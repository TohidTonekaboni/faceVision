import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./routes/RequireAuth";
import { RequireRole } from "./routes/RequireRole";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CamerasPage } from "./pages/CamerasPage";
import { FocusedCameraPage } from "./pages/FocusedCameraPage";
import { ReportingPage } from "./pages/ReportingPage";
import { AnnotationPage } from "./pages/AnnotationPage";
import { OfflineInferencePage } from "./pages/OfflineInferencePage";
import { CameraManagementPage } from "./pages/CameraManagementPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cameras" element={<CamerasPage />} />
        <Route path="/cameras/:id" element={<FocusedCameraPage />} />
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/annotation" element={<AnnotationPage />} />
        <Route path="/offline" element={<OfflineInferencePage />} />
        <Route
          path="/camera-management"
          element={
            <RequireRole roles={["super_admin"]}>
              <CameraManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={["super_admin"]}>
              <UsersPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
