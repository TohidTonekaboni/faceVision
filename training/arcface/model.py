"""ArcFace model: a face-embedding backbone plus an additive angular margin
classification head (https://arxiv.org/abs/1801.07698).

The head is only used during training, to shape the embedding space so faces
of the same identity land close together and different identities land far
apart under cosine similarity. At inference time you drop the head and use
`ArcFaceModel.embed()` plus nearest-neighbor/cosine matching against an
enrolled gallery (see inference.py).
"""

from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class ArcMarginProduct(nn.Module):
    def __init__(self, in_features: int, out_features: int, scale: float = 30.0, margin: float = 0.5, easy_margin: bool = False):
        super().__init__()
        self.scale = scale
        self.margin = margin
        self.easy_margin = easy_margin
        self.weight = nn.Parameter(torch.empty(out_features, in_features))
        nn.init.xavier_uniform_(self.weight)

        self.cos_m = math.cos(margin)
        self.sin_m = math.sin(margin)
        self.th = math.cos(math.pi - margin)
        self.mm = math.sin(math.pi - margin) * margin

    def forward(self, embeddings: torch.Tensor, labels: torch.Tensor | None = None) -> torch.Tensor:
        cosine = F.linear(F.normalize(embeddings), F.normalize(self.weight))
        if labels is None:
            # No ground truth (eval/inference) — plain cosine similarity logits, no margin applied.
            return cosine * self.scale

        sine = torch.sqrt((1.0 - cosine.pow(2)).clamp(0, 1))
        phi = cosine * self.cos_m - sine * self.sin_m
        if self.easy_margin:
            phi = torch.where(cosine > 0, phi, cosine)
        else:
            phi = torch.where(cosine > self.th, phi, cosine - self.mm)

        one_hot = torch.zeros_like(cosine)
        one_hot.scatter_(1, labels.view(-1, 1), 1.0)
        output = one_hot * phi + (1.0 - one_hot) * cosine
        return output * self.scale


def build_backbone(name: str, embedding_size: int, pretrained: bool) -> nn.Module:
    if name == "facenet_vggface2":
        from facenet_pytorch import InceptionResnetV1

        backbone = InceptionResnetV1(pretrained="vggface2" if pretrained else None, classify=False)
        if embedding_size == 512:
            return backbone
        return nn.Sequential(backbone, nn.Linear(512, embedding_size))

    if name in ("resnet18", "resnet34", "resnet50"):
        import torchvision.models as tvm

        ctor = getattr(tvm, name)
        net = ctor(weights="DEFAULT" if pretrained else None)
        net.fc = nn.Linear(net.fc.in_features, embedding_size)
        return net

    raise ValueError(f"Unknown backbone {name!r} (expected 'facenet_vggface2', 'resnet18', 'resnet34', or 'resnet50')")


class ArcFaceModel(nn.Module):
    def __init__(
        self,
        num_classes: int,
        backbone: str = "facenet_vggface2",
        embedding_size: int = 512,
        scale: float = 30.0,
        margin: float = 0.5,
        pretrained: bool = True,
    ):
        super().__init__()
        self.backbone = build_backbone(backbone, embedding_size, pretrained)
        self.embedding_size = embedding_size
        self.head = ArcMarginProduct(embedding_size, num_classes, scale=scale, margin=margin)

    def embed(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.backbone(x))

    def forward(self, x: torch.Tensor, labels: torch.Tensor | None = None) -> tuple[torch.Tensor, torch.Tensor]:
        embeddings = self.backbone(x)
        logits = self.head(embeddings, labels)
        return logits, embeddings

    def freeze_backbone(self, freeze: bool = True) -> None:
        for param in self.backbone.parameters():
            param.requires_grad = not freeze
