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
  Tooltip,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import InsightsIcon from "@mui/icons-material/Insights";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import DatasetIcon from "@mui/icons-material/Dataset";
import FilePresentIcon from "@mui/icons-material/FilePresent";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";

/* -------------------- TYPES -------------------- */
export type NavKey = "single" | "explorer" | "batch";

/* -------------------- CONSTANTS -------------------- */
const drawerWidthExpanded = 280;
const drawerWidthCollapsed = 76;

/* -------------------- COMPONENT -------------------- */
export default function DashboardLayout(props: {
  active: NavKey;
  setActive: (k: NavKey) => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  // Mobile drawer
  const [open, setOpen] = React.useState(false);

  // Desktop collapse
  const [collapsed, setCollapsed] = React.useState(false);
  const drawerWidth = collapsed ? drawerWidthCollapsed : drawerWidthExpanded;

  const sidebar = (
    <Box sx={{ px: collapsed ? 1.2 : 2.2, py: 2 }}>
      {/* Brand */}
      <Stack spacing={0.7} alignItems={collapsed ? "center" : "stretch"}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent={collapsed ? "center" : "flex-start"}
        >
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
              flex: "0 0 auto",
            }}
          >
            X
          </Box>

          {!collapsed && (
            <Box>
              <Typography sx={{ fontWeight: 950, lineHeight: 1.1 }}>
                Twitter Sentiment Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Analytics Dashboard
              </Typography>
            </Box>
          )}
        </Stack>

        {!collapsed && (
          <Stack direction="row" spacing={1}>
            <Chip size="small" label="Sentiment" variant="outlined" />
            <Chip size="small" label="Dashboard" variant="outlined" />
          </Stack>
        )}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Navigation */}
      <List sx={{ px: collapsed ? 0.3 : 0 }}>
        <Tooltip title={collapsed ? "Single Text" : ""} placement="right">
          <ListItemButton
            selected={props.active === "single"}
            onClick={() => props.setActive("single")}
            sx={{
              borderRadius: 2,
              mb: 0.6,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1.2 : 2,
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? "auto" : 40 }}>
              <TextSnippetIcon color="primary" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Single Text" secondary="One tweet" />}
          </ListItemButton>
        </Tooltip>

        <Tooltip title={collapsed ? "Explorer" : ""} placement="right">
          <ListItemButton
            selected={props.active === "explorer"}
            onClick={() => props.setActive("explorer")}
            sx={{
              borderRadius: 2,
              mb: 0.6,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1.2 : 2,
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? "auto" : 40 }}>
              <DatasetIcon color="primary" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Explorer" secondary="Analytics & KPIs" />}
          </ListItemButton>
        </Tooltip>

        <Tooltip title={collapsed ? "Batch CSV" : ""} placement="right">
          <ListItemButton
            selected={props.active === "batch"}
            onClick={() => props.setActive("batch")}
            sx={{
              borderRadius: 2,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1.2 : 2,
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? "auto" : 40 }}>
              <FilePresentIcon color="primary" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Batch CSV" secondary="Upload & export" />}
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider sx={{ my: 2 }} />

      {!collapsed && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
          <SettingsSuggestIcon fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            Professional analytics UI
          </Typography>
        </Stack>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      {/* Sidebar */}
      {isMdUp ? (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: drawerWidth,
              overflowX: "hidden",
              transition: "width 180ms ease",
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
          open={open}
          onClose={() => setOpen(false)}
          PaperProps={{ sx: { width: drawerWidthExpanded, bgcolor: "white" } }}
        >
          {sidebar}
        </Drawer>
      )}

      {/* Main */}
      <Box sx={{ flex: 1 }}>
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
            {/* Mobile open drawer */}
            {!isMdUp && (
              <IconButton onClick={() => setOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}

            {/* Desktop collapse toggle */}
            {isMdUp && (
              <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <IconButton onClick={() => setCollapsed((v) => !v)}>
                  {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                </IconButton>
              </Tooltip>
            )}

            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <InsightsIcon color="primary" />
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  Tweet Sentiment Analytics
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>
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
          }}
        >
          {props.children}
        </Box>
      </Box>
    </Box>
  );
}
