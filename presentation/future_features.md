# FaceVision — Future Features

Source for a NotebookLM slide deck on what's next for FaceVision. Builds on the
current state documented in `algorithm.md` (the RetinaFace + ArcFace pipeline) and
`project_features.md` (the FastAPI + React application) — this document covers what
is planned but **not yet built**.

## 1. Live face recognition (the core missing link)

The single biggest gap: the RetinaFace + ArcFace pipeline runs standalone in
notebooks/scripts today and is completely disconnected from the live application.
Closing this loop is the next major milestone.

**New database tables:**
- `Identity` — a recognized person (distinct from `User`, which is a dashboard
  login account with a role)
- `FaceEmbedding` — 512-d reference vectors per identity, linked to the enrollment
  snapshot they came from
- `Event` — camera + identity + confidence + bounding box + timestamp, one row per
  recognition
- `Camera.recognition_enabled` — opt-in flag so recognition runs only on cameras
  explicitly enabled for it, not globally by default

**Recognition worker:**
- A background loop per recognition-enabled camera, sampling on an interval
  (~2 seconds) rather than every frame, to bound CPU cost
- A per-(camera, identity) cooldown (~30–60s) so the same person sitting in frame
  across consecutive samples doesn't spam duplicate events
- v1 scope: log events only for recognized identities, not every "unknown face
  detected" — unknown-face logging can be added later once threshold/cooldown
  behavior is proven; starting with it risks a noisy event feed

**Enrollment UI (replaces the current offline LabelMe → crop → `enroll.py` flow):**
- Admin picks or captures a snapshot
- Backend runs RetinaFace and returns candidate face boxes
- Admin assigns an identity to a box (existing or new)
- Backend aligns, embeds, and stores the reference embedding; refreshes the
  in-memory gallery
- Recommend 3–10 reference photos per identity for a robust gallery

## 2. Events page (frontend)

A new page to browse recognition history once events exist:
- Filter by camera, identity, date range
- Thumbnail of the matched face crop alongside the source snapshot
- Useful both as an audit log and as a way to spot false positives/negatives for
  threshold tuning

## 3. Threshold tuning with a proper open-set golden set

The current evaluation golden set has no true "stranger" faces — every labeled
face belongs to one of the 3 enrolled identities. This means the identification
threshold (`DEFAULT_THRESHOLD = 0.35`) has never been validated against real
open-set rejection, and there's an unresolved gap between the implemented value
(0.35) and both the original design proposal (0.45–0.5) and the empirically best
separation point measured so far (~0.40).

Planned: extend the golden set with genuinely unenrolled faces, re-run the
ROC/EER analysis, and settle on a threshold with actual open-set evidence rather
than a closed-set approximation.

## 4. Fine-grained role permissions

The schema and UI already define 4 roles (`super_admin`, `level_1`, `level_2`,
`level_3`), but only `super_admin` is currently distinguished from everyone else.
Planned: define what each level can actually do (e.g., `level_1` = view-only,
`level_2` = can annotate, `level_3` = can manage cameras) and enforce it
per-endpoint instead of the current single admin/non-admin check.

## 5. Continuous detection overlay on the live view

Today the "Inference" button is a manual, one-shot action that temporarily
replaces the live view with an annotated frame for 10 seconds. A natural next
step is an overlay mode that continuously draws bounding boxes/names on the live
MJPEG stream as recognition runs, rather than requiring a manual trigger per
check.

## 6. Notifications / alerting

Once events are being logged, a natural extension is real-time alerting — e.g.,
notify an admin when a specific identity (or an unknown face) is seen on a
particular camera, rather than requiring someone to check the Events page.

## 7. Operational hardening

- Rotate and stop committing the real secrets currently sitting in the repo's
  root `.env` file; move it out of version control.
- Remove the stale `.env` comment describing cameras as an env-configured JSON
  list — cameras are fully managed through the database and admin API now, and
  the leftover comment is misleading.
- Consider `buffalo_s` (smaller/faster InsightFace model pack) as a configurable
  option if the recognition worker's CPU cost becomes a bottleneck at higher
  camera counts or sampling rates.

## 8. Scaling the gallery

The current match step is a flat array + a single batched dot product — fine at
today's scale (382 embeddings, 3 identities). If the number of enrolled identities
grows substantially, revisit whether an approximate nearest-neighbor index or
`pgvector` is worth the added complexity; not needed yet.
