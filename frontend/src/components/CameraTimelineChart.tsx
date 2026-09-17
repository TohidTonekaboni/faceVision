import { useEffect, useMemo, useState } from "react";
import { Tooltip } from "@mui/material";
import type { Camera, DetectionEvent } from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

interface CameraTimelineChartProps {
  events: DetectionEvent[];
  cameras: Camera[];
  dateIso: string; // Local calendar date (YYYY-MM-DD) being visualized
}

// Validated 8-hue categorical order (see dataviz skill reference palette) —
// slot order is the CVD-safety mechanism, not cosmetic, so keep this order
// rather than re-sorting alphabetically or by frequency.
const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
];
const OTHER_COLOR = "#4a3aa7"; // violet — overflow bucket past the soft cap
const UNKNOWN_COLOR = "#94a3b8"; // muted gray — deliberately not a categorical hue, since "unknown" isn't an identity
const MAX_COLORED_PEOPLE = CATEGORICAL_PALETTE.length;

const DAY_MS = 24 * 60 * 60 * 1000;
const LANE_HEIGHT = 16;
const LANE_GAP = 3;
const MIN_ZOOM_MS = 5 * 60 * 1000; // dragging to a sliver smaller than this is treated as a click, not a zoom
const MIN_DRAG_PX = 6;

// Candidate gridline spacings, in minutes, from finest to coarsest. Whichever
// is the smallest step that still keeps the visible window under ~10 ticks
// is used — so zooming in from a full day down to a 20-minute window
// gradually swaps hour ticks for 5- or 1-minute ticks instead of either
// cluttering the axis or showing just one or two labels.
const NICE_STEP_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];
const TARGET_TICK_COUNT = 8;

interface Segment {
  event: DetectionEvent;
  lane: number;
  color: string;
  seriesLabel: string;
}

function assignLanes(events: DetectionEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const laneEnds: number[] = []; // last occupied end-time per lane
  const laneByEventId = new Map<string, number>();

  for (const event of sorted) {
    const start = new Date(event.started_at).getTime();
    const end = new Date(event.ended_at).getTime();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneByEventId.set(event.id, lane);
  }
  return laneByEventId;
}

export function CameraTimelineChart({ events, cameras, dateIso }: CameraTimelineChartProps) {
  const { t, locale } = useLocale();
  const [crosshair, setCrosshair] = useState<{ leftPct: number; label: string } | null>(null);
  const [drag, setDrag] = useState<{ startFrac: number; endFrac: number } | null>(null);

  // Parsed without a "Z" suffix, so the JS runtime treats it as local
  // midnight — matching the viewer's own wall clock, which is what the hour
  // axis and event positions need to agree on. Using UTC midnight here (as
  // this chart previously did) is what caused events to render under the
  // wrong hour for any viewer not in UTC: a 9:47am local event is a
  // different instant than 9:47am UTC, so positioning by UTC-day-fraction
  // shows it under whatever hour it happens to be in UTC instead.
  const dayStart = useMemo(() => new Date(`${dateIso}T00:00:00`).getTime(), [dateIso]);
  const dayEnd = dayStart + DAY_MS;

  const [viewRange, setViewRange] = useState<[number, number]>([dayStart, dayEnd]);
  // A newly selected day should always open fully zoomed out, not carry over
  // whatever window a previous day was left zoomed into.
  useEffect(() => {
    setViewRange([dayStart, dayEnd]);
  }, [dayStart, dayEnd]);

  const [viewStart, viewEnd] = viewRange;
  const viewDuration = viewEnd - viewStart;
  const isZoomed = viewStart > dayStart || viewEnd < dayEnd;

  // Minutes to ADD to local time to reach UTC (JS Date.getTimezoneOffset()
  // convention). Tick boundaries are computed in this shifted space so that,
  // e.g., "round to the nearest hour" means the nearest local hour rather
  // than the nearest UTC hour — they can differ by any number of minutes,
  // not just whole hours (many real zones sit at a half-hour offset).
  const tzOffsetMs = useMemo(() => new Date().getTimezoneOffset() * 60000, []);
  const toLocalSpace = (ms: number) => ms - tzOffsetMs;
  const toRealSpace = (localMs: number) => localMs + tzOffsetMs;

  const ticks = useMemo(() => {
    const stepMinutes =
      NICE_STEP_MINUTES.find((step) => viewDuration / (step * 60000) <= TARGET_TICK_COUNT) ??
      NICE_STEP_MINUTES[NICE_STEP_MINUTES.length - 1];
    const stepMs = stepMinutes * 60000;
    const firstLocal = Math.ceil(toLocalSpace(viewStart) / stepMs) * stepMs;
    const result: number[] = [];
    for (let localMs = firstLocal; toRealSpace(localMs) <= viewEnd; localMs += stepMs) {
      result.push(toRealSpace(localMs));
    }
    return result;
  }, [viewStart, viewEnd, viewDuration, tzOffsetMs]);

  const formatClock = (ms: number) =>
    new Date(ms).toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" });

  const colorByPersonId = useMemo(() => {
    const totals = new Map<string, { name: string; count: number; isUnknown: boolean }>();
    for (const e of events) {
      const existing = totals.get(e.person_id);
      if (existing) existing.count += e.detection_count;
      else totals.set(e.person_id, { name: e.person_name, count: e.detection_count, isUnknown: e.person_name === "unknown" });
    }
    const realPeople = [...totals.entries()]
      .filter(([, v]) => !v.isUnknown)
      .sort((a, b) => b[1].count - a[1].count);

    const map = new Map<string, { color: string; label: string }>();
    realPeople.forEach(([personId, info], index) => {
      if (index < MAX_COLORED_PEOPLE) {
        map.set(personId, { color: CATEGORICAL_PALETTE[index], label: info.name });
      } else {
        map.set(personId, { color: OTHER_COLOR, label: t("otherPeople") });
      }
    });
    for (const [personId, info] of totals) {
      if (info.isUnknown) map.set(personId, { color: UNKNOWN_COLOR, label: t("unknownPerson") });
    }
    return map;
  }, [events, t]);

  const legend = useMemo(() => {
    const seen = new Map<string, string>(); // label -> color
    for (const info of colorByPersonId.values()) seen.set(info.label, info.color);
    return [...seen.entries()];
  }, [colorByPersonId]);

  const cameraRows = useMemo(() => {
    const cameraNames = new Set(cameras.map((c) => c.name));
    for (const e of events) cameraNames.add(e.camera_name);
    return [...cameraNames].sort((a, b) => a.localeCompare(b));
  }, [cameras, events]);

  const segmentsByCamera = useMemo(() => {
    const byCamera = new Map<string, DetectionEvent[]>();
    for (const e of events) {
      const list = byCamera.get(e.camera_name) ?? [];
      list.push(e);
      byCamera.set(e.camera_name, list);
    }

    const result = new Map<string, { lanes: number; segments: Segment[] }>();
    for (const [cameraName, cameraEvents] of byCamera) {
      const laneByEventId = assignLanes(cameraEvents);
      const lanes = Math.max(...laneByEventId.values(), -1) + 1;
      const segments = cameraEvents.map((event) => {
        const info = colorByPersonId.get(event.person_id);
        return {
          event,
          lane: laneByEventId.get(event.id) ?? 0,
          color: info?.color ?? OTHER_COLOR,
          seriesLabel: info?.label ?? event.person_name,
        };
      });
      result.set(cameraName, { lanes, segments });
    }
    return result;
  }, [events, colorByPersonId]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" });

  const fractionFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const fraction = fractionFromEvent(e);
    setDrag({ startFrac: fraction, endFrac: fraction });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const fraction = fractionFromEvent(e);
    if (drag) {
      setDrag({ startFrac: drag.startFrac, endFrac: fraction });
      return;
    }
    setCrosshair({ leftPct: fraction * 100, label: formatClock(viewStart + fraction * viewDuration) });
  };

  const finishDrag = () => {
    if (!drag) return;
    const rect = { startFrac: Math.min(drag.startFrac, drag.endFrac), endFrac: Math.max(drag.startFrac, drag.endFrac) };
    setDrag(null);
    const pxWidth = (rect.endFrac - rect.startFrac) * (document.getElementById(TRACK_WIDTH_PROBE_ID)?.clientWidth ?? 0);
    if (pxWidth < MIN_DRAG_PX) return; // treat as a click, not a zoom gesture

    const newStart = viewStart + rect.startFrac * viewDuration;
    const newEnd = viewStart + rect.endFrac * viewDuration;
    if (newEnd - newStart < MIN_ZOOM_MS) return;
    setViewRange([newStart, newEnd]);
  };

  const handlePointerUp = () => finishDrag();
  const handlePointerLeave = () => {
    setCrosshair(null);
    finishDrag();
  };

  const resetZoom = () => setViewRange([dayStart, dayEnd]);

  if (cameraRows.length === 0) {
    return <p className="text-sm text-inkDim px-1 py-6">{t("noTimelineData")}</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        {legend.length >= 2 ? (
          <div className="flex flex-wrap gap-3">
            {legend.map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-inkDim">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-inkDim">{t("dragToZoomHint")}</span>
        )}
        {isZoomed && (
          <button onClick={resetZoom} className="text-xs font-medium text-primary hover:underline shrink-0">
            {t("resetZoom")}
          </button>
        )}
      </div>

      <div className="flex text-[10px] text-inkDim px-[1px] mb-1" style={{ marginInlineStart: 112 + 12 }}>
        <div id={TRACK_WIDTH_PROBE_ID} className="relative flex-1 h-3">
          {ticks.map((tickMs) => (
            <span
              key={tickMs}
              className="absolute -translate-x-1/2"
              style={{ left: `${((tickMs - viewStart) / viewDuration) * 100}%` }}
            >
              {formatClock(tickMs)}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {cameraRows.map((cameraName) => {
          const rowData = segmentsByCamera.get(cameraName);
          const lanes = Math.max(rowData?.lanes ?? 1, 1);
          const rowHeight = lanes * LANE_HEIGHT + (lanes - 1) * LANE_GAP;

          return (
            <div key={cameraName} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs font-medium truncate">{cameraName}</div>
              <div
                className="relative flex-1 rounded bg-subtle overflow-hidden cursor-crosshair select-none"
                style={{ height: rowHeight }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerLeave}
              >
                {ticks.map((tickMs) => (
                  <div
                    key={tickMs}
                    className="absolute top-0 bottom-0 border-border"
                    style={{
                      left: `${((tickMs - viewStart) / viewDuration) * 100}%`,
                      borderInlineStartWidth: 1,
                      borderStyle: "solid",
                      opacity: 0.5,
                    }}
                  />
                ))}

                {rowData?.segments.map(({ event, lane, color, seriesLabel }) => {
                  const startedAt = new Date(event.started_at).getTime();
                  const endedAt = new Date(event.ended_at).getTime();
                  const rawLeft = ((startedAt - viewStart) / viewDuration) * 100;
                  const rawRight = ((endedAt - viewStart) / viewDuration) * 100;
                  if (rawRight <= 0 || rawLeft >= 100) return null; // entirely outside the current zoom window
                  const left = Math.max(rawLeft, 0);
                  const width = Math.min(Math.max(rawRight - left, 0.4), 100 - left);
                  return (
                    <Tooltip
                      key={event.id}
                      title={`${seriesLabel} — ${formatTime(event.started_at)}–${formatTime(event.ended_at)} (${event.detection_count})`}
                    >
                      <div
                        className="absolute rounded-sm ring-2 ring-surface hover:opacity-80"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: lane * (LANE_HEIGHT + LANE_GAP),
                          height: LANE_HEIGHT,
                          backgroundColor: color,
                        }}
                      />
                    </Tooltip>
                  );
                })}

                {drag && (
                  <div
                    className="absolute top-0 bottom-0 bg-primary/20 border-x border-primary pointer-events-none"
                    style={{
                      left: `${Math.min(drag.startFrac, drag.endFrac) * 100}%`,
                      width: `${Math.abs(drag.endFrac - drag.startFrac) * 100}%`,
                    }}
                  />
                )}

                {!drag && crosshair && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-ink/30 pointer-events-none"
                    style={{ left: `${crosshair.leftPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!drag && crosshair && (
        <p className="text-[10px] text-inkDim text-right mt-1" dir="ltr">
          {crosshair.label}
        </p>
      )}
    </div>
  );
}

// Any one row's track div works as the shared width reference, since every
// row's track spans the same horizontal region (same fixed-width label
// column + gap precede all of them) — this id is placed on the tick-label
// strip above the rows purely to have a stable, always-mounted element to
// measure pixel width from when deciding if a drag was a real zoom gesture.
const TRACK_WIDTH_PROBE_ID = "camera-timeline-track-width-probe";
