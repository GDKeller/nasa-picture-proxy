---
type: task
status: backlog
priority: 3
created: 2026-04-09
parent: EPIC-0002
---

# Local timezone APOD rollover

Let users receive the new image at midnight in their local timezone instead of waiting for ET rollover. Spawned from NOTE-0016. Nice-to-have.

**Partial blocker**: Phase 1 (west-of-ET only) can ship today without any dependencies. Phase 2 (ahead-of-ET, e.g. Asia/Pacific) is blocked by TASK-0011 (R2 archive) because it needs a previous-day fallback when "today" in the requested timezone doesn't exist in NASA's API yet. The frontmatter `blocked-by` is intentionally omitted so Phase 1 doesn't get hidden behind the R2 work.

## The problem

APOD publishes once per day keyed to Eastern Time. A user in Tokyo sees the image roll over at 1pm JST, which is awkward if they want "a new picture every morning." A user in PST sees it at 9pm, which may be acceptable.

## API surface

Query param on image and `/info` routes, e.g. `?tz=Asia/Tokyo`. Worker computes "today" in that timezone and requests that date's APOD.

- **West of ET** (the requested date always exists): lookback handles anything missing, works today without R2.
- **Ahead of ET** (e.g., Asia/Pacific, requested date may not exist yet): serve the most recent archived image from R2.

## Landing page

Detect timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and pass it to the API. Consider an explicit "NASA time / local time" toggle so the behavior is never hidden from users.

## Phasing

1. **Phase 1** — west-of-ET only, ships without R2. Covers the common US case (and is the main thing most users want). **Not blocked by anything — can start now.**
2. **Phase 2** — ahead-of-ET, requires TASK-0011 to serve the previous day when the new one doesn't exist yet. **Blocked by TASK-0011.**

## Open questions

- **Cache hit rate impact**: timezone-varied requests create different date keys during the rollover window, which reduces cache hit rate. Worst case: every hour produces a new key band as another timezone rolls over. Measure this in practice before optimizing. If it turns out to matter, bucket `tz` params into ET offset groups (e.g., `?offset=-5` rather than `?tz=America/Chicago`) so zones sharing an offset share a cache key.

## Acceptance

- `?tz=` respected on image and `/info` routes
- Landing page rollover respects local timezone when available
- Phase 1 works for west-of-ET without R2
- Documented in `/about`
