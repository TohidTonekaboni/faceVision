import asyncio
import base64
import re
import time
import uuid
from urllib.parse import quote

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.camera_stream import (
    READY_TIMEOUT_SECONDS,
    StreamCapacityError,
    _CAPTURE_TIMEOUT_PARAMS,
    _SharedCameraStream,
    camera_stream_hub,
)
from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import get_current_user, oauth2_scheme, require_admin, resolve_media_user
from app.inference import run_inference
from app.logger import get_logger
from app.models import Camera, Snapshot, User
from app.schemas import Camera as CameraSchema
from app.schemas import InferenceResult, SnapshotBatchRequest, SnapshotBatchResult, SnapshotOut, StreamToken
from app.security import create_media_token, decrypt_camera_password

router = APIRouter(prefix="/api/cameras", tags=["cameras"])
logger = get_logger(__name__)

FRAME_INTERVAL_SECONDS = 1 / 15

# Cameras kept warm for an active snapshot session: camera_id -> (stream,
# last time a snapshot tick actually used it). A snapshot session's whole
# point is to poll every ~1s for potentially a long time, so — unlike a
# one-off /snapshot call — it's worth paying for one persistent RTSP
# connection per camera up front instead of a fresh connect+handshake every
# tick. This matters most for a multi-channel NVR (several "cameras" that
# are really channels of one device): that handshake is exactly what such a
# device's low concurrent-session cap punishes hardest, since every tick
# opens N connections against it at once rather than N connections total.
_session_streams: dict[str, tuple[_SharedCameraStream, float]] = {}
# Bounds the leak if a session's stop endpoint is never called (browser
# crash, network drop) — comfortably above the 1s tick interval so a live
# session is never mistaken for an abandoned one.
_SESSION_STREAM_TTL_SECONDS = 30.0


def _sweep_expired_session_streams() -> None:
    now = time.monotonic()
    expired = [camera_id for camera_id, (_, last_used) in _session_streams.items() if now - last_used > _SESSION_STREAM_TTL_SECONDS]
    for camera_id in expired:
        stream, _ = _session_streams.pop(camera_id)
        camera_stream_hub.release(camera_id, stream)
        logger.info(
            "Released idle persistent snapshot stream for camera_id=%r (no snapshot tick for %.0fs)",
            camera_id,
            _SESSION_STREAM_TTL_SECONDS,
        )


def _build_rtsp_url(camera: Camera) -> str:
    auth = ""
    if camera.username:
        user_part = quote(camera.username, safe="")
        password = decrypt_camera_password(camera.password_encrypted) if camera.password_encrypted else ""
        auth = f"{user_part}:{quote(password, safe='')}@" if password else f"{user_part}@"

    path = camera.path or ""
    if path and not path.startswith("/"):
        path = f"/{path}"

    return f"rtsp://{auth}{camera.host}:{camera.port}{path}"


async def _get_camera_or_404(camera_id: str, db: AsyncSession) -> Camera:
    camera = await db.get(Camera, camera_id)
    if not camera:
        logger.warning("Request for missing camera_id=%r", camera_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return camera


def _redact_rtsp_url(rtsp_url: str) -> str:
    """Strips any embedded credentials before the URL is logged."""
    return re.sub(r"rtsp://[^@]+@", "rtsp://", rtsp_url)


async def _mjpeg_frames(camera_id: str, stream: _SharedCameraStream):
    """Polls the shared stream's latest already-encoded JPEG at the target
    frame rate. Encoding happens once per camera (in the stream's background
    thread), not once per viewer — this generator only copies bytes."""
    try:
        while True:
            frame_bytes = stream.latest_jpeg()
            if frame_bytes is not None:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            await asyncio.sleep(FRAME_INTERVAL_SECONDS)
    finally:
        camera_stream_hub.release(camera_id, stream)


def _capture_single_frame(rtsp_url: str):
    capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG, _CAPTURE_TIMEOUT_PARAMS)
    try:
        if not capture.isOpened():
            logger.error("Could not open camera stream at %s", _redact_rtsp_url(rtsp_url))
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not open camera stream")
        ok, frame = capture.read()
        if not ok:
            logger.error("Could not read frame from camera at %s", _redact_rtsp_url(rtsp_url))
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not read frame from camera")
        return frame
    finally:
        capture.release()


def _decode_jpeg(jpeg_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    return cv2.imdecode(array, cv2.IMREAD_COLOR)


async def _get_current_frame(cam: Camera) -> np.ndarray:
    """Same live-stream-reuse-first strategy as snapshots (see take_snapshot)."""
    jpeg_bytes = camera_stream_hub.peek_latest_jpeg(cam.id)
    if jpeg_bytes is not None:
        return await run_in_threadpool(_decode_jpeg, jpeg_bytes)
    return await run_in_threadpool(_capture_single_frame, _build_rtsp_url(cam))


def _decode_jpeg_dimensions(jpeg_bytes: bytes) -> tuple[int, int]:
    array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_UNCHANGED)
    height, width = image.shape[:2]
    return height, width


def _write_snapshot_file(data: bytes, image_path: str) -> None:
    with open(image_path, "wb") as f:
        f.write(data)


@router.get("", response_model=list[CameraSchema])
async def list_cameras(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    cameras = (await db.scalars(select(Camera).where(Camera.is_active.is_(True)).order_by(Camera.name))).all()
    return [CameraSchema(id=c.id, name=c.name, is_active=c.is_active) for c in cameras]


@router.post("/{camera_id}/stream-token", response_model=StreamToken)
async def create_stream_token(
    camera_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    await _get_camera_or_404(camera_id, db)
    token = create_media_token(current_user.id, f"camera:{camera_id}")
    return StreamToken(token=token, expires_in=settings.media_token_expire_seconds)


@router.get("/{camera_id}/stream")
async def stream_camera(
    camera_id: str,
    token_header: str | None = Depends(oauth2_scheme),
    token_query: str | None = Query(default=None, alias="token"),
    db: AsyncSession = Depends(get_db),
):
    await resolve_media_user(token_header or token_query, f"camera:{camera_id}", db)
    cam = await _get_camera_or_404(camera_id, db)
    rtsp_url = _build_rtsp_url(cam)

    try:
        stream = camera_stream_hub.acquire(cam.id, rtsp_url, _redact_rtsp_url(rtsp_url))
    except StreamCapacityError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Too many concurrent camera streams; try again later",
        )

    ready = await run_in_threadpool(stream.wait_ready, READY_TIMEOUT_SECONDS)
    if not ready or not stream.has_frame():
        camera_stream_hub.release(cam.id, stream)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not open camera stream")

    logger.info("Started stream for camera %r", cam.name)
    return StreamingResponse(_mjpeg_frames(cam.id, stream), media_type="multipart/x-mixed-replace; boundary=frame")


async def _capture_frame_jpeg(cam: Camera) -> tuple[bytes, int, int]:
    """Does all the slow I/O (RTSP connect+read can cost seconds) with no DB
    session involved at all, so nothing holds a pooled connection open while
    waiting on a camera."""
    # Reuse an already-open live view's latest decoded frame when one exists,
    # instead of always paying for a brand-new RTSP connection — a fresh
    # connect+handshake commonly costs 0.5-3s even on a healthy camera, and
    # the live-view stream already has a continuously-updated frame in memory.
    jpeg_bytes = camera_stream_hub.peek_latest_jpeg(cam.id)
    if jpeg_bytes is not None:
        session_entry = _session_streams.get(cam.id)
        if session_entry is not None:
            _session_streams[cam.id] = (session_entry[0], time.monotonic())
        height, width = await run_in_threadpool(_decode_jpeg_dimensions, jpeg_bytes)
    else:
        frame = await run_in_threadpool(_capture_single_frame, _build_rtsp_url(cam))
        height, width = frame.shape[:2]
        ok, buffer = await run_in_threadpool(cv2.imencode, ".jpg", frame)
        jpeg_bytes = buffer.tobytes()
    return jpeg_bytes, width, height


async def _persist_snapshot(cam: Camera, jpeg_bytes: bytes, width: int, height: int, db: AsyncSession) -> Snapshot:
    """Only the fast part (file write + one insert) touches the DB, so a
    session for this is held open for milliseconds, not for however long the
    camera took to respond."""
    filename = f"{uuid.uuid4()}.jpg"
    image_path = f"{settings.snapshot_dir}/{filename}"
    await run_in_threadpool(_write_snapshot_file, jpeg_bytes, image_path)

    snapshot = Snapshot(
        camera_id=cam.id, camera_name=cam.name, image_path=image_path, image_width=width, image_height=height
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    logger.info("Captured snapshot %r for camera %r", snapshot.id, cam.name)
    return snapshot


async def _capture_and_store_snapshot(cam: Camera, db: AsyncSession) -> Snapshot:
    jpeg_bytes, width, height = await _capture_frame_jpeg(cam)
    return await _persist_snapshot(cam, jpeg_bytes, width, height, db)


@router.post("/{camera_id}/snapshot", response_model=SnapshotOut, status_code=status.HTTP_201_CREATED)
async def take_snapshot(camera_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    cam = await _get_camera_or_404(camera_id, db)
    return await _capture_and_store_snapshot(cam, db)


@router.post("/snapshot-session/start", response_model=list[str])
async def start_snapshot_session(
    payload: SnapshotBatchRequest, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)
) -> list[str]:
    """Opens (or reuses) a persistent RTSP connection per listed camera and
    keeps it warm — call once when a snapshot session starts, and again
    with the same camera_ids if the selection changes, then call
    /snapshot-session/stop when the session ends. Idempotent per camera:
    calling this again for a camera that's already warm just refreshes it.
    Returns the subset of camera_ids that are now warm (a camera can be
    skipped if it doesn't exist or the server is already at its concurrent
    stream cap — snapshot-batch still works for it, just without the warm
    connection).
    """
    _sweep_expired_session_streams()
    started: list[str] = []
    now = time.monotonic()
    for camera_id in dict.fromkeys(payload.camera_ids):
        existing = _session_streams.get(camera_id)
        if existing is not None:
            _session_streams[camera_id] = (existing[0], now)
            started.append(camera_id)
            continue

        camera = await db.get(Camera, camera_id)
        if camera is None:
            continue
        rtsp_url = _build_rtsp_url(camera)
        try:
            stream = camera_stream_hub.acquire(camera_id, rtsp_url, _redact_rtsp_url(rtsp_url))
        except StreamCapacityError:
            logger.warning("Could not warm a persistent snapshot stream for camera_id=%r: at capacity", camera_id)
            continue
        _session_streams[camera_id] = (stream, now)
        started.append(camera_id)
    return started


@router.post("/snapshot-session/stop", status_code=status.HTTP_204_NO_CONTENT)
async def stop_snapshot_session(payload: SnapshotBatchRequest, _: User = Depends(require_admin)) -> None:
    for camera_id in payload.camera_ids:
        entry = _session_streams.pop(camera_id, None)
        if entry is not None:
            camera_stream_hub.release(camera_id, entry[0])


@router.post("/snapshot-batch", response_model=list[SnapshotBatchResult])
async def take_snapshot_batch(
    payload: SnapshotBatchRequest, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)
):
    """Captures a snapshot from every listed camera concurrently (one task
    per camera via asyncio.gather) instead of one at a time, so wall-clock
    time for a multi-camera snapshot tick is bounded by the slowest camera
    rather than the sum of all of them. One camera failing (offline, RTSP
    timeout, etc) is reported per-item and doesn't fail the others.

    Camera rows are looked up up front on the request's own session (cheap,
    sequential — no slow I/O involved). Each concurrent task then opens its
    own short-lived session (AsyncSession isn't safe for concurrent use)
    strictly around its own insert, never around the RTSP fetch — holding a
    pooled connection open for the multi-second duration of a camera capture
    is what exhausts the pool when several cameras/ticks overlap.
    """
    _sweep_expired_session_streams()
    cameras_by_id: dict[str, Camera] = {}
    for camera_id in dict.fromkeys(payload.camera_ids):  # de-dup, keep order
        camera = await db.get(Camera, camera_id)
        if camera is not None:
            cameras_by_id[camera_id] = camera

    async def _run(camera_id: str) -> SnapshotBatchResult:
        cam = cameras_by_id.get(camera_id)
        if cam is None:
            return SnapshotBatchResult(camera_id=camera_id, error="Camera not found")
        try:
            jpeg_bytes, width, height = await _capture_frame_jpeg(cam)
        except HTTPException as exc:
            return SnapshotBatchResult(camera_id=camera_id, error=str(exc.detail))

        async with SessionLocal() as isolated_db:
            snapshot = await _persist_snapshot(cam, jpeg_bytes, width, height, isolated_db)
        return SnapshotBatchResult(camera_id=camera_id, snapshot=SnapshotOut.model_validate(snapshot))

    return list(await asyncio.gather(*(_run(camera_id) for camera_id in payload.camera_ids)))


@router.post("/{camera_id}/inference", response_model=InferenceResult)
async def run_camera_inference(camera_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    cam = await _get_camera_or_404(camera_id, db)
    frame = await _get_current_frame(cam)

    jpeg_bytes, detections = await run_in_threadpool(run_inference, frame)
    logger.info("Ran inference for camera %r, %d detection(s)", cam.name, len(detections))

    return InferenceResult(image=base64.b64encode(jpeg_bytes).decode("ascii"), detections=detections)
