import argparse
from typing import Dict, Any

from rich.console import Console
from rich.table import Table

from src.data.binance import fetch_klines
from src.indicators.ta import add_indicators
from src.strategy.ema_rsi_bb import generate_signals
from src.backtest.engine import run_backtest


console = Console()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Crypto Market Analyzer CLI")
    parser.add_argument("--symbol", type=str, default="BTCUSDT")
    parser.add_argument("--interval", type=str, default="1h")
    parser.add_argument("--limit", type=int, default=1000)

    # Strategy params
    parser.add_argument("--ema-fast", dest="ema_fast", type=int, default=20)
    parser.add_argument("--ema-slow", dest="ema_slow", type=int, default=50)
    parser.add_argument("--rsi-period", dest="rsi_period", type=int, default=14)
    parser.add_argument("--rsi-oversold", dest="rsi_oversold", type=float, default=35.0)
    parser.add_argument("--rsi-overbought", dest="rsi_overbought", type=float, default=65.0)
    parser.add_argument("--bb-period", dest="bb_period", type=int, default=20)
    parser.add_argument("--bb-std", dest="bb_std", type=float, default=2.0)
    parser.add_argument("--atr-period", dest="atr_period", type=int, default=14)
    parser.add_argument("--sl-atr", dest="sl_atr", type=float, default=2.0)
    parser.add_argument("--tp-atr", dest="tp_atr", type=float, default=3.0)
    parser.add_argument("--fee-bps", dest="fee_bps", type=float, default=10.0, help="fee in basis points")
    return parser


def print_summary(stats: Dict[str, Any]) -> None:
    table = Table(title="Backtest Summary", show_lines=False)
    table.add_column("Metric")
    table.add_column("Value", justify="right")

    for key in [
        "trades",
        "win_rate",
        "total_return_pct",
        "sharpe",
        "max_drawdown_pct",
        "profit_factor",
    ]:
        value = stats.get(key, None)
        if value is None:
            continue
        if isinstance(value, float):
            if "pct" in key:
                table.add_row(key, f"{value:,.2f}%")
            else:
                table.add_row(key, f"{value:,.3f}")
        else:
            table.add_row(key, str(value))

    console.print(table)


def print_signal(signal: Dict[str, Any]) -> None:
    action = signal.get("action", "HOLD")
    confidence = signal.get("confidence", 0.0)
    price = signal.get("price", None)
    console.rule("Signal")
    console.print(f"Action: [bold]{action}[/bold] | Confidence: {confidence:.2f} | Price: {price}")


def main() -> None:
    args = build_arg_parser().parse_args()

    df = fetch_klines(symbol=args.symbol, interval=args.interval, limit=args.limit)
    if df.empty:
        console.print("No data returned. Check symbol/interval.", style="bold red")
        return

    df = add_indicators(
        df,
        ema_fast=args.ema_fast,
        ema_slow=args.ema_slow,
        rsi_period=args.rsi_period,
        bb_period=args.bb_period,
        bb_std=args.bb_std,
        atr_period=args.atr_period,
    )

    signal = generate_signals(
        df,
        ema_fast=args.ema_fast,
        ema_slow=args.ema_slow,
        rsi_period=args.rsi_period,
        rsi_oversold=args.rsi_oversold,
        rsi_overbought=args.rsi_overbought,
        bb_period=args.bb_period,
        bb_std=args.bb_std,
    )
    print_signal(signal)

    stats = run_backtest(
        df,
        fee_bps=args.fee_bps,
        atr_period=args.atr_period,
        sl_atr=args.sl_atr,
        tp_atr=args.tp_atr,
    )
    print_summary(stats)


if __name__ == "__main__":
    main()


