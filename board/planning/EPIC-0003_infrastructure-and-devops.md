---
type: epic
status: planning
created: 2026-04-03
---

# Infrastructure and DevOps

Remove manual steps from the deploy workflow and add durable storage so the service doesn't depend on NASA's uptime for every cache miss.

## Tasks

### TASK-0011: Add R2 storage layer for APOD image archiving

Insert R2 between edge cache and NASA as a persistent origin. Every image fetched from NASA gets stored in R2, building an automatic archive. Layered lookup becomes: Edge cache -> R2 -> NASA.

Key structure: `{date}/hd.{ext}`, `{date}/sd.{ext}`, `{date}/info.json`. Current-day images re-validated against NASA for same-day corrections; past dates served from R2 unconditionally.

R2 archiving also unblocks NOTE-0016 (local timezone rollover), since serving a timezone-shifted "yesterday" from the archive is trivial.

Blocked by TASK-0010.

### NOTE-0014: Add GitHub Action to auto-deploy on merge to main

Workflow triggered on push to `main`. Runs type-check (`npx tsc --noEmit`) as a gate, then `npm run deploy`. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.

## Sequence

1. R2 storage layer (TASK-0011) -- larger effort, independent of deploy automation
2. GitHub Action (NOTE-0014) -- small, can be done anytime

## Cross-EPIC Dependencies

- EPIC-0002 NOTE-0016 (local timezone rollover) is blocked by TASK-0011 (R2 archiving)
