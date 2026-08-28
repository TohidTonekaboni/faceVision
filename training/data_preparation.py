"""Build YOLO and/or ArcFace training datasets from a raw exported dataset.

Reads the single, self-contained raw dataset directory produced by
`export_dataset.py` (images/{train,val,test}/*.jpg + manifest.json,
already verified, de-duplicated, and split by camera/day session) and
exports whichever of the two downstream formats is requested:

    YOLO    -> dataset/images/{train,val,test}, dataset/labels/{...}, data.yaml
    ArcFace -> dataset_arcface/{train,val,test}/<identity>/<snapshot>_<box>.jpg

Train-split YOLO images additionally get `--augmentations-per-image` offline
synthetic variants (flip/rotate/perspective/lighting/blur/noise/occlusion via
albumentations, tuned for an overhead-mounted camera — see augmentations.py).
ArcFace crops are left unaugmented on disk; train_arcface.py applies
augmentation on the fly per-epoch instead. Validation and test images are
always left untouched so metrics reflect real, unaugmented frames.

This script has no database dependency — it only needs the raw dataset
directory, so it's the piece meant to run on a GPU server after copying
`dataset_raw/` (or whatever --output export_dataset.py was given) over.

Usage:
    python training/data_preparation.py --raw-dir dataset_raw --pipeline both
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import cv2

from augmentations import build_yolo_train_augmentations


def _load_raw_dataset(raw_dir: Path) -> tuple[list[str], dict[str, list[dict]]]:
    manifest = json.loads((raw_dir / "manifest.json").read_text())
    class_names: list[str] = manifest["labels"]

    splits: dict[str, list[dict]] = {}
    for split, entries in manifest["splits"].items():
        records = []
        for entry in entries:
            image_path = raw_dir / entry["image"]
            boxes = [(x, y, w, h) for x, y, w, h, _label in entry["boxes"]]
            class_labels = [label for *_box, label in entry["boxes"]]
            records.append(
                {
                    "snapshot_id": Path(entry["image"]).stem,
                    "image_path": image_path,
                    "boxes": boxes,
                    "class_labels": class_labels,
                    "session_key": entry["session_key"],
                }
            )
        splits[split] = records
    return class_names, splits


def _augment_yolo(image_bgr, yolo_boxes, class_labels, transform, count):
    """Yield up to `count` (augmented_image_bgr, yolo_lines) pairs. Skips a
    variant if the transform crops out every box — a boxless training image
    would teach the model these faces are background."""
    for _ in range(count):
        result = transform(image=image_bgr, bboxes=yolo_boxes, class_labels=class_labels)
        if not result["bboxes"]:
            continue
        lines = [
            f"{int(label)} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}"
            for (x_center, y_center, width, height), label in zip(result["bboxes"], result["class_labels"])
        ]
        yield result["image"], lines


def _write_yolo_data_yaml(output_dir: Path, class_names: list[str]) -> None:
    lines = [
        f"path: {output_dir.resolve()}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "",
        f"nc: {len(class_names)}",
        "names:",
    ]
    lines += [f"  {i}: {name}" for i, name in enumerate(class_names)]
    (output_dir / "data.yaml").write_text("\n".join(lines) + "\n")


def export_yolo(
    splits: dict[str, list[dict]],
    class_names: list[str],
    output_dir: Path,
    augmentations_per_image: int,
    horizontal_flip: bool,
) -> int:
    images_dir = output_dir / "images"
    labels_dir = output_dir / "labels"
    transform = build_yolo_train_augmentations(horizontal_flip) if augmentations_per_image > 0 else None
    augmented_count = 0

    for split, records in splits.items():
        (images_dir / split).mkdir(parents=True, exist_ok=True)
        (labels_dir / split).mkdir(parents=True, exist_ok=True)

        for record in records:
            src_image = record["image_path"]
            snapshot_id = record["snapshot_id"]
            dst_image = images_dir / split / f"{snapshot_id}{src_image.suffix}"
            dst_image.write_bytes(src_image.read_bytes())

            lines = [
                f"{label} {x:.6f} {y:.6f} {w:.6f} {h:.6f}"
                for (x, y, w, h), label in zip(record["boxes"], record["class_labels"])
            ]
            (labels_dir / split / f"{snapshot_id}.txt").write_text("\n".join(lines) + "\n")

            if split != "train" or transform is None:
                continue

            image_bgr = cv2.imread(str(src_image))
            if image_bgr is None:
                continue
            for i, (aug_image, aug_lines) in enumerate(
                _augment_yolo(image_bgr, record["boxes"], record["class_labels"], transform, augmentations_per_image)
            ):
                aug_name = f"{snapshot_id}_aug{i}"
                cv2.imwrite(str(images_dir / split / f"{aug_name}{src_image.suffix}"), aug_image)
                (labels_dir / split / f"{aug_name}.txt").write_text("\n".join(aug_lines) + "\n")
                augmented_count += 1

    _write_yolo_data_yaml(output_dir, class_names)
    return augmented_count


def _crop_face(image_bgr, box: tuple[float, float, float, float], margin: float, image_size: int):
    h_img, w_img = image_bgr.shape[:2]
    x_center, y_center, w, h = box
    w_exp = w * (1 + 2 * margin)
    h_exp = h * (1 + 2 * margin)
    x1 = int(max(0, (x_center - w_exp / 2) * w_img))
    y1 = int(max(0, (y_center - h_exp / 2) * h_img))
    x2 = int(min(w_img, (x_center + w_exp / 2) * w_img))
    y2 = int(min(h_img, (y_center + h_exp / 2) * h_img))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = image_bgr[y1:y2, x1:x2]
    return cv2.resize(crop, (image_size, image_size), interpolation=cv2.INTER_LINEAR)


def _write_arcface_manifest(output_dir: Path, class_names: list[str], counts: dict[str, dict[str, int]]) -> None:
    lines = ["identities:"]
    lines += [f"  - {name}" for name in class_names]
    lines.append("splits:")
    for split in ("train", "val", "test"):
        lines.append(f"  {split}:")
        for name in class_names:
            lines.append(f"    {name}: {counts.get(split, {}).get(name, 0)}")
    (output_dir / "manifest.yaml").write_text("\n".join(lines) + "\n")


def export_arcface(
    splits: dict[str, list[dict]], class_names: list[str], output_dir: Path, face_margin: float, image_size: int
) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {split: defaultdict(int) for split in splits}

    for split, records in splits.items():
        for record in records:
            image_bgr = cv2.imread(str(record["image_path"]))
            if image_bgr is None:
                continue
            for i, (box, label) in enumerate(zip(record["boxes"], record["class_labels"])):
                crop = _crop_face(image_bgr, box, face_margin, image_size)
                if crop is None:
                    continue
                identity = class_names[label]
                identity_dir = output_dir / split / identity
                identity_dir.mkdir(parents=True, exist_ok=True)
                out_path = identity_dir / f"{record['snapshot_id']}_{i}.jpg"
                cv2.imwrite(str(out_path), crop)
                counts[split][identity] += 1

    _write_arcface_manifest(output_dir, class_names, counts)
    return counts


def _print_stats(splits: dict[str, list[dict]], class_names: list[str]) -> None:
    total = sum(len(records) for records in splits.values())
    print(f"\nRaw dataset: {total} image(s)")
    print(f"Identities ({len(class_names)}): {', '.join(class_names)}")
    for split in ("train", "val", "test"):
        records = splits.get(split, [])
        sessions = {record["session_key"] for record in records}
        per_class: dict[str, int] = defaultdict(int)
        for record in records:
            for label in record["class_labels"]:
                per_class[class_names[label]] += 1
        print(f"  {split}: {len(records)} image(s) across {len(sessions)} session(s)")
        for name in class_names:
            print(f"    {name}: {per_class.get(name, 0)} box(es)")


def prepare_dataset(
    raw_dir: Path,
    yolo_output: Path,
    arcface_output: Path,
    pipeline: str,
    augmentations_per_image: int,
    horizontal_flip: bool,
    face_margin: float,
    arcface_image_size: int,
) -> None:
    class_names, splits = _load_raw_dataset(raw_dir)
    _print_stats(splits, class_names)

    if pipeline in ("yolo", "both"):
        augmented = export_yolo(splits, class_names, yolo_output, augmentations_per_image, horizontal_flip)
        print(f"\nYOLO dataset written to {yolo_output} (+{augmented} augmented train images)")

    if pipeline in ("arcface", "both"):
        counts = export_arcface(splits, class_names, arcface_output, face_margin, arcface_image_size)
        total_crops = sum(sum(c.values()) for c in counts.values())
        print(f"\nArcFace dataset written to {arcface_output} ({total_crops} face crop(s))")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("dataset_raw"),
        help="Raw dataset directory produced by export_dataset.py (images/ + manifest.json)",
    )
    parser.add_argument("--pipeline", choices=["yolo", "arcface", "both"], default="both", help="Which dataset format(s) to build")
    parser.add_argument("--output", type=Path, default=Path("dataset"), help="Output directory for the YOLO dataset")
    parser.add_argument("--arcface-output", type=Path, default=Path("dataset_arcface"), help="Output directory for the ArcFace dataset")
    parser.add_argument(
        "--augmentations-per-image",
        type=int,
        default=3,
        help="Albumentations-generated variants per YOLO train image. Lower this as real, distinct "
        "footage grows — it exists to add volume when real data is scarce, not to replace it. 0 disables.",
    )
    parser.add_argument("--no-horizontal-flip", action="store_true", help="Disable horizontal-flip augmentation")
    parser.add_argument("--face-margin", type=float, default=0.3, help="Margin added around each ArcFace crop, as a fraction of box size")
    parser.add_argument("--arcface-image-size", type=int, default=112, help="ArcFace crop size in pixels (square)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    prepare_dataset(
        raw_dir=args.raw_dir,
        yolo_output=args.output,
        arcface_output=args.arcface_output,
        pipeline=args.pipeline,
        augmentations_per_image=args.augmentations_per_image,
        horizontal_flip=not args.no_horizontal_flip,
        face_margin=args.face_margin,
        arcface_image_size=args.arcface_image_size,
    )


if __name__ == "__main__":
    main()
