---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0003
---

# Fix the walkback date math across DST

Make the 7-day walkback visit each ET calendar day exactly once, including on DST change days. Found in the PR #5 review (2026-10-30). Pre-existing on `main`.

## Context

- `findLatestResolvable` (`src/index.ts`) builds each date with `new Date()` and `setDate(getDate() - i)`, which runs in the runtime's timezone (UTC on Workers), then formats the result in `America/New_York`.
- At 2026-03-09 00:30 EDT the dates come out 03-09, 03-07, 03-06…, so March 8 is skipped. In the 00:00 to 00:05 ET window before NASA publishes, `/` serves a two-day-old image, which clients cache for 6h.
- On the fall-back day, 23:00 to 24:00 EST yields one date twice, so the walkback covers 7 distinct days instead of 8.

## Implementation

Derive the dates from `todayET()` with UTC calendar math, e.g. parse `YYYY-MM-DD` as a UTC midnight and step back with `setUTCDate`.

## Acceptance

- A test pinned to 2026-03-09 04:30 UTC (00:30 EDT) walks back 03-09, 03-08, 03-07.
- A test pinned to the 2026-11-01 fall-back hour yields 8 distinct dates.
- `npx tsc --noEmit` and `npm test` pass.
