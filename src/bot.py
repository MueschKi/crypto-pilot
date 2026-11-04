"""Read-only public-market CryptoPilot research. NO exchange accounts or orders."""
from __future__ import annotations
import argparse
import json
import math
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

INITIAL_EUR = 1000.0
FEE = 0.004
SLIPPAGE = 0.001
MAX_EXPOSURE = 0.40
FAST, SLOW = 20, 50

@dataclass(frozen=True)
class Candle:
    stamp: int
    opening: float
    high: float
    low: float
    close: float
    volume: float

def candle_from_row(row: list) -> Candle:
    if len(row) < 7:
        raise ValueError("Incomplete OHLC row")
    bar = Candle(int(row[0]), float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[6]))
    if not (all(math.isfinite(v) for v in (bar.opening, bar.high, bar.low, bar.close, bar.volume))
            and min(bar.opening, bar.high, bar.low, bar.close) > 0 and bar.volume >= 0
            and bar.low <= min(bar.opening, bar.close) <= max(bar.opening, bar.close) <= bar.high):
        raise ValueError("Invalid OHLC bar")
    return bar

def parse_kraken(payload: dict) -> list[Candle]:
    if not isinstance(payload, dict) or payload.get("error") != [] or not isinstance(payload.get("result"), dict):
        raise ValueError("Kraken response rejected")
    result = payload["result"]
    keys = [key for key in result if key != "last"]
    if len(keys) != 1 or not isinstance(result[keys[0]], list):
        raise ValueError("Unexpected Kraken pair result")
    raw = result[keys[0]]
    if len(raw) < SLOW + 2:
        raise ValueError("Insufficient history")
    candles = [candle_from_row(row) for row in raw[:-1]]
    if any(b.stamp >= n.stamp for b, n in zip(candles, candles[1:])):
        raise ValueError("Unsorted or duplicate timestamps")
    return candles

def fetch_daily(pair: str) -> list[Candle]:
    if not isinstance(pair, str) or not pair or len(pair)>60 or not all(c.isalnum() or c in '._-' for c in pair):
        raise ValueError("Invalid public Kraken pair")
    params = urllib.parse.urlencode({"pair": pair, "interval": 1440})
    request = urllib.request.Request("https://api.kraken.com/0/public/OHLC?" + params,
                                     headers={"User-Agent": "CryptoPilot-research/0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError("Public market data unavailable")
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("Response too large")
    return parse_kraken(json.loads(data))

def sma(data: list[Candle], end: int, length: int) -> float:
    return sum(bar.close for bar in data[end - length + 1:end + 1]) / length

def signal(data: list[Candle], last_closed: int) -> bool:
    if last_closed < SLOW - 1:
        return False
    return sma(data, last_closed, FAST) > sma(data, last_closed, SLOW)

def backtest(data: list[Candle]) -> dict:
    """Individual long/cash replay: closed daily signal -> following day's open."""
    if len(data) < SLOW + 2:
        raise ValueError("Insufficient candles")
    if any(a.stamp >= b.stamp for a, b in zip(data, data[1:])):
        raise ValueError("Unsorted candles")
    cash, units, peak, drawdown, trades = INITIAL_EUR, 0.0, INITIAL_EUR, 0.0, 0
    curve = []
    for i in range(SLOW - 1, len(data) - 1):
        desired = signal(data, i)
        price = data[i + 1].opening
        equity = cash + units * price
        if desired and units == 0:
            spend = min(cash, MAX_EXPOSURE * equity)
            units = spend / (price * (1 + SLIPPAGE) * (1 + FEE))
            cash -= spend
            trades += 1
        elif not desired and units > 0:
            cash += units * price * (1 - SLIPPAGE) * (1 - FEE)
            units = 0
            trades += 1
        value = cash + units * data[i + 1].close
        peak = max(peak, value)
        drawdown = max(drawdown, 1 - value / peak)
        curve.append((data[i + 1].stamp, round(value, 5)))
    return {"initial_eur": INITIAL_EUR, "final_eur": round(curve[-1][1], 2),
            "return_pct": round((curve[-1][1] / INITIAL_EUR - 1) * 100, 2),
            "max_drawdown_pct": round(drawdown * 100, 2), "executions": trades,
            "first_fill_utc": datetime.fromtimestamp(curve[0][0], timezone.utc).strftime('%Y-%m-%d'),
            "last_fill_utc": datetime.fromtimestamp(curve[-1][0], timezone.utc).strftime('%Y-%m-%d'),
            "assumptions": {"fee_pct_per_side": FEE * 100, "slippage_pct_per_side": SLIPPAGE * 100,
                            "exposure_cap_pct": MAX_EXPOSURE * 100},
            "warning": "Historical simulation, no future performance guarantee."}

def synthetic(n: int = 150) -> list[Candle]:
    out = []
    for i in range(n):
        p = 100 + i * 0.14 + 3.5 * math.sin(i / 9)
        o = p - .1
        out.append(Candle(1_700_000_000 + i * 86400, o, max(o, p) + 1,
                          min(o, p) - 1, p, 100 + i))
    return out

def market_report(max_assets: int = 20) -> dict:
    """Today's top-20, with standalone per-asset backtests, NOT one portfolio."""
    from universe import discover
    snapshot = discover()
    for row in snapshot['universe'][:max_assets]:
        if row['status'] != 'eligible_for_research':
            continue
        try:
            candles = fetch_daily(row['kraken_pair'])
            result = backtest(candles)
            row['market_analysis'] = {
                'closed_candles': len(candles),
                'last_closed_utc': datetime.fromtimestamp(candles[-1].stamp,timezone.utc).isoformat(),
                'trend': 'SMA20_above_SMA50' if signal(candles,len(candles)-1) else 'no_buy_signal',
                'individual_historical_backtest': result,
            }
        except (ValueError, OSError, TimeoutError, json.JSONDecodeError) as exc:
            row['status'] = 'data_unavailable'
            row['error_class'] = type(exc).__name__
    snapshot['counts']['analyzed'] = sum('market_analysis' in x for x in snapshot['universe'])
    snapshot['counts']['not_analyzed'] = 20 - snapshot['counts']['analyzed']
    snapshot['limitations'] = [
        'Membership is determined today; historical backtests suffer survivorship/selection bias.',
        'Each coin backtest simulates a separate EUR 1000 account, NOT one portfolio.',
        'Stablecoins are shown but never used in directional trading simulations.',
        'Unavailable or unmapped markets remain visible; no substitution with rank 21+.',
        'No leverage, real orders, Kraken account, or guaranteed profit.',
    ]
    return snapshot

def main() -> None:
    parser = argparse.ArgumentParser(description='CryptoPilot public research only. Never places orders.')
    parser.add_argument('mode', choices=['demo','market'])
    args=parser.parse_args()
    if args.mode=='demo':
        result={'mode':'demo','pair':'synthetic','backtest':backtest(synthetic()),
                'note':'Only synthetic test data, not current market leaders'}
    else:
        result={'mode':'market','report':market_report()}
    print(json.dumps(result,indent=2,ensure_ascii=False))

if __name__ == '__main__':
    main()
