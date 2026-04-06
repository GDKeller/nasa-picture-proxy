---
type: note
status: inbox
created: 2026-04-06
blocked-by: TASK-0011
---

# Add a user-facing gallery of past APOD images

A browsable archive/gallery showing past Astronomy Pictures of the Day. Depends on TASK-0011 (R2 storage layer) being in place to persist historical images.

## Why

The daily APOD is ephemeral by design, but visitors naturally want to browse past images. A gallery turns the site from a single-serving utility into something worth revisiting. NASA's own APOD archive is functional but not visually engaging, so there's room to offer a better browsing experience that matches the project's aesthetic.

## Data available from R2

TASK-0011 defines the R2 key structure as:

- `{date}/hd.{ext}` — HD image
- `{date}/sd.{ext}` — SD image
- `{date}/info.json` — metadata snapshot (title, explanation, copyright, dimensions)

The `info.json` sidecar gives us everything we need for gallery cards without hitting NASA's API. The archive builds organically from the day R2 goes live, one image per day.

## API surface

The gallery needs a way to list and fetch archived images. Options:

- **New route: `/archive`** — returns JSON listing of available dates (from R2 `list()`)
- **New route: `/archive/{date}`** — returns image for a specific date (from R2)
- **New route: `/archive/{date}/info`** — returns metadata for a specific date

Alternatively, the existing `/info?date=2026-04-01` could accept a date param. But dedicated archive routes are cleaner and avoid overloading the "today" endpoints.

## Frontend

### Location
Could live on the landing page as a section below the hero, or as a dedicated `/gallery` page. A separate page avoids bloating the clean single-page landing, and gives room for richer browsing UX.

### Layout ideas
- Thumbnail grid using Cloudflare Image Transformations (same approach as `/thumb` route, but per-date)
- Click/tap to expand with title, explanation, and full-res image
- Date-based navigation (calendar picker or month groupings)
- Infinite scroll or paginated grid

### Performance
- Grid thumbnails via `cf.image` transforms (small, blurred placeholders with lazy-loaded sharper versions)
- Pre-sized containers using dimensions from `info.json` (same pattern as the current hero image)
- Paginate R2 `list()` calls to avoid loading the entire archive at once

## Related board items

- **TASK-0011** (blocker): R2 storage layer that archives images and metadata daily
- **EPIC-0002**: Landing page polish, gallery would be a major addition under this umbrella
- **NOTE-0005**: Individual metadata routes (`/title`, `/date`, etc.) could extend to per-date variants
- **NOTE-0008**: Daily OG image generation, could reuse the gallery's per-date image serving
- **NOTE-0016**: Local timezone rollover also depends on R2 and date-keyed image access

## Open questions

- Gallery on the landing page or a separate `/gallery` route?
- How far back to go? Only from when R2 archiving starts, or backfill older images from NASA's API?
- Search/filter by title or keyword, or just date-based browsing?
- Should the gallery be part of the Cloudflare Pages landing site, or served by the Worker?
