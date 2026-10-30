---
type: task
status: current
priority: 1
created: 2026-10-20
parent: EPIC-0006
---

# Merge and deploy the APOD source migration to production

Ship EPIC-0006 and verify production serves the real APOD again.

## Context

- Production runs `main` (`4653847`). PR #5 merges `dev`, 27 commits ahead: this epic, the PR #5 review fixes (TASK-0052, TASK-0053), TASK-0019 (video thumbnail), the vitest suite, and board changes.
- Deploys go from `main` only.
- `assets.science.nasa.gov/` was added to the zone's Image Transformations sources on 2026-10-30, so `/optimized` and `/thumb` can transform the new images. Removing `apod.nasa.gov/` afterward is TASK-0054.

## Steps

1. On `dev`, run `npx tsc --noEmit` and `npm test`. Both must pass.
2. Verify locally with `npm run dev`:
   - `/`, `/sd`, `/optimized`, `/thumb`, `/info`, and `/about` for today.
   - The `?dev=video`, `?dev=video-no-thumb`, and `?dev=nasa-error` fixtures.
   - The landing page hero and caption.
3. Merge PR #5 (`dev` to `main`).
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
