---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0005
---

# Generate daily OG image (1200x630) with workers-og

Render a new Open Graph image daily with the APOD photo cropped to 1200x630 and branded with a nasapicture.com wordmark. Spawned from NOTE-0008.

## Why

The current `og:image` points to `https://api.nasapicture.com/image.jpg`, which serves the raw APOD at whatever dimensions NASA provides (often square or portrait). Social platforms expect 1200x630 for optimal link previews.

## Approach: workers-og

[`workers-og`](https://github.com/kvnang/workers-og) renders HTML/CSS to PNG inside the Worker via Satori. No browser, no external service, free Workers tier.

### Implementation

1. Add a `/og` route to `src/index.ts`
2. Handler calls `findLatestImage` to get today's metadata, then renders an HTML template with the APOD image as background, title text, and nasapicture.com wordmark
3. Cache the PNG aggressively (24h TTL keyed to date) — one cold generation per day
4. Update the `og:image` meta tag in `landing/index.html` to point to `https://api.nasapicture.com/og`
5. Embed fonts (Source Serif / Sans) as ArrayBuffer imports

### Constraints (from NOTE-0008)

- Satori supports flexbox only (no grid)
- Custom fonts must be embedded as ArrayBuffers, adds to Worker bundle size
- Only a subset of CSS is supported — keep the template minimal

## Alternative (fallback if quality isn't sufficient)

Cloudflare Images binding (`env.IMAGES`) to resize/crop the APOD natively, then `.draw()` a pre-rendered text overlay PNG on top. Higher-fidelity resizing with smart crop/gravity. Free tier is 5,000 transformations/month; we'd use ~30. More moving parts, don't reach for it unless workers-og isn't good enough.

## Related

- TASK-0034 (OG HTML for crawlers) — benefits from this being in place
- TASK-0022 (annotated image endpoint) — shares the rendering pipeline, candidate for refactor after both land

## Acceptance

- `GET /og` returns a valid 1200x630 PNG
- Response cached for 24h, regenerates on rollover
- Twitter Card Validator and Facebook Sharing Debugger render the new image correctly
- Worker bundle size stays reasonable (measure before/after)
