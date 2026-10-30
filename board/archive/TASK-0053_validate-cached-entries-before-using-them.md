---
type: task
status: done
priority: 2
created: 2026-10-30
parent: EPIC-0006
---

# Validate cached entries before using them

Treat the Cache API as a runtime boundary, per the project's Zod rule ("API responses, … storage"). Found in the PR #5 review (2026-10-30).

## Context

- APOD and dimension cache hits are read with `cached.json() as Apod` / `as ImageDimensions` (five sites in `src/index.ts`), with no checks.
- An entry that isn't valid JSON makes `.json()` throw. The day is skipped, and the entry stays for its full TTL (6h primary, 24h stale).
- An entry with the wrong shape passes through and fails later in the request, so that route returns 502.
- Versioned cache keys (TASK-0045) already cover shape changes between deploys. What's left is a bad write.

## Implementation

1. Define the cached model as Zod schemas (`ApodRecord`, its image, and dimensions), and derive the `Apod`, `ApodImage` and `ImageDimensions` types with `z.infer`.
2. Add one `readCached` helper. It returns the parsed entry. When an entry fails to parse, it deletes it, logs it, and returns `null` so the caller treats it as a miss.
3. Use it at every APOD and dimension cache read, primary and stale.
4. Keep the schemas unexported. The Worker's entry module may only export functions.

## Acceptance

- A garbage primary entry is deleted and today is fetched again, with a test.
- A wrong-shape stale entry is not served, with a test.
- `npx tsc --noEmit` and `npm test` pass.
