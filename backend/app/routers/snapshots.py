import os

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, oauth2_scheme, resolve_media_user
from app.logger import get_logger
from app.models import Annotation, Snapshot, User
from app.schemas import SnapshotOut, StreamToken
from app.security import create_media_token

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])
logger = get_logger(__name__)


@router.get("", response_model=list[SnapshotOut], dependencies=[Depends(get_current_user)])
async def list_snapshots(
    camera_id: str | None = None,
    is_annotated: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Snapshot)
    if camera_id is not None:
        query = query.where(Snapshot.camera_id == camera_id)
    if is_annotated is not None:
        query = query.where(Snapshot.is_annotated == is_annotated)
    return (await db.scalars(query.order_by(Snapshot.created_at.desc()))).all()


@router.post("/{snapshot_id}/image-token", response_model=StreamToken)
async def create_image_token(
    snapshot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await db.get(Snapshot, snapshot_id)
    if not snapshot:
        logger.warning("Image token requested for missing snapshot_id=%r", snapshot_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    token = create_media_token(current_user.id, f"snapshot:{snapshot_id}")
    return StreamToken(token=token, expires_in=settings.media_token_expire_seconds)


@router.post("/{snapshot_id}/complete", response_model=SnapshotOut)
async def complete_snapshot(
    snapshot_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marks a snapshot as annotated, removing it from the unannotated list.
    Explicit and separate from annotation creation so a snapshot can hold
    several in-progress boxes — drawn and deletable one at a time — while
    still showing up as unfinished, until the user deliberately saves."""
    snapshot = await db.get(Snapshot, snapshot_id)
    if not snapshot:
        logger.warning("Complete requested for missing snapshot_id=%r", snapshot_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")

    has_annotation = await db.scalar(select(Annotation.id).where(Annotation.snapshot_id == snapshot_id).limit(1))
    if not has_annotation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draw at least one bounding box before saving",
        )

    snapshot.is_annotated = True
    await db.commit()
    await db.refresh(snapshot)
    logger.info("Marked snapshot %r as annotated", snapshot_id)
    return snapshot


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot(
    snapshot_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await db.get(Snapshot, snapshot_id)
    if not snapshot:
        logger.warning("Delete requested for missing snapshot_id=%r", snapshot_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")

    image_path = snapshot.image_path
    await db.delete(snapshot)
    await db.commit()

    if image_path and os.path.exists(image_path):
        try:
            os.remove(image_path)
        except OSError:
            logger.warning("Could not remove snapshot image file %r", image_path)

    logger.info("Deleted snapshot %r", snapshot_id)


@router.get("/{snapshot_id}/image")
async def get_snapshot_image(
    snapshot_id: str,
    token_header: str | None = Depends(oauth2_scheme),
    token_query: str | None = Query(default=None, alias="token"),
    db: AsyncSession = Depends(get_db),
):
    await resolve_media_user(token_header or token_query, f"snapshot:{snapshot_id}", db)
    snapshot = await db.get(Snapshot, snapshot_id)
    if not snapshot or not os.path.exists(snapshot.image_path):
        logger.warning("Image file missing for snapshot_id=%r", snapshot_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot image not found")
    return FileResponse(snapshot.image_path, media_type="image/jpeg")
