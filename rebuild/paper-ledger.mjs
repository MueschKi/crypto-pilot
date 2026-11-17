// Pure paper-only ledger. No exchange order endpoints or credentials.
export function applyPaperOrder(state, order, policy = {}) {
  const feeRate = policy.feeRate ?? 0.004;
  const slippageRate = policy.slippageRate ?? 0.001;
  const maxExposure = policy.maxExposure ?? 0.4;
  const maxAgeMs = policy.maxAgeMs ?? 120000;
  const now = order?.now;
  if (!state || !Array.isArray(state.trades) || !Number.isFinite(state.cash) || state.cash < 0 ||
      !Number.isFinite(state.quantity) || state.quantity < 0 || !Number.isFinite(state.costBasis) || state.costBasis < 0 ||
      (state.quantity === 0 && state.costBasis !== 0) || (state.quantity > 0 && state.costBasis === 0))
    throw new Error("invalid wallet");
  if (typeof state.enabled !== "boolean" || typeof state.emergencyStop !== "boolean" ||
      state.trades.some(t => !t || typeof t.id !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(t.id) ||
        !["BUY", "SELL"].includes(t.side) || !Number.isFinite(t.quantity) || t.quantity <= 0 ||
        !Number.isFinite(t.executionPrice) || t.executionPrice <= 0 ||
        !Number.isFinite(t.fee) || t.fee < 0 ||
        !Number.isSafeInteger(t.priceTimestamp) || !Number.isSafeInteger(t.at) ||
        t.priceTimestamp < 0 || t.at < 0 || t.priceTimestamp > t.at ||
        (Number.isFinite(now) && t.at > now)) ||
      new Set(state.trades.map(t => t.id)).size !== state.trades.length ||
      state.trades.some((t, i) => i > 0 && (t.at < state.trades[i - 1].at ||
        t.priceTimestamp < state.trades[i - 1].priceTimestamp)))
    throw new Error("invalid wallet control or journal");
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0 || maxAgeMs > 120000 ||
      ![feeRate, slippageRate, maxExposure].every(Number.isFinite) ||
      feeRate < 0 || feeRate >= 1 || slippageRate < 0 || slippageRate >= 1 ||
      maxExposure <= 0 || maxExposure > 1) throw new Error("invalid policy");
  if (!state.enabled || state.emergencyStop) return { state, status: "disabled" };
  if (!order || typeof order.id !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(order.id))
    throw new Error("invalid id");
  const previous = state.trades.find(t => t.id === order.id);
  if (previous) {
    // Idempotency must not silently accept a conflicting order under an old key.
    const expectedPrice = order.price * (order.side === "BUY" ? 1 + slippageRate : 1 - slippageRate);
    if (order.side !== previous.side || order.quantity !== previous.quantity ||
        order.priceTimestamp !== previous.priceTimestamp ||
        !Number.isFinite(expectedPrice) || expectedPrice !== previous.executionPrice ||
        expectedPrice * order.quantity * feeRate !== previous.fee)
      throw new Error("conflicting idempotency key");
    return { state, status: "duplicate" };
  }
  if (state.trades.length && Number.isSafeInteger(now) && now < state.trades[state.trades.length - 1].at)
    throw new Error("order clock precedes persisted journal");
  // Never accept an older quote than the last persisted fill, even if it
  // remains within the normal freshness window after a restart.
  if (state.trades.length && Number.isSafeInteger(order.priceTimestamp) &&
      order.priceTimestamp < state.trades[state.trades.length - 1].priceTimestamp)
    throw new Error("quote precedes persisted journal");
  if (!["BUY", "SELL"].includes(order.side) || !Number.isFinite(order.price) || order.price <= 0 ||
      !Number.isFinite(order.quantity) || order.quantity <= 0 || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(order.priceTimestamp) || order.priceTimestamp < 0 || now < 0 || order.priceTimestamp > now ||
      now - order.priceTimestamp > maxAgeMs) throw new Error("invalid or stale quote/order");
  const executionPrice = order.price * (order.side === "BUY" ? 1 + slippageRate : 1 - slippageRate);
  const notional = executionPrice * order.quantity;
  const fee = notional * feeRate;
  if (![executionPrice, notional, fee].every(Number.isFinite) || executionPrice <= 0 || notional <= 0) throw new Error("overflow or underflow");
  const next = { ...state, trades: [...state.trades] };
  if (order.side === "BUY") {
    const equity = state.cash + state.quantity * order.price;
    if (!Number.isFinite(equity)) throw new Error("wallet valuation overflow");
    if (!Number.isFinite(notional + fee)) throw new Error("wallet debit overflow");
    if (notional + fee > state.cash) return { state, status: "insufficient_cash" };
    const projectedQuantity = state.quantity + order.quantity;
    const projectedExposure = projectedQuantity * order.price;
    const exposureCap = equity * maxExposure;
    if (![projectedQuantity, projectedExposure, exposureCap].every(Number.isFinite))
      throw new Error("wallet exposure overflow");
    if (projectedExposure > exposureCap)
      return { state, status: "exposure_limit" };
    next.cash -= notional + fee;
    next.quantity += order.quantity;
    next.costBasis += notional + fee;
  } else {
    if (order.quantity > state.quantity) return { state, status: "insufficient_position" };
    const basisRemoved = state.costBasis * (order.quantity / state.quantity);
    // A partial sale must actually reduce its recorded basis. Otherwise tiny
    // fills silently leave an inconsistent cost basis after persistence.
    if (order.quantity < state.quantity && (basisRemoved <= 0 || !Number.isFinite(basisRemoved) ||
        state.costBasis - basisRemoved === state.costBasis))
      throw new Error("cost basis precision underflow");
    next.cash += notional - fee;
    next.quantity -= order.quantity;
    next.costBasis -= basisRemoved;
    if (next.quantity === 0) next.costBasis = 0;
  }
  if (next.quantity === state.quantity || (order.side === "BUY" && next.cash === state.cash) ||
      (order.side === "SELL" && next.cash === state.cash)) throw new Error("wallet precision underflow");
  if (![next.cash, next.quantity, next.costBasis].every(Number.isFinite) ||
      next.cash < 0 || next.quantity < 0 || next.costBasis < 0)
    throw new Error("wallet arithmetic overflow");
  next.trades.push({ id: order.id, side: order.side, quantity: order.quantity, executionPrice, fee, priceTimestamp: order.priceTimestamp, at: now });
  return { state: next, status: "filled" };
}
