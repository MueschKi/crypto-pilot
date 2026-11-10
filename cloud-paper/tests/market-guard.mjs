import assert from "node:assert/strict";
import {validatePaperQuote as check} from "../src/market-guard.mjs";
const now=1700000000000,quote={symbol:"BTC",priceCents:5000000,timestampMs:now-5000};
assert.deepEqual(check(quote,now),{ok:true,...quote});
for(const [q,reason] of [
 [{...quote,priceCents:0},"invalid_quote"],
 [{...quote,priceCents:1.5},"invalid_quote"],
 [{...quote,symbol:"DOGE"},"invalid_quote"],
 [{...quote,timestampMs:now-60001},"stale_quote"],
 [{...quote,timestampMs:now+1001},"future_quote"],
 [null,"invalid_quote"]
])assert.equal(check(q,now).reason,reason);
assert.equal(check(quote,NaN).reason,"invalid_clock");
assert.equal(check(quote,now,900000).reason,"invalid_clock");
assert.equal(check({...quote,timestampMs:now+1000},now).ok,true);
console.log("paper market guard: OK");
