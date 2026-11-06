import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from paper_ledger import replay_paper_ledger, PaperLedgerError


class PaperLedgerTests(unittest.TestCase):
    def test_replay_buy_sell_and_fees(self):
        events = [
            {"id": "a", "side": "BUY", "quantity": "2", "price": "100", "fee": "1"},
            {"id": "b", "side": "SELL", "quantity": "1", "price": "120", "fee": "0.6"},
        ]
        self.assertEqual(replay_paper_ledger(events),
                         {"cash_eur": "918.4", "quantity": "1",
                          "processed_orders": 2, "mode": "PAPER_ONLY"})

    def test_replay_is_deterministic(self):
        self.assertEqual(replay_paper_ledger([]), replay_paper_ledger([]))

    def test_duplicate_id_rejected(self):
        event = {"id": "same", "side": "BUY", "quantity": "1", "price": "100", "fee": "0"}
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([event, event])

    def test_insufficient_cash_and_caps(self):
        event = {"id": "a", "side": "BUY", "quantity": "5", "price": "100", "fee": "0"}
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([event])
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([dict(event, quantity="4", fee="1")], initial_cash="400")

    def test_no_short_or_unknown_side(self):
        event = {"id": "a", "side": "SELL", "quantity": "1", "price": "100", "fee": "0"}
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([event])
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([dict(event, side="LIVE_BUY")])

    def test_invalid_prices_and_floats(self):
        event = {"id": "a", "side": "BUY", "quantity": "1", "price": "NaN", "fee": "0"}
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([event])
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger([dict(event, price=100.0)])

    def test_position_limit(self):
        events = [
            {"id": "a", "side": "BUY", "quantity": "2", "price": "100", "fee": "0"},
            {"id": "b", "side": "BUY", "quantity": "3", "price": "100", "fee": "0"},
        ]
        with self.assertRaises(PaperLedgerError):
            replay_paper_ledger(events)


if __name__ == "__main__":
    unittest.main()
