# CryptoPilot clean rebuild – acceptance gates

This branch replaces the legacy browser-dependent paper engine. Preserve the existing main branch and cloud resources until replacement is proven.

## Non-negotiable scope
- Cloudflare Free only; no private exchange API credentials, no live trading endpoints or real orders.
- Explicit manual enable, disable and emergency stop. Default disabled after new installation or invalid state.
- Cloudflare scheduled trigger runs independently of the browser. Every tick records an immutable execution identifier, timestamp, status and reason.
- Fetch fresh public market data, validate timestamp, symbol, numerical bounds and response; reject stale or missing data.
- Persistent wallet and journal use a single serialized writer (Durable Object or equivalent transactional storage), with idempotency keys per tick/signal. Never debit cash without recording the corresponding fill atomically.
- Apply fees, slippage, exposure limits, drawdown and cash checks before every virtual order; fail closed on price, authentication or storage errors.
- Deterministic, documented rules and configurable risk limits. No profit guarantees.

## Required tests and live evidence
1. Unit and integration tests: repeated/concurrent ticks, restart, duplicate event, stale price, price outage, storage failure, disabled state, emergency stop, risk limits and journal consistency.
2. Green CI and preview verification before merge/deployment.
3. Cloudflare Free deployment configuration and permissions checked without exposing secrets.
4. Independently observe scheduled production ticks and persisted BUY and SELL journal records. If market signals do not occur naturally, use a safe isolated paper-only validation scenario without falsifying production trade evidence.
5. Do not mark the product complete until the live evidence is captured. Clean up legacy components only after the replacement is verified.
