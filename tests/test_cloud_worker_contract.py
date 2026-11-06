"""Cloudflare prototype safety checks without deployment credentials."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "cloud-paper/src/index.js"
CONFIG = ROOT / "cloud-paper/wrangler.toml"


class CloudWorkerContract(unittest.TestCase):
    def test_worker_is_paper_only(self):
        source = WORKER.read_text(encoding="utf-8")
        self.assertIn("async function identity(request, keys)", source)
        self.assertIn("const identityClaims = await identity(request, signingKeys)", source)
        self.assertIn('this.state.storage.transaction(async txn =>', source)
        self.assertIn('await txn.put("state",next)', source)
        self.assertIn('await txn.put("order:"+fill.id,{fill})', source)
        self.assertIn("if (state.halted)", source)
        self.assertIn("realTrading:false", source)
        self.assertNotIn("api.kraken.com/0/private", source)
        self.assertNotIn("AddOrder", source)
        self.assertIn("workers_dev = false", CONFIG.read_text(encoding="utf-8"))

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_javascript_syntax(self):
        result = subprocess.run(["node", "--check", str(WORKER)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
