---
type: note
status: processed
created: 2026-04-08
---

# Add annotated image endpoint with title and explanation

## Idea

A new endpoint (e.g., `/annotated` or `/card`) that composites the APOD title and explanation text onto the image itself. For people who want context with the photo, not just the photo alone. Useful as a wallpaper with built-in caption, a shareable card, or a daily briefing image.

## Related

- NOTE-0008 (generate daily OG image) is similar in that both composite text onto the APOD image, but OG serves social crawler previews at specific dimensions. This endpoint is user-facing and could have different layout/sizing goals. Implementation could share the same rendering pipeline.

## Open questions

- What rendering approach? Cloudflare Workers have no canvas/DOM, so options include:
  - **Cloudflare Image Transformations `draw` overlay**: can composite images but not arbitrary text
  - **SVG foreignObject rendered to image**: build an SVG with embedded text, render via cf image transforms
  - **External service (e.g., Satori/resvg-wasm)**: generate an image from JSX/HTML in the Worker using WASM. Satori is what Vercel's OG image generation uses. Would need to bundle the WASM into the Worker.
  - **Pre-rendered via R2**: generate the image externally (GitHub Action, cron job) and store in R2
- How much explanation text to include? Full explanation can be several paragraphs. Truncation or a short summary might work better.
- Layout: text overlay on the image (risk of readability), or extend the canvas with a text panel below/beside?
- Should this share infrastructure with NOTE-0008 (OG image)?
