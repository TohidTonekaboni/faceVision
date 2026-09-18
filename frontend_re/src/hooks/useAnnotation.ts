import { useQuery } from "@tanstack/react-query";
import { delay } from "../data/mockApi";
import { ANNOTATION_BOXES, ANNOTATION_QUEUE, LABELS } from "../data/labels";

export function useAnnotationQueue() {
  return useQuery({ queryKey: ["annotation-queue"], queryFn: () => delay(ANNOTATION_QUEUE) });
}

export function useAnnotationBoxes() {
  return useQuery({ queryKey: ["annotation-boxes"], queryFn: () => delay(ANNOTATION_BOXES) });
}

export function useLabels() {
  return useQuery({ queryKey: ["labels"], queryFn: () => delay(LABELS) });
}
