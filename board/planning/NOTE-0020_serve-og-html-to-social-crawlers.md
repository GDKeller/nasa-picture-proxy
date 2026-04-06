---
type: note
status: inbox
created: 2026-04-06
---

# Serve OG HTML to social crawlers on api.nasapicture.com

## Problem

Twitter/Facebook/etc. link previews need an HTML page with Open Graph meta tags. When their crawlers hit `api.nasapicture.com/`, the Worker responds with `Content-Type: image/jpeg` (the raw APOD image), so there's no HTML to parse and no card renders. This means tweets linking `api.nasapicture.com` show no preview image.

## Fix

In the Worker, sniff the `User-Agent` header on incoming requests to the image routes. If the UA matches a known social crawler, return an HTML document with OG tags instead of the image bytes. Otherwise, behave as today and return the image.

## Affected routes

The crawler check should run before the image response for these route groups in `src/index.ts`:

- `hdPaths`: `/`, `/image.jpg`
- `sdPaths`: `/sd`, `/image-sd.jpg`
- `optimizedPaths`: `/optimized`, `/image-optimized.jpg`
- `thumbPaths`: `/thumb`, `/thumb.jpg`

The `/info` and `/about` routes already return text, so they don't need this.

## Implementation approach

1. **Add a `isSocialCrawler(request)` helper** that reads `User-Agent` and tests against a regex of known crawler substrings (case-insensitive).

2. **Add a `buildOgHtml(apod, requestUrl)` helper** that takes the APOD metadata (already fetched by `findLatestImage`) and the request URL, and returns a minimal HTML string with OG tags.

3. **Insert the check early in each image route block**, after `findLatestImage` resolves but before fetching the upstream image. If it's a crawler, return the OG HTML and skip the image fetch entirely (saves bandwidth and latency).

```
if (isSocialCrawler(request)) {
  const apod = await findLatestImage(log, apiKey);
  res = new Response(buildOgHtml(apod, reqUrl), {
    headers: baseHeaders(origin, { "Content-Type": "text/html; charset=utf-8" }),
  });
}
```

Since `findLatestImage` is already called for these routes, the crawler path just skips the image fetch/transform step.

## Crawler User-Agents to match (case-insensitive substring)

- `Twitterbot`
- `facebookexternalhit`
- `Facebot`
- `Slackbot`
- `Discordbot`
- `LinkedInBot`
- `TelegramBot`
- `WhatsApp`
- `Pinterest`
- `redditbot`

## HTML response shape

Minimal document with:

- `<title>` — APOD title + "| nasapicture.com"
- `<meta name="description">` — truncated APOD explanation
- `og:title`, `og:description`, `og:type=website`, `og:url`
- `og:image` — `https://api.nasapicture.com/sd` (standard res is more reliable for card dimensions)
- `og:image:width` / `og:image:height` — from `fetchImageDimensions` if available, omit if not
- `og:site_name` — "nasapicture.com"
- `twitter:card=summary_large_image`, `twitter:image`, `twitter:title`, `twitter:description`

## Caching consideration

Crawler responses can use the same cache TTL as regular image responses. The OG HTML is date-keyed (same APOD metadata), so it rolls over at midnight ET like everything else. Consider using a distinct cache key suffix (e.g., `:og`) to avoid serving HTML from the image cache or vice versa.

## Testing

- Use `curl -A "Twitterbot/1.0"` to verify the crawler path returns HTML
- Use `curl` with no special UA to verify normal image behavior is unchanged
- Validate the returned HTML with the [Twitter Card Validator](https://cards-dev.twitter.com/validator) and [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
