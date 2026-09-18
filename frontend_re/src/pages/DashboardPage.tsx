import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { StatusChip, StatusDot } from "../components/common/StatusChip";
import { cameraById } from "../data/cameras";
import {
  useActiveCameraStrip,
  useDashboardStats,
  useDetectionFeed,
  useSystemHealth,
  useTopPeople,
  type FeedTab,
} from "../hooks/useDashboard";

const FEED_TABS: { key: FeedTab; label: (fa: boolean) => string }[] = [
  { key: "all", label: (fa) => (fa ? "همه" : "All") },
  { key: "known", label: (fa) => (fa ? "شناخته‌شده" : "Known") },
  { key: "unknown", label: (fa) => (fa ? "ناشناس" : "Unknown") },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const [feedTab, setFeedTab] = useState<FeedTab>("all");

  const { data: stats = [] } = useDashboardStats();
  const { data: strip = [] } = useActiveCameraStrip();
  const { data: feed = [] } = useDetectionFeed(feedTab);
  const { data: health = [] } = useSystemHealth();
  const { data: topPeople = [] } = useTopPeople();
  const eventsToday = 1284;

  return (
    <div className="flex flex-col gap-[18px] max-w-[1520px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.dash_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.dash_sub}</div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-[7px] px-3 py-[7px] rounded-full text-[11.5px] font-medium text-teal"
            style={{ background: "rgba(20,184,166,.1)", border: "1px solid rgba(20,184,166,.3)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal" style={{ animation: "fvGlow 2s infinite" }} />
            {dict.live_now}
          </span>
          <span className="text-[11px] font-mono text-faint">14:32:08</span>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(186px,1fr))" }}>
        {stats.map((s) => (
          <Panel key={s.label} className="p-4 flex flex-col gap-[9px]" style={{ padding: "15px 16px" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-dim">{fa ? s.labelFa : s.label}</span>
              <span
                className="text-[10.5px] font-mono px-1.5 py-[2px] rounded"
                style={{ background: s.up ? "rgba(20,184,166,.13)" : "rgba(245,158,11,.13)", color: s.up ? "#14B8A6" : "#F59E0B" }}
              >
                {formatDigits(lang, s.delta)}
              </span>
            </div>
            <div className="flex items-baseline gap-[7px]">
              <span className="text-[27px] font-semibold font-mono text-txt" style={{ letterSpacing: "-.02em" }}>
                {formatDigits(lang, s.value)}
              </span>
              <span className="text-[11px] text-faint">{fa ? s.unitFa ?? s.unit : s.unit}</span>
            </div>
            <div className="h-[3px] rounded bg-panel2 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${s.pct}%`, background: s.up ? "#14B8A6" : "#F59E0B" }} />
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="px-4 py-[13px] flex items-center justify-between gap-3 border-b border-line flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[13px] font-semibold text-txt">{dict.camera_strip}</span>
            <span className="text-[11px] text-faint">
              {fa ? "۹ دوربین با استنتاج فعال · ۱ ناپایدار · ۱ قطع" : "9 with inference · 1 degraded · 1 offline"}
            </span>
          </div>
          <button
            onClick={() => navigate("/cameras")}
            className="px-[11px] py-[6px] rounded-lg text-[11.5px] text-dim cursor-pointer"
            style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
          >
            {dict.open_wall}
          </button>
        </div>
        <div className="flex gap-2.5 px-4 py-3.5 overflow-x-auto">
          {strip.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/cameras/${c.id}`)}
              className="flex-none w-[174px] cursor-pointer rounded-[11px] overflow-hidden border border-line"
              style={{ background: "#05080F" }}
            >
              <div className="relative h-[98px]">
                <ImageSlot id={`fv-strip-${c.id}`} shape="rect" placeholder={fa ? "تصویر دوربین" : "camera frame"} />
                <div className="absolute top-[7px] flex gap-[5px] pointer-events-none" style={{ insetInlineStart: 7 }}>
                  <StatusChip status={c.status} />
                  {c.inferenceOn && (
                    <span className="px-1.5 py-[3px] rounded-[5px] text-white font-mono" style={{ background: "rgba(99,102,241,.9)", fontSize: 9, letterSpacing: ".06em" }}>
                      AI
                    </span>
                  )}
                </div>
              </div>
              <div className="px-2.5 py-2 flex flex-col gap-0.5">
                <span className="text-[11.5px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? c.nameFa : c.name}</span>
                <span className="text-[10px] font-mono text-faint">
                  {fa ? c.zoneFa : c.zone} · {c.fps}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr)" }}>
        <Panel>
          <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[13.5px] font-semibold text-txt">{dict.feed_title}</span>
              <span className="text-[11.5px] text-faint">{dict.feed_caption}</span>
            </div>
            <div className="flex p-[2px] rounded-[9px] bg-panel2 border border-line">
              {FEED_TABS.map((ft) => (
                <button
                  key={ft.key}
                  onClick={() => setFeedTab(ft.key)}
                  className="px-3 py-[5px] rounded-[7px] border-none cursor-pointer text-[11.5px]"
                  style={{
                    background: feedTab === ft.key ? "#6366F1" : "transparent",
                    color: feedTab === ft.key ? "#fff" : "var(--fv-dim)",
                    fontWeight: feedTab === ft.key ? 500 : 400,
                  }}
                >
                  {ft.label(fa)}
                </button>
              ))}
            </div>
          </div>
          {feed.map((e, i) => {
            const cam = cameraById(e.cameraId);
            return (
              <div
                key={`${e.cameraId}-${e.seen}`}
                onClick={() => navigate(`/cameras/${e.cameraId}`)}
                className="flex items-center gap-[13px] px-4 py-3 border-b border-line cursor-pointer"
                style={{ background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
              >
                <div className="w-[42px] h-[42px] rounded-[10px] overflow-hidden flex-none border border-line bg-panel2">
                  <ImageSlot id={`fv-feed-${i}`} shape="rounded" radius={10} placeholder="face" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium" style={{ color: e.unknown ? "#F59E0B" : "var(--fv-txt)" }}>
                      {fa ? e.personFa : e.person}
                    </span>
                    {e.unknown && (
                      <span
                        className="px-1.5 py-[2px] rounded-[5px] font-mono"
                        style={{ background: "rgba(245,158,11,.14)", border: "1px solid rgba(245,158,11,.3)", color: "#F59E0B", fontSize: 9.5, letterSpacing: ".06em" }}
                      >
                        {dict.unknown_tag}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-dim flex-wrap">
                    <span>{fa ? cam.nameFa : cam.name}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{fa ? cam.zoneFa : cam.zone}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span className="font-mono">{formatDigits(lang, e.seen)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-none">
                  <span className="text-[11px] font-mono text-dim">{formatDigits(lang, e.confidence)}</span>
                  <div className="w-[62px] h-[3px] rounded bg-panel2 overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${parseFloat(e.confidence)}%`, background: e.unknown ? "#F59E0B" : "#14B8A6" }} />
                  </div>
                </div>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    navigate(`/cameras/${e.cameraId}`);
                  }}
                  className="flex-none px-2.5 py-[6px] rounded-lg text-[11px] text-dim cursor-pointer"
                  style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
                >
                  {dict.view}
                </button>
              </div>
            );
          })}
          <div className="px-4 py-[11px] flex items-center justify-between gap-3 border-t border-line">
            <span className="text-[11px] font-mono text-faint">
              {fa ? `به‌روزرسانی هر ۳ ثانیه · ${formatDigits(lang, eventsToday)} رویداد امروز` : `polling every 3s · ${eventsToday.toLocaleString("en-US")} events today`}
            </span>
            <button
              onClick={() => navigate("/reporting")}
              className="px-[11px] py-[6px] rounded-lg border-none text-indigo-soft text-[11.5px] cursor-pointer bg-panel2"
            >
              {dict.open_report}
            </button>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <div className="px-[15px] py-[13px] border-b border-line text-[13px] font-semibold text-txt">{dict.sys_status}</div>
            <div className="px-[15px] pt-1.5 pb-3">
              {health.map((h) => (
                <div key={h.label} className="flex items-center gap-2.5 py-[9px] border-b border-line">
                  <StatusDot status={h.status} />
                  <span className="flex-1 text-[12px] text-dim">{fa ? h.labelFa : h.label}</span>
                  <span className="text-[11.5px] font-mono text-txt">{formatDigits(lang, fa ? h.valueFa ?? h.value : h.value)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div
            className="rounded-[14px] overflow-hidden"
            style={{ border: "1px solid rgba(99,102,241,.3)", background: "linear-gradient(160deg,rgba(99,102,241,.14),rgba(20,184,166,.07))" }}
          >
            <div className="p-[15px]">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-[7px] h-[7px] rounded-full bg-teal" style={{ animation: "fvPulse 1.6s infinite" }} />
                <span className="text-[12.5px] font-semibold text-txt">{dict.inference_card}</span>
              </div>
              <div className="text-[11.5px] leading-[1.6] text-dim mb-3">{dict.inference_card_sub}</div>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-[9px] rounded-[9px] text-rose text-[12px] font-medium cursor-pointer"
                  style={{ border: "1px solid rgba(244,63,94,.35)", background: "rgba(244,63,94,.1)" }}
                >
                  {dict.stop_all}
                </button>
                <button
                  onClick={() => navigate("/cameras")}
                  className="flex-1 py-[9px] rounded-[9px] text-dim text-[12px] cursor-pointer"
                  style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
                >
                  {dict.manage}
                </button>
              </div>
            </div>
          </div>

          <Panel>
            <div className="px-[15px] py-[13px] border-b border-line flex items-center justify-between gap-2.5">
              <span className="text-[13px] font-semibold text-txt">{dict.top_people}</span>
              <span className="text-[10px] font-mono text-faint">{dict.today}</span>
            </div>
            <div className="px-[15px] pt-3 pb-[15px] flex flex-col gap-3">
              {topPeople.map((p) => (
                <div key={p.slot} className="flex items-center gap-2.5">
                  <div className="w-[26px] h-[26px] rounded-full overflow-hidden flex-none border border-line">
                    <ImageSlot id={p.slot} shape="circle" placeholder="face" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? p.nameFa : p.name}</div>
                    <div className="h-[3px] mt-[5px] rounded bg-panel2 overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${p.pct}%`, background: "#6366F1" }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-dim">{formatDigits(lang, p.count)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
