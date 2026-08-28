import { createTheme } from "@mui/material/styles";

export const createAppTheme = (direction: "ltr" | "rtl") => createTheme({
  direction,
  palette: {
    mode: "light",
    background: {
      default: "#F6F7FB",
      paper: "#FFFFFF",
    },
    primary: {
      main: "#4F46E5",
      dark: "#4338CA",
    },
    secondary: {
      main: "#0D9488",
    },
    error: {
      main: "#DC2626",
    },
    warning: {
      main: "#D97706",
    },
    success: {
      main: "#16A34A",
    },
    text: {
      primary: "#1E2233",
      secondary: "#6B7280",
    },
    divider: "#E4E7EF",
  },
  typography: {
    fontFamily: direction === "rtl" ? "'Vazirmatn', Tahoma, sans-serif" : "'Inter', sans-serif",
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "none",
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});
