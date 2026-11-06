import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from paper_journal import append_paper_fill, load_paper_journal
from paper_ledger import PaperLedgerError


class PaperJournalTests(unittest.TestCase):
    def setUp(self):
        self.event = {"id": "fill-1", "side": "BUY", "quantity": "1",
                      "price": "100", "fee": "0.5"}

    def test_restart_replays_exactly(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "paper.json"
            result = append_paper_fill(path, self.event)
            self.assertEqual(result["cash_eur"], "899.5")
            self.assertEqual(load_paper_journal(path)["state"], result)

    def test_duplicate_id_does_not_modify_journal(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "paper.json"
            append_paper_fill(path, self.event)
            before = path.read_bytes()
            with self.assertRaises(PaperLedgerError):
                append_paper_fill(path, self.event)
            self.assertEqual(path.read_bytes(), before)

    def test_corruption_blocks_new_writes(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "paper.json"
            path.write_text("{bad")
            with self.assertRaises(PaperLedgerError):
                append_paper_fill(path, self.event)
            self.assertEqual(path.read_text(), "{bad")

    def test_invalid_order_never_creates_file(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "paper.json"
            with self.assertRaises(PaperLedgerError):
                append_paper_fill(path, dict(self.event, side="REAL_BUY"))
            self.assertFalse(path.exists())

    def test_recovery_from_valid_existing_journal(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "paper.json"
            path.write_text(json.dumps([self.event]))
            state = append_paper_fill(path, {"id": "fill-2", "side": "SELL",
                                            "quantity": "1", "price": "110", "fee": "0.5"})
            self.assertEqual(state["quantity"], "0")
            self.assertEqual(state["processed_orders"], 2)


if __name__ == "__main__":
    unittest.main()
