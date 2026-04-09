---
type: epic
status: planning
created: 2026-04-08
---

# Video APOD Resilience

Make the service handle video APODs and upstream failures gracefully, so image endpoints never 500 when a working fallback exists.

See NOTE-0026 for full context and discovery.

## Tasks

### TASK-0018: Fix findLatestImage walkback error handling

`findLatestImage` crashes on the first upstream error instead of continuing to the next day. Wrap `fetchApod` in a try/catch inside the loop so a 500 for one date doesn't prevent checking earlier dates.

### TASK-0019: Serve video APOD thumbnail instead of walking back

When the current APOD is a video, check for a `thumbnail_url` in the NASA API response and serve that as the image. This keeps content current instead of showing a stale photo from days ago. Fall back to the (now-fixed) walkback if no thumbnail is available.

## Sequence

1. TASK-0018 (walkback fix) -- bug fix, small, ship first
2. TASK-0019 (video thumbnail) -- enhancement, depends on TASK-0018 being solid

## Cross-EPIC Dependencies

- EPIC-0003 TASK-0011 (R2 storage) would make both tasks more resilient long-term by providing archived fallbacks
