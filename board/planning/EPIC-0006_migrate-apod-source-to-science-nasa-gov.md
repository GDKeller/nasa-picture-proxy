---
type: epic
status: current
created: 2026-10-20
---

# Migrate APOD source to science.nasa.gov

**Priority: P1.** Production is serving the NASA logo instead of the Astronomy Picture of the Day.

## Problem

NASA moved APOD from apod.nasa.gov to science.nasa.gov. The APOD editor announced the move for August/September 2026, and a third party reports the cutover on 2026-09-29. Everything this Worker depends on broke:

- `api.nasa.gov/planetary/apod` returns 200 with `title: "NASA Science"` and `url`/`hdurl` set to `https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png` for every date checked. Only `explanation` is still correct.
- `apod.nasa.gov/apod/` and every dated `apYYMMDD.html` page 301-redirect to the `science.nasa.gov/apod/` index, so the scrape fallback (TASK-0020, dev only) can't reach a specific date.
- The `nasa/apod-api` README ("Final update 9-10-2026") says that repo will be archived and api.nasa.gov pointed at the new endpoint on 2026-12-01. The old API is not coming back in its old form.

Observed in production on 2026-10-20:
- `/sd` serves the logo PNG (8,928 B).
- `/info` reports the "NASA Science" title.
- `/optimized` and `/thumb` return 502.
- `/` timed out.

Why our code accepted it: the logo response is a 200 with `media_type: "image"` and a `*.nasa.gov` URL. It passes `res.ok`, `resolveApod`, and `ALLOWED_IMAGE_HOSTS`. Nothing validates content, so it was cached in both tiers (6h primary, 24h stale) under date-only keys.

## Approach

This is a permanent migration to NASA's new official endpoint. No temporary workarounds, and no relying on cached data to cover the gap.

- Replace api.nasa.gov with the science.nasa.gov `apod-basic` WordPress REST API, which needs no key.
- Validate upstream data at the boundary, so a bad upstream response is never cached or served.
- Remove the apod.nasa.gov scrape, which has no working target.
- Version cache keys so nothing cached from the old source is ever read again.

## Source facts (verified 2026-10-20)

**Endpoint**
- Single date: `GET https://science.nasa.gov/wp-json/wp/v2/apod-basic/YYMMDD` (for example `261020`).
  - An unpublished date returns 404 `{"code":"apod_basic_not_found"}`.
  - A malformed date returns 400 `rest_invalid_param`.
  - The archive goes back to 1995.
- Range: `?date_from=YYMMDD&date_to=YYMMDD` returns newest first. ISO dates are rejected with 400.
- With no args, the list returns newest first (`x-wp-total: 11442`).
- `_fields=` trims the response, for example 256 B instead of 11 KB without `basic_html`.

**Fields**
- `date`: ISO.
- `title`.
- `media_type`.
- `explanation`: HTML, prefixed with `<strong>Explanation: </strong>`.
- `credit` and `copyright`: HTML, and identical in every sample.
- `alt`.
- `hdurl`.
- `permalink`.
- `url`: now equals `permalink`. It is **not** an image.
- `basic_html`: legacy APOD-layout HTML.
- `post_id`.

**Publishing and images**
- A new APOD publishes at 00:05 ET (`article:published_time`), which matches our ET date keys.
- Images live on `assets.science.nasa.gov`:
  - **Original:** `/content/dam/science/cds/apod/apod/YYYY/<month>/<file>`. It ignores query strings. Per nasa/apod-api#183 it is byte-identical to the old apod.nasa.gov originals.
  - **`hdurl` for recent dates:** `/dynamicimage/assets/science/cds/apod/...?w=...`, a re-encoded copy. The two paths map directly: `dynamicimage/assets/science/...` to `content/dam/science/...`.
  - **`dynamicimage` with no params:** 1280px default. `?w=N` is honored up to the original width; `fm` and `q` are ignored.
- Some archive entries have a placeholder `hdurl` (`.../cosmic-origins/images/misc/news-thumbnail.png`). Their real image is only in `basic_html`.

**Video days**
- YouTube: `media_type: "video"`, and `hdurl` is a poster still on assets.science.nasa.gov. The embed URL is only in `basic_html` (`<iframe src="//www.youtube.com/embed/...">`).
- Self-hosted MP4: `hdurl: ""`, and `basic_html` has `<video><source src=".../X.mp4">`.

**Caching and limits**
- wp-json sends `max-age=60`; assets send `max-age=43200`.
- robots.txt allows `/wp-json/`.
- No rate-limit headers were observed.

**Other notes**
- RSS (`https://science.nasa.gov/feed/apod-basic/`) and the permalink pages serve the same data from the same WordPress origin, so they are not independent fallbacks.
- Known upstream issues:
  - nasa/apod-api#179: HTML in fields, `url` repurposed, no video field.
  - #181: date params.
  - #183: re-encoded `hdurl`.
  - #184: logo.

## Tasks

1. ~~**TASK-0042** [P1]: Fetch APOD metadata from the science.nasa.gov apod-basic API~~ [done]
2. ~~**TASK-0043** [P1]: Resolve APOD image and video URLs from apod-basic data~~ [done]
3. ~~**TASK-0044** [P1]: Remove the apod.nasa.gov scrape fallback~~ [done]
4. ~~**TASK-0045** [P1]: Version cache keys so pre-migration entries are never read~~ [done]
5. ~~**TASK-0046** [P1]: Update docs and user-facing text for the science.nasa.gov source~~ [done]
6. **TASK-0047** [P1]: Merge and deploy the APOD source migration to production [current]
7. ~~**TASK-0052** [P2]: Keep the APOD record when the cache write fails~~ [done, from the PR #5 review]
8. ~~**TASK-0053** [P2]: Validate cached entries before using them~~ [done, from the PR #5 review]
9. **TASK-0054** [P2]: Remove apod.nasa.gov from the Image Transformations sources (blocked by TASK-0047)

## Sequence

1. ~~TASK-0042 first. It defines the fetch, validation, and internal model.~~
2. ~~TASK-0043 and TASK-0044 in parallel.~~
3. ~~TASK-0045 can land any time before TASK-0047.~~
4. ~~TASK-0046.~~
5. ~~TASK-0052 and TASK-0053, from the PR #5 review.~~
6. **TASK-0047.**
7. TASK-0054, once production serves the new source.

## Cross-EPIC dependencies

These items assume the old source and need revisiting after this epic ships. None of them block it.

- **TASK-0021** (cron cache warming, EPIC-0003): it would currently warm caches with the logo, and it references `findLatestImage` (now `findLatestResolvable`).
- **TASK-0011** (R2 archive): its `{date}/hd.{ext}` / `{date}/sd.{ext}` keys assume the old hd/sd pair. It would currently archive the logo permanently.
- ~~**TASK-0027** copy cites DEMO_KEY's 30 req/hr limit. **TASK-0032** mentions the `NASA_API_KEY` secret. **TASK-0003** says "we proxy the APOD API".~~ Fixed 2026-10-30.
- **NOTE-0027** (download filename) parses apod.nasa.gov `/apod/image/YYMM/` URLs. The `content/dam` paths carry the original filename.
- ~~**REFE-0001** dev-mode table (`nasa-error`, `video`, `video-no-thumb`).~~ Fixed 2026-10-30.
- **Monitoring:** nothing alerted on this outage. NOTE-0029 (Sentry) or an upstream sanity alert would catch the next silent upstream change.
