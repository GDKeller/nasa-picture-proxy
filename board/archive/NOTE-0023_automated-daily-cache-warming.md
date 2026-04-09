---
type: note
status: processed
created: 2026-04-08
---

# Automate daily cache warming after APOD rollover

## Problem

The Worker relies on visitor traffic to populate its edge cache. With low traffic (new site), there may be no requests for hours after the daily APOD rollover at midnight ET. This means:

- The first visitor of the day gets a slow, uncached response
- If NASA's API is down and stale cache has expired (24h TTL), there's nothing to serve at all (exactly what happened on 2026-04-08)

## Idea

Automatically hit the Worker's endpoints shortly after midnight ET each day to warm the cache, so the APOD metadata and image bytes are always ready regardless of traffic.

## Options

### 1. Cloudflare Workers Cron Trigger
Add a `scheduled()` handler to the Worker itself. Cloudflare runs it on a cron schedule (e.g., `0 5 * * *` for 05:00 UTC / midnight ET). The handler would call `findLatestImage` and `fetchImageCached` internally to populate the cache. No external service needed.

### 2. GitHub Actions cron
A scheduled workflow that curls the Worker endpoints. Simple but adds an external dependency and GitHub's cron scheduling has up to 15 min of jitter.

### 3. External uptime monitor
Services like UptimeRobot or Cronitor can ping URLs on a schedule. Doubles as uptime monitoring. Adds an external dependency.

## Recommendation

Option 1 (Cron Trigger) is the cleanest, lives in the same codebase, and runs on Cloudflare's infrastructure with no external dependencies. The `scheduled()` handler could warm `/info`, `/` (HD image), and `/thumb` in one pass.

## Implementation detail (Cron Trigger)

### wrangler.toml

Add a triggers block:

```toml
[triggers]
crons = ["30 5 * * *"]   # 05:30 UTC = 00:30 ET (EST) / 01:30 ET (EDT)
```

### src/index.ts

Export a `scheduled()` handler alongside the existing `fetch()`:

```ts
export default {
  async fetch(request, env) { /* existing handler */ },

  async scheduled(event, env, ctx) {
    const log: string[] = [];
    const apiKey = env.NASA_API_KEY || "DEMO_KEY";

    // Warm APOD metadata + find today's image
    const apod = await findLatestImage(log, apiKey);
    const imageUrl = apod.hdurl || apod.url;

    // Warm HD image bytes
    await fetchImageCached(log, imageUrl);

    // Warm SD image bytes (if different)
    if (apod.url !== imageUrl) {
      await fetchImageCached(log, apod.url);
    }

    // Warm image dimensions (used by /info)
    await fetchImageDimensions(log, imageUrl);

    console.log(`[scheduled] Cache warmed for ${apod.date}`);
    for (const line of log) console.log(line);
  },
};
```

No new dependencies. The handler reuses `findLatestImage`, `fetchImageCached`, and `fetchImageDimensions` which already populate both primary (6h) and stale (24h) caches.

## Considerations

- APOD rollover is midnight ET, but NASA sometimes publishes late. 00:30 ET is a reasonable first attempt. Could add a second cron (e.g., `0 7 * * *` / 02:00 ET) as a safety net.
- Cron Triggers run in a single colo, so cache warming only covers that edge. First visitors from other regions still get a cold cache, but the API metadata is cached and image fetches from NASA are fast.
- The 6h primary cache TTL means a single daily cron isn't enough to keep the cache warm all day. Options: run the cron every 4-6 hours, or accept that off-peak hours may have cold caches.
- Related to NOTE-0022 (HTML scraping fallback): both address resilience, but serve different purposes. Cache warming prevents cold starts; scraping handles API outages.
