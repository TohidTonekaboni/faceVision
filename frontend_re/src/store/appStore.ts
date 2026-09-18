import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "../i18n";

export type Theme = "dark" | "light";
export type Role = "super_admin" | "level_1" | "level_2" | "level_3";

interface AppState {
  theme: Theme;
  lang: Lang;
  role: Role;
  authenticated: boolean;
  lastCameraId: string;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  setRole: (role: Role) => void;
  setLastCameraId: (id: string) => void;
  login: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      lang: "en",
      role: "super_admin",
      authenticated: false,
      lastCameraId: "c1",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setLang: (lang) => set({ lang }),
      setRole: (role) => set({ role }),
      setLastCameraId: (id) => set({ lastCameraId: id }),
      login: () => set({ authenticated: true }),
      logout: () => set({ authenticated: false }),
    }),
    { name: "facevision-app" },
  ),
);
