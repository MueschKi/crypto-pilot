"""Offline structural checks of the browser-only research dashboard."""
import pathlib
import re
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class DashboardChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")

    def test_real_stream_not_fake_live_quotes(self):
        self.assertIn("wss://ws.kraken.com", self.html)
        self.assertIn("api.coingecko.com", self.html)
        self.assertIn("S.connection", self.html)
        self.assertIn("quoteFresh", self.html)
        self.assertIn("keine echten orders", self.html.lower())

    def test_no_private_order_api_and_no_credentials(self):
        banned = ("/private/AddOrder", "/private/Balance",
                  "api_key", "API_SECRET", "CLOUDFLARE_API_TOKEN")
        for needle in banned:
            self.assertNotIn(needle, self.html)

    def test_safe_default_for_autotrading(self):
        self.assertIn("active:false", self.html)
        self.assertIn("S.sim.active=false", self.html)
        self.assertIn("visibilitychange", self.html)

    def test_one_inline_script_is_valid_javascript(self):
        # Node is available on GitHub's hosted Ubuntu runners. Skip locally
        # only if Node is genuinely absent; the workflow runs node --check.
        match = re.findall(r"<script>(.*?)</script>", self.html, re.S)
        self.assertEqual(len(match), 1)
        with tempfile.TemporaryDirectory() as folder:
            target = pathlib.Path(folder) / "dashboard.js"
            target.write_text(match[0], encoding="utf-8")
            import shutil
            node = shutil.which("node")
            if node is None:
                self.skipTest("node not installed")
            result = subprocess.run([node, "--check", str(target)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
