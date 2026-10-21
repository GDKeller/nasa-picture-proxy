---
type: task
status: backlog
priority: 1
created: 2026-10-20
parent: EPIC-0006
---

# Fetch APOD metadata from the science.nasa.gov apod-basic API

Replace the broken api.nasa.gov source with NASA's new official endpoint, and validate what comes back so a bad upstream response is never cached or served. See EPIC-0006 for the source facts.

## Context

- `fetchApodFromNasa` (`src/index.ts:247-273`) calls `NASA_APOD_URL` (`https://api.nasa.gov/planetary/apod`, line 22) with `api_key` and `date`.
- It casts `res.json() as ApodResponse` (line 270) with no checks, then writes both cache tiers.
- `handleUpstreamFailure` (211-245) only runs on `!res.ok`. A 200 carrying the NASA logo goes straight into the cache.

## Implementation

1. **Fetch.** Replace `NASA_APOD_URL` with `https://science.nasa.gov/wp-json/wp/v2/apod-basic`.
   - Fetch `/${YYMMDD}` with `_fields=date,title,media_type,explanation,copyright,hdurl,permalink,basic_html`.
   - `basic_html` (about 11 KB, cached) is needed by TASK-0043 for video URLs and placeholder entries.
2. **Validate at the boundary** with a Zod 4 schema (add the `zod` dependency, and derive the upstream type with `z.infer`). Reject:
   - a missing or empty `title`
   - a `date` that doesn't match the requested date
   - a `media_type` outside `image` / `video`
3. **Normalize** in one function that maps the upstream record to the internal model.
   - Strip HTML from `explanation` and drop its leading `Explanation:` label.
   - Strip HTML from `copyright`. `stripHtml` (293-304) is reusable.
   - Keep the public `/info` field names (`title`, `date`, `explanation`, `url`, `hdurl`, `media_type`, `copyright`, `image_source`) stable for clients, and add `permalink`.
4. **Status handling:**
   - 404 `apod_basic_not_found` means "not published yet". Treat it as unresolvable so the walkback moves to the previous day. It is not an upstream failure, and nothing is cached for it. This covers the 00:00 to 00:05 ET window before NASA publishes.
   - Any other non-2xx status, or a validation failure, is an upstream failure and goes through `handleUpstreamFailure`.
   - Invalid data is never written to either cache tier.
5. **Remove the API key.** Delete `NASA_API_KEY` (`Env`, line 18), the `DEMO_KEY` fallback (line 598), and the `apiKey` parameter threaded through every fetch function.
   - Make the `NasaApiError` naming and the "NASA API rate limit exceeded…" / "NASA API returned…" messages (242-243) source-neutral.
   - Keep the 429 passthrough only if the new upstream can return 429. None was observed.
6. **User-Agent.** Send a descriptive one; reuse the scrape's `+https://nasapicture.com` UA.
7. **Tests** (`test/handler.test.ts`):
   - Replace `nasaImage()` / `nasaVideoNoThumb()` (161-180) and the `api.nasa.gov/planetary/apod` assertions (263, 331, 450, 494, 497) with apod-basic shapes.
   - Record real responses as fixtures: `261020` (image), `261018` (YouTube video), `261016` (MP4 video), a 404 unpublished date, and a logo-shaped response that must be rejected.

## Acceptance

- No request goes to api.nasa.gov. `NASA_API_KEY` and `DEMO_KEY` are gone from `src/`.
- `/info` for 2026-10-20 returns the title "An Anticrepuscular Rainbow Fan", a plain-text explanation and credit, and `date: 2026-10-20`.
- An unpublished date (404) triggers the walkback, not a 502.
- A response that fails validation is never written to the primary or stale cache, and a test proves it.
- `npx tsc --noEmit` and `npm test` pass.
