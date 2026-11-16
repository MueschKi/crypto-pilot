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

test("rejects unsafe quote freshness policy rather than disabling stale checks", () => {
 for (const maxAgeMs of [NaN, Infinity, -1, 120001, "120000", 1.5]) {
   assert.throws(() => applyPaperOrder(wallet(), buy, {maxAgeMs}));
 }
 assert.throws(() => applyPaperOrder(wallet(), {...buy, priceTimestamp: 0}, {maxAgeMs: 120000}));
});
test("malformed orders fail without creating a paper trade", () => {
 assert.throws(() => applyPaperOrder(wallet(), null));
 assert.throws(() => applyPaperOrder(wallet(), undefined));
 assert.equal(wallet().trades.length, 0);
});

test("fractional oversell cannot mint cash or create negative inventory", () => {
 const state = {...wallet(), cash: 900, quantity: 0.1, costBasis: 10};
 const result = applyPaperOrder(state, {...buy, id:"oversell", side:"SELL", quantity:0.1000000005});
 assert.equal(result.status, "insufficient_position");
 assert.strictEqual(result.state, state);
 assert.equal(state.trades.length, 0);
});
test("fractional overdraft cannot make paper cash negative", () => {
 const state = {...wallet(), cash: 100};
 const quantity = 100 / (100 * 1.001 * 1.004) + 1e-11;
 const result = applyPaperOrder(state, {...buy, id:"overdraft", quantity}, {maxExposure:1});
 assert.equal(result.status, "insufficient_cash");
 assert.strictEqual(result.state, state);
});

test("rejects finite inputs that overflow wallet arithmetic", () => {
 const huge = {...wallet(), cash:1e308, quantity:1e308, costBasis:1e308};
 assert.throws(() => applyPaperOrder(huge, {...buy, id:"overflow-buy", price:100, quantity:1}, {maxExposure:1}), /overflow/);
 assert.equal(huge.trades.length, 0);
 const hugeSell = {...wallet(), cash:1e308, quantity:1e308, costBasis:1e308};
 assert.throws(() => applyPaperOrder(hugeSell, {...buy, id:"overflow-sell", side:"SELL", price:100, quantity:1e307}), /overflow/);
 assert.equal(hugeSell.trades.length, 0);
});
