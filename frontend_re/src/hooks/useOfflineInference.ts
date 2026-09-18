import { useQuery } from "@tanstack/react-query";
import { delay } from "../data/mockApi";
import { OFFLINE_HISTORY, OFFLINE_ROWS } from "../data/labels";

export function useOfflineResults() {
  return useQuery({ queryKey: ["offline-results"], queryFn: () => delay(OFFLINE_ROWS) });
}

export function useOfflineHistory() {
  return useQuery({ queryKey: ["offline-history"], queryFn: () => delay(OFFLINE_HISTORY) });
}
