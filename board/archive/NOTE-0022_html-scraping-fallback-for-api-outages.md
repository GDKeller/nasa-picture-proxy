---
type: note
status: processed
created: 2026-04-08
---

# HTML scraping fallback for NASA API outages

## Context

On 2026-04-08, NASA's APOD API (`api.nasa.gov/planetary/apod`) returned 500 all day while the actual APOD webpage (`apod.nasa.gov/apod/`) served normally. With no traffic to keep the Worker's stale cache warm, the 24h stale cache expired and the site was down the entire day.

## Idea

Add a fallback in `fetchApodFromNasa` that scrapes the APOD HTML page when:

1. The NASA API returns a non-200 response
2. The stale cache is also empty

Scrape `https://apod.nasa.gov/apod/` to extract:
- Image URL (from the main `<img>` tag or `<a>` wrapping it)
- Title, explanation, date, copyright (from page structure)

This would make the proxy resilient to API-only outages, which appear to happen while the static APOD page stays up.

## HTML page structure

The APOD page (`apod.nasa.gov/apod/`) uses old-school table-based HTML. Key elements:

- **HD image**: `<a href="image/2604/earthset_original.jpg">` wrapping the `<img>` tag. Prefix with `https://apod.nasa.gov/apod/` to get the full URL.
- **SD image**: `<IMG SRC="image/2604/earthset_700.jpg">` inside that anchor. Same prefix needed.
- **Title**: `<center><b>Earthset</b></center>` (also in `<title>APOD: 2026 April 8  Earthset</title>`)
- **Date**: plain text `2026 April 8` in a `<p>` before the image
- **Explanation**: follows `<b>Explanation:</b>`, runs until the next `<p>` with credits
- **Copyright**: follows `<b>Image Credit:</b>` or `<b>Credit &amp; Copyright:</b>`
- **Video detection**: if the page has an `<iframe>` instead of an `<img>`, it's a video day

## Implementation approach

1. Add a `scrapeApodPage(log, date?)` function that fetches `https://apod.nasa.gov/apod/` (or `https://apod.nasa.gov/apod/apYYMMDD.html` for specific dates) and returns an `ApodResponse`
2. Use regex-based extraction (no DOM parser available in Workers)
3. Call it in `fetchApodFromNasa` after the stale cache miss, before throwing `NasaApiError`
4. Populate both primary and stale caches with the scraped result so subsequent requests are fast
5. Log clearly when the scrape fallback activates

## Considerations

- Regex parsing is fragile but the APOD page layout hasn't changed in years
- Only triggered as a last resort (API fail + no stale cache), so scraping isn't the normal code path
- The scrape fallback also needs to work inside `findLatestImage`'s lookback loop for date-specific pages
- Image URLs from the page are relative paths, need to be prefixed with `https://apod.nasa.gov/apod/`
