"""ArcFace embedding wrapper built on InsightFace (w600k_r50, from buffalo_l).

Takes an already-aligned 112x112 face crop (see RetinaFace.align) and
returns a 512-d normalized embedding.
"""

import numpy as np
from insightface.model_zoo import get_model
from insightface.utils.storage import ensure_available


class ArcFace:
    def __init__(self, model_name: str = "buffalo_l", ctx_id: int = -1):
        """ctx_id: -1 for CPU, >=0 for GPU device id."""
        model_dir = ensure_available("models", model_name)
        self.model = get_model(f"{model_dir}/w600k_r50.onnx")
        self.model.prepare(ctx_id=ctx_id)

    def embed(self, aligned_face: np.ndarray) -> np.ndarray:
        """aligned_face: 112x112 BGR crop, e.g. from RetinaFace.align()."""
        feat = self.model.get_feat(aligned_face).flatten()
        return feat / np.linalg.norm(feat)

    @staticmethod
    def cosine_similarity(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        return float(np.dot(embedding_a, embedding_b))
