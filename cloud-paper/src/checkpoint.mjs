// Persistent, paper-only tick checkpoint. No order execution or exchange access.
// Requires a transactional Durable Object storage facade with get/put.
export async function checkpointPaperTick(storage, {tickId, nowMs, halted, enabled, marketFresh}) {
  if (typeof tickId !== "string" || !/^(0|[1-9][0-9]{0,15})$/.test(tickId)
      || !Number.isSafeInteger(nowMs) || nowMs < 0)
    return {accepted:false, reason:"invalid_tick"};
  if (!enabled) return {accepted:false, reason:"disabled"};
  if (halted) return {accepted:false, reason:"halted"};
  if (!marketFresh) return {accepted:false, reason:"stale_market"};
  if (!storage || typeof storage.transaction !== "function")
    return {accepted:false, reason:"storage_unavailable"};
  try {
    return await storage.transaction(async tx => {
      const last = await tx.get("paper_tick_checkpoint");
      if (last !== undefined && (typeof last !== "object" || last === null
          || !/^(0|[1-9][0-9]{0,15})$/.test(last.tickId)
          || !Number.isSafeInteger(last.nowMs) || last.nowMs < 0))
        throw new Error("invalid checkpoint");
      if (last && BigInt(tickId) <= BigInt(last.tickId))
        return {accepted:false, reason:"duplicate_or_old"};
      await tx.put("paper_tick_checkpoint", {tickId,nowMs});
      return {accepted:true, reason:"checkpoint_only",tickId};
    });
  } catch (_) {
    return {accepted:false, reason:"storage_unavailable"};
  }
}
