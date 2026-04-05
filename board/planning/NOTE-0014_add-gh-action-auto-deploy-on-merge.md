---
type: note
status: inbox
created: 2026-04-01
updated: 2026-04-05
---

# Add GitHub Action to auto-deploy to Cloudflare on PR merge into main

Set up a GitHub Actions workflow that runs `npm run deploy` automatically when a PR is merged into `main`. This removes the manual deploy step after each merge.

## Current Deploy Process

`npm run deploy` runs two steps sequentially:
1. `deploy:api` — `wrangler deploy` (Worker to `api.nasapicture.com` + `get.nasapicture.com`)
2. `deploy:landing` — `vite build` + `wrangler pages deploy landing/dist/ --project-name nasapicture-landing`

## Implementation Plan

### 1. Create `.github/workflows/deploy.yml`

**Trigger**: `push` to `main` (covers PR merges and direct pushes)

**Jobs**: Single job with these steps:
1. Checkout repo
2. Set up Node.js (LTS, e.g. 22.x) — add `.nvmrc` to pin version
3. `npm ci` (root deps: wrangler, typescript, workers-types)
4. `npm ci --prefix landing` (landing deps: vite, sass)
5. `npx tsc --noEmit` — type-check gate, fail the deploy if types are broken
6. `npm run deploy` — deploys both Worker and Pages

### 2. GitHub Repository Secrets Required

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler auth for both Worker and Pages deploys |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account |

The API token needs permissions: **Workers Scripts: Edit**, **Cloudflare Pages: Edit**, and **Account Settings: Read**.

`NASA_API_KEY` is already set via `wrangler secret` on the Worker itself, so it does not need to be in GitHub secrets.

### 3. Add `.nvmrc`

Pin Node.js version (e.g. `22`) at the repo root so the workflow and local dev stay in sync.

## Workflow Skeleton

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

## Considerations

- **Single job vs. split jobs**: A single job is simpler and the total deploy is fast (type-check + wrangler deploy + pages deploy). No need to parallelize until it becomes slow.
- **No deploy on non-main branches**: Dev/feature branches never trigger deploys, matching the existing "deploy from main only" rule.
- **Failure notifications**: GitHub sends email on workflow failure by default, which is sufficient. Slack/webhook notifications can be added later if needed.
- **Caching**: `actions/setup-node` with `cache: npm` caches `~/.npm` across runs, speeding up installs.
- **Pages deploy**: `wrangler pages deploy` uses the same `CLOUDFLARE_API_TOKEN`, no separate Pages token needed.
