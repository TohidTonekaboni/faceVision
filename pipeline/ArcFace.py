"""Face detection + ArcFace embedding wrapper built on InsightFace.

Uses InsightFace's `buffalo_l` bundle: RetinaFace for detection/landmarks,
ArcFace (w600k_r50) for 512-d embeddings.
"""

from dataclasses import dataclass

import numpy as np
from insightface.app import FaceAnalysis


@dataclass
class DetectedFace:
    bbox: np.ndarray  # [x1, y1, x2, y2]
    kps: np.ndarray  # 5x2 landmarks
    det_score: float
    embedding: np.ndarray  # 512-d ArcFace embedding


class ArcFace:
    def __init__(self, model_name: str = "buffalo_l", ctx_id: int = -1, det_size: tuple[int, int] = (640, 640)):
        """ctx_id: -1 for CPU, >=0 for GPU device id."""
        self.app = FaceAnalysis(name=model_name)
        self.app.prepare(ctx_id=ctx_id, det_size=det_size)

    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        """image: BGR image (as loaded by cv2.imread)."""
        faces = self.app.get(image)
        return [
            DetectedFace(
                bbox=face.bbox,
                kps=face.kps,
                det_score=float(face.det_score),
                embedding=face.normed_embedding,
            )
            for face in faces
        ]

    @staticmethod
    def cosine_similarity(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        return float(np.dot(embedding_a, embedding_b))
