"""Loads the identity-per-folder crops produced by
training/data_preparation.py's export_arcface() into a PyTorch Dataset."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class IdentityFolderDataset(Dataset):
    """root/<identity_name>/<file>.jpg, one subfolder per identity.

    `classes`/`class_to_idx` should be passed in for val/test splits so class
    index assignment is consistent across splits even if a split is missing
    some identity's images entirely.
    """

    def __init__(self, root: Path, transform=None, classes: list[str] | None = None):
        self.root = Path(root)
        if not self.root.exists():
            raise FileNotFoundError(f"{self.root} does not exist — run data_preparation.py with --pipeline arcface first")

        self.classes = classes or sorted(p.name for p in self.root.iterdir() if p.is_dir())
        self.class_to_idx = {name: i for i, name in enumerate(self.classes)}
        self.transform = transform

        self.samples: list[tuple[Path, int]] = []
        for name in self.classes:
            class_dir = self.root / name
            if not class_dir.is_dir():
                continue
            for path in sorted(class_dir.glob("*.jpg")):
                self.samples.append((path, self.class_to_idx[name]))

        if not self.samples:
            raise ValueError(f"No images found under {self.root}")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        path, label = self.samples[index]
        image = np.array(Image.open(path).convert("RGB"))

        if self.transform is not None:
            image = self.transform(image=image)["image"]

        image = image.astype(np.float32) / 255.0
        image = (image - _IMAGENET_MEAN) / _IMAGENET_STD
        tensor = torch.from_numpy(image.transpose(2, 0, 1)).float()
        return tensor, label
