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
        self.assertIn("keine echten order-endpunkte", self.html.lower())

    def test_no_private_order_api_and_no_credentials(self):
        banned = ("/private/AddOrder", "/private/Balance",
                  "api_key", "API_SECRET", "CLOUDFLARE_API_TOKEN")
        for needle in banned:
            self.assertNotIn(needle, self.html)

    def test_live_kraken_candles_and_paper_markers(self):
        self.assertIn('src="./market-chart.js"', self.html)
        self.assertIn('id="marketChart"', self.html)
        self.assertIn('CryptoPilotChart.tick(id,q.last,q.time)', self.html)
        self.assertIn('CryptoPilotChart.trades(S.sim.trades)', self.html)
        chart = (ROOT / "docs" / "market-chart.js").read_text(encoding="utf-8")
        self.assertIn("/0/public/OHLC?", chart)
        self.assertIn("interval:\"1\"", chart)
        self.assertIn("minute>last.t", chart)
        self.assertIn("trade.id!==state.selected", chart)
        self.assertNotIn("/private/AddOrder", chart)
        import shutil
        node = shutil.which("node")
        if node:
            result = subprocess.run([node,"--check",str(ROOT / "docs" / "market-chart.js")],
                                    capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_ticker_does_not_restart_on_live_updates(self):
        self.assertIn('for(const coin of S.coins)', self.html)
        self.assertIn('tickerKey', self.html)
        self.assertIn('refreshTicker()', self.html)
        self.assertIn('item.price.textContent=', self.html)
        self.assertIn('distance/250', self.html)
        self.assertNotIn('lastTickerRender', self.html)
        self.assertNotIn('ticker").innerHTML=items+items', self.html)

    def test_chart_coin_switching_preserves_valid_candles(self):
        chart = (ROOT / "docs" / "market-chart.js").read_text(encoding="utf-8")
        self.assertIn('activeController.abort()', chart)
        self.assertIn('state.cache.get(id)', chart)
        self.assertIn('for(let attempt=0;attempt<2;attempt++)', chart)
        self.assertIn('if(token!==state.token)return;', chart)
        self.assertIn('const visibleCount=w<500?44', chart)
        self.assertIn('raw.map(validate).filter(Boolean)', chart)

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
