import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import Grid from "@mui/material/Grid";
import { PieChart, BarChart } from "@mui/x-charts";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import ImageIcon from "@mui/icons-material/Image";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

import ErrorBoundary from "./ui/ErrorBoundary";
import { exportRefToPng } from "./ui/exportPng";
import Papa from "papaparse";
import DashboardLayout from "./layout/DashboardLayout";
import type { NavKey } from "./layout/DashboardLayout";
import StatCard from "./ui/StatCard";
import CardHeader from "./ui/CardHeader";
import { api } from "./api";
import type { ExploreResponse, Meta, PredictResponse } from "./api";

function sentimentChipColor(
  s: string
): "default" | "success" | "warning" | "error" | "info" {
  const x = (s || "").toLowerCase();
  if (x.includes("pos")) return "success";
  if (x.includes("neg")) return "error";
  if (x.includes("neu")) return "info";
  return "default";
}

function ChartShell(props: {
  children: React.ReactNode;
  minWidth?: number;
  refEl?: React.RefObject<HTMLDivElement | null>;
}) {
  // A responsive wrapper that:
  // - fills width on mobile
  // - allows horizontal scroll if chart needs more room
  // - avoids overflow breaking layout
  return (
    <Box
      ref={props.refEl as any}
      sx={{
        width: "100%",
        bgcolor: "white",
        borderRadius: 2,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Box sx={{ minWidth: props.minWidth ?? 0 }}>{props.children}</Box>
    </Box>
  );
}

function GridShell(props: { children: React.ReactNode; height: number }) {
  // DataGrid wrapper that stays responsive and scrollable
  return (
    <Box
      sx={{
        width: "100%",
        height: props.height,
        overflow: "hidden",
        // Let the grid handle horizontal scroll without breaking page
        "& .MuiDataGrid-main": { overflow: "auto" },
      }}
    >
      {props.children}
    </Box>
  );
}

export default function App() {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  const chartH = isSmDown ? 240 : 320;
  const chartH2 = isSmDown ? 220 : 300;
  const tableH = isSmDown ? 380 : 520;

  const [active, setActive] = useState<NavKey>("single");
  const [meta, setMeta] = useState<Meta | null>(null);

  // Single
  const [text, setText] = useState("");
  const [pred, setPred] = useState<PredictResponse | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  // Explorer filters
  const [entity, setEntity] = useState("All");
  const [keyword, setKeyword] = useState("");
  const [sentiment, setSentiment] = useState("All");
  const [wcSentiment, setWcSentiment] = useState<
    "Negative" | "Neutral" | "Positive"
  >("Neutral");
  const [explore, setExplore] = useState<ExploreResponse | null>(null);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState("");

  // Batch
  const [batchPredRows, setBatchPredRows] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchFilename, setBatchFilename] = useState<string>("");

  // Refs for PNG export
  const distRef = useRef<HTMLDivElement | null>(null);
  const topEntitiesRef = useRef<HTMLDivElement | null>(null);
  const mixRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<HTMLDivElement | null>(null);
  const negRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.get("/meta").then((r) => setMeta(r.data));
  }, []);

  // ---------- Single Prediction ----------
  async function runPredict() {
    setPred(null);
    const t = text.trim();
    if (!t) return;
    setPredLoading(true);
    try {
      const r = await api.post("/predict", { text: t });
      setPred(r.data);
    } finally {
      setPredLoading(false);
    }
  }

  // ---------- Explorer ----------
  async function runExplore() {
    setExploreError(null);
    setExploreLoading(true);

    try {
      const r = await api.post("/explore", {
        entity,
        keyword,
        sentiment,
        wc_sentiment: wcSentiment,
        top_entities_n: 12,
        leaderboard_n: 50,
        sample_n: 200,
      });
      setExplore(r.data);
    } catch (e: any) {
      console.error(e);
      setExploreError(e?.message || "Failed to load explorer analytics.");
    } finally {
      setExploreLoading(false);
    }
  }

  function downloadFilteredSamplesCsv() {
    const csv = Papa.unparse(
      filteredSampleRows.map(({ id, ...rest }: any) => rest)
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_samples.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Batch ----------
  async function onBatchFile(file: File) {
    setBatchPredRows([]);
    setBatchFilename(file.name);
    setBatchLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: Papa.ParseResult<any>) => {
        const rows = (results.data as any[]).filter((r) => r && r.text);
        try {
          const texts = rows.map((r) => String(r.text));
          const r = await api.post("/batch_predict", { texts });
          const sentiments = r.data.sentiments as string[];

          const merged = rows.map((row, i) => ({
            id: i + 1,
            ...row,
            predicted_sentiment: sentiments[i],
          }));
          setBatchPredRows(merged);
        } finally {
          setBatchLoading(false);
        }
      },
      error: () => setBatchLoading(false),
    });
  }

  function downloadCSV() {
    const csv = Papa.unparse(batchPredRows.map(({ id, ...rest }) => rest));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tweet_sentiment_predictions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Derived analytics (Explorer) ----------
  const explorerDist = useMemo(() => {
    if (!explore) return [];
    return explore.distribution.map((d, i) => ({
      id: i,
      label: d.sentiment,
      value: d.count,
    }));
  }, [explore]);

  const exploreCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of explorerDist) m.set(String(d.label), Number(d.value));
    return {
      Negative: m.get("Negative") ?? 0,
      Neutral: m.get("Neutral") ?? 0,
      Positive: m.get("Positive") ?? 0,
    };
  }, [explorerDist]);

  const entityScores = useMemo(() => {
    if (!explore) return [];
    const map = new Map<string, { pos: number; neg: number; neu: number }>();

    for (const m of explore.mix) {
      if (!map.has(m.entity)) map.set(m.entity, { pos: 0, neg: 0, neu: 0 });
      const row = map.get(m.entity)!;
      if (m.sentiment === "Positive") row.pos = m.count;
      if (m.sentiment === "Negative") row.neg = m.count;
      if (m.sentiment === "Neutral") row.neu = m.count;
    }

    const out = Array.from(map.entries()).map(([entity, v]) => {
      const total = v.pos + v.neg + v.neu || 1;
      const score = (v.pos - v.neg) / total;
      return { entity, ...v, total, score };
    });

    out.sort((a, b) => b.total - a.total);
    return out;
  }, [explore]);

  const topPositiveEntities = useMemo(
    () =>
      entityScores
        .slice(0, 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [entityScores]
  );
  const topNegativeEntities = useMemo(
    () =>
      entityScores
        .slice(0, 20)
        .sort((a, b) => a.score - b.score)
        .slice(0, 8),
    [entityScores]
  );

  const topPosBar = useMemo(
    () => ({
      labels: topPositiveEntities.map((x) => x.entity),
      values: topPositiveEntities.map((x) => Math.round(x.score * 100)),
    }),
    [topPositiveEntities]
  );

  const topNegBar = useMemo(
    () => ({
      labels: topNegativeEntities.map((x) => x.entity),
      values: topNegativeEntities.map((x) => Math.round(x.score * 100)),
    }),
    [topNegativeEntities]
  );

  const topEntitiesBar = useMemo(() => {
    if (!explore) return { labels: [], values: [] as number[] };
    const labels = explore.leaderboard.slice(0, 10).map((x) => x.entity);
    const values = explore.leaderboard.slice(0, 10).map((x) => x.mentions);
    return { labels, values };
  }, [explore]);

  const explorerMix = useMemo(() => {
    if (!explore)
      return {
        x: [] as string[],
        neg: [] as number[],
        neu: [] as number[],
        pos: [] as number[],
      };

    const entities = Array.from(new Set(explore.mix.map((m) => m.entity)));
    const map = new Map<string, Record<string, number>>();
    entities.forEach((e) => map.set(e, { Negative: 0, Neutral: 0, Positive: 0 }));
    explore.mix.forEach((m) => (map.get(m.entity)![m.sentiment] = m.count));

    // On small screens, too many labels will smash. Keep top N if needed.
    const maxEntities = isSmDown ? 10 : entities.length;
    const x = entities.slice(0, maxEntities);

    return {
      x,
      neg: x.map((e) => map.get(e)!.Negative),
      neu: x.map((e) => map.get(e)!.Neutral),
      pos: x.map((e) => map.get(e)!.Positive),
    };
  }, [explore, isSmDown]);

  const sentimentIndex = useMemo(() => {
    if (!explore) return 0;
    const neg = exploreCounts.Negative;
    const neu = exploreCounts.Neutral;
    const pos = exploreCounts.Positive;
    const denom = neg + neu + pos || 1;
    return (pos - neg) / denom;
  }, [explore, exploreCounts]);

  const leaderboardRows = useMemo(() => {
    if (!explore) return [];
    return explore.leaderboard.map((r, i) => ({ id: i + 1, ...r }));
  }, [explore]);

  const sampleRows = useMemo(() => {
    if (!explore) return [];
    return explore.samples.map((r, i) => ({ id: i + 1, ...r }));
  }, [explore]);

  const filteredSampleRows = useMemo(() => {
    if (!sampleRows.length) return sampleRows;
    const q = localSearch.trim().toLowerCase();
    if (!q) return sampleRows;

    return sampleRows.filter((r: any) => {
      const t = String(r.text || "").toLowerCase();
      const e = String(r.entity || "").toLowerCase();
      const s = String(r.sentiment || "").toLowerCase();
      const id = String(r.tweet_id || "").toLowerCase();
      return t.includes(q) || e.includes(q) || s.includes(q) || id.includes(q);
    });
  }, [sampleRows, localSearch]);

  const filteredLeaderboardRows = useMemo(() => {
    if (!leaderboardRows.length) return leaderboardRows;
    const q = localSearch.trim().toLowerCase();
    if (!q) return leaderboardRows;
    return leaderboardRows.filter((r: any) =>
      String(r.entity || "").toLowerCase().includes(q)
    );
  }, [leaderboardRows, localSearch]);

  const batchDist = useMemo(() => {
    if (!batchPredRows.length) return [];
    const counts: Record<string, number> = {};
    for (const r of batchPredRows) {
      const k = r.predicted_sentiment;
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).map(([label, value], i) => ({
      id: i,
      label,
      value,
    }));
  }, [batchPredRows]);

  const batchPercents = useMemo(() => {
    const total = batchPredRows.length || 0;
    if (total <= 1) return [];
    return batchDist
      .map((d) => ({
        label: String(d.label),
        value: Number(d.value),
        pct: (Number(d.value) / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [batchDist, batchPredRows.length]);

  // ---------- Columns ----------
  const leaderboardCols: GridColDef[] = useMemo(
    () => [
      { field: "entity", headerName: "Entity", flex: 1, minWidth: 180 },
      { field: "mentions", headerName: "Mentions", width: 120 },
    ],
    []
  );

  const sampleCols: GridColDef[] = useMemo(
    () => [
      { field: "tweet_id", headerName: "Tweet ID", width: 120 },
      { field: "entity", headerName: "Entity", width: 140 },
      { field: "sentiment", headerName: "Sentiment", width: 120 },
      { field: "text", headerName: "Text", flex: 1, minWidth: 320 },
    ],
    []
  );

  const batchCols: GridColDef[] = useMemo(() => {
    if (!batchPredRows.length) return [];
    return Object.keys(batchPredRows[0])
      .filter((k) => k !== "id")
      .slice(0, 8)
      .map((k) => ({
        field: k,
        headerName: k,
        flex: k === "text" ? 1 : 0.6,
        minWidth: k === "text" ? 360 : 140,
      }));
  }, [batchPredRows]);

  const topbarRight = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Chip
        size="small"
        variant="outlined"
        label={meta ? `Entities: ${meta.entities.length}` : "Loading…"}
      />
      <Chip size="small" label="Light UI" variant="outlined" />
    </Stack>
  );

  return (
    <DashboardLayout active={active} setActive={setActive} right={topbarRight}>
      {!meta ? (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={22} />
            <Typography color="text.secondary">Loading metadata…</Typography>
          </Stack>
        </Paper>
      ) : (
        <>
          {/* ================= SINGLE ================= */}
          {active === "single" && (
            <Grid container spacing={2.2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ p: 2.6 }}>
                  <CardHeader
                    title="Single Tweet Prediction"
                    subtitle="Analyze one tweet (no percentages shown)"
                  />

                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    placeholder="Type or paste a tweet here…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    sx={{ mt: 1.5 }}
                  />

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ mt: 2 }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      onClick={runPredict}
                      disabled={!text.trim() || predLoading}
                      fullWidth
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      Analyze sentiment
                    </Button>

                    {predLoading && (
                      <Stack direction="row" justifyContent="center">
                        <CircularProgress size={22} />
                      </Stack>
                    )}
                  </Stack>

                  {pred && (
                    <Paper
                      variant="outlined"
                      sx={{
                        mt: 2.5,
                        p: 2.2,
                        bgcolor: "#F8FAFC",
                        borderRadius: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 900 }}>Prediction</Typography>
                        <Chip
                          label={pred.sentiment}
                          color={sentimentChipColor(pred.sentiment)}
                        />
                      </Stack>
                    </Paper>
                  )}
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 2.4 }}>
                  <CardHeader title="Tips" subtitle="Examples + what to try" />
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, bgcolor: "#F8FAFC", borderStyle: "dashed" }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      I love this product! <br />
                      This is okay, not bad. <br />
                      I hate how this works.
                    </Typography>
                  </Paper>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Model: TF-IDF + Logistic Regression (fast & explainable)
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* ================= EXPLORER ================= */}
          {active === "explorer" && (
            <ErrorBoundary>
              <Grid container spacing={2.2}>
                {/* Filters */}
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ p: 2.4 }}>
                    <CardHeader
                      title="Dataset Explorer"
                      subtitle="Analytics, KPIs, entity insights, and searchable rows"
                      right={
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ width: { xs: "100%", sm: "auto" } }}
                        >
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={downloadFilteredSamplesCsv}
                            disabled={!explore || filteredSampleRows.length === 0}
                            fullWidth
                            sx={{ width: { xs: "100%", sm: "auto" } }}
                          >
                            Export Samples CSV
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<FilterAltIcon />}
                            onClick={runExplore}
                            disabled={exploreLoading}
                            fullWidth
                            sx={{ width: { xs: "100%", sm: "auto" } }}
                          >
                            Apply
                          </Button>
                        </Stack>
                      }
                    />

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="Entity"
                          value={entity}
                          onChange={(e) => setEntity(e.target.value)}
                        >
                          <MenuItem value="All">All</MenuItem>
                          {meta.entities.map((e) => (
                            <MenuItem key={e} value={e}>
                              {e}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Keyword (server filter)"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="Sentiment"
                          value={sentiment}
                          onChange={(e) => setSentiment(e.target.value)}
                        >
                          {meta.sentiments.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="WordCloud"
                          value={wcSentiment}
                          onChange={(e) => setWcSentiment(e.target.value as any)}
                        >
                          <MenuItem value="Negative">Negative</MenuItem>
                          <MenuItem value="Neutral">Neutral</MenuItem>
                          <MenuItem value="Positive">Positive</MenuItem>
                        </TextField>
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Search (local)"
                          value={localSearch}
                          onChange={(e) => setLocalSearch(e.target.value)}
                        />
                      </Grid>
                    </Grid>

                    {exploreLoading && (
                      <Box sx={{ mt: 2 }}>
                        <LinearProgress />
                      </Box>
                    )}
                    {exploreError && (
                      <Box sx={{ mt: 2 }}>
                        <Alert severity="error">{exploreError}</Alert>
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {!explore && !exploreLoading && !exploreError && (
                  <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 2.4 }}>
                      <Alert severity="info">
                        Click <b>Apply</b> to load analytics.
                      </Alert>
                    </Paper>
                  </Grid>
                )}

                {explore && (
                  <>
                    {/* KPIs */}
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard
                        label="Rows (filtered)"
                        value={explore.total_rows.toLocaleString()}
                        hint="records in view"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard
                        label="Top entity"
                        value={explore.top_entity || "—"}
                        hint="most frequent topic"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard
                        label="Neutral count"
                        value={exploreCounts.Neutral.toLocaleString()}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard
                        label="Positive count"
                        value={exploreCounts.Positive.toLocaleString()}
                      />
                    </Grid>

                    {/* Charts row 1 */}
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Sentiment Distribution"
                          subtitle="Counts by class"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  distRef.current &&
                                  exportRefToPng(
                                    distRef.current,
                                    "sentiment_distribution.png"
                                  )
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ChartShell refEl={distRef} minWidth={isSmDown ? 360 : 0}>
                          {explorerDist.length ? (
                            <PieChart
                              height={chartH}
                              series={[{ data: explorerDist, innerRadius: isSmDown ? 56 : 78 }]}
                            />
                          ) : (
                            <Alert severity="info">No data.</Alert>
                          )}
                        </ChartShell>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Top Entities"
                          subtitle="Most mentioned"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  topEntitiesRef.current &&
                                  exportRefToPng(
                                    topEntitiesRef.current,
                                    "top_entities.png"
                                  )
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ChartShell refEl={topEntitiesRef} minWidth={isSmDown ? 620 : 0}>
                          {topEntitiesBar.labels.length ? (
                            <BarChart
                              height={chartH}
                              xAxis={[
                                {
                                  scaleType: "band",
                                  data: topEntitiesBar.labels,
                                  tickLabelStyle: { angle: isSmDown ? -45 : 0 },
                                },
                              ]}
                              series={[{ data: topEntitiesBar.values, label: "Mentions" }]}
                            />
                          ) : (
                            <Alert severity="info">No entities available.</Alert>
                          )}
                        </ChartShell>
                      </Paper>
                    </Grid>

                    {/* Charts row 2 */}
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Entity Sentiment Mix"
                          subtitle="Stacked breakdown"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  mixRef.current &&
                                  exportRefToPng(mixRef.current, "entity_sentiment_mix.png")
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ChartShell refEl={mixRef} minWidth={isSmDown ? 760 : 0}>
                          {explorerMix.x.length ? (
                            <BarChart
                              height={chartH}
                              xAxis={[
                                {
                                  scaleType: "band",
                                  data: explorerMix.x,
                                  tickLabelStyle: { angle: isSmDown ? -45 : 0 },
                                },
                              ]}
                              series={[
                                { label: "Negative", data: explorerMix.neg, stack: "a" },
                                { label: "Neutral", data: explorerMix.neu, stack: "a" },
                                { label: "Positive", data: explorerMix.pos, stack: "a" },
                              ]}
                            />
                          ) : (
                            <Alert severity="info">No mix data.</Alert>
                          )}
                        </ChartShell>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader title="WordCloud" subtitle={`From: ${wcSentiment}`} />
                        {explore.wordcloud_png_base64 ? (
                          <Box
                            sx={{
                              width: "100%",
                              overflow: "hidden",
                              borderRadius: 2,
                              border: "1px solid rgba(15,23,42,0.10)",
                              bgcolor: "white",
                            }}
                          >
                            <img
                              alt="wordcloud"
                              style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                              }}
                              src={`data:image/png;base64,${explore.wordcloud_png_base64}`}
                            />
                          </Box>
                        ) : (
                          <Alert severity="info">Not enough text to generate wordcloud.</Alert>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <CardHeader
                          title="Sentiment Index"
                          subtitle="(Positive − Negative) / Total"
                          right={<Chip label={sentimentIndex.toFixed(2)} />}
                        />
                        <LinearProgress
                          variant="determinate"
                          value={((sentimentIndex + 1) / 2) * 100}
                          sx={{ height: 14, borderRadius: 999, mt: 1 }}
                        />
                      </Paper>
                    </Grid>

                    {/* Positive/Negative charts */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Most Positive Entities"
                          subtitle="Score (×100)"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  posRef.current &&
                                  exportRefToPng(posRef.current, "most_positive_entities.png")
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ChartShell refEl={posRef} minWidth={isSmDown ? 620 : 0}>
                          {topPosBar.labels.length ? (
                            <BarChart
                              height={chartH2}
                              xAxis={[
                                {
                                  scaleType: "band",
                                  data: topPosBar.labels,
                                  tickLabelStyle: { angle: isSmDown ? -45 : 0 },
                                },
                              ]}
                              series={[{ data: topPosBar.values, label: "Score" }]}
                            />
                          ) : (
                            <Alert severity="info">Not enough entities.</Alert>
                          )}
                        </ChartShell>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Most Negative Entities"
                          subtitle="Score (×100)"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  negRef.current &&
                                  exportRefToPng(negRef.current, "most_negative_entities.png")
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ChartShell refEl={negRef} minWidth={isSmDown ? 620 : 0}>
                          {topNegBar.labels.length ? (
                            <BarChart
                              height={chartH2}
                              xAxis={[
                                {
                                  scaleType: "band",
                                  data: topNegBar.labels,
                                  tickLabelStyle: { angle: isSmDown ? -45 : 0 },
                                },
                              ]}
                              series={[{ data: topNegBar.values, label: "Score" }]}
                            />
                          ) : (
                            <Alert severity="info">Not enough entities.</Alert>
                          )}
                        </ChartShell>
                      </Paper>
                    </Grid>

                    {/* Tables */}
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader title="Leaderboard" subtitle="Top entities (mentions)" />
                        <GridShell height={tableH}>
                          <DataGrid
                            rows={filteredLeaderboardRows}
                            columns={leaderboardCols}
                            disableRowSelectionOnClick
                            pageSizeOptions={isSmDown ? [10, 20] : [10, 20, 50]}
                            initialState={{
                              pagination: { paginationModel: { pageSize: isSmDown ? 10 : 20, page: 0 } },
                            }}
                            density={isSmDown ? "compact" : "standard"}
                            slots={{ toolbar: isSmDown ? undefined : (GridToolbar as any) }}
                          />
                        </GridShell>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader title="Sample Rows" subtitle="Searchable preview" />
                        <GridShell height={tableH}>
                          <DataGrid
                            rows={filteredSampleRows}
                            columns={sampleCols}
                            disableRowSelectionOnClick
                            pageSizeOptions={isSmDown ? [10, 25] : [10, 25, 50, 100]}
                            initialState={{
                              pagination: { paginationModel: { pageSize: isSmDown ? 10 : 25, page: 0 } },
                            }}
                            density={isSmDown ? "compact" : "standard"}
                            slots={{ toolbar: isSmDown ? undefined : (GridToolbar as any) }}
                          />
                        </GridShell>
                      </Paper>
                    </Grid>
                  </>
                )}
              </Grid>
            </ErrorBoundary>
          )}

          {/* ================= BATCH ================= */}
          {active === "batch" && (
            <Grid container spacing={2.2}>
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2.4 }}>
                  <CardHeader
                    title="Batch CSV Prediction"
                    subtitle="Upload a CSV with column: text → download enriched CSV"
                  />

                  <Paper
                    variant="outlined"
                    sx={{ p: 2.2, borderStyle: "dashed", bgcolor: "white" }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      justifyContent="space-between"
                    >
                      <Stack>
                        <Typography sx={{ fontWeight: 900 }}>Upload CSV</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {batchFilename
                            ? `Selected: ${batchFilename}`
                            : "Choose a file to run batch predictions."}
                        </Typography>
                      </Stack>

                      <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        disabled={batchLoading}
                        fullWidth
                        sx={{ width: { xs: "100%", md: "auto" } }}
                      >
                        Select file
                        <input
                          hidden
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onBatchFile(f);
                          }}
                        />
                      </Button>
                    </Stack>

                    {batchLoading && (
                      <Box sx={{ mt: 2 }}>
                        <LinearProgress />
                      </Box>
                    )}
                  </Paper>
                </Paper>
              </Grid>

              {batchPredRows.length > 0 && (
                <>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2.4 }}>
                      <CardHeader
                        title="Distribution"
                        subtitle="Predicted sentiment breakdown"
                        right={<Chip label={`${batchPredRows.length} rows`} variant="outlined" />}
                      />

                      <ChartShell minWidth={isSmDown ? 360 : 0}>
                        <PieChart
                          height={chartH}
                          series={[{ data: batchDist, innerRadius: isSmDown ? 56 : 78 }]}
                        />
                      </ChartShell>

                      {batchPercents.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                          {batchPercents.map((x) => (
                            <Chip
                              key={x.label}
                              variant="outlined"
                              label={`${x.label}: ${x.pct.toFixed(1)}%`}
                            />
                          ))}
                        </Stack>
                      )}

                      <Button sx={{ mt: 1.5 }} fullWidth variant="outlined" onClick={downloadCSV}>
                        Download CSV
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 2.4 }}>
                      <CardHeader title="Preview" subtitle="First 200 rows" />
                      <GridShell height={tableH}>
                        <DataGrid
                          rows={batchPredRows.slice(0, 200)}
                          columns={batchCols}
                          disableRowSelectionOnClick
                          pageSizeOptions={isSmDown ? [10, 25] : [25, 50, 100]}
                          initialState={{
                            pagination: { paginationModel: { pageSize: isSmDown ? 10 : 25, page: 0 } },
                          }}
                          density={isSmDown ? "compact" : "standard"}
                        />
                      </GridShell>
                    </Paper>
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
