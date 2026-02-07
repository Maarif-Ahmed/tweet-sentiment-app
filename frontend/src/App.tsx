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

/* -------------------- helpers -------------------- */
function sentimentChipColor(
  s: string
): "default" | "success" | "warning" | "error" | "info" {
  const x = (s || "").toLowerCase();
  if (x.includes("pos")) return "success";
  if (x.includes("neg")) return "error";
  if (x.includes("neu")) return "info";
  return "default";
}

/** Prevent charts/images from forcing page width */
function ResponsiveSurface(props: {
  children: React.ReactNode;
  refEl?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Box
      ref={props.refEl as any}
      sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: 2,
        bgcolor: "white",
      }}
    >
      {props.children}
    </Box>
  );
}

/** Make DataGrid scroll internally (NOT the page) */
function ResponsiveGridBox(props: { height: number; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        width: "100%",
        height: props.height,
        overflow: "hidden",
        "& .MuiDataGrid-root": { width: "100%" },
        "& .MuiDataGrid-main": { overflowX: "auto" },
        "& .MuiDataGrid-virtualScroller": { overflowX: "auto" },
      }}
    >
      {props.children}
    </Box>
  );
}

export default function App() {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

  const chartH = isSmDown ? 260 : 320;
  const chartHSmall = isSmDown ? 240 : 300;
  const tableH = isSmDown ? 420 : 520;

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
  const confidenceData = useMemo(() => {
    if (!pred?.classes || !pred?.probabilities) return null;
    const rows = pred.classes.map((c, i) => ({
      label: c,
      value: pred.probabilities![i],
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [pred]);

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

  // Derived: entity positivity score (pos - neg)
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
      const positivity = v.pos / total; // 0..1
      const negativity = v.neg / total; // 0..1
      const score = (v.pos - v.neg) / total; // -1..1
      return { entity, ...v, total, positivity, negativity, score };
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
      values: topPositiveEntities.map((x) => Math.round(x.score * 100)), // -100..100
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

    return {
      x: entities,
      neg: entities.map((e) => map.get(e)!.Negative),
      neu: entities.map((e) => map.get(e)!.Neutral),
      pos: entities.map((e) => map.get(e)!.Positive),
    };
  }, [explore]);

  // Sentiment index: (-1 .. +1) derived from counts
  const sentimentIndex = useMemo(() => {
    if (!explore) return 0;
    const dist = new Map(explore.distribution.map((d) => [d.sentiment, d.count]));
    const neg = dist.get("Negative") ?? 0;
    const neu = dist.get("Neutral") ?? 0;
    const pos = dist.get("Positive") ?? 0;
    const denom = neg + neu + pos || 1;
    return (pos - neg) / denom; // -1..1
  }, [explore]);

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

  // ---------- Columns ----------
  const leaderboardCols: GridColDef[] = useMemo(
    () => [
      { field: "entity", headerName: "Entity", flex: 1, minWidth: 160 },
      { field: "mentions", headerName: "Mentions", width: 120 },
    ],
    []
  );

  const sampleCols: GridColDef[] = useMemo(
    () => [
      { field: "tweet_id", headerName: "Tweet ID", width: 120 },
      { field: "entity", headerName: "Entity", width: 140 },
      { field: "sentiment", headerName: "Sentiment", width: 120 },
      {
        field: "text",
        headerName: "Text",
        flex: 1,
        minWidth: 220,
        renderCell: (params) => (
          <Box sx={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>
            {params.value}
          </Box>
        ),
      },
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
        minWidth: k === "text" ? 240 : 120,
        renderCell:
          k === "text"
            ? (params) => (
                <Box sx={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>
                  {params.value}
                </Box>
              )
            : undefined,
      }));
  }, [batchPredRows]);

  // ---------- Topbar right controls ----------
  const topbarRight = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: "hidden" }}>
      <Chip
        size="small"
        variant="outlined"
        label={meta ? `Entities: ${meta.entities.length}` : "Loading…"}
      />
      <Chip size="small" label="Responsive UI" variant="outlined" />
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
            <Grid container spacing={2.2} sx={{ overflowX: "hidden" }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ p: 2.6, overflowX: "hidden" }}>
                  <CardHeader
                    title="Single Tweet Prediction"
                    subtitle="Analyze one tweet (no percentages shown)"
                  />

                  <TextField
                    fullWidth
                    multiline
                    minRows={isSmDown ? 5 : 6}
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
                      fullWidth={isSmDown}
                    >
                      Analyze sentiment
                    </Button>

                    {predLoading && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={22} />
                        <Typography variant="body2" color="text.secondary">
                          Analyzing…
                        </Typography>
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
                        overflowX: "hidden",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mb: 1.5, flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>Prediction</Typography>
                        <Chip
                          label={pred.sentiment}
                          color={sentimentChipColor(pred.sentiment)}
                        />
                      </Stack>

                      {/* Single: show bars ONLY (no % text) */}
                      {confidenceData && (
                        <Stack spacing={1.4}>
                          {confidenceData.map((r) => (
                            <Box key={r.label}>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {r.label}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={r.value * 100}
                                sx={{ height: 10, borderRadius: 999 }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Paper>
                  )}
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 2.4, overflowX: "hidden" }}>
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
              <Grid container spacing={2.2} sx={{ overflowX: "hidden" }}>
                {/* Filters */}
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ p: 2.4, overflowX: "hidden" }}>
                    <CardHeader
                      title="Dataset Explorer"
                      subtitle="Analytics, KPIs, entity insights, and searchable rows"
                      right={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={downloadFilteredSamplesCsv}
                            disabled={!explore || filteredSampleRows.length === 0}
                            fullWidth={isSmDown}
                          >
                            Export Samples CSV
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<FilterAltIcon />}
                            onClick={runExplore}
                            disabled={exploreLoading}
                            fullWidth={isSmDown}
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
                          label="Keyword (server filter)"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                          placeholder="Filters server-side…"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                          select
                          fullWidth
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
                          label="Search (local)"
                          value={localSearch}
                          onChange={(e) => setLocalSearch(e.target.value)}
                          placeholder="Search tables instantly…"
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
                    {/* KPI cards */}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <StatCard
                        label="Rows (filtered)"
                        value={explore.total_rows.toLocaleString()}
                        hint="records in view"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <StatCard
                        label="Top entity"
                        value={explore.top_entity || "—"}
                        hint="most frequent topic"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <StatCard
                        label="Neutral share"
                        value={`${(explore.share_neutral * 100).toFixed(1)}%`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <StatCard
                        label="Positive share"
                        value={`${(explore.share_positive * 100).toFixed(1)}%`}
                      />
                    </Grid>

                    {/* Charts Row 1 */}
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
                        <ResponsiveSurface refEl={distRef}>
                          {explorerDist.length ? (
                            <PieChart
                              height={chartH}
                              series={[{ data: explorerDist, innerRadius: isSmDown ? 55 : 78 }]}
                            />
                          ) : (
                            <Alert severity="info">No data.</Alert>
                          )}
                        </ResponsiveSurface>
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
                        <ResponsiveSurface refEl={topEntitiesRef}>
                          {topEntitiesBar.labels.length ? (
                            <BarChart
                              height={chartH}
                              xAxis={[
                                {
                                  scaleType: "band",
                                  data: topEntitiesBar.labels,
                                },
                              ]}
                              series={[
                                { data: topEntitiesBar.values, label: "Mentions" },
                              ]}
                            />
                          ) : (
                            <Alert severity="info">
                              No entities available for this filter.
                            </Alert>
                          )}
                        </ResponsiveSurface>
                      </Paper>
                    </Grid>

                    {/* Charts Row 2 */}
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Entity Sentiment Mix"
                          subtitle="Stacked breakdown (top entities)"
                          right={
                            <Tooltip title="Export PNG">
                              <IconButton
                                onClick={() =>
                                  mixRef.current &&
                                  exportRefToPng(
                                    mixRef.current,
                                    "entity_sentiment_mix.png"
                                  )
                                }
                              >
                                <ImageIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        />
                        <ResponsiveSurface refEl={mixRef}>
                          {explorerMix.x.length ? (
                            <BarChart
                              height={chartH}
                              xAxis={[{ scaleType: "band", data: explorerMix.x }]}
                              series={[
                                { label: "Negative", data: explorerMix.neg, stack: "a" },
                                { label: "Neutral", data: explorerMix.neu, stack: "a" },
                                { label: "Positive", data: explorerMix.pos, stack: "a" },
                              ]}
                            />
                          ) : (
                            <Alert severity="info">No mix data.</Alert>
                          )}
                        </ResponsiveSurface>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2.4, overflowX: "hidden" }}>
                        <CardHeader title="WordCloud" subtitle={`From: ${wcSentiment}`} />
                        {explore.wordcloud_png_base64 ? (
                          <Box sx={{ width: "100%", overflow: "hidden" }}>
                            <img
                              alt="wordcloud"
                              style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                                borderRadius: 14,
                                border: "1px solid rgba(15,23,42,0.10)",
                                background: "white",
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

                    {/* Top positive / negative */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Most Positive Entities"
                          subtitle="Score: (pos−neg)/total"
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
                        <ResponsiveSurface refEl={posRef}>
                          {topPosBar.labels.length ? (
                            <BarChart
                              height={chartHSmall}
                              xAxis={[{ scaleType: "band", data: topPosBar.labels }]}
                              series={[{ data: topPosBar.values, label: "Score (×100)" }]}
                            />
                          ) : (
                            <Alert severity="info">Not enough entities.</Alert>
                          )}
                        </ResponsiveSurface>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Most Negative Entities"
                          subtitle="Score: (pos−neg)/total"
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
                        <ResponsiveSurface refEl={negRef}>
                          {topNegBar.labels.length ? (
                            <BarChart
                              height={chartHSmall}
                              xAxis={[{ scaleType: "band", data: topNegBar.labels }]}
                              series={[{ data: topNegBar.values, label: "Score (×100)" }]}
                            />
                          ) : (
                            <Alert severity="info">Not enough entities.</Alert>
                          )}
                        </ResponsiveSurface>
                      </Paper>
                    </Grid>

                    {/* Tables */}
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader title="Leaderboard" subtitle="Top entities (mentions)" />
                        <ResponsiveGridBox height={tableH}>
                          <DataGrid
                            rows={filteredLeaderboardRows}
                            columns={leaderboardCols}
                            disableRowSelectionOnClick
                            pageSizeOptions={[10, 20, 50]}
                            initialState={{
                              pagination: { paginationModel: { pageSize: 20, page: 0 } },
                            }}
                            density={isSmDown ? "compact" : "standard"}
                            slots={{ toolbar: GridToolbar as any }}
                          />
                        </ResponsiveGridBox>
                      </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2.4 }}>
                        <CardHeader
                          title="Sample Rows"
                          subtitle="Searchable preview (local search applies)"
                        />
                        <ResponsiveGridBox height={tableH}>
                          <DataGrid
                            rows={filteredSampleRows}
                            columns={sampleCols}
                            disableRowSelectionOnClick
                            pageSizeOptions={[10, 25, 50, 100]}
                            initialState={{
                              pagination: { paginationModel: { pageSize: 25, page: 0 } },
                            }}
                            density={isSmDown ? "compact" : "standard"}
                            slots={{ toolbar: GridToolbar as any }}
                          />
                        </ResponsiveGridBox>
                      </Paper>
                    </Grid>
                  </>
                )}
              </Grid>
            </ErrorBoundary>
          )}

          {/* ================= BATCH ================= */}
          {active === "batch" && (
            <Grid container spacing={2.2} sx={{ overflowX: "hidden" }}>
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2.4 }}>
                  <CardHeader
                    title="Batch CSV Prediction"
                    subtitle="Upload a CSV with column: text → download enriched CSV"
                  />

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.2,
                      borderStyle: "dashed",
                      bgcolor: "white",
                      overflowX: "hidden",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      justifyContent="space-between"
                    >
                      <Stack sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }}>Upload CSV</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
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
                        fullWidth={isSmDown}
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
                        right={
                          <Chip
                            label={`${batchPredRows.length} rows`}
                            variant="outlined"
                          />
                        }
                      />
                      <ResponsiveSurface>
                        <PieChart
                          height={chartH}
                          series={[{ data: batchDist, innerRadius: isSmDown ? 55 : 78 }]}
                        />
                      </ResponsiveSurface>

                      <Button
                        sx={{ mt: 1.5 }}
                        fullWidth
                        variant="outlined"
                        onClick={downloadCSV}
                      >
                        Download CSV
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 2.4 }}>
                      <CardHeader title="Preview" subtitle="First 200 rows" />
                      <ResponsiveGridBox height={tableH}>
                        <DataGrid
                          rows={batchPredRows.slice(0, 200)}
                          columns={batchCols}
                          disableRowSelectionOnClick
                          pageSizeOptions={[25, 50, 100]}
                          initialState={{
                            pagination: { paginationModel: { pageSize: 25, page: 0 } },
                          }}
                          density={isSmDown ? "compact" : "standard"}
                        />
                      </ResponsiveGridBox>
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
