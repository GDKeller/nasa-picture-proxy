---
type: task
status: done
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
- GitHub reports 55 Dependabot alerts on `main` (2026-10-30).
  - 38 are in the root `package-lock.json` and match the packages above.
  - 17 are in `landing/package-lock.json` (`vite`, `postcss`, `immutable`, `nanoid`, `source-map-js`). TASK-0056 already fixed these on `dev` (`npm audit` in `landing/` reports 0). They clear when `dev` merges to `main`.

## Steps

1. Run `npm audit fix`.
2. Run `npx tsc --noEmit` and `npm test`, then smoke-test `npm run dev`.
3. Run `npm audit` again.

## Acceptance

- `npm audit` reports no high or critical findings.
- The type check, tests, and local dev all pass.

## Outcome

Done on 2026-10-30 in `c34a00f`: wrangler 4.156.0, vitest 4.1.12, `@cloudflare/workers-types` 5.20261030.1, and `npm audit` reports 0 vulnerabilities.

- `npm audit fix` alone failed with ERESOLVE. Every wrangler release from 4.114.0 on declares an optional peer on `@cloudflare/workers-types@^5`, and the root pinned `^4`. Ran `npm install -D @cloudflare/workers-types@^5 wrangler@latest`, then `npm audit fix` for the rest.
- workers-types v5 drops the dated entrypoints. Its root entrypoint now types the latest runtime instead of the oldest compatibility date. `tsconfig.json` needed no change.
- wrangler 4.156.0 pins `miniflare@5.20261023.3-beta`. Every stable miniflare 4.x is in the vulnerable range.
- The type check, all 75 tests, `wrangler deploy --dry-run`, and a `npm run dev` smoke test pass. `wrangler pages deploy` has no dry run, so the next landing deploy is its first run on wrangler 4.156.0.
