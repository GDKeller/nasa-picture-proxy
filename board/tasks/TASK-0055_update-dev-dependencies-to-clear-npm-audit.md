---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0003
---

# Update dev dependencies to clear npm audit findings

Clear the `npm audit` findings behind GitHub's Dependabot warning.

## Context

- `npm audit` on `dev` (2026-10-30) reports 12 vulnerabilities: 9 high, 2 moderate, 1 low.
- All are in dev and tooling dependencies.
  - Direct: `wrangler` (high), `vitest` (moderate).
  - Transitive: `miniflare`, `undici`, `ws`, `sharp`, `vite`, `postcss`, `nanoid`, `source-map-js`, `esbuild`, `@vitest/mocker`.
- `npm audit --omit=dev` reports 0, so the deployed Worker is not affected. The exposure is the local dev and deploy toolchain.
- npm reports a non-breaking fix for every finding.
- GitHub reports 32 alerts on `main`, which still has the older lockfile. Merging PR #5 changes that count.

## Steps

1. Run `npm audit fix`.
2. Run `npx tsc --noEmit` and `npm test`, then smoke-test `npm run dev`.
3. Run `npm audit` again.

## Acceptance

- `npm audit` reports no high or critical findings.
- The type check, tests, and local dev all pass.
