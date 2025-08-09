from __future__ import annotations

from typing import Dict, Any

import numpy as np
import pandas as pd


def generate_signals(
    df: pd.DataFrame,
    ema_fast: int,
    ema_slow: int,
    rsi_period: int,
    rsi_oversold: float,
    rsi_overbought: float,
    bb_period: int,
    bb_std: float,
) -> Dict[str, Any]:
    data = df.dropna().copy()
    if data.empty:
        return {"action": "HOLD", "confidence": 0.0, "price": None}

    last = data.iloc[-1]

    ema_fast_val = last["ema_fast"]
    ema_slow_val = last["ema_slow"]
    rsi_val = last["rsi"]
    price = float(last["close"])
    bb_upper = last["bb_upper"]
    bb_lower = last["bb_lower"]

    cross_up = data["ema_fast"].iloc[-2] < data["ema_slow"].iloc[-2] and ema_fast_val > ema_slow_val
    cross_down = data["ema_fast"].iloc[-2] > data["ema_slow"].iloc[-2] and ema_fast_val < ema_slow_val

    buy_score = 0.0
    sell_score = 0.0

    if cross_up:
        buy_score += 0.6
    if cross_down:
        sell_score += 0.6

    if rsi_val <= rsi_oversold:
        buy_score += 0.25
    if rsi_val >= rsi_overbought:
        sell_score += 0.25

    if price <= bb_lower:
        buy_score += 0.15
    if price >= bb_upper:
        sell_score += 0.15

    if buy_score > sell_score and buy_score >= 0.5:
        return {"action": "BUY", "confidence": float(buy_score), "price": price}
    if sell_score > buy_score and sell_score >= 0.5:
        return {"action": "SELL", "confidence": float(sell_score), "price": price}
    return {"action": "HOLD", "confidence": float(max(buy_score, sell_score)), "price": price}


