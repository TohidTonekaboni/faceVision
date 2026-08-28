# YOLOv12 vs. ArcFace for closed-set face identification

Both pipelines share `data_preparation.py` for verification/dedup/splitting;
they diverge in export format (`--pipeline yolo|arcface|both`) and in
`train.py` vs `train_arcface.py`. This compares them for the actual target:
identifying a small, fixed roster of known people from an overhead camera.

## How they differ

**YOLOv12 (`train.py`)** treats each person as an object class. One network
does detection (where is a head/face) and identification (whose) jointly —
`nc` classes, one box + one class score per detection. Adding a new person
means adding a class and retraining the whole detector.

**ArcFace (`train_arcface.py`)** separates the two problems. A face
detector — YOLO can still do this, but as a single "face" class, or any
off-the-shelf detector — finds the crop; a separate embedding model maps it
to a point in an embedding space where cosine distance reflects identity.
Recognition becomes nearest-neighbor lookup against a small "gallery" of
enrolled embeddings per person (`arcface/inference.py`). Adding a person
means enrolling a few embeddings — no retraining of the network itself.

## Trade-offs

| | YOLOv12 (per-identity classes) | ArcFace (detect + embed + match) |
|---|---|---|
| **Accuracy at small N** (a handful of people) | Competitive, and simpler to reason about — this is why your existing model hit 0.98 mAP50 on its (narrow) val set | Competitive, generally the stronger option here since the backbone is pretrained on faces broadly, not just your 3 identities |
| **Data efficiency per identity** | Needs enough boxes per class for the detector's classification head to separate them; struggles more when identities look similar or lighting varies a lot, since it only ever compares within your dataset | Better — the pretrained backbone (VGGFace2) already encodes general facial structure, so it needs comparatively few images per identity to place them correctly in embedding space |
| **Adding/removing a person** | Requires new annotations for that class + full retrain | Enroll new gallery embeddings (a few images run through the existing embedder); no retraining needed unless you want to fine-tune the embedder itself |
| **Unknown-person handling** | No native concept — the model always outputs its known classes, or you rely on confidence thresholding alone (weak) | Natural — nearest-neighbor similarity below a threshold reports "unknown" (`identify()` in inference.py) |
| **Overhead-camera robustness** | Sensitive to the same box-regression + classification loss trading off; a face at a steep angle affects both localization and identity accuracy simultaneously | Detector and embedder can be tuned independently — a robust face detector plus a robust embedder is usually easier than one network doing both well at odd angles |
| **Inference speed** | One forward pass per frame — fastest, since detection and identification are fused | Two stages: detect (or reuse a lightweight generic face detector), then embed each crop. Slightly slower per frame, though InceptionResnetV1 at 112×112 is cheap; still real-time on modest hardware |
| **Scalability to more identities** | Every new identity grows the classification head and generally needs a full retrain to avoid catastrophic forgetting of prior classes | Scales cleanly to dozens/hundreds of enrolled identities — the network itself doesn't change size, only the gallery does |
| **Maintenance** | One model, one training script, simpler ops | Two concerns (detector + embedder) and a gallery-management step (re-enrolling when appearance changes significantly, e.g. new glasses/facial hair) |
| **Explainability of failures** | A missed detection and a misidentification look the same (a wrong/absent box) — harder to tell why | Easier to separate: did detection miss the face, or did the embedding match the wrong gallery entry? Similarity score gives a confidence signal per identification, not just a softmax score biased toward the training classes |

## Recommendation for this project

Given: a **closed set of a small, fixed number of known people**, an
**overhead camera** (non-frontal, variable pose), and a stated need to
eventually recognize when someone is *not* one of the known people — **ArcFace
is the better fit**. Its native unknown-rejection via similarity threshold and
its data efficiency per identity (thanks to VGGFace2 pretraining) directly
address the two weakest points of the current YOLO-only approach: it has no
"unknown" concept, and it was overfitting to a narrow camera/session
distribution rather than learning transferable facial features.

That said, keep the YOLO detector in the loop — plain closed-set
classification into a single `face` class (rather than one class per person)
is a good, fast face detector to feed ArcFace's cropper, and the two systems
in `training/` are wired to a shared `data_preparation.py` specifically so
you can try both and compare on the same validation/test sessions before
committing.
