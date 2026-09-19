import { useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import {
  useAnnotationBoxes,
  useAnnotationQueue,
  useLabels,
  useCreateAnnotation,
  useDeleteAnnotation,
  useCreateLabel,
  useSnapshotImageUrl,
  useCompleteSnapshot,
} from "../hooks/useAnnotation";
import type { Annotation } from "../api/queries";

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function AnnotationPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const [activeQueueIdx, setActiveQueueIdx] = useState(0);
  const [labelId, setLabelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DrawRect | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const { data: queue = [] } = useAnnotationQueue();
  const activeSnapshot = queue[activeQueueIdx];
  const { data: boxes = [] } = useAnnotationBoxes(activeSnapshot?.id);
  const { data: labels = [] } = useLabels();
  const imageUrl = useSnapshotImageUrl(activeSnapshot?.id);
  const createAnnotation = useCreateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const createLabel = useCreateLabel();
  const completeSnapshot = useCompleteSnapshot();

  const activeLabel = labels.find((l) => l.id === labelId) ?? labels[0];

  const labelById = (id: string) => labels.find((l) => l.id === id);

  const boxStyle = (b: { x: number; y: number; width: number; height: number }) => ({
    insetInlineStart: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.width * 100}%`,
    height: `${b.height * 100}%`,
  });

  const relativePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!activeSnapshot) return;
    const p = relativePos(e);
    dragStart.current = p;
    setDraft({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const p = relativePos(e);
    const start = dragStart.current;
    setDraft({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
  };

  const onMouseUp = async () => {
    dragStart.current = null;
    if (!draft || !activeSnapshot || !activeLabel) {
      setDraft(null);
      return;
    }
    if (draft.width > 0.01 && draft.height > 0.01) {
      await createAnnotation.mutateAsync({
        snapshot_id: activeSnapshot.id,
        label_id: activeLabel.id,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
      });
    }
    setDraft(null);
  };

  const saveAndNext = async () => {
    if (activeSnapshot) await completeSnapshot.mutateAsync(activeSnapshot.id);
    setActiveQueueIdx((i) => Math.min(i + 1, Math.max(0, queue.length - 1)));
  };

  const addLabel = async () => {
    if (!newLabelName.trim()) return;
    await createLabel.mutateAsync({ name: newLabelName.trim(), color: "#14B8A6" });
    setNewLabelName("");
  };

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
                key={q.id}
                onClick={() => setActiveQueueIdx(i)}
                className="flex items-center gap-2.5 p-[7px] rounded-[9px] cursor-pointer"
                style={{
                  border: i === activeQueueIdx ? "1px solid rgba(99,102,241,.45)" : "1px solid var(--fv-line)",
                  background: i === activeQueueIdx ? "rgba(99,102,241,.1)" : "transparent",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{q.camera_name}</div>
                  <div className="text-[10px] font-mono text-faint mt-0.5">
                    {formatDigits(lang, new Date(q.created_at).toLocaleString())}
                  </div>
                </div>
              </div>
            ))}
            {queue.length === 0 && <div className="p-2 text-[11.5px] text-faint">{dict.no_data}</div>}
          </div>
        </Panel>

        <Panel style={{ flex: "6 1 380px", minWidth: 320 }}>
          <div className="px-3.5 py-[11px] border-b border-line flex items-center gap-2.5 flex-wrap">
            <span className="text-[12.5px] font-semibold text-txt">{dict.canvas}</span>
            <span className="text-[11px] text-faint">{dict.canvas_hint}</span>
            <span className="flex-1" />
            {activeLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-panel2 text-[11px] text-dim" style={{ border: "1px solid var(--fv-line)" }}>
                <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: activeLabel.color }} />
                {activeLabel.name}
              </span>
            )}
          </div>
          <div className="p-3.5" style={{ background: "repeating-linear-gradient(45deg,rgba(148,163,184,.045) 0 8px,transparent 8px 16px)" }}>
            <div
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => {
                dragStart.current = null;
                setDraft(null);
              }}
              className="relative rounded-[10px] overflow-hidden border border-line"
              style={{ aspectRatio: "16/10", background: "#05080F", cursor: "crosshair" }}
            >
              {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
              <div className="absolute inset-0">
                {boxes.map((b: Annotation) => {
                  const label = labelById(b.label_id);
                  return (
                    <div
                      key={b.id}
                      className="absolute rounded group"
                      style={{ ...boxStyle(b), border: `1.5px solid ${label?.color ?? "#6366F1"}` }}
                    >
                      <div
                        className="absolute px-1.5 py-[2px] rounded font-mono whitespace-nowrap flex items-center gap-1.5"
                        style={{ top: -20, insetInlineStart: -1.5, background: label?.color ?? "#6366F1", color: "#04070E", fontSize: 10 }}
                      >
                        {label?.name ?? "?"}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotation.mutate(b.id);
                          }}
                          className="cursor-pointer border-none bg-transparent"
                          style={{ color: "#04070E", fontWeight: 700 }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {draft && (
                  <div
                    className="absolute rounded"
                    style={{ ...boxStyle(draft), border: "1.5px dashed #818CF8", background: "rgba(99,102,241,.12)" }}
                  >
                    <span className="absolute font-mono whitespace-nowrap text-indigo-soft" style={{ top: -18, insetInlineStart: 0, fontSize: 10 }}>
                      {dict.drawing}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-3.5 py-3 border-t border-line flex items-center gap-2.5 flex-wrap">
            <button
              onClick={saveAndNext}
              disabled={!activeSnapshot}
              className="px-3.5 py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer"
              style={{ background: "#6366F1" }}
            >
              {dict.save_annot}
            </button>
            <button
              onClick={() => setActiveQueueIdx((i) => Math.min(i + 1, Math.max(0, queue.length - 1)))}
              className="px-3.5 py-2 rounded-[9px] text-dim text-[12px] cursor-pointer"
              style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
            >
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
                <span className="flex-1 text-start text-[12px]">{l.name}</span>
              </button>
            ))}
            <div className="mt-1.5 p-[11px] rounded-[10px] flex flex-col gap-2" style={{ border: "1px dashed var(--fv-line)" }}>
              <span className="text-[11px] text-dim">{dict.new_label}</span>
              <div className="flex gap-[7px]">
                <input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder={dict.label_ph}
                  className="flex-1 px-2.5 py-[7px] rounded-lg bg-panel2 text-txt text-[11.5px] outline-none"
                  style={{ border: "1px solid var(--fv-line)" }}
                />
                <button onClick={addLabel} className="px-2.5 rounded-lg border-none cursor-pointer text-white text-[11px]" style={{ background: "#14B8A6" }}>
                  +
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
