---
type: task
status: todo
created: 2026-04-09
parent: NOTE-0005
---

# Add metadata text routes to Worker

Add `/date`, `/title`, `/explanation`, `/copyright` routes to `src/index.ts` returning plain text (`text/plain; charset=utf-8`).

## Implementation

- Add a single route block after the `/about` handler, before the 404 fallback
- Match any of the four paths, call `fetchApod()` once, return the requested field
- Uses `fetchApod()` (not `findLatestImage`) so metadata reflects today's actual APOD, even if it's a video
- `/copyright` returns the literal string `none` when the field is absent (public domain)
- Error handling falls through to the existing outer `catch` block

## Implementation notes (from review)

- Must use `baseHeaders(origin, { "Content-Type": "text/plain; charset=utf-8" })` to inherit CORS, Cache-Control, and Link headers -- omitting this would break cross-origin consumers
- `fetchApod()` returns stale cache when available, throws `NasaApiError` when not -- errors fall through to the outer catch block by design

## Acceptance

- Each route returns the correct field as plain text with `Content-Type: text/plain; charset=utf-8`
- Response includes CORS and Cache-Control headers via `baseHeaders()`
- `/copyright` returns `none` for public domain images
- Cache behavior inherited from `fetchApod()` (6h primary / 24h stale)
