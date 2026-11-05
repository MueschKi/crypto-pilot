"""Risk and no-lookahead regression checks for the research-only shadow strategy."""
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ShadowLabChecks(unittest.TestCase):
    def test_ui_is_explicitly_research_only(self):
        html=(ROOT/"docs"/"index.html").read_text(encoding="utf-8")
        for name in ("runShadowLab","shadowStatus","shadowResults","shadowForecast","shadowHold","shadowSignals","shadowDrawdown"):
            self.assertIn('id="'+name+'"',html)
        self.assertIn('src="./shadow-strategy.js?v=20261105-shadow45"',html)
        self.assertIn("CryptoPilotShadow.simulate({rows:closed,period},CryptoPilotForecast)",html)
        src=(ROOT/"docs"/"shadow-strategy.js").read_text(encoding="utf-8")
        for forbidden in ("fetch(", "WebSocket(", "/private/AddOrder", "localStorage", "S.sim.", "order("):
            self.assertNotIn(forbidden,src)

    def test_costs_and_future_leak_prevention(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node required")
        script=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={};vm.runInNewContext(fs.readFileSync('docs/shadow-strategy.js','utf8'),ctx);
const Lab=ctx.CryptoPilotShadow;
const start=1720000000;
const rows=Array.from({length:360},(_,i)=>[start+i*3600,100,100.12,99.88,100,"0","1"]);
const valid=(rows,period)=>{assert.equal(period,60);return rows.map(r=>({t:r[0],o:r[1],h:r[2],l:r[3],c:r[4]}))};
let calls=0;
const alwaysBuy={ensure:valid,roundTripPct:1,estimate:(history,index)=>{
 calls++;assert.equal(index,history.length-1,"Only closed candles may enter signal");
 assert(index<rows.length-1);
 return {expectedReturnPct:10};
}};
const result=Lab.simulate({rows,period:60},alwaysBuy);
assert(calls>0);
assert(result.forecast.signals>0);
assert(result.forecast.returnPct<0,"Trading a flat market must lose money to costs");
assert(result.hold.returnPct<0,"Buy-and-hold also pays fees");
assert(result.forecast.estimatedExecutedCosts>0);
assert(result.forecast.drawdownPct<=0);
assert.equal(result.forecast.curve.length,result.hold.curve.length);
const neverBuy={...alwaysBuy,estimate:()=>({expectedReturnPct:-10})};
const no=Lab.simulate({rows,period:60},neverBuy);
assert.equal(no.forecast.signals,0);
assert.equal(no.forecast.value,1000);
assert.equal(no.forecast.estimatedExecutedCosts,0);
assert(no.noSignal);
assert.throws(()=>Lab.simulate({rows:rows.slice(0,250),period:60},alwaysBuy));
const sample=rows.map(r=>r.slice());sample[200][4]=95;
const strictEngine={...alwaysBuy,ensure:(input,period)=>{
 for(const r of input)if(r[4]<99.88)throw Error('Invalid OHLC');
 return valid(input,period);
}};
assert.throws(()=>Lab.simulate({rows:sample,period:60},strictEngine));
"""
        p=subprocess.run([node,"-e",script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr)

if __name__=="__main__":unittest.main()
