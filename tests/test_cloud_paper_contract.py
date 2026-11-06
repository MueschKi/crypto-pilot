"""Cloud-paper contract safety tests; no server or real trading."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from cloud_paper_contract import PaperState, Fill, ContractError, apply_fill, halt


def fill(oid="one", seq=1, side="BUY", symbol="BTC", qty="1", price="100", fee="1"):
    return Fill(oid, seq, symbol, side, qty, price, fee)


class CloudPaperContractTests(unittest.TestCase):
    def test_buy_sell_and_replay(self):
        start = PaperState()
        bought = apply_fill(start, fill())
        self.assertEqual(str(bought.cash), "899")
        self.assertEqual(bought.sequence, 1)
        sold = apply_fill(bought, fill("two", 2, "SELL", price="110"))
        self.assertEqual(str(sold.cash), "1008")
        self.assertEqual(sold.positions, ())
        self.assertEqual(apply_fill(apply_fill(start, fill()), fill("two", 2, "SELL", price="110")), sold)

    def test_duplicate_and_out_of_order_are_rejected(self):
        state = apply_fill(PaperState(), fill())
        for event in (fill(), fill("two", 3), fill("two", 1)):
            with self.assertRaises(ContractError):
                apply_fill(state, event)

    def test_fail_closed_halt(self):
        state = halt(PaperState())
        with self.assertRaises(ContractError):
            apply_fill(state, fill())

    def test_reject_invalid_prices_fees_and_short(self):
        for event in (fill(price="NaN"), fill(qty="-1"), fill(price="0"), fill(fee="101"), fill(side="SELL")):
            with self.assertRaises(ContractError):
                apply_fill(PaperState(), event)

    def test_caps_and_no_short(self):
        state = apply_fill(PaperState(), fill())
        with self.assertRaises(ContractError):
            apply_fill(state, fill("two", 2, qty="1", price="100"))
        with self.assertRaises(ContractError):
            apply_fill(state, fill("two", 2, side="SELL", qty="2"))


if __name__ == "__main__":
    unittest.main()
