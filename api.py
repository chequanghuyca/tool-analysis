from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from src.data.binance import fetch_symbols, fetch_klines
from src.indicators.ta import add_indicators
from src.strategy.ema_rsi_bb import generate_signals
from src.backtest.engine import run_backtest
import numpy as np
from src.ml.features import build_features
from src.ml.model import LogisticModel
from src.ml.labeling import triple_barrier_labels
from src.ml.model_lgbm import LGBMBaseline

app = FastAPI(title="Crypto Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/symbols")
def list_symbols(quote: str = "USDT", search: str = ""):
    return fetch_symbols(quote=quote, search=search)


@app.get("/klines")
def klines(symbol: str, interval: str = "1h", limit: int = 500):
    df = fetch_klines(symbol=symbol, interval=interval, limit=limit)
    return df.to_dict(orient="records")


@app.get("/signal")
def signal(
    symbol: str,
    interval: str = "1h",
    limit: int = 500,
    ema_fast: int = 20,
    ema_slow: int = 50,
    rsi_period: int = 14,
    rsi_oversold: float = 35.0,
    rsi_overbought: float = 65.0,
    bb_period: int = 20,
    bb_std: float = 2.0,
    atr_period: int = 14,
):
    df = fetch_klines(symbol=symbol, interval=interval, limit=limit)
    df = add_indicators(
        df,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        rsi_period=rsi_period,
        bb_period=bb_period,
        bb_std=bb_std,
        atr_period=atr_period,
    )
    sig = generate_signals(
        df,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        rsi_period=rsi_period,
        rsi_oversold=rsi_oversold,
        rsi_overbought=rsi_overbought,
        bb_period=bb_period,
        bb_std=bb_std,
    )
    return sig


@app.get("/backtest")
def backtest(
    symbol: str,
    interval: str = "1h",
    limit: int = 1000,
    ema_fast: int = 20,
    ema_slow: int = 50,
    rsi_period: int = 14,
    bb_period: int = 20,
    bb_std: float = 2.0,
    atr_period: int = 14,
    fee_bps: float = 10.0,
    sl_atr: float = 2.0,
    tp_atr: float = 3.0,
):
    df = fetch_klines(symbol=symbol, interval=interval, limit=limit)
    df = add_indicators(
        df,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        rsi_period=rsi_period,
        bb_period=bb_period,
        bb_std=bb_std,
        atr_period=atr_period,
    )
    stats = run_backtest(
        df,
        fee_bps=fee_bps,
        atr_period=atr_period,
        sl_atr=sl_atr,
        tp_atr=tp_atr,
    )
    return stats


# --- Simple AI signal (logistic regression baseline) ---
@app.get("/ai/signal")
def ai_signal(
    symbol: str,
    interval: str = "1h",
    limit: int = 1000,
    horizon: int = 5,
    threshold: float = 0.55,
):
    """Train a quick in-memory logistic model on recent history and infer next move.

    Label: 1 if future return over 'horizon' bars is positive, else 0.
    """
    df = fetch_klines(symbol=symbol, interval=interval, limit=limit)
    if df.empty:
        return {"action": "HOLD", "confidence": 0.0, "prob_up": 0.5}

    feats = build_features(df)
    # Align features to returns label
    close = df["close"].reindex(feats.index)
    future = close.shift(-horizon)
    y = (future / close - 1.0).fillna(0.0)
    y = (y > 0).astype(int).values

    # Avoid last horizon bars for training leakage
    cutoff = max(100, int(len(feats) * 0.8))
    X_train = feats.iloc[:cutoff]
    y_train = y[:cutoff]
    X_test = feats.iloc[cutoff:]

    if len(X_train) < 50 or len(X_test) == 0:
        return {"action": "HOLD", "confidence": 0.0, "prob_up": 0.5}

    # Sample weight: emphasize recent data
    sw = np.linspace(0.2, 1.0, num=len(X_train))
    model = LogisticModel.fit(X_train, y_train, lr=0.05, epochs=600, sample_weight=sw)
    proba_class = float(model.predict_proba(X_test.tail(1)).ravel()[0])

    # LGBM multiclass with triple-barrier labels (BUY=1, HOLD=0, SELL=-1 mapped to [2,1,0])
    tb = triple_barrier_labels(df.reindex(feats.index), horizon=horizon)
    tb = tb.iloc[:cutoff]
    if not tb.empty and tb.abs().sum() > 10:
        # map -1,0,1 -> 0,1,2
        y_tb = tb.replace({-1: 0, 0: 1, 1: 2}).astype(int).values
        lgbm = LGBMBaseline.fit(X_train, y_tb)
        probs_mc = lgbm.predict_proba(X_test.tail(1))  # shape (1,3)
        prob_sell, prob_hold, prob_buy = probs_mc[0]
    else:
        prob_buy = proba_class
        prob_sell = 1 - proba_class
        prob_hold = 0.0

    action = "HOLD"
    confidence = abs(proba_class - 0.5) * 2.0  # scale 0..1 around 0.5
    if prob_buy >= threshold and confidence >= 0.2:
        action = "BUY"
    elif prob_sell >= threshold and confidence >= 0.2:
        action = "SELL"

    return {
        "action": action,
        "confidence": round(confidence, 3),
        "prob_up": round(proba_class, 3),
        "prob_buy": round(float(prob_buy), 3),
        "prob_sell": round(float(prob_sell), 3),
        "prob_hold": round(float(prob_hold), 3),
        "horizon": horizon,
        "threshold": threshold,
    }


