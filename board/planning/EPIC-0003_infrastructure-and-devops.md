---
type: epic
status: planning
created: 2026-04-03
updated: 2026-04-10
---

# Infrastructure and DevOps

Remove manual steps from the deploy workflow and add durable storage so the service doesn't depend on NASA's uptime for every cache miss.

## Priority focus: show today's image reliably

Recent incidents (video APOD tripping walkback, unexplained NASA API 500 on 2026-04-08) have repeatedly hurt the core promise — showing today's image reliably. TASK-0020 shipped alongside EPIC-0004's TASK-0019; TASK-0021 (cron warming) is the remaining P1.

## Tasks

### ~~TASK-0020: HTML scraping fallback for NASA API outages~~ [done]

Shipped with TASK-0019. `scrapeApodForDate` + `parseApodHtml` in `src/index.ts` kick in from `handleUpstreamFailure` whenever the API errors and stale cache is empty. Handles UTF-8 and UTF-16 LE/BE APOD pages (NASA silently serves some pages as UTF-16 LE with BOM despite a UTF-8 Content-Type header). **Directly addresses the 2026-04-08 outage.**

### TASK-0021: Automated daily cache warming via Cron Trigger [P1]

Add a `scheduled()` handler with a cron trigger to warm the edge cache after APOD rollover. Calls `findLatestImage`, `fetchImageCached`, and `fetchImageDimensions` to populate metadata and image bytes proactively. **Combined with TASK-0020, guarantees a fresh entry in stale cache so outages never exhaust our fallback.**

### TASK-0011: Add R2 storage layer for APOD image archiving

Insert R2 between edge cache and NASA as a persistent origin. Every image fetched from NASA gets stored in R2, building an automatic archive. Layered lookup becomes: Edge cache -> R2 -> NASA.

Key structure: `{date}/hd.{ext}`, `{date}/sd.{ext}`, `{date}/info.json`. Current-day images re-validated against NASA for same-day corrections; past dates served from R2 unconditionally.

R2 archiving also unblocks TASK-0031 Phase 2 (local timezone rollover, ahead-of-ET) and TASK-0035 (gallery/archive).

Blocked by TASK-0010.

### TASK-0032: GitHub Action auto-deploy on merge to main

Workflow triggered on push to `main`. Runs type-check (`npx tsc --noEmit`) as a gate, then `npm run deploy`. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Spawned from NOTE-0014.

## Sequence

1. ~~TASK-0020~~ — done
2. **TASK-0021** [P1] — Cron cache warming. Now that scrape is in place, cron warming guarantees stale cache never runs dry.
3. TASK-0011 — R2 storage layer. Larger effort, unblocks follow-on features (gallery, timezone Phase 2).
4. TASK-0032 — GitHub Action. Small, can be done anytime.

## Cross-EPIC Dependencies

- EPIC-0002 TASK-0031 Phase 2 (local timezone, ahead-of-ET) is blocked by TASK-0011
- EPIC-0006-worth gallery/archive work (TASK-0035) is blocked by TASK-0011
