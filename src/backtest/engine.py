from __future__ import annotations

from typing import Dict, Any

import numpy as np
import pandas as pd


def _vectorized_strategy(df: pd.DataFrame) -> pd.Series:
    # Long when ema_fast > ema_slow and RSI not overbought
    long_cond = (df["ema_fast"] > df["ema_slow"]) & (df["rsi"] < 70)
    # Flat otherwise
    position = long_cond.astype(int)
    return position


def _compute_pnl(
    df: pd.DataFrame,
    position: pd.Series,
    fee_bps: float,
    atr_period: int,
    sl_atr: float,
    tp_atr: float,
) -> pd.Series:
    # Returns based on close-to-close
    ret = df["close"].pct_change().fillna(0.0)
    raw_pnl = position.shift(1).fillna(0) * ret

    # Fees when position changes
    pos_change = position.diff().abs().fillna(position.abs())
    fees = (fee_bps / 10000.0) * pos_change

    # ATR-based SL/TP approximation: cap daily returns when adverse/excessive
    # For simplicity, dampen pnl when move exceeds thresholds
    atr = df["atr"].replace(0, np.nan).fillna(method="ffill")
    atr_ret = atr / df["close"].shift(1)
    sl_cap = -sl_atr * atr_ret
    tp_cap = tp_atr * atr_ret
    capped = raw_pnl.clip(lower=sl_cap, upper=tp_cap).fillna(raw_pnl)

    net = capped - fees
    return net


def _stats_from_equity(equity_curve: pd.Series) -> Dict[str, Any]:
    returns = equity_curve.pct_change().fillna(0.0)
    total_return = equity_curve.iloc[-1] / equity_curve.iloc[0] - 1.0
    ann_factor = max(1, int(len(equity_curve) / 252))
    sharpe = 0.0
    if returns.std() > 0:
        sharpe = float((returns.mean() / returns.std()) * np.sqrt(252))

    cummax = equity_curve.cummax()
    drawdown = (equity_curve / cummax) - 1.0
    max_dd = float(drawdown.min())

    # Trades and win rate approximation
    # Count entries when position goes from 0 to 1
    # Here we infer from equity increments > 0 while in position
    wins = (returns > 0).sum()
    losses = (returns < 0).sum()
    trades = int((wins + losses))
    win_rate = float(wins / trades * 100.0) if trades > 0 else 0.0

    gross_profit = returns[returns > 0].sum()
    gross_loss = -returns[returns < 0].sum()
    profit_factor = float(gross_profit / gross_loss) if gross_loss > 0 else np.inf

    return {
        "trades": trades,
        "win_rate": win_rate,
        "total_return_pct": float(total_return * 100.0),
        "sharpe": sharpe,
        "max_drawdown_pct": float(max_dd * 100.0),
        "profit_factor": profit_factor,
    }


def run_backtest(
    df: pd.DataFrame,
    fee_bps: float,
    atr_period: int,
    sl_atr: float,
    tp_atr: float,
) -> Dict[str, Any]:
    data = df.dropna().copy()
    if data.empty:
        return {
            "trades": 0,
            "win_rate": 0.0,
            "total_return_pct": 0.0,
            "sharpe": 0.0,
            "max_drawdown_pct": 0.0,
            "profit_factor": 0.0,
        }

    position = _vectorized_strategy(data)
    pnl = _compute_pnl(data, position, fee_bps, atr_period, sl_atr, tp_atr)
    equity = (1.0 + pnl).cumprod()
    return _stats_from_equity(equity)


