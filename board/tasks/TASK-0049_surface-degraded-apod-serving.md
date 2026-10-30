---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0003
---

# Surface degraded APOD serving

Make it visible when the Worker serves something other than today's APOD, so the next silent upstream change is caught in hours, not weeks. Found in the PR #5 review (2026-10-30).

## Context

- The 2026-10-20 logo outage ran for weeks because nothing alerted.
- Serving an older day (walkback `lookback > 0`), a stale entry, or a 502 is only logged through `console.log`, buffered and printed at the end of the request. A hung or cancelled request logs nothing.
- `wrangler.toml` has no `[observability]` section, and no response header says which date was served.
- Related: NOTE-0029 (Sentry).

## Implementation

1. `console.error` when serving a walked-back day, a stale entry, or a 502.
2. Add an `X-APOD-Date` response header on every route, so an uptime check can assert it equals today's ET date.
3. Enable `[observability]` in `wrangler.toml`.

## Acceptance

- A walked-back, stale, or failed response produces an error-level log line.
- Every image and `/info` response carries `X-APOD-Date`, with a test.
- `npx tsc --noEmit` and `npm test` pass.
