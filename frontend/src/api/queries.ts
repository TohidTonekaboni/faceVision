import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, apiClient } from "./client";
import { Role } from "../store/authStore";

export interface Camera {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CameraAdmin {
  id: string;
  name: string;
  host: string;
  port: number;
  path: string;
  username: string | null;
  has_password: boolean;
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
  is_active?: boolean;
}

export interface Snapshot {
  id: string;
  camera_id: string | null;
  camera_name: string;
  image_width: number | null;
  image_height: number | null;
  is_annotated: boolean;
  created_at: string;
}

export interface UserRecord {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
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

export interface Annotation {
  id: string;
  snapshot_id: string;
  label_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
    },
  });
}

export function useUpdateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CameraInput> }) =>
      (await apiClient.patch<CameraAdmin>(`/api/camera-admin/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
    },
  });
}

export function useDeleteCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/camera-admin/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
    },
  });
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

export function useTakeSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cameraId: string) =>
      (await apiClient.post<Snapshot>(`/api/cameras/${cameraId}/snapshot`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });
}

export interface SnapshotBatchResult {
  camera_id: string;
  snapshot: Snapshot | null;
  error: string | null;
}

/** Captures every listed camera in a single request; the backend runs the
 * captures concurrently (asyncio.gather) so wall-clock time is bounded by
 * the slowest camera rather than the sum of all of them. */
export async function takeSnapshotBatch(cameraIds: string[]): Promise<SnapshotBatchResult[]> {
  const { data } = await apiClient.post<SnapshotBatchResult[]>("/api/cameras/snapshot-batch", {
    camera_ids: cameraIds,
  });
  return data;
}

/** Opens (or refreshes) a persistent RTSP connection per camera on the
 * backend, so subsequent takeSnapshotBatch ticks read an already-buffered
 * frame instead of paying for a fresh connect+handshake every second — call
 * once when a snapshot session starts, then stopSnapshotSession when it ends. */
export async function startSnapshotSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/snapshot-session/start", { camera_ids: cameraIds });
}

export async function stopSnapshotSession(cameraIds: string[]): Promise<void> {
  await apiClient.post("/api/cameras/snapshot-session/stop", { camera_ids: cameraIds });
}

export function useRunInference() {
  return useMutation({
    mutationFn: async (cameraId: string) =>
      (await apiClient.post<InferenceResult>(`/api/cameras/${cameraId}/inference`)).data,
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/snapshots/${id}`),
    // Deleting a snapshot cascades its annotations server-side too.
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserRecord & { password: string }> }) =>
      (await apiClient.patch<UserRecord>(`/api/users/${id}`, data)).data,
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
    // Drawing a box doesn't mark the snapshot annotated (that's a separate,
    // explicit save step — see useCompleteSnapshot), so only the annotations
    // list needs to refetch here.
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

/**
 * Mints a short-lived, single-camera stream token instead of embedding the
 * long-lived access token in the <img> src, and re-mints it shortly before
 * expiry so a long-open live view keeps working without a manual refresh.
 */
export function useCameraStreamUrl(cameraId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchTokenRef = useRef<() => void>();
  const lastReconnectAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);

    const fetchToken = async () => {
      try {
        const { data } = await apiClient.post<{ token: string; expires_in: number }>(
          `/api/cameras/${cameraId}/stream-token`
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

  // Lets the <img> tag force a fresh token + src when the MJPEG connection
  // itself dies (e.g. the camera dropped mid-stream on the backend), rather
  // than waiting for the next scheduled token refresh. Debounced so a
  // persistently unreachable camera can't fire this in a tight loop.
  const reconnect = () => {
    const now = Date.now();
    if (now - lastReconnectAtRef.current < 3000) return;
    lastReconnectAtRef.current = now;
    clearTimeout(timeoutRef.current);
    fetchTokenRef.current?.();
  };

  return { url, reconnect };
}

/** Mints a short-lived, single-snapshot image token for the same reason as above. */
export function useSnapshotImageUrl(snapshotId: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
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
