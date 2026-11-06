"""Single-host SQLite paper engine: durable fills, idempotency, leases, fail-closed limits.

Offline only. Not a distributed Cloudflare deployment and never places real orders.
"""
import json
import sqlite3
import time
from decimal import Decimal
from pathlib import Path

from paper_ledger import PaperLedgerError, replay_paper_ledger


class PaperStoreError(ValueError):
    pass


def _connect(path):
    connection = sqlite3.connect(str(path), timeout=10, isolation_level=None)
    connection.execute("PRAGMA busy_timeout=10000")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=FULL")
    connection.execute("CREATE TABLE IF NOT EXISTS fills (sequence INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS lease (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS controls (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
    return connection


def _journal(conn):
    return [json.loads(row[0]) for row in conn.execute("SELECT payload FROM fills ORDER BY sequence")]


def paper_state(path):
    with _connect(path) as conn:
        events = _journal(conn)
        return {"state": replay_paper_ledger(events), "fills": len(events),
                "halted": conn.execute("SELECT value FROM controls WHERE name='halt'").fetchone() == ("1",)}


def set_halt(path, halted=True):
    with _connect(path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("INSERT INTO controls(name,value) VALUES('halt',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value", ("1" if halted else "0",))
        conn.commit()


def acquire_lease(path, owner, now=None, ttl=30):
    if not isinstance(owner, str) or not owner or len(owner) > 128:
        raise PaperStoreError("invalid owner")
    if type(ttl) is not int or not 1 <= ttl <= 300:
        raise PaperStoreError("invalid lease duration")
    now = int(time.time()) if now is None else now
    if type(now) is not int or now < 0:
        raise PaperStoreError("invalid time")
    with _connect(path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT owner,expires_at FROM lease WHERE name='engine'").fetchone()
        if row and row[0] != owner and row[1] > now:
            conn.rollback()
            return False
        conn.execute("INSERT INTO lease(name,owner,expires_at) VALUES('engine',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at", (owner, now + ttl))
        conn.commit()
        return True


def append_fill(path, event, *, owner, now=None):
    """Atomically check lease, halt, replay/risk and unique order ID before commit.

    An identical order ID is a no-op, while a conflicting payload fails closed.
    Lease is required and checked inside the same SQLite write transaction.
    """
    now = int(time.time()) if now is None else now
    if type(now) is not int or now < 0:
        raise PaperStoreError("invalid time")
    if not isinstance(event, dict):
        raise PaperStoreError("invalid fill")
    with _connect(path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        lease = conn.execute("SELECT owner,expires_at FROM lease WHERE name='engine'").fetchone()
        if not lease or lease[0] != owner or lease[1] <= now:
            raise PaperStoreError("missing or expired lease")
        if conn.execute("SELECT value FROM controls WHERE name='halt'").fetchone() == ("1",):
            raise PaperStoreError("paper trading halted")
        if not isinstance(event.get("id"), str) or not event["id"]:
            raise PaperStoreError("invalid order ID")
        previous = conn.execute("SELECT payload FROM fills WHERE order_id=?", (event["id"],)).fetchone()
        if previous is not None:
            if json.loads(previous[0]) != event:
                raise PaperStoreError("conflicting duplicate order ID")
            return replay_paper_ledger(_journal(conn))
        events = _journal(conn)
        result = replay_paper_ledger(events + [event])
        conn.execute("INSERT INTO fills(order_id,payload) VALUES(?,?)",
                     (event["id"], json.dumps(event, sort_keys=True, separators=(",", ":"), allow_nan=False)))
        conn.commit()
        return result
