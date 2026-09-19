import { useCameras as useApiCameras } from "../api/queries";
import type { Camera as ApiCamera } from "../api/queries";
import type { Camera } from "../data/types";

function toUiCamera(c: ApiCamera): Camera {
  return {
    id: c.id,
    name: c.name,
    zone: c.zone,
    status: c.is_active ? "online" : "offline",
    secured: c.secured,
  };
}

export function useCameras() {
  const query = useApiCameras();
  return { ...query, data: query.data?.map(toUiCamera) };
}

/** Derives a single camera from the shared cameras list query instead of a
 * separate request — there's no single-camera GET endpoint. */
export function useCamera(id: string | undefined) {
  const query = useApiCameras();
  const cam = id ? query.data?.find((c: ApiCamera) => c.id === id) : undefined;
  return { ...query, data: cam ? toUiCamera(cam) : undefined };
}
