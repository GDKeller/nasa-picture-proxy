---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0003
---

# GitHub Action auto-deploy on merge to main

Automate the manual `npm run deploy` step after each PR merge so Worker and Pages both deploy on `push` to `main`. Spawned from NOTE-0014.

## Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm ci --prefix landing
      - run: npx tsc --noEmit
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Prerequisites

- **Create `.nvmrc` at the repo root** pinning Node LTS (e.g., `22`) so CI and local dev stay in sync. This file does not exist yet — it must be created as part of this task. The workflow's `node-version-file: .nvmrc` depends on it. (Alternative: drop `node-version-file` and use `node-version: '22'` inline, but `.nvmrc` is preferred so local dev via nvm stays in sync.)
- GitHub repository secrets:
  - `CLOUDFLARE_API_TOKEN` — needs **Workers Scripts: Edit**, **Cloudflare Pages: Edit**, **Account Settings: Read**
  - `CLOUDFLARE_ACCOUNT_ID` — target account
- `NASA_API_KEY` is already set via `wrangler secret` on the Worker, no GH secret needed

## Considerations

- Single job is sufficient; total deploy is fast enough not to need parallelization
- Type-check is a gate so a broken build never deploys
- `actions/setup-node` with `cache: npm` speeds up repeat installs
- Only triggers on `main`, matching the "deploy from main only" rule
- GitHub's default email-on-failure notification is sufficient; Slack webhook can be added later

## Acceptance

- PR merge to `main` triggers the workflow
- Type-check failure blocks the deploy
- Worker and Pages both deploy from one job
- Manual `npm run deploy` after merges is no longer needed
