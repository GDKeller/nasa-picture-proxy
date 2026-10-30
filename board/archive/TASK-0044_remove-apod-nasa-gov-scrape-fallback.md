---
type: task
status: done
priority: 1
created: 2026-10-20
parent: EPIC-0006
blocked_by: [TASK-0042]
---

# Remove the apod.nasa.gov scrape fallback

The HTML scrape added in TASK-0020 (on `dev`, never deployed) targets a site that no longer exists. Remove it.

## Context

- `scrapeApodForDate` / `parseApodHtml` (`src/index.ts:275-403`) build URLs from `APOD_PAGE_BASE = "https://apod.nasa.gov/apod/"`.
- Every apod.nasa.gov page now 301-redirects to the `science.nasa.gov/apod/` index, so the scrape can't fetch a specific date.
- On the WordPress HTML, `parseApodHtml` returns the title "Astronomy Picture of the Day" with an empty `url`, and the result is still cached (line 232).

## Decision

Remove the scrape and don't replace it with a same-origin alternative. The RSS feed and permalink pages are served by the same WordPress origin as apod-basic, so they would fail together. The 24h stale cache tier stays as the resilience layer. Revisit only if apod-basic fails while the rest of science.nasa.gov stays up.

## Implementation

1. Delete `APOD_PAGE_BASE`, `MONTH_NAMES`, `pageUrlForDate`, `scrapeApodForDate`, `parseApodHtml`, and the UTF-16 BOM handling. Keep `stripHtml` if TASK-0042 uses it.
2. `handleUpstreamFailure` (211-245) becomes: serve stale cache, otherwise error. Remove the scrape log line (231).
3. Keep `?dev=nasa-error` as a simulated upstream failure, and update its description in the REFE-0001 mode table (lines 110-112).
4. Delete the scrape tests and helpers:
   - `test/handler.test.ts`: the scrape cases in 313-434, `apodPageHtml`, and `utf16leBomResponse`.
   - `test/pure.test.ts`: the `parseApodHtml` block (165-249).
   - Keep "stale cache wins" and the 502 case when stale is empty.
5. Close TASK-0020's intent in EPIC-0003: mark the scrape as superseded by this epic.

## Acceptance

- No reference to `apod.nasa.gov` remains in `src/` or `test/`.
- On upstream failure, a stale entry is served if present, otherwise the response is 502. Both cases are tested.
- `npx tsc --noEmit` and `npm test` pass.
