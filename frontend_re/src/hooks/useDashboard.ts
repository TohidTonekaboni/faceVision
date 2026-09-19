import {
  useDashboardStats as useApiDashboardStats,
  useSystemHealth as useApiSystemHealth,
  useTopPeople as useApiTopPeople,
  useDashboardNotifications,
  type DetectionEvent,
} from "../api/queries";
import { useCameras } from "./useCameras";
import { colorForId } from "../utils/palette";
import { timeAgo } from "../utils/relativeTime";

export type FeedTab = "all" | "known" | "unknown";

/** Detections whose person record is unknown are stored with the literal
 * display name "unknown" (see backend `events_consumer.py`), so this is a
 * safe, non-admin-only way to tell known and unknown apart on the dashboard
 * feed without calling the admin-only /api/reporting/people endpoint. */
export function isUnknownPersonName(name: string): boolean {
  return name.trim().toLowerCase() === "unknown";
}

export type DashboardStatKey =
  | "total_cameras"
  | "active_cameras"
  | "detections_today"
  | "unknown_detections_today"
  | "distinct_people_today";

export interface DashboardStatItem {
  key: DashboardStatKey;
  value: number;
  /** Decorative progress bar fraction (0-100) — only set where a natural
   * denominator exists (active/total cameras, unknown/total detections).
   * The mock's fabricated day-over-day delta has no real backend
   * equivalent, so it's dropped rather than invented. */
  pct: number | null;
  unitKey?: "of_total_cameras" | "of_detections_today";
}

export function useDashboardStats() {
  const query = useApiDashboardStats();
  const s = query.data;
  const items: DashboardStatItem[] | undefined = s
    ? [
        { key: "total_cameras", value: s.total_cameras, pct: null },
        {
          key: "active_cameras",
          value: s.active_cameras,
          pct: s.total_cameras > 0 ? (s.active_cameras / s.total_cameras) * 100 : 0,
          unitKey: "of_total_cameras",
        },
        { key: "detections_today", value: s.detections_today, pct: null },
        {
          key: "unknown_detections_today",
          value: s.unknown_detections_today,
          pct: s.detections_today > 0 ? (s.unknown_detections_today / s.detections_today) * 100 : 0,
          unitKey: "of_detections_today",
        },
        { key: "distinct_people_today", value: s.distinct_people_today, pct: null },
      ]
    : undefined;
  return { ...query, data: items };
}

export function useActiveCameraStrip() {
  const query = useCameras();
  return { ...query, data: query.data?.slice(0, 7) };
}

export interface FeedItem {
  id: string;
  personName: string;
  isUnknown: boolean;
  cameraId: string | null;
  cameraName: string;
  startedAt: string;
  maxConfidence: number | null;
}

function toFeedItem(e: DetectionEvent): FeedItem {
  return {
    id: e.id,
    personName: e.person_name,
    isUnknown: isUnknownPersonName(e.person_name),
    cameraId: e.camera_id,
    cameraName: e.camera_name,
    startedAt: e.started_at,
    maxConfidence: e.max_confidence,
  };
}

/** Dashboard's "live detection feed" is backed by the same
 * /api/dashboard/notifications endpoint as the topbar dropdown (both are
 * "recent detections, most recent first" — there's no separate
 * paginated/tabbed feed endpoint), fetched with a larger limit and filtered
 * client-side by tab. */
export function useDetectionFeed(tab: FeedTab) {
  const query = useDashboardNotifications(30);
  const items = query.data?.map(toFeedItem);
  const filtered = items?.filter((i) => tab === "all" || (tab === "unknown" ? i.isUnknown : !i.isUnknown));
  return { ...query, data: filtered };
}

export interface NotificationItem {
  id: string;
  personName: string;
  isUnknown: boolean;
  cameraName: string;
  ago: string;
}

export function useNotifications(limit = 10) {
  const query = useDashboardNotifications(limit);
  const items = query.data?.map((e) => ({
    id: e.id,
    personName: e.person_name,
    isUnknown: isUnknownPersonName(e.person_name),
    cameraName: e.camera_name,
    ago: timeAgo(e.started_at),
  }));
  return { ...query, data: items };
}

export type { SystemHealthItem } from "../api/queries";

export function useSystemHealth() {
  return useApiSystemHealth();
}

export interface TopPersonItem {
  personId: string;
  name: string;
  isUnknown: boolean;
  count: number;
  pct: number;
  color: string;
}

export function useTopPeople(days = 7, limit = 5) {
  const query = useApiTopPeople(days, limit);
  const max = Math.max(1, ...(query.data?.map((p) => p.detection_count) ?? [1]));
  const items: TopPersonItem[] | undefined = query.data?.map((p) => ({
    personId: p.person_id,
    name: p.display_name,
    isUnknown: p.is_unknown,
    count: p.detection_count,
    pct: (p.detection_count / max) * 100,
    color: colorForId(p.person_id, p.is_unknown),
  }));
  return { ...query, data: items };
}
