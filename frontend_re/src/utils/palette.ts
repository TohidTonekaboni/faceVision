/** The backend has no per-person "color" field — this deterministically maps
 * an id to a swatch from a fixed palette so the same person always renders
 * with the same color across the reporting timeline/legend, without
 * persisting anything fake server-side. */
const PALETTE = ["#6366F1", "#14B8A6", "#0EA5E9", "#A855F7", "#F43F5E", "#F59E0B", "#22C55E", "#EC4899"];

const UNKNOWN_COLOR = "#64748B";

export function colorForId(id: string, isUnknown = false): string {
  if (isUnknown) return UNKNOWN_COLOR;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
