import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePaperOrder as order } from "./paper-risk.mjs";
const base = { price: 100, quantity: 0.5, cash: 1000, assetQuantity: 0, equity: 1000 };
test("buy includes slippage and fees", () => {
  const r = order({ ...base, side: "BUY" });
  assert.equal(r.ok, true);
  assert.equal(r.executionPrice, 100.1);
  assert.ok(r.cashDelta < -50);
});
test("sell is net of costs", () => {
  const r = order({ ...base, side: "SELL", assetQuantity: 1 });
  assert.equal(r.ok, true);
  assert.ok(r.cashDelta < 50);
});
test("rejects invalid values and unknown sides", () => {
  for (const overrides of [{ price: NaN }, { price: Infinity }, { quantity: -1 }, { side: "LIVE" }]) {
    assert.equal(order({ ...base, side: "BUY", ...overrides }).ok, false);
  }
});
test("enforces cash, order and exposure caps", () => {
  assert.equal(order({ ...base, side: "BUY", quantity: 11 }).ok, false);
  assert.equal(order({ ...base, side: "BUY", quantity: 2 }).reason, "ORDER_LIMIT");
  assert.equal(order({ ...base, side: "BUY", assetQuantity: 3.8 }).reason, "EXPOSURE_LIMIT");
});
test("cannot sell unowned units", () => {
  assert.equal(order({ ...base, side: "SELL" }).reason, "INSUFFICIENT_ASSET");
});
test("rejects zero-price execution and invalid risk", () => {
  assert.equal(order({ ...base, side: "SELL", assetQuantity: 1, risk: {feeRate:0,slippageRate:1,maxExposureFraction:0.4,maxOrderFraction:0.1,minimumCashReserveFraction:0.05} }).ok, false);
});
