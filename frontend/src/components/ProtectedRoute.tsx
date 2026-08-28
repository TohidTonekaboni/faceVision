import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (adminOnly && user && user.role !== "super_admin") return <Navigate to="/cameras" replace />;

  return <Outlet />;
}
