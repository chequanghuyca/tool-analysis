from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd

from src.indicators.ta import add_indicators, macd, sma


def build_features(
    df_raw: pd.DataFrame,
    interval_params: Tuple[int, int, int, int, float, int] = (20, 50, 14, 20, 2.0, 14),
) -> pd.DataFrame:
    """Return a feature DataFrame aligned with close prices.

    interval_params: (ema_fast, ema_slow, rsi_period, bb_period, bb_std, atr_period)
    """
    ema_fast, ema_slow, rsi_period, bb_period, bb_std, atr_period = interval_params

    df = add_indicators(
        df_raw,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        rsi_period=rsi_period,
        bb_period=bb_period,
        bb_std=bb_std,
        atr_period=atr_period,
    ).copy()

    macd_line, macd_sig, macd_hist = macd(df["close"], 12, 26, 9)
    df["macd"] = macd_line
    df["macd_sig"] = macd_sig
    df["macd_hist"] = macd_hist

    # Momentum features
    df["ret_1"] = df["close"].pct_change(1)
    df["ret_5"] = df["close"].pct_change(5)
    df["ret_20"] = df["close"].pct_change(20)

    # EMA distance
    df["ema_dist"] = (df["ema_fast"] - df["ema_slow"]) / df["close"].replace(0, np.nan)
    df["price_ema_fast"] = (df["close"] - df["ema_fast"]) / df["close"].replace(0, np.nan)

    # Bollinger z-score
    df["bb_z"] = (df["close"] - df["bb_mid"]) / (df["bb_upper"] - df["bb_mid"]).replace(0, np.nan)

    # Volatility
    df["atr_p"] = df["atr"] / df["close"].replace(0, np.nan)
    df["roll_vol_20"] = df["ret_1"].rolling(20).std()

    # Normalize RSI to 0..1
    df["rsi_n"] = df["rsi"] / 100.0

    features = df[[
        "ret_1",
        "ret_5",
        "ret_20",
        "ema_dist",
        "price_ema_fast",
        "bb_z",
        "atr_p",
        "roll_vol_20",
        "rsi_n",
        "macd",
        "macd_sig",
        "macd_hist",
    ]].dropna().copy()

    return features


