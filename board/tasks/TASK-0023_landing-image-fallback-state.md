---
type: task
status: todo
created: 2026-04-08
parent: EPIC-0002
---

# Landing page image fallback state

## Problem

When the API is down and all backend safeguards fail, the landing page shows a black void where the image should be. No indication anything went wrong.

## Implementation

Add a styled placeholder that triggers when:
- `/info` returns an error response (has `error` field instead of `url`)
- The image itself fails to load (`onerror` on the `<img>`)

Placeholder design:
- Sized to match the image container
- Subtle silver/gray border, dark space aesthetic
- Centered message: "Today's image isn't available right now"
- Subtext: "NASA's Astronomy Picture of the Day updates daily — check back soon"

## Future (Tier 1, requires TASK-0011)

Once R2 archiving exists, fall back to the most recent archived image with a disclaimer instead of the placeholder.

## Acceptance

- When `/info` errors or image fails to load, a styled placeholder appears instead of a black gap
- Placeholder matches the site's aesthetic
- Normal image loading path is unaffected
