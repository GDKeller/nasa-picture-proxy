---
type: task
status: done
created: 2026-04-01
---

# Add /optimized endpoint with Cloudflare Image Transformations

Add a new `/optimized` route (and `/image-optimized.jpg` alias) that serves today's APOD image through Cloudflare Image Transformations. Also switch the landing page hero to use this endpoint.

## Worker changes (`src/index.ts`)

- Add `/optimized` and `/image-optimized.jpg` to the router
- Fetch HD source image with `cf.image` options: `fit: "scale-down"`, `width: 1200`, `quality: 85`
- Auto-negotiate format: check `Accept` header for AVIF/WebP support
- Preserve existing edge caching (`cf.cacheTtl`, `cf.cacheEverything`) alongside transform options
- Update `/info` response to include the optimized URL
- Update `/about` text to list the new endpoint

## Landing page (`landing/index.html`)

- Change hero `<img>` src from `/` (HD) to `/optimized`
- Consider `srcset` with `/sd` and `/optimized` for responsive loading

## Verification

- Transformed response returns webp/avif `content-type` when browser supports it
- Falls back to JPEG for browsers without modern format support
- Image dimensions ≤1200px wide
- Edge caching still works (`cf-cache-status` header)
