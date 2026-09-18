import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { useCamera } from "../hooks/useCameras";
import { useCameraRecent, useFocusBoxes } from "../hooks/useDashboard";

export function FocusedCameraPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const setLastCameraId = useAppStore((s) => s.setLastCameraId);
  const dict = t(lang);
  const fa = lang === "fa";
  const [filled, setFilled] = useState(false);

  const { data: cam } = useCamera(id);
  const { data: boxes = [] } = useFocusBoxes(id);
  const { data: recent = [] } = useCameraRecent(id);

  useEffect(() => {
    if (id) setLastCameraId(id);
  }, [id, setLastCameraId]);

  if (!cam) return null;

  const actions = [
    fa ? "تمام‌صفحه" : "Fullscreen",
    fa ? "عکس‌برداری" : "Snapshot",
    fa ? "توقف استنتاج" : "Stop inference",
    fa ? "افزودن به دیوار" : "Add to wall",
    fa ? "تنظیمات" : "Settings",
  ];

  return (
    <div className="grid gap-4 max-w-[1600px] items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 296px" }}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/cameras")}
            className="px-[11px] py-[7px] rounded-[9px] text-[12px] text-dim cursor-pointer bg-panel"
            style={{ border: "1px solid var(--fv-line)" }}
          >
            {fa ? "→" : "←"} {dict.back_cams}
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-semibold text-txt">{fa ? cam.nameFa : cam.name}</div>
            <div className="text-[11.5px] font-mono text-faint mt-0.5">
              rtsp://{cam.host}:554{cam.path}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-full text-[11px] font-semibold font-mono text-rose"
            style={{ background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.32)", letterSpacing: ".08em" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose" style={{ animation: "fvPulse 1.4s infinite" }} />
            {dict.live}
          </span>
        </div>

        <div className="relative rounded-[14px] overflow-hidden border border-line" style={{ background: "#04070E", aspectRatio: "16/9" }}>
          <ImageSlot
            id="fv-focus"
            shape="rect"
            placeholder={fa ? "قاب جریان دوربین — یک عکس رها کنید" : "camera stream frame — drop a screenshot"}
            onFilledChange={setFilled}
          />
          <div className="absolute inset-0 pointer-events-none">
            {filled &&
              boxes.map((b) => (
                <div
                  key={b.label}
                  className="absolute rounded"
                  style={{ insetInlineStart: b.left, top: b.top, width: b.width, height: b.height, border: `1.5px solid ${b.color}`, boxShadow: "0 0 0 1px rgba(4,7,14,.5)" }}
                >
                  <div
                    className="absolute px-1.5 py-[2px] rounded font-mono whitespace-nowrap"
                    style={{ top: -20, insetInlineStart: -1.5, background: b.color, color: "#04070E", fontSize: 10 }}
                  >
                    <span className="font-semibold">{fa ? b.labelFa : b.label}</span>{" "}
                    <span style={{ opacity: 0.75 }}>{formatDigits(lang, b.confidence)}</span>
                  </div>
                </div>
              ))}
            <div className="absolute top-3 flex flex-col gap-1.5 items-start" style={{ insetInlineStart: 12 }}>
              <span className="px-[9px] py-1 rounded-md text-white font-mono" style={{ background: "rgba(99,102,241,.9)", fontSize: 10, letterSpacing: ".08em" }}>
                {dict.inference_on}
              </span>
              <span
                className="px-[9px] py-1 rounded-md font-mono"
                style={{ background: "rgba(4,7,14,.72)", border: "1px solid rgba(255,255,255,.14)", color: "#CBD5E1", fontSize: 10 }}
              >
                {fa ? cam.zoneFa : cam.zone} · {cam.fps} · 1920×1080
              </span>
            </div>
            <span
              className="absolute bottom-3 px-[9px] py-1 rounded-md font-mono"
              style={{ insetInlineEnd: 12, background: "rgba(4,7,14,.72)", border: "1px solid rgba(255,255,255,.14)", color: "#CBD5E1", fontSize: 10 }}
            >
              14:32:08
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-panel border border-line flex-wrap">
          {actions.map((label) => (
            <button key={label} className="px-3 py-[7px] rounded-[9px] text-[11.5px] text-dim cursor-pointer bg-panel2" style={{ border: "1px solid var(--fv-line)" }}>
              {label}
            </button>
          ))}
          <span className="flex-1" />
          <span className="text-[11px] font-mono text-faint">{dict.overlay_hint}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <Panel>
          <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.in_frame}</div>
          <div className="px-3.5 pt-1.5 pb-3">
            {(filled ? boxes : []).map((b) => (
              <div key={b.label} className="flex items-center gap-2.5 py-[9px] border-b border-line">
                <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: b.color }} />
                <span className="flex-1 text-[12px] text-txt">{fa ? b.labelFa : b.label}</span>
                <span className="text-[11px] font-mono text-dim">{formatDigits(lang, b.confidence)}</span>
              </div>
            ))}
            {!filled && <div className="py-2 text-[11.5px] text-faint">{dict.overlay_hint}</div>}
          </div>
        </Panel>
        <Panel>
          <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.cam_recent}</div>
          {recent.map((e) => (
            <div key={e.slot} className="px-3.5 py-2.5 flex items-center gap-2.5 border-b border-line">
              <div className="w-[26px] h-[26px] rounded-[7px] overflow-hidden flex-none border border-line">
                <ImageSlot id={e.slot} shape="rounded" radius={7} placeholder="face" />
              </div>
              <span className="flex-1 min-w-0 text-[12px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? e.personFa : e.person}</span>
              <span className="text-[10.5px] font-mono text-faint">{formatDigits(lang, e.seen)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
