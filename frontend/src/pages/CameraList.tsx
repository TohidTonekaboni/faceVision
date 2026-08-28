import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
} from "@mui/material";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import { useCameras } from "../api/queries";
import { useAuthStore } from "../store/authStore";
import { useSnapshotSessionStore } from "../store/snapshotSessionStore";
import { CameraView } from "./CameraView";
import { useLocale } from "../i18n/LocaleContext";

export default function CameraList() {
  const { data: cameras, isLoading } = useCameras();
  const [selected, setSelected] = useState<string | null>(null);
  const { direction, t } = useLocale();
  const { user } = useAuthStore();

  // Lives in an app-level store (not component state) so a running session
  // keeps capturing snapshots even after navigating away from this page.
  const isSessionRunning = useSnapshotSessionStore((state) => state.isRunning);
  const startSession = useSnapshotSessionStore((state) => state.start);
  const stopSession = useSnapshotSessionStore((state) => state.stop);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCameraIds, setSelectedCameraIds] = useState<Set<string>>(new Set());

  const openSnapshotModal = () => {
    setSelectedCameraIds(new Set());
    setModalOpen(true);
  };

  const toggleCameraSelected = (id: string) => {
    setSelectedCameraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartSession = () => {
    if (selectedCameraIds.size === 0) return;
    startSession(Array.from(selectedCameraIds));
    setModalOpen(false);
  };

  if (isLoading) {
    return <div className="p-8 text-inkDim text-sm">{t("loadingCameras")}</div>;
  }

  if (selected) {
    return <CameraView cameraId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{t("cameras")}</h1>
          <p className="text-sm text-inkDim">{t("selectFeed")}</p>
        </div>
        {user?.role === "super_admin" && (
          <div className="flex items-center gap-3">
            <Button
              variant="contained"
              startIcon={<PhotoCameraRoundedIcon />}
              onClick={openSnapshotModal}
              disabled={isSessionRunning}
            >
              {t("takeSnapshot")}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<StopRoundedIcon />}
              onClick={stopSession}
              disabled={!isSessionRunning}
            >
              {t("stopSnapshot")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cameras?.map((cam) => (
          <button
            key={cam.id}
            onClick={() => setSelected(cam.id)}
            className="text-left bg-surface border border-border rounded-xl overflow-hidden hover:shadow-soft hover:border-primary/40 transition-all"
          >
            <div className="aspect-video bg-[#0F172A] flex items-center justify-center relative">
              <span className={`absolute top-3 ${direction === "rtl" ? "right-3" : "left-3"} flex items-center gap-1.5 text-xs font-semibold text-white bg-black/40 px-2 py-1 rounded-md`}>
                <span className="live-dot" /> {t("live")}
              </span>
              <VideocamRoundedIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: 40 }} />
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-sm">{cam.name}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  cam.is_active ? "text-success bg-success/10" : "text-inkDim bg-subtle"
                }`}
              >
                {cam.is_active ? t("online") : t("offline")}
              </span>
            </div>
          </button>
        ))}
        {cameras?.length === 0 && (
          <p className="text-sm text-inkDim">
            {t("noCamerasConfigured")}
          </p>
        )}
      </div>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("selectCamerasForSnapshot")}</DialogTitle>
        <DialogContent>
          <p className="text-sm text-inkDim mb-2">{t("selectCamerasForSnapshotDescription")}</p>
          {cameras?.length === 0 && <p className="text-sm text-inkDim">{t("noCamerasToSelect")}</p>}
          {cameras?.map((cam) => (
            <FormControlLabel
              key={cam.id}
              control={
                <Checkbox
                  checked={selectedCameraIds.has(cam.id)}
                  onChange={() => toggleCameraSelected(cam.id)}
                />
              }
              label={cam.name}
              className="flex w-full"
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
          <Button variant="contained" onClick={handleStartSession} disabled={selectedCameraIds.size === 0}>
            {t("startSnapshotSession")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
