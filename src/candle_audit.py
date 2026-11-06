"""Fail-closed audit of closed public OHLC candles; no trading or network access."""
import hashlib
import json
import math
from datetime import datetime, timezone


class CandleAuditError(ValueError):
    """Invalid, incomplete, or non-reproducible candle batch."""


def audit_closed_candles(rows, *, market, interval_seconds, observed_at, source="kraken-public-ohlc"):
    """Return a deterministic snapshot; reject gaps, duplicates and open candles.

    rows: chronological [unix_open_seconds, open, high, low, close, volume].
    observed_at: trusted UTC unix timestamp at which the batch was observed.
    The final candle must have closed strictly before or at observed_at.
    """
    if not isinstance(market, str) or not market or not market.isascii():
        raise CandleAuditError("invalid market")
    if source != "kraken-public-ohlc":
        raise CandleAuditError("unsupported source")
    if type(interval_seconds) is not int or interval_seconds <= 0:
        raise CandleAuditError("invalid interval")
    if type(observed_at) not in (int, float) or not math.isfinite(observed_at) or observed_at <= 0:
        raise CandleAuditError("invalid observation time")
    if not isinstance(rows, (list, tuple)) or not rows:
        raise CandleAuditError("empty candle batch")
    normalized = []
    previous = None
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) != 6:
            raise CandleAuditError("expected six candle fields")
        timestamp = row[0]
        if type(timestamp) is not int or timestamp < 0 or timestamp % interval_seconds:
            raise CandleAuditError("invalid candle timestamp")
        if previous is not None and timestamp - previous != interval_seconds:
            raise CandleAuditError("duplicate, reordered or missing candle")
        if timestamp + interval_seconds > observed_at:
            raise CandleAuditError("unclosed candle")
        values = []
        for value in row[1:]:
            if isinstance(value, bool):
                raise CandleAuditError("boolean price")
            try:
                number = float(value)
            except (TypeError, ValueError, OverflowError):
                raise CandleAuditError("invalid numeric field") from None
            if not math.isfinite(number):
                raise CandleAuditError("non-finite numeric field")
            values.append(number)
        op, hi, lo, close, volume = values
        if min(op, hi, lo, close) <= 0 or volume < 0 or hi < max(op, close, lo) or lo > min(op, close, hi):
            raise CandleAuditError("inconsistent OHLCV")
        normalized.append([timestamp, *values])
        previous = timestamp
    payload = {"schema": 1, "source": source, "market": market,
               "interval_seconds": interval_seconds, "candles": normalized}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return {"schema": 1, "source": source, "market": market,
            "interval_seconds": interval_seconds, "observed_at": observed_at,
            "observed_utc": datetime.fromtimestamp(observed_at, timezone.utc).isoformat(),
            "first_open": normalized[0][0], "last_close": normalized[-1][0] + interval_seconds,
            "count": len(normalized), "sha256": hashlib.sha256(canonical.encode()).hexdigest(),
            "candles": normalized}
