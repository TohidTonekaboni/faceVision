from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin
from app.logger import get_logger
from app.models import Camera
from app.schemas import CameraCreate, CameraOut, CameraUpdate
from app.security import encrypt_camera_password

router = APIRouter(prefix="/api/camera-admin", tags=["camera-admin"], dependencies=[Depends(require_admin)])
logger = get_logger(__name__)


def _to_out(camera: Camera) -> CameraOut:
    return CameraOut(
        id=camera.id,
        name=camera.name,
        host=camera.host,
        port=camera.port,
        path=camera.path,
        username=camera.username,
        has_password=bool(camera.password_encrypted),
        is_active=camera.is_active,
        created_at=camera.created_at,
        updated_at=camera.updated_at,
    )


@router.get("", response_model=list[CameraOut])
async def list_all_cameras(db: AsyncSession = Depends(get_db)):
    cameras = (await db.scalars(select(Camera).order_by(Camera.created_at))).all()
    return [_to_out(c) for c in cameras]


@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
async def create_camera(payload: CameraCreate, db: AsyncSession = Depends(get_db)):
    camera = Camera(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        path=payload.path,
        username=payload.username or None,
        password_encrypted=encrypt_camera_password(payload.password) if payload.password else None,
        is_active=payload.is_active,
    )
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    logger.info("Created camera %r (id=%s)", camera.name, camera.id)
    return _to_out(camera)


@router.patch("/{camera_id}", response_model=CameraOut)
async def update_camera(camera_id: str, payload: CameraUpdate, db: AsyncSession = Depends(get_db)):
    camera = await db.get(Camera, camera_id)
    if not camera:
        logger.warning("Update requested for missing camera_id=%r", camera_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        password = data.pop("password")
        camera.password_encrypted = encrypt_camera_password(password) if password else None
    if "username" in data and not data["username"]:
        data["username"] = None
    for field, value in data.items():
        setattr(camera, field, value)

    await db.commit()
    await db.refresh(camera)
    logger.info("Updated camera %r (id=%s)", camera.name, camera.id)
    return _to_out(camera)


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    camera = await db.get(Camera, camera_id)
    if not camera:
        logger.warning("Delete requested for missing camera_id=%r", camera_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    await db.delete(camera)
    await db.commit()
    logger.info("Deleted camera %r (id=%s)", camera.name, camera.id)
