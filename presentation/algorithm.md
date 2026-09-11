# Face Recognition Algorithm

Source for a NotebookLM slide deck on the FaceVision detection/identification pipeline.
Everything below reflects the code in `pipeline/` as of the `beab017` commit, evaluated
against a held-out golden set.

## 1. Why this design

The project started with a YOLO object-detection model trained to recognize each
person as its own class (`backend/inference/best.pt`, classes `Tohid` / `Mreza` /
`Mahdi`). That approach doesn't scale: adding or removing a person means retraining
the model.

It was replaced with an **open-set detect → align → embed → match** pipeline, built
entirely on pretrained models (no training required):

- Adding a person = adding reference photos and re-running enrollment (a database
  operation, not a retrain).
- Removing a person = deleting their gallery entries.

## 2. Pipeline stages

```
frame ─▶ Detect (RetinaFace) ─▶ Align (112×112) ─▶ Embed (ArcFace) ─▶ Match (cosine similarity)
```

### Stage 1 — Detect: RetinaFace

- `pipeline/RetinaFace.py`, wraps InsightFace's `det_10g.onnx` (from the `buffalo_l`
  model pack), run on ONNX Runtime, CPU (`ctx_id=-1`).
- Pretrained, no fine-tuning.
- Default settings: `det_thresh=0.5`, `det_size=(640, 640)`.
- Output per detected face: bounding box, 5 landmarks (eyes, nose, mouth corners),
  detection confidence.
- Landmarks matter: ArcFace was trained on *aligned* faces, so skipping alignment
  measurably hurts embedding quality — this is why RetinaFace (which gives
  landmarks) was chosen over a plain face detector.

### Stage 2 — Align

- `RetinaFace.align(image, kps)` warps each detected face to a canonical 112×112
  crop using the 5 landmarks (`insightface.utils.face_align.norm_crop`) — the
  standard ArcFace preprocessing transform.

### Stage 3 — Embed: ArcFace

- `pipeline/ArcFace.py`, wraps InsightFace's `w600k_r50.onnx` (also from
  `buffalo_l`), CPU inference.
- Input: a pre-aligned 112×112 crop. Detection and embedding are fully decoupled —
  `ArcFace.embed()` never sees a raw frame.
- Output: a 512-dimension, L2-normalized embedding vector.
- Pretrained, no fine-tuning — accuracy on new people comes from the pretrained
  model generalizing, not from training on specific faces.

### Stage 4 — Match: nearest-neighbor against a gallery

- `pipeline/identify.py`. The "gallery" is a flat store of `(embedding, label)`
  pairs — currently `pipeline/gallery.npz` (382 embeddings across 3 identities:
  Tohid 149, Mahdi 131, MReza 102).
- Since all embeddings are L2-normalized, cosine similarity is a single batched dot
  product: `gallery.embeddings @ query_embedding`, then `argmax`.
- If the best similarity is below `DEFAULT_THRESHOLD = 0.35`, the face is reported
  as `"unknown"`; otherwise it's labeled with the matching identity.
- No vector database — at this scale (a handful of identities, hundreds of
  reference embeddings) a plain array and a dot product is enough.

## 3. Enrollment (building the gallery)

1. Faces are labeled by name as bounding-box annotations in **LabelMe** format
   (`volumes_backup/labels/*.json`), against raw camera snapshots
   (`volumes_backup/snapshots/*.jpg`).
2. `pipeline/extract_from_lableme_annotations.py` crops each labeled box out of its
   source image and saves it to `pipeline/arcface_images/<PersonName>/*.jpg`.
3. `pipeline/enroll.py`:
   - Runs RetinaFace (`det_size=(160, 160)`, tuned for tight face crops) on each
     enrollment image to re-detect and align it to 112×112.
   - Falls back to a plain resize (no landmark alignment) if RetinaFace can't find
     a face in an already-cropped image — this is logged as a "fallback count".
   - Embeds every aligned/resized crop with ArcFace and writes all
     `(embedding, label)` pairs to `gallery.npz`.

## 4. Evaluation methodology

`pipeline/evaluation.ipynb` measures the full pipeline against a **held-out golden
set** — 300 snapshots sampled by `pipeline/select_goldenset.py` (seeded random
sample of camera snapshots that RetinaFace can detect a face in), hand-annotated
with LabelMe, and kept disjoint from the enrollment images used to build
`gallery.npz`.

Ground truth: 534 labeled faces across 300 images (Mahdi 214, Tohid 206, MReza 114).

Method: for every ground-truth box, the detection with the highest IoU (≥ 0.3) is
matched to it; matched detections are aligned, embedded, and identified against the
gallery. Unmatched ground-truth boxes count as detection misses.

### Results (current `gallery.npz`, `DEFAULT_THRESHOLD=0.35`)

| Metric | Value |
|---|---|
| Detection recall | 84.8% (453 / 534) |
| Identification accuracy (given detection) | 93.8% (425 / 453) |
| Verification AUC | 0.956 |
| Equal Error Rate (EER) | 7.6%, at threshold 0.404 |
| Accuracy at `DEFAULT_THRESHOLD=0.35` | 93.8% |
| Best achievable accuracy on this set | 96.0%, at threshold 0.0 |

**Confusion matrix** (rows = true identity, columns = predicted / unknown / missed):

| True \ Pred | MReza | Mahdi | Tohid | unknown | missed |
|---|---|---|---|---|---|
| MReza | 88 | 5 | 0 | 4 | 17 |
| Mahdi | 9 | 148 | 1 | 6 | 50 |
| Tohid | 2 | 1 | 189 | 0 | 14 |

**Per-identity metrics:**

| Identity | Precision | Recall (given detected) | End-to-end recall |
|---|---|---|---|
| MReza | 0.889 | 0.907 | 0.772 |
| Mahdi | 0.961 | 0.902 | 0.692 |
| Tohid | 0.995 | 0.984 | 0.917 |

Mahdi has the lowest end-to-end recall (0.692), driven almost entirely by detection
misses (50 of 214), not misidentification — once detected, Mahdi is identified
correctly 90%+ of the time.

Plots for slides (generated by `pipeline/evaluation.ipynb`, saved to
`presentation/eval_plots/`):
- `confusion_matrix.png`
- `genuine_vs_impostor.png` — cosine similarity distributions for correct-identity
  vs. wrong-identity comparisons
- `roc_curve.png` — true-accept-rate vs. false-accept-rate sweep
- `accuracy_vs_threshold.png` — identification accuracy as `DEFAULT_THRESHOLD` varies

### Important caveat: no true "strangers" in the golden set

Every labeled face in the golden set belongs to one of the 3 enrolled identities —
there is no unenrolled "stranger" in the evaluation data. This means:
- The accuracy-vs-threshold sweep is biased toward threshold 0 (there's no
  unenrolled-face cost to penalize a low threshold).
- The ROC/EER numbers use "a different enrolled identity" as the impostor
  definition, which is the correct threshold-independent view *given this data*,
  but doesn't validate open-set rejection of a genuinely unknown person.
- A golden set including true stranger faces is needed to properly tune
  `DEFAULT_THRESHOLD` for real-world open-set rejection.

## 5. Open design gap worth flagging

The original design proposal (`ML_Pipeline.md`, since replaced by working code)
suggested a similarity threshold of **0.45–0.5**, "tune empirically." The
implemented `DEFAULT_THRESHOLD` is **0.35** — noticeably lower. The evaluation
notebook's EER analysis puts the empirically best separation point around
**0.40**, closer to the original proposal than to what's currently deployed. This
gap hasn't been resolved and should be revisited once a golden set with true
stranger faces exists.

## 6. What's implemented vs. what's still a design doc

**Implemented today** (standalone scripts/notebooks in `pipeline/`, not yet wired
into the backend):
- Detection, alignment, embedding, matching (`RetinaFace.py`, `ArcFace.py`,
  `identify.py`)
- Enrollment pipeline (`extract_from_lableme_annotations.py`, `enroll.py`)
- Golden-set sampling and full evaluation (`select_goldenset.py`,
  `evaluation.ipynb`)

**Designed but not yet built** (from the original `ML_Pipeline.md` proposal):
- Database tables: `Identity`, `FaceEmbedding`, `Event` (with per-camera
  `recognition_enabled` flag)
- A recognition worker that samples each enabled camera on an interval
  (~2s), matches faces against the gallery, and logs `Event` rows subject to a
  per-(camera, identity) cooldown (~30–60s) to avoid duplicate events
- Enrollment UI: capture/pick a snapshot → backend detects candidate faces → admin
  assigns an identity → backend aligns, embeds, and stores the reference embedding
- An "Events" page in the frontend to browse recognition history
- Config keys for interval, threshold, cooldown, and model pack size
  (`buffalo_l` vs `buffalo_s`)

The backend currently still runs the old YOLO object-detection model
(`backend/inference/best.pt`, confidence threshold 0.4) for its existing
annotation/detection features — this is separate from, and not yet replaced by,
the face-identification pipeline described here.
