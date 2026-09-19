import base64

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.inference import run_inference
from app.logger import get_logger
from app.models import InferenceRun, User
from app.schemas import InferenceResult, InferenceRunOut

router = APIRouter(prefix="/api/inference", tags=["inference"])
logger = get_logger(__name__)


def _decode_upload(data: bytes) -> np.ndarray:
    array = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(array, cv2.IMREAD_COLOR)


@router.post("/image", response_model=InferenceResult)
async def run_offline_inference(
    file: UploadFile, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    data = await file.read()
    if len(data) > settings.max_offline_inference_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds the maximum upload size",
        )

    frame = await run_in_threadpool(_decode_upload, data)
    if frame is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not decode image")

    jpeg_bytes, detections = await run_in_threadpool(run_inference, frame)
    logger.info("Ran offline inference on uploaded image %r, %d detection(s)", file.filename, len(detections))

    run = InferenceRun(filename=file.filename or "upload.jpg", detection_count=len(detections))
    db.add(run)
    await db.commit()

    return InferenceResult(image=base64.b64encode(jpeg_bytes).decode("ascii"), detections=detections)


@router.get("/history", response_model=list[InferenceRunOut])
async def get_inference_history(
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    runs = (
        await db.scalars(select(InferenceRun).order_by(InferenceRun.created_at.desc()).limit(limit))
    ).all()
    return runs
