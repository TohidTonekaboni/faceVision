import { useState } from "react";
import Switch from "@mui/material/Switch";
import { useAppStore } from "../store/appStore";
import { t } from "../i18n";
import { Panel } from "../components/common/Panel";
import { ImageSlot } from "../components/common/ImageSlot";
import { useUsers } from "../hooks/useUsers";
import { ROLE_COLORS } from "../data/users";

export function UsersPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const fa = lang === "fa";
  const { data: users = [] } = useUsers();
  const [active, setActive] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-[15px] max-w-[1280px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.users_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.users_sub}</div>
        </div>
        <button className="px-[13px] py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer" style={{ background: "#6366F1" }}>
          {dict.add_user}
        </button>
      </div>
      <Panel>
        <div
          className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
          style={{ gridTemplateColumns: "1.8fr 1fr 1.1fr .7fr 1fr", letterSpacing: ".12em" }}
        >
          <span>{dict.th_user}</span>
          <span>{dict.th_role}</span>
          <span>{dict.th_signin}</span>
          <span>{dict.th_active}</span>
          <span style={{ textAlign: "end" }}>{dict.edit}</span>
        </div>
        {users.map((u, i) => {
          const isActive = active[u.handle] ?? u.active;
          return (
            <div
              key={u.handle}
              className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
              style={{ gridTemplateColumns: "1.8fr 1fr 1.1fr .7fr 1fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-full overflow-hidden flex-none border border-line">
                  <ImageSlot id={`fv-u-${i}`} shape="circle" placeholder="" />
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[12.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{fa ? u.nameFa : u.name}</span>
                  <span className="text-[10.5px] font-mono text-faint">{u.handle}</span>
                </span>
              </span>
              <span>
                <span
                  className="px-2 py-[3px] rounded-md text-[10.5px] font-mono"
                  style={{ background: `${ROLE_COLORS[u.role]}22`, color: ROLE_COLORS[u.role] }}
                >
                  {u.role}
                </span>
              </span>
              <span className="font-mono text-dim text-[11.5px]">{u.lastSignIn}</span>
              <span>
                <Switch size="small" checked={isActive} onChange={(e) => setActive((a) => ({ ...a, [u.handle]: e.target.checked }))} />
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
