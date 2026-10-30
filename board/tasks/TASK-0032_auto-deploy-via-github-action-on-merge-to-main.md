---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0003
---

# Auto-deploy via GitHub Action on merge to main

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
```

## Prerequisites

- `.nvmrc` at the repo root pins Node `24` (added in `ea61165`), so CI and local dev stay in sync. The workflow's `node-version-file: .nvmrc` reads it.
- GitHub repository secret `CLOUDFLARE_API_TOKEN` — needs **Workers Scripts: Edit**, **Cloudflare Pages: Edit**, **Account Settings: Read**
- No `CLOUDFLARE_ACCOUNT_ID` secret is needed. The account ID is not a credential and is committed in two places:
  - `wrangler.toml` `account_id`, read by `wrangler deploy`, `tail`, and `secret`.
  - The `deploy:landing` script's `CLOUDFLARE_ACCOUNT_ID=` prefix. `wrangler pages` ignores `wrangler.toml` because it has no `pages_build_output_dir`.
- The Worker needs no secrets (the apod-basic source is keyless), so no GH secret is needed for it

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
