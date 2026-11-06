import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from candle_audit import audit_closed_candles, CandleAuditError
from snapshot_store import save_snapshot, load_snapshot


class SnapshotStoreTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = audit_closed_candles(
            [[0, 10, 12, 9, 11, 5], [60, 11, 13, 10, 12, 4]],
            market="BTC/EUR", interval_seconds=60, observed_at=120)

    def test_roundtrip_and_idempotent_save(self):
        with tempfile.TemporaryDirectory() as root:
            first = save_snapshot(root, self.snapshot)
            self.assertEqual(first, save_snapshot(root, self.snapshot))
            self.assertEqual(load_snapshot(first), self.snapshot)
            self.assertEqual(len(list(Path(root).iterdir())), 1)

    def test_tampered_price_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            path = save_snapshot(root, self.snapshot)
            modified = json.loads(path.read_text())
            modified["candles"][1][4] = 12.5
            path.write_text(json.dumps(modified))
            with self.assertRaises(CandleAuditError):
                load_snapshot(path)
            with self.assertRaises(CandleAuditError):
                save_snapshot(root, self.snapshot)

    def test_tampered_metadata_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            path = save_snapshot(root, self.snapshot)
            modified = json.loads(path.read_text())
            modified["count"] = 100
            path.write_text(json.dumps(modified))
            with self.assertRaises(CandleAuditError):
                load_snapshot(path)

    def test_open_candle_rejected_on_save(self):
        bad = dict(self.snapshot, observed_at=119)
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(CandleAuditError):
                save_snapshot(root, bad)


if __name__ == "__main__":
    unittest.main()
