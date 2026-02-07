import * as React from "react";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Stack,
  Chip,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import InsightsIcon from "@mui/icons-material/Insights";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import DatasetIcon from "@mui/icons-material/Dataset";
import FilePresentIcon from "@mui/icons-material/FilePresent";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";

/* -------------------- TYPES -------------------- */
export type NavKey = "single" | "explorer" | "batch";

/* -------------------- CONSTANTS -------------------- */
const drawerWidth = 280;

/* -------------------- COMPONENT -------------------- */
export default function DashboardLayout(props: {
  active: NavKey;
  setActive: (k: NavKey) => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = React.useState(false);

  const sidebar = (
    <Box sx={{ px: 2.2, py: 2 }}>
      {/* Brand */}
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: "#1D9BF0",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            X
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 950, lineHeight: 1.1 }}>
              Twitter Sentiment Analysis
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Analytics Dashboard
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Chip size="small" label="Sentiment" variant="outlined" />
          <Chip size="small" label="Dashboard" variant="outlined" />
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Navigation */}
      <List>
        <ListItemButton
          selected={props.active === "single"}
          onClick={() => props.setActive("single")}
          sx={{ borderRadius: 2, mb: 0.6 }}
        >
          <ListItemIcon>
            <TextSnippetIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Single Text" secondary="One tweet" />
        </ListItemButton>

        <ListItemButton
          selected={props.active === "explorer"}
          onClick={() => props.setActive("explorer")}
          sx={{ borderRadius: 2, mb: 0.6 }}
        >
          <ListItemIcon>
            <DatasetIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Explorer" secondary="Analytics & KPIs" />
        </ListItemButton>

        <ListItemButton
          selected={props.active === "batch"}
          onClick={() => props.setActive("batch")}
          sx={{ borderRadius: 2 }}
        >
          <ListItemIcon>
            <FilePresentIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Batch CSV" secondary="Upload & export" />
        </ListItemButton>
      </List>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
        <SettingsSuggestIcon fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          Professional analytics UI
        </Typography>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      {/* Sidebar container */}
      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
        }}
      >
        {isMdUp ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
                borderRight: "1px solid rgba(15,23,42,0.08)",
                bgcolor: "white",
                boxShadow: "4px 0 24px rgba(15,23,42,0.04)",
              },
            }}
          >
            {sidebar}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={open}
            onClose={() => setOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
                bgcolor: "white",
              },
            }}
          >
            {sidebar}
          </Drawer>
        )}
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0, // IMPORTANT: prevents overflow/horizontal scroll
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {!isMdUp && (
              <IconButton onClick={() => setOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}

            <Stack sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <InsightsIcon color="primary" />
                <Typography sx={{ fontWeight: 900 }}>
                  Tweet Sentiment Analytics
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Horizon-style dashboard UI
              </Typography>
            </Stack>

            {props.right}
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            p: { xs: 2, md: 3 },
            maxWidth: 1400,
            mx: "auto",
            minWidth: 0, // IMPORTANT: prevents child overflow
          }}
        >
          {props.children}
        </Box>
      </Box>
    </Box>
  );
}
