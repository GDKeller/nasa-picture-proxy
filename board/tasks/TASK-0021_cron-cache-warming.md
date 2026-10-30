---
type: task
status: backlog
priority: 1
created: 2026-04-08
updated: 2026-04-09
parent: EPIC-0003
---

# Automated daily cache warming via Cron Trigger

**Priority 1** — today's-image reliability. Proactively populating the cache right after APOD rollover means the first visitor never hits a cold path, and (combined with TASK-0020) keeps a fresh entry in stale cache so NASA outages never exhaust our fallback.

## Problem

The Worker relies on visitor traffic to populate edge cache. With low traffic, the first visitor after APOD rollover gets a slow uncached response. Worse, if NASA's API is down and stale cache has expired, there's nothing to serve at all.

## Implementation

1. Add a `[triggers]` block to `wrangler.toml` with a cron schedule (e.g., `30 5 * * *` for 00:30 ET)
2. Export a `scheduled()` handler alongside the existing `fetch()` handler
3. The handler calls `findLatestImage`, `fetchImageCached` (HD + SD), and `fetchImageDimensions` to populate both cache tiers
4. Consider a second cron run (e.g., every 6h) to keep caches warm within the 6h primary TTL

## Considerations

- NASA sometimes publishes late after midnight ET; 00:30 ET is a reasonable first attempt
- Cron Triggers run in a single colo, so only that edge gets warmed. Other regions still cold on first hit, but API metadata is cached and NASA image fetches are fast.
- A single daily run doesn't cover the full 6h primary TTL. Running every 4-6h or accepting off-peak cold caches are both viable.
- Complementary to TASK-0020 (scraping fallback): warming prevents cold starts, scraping handles API outages.

## Local testing

Wrangler has a built-in way to invoke scheduled handlers without waiting for real cron time. No new dev flag needed.

1. **Start dev with scheduled testing enabled:** `npx wrangler dev --test-scheduled` (or confirm `npm run dev:api` passes the flag). Exposes `/__scheduled` for manual triggers.
2. **Trigger the handler:** `curl "http://localhost:8787/__scheduled?cron=30+5+*+*+*"` — simulates the 00:30 ET cron firing. Should return 200.
3. **Verify caches were populated:** immediately hit `curl "http://localhost:8787/info"` and `curl -I "http://localhost:8787/"`. Both should respond instantly from the warmed cache with no NASA upstream fetch in the logs.
4. **Check logs:** `npm run log:api` should show the scheduled handler running and what was warmed (date, HD/SD byte counts, dimensions).
5. **Integration with TASK-0020:** trigger the scheduled handler while `?dev=nasa-error` is... well, `/__scheduled` doesn't accept query params, so to exercise the "warmer falls through to scrape" path, set the `ENVIRONMENT=development` + a dev-env flag that makes the scheduled handler itself treat NASA as down. Simpler alternative: just flip the network off during the test.
6. **Multi-cron sanity:** if a second schedule is added (e.g., every 6h), trigger each with the corresponding `cron=` query and confirm both execute without error.

Reference: [Wrangler scheduled testing docs](https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/#test-scheduled-workers).

## Acceptance

- `scheduled()` handler warms APOD metadata, HD image, SD image, and dimensions after rollover
- Cache warming runs automatically with no external dependencies
- Handler logs what was warmed and for which date
- Local `/__scheduled` trigger produces the same result as a real cron invocation
