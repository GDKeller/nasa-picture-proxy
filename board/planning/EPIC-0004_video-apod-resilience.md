---
type: epic
status: done
created: 2026-04-08
updated: 2026-04-10
---

# Video APOD Resilience

Make the service handle video APODs and upstream failures gracefully, so image endpoints never 500 when a working fallback exists, and never show days-old content when a same-day thumbnail is available.

See NOTE-0026 for full context and discovery.

## Status: done

Both reliability goals are shipped. Video days with a NASA-provided `thumbnail_url` now serve the thumbnail directly (no stale walkback), and upstream API outages now fall through to an HTML scrape of `apod.nasa.gov/apod/` before giving up. The two changes landed together because they share the same plumbing: `resolveApod()`, `findLatestResolvable()`, and `handleUpstreamFailure()` all live in `src/index.ts`.

## Tasks

- ~~TASK-0018~~ — walkback error handling (shipped `997371e`)
- ~~TASK-0019~~ — video APOD thumbnail support
- ~~TASK-0020~~ — HTML scrape fallback (cross-filed under EPIC-0003 but closed as part of the same shipment)

## Cross-EPIC Dependencies

- EPIC-0003 TASK-0011 (R2 storage) would add an archival layer on top of this, but is not required — the scrape + thumbnail path already closes the two reliability holes that motivated this epic.
