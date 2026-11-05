"""Cross-market research-only forecast settlement and accuracy accounting."""
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ForecastJournalChecks(unittest.TestCase):
    def test_pure_journal_due_groups_and_accuracy(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node required")
        script=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={};
vm.runInNewContext(fs.readFileSync('docs/forecast-engine.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('docs/forecast-journal.js','utf8'),ctx);
const E=ctx.CryptoPilotForecast,J=ctx.CryptoPilotForecastJournal;
const now=1750000000000,at=1720000000;
const p=(coin,period,pair)=>({coin,period,pair,at,until:at+6*period*60,
 price:100,expectedReturnPct:2,closeBand:[97,104],lowScenario:96,highScenario:107});
const records=[p("bitcoin",60,"XXBTZEUR"),p("ethereum",240,"XETHZEUR"),p("bitcoin",60,"XXBTZEUR"),
 {...p("solana",60,"SOL/EUR"),actual:{actual:110,errorPct:1,baselinePct:10}}];
const grouped=J.dueGroups(records,now,4);
assert.equal(grouped.length,2);
assert.equal(grouped.find(x=>x.coin==="bitcoin").count,2);
assert.equal(J.dueGroups(records,now,1).length,1);
assert.equal(J.status(records,now).due,3);
assert.equal(J.dueGroups(records,(at+200)*1000).length,0);
const rows=Array.from({length:240},(_,i)=>{
 const open=100+i*.02,close=open+.01;
 return [at+i*3600,open,close+.05,open-.05,close,"0","1"];
});
const btc=grouped.find(x=>x.coin==="bitcoin");
const settled=J.mergeOutcomes(records,btc,rows,E);
assert.equal(settled.settled,2);
assert.equal(settled.records[1].actual,undefined,"Do not settle ETH with BTC bars");
assert.equal(records[0].actual,undefined,"Original entries remain immutable");
const score=E.scoreJournal([{...p("bitcoin",60,"XXBTZEUR"),
 actual:{actual:104,actualLow:95,actualHigh:108,errorPct:0,baselinePct:3}},
 {...p("bitcoin",60,"XXBTZEUR"),expectedReturnPct:-2,
 actual:{actual:95,actualLow:93,actualHigh:107,errorPct:2,baselinePct:5}}]);
assert.equal(score.count,2);
assert.equal(score.longCandidates,1,"Cost-aware research only when median exceeds costs");
assert.equal(score.lowCases,2);
assert.equal(score.highCases,2);
assert(score.lowMaePct>0);
assert(score.highMaePct>0);
assert(score.longMeanNetPct>0);
assert(score.longNetHitPct===100);
"""
        result=subprocess.run([node,"-e",script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_browser_settles_all_market_horizons_without_trading(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node required")
        script=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('docs/index.html','utf8');
const i=html.indexOf('const FORECAST_KEY='),j=html.indexOf('let labBusy=false;',i);
assert(i>=0&&j>i);
const snippet=html.slice(i,j),at=1720000000;
const makeRows=(period)=>Array.from({length:261},(_,k)=>{
 const open=100+k*.01,close=open+.015;
 return [at+k*period*60,open,close+.08,open-.08,close,'0','1']
});
const sets={XXBTZEUR:makeRows(60),XETHZEUR:makeRows(240)};
const makeRecord=(coin,pair,period)=>({coin,pair,period,
 at:at+210*period*60,until:at+216*period*60,
 price:102,expectedReturnPct:1,lowScenario:100,highScenario:106,closeBand:[98,106]});
let records=[makeRecord('bitcoin','XXBTZEUR',60),makeRecord('ethereum','XETHZEUR',240)];
const storage=new Map([['cryptopilot-v42-prediction-journal',JSON.stringify(records)]]);
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='forecastCoin'?'bitcoin':id==='forecastPeriod'?'60':'',disabled:false,hidden:false,
 textContent:'',setAttribute(){},addEventListener(){}});return nodes.get(id)};
let fetches=0;
const now=(at+280*240*60)*1000;
class FakeDate extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
const ctx={S:{pairs:new Map([['XBT',{pair:'XXBTZEUR'}],['ETH',{pair:'XETHZEUR'}]]),coins:[]},
 BASE:{bitcoin:'XBT',ethereum:'ETH'},Date:FakeDate,document:{hidden:false},$,PCT:new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}),
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},text:(id,t)=>{$(id).textContent=String(t)},
 getJson:async(url)=>{
  fetches++;
  const q=new URLSearchParams(url.split('?')[1]),pair=q.get('pair');
  return {error:[],result:{[pair]:[...sets[pair],[at+261*Number(q.get('interval'))*60,1,1,1,1]],last:0}};
 },priceEUR:x=>String(x),alert:()=>{},URLSearchParams};
vm.runInNewContext(fs.readFileSync('docs/forecast-engine.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('docs/forecast-journal.js','utf8'),ctx);
vm.runInNewContext(snippet,ctx);
(async()=>{
 await vm.runInNewContext('checkForecastOutcomes(true)',ctx);
 const log=JSON.parse(storage.get('cryptopilot-v42-prediction-journal'));
 assert.equal(fetches,2,'Exactly one request per unique market / horizon');
 assert.equal(log.length,2,'Do not invent additional forecasts');
 assert(log.every(x=>x.actual&&x.actual.actual>0),'Both 1h and 4h predictions settle');
 await vm.runInNewContext('checkForecastOutcomes(true)',ctx);
 assert.equal(fetches,2,'Resolved forecasts are not fetched again');
})().catch(err=>{console.error(err);process.exitCode=1});
"""
        result=subprocess.run([node,"-e",script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)

if __name__=="__main__":unittest.main()
