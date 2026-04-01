---
type: note
status: inbox
created: 2026-03-31
---

# Generate a daily OG image

Generate a new Open Graph image every day, resized and cropped to the optimal 1200x630px dimensions. Adding a text overlay with the logo would be a bonus.

## Context

The current OG image points to `https://api.nasapicture.com/image.jpg`, which serves the raw APOD at whatever dimensions NASA provides (often square or portrait). Social platforms expect 1200x630px for optimal previews.

## Recommended approach: `workers-og`

[`workers-og`](https://github.com/kvnang/workers-og) renders HTML/CSS to PNG entirely inside a Worker (Satori → SVG → PNG, no browser needed). This is purpose-built for OG image generation at the edge.

**How it would work:**
1. Add a `/og` route to the existing Worker (or a separate one)
2. Fetch today's APOD metadata from `/info` (title, date)
3. Render an HTML template with the APOD photo as background, title text, and nasapicture.com branding
4. Cache the result aggressively (24h TTL keyed to date) — one cold generation per day
5. Update the `og:image` meta tag to point to the new `/og` route

**Pros:** Single Worker, zero external dependencies, familiar HTML/CSS for layout, no billing (stays within free Workers tier since we're generating the image ourselves, not using Cloudflare's Images API).

**Cons:** Satori supports flexbox only (no CSS grid). Custom fonts need to be embedded as ArrayBuffers (adds to bundle size). Subset of CSS supported.

## Alternative: Cloudflare Images binding

Use the Images binding (`env.IMAGES`) to resize/crop the APOD to 1200x630 natively, then `.draw()` a pre-rendered text overlay PNG on top.

- Requires `[images] binding = "IMAGES"` in `wrangler.toml`
- Free tier: 5,000 unique transformations/month (we'd use ~30/month — well within limits)
- Higher-fidelity resizing with smart crop/gravity options
- More moving parts (two-step: resize + composite)

This is the upgrade path if `workers-og` quality isn't sufficient or if we need smarter cropping (e.g. face/subject detection).

## Not viable

- **Sharp** — uses native Node.js modules, incompatible with Workers
- **Canvas APIs** — no browser context in Workers

## Useful links

- [workers-og](https://github.com/kvnang/workers-og)
- [@cf-wasm/photon](https://www.npmjs.com/package/@cf-wasm/photon) — WASM image processing if more control is needed
- [Cloudflare Images: draw overlays](https://developers.cloudflare.com/images/transform-images/draw-overlays/)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) — free up to 5,000 transformations/month
