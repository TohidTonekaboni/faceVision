import { useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { useOfflineHistory, useRunOfflineInference } from "../hooks/useOfflineInference";
import { colorForId } from "../utils/palette";

export function OfflineInferencePage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: history = [], refetch: refetchHistory } = useOfflineHistory();
  const runInference = useRunOfflineInference();

  const pickFile = (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    runInference.reset();
  };

  const run = async () => {
    if (!file) return;
    await runInference.mutateAsync(file);
    refetchHistory();
  };

  const result = runInference.data;
  const resultImage = result ? `data:image/jpeg;base64,${result.image}` : previewUrl;

  return (
    <div className="flex flex-col gap-[15px] max-w-[1280px]">
      <div>
        <div className="text-[22px] font-semibold text-txt">{dict.off_title}</div>
        <div className="text-[12.5px] text-dim mt-1">{dict.off_sub}</div>
      </div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
        <Panel className="p-4 flex flex-col gap-3.5" style={{ padding: 16 }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="relative rounded-xl overflow-hidden cursor-pointer"
            style={{ border: "1.5px dashed rgba(99,102,241,.5)", background: "rgba(99,102,241,.05)", aspectRatio: "16/10" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {resultImage ? (
              <img src={resultImage} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center px-4 text-[12px] text-faint">
                {fa ? "برای تحلیل، تصویری رها کنید" : "drop an image to analyse"}
              </div>
            )}
            {result && (
              <div className="absolute inset-0 pointer-events-none">
                {result.detections.map((d, i) => (
                  <div
                    key={i}
                    className="absolute rounded"
                    style={{
                      insetInlineStart: `${d.x * 100}%`,
                      top: `${d.y * 100}%`,
                      width: `${d.width * 100}%`,
                      height: `${d.height * 100}%`,
                      border: `1.5px solid ${colorForId(d.label)}`,
                    }}
                  >
                    <div
                      className="absolute px-1.5 py-[2px] rounded font-mono whitespace-nowrap"
                      style={{ top: -20, insetInlineStart: -1.5, background: colorForId(d.label), color: "#04070E", fontSize: 10 }}
                    >
                      <span className="font-semibold">{d.label}</span>{" "}
                      <span style={{ opacity: 0.75 }}>{formatDigits(lang, `${(d.confidence * 100).toFixed(1)}%`)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={run}
              disabled={!file || runInference.isPending}
              className="px-[15px] py-[9px] rounded-[9px] border-none text-white text-[12.5px] font-medium cursor-pointer"
              style={{ background: "#6366F1", opacity: !file || runInference.isPending ? 0.6 : 1 }}
            >
              {runInference.isPending ? dict.offline_running : dict.run_inference}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-[15px] py-[9px] rounded-[9px] text-dim text-[12.5px] cursor-pointer"
              style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
            >
              {file ? dict.replace_img : dict.offline_drop_cta}
            </button>
            <span className="flex-1" />
            {file && <span className="text-[10.5px] font-mono text-faint">{file.name}</span>}
          </div>
          {runInference.isError && <div className="text-[11.5px] text-rose">{dict.error_generic}</div>}
        </Panel>

        <div className="flex flex-col gap-3.5">
          <Panel>
            <div className="px-3.5 py-3 border-b border-line flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-txt">{dict.off_results}</span>
              <span className="text-[10px] font-mono text-faint">{dict.confidence}</span>
            </div>
            {(result?.detections ?? []).map((d, i) => (
              <div key={i} className="px-3.5 py-[11px] flex items-center gap-2.5 border-b border-line">
                <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: colorForId(d.label) }} />
                <span className="flex-1 min-w-0 text-[12.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{d.label}</span>
                <div className="w-14 h-[3px] rounded bg-panel2 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${d.confidence * 100}%`, background: colorForId(d.label) }} />
                </div>
                <span className="text-[11px] font-mono text-dim" style={{ minWidth: 44, textAlign: "end" }}>
                  {formatDigits(lang, `${(d.confidence * 100).toFixed(1)}%`)}
                </span>
              </div>
            ))}
            {!result && <div className="px-3.5 py-4 text-[11.5px] text-faint">{dict.no_data}</div>}
          </Panel>
          <Panel>
            <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.off_history}</div>
            {history.map((h) => (
              <div key={h.id} className="px-3.5 py-2.5 flex items-center gap-2.5 border-b border-line">
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{h.filename}</div>
                  <div className="text-[10px] font-mono text-faint mt-0.5">
                    {formatDigits(lang, new Date(h.created_at).toLocaleString())}
                  </div>
                </div>
                <span className="text-[10.5px] font-mono text-dim">
                  {formatDigits(lang, h.detection_count)} {dict.faces}
                </span>
              </div>
            ))}
            {history.length === 0 && <div className="px-3.5 py-4 text-[11.5px] text-faint">{dict.history_empty}</div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
