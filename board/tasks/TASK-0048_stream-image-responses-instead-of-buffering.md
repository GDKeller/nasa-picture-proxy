---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0003
---

# Stream image responses instead of buffering them

Keep large APOD images from pushing the Worker past its memory limit, and stop making clients wait on cache writes. Found in the PR #5 review (2026-10-30).

## Context

- `fetchImageCached` (`src/index.ts`) reads the whole image with `res.arrayBuffer()`, then builds three Responses from it (primary cache, stale cache, client).
- The 128 MB memory limit is per isolate, and one isolate serves many requests at once (workers/platform/limits#memory).
- `/sd` serves the `dynamicimage` path with no params, which NASA does not resize for PNGs. 2026-10-02 (`sharpless_catalog.png`) is 37.7 MB. A few concurrent cold misses on a day like that, such as right after a deploy, can exceed the limit.
- Cache writes for images, APOD records, and dimensions are awaited inline, so the first byte waits on them.

## Implementation

1. Stream the upstream body to the client and write the cache with `ctx.waitUntil(cache.put(key, res.clone()))`. Thread `ctx` from the `fetch` handler.
2. Drop the duplicate `:stale` image copy. Image URLs never change, so one entry with the 24h TTL is enough.
3. Move the APOD and dimension cache writes to `ctx.waitUntil` too.

## Acceptance

- No `arrayBuffer()` on image bodies in `src/`.
- Image responses start streaming before the cache write finishes.
- `npx tsc --noEmit` and `npm test` pass.
