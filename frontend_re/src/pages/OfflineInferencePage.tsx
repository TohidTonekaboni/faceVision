import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { useOfflineHistory, useOfflineResults } from "../hooks/useOfflineInference";

export function OfflineInferencePage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";

  const { data: results = [] } = useOfflineResults();
  const { data: history = [] } = useOfflineHistory();

  return (
    <div className="flex flex-col gap-[15px] max-w-[1280px]">
      <div>
        <div className="text-[22px] font-semibold text-txt">{dict.off_title}</div>
        <div className="text-[12.5px] text-dim mt-1">{dict.off_sub}</div>
      </div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
        <Panel className="p-4 flex flex-col gap-3.5" style={{ padding: 16 }}>
          <div
            className="relative rounded-xl overflow-hidden"
            style={{ border: "1.5px dashed rgba(99,102,241,.5)", background: "rgba(99,102,241,.05)", aspectRatio: "16/10" }}
          >
            <ImageSlot id="fv-offline" shape="rect" placeholder={fa ? "برای تحلیل، تصویری رها کنید" : "drop an image to analyse"} />
            <div className="absolute inset-0 pointer-events-none">
              {results.map((b) => (
                <div key={b.label} className="absolute rounded" style={{ insetInlineStart: b.left, top: b.top, width: "15%", height: "24%", border: `1.5px solid ${b.color}` }}>
                  <div
                    className="absolute px-1.5 py-[2px] rounded font-mono whitespace-nowrap"
                    style={{ top: -20, insetInlineStart: -1.5, background: b.color, color: "#04070E", fontSize: 10 }}
                  >
                    <span className="font-semibold">{fa ? b.labelFa : b.label}</span> <span style={{ opacity: 0.75 }}>{formatDigits(lang, b.confidence)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button className="px-[15px] py-[9px] rounded-[9px] border-none text-white text-[12.5px] font-medium cursor-pointer" style={{ background: "#6366F1" }}>
              {dict.run_inference}
            </button>
            <button className="px-[15px] py-[9px] rounded-[9px] text-dim text-[12.5px] cursor-pointer" style={{ border: "1px solid var(--fv-line)", background: "transparent" }}>
              {dict.replace_img}
            </button>
            <span className="flex-1" />
            <span className="text-[10.5px] font-mono text-faint">entrance_cctv_1412.jpg · 1920×1080 · 284 ms</span>
          </div>
        </Panel>

        <div className="flex flex-col gap-3.5">
          <Panel>
            <div className="px-3.5 py-3 border-b border-line flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-txt">{dict.off_results}</span>
              <span className="text-[10px] font-mono text-faint">{dict.confidence}</span>
            </div>
            {results.map((b) => (
              <div key={b.label} className="px-3.5 py-[11px] flex items-center gap-2.5 border-b border-line">
                <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: b.color }} />
                <span className="flex-1 min-w-0 text-[12.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? b.labelFa : b.label}</span>
                <div className="w-14 h-[3px] rounded bg-panel2 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <span className="text-[11px] font-mono text-dim" style={{ minWidth: 44, textAlign: "end" }}>
                  {formatDigits(lang, b.confidence)}
                </span>
              </div>
            ))}
          </Panel>
          <Panel>
            <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.off_history}</div>
            {history.map((h) => (
              <div key={h.slot} className="px-3.5 py-2.5 flex items-center gap-2.5 border-b border-line">
                <div className="w-[38px] h-[26px] rounded-md overflow-hidden flex-none" style={{ background: "#05080F" }}>
                  <ImageSlot id={h.slot} shape="rounded" radius={6} placeholder="" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{h.file}</div>
                  <div className="text-[10px] font-mono text-faint mt-0.5">{formatDigits(lang, h.meta)}</div>
                </div>
                <span className="text-[10.5px] font-mono text-dim">{formatDigits(lang, h.faces)} {fa ? "چهره" : "faces"}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
