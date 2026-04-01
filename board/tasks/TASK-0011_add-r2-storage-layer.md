---
type: task
status: todo
created: 2026-04-01
blocked-by: TASK-0010
---

# Add R2 storage layer for APOD image archiving

Add Cloudflare R2 as a persistent storage/origin layer between edge cache and NASA API. Every image fetched from NASA gets stored in R2, building an automatic archive and providing resilience if NASA is slow or down.

## Infrastructure

- Create R2 bucket (e.g., `apod-archive`)
- Add R2 binding in `wrangler.toml`: `[[r2_buckets]]` with `binding = "APOD_ARCHIVE"`
- Update `Env` interface in `src/index.ts` to include the R2 binding

## R2 key structure

- `{date}/hd.{ext}` — HD image
- `{date}/sd.{ext}` — SD image
- `{date}/info.json` — metadata snapshot

## Worker changes (`src/index.ts`)

- Refactor image fetching to layered lookup: Edge cache → R2 → NASA
- On R2 miss: fetch from NASA, store in R2 (`bucket.put()`), then serve
- On R2 hit: serve directly from R2 with appropriate `Content-Type`
- `/optimized` applies `cf.image` transforms on top of R2-served images
- Cache metadata in R2 alongside images

## Edge caching preserved

- `cf.cacheTtl` and `cf.cacheEverything` remain on all responses
- R2 replaces NASA as the origin; edge cache sits in front

## Cache invalidation

Once an image is in R2, it's permanent — if NASA corrects or replaces an image at the same URL, we'd serve the stale version. Low risk (NASA rarely edits published APODs) but worth a safety valve:

- For the current day's image, treat R2 as a cache with a short TTL (e.g., re-fetch from NASA if R2 object is <1 hour old and edge cache misses) — allows corrections to propagate same-day
- For past dates, serve from R2 unconditionally (immutable after rollover)
- Consider an auth-protected manual purge endpoint (e.g., `DELETE /admin/purge/{date}`) to force re-fetch from NASA on demand

## Verification

- First request stores to R2 (check via `wrangler r2 object get`)
- Subsequent requests serve from R2 without hitting NASA
- Edge caching still works in front of R2
- `/optimized` transforms apply correctly on R2-sourced images
