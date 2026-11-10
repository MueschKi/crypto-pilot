import assert from "node:assert/strict";
import {evaluatePaperTick as gate} from "../src/scheduler.mjs";
const base={nowMs:600000,lastTickMs:0,intervalMs:300000,enabled:true,halted:false,marketFresh:true,storageHealthy:true};
assert.deepEqual(gate(base),{run:true,reason:"dry_run_only",tickId:"2"});
for(const [patch,reason] of [
 [{enabled:false},"disabled"],[{halted:true},"halted"],
 [{storageHealthy:false},"storage_unavailable"],[{marketFresh:false},"stale_market"],
 [{lastTickMs:500000},"not_due"],[{lastTickMs:700000},"invalid_clock_or_interval"],
 [{intervalMs:0},"invalid_clock_or_interval"],[{nowMs:NaN},"invalid_clock_or_interval"]
]) {
 const result=gate({...base,...patch});
 assert.equal(result.run,false);
 assert.equal(result.reason,reason);
}
assert.equal(gate({...base,nowMs:600000}).tickId,gate({...base,nowMs:600001}).tickId);
console.log("paper scheduler dry-run gate: OK");
