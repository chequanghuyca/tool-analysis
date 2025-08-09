export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export type SymbolItem = { symbol: string; baseAsset: string; quoteAsset: string; status: string };
export type Signal = { action: "BUY" | "SELL" | "HOLD"; confidence: number; price: number | null };
export type BacktestStats = {
  trades: number;
  win_rate: number;
  total_return_pct: number;
  sharpe: number;
  max_drawdown_pct: number;
  profit_factor: number;
};

export type Kline = {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time: string;
};

export type AiSignal = {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  prob_up: number;
  horizon: number;
  threshold?: number;
  prob_buy?: number;
  prob_sell?: number;
  prob_hold?: number;
};

export async function fetchSymbols(search: string): Promise<SymbolItem[]> {
  const url = new URL(`${API_BASE}/symbols`);
  url.searchParams.set("quote", "USDT");
  if (search) url.searchParams.set("search", search);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch symbols");
  return res.json();
}

export async function fetchSignal(
  symbol: string,
  opts?: { interval?: string; limit?: number },
): Promise<Signal> {
  const url = new URL(`${API_BASE}/signal`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", opts?.interval ?? "1h");
  url.searchParams.set("limit", String(opts?.limit ?? 500));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch signal");
  return res.json();
}

export async function fetchBacktest(
  symbol: string,
  opts?: { interval?: string; limit?: number },
): Promise<BacktestStats> {
  const url = new URL(`${API_BASE}/backtest`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", opts?.interval ?? "1h");
  url.searchParams.set("limit", String(opts?.limit ?? 1000));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch backtest");
  return res.json();
}

export async function fetchKlines(
  symbol: string,
  opts?: { interval?: string; limit?: number },
): Promise<Kline[]> {
  const url = new URL(`${API_BASE}/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", opts?.interval ?? "1h");
  url.searchParams.set("limit", String(opts?.limit ?? 500));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch klines");
  const data = await res.json();
  return data.map((d: any) => ({
    ...d,
    open: Number(d.open),
    high: Number(d.high),
    low: Number(d.low),
    close: Number(d.close),
    volume: Number(d.volume),
  }));
}

export async function fetchAiSignal(
  symbol: string,
  opts?: { interval?: string; limit?: number; horizon?: number; threshold?: number },
): Promise<AiSignal> {
  const url = new URL(`${API_BASE}/ai/signal`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", opts?.interval ?? "1h");
  if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts?.horizon) url.searchParams.set("horizon", String(opts.horizon));
  if (opts?.threshold) url.searchParams.set("threshold", String(opts.threshold));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch ai signal");
  return res.json();
}
