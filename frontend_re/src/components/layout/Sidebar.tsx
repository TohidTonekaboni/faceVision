import { Link, useLocation, useNavigate } from "react-router-dom";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { t, formatDigits } from "../../i18n";
import { buildNavGroups } from "./navConfig";
import { ImageSlot } from "../common/ImageSlot";

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const role = useAppStore((s) => s.role);
  const lastCameraId = useAppStore((s) => s.lastCameraId);
  const logout = useAppStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const dict = t(lang);
  const groups = buildNavGroups(dict, lang, role, lastCameraId);
  const roleLabel = (dict as Record<string, string>)[`role_${role}`] ?? role;

  return (
    <aside className="w-[248px] flex-none flex flex-col bg-panel border-e border-line">
      <div className="px-[18px] pt-[18px] pb-[14px] flex items-center gap-[11px]">
        <div
          className="w-[30px] h-[30px] rounded-[9px] grid place-items-center font-bold text-[14px] text-white"
          style={{ background: "linear-gradient(140deg,#6366F1,#14B8A6)" }}
        >
          F
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-[13.5px] text-txt">FaceVision</span>
          <span className="text-[10px] font-mono text-faint">{dict.control_center}</span>
        </div>
      </div>

      <div className="px-3.5 pb-3 flex flex-col gap-[7px]">
        <div className="flex items-center gap-[9px] py-[9px] px-[11px] rounded-[10px]" style={{ background: "rgba(20,184,166,.1)", border: "1px solid rgba(20,184,166,.3)" }}>
          <span className="w-[7px] h-[7px] rounded-full bg-teal" style={{ animation: "fvPulse 1.6s ease-in-out infinite" }} />
          <span className="flex-1 text-[11.5px] font-medium text-teal">{dict.inference_running}</span>
          <button className="text-[10px] px-[7px] py-[3px] rounded-[6px] cursor-pointer text-teal" style={{ border: "1px solid rgba(20,184,166,.35)", background: "transparent" }}>
            {dict.stop}
          </button>
        </div>
        <div className="flex items-center gap-[9px] py-[9px] px-[11px] rounded-[10px]" style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)" }}>
          <span className="w-[7px] h-[7px] rounded-full bg-amber" />
          <span className="flex-1 text-[11.5px] font-medium text-amber">{dict.snapshot_session}</span>
          <span className="text-[10px] font-mono text-amber">{formatDigits(lang, 184)}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-auto px-2.5 pb-2.5 pt-1 flex flex-col gap-0.5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-2 pt-3.5 pb-1.5 text-[9.5px] font-mono uppercase text-faint flex items-center gap-2" style={{ letterSpacing: ".14em" }}>
              <span>{g.title}</span>
              {g.admin && (
                <span className="px-[5px] py-[2px] rounded text-indigo-soft" style={{ background: "rgba(99,102,241,.16)", letterSpacing: ".06em" }}>
                  {dict.admin}
                </span>
              )}
            </div>
            {g.items.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className="flex items-center gap-[10px] w-full px-[11px] py-2 rounded-[9px] text-[12.5px] no-underline"
                  style={{
                    textAlign: "start",
                    background: active ? "rgba(99,102,241,.14)" : "transparent",
                    color: active ? "var(--fv-txt)" : "var(--fv-dim)",
                    fontWeight: active ? 500 : 400,
                    boxShadow: active ? "inset 0 0 0 1px rgba(99,102,241,.28)" : "none",
                  }}
                >
                  <span className="w-[5px] h-[5px] rounded-full flex-none" style={{ background: active ? "#6366F1" : "var(--fv-faint)" }} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-px rounded" style={{ background: "rgba(244,63,94,.16)", color: "#F43F5E" }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3.5 py-3 border-t border-line flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[9px] overflow-hidden flex-none border border-line">
          <ImageSlot id="fv-avatar" shape="rounded" radius={9} placeholder="avatar" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-[12px] font-medium text-txt overflow-hidden text-ellipsis whitespace-nowrap">
            {user?.full_name || user?.username || dict.user_name}
          </span>
          <span className="text-[10px] font-mono text-teal">{roleLabel}</span>
        </div>
        <button
          title={dict.signout}
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-7 h-7 rounded-lg border border-line text-dim cursor-pointer flex items-center justify-center"
          style={{ background: "transparent" }}
        >
          <PowerSettingsNewRoundedIcon sx={{ fontSize: 15 }} />
        </button>
      </div>
    </aside>
  );
}
