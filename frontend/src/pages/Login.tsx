import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, TextField, Alert } from "@mui/material";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useLocale } from "../i18n/LocaleContext";
import { LanguageToggle } from "../components/LanguageToggle";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const { locale, t } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);
      const { data } = await apiClient.post("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setSession(data.access_token, data.refresh_token);
      const meRes = await apiClient.get("/api/auth/me");
      useAuthStore.getState().setUser(meRes.data);
      navigate("/cameras");
    } catch (err: any) {
      setError(locale === "en" ? (err.response?.data?.detail || t("loginFailed")) : t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas font-display px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4"><LanguageToggle /></div>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3 shadow-soft">
            <VideocamRoundedIcon sx={{ color: "#fff" }} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FaceVision</h1>
          <p className="text-sm text-inkDim mt-1">{t("signInDescription")}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-7 space-y-4 shadow-soft"
        >
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label={t("username")}
            fullWidth
            size="small"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label={t("password")}
            type="password"
            fullWidth
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {loading ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}
