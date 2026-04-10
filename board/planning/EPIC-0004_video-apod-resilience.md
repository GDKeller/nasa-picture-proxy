---
type: epic
status: current
created: 2026-04-08
updated: 2026-04-09
---

# Video APOD Resilience

Make the service handle video APODs and upstream failures gracefully, so image endpoints never 500 when a working fallback exists, and never show days-old content when a same-day thumbnail is available.

See NOTE-0026 for full context and discovery.

## Priority focus: show today's image reliably

Video APOD days are one of the two recurring failure modes that keep the service from showing *today's* image (the other being NASA API outages, covered by EPIC-0003 TASK-0020/TASK-0021). TASK-0019 is now **priority 1**.

## Tasks

### ~~TASK-0018: Fix findLatestImage walkback error handling~~ [done]

Shipped in commit `997371e`. `findLatestImage` no longer crashes on the first upstream error; each date inside the loop is wrapped in a try/catch so a 500 for one date doesn't prevent checking earlier dates.

### TASK-0019: Serve video APOD thumbnail instead of walking back [P1]

When the current APOD is a video, check for a `thumbnail_url` in the NASA API response and serve that as the image. This keeps content current instead of showing a stale photo from days ago. Fall back to the (now-fixed) walkback if no thumbnail is available.

## Sequence

1. ~~TASK-0018~~ — done
2. **TASK-0019** [P1] — video thumbnail. The walkback fix is the floor; this is the real reliability win for video days.

## Cross-EPIC Dependencies

- EPIC-0003 TASK-0011 (R2 storage) would make video fallbacks more resilient long-term by providing archived same-day content from previous runs, but is not required for this epic.
