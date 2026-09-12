"""Face detection + alignment using InsightFace's RetinaFace (det_10g, from buffalo_l)."""

from dataclasses import dataclass

import numpy as np
import onnxruntime
from insightface.model_zoo import get_model
from insightface.utils import face_align
from insightface.utils.storage import ensure_available

# silence a benign onnxruntime shape-hint warning triggered by using a
# non-default det_size with det_10g.onnx (output shape is still correct)
onnxruntime.set_default_logger_severity(3)


@dataclass
class DetectedFace:
    bbox: np.ndarray  # [x1, y1, x2, y2]
    kps: np.ndarray  # 5x2 landmarks
    det_score: float


class RetinaFace:
    def __init__(
        self,
        model_name: str = "buffalo_l",
        ctx_id: int = -1,
        det_thresh: float = 0.5,
        det_size: tuple[int, int] = (640, 640),
    ):
        """ctx_id: -1 for CPU, >=0 for GPU device id."""
        model_dir = ensure_available("models", model_name)
        self.model = get_model(f"{model_dir}/det_10g.onnx")
        self.model.prepare(ctx_id=ctx_id, det_thresh=det_thresh, input_size=det_size)

    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        """image: BGR image (as loaded by cv2.imread)."""
        bboxes, kpss = self.model.detect(image, max_num=0)
        faces = []
        for i in range(bboxes.shape[0]):
            faces.append(
                DetectedFace(
                    bbox=bboxes[i, :4],
                    kps=kpss[i] if kpss is not None else None,
                    det_score=float(bboxes[i, 4]),
                )
            )
        return faces

    @staticmethod
    def align(image: np.ndarray, kps: np.ndarray, image_size: int = 112) -> np.ndarray:
        """Warp a detected face to a canonical `image_size`x`image_size` crop using its landmarks."""
        return face_align.norm_crop(image, landmark=kps, image_size=image_size)
