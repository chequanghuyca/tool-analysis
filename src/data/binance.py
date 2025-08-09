from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any

import httpx
import pandas as pd


BINANCE_BASE = "https://api.binance.com"


def _normalize_interval(interval: str) -> str:
    m = interval.lower().strip()
    mapping = {
        "1m": "1m",
        "3m": "3m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "2h": "2h",
        "4h": "4h",
        "6h": "6h",
        "8h": "8h",
        "12h": "12h",
        "1d": "1d",
        "3d": "3d",
        "1w": "1w",
        "1M": "1M",
    }
    return mapping.get(m, "1h")


def fetch_klines(symbol: str, interval: str, limit: int = 1000) -> pd.DataFrame:
    url = f"{BINANCE_BASE}/api/v3/klines"
    params = {"symbol": symbol.upper(), "interval": _normalize_interval(interval), "limit": max(10, min(limit, 1000))}
    with httpx.Client(timeout=20.0, headers={"User-Agent": "crypto-analyzer/1.0"}) as client:
        r = client.get(url, params=params)
        r.raise_for_status()
        data: List[List[Any]] = r.json()

    cols = [
        "open_time_ms",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "close_time_ms",
        "quote_asset_volume",
        "number_of_trades",
        "taker_buy_base",
        "taker_buy_quote",
        "ignore",
    ]

    df = pd.DataFrame(data, columns=cols)
    df["open_time"] = pd.to_datetime(df["open_time_ms"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time_ms"], unit="ms", utc=True)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)
    df = df[["open_time", "open", "high", "low", "close", "volume", "close_time"]]
    return df


def fetch_symbols(quote: str = "USDT", search: str = "") -> List[Dict[str, Any]]:
    """Fetch spot symbols from Binance, filtered by quote asset and optional search substring.

    Returns minimal fields: symbol, baseAsset, quoteAsset, status.
    """
    url = f"{BINANCE_BASE}/api/v3/exchangeInfo"
    with httpx.Client(timeout=20.0, headers={"User-Agent": "crypto-analyzer/1.0"}) as client:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
    symbols = data.get("symbols", [])
    out: List[Dict[str, Any]] = []
    q = (quote or "").upper()
    s = (search or "").upper()
    for sym in symbols:
        if sym.get("quoteAsset") != q:
            continue
        if sym.get("status") != "TRADING":
            continue
        name = sym.get("symbol", "")
        if s and s not in name.upper() and s not in sym.get("baseAsset", "").upper():
            continue
        out.append(
            {
                "symbol": name,
                "baseAsset": sym.get("baseAsset"),
                "quoteAsset": sym.get("quoteAsset"),
                "status": sym.get("status"),
            }
        )
    # Sort by base asset alphabetically for stable UI
    out.sort(key=lambda x: (x.get("baseAsset") or "", x.get("symbol") or ""))
    return out


