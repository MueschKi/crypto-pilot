"""Regression checks for the browser-local emergency stop."""
from pathlib import Path
import unittest

HTML = (Path(__file__).resolve().parents[1] / "docs" / "index.html").read_text(encoding="utf-8")


class EmergencyStopUI(unittest.TestCase):
    def test_manual_stop_is_visible_and_persistent(self):
        self.assertIn("Web v4.12 · Forschungsbasis v4.11", HTML)
        self.assertIn('id="paperEmergencyStop"', HTML)
        self.assertIn('$("paperEmergencyStop").addEventListener("click"', HTML)
        self.assertIn("S.sim.stopped=true;S.sim.armed=false;S.sim.active=false;releasePaperLease();", HTML)
        self.assertIn("const persisted=save();renderDepot();renderRuntimeStatus();", HTML)
        self.assertIn('S.sim.stopped?"NOT-AUS (Reset erforderlich)"', HTML)
        self.assertIn('S.sim.stopped?"Sicherheits-Not-Aus', HTML)

    def test_cloud_and_real_trading_remain_unavailable(self):
        self.assertIn("Cloud-Paper: nicht verbunden · Echtgeld: gesperrt", HTML)
        self.assertIn("Echtgeld-Orders sind nicht verfügbar.", HTML)


if __name__ == "__main__":
    unittest.main()
