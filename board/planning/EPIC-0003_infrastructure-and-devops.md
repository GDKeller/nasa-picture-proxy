---
type: epic
status: planning
created: 2026-04-03
updated: 2026-10-20
---

# Infrastructure and DevOps

Remove manual steps from the deploy workflow and add durable storage so the service doesn't depend on NASA's uptime for every cache miss.

## Priority focus: show today's image reliably

Recent incidents (video APOD tripping walkback, unexplained NASA API 500 on 2026-04-08) have repeatedly hurt the core promise — showing today's image reliably. TASK-0020 shipped alongside EPIC-0004's TASK-0019; TASK-0021 (cron warming) is the remaining P1.

## Tasks

### ~~TASK-0020: HTML scraping fallback for NASA API outages~~ [done]

Shipped with TASK-0019. `scrapeApodForDate` + `parseApodHtml` in `src/index.ts` kick in from `handleUpstreamFailure` whenever the API errors and stale cache is empty. Handles UTF-8 and UTF-16 LE/BE APOD pages (NASA silently serves some pages as UTF-16 LE with BOM despite a UTF-8 Content-Type header). **Directly addresses the 2026-04-08 outage.**

**Superseded by EPIC-0006 (TASK-0044).** NASA moved APOD to science.nasa.gov and every apod.nasa.gov page now redirects to the index, so the scrape had no target and was removed before it ever deployed. The 24h stale cache tier is the only fallback now.

### TASK-0021: Automated daily cache warming via Cron Trigger [P1]

Add a `scheduled()` handler with a cron trigger to warm the edge cache after APOD rollover. Calls `findLatestImage`, `fetchImageCached`, and `fetchImageDimensions` to populate metadata and image bytes proactively. **Combined with TASK-0020, guarantees a fresh entry in stale cache so outages never exhaust our fallback.**

### TASK-0011: Add R2 storage layer for APOD image archiving

Insert R2 between edge cache and NASA as a persistent origin. Every image fetched from NASA gets stored in R2, building an automatic archive. Layered lookup becomes: Edge cache -> R2 -> NASA.

Key structure: `{date}/hd.{ext}`, `{date}/sd.{ext}`, `{date}/info.json`. Current-day images re-validated against NASA for same-day corrections; past dates served from R2 unconditionally.

R2 archiving also unblocks TASK-0031 Phase 2 (local timezone rollover, ahead-of-ET) and TASK-0035 (gallery/archive).

### TASK-0032: GitHub Action auto-deploy on merge to main

Workflow triggered on push to `main`. Runs type-check (`npx tsc --noEmit`) as a gate, then `npm run deploy`. Requires only a `CLOUDFLARE_API_TOKEN` repository secret; the account ID is committed in `wrangler.toml` and the `deploy:landing` script. Spawned from NOTE-0014.

### TASK-0048: Stream image responses instead of buffering them [P2]

`fetchImageCached` loads the whole image into memory and builds 3 Responses from it. PNG days run to tens of MB (37.7 MB on 2026-10-02) against a 128 MB isolate limit. Stream to the client, write the cache with `ctx.waitUntil`, and drop the duplicate `:stale` image copy. From the PR #5 review.

### TASK-0049: Surface degraded APOD serving [P2]

Serving a walked-back day, a stale entry, or a 502 is only logged through buffered `console.log`. Add `console.error` on those paths, an `X-APOD-Date` header an uptime check can assert, and `[observability]` in `wrangler.toml`. From the PR #5 review. Related: NOTE-0029 (Sentry).

### TASK-0050: Fix the walkback date math across DST [P2]

`findLatestResolvable` steps back in UTC, then formats in `America/New_York`, so DST change days skip or repeat a date. Derive dates from `todayET()` with UTC calendar math. From the PR #5 review; already on `main` before the migration.

### TASK-0051: Report the image URL that actually serves in /info [P3]

`/info` always reports the derived `content/dam` original as `hdurl`, even if it 404s and `/` falls back to NASA's `hdurl`. Run the dimensions probe through `firstThatServes`. Theoretical so far; do it when a missing original shows up in the logs. From the PR #5 review.

### TASK-0055: Update dev dependencies to clear npm audit findings [P2]

`npm audit` on `dev` reports 12 vulnerabilities (9 high), all in dev and tooling dependencies (`wrangler`, `vitest`, and their transitive deps). Runtime dependencies report 0. Every finding has a non-breaking fix.

### ~~TASK-0056: Upgrade the landing page to Vite 8~~ [done]

`landing/` builds with Vite 6.4.1, two majors behind. Vite 8 swaps Rollup and esbuild for Rolldown. `npm audit --prefix landing` reports 5 high findings, `vite` among them. The root package already runs Vite 8 through `vitest`.

## Sequence

1. ~~TASK-0020~~ — done
2. **TASK-0021** [P1] — Cron cache warming. Now that scrape is in place, cron warming guarantees stale cache never runs dry.
3. TASK-0011 — R2 storage layer. Larger effort, unblocks follow-on features (gallery, timezone Phase 2).
4. TASK-0032 — GitHub Action. Small, can be done anytime.
5. TASK-0049, TASK-0050, TASK-0055, ~~TASK-0056~~ — small, independent, can be done anytime.
6. TASK-0048 — before TASK-0011, which reworks the same image path.
7. TASK-0051 — only once a missing original shows up in the logs.

## Cross-EPIC Dependencies

- EPIC-0002 TASK-0031 Phase 2 (local timezone, ahead-of-ET) is blocked by TASK-0011
- EPIC-0006-worth gallery/archive work (TASK-0035) is blocked by TASK-0011
