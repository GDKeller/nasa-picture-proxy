---
type: task
status: done
priority: 2
created: 2026-10-30
parent: EPIC-0006
---

# Keep the APOD record when the cache write fails

Serve a valid record even if caching it fails. Found in the PR #5 review (2026-10-30).

## Context

- `fetchApodFromUpstream` awaits `writeApodCaches` with no catch (`src/index.ts`). If either `cache.put` rejects, the error escapes, the walkback catches it, and yesterday is served even though today's validated record is in hand.
- TASK-0048 moves cache writes to `ctx.waitUntil`, which would also decouple them. This task is the small fix that doesn't wait for it.

## Implementation

Catch the `writeApodCaches` rejection, log it, and return the record anyway.

## Acceptance

- With `cache.put` failing, `/info` still serves today, with a test.
- `npx tsc --noEmit` and `npm test` pass.
