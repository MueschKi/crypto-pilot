"""Local research snapshot store: atomic writes, hash verification, no orders."""
import hashlib
import json
import os
import tempfile
from pathlib import Path

from candle_audit import CandleAuditError


def _canonical(snapshot):
    payload = {key: snapshot[key] for key in
               ("schema", "source", "market", "interval_seconds", "candles")}
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def verify_snapshot(snapshot):
    if not isinstance(snapshot, dict):
        raise CandleAuditError("invalid snapshot")
    from candle_audit import audit_closed_candles
    try:
        validated = audit_closed_candles(
            snapshot["candles"], market=snapshot["market"],
            interval_seconds=snapshot["interval_seconds"],
            observed_at=snapshot["observed_at"], source=snapshot["source"])
        if snapshot["schema"] != 1 or snapshot["sha256"] != validated["sha256"]:
            raise CandleAuditError("snapshot checksum mismatch")
        for key in ("count", "first_open", "last_close", "observed_utc"):
            if snapshot[key] != validated[key]:
                raise CandleAuditError("snapshot metadata mismatch")
    except (KeyError, TypeError, OverflowError) as exc:
        raise CandleAuditError("invalid snapshot metadata") from exc
    return validated


def save_snapshot(directory, snapshot):
    """Atomically persist a verified immutable research record by content hash."""
    verified = verify_snapshot(snapshot)
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    target = root / (verified["sha256"] + ".json")
    if target.exists():
        if load_snapshot(target) != verified:
            raise CandleAuditError("existing snapshot differs")
        return target
    fd, temp_path = tempfile.mkstemp(prefix=".pending-", suffix=".json", dir=root)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(verified, stream, sort_keys=True, separators=(",", ":"), allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        # Never replace an existing snapshot; concurrent identical writes are harmless.
        try:
            os.link(temp_path, target)
        except FileExistsError:
            if load_snapshot(target) != verified:
                raise CandleAuditError("concurrent snapshot mismatch")
    finally:
        os.unlink(temp_path)
    return target


def load_snapshot(path):
    with open(path, "r", encoding="utf-8") as stream:
        return verify_snapshot(json.load(stream))
