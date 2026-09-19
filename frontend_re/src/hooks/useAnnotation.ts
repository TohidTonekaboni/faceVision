import { useSnapshots, type Snapshot } from "../api/queries";

export {
  useLabels,
  useCreateLabel,
  useDeleteLabel,
  useAnnotations as useAnnotationBoxes,
  useCreateAnnotation,
  useDeleteAnnotation,
  useSnapshotImageUrl,
  useCompleteSnapshot,
} from "../api/queries";
export type { Label, Annotation } from "../api/queries";

/** The annotation queue is simply the set of not-yet-annotated snapshots. */
export function useAnnotationQueue() {
  return useSnapshots(undefined, false);
}

export type { Snapshot };
