# Internal session revocation – not a public administration API

`PaperSessions` accepts `POST /admin/revoke-token` (a single `jti`) and `POST /admin/revoke-all` (monotonic `revokedBefore`) **only through its internal Durable Object binding**, with a separate server-side `PAPER_ADMIN_KEY` of at least 32 characters. The public Worker has **no routing to these paths**. The admin secret must not be in the browser, repository, CI logs or client-issued tokens.

This is a guarded internal primitive, **not** a complete secure administrative service. A future separate trusted operator service must authenticate administrators with a strong identity provider, enforce per-subject authorization, rate limits, audit every action, protect the admin secret and supply a safe method for identifying the target user's DO. Until then no operator endpoint should be exposed.

The `revokedBefore` cutoff is monotonic. Revoking at time `t` invalidates tokens issued at or before `t`. Token issuance must enforce monotonic timestamps; tokens issued in the same second are also revoked. The per-token revocation set remains durable and scoped to the subject.

The public Worker fails closed on session DO errors. No Cloudflare deployment or real trading is authorized.
