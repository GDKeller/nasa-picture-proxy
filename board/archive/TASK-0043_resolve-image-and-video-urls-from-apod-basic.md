---
type: task
status: done
priority: 1
created: 2026-10-20
parent: EPIC-0006
blocked_by: [TASK-0042]
---

# Resolve APOD image and video URLs from apod-basic data

Map apod-basic's image fields to the bytes each route serves, restore original-resolution HD images, keep video days working, and lock the image allowlist to APOD assets.

## Context

`resolveApod` (`src/index.ts:123-141`) picks `hdurl`/`url` for images and `thumbnail_url` for videos. apod-basic changes all three:

- `url` is now the article permalink, not an image.
- `hdurl` is a re-encoded `dynamicimage` copy. On older or odd entries it is a placeholder PNG, or empty.
- There is no `thumbnail_url`.

`ALLOWED_IMAGE_HOSTS` (28-35) allows any `.nasa.gov` suffix, which is why the logo URL passed.

## Implementation

1. **HD** (`/`, `/image.jpg`): serve the original from `content/dam`.
   - Derive it from `hdurl` by swapping `/dynamicimage/assets/science/` for `/content/dam/science/` and dropping the query. If `hdurl` is already a `content/dam` URL (older eras), just drop the query.
   - If the derived original returns 404, use `hdurl` as given.
2. **SD** (`/sd`, `/image-sd.jpg`): serve the `dynamicimage` path with no params (1280px default).
3. **`/optimized` and `/thumb`:** keep the current `cf.image` options and source selection. Confirm Cloudflare Image Transformations can fetch from `assets.science.nasa.gov`. The 502s seen on 2026-10-20 came from the logo source.
4. **Video:**
   - YouTube day with a poster `hdurl` on assets.science.nasa.gov: serve the poster (`image_source: video_thumbnail`).
   - MP4 day (`hdurl: ""`) or no poster: treat as unresolvable and walk back, which is the existing behavior.
   - Extract the video URL from `basic_html` (`<iframe src="//www.youtube.com/embed/ID">`, normalized to `https:`, or `<video><source src>`) and expose it as `/info` `url` on video days, matching the old API contract.
5. **Placeholders:** if `hdurl` points to `/cosmic-origins/images/misc/news-thumbnail.png`, or any path outside the APOD asset tree, take the real image from `basic_html` (`<a href>` / `<IMG SRC>`). If there is none, the entry is unresolvable.
6. **Tighten `ALLOWED_IMAGE_HOSTS`:** replace the `.nasa.gov` suffix with the exact host `assets.science.nasa.gov`, and require the APOD asset path (`/cds/apod/`), so site chrome like the logo can never pass. Drop `.ytimg.com` / `.youtube.com` / `.vimeocdn.com` if nothing still serves images from them.
7. **Fixtures and tests:** update the dev fixtures `VIDEO_FIXTURE_*` and `devApodFixture` (80-105), the `resolveApod` cases in `test/pure.test.ts` (73-121), and the `?dev=video` / `?dev=video-no-thumb` handler tests to the new shapes.

## Acceptance

- `/` for 2026-10-20 serves the 5120x3840 original (`image/jpeg`, 1,100,460 B).
- `/sd` serves the 1280px rendition.
- 2026-10-18 (YouTube) serves the NASA poster. 2026-10-16 (MP4, no poster) walks back to the previous day.
- The NASA logo URL and the placeholder PNG are rejected, with tests.
- `/info` `width` and `height` are populated for images on the new host.
- `npx tsc --noEmit` and `npm test` pass.
