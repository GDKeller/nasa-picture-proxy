---
type: task
status: todo
created: 2026-04-08
parent: EPIC-0003
---

# Automated daily cache warming via Cron Trigger

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

## Acceptance

- `scheduled()` handler warms APOD metadata, HD image, SD image, and dimensions after rollover
- Cache warming runs automatically with no external dependencies
- Handler logs what was warmed and for which date
