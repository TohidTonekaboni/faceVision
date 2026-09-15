import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import "dayjs/locale/fa";
import "dayjs/locale/en";
import dayjs from "../i18n/dayjsSetup";
import { useCameras, useDetectionEvents, usePeople, buildEventsExportUrl } from "../api/queries";
import { useAuthStore } from "../store/authStore";
import { useLocale } from "../i18n/LocaleContext";
import { CameraTimelineChart } from "../components/CameraTimelineChart";

const toGregorianIso = (value: dayjs.Dayjs | null) => (value ? value.calendar("gregory").format("YYYY-MM-DD") : "");

export default function Reporting() {
  const { locale, t } = useLocale();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    dayjs.calendar(locale === "fa" ? "jalali" : "gregory");
    dayjs.locale(locale === "fa" ? "fa" : "en");
  }, [locale]);

  const today = useMemo(() => dayjs().calendar("gregory").format("YYYY-MM-DD"), []);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [timelineDate, setTimelineDate] = useState(today);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [includeUnknown, setIncludeUnknown] = useState(false);

  const { data: people } = usePeople();
  const { data: cameras } = useCameras();
  const { data: eventsPage, isLoading } = useDetectionEvents({
    dateFrom,
    dateTo,
    personIds: selectedPersonIds.length ? selectedPersonIds : undefined,
    cameraIds: selectedCameraIds.length ? selectedCameraIds : undefined,
    includeUnknown,
  });
  const { data: timelineEvents } = useDetectionEvents({
    dateFrom: timelineDate,
    dateTo: timelineDate,
    personIds: selectedPersonIds.length ? selectedPersonIds : undefined,
    cameraIds: selectedCameraIds.length ? selectedCameraIds : undefined,
    includeUnknown,
    pageSize: 500,
  });

  const selectablePeople = (people ?? []).filter((p) => includeUnknown || !p.is_unknown);
  const selectedCameras = (cameras ?? []).filter((c) => selectedCameraIds.length === 0 || selectedCameraIds.includes(c.id));

  const handleExport = () => {
    if (!accessToken) return;
    const url = buildEventsExportUrl(
      {
        dateFrom,
        dateTo,
        personIds: selectedPersonIds.length ? selectedPersonIds : undefined,
        cameraIds: selectedCameraIds.length ? selectedCameraIds : undefined,
        includeUnknown,
      },
      accessToken
    );
    window.open(url, "_blank");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale === "fa" ? "fa" : "en"}>
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">{t("reporting")}</h1>
            <p className="text-sm text-inkDim">{t("reportingDescription")}</p>
          </div>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleExport}>
            {t("exportCsv")}
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <DatePicker
            label={t("dateFrom")}
            value={dayjs(dateFrom)}
            onChange={(value) => value && setDateFrom(toGregorianIso(value))}
            slotProps={{ textField: { size: "small" } }}
          />
          <DatePicker
            label={t("dateTo")}
            value={dayjs(dateTo)}
            onChange={(value) => value && setDateTo(toGregorianIso(value))}
            slotProps={{ textField: { size: "small" } }}
          />

          <Autocomplete
            multiple
            size="small"
            sx={{ minWidth: 240 }}
            options={selectablePeople}
            getOptionLabel={(p) => (p.is_unknown ? t("unknownPerson") : p.display_name)}
            value={selectablePeople.filter((p) => selectedPersonIds.includes(p.id))}
            onChange={(_, value) => setSelectedPersonIds(value.map((v) => v.id))}
            renderInput={(params) => (
              <TextField {...params} label={t("filterByPeople")} placeholder={t("selectPeople")} />
            )}
          />

          <Autocomplete
            multiple
            size="small"
            sx={{ minWidth: 240 }}
            options={cameras ?? []}
            getOptionLabel={(c) => c.name}
            value={(cameras ?? []).filter((c) => selectedCameraIds.includes(c.id))}
            onChange={(_, value) => setSelectedCameraIds(value.map((v) => v.id))}
            renderInput={(params) => (
              <TextField {...params} label={t("filterByCamera")} placeholder={t("allCameras")} />
            )}
          />

          <FormControlLabel
            control={<Checkbox checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} />}
            label={t("includeUnknown")}
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold">{t("cameraTimeline")}</h2>
            <DatePicker
              label={t("timelineDate")}
              value={dayjs(timelineDate)}
              onChange={(value) => value && setTimelineDate(toGregorianIso(value))}
              slotProps={{ textField: { size: "small" } }}
            />
          </div>
          <CameraTimelineChart
            events={timelineEvents?.items ?? []}
            cameras={selectedCameras}
            dateIso={timelineDate}
          />
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-inkDim text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">{t("person")}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t("camera")}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t("startedAt")}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t("endedAt")}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t("detectionCount")}</th>
              </tr>
            </thead>
            <tbody>
              {eventsPage?.items.map((event) => (
                <tr key={event.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">
                    {event.person_name === "unknown" ? t("unknownPerson") : event.person_name}
                  </td>
                  <td className="px-4 py-2.5">{event.camera_name}</td>
                  <td className="px-4 py-2.5 text-inkDim">{new Date(event.started_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-inkDim">{new Date(event.ended_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-inkDim">{event.detection_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && eventsPage?.items.length === 0 && (
            <p className="text-sm text-inkDim px-4 py-6">{t("noEventsFound")}</p>
          )}
          {isLoading && <p className="text-sm text-inkDim px-4 py-6">{t("loadingEvents")}</p>}
        </div>
      </div>
    </LocalizationProvider>
  );
}
