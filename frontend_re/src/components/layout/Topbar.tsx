import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Popover from "@mui/material/Popover";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { useAppStore } from "../../store/appStore";
import { t, formatDigits } from "../../i18n";
import { crumbFor } from "./navConfig";
import { useCameras } from "../../hooks/useCameras";
import { useNotifications } from "../../hooks/useDashboard";
import { ImageSlot } from "../common/ImageSlot";

export function Topbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const dict = t(lang);
  const fa = lang === "fa";

  const [searchAnchor, setSearchAnchor] = useState<HTMLDivElement | null>(null);
  const [notifAnchor, setNotifAnchor] = useState<HTMLButtonElement | null>(null);
  const { data: notifs = [] } = useNotifications();
  const { data: cams = [] } = useCameras();

  const searchCams = cams.slice(0, 3);

  return (
    <header className="h-[60px] flex-none flex items-center gap-4 px-5 bg-panel border-b border-line relative z-[5]">
      <div className="flex items-center gap-2 text-[12px] text-faint min-w-0">
        <span>{dict.brand_short}</span>
        <span style={{ opacity: 0.5 }}>{fa ? "‹" : "›"}</span>
        <span className="text-txt font-medium">{crumbFor(dict, pathname)}</span>
      </div>

      <div className="flex-1 max-w-[400px] relative" style={{ marginInlineStart: "auto" }}>
        <div
          onClick={(e) => setSearchAnchor(e.currentTarget)}
          className="flex items-center gap-[9px] px-3 py-2 rounded-[10px] border border-line bg-panel2 cursor-text"
        >
          <SearchRoundedIcon sx={{ fontSize: 15 }} className="text-faint" />
          <span className="flex-1 text-[12.5px] text-faint">{dict.search_ph}</span>
          <span className="text-[10px] font-mono px-[5px] py-px rounded border border-line text-faint">⌘K</span>
        </div>
        <Popover
          open={!!searchAnchor}
          anchorEl={searchAnchor}
          onClose={() => setSearchAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{ paper: { className: "w-[400px] mt-1.5 bg-panel border border-line rounded-xl overflow-hidden" } }}
        >
          <div className="px-[13px] py-[9px] text-[9.5px] font-mono uppercase text-faint bg-panel2" style={{ letterSpacing: ".14em" }}>
            {dict.cameras}
          </div>
          {searchCams.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setSearchAnchor(null);
                navigate(`/cameras/${c.id}`);
              }}
              className="px-[13px] py-[9px] flex items-center gap-2.5 text-[12.5px] text-txt cursor-pointer"
            >
              <span
                className="w-[7px] h-[7px] rounded-full flex-none"
                style={{ background: c.status === "online" ? "#14B8A6" : "#64748B" }}
              />
              <span className="flex-1">{c.name}</span>
              <span className="text-[11px] text-faint">{c.zone}</span>
            </div>
          ))}
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex p-[2px] rounded-[9px] border border-line bg-panel2">
          <button
            onClick={() => setLang("en")}
            className="px-[11px] py-[5px] rounded-[7px] border-none cursor-pointer text-[11px] font-medium"
            style={{ background: lang === "en" ? "#6366F1" : "transparent", color: lang === "en" ? "#fff" : "var(--fv-dim)" }}
          >
            EN
          </button>
          <button
            onClick={() => setLang("fa")}
            className="px-[11px] py-[5px] rounded-[7px] border-none cursor-pointer text-[11px] font-medium"
            style={{ background: lang === "fa" ? "#6366F1" : "transparent", color: lang === "fa" ? "#fff" : "var(--fv-dim)" }}
          >
            فا
          </button>
        </div>

        <button
          onClick={toggleTheme}
          title={dict.theme}
          className="w-[34px] h-[34px] rounded-[9px] border border-line bg-panel2 text-dim cursor-pointer text-[13px]"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

        <div className="relative">
          <button
            onClick={(e) => setNotifAnchor(e.currentTarget)}
            className="w-[34px] h-[34px] rounded-[9px] border border-line bg-panel2 text-dim cursor-pointer relative flex items-center justify-center"
          >
            <NotificationsNoneRoundedIcon sx={{ fontSize: 17 }} />
            <span
              className="absolute -top-[5px] min-w-4 h-4 px-1 rounded-full bg-rose text-white font-mono flex items-center justify-center"
              style={{ insetInlineEnd: "-5px", fontSize: 9.5, fontWeight: 600 }}
            >
              {formatDigits(lang, notifs.length || 7)}
            </span>
          </button>
          <Popover
            open={!!notifAnchor}
            anchorEl={notifAnchor}
            onClose={() => setNotifAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { className: "w-[330px] mt-1.5 bg-panel border border-line rounded-xl overflow-hidden" } }}
          >
            <div className="px-3.5 py-3 border-b border-line flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-txt">{dict.notif_title}</span>
              <span className="text-[10px] font-mono text-faint">{dict.notif_src}</span>
            </div>
            {notifs.map((n) => (
              <div key={n.id} className="px-3.5 py-[11px] flex gap-[11px] items-center border-b border-line">
                <div className="w-[30px] h-[30px] rounded-lg overflow-hidden flex-none border border-line">
                  <ImageSlot id={`fv-notif-${n.id}`} shape="rounded" radius={8} placeholder="face" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-txt font-medium">{n.isUnknown ? dict.unknown_tag : n.personName}</div>
                  <div className="text-[11px] text-dim overflow-hidden text-ellipsis whitespace-nowrap">{n.cameraName}</div>
                </div>
                <div className="text-[10.5px] font-mono text-faint">{formatDigits(lang, n.ago)}</div>
              </div>
            ))}
            {notifs.length === 0 && <div className="px-3.5 py-4 text-[12px] text-faint text-center">{dict.no_data}</div>}
            <button
              onClick={() => {
                setNotifAnchor(null);
                navigate("/reporting");
              }}
              className="w-full py-[11px] border-none bg-transparent text-indigo-soft text-[12px] cursor-pointer"
            >
              {dict.view_all}
            </button>
          </Popover>
        </div>
      </div>
    </header>
  );
}
