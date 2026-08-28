import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import CameraList from "./pages/CameraList";
import Annotation from "./pages/Annotation";
import UserManagement from "./pages/UserManagement";
import CameraManagement from "./pages/CameraManagement";
import { apiClient } from "./api/client";
import { useAuthStore } from "./store/authStore";

function useSessionBootstrap() {
  const { accessToken, user, setUser, logout } = useAuthStore();
  const [ready, setReady] = useState(!accessToken || !!user);

  useEffect(() => {
    if (!accessToken || user) return;
    apiClient
      .get("/api/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => logout())
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return ready;
}

export default function App() {
  const ready = useSessionBootstrap();

  if (!ready) {
    return <div className="h-screen w-screen bg-canvas" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/cameras" element={<CameraList />} />
          <Route path="/annotation" element={<Annotation />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/users" element={<UserManagement />} />
            <Route path="/camera-management" element={<CameraManagement />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/cameras" replace />} />
    </Routes>
  );
}
