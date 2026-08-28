"""Train an ArcFace face-identification model on the dataset produced by
training/data_preparation.py --pipeline arcface.

Usage:
    python training/train_arcface.py --data dataset_arcface --epochs 50

Unlike the YOLO pipeline, augmentation here happens on the fly (see
augmentations.build_arcface_train_transforms) rather than being pre-generated
onto disk — with a large, diverse set of real crops already collected,
re-sampling a fresh random augmentation each epoch uses that diversity better
than baking a fixed number of synthetic copies per image.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parent))

from augmentations import build_arcface_train_transforms, build_eval_transforms  # noqa: E402
from arcface.dataset import IdentityFolderDataset  # noqa: E402
from arcface.model import ArcFaceModel  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=Path("dataset_arcface"), help="Root with train/val/test identity folders")
    parser.add_argument(
        "--backbone",
        choices=["facenet_vggface2", "resnet18", "resnet34", "resnet50"],
        default="facenet_vggface2",
        help="facenet_vggface2 is pretrained on real faces (VGGFace2) and is the strongest starting "
        "point for a small number of identities; the resnet* options are ImageNet-pretrained "
        "general-purpose fallbacks if facenet-pytorch isn't available.",
    )
    parser.add_argument("--pretrained", action=argparse.BooleanOptionalAction, default=True, help="Start from pretrained backbone weights")
    parser.add_argument("--embedding-size", type=int, default=512)
    parser.add_argument("--scale", type=float, default=30.0, help="ArcFace logit scale (s)")
    parser.add_argument("--margin", type=float, default=0.5, help="ArcFace additive angular margin (m)")
    parser.add_argument("--image-size", type=int, default=112, help="Must match --arcface-image-size used in data_preparation.py")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--optimizer", choices=["adam", "adamw", "sgd"], default="adamw")
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=5e-4)
    parser.add_argument("--scheduler", choices=["none", "cosine", "step"], default="cosine")
    parser.add_argument("--step-size", type=int, default=15, help="Epochs between LR drops when --scheduler step")
    parser.add_argument("--gamma", type=float, default=0.1, help="LR decay factor when --scheduler step")
    parser.add_argument(
        "--freeze-backbone-epochs",
        type=int,
        default=2,
        help="Freeze the pretrained backbone for this many initial epochs, training only the ArcFace "
        "head — lets the head adapt to your identities before backbone weights start moving, which "
        "otherwise tends to overfit fast on a handful of identities. 0 disables.",
    )
    parser.add_argument("--patience", type=int, default=10, help="Early-stopping patience in epochs, measured on val top-1 accuracy")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--no-horizontal-flip", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("checkpoints"), help="Directory checkpoints are written to")
    parser.add_argument("--name", default="arcface_face_vision", help="Checkpoint file stem")
    return parser.parse_args()


def build_optimizer(args: argparse.Namespace, model: nn.Module) -> torch.optim.Optimizer:
    params = [p for p in model.parameters() if p.requires_grad]
    if args.optimizer == "adam":
        return torch.optim.Adam(params, lr=args.lr, weight_decay=args.weight_decay)
    if args.optimizer == "adamw":
        return torch.optim.AdamW(params, lr=args.lr, weight_decay=args.weight_decay)
    return torch.optim.SGD(params, lr=args.lr, momentum=0.9, weight_decay=args.weight_decay, nesterov=True)


def build_scheduler(args: argparse.Namespace, optimizer: torch.optim.Optimizer):
    if args.scheduler == "cosine":
        return torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    if args.scheduler == "step":
        return torch.optim.lr_scheduler.StepLR(optimizer, step_size=args.step_size, gamma=args.gamma)
    return None


def run_epoch(model, loader, criterion, optimizer, device, train: bool):
    model.train(mode=train)
    total_loss, total_correct, total_count = 0.0, 0, 0
    torch.set_grad_enabled(train)
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        logits, _ = model(images, labels if train else None)
        loss = criterion(logits, labels)

        if train:
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * images.size(0)
        total_correct += (logits.argmax(dim=1) == labels).sum().item()
        total_count += images.size(0)
    torch.set_grad_enabled(True)
    return total_loss / total_count, total_correct / total_count


def main() -> None:
    args = parse_args()

    train_dataset = IdentityFolderDataset(
        args.data / "train",
        transform=build_arcface_train_transforms(args.image_size, horizontal_flip=not args.no_horizontal_flip),
    )
    classes = train_dataset.classes
    val_dataset = IdentityFolderDataset(args.data / "val", transform=build_eval_transforms(args.image_size), classes=classes)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=args.workers, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    model = ArcFaceModel(
        num_classes=len(classes),
        backbone=args.backbone,
        embedding_size=args.embedding_size,
        scale=args.scale,
        margin=args.margin,
        pretrained=args.pretrained,
    ).to(args.device)

    criterion = nn.CrossEntropyLoss()
    optimizer = build_optimizer(args, model)
    scheduler = build_scheduler(args, optimizer)

    args.output.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.output / f"{args.name}_best.pt"

    best_val_acc = 0.0
    epochs_without_improvement = 0

    for epoch in range(1, args.epochs + 1):
        if args.freeze_backbone_epochs:
            model.freeze_backbone(epoch <= args.freeze_backbone_epochs)

        train_loss, train_acc = run_epoch(model, train_loader, criterion, optimizer, args.device, train=True)
        val_loss, val_acc = run_epoch(model, val_loader, criterion, optimizer, args.device, train=False)
        if scheduler is not None:
            scheduler.step()

        print(
            f"epoch {epoch}/{args.epochs}  train_loss={train_loss:.4f} train_acc={train_acc:.4f}  "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            epochs_without_improvement = 0
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "classes": classes,
                    "val_acc": val_acc,
                    "epoch": epoch,
                    "config": {
                        "backbone": args.backbone,
                        "embedding_size": args.embedding_size,
                        "scale": args.scale,
                        "margin": args.margin,
                        "image_size": args.image_size,
                    },
                },
                checkpoint_path,
            )
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= args.patience:
                print(f"No val_acc improvement for {args.patience} epochs — stopping early.")
                break

    print(f"Best val_acc={best_val_acc:.4f}, checkpoint saved to {checkpoint_path}")

    if (args.data / "test").exists():
        test_dataset = IdentityFolderDataset(args.data / "test", transform=build_eval_transforms(args.image_size), classes=classes)
        test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
        checkpoint = torch.load(checkpoint_path, map_location=args.device, weights_only=False)
        model.load_state_dict(checkpoint["model_state"])
        test_loss, test_acc = run_epoch(model, test_loader, criterion, optimizer, args.device, train=False)
        print(f"test_loss={test_loss:.4f} test_acc={test_acc:.4f}")


if __name__ == "__main__":
    main()
