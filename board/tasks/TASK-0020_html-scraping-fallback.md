---
type: task
status: todo
priority: 1
created: 2026-04-08
updated: 2026-04-09
parent: EPIC-0003
---

# HTML scraping fallback for NASA API outages

**Priority 1** — today's-image reliability. A NASA API 500 on 2026-04-08 took the service down for a stretch even though `apod.nasa.gov/apod/` was serving normally. Scraping the page as a last-resort data source closes that gap.

## Problem

NASA's API can return 500 while the actual APOD webpage (`apod.nasa.gov/apod/`) serves normally. Once the 24h stale cache expires with no traffic to refresh it, the Worker has nothing to serve. This happened on 2026-04-08.

## Implementation

1. Add a `scrapeApodPage(log, date?)` function that fetches `https://apod.nasa.gov/apod/` (or `apYYMMDD.html` for specific dates)
2. Use regex extraction (no DOM parser in Workers) to pull: image URL (HD + SD), title, date, explanation, copyright, media type (img vs iframe)
3. Image URLs from the page are relative paths, prefix with `https://apod.nasa.gov/apod/`
4. Insert the call in `fetchApodFromNasa` after stale cache miss, before throwing `NasaApiError`
5. Populate both primary (6h) and stale (24h) caches with the scraped result
6. Log clearly when scrape fallback activates

## Considerations

- Regex parsing is fragile but the APOD page layout hasn't changed in years
- Only triggered as last resort (API fail + no stale cache), not the normal path
- Must work inside `findLatestImage`'s lookback loop for date-specific pages
- See NOTE-0022 for full HTML structure analysis

## Local testing

Follow the project dev flag convention in **REFE-0001** (`?dev=<mode>`, dev-env gated). Simulating the NASA outage otherwise requires blocking real network traffic, which isn't worth the complexity.

1. **Add `?dev=nasa-error` mode.** When `devFlags.mode === "nasa-error"`, `fetchApodFromNasa` skips the upstream fetch and throws `NasaApiError` as if NASA returned a 500. This exercises the "primary cache miss + stale cache miss + NASA down" path where the scrape is the only option left.
2. **Test the scrape fallback path:**
   - Start `wrangler dev` fresh so both cache tiers are empty
   - `curl "http://localhost:8787/info?dev=nasa-error"` → expect a valid `/info` response sourced from the scraped webpage
   - `curl "http://localhost:8787/"` (no dev param) immediately after → should hit the cache populated by the scrape
   - `npm run log:api` should show a clear "scrape fallback activated" log line
3. **Test the stale-cache-present path:**
   - Let a normal request populate the cache (no dev param)
   - Then hit with `?dev=nasa-error` → should serve from **stale cache**, NOT trigger the scrape. Scrape is last resort only; stale cache wins first.
4. **Regex brittleness check:** manually verify `scrapeApodPage` extraction against 3-4 recent APOD pages with different shapes (photo with short caption, photo with long explanation, video page). Paste the HTML into a scratch file and run the regex against it, or hit real URLs in a throwaway script.
5. **Register the mode** in REFE-0001 "Current modes" table as part of this task.

## Acceptance

- When NASA API returns non-200 and stale cache is empty, Worker serves data scraped from the APOD webpage
- Scraped data populates both cache tiers for subsequent requests
- Scrape activation is clearly logged
- Normal API path is unaffected
- `?dev=nasa-error` mode is gated per REFE-0001 and cannot fire in production
- REFE-0001 "Current modes" table is updated
