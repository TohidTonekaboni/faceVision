import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { useAnnotationBoxes, useAnnotationQueue, useLabels } from "../hooks/useAnnotation";

export function AnnotationPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const [activeQueueIdx, setActiveQueueIdx] = useState(0);
  const [labelId, setLabelId] = useState("l1");

  const { data: queue = [] } = useAnnotationQueue();
  const { data: boxes = [] } = useAnnotationBoxes();
  const { data: labels = [] } = useLabels();
  const activeLabel = labels.find((l) => l.id === labelId) ?? labels[0];

  return (
    <div className="flex flex-col gap-[15px] max-w-[1520px]">
      <div>
        <div className="text-[22px] font-semibold text-txt">{dict.annot_title}</div>
        <div className="text-[12.5px] text-dim mt-1">{dict.annot_sub}</div>
      </div>
      <div className="flex flex-wrap gap-3.5 items-start">
        <Panel style={{ flex: "1 1 212px", minWidth: 212 }}>
          <div className="px-3.5 py-3 border-b border-line flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-txt">{dict.queue}</span>
            <span className="text-[10.5px] font-mono px-1.5 py-[2px] rounded bg-panel2 text-dim">{formatDigits(lang, queue.length)}</span>
          </div>
          <div className="p-2.5 flex flex-col gap-2" style={{ maxHeight: 520, overflow: "auto" }}>
            {queue.map((q, i) => (
              <div
                key={q.slot}
                onClick={() => setActiveQueueIdx(i)}
                className="flex items-center gap-2.5 p-[7px] rounded-[9px] cursor-pointer"
                style={{
                  border: i === activeQueueIdx ? "1px solid rgba(99,102,241,.45)" : "1px solid var(--fv-line)",
                  background: i === activeQueueIdx ? "rgba(99,102,241,.1)" : "transparent",
                }}
              >
                <div className="w-14 h-9 rounded-md overflow-hidden flex-none" style={{ background: "#05080F" }}>
                  <ImageSlot id={q.slot} shape="rounded" radius={6} placeholder="" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? q.camFa : q.cam}</div>
                  <div className="text-[10px] font-mono text-faint mt-0.5">{formatDigits(lang, q.meta)}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel style={{ flex: "6 1 380px", minWidth: 320 }}>
          <div className="px-3.5 py-[11px] border-b border-line flex items-center gap-2.5 flex-wrap">
            <span className="text-[12.5px] font-semibold text-txt">{dict.canvas}</span>
            <span className="text-[11px] text-faint">{dict.canvas_hint}</span>
            <span className="flex-1" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-panel2 text-[11px] text-dim" style={{ border: "1px solid var(--fv-line)" }}>
              <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: activeLabel?.color }} />
              {fa ? activeLabel?.nameFa : activeLabel?.name}
            </span>
          </div>
          <div className="p-3.5" style={{ background: "repeating-linear-gradient(45deg,rgba(148,163,184,.045) 0 8px,transparent 8px 16px)" }}>
            <div className="relative rounded-[10px] overflow-hidden border border-line" style={{ aspectRatio: "16/10", background: "#05080F", cursor: "crosshair" }}>
              <ImageSlot id="fv-annot" shape="rect" placeholder={fa ? "عکس برای برچسب‌گذاری — یک عکس رها کنید" : "snapshot to annotate — drop a screenshot"} />
              <div className="absolute inset-0">
                {boxes.map((b) => (
                  <div
                    key={b.label}
                    className="absolute rounded"
                    style={{ insetInlineStart: b.left, top: b.top, width: b.width, height: b.height, border: `1.5px solid ${b.color}` }}
                  >
                    <div
                      className="absolute px-1.5 py-[2px] rounded font-mono whitespace-nowrap"
                      style={{ top: -20, insetInlineStart: -1.5, background: b.color, color: "#04070E", fontSize: 10 }}
                    >
                      {fa ? b.labelFa : b.label}
                    </div>
                  </div>
                ))}
                <div
                  className="absolute rounded"
                  style={{ insetInlineStart: "34%", top: "68%", width: "12%", height: "22%", border: "1.5px dashed #818CF8", background: "rgba(99,102,241,.12)" }}
                >
                  <span className="absolute font-mono whitespace-nowrap text-indigo-soft" style={{ top: -18, insetInlineStart: 0, fontSize: 10 }}>
                    {dict.drawing}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="px-3.5 py-3 border-t border-line flex items-center gap-2.5 flex-wrap">
            <button className="px-3.5 py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer" style={{ background: "#6366F1" }}>
              {dict.save_annot}
            </button>
            <button className="px-3.5 py-2 rounded-[9px] text-dim text-[12px] cursor-pointer" style={{ border: "1px solid var(--fv-line)", background: "transparent" }}>
              {dict.skip}
            </button>
            <span className="flex-1" />
            <span className="text-[10.5px] font-mono text-faint">{dict.kbd_hint}</span>
          </div>
        </Panel>

        <Panel style={{ flex: "1 1 212px", minWidth: 212 }}>
          <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.labels}</div>
          <div className="px-3 pt-2.5 pb-3.5 flex flex-col gap-[7px]">
            {labels.map((l) => (
              <button
                key={l.id}
                onClick={() => setLabelId(l.id)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[9px] cursor-pointer text-txt"
                style={{ border: labelId === l.id ? "1px solid rgba(99,102,241,.45)" : "1px solid var(--fv-line)", background: labelId === l.id ? "rgba(99,102,241,.1)" : "transparent" }}
              >
                <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: l.color }} />
                <span className="flex-1 text-start text-[12px]">{fa ? l.nameFa : l.name}</span>
                <span className="text-[10px] font-mono text-faint">{l.key}</span>
              </button>
            ))}
            <div className="mt-1.5 p-[11px] rounded-[10px] flex flex-col gap-2" style={{ border: "1px dashed var(--fv-line)" }}>
              <span className="text-[11px] text-dim">{dict.new_label}</span>
              <div className="flex gap-[7px]">
                <span className="flex-1 px-2.5 py-[7px] rounded-lg bg-panel2 text-faint text-[11.5px]" style={{ border: "1px solid var(--fv-line)" }}>
                  {dict.label_ph}
                </span>
                <span className="w-[30px] rounded-lg" style={{ background: "#14B8A6" }} />
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
