"""Persistent paper-activation and deterministic risk-rule regression checks."""
import pathlib
import shutil
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class PaperStrategyChecks(unittest.TestCase):
    def test_opt_in_persists_but_running_requires_foreground_and_fresh_tick(self):
        html=(ROOT/"docs"/"index.html").read_text(encoding="utf-8")
        self.assertIn('src="./paper-rules.js?v=20261107-exit53"',html)
        self.assertIn("armed:d.armed===true&&!d.stopped,active:false",html)
        self.assertIn('JSON.stringify({...S.sim,active:false})',html)
        self.assertIn('if(S.sim.armed){S.sim.armed=false;S.sim.active=false;releasePaperLease()}',html)
        self.assertIn('function maybeResumePaper()',html)
        self.assertIn('!document.hidden&&S.connection&&S.rankingOk',html)
        self.assertIn('maybeResumePaper();if(wasOffline)',html)
        self.assertIn('S.sim.stopped=true;S.sim.armed=false;S.sim.active=false',html)
        self.assertIn('S.sim.active=false;releasePaperLease();save();renderDepot()',html)
        self.assertIn('if(!S.sim.active||!S.sim.armed||S.sim.stopped||S.paperStorageFault||document.hidden',html)
        self.assertIn('CryptoPilotPaperRules.inspectEntry(',html)
        self.assertIn('CryptoPilotPaperRules.inspectExit(',html)
        self.assertNotIn('/private/AddOrder',html)

    def test_paper_rules_behaviors(self):
        node=shutil.which("node")
        if not node:self.skipTest("Node runtime required")
        script=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={};vm.runInNewContext(fs.readFileSync('docs/paper-rules.js','utf8'),ctx);
const R=ctx.CryptoPilotPaperRules,now=1700000000000;
const quote={bid:101.35,ask:101.45,last:101.4,time:now};
const tape=Array.from({length:13},(_,i)=>({price:100+(1.4*i/12),time:now-36000+i*3000}));
let e=R.inspectEntry(tape,quote,now,0);
assert(e.buy,"positive momentum with tight spread should pass");
assert(!R.inspectEntry(tape,{...quote,ask:103},now,0).buy,"high spread");
assert(!R.inspectEntry(tape,quote,now,now-10000).buy,"cooldown");
assert(!R.inspectEntry(tape.slice(0,3),quote,now,0).buy,"minimum ticks");
assert(!R.inspectEntry(tape,{...quote,time:now-21000},now,0).buy,"stale");
const flat=tape.map(x=>({...x,price:100}));
assert(!R.inspectEntry(flat,quote,now,0).buy,"flat signal");
const pos={qty:1,cost:100,openedAt:now-60000,peakBid:105};
assert.equal(R.inspectExit(pos,{...quote,bid:96},now).reason,"Verluststopp (Demo)");
assert.equal(R.inspectExit(pos,{...quote,bid:105.5,ask:105.6},now).reason,"Gewinnziel (Demo)");
assert.equal(R.inspectExit(pos,{...quote,bid:103,ask:103.1},now).reason,"Nachziehender Gewinnschutz (Demo)");
assert.equal(R.inspectExit({...pos,peakBid:99,openedAt:now-50*60000},{...quote,bid:99.5},now).reason,"Zeitstopp bei Verlust (Demo)");
assert(!R.inspectExit(pos,{...quote,time:now-21000},now).sell,"stale tick is no fill");
assert(!R.inspectExit({...pos,peakBid:101.6},{...quote,bid:101.6,ask:101.7},now).sell,"still hold");
"""
        p=subprocess.run([node,"-e",script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr)

if __name__=="__main__":
    unittest.main()
