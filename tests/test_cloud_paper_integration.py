"""Run the non-deployed Cloudflare Durable Object integration harness."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CloudPaperIntegration(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "node unavailable")
    def test_auth_replay_restart_and_halt(self):
        script = ROOT / "cloud-paper/tests/integration.mjs"
        result = subprocess.run(["node", str(script)], capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + "\n" + result.stderr)


if __name__ == "__main__":
    unittest.main()
