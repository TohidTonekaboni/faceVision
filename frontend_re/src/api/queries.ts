import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, apiClient } from "./client";
import type { Role } from "../store/authStore";

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

export interface Camera {
  id: string;
  name: string;
  is_active: boolean;
  zone: string | null;
  secured: boolean;
}

export interface CameraAdmin {
  id: string;
  name: string;
  host: string;
  port: number;
  path: string;
  username: string | null;
  has_password: boolean;
  zone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CameraInput {
  name: string;
  host: string;
  port: number;
  path: string;
  username?: string | null;
  password?: string | null;
  zone?: string | null;
  is_active?: boolean;
}

export function useCameras() {
  return useQuery({
    queryKey: ["cameras"],
    queryFn: async () => (await apiClient.get<Camera[]>("/api/cameras")).data,
  });
}

export function useAdminCameras() {
  return useQuery({
    queryKey: ["cameras", "admin"],
    queryFn: async () => (await apiClient.get<CameraAdmin[]>("/api/camera-admin")).data,
  });
}

export function useCreateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CameraInput) => (await apiClient.post<CameraAdmin>("/api/camera-admin", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  });
}

export function useUpdateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CameraInput> }) =>
      (await apiClient.patch<CameraAdmin>(`/api/camera-admin/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  });
}

export function useDeleteCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/camera-admin/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  });
}

export interface SnapshotBatchResult {
  camera_id: string;
  snapshot: Snapshot | null;
  error: string | null;
}

export async function takeSnapshotBatch(cameraIds: string[]): Promise<SnapshotBatchResult[]> {
  const { data } = await apiClient.post<SnapshotBatchResult[]>("/api/cameras/snapshot-batch", {
    camera_ids: cameraIds,
  });
  return data;
}

export async function startSnapshotSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/snapshot-session/start", { camera_ids: cameraIds });
}

export async function stopSnapshotSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/snapshot-session/stop", { camera_ids: cameraIds });
}

export async function startInferenceSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/inference-session/start", { camera_ids: cameraIds });
}

export async function stopInferenceSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/inference-session/stop", { camera_ids: cameraIds });
}

export function useInferenceSessionStatus(enabled = true) {
  return useQuery({
    queryKey: ["cameras", "inference-session-status"],
    queryFn: async () => (await apiClient.get<string[]>("/api/cameras/inference-session/status")).data,
    enabled,
    refetchInterval: enabled ? 10000 : false,
  });
}

export interface InferenceDetection {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InferenceResult {
  image: string;
  detections: InferenceDetection[];
}

export function useRunInference() {
  return useMutation({
    mutationFn: async (cameraId: string) =>
      (await apiClient.post<InferenceResult>(`/api/cameras/${cameraId}/inference`)).data,
  });
}

export function useTakeSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cameraId: string) => (await apiClient.post<Snapshot>(`/api/cameras/${cameraId}/snapshot`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });
}

/**
 * Mints a short-lived, single-camera stream token instead of embedding the
 * long-lived access token in the <img> src, and re-mints it shortly before
 * expiry so a long-open live view keeps working without a manual refresh.
 */
export function useCameraStreamUrl(cameraId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fetchTokenRef = useRef<() => void>(undefined);
  const lastReconnectAtRef = useRef(0);

  useEffect(() => {
    if (!cameraId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setUrl(null);

    const fetchToken = async () => {
      try {
        const { data } = await apiClient.post<{ token: string; expires_in: number }>(
          `/api/cameras/${cameraId}/stream-token`,
        );
        if (cancelled) return;
        setUrl(`${API_BASE_URL}/api/cameras/${cameraId}/stream?token=${data.token}`);
        const refreshInMs = Math.max(data.expires_in - 30, 15) * 1000;
        timeoutRef.current = setTimeout(fetchToken, refreshInMs);
      } catch {
        if (!cancelled) timeoutRef.current = setTimeout(fetchToken, 15000);
      }
    };
    fetchTokenRef.current = fetchToken;

    fetchToken();
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, [cameraId]);

  const reconnect = () => {
    const now = Date.now();
    if (now - lastReconnectAtRef.current < 3000) return;
    lastReconnectAtRef.current = now;
    clearTimeout(timeoutRef.current);
    fetchTokenRef.current?.();
  };

  return { url, reconnect };
}

/**
 * Same as useCameraStreamUrl but for the admin-only face-detection overlay
 * feed — boxes are baked in server-side, so there's no client-side box data
 * to render on top of it.
 */
export function useInferenceStreamUrl(cameraId: string | undefined, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!enabled || !cameraId) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    const fetchToken = async () => {
      try {
        const { data } = await apiClient.post<{ token: string; expires_in: number }>(
          `/api/cameras/${cameraId}/inference-stream-token`,
        );
        if (cancelled) return;
        setUrl(`${API_BASE_URL}/api/cameras/${cameraId}/inference-stream?token=${data.token}`);
        const refreshInMs = Math.max(data.expires_in - 30, 15) * 1000;
        timeoutRef.current = setTimeout(fetchToken, refreshInMs);
      } catch {
        if (!cancelled) timeoutRef.current = setTimeout(fetchToken, 15000);
      }
    };

    fetchToken();
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
      setUrl(null);
    };
  }, [cameraId, enabled]);

  return url;
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export interface Snapshot {
  id: string;
  camera_id: string | null;
  camera_name: string;
  image_width: number | null;
  image_height: number | null;
  is_annotated: boolean;
  created_at: string;
}

export function useSnapshots(cameraId?: string, isAnnotated?: boolean) {
  return useQuery({
    queryKey: ["snapshots", cameraId, isAnnotated],
    queryFn: async () =>
      (
        await apiClient.get<Snapshot[]>("/api/snapshots", {
          params: { camera_id: cameraId, is_annotated: isAnnotated },
        })
      ).data,
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/snapshots/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["annotations"] });
    },
  });
}

export function useCompleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<Snapshot>(`/api/snapshots/${id}/complete`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });
}

/** Mints a short-lived, single-snapshot image token for the same reason as useCameraStreamUrl. */
export function useSnapshotImageUrl(snapshotId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshotId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    apiClient.post<{ token: string }>(`/api/snapshots/${snapshotId}/image-token`).then(({ data }) => {
      if (!cancelled) setUrl(`${API_BASE_URL}/api/snapshots/${snapshotId}/image?token=${data.token}`);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  return url;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<UserRecord[]>("/api/users")).data,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string; full_name?: string; role: Role }) =>
      (await apiClient.post<UserRecord>("/api/users", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ full_name: string; role: Role; is_active: boolean; password: string }>;
    }) => (await apiClient.patch<UserRecord>(`/api/users/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

// ---------------------------------------------------------------------------
// Labels & annotations
// ---------------------------------------------------------------------------

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Annotation {
  id: string;
  snapshot_id: string;
  label_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: async () => (await apiClient.get<Label[]>("/api/labels")).data,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) =>
      (await apiClient.post<Label>("/api/labels", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labels"] }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/labels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labels"] }),
  });
}

export function useAnnotations(snapshotId?: string) {
  return useQuery({
    queryKey: ["annotations", snapshotId],
    queryFn: async () =>
      (await apiClient.get<Annotation[]>("/api/annotations", { params: { snapshot_id: snapshotId } })).data,
    enabled: !!snapshotId,
  });
}

export function useCreateAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Annotation, "id">) =>
      (await apiClient.post<Annotation>("/api/annotations", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations"] }),
  });
}

export function useDeleteAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/annotations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations"] }),
  });
}

// ---------------------------------------------------------------------------
// Offline / ad-hoc inference
// ---------------------------------------------------------------------------

export function useRunOfflineInference() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (await apiClient.post<InferenceResult>("/api/inference/image", formData)).data;
    },
  });
}

export interface InferenceRun {
  id: string;
  filename: string;
  detection_count: number;
  created_at: string;
}

export function useOfflineHistory(limit = 20) {
  return useQuery({
    queryKey: ["inference", "history", limit],
    queryFn: async () => (await apiClient.get<InferenceRun[]>("/api/inference/history", { params: { limit } })).data,
  });
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  display_name: string;
  is_unknown: boolean;
}

export interface DetectionEvent {
  id: string;
  person_id: string;
  person_name: string;
  camera_id: string | null;
  camera_name: string;
  started_at: string;
  ended_at: string;
  detection_count: number;
  max_confidence: number | null;
}

export interface DetectionEventPage {
  items: DetectionEvent[];
  total: number;
}

export interface DetectionEventFilters {
  dateFrom: string;
  dateTo: string;
  personIds?: string[];
  cameraIds?: string[];
  includeUnknown?: boolean;
  /** JS Date.getTimezoneOffset() convention (minutes to ADD to local time to
   * reach UTC) — lets the backend interpret dateFrom/dateTo as the caller's
   * local calendar day instead of a UTC day. */
  tzOffsetMinutes?: number;
  page?: number;
  pageSize?: number;
}

function toEventQueryParams(filters: DetectionEventFilters) {
  return {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    person_ids: filters.personIds,
    camera_ids: filters.cameraIds,
    include_unknown: filters.includeUnknown,
    tz_offset_minutes: filters.tzOffsetMinutes,
    page: filters.page,
    page_size: filters.pageSize,
  };
}

export function usePeople() {
  return useQuery({
    queryKey: ["reporting", "people"],
    queryFn: async () => (await apiClient.get<Person[]>("/api/reporting/people")).data,
  });
}

export function useDetectionEvents(filters: DetectionEventFilters) {
  return useQuery({
    queryKey: ["reporting", "events", filters],
    queryFn: async () =>
      (
        await apiClient.get<DetectionEventPage>("/api/reporting/events", {
          params: toEventQueryParams(filters),
        })
      ).data,
    placeholderData: (prev) => prev,
  });
}

export function usePersonTimeline(personId: string | null, date: string, tzOffsetMinutes: number) {
  return useQuery({
    queryKey: ["reporting", "timeline", personId, date],
    queryFn: async () =>
      (
        await apiClient.get<DetectionEvent[]>(`/api/reporting/people/${personId}/timeline`, {
          params: { date, tz_offset_minutes: tzOffsetMinutes },
        })
      ).data,
    enabled: !!personId,
  });
}

/** Builds a direct-download URL for the CSV export endpoint. The access
 * token is passed as a query param since a plain anchor download can't
 * attach an Authorization header. */
export function buildEventsExportUrl(filters: DetectionEventFilters, accessToken: string): string {
  const params = new URLSearchParams();
  params.set("date_from", filters.dateFrom);
  params.set("date_to", filters.dateTo);
  (filters.personIds ?? []).forEach((id) => params.append("person_ids", id));
  (filters.cameraIds ?? []).forEach((id) => params.append("camera_ids", id));
  if (filters.includeUnknown) params.set("include_unknown", "true");
  if (filters.tzOffsetMinutes !== undefined) params.set("tz_offset_minutes", String(filters.tzOffsetMinutes));
  params.set("token", accessToken);
  return `${API_BASE_URL}/api/reporting/events/export.csv?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  total_cameras: number;
  active_cameras: number;
  detections_today: number;
  unknown_detections_today: number;
  distinct_people_today: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => (await apiClient.get<DashboardStats>("/api/dashboard/stats")).data,
  });
}

export type SystemHealthKey = "database" | "cameras" | "kafka";
export type SystemHealthStatus = "online" | "degraded" | "offline";

export interface SystemHealthItem {
  key: SystemHealthKey;
  status: SystemHealthStatus;
  detail: string | null;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["dashboard", "system-health"],
    queryFn: async () => (await apiClient.get<SystemHealthItem[]>("/api/dashboard/system-health")).data,
  });
}

export interface TopPerson {
  person_id: string;
  display_name: string;
  is_unknown: boolean;
  detection_count: number;
}

export function useTopPeople(days = 7, limit = 5) {
  return useQuery({
    queryKey: ["dashboard", "top-people", days, limit],
    queryFn: async () =>
      (await apiClient.get<TopPerson[]>("/api/dashboard/top-people", { params: { days, limit } })).data,
  });
}

export function useDashboardNotifications(limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "notifications", limit],
    queryFn: async () =>
      (await apiClient.get<DetectionEvent[]>("/api/dashboard/notifications", { params: { limit } })).data,
    refetchInterval: 15000,
  });
}
