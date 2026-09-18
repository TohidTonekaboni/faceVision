import { useEffect, useMemo, type ReactNode } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { buildMuiTheme } from "../theme/muiTheme";
import { ltrCache, rtlCache } from "../theme/rtlCache";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const dir = lang === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [theme, dir, lang]);

  const muiTheme = useMemo(() => buildMuiTheme(theme, lang), [theme, lang]);
  const cache = dir === "rtl" ? rtlCache : ltrCache;

  return (
    <QueryClientProvider client={queryClient}>
      <CacheProvider value={cache}>
        <MuiThemeProvider theme={muiTheme}>
          <CssBaseline />
          <BrowserRouter>{children}</BrowserRouter>
        </MuiThemeProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}
