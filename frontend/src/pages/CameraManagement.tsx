import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  IconButton,
  Chip,
  Alert,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import {
  useAdminCameras,
  useCreateCamera,
  useUpdateCamera,
  useDeleteCamera,
  CameraAdmin,
  CameraInput,
} from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

const EMPTY_FORM: CameraInput = {
  name: "",
  host: "",
  port: 554,
  path: "",
  username: "",
  password: "",
  is_active: true,
};

export default function CameraManagement() {
  const { locale, t } = useLocale();
  const { data: cameras, isLoading } = useAdminCameras();
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();
  const deleteCamera = useDeleteCamera();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CameraAdmin | null>(null);
  const [form, setForm] = useState<CameraInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CameraAdmin | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (camera: CameraAdmin) => {
    setEditing(camera);
    setForm({
      name: camera.name,
      host: camera.host,
      port: camera.port,
      path: camera.path,
      username: camera.username ?? "",
      password: "",
      is_active: camera.is_active,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.host) {
      setFormError(t("requiredCameraFields"));
      return;
    }

    const payload: CameraInput = {
      ...form,
      port: Number(form.port) || 554,
      username: form.username || null,
      password: form.password || null,
    };

    const onSettled = {
      onSuccess: () => setDialogOpen(false),
      onError: (err: any) => setFormError(locale === "en" ? (err?.response?.data?.detail ?? t("saveCameraFailed")) : t("saveCameraFailed")),
    };

    if (editing) {
      updateCamera.mutate({ id: editing.id, data: payload }, onSettled);
    } else {
      createCamera.mutate(payload, onSettled);
    }
  };

  const addressFor = (camera: CameraAdmin) => {
    const path = camera.path ? (camera.path.startsWith("/") ? camera.path : `/${camera.path}`) : "";
    return `${camera.host}:${camera.port}${path}`;
  };

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{t("cameraManagement")}</h1>
          <p className="text-sm text-inkDim">{t("cameraManagementDescription")}</p>
        </div>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          {t("addCamera")}
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-inkDim text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">{t("name")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("address")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("username")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("active")}</th>
              <th className="text-left px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {cameras?.map((camera) => (
              <tr key={camera.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                  <VideocamRoundedIcon fontSize="small" sx={{ color: "#94A3B8" }} />
                  {camera.name}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-inkDim" dir="ltr">{addressFor(camera)}</td>
                <td className="px-4 py-2.5">
                  {camera.username ? (
                    <span>
                      {camera.username}
                      {camera.has_password && <Chip label={t("secured")} size="small" sx={{ mx: 1, height: 18, fontSize: 10 }} />}
                    </span>
                  ) : (
                    <span className="text-inkDim">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Switch
                    checked={camera.is_active}
                    onChange={(e) => updateCamera.mutate({ id: camera.id, data: { is_active: e.target.checked } })}
                    size="small"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <IconButton size="small" onClick={() => openEdit(camera)}>
                    <EditRoundedIcon fontSize="small" sx={{ color: "#4F46E5" }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setPendingDelete(camera)}>
                    <DeleteRoundedIcon fontSize="small" sx={{ color: "#DC2626" }} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && cameras?.length === 0 && (
          <p className="text-sm text-inkDim px-4 py-6">
            {t("noRegisteredCameras")}
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? t("editCamera") : t("addCamera")}</DialogTitle>
          <DialogContent className="space-y-4 pt-1">
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={t("name")}
              fullWidth
              size="small"
              margin="dense"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
            <div className="flex gap-3">
              <TextField
                label={t("hostIp")}
                fullWidth
                size="small"
                margin="dense"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="192.168.1.10"
                inputProps={{ dir: "ltr" }}
                required
              />
              <TextField
                label={t("port")}
                type="number"
                size="small"
                margin="dense"
                sx={{ width: 120 }}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              />
            </div>
            <TextField
              label={t("streamPath")}
              fullWidth
              size="small"
              margin="dense"
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="/stream1"
              helperText={t("streamPathHelp")}
              inputProps={{ dir: "ltr" }}
            />
            <div className="flex gap-3">
              <TextField
                label={t("username")}
                fullWidth
                size="small"
                margin="dense"
                value={form.username ?? ""}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <TextField
                label={t("password")}
                type="password"
                fullWidth
                size="small"
                margin="dense"
                value={form.password ?? ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing?.has_password ? t("leavePasswordBlank") : ""}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.is_active ?? true}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                size="small"
              />
              <span className="text-sm text-inkDim">{t("activeVisible")}</span>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>{t("cancel")}</Button>
            <Button type="submit" variant="contained" disabled={createCamera.isPending || updateCamera.isPending}>
              {editing ? t("saveChanges") : t("addCamera")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("deleteCamera")}</DialogTitle>
        <DialogContent>
          <p className="text-sm text-inkDim">
            {t("deleteCameraDescription", { name: pendingDelete?.name ?? "" })}
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (pendingDelete) deleteCamera.mutate(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
