"""Runs the trained YOLO detection model against a single frame.

The model is loaded once, lazily, on first use and reused for every
subsequent request — loading YOLO weights takes real time (disk + building
the network), which would otherwise happen on every inference call.
"""

import threading

import cv2
import numpy as np
from ultralytics import YOLO

from app.config import settings
from app.logger import get_logger

logger = get_logger(__name__)

_model: YOLO | None = None
_model_lock = threading.Lock()


def _get_model() -> YOLO:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                logger.info("Loading inference model from %s", settings.inference_model_path)
                _model = YOLO(settings.inference_model_path)
    return _model


def run_inference(frame: np.ndarray) -> tuple[bytes, list[dict]]:
    """Runs detection on a decoded BGR frame. Returns the JPEG-encoded,
    annotated frame plus a list of detections (label, confidence, and
    pixel bounding box in x/y/width/height form)."""
    model = _get_model()
    result = model.predict(frame, conf=settings.inference_confidence_threshold, verbose=False)[0]

    detections = []
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        detections.append(
            {
                "label": result.names[int(box.cls[0])],
                "confidence": round(float(box.conf[0]), 4),
                "x": round(x1, 2),
                "y": round(y1, 2),
                "width": round(x2 - x1, 2),
                "height": round(y2 - y1, 2),
            }
        )

    annotated = result.plot()
    ok, buffer = cv2.imencode(".jpg", annotated)
    if not ok:
        raise RuntimeError("Could not encode annotated inference frame")
    return buffer.tobytes(), detections
