import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { t } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { StatusChip, StatusDot } from "../components/common/StatusChip";
import { useCameras } from "../hooks/useCameras";

type View = "grid" | "wall" | "list";

export function CamerasPage() {
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const [view, setView] = useState<View>("grid");
  const { data: cams = [] } = useCameras();

  const views: { key: View; label: string }[] = [
    { key: "grid", label: dict.v_grid },
    { key: "wall", label: dict.v_wall },
    { key: "list", label: dict.v_list },
  ];

  const onlineWithInf = cams.filter((c) => c.inferenceOn).length;
  const degraded = cams.filter((c) => c.status === "degraded").length;
  const offline = cams.filter((c) => c.status === "offline").length;

  return (
    <div className="flex flex-col gap-4 max-w-[1520px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.cams_title}</div>
          <div className="text-[12.5px] text-dim mt-1">
            {fa
              ? `${onlineWithInf} دوربین با استنتاج فعال · ${degraded} ناپایدار · ${offline} قطع`
              : `${onlineWithInf} with inference · ${degraded} degraded · ${offline} offline`}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex p-[2px] rounded-[9px] bg-panel2 border border-line">
            {views.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className="px-[13px] py-[6px] rounded-[7px] border-none cursor-pointer text-[11.5px]"
                style={{ background: view === v.key ? "#6366F1" : "transparent", color: view === v.key ? "#fff" : "var(--fv-dim)", fontWeight: view === v.key ? 500 : 400 }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button className="px-[13px] py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer" style={{ background: "#6366F1", boxShadow: "0 6px 16px -8px rgba(99,102,241,.8)" }}>
            {dict.start_inference}
          </button>
        </div>
      </div>

      {view === "grid" && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(272px,1fr))" }}>
          {cams.map((c) => (
            <Panel key={c.id}>
              <div className="relative" style={{ aspectRatio: "16/9", background: "#05080F" }}>
                <ImageSlot id={`fv-cam-${c.id}`} shape="rect" placeholder={fa ? "تصویر دوربین" : "camera frame"} />
                <div className="absolute top-[9px] flex gap-1.5 pointer-events-none" style={{ insetInlineStart: 9 }}>
                  <StatusChip status={c.status} />
                  {c.inferenceOn && (
                    <span className="px-[7px] py-[3px] rounded-md text-white font-mono" style={{ background: "rgba(99,102,241,.9)", fontSize: 9.5, letterSpacing: ".06em" }}>
                      {dict.ai_on}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-[9px] flex gap-1.5" style={{ insetInlineEnd: 9 }}>
                  <button
                    onClick={() => navigate(`/cameras/${c.id}`)}
                    className="px-[9px] py-[5px] rounded-[7px] text-[10.5px] cursor-pointer"
                    style={{ border: "1px solid rgba(255,255,255,.2)", background: "rgba(7,11,22,.74)", backdropFilter: "blur(6px)", color: "#E6EDF7" }}
                  >
                    {dict.open}
                  </button>
                  <button
                    className="px-[9px] py-[5px] rounded-[7px] text-[10.5px] cursor-pointer"
                    style={{ border: "1px solid rgba(255,255,255,.2)", background: "rgba(7,11,22,.74)", backdropFilter: "blur(6px)", color: "#E6EDF7" }}
                  >
                    {dict.snapshot}
                  </button>
                </div>
              </div>
              <div className="px-[13px] py-[11px] flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? c.nameFa : c.name}</div>
                  <div className="text-[10.5px] font-mono text-faint mt-[3px]">
                    {c.host} · {c.fps}
                  </div>
                </div>
                <span className="text-[10.5px] px-2 py-[3px] rounded-md bg-panel2 text-dim">{fa ? c.zoneFa : c.zone}</span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {view === "wall" && (
        <div className="grid gap-1 p-1 rounded-[14px]" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", background: "#05080F", border: "1px solid var(--fv-line)" }}>
          {cams.map((c) => (
            <div key={c.id} onClick={() => navigate(`/cameras/${c.id}`)} className="relative cursor-pointer overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <ImageSlot id={`fv-wall-${c.id}`} shape="rect" placeholder={fa ? "تصویر دوربین" : "camera frame"} />
              <div
                className="absolute bottom-0 px-2.5 py-2 flex items-center gap-[7px] pointer-events-none"
                style={{ insetInline: 0, background: "linear-gradient(to top,rgba(5,8,15,.92),transparent)" }}
              >
                <StatusDot status={c.status} />
                <span className="flex-1 text-[11px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "#E6EDF7" }}>
                  {fa ? c.nameFa : c.name}
                </span>
                <span className="text-[9.5px] font-mono" style={{ color: "rgba(230,237,247,.65)" }}>
                  {c.fps}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <Panel>
          <div
            className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
            style={{ gridTemplateColumns: "2fr .9fr .9fr 1.3fr .7fr", letterSpacing: ".12em" }}
          >
            <span>{dict.th_camera}</span>
            <span>{dict.th_status}</span>
            <span>{dict.th_zone}</span>
            <span>{dict.th_stream}</span>
            <span style={{ textAlign: "end" }}>{dict.open}</span>
          </div>
          {cams.map((c, i) => (
            <div
              key={c.id}
              className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
              style={{ gridTemplateColumns: "2fr .9fr .9fr 1.3fr .7fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-[22px] rounded-[5px] overflow-hidden flex-none" style={{ background: "#05080F" }}>
                  <ImageSlot id={`fv-list-${c.id}`} shape="rounded" radius={5} placeholder="" />
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-txt">{fa ? c.nameFa : c.name}</span>
              </span>
              <span>
                <StatusChip status={c.status} />
              </span>
              <span className="text-dim">{fa ? c.zoneFa : c.zone}</span>
              <span className="font-mono text-dim text-[11.5px]">
                rtsp://{c.host}:554{c.path}
              </span>
              <span style={{ textAlign: "end" }}>
                <button
                  onClick={() => navigate(`/cameras/${c.id}`)}
                  className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-dim cursor-pointer"
                  style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
                >
                  {dict.open}
                </button>
              </span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
