"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatsCard from "@/components/StatsCard";
import Skeleton from "@/components/Skeleton";
import PriceChart from "@/components/PriceChart";
import {
  fetchBacktest,
  fetchSignal,
  fetchKlines,
  fetchAiSignal,
  fetchAiAdvice,
  type BacktestStats,
  type Signal,
  type Kline,
  type AiSignal,
} from "@/lib/api";

export default function SymbolDetail({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol;
  const [signal, setSignal] = useState<Signal | null>(null);
  const [stats, setStats] = useState<BacktestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<string>("1h");
  const [limit, setLimit] = useState<number>(1000);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [ai, setAi] = useState<AiSignal | null>(null);
  const [chartHeight, setChartHeight] = useState<number>(380);
  const [adviceObj, setAdviceObj] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [sig, st, ks, aiResp, adv] = await Promise.all([
          fetchSignal(symbol, { interval, limit: 500 }),
          fetchBacktest(symbol, { interval, limit }),
          fetchKlines(symbol, { interval, limit: Math.min(500, limit) }),
          fetchAiSignal(symbol, { interval, limit, horizon: 5, threshold: 0.6 }),
          fetchAiAdvice(symbol, { interval, limit, htf_interval: "4h", horizon: 5 }),
        ]);
        setSignal(sig);
        setStats(st);
        setKlines(ks);
        setAi(aiResp);
        setAdviceObj(adv);
      } catch (e: any) {
        setError(e?.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol, interval, limit]);

  // Realtime price + kline updates via Binance WebSocket
  useEffect(() => {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data as string);
          const k = payload?.k;
          if (!k) return;
          const price = Number(k.c);
          if (!Number.isNaN(price)) setRealtimePrice(price);

          // Update current candle (and append if closed)
          setKlines((prev) => {
            if (!prev || prev.length === 0) return prev;
            const openMs = Number(k.t);
            const closeMs = Number(k.T);
            const isFinal = Boolean(k.x);
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const last = updated[lastIdx];
            const lastOpenMs = new Date(last.open_time).getTime();
            const newBar: Kline = {
              open_time: new Date(openMs).toISOString(),
              open: Number(k.o),
              high: Number(k.h),
              low: Number(k.l),
              close: Number(k.c),
              volume: Number(k.v),
              close_time: new Date(closeMs).toISOString(),
            };

            if (openMs === lastOpenMs) {
              updated[lastIdx] = newBar;
              return updated;
            }
            // If candle closed and it's a new one, append
            if (isFinal) {
              updated.push(newBar);
              // Respect limit cap to avoid unbounded growth
              if (updated.length > Math.max(500, limit)) updated.shift();
              return updated;
            }
            return prev;
          });
        } catch {}
      };
    } catch {}

    return () => {
      try {
        ws?.close();
      } catch {}
    };
  }, [symbol, interval, limit]);

  const advice = useMemo(() => {
    if (!signal || !stats) return "Chưa đủ dữ liệu.";
    const conf = signal.confidence ?? 0;
    const action = signal.action;
    const tr = stats.total_return_pct ?? 0;
    const pf = stats.profit_factor ?? 0;
    const dd = stats.max_drawdown_pct ?? 0;

    const bullets: string[] = [];

    // 1) Kết luận AI ưu tiên
    if (ai) {
      const pb = ai.prob_buy ?? ai.prob_up ?? 0;
      const ps = ai.prob_sell ?? 1 - (ai.prob_up ?? 0);
      const ph = ai.prob_hold ?? 0;
      const aiLine = `AI: ${ai.action} | BUY ${pb?.toFixed(2)} • SELL ${ps?.toFixed(
        2,
      )} • HOLD ${ph?.toFixed(2)} (horizon ${ai.horizon} nến, threshold ${ai.threshold ?? 0.55})`;
      bullets.push(aiLine);

      if (ai.action === "BUY" && pb >= 0.6) {
        bullets.push(
          "Đề xuất: Có thể MUA thử trọng số nhỏ và gia tăng khi giá xác nhận (break/close trên kháng cự).",
        );
      } else if (ai.action === "SELL" && ps >= 0.6) {
        bullets.push(
          "Đề xuất: Cân nhắc GIẢM vị thế/đứng ngoài, chỉ vào lại khi có tín hiệu đảo chiều rõ.",
        );
      } else if (ai.action === "HOLD" || Math.max(pb, ps) < 0.6) {
        bullets.push("Đề xuất: CHỜ THÊM – xác suất chưa đủ mạnh để hành động.");
      }
    }

    // 2) Chiến lược rule-based (đồng thuận hoặc xung đột với AI)
    if (action === "BUY") bullets.push("Chiến lược kỹ thuật ủng hộ MUA (EMA/RSI/BB).");
    if (action === "SELL") bullets.push("Chiến lược kỹ thuật cảnh báo BÁN/điều chỉnh.");
    if (action === "HOLD") bullets.push("Chiến lược kỹ thuật chưa rõ ràng → chờ.");

    if (ai && action !== ai.action) {
      bullets.push(
        "Lưu ý: AI và chiến lược ĐANG XUNG ĐỘT → nên giảm kích thước lệnh hoặc chờ xác nhận.",
      );
    }

    // 3) Bối cảnh hiệu suất/backtest
    bullets.push(
      `Backtest giai đoạn gần đây: tổng lợi nhuận ${tr.toFixed(2)}%, PF ${
        Number.isFinite(pf) ? pf.toFixed(2) : "∞"
      }, MaxDD ${dd.toFixed(2)}%.`,
    );
    bullets.push(`Ngưỡng tín hiệu kỹ thuật: Confidence ${conf.toFixed(2)} (≥ 0.5 coi là mạnh).`);

    // 4) Quản trị rủi ro & vận hành
    bullets.push("Quản trị rủi ro: SL/TP theo ATR; rủi ro < 1–2%/lệnh; tăng vị thế theo xác nhận.");
    bullets.push("Đa khung thời gian (HTF) để tránh nhiễu; tránh giờ tin tức lớn.");

    return bullets.map((b) => `• ${b}`).join("\n");
  }, [signal, stats, ai]);

  const explanations = useMemo(
    () => [
      { k: "AI Action", v: "Khuyến nghị tổng hợp từ mô hình AI (logistic + LGBM triple-barrier)." },
      { k: "AI Confidence", v: "Độ tự tin của logistic so với ngưỡng 0.5 (0..1)." },
      { k: "Prob Up", v: "Xác suất giá tăng theo logistic với horizon đã chọn." },
      {
        k: "Prob BUY/SELL/HOLD",
        v: "Xác suất phân lớp BUY/SELL/HOLD từ LGBM (nhãn triple-barrier).",
      },
      { k: "Horizon", v: "Số nến tương lai để đánh giá kết quả (tạo nhãn/ước lượng)." },
      { k: "Threshold", v: "Ngưỡng xác suất để biến thành hành động (ví dụ ≥0.6 → BUY/SELL)." },
      {
        k: "Action",
        v: "Khuyến nghị hiện tại từ chiến lược theo khung giờ đã chọn: BUY (mua), SELL (bán), HOLD (chờ).",
      },
      {
        k: "Confidence",
        v: "Mức tự tin của tín hiệu trong khoảng 0–1. Thường ≥ 0.5 được coi là đủ mạnh để cân nhắc hành động.",
      },
      {
        k: "Last Price",
        v: "Giá đóng cửa của nến mới nhất (khung giờ đang phân tích).",
      },
      { k: "Trades", v: "Số thanh lợi nhuận/lỗ dùng để ước lượng số giao dịch trong backtest." },
      { k: "Win Rate", v: "Tỷ lệ phần trăm số thanh có lợi nhuận dương." },
      {
        k: "Total Return",
        v: "Lợi nhuận tích lũy của đường vốn backtest trong giai đoạn dữ liệu đã chọn.",
      },
      {
        k: "Sharpe",
        v: "Chỉ số ổn định lợi nhuận (mean/std) thường hóa theo năm. Cao hơn thường tốt hơn.",
      },
      {
        k: "Max Drawdown",
        v: "Mức sụt giảm tối đa của đường vốn so với đỉnh trước đó (rủi ro). | giá trị âm",
      },
      {
        k: "Profit Factor",
        v: "Tổng lợi nhuận / tổng thua lỗ tuyệt đối. >1 là có lợi thế, >1.5–2 là tương đối ổn.",
      },
    ],
    [],
  );

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href='/' style={{ color: "#9ca3af", textDecoration: "none" }}>
          &larr; Back
        </Link>
      </div>
      <h2 style={{ marginTop: 0 }}>{symbol}</h2>

      {/* Price Chart */}
      {klines.length > 0 ? (
        <div className='stats__card' style={{ margin: "8px 0 16px" }}>
          <PriceChart data={klines} resetKey={`${symbol}-${interval}`} height={chartHeight} />
          <div className='fullscreen-hint'>
            Gợi ý: Dùng nút Fullscreen để xem toàn màn hình; trên mobile, xoay ngang để tối ưu hiển
            thị.
          </div>
        </div>
      ) : (
        <div className='stats__card' style={{ margin: "8px 0 16px" }}>
          <Skeleton height={chartHeight} />
        </div>
      )}

      {/* Controls */}
      <div className='controls'>
        <label className='controls__group'>
          <span className='controls__label'>Interval</span>
          <select
            className='controls__select'
            value={interval}
            onChange={(e) => setInterval(e.target.value)}>
            <option value='1m'>1m</option>
            <option value='5m'>5m</option>
            <option value='15m'>15m</option>
            <option value='1h'>1h</option>
            <option value='4h'>4h</option>
            <option value='1d'>1d</option>
          </select>
        </label>
        <label className='controls__group'>
          <span className='controls__label'>Limit</span>
          <select
            className='controls__select'
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={1500}>1500</option>
          </select>
        </label>
        <label className='controls__group'>
          <span className='controls__label'>Chart</span>
          <select
            className='controls__select'
            value={chartHeight}
            onChange={(e) => setChartHeight(Number(e.target.value))}>
            <option value={300}>300px</option>
            <option value={380}>380px</option>
            <option value={480}>480px</option>
            <option value={560}>560px</option>
            <option value={680}>680px</option>
          </select>
        </label>
      </div>
      {loading && (
        <div style={{ display: "grid", gap: 16 }}>
          <div className='stats'>
            <Skeleton height={60} />
          </div>
          <div className='stats'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={72} />
            ))}
          </div>
          <div className='stats__card'>
            <Skeleton height={120} />
          </div>
        </div>
      )}
      {error && <div style={{ color: "#ef4444" }}>{error}</div>}
      {!loading && !error && (
        <div style={{ display: "grid", gap: 16 }}>
          <div className='stats'>
            <StatsCard
              title='Action'
              value={signal?.action ?? "-"}
              hint='Khuyến nghị hiện tại từ chiến lược (BUY/SELL/HOLD).'
            />
            <StatsCard
              title='Confidence'
              value={(signal?.confidence ?? 0).toFixed(2)}
              hint='Mức tự tin 0–1. ≥0.5 thường coi là đủ mạnh.'
            />
            <StatsCard
              title='Last Price'
              value={
                realtimePrice != null
                  ? realtimePrice.toLocaleString()
                  : signal?.price
                  ? signal.price.toLocaleString()
                  : "-"
              }
              hint='Giá đóng cửa của nến hiện tại theo khung giờ đã chọn.'
            />
          </div>
          {ai && (
            <div className='stats'>
              <StatsCard
                title='AI Action'
                value={ai.action}
                hint='Khuyến nghị từ mô hình logistic baseline (học trên lịch sử gần nhất).'
              />
              <StatsCard
                title='AI Confidence'
                value={ai.confidence.toFixed(2)}
                hint='Độ lệch so với 0.5 (0..1).'
              />
              <StatsCard
                title='Prob Up'
                value={ai.prob_up.toFixed(3)}
                hint='Xác suất tăng từ logistic.'
              />
              <StatsCard
                title='Prob BUY'
                value={ai.prob_buy?.toFixed(3) ?? "-"}
                hint='Xác suất BUY từ LGBM (triple-barrier).'
              />
              <StatsCard
                title='Prob SELL'
                value={ai.prob_sell?.toFixed(3) ?? "-"}
                hint='Xác suất SELL từ LGBM (triple-barrier).'
              />
              <StatsCard
                title='Prob HOLD'
                value={ai.prob_hold?.toFixed(3) ?? "-"}
                hint='Xác suất HOLD từ LGBM (triple-barrier).'
              />
              <StatsCard
                title='Horizon'
                value={`${ai.horizon} bars`}
                hint='Số nến tương lai dùng để gán nhãn khi huấn luyện.'
              />
            </div>
          )}
          <div className='stats'>
            <StatsCard
              title='Trades'
              value={stats?.trades ?? "-"}
              hint='Số thanh có lời/lỗ được dùng để ước lượng số giao dịch.'
            />
            <StatsCard
              title='Win Rate'
              value={stats ? `${stats.win_rate.toFixed(2)}%` : "-"}
              hint='Tỷ lệ số thanh có lợi nhuận dương.'
            />
            <StatsCard
              title='Total Return'
              value={stats ? `${stats.total_return_pct.toFixed(2)}%` : "-"}
              hint='Hiệu suất tích lũy của backtest trên chuỗi dữ liệu.'
            />
            <StatsCard
              title='Sharpe'
              value={stats ? stats.sharpe.toFixed(3) : "-"}
              hint='Ổn định lợi nhuận (cao hơn tốt hơn).'
            />
            <StatsCard
              title='Max Drawdown'
              value={stats ? `${stats.max_drawdown_pct.toFixed(2)}%` : "-"}
              hint='Mức sụt giảm tối đa từ đỉnh (rủi ro).'
            />
            <StatsCard
              title='Profit Factor'
              value={
                stats
                  ? Number.isFinite(stats.profit_factor)
                    ? stats.profit_factor.toFixed(3)
                    : "∞"
                  : "-"
              }
              hint='Tổng lời / tổng lỗ tuyệt đối (>1 tốt).'
            />
          </div>

          {/* Advice */}
          <div className='stats__card' style={{ marginTop: 12 }}>
            <div className='stats__title'>Lời khuyên</div>
            <pre
              className='stats__value'
              style={{ lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
              {advice}
            </pre>
          </div>

          {adviceObj && (
            <div className='stats__card'>
              <div className='stats__title'>AI Plan</div>
              <div className='stats__value' style={{ lineHeight: 1.6 }}>
                <div>
                  <strong>Stance</strong>: {adviceObj.stance} • <strong>Conviction</strong>:{" "}
                  {adviceObj.conviction}% • <strong>Setup</strong>: {adviceObj.setup_type}
                </div>
                <div>
                  <strong>Entry</strong>:{" "}
                  {adviceObj.plan.entry_zone?.filter(Boolean).join(" – ") || "-"} •{" "}
                  <strong>Stop</strong>: {adviceObj.plan.stop ?? "-"} • <strong>Targets</strong>:{" "}
                  {adviceObj.plan.targets?.join(", ")}
                </div>
                <div>
                  <strong>HTF</strong>: {adviceObj.context.htf_trend} • <strong>Levels</strong>: S{" "}
                  {adviceObj.context.key_levels.support ?? "-"} / R{" "}
                  {adviceObj.context.key_levels.resistance ?? "-"}
                </div>
                <div>
                  <strong>Probs</strong>: BUY {adviceObj.probs.prob_buy} • SELL{" "}
                  {adviceObj.probs.prob_sell} • HOLD {adviceObj.probs.prob_hold}
                </div>
                {adviceObj.notes?.length ? (
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {adviceObj.notes.map((n: string, i: number) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* Explanations as bullet points */}
          <div className='stats__card'>
            <div className='stats__title'>Chú thích chỉ số</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {explanations.map((e) => (
                <li key={e.k} style={{ marginBottom: 6 }}>
                  <strong>{e.k}:</strong> {e.v}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
