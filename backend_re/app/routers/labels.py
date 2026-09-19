from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.logger import get_logger
from app.models import Annotation, Label
from app.schemas import LabelCreate, LabelOut

router = APIRouter(prefix="/api/labels", tags=["labels"], dependencies=[Depends(get_current_user)])
logger = get_logger(__name__)


@router.get("", response_model=list[LabelOut])
async def list_labels(db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(Label).order_by(Label.name))).all()


@router.post("", response_model=LabelOut, status_code=status.HTTP_201_CREATED)
async def create_label(payload: LabelCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Label).where(Label.name == payload.name))
    if existing:
        logger.warning("Attempted to create duplicate label %r", payload.name)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Label already exists")

    label = Label(name=payload.name, color=payload.color)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    logger.info("Created label %r (id=%s)", label.name, label.id)
    return label


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(label_id: str, db: AsyncSession = Depends(get_db)):
    label = await db.get(Label, label_id)
    if not label:
        logger.warning("Delete requested for missing label_id=%r", label_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    in_use = await db.scalar(select(Annotation.id).where(Annotation.label_id == label_id).limit(1))
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Label is used by existing annotations and cannot be deleted",
        )

    await db.delete(label)
    await db.commit()
    logger.info("Deleted label %r (id=%s)", label.name, label_id)
