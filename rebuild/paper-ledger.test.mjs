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


test("corrupt wallet controls and journal fail closed without changing balances", () => {
 for (const patch of [
   {enabled:"true"}, {enabled:1}, {emergencyStop:"false"}, {emergencyStop:null},
   {trades:[null]}, {trades:[{}]}, {trades:[{id:"bad id"}]},
   {trades:[{id:"same"},{id:"same"}]}
 ]) {
   const state={...wallet(),...patch};
   const before=structuredClone(state);
   assert.throws(()=>applyPaperOrder(state,buy),/invalid wallet/);
   assert.deepEqual(state,before);
 }
});

test("projected position overflow fails closed without writing a trade", () => {
 const state = {...wallet(), cash:1e308, quantity:1e308, costBasis:1e307};
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"projected-overflow", price:0.1, quantity:1e308}, {maxExposure:1}), /exposure overflow/);
 assert.deepEqual(state, before);
});

test("execution-price overflow fails closed before journaling", () => {
 const state = {...wallet(), cash:1e308};
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"price-overflow", price:1e308, quantity:1e-300}, {slippageRate:0.9, maxExposure:1}), /overflow/);
 assert.deepEqual(state, before);
});

test("corrupt persisted trade fields fail closed before any new order", () => {
 const valid = applyPaperOrder(wallet(), buy).state.trades[0];
 for (const patch of [
   {side:"HOLD"}, {quantity:0}, {quantity:Infinity},
   {executionPrice:NaN}, {executionPrice:-1},
   {fee:-0.01}, {fee:Infinity}, {priceTimestamp:Infinity},
   {at:NaN}, {priceTimestamp:valid.at+1}
 ]) {
   const state = {...wallet(), trades:[{...valid,...patch}]};
   const before = structuredClone(state);
   assert.throws(() => applyPaperOrder(state, {...buy,id:"next-tick"}), /invalid wallet/);
   assert.deepEqual(state, before);
 }
});

test("invalid risk policy cannot bypass validation through disabled or duplicate orders", () => {
 const filled = applyPaperOrder(wallet(), buy).state;
 for (const state of [
   {...wallet(), enabled:false},
   {...wallet(), emergencyStop:true},
   filled
 ]) {
   const before=structuredClone(state);
   for (const policy of [
     {maxAgeMs:NaN}, {feeRate:Infinity}, {slippageRate:-0.01},
     {maxExposure:0}, {maxExposure:2}
   ]) {
     assert.throws(() => applyPaperOrder(state,buy,policy),/invalid policy/);
     assert.deepEqual(state,before);
   }
 }
});

test("persisted journal timestamps cannot be negative or ahead of current tick", () => {
 const valid = applyPaperOrder(wallet(), buy).state.trades[0];
 for (const patch of [
   {priceTimestamp:-1, at:valid.at},
   {priceTimestamp:-1, at:-1},
   {at:-1, priceTimestamp:-2},
   {at:buy.now+1, priceTimestamp:buy.now+1}
 ]) {
   const state = {...wallet(), trades:[{...valid,...patch}]};
   const before = structuredClone(state);
   assert.throws(() => applyPaperOrder(state, {...buy,id:"later"}), /invalid wallet/);
   assert.deepEqual(state,before);
 }
});


test("negative order clock or quote timestamp cannot create virtual trades", () => {
 for (const order of [
   {...buy, now:-1, priceTimestamp:-2},
   {...buy, now:100000, priceTimestamp:-1},
   {...buy, now:-1, priceTimestamp:0}
 ]) {
   const state=wallet();
   const before=structuredClone(state);
   assert.throws(() => applyPaperOrder(state, order), /invalid or stale quote\/order/);
   assert.deepEqual(state,before);
 }
});

test("persisted inventory and cost basis must agree before paper fills", () => {
 for (const patch of [
   {quantity:0, costBasis:1},
   {quantity:0, costBasis:Number.MIN_VALUE},
   {quantity:1, costBasis:0},
   {quantity:Number.MIN_VALUE, costBasis:0}
 ]) {
   const state = {...wallet(), ...patch};
   const before = structuredClone(state);
   assert.throws(() => applyPaperOrder(state, buy), /invalid wallet/);
   assert.deepEqual(state, before);
 }
});


test("fractional sell retains sub-nanounit inventory and proportional basis", () => {
 const state = {...wallet(), quantity:1e-10, costBasis:1e-8};
 const before = structuredClone(state);
 const result = applyPaperOrder(state, {...buy, id:"fractional-sell", side:"SELL", quantity:5e-11});
 assert.equal(result.status, "filled");
 assert.ok(result.state.quantity > 0);
 assert.equal(result.state.quantity, 5e-11);
 assert.equal(result.state.costBasis, 5e-9);
 assert.equal(result.state.trades.length, 1);
 assert.deepEqual(state, before);
});


test("paper timestamps must be safe integer milliseconds", () => {
 const valid = applyPaperOrder(wallet(), buy).state.trades[0];
 for (const timestamp of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
   for (const order of [
     {...buy, now:timestamp},
     {...buy, priceTimestamp:timestamp}
   ]) {
     const state = wallet();
     assert.throws(() => applyPaperOrder(state, order));
     assert.equal(state.trades.length, 0);
   }
   for (const patch of [{at:timestamp}, {priceTimestamp:timestamp}]) {
     const state = {...wallet(), trades:[{...valid,...patch}]};
     const before = structuredClone(state);
     assert.throws(() => applyPaperOrder(state, {...buy,id:"next"}), /invalid wallet/);
     assert.deepEqual(state, before);
   }
 }
});

test("subnormal virtual fills cannot create journal entries without wallet movement", () => {
 const state = wallet();
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"tiny-buy", quantity:1e-320}), /underflow/);
 assert.deepEqual(state, before);
});

test("zero-notional virtual orders fail closed", () => {
 const state = wallet();
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"zero-notional", price:Number.MIN_VALUE, quantity:Number.MIN_VALUE}), /underflow/);
 assert.deepEqual(state, before);
});

test("persisted journal cannot run backward in time", () => {
 const first = applyPaperOrder(wallet(), buy).state;
 const second = applyPaperOrder(first, {...buy, id:"tick:2", side:"SELL", quantity:1, now:100001, priceTimestamp:100001}).state;
 const reversed = {...second, trades:[second.trades[1], second.trades[0]]};
 const snapshot = structuredClone(reversed);
 assert.throws(() => applyPaperOrder(reversed, {...buy, id:"tick:3", now:100002, priceTimestamp:100002}), /invalid wallet/);
 assert.deepEqual(reversed, snapshot);
});

test("new paper order cannot predate latest persisted trade", () => {
 const state = applyPaperOrder(wallet(), buy).state;
 const snapshot = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"clock-rollback", now:99999, priceTimestamp:99999}), /clock precedes persisted journal/);
 assert.deepEqual(state, snapshot);
});

test("small paper wallets enforce the exact exposure cap", () => {
 const state = {...wallet(), cash:1e-7};
 const before = structuredClone(state);
 const order = {...buy, id:"micro-exposure", quantity:4.0001e-10};
 const result = applyPaperOrder(state, order);
 assert.equal(result.status, "exposure_limit");
 assert.strictEqual(result.state, state);
 assert.deepEqual(state, before);
 const atLimit = applyPaperOrder(state, {...order, id:"micro-at-limit", quantity:3.99e-10});
 assert.equal(atLimit.status, "filled");
 assert.equal(atLimit.state.trades.length, 1);
});

test("restarted wallet rejects quote rollback without mutating persisted balances", () => {
 const first = applyPaperOrder(wallet(), buy).state;
 const before = structuredClone(first);
 assert.throws(() => applyPaperOrder(first, {
   ...buy, id:"quote-rollback", side:"SELL", quantity:1,
   now:100001, priceTimestamp:99998
 }), /quote precedes persisted journal/);
 assert.deepEqual(first, before);
 const forward = applyPaperOrder(first, {
   ...buy, id:"quote-forward", side:"SELL", quantity:1,
   now:100001, priceTimestamp:99999
 });
 assert.equal(forward.status, "filled");
});

test("persisted quote timestamps must be monotonic across journal entries", () => {
 const first = applyPaperOrder(wallet(), buy).state;
 const second = applyPaperOrder(first, {
   ...buy, id:"tick:2", side:"SELL", quantity:1,
   now:100002, priceTimestamp:100001
 }).state;
 const corrupt = structuredClone(second);
 corrupt.trades[0].priceTimestamp = 100000;
 corrupt.trades[1].priceTimestamp = 99999;
 const before = structuredClone(corrupt);
 assert.throws(() => applyPaperOrder(corrupt, {
   ...buy, id:"tick:3", side:"SELL", quantity:1,
   now:100003, priceTimestamp:100003
 }), /invalid wallet/);
 assert.deepEqual(corrupt, before);
});

test("idempotency keys reject conflicting replays without changing the wallet", () => {
 const first = applyPaperOrder(wallet(), buy).state;
 const snapshot = structuredClone(first);
 assert.equal(applyPaperOrder(first, buy).status, "duplicate");
 for (const patch of [
   {side:"SELL"}, {quantity:1}, {price:101},
   {priceTimestamp:99998}, {price:NaN}
 ]) {
   assert.throws(() => applyPaperOrder(first, {...buy,...patch}), /conflicting idempotency key/);
   assert.deepEqual(first, snapshot);
 }
});


test("partial sell rejects cost-basis precision underflow without wallet mutation", () => {
 const state = {...wallet(), quantity:1, costBasis:Number.MIN_VALUE};
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"basis-underflow", side:"SELL", quantity:0.5}), /cost basis precision underflow/);
 assert.deepEqual(state, before);
});


test("adverse buy slippage counts toward maximum exposure", () => {
 const state = wallet();
 const before = structuredClone(state);
 // Mark-price exposure is exactly 40%, but the executable buy costs more.
 const order = {...buy, id:"slippage-exposure", quantity:4};
 const rejected = applyPaperOrder(state, order);
 assert.equal(rejected.status, "exposure_limit");
 assert.strictEqual(rejected.state, state);
 assert.deepEqual(state, before);
 const allowed = applyPaperOrder(state, {...order, id:"slippage-safe", quantity:3.99});
 assert.equal(allowed.status, "filled");
 assert.equal(allowed.state.trades.length, 1);
});


test("duplicate paper orders reject malformed replay clocks without wallet mutation", () => {
 const state = applyPaperOrder(wallet(), buy).state;
 const snapshot = structuredClone(state);
 for (const now of [undefined, null, NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
   assert.throws(() => applyPaperOrder(state, {...buy, now}), /invalid order clock/);
   assert.deepEqual(state, snapshot);
 }
 assert.equal(applyPaperOrder(state, buy).status, "duplicate");
});


test("buy refuses a cost-basis rounding no-op without mutating wallet", () => {
 const state = {...wallet(), cash:1000, quantity:1, costBasis:1e308};
 const before = structuredClone(state);
 assert.throws(() => applyPaperOrder(state, {...buy, id:"basis-buy-underflow", quantity:1}, {maxExposure:1}), /cost basis precision underflow/);
 assert.deepEqual(state, before);
 assert.equal(state.trades.length, 0);
});

test("duplicate replay cannot roll clock back behind a later persisted fill", () => {
 const first = applyPaperOrder(wallet(), buy).state;
 const later = applyPaperOrder(first, {...buy, id:"tick:2", side:"SELL", quantity:1, now:100010, priceTimestamp:100010}).state;
 const before = structuredClone(later);
 assert.throws(() => applyPaperOrder(later, buy), /clock precedes persisted journal/);
 assert.deepEqual(later, before);
 assert.equal(applyPaperOrder(later, {...buy, now:100010}).status, "duplicate");
});


test("persisted paper journal rejects impossible fees and overflowed notionals", () => {
 const filled = applyPaperOrder(wallet(), buy).state;
 const original = filled.trades[0];
 for (const patch of [
   {fee: original.executionPrice * original.quantity},
   {fee: original.executionPrice * original.quantity + 1},
   {executionPrice: 1e308, quantity: 1e308, fee: 1}
 ]) {
   const corrupt = {...filled, trades: [{...original, ...patch}]};
   const snapshot = structuredClone(corrupt);
   assert.throws(() => applyPaperOrder(corrupt, {...buy, id:"next", side:"SELL", quantity:1, now:100001}), /invalid wallet/);
   assert.deepEqual(corrupt, snapshot);
 }
});


test("persisted paper fills with stale quotes fail closed after restart", () => {
 const valid = applyPaperOrder(wallet(), buy).state;
 const stale = structuredClone(valid);
 stale.trades[0].at = 300000;
 stale.trades[0].priceTimestamp = 179999;
 const snapshot = structuredClone(stale);
 assert.throws(() => applyPaperOrder(stale, {...buy, id:"after-restart", now:300001, priceTimestamp:300001}), /invalid wallet/);
 assert.deepEqual(stale, snapshot);
 // Exactly at the hard 120-second ceiling remains structurally valid.
 const boundary = structuredClone(valid);
 boundary.trades[0].at = 220000;
 boundary.trades[0].priceTimestamp = 100000;
 const next = applyPaperOrder(boundary, {...buy, id:"boundary-next", side:"SELL", quantity:1, now:220001, priceTimestamp:220001});
 assert.equal(next.status, "filled");
});
