import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from sqlite_paper_store import (acquire_lease, append_fill, paper_state, set_halt, PaperStoreError)
from paper_ledger import PaperLedgerError


class SQLitePaperStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "paper.sqlite"
        self.fill = {"id": "order-1", "side": "BUY", "quantity": "1",
                     "price": "100", "fee": "0.4"}

    def test_replay_and_idempotent_order(self):
        self.assertTrue(acquire_lease(self.path, "worker-a", now=100))
        first = append_fill(self.path, self.fill, owner="worker-a", now=101)
        second = append_fill(self.path, self.fill, owner="worker-a", now=102)
        self.assertEqual(first, second)
        self.assertEqual(paper_state(self.path)["fills"], 1)
        self.assertEqual(paper_state(self.path)["state"]["cash_eur"], "899.6")

    def test_lease_contention_and_expiry(self):
        self.assertTrue(acquire_lease(self.path, "a", now=100, ttl=10))
        self.assertFalse(acquire_lease(self.path, "b", now=105))
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, self.fill, owner="b", now=105)
        self.assertTrue(acquire_lease(self.path, "b", now=110))
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, self.fill, owner="a", now=111)
        append_fill(self.path, self.fill, owner="b", now=111)

    def test_halt_blocks_new_fills(self):
        acquire_lease(self.path, "a", now=100)
        set_halt(self.path, True)
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, self.fill, owner="a", now=101)
        self.assertEqual(paper_state(self.path)["fills"], 0)
        set_halt(self.path, False)
        append_fill(self.path, self.fill, owner="a", now=101)

    def test_conflicting_duplicate_rejected(self):
        acquire_lease(self.path, "a", now=100)
        append_fill(self.path, self.fill, owner="a", now=101)
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, dict(self.fill, price="110"), owner="a", now=102)
        self.assertEqual(paper_state(self.path)["fills"], 1)

    def test_risk_rejection_is_atomic(self):
        acquire_lease(self.path, "a", now=100)
        with self.assertRaises(PaperLedgerError):
            append_fill(self.path, dict(self.fill, quantity="100"), owner="a", now=101)
        self.assertEqual(paper_state(self.path)["fills"], 0)

    def test_no_lease_and_expired_lease(self):
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, self.fill, owner="a", now=100)
        acquire_lease(self.path, "a", now=100, ttl=1)
        with self.assertRaises(PaperStoreError):
            append_fill(self.path, self.fill, owner="a", now=101)


if __name__ == "__main__":
    unittest.main()
