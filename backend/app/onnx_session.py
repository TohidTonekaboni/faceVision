"""Shared ONNX Runtime session construction for CPU-only inference.

insightface's get_model()/get_model(**kwargs) helper only forwards
`providers`/`provider_options` to the underlying onnxruntime.InferenceSession
— it drops `sess_options` entirely, so there's no way to tune thread counts
through it. Building the session directly here (and handing it to
insightface's SCRFD/ArcFaceONNX classes via their `session=` constructor
argument, bypassing get_model()) is the only way to apply that tuning.
"""

import onnxruntime as ort

from app.config import settings


def build_cpu_session(model_path: str) -> ort.InferenceSession:
    """Explicitly requests CPUExecutionProvider only (skips ONNX Runtime's
    default CUDA-then-CPU provider probe, which is a no-op here but logs a
    warning) and pins the session to a small, fixed thread budget instead of
    letting it claim every CPU core — see Settings.face_onnx_intra_op_threads
    for why that matters once more than one camera is running inference at
    once."""
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = settings.face_onnx_intra_op_threads
    session_options.inter_op_num_threads = settings.face_onnx_inter_op_threads
    session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(model_path, sess_options=session_options, providers=["CPUExecutionProvider"])
