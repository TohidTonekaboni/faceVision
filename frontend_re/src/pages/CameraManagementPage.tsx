import { useState } from "react";
import Switch from "@mui/material/Switch";
import { useAppStore } from "../store/appStore";
import { t } from "../i18n";
import { Panel } from "../components/common/Panel";
import { useCameras } from "../hooks/useCameras";

export function CameraManagementPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const { data: cams = [] } = useCameras();
  const [active, setActive] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-[15px] max-w-[1320px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.camman_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.camman_sub}</div>
        </div>
        <button className="px-[13px] py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer" style={{ background: "#6366F1" }}>
          {dict.add_camera}
        </button>
      </div>
      <Panel>
        <div
          className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
          style={{ gridTemplateColumns: "2fr 1.1fr 1fr .7fr 1fr", letterSpacing: ".12em" }}
        >
          <span>{dict.th_camera}</span>
          <span>{dict.th_host}</span>
          <span>{dict.th_path}</span>
          <span>{dict.th_active}</span>
          <span style={{ textAlign: "end" }}>{dict.edit}</span>
        </div>
        {cams.map((c, i) => {
          const isActive = active[c.id] ?? c.status !== "offline";
          return (
            <div
              key={c.id}
              className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
              style={{ gridTemplateColumns: "2fr 1.1fr 1fr .7fr 1fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-txt">{fa ? c.nameFa : c.name}</span>
                {c.secured && (
                  <span className="px-1.5 py-[2px] rounded-md text-teal font-mono" style={{ background: "rgba(20,184,166,.13)", fontSize: 9.5 }}>
                    {dict.secured}
                  </span>
                )}
              </span>
              <span className="font-mono text-dim text-[11.5px]">{c.host}:554</span>
              <span className="font-mono text-dim text-[11.5px]">{c.path}</span>
              <span>
                <Switch size="small" checked={isActive} onChange={(e) => setActive((a) => ({ ...a, [c.id]: e.target.checked }))} />
              </span>
              <span style={{ textAlign: "end", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-dim cursor-pointer" style={{ border: "1px solid var(--fv-line)", background: "transparent" }}>
                  {dict.edit}
                </button>
                <button className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-rose cursor-pointer" style={{ border: "1px solid rgba(244,63,94,.3)", background: "transparent" }}>
                  {dict.delete}
                </button>
              </span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
