"""Identify a face embedding against the enrolled gallery (gallery.npz) via
nearest-neighbor cosine similarity.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np

GALLERY_PATH = Path(__file__).resolve().parent / "gallery.npz"

UNKNOWN_LABEL = "unknown"
DEFAULT_THRESHOLD = 0.35


@dataclass
class Match:
    label: str
    score: float


class Gallery:
    def __init__(self, gallery_path: Path = GALLERY_PATH):
        data = np.load(gallery_path)
        self.embeddings = data["embeddings"]  # N x 512
        self.labels = data["labels"]  # N

    def identify(self, embedding: np.ndarray, threshold: float = DEFAULT_THRESHOLD) -> Match:
        similarities = self.embeddings @ embedding
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])
        if best_score < threshold:
            return Match(label=UNKNOWN_LABEL, score=best_score)
        return Match(label=str(self.labels[best_idx]), score=best_score)
