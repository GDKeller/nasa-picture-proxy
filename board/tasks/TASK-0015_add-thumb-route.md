---
type: task
status: backlog
priority: 2
parent: EPIC-0001
created: 2026-04-03
---

# Add /thumb route to Worker

Add a `/thumb` (and `/thumb.jpg` alias) route that returns a tiny thumbnail of today's APOD via Cloudflare Image Transformations.

## Implementation

Use the same pattern as `/optimized` with aggressive settings:

```ts
const imageOpts: RequestInitCfPropertiesImage = {
  fit: "scale-down",
  width: 32,
  quality: 30,
  format: "webp",
  blur: 5,
};
```

Expected output: ~500B-2KB WebP.

## Caching

Same two-tier strategy as other image routes (6h primary, 24h stale). Cache key based on ET date.

## Acceptance

- `GET /thumb` returns a tiny WebP thumbnail of today's APOD
- Response is cached with the standard two-tier strategy
- `/about` and route listing updated to include the new route
