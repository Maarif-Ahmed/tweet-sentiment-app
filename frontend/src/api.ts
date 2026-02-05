/* -------------------- API INSTANCE -------------------- */
import axios from "axios";

// Vercel: set VITE_API_BASE_URL to your Railway backend (no trailing slash preferred)
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
});

/* Optional: helpful error message in console if env var is missing in production */
if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api] VITE_API_BASE_URL is not set. Falling back to http://127.0.0.1:8000 (this will fail on Vercel)."
  );
}

/* -------------------- TYPES -------------------- */
export type Meta = {
  entities: string[];
  sentiments: string[];
  has_probabilities: boolean;
};

export type PredictResponse = {
  sentiment: string;
  classes: string[] | null;
  probabilities: number[] | null;
};

export type ExploreResponse = {
  total_rows: number;
  top_entity: string | null;
  share_neutral: number;
  share_positive: number;

  distribution: {
    sentiment: string;
    count: number;
  }[];

  mix: {
    entity: string;
    sentiment: string;
    count: number;
  }[];

  leaderboard: {
    entity: string;
    mentions: number;
  }[];

  samples: {
    tweet_id: any;
    entity: string;
    sentiment: string;
    text: string;
  }[];

  wordcloud_png_base64: string | null;
};
