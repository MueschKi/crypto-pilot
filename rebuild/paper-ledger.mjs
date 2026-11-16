// Pure paper-only ledger. No exchange order endpoints or credentials.
export function applyPaperOrder(state, order, policy = {}) {
  const feeRate = policy.feeRate ?? 0.004;
  const slippageRate = policy.slippageRate ?? 0.001;
  const maxExposure = policy.maxExposure ?? 0.4;
  const maxAgeMs = policy.maxAgeMs ?? 120000;
  const now = order?.now;
  if (!state || !Array.isArray(state.trades) || !Number.isFinite(state.cash) || state.cash < 0 ||
      !Number.isFinite(state.quantity) || state.quantity < 0 || !Number.isFinite(state.costBasis) || state.costBasis < 0)
    throw new Error("invalid wallet");
  if (typeof state.enabled !== "boolean" || typeof state.emergencyStop !== "boolean" ||
      state.trades.some(t => !t || typeof t.id !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(t.id)) ||
      new Set(state.trades.map(t => t.id)).size !== state.trades.length)
    throw new Error("invalid wallet control or journal");
  if (!state.enabled || state.emergencyStop) return { state, status: "disabled" };
  if (!order || typeof order.id !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(order.id))
    throw new Error("invalid id");
  if (state.trades.some(t => t.id === order.id)) return { state, status: "duplicate" };
  if (!["BUY", "SELL"].includes(order.side) || !Number.isFinite(order.price) || order.price <= 0 ||
      !Number.isFinite(order.quantity) || order.quantity <= 0 || !Number.isFinite(now) ||
      !Number.isFinite(order.priceTimestamp) || order.priceTimestamp > now ||
      now - order.priceTimestamp > maxAgeMs) throw new Error("invalid or stale quote/order");
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0 || maxAgeMs > 120000 ||
      ![feeRate, slippageRate, maxExposure].every(Number.isFinite) ||
      feeRate < 0 || feeRate >= 1 || slippageRate < 0 || slippageRate >= 1 ||
      maxExposure <= 0 || maxExposure > 1) throw new Error("invalid policy");
  const executionPrice = order.price * (order.side === "BUY" ? 1 + slippageRate : 1 - slippageRate);
  const notional = executionPrice * order.quantity;
  const fee = notional * feeRate;
  if (!Number.isFinite(notional) || !Number.isFinite(fee)) throw new Error("overflow");
  const next = { ...state, trades: [...state.trades] };
  if (order.side === "BUY") {
    const equity = state.cash + state.quantity * order.price;
    if (!Number.isFinite(equity)) throw new Error("wallet valuation overflow");
    if (notional + fee > state.cash) return { state, status: "insufficient_cash" };
    const projectedQuantity = state.quantity + order.quantity;
    const projectedExposure = projectedQuantity * order.price;
    const exposureCap = equity * maxExposure;
    if (![projectedQuantity, projectedExposure, exposureCap].every(Number.isFinite))
      throw new Error("wallet exposure overflow");
    if (projectedExposure > exposureCap + 1e-9)
      return { state, status: "exposure_limit" };
    next.cash -= notional + fee;
    next.quantity += order.quantity;
    next.costBasis += notional + fee;
  } else {
    if (order.quantity > state.quantity) return { state, status: "insufficient_position" };
    const basisRemoved = state.costBasis * (order.quantity / state.quantity);
    next.cash += notional - fee;
    next.quantity -= order.quantity;
    next.costBasis -= basisRemoved;
    if (next.quantity < 1e-9) { next.quantity = 0; next.costBasis = 0; }
  }
  if (![next.cash, next.quantity, next.costBasis].every(Number.isFinite) ||
      next.cash < 0 || next.quantity < 0 || next.costBasis < 0)
    throw new Error("wallet arithmetic overflow");
  next.trades.push({ id: order.id, side: order.side, quantity: order.quantity, executionPrice, fee, priceTimestamp: order.priceTimestamp, at: now });
  return { state: next, status: "filled" };
}
