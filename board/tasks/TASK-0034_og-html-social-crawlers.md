---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0005
---

# Serve OG HTML to social crawlers on api.nasapicture.com

When Twitter/Facebook/Slack/etc. crawl `api.nasapicture.com/`, the Worker responds with `Content-Type: image/jpeg` and no HTML, so link previews fail to render. Sniff the User-Agent and return an HTML document with OG tags for known crawlers, unchanged image bytes for everyone else. Spawned from NOTE-0020.

## Affected routes

Add the crawler check early in each image route block in `src/index.ts`, after `findLatestImage` resolves but before fetching upstream bytes:

- `hdPaths`: `/`, `/image.jpg`
- `sdPaths`: `/sd`, `/image-sd.jpg`
- `optimizedPaths`: `/optimized`, `/image-optimized.jpg`
- `thumbPaths`: `/thumb`, `/thumb.jpg`

`/info` and `/about` already return text; they don't need this.

## Implementation

1. `isSocialCrawler(request)` helper that tests the `User-Agent` header against a case-insensitive substring list
2. `buildOgHtml(apod, requestUrl)` helper that returns a minimal HTML document with OG + Twitter-card tags
3. Insert early in each image route, skipping the image fetch entirely on the crawler path:

```ts
if (isSocialCrawler(request)) {
  const apod = await findLatestImage(log, apiKey);
  res = new Response(buildOgHtml(apod, reqUrl), {
    headers: baseHeaders(origin, { "Content-Type": "text/html; charset=utf-8" }),
  });
}
```

## Crawler substrings (case-insensitive)

`Twitterbot`, `facebookexternalhit`, `Facebot`, `Slackbot`, `Discordbot`, `LinkedInBot`, `TelegramBot`, `WhatsApp`, `Pinterest`, `redditbot`

## HTML shape

- `<title>`: APOD title + " | nasapicture.com"
- `<meta name="description">`: truncated APOD explanation
- `og:title`, `og:description`, `og:type=website`, `og:url`
- `og:image`: `https://api.nasapicture.com/og` once TASK-0033 ships, otherwise `/sd` (SD is more reliable for card dimensions than HD)
- `og:image:width` / `og:image:height` from `fetchImageDimensions` when available; omit if not
- `og:site_name`: `nasapicture.com`
- `twitter:card=summary_large_image`, `twitter:image`, `twitter:title`, `twitter:description`

## Caching

Distinct cache key suffix (e.g. `:og`) so HTML and image caches don't collide. Same 6h primary / 24h stale TTL as the image responses.

## Testing

- `curl -A "Twitterbot/1.0" https://api.nasapicture.com/` returns HTML with OG tags
- `curl https://api.nasapicture.com/` (default UA) still returns image bytes
- Validate with Twitter Card Validator and Facebook Sharing Debugger

## Acceptance

- All listed crawlers receive HTML with OG/Twitter tags on image routes
- Non-crawler requests are unchanged
- No regression in image response caching
