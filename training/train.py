"""Train a YOLOv12 detector on the dataset produced by data_preparation.py.

Usage:
    python training/train.py --data dataset/data.yaml --epochs 100

The dataset's identities co-occur in a small number of camera sessions, which
makes this model prone to overfitting well before --epochs/--patience would
otherwise stop it (see runs/face_vision/results.csv: val/box_loss and
val/dfl_loss bottomed out at epoch 6 and worsened every epoch after, despite
train loss and mAP50 continuing to look fine). --freeze, --dropout and
--weight-decay exist to make that easier to counteract as you iterate;
--patience should be lowered once you can see where val loss actually turns.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=Path("/home/tohid/training/dataset/data.yaml"), help="Path to the dataset YAML")
    parser.add_argument("--model", default="/home/tohid/training/yolo12n.pt", help="Base checkpoint to fine-tune (downloaded if missing)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Training resolution. Raise this (e.g. 960/1280) if faces occupy a small fraction of the "
        "overhead camera's frame — small-object detection degrades faster from low resolution than "
        "from dataset size.",
    )
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default=None, help="e.g. 'cpu', '0', '0,1'. Omit to let ultralytics auto-select")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument(
        "--patience",
        type=int,
        default=15,
        help="Early-stopping patience, in epochs since the last improvement. Lowered from ultralytics' "
        "default of 30 because this dataset's val loss has historically turned within the first "
        "10 epochs; raise it again once more session diversity makes later improvement plausible.",
    )
    parser.add_argument(
        "--freeze",
        type=int,
        default=0,
        help="Freeze the first N backbone layers during fine-tuning. A small, identity-narrow dataset "
        "can overwrite the pretrained backbone's general face/object features; freezing early layers "
        "(e.g. 10) limits fine-tuning to the head and reduces that risk. 0 disables.",
    )
    parser.add_argument(
        "--dropout", type=float, default=0.0, help="Classification-head dropout. Try 0.1-0.2 if val loss keeps rising while train loss falls."
    )
    parser.add_argument("--weight-decay", type=float, default=0.0005, help="L2 regularization strength")
    parser.add_argument("--project", default="/home/tohid/training/runs", help="Directory training runs are written under")
    parser.add_argument("--name", default="face_vision", help="Run name, used as the subfolder under --project")
    parser.add_argument("--resume", action="store_true", help="Resume the last checkpoint in --project/--name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.data.exists():
        raise SystemExit(f"{args.data} not found — run training/data_preparation.py first.")

    model = YOLO(args.model)
    model.train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        patience=args.patience,
        freeze=args.freeze or None,
        dropout=args.dropout,
        weight_decay=args.weight_decay,
        project=args.project,
        name=args.name,
        resume=args.resume,
    )
    model.val(split="test")


if __name__ == "__main__":
    main()
