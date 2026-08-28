"""Shared camera capture layer.

Each camera has at most one cv2.VideoCapture and one background reader
thread, regardless of how many viewers are watching it — viewers subscribe
to the same _SharedCameraStream instead of each opening their own RTSP
session. This keeps RTSP connections/decoding at O(cameras) instead of
O(cameras * viewers), which matters because many cameras cap concurrent
RTSP sessions at 2-4 and will start dropping or degrading streams past that.
"""

import os
import threading
import time

# Must be set before any cv2.VideoCapture is created: OpenCV's FFmpeg backend
# defaults to UDP for RTSP, which some cameras (e.g. this Dahua unit) reject
# outright, causing capture.read() to fail instantly despite isOpened() being
# True. Forcing TCP matches how `ffprobe`/`ffmpeg` negotiate by default.
# nobuffer/low_delay/max_delay keep FFmpeg's internal RTSP buffer from
# accumulating stale frames, which otherwise makes the stream's delay grow
# the longer a viewer stays connected.
os.environ.setdefault(
    "OPENCV_FFMPEG_CAPTURE_OPTIONS",
    "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;500000",
)

import cv2

from app.config import settings
from app.logger import get_logger

logger = get_logger(__name__)

INITIAL_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 30.0
IDLE_GRACE_SECONDS = 5.0
READY_TIMEOUT_SECONDS = 10.0

# Bounds how long a single open/read attempt can block (OpenCV's own
# interrupt-callback timeout, not an FFmpeg option — separate from the
# rtsp_transport/nobuffer options above). Without this, OpenCV defaults to
# ~30s per attempt, so an unreachable camera (wrong network, offline, etc.)
# ties up a thread for 30s on every attempt, and the reconnect loop below
# repeats that indefinitely — sustained load that has been observed to
# destabilize Docker Desktop's VM network proxy.
CAPTURE_OPEN_TIMEOUT_MSEC = 5000
CAPTURE_READ_TIMEOUT_MSEC = 5000
_CAPTURE_TIMEOUT_PARAMS = [
    cv2.CAP_PROP_OPEN_TIMEOUT_MSEC,
    CAPTURE_OPEN_TIMEOUT_MSEC,
    cv2.CAP_PROP_READ_TIMEOUT_MSEC,
    CAPTURE_READ_TIMEOUT_MSEC,
]


class StreamCapacityError(Exception):
    """Raised when the server is already running the maximum number of
    concurrent camera captures and cannot open another one."""


class _SharedCameraStream:
    """Owns one cv2.VideoCapture for one camera. A single background thread
    reads frames, JPEG-encodes each one once, and reconnects with
    exponential backoff on failure or disconnect — independent of how many
    viewers are attached. Viewers only ever read the latest encoded frame."""

    def __init__(self, camera_id: str, rtsp_url: str, redacted_url: str):
        self.camera_id = camera_id
        self._rtsp_url = rtsp_url
        self._redacted_url = redacted_url

        self._lock = threading.Lock()
        self._latest_jpeg: bytes | None = None
        self._frame_version = 0
        self._refcount = 0
        self._idle_since: float | None = None

        self._ready_event = threading.Event()
        self._stop_event = threading.Event()

        self._thread = threading.Thread(
            target=self._run, name=f"camera-stream-{camera_id}", daemon=True
        )
        self._thread.start()

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def acquire(self) -> None:
        with self._lock:
            self._refcount += 1
            self._idle_since = None

    def release(self) -> None:
        with self._lock:
            self._refcount = max(0, self._refcount - 1)
            if self._refcount == 0:
                self._idle_since = time.monotonic()

    def has_frame(self) -> bool:
        with self._lock:
            return self._latest_jpeg is not None

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._latest_jpeg

    def wait_ready(self, timeout: float) -> bool:
        """Blocks until the first open attempt has either produced a frame
        or failed. Does not wait for later reconnect attempts — those
        continue in the background regardless of whether anyone is waiting."""
        return self._ready_event.wait(timeout)

    def stop(self) -> None:
        self._stop_event.set()

    def _is_idle_expired(self) -> bool:
        with self._lock:
            return self._idle_since is not None and (time.monotonic() - self._idle_since) > IDLE_GRACE_SECONDS

    def _wait_before_retry(self, seconds: float) -> bool:
        """Sleeps up to `seconds`, waking early to stop if the stream is
        signaled to stop or has had no viewers for longer than the idle
        grace period. Returns True if the caller should stop."""
        deadline = time.monotonic() + seconds
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            if self._stop_event.wait(min(1.0, remaining)):
                return True
            if self._is_idle_expired():
                return True

    def _run(self) -> None:
        backoff = INITIAL_BACKOFF_SECONDS
        while not self._stop_event.is_set():
            capture = cv2.VideoCapture(self._rtsp_url, cv2.CAP_FFMPEG, _CAPTURE_TIMEOUT_PARAMS)
            if not capture.isOpened():
                capture.release()
                logger.warning(
                    "Could not open camera stream at %s, retrying in %.1fs", self._redacted_url, backoff
                )
                self._ready_event.set()
                if self._wait_before_retry(backoff):
                    break
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                continue

            logger.info("Opened camera stream for camera_id=%r", self.camera_id)
            backoff = INITIAL_BACKOFF_SECONDS
            while not self._stop_event.is_set():
                if self._is_idle_expired():
                    self._stop_event.set()
                    break
                ok, frame = capture.read()
                if not ok:
                    logger.warning("Lost camera stream for camera_id=%r, reconnecting", self.camera_id)
                    break
                encode_ok, buffer = cv2.imencode(".jpg", frame)
                if encode_ok:
                    with self._lock:
                        self._latest_jpeg = buffer.tobytes()
                        self._frame_version += 1
                    self._ready_event.set()
            capture.release()

            if self._stop_event.is_set():
                break
            if self._wait_before_retry(backoff):
                break
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)

        logger.info("Stopped camera stream for camera_id=%r", self.camera_id)


class CameraStreamHub:
    """Registry of shared streams, one per camera_id, with a global cap on
    how many can be open at once so a burst of viewers across many cameras
    can't exhaust FFmpeg processes/RTSP sessions on the host."""

    def __init__(self, max_concurrent_streams: int):
        self._lock = threading.Lock()
        self._streams: dict[str, _SharedCameraStream] = {}
        self._max_concurrent_streams = max_concurrent_streams

    def _prune_dead_streams(self) -> None:
        """Drops entries whose background thread has already stopped (idle
        timeout or fatal stop). Without this, a stream that idled out stays
        counted against the concurrency cap until that same camera_id happens
        to be re-acquired, permanently wasting capacity."""
        dead_ids = [camera_id for camera_id, stream in self._streams.items() if not stream.is_alive()]
        for camera_id in dead_ids:
            del self._streams[camera_id]

    def acquire(self, camera_id: str, rtsp_url: str, redacted_url: str) -> _SharedCameraStream:
        with self._lock:
            self._prune_dead_streams()
            stream = self._streams.get(camera_id)
            if stream is None:
                if len(self._streams) >= self._max_concurrent_streams:
                    raise StreamCapacityError(
                        f"Already running {self._max_concurrent_streams} concurrent camera streams"
                    )
                stream = _SharedCameraStream(camera_id, rtsp_url, redacted_url)
                self._streams[camera_id] = stream
            stream.acquire()
            return stream

    def peek_latest_jpeg(self, camera_id: str) -> bytes | None:
        """Returns the shared stream's most recent encoded frame for this
        camera without acquiring/holding a reference (no effect on refcount
        or idle timeout). Lets a snapshot reuse an already-open live view's
        decoded frame instead of paying for a brand-new RTSP connection.
        Returns None if no stream is currently running for this camera —
        callers should fall back to a one-off capture in that case."""
        with self._lock:
            stream = self._streams.get(camera_id)
        if stream is None or not stream.is_alive():
            return None
        return stream.latest_jpeg()

    def release(self, camera_id: str, stream: _SharedCameraStream) -> None:
        stream.release()
        with self._lock:
            if not stream.is_alive() and self._streams.get(camera_id) is stream:
                del self._streams[camera_id]

    def stop_all(self) -> None:
        with self._lock:
            streams = list(self._streams.values())
            self._streams.clear()
        for stream in streams:
            stream.stop()


camera_stream_hub = CameraStreamHub(max_concurrent_streams=settings.max_concurrent_camera_streams)
