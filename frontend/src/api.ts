import axios from "axios";

/* -------------------- API INSTANCE -------------------- */
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

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
