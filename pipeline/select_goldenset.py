"""Randomly sample snapshots that contain at least one detected face and copy
them into volumes_backup/goldenset_images/, for use as an evaluation set.

Face presence is checked with RetinaFace (the detector in this pipeline);
ArcFace only embeds an already-aligned face crop, it doesn't detect faces.
"""

import random
import shutil
from pathlib import Path

import cv2

from RetinaFace import RetinaFace

SNAPSHOTS_DIR = Path(__file__).resolve().parent.parent / "volumes_backup" / "snapshots"
GOLDENSET_DIR = Path(__file__).resolve().parent.parent / "volumes_backup" / "goldenset_images"
TARGET_COUNT = 300
SEED = 42


def select_goldenset() -> list[Path]:
    retina = RetinaFace(ctx_id=-1, det_size=(640, 640))

    candidates = sorted(SNAPSHOTS_DIR.glob("*.jpg"))
    rng = random.Random(SEED)
    rng.shuffle(candidates)

    selected = []
    checked = 0
    for image_path in candidates:
        if len(selected) >= TARGET_COUNT:
            break
        checked += 1

        image = cv2.imread(str(image_path))
        if image is None:
            continue

        faces = retina.detect(image)
        if faces:
            selected.append(image_path)

    print(f"checked {checked} images, selected {len(selected)} with a detected face")
    return selected


if __name__ == "__main__":
    GOLDENSET_DIR.mkdir(parents=True, exist_ok=True)
    selected = select_goldenset()
    for image_path in selected:
        shutil.copy2(image_path, GOLDENSET_DIR / image_path.name)
    print(f"copied {len(selected)} images to {GOLDENSET_DIR}")
