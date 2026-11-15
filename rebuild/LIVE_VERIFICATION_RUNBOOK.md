# Live verification protocol (Cloudflare Free)

This protocol is an operational release gate, not proof of current deployment. Do not claim success from unit tests, configured cron schedules, or an HTTP health endpoint alone.

## Preconditions
1. Confirm the exact commit SHA of main and PR #85; require green CI for the proposed commit. Confirm preview Worker configuration matches production bindings and the cron trigger exists.
2. Verify Cloudflare Free compatibility, Durable Object migrations/bindings, and absence of exchange private credentials and any real-order API route. Preserve existing production until the replacement is proven.
3. Check that synthetic smoke trading is disabled by default. Ensure only explicit manual paper enable permits orders. Confirm emergency stop prevents subsequent orders.

## Evidence collection
- Record the deployed Worker version and deployment timestamp.
- Observe at least two **actual scheduled** invocations with distinct execution IDs and timestamps, not only a configured trigger. Cross-check Cloudflare invocation metrics against application-side persisted tick records.
- For each tick, verify quote source, market symbol, quote freshness, outcome and redacted failure category. Do not log secrets or full auth headers.
- Read wallet and journal from persistent storage **after** the execution; check balances, fill fee/slippage, position limits and stable idempotency key. Repeat a tick ID and verify no duplicate fill or debit.
- Confirm both BUY and SELL persisted with corresponding wallet transitions. Natural market conditions may not generate both promptly: use an explicitly isolated, bounded, paper-only validation environment for deterministic BUY/SELL, and label it as a test, never as organic strategy performance.
- Restart the Worker and verify wallet/journal survive. Test stale quote, provider outage, storage failure, manual stop, emergency stop and risk breach: all must produce no order.

## Decision
- PASS only when deployment identity, scheduled invocation, storage readback and BUY/SELL evidence are all captured, and no safety regression exists.
- BLOCKED when Cloudflare access, binding, deployment permissions or logs are unavailable: name the missing permission/resource precisely and do not deploy or mark complete.
- FAIL when invocations are missing, orders are duplicated, data are stale, or storage readback fails: keep the old production and fix the defect before promotion.

## Known diagnostic pitfall
Wrangler tail stdout can contain ANSI/status lines or non-JSON diagnostics. `invalidJsonLines > 0` does not establish either successful cron execution or failure of the cron itself. Inspect sanitized error categories and corroborate via Cloudflare scheduled invocation metrics and persisted tick IDs; never treat tail silence as evidence of no ticks.
