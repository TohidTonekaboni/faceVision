# Redesign Prompt — FaceVision Frontend

Use this prompt with Claude (design mode / artifact generation) to produce updated UI/UX designs for the FaceVision app. Paste the whole block below as the instruction.

---

## Prompt

I'm redesigning the frontend of **FaceVision**, a role-gated web app for a live RTSP face-recognition and camera-surveillance system. I want a modern, beautiful, professional UI/UX redesign — treat this like a real product design exercise, not a code refactor.

**Tech constraints (keep these in mind but focus on visual/UX design, not implementation):**
- **Frontend-only redesign — the backend must not change.** Every screen must be achievable using only the existing API endpoints and data already returned today (cameras, snapshots, labels, annotations, users, people, detection events). No new backend entities, endpoints, or fields (e.g. no new "alerts"/"watchlist" database concept) — if something like a notifications feed or "recent activity" shows up, it must be built by re-presenting existing detection-event data on the frontend, not by inventing new backend data.
- React + TypeScript, MUI v6 component primitives + Tailwind utility classes.
- Must support English (LTR) and Persian/Farsi (RTL) with a live language switch — every layout must mirror cleanly in RTL.
- Must support a proper dark mode (this is a 24/7 monitoring tool, dark should be the default/primary mode) and a light mode.
- Existing brand accent is an indigo/teal palette (`#4F46E5` primary, `#0D9488` accent) — feel free to evolve it into something richer and more "security/NOC-product" feeling (deep navy/slate backgrounds, glowing accent for "live" states, clear danger/warning/success semantics for alerts), but keep it professional, not garish.

**Current app structure (what exists today, so the redesign covers real screens, not hypothetical ones):**

1. **Login** — simple centered auth card.
2. **Camera List** (home page) — grid of camera cards (currently generic icons, no real thumbnails), online/offline + "LIVE" status, global "Start/Stop Live Inference" toggle and a "Snapshot session" toggle (super-admin only).
3. **Camera View** — single live MJPEG video stream per camera, optionally showing server-drawn face-recognition bounding boxes when inference is active. Currently no fullscreen, no multi-camera wall view, no PTZ/audio.
4. **Offline Inference** — upload a static image, run face recognition on it, see annotated result + a list of detected labels/confidences.
5. **Annotation** — a labeling tool: manage named/colored labels, browse a queue of unannotated snapshots, draw bounding boxes on a selected snapshot to tag faces/objects, save.
6. **Camera Management** (admin) — CRUD table for RTSP camera configs (host/port/path/credentials).
7. **User Management** (admin) — CRUD table for user accounts and roles (super_admin, level_1, level_2, level_3).
8. **Reporting** (admin) — the flagship analytics page, but currently **too complicated and dense**: two date pickers (a report-range "From/To" and a separate, easily-confused-with-it "Timeline day" picker), a People multi-select, a Camera multi-select, an "include unrecognized" checkbox, a CSV export button, a per-camera "timeline swimlane" chart (shows when each recognized person or "unknown" appeared during the day — the best feature on the page), and a paginated table of detection events (person, camera, first/last seen, count) — all currently presented as one dense, equal-weight, ungrouped scroll with no stats/orientation and no separation between "filter the page," "adjust just the chart," and "view results."

**App shell today:** fixed left sidebar (brand, persistent "session running" status banners, nav links, user footer with sign-out) and no topbar at all — no search, no notifications, no breadcrumbs, no theme toggle.

**What I want you to design:**

1. A **new dashboard/overview landing page** — the first thing an operator sees. Should surface: live system status, a grid of camera live-thumbnails, a feed of recent/notable detections (built from the existing detection-events data, not a new backend concept), and key at-a-glance stats (active cameras, people recognized today, etc). This should feel like a security-operations dashboard.
2. A redesigned **camera grid/wall view** with real-looking live thumbnails, clear live/offline/inference-active states, and hover quick-actions — plus a way to jump into a focused, fullscreen single-camera view with the bounding-box overlay looking clean and legible.
3. A cohesive **design system direction**: card style, table style, dialog/modal style, empty states, loading skeletons, toast/notification style, and both dark and light theme treatments — applied consistently across all the pages listed above, not just the dashboard.
4. A **new app shell**: sidebar navigation (can restyle, but keep it functional and add role-based grouping) plus a proper topbar with global search over existing camera/person data, a notifications bell surfacing recent detection events (still just existing data, re-presented — no new backend alert type), and a light/dark theme toggle. Keep the persistent "session running" indicators from today but make them feel like polished live-status chips, not plain colored banners.
5. A **much simpler Reporting page** — this is the page users have specifically flagged as too complicated, so prioritize reducing perceived complexity over adding polish:
   - A short **orientation stats strip** at the top (e.g. total detections in range, distinct people, distinct cameras, active date range) so users have context before touching any control.
   - Filters collapsed into a single **compact filter summary bar** by default (e.g. "Last 7 days · All cameras · All people ▾") that expands into the full date-range/people/camera/include-unknown controls only when clicked — don't show 5+ raw form fields at all times.
   - The **timeline swimlane chart** as its own clearly-framed section with a heading and a short explanatory caption, its "which day" picker placed visibly *inside* that section (not next to the report-range filters) so it's unmistakable that it only controls the chart, not the table below.
   - The **results table** as a visually distinct "card" below the chart (clear header with a live result count, zebra striping/row hover, pagination) — not butted directly against the chart with just a thin line between them.
   - Net goal: someone opening this page for the first time should see 3–4 clearly labeled sections (stats → filters summary → timeline → results), not ~9 controls and a chart and a table all fighting for attention at once.
6. Refreshed **Annotation** and **Offline Inference** tools that feel like first-class parts of the product — drag-and-drop upload styling, a clear bounding-box drawing affordance, and better visual separation between "queue," "canvas," and "labels."
7. Make sure every screen you design works believably in **both English/LTR and Persian/Farsi/RTL**, and in **both dark and light mode** — call out how key layouts mirror/adapt.

Please produce high-fidelity visual concepts (as interactive HTML/React mockups if you're generating artifacts, or detailed descriptions + layout breakdowns otherwise) for: (a) the new dashboard, (b) the camera grid + focused camera view, (c) the reporting page, and (d) the shared app shell (sidebar + topbar) — since those four screens define the rest of the design system and the remaining pages (Annotation, Offline Inference, Camera/User Management, Login) can follow from the same components and patterns.
