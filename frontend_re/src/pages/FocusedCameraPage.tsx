import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { t } from "../i18n";
import { Panel } from "../components/common/Panel";
import { useCamera } from "../hooks/useCameras";
import { useCameraStreamUrl, useInferenceStreamUrl } from "../hooks/useCameraStream";

export function FocusedCameraPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const role = useAppStore((s) => s.role);
  const setLastCameraId = useAppStore((s) => s.setLastCameraId);
  const dict = t(lang);
  const fa = lang === "fa";
  const isAdmin = role === "super_admin";

  const { data: cam } = useCamera(id);
  const { url: plainUrl, reconnect } = useCameraStreamUrl(id);
  const inferenceUrl = useInferenceStreamUrl(id, isAdmin);
  const streamUrl = inferenceUrl ?? plainUrl;

  useEffect(() => {
    if (id) setLastCameraId(id);
  }, [id, setLastCameraId]);

  if (!cam) return null;

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
            <div className="text-[18px] font-semibold text-txt">{cam.name}</div>
            {cam.zone && <div className="text-[11.5px] font-mono text-faint mt-0.5">{cam.zone}</div>}
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
          {streamUrl ? (
            <img
              src={streamUrl}
              alt={cam.name}
              onError={reconnect}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[12px] text-faint">{dict.loading}</div>
          )}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 flex flex-col gap-1.5 items-start" style={{ insetInlineStart: 12 }}>
              {inferenceUrl && (
                <span className="px-[9px] py-1 rounded-md text-white font-mono" style={{ background: "rgba(99,102,241,.9)", fontSize: 10, letterSpacing: ".08em" }}>
                  {dict.inference_on}
                </span>
              )}
              {cam.zone && (
                <span
                  className="px-[9px] py-1 rounded-md font-mono"
                  style={{ background: "rgba(4,7,14,.72)", border: "1px solid rgba(255,255,255,.14)", color: "#CBD5E1", fontSize: 10 }}
                >
                  {cam.zone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-panel border border-line flex-wrap">
          <span className="text-[11px] font-mono text-faint">{dict.overlay_hint}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <Panel>
          <div className="px-3.5 py-3 border-b border-line text-[12.5px] font-semibold text-txt">{dict.cam_recent}</div>
          <div className="px-3.5 py-4 text-[11.5px] text-faint">{dict.no_data}</div>
        </Panel>
      </div>
    </div>
  );
}
