"""Offline regression tests for chronological, cost-aware research."""
import sys
import unittest
from dataclasses import replace
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from bot import synthetic, Candle
from research import validate, _period


class EvidenceFirstTests(unittest.TestCase):
    def test_training_and_holdout_are_disjoint(self):
        result = validate(synthetic(260))
        self.assertLess(result["training"]["until_utc"],
                        result["holdout"]["from_utc"])
        self.assertEqual(result["training"]["strategy"]["observations"],
                         result["training"]["benchmark_40pct_buy_hold"]["observations"])
        self.assertEqual(result["holdout"]["strategy"]["observations"],
                         result["holdout"]["benchmark_40pct_buy_hold"]["observations"])

    def test_future_price_does_not_change_earlier_period(self):
        data = synthetic(260)
        before = _period(data, 49, 150)
        last = data[-1]
        data[-1] = replace(last, opening=50000, high=50001, low=49999, close=50000)
        self.assertEqual(before, _period(data, 49, 150))

    def test_fixed_rule_is_deterministic(self):
        self.assertEqual(validate(synthetic(260)), validate(synthetic(260)))

    def test_reject_gaps(self):
        data = synthetic(260)
        data[140] = replace(data[140], stamp=data[140].stamp + 1)
        with self.assertRaisesRegex(ValueError, "gap"):
            validate(data)

    def test_reject_short_history(self):
        with self.assertRaises(ValueError):
            validate(synthetic(80))

    def test_cannot_claim_validated_on_flat_market(self):
        values = []
        for i, bar in enumerate(synthetic(260)):
            values.append(Candle(bar.stamp,100,101,99,100,10))
        result = validate(values)
        self.assertNotEqual(result["status"], "DATA_VALIDATED_PRELIMINARY")


if __name__ == "__main__":
    unittest.main()
