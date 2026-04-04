---
type: note
status: inbox
created: 2026-04-03
---

# Generate CF thumbnail placeholder

Have Cloudflare Image Transformations generate a tiny thumbnail of the APOD image that loads instantly as a placeholder. On hero image load, crossfade from the scaled-up thumbnail to the full resolution.

This would solve the empty void users see while the hero image loads on slower connections (flagged as P3 in NOTE-0017).

## Approach

The `/optimized` endpoint already uses `cf: { image: { ... } }` for Image Transformations (scale-down to 1200px, auto WebP/AVIF). A new `/thumb` route could use the same pattern with aggressive settings:

```ts
const imageOpts: RequestInitCfPropertiesImage = {
  fit: "scale-down",
  width: 32,       // tiny thumbnail
  quality: 30,
  format: "webp",  // always WebP for smallest size
  blur: 5,         // optional: pre-blur server-side
};
```

Expected output: ~500B-2KB WebP. Small enough to inline as a base64 data URI in the `/info` response, or to load in parallel with near-zero latency.

## Implementation options

1. **New `/thumb` route** -- returns the tiny image directly. Landing page fetches it in parallel with the full image. Simple, cacheable independently.
2. **Inline in `/info` response** -- add a `thumbnail` field with a base64 data URI. One fewer request, but increases `/info` payload and couples the two.
3. **Build-time bake** -- not viable since the image changes daily.

Option 1 is cleanest. The landing page would:
1. Set the thumbnail as `background-image` on `.hero-image-area`
2. Load the full image via `<img>` as today
3. On `.loaded`, the image covers the thumbnail naturally

## Caching

Same two-tier strategy as other image routes (6h primary, 24h stale). Cache key based on ET date like everything else.
