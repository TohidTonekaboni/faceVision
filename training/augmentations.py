"""Augmentation pipelines shared by the YOLO and ArcFace training paths.

Both cameras are mounted overhead, so subjects are seen from an elevated
angle far more often than head-on: foreshortened faces, occluded chins/necks,
and viewing-angle-dependent lighting are the norm, not the exception. The
transforms below are chosen to reproduce that rather than generic frontal-face
jitter — geometric perspective/rotation to stand in for camera-angle and head
pose variation, and photometric/occlusion transforms to stand in for the
lighting and partial-occlusion (badges, lanyards, hands, masks) an overhead
feed actually sees.
"""

from __future__ import annotations

import albumentations as A


def build_yolo_train_augmentations(horizontal_flip: bool = True) -> A.Compose:
    """Offline augmentation pipeline for YOLO training images (bbox-aware).

    Applied once per generated variant in data_preparation.py, so a single
    real snapshot yields several distinct synthetic views rather than several
    near-identical copies.
    """
    transforms = [
        A.HorizontalFlip(p=0.5 if horizontal_flip else 0.0),
        A.Affine(rotate=(-15, 15), scale=(0.85, 1.15), translate_percent=(-0.08, 0.08), p=0.6),
        A.Perspective(scale=(0.02, 0.08), p=0.35),
        A.RandomBrightnessContrast(brightness_limit=0.35, contrast_limit=0.35, p=0.6),
        A.RandomGamma(gamma_limit=(70, 150), p=0.3),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=25, val_shift_limit=20, p=0.3),
        A.OneOf(
            [
                A.GaussNoise(std_range=(0.03, 0.12), p=1.0),
                A.MotionBlur(blur_limit=5, p=1.0),
                A.GaussianBlur(blur_limit=(3, 5), p=1.0),
            ],
            p=0.35,
        ),
        A.CoarseDropout(
            num_holes_range=(1, 3),
            hole_height_range=(0.05, 0.18),
            hole_width_range=(0.05, 0.18),
            p=0.2,
        ),
        A.RandomShadow(p=0.1),
        A.ImageCompression(quality_range=(45, 95), p=0.25),
    ]
    return A.Compose(
        transforms,
        bbox_params=A.BboxParams(format="yolo", label_fields=["class_labels"], min_visibility=0.3),
    )


def build_arcface_train_transforms(image_size: int = 112, horizontal_flip: bool = True) -> A.Compose:
    """On-the-fly augmentation for ArcFace training, applied per-epoch to
    already-cropped face images (no bbox tracking needed). Geometric jitter
    is milder than the YOLO pipeline since the crop is already tight around
    the face."""
    return A.Compose(
        [
            A.HorizontalFlip(p=0.5 if horizontal_flip else 0.0),
            A.Affine(rotate=(-10, 10), scale=(0.9, 1.1), translate_percent=(-0.04, 0.04), p=0.5),
            A.Perspective(scale=(0.02, 0.06), p=0.25),
            A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.6),
            A.RandomGamma(gamma_limit=(70, 150), p=0.3),
            A.HueSaturationValue(hue_shift_limit=8, sat_shift_limit=20, val_shift_limit=15, p=0.25),
            A.OneOf(
                [
                    A.GaussNoise(std_range=(0.02, 0.1), p=1.0),
                    A.MotionBlur(blur_limit=5, p=1.0),
                    A.GaussianBlur(blur_limit=(3, 5), p=1.0),
                ],
                p=0.3,
            ),
            A.CoarseDropout(
                num_holes_range=(1, 2),
                hole_height_range=(0.05, 0.2),
                hole_width_range=(0.05, 0.2),
                p=0.2,
            ),
            A.ImageCompression(quality_range=(50, 95), p=0.2),
            A.Resize(image_size, image_size),
        ]
    )


def build_eval_transforms(image_size: int = 112) -> A.Compose:
    """Deterministic resize-only pipeline for val/test/inference — no
    augmentation, since these should reflect real, unaltered frames."""
    return A.Compose([A.Resize(image_size, image_size)])
