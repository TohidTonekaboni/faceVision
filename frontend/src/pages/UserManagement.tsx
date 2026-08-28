import { useState } from "react";
import { Button, TextField, MenuItem, Switch, IconButton } from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../api/queries";
import { Role } from "../store/authStore";
import { useLocale } from "../i18n/LocaleContext";

const ROLE_OPTIONS: Role[] = ["level_1", "level_2", "level_3", "super_admin"];

export default function UserManagement() {
  const { t } = useLocale();
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("level_1");
  const roleLabel = (value: Role) =>
    t(value === "super_admin" ? "superAdmin" : value === "level_1" ? "level1" : value === "level_2" ? "level2" : "level3");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { username, password, full_name: fullName, role },
      {
        onSuccess: () => {
          setUsername("");
          setFullName("");
          setPassword("");
          setRole("level_1");
        },
      }
    );
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">{t("userManagement")}</h1>
      <p className="text-sm text-inkDim mb-6">{t("userManagementDescription")}</p>

      <form
        onSubmit={handleCreate}
        className="bg-surface border border-border rounded-xl p-5 mb-6 flex flex-wrap gap-3 items-end"
      >
        <TextField label={t("username")} size="small" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <TextField label={t("fullName")} size="small" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField
          label={t("password")}
          type="password"
          size="small"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextField
          select
          label={t("role")}
          size="small"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          sx={{ minWidth: 120 }}
        >
          {ROLE_OPTIONS.map((r) => (
            <MenuItem key={r} value={r}>
              {roleLabel(r)}
            </MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="contained" disabled={createUser.isPending}>
          {t("addUser")}
        </Button>
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-inkDim text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">{t("username")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("name")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("role")}</th>
              <th className="text-left px-4 py-2.5 font-semibold">{t("active")}</th>
              <th className="text-left px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2.5">{u.username}</td>
                <td className="px-4 py-2.5">{u.full_name || "—"}</td>
                <td className="px-4 py-2.5">
                  <TextField
                    select
                    size="small"
                    value={u.role}
                    onChange={(e) => updateUser.mutate({ id: u.id, data: { role: e.target.value as Role } })}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {roleLabel(r)}
                      </MenuItem>
                    ))}
                  </TextField>
                </td>
                <td className="px-4 py-2.5">
                  <Switch
                    checked={u.is_active}
                    onChange={(e) => updateUser.mutate({ id: u.id, data: { is_active: e.target.checked } })}
                    size="small"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <IconButton size="small" onClick={() => deleteUser.mutate(u.id)}>
                    <DeleteRoundedIcon fontSize="small" sx={{ color: "#DC2626" }} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users?.length === 0 && <p className="text-sm text-inkDim px-4 py-6">{t("noUsers")}</p>}
      </div>
    </div>
  );
}
