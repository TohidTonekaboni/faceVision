import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore, type Role } from "../store/appStore";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useAppStore((s) => s.role);
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
