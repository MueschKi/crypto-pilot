// Pure, deterministic paper-only risk and fill calculations. No exchange order API.
export const DEFAULT_RISK = Object.freeze({
  feeRate: 0.004, slippageRate: 0.001, maxExposureFraction: 0.4,
  maxOrderFraction: 0.1, minimumCashReserveFraction: 0.05,
});
function finiteNonnegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
export function evaluatePaperOrder({ side, price, quantity, cash, assetQuantity, equity, risk = DEFAULT_RISK }) {
  if (!["BUY", "SELL"].includes(side)) return { ok: false, reason: "INVALID_SIDE" };
  if (![price, quantity, cash, assetQuantity, equity].every(finiteNonnegative) ||
      price === 0 || quantity === 0 || equity === 0) return { ok: false, reason: "INVALID_INPUT" };
  const { feeRate, slippageRate, maxExposureFraction, maxOrderFraction, minimumCashReserveFraction } = risk ?? {};
  if (![feeRate, slippageRate, maxExposureFraction, maxOrderFraction, minimumCashReserveFraction]
      .every(x => finiteNonnegative(x) && x <= 1)) return { ok: false, reason: "INVALID_RISK" };
  const executionPrice = price * (side === "BUY" ? 1 + slippageRate : 1 - slippageRate);
  if (!(executionPrice > 0)) return { ok: false, reason: "INVALID_EXECUTION_PRICE" };
  const gross = executionPrice * quantity;
  const fee = gross * feeRate;
  if (![executionPrice, gross, fee].every(Number.isFinite)) return { ok: false, reason: "OVERFLOW" };
  if (side === "BUY") {
    const debit = gross + fee;
    const reserve = equity * minimumCashReserveFraction;
    const orderCap = equity * maxOrderFraction;
    const exposure = (assetQuantity + quantity) * executionPrice;
    const exposureCap = equity * maxExposureFraction;
    if (![debit, reserve, orderCap, exposure, exposureCap].every(Number.isFinite))
      return { ok: false, reason: "OVERFLOW" };
    if (debit > cash - reserve)
      return { ok: false, reason: "INSUFFICIENT_CASH_OR_RESERVE" };
    if (gross > orderCap) return { ok: false, reason: "ORDER_LIMIT" };
    if (exposure > exposureCap)
      return { ok: false, reason: "EXPOSURE_LIMIT" };
    return { ok: true, side, quantity, executionPrice, fee, cashDelta: -debit, assetDelta: quantity };
  }
  if (quantity > assetQuantity) return { ok: false, reason: "INSUFFICIENT_ASSET" };
  const proceeds = gross - fee;
  if (!Number.isFinite(proceeds) || !Number.isFinite(cash + proceeds))
    return { ok: false, reason: "OVERFLOW" };
  return { ok: true, side, quantity, executionPrice, fee, cashDelta: proceeds, assetDelta: -quantity };
}
