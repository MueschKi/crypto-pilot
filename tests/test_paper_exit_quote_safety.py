"""Regression tests: paper exits must reject invalid or future Kraken quotes."""
import pathlib
import shutil
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class PaperExitQuoteSafety(unittest.TestCase):
    def test_invalid_quotes_never_trigger_virtual_sell(self):
        if not shutil.which("node"):
            self.skipTest("Node.js required")
        js = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={};vm.runInNewContext(fs.readFileSync('docs/paper-rules.js','utf8'),context);
const inspect=context.CryptoPilotPaperRules.inspectExit;
const now=1700000000000;
const position={qty:1,cost:100,peakBid:100,openedAt:now-60000};
const good={bid:96,ask:96.1,last:96.05,time:now};
assert.strictEqual(inspect(position,good,now).sell,true,'valid loss stop still works');
const invalid=[
 {...good,time:now+1001},
 {...good,time:now-20001},
 {...good,ask:95},
 {...good,last:0},
 {...good,bid:0},
 {...good,ask:NaN},
 {...good,time:Infinity}
];
for(const quote of invalid){
 const result=inspect(position,quote,now);
 assert.strictEqual(result.sell,false,JSON.stringify(quote));
 assert.strictEqual(result.peak,null);
}
const nearFuture={...good,time:now+1000};
assert.strictEqual(inspect(position,nearFuture,now).sell,true,'one-second tolerance is retained');
"""
        result = subprocess.run(
            ["node", "-e", js], cwd=ROOT, text=True, capture_output=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
