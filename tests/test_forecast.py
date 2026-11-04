"""Executable safeguards for a leakage-free observational forecast engine."""
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ForecastChecks(unittest.TestCase):
    def test_forecast_panel_is_research_only(self):
        html=(ROOT/"docs"/"index.html").read_text(encoding="utf-8")
        self.assertIn('src="./forecast-engine.js?v=20261104-forecast42"',html)
        self.assertIn('id="forecastSection"',html)
        for field in ("forecastCoin","forecastPeriod","runForecast","forecastMedian",
                      "forecastLow","forecastHigh","forecastBand","forecastScore",
                      "forecastJournal"):
            self.assertIn('id="'+field+'"',html)
        self.assertIn("const predicted=CryptoPilotForecast.forecast({rows:closed,period})",html)
        self.assertIn("const raw=body.result[keys[0]],closed=raw.slice(0,-1)",html)
        self.assertIn("CryptoPilotForecast.settle(record,closed)",html)
        self.assertIn('FORECAST_KEY="cryptopilot-v42-prediction-journal"',html)
        engine=(ROOT/"docs"/"forecast-engine.js").read_text(encoding="utf-8")
        self.assertNotIn("fetch(",engine)
        self.assertNotIn("WebSocket(",engine)
        self.assertNotIn("order(",engine)
        self.assertNotIn("/private/AddOrder",engine)

    def test_forecast_validation_and_subsequent_realized_evaluation(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node is required to run the actual browser forecast algorithm")
        js=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={};vm.runInNewContext(fs.readFileSync('docs/forecast-engine.js','utf8'),ctx);
const F=ctx.CryptoPilotForecast;
const stamp=1720000000;
const rows=Array.from({length:500},(_,i)=>{
 const base=100+2*Math.sin(i/19)+.012*i;
 const next=100+2*Math.sin((i+1)/19)+.012*(i+1);
 const hi=Math.max(base,next)+.08,lo=Math.min(base,next)-.08;
 return [stamp+i*3600,base,hi,lo,next,'0','1'];
});
const p=F.forecast({rows:rows.slice(0,440),period:60});
assert.equal(p.at,rows[439][0]);
assert.equal(p.until,p.at+6*3600);
assert(p.samples>=18&&p.samples<=30);
assert(Number.isFinite(p.expectedReturnPct));
assert(p.closeBand[0]<=p.closeBand[1]);
assert(p.lowScenario<=p.highScenario);
assert(p.costPct>.9&&p.costPct<1.1);
assert(p.checked.count>=8);
assert(Number.isFinite(p.checked.maePct));
assert(Number.isFinite(p.checked.baselineMaePct));
assert.equal(p.checked.validated,false,"Retrospective performance is not prospective validation");
const record={...p,coin:"bitcoin",pair:"XXBTZEUR"};
assert.equal(F.settle(record,rows.slice(0,444)),null,"Must not score incomplete future");
const actual=F.settle(record,rows.slice(0,450));
assert(actual&&actual.actual>0);
assert.equal(actual.actual,rows[445][4]);
assert(actual.actualHigh>=actual.actualLow);
assert(actual.errorPct>=0&&actual.baselinePct>=0);
const historic=F.estimate(F.ensure(rows,60),390);
const changed=rows.map(x=>x.slice());
changed[401][4]*=1.4;changed[401][2]=Math.max(changed[401][2],changed[401][4]+.1);
const earlier=F.estimate(F.ensure(changed,60),390);
assert.equal(earlier.expectedReturnPct,historic.expectedReturnPct,"Future bars must not change old forecasts");
const hole=rows.map(x=>x.slice());hole[110][0]+=300;
assert.throws(()=>F.forecast({rows:hole,period:60}),/Zeitlücke/);
const invalid=rows.map(x=>x.slice());invalid[100][1]=-1;
assert.throws(()=>F.forecast({rows:invalid,period:60}),/Ungültige/);
assert.throws(()=>F.forecast({rows:rows.slice(0,60),period:60}));
assert.throws(()=>F.forecast({rows,period:15}));
"""
        run=subprocess.run([node,"-e",js],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(run.returncode,0,run.stderr)

if __name__=="__main__": unittest.main()
