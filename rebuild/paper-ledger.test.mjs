import test from "node:test";
import assert from "node:assert/strict";
import { applyPaperOrder } from "./paper-ledger.mjs";
const wallet = () => ({ cash: 1000, quantity: 0, costBasis: 0, enabled: true, emergencyStop: false, trades: [] });
const buy = { id: "tick:1", side: "BUY", price: 100, quantity: 2, now: 100000, priceTimestamp: 99999 };
test("buy, duplicate, sell and journal", () => {
 const a = applyPaperOrder(wallet(), buy);
 assert.equal(a.status, "filled");
 assert.equal(a.state.trades.length, 1);
 assert.equal(applyPaperOrder(a.state, buy).status, "duplicate");
 const b = applyPaperOrder(a.state, {...buy, id:"tick:2", side:"SELL", quantity:2});
 assert.equal(b.status,"filled");
 assert.equal(b.state.quantity,0);
 assert.equal(b.state.trades.length,2);
 assert.ok(b.state.cash < 1000);
});
test("fail closed on stale, future, invalid quotes", () => {
 for (const o of [{...buy,priceTimestamp:0},{...buy,priceTimestamp:100001},{...buy,price:NaN},{...buy,quantity:-1}])
   assert.throws(()=>applyPaperOrder(wallet(),o));
});
test("limits, stop and disabled", () => {
 assert.equal(applyPaperOrder(wallet(), {...buy,quantity:5}).status,"exposure_limit");
 assert.equal(applyPaperOrder(wallet(), {...buy,side:"SELL"}).status,"insufficient_position");
 assert.equal(applyPaperOrder({...wallet(),enabled:false},buy).status,"disabled");
 assert.equal(applyPaperOrder({...wallet(),emergencyStop:true},buy).status,"disabled");
});
