import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1D9BF0" },           // Twitter blue
    secondary: { main: "#0EA5E9" },         // cyan accent
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#475569" },
    divider: "rgba(15, 23, 42, 0.10)",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial`,
    h4: { fontWeight: 850, letterSpacing: "-0.02em" },
    h6: { fontWeight: 750 },
    button: { fontWeight: 750 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 16px 40px rgba(2, 6, 23, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 999, paddingInline: 16 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 750, minHeight: 44 },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
