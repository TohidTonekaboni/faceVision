import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { CAMERAS, cameraById } from "../data/cameras";
import { PEOPLE, personById } from "../data/people";
import { DEFAULT_REPORT_FILTERS, REPORT_DAYS, type ReportFilters } from "../data/reportEngine";
import { useReportData } from "../hooks/useReportData";

const ZOOM = [100, 150, 220, 320, 450];
const PAGE_SIZE = 8;

export function ReportingPage() {
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const dict = t(lang);
  const fa = lang === "fa";
  const fd = (v: string | number) => formatDigits(lang, v);
  const num = (n: number) => fd(n.toLocaleString("en-US"));
  const shortDate = (d: string) => fd(d.slice(5).replace("-", "/"));

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(0);

  const { data } = useReportData(filters, lang);
  const summary = data?.summary ?? { matched: [], totalEvents: 0, distinctPeople: [], camsUsed: [] };
  const timeline = data?.timeline ?? { day: filters.to, lanes: [], empty: true };

  const patchFilters = (patch: Partial<ReportFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const toggleIn = (key: "people" | "cams", id: string) => {
    const list = filters[key];
    patchFilters({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const presetGo = (days: number) => {
    const to = REPORT_DAYS[REPORT_DAYS.length - 1];
    const from = REPORT_DAYS[Math.max(0, REPORT_DAYS.length - days)];
    patchFilters({ from, to });
  };
  const activePreset = (days: number) =>
    filters.to === REPORT_DAYS[REPORT_DAYS.length - 1] && filters.from === REPORT_DAYS[Math.max(0, REPORT_DAYS.length - days)];

  const pageCount = Math.max(1, Math.ceil(summary.matched.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const shown = useMemo(() => summary.matched.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE), [summary.matched, clampedPage]);

  const summaryParts = [
    `${shortDate(filters.from)} → ${shortDate(filters.to)}`,
    filters.people.length ? (fa ? `${fd(filters.people.length)} نفر` : `${filters.people.length} person${filters.people.length > 1 ? "s" : ""}`) : dict.all_people,
    filters.cams.length ? (fa ? `${fd(filters.cams.length)} دوربین` : `${filters.cams.length} camera${filters.cams.length > 1 ? "s" : ""}`) : dict.all_cams,
  ];
  if (!filters.unknown) summaryParts.push(fa ? "بدون ناشناس" : "no unrecognised");

  const chipStyle = (on: boolean, color?: string) => ({
    background: on ? color ?? "#6366F1" : "transparent",
    color: on ? "#04070E" : "var(--fv-dim)",
    border: on ? "1px solid transparent" : "1px solid var(--fv-line)",
    fontWeight: on ? 500 : 400,
  });

  const legend = PEOPLE.filter((p) => filters.people.length === 0 || filters.people.includes(p.id)).filter((p) => filters.unknown || p.id !== "p0");

  return (
    <div className="flex flex-col gap-4 max-w-[1420px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.rep_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.rep_sub}</div>
        </div>
        <button className="px-[13px] py-2 rounded-[9px] text-[12px] text-dim cursor-pointer bg-panel" style={{ border: "1px solid var(--fv-line)" }}>
          {dict.export_csv}
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(176px,1fr))" }}>
        <Panel className="p-[15px]" style={{ padding: "14px 15px" }}>
          <div className="text-[10px] uppercase font-mono text-faint" style={{ letterSpacing: ".12em" }}>
            {fa ? "کل شناسایی‌ها" : "Detections in range"}
          </div>
          <div className="mt-[9px] font-semibold font-mono text-txt text-[22px]" style={{ lineHeight: 1.2 }}>
            {num(summary.totalEvents)}
          </div>
          <div className="mt-[3px] text-[11px] text-dim">{fa ? `${num(summary.matched.length)} ردیف` : `${num(summary.matched.length)} rows`}</div>
        </Panel>
        <Panel className="p-[15px]" style={{ padding: "14px 15px" }}>
          <div className="text-[10px] uppercase font-mono text-faint" style={{ letterSpacing: ".12em" }}>
            {fa ? "افراد متمایز" : "Distinct people"}
          </div>
          <div className="mt-[9px] font-semibold font-mono text-txt text-[22px]" style={{ lineHeight: 1.2 }}>
            {num(summary.distinctPeople.length)}
          </div>
          <div className="mt-[3px] text-[11px] text-dim">
            {summary.distinctPeople.includes("p0") ? (fa ? "شامل ناشناس" : "includes unrecognised") : fa ? "همه شناخته‌شده" : "all recognised"}
          </div>
        </Panel>
        <Panel className="p-[15px]" style={{ padding: "14px 15px" }}>
          <div className="text-[10px] uppercase font-mono text-faint" style={{ letterSpacing: ".12em" }}>
            {fa ? "دوربین‌ها" : "Cameras"}
          </div>
          <div className="mt-[9px] font-semibold font-mono text-txt text-[22px]" style={{ lineHeight: 1.2 }}>
            {num(summary.camsUsed.length)}
          </div>
          <div className="mt-[3px] text-[11px] text-dim">{fa ? "از ۱۲ دوربین" : "of 12 configured"}</div>
        </Panel>
        <Panel className="p-[15px]" style={{ padding: "14px 15px" }}>
          <div className="text-[10px] uppercase font-mono text-faint" style={{ letterSpacing: ".12em" }}>
            {fa ? "بازه گزارش" : "Range shown"}
          </div>
          <div className="mt-[9px] font-semibold font-mono text-txt text-[17px]" style={{ lineHeight: 1.2 }}>
            {shortDate(filters.from)}–{shortDate(filters.to)}
          </div>
          <div className="mt-[3px] text-[11px] text-dim">{fa ? "تقویم جلالی" : "Jalali-aware"}</div>
        </Panel>
      </div>

      <Panel>
        <div onClick={() => setFiltersOpen((v) => !v)} className="px-4 py-[13px] flex items-center gap-3 cursor-pointer flex-wrap">
          <span className="text-[10px] uppercase font-mono text-faint" style={{ letterSpacing: ".12em" }}>
            {dict.filters}
          </span>
          <span className="flex-1 min-w-0 text-[13px] text-txt font-medium">{summaryParts.join(" · ")}</span>
          <span className="text-[11.5px] text-indigo-soft">{filtersOpen ? dict.hide : dict.edit}</span>
        </div>
        {filtersOpen && (
          <div className="px-4 pb-4 border-t border-line">
            <div className="flex flex-col gap-[15px] pt-[15px]">
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(232px,1fr))" }}>
                <div className="flex flex-col gap-[7px]">
                  <span className="text-[11.5px] text-dim">{dict.f_range}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filters.from}
                      min={REPORT_DAYS[0]}
                      max={REPORT_DAYS[REPORT_DAYS.length - 1]}
                      onChange={(e) => patchFilters({ from: e.target.value > filters.to ? filters.to : e.target.value })}
                      className="flex-1 min-w-0 px-[11px] py-[9px] rounded-[9px] text-[12px] font-mono outline-none bg-panel2 text-txt"
                      style={{ border: "1px solid var(--fv-line)", colorScheme: theme }}
                    />
                    <span className="text-faint text-[12px]">→</span>
                    <input
                      type="date"
                      value={filters.to}
                      min={REPORT_DAYS[0]}
                      max={REPORT_DAYS[REPORT_DAYS.length - 1]}
                      onChange={(e) => patchFilters({ to: e.target.value < filters.from ? filters.from : e.target.value })}
                      className="flex-1 min-w-0 px-[11px] py-[9px] rounded-[9px] text-[12px] font-mono outline-none bg-panel2 text-txt"
                      style={{ border: "1px solid var(--fv-line)", colorScheme: theme }}
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      [1, dict.today_p],
                      [7, dict.last7],
                      [30, dict.last30],
                    ].map(([d, label]) => (
                      <button
                        key={label as string}
                        onClick={() => presetGo(d as number)}
                        className="px-[9px] py-1 rounded-md cursor-pointer text-[11px]"
                        style={
                          activePreset(d as number)
                            ? { background: "rgba(99,102,241,.16)", color: "#818CF8", border: "1px solid rgba(99,102,241,.4)" }
                            : { background: "transparent", color: "var(--fv-faint)", border: "1px solid var(--fv-line)" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-[7px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11.5px] text-dim">{dict.f_people}</span>
                    <button
                      onClick={() => patchFilters({ people: [] })}
                      className="px-[7px] py-[2px] rounded-md text-[10.5px] text-faint cursor-pointer"
                      style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
                    >
                      {dict.all_people}
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 px-[9px] py-2 rounded-[9px] flex-wrap bg-panel2" style={{ border: "1px solid var(--fv-line)", minHeight: 38 }}>
                    {PEOPLE.map((p) => {
                      const on = filters.people.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleIn("people", p.id)}
                          className="inline-flex items-center gap-1.5 px-[9px] py-1 rounded-md cursor-pointer text-[11.5px]"
                          style={chipStyle(on, p.color)}
                        >
                          <span className="w-2 h-2 rounded-[2px] flex-none" style={{ background: on ? "rgba(4,7,14,.45)" : p.color }} />
                          {fa ? p.nameFa : p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-[7px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11.5px] text-dim">{dict.f_cams}</span>
                    <button
                      onClick={() => patchFilters({ cams: [] })}
                      className="px-[7px] py-[2px] rounded-md text-[10.5px] text-faint cursor-pointer"
                      style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
                    >
                      {dict.all_cams}
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 px-[9px] py-2 rounded-[9px] flex-wrap bg-panel2" style={{ border: "1px solid var(--fv-line)", minHeight: 38 }}>
                    {CAMERAS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleIn("cams", c.id)}
                        className="px-[9px] py-1 rounded-md cursor-pointer text-[11.5px]"
                        style={chipStyle(filters.cams.includes(c.id))}
                      >
                        {fa ? c.nameFa : c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-[9px] self-start px-3 py-[10px] rounded-[9px] text-[12px] text-txt cursor-pointer bg-panel2" style={{ border: "1px solid var(--fv-line)" }}>
                <input type="checkbox" checked={filters.unknown} onChange={(e) => patchFilters({ unknown: e.target.checked })} style={{ accentColor: "#6366F1" }} />
                {dict.include_unknown}
              </label>
            </div>
            <div className="flex gap-[9px] mt-[15px] items-center flex-wrap">
              <button onClick={() => setFiltersOpen(false)} className="px-3.5 py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer" style={{ background: "#6366F1" }}>
                {dict.apply}
              </button>
              <button
                onClick={() => {
                  setFilters(DEFAULT_REPORT_FILTERS);
                  setPage(1);
                }}
                className="px-3.5 py-2 rounded-[9px] text-dim text-[12px] cursor-pointer"
                style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
              >
                {dict.reset}
              </button>
              <span className="text-[11.5px] text-faint">{fa ? `${num(summary.matched.length)} ردیف مطابق` : `${num(summary.matched.length)} rows match`}</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="px-4 py-[15px] border-b border-line flex items-start justify-between gap-3.5 flex-wrap">
          <div className="max-w-[560px]">
            <div className="text-[14px] font-semibold text-txt">{dict.timeline_title}</div>
            <div className="text-[11.5px] leading-[1.55] text-dim mt-[5px]" style={{ textWrap: "pretty" }}>
              {dict.timeline_caption}
            </div>
          </div>
          <div className="flex flex-col gap-[7px] items-start px-[11px] py-2.5 rounded-[10px]" style={{ background: "rgba(99,102,241,.08)", border: "1px dashed rgba(99,102,241,.4)" }}>
            <span className="text-[9.5px] font-mono uppercase text-indigo-soft" style={{ letterSpacing: ".1em" }}>
              {dict.chart_only}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-dim">{dict.timeline_day}</span>
              <span className="px-2.5 py-[6px] rounded-lg text-[12px] font-mono bg-panel text-txt" style={{ border: "1px solid var(--fv-line)" }}>
                {fd(timeline.day)}
              </span>
            </div>
          </div>
        </div>
        <div className="px-4 pt-3.5 pb-[18px]">
          <div className="flex items-center gap-3 flex-wrap mb-3.5">
            <div className="flex gap-3 flex-wrap flex-1">
              {legend.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 text-[11px] text-dim">
                  <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: p.color }} />
                  {fa ? p.nameFa : p.name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 p-[3px] rounded-lg bg-panel2" style={{ border: "1px solid var(--fv-line)" }}>
              <button
                disabled={zoomIdx === 0}
                onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                className="w-[22px] h-[22px] rounded-md border-none text-dim text-[14px] leading-none cursor-pointer bg-transparent"
              >
                −
              </button>
              <span className="min-w-[42px] text-center text-[11px] font-mono text-dim">{fd(ZOOM[zoomIdx])}%</span>
              <button
                disabled={zoomIdx === ZOOM.length - 1}
                onClick={() => setZoomIdx((z) => Math.min(ZOOM.length - 1, z + 1))}
                className="w-[22px] h-[22px] rounded-md border-none text-dim text-[14px] leading-none cursor-pointer bg-transparent"
              >
                +
              </button>
              {zoomIdx !== 0 && (
                <button onClick={() => setZoomIdx(0)} className="ms-0.5 px-2 py-[3px] rounded-md border-none text-indigo-soft text-[10.5px] cursor-pointer bg-transparent">
                  {dict.reset}
                </button>
              )}
            </div>
          </div>
          {timeline.empty && (
            <div className="py-[26px] px-3 rounded-lg text-center text-[12px] text-dim" style={{ border: "1px dashed var(--fv-line)" }}>
              {dict.no_chart}
            </div>
          )}
          <div style={{ display: timeline.empty ? "none" : "flex", flexDirection: "column", gap: 4, overflowX: "auto" }}>
            <div style={{ minWidth: `${ZOOM[zoomIdx]}%` }}>
              {timeline.lanes.map((ln) => {
                const cam = cameraById(ln.cameraId);
                return (
                  <div key={ln.cameraId} className="grid gap-2.5 items-center" style={{ gridTemplateColumns: "126px minmax(0,1fr)" }}>
                    <span className="text-[11.5px] text-dim overflow-hidden text-ellipsis whitespace-nowrap sticky bg-panel" style={{ insetInlineStart: 0, paddingInlineEnd: 8 }}>
                      {fa ? cam.nameFa : cam.name}
                    </span>
                    <div className="relative h-7 rounded-md bg-panel2 overflow-hidden">
                      {ln.segments.map((sg, i) => (
                        <div
                          key={i}
                          title={sg.title}
                          className="absolute rounded"
                          style={{ top: 5, bottom: 5, insetInlineStart: `${sg.left}%`, width: `${sg.width}%`, background: sg.color, opacity: sg.dimmed ? 0.55 : 1 }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="grid gap-2.5 mt-1.5" style={{ gridTemplateColumns: "126px minmax(0,1fr)" }}>
                <span />
                <div className="flex justify-between text-[10px] font-mono text-faint">
                  {["06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"].map((tk) => (
                    <span key={tk}>{fd(tk)}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ boxShadow: "0 14px 36px -26px rgba(0,0,0,.85)" }}>
        <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[14px] font-semibold text-txt">{dict.results}</span>
            <span className="text-[11.5px] font-mono text-teal">{fa ? `${num(summary.totalEvents)} رویداد` : `${num(summary.totalEvents)} detection events`}</span>
          </div>
          <span className="text-[11px] text-faint">{dict.results_note}</span>
        </div>
        <div
          className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
          style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr .8fr", letterSpacing: ".12em" }}
        >
          <span>{dict.th_person}</span>
          <span>{dict.th_camera}</span>
          <span>{dict.th_first}</span>
          <span>{dict.th_last}</span>
          <span style={{ textAlign: "end" }}>{dict.th_count}</span>
        </div>
        {shown.map((r, i) => {
          const p = personById(r.personId);
          const cam = cameraById(r.cameraId);
          return (
            <div
              key={`${r.date}-${r.personId}-${r.cameraId}-${i}`}
              className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
              style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr 1fr .8fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: p.color }} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: r.personId === "p0" ? "var(--fv-dim)" : "var(--fv-txt)" }}>
                  {fa ? p.nameFa : p.name}
                </span>
              </span>
              <span className="text-dim overflow-hidden text-ellipsis whitespace-nowrap">{fa ? cam.nameFa : cam.name}</span>
              <span className="font-mono text-dim">
                {shortDate(r.date)} {fd(r.first.slice(0, 5))}
              </span>
              <span className="font-mono text-dim">{fd(r.last)}</span>
              <span className="font-mono text-txt" style={{ textAlign: "end" }}>
                {num(r.count)}
              </span>
            </div>
          );
        })}
        {summary.matched.length === 0 && (
          <div className="py-[34px] px-4 flex flex-col items-center gap-2.5 text-center">
            <span className="text-[13px] text-txt font-medium">{dict.no_results}</span>
            <span className="text-[12px] text-dim max-w-[340px]" style={{ textWrap: "pretty" }}>
              {dict.no_results_sub}
            </span>
            <button
              onClick={() => {
                setFilters(DEFAULT_REPORT_FILTERS);
                setPage(1);
              }}
              className="mt-0.5 px-3.5 py-[7px] rounded-[9px] text-indigo-soft text-[12px] cursor-pointer"
              style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
            >
              {dict.reset}
            </button>
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11.5px] text-faint">
            {summary.matched.length
              ? fa
                ? `نمایش ${num((clampedPage - 1) * PAGE_SIZE + 1)}–${num(Math.min(clampedPage * PAGE_SIZE, summary.matched.length))} از ${num(summary.matched.length)}`
                : `Showing ${(clampedPage - 1) * PAGE_SIZE + 1}–${Math.min(clampedPage * PAGE_SIZE, summary.matched.length)} of ${summary.matched.length}`
              : ""}
          </span>
          <div className="flex gap-1.5">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className="min-w-[30px] px-[9px] py-1.5 rounded-lg cursor-pointer text-[11.5px] font-mono"
                style={
                  clampedPage === i + 1
                    ? { background: "#6366F1", color: "#fff", border: "1px solid #6366F1" }
                    : { background: "transparent", color: "var(--fv-dim)", border: "1px solid var(--fv-line)" }
                }
              >
                {fd(i + 1)}
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
