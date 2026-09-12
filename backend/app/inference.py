"""Runs the RetinaFace + ArcFace face-recognition pipeline against a single
frame: detect faces, align each to a canonical crop, embed it with ArcFace,
and identify it against the enrolled gallery via cosine similarity.

The models and gallery are loaded once, lazily, on first use and reused for
every subsequent request — loading them (including downloading the
"buffalo_l" model pack on first run) takes real time, which would otherwise
happen on every inference call.
"""

import threading

import cv2
import numpy as np

from app.config import settings
from app.face_pipeline.arcface import ArcFace
from app.face_pipeline.gallery import Gallery
from app.face_pipeline.retinaface import RetinaFace
from app.logger import get_logger

logger = get_logger(__name__)

_detector: RetinaFace | None = None
_embedder: ArcFace | None = None
_gallery: Gallery | None = None
_model_lock = threading.Lock()


def _get_models() -> tuple[RetinaFace, ArcFace, Gallery]:
    global _detector, _embedder, _gallery
    if _detector is None or _embedder is None or _gallery is None:
        with _model_lock:
            if _detector is None:
                logger.info("Loading RetinaFace detector (%s)", settings.face_model_pack)
                _detector = RetinaFace(
                    model_name=settings.face_model_pack,
                    ctx_id=settings.face_ctx_id,
                    det_thresh=settings.face_det_thresh,
                )
            if _embedder is None:
                logger.info("Loading ArcFace embedder (%s)", settings.face_model_pack)
                _embedder = ArcFace(model_name=settings.face_model_pack, ctx_id=settings.face_ctx_id)
            if _gallery is None:
                logger.info("Loading face gallery from %s", settings.face_gallery_path)
                _gallery = Gallery(settings.face_gallery_path)
    return _detector, _embedder, _gallery


def _draw_detection(frame: np.ndarray, x1: float, y1: float, x2: float, y2: float, label: str, score: float) -> None:
    color = (0, 0, 255) if label == "unknown" else (0, 200, 0)
    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
    caption = f"{label} {score:.2f}"
    cv2.putText(frame, caption, (int(x1), max(int(y1) - 8, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)


def run_inference(frame: np.ndarray) -> tuple[bytes, list[dict]]:
    """Runs face detection + recognition on a decoded BGR frame. Returns the
    JPEG-encoded, annotated frame plus a list of detections (identified
    label, similarity score, and pixel bounding box in x/y/width/height
    form)."""
    detector, embedder, gallery = _get_models()
    faces = detector.detect(frame)

    annotated = frame.copy()
    detections = []
    for face in faces:
        x1, y1, x2, y2 = face.bbox.tolist()

        label, score = "unknown", face.det_score
        if face.kps is not None:
            aligned = RetinaFace.align(frame, face.kps)
            embedding = embedder.embed(aligned)
            match = gallery.identify(embedding, threshold=settings.face_identify_threshold)
            label, score = match.label, match.score

        _draw_detection(annotated, x1, y1, x2, y2, label, score)
        detections.append(
            {
                "label": label,
                "confidence": round(score, 4),
                "x": round(x1, 2),
                "y": round(y1, 2),
                "width": round(x2 - x1, 2),
                "height": round(y2 - y1, 2),
            }
        )

    ok, buffer = cv2.imencode(".jpg", annotated)
    if not ok:
        raise RuntimeError("Could not encode annotated inference frame")
    return buffer.tobytes(), detections
