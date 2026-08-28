import { create } from "zustand";
import { startSnapshotSession, stopSnapshotSession, takeSnapshotBatch } from "../api/queries";
import { queryClient } from "../api/queryClient";

const AUTO_SNAPSHOT_INTERVAL_MS = 1_000;

interface SnapshotSessionState {
  isRunning: boolean;
  cameraIds: string[];
  start: (cameraIds: string[]) => void;
  stop: () => void;
}

// A plain module-level timer, not a React ref — this store (and the timer it
// drives) must keep running across route navigation, since taking a snapshot
// session is a background activity the user starts once and expects to
// persist while they use other pages, not something scoped to whichever
// component happened to start it.
let timerId: ReturnType<typeof setTimeout> | undefined;
// Bumped on every start()/stop() so a tick already in flight when the
// session stops (or restarts with a different camera set) doesn't schedule
// another one behind it.
let generation = 0;

async function runTick(cameraIds: string[], myGeneration: number) {
  try {
    const results = await takeSnapshotBatch(cameraIds);
    for (const result of results) {
      if (result.error) {
        console.warn(`Snapshot failed for camera ${result.camera_id}: ${result.error}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["snapshots"] });
  } catch (error) {
    // A single failed tick (network hiccup, all cameras briefly
    // unreachable) shouldn't kill the session — the next tick retries.
    console.warn("Snapshot batch request failed", error);
  }

  if (myGeneration !== generation) return;
  // Only schedule the next tick after this one has actually finished —
  // a plain setInterval would keep firing every second even if a camera
  // takes several seconds to respond, piling up overlapping in-flight
  // requests (and, previously, backend DB sessions) without bound.
  timerId = setTimeout(() => runTick(cameraIds, myGeneration), AUTO_SNAPSHOT_INTERVAL_MS);
}

export const useSnapshotSessionStore = create<SnapshotSessionState>((set, get) => ({
  isRunning: false,
  cameraIds: [],
  start: (cameraIds) => {
    if (get().isRunning || cameraIds.length === 0) return;
    generation += 1;
    clearTimeout(timerId);
    set({ isRunning: true, cameraIds });
    // Fire-and-forget: warming the persistent connections is an optimization,
    // not a precondition — ticks fall back to a one-off capture per camera
    // until each camera's warm stream comes up.
    startSnapshotSession(cameraIds).catch((error) => {
      console.warn("Failed to warm persistent snapshot streams", error);
    });
    runTick(cameraIds, generation);
  },
  stop: () => {
    const { cameraIds } = get();
    generation += 1;
    clearTimeout(timerId);
    timerId = undefined;
    set({ isRunning: false, cameraIds: [] });
    stopSnapshotSession(cameraIds).catch((error) => {
      console.warn("Failed to release persistent snapshot streams", error);
    });
  },
}));
