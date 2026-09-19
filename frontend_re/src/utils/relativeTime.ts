/** Lightweight "Xs / Xm / Xh / Xd" relative-time formatter — kept ASCII, the
 * app's `formatDigits(lang, value)` helper handles Farsi digit conversion at
 * render time the same way it does for every other formatted value. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${Math.max(1, sec)}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}
