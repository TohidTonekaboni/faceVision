import { useState } from "react";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";
import { Panel } from "../components/common/Panel";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, ROLE_COLORS } from "../hooks/useUsers";
import type { Role } from "../store/authStore";

const ROLES: Role[] = ["super_admin", "level_1", "level_2", "level_3"];

const EMPTY_FORM = { username: "", password: "", full_name: "", role: "level_1" as Role };

export function UsersPage() {
  const lang = useAppStore((s) => s.lang);
  const dict = t(lang);
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const roleLabel = (r: string) => (dict as Record<string, string>)[`role_${r}`] ?? r;

  const save = async () => {
    await createUser.mutateAsync(form);
    setDialogOpen(false);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="flex flex-col gap-[15px] max-w-[1280px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[22px] font-semibold text-txt">{dict.users_title}</div>
          <div className="text-[12.5px] text-dim mt-1">{dict.users_sub}</div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-[13px] py-2 rounded-[9px] border-none text-white text-[12px] font-medium cursor-pointer"
          style={{ background: "#6366F1" }}
        >
          {dict.add_user}
        </button>
      </div>
      {isLoading && <div className="py-10 text-center text-[12.5px] text-faint">{dict.loading}</div>}
      <Panel>
        <div
          className="grid gap-3 px-4 py-[11px] bg-panel2 border-b border-line text-[10px] font-mono uppercase text-faint"
          style={{ gridTemplateColumns: "1.8fr 1fr 1.1fr .7fr 1fr", letterSpacing: ".12em" }}
        >
          <span>{dict.th_user}</span>
          <span>{dict.th_role}</span>
          <span>{dict.th_signin}</span>
          <span>{dict.th_active}</span>
          <span style={{ textAlign: "end" }}>{dict.edit}</span>
        </div>
        {users.map((u, i) => (
          <div
            key={u.id}
            className="grid gap-3 items-center px-4 py-[11px] border-b border-line text-[12.5px]"
            style={{ gridTemplateColumns: "1.8fr 1fr 1.1fr .7fr 1fr", background: i % 2 ? "var(--fv-zebra)" : "transparent" }}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="min-w-0 flex flex-col">
                <span className="text-[12.5px] text-txt overflow-hidden text-ellipsis whitespace-nowrap">{u.full_name || u.username}</span>
                <span className="text-[10.5px] font-mono text-faint">{u.username}</span>
              </span>
            </span>
            <span>
              <span
                className="px-2 py-[3px] rounded-md text-[10.5px] font-mono"
                style={{ background: `${ROLE_COLORS[u.role]}22`, color: ROLE_COLORS[u.role] }}
              >
                {roleLabel(u.role)}
              </span>
            </span>
            <span className="font-mono text-dim text-[11.5px]">{formatDigits(lang, new Date(u.created_at).toLocaleDateString())}</span>
            <span>
              <Switch
                size="small"
                checked={u.is_active}
                onChange={(e) => updateUser.mutate({ id: u.id, data: { is_active: e.target.checked } })}
              />
            </span>
            <span style={{ textAlign: "end", display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => deleteUser.mutate(u.id)}
                className="px-2.5 py-[5px] rounded-[7px] text-[11px] text-rose cursor-pointer"
                style={{ border: "1px solid rgba(244,63,94,.3)", background: "transparent" }}
              >
                {dict.delete}
              </button>
            </span>
          </div>
        ))}
        {users.length === 0 && !isLoading && <div className="px-4 py-8 text-center text-[12px] text-faint">{dict.no_data}</div>}
      </Panel>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{dict.add_user}</DialogTitle>
        <DialogContent className="flex flex-col gap-3 pt-2">
          <TextField label={dict.username_field} size="small" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} fullWidth />
          <TextField
            label={dict.password_field}
            size="small"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            fullWidth
          />
          <TextField label={dict.full_name} size="small" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} fullWidth />
          <TextField
            select
            label={dict.th_role}
            size="small"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            fullWidth
          >
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {roleLabel(r)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{dict.cancel}</Button>
          <Button variant="contained" onClick={save} disabled={createUser.isPending}>
            {dict.create}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
