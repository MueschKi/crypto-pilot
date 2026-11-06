"""Crash-resilient local paper journal; research prototype, not cloud execution."""
import json
import os
import tempfile
from pathlib import Path

from paper_ledger import replay_paper_ledger, PaperLedgerError


def _read_events(path):
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as stream:
            events = json.load(stream)
    except (ValueError, UnicodeError) as exc:
        raise PaperLedgerError("corrupt paper journal") from exc
    if not isinstance(events, list):
        raise PaperLedgerError("invalid paper journal")
    replay_paper_ledger(events)
    return events


def append_paper_fill(path, event):
    """Append an audited fill by atomic file replacement; duplicate IDs fail closed.

    Caller must ensure exclusive single-writer access. This is NOT a distributed
    transaction, lease or safe multi-worker cloud store.
    """
    path = Path(path)
    events = _read_events(path)
    candidate = events + [event]
    state = replay_paper_ledger(candidate)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".paper-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(candidate, stream, sort_keys=True, separators=(",", ":"), allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        # Sync parent directory on platforms supporting directory fsync.
        if hasattr(os, "O_DIRECTORY"):
            directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return state


def load_paper_journal(path):
    events = _read_events(Path(path))
    return {"events": events, "state": replay_paper_ledger(events)}
