"""End-to-end-ish simulated browser test for opt-in observational forecast scheduling."""
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ForecastObserverChecks(unittest.TestCase):
    def test_observer_saves_once_settles_later_and_pauses_when_hidden(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node required")
        script=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('docs/index.html','utf8');
const start=html.indexOf('const FORECAST_KEY=');
const end=html.indexOf('let labBusy=false;',start);
assert(start>0&&end>start,"Forecast UI script boundaries");
const snippet=html.slice(start,end);
const baseTime=1720000000;
let now=(baseTime+320*3600+3600)*1000,fetches=0;
class FakeDate extends Date{
 constructor(...a){super(...(a.length?a:[now]))}
 static now(){return now}
}
const rows=[];
function bar(i){
 const t=baseTime+i*3600,o=100+2*Math.sin(i/20)+.014*i,c=100+2*Math.sin((i+1)/20)+.014*(i+1);
 return [t,o,Math.max(o,c)+.12,Math.min(o,c)-.12,c,"0","1"];
}
for(let i=0;i<321;i++)rows.push(bar(i));
let currentRows=rows;
const storage=new Map([["cryptopilot-v43-forecast-observer-enabled","1"]]);
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{value:id==="forecastCoin"?"bitcoin":id==="forecastPeriod"?"60":"",
 textContent:"",hidden:false,disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}});
 return nodes.get(id)};
const S={coins:[{id:"bitcoin",symbol:"btc"}],pairs:new Map([["XBT",{pair:"XXBTZEUR"}]])};
const ctx={Date:FakeDate,Math,JSON,Number,Array,Object,String,Map,Set,URLSearchParams,console,
 localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,v)=>storage.set(key,v)},
 document:{hidden:false},S,BASE:{bitcoin:"XBT"},$,text:(id,value)=>{$(id).textContent=String(value)},
 PCT:new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}),
 priceEUR:x=>String(x),
 getJson:async()=>{fetches++;return {error:[],result:{XXBTZEUR:currentRows,last:123}}},
 alert:()=>{throw Error("unexpected alert")}};
vm.runInNewContext(fs.readFileSync('docs/forecast-engine.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('docs/forecast-journal.js','utf8'),ctx);
vm.runInNewContext(snippet,ctx);
(async()=>{
 await vm.runInNewContext('observeForecasts()',ctx);
 let log=JSON.parse(storage.get("cryptopilot-v42-prediction-journal"));
 assert.equal(log.length,1,"Initial 6h prediction recorded");
 assert.equal(fetches,1);
 await vm.runInNewContext('observeForecasts()',ctx);
 assert.equal(fetches,1,"No duplicate network calls");
 // Seven hours later a previous prediction becomes mature; append completed true OHLC.
 for(let i=321;i<328;i++)rows.push(bar(i));
 rows.push(bar(328));currentRows=rows;now+=7*3600000;
 await vm.runInNewContext('observeForecasts()',ctx);
 log=JSON.parse(storage.get("cryptopilot-v42-prediction-journal"));
 assert.equal(fetches,2);
 assert.equal(log.length,2,"Exactly one new forecast after a full six-hour horizon");
 assert(log[0].actual&&Number.isFinite(log[0].actual.errorPct),"Past forecast must mature");
 assert(log[1].at>log[0].at);
 // Browser pause prevents any further data capture, even after the next horizon.
 ctx.document.hidden=true;now+=7*3600000;
 await vm.runInNewContext('observeForecasts()',ctx);
 assert.equal(fetches,2,"Hidden Safari tab does not run");
 assert.equal(JSON.parse(storage.get("cryptopilot-v42-prediction-journal")).length,2);
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        r=subprocess.run([node,"-e",script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)

if __name__=="__main__":
    unittest.main()
