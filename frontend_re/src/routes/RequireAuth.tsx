import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useAppStore((s) => s.authenticated);
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
