---
type: task
status: backlog
priority: 2
parent: NOTE-0019
created: 2026-04-03
---

# Add image dimensions to /info response

Add `width` and `height` fields to the `/info` JSON response so the landing page can pre-size the image container before the image loads.

## Approach

NASA's APOD API does not return dimensions. Options to obtain them:

1. Extract from `cf-image` response headers when processing via Image Transformations (may already be available from the `/optimized` path)
2. HEAD request to NASA's image CDN
3. Fetch a small portion of the image bytes to read dimensions from headers (JPEG SOF, PNG IHDR)

Option 1 is preferred if CF exposes original dimensions. Investigate first.

## Caching

Cache dimensions alongside the APOD metadata in the existing two-tier strategy (6h primary, 24h stale).

## Acceptance

- `GET /info` response includes `width` and `height` (integers, pixels) for today's APOD image
- Dimensions are cached and don't require extra fetches on subsequent requests
