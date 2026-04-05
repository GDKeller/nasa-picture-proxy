---
type: epic
status: done
created: 2026-04-03
---

# Image Optimization Pipeline

Eliminate the empty void users see while the hero image loads, and give the landing page correctly-sized containers before image bytes arrive. Two Worker-side changes (thumbnail route, dimension metadata) feed one landing page integration.

## Goal

A visitor on a slow connection sees: tiny blurred placeholder instantly, correct aspect-ratio container (no layout shift), then full image crossfades in on load.

## Sequence

The tasks have a natural dependency chain:

1. **TASK-0015: Add /thumb route to Worker** -- New endpoint using Cloudflare Image Transformations (32px wide, quality 30, WebP, optional blur). Expected output ~500B-2KB. Same two-tier cache strategy (6h primary, 24h stale) with ET date-based keys.
2. **TASK-0016: Add image dimensions to /info response** -- Extract original width/height during image processing (possibly from `cf-image` response headers on the existing `/optimized` path). Add `width` and `height` fields to the JSON response. Cached alongside existing metadata.
3. **TASK-0017: Add thumbnail placeholder and pre-sized container to landing page** -- Blocked by TASK-0015 and TASK-0016. Fetch `/thumb` and `/info` in parallel on page load. Set container aspect ratio from dimensions, show scaled-up thumbnail as background, crossfade to full image on load.

## Open Questions

- Does Cloudflare Image Transformations expose original dimensions in response headers? If so, TASK-0016 gets dimensions for free from the `/optimized` path.
- Should dimensions be full pixel values or just the aspect ratio?

## Related Notes

- NOTE-0018: Generate CF thumbnail placeholder (design exploration)
- NOTE-0019: Pre-size image container using metadata (design exploration)
