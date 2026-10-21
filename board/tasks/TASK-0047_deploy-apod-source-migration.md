---
type: task
status: backlog
priority: 1
created: 2026-10-20
parent: EPIC-0006
blocked_by: [TASK-0042, TASK-0043, TASK-0044, TASK-0045, TASK-0046]
---

# Merge and deploy the APOD source migration to production

Ship EPIC-0006 and verify production serves the real APOD again.

## Context

- Production runs `main` (`4653847`). `dev` is ahead with unreleased work: TASK-0019 (video thumbnail), the vitest suite, and board changes, plus this epic.
- Deploys go from `main` only.

## Steps

1. On `dev`, run `npx tsc --noEmit` and `npm test`. Both must pass.
2. Verify locally with `npm run dev`:
   - `/`, `/sd`, `/optimized`, `/thumb`, `/info`, and `/about` for today.
   - The `?dev=video`, `?dev=video-no-thumb`, and `?dev=nasa-error` fixtures.
   - The landing page hero and caption.
3. Open a PR from `dev` to `main` and merge it.
4. From `main`, run `npm run deploy` (Worker and landing page).
5. Remove the obsolete secret with `npx wrangler secret delete NASA_API_KEY`.
6. Verify production:
   - Every image route serves the real APOD, not the 8,928 B logo PNG.
   - `/optimized` and `/thumb` return 200 (they returned 502 on 2026-10-20).
   - `/info` `title` matches apod-basic for today's date.
   - nasapicture.com shows the real image.
7. Watch `npm run log:prod` across the next 00:05 ET rollover and confirm the new date resolves without errors.

## Acceptance

- Production serves the real APOD on every route.
- The `NASA_API_KEY` secret is deleted.
- The first rollover after deploy completes cleanly.
- EPIC-0006 and its tasks are marked done and archived.
