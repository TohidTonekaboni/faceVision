import { useMemo } from "react";
import { useDetectionEvents, usePeople, useCameras, type DetectionEventFilters } from "../api/queries";
import { isUnknownPersonName } from "./useDashboard";
import {
  computeTimeline,
  summarize,
  type ReportFilters,
  type ReportRow,
} from "../data/reportEngine";
import type { Lang } from "../i18n";
import { formatDigits } from "../i18n";

export { defaultReportFilters, type ReportFilters, type ReportRow, type ReportSummary, type Timeline } from "../data/reportEngine";
export { usePeople } from "../api/queries";
export { useCameras } from "./useCameras";

const EVENTS_FETCH_SIZE = 500;

function toFilterParams(f: ReportFilters): DetectionEventFilters {
  return {
    dateFrom: f.from,
    dateTo: f.to,
    personIds: f.people.length ? f.people : undefined,
    cameraIds: f.cams.length ? f.cams : undefined,
    includeUnknown: f.unknown,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
    page: 1,
    pageSize: EVENTS_FETCH_SIZE,
  };
}

function toHHMMSS(iso: string): string {
  return iso.slice(11, 19);
}

/**
 * Fetches every matching event for the selected range (bounded by
 * EVENTS_FETCH_SIZE) rather than paginating server-side, so the existing
 * client-side summary/timeline/table-pagination logic (ported from the
 * mock's `reportEngine.ts`) keeps working unchanged against real data.
 */
export function useReportData(filters: ReportFilters, lang: Lang) {
  const eventsQuery = useDetectionEvents(toFilterParams(filters));
  const peopleQuery = usePeople();
  const camerasQuery = useCameras();

  const rows: ReportRow[] | undefined = eventsQuery.data?.items.map((e) => ({
    id: e.id,
    date: e.started_at.slice(0, 10),
    personId: e.person_id,
    personName: e.person_name,
    isUnknown: isUnknownPersonName(e.person_name),
    cameraId: e.camera_id ?? "",
    cameraName: e.camera_name,
    first: toHHMMSS(e.started_at),
    last: toHHMMSS(e.ended_at),
    count: e.detection_count,
  }));

  const result = useMemo(() => {
    if (!rows) return undefined;
    const summary = summarize(rows);
    const fallbackLanes = (camerasQuery.data ?? []).slice(0, 6).map((c) => ({ id: c.id, name: c.name }));
    const timeline = computeTimeline(summary, filters.to, fallbackLanes, (v) => formatDigits(lang, v));
    return { summary, timeline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters.to, camerasQuery.data, lang]);

  return {
    data: result,
    people: peopleQuery.data ?? [],
    cameras: camerasQuery.data ?? [],
    isLoading: eventsQuery.isLoading || peopleQuery.isLoading || camerasQuery.isLoading,
    isError: eventsQuery.isError || peopleQuery.isError || camerasQuery.isError,
  };
}
