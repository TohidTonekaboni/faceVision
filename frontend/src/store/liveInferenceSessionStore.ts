import { create } from "zustand";
import { startInferenceSession, stopInferenceSession } from "../api/queries";

interface LiveInferenceSessionState {
  isRunning: boolean;
  cameraIds: string[];
  start: (cameraIds: string[]) => void;
  stop: () => void;
}

// Lives in an app-level store (not page state), mirroring
// snapshotSessionStore, so a running inference session keeps annotating and
// publishing detections for every selected camera even after navigating away
// from the cameras page. Unlike the earlier approach of keeping a hidden
// <img> per camera open in the browser, the actual detection loop runs
// entirely on the backend (see /inference-session/start) — a client-side
// connection per background camera would otherwise compete with whichever
// camera the user actually opens to view for the browser's small per-origin
// connection pool, starving it.
export const useLiveInferenceSessionStore = create<LiveInferenceSessionState>((set, get) => ({
  isRunning: false,
  cameraIds: [],
  start: (cameraIds) => {
    if (get().isRunning || cameraIds.length === 0) return;
    set({ isRunning: true, cameraIds });
    startInferenceSession(cameraIds).catch((error) => {
      console.warn("Failed to start background inference session", error);
    });
  },
  stop: () => {
    const { cameraIds } = get();
    set({ isRunning: false, cameraIds: [] });
    stopInferenceSession(cameraIds).catch((error) => {
      console.warn("Failed to stop background inference session", error);
    });
  },
}));
