import { useQuery } from "@tanstack/react-query";
import { delay } from "../data/mockApi";
import {
  CAM_RECENT,
  DASH_STATS,
  FEED_ROWS,
  NOTIFICATIONS,
  SYSTEM_HEALTH,
  TOP_PEOPLE,
  focusBoxes,
} from "../data/detections";
import { CAMERAS } from "../data/cameras";

export type FeedTab = "all" | "known" | "unknown";

export function useDashboardStats() {
  return useQuery({ queryKey: ["dashboard-stats"], queryFn: () => delay(DASH_STATS) });
}

export function useActiveCameraStrip() {
  return useQuery({ queryKey: ["camera-strip"], queryFn: () => delay(CAMERAS.slice(0, 7)) });
}

export function useDetectionFeed(tab: FeedTab) {
  return useQuery({
    queryKey: ["detection-feed", tab],
    queryFn: () =>
      delay(FEED_ROWS.filter((r) => tab === "all" || (tab === "unknown" ? r.unknown : !r.unknown))),
  });
}

export function useSystemHealth() {
  return useQuery({ queryKey: ["system-health"], queryFn: () => delay(SYSTEM_HEALTH) });
}

export function useTopPeople() {
  return useQuery({ queryKey: ["top-people"], queryFn: () => delay(TOP_PEOPLE) });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => delay(NOTIFICATIONS) });
}

export function useFocusBoxes(cameraId: string | undefined) {
  return useQuery({
    queryKey: ["focus-boxes", cameraId],
    queryFn: () => delay(focusBoxes()),
    enabled: !!cameraId,
  });
}

export function useCameraRecent(cameraId: string | undefined) {
  return useQuery({
    queryKey: ["camera-recent", cameraId],
    queryFn: () => delay(CAM_RECENT),
    enabled: !!cameraId,
  });
}
