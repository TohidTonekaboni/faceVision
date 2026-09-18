import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { t, formatDigits } from "../i18n";

export function LoginPage() {
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const login = useAppStore((s) => s.login);
  const dict = t(lang);

  const [username, setUsername] = useState("operator.nasiri");
  const [password, setPassword] = useState("············");
  const [remember, setRemember] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    login();
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen grid bg-bg" style={{ gridTemplateColumns: "1.05fr .95fr" }}>
      <div
        className="relative overflow-hidden p-14 flex flex-col justify-between min-h-screen"
        style={{ borderInlineEnd: "1px solid var(--fv-line)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 10% 0%, rgba(99,102,241,.2), transparent 60%),radial-gradient(90% 70% at 90% 100%, rgba(20,184,166,.14), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center font-bold text-[15px] text-white"
            style={{ background: "linear-gradient(140deg,#6366F1,#14B8A6)" }}
          >
            F
          </div>
          <div className="font-semibold text-[15px] text-txt">FaceVision</div>
        </div>
        <div className="relative max-w-[440px] flex flex-col gap-[18px]">
          <div className="text-[11px] font-mono uppercase text-teal" style={{ letterSpacing: ".16em" }}>
            {dict.login_kicker}
          </div>
          <div className="text-[34px] leading-[1.2] font-semibold text-txt" style={{ textWrap: "pretty" }}>
            {dict.login_head}
          </div>
          <div className="text-[14px] leading-[1.7] text-dim" style={{ textWrap: "pretty" }}>
            {dict.login_sub}
          </div>
        </div>
        <div className="relative flex gap-[26px] text-[11px] font-mono text-faint">
          <span>{formatDigits(lang, 12)} {dict.l_cameras}</span>
          <span>{formatDigits(lang, "99.4%")} {dict.l_uptime}</span>
          <span>v2.0</span>
        </div>
      </div>

      <div className="grid place-items-center p-10 bg-panel">
        <form onSubmit={submit} className="w-full max-w-[360px] flex flex-col gap-[22px]">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setLang("en")}
              className="px-[11px] py-[5px] rounded-[7px] border-none cursor-pointer text-[11px] font-medium"
              style={{ background: lang === "en" ? "#6366F1" : "transparent", color: lang === "en" ? "#fff" : "var(--fv-dim)" }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("fa")}
              className="px-[11px] py-[5px] rounded-[7px] border-none cursor-pointer text-[11px] font-medium"
              style={{ background: lang === "fa" ? "#6366F1" : "transparent", color: lang === "fa" ? "#fff" : "var(--fv-dim)" }}
            >
              فا
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-2.5 py-[5px] rounded-lg text-[11px] text-dim cursor-pointer"
              style={{ border: "1px solid var(--fv-line)", background: "transparent" }}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[21px] font-semibold text-txt">{dict.signin}</div>
            <div className="text-[13px] text-dim">{dict.signin_sub}</div>
          </div>

          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-[7px]">
              <span className="text-[12px] text-dim">{dict.username}</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="px-[13px] py-[11px] rounded-[10px] text-[13px] outline-none bg-panel2 text-txt"
                style={{ border: "1px solid var(--fv-line)" }}
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-[12px] text-dim">{dict.password}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-[13px] py-[11px] rounded-[10px] text-[13px] outline-none bg-panel2 text-txt"
                style={{ border: "1px solid var(--fv-line)" }}
              />
            </label>
            <div className="flex items-center justify-between text-[12px]">
              <label className="flex items-center gap-2 text-dim cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: "#6366F1" }} />
                {dict.remember}
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()}>
                {dict.forgot}
              </a>
            </div>
            <button
              type="submit"
              className="mt-1 p-3 rounded-[10px] border-none text-white text-[13px] font-semibold cursor-pointer"
              style={{ background: "#6366F1", boxShadow: "0 6px 18px -6px rgba(99,102,241,.7)" }}
            >
              {dict.signin}
            </button>
          </div>

          <div className="text-[11px] text-faint text-center font-mono">{dict.login_foot}</div>
        </form>
      </div>
    </div>
  );
}
