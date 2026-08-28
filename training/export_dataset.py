"""Export annotated snapshots from the face-vision database into a single,
self-contained raw dataset directory.

This is the only step in the training pipeline that needs database and raw
snapshot-storage access. It fetches Snapshot/Annotation/Label rows, verifies
and de-duplicates them, splits them by camera/day *session* (not by
individual frame) so validation and test sets measure generalization to
conditions the model hasn't trained on, and copies every usable image plus a
single manifest.json describing boxes/labels/splits into one output
directory:

    <output>/
      images/{train,val,test}/<snapshot_id>.jpg
      manifest.json

That directory is everything downstream dataset building and training needs
— copy it as-is to a GPU server (rsync/scp/tar) and run
`data_preparation.py --raw-dir <output>` there to build the YOLO and/or
ArcFace formatted datasets, with no database connectivity required on the
GPU side.

Usage:
    python training/export_dataset.py --output dataset_raw --val-split 0.15 --test-split 0.15
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import imagehash
from dotenv import dotenv_values
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.orm import selectinload  # noqa: E402

from app.config import settings  # noqa: E402
from app.models import Label, Snapshot  # noqa: E402


def _default_database_url() -> str:
    """Mirror docker-compose.yml's DATABASE_URL, but against localhost.

    docker-compose passes DATABASE_URL to the backend container directly,
    composed from POSTGRES_USER/PASSWORD/DB with host "db" (the compose
    network alias). This script runs on the host instead, where the same
    postgres is reachable via the port docker-compose maps to localhost.
    """
    env = {**dotenv_values(REPO_ROOT / ".env"), **os.environ}
    user = env.get("POSTGRES_USER", "facevision")
    password = env.get("POSTGRES_PASSWORD", "facevision")
    db = env.get("POSTGRES_DB", "facevision")
    return f"postgresql+asyncpg://{user}:{password}@localhost:5432/{db}"


DEFAULT_DATABASE_URL = _default_database_url()


async def _fetch_annotated_snapshots(db: AsyncSession) -> list[Snapshot]:
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.is_annotated.is_(True))
        .options(selectinload(Snapshot.annotations))
    )
    return list(result.scalars().unique().all())


async def _fetch_labels(db: AsyncSession) -> list[Label]:
    result = await db.execute(select(Label).order_by(Label.created_at))
    return list(result.scalars().all())


def _resolve_image_path(image_path: str, image_root: str | None) -> Path:
    """Map a Snapshot.image_path (as seen by the backend process that wrote
    it) to a path readable from wherever this script is running.

    image_path is written as f"{settings.snapshot_dir}/{filename}" at
    capture time (backend/app/routers/cameras.py), but settings.snapshot_dir
    itself can vary across environments/config (absolute inside Docker,
    sometimes relative for a local non-Docker run) — so historical rows in
    the DB are not guaranteed to share one root, absolute or otherwise.
    Snapshots are always stored flat with no subdirectories, so the only
    part of image_path that's reliable is the filename; --image-root (or,
    absent that, settings.snapshot_dir) supplies the actual root to join it
    to.
    """
    filename = Path(image_path).name
    root = image_root or settings.snapshot_dir
    return Path(root) / filename


def _session_key(snapshot: Snapshot) -> str:
    """Groups snapshots into camera+day buckets. Splitting by session (rather
    than by individual frame) keeps near-identical frames from the same
    sitting on the same side of the train/val/test boundary, so held-out
    metrics reflect generalization to a new session instead of memorization
    of one."""
    camera = snapshot.camera_id or snapshot.camera_name or "unknown-camera"
    created_at = snapshot.created_at or datetime.now(timezone.utc)
    return f"{camera}_{created_at.date().isoformat()}"


def _verify_snapshot(
    snapshot: Snapshot, image_path: Path, label_index: dict[str, int], min_box_side: float
) -> tuple[dict | None, str | None]:
    """Verifies the image decodes and every annotation is well-formed.
    Returns (record, None) on success or (None, reason) to skip and count."""
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            width, height = img.size
            if width == 0 or height == 0:
                return None, "zero-sized image"
            phash = imagehash.phash(img)
    except (OSError, ValueError):
        return None, "unreadable/corrupted image"

    boxes: list[tuple[float, float, float, float]] = []
    class_labels: list[int] = []
    for annotation in snapshot.annotations:
        if annotation.label_id not in label_index:
            continue  # label was deleted/renamed since this annotation was made
        if annotation.width <= 0 or annotation.height <= 0:
            continue
        x_center = annotation.x + annotation.width / 2
        y_center = annotation.y + annotation.height / 2
        if not (0.0 <= x_center <= 1.0 and 0.0 <= y_center <= 1.0):
            continue
        if min(annotation.width * width, annotation.height * height) < min_box_side:
            continue
        boxes.append((x_center, y_center, annotation.width, annotation.height))
        class_labels.append(label_index[annotation.label_id])

    if not boxes:
        return None, "no valid annotations after validation"

    return (
        {
            "snapshot": snapshot,
            "image_path": image_path,
            "boxes": boxes,
            "class_labels": class_labels,
            "session_key": _session_key(snapshot),
            "phash": phash,
        },
        None,
    )


def _dedupe(records: list[dict], threshold: int | None) -> tuple[list[dict], int]:
    """Drops near-duplicate frames (e.g. consecutive RTSP snapshots of the
    same moment) using a perceptual hash, comparing sequentially within each
    camera/day session in capture order. Returns (kept_records, dropped_count)."""
    if threshold is None:
        return records, 0

    by_session: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        by_session[record["session_key"]].append(record)

    kept: list[dict] = []
    dropped = 0
    for group in by_session.values():
        group.sort(key=lambda r: r["snapshot"].created_at or datetime.min.replace(tzinfo=timezone.utc))
        last_hash = None
        for record in group:
            if last_hash is not None and (record["phash"] - last_hash) <= threshold:
                dropped += 1
                continue
            kept.append(record)
            last_hash = record["phash"]
    return kept, dropped


def _assign_splits(
    records: list[dict], val_split: float, test_split: float, seed: int, split_by: str
) -> dict[str, list[dict]]:
    """Splits by whole camera/day session so val/test measure generalization
    to unseen conditions rather than near-duplicate frames of a training
    session. Falls back to a random per-image split (with a warning) when
    there are too few distinct sessions for that to be meaningful."""
    train_split = 1.0 - val_split - test_split
    if train_split <= 0:
        raise SystemExit("--val-split + --test-split must be less than 1.0")

    sessions: dict[str, list[dict]] = defaultdict(list)
    if split_by == "session":
        for record in records:
            sessions[record["session_key"]].append(record)
        if len(sessions) < 3:
            print(
                f"Warning: only {len(sessions)} distinct camera/day session(s) found — "
                "falling back to a random per-image split. Validation and test metrics will "
                "not reflect generalization to a new session/camera/lighting condition."
            )
            sessions = {}
    if not sessions:
        sessions = {f"record-{i}": [record] for i, record in enumerate(records)}

    keys = list(sessions.keys())
    random.Random(seed).shuffle(keys)

    total = len(records)
    targets = {"train": train_split * total, "val": val_split * total, "test": test_split * total}
    counts = {"train": 0, "val": 0, "test": 0}
    splits: dict[str, list[dict]] = {"train": [], "val": [], "test": []}

    for key in keys:
        group = sessions[key]
        deficit = {name: targets[name] - counts[name] for name in splits}
        chosen = max(deficit, key=deficit.get)
        splits[chosen].extend(group)
        counts[chosen] += len(group)

    return splits


def _print_stats(splits: dict[str, list[dict]], class_names: list[str], corrupted: int, duplicate: int, invalid: int) -> None:
    total = sum(len(records) for records in splits.values())
    print(
        f"\nDataset summary: {total} usable snapshot(s) after validation "
        f"({corrupted} corrupted, {duplicate} near-duplicate, {invalid} with no valid annotation dropped)"
    )
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


def _write_manifest(output_dir: Path, class_names: list[str], splits: dict[str, list[dict]]) -> None:
    manifest = {
        "labels": class_names,
        "splits": {
            split: [
                {
                    "image": f"images/{split}/{record['snapshot'].id}{record['image_path'].suffix}",
                    "session_key": record["session_key"],
                    "boxes": [
                        [x, y, w, h, label]
                        for (x, y, w, h), label in zip(record["boxes"], record["class_labels"])
                    ],
                }
                for record in records
            ]
            for split, records in splits.items()
        },
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def export_raw(splits: dict[str, list[dict]], class_names: list[str], output_dir: Path) -> None:
    images_dir = output_dir / "images"
    for split, records in splits.items():
        (images_dir / split).mkdir(parents=True, exist_ok=True)
        for record in records:
            snapshot = record["snapshot"]
            src_image = record["image_path"]
            dst_image = images_dir / split / f"{snapshot.id}{src_image.suffix}"
            shutil.copyfile(src_image, dst_image)
    _write_manifest(output_dir, class_names, splits)


async def run(
    output: Path,
    val_split: float,
    test_split: float,
    seed: int,
    database_url: str,
    image_root: str | None,
    min_box_side: float,
    dedupe_hamming_threshold: int | None,
    split_by: str,
) -> None:
    engine = create_async_engine(database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        snapshots = await _fetch_annotated_snapshots(db)
        labels = await _fetch_labels(db)
    await engine.dispose()

    if not labels:
        raise SystemExit("No labels found in the database — annotate at least one class first.")

    label_index = {label.id: i for i, label in enumerate(labels)}
    class_names = [label.name for label in labels]

    resolved = [(s, _resolve_image_path(s.image_path, image_root)) for s in snapshots]
    exportable = [(s, path) for s, path in resolved if s.annotations and path.exists()]
    skipped_missing = len(snapshots) - len(exportable)
    if skipped_missing:
        print(
            f"Skipping {skipped_missing} annotated snapshot(s) with no annotations or an unreadable image file.\n"
            "If snapshots live in the docker-compose 'snapshots' volume, either run this script inside "
            "the backend container, or pass --image-root pointing at a local copy/mount of that volume "
            "(e.g. `docker cp face-vision-backend-1:/app/storage/snapshots ./snapshots` then "
            "`--image-root ./snapshots`)."
        )

    records: list[dict] = []
    corrupted = 0
    invalid = 0
    for snapshot, image_path in exportable:
        record, reason = _verify_snapshot(snapshot, image_path, label_index, min_box_side)
        if record is None:
            if reason == "no valid annotations after validation":
                invalid += 1
            else:
                corrupted += 1
            continue
        records.append(record)

    records, duplicate = _dedupe(records, dedupe_hamming_threshold)

    if not records:
        raise SystemExit("No usable snapshots remain after validation/dedupe — nothing to export.")

    splits = _assign_splits(records, val_split, test_split, seed, split_by)
    _print_stats(splits, class_names, corrupted, duplicate, invalid)

    export_raw(splits, class_names, output)
    total = sum(len(records) for records in splits.values())
    print(f"\nRaw dataset written to {output.resolve()} ({total} image(s) + manifest.json)")
    print(f"Copy this entire directory to the GPU server, then run data_preparation.py --raw-dir {output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=Path("dataset_raw"), help="Output directory for the raw (DB-independent) dataset")
    parser.add_argument("--val-split", type=float, default=0.15, help="Fraction of sessions held out for validation")
    parser.add_argument("--test-split", type=float, default=0.15, help="Fraction of sessions held out for test")
    parser.add_argument("--seed", type=int, default=42, help="Shuffle seed for the train/val/test split")
    parser.add_argument(
        "--split-by",
        choices=["session", "random"],
        default="session",
        help="'session' (default) keeps each camera/day's frames on one side of the split, so val/test "
        "measure generalization instead of memorization of near-duplicate frames. 'random' splits "
        "individual frames, which is only meaningful with many distinct sessions already.",
    )
    parser.add_argument(
        "--database-url",
        default=DEFAULT_DATABASE_URL,
        help="SQLAlchemy async database URL (default: settings.database_url with 'db' host swapped for 'localhost')",
    )
    parser.add_argument(
        "--image-root",
        default=None,
        help=(
            "Local directory the snapshots volume is mounted/copied to, replacing "
            f"{settings.snapshot_dir!r} as seen by the backend container. Omit if running this "
            "script inside the backend container, where that path already exists."
        ),
    )
    parser.add_argument(
        "--min-box-side",
        type=float,
        default=20.0,
        help="Drop annotations whose shorter side is smaller than this many pixels (too small to be a usable face crop)",
    )
    parser.add_argument(
        "--dedupe-hamming-threshold",
        type=int,
        default=5,
        help="Max perceptual-hash Hamming distance for two frames in the same camera/day session to be "
        "considered near-duplicates (the later one is dropped). Set to -1 to disable de-duplication.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dedupe_threshold = None if args.dedupe_hamming_threshold < 0 else args.dedupe_hamming_threshold
    asyncio.run(
        run(
            output=args.output,
            val_split=args.val_split,
            test_split=args.test_split,
            seed=args.seed,
            database_url=args.database_url,
            image_root=args.image_root,
            min_box_side=args.min_box_side,
            dedupe_hamming_threshold=dedupe_threshold,
            split_by=args.split_by,
        )
    )


if __name__ == "__main__":
    main()
