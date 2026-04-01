---
type: note
status: inbox
created: 2026-04-01
---

# Add GitHub Action to auto-deploy to Cloudflare on PR merge into main

Set up a GitHub Actions workflow that runs `npm run deploy` (wrangler deploy) automatically when a PR is merged into `main`. This removes the manual deploy step after each merge.

## Considerations

- Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets
- Trigger on `push` to `main` (which covers PR merges)
- Could also run type-check (`npx tsc --noEmit`) as a pre-deploy gate
