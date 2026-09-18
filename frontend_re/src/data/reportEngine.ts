import { CAMERAS, cameraById } from "./cameras";
import { PEOPLE, personById } from "./people";
import { REPORT_DATA, REPORT_DAYS } from "./detections";
import type { ReportRow } from "./types";

export interface ReportFilters {
  from: string;
  to: string;
  people: string[];
  cams: string[];
  unknown: boolean;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  from: REPORT_DAYS[0],
  to: REPORT_DAYS[REPORT_DAYS.length - 1],
  people: [],
  cams: [],
  unknown: true,
};

function inRange(date: string, f: ReportFilters) {
  return date >= f.from && date <= f.to;
}

export function filterReportRows(f: ReportFilters): ReportRow[] {
  return REPORT_DATA.filter(
    (r) =>
      inRange(r.date, f) &&
      (f.people.length === 0 || f.people.includes(r.personId)) &&
      (f.cams.length === 0 || f.cams.includes(r.cameraId)) &&
      (f.unknown || r.personId !== "p0"),
  );
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

export function summarize(f: ReportFilters): ReportSummary {
  const matched = filterReportRows(f);
  return {
    matched,
    totalEvents: matched.reduce((a, r) => a + r.count, 0),
    distinctPeople: distinctIds(matched, "personId"),
    camsUsed: distinctIds(matched, "cameraId"),
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
  segments: TimelineSegment[];
}

export interface Timeline {
  day: string;
  lanes: TimelineLane[];
  empty: boolean;
}

export function computeTimeline(summary: ReportSummary, f: ReportFilters, fd: (v: string | number) => string): Timeline {
  const { matched, camsUsed } = summary;
  const day = matched.length ? matched.map((r) => r.date).sort().reverse()[0] : f.to;
  const dayRows = matched.filter((r) => r.date === day);
  const laneCams = (camsUsed.length ? camsUsed : f.cams.length ? f.cams : CAMERAS.slice(0, 6).map((c) => c.id)).slice(0, 7);

  const lanes: TimelineLane[] = laneCams.map((cid, li) => {
    const rows = dayRows.filter((r) => r.cameraId === cid);
    const lefts = spread(li + 3, Math.min(5, Math.max(rows.length, 0)));
    return {
      cameraId: cid,
      segments: rows.slice(0, 5).map((r, i) => {
        const p = personById(r.personId);
        const width = 6 + (r.count % 9);
        return {
          personId: r.personId,
          title: `${p.name} · ${fd(r.first.slice(0, 5))} – ${fd(r.last.slice(0, 5))}`,
          left: lefts[i] ?? 6,
          width,
          color: p.color,
          dimmed: r.personId === "p0",
        };
      }),
    };
  });

  return { day, lanes, empty: dayRows.length === 0 };
}

export { CAMERAS, PEOPLE, cameraById, personById, REPORT_DAYS };
