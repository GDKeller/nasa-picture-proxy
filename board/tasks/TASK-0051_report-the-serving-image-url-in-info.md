---
type: task
status: backlog
priority: 3
created: 2026-10-30
parent: EPIC-0003
---

# Report the image URL that actually serves in /info

Make `/info` `hdurl`, `width` and `height` describe the image `/` really serves. Found in the PR #5 review (2026-10-30).

## Context

- `/` tries the derived `content/dam` original, then NASA's `hdurl` (`firstThatServes`).
- `/info` always reports the derived original as `hdurl` and probes its dimensions there (`src/index.ts`, `fetchImageDimensions(log, image.hd)`). If the original 404s, `/info` advertises a dead URL with null `width`/`height`, and the failed probe repeats on every request.
- No derived original has 404'd in live data so far, so this is theoretical. Do it when one shows up in the logs.

## Implementation

1. Make `fetchImageDimensions` throw on failure instead of returning null.
2. In `/info`, run it through `firstThatServes(log, [image.hd, image.hdFallback], …)` and report the URL that answered as `hdurl`.
3. If both fail, keep `hdurl: image.hd` with null dimensions.

The probe uses `cf.image`, so it also fails when Image Transformations can't reach the source host. Both candidates fail together in that case, which lands on step 3.

## Acceptance

- With the original returning 404, `/info` reports NASA's `hdurl` and its dimensions, with a test.
- `npx tsc --noEmit` and `npm test` pass.
