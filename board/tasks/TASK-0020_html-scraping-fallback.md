---
type: task
status: todo
created: 2026-04-08
parent: EPIC-0003
---

# HTML scraping fallback for NASA API outages

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

## Acceptance

- When NASA API returns non-200 and stale cache is empty, Worker serves data scraped from the APOD webpage
- Scraped data populates both cache tiers for subsequent requests
- Scrape activation is clearly logged
- Normal API path is unaffected
