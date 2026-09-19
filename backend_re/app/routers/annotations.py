from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.logger import get_logger
from app.models import Annotation, Snapshot
from app.schemas import AnnotationCreate, AnnotationOut

router = APIRouter(prefix="/api/annotations", tags=["annotations"], dependencies=[Depends(get_current_user)])
logger = get_logger(__name__)


@router.get("", response_model=list[AnnotationOut])
async def list_annotations(snapshot_id: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Annotation)
    if snapshot_id:
        query = query.where(Annotation.snapshot_id == snapshot_id)
    return (await db.scalars(query.order_by(Annotation.created_at))).all()


@router.post("", response_model=AnnotationOut, status_code=status.HTTP_201_CREATED)
async def create_annotation(payload: AnnotationCreate, db: AsyncSession = Depends(get_db)):
    snapshot = await db.get(Snapshot, payload.snapshot_id)
    if not snapshot:
        logger.warning("Annotation requested for missing snapshot_id=%r", payload.snapshot_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")

    annotation = Annotation(**payload.model_dump())
    db.add(annotation)
    # Deliberately does not flip snapshot.is_annotated here — that happens
    # only when the user explicitly saves (POST /api/snapshots/{id}/complete),
    # so a snapshot stays in the unannotated list while multiple boxes are
    # still being drawn on it.
    await db.commit()
    await db.refresh(annotation)
    logger.info("Created annotation %r for snapshot %r", annotation.id, snapshot.id)
    return annotation


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(annotation_id: str, db: AsyncSession = Depends(get_db)):
    annotation = await db.get(Annotation, annotation_id)
    if not annotation:
        logger.warning("Delete requested for missing annotation_id=%r", annotation_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    await db.delete(annotation)
    await db.commit()
    logger.info("Deleted annotation %r", annotation_id)
