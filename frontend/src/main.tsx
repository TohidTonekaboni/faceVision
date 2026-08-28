import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, CssBaseline } from "@mui/material";
import App from "./App";
import { createAppTheme } from "./theme/theme";
import { LocaleProvider, useLocale } from "./i18n/LocaleContext";
import { queryClient } from "./api/queryClient";
import "./index.css";

function LocalizedApp() {
  const { direction } = useLocale();
  const theme = useMemo(() => createAppTheme(direction), [direction]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <LocalizedApp />
      </LocaleProvider>
    </QueryClientProvider>
  </StrictMode>
);
