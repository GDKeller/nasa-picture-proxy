---
type: note
status: processed
created: 2026-04-08
---

# Add fallback state for landing page when no image is available

## Problem

When the API is down and all safeguards fail (no cache, no scrape fallback), the landing page shows a completely black void where the image should be. No indication anything went wrong.

## Tiered fallback strategy

### Tier 1: Yesterday's image (future, requires R2)
Once TASK-0011 (R2 storage layer) is implemented, the landing page could fall back to the most recent archived image. Should include a visible disclaimer like "Showing yesterday's image — today's isn't available yet" so visitors aren't misled.

### Tier 2: Worst-case placeholder (implement now)
A styled placeholder that communicates the failure gracefully. Proposal:
- 768px container with a subtle silver/gray border
- Centered message: "Today's image isn't available right now"
- Brief subtext: "NASA's Astronomy Picture of the Day updates daily — check back soon"
- Fits the existing dark space aesthetic (not a jarring white error box)

## Implementation

The landing page JS already fetches `/info` and handles the image load. The fallback triggers when:
- `/info` returns an error response (has `error` field instead of `url`)
- Or the image itself fails to load (`onerror` on the `<img>`)

Instead of leaving a black gap, inject the placeholder element into the image container.

## Related

- NOTE-0022: HTML scraping fallback (API-side resilience)
- NOTE-0023: Automated cache warming (prevents cold cache)
- TASK-0011: R2 storage layer (enables Tier 1 fallback)
