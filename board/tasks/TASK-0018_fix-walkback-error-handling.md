---
type: task
status: todo
created: 2026-04-08
parent: EPIC-0004
---

# Fix findLatestImage walkback error handling

## Problem

`findLatestImage` (`src/index.ts:123`) loops through dates to find an image APOD, but if `fetchApod` throws (e.g. NASA returns 500 for a date), the error propagates immediately and kills the loop. It never tries earlier dates.

Observed 2026-04-08: today is a video, yesterday returns 500 from NASA. The walkback stops at day -1 instead of continuing to day -2 through -7.

## Implementation

1. Wrap the `fetchApod` call inside the for-loop in a try/catch
2. On catch, log the error and continue to the next iteration
3. After exhausting all days, throw with a summary of what was tried (X videos, Y errors)
4. Keep the existing stale-cache fallback in `fetchApod` itself untouched

## Acceptance

- Image endpoints survive a mix of video APODs and upstream 500s as long as one image exists in the lookback window
- `/info` behavior unchanged (it doesn't use `findLatestImage`)
- Errors for skipped dates appear in the log output
