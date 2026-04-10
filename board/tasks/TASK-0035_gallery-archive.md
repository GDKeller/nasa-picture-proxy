---
type: task
status: backlog
priority: 3
created: 2026-04-09
blocked-by: TASK-0011
---

# Build a user-facing gallery of past APOD images

Browsable archive showing past Astronomy Pictures of the Day, built on top of the R2 archive from TASK-0011. Spawned from NOTE-0021. Several design questions remain open — revisit this task once TASK-0011 is underway.

## Scope

- **API**: new routes to list and fetch archived entries
  - `/archive` — JSON listing of available dates from R2 `list()`, paginated
  - `/archive/{date}` — image for a specific date from R2
  - `/archive/{date}/info` — metadata for a specific date from R2
- **Frontend**: gallery page with thumbnail grid, date navigation, expand/detail view
- **Thumbnails** via Cloudflare Image Transformations on R2-served bytes (same approach as `/thumb`, but per-date)
- **Pre-sized containers** from dimensions in the archived `info.json` (same pattern as the current hero image)

## Data from TASK-0011

The R2 key structure from TASK-0011 gives us everything we need:

- `{date}/hd.{ext}` — HD image
- `{date}/sd.{ext}` — SD image
- `{date}/info.json` — metadata snapshot (title, explanation, copyright, dimensions)

The archive builds organically from the day R2 goes live, one image per day.

## Open questions (from NOTE-0021)

- Gallery on the landing page or a dedicated `/gallery` route?
- Backfill historical APODs from NASA, or start from the day R2 archiving goes live?
- Search/filter by title or keyword, or just date-based browsing?
- Served by the Worker or by Cloudflare Pages?

These should be resolved before implementation starts.

## Dependencies

- Blocked-by: TASK-0011 (R2 storage layer)
- Relates to: TASK-0031 (local timezone rollover) also benefits from archived images

## Acceptance

TBD once open questions are resolved. Initial definition: visitors can browse a paginated grid of past APODs and click through to a detail view with the full image, title, and explanation.
