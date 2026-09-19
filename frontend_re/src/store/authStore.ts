import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "super_admin" | "level_1" | "level_2" | "level_3";

export interface CurrentUser {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: CurrentUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "facevision-re-auth" },
  ),
);
