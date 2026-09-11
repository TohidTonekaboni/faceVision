# FaceVision — Frontend & Backend Features

Source for a NotebookLM slide deck on the FaceVision application (the camera/annotation
platform, as distinct from the standalone face-recognition ML pipeline covered in
`algorithm.md`).

## 1. Product mission

A live camera monitoring system for capturing and labeling face data, built toward
eventual live face recognition with event logging:

- Connect to RTSP cameras, show live view in the UI
- Admin can take snapshots on demand for annotation
- An annotation/labeling tab for drawing bounding boxes and assigning labels
- Login, authentication, and role-based access control
- Admin user-management panel
- Everything (users, labels, annotations, snapshots, cameras) stored in Postgres

## 2. Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), async |
| Database | PostgreSQL 16 |
| Frontend | React + TypeScript, Vite |
| Styling / UI | Tailwind CSS, Material UI (MUI) |
| State | Zustand |
| Data fetching | React Query (`@tanstack/react-query`) |
| Deployment | Docker Compose (db, backend, frontend services) |

## 3. Authentication & access control

- **JWT access tokens** (15-minute expiry) + **opaque refresh tokens** (30 days,
  SHA-256 hashed at rest, single-use and rotated on refresh, revocable).
- A separate short-lived **media token** (5 minutes, scoped to one camera/snapshot
  resource) is minted for embedding in `<img>` URLs, since `<img>` tags can't send
  an `Authorization` header.
- **4-level role model**: `super_admin`, `level_1`, `level_2`, `level_3`. Currently
  only `super_admin` is actually distinguished — everything else is treated the
  same (the finer-grained levels exist in the schema/UI but aren't enforced yet).
- Axios client auto-refreshes on a 401 (single in-flight refresh shared across
  concurrent requests) and retries the original call once before logging out.

## 4. Camera management & live view

- Admin CRUD for RTSP camera configs (name, host, port, path, username, password);
  passwords encrypted at rest with Fernet.
- Live view streams as MJPEG (`multipart/x-mixed-replace`, 15 fps) from a single
  shared RTSP connection **per camera**, not per viewer — this matters because most
  camera/NVR hardware caps concurrent RTSP sessions at 2–4. The stream
  auto-reconnects with exponential backoff and shuts down when nobody is watching.
- A global cap on simultaneous open camera streams (default 16) protects the
  backend under load.

## 5. Snapshot capture

- **On-demand single snapshot**: admin clicks a button, backend grabs the current
  frame (reusing an already-open live-view frame when available, to avoid an extra
  RTSP connect) and stores it.
- **Recurring snapshot session**: admin selects multiple cameras and starts a
  session; the frontend ticks once per second, batch-capturing all selected
  cameras concurrently. The backend pre-warms persistent RTSP connections for the
  session and auto-releases them after a 30-second timeout if the client never
  explicitly stops (covers crashes/dropped connections). A persistent banner in the
  UI shows the running session and lets the admin stop it from any page.

## 6. Annotation / labeling workspace

- Define labels (name + color) up front; labels in use can't be deleted.
- Paginated queue of unannotated snapshots with thumbnails.
- Click-and-drag bounding-box drawing on the snapshot canvas, assigned to the
  active label; boxes are stored normalized (0–1) so they're resolution-independent.
- "Save annotations" marks the snapshot complete (requires at least one box) and
  removes it from the queue.
- All labels/annotations persisted to Postgres, cascade-deleted with their parent
  snapshot.

## 7. Face inference — bridge to face recognition

- A one-shot "Inference" button on the live camera view grabs the current frame
  and identifies faces in it, showing an annotated result for 10 seconds.
- Inference is based on the RetinaFace (detect + align) + ArcFace (embed) + gallery
  match pipeline described in `algorithm.md` — RetinaFace locates faces and their
  landmarks, ArcFace produces a 512-d embedding for each, and the embedding is
  matched against the enrolled gallery (`gallery.npz`) by cosine similarity, with a
  similarity threshold below which a face is reported as `unknown`.
- This replaces an earlier prototype that used a YOLO model trained with one class
  per person (`Tohid`/`Mreza`/`Mahdi`) — that approach required retraining to add
  or remove a person, which is why it was superseded by the open-set RetinaFace +
  ArcFace design.
- Results are not persisted anywhere yet — no detections/events table exists, so
  this is a manual preview action, not continuous recognition or event logging.

## 8. User management

- Admin-only CRUD: create users (username, full name, password, role), edit role /
  active status / password inline, delete.
- First `super_admin` account is bootstrapped automatically from environment
  variables on first run if the `users` table is empty.

## 9. Internationalization

- English/Farsi language toggle with full RTL layout support.

## 10. Data model (Postgres, via Alembic migrations)

| Table | Purpose |
|---|---|
| `users` | Login accounts, role, active flag |
| `refresh_tokens` | Hashed, revocable refresh tokens per user |
| `cameras` | RTSP connection details (encrypted password) |
| `snapshots` | Captured frames, linked to camera, annotation status |
| `labels` | Named, colored annotation categories |
| `annotations` | Normalized bounding boxes linking a snapshot to a label |

No tables yet for recognition events, embeddings, or identities — the schema
currently covers the camera/annotation/user-management workflow, matching the
"first step" scope in the product mission. Adding `Identity` / `FaceEmbedding` /
`Event` tables (and wiring the face-recognition pipeline into a background worker
that populates them) is the next major milestone, not yet started.

## 11. Roadmap: connecting the pipeline to the app

The RetinaFace + ArcFace pipeline (`algorithm.md`) currently runs standalone in
notebooks/scripts, disconnected from this application. The planned integration:

1. New DB tables: `Identity` (a recognized person, distinct from a login `User`),
   `FaceEmbedding` (512-d vectors linked to enrollment snapshots), `Event`
   (camera + identity + confidence + bbox + timestamp), plus a
   `Camera.recognition_enabled` opt-in flag.
2. An enrollment flow: pick a snapshot → backend detects candidate faces → admin
   assigns an identity → backend aligns, embeds, and stores the reference vector.
3. A background recognition worker sampling each enabled camera every ~2 seconds,
   matching against the in-memory gallery, and logging events with a per-camera,
   per-identity cooldown (~30–60s) to avoid duplicate spam.
4. An "Events" page in the frontend to browse recognition history.

## 12. Known gaps worth flagging on a slide

- The root `.env` file contains real-looking secrets committed to the repo — should
  be rotated and gitignored.
- The `.env` file has a stale comment describing cameras as an env-configured JSON
  list; cameras are actually fully managed via the database and the admin API now.
- Role levels beyond `super_admin` exist but carry no distinct permissions yet.
