"""Embedding-similarity identification: build a gallery of enrolled
identities from a set of images, then match a new face embedding against it.

Usage as a library (e.g. from a backend inference module)::

    model, classes = load_checkpoint("checkpoints/arcface_best.pt")
    gallery = build_gallery(model, Path("dataset_arcface/train"), classes, device)
    label, similarity = identify(embed_image(model, crop_bgr, device), gallery, threshold=0.4)
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import torch

from .dataset import _IMAGENET_MEAN, _IMAGENET_STD
from .model import ArcFaceModel


def load_checkpoint(path: str | Path, device: str = "cpu") -> tuple[ArcFaceModel, list[str]]:
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    config = checkpoint["config"]
    model = ArcFaceModel(
        num_classes=len(checkpoint["classes"]),
        backbone=config["backbone"],
        embedding_size=config["embedding_size"],
        scale=config["scale"],
        margin=config["margin"],
        pretrained=False,
    )
    model.load_state_dict(checkpoint["model_state"])
    model.to(device).eval()
    return model, checkpoint["classes"]


def preprocess_bgr(image_bgr: np.ndarray, image_size: int) -> torch.Tensor:
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    image_rgb = cv2.resize(image_rgb, (image_size, image_size), interpolation=cv2.INTER_LINEAR)
    image = image_rgb.astype(np.float32) / 255.0
    image = (image - _IMAGENET_MEAN) / _IMAGENET_STD
    tensor = torch.from_numpy(image.transpose(2, 0, 1)).float().unsqueeze(0)
    return tensor


@torch.no_grad()
def embed_image(model: ArcFaceModel, image_bgr: np.ndarray, device: str = "cpu", image_size: int = 112) -> np.ndarray:
    tensor = preprocess_bgr(image_bgr, image_size).to(device)
    embedding = model.embed(tensor)
    return embedding.squeeze(0).cpu().numpy()


@torch.no_grad()
def build_gallery(
    model: ArcFaceModel, root: Path, classes: list[str], device: str = "cpu", image_size: int = 112
) -> dict[str, np.ndarray]:
    """One mean, L2-normalized embedding per identity, averaged over every
    enrollment image under root/<identity>/*.jpg."""
    gallery: dict[str, np.ndarray] = {}
    for name in classes:
        class_dir = Path(root) / name
        if not class_dir.is_dir():
            continue
        embeddings = []
        for path in class_dir.glob("*.jpg"):
            image_bgr = cv2.imread(str(path))
            if image_bgr is None:
                continue
            embeddings.append(embed_image(model, image_bgr, device, image_size))
        if embeddings:
            mean = np.mean(embeddings, axis=0)
            gallery[name] = mean / (np.linalg.norm(mean) + 1e-8)
    return gallery


def identify(embedding: np.ndarray, gallery: dict[str, np.ndarray], threshold: float = 0.4) -> tuple[str, float]:
    """Returns (identity, cosine_similarity), or ("unknown", best_similarity)
    when the best match falls below `threshold`. Tune the threshold on a
    held-out set of known + deliberately-unknown faces — it trades off false
    accepts against false rejects."""
    if not gallery:
        return "unknown", 0.0

    best_name, best_score = "unknown", -1.0
    for name, gallery_embedding in gallery.items():
        score = float(np.dot(embedding, gallery_embedding))
        if score > best_score:
            best_name, best_score = name, score

    if best_score < threshold:
        return "unknown", best_score
    return best_name, best_score
