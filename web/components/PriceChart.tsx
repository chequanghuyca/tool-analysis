"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { Kline } from "@/lib/api";

type Props = {
  data: Kline[];
  height?: number;
  resetKey?: string; // change when symbol/interval changes to refit once
};

export default function PriceChart({ data, height = 380, resetKey }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma7Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma25Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma99Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const userInteractedRef = useRef<boolean>(false);
  const updatingRef = useRef<boolean>(false);
  const hasFitOnceRef = useRef<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    time: number | null;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  const resizeToContainer = () => {
    if (!chartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    chartRef.current.resize(
      Math.max(320, Math.floor(rect.width)),
      Math.max(200, Math.floor(rect.height)),
    );
  };

  const computeSMA = (values: number[], period: number): (number | null)[] => {
    const out: (number | null)[] = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  };

  const timesRef = useRef<number[]>([]);
  const maValsRef = useRef<{
    ma7: (number | null)[];
    ma25: (number | null)[];
    ma99: (number | null)[];
  }>({
    ma7: [],
    ma25: [],
    ma99: [],
  });

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: "#0b0e11" }, textColor: "#e5e7eb" },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 6 },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    const line7 = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const line25 = chart.addLineSeries({
      color: "#e879f9",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const line99 = chart.addLineSeries({
      color: "#8b5cf6",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    ma7Ref.current = line7;
    ma25Ref.current = line25;
    ma99Ref.current = line99;
    const ts = chart.timeScale();
    const onRangeChange = () => {
      if (!updatingRef.current) userInteractedRef.current = true;
    };
    ts.subscribeVisibleTimeRangeChange(onRangeChange);
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.point || !param.time) {
        setHover(null);
        return;
      }
      const p = param.point;
      const sd: any = param.seriesData.get(series);
      if (!sd) {
        setHover(null);
        return;
      }
      setHover({
        x: p.x,
        y: p.y,
        time: typeof param.time === "number" ? (param.time as number) : null,
        open: sd.open,
        high: sd.high,
        low: sd.low,
        close: sd.close,
      });
    });
    resizeToContainer();
    const onWindowResize = () => resizeToContainer();
    window.addEventListener("resize", onWindowResize);

    return () => {
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      ma7Ref.current = null;
      ma25Ref.current = null;
      ma99Ref.current = null;
      userInteractedRef.current = false;
      hasFitOnceRef.current = false;
      window.removeEventListener("resize", onWindowResize);
    };
  }, [height]);

  // Apply height changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ height });
    }
  }, [height]);

  // Update data when changed
  useEffect(() => {
    if (!seriesRef.current) return;
    const candles = data.map((d) => ({
      time: (new Date(d.open_time).getTime() / 1000) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    updatingRef.current = true;
    seriesRef.current.setData(candles);
    // Compute and set MA lines
    const closes = data.map((d) => d.close);
    const times = data.map((d) => Math.floor(new Date(d.open_time).getTime() / 1000));
    timesRef.current = times;
    const ma7 = computeSMA(closes, 7);
    const ma25 = computeSMA(closes, 25);
    const ma99 = computeSMA(closes, 99);
    maValsRef.current = { ma7, ma25, ma99 };
    const toLine = (arr: (number | null)[]) =>
      times
        .map((t, i) => (arr[i] != null ? { time: t as Time, value: arr[i]! } : null))
        .filter(Boolean) as { time: Time; value: number }[];
    if (ma7Ref.current) ma7Ref.current.setData(toLine(ma7));
    if (ma25Ref.current) ma25Ref.current.setData(toLine(ma25));
    if (ma99Ref.current) ma99Ref.current.setData(toLine(ma99));
    updatingRef.current = false;
    if (!hasFitOnceRef.current) {
      chartRef.current?.timeScale().fitContent();
      hasFitOnceRef.current = true;
    } else if (!userInteractedRef.current) {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [data]);

  // Reset fitting when symbol/interval changes
  useEffect(() => {
    userInteractedRef.current = false;
    hasFitOnceRef.current = false;
    // ensure resize after mode switch
    setTimeout(resizeToContainer, 0);
  }, [resetKey]);

  // Update size after toggling fullscreen
  useEffect(() => {
    setTimeout(resizeToContainer, 0);
  }, [isFullscreen]);

  const wrapperStyle: React.CSSProperties = isFullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0b0e11",
        padding: 12,
      }
    : { position: "relative" };

  const containerStyle: React.CSSProperties = isFullscreen
    ? { width: "100%", height: "calc(100vh - 24px)" }
    : ({ width: "100%", height } as React.CSSProperties);

  const btnStyle: React.CSSProperties = {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    background: "rgba(0,0,0,0.4)",
    color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    zIndex: 10,
    backdropFilter: "blur(2px)",
  };

  const headerStyle: React.CSSProperties = {
    position: "absolute",
    left: 8,
    top: 8,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "6px 10px",
    color: "#e5e7eb",
    fontSize: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    zIndex: 11,
  };

  const labelStyle: React.CSSProperties = { color: "#9ca3af", marginRight: 4 };
  const valStyle: React.CSSProperties = { color: "#e5e7eb", marginRight: 8 };
  const upStyle: React.CSSProperties = { color: "#22c55e", marginRight: 8 };
  const downStyle: React.CSSProperties = { color: "#ef4444", marginRight: 8 };
  const indicatorStyle: React.CSSProperties = {
    position: "absolute",
    left: 8,
    top: 36,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "4px 8px",
    color: "#e5e7eb",
    fontSize: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
    zIndex: 11,
  };

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <button
        style={btnStyle}
        onClick={() => setIsFullscreen((s) => !s)}
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{isFullscreen ? "🗗" : "⛶"}</span>
      </button>
      {/* Header OHLC like Binance */}
      {(() => {
        const last = data.length ? data[data.length - 1] : null;
        const cndl = hover
          ? {
              timeMs: hover.time ? hover.time * 1000 : last ? Date.parse(last.open_time) : NaN,
              open: hover.open,
              high: hover.high,
              low: hover.low,
              close: hover.close,
            }
          : last
          ? {
              timeMs: Date.parse(last.open_time),
              open: last.open,
              high: last.high,
              low: last.low,
              close: last.close,
            }
          : null;
        if (!cndl || Number.isNaN(cndl.timeMs)) return null;
        const changePct = cndl.open !== 0 ? ((cndl.close - cndl.open) / cndl.open) * 100 : 0;
        const ampPct = cndl.open !== 0 ? ((cndl.high - cndl.low) / cndl.open) * 100 : 0;
        const changeStyle = changePct >= 0 ? upStyle : downStyle;
        // find MA values at hover or last index
        let idx = -1;
        if (hover && hover.time) idx = timesRef.current.indexOf(hover.time);
        else if (timesRef.current.length) idx = timesRef.current.length - 1;
        const ma7v = idx >= 0 ? maValsRef.current.ma7[idx] : null;
        const ma25v = idx >= 0 ? maValsRef.current.ma25[idx] : null;
        const ma99v = idx >= 0 ? maValsRef.current.ma99[idx] : null;
        return (
          <div style={headerStyle}>
            <span style={valStyle}>{new Date(cndl.timeMs).toLocaleString()}</span>
            <span style={labelStyle}>Open:</span>
            <span style={valStyle}>{cndl.open.toLocaleString()}</span>
            <span style={labelStyle}>High:</span>
            <span style={valStyle}>{cndl.high.toLocaleString()}</span>
            <span style={labelStyle}>Low:</span>
            <span style={valStyle}>{cndl.low.toLocaleString()}</span>
            <span style={labelStyle}>Close:</span>
            <span style={valStyle}>{cndl.close.toLocaleString()}</span>
            <span style={labelStyle}>CHANGE:</span>
            <span style={changeStyle}>{changePct.toFixed(2)}%</span>
            <span style={labelStyle}>AMPLITUDE:</span>
            <span style={valStyle}>{ampPct.toFixed(2)}%</span>
          </div>
        );
      })()}
      {(() => {
        // Render MA labels on a separate bar below the header
        let idx = -1;
        if (hover && hover.time) idx = timesRef.current.indexOf(hover.time);
        else if (timesRef.current.length) idx = timesRef.current.length - 1;
        const ma7v = idx >= 0 ? maValsRef.current.ma7[idx] : null;
        const ma25v = idx >= 0 ? maValsRef.current.ma25[idx] : null;
        const ma99v = idx >= 0 ? maValsRef.current.ma99[idx] : null;
        if (ma7v == null && ma25v == null && ma99v == null) return null;
        return (
          <div style={indicatorStyle}>
            <span style={labelStyle}>MA(7):</span>
            <span style={{ ...valStyle, color: "#f59e0b" }}>
              {ma7v != null ? ma7v.toFixed(2) : "-"}
            </span>
            <span style={labelStyle}>MA(25):</span>
            <span style={{ ...valStyle, color: "#e879f9" }}>
              {ma25v != null ? ma25v.toFixed(2) : "-"}
            </span>
            <span style={labelStyle}>MA(99):</span>
            <span style={{ ...valStyle, color: "#8b5cf6" }}>
              {ma99v != null ? ma99v.toFixed(2) : "-"}
            </span>
          </div>
        );
      })()}
      <div ref={containerRef} style={containerStyle} />
    </div>
  );
}
