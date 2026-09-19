import { useState } from "react";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { useAppStore } from "../store/appStore";
import { t } from "../i18n";
import { Panel } from "../components/common/Panel";
import {
  useAdminCameras,
  useCreateCamera,
  useUpdateCamera,
  useDeleteCamera,
  type CameraAdmin,
  type CameraInput,
} from "../api/queries";

const EMPTY_FORM: CameraInput = { name: "", host: "", port: 554, path: "", username: "", password: "", zone: "", is_active: true };

export function CameraManagementPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const { data: cams = [], isLoading } = useAdminCameras();
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();
  const deleteCamera = useDeleteCamera();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CameraAdmin | null>(null);
  const [form, setForm] = useState<CameraInput>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: CameraAdmin) => {
    setEditing(c);
    setForm({ name: c.name, host: c.host, port: c.port, path: c.path, username: c.username ?? "", password: "", zone: c.zone ?? "", is_active: c.is_active });
    setDialogOpen(true);
  };

  const save = async () => {
    if (editing) {
      const patch: Partial<CameraInput> = { ...form };
      if (!patch.password) delete patch.password;
      await updateCamera.mutateAsync({ id: editing.id, data: patch });
    } else {
      await createCamera.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-[15px] max-w-[1320px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.camman_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.camman_sub}</div>
        </div>
        <button
          onClick={openCreate}
          className="px-[13px] py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer"
          style={{ background: "#6366F1" }}
        >
          {dict.add_camera}
        </button>
      </div>
      {isLoading && <div className="py-10 text-center text-[12.5px] text-faint">{dict.loading}</div>}
      <Panel>
        <div
          className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
          style={{ gridTemplateColumns: "2fr 1.1fr 1fr .7fr 1fr", letterSpacing: ".12em" }}
        >
          <span>{dict.th_camera}</span>
          <span>{dict.th_host}</span>
          <span>{dict.th_path}</span>
          <span>{dict.th_active}</span>
          <span style={{ textAlign: "end" }}>{dict.edit}</span>
        </div>
        {cams.map((c, i) => (
          <div
            key={c.id}
            className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
            style={{ gridTemplateColumns: "2fr 1.1fr 1fr .7fr 1fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-txt">{c.name}</span>
              {c.has_password && (
                <span className="px-1.5 py-[2px] rounded-md text-teal font-mono" style={{ background: "rgba(20,184,166,.13)", fontSize: 9.5 }}>
                  {dict.secured}
                </span>
              )}
            </span>
            <span className="font-mono text-dim text-[11.5px]">{c.host}:{c.port}</span>
            <span className="font-mono text-dim text-[11.5px]">{c.path}</span>
            <span>
              <Switch
                size="small"
                checked={c.is_active}
                onChange={(e) => updateCamera.mutate({ id: c.id, data: { is_active: e.target.checked } })}
              />
            </span>
            <span style={{ textAlign: "end", display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => openEdit(c)}
                className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-dim cursor-pointer"
                style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
              >
                {dict.edit}
              </button>
              <button
                onClick={() => deleteCamera.mutate(c.id)}
                className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-rose cursor-pointer"
                style={{ border: "1px solid rgba(244,63,94,.3)", background: "transparent" }}
              >
                {dict.delete}
              </button>
            </span>
          </div>
        ))}
        {cams.length === 0 && !isLoading && <div className="px-4 py-8 text-center text-[12px] text-faint">{dict.no_data}</div>}
      </Panel>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? dict.edit : dict.add_camera}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 pt-2">
          <TextField label={dict.th_camera} size="small" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField label={dict.host} size="small" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} fullWidth />
          <TextField
            label={dict.port}
            size="small"
            type="number"
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
            fullWidth
          />
          <TextField label={dict.path} size="small" value={form.path} onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))} fullWidth />
          <TextField label={dict.zone} size="small" value={form.zone ?? ""} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} fullWidth />
          <TextField
            label={dict.username_field}
            size="small"
            value={form.username ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            fullWidth
          />
          <TextField
            label={dict.password_field}
            size="small"
            type="password"
            value={form.password ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{dict.cancel}</Button>
          <Button variant="contained" onClick={save} disabled={createCamera.isPending || updateCamera.isPending}>
            {editing ? dict.save : dict.create}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
