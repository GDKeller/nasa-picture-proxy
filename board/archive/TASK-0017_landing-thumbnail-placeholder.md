---
type: task
status: done
priority: 2
blocked_by: TASK-0015, TASK-0016
parent: EPIC-0001
created: 2026-04-03
---

# Add thumbnail placeholder and pre-sized container to landing page

Use the `/thumb` and `/info` dimensions endpoints to show a scaled-up thumbnail placeholder while the full hero image loads, inside a correctly-sized container.

## Implementation

1. Fetch `/info` and set `width`/`height` attributes on the `<img>` so the browser reserves the correct aspect ratio
2. Fetch `/thumb` and set it as `background-image` on `.hero-image-area` (or a wrapper), scaled up with CSS
3. On `img.loaded`, the full image covers the thumbnail naturally via opacity transition

## Acceptance

- Image area shows a blurred thumbnail immediately while the full image loads
- Container is pre-sized to the correct aspect ratio (no layout shift)
- On fast connections, the transition is seamless (thumbnail may not even be visible)
- Works with `prefers-reduced-motion` (skip crossfade, just show image when ready)
