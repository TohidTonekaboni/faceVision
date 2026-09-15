import { Tooltip } from "@mui/material";
import { usePersonTimeline } from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";
import dayjs from "../i18n/dayjsSetup";

interface PersonTimelineProps {
  personId: string;
  personName: string;
  date: string; // ISO YYYY-MM-DD (Gregorian), matches the API contract
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_MS = 24 * 60 * 60 * 1000;

export function PersonTimeline({ personId, personName, date }: PersonTimelineProps) {
  const { t, locale } = useLocale();
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const { data: events, isLoading } = usePersonTimeline(personId, date, tzOffsetMinutes);

  const dayStart = dayjs(date).startOf("day").subtract(tzOffsetMinutes, "minute").valueOf();

  const cameraNames = Array.from(new Set((events ?? []).map((e) => e.camera_name))).sort();

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold mb-3">{t("timelineFor", { name: personName })}</h3>

      {isLoading && <p className="text-sm text-inkDim">{t("loadingEvents")}</p>}
      {!isLoading && cameraNames.length === 0 && <p className="text-sm text-inkDim">{t("noTimelineData")}</p>}

      {cameraNames.length > 0 && (
        <div className="space-y-3">
          <div className="flex text-[10px] text-inkDim px-[1px]">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center">
                {h}
              </div>
            ))}
          </div>

          {cameraNames.map((cameraName) => (
            <div key={cameraName} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs font-medium truncate">{cameraName}</div>
              <div className="relative flex-1 h-6 rounded bg-subtle overflow-hidden">
                {(events ?? [])
                  .filter((e) => e.camera_name === cameraName)
                  .map((event) => {
                    const startedAt = new Date(event.started_at).getTime();
                    const endedAt = new Date(event.ended_at).getTime();
                    const left = Math.max(((startedAt - dayStart) / DAY_MS) * 100, 0);
                    const width = Math.max(((endedAt - startedAt) / DAY_MS) * 100, 0.5);
                    return (
                      <Tooltip
                        key={event.id}
                        title={`${formatTime(event.started_at)} – ${formatTime(event.ended_at)} (${event.detection_count})`}
                      >
                        <div
                          className="absolute top-0 h-full bg-primary/70 hover:bg-primary rounded-sm"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      </Tooltip>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
