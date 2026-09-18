import { useQuery } from "@tanstack/react-query";
import { CAMERAS, cameraById } from "../data/cameras";
import { delay } from "../data/mockApi";

export function useCameras() {
  return useQuery({
    queryKey: ["cameras"],
    queryFn: () => delay(CAMERAS),
  });
}

export function useCamera(id: string | undefined) {
  return useQuery({
    queryKey: ["camera", id],
    queryFn: () => delay(cameraById(id ?? "c1")),
    enabled: !!id,
  });
}
