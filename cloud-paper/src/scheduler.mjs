// Pure, side-effect-free scheduling gate. No market access or order execution.
export function evaluatePaperTick({nowMs, lastTickMs, intervalMs = 300000, halted, enabled, marketFresh, storageHealthy}) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
      !Number.isSafeInteger(intervalMs) || intervalMs < 60000 ||
      !Number.isSafeInteger(lastTickMs) || lastTickMs < 0 || lastTickMs > nowMs) {
    return {run:false, reason:"invalid_clock_or_interval"};
  }
  if (!enabled) return {run:false, reason:"disabled"};
  if (halted) return {run:false, reason:"halted"};
  if (!storageHealthy) return {run:false, reason:"storage_unavailable"};
  if (!marketFresh) return {run:false, reason:"stale_market"};
  if (nowMs - lastTickMs < intervalMs) return {run:false, reason:"not_due"};
  return {run:true, reason:"dry_run_only", tickId:String(Math.floor(nowMs / intervalMs))};
}
