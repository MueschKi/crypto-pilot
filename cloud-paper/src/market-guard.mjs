// Paper-only market-data validation. No fetch, secrets, or exchange order execution.
const SYMBOLS = new Set(["BTC","ETH","SOL","NEAR"]);
export function validatePaperQuote(quote, nowMs, maxAgeMs=60000) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
      !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 300000)
    return {ok:false,reason:"invalid_clock"};
  if (!quote || typeof quote !== "object" || Array.isArray(quote) ||
      !SYMBOLS.has(quote.symbol) ||
      !Number.isSafeInteger(quote.priceCents) || quote.priceCents <= 0 ||
      !Number.isSafeInteger(quote.timestampMs) || quote.timestampMs < 0)
    return {ok:false,reason:"invalid_quote"};
  if (quote.timestampMs > nowMs + 1000)
    return {ok:false,reason:"future_quote"};
  if (nowMs - quote.timestampMs > maxAgeMs)
    return {ok:false,reason:"stale_quote"};
  return {ok:true,symbol:quote.symbol,priceCents:quote.priceCents,timestampMs:quote.timestampMs};
}
