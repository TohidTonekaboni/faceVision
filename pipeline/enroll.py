"""Build a face embedding gallery from labeled crops in arcface_images/<person>/*.jpg.

Each crop is already a single-face region (extracted via LabelMe bboxes), so
RetinaFace re-detection often fails on it (no surrounding scene context). We
try RetinaFace detect+align first for proper landmark alignment, and fall
back to a plain resize when no face is found.

Saves embeddings + labels to gallery.npz (loaded by identify.py).
"""

from pathlib import Path

import cv2
import numpy as np

from ArcFace import ArcFace
from RetinaFace import RetinaFace

ARCFACE_IMAGES_DIR = Path(__file__).resolve().parent / "arcface_images"
GALLERY_PATH = Path(__file__).resolve().parent / "gallery.npz"


def build_gallery() -> tuple[np.ndarray, np.ndarray]:
    retina = RetinaFace(ctx_id=-1, det_size=(160, 160))
    arcface = ArcFace(ctx_id=-1)

    embeddings = []
    labels = []
    fallback_count = 0

    person_dirs = sorted(p for p in ARCFACE_IMAGES_DIR.iterdir() if p.is_dir())
    for person_dir in person_dirs:
        image_paths = sorted(person_dir.glob("*.jpg"))
        print(f"{person_dir.name}: {len(image_paths)} images")
        for image_path in image_paths:
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"  skipping unreadable image: {image_path}")
                continue

            faces = retina.detect(image)
            if faces:
                best = max(faces, key=lambda f: f.det_score)
                aligned = retina.align(image, best.kps)
            else:
                aligned = cv2.resize(image, (112, 112))
                fallback_count += 1

            embedding = arcface.embed(aligned)
            embeddings.append(embedding)
            labels.append(person_dir.name)

    print(f"total: {len(embeddings)} embeddings ({fallback_count} used resize fallback)")
    return np.stack(embeddings), np.array(labels)


if __name__ == "__main__":
    embeddings, labels = build_gallery()
    np.savez(GALLERY_PATH, embeddings=embeddings, labels=labels)
    print(f"saved gallery to {GALLERY_PATH}")
