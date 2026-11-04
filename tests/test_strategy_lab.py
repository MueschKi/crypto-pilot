"""Offline executable checks for the on-demand Strategy Lab, using deterministic candles."""
import pathlib
import shutil
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class StrategyLabChecks(unittest.TestCase):
    def test_strategy_lab_ui_is_paper_only(self):
        html = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="./strategy-lab.js?v=20261104-lab39"', html)
        for control in ('runLab', 'labCoin', 'labInterval', 'labRows', 'labChart', 'labFolds'):
            self.assertIn('id="'+control+'"', html)
        self.assertIn('const completed=raw.slice(0,-1)', html)
        self.assertIn('CryptoPilotStrategyLab.compare({rows:completed,period:interval})', html)
        self.assertIn('labBusy=true', html)
        self.assertNotIn('/private/AddOrder', html)

    def test_executable_no_lookahead_fee_and_split(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node is required for executable strategy unit tests")
        script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={};vm.runInNewContext(fs.readFileSync('docs/strategy-lab.js','utf8'),ctx);
const L=ctx.CryptoPilotStrategyLab;
const start=1710000000;
const bars=Array.from({length:300},(_,i)=>{
 const open=100+i*.08,close=open+.025;
 return [start+i*3600,open,close+.03,open-.03,close,'0','1','0'];
});
const result=L.compare({rows:bars,period:60});
assert.equal(result.bars,300);
assert.equal(result.development.length,3);
assert.equal(result.holdout.length,3);
assert.equal(result.walkForward.length,3);
assert.equal(result.walkForward[0].windows.length,3);
assert.equal(result.holdoutStart,start+180*3600);
assert(result.holdout.every(x=>Number.isFinite(x.returnPct)));
assert(result.holdout.every(x=>x.drawdownPct<=0));
assert(result.holdout.every(x=>x.estimatedCosts>=0));
assert(result.holdout.every(x=>x.curve.length===120));
const one=L.simulate(L.candles(bars),'hold',180,300);
assert(one.buys===1&&one.sells===0);
assert(one.capital<1000*(bars.at(-1)[4]/bars[180][1]));
const untouched=L.simulate(L.candles(bars),'ema',180,240);
const modified=bars.map(r=>r.slice());modified[240][4]*=10;modified[240][2]=modified[240][4]+.03;
const again=L.simulate(L.candles(modified),'ema',180,240);
assert.equal(untouched.capital,again.capital,'future candle changed earlier results');
const invalid=bars.map(r=>r.slice());invalid[19][0]=invalid[18][0];
assert.throws(()=>L.compare({rows:invalid,period:60}));
const gaps=bars.map(r=>r.slice());gaps[25][0]+=10;
assert.throws(()=>L.compare({rows:gaps,period:60}));
assert.throws(()=>L.compare({rows:bars.slice(0,150),period:60}));
assert.throws(()=>L.compare({rows:bars,period:1}));
assert.throws(()=>L.strategySignal('unknown',[]));
"""
        result = subprocess.run([node, "-e", script], cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

if __name__ == "__main__":
    unittest.main()
