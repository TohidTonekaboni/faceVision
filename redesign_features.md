# FaceVision Frontend — Feature Inventory & Redesign Plan

> **Hard constraint: frontend-only redesign.** The backend (API contracts, endpoints, response shapes, `backend/`) must **not** change. Every idea below has to be achievable by only changing `frontend/` — restyling, rearranging, grouping, collapsing/expanding existing data and existing API calls. No new backend fields, endpoints, or entities (e.g. no new Alert/Watchlist tables) unless purely aspirational/out-of-scope notes explicitly marked as "future backend work."

## 1. What FaceVision is today

A role-gated web app for an RTSP-based live face-recognition system. Stack: React 18 + TypeScript, Vite, MUI v6, Tailwind, zustand, TanStack Query, react-router-dom, dayjs + jalaliday (Persian calendar). Hand-rolled i18n with full English/Persian + RTL support. Single light theme, indigo/teal palette, flat/soft aesthetic (no elevation shadows, radius 10).

Domain entities: `User` (role: super_admin / level_1 / level_2 / level_3 — only super_admin is actually differentiated in the UI today), `Camera` (RTSP config), `Snapshot`, `Label`, `Annotation`, `Person` (incl. "unknown"), `DetectionEvent`. No Alert/Watchlist entity exists yet.

## 2. Current pages & features (as-is)

### Login (`/login`)
- Centered card, username/password form (OAuth2 form-encoded), language toggle in the corner.
- No "remember me", no forgot-password flow, minimal branding (small camera icon + wordmark).

### Camera List (`/cameras`) — home route
- Grid of camera cards: name, online/offline pill, "LIVE" badge, generic camera-icon placeholder (no real thumbnail preview).
- Clicking a card swaps in `CameraView` inline (not a separate route/URL).
- Super-admin only, top-right: "Snapshot" (multi-camera batch capture session, ~1/sec), "Stop", and a single **global** Start/Stop Live Inference toggle for *all* cameras at once (no per-camera control here).

### Camera View (rendered inline from Camera List)
- One live MJPEG stream via short-lived per-camera token, auto-refreshing/reconnecting.
- If a global inference session is running and includes this camera, swaps to the server-annotated inference MJPEG stream (bounding boxes baked in server-side, not an HTML/canvas overlay).
- Aspect ratio inferred from first frame. Only a "Back to cameras" link — no zoom, PTZ, audio, fullscreen, or per-camera snapshot button.

### Offline Inference (`/offline-inference`)
- Upload an image → preview → "Run Inference" → backend returns annotated JPEG + flat `{label, confidence}` list.
- No bounding-box interactivity, no batch upload, no history of past runs.

### Annotation (`/annotation`)
- Label-chip management bar (create/delete named+colored labels; delete blocked if in use).
- Left sidebar: paginated (20/page) unannotated-snapshot queue with thumbnails, camera name, timestamp, dimensions, delete.
- Right pane: click-drag rectangle drawing (normalized coords) tied to a selected label; existing boxes shown with hover-delete; "Save" marks snapshot annotated and removes from queue.

### Camera Management (`/camera-management`, super_admin)
- CRUD table for RTSP configs: name/host/port/path/username, "secured" chip, inline active toggle, edit/delete.
- Add/Edit dialog with RTSP fields; delete confirmation dialog.

### User Management (`/users`, super_admin)
- Inline create-user form above a user table; inline role select + active switch per row; delete.
- Roles `level_1`–`level_3` are provisioned but not yet meaningfully differentiated anywhere in the frontend.

### Reporting (`/reporting`, super_admin) — most complex page, flagged as needing a UX simplification pass
- Everything lives in one dense `flex-wrap` row with no grouping or visual hierarchy: two date pickers, a People multi-select autocomplete, a Camera multi-select autocomplete, and an "include unrecognized" checkbox all sit at equal visual weight, back to back, with no section headers or breathing room.
- Directly below that, a **second, separate** date picker ("Timeline day") controls just the chart — so the page has two independent date concepts (report range vs. timeline day) presented side by side with no visual distinction, which is a common source of user confusion ("why did changing the date not update the table?").
- **`CameraTimelineChart`**: per-camera swimlanes of detection segments for a day, auto-laned when overlapping, up to 6 fixed categorical colors for real identities + shared "Other" + distinct muted gray for "unknown", legend, drag-to-zoom with adaptive tick density, local-timezone-correct boundaries, per-segment tooltip (person/time-range/count). This is the best-built, most valuable feature on the page, but it's visually squeezed between the filter row and the table with no framing of its own.
- Paginated (20/page) detections table: Person / Camera / First seen / Last seen / Detection count — plain HTML table, no zebra striping/hover state, sits directly under the chart with only a thin border separating sections.
- Net effect: a first-time (or infrequent) user sees ~9 interactive controls, a chart, and a table all at the same visual weight in one scroll, with no stats/orientation ("what am I even looking at right now"), no grouping of "filter the whole page" vs. "adjust the chart only", and no indication of which controls matter most. This is exactly the complexity the user has asked to reduce.

## 3. App shell (as-is)

- No topbar/header at all: no breadcrumbs, no global search, no notifications, no dark-mode toggle.
- Fixed 256px left sidebar: brand block + language toggle → persistent global session banners (snapshot session running / live-inference running, each stoppable inline from any page) → nav links (role-gated) → footer with avatar/name/role/sign-out.
- RTL-aware (border side, icon mirroring, badge position flip).

## 4. Gaps that motivate a redesign

- **No overview/dashboard** — no at-a-glance system health, active cameras, recent detections, or alerts on login; users land straight on a camera grid.
- **No dark mode** — single light theme only, unusual for a 24/7 surveillance/NOC-style tool.
- **No real camera thumbnails** — grid shows generic icons instead of live/recent preview frames, making the grid hard to scan visually.
- **Flat, code-driven visual hierarchy** — inline dialogs/tables per page, no shared design system components (cards, tables, dialogs, empty/loading states) — feels functional/admin-panel rather than a polished product.
- **CameraView is minimal** — no fullscreen, PTZ, multi-camera wall/grid live view, audio, or per-camera snapshot action.
- **Role levels 1–3 unused** — only a binary admin/non-admin split exists; no differentiated navigation or permissions for the granular roles that already exist in the data model.
- **No alerting/watchlist UI** — no backend entity for this exists, and per the frontend-only constraint above we won't build one now. Out of scope for this redesign; noted only as a future backend-dependent idea, not something to design around today.
- **Reporting is dense but isolated** — the best-built feature (timeline chart) is buried on one admin-only page; nothing surfaces "who's on site now" live.
- **Annotation/Offline Inference feel like internal tools** — functional but not visually consistent with the rest of the product; no run history, no drag-drop upload polish.
- **No responsive/mobile consideration called out** — sidebar-first layout likely doesn't collapse gracefully; worth explicit redesign attention.
- **Session banners are functional-only** — snapshot/inference status banners are plain colored bars; could become richer live status chips/toasts.

## 5. Reporting page — specific simplification plan

The user has explicitly called out `/reporting` as too complicated today. Rather than just "make it prettier," simplify the actual information architecture:

1. **Separate "what am I filtering" from "what am I looking at right now."** Group the range/people/camera/unknown filters into one clearly-bordered "Filters" panel with a heading, laid out as a clean grid (date range as one paired control, then People / Cameras / Include unknown), instead of one undifferentiated flex-wrap row. Collapse it by default to a compact summary ("Last 7 days · All cameras · All people") that expands on click, so returning users aren't re-reading 5 controls every visit.
2. **Give the timeline its own visual section**, separate from the filters and from the table — its own card with a header ("Camera timeline"), the "Timeline day" picker placed clearly *inside* that card (visually tied to the chart, not floating next to the report-range filters) so it's obvious it only affects the chart below it, plus a one-line caption explaining what it shows.
3. **Add a lightweight orientation strip** above everything else: 3–4 simple stats (total detections in range, distinct people, distinct cameras, date range shown) so the user has context before parsing filters/chart/table.
4. **Turn the raw table into a proper "Results" card**: header with a live count ("128 detection events"), zebra striping/row hover, and keep pagination — but visually detach it from the chart above so the two don't read as one continuous block.
5. **Progressive disclosure over one flat list**: default view = stats strip + collapsed filter summary + timeline + table. Filters expand only when the user wants to change them. This alone removes most of the "too many things at once" feeling without dropping any functionality.
6. **Consistent picker UX**: use one shared date-range concept where possible; if the timeline truly needs an independent single day, make that difference obvious through placement/labeling (as in #2) rather than through subtlety of a checkbox-sized visual difference.

## 6. Redesign goals for the UI/UX refresh

1. Introduce a **modern dashboard/overview** landing page (system status, live camera thumbnails, a "recent detections" feed built from existing `DetectionEvent` data — not a new alerts entity, quick stats) — replaces or supplements the raw camera grid as the entry point.
2. Add **dark mode** (default for a surveillance tool) with a light mode toggle, refined palette, and consistent elevation/depth language (replace the currently intentionally-flat aesthetic with tasteful depth/glassmorphism or soft neumorphic cards where appropriate).
3. Redesign the **camera grid** with live/recent thumbnail previews, richer status chips, hover quick-actions (view, snapshot, start inference) and a toggle between grid/list/wall views.
4. Elevate **Camera View** into a proper focused viewing experience: fullscreen, multi-camera "video wall" mode, clearer live/inference-mode indicator, per-camera quick actions.
5. Build a shared **design system** (buttons, cards, tables, dialogs, empty states, skeleton loaders, toasts) so all pages (Annotation, Reporting, Management tables) feel like one product instead of separately built screens.
6. Add a real **topbar**: global search over existing camera/person data already returned by the API, breadcrumbs, a notifications bell surfacing recent `DetectionEvent`s (no new backend alert concept), theme toggle, alongside the existing sidebar nav.
7. Simplify **Reporting** per the plan in §5 above: orientation stats strip, collapsible filter panel, a dedicated timeline section with its own day-picker clearly scoped to the chart, and a visually distinct results table — turning one dense scroll of ~9 equal-weight controls into a small number of clearly separated, progressively-disclosed sections.
8. Polish **Annotation** and **Offline Inference** to feel like first-class tools: drag-and-drop upload zones, run history, clearer keyboard-driven bounding-box workflow.
9. Make **role-based navigation** visually meaningful even though only super_admin/non-admin is enforced today — prepare the IA for level_1–3 differentiation later.
10. Ensure the redesign preserves full **EN/FA + RTL** correctness — this is a mature, load-bearing feature and must not regress.
