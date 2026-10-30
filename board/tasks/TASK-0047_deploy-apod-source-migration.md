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

1. ~~On `dev`, run `npx tsc --noEmit` and `npm test`. Both must pass.~~
2. ~~Verify locally with `npm run dev`.~~
3. ~~Merge PR #5 (`dev` to `main`).~~ Merged as `90c72f8`.
4. ~~From `main`, run `npm run deploy` (Worker and landing page).~~ Done 2026-10-30.
5. ~~Remove the obsolete secret with `npx wrangler secret delete NASA_API_KEY`.~~ Nothing to do: `wrangler secret list` returns `[]`.
6. ~~Verify production.~~ Done 2026-10-30 at 16:23 ET. Results are below.
7. Watch `npm run log:prod` across the next 00:05 ET rollover and confirm the new date resolves without errors. Afterward, `/info` `date` should equal the new ET date.

## Deploy record (2026-10-30)

- Worker version `39ce905e-dd41-47c0-9428-1a7a45000ff2`. The rollback target is `bbc7256f-d991-4e0e-98b8-a9acf8497602` (2026-04-09): `npx wrangler rollback <version-id>`.
- Pages deployment `98f8250c` from `main` `90c72f8`.
- Production checks:
  - `/` and `get.`: 200, the 6.0 MB original JPEG.
  - `/sd`: 200, 296 KB.
  - `/optimized`: 200, 180 KB.
  - `/thumb`: 200, a 32×21 WebP.
  - `/info`: "Haunting the Cepheus Flare", 6000×4076, matching apod-basic.
  - `/about` and nasapicture.com: 200.

## Acceptance

- Production serves the real APOD on every route.
- The `NASA_API_KEY` secret is deleted.
- The first rollover after deploy completes cleanly.
- EPIC-0006 and its tasks are marked done and archived.
