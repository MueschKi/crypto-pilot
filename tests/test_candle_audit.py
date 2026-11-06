import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from candle_audit import audit_closed_candles, CandleAuditError


class CandleAuditTests(unittest.TestCase):
    def setUp(self):
        self.rows = [[0, "10", "12", "9", "11", "5"],
                     [60, "11", "13", "10", "12", "4"]]

    def audit(self, rows=None, **kwargs):
        args = dict(market="BTC/EUR", interval_seconds=60, observed_at=120)
        args.update(kwargs)
        return audit_closed_candles(self.rows if rows is None else rows, **args)

    def test_deterministic_hash_and_source_time(self):
        a, b = self.audit(), self.audit()
        self.assertEqual(a["sha256"], b["sha256"])
        self.assertEqual(a["count"], 2)
        self.assertEqual(a["last_close"], 120)
        self.assertEqual(a["source"], "kraken-public-ohlc")

    def test_observation_time_not_part_of_market_data_hash(self):
        self.assertEqual(self.audit()["sha256"], self.audit(observed_at=180)["sha256"])

    def test_changed_price_changes_hash(self):
        rows = [list(r) for r in self.rows]
        rows[1][4] = "12.5"
        self.assertNotEqual(self.audit()["sha256"], self.audit(rows)["sha256"])

    def test_rejects_gaps_duplicates_and_reorder(self):
        for rows in ([self.rows[0], [180, 11, 13, 10, 12, 4]],
                     [self.rows[0], self.rows[0]], list(reversed(self.rows))):
            with self.subTest(rows=rows), self.assertRaises(CandleAuditError):
                self.audit(rows, observed_at=300)

    def test_rejects_open_candle(self):
        with self.assertRaisesRegex(CandleAuditError, "unclosed"):
            self.audit(observed_at=119)

    def test_rejects_bad_ohlcv(self):
        for bad in ([60, 11, 10, 9, 12, 4], [60, 11, 13, 10, 12, -1],
                    [60, 11, float("nan"), 10, 12, 4], [60, 0, 13, 10, 12, 4]):
            with self.subTest(bad=bad), self.assertRaises(CandleAuditError):
                self.audit([self.rows[0], bad])

    def test_rejects_unsupported_source_and_empty(self):
        with self.assertRaises(CandleAuditError):
            self.audit(source="unknown")
        with self.assertRaises(CandleAuditError):
            self.audit([])


if __name__ == "__main__":
    unittest.main()
