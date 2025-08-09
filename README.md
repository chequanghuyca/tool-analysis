## Crypto Market Analyzer (Python CLI)

Tool phân tích thị trường crypto, tính các chỉ báo kỹ thuật (EMA, RSI, MACD, Bollinger Bands, ATR), sinh tín hiệu mua/bán, và backtest nhanh. Nguồn dữ liệu mặc định từ Binance (không cần API key).

### Tính năng

- Lấy OHLCV từ Binance (klines) theo `symbol` và `interval`
- Chỉ báo: SMA, EMA, RSI (Wilder), MACD, Bollinger Bands, ATR
- Chiến lược mẫu: EMA crossover + bộ lọc RSI/Bollinger + quản trị rủi ro cơ bản
- Backtest vectorized, thống kê: tổng lợi nhuận, Sharpe, Max Drawdown, Win rate, Profit factor
- Gợi ý: BUY / SELL / HOLD với điểm tự tin (confidence)

### Cài đặt nhanh

```bash
cd /Volumes/SSD/tool-analysis
python3 -m venv .venv
source ./.venv/bin/activate
pip install -r requirements.txt
```

### Chạy ví dụ

```bash
python main.py --symbol BTCUSDT --interval 1h --limit 1000
```

Các tham số phổ biến:

- `--symbol`: cặp giao dịch Binance, ví dụ `BTCUSDT`, `ETHUSDT`
- `--interval`: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`
- `--limit`: số nến lấy (tối đa 1000 cho Binance public API)
- Tham số chiến lược (tuỳ chọn): `--ema-fast`, `--ema-slow`, `--rsi-period`, `--rsi-oversold`, `--rsi-overbought`, `--bb-period`, `--bb-std`, `--atr-period`, `--sl-atr`, `--tp-atr`, `--fee-bps`

Ví dụ tinh chỉnh chiến lược:

```bash
python main.py \
  --symbol ETHUSDT \
  --interval 4h \
  --limit 1500 \
  --ema-fast 20 --ema-slow 50 \
  --rsi-period 14 --rsi-oversold 35 --rsi-overbought 65 \
  --bb-period 20 --bb-std 2.0 \
  --atr-period 14 --sl-atr 2.0 --tp-atr 3.0 \
  --fee-bps 10
```

### Lưu ý

- Đây là công cụ hỗ trợ phân tích, không phải lời khuyên đầu tư. Thị trường crypto rủi ro cao.
- Sử dụng chiến lược nhiều khung thời gian và xác nhận đa chỉ báo để tăng độ tin cậy.
- Có thể mở rộng thêm chiến lược, nguồn dữ liệu (CoinGecko…), và xuất báo cáo.

## Web + API (Giao diện tìm kiếm/view symbol)

### Chạy nhanh bằng script (đề xuất)

Các script tiện ích nằm trong `scripts/` giúp khởi động/dừng toàn bộ hệ thống.

```bash
# Khởi động toàn bộ (ưu tiên Bun; nếu Bun lỗi sẽ gợi ý Yarn/NPM)
/Volumes/SSD/tool-analysis/scripts/start_all.sh

# Ép dùng Yarn
PKG_MGR=yarn /Volumes/SSD/tool-analysis/scripts/start_all.sh

# Ép dùng npm
PKG_MGR=npm /Volumes/SSD/tool-analysis/scripts/start_all.sh

# Dừng toàn bộ (API + Web)
/Volumes/SSD/tool-analysis/scripts/stop_all.sh
```

Sau khi chạy thành công:

- API: `http://127.0.0.1:8000` (Swagger: `http://127.0.0.1:8000/docs`)
- Web: `http://localhost:3001`

Mặc định script sẽ tạo `web/.env.local` với `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000`.

### Chạy thủ công (tuỳ chọn)

1. Khởi động API (FastAPI + Uvicorn)

```bash
cd /Volumes/SSD/tool-analysis
source .venv/bin/activate
./.venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

2. Khởi động Web (Next.js + TS + SCSS)

- Bun (khuyến nghị):

```bash
cd /Volumes/SSD/tool-analysis/web
echo "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000" > .env.local
bun install
bun run dev -- -p 3001
```

- Nếu Bun gặp vấn đề, dùng Yarn:

```bash
cd /Volumes/SSD/tool-analysis/web
echo "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000" > .env.local
yarn install --frozen-lockfile || yarn install
yarn dev -- -p 3001
```

- Hoặc npm:

```bash
cd /Volumes/SSD/tool-analysis/web
echo "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000" > .env.local
npm install
npm run dev -- -p 3001
```

### Endpoint chính (API)

- `GET /health`: kiểm tra tình trạng
- `GET /symbols?quote=USDT&search=BTC`: danh sách symbol theo quote
- `GET /signal?symbol=BTCUSDT&interval=1h&limit=500`: tín hiệu BUY/SELL/HOLD
- `GET /backtest?symbol=BTCUSDT&interval=1h&limit=1000`: thống kê backtest

### Troubleshooting (thường gặp)

- Cổng bận (EADDRINUSE):

  - Dừng cổng: `lsof -tiTCP:3000,3001,8000 | xargs -r kill`
  - Đổi cổng Web: `bun run dev -- -p 3002`
  - Đổi cổng API: `./.venv/bin/uvicorn api:app --host 127.0.0.1 --port 8001 --reload` và đổi `NEXT_PUBLIC_API_BASE`

- Bun lỗi: chạy script với `PKG_MGR=yarn` hoặc `PKG_MGR=npm`, hoặc dùng hướng dẫn chạy thủ công ở trên.

- Python 3.7: đã ghim phiên bản dependency tương thích. Nếu có cảnh báo `lzma`, không ảnh hưởng trừ khi bạn nén lzma.
