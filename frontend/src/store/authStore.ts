import { create } from "zustand";

export type Role = "super_admin" | "level_1" | "level_2" | "level_3";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  level_1: "Level 1",
  level_2: "Level 2",
  level_3: "Level 3",
};

export interface CurrentUser {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  setSession: (accessToken: string, refreshToken: string, user?: CurrentUser) => void;
  setUser: (user: CurrentUser) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

const storedAccessToken = localStorage.getItem("facevision_access_token");
const storedRefreshToken = localStorage.getItem("facevision_refresh_token");

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: storedAccessToken,
  refreshToken: storedRefreshToken,
  user: null,
  setSession: (accessToken, refreshToken, user) => {
    localStorage.setItem("facevision_access_token", accessToken);
    localStorage.setItem("facevision_refresh_token", refreshToken);
    set({ accessToken, refreshToken, ...(user ? { user } : {}) });
  },
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => {
    localStorage.setItem("facevision_access_token", accessToken);
    set({ accessToken });
  },
  logout: () => {
    localStorage.removeItem("facevision_access_token");
    localStorage.removeItem("facevision_refresh_token");
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
