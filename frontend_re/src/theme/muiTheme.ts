import { createTheme } from "@mui/material/styles";
import type { Theme as MuiTheme } from "@mui/material/styles";
import type { Lang } from "../i18n";
import type { Theme as AppTheme } from "../store/appStore";

const DARK = {
  bg: "#070B16",
  panel: "#0E1524",
  panel2: "#141C2E",
  line: "#1E293B",
  txt: "#E6EDF7",
  dim: "#94A3B8",
  faint: "#64748B",
};
const LIGHT = {
  bg: "#F4F6FB",
  panel: "#FFFFFF",
  panel2: "#F1F4FA",
  line: "#E2E8F2",
  txt: "#111827",
  dim: "#5B6577",
  faint: "#8A94A6",
};

export function buildMuiTheme(mode: AppTheme, lang: Lang): MuiTheme {
  const c = mode === "dark" ? DARK : LIGHT;
  return createTheme({
    direction: lang === "fa" ? "rtl" : "ltr",
    palette: {
      mode,
      background: { default: c.bg, paper: c.panel },
      text: { primary: c.txt, secondary: c.dim },
      primary: { main: "#6366F1", contrastText: "#fff" },
      secondary: { main: "#14B8A6" },
      divider: c.line,
    },
    typography: {
      fontFamily: lang === "fa" ? "'Vazirmatn', sans-serif" : "'Archivo', sans-serif",
    },
    shape: { borderRadius: 10 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 500 },
        },
      },
    },
  });
}
