from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd

from src.indicators.ta import atr


def compute_atr_percent(df: pd.DataFrame, period: int = 14) -> pd.Series:
    atr_val = atr(df["high"], df["low"], df["close"], period=period)
    atr_p = atr_val / df["close"].replace(0, np.nan)
    return atr_p


def triple_barrier_labels(
    df: pd.DataFrame,
    horizon: int = 5,
    upper_mult: float = 2.0,
    lower_mult: float = 2.0,
    atr_period: int = 14,
) -> pd.Series:
    """Simplified triple-barrier labeling.

    For each index i, set upper = close[i]*(1+upper_mult*atr_p[i]) and
    lower = close[i]*(1-lower_mult*atr_p[i]). Look ahead 'horizon' bars; label 1
    if upper is hit first, -1 if lower is hit first, otherwise 0 based on sign of
    return to the last bar.
    """
    if len(df) < horizon + 2:
        return pd.Series(index=df.index, dtype=float)

    atr_p = compute_atr_percent(df, period=atr_period).values
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values

    n = len(df)
    labels = np.zeros(n)

    for i in range(n - horizon - 1):
        up = close[i] * (1.0 + upper_mult * (atr_p[i] if not np.isnan(atr_p[i]) else 0.01))
        dn = close[i] * (1.0 - lower_mult * (atr_p[i] if not np.isnan(atr_p[i]) else 0.01))
        label = 0
        for j in range(1, horizon + 1):
            idx = i + j
            if idx >= n:
                break
            if high[idx] >= up:
                label = 1
                break
            if low[idx] <= dn:
                label = -1
                break
        if label == 0:
            ret = (close[min(i + horizon, n - 1)] / close[i]) - 1.0
            label = 1 if ret > 0 else (-1 if ret < 0 else 0)
        labels[i] = label

    return pd.Series(labels, index=df.index)


