import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "../i18n";
import type { CurrentUser, Role } from "../store/authStore";
import { useAuthStore } from "../store/authStore";

export type Theme = "dark" | "light";
export type { Role };

interface AppState {
  theme: Theme;
  lang: Lang;
  role: Role;
  authenticated: boolean;
  lastCameraId: string;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  setLastCameraId: (id: string) => void;
  /** Called after a real login (POST /api/auth/login + GET /api/auth/me)
   * succeeds — role is mirrored from the authenticated user rather than set
   * independently, so existing role-gated nav/routes (RequireRole,
   * navConfig) keep working unchanged. */
  login: (user: CurrentUser) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      lang: "en",
      role: "level_1",
      authenticated: false,
      lastCameraId: "",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setLang: (lang) => set({ lang }),
      setLastCameraId: (id) => set({ lastCameraId: id }),
      login: (user) => set({ authenticated: true, role: user.role }),
      logout: () => {
        useAuthStore.getState().logout();
        set({ authenticated: false });
      },
    }),
    { name: "facevision-app" },
  ),
);
