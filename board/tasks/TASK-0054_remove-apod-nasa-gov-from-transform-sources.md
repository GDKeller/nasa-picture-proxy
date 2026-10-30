---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0006
---

# Remove apod.nasa.gov from the Image Transformations sources

Drop the old APOD host from the zone's transform allowlist once production runs the new source.

## Context

- The `nasapicture.com` zone's `transformations_allowed_origins` is `nasapicture.com/,apod.nasa.gov/,assets.science.nasa.gov/`. `assets.science.nasa.gov/` was added on 2026-10-30.
- `apod.nasa.gov/` was kept until TASK-0047 deployed, because the old production code transformed images from it.
- TASK-0047 deployed on 2026-10-30, and production `/optimized` and `/thumb` return 200 from `assets.science.nasa.gov`. Nothing fetches from apod.nasa.gov now, so the entry only widens what the zone will transform.
- Rolling back to Worker `bbc7256f` would not need the entry either, because every apod.nasa.gov page now redirects.
- The zone is in `Grant@kellerdigital.com's Account`. The Cloudflare connector needs that account granted, with Zone Settings: Edit.

## Steps

1. Confirm production `/optimized` and `/thumb` return 200 for today (TASK-0047 step 6).
2. Read the current value with `GET /zones/{zone_id}/settings/transformations_allowed_origins`. The PATCH replaces the whole list, so build the new value from what is there.
3. PATCH it with `apod.nasa.gov/` removed, for example `nasapicture.com/,assets.science.nasa.gov/`. The dashboard path is Images > Transformations > nasapicture.com > Sources.
4. Check `/optimized` and `/thumb` again.

## Acceptance

- The sources list no longer contains `apod.nasa.gov/`.
- Production `/optimized` and `/thumb` still return 200.
