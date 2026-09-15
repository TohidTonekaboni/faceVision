import { useMemo, useState } from "react";
import { Tooltip } from "@mui/material";
import type { Camera, DetectionEvent } from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

interface CameraTimelineChartProps {
  events: DetectionEvent[];
  cameras: Camera[];
  dateIso: string; // Gregorian YYYY-MM-DD, the day being visualized (UTC day, matches the events query)
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
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LANE_HEIGHT = 16;
const LANE_GAP = 3;

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

  const dayStart = useMemo(() => Date.parse(`${dateIso}T00:00:00Z`), [dateIso]);

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

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const timeAtCursor = new Date(dayStart + fraction * DAY_MS);
    setCrosshair({
      leftPct: fraction * 100,
      label: timeAtCursor.toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" }),
    });
  };

  if (cameraRows.length === 0) {
    return <p className="text-sm text-inkDim px-1 py-6">{t("noTimelineData")}</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {legend.length >= 2 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {legend.map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-inkDim">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      )}

      <div className="flex text-[10px] text-inkDim px-[1px] mb-1" style={{ marginInlineStart: 112 }}>
        {HOURS.map((h) => (
          <div key={h} className="flex-1 text-center">
            {h}
          </div>
        ))}
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
                className="relative flex-1 rounded bg-subtle overflow-hidden cursor-crosshair"
                style={{ height: rowHeight }}
                onMouseMove={handlePointerMove}
                onMouseLeave={() => setCrosshair(null)}
              >
                {/* hourly gridlines — hairline, recessive */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-border"
                    style={{ left: `${(h / 24) * 100}%`, borderInlineStartWidth: 1, borderStyle: "solid", opacity: 0.5 }}
                  />
                ))}

                {rowData?.segments.map(({ event, lane, color, seriesLabel }) => {
                  const startedAt = new Date(event.started_at).getTime();
                  const endedAt = new Date(event.ended_at).getTime();
                  const left = Math.max(((startedAt - dayStart) / DAY_MS) * 100, 0);
                  const width = Math.min(Math.max(((endedAt - startedAt) / DAY_MS) * 100, 0.4), 100 - left);
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

                {crosshair && (
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

      {crosshair && (
        <p className="text-[10px] text-inkDim text-right mt-1" dir="ltr">
          {crosshair.label}
        </p>
      )}
    </div>
  );
}
