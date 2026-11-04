"""Audit assertions for accessible collapsible UI, persisted state and cross-tab paper safety."""
from html.parser import HTMLParser
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
HTML=(ROOT/"docs"/"index.html").read_text(encoding="utf-8")

class Structure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[]
        self.details=[]
        self.depth=0
        self.summary_depths=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if "id" in d:self.ids.append(d["id"])
        if tag=="details":
            self.depth+=1
            self.details.append((d.get("id"),"open" in d))
        if tag=="summary":self.summary_depths.append(self.depth)
    def handle_endtag(self,tag):
        if tag=="details":self.depth-=1

class UIChecks(unittest.TestCase):
    def test_collapsible_ui_and_unique_dom_ids(self):
        parser=Structure();parser.feed(HTML)
        self.assertEqual(len(parser.ids),len(set(parser.ids)),"Duplicate HTML IDs")
        self.assertEqual(parser.depth,0,"Missing closing details tag")
        for area in ("signalSection","forecastSection","labSection","journalSection","diagnosticSection"):
            self.assertIn((area,False),parser.details,"Non-essential panel must default collapsed")
        self.assertEqual(len(parser.summary_depths),5)
        self.assertTrue(all(d>0 for d in parser.summary_depths))
        self.assertIn("collapsible summary:focus-visible",HTML)
        self.assertIn('id="marketChart"',HTML)
        self.assertIn('id="paperState"',HTML)
        self.assertIn("distance/85",HTML)

    def test_held_coin_keeps_kraken_subscription_after_ranking_rotation(self):
        node=shutil.which("node")
        if not node:self.skipTest("Requires Node")
        code=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('docs/index.html','utf8');
const begin=html.indexOf('function connect(){');
const end=html.indexOf('$("toggle").addEventListener',begin);
assert(begin>=0&&end>begin);
const code=html.slice(begin,end);
class FakeWS{
 constructor(){this.readyState=FakeWS.CONNECTING;this.closed=false}
 close(){this.closed=true}
 send(){}
}
FakeWS.CONNECTING=0;FakeWS.OPEN=1;FakeWS.CLOSED=3;
const S={coins:[{id:'bitcoin'}],sim:{holdings:{near:{qty:1,cost:100}},active:true},pairs:new Map([
 ['XBT',{wsname:'XBT/EUR'}],['NEAR',{wsname:'NEAR/EUR'}]]),ws:null,quotes:new Map(),byPair:new Map(),livePairKey:'',connection:false};
const ctx={S,BASE:{bitcoin:'XBT',near:'NEAR'},STABLE:new Set(),WebSocket:FakeWS,setNotice:()=>{},text:()=>{},Date};
vm.runInNewContext(code+';connect()',ctx);
assert.equal(S.byPair.get('XBT/EUR'),'bitcoin');
assert.equal(S.byPair.get('NEAR/EUR'),'near','Existing positions must not leave Kraken feed');
const original=S.ws;vm.runInNewContext('connect()',ctx);
assert.strictEqual(S.ws,original,'Unchanged healthy connection must not be restarted');
S.pairs.delete('NEAR');
vm.runInNewContext('connect()',ctx);
assert.equal(S.sim.active,false,'Unmapped position blocks new paper trading');
"""
        p=subprocess.run([node,"-e",code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr)

    def test_saved_wallet_validation_and_tab_lease(self):
        node=shutil.which("node")
        if not node:self.skipTest("Requires Node")
        code=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('docs/index.html','utf8');
function part(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end)}
const savedPart=part('function save(){','// Best-effort cross-tab lease');
function loadWallet(data){
 const bytes=JSON.stringify(data),store={record:bytes},labels={},S={sim:{cash:1000,holdings:{},trades:[],stopped:false,lastTrade:{},armed:false,active:false,series:[1000]},paperStorageFault:false};
 const ctx={S,BASE:{bitcoin:'XBT'},STABLE:new Set(['tether']),localStorage:{
 getItem:()=>store.record,setItem:(k,v)=>{store.record=v}},text:(id,v)=>{labels[id]=v}};
 vm.runInNewContext(savedPart+';load()',ctx);
 return {S,store,labels};
}
const t=1700000000000;
const valid={cash:1200,holdings:{bitcoin:{qty:.5,cost:100,entry:200,peakBid:205,openedAt:t}},trades:[{type:'KAUF',eur:100,time:t}],series:[1000,1100],stopped:false,lastTrade:{bitcoin:t},armed:true,active:true};
const ok=loadWallet(valid);
assert.equal(ok.S.sim.cash,1200,"A profitable saved wallet must survive reload");
assert.equal(ok.S.sim.active,false,"Execution must never auto-start from saved state");
assert.equal(ok.S.sim.armed,true);
assert.equal(ok.S.paperStorageFault,false);
const corrupt=JSON.parse(JSON.stringify(valid));corrupt.holdings.bitcoin.qty=-1;
const bad=loadWallet(corrupt);
assert.equal(bad.S.paperStorageFault,true);
assert.equal(bad.S.sim.armed,false);
assert.equal(bad.store.record,JSON.stringify(corrupt),"Corrupt original must not be overwritten");
const state={...valid,series:[1000,Infinity]};
const invalidSeries=loadWallet(state);
assert.equal(invalidSeries.S.paperStorageFault,true);
const now=Date.now();
const mem=new Map([['cryptopilot-v3-execution-lease',JSON.stringify({id:'other',until:now+10000})]]);
const ctx={localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},Date,Math};
vm.runInNewContext(part('// Best-effort cross-tab lease','function quoteFresh(q){'),ctx);
assert.equal(vm.runInNewContext('paperLease()',ctx),false,"Concurrent live lease blocks second tab");
mem.delete('cryptopilot-v3-execution-lease');
assert.equal(vm.runInNewContext('paperLease()',ctx),true);
vm.runInNewContext('releasePaperLease()',ctx);
assert.equal(mem.has('cryptopilot-v3-execution-lease'),false);
"""
        r=subprocess.run([node,"-e",code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)

if __name__=="__main__":unittest.main()
