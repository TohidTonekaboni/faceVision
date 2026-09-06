# ML Pipeline — Face Detection & Recognition

Replaces the identity-as-YOLO-class approach (`backend/inference/best.pt`, classes
`Tohid`/`Mreza`/`Mahdi`) with an open-set detect → embed → match pipeline, so adding
or removing a known person is a database change, not a retrain.

## Pipeline

```
frame → [1. Detect] → [2. Align] → [3. Embed] → [4. Match] → [5. Log Event]
```

### 1. Detection — RetinaFace

- Model: `buffalo_l` (or `buffalo_s` if CPU cost matters more than accuracy) via the
  `insightface` package, running on ONNX Runtime (CPU). Pretrained — no fine-tuning.
- Downscale the frame (longest side ~640px) before detection to bound CPU cost;
  RetinaFace accuracy on a face-sized region doesn't need full camera resolution.
- Output per face: bounding box, 5 landmarks (eyes, nose, mouth corners), detection
  confidence.

Chosen over YOLO-face specifically because the landmarks feed step 2 — ArcFace was
trained on aligned faces, and skipping alignment measurably hurts embedding quality.

### 2. Alignment

- Warp each detected face to the canonical 112×112 pose using its 5 landmarks
  (standard ArcFace preprocessing; `insightface` provides this transform directly).

### 3. Embedding — ArcFace

- Pretrained ArcFace (part of the same `buffalo_l`/`buffalo_s` pack) → 512-d,
  L2-normalized embedding per aligned face. No fine-tuning needed — accuracy on new
  faces comes from the pretrained model generalizing, not from retraining on your
  specific people.

### 4. Matching

- In-memory gallery: `identity_id → [embedding, ...]`, loaded from Postgres at
  startup and refreshed whenever enrollment changes. No vector DB / `pgvector` at
  this scale (a handful of identities, tens of reference embeddings) — a Python
  list and a dot-product loop is enough, since embeddings are already normalized
  (cosine similarity = dot product).
- For each detected face, compare against every reference embedding, take the best
  match. Above `recognition_similarity_threshold` → that identity; otherwise
  "unknown."
- Threshold is empirical — start around 0.45–0.5 for ArcFace cosine similarity and
  tune against real footage before trusting it for anything unattended.

### 5. Event logging

- A background loop per camera with recognition enabled, sampling on an interval
  (not every frame — see worker design below).
- Per (camera, identity) cooldown suppresses duplicate events while the same person
  sits in frame across consecutive samples.
- v1 recommendation: only log events for recognized identities, not every
  "unknown face detected." Unknown-face logging is easy to add later once the
  cooldown/threshold behavior is proven — starting with it risks the event feed
  being mostly noise.

## Data model changes

New tables (new Alembic migration):

```python
class Identity(Base):
    __tablename__ = "identities"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id", ondelete="CASCADE"), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)  # 512-d
    source_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("snapshots.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    camera_id: Mapped[str | None] = mapped_column(ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    identity_id: Mapped[str | None] = mapped_column(ForeignKey("identities.id", ondelete="SET NULL"), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("snapshots.id", ondelete="SET NULL"), nullable=True)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
```

Plus `Camera.recognition_enabled: Mapped[bool]` (default `False`) so recognition is
opt-in per camera rather than on for everything by default.

**`Identity` is not `User`.** `User` rows are dashboard login accounts with roles;
`Identity` rows are recognized people the camera watches for. Conflating them would
force every recognized person to also be an app account, which isn't the model.

**`Label`/`Annotation` tables**: no longer part of this pipeline (there's no detector
left to train on manually-drawn boxes). Leave them in place rather than dropping
them — low migration risk, and they stay available if generic object-detection
annotation is ever wanted again. Don't build new features on them.

## Recognition worker design

Mirrors `camera_stream_hub` (`backend/app/camera_stream.py`) but with different
lifetime semantics: a live-view stream idles out ~5s after the last viewer
disconnects; a recognition stream must stay open for as long as recognition is
enabled on that camera, independent of whether anyone is watching. So it calls
`camera_stream_hub.acquire()`/`release()` itself, on its own lifecycle (start when
`recognition_enabled` flips on, stop when it flips off or the app shuts down) —
not tied to viewer refcounting.

Each tick (e.g. every 2s):
1. `camera_stream_hub.peek_latest_jpeg(camera_id)` (free — same trick the snapshot
   session already uses) or its own acquired stream's latest frame.
2. Decode → detect → align → embed → match (steps 1–4 above).
3. For each match past the per-(camera, identity) cooldown, write an `Event` row.

Recognition streams count against the existing `max_concurrent_camera_streams` cap
— enabling recognition on many cameras alongside live viewing and snapshot sessions
can hit that cap sooner than before. Worth revisiting the cap once you know how many
cameras will run recognition simultaneously.

## Enrollment flow

Replaces manual bounding-box annotation for this purpose (there's no detector being
trained, so freehand box-drawing isn't needed for it):

1. Capture or pick an existing snapshot (reuses the current snapshot feature as-is).
2. Backend runs RetinaFace on it, returns candidate face boxes.
3. Admin clicks a candidate face, assigns an existing `Identity` or creates a new
   one by name.
4. Backend aligns + embeds that crop, stores it as a `FaceEmbedding` row, and
   refreshes the in-memory gallery.

Recommend 3–10 reference photos per identity (varied angle/lighting) for embedding
robustness — one photo works but is fragile to pose/lighting changes.

This is a judgment call, not a certainty: if you still want generic object-detection
annotation as a separate feature, keep the existing Annotation canvas for that and
add enrollment as a new, additional tab rather than a replacement.

## Config additions (`backend/app/config.py`)

- `recognition_interval_seconds` (default ~2.0)
- `recognition_similarity_threshold` (default ~0.45, tune empirically)
- `recognition_event_cooldown_seconds` (default ~30–60)
- `recognition_min_detection_confidence`
- `face_model_pack` (`buffalo_l` / `buffalo_s`)

## Dependencies

- Add: `insightface`, `onnxruntime` (CPU build).
- Retire: `ultralytics` + `backend/inference/best.pt` for identification. (Keep
  `ultralytics` only if some other, non-identity object detection is wanted later —
  not required for this pipeline.)
- Docker: bake `insightface` model weights into the image at build time rather than
  letting them download on first request — avoids a slow/offline-broken cold start
  in production.

## Frontend changes

- **Events page**: feed/table of recent events — camera, identity or "Unknown",
  confidence, timestamp, thumbnail. Read access at `level_1`+, matching the existing
  RBAC pattern.
- **Enrollment page**: the auto-detect-and-tag flow described above (new, or a
  reworked `Annotation.tsx`).
- **Camera management**: a `recognition_enabled` toggle per camera, next to the
  existing `is_active` switch.

## Phased rollout

0. Add `insightface`/`onnxruntime`; verify RetinaFace+ArcFace run locally against a
   test image before touching the app.
1. Migration: `identities`, `face_embeddings`, `events` tables + `Camera.recognition_enabled`.
2. Enrollment endpoints + minimal frontend.
3. Recognition worker + event-write path.
4. Events frontend page + camera recognition toggle.
5. (Stretch) tune thresholds against real footage, consider simple cross-sample
   tracking (e.g. IoU) instead of pure time-cooldown to reduce duplicate events,
   `pgvector` only if the identity gallery grows large enough to matter.

## Open decisions made by default here — revisit if you disagree

- Annotation tool is treated as fully replaced by enrollment. If you want to keep
  generic bounding-box annotation too, keep both features side by side instead.
- Recognition is opt-in per camera, sampled every ~2s — not all cameras, not
  full frame rate, by default.
- v1 does not log "unknown face" events, only recognized identities.
