# FaceVision

A live face-recognition system for RTSP cameras: it streams and identifies
faces in real time, lets admins capture/annotate snapshots to grow the
recognition gallery, and records every detection as an event you can query
through a reporting dashboard.

## Architecture

| Layer | Stack |
|---|---|
| Backend API | FastAPI, SQLAlchemy (async) + Alembic, PostgreSQL |
| Face recognition | RetinaFace (detection) + ArcFace (embedding), via InsightFace's `buffalo_l` pack |
| Event streaming | Kafka (single-node, KRaft) + Kafka UI, `aiokafka` producer/consumer |
| Frontend | React + TypeScript + Vite, MUI, Tailwind CSS, Zustand, TanStack Query |
| Infra | Docker Compose |

```
Camera (RTSP) → backend (RetinaFace + ArcFace) → live MJPEG stream to UI
                                │
                                ├─→ Postgres (snapshots, annotations, users, cameras)
                                │
                                └─→ Kafka topic `detections`
                                        │
                                    worker (consumer)
                                        │
                                 Postgres `detection_events`
                                        │
                                 /api/reporting/* → Reporting page
```

## Features

- **Login & role-based access control** (`super_admin`, `level_1/2/3`).
- **Live camera viewing** — connect to RTSP cameras, view them in the browser.
- **Live face recognition** — real-time detection + identification overlaid on the stream.
- **Offline inference** — run detection/recognition against an uploaded image.
- **Snapshot capture & annotation** — admins capture frames on demand (single or batch across multiple cameras) and label bounding boxes to build/refine the training set.
- **Camera & user management** (admin only).
- **Event streaming & reporting** (admin only) — every detection is published to Kafka, persisted as a presence interval per (person, camera) in Postgres, and browsable on the `/reporting` page:
  - Filter by date range, person, and camera; the date picker follows the site's language (English/Gregorian or Persian/Jalali).
  - A per-camera 24-hour timeline chart (cameras on the vertical axis, time of day on the horizontal axis) showing exactly when each selected person was seen on which camera(s), color-coded per person with overlapping detections split into separate lanes.
  - CSV export of the filtered results.
  - See [`docs/reporting.md`](docs/reporting.md) for retention guidance and deferred/future scope (path reconstruction, live "who's on-site" dashboard, alerting).

## Running the app

Requires Docker and Docker Compose.

1. Copy `.env.example` to `.env` (if present) or create `.env` at the repo root with at least:
   ```
   POSTGRES_USER=facevision
   POSTGRES_PASSWORD=facevision
   POSTGRES_DB=facevision
   JWT_SECRET=change-me
   CAMERA_SECRET_KEY=change-me
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=change-me
   CORS_ORIGINS=http://localhost:5173
   VITE_API_BASE_URL=http://localhost:8000
   ```
2. Start everything:
   ```
   docker compose up -d
   ```
   This brings up Postgres, Kafka (+ Kafka UI), the FastAPI backend, the events-consumer worker, and the frontend.
3. Open:
   - Frontend: http://localhost:5173
   - Backend API docs: http://localhost:8000/docs
   - Kafka UI: http://localhost:8080

An admin account is bootstrapped automatically on first boot from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if no users exist yet. Cameras are added afterward from the Camera Management page (admin only) — RTSP host/credentials are stored encrypted in Postgres, not in `.env`.

Database schema is managed by Alembic migrations, run automatically by the backend container's entrypoint on startup.

## Backend tests

```
cd backend
pip install -r requirements.txt
TEST_DATABASE_URL=postgresql+asyncpg://facevision:facevision@localhost:5432/facevision_test pytest
```

Tests run against a real Postgres database (not SQLite) since models use Postgres-native column types — point `TEST_DATABASE_URL` at a throwaway database.

## Face recognition pipeline (offline tooling)

The `pipeline/` directory holds the standalone scripts/notebooks used to build and evaluate the face gallery consumed by the backend (`backend/inference/gallery.npz`):

- `pipeline/enroll.py` — enrolls reference images per person into the gallery.
- `pipeline/identify.py` — ad-hoc identification against the gallery.
- `pipeline/evaluation.ipynb`, `pipeline/ArcFace_test.ipynb`, `pipeline/RetinaFace_test.ipynb`, `pipeline/Identify_test.ipynb` — exploration/evaluation notebooks.

These are development tools, not part of the running application.
