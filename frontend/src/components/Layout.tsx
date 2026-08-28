import { NavLink, Outlet, useNavigate } from "react-router-dom";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import VideoSettingsRoundedIcon from "@mui/icons-material/VideoSettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import { Avatar, IconButton, Tooltip } from "@mui/material";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useSnapshotSessionStore } from "../store/snapshotSessionStore";
import { useLocale } from "../i18n/LocaleContext";
import { LanguageToggle } from "./LanguageToggle";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive ? "bg-primary/10 text-primary" : "text-inkDim hover:text-ink hover:bg-subtle"
  }`;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Layout() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const displayName = user?.full_name || user?.username || "";
  const { direction, t } = useLocale();

  // The snapshot session lives in an app-level store (not page state) so it
  // keeps capturing across navigation; surfacing it here means there's
  // always a way to see/stop it, even from a page other than Cameras.
  const isSessionRunning = useSnapshotSessionStore((state) => state.isRunning);
  const sessionCameraIds = useSnapshotSessionStore((state) => state.cameraIds);
  const stopSession = useSnapshotSessionStore((state) => state.stop);

  return (
    <div className="flex h-screen bg-canvas text-ink font-display">
      <aside className={`w-64 shrink-0 bg-surface flex flex-col ${direction === "rtl" ? "border-l" : "border-r"} border-border`}>
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <VideocamRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
            </div>
            <span className="font-bold tracking-tight text-lg">FaceVision</span>
          </div>
          <p className="text-xs text-inkDim mt-1.5">{t("liveRecognition")}</p>
          <LanguageToggle className="mt-4" />
        </div>

        {isSessionRunning && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success">
            <span className="live-dot" />
            <span className="flex-1 truncate">
              {t("snapshotSessionRunning", { count: String(sessionCameraIds.length) })}
            </span>
            <Tooltip title={t("stopSnapshot")}>
              <IconButton size="small" onClick={stopSession} aria-label={t("stopSnapshot")}>
                <StopRoundedIcon fontSize="small" sx={{ color: "inherit" }} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/cameras" className={navItemClass}>
            <VideocamRoundedIcon fontSize="small" /> {t("cameras")}
          </NavLink>
          <NavLink to="/annotation" className={navItemClass}>
            <CropFreeRoundedIcon fontSize="small" /> {t("annotation")}
          </NavLink>
          {user?.role === "super_admin" && (
            <>
              <NavLink to="/camera-management" className={navItemClass}>
                <VideoSettingsRoundedIcon fontSize="small" /> {t("cameraManagement")}
              </NavLink>
              <NavLink to="/users" className={navItemClass}>
                <GroupRoundedIcon fontSize="small" /> {t("userManagement")}
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-border flex items-center gap-3">
          <Avatar sx={{ width: 34, height: 34, bgcolor: "#EEF2FF", color: "#4F46E5", fontSize: 13, fontWeight: 700 }}>
            {initials(displayName || "?")}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-inkDim tracking-wide">{user?.role ? t(user.role === "super_admin" ? "superAdmin" : user.role === "level_1" ? "level1" : user.role === "level_2" ? "level2" : "level3") : ""}</p>
          </div>
          <button
            onClick={() => {
              if (refreshToken) {
                apiClient.post("/api/auth/logout", { refresh_token: refreshToken }).catch(() => {});
              }
              logout();
              navigate("/login");
            }}
            className="text-inkDim hover:text-danger transition-colors p-1"
            title={t("signOut")}
            aria-label={t("signOut")}
          >
            <LogoutRoundedIcon fontSize="small" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
