---
type: task
status: backlog
created: 2026-04-08
---

# Annotated image endpoint with title and explanation

## Idea

A new endpoint (e.g., `/annotated` or `/card`) that composites the APOD title and explanation onto the image. Useful as a wallpaper with built-in caption, a shareable card, or a daily briefing image.

## Open questions

- **Rendering approach**: Workers have no canvas/DOM. Options: SVG foreignObject via CF image transforms, Satori/resvg-wasm bundled in the Worker, or pre-rendered via R2 + external job.
- **Text length**: Full explanation can be paragraphs. Truncation or summary needed.
- **Layout**: Text overlay on image (readability risk) vs. extended canvas with text panel.
- **Shared infra with NOTE-0008** (OG image): both composite text on images, could share a rendering pipeline.

## Related

- NOTE-0008 (OG image generation)
- NOTE-0024 (original exploration)

## Acceptance

- TBD pending resolution of open questions
