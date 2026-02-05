from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Any, Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from wordcloud import WordCloud
import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "artifacts" / "models" / "prototype_logreg.joblib"
DATA_PATH = ROOT / "data" / "data_processed" / "prototype_dataset.csv"


# -----------------------------
# Load model + dataset once
# -----------------------------
model = joblib.load(MODEL_PATH)

df = pd.read_csv(DATA_PATH)
# Expected columns from your pipeline:
# tweet_id, entity, sentiment, text, clean_text
# If any are missing, you can adapt below.
for col in ["tweet_id", "entity", "sentiment", "text", "clean_text"]:
    if col not in df.columns:
        raise RuntimeError(f"Dataset missing required column: {col}")

df["entity"] = df["entity"].astype(str)
df["sentiment"] = df["sentiment"].astype(str)
df["text"] = df["text"].astype(str)
df["clean_text"] = df["clean_text"].astype(str)

ENTITIES = sorted(df["entity"].unique().tolist())
SENTIMENTS = ["Negative", "Neutral", "Positive"]


def has_predict_proba() -> bool:
    steps = getattr(model, "named_steps", {})
    clf = steps.get("clf")
    return hasattr(clf, "predict_proba") if clf is not None else False


def safe_predict_proba(texts: list[str]) -> tuple[list[str] | None, np.ndarray | None]:
    steps = getattr(model, "named_steps", {})
    clf = steps.get("clf")
    if clf is not None and hasattr(clf, "predict_proba"):
        probs = model.predict_proba(texts)
        classes = list(clf.classes_)
        return classes, probs
    return None, None


def apply_filters(
    entity: str | None,
    keyword: str | None,
    sentiment: str | None,
) -> pd.DataFrame:
    out = df

    if entity and entity != "All":
        out = out[out["entity"] == entity]

    if sentiment and sentiment != "All":
        out = out[out["sentiment"] == sentiment]

    if keyword and keyword.strip():
        k = keyword.strip().lower()
        mask = (
            out["entity"].str.lower().str.contains(k, na=False)
            | out["text"].str.lower().str.contains(k, na=False)
            | out["clean_text"].str.lower().str.contains(k, na=False)
        )
        out = out[mask]

    return out


def make_wordcloud_base64(text_blob: str) -> str | None:
    text_blob = (text_blob or "").strip()
    if not text_blob:
        return None

    wc = WordCloud(width=1200, height=520, background_color="white").generate(text_blob)

    fig = plt.figure(figsize=(12, 5))
    plt.imshow(wc.to_array(), interpolation="bilinear")
    plt.axis("off")

    buf = io.BytesIO()
    plt.tight_layout(pad=0)
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return encoded


# -----------------------------
# API models
# -----------------------------
class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1)

class PredictResponse(BaseModel):
    sentiment: str
    classes: list[str] | None = None
    probabilities: list[float] | None = None

class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1)

class BatchPredictResponse(BaseModel):
    sentiments: list[str]
    classes: list[str] | None = None
    probabilities: list[list[float]] | None = None

class ExploreRequest(BaseModel):
    entity: str = "All"
    keyword: str = ""
    sentiment: str = "All"
    wc_sentiment: Literal["Negative", "Neutral", "Positive"] = "Neutral"
    top_entities_n: int = 10
    leaderboard_n: int = 20
    sample_n: int = 50

class ExploreResponse(BaseModel):
    total_rows: int
    top_entity: str | None
    share_neutral: float
    share_positive: float
    distribution: list[dict[str, Any]]
    mix: list[dict[str, Any]]
    leaderboard: list[dict[str, Any]]
    samples: list[dict[str, Any]]
    wordcloud_png_base64: str | None


# -----------------------------
# FastAPI app
# -----------------------------
from fastapi.middleware.cors import CORSMiddleware
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}


@app.get("/meta")
def meta():
    return {
        "entities": ENTITIES,
        "sentiments": ["All"] + SENTIMENTS,
        "has_probabilities": has_predict_proba(),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    text = req.text.strip()
    pred = model.predict([text])[0]

    classes, probs = safe_predict_proba([text])
    if probs is None:
        return PredictResponse(sentiment=str(pred), classes=None, probabilities=None)

    return PredictResponse(
        sentiment=str(pred),
        classes=classes,
        probabilities=[float(x) for x in probs[0]],
    )


@app.post("/batch_predict", response_model=BatchPredictResponse)
def batch_predict(req: BatchPredictRequest):
    texts = [t.strip() for t in req.texts if str(t).strip()]
    preds = model.predict(texts)

    classes, probs = safe_predict_proba(texts)
    if probs is None:
        return BatchPredictResponse(sentiments=[str(x) for x in preds], classes=None, probabilities=None)

    return BatchPredictResponse(
        sentiments=[str(x) for x in preds],
        classes=classes,
        probabilities=[[float(v) for v in row] for row in probs],
    )


@app.post("/explore", response_model=ExploreResponse)
def explore(req: ExploreRequest):
    show = apply_filters(req.entity, req.keyword, req.sentiment)

    total = int(len(show))
    top_entity = str(show["entity"].value_counts().idxmax()) if total else None

    if total:
        dist = show["sentiment"].value_counts(normalize=True)
        share_neutral = float(dist.get("Neutral", 0.0))
        share_positive = float(dist.get("Positive", 0.0))
    else:
        share_neutral = 0.0
        share_positive = 0.0

    # Distribution counts
    dist_counts = (
        show["sentiment"].value_counts()
        .reindex(SENTIMENTS, fill_value=0)
        .reset_index()
    )
    dist_counts.columns = ["sentiment", "count"]
    distribution = dist_counts.to_dict(orient="records")

    # Sentiment mix by top entities
    top_entities = show["entity"].value_counts().head(req.top_entities_n).index.tolist()
    mix_df = (
        show[show["entity"].isin(top_entities)]
        .groupby(["entity", "sentiment"])
        .size()
        .reset_index(name="count")
    )
    mix = mix_df.to_dict(orient="records")

    # Leaderboard
    lb = (
        show["entity"].value_counts()
        .head(req.leaderboard_n)
        .reset_index()
    )
    lb.columns = ["entity", "mentions"]
    leaderboard = lb.to_dict(orient="records")

    # Samples
    cols = ["tweet_id", "entity", "sentiment", "text"]
    samples = show[cols].head(req.sample_n).to_dict(orient="records")

    # Wordcloud (from clean_text of chosen sentiment)
    subset = show[show["sentiment"] == req.wc_sentiment]
    blob = " ".join(subset["clean_text"].tolist()[:1500])
    wc_b64 = make_wordcloud_base64(blob)

    return ExploreResponse(
        total_rows=total,
        top_entity=top_entity,
        share_neutral=share_neutral,
        share_positive=share_positive,
        distribution=distribution,
        mix=mix,
        leaderboard=leaderboard,
        samples=samples,
        wordcloud_png_base64=wc_b64,
    )
