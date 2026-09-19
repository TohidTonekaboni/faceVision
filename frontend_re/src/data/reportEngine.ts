import { colorForId } from "../utils/palette";

export interface ReportFilters {
  from: string;
  to: string;
  people: string[];
  cams: string[];
  unknown: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Defaults to the last 7 calendar days ending today, replacing the mock's
 * hardcoded static date range. */
export function defaultReportFilters(): ReportFilters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: isoDate(from), to: isoDate(to), people: [], cams: [], unknown: true };
}

/** One row per detection "session" (a person seen continuously on one camera
 * for a stretch of time) — this is exactly what `DetectionEventOut` already
 * represents, so a row maps 1:1 to one API event rather than a client-side
 * aggregate the way the old mock's ReportRow was. */
export interface ReportRow {
  id: string;
  date: string;
  personId: string;
  personName: string;
  isUnknown: boolean;
  cameraId: string;
  cameraName: string;
  first: string;
  last: string;
  count: number;
}

export function distinctIds<K extends "personId" | "cameraId">(rows: ReportRow[], key: K): string[] {
  const set: string[] = [];
  for (const r of rows) {
    const v = r[key];
    if (!set.includes(v)) set.push(v);
  }
  return set;
}

export interface ReportSummary {
  matched: ReportRow[];
  totalEvents: number;
  distinctPeople: string[];
  camsUsed: string[];
}

/** The backend already applies date/person/camera/unknown filtering via
 * query params, so this just aggregates the (already-matching) rows it's
 * given — no client-side re-filtering. */
export function summarize(rows: ReportRow[]): ReportSummary {
  return {
    matched: rows,
    totalEvents: rows.reduce((a, r) => a + r.count, 0),
    distinctPeople: distinctIds(rows, "personId"),
    camsUsed: distinctIds(rows, "cameraId"),
  };
}

/** Deterministic pseudo-random spread used to lay out timeline segments, ported 1:1 from the source. */
function spread(seed: number, n: number): number[] {
  const out: number[] = [];
  let x = (seed * 37) % 23;
  for (let i = 0; i < n; i++) {
    out.push(4 + ((x + i * 29) % 82));
    x = (x * 13 + 7) % 71;
  }
  return out.sort((a, b) => a - b);
}

export interface TimelineSegment {
  personId: string;
  title: string;
  left: number;
  width: number;
  color: string;
  dimmed: boolean;
}

export interface TimelineLane {
  cameraId: string;
  cameraName: string;
  segments: TimelineSegment[];
}

export interface Timeline {
  day: string;
  lanes: TimelineLane[];
  empty: boolean;
}

/** `fallbackLanes` (id + display name) fill the chart with empty lanes when
 * no rows/camera filter narrow down which cameras to show — mirrors the
 * mock's behaviour of always drawing a handful of lanes. */
export function computeTimeline(
  summary: ReportSummary,
  fallbackDay: string,
  fallbackLanes: { id: string; name: string }[],
  fd: (v: string | number) => string,
): Timeline {
  const { matched, camsUsed } = summary;
  const day = matched.length ? matched.map((r) => r.date).sort().reverse()[0] : fallbackDay;
  const dayRows = matched.filter((r) => r.date === day);

  const camNameById = new Map<string, string>();
  for (const r of dayRows) camNameById.set(r.cameraId, r.cameraName);
  for (const c of fallbackLanes) if (!camNameById.has(c.id)) camNameById.set(c.id, c.name);

  const laneCams = (camsUsed.length ? camsUsed : fallbackLanes.map((c) => c.id)).slice(0, 7);

  const lanes: TimelineLane[] = laneCams.map((cid, li) => {
    const rows = dayRows.filter((r) => r.cameraId === cid);
    const lefts = spread(li + 3, Math.min(5, Math.max(rows.length, 0)));
    return {
      cameraId: cid,
      cameraName: camNameById.get(cid) ?? cid,
      segments: rows.slice(0, 5).map((r, i) => {
        const width = 6 + (r.count % 9);
        return {
          personId: r.personId,
          title: `${r.personName} · ${fd(r.first.slice(0, 5))} – ${fd(r.last.slice(0, 5))}`,
          left: lefts[i] ?? 6,
          width,
          color: colorForId(r.personId, r.isUnknown),
          dimmed: r.isUnknown,
        };
      }),
    };
  });

  return { day, lanes, empty: dayRows.length === 0 };
}
