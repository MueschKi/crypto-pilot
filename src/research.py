"""Reproducible, fixed-rule research. No AI judgement, no broker execution.

Training and holdout are disjoint in executed days; historical candles preceding the
holdout may be used solely to warm up its indicators. Both periods restart at EUR 1000.
A fixed 40% exposure buy-and-hold benchmark pays the same assumed entry costs.
No tuning is performed on the holdout period.
"""
from __future__ import annotations
from datetime import datetime, timezone
from math import sqrt
from bot import Candle, INITIAL_EUR, FAST, SLOW, FEE, SLIPPAGE, MAX_EXPOSURE, signal

ANNUAL_DAYS = 365
MIN_OUT_OF_SAMPLE = 40


def _scores(curve: list[float]) -> dict:
    if len(curve) < 2 or any(v <= 0 for v in curve):
        raise ValueError("Insufficient positive equity observations")
    returns = [b / a - 1 for a, b in zip(curve, curve[1:])]
    mean = sum(returns) / len(returns)
    var = sum((v - mean) ** 2 for v in returns) / len(returns)
    sharpe = mean / sqrt(var) * sqrt(ANNUAL_DAYS) if var > 0 else 0.0
    peak = curve[0]
    drawdown = 0.0
    for value in curve[1:]:
        peak = max(peak, value)
        drawdown = max(drawdown, 1 - value / peak)
    return {
        "final_eur": round(curve[-1], 2),
        "return_pct": round((curve[-1] / curve[0] - 1) * 100, 3),
        "max_drawdown_pct": round(drawdown * 100, 3),
        "sharpe_zero_cash_rate": round(sharpe, 3),
        "observations": len(curve),
    }


def _period(candles: list[Candle], start: int, end: int) -> dict:
    """Evaluate signals from close[start:end], fills at the NEXT open.

    start/end specify signal indices, end is exclusive. Last executable signal index
    is len(candles)-2. Holdout may inspect historical closes before start solely
    to compute moving averages. No period shares a portfolio state.
    """
    if start < SLOW - 1 or end > len(candles) - 1 or end <= start:
        raise ValueError("Invalid replay boundaries")
    cash, qty, executions = INITIAL_EUR, 0.0, 0
    benchmark_cash = INITIAL_EUR * (1 - MAX_EXPOSURE)
    first_open = candles[start + 1].opening
    benchmark_qty = (INITIAL_EUR * MAX_EXPOSURE) / (
        first_open * (1 + SLIPPAGE) * (1 + FEE))
    bot_curve = [INITIAL_EUR]
    benchmark_curve = [INITIAL_EUR]
    for i in range(start, end):
        next_bar = candles[i + 1]
        # The decision uses candle i and earlier; execution uses i+1 opening.
        wanted = signal(candles, i)
        px = next_bar.opening
        if wanted and not qty:
            stake = min(cash, MAX_EXPOSURE * (cash + qty * px))
            if stake > 0:
                qty = stake / (px * (1 + SLIPPAGE) * (1 + FEE))
                cash -= stake
                executions += 1
        elif not wanted and qty:
            cash += qty * px * (1 - SLIPPAGE) * (1 - FEE)
            qty = 0.0
            executions += 1
        bot_curve.append(cash + qty * next_bar.close)
        benchmark_curve.append(benchmark_cash + benchmark_qty * next_bar.close)
    return {"strategy": _scores(bot_curve),
            "benchmark_40pct_buy_hold": _scores(benchmark_curve),
            "executions": executions,
            "from_utc": datetime.fromtimestamp(candles[start + 1].stamp, timezone.utc).date().isoformat(),
            "until_utc": datetime.fromtimestamp(candles[end].stamp, timezone.utc).date().isoformat()}


def validate(candles: list[Candle], training_fraction: float = 0.7) -> dict:
    """Compare an unchanged SMA20/50 strategy to cost-adjusted buy-and-hold.

    Labels are strictly descriptive, not evidence of statistical significance.
    """
    if not 0.5 <= training_fraction <= 0.8:
        raise ValueError("Training fraction must stay between 0.5 and 0.8")
    if len(candles) < SLOW + 2 + MIN_OUT_OF_SAMPLE:
        raise ValueError("Not enough daily candles for a held-out evaluation")
    if any(a.stamp >= b.stamp for a, b in zip(candles, candles[1:])):
        raise ValueError("Non-monotonic timestamps")
    if any(b.stamp-a.stamp != 86400 for a,b in zip(candles,candles[1:])):
        raise ValueError("Daily candle gap or invalid daily cadence")
    split = max(SLOW + 5, int((len(candles) - 1) * training_fraction))
    if len(candles) - 1 - split < MIN_OUT_OF_SAMPLE:
        raise ValueError("Held-out sample is too short")
    train = _period(candles, SLOW - 1, split)
    holdout = _period(candles, split, len(candles) - 1)
    comparisons = [
        (train["strategy"]["return_pct"] > train["benchmark_40pct_buy_hold"]["return_pct"]),
        (train["strategy"]["sharpe_zero_cash_rate"] > train["benchmark_40pct_buy_hold"]["sharpe_zero_cash_rate"]),
        (holdout["strategy"]["return_pct"] > holdout["benchmark_40pct_buy_hold"]["return_pct"]),
        (holdout["strategy"]["sharpe_zero_cash_rate"] > holdout["benchmark_40pct_buy_hold"]["sharpe_zero_cash_rate"]),
    ]
    label = "DATA_VALIDATED_PRELIMINARY" if all(comparisons) else ("TRADE_OFF" if any(comparisons) else "NO_EDGE")
    return {
        "status": label, "training": train, "holdout": holdout,
        "split_rule": "chronological, 70pct default, no re-optimization",
        "strategy": "fixed SMA20 > SMA50, next-day-open execution",
        "benchmark": "40pct buy-and-hold + 60pct EUR, same entry costs",
        "warnings": [
            "Preliminary descriptive verdict, NOT proof of statistical significance.",
            "No correction for multiple testing, selection bias or delisted coins.",
            "Today's top-20 universe is NOT a historically point-in-time universe.",
            "Assumes next-bar opens are executable; does not model real order-book depth.",
            "Cash earns no interest; fees 0.4pct and slippage 0.1pct each side.",
            "No live orders, no guaranteed returns or autonomous model decisions.",
        ],
    }
