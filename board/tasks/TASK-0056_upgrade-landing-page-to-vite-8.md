---
type: task
status: backlog
priority: 2
created: 2026-10-30
parent: EPIC-0003
---

# Upgrade the landing page to Vite 8

Move `landing/` from Vite 6 to Vite 8, the current major (8.3.5 on 2026-10-30).

## Context

- Only `landing/` builds with Vite: `landing/package.json` pins `vite: ^6.3.0` (installed 6.4.1) and `sass: ^1.86.0` (installed 1.98.0).
- The root package already resolves `vite@8.0.8` through `vitest`, so the Worker is out of scope. Root dependency fixes are TASK-0055.
- `npm audit --prefix landing` reports 5 high findings: `vite` (direct), plus `postcss`, `nanoid`, `source-map-js`, and `immutable` (transitive).
- `landing/vite.config.ts` only sets `root`, `build.outDir`, `build.emptyOutDir`, and `server.port`, so the config surface is small.
- Vite 8 replaces Rollup and esbuild with Rolldown, so build output can change even with no config changes.
- `npm run deploy:landing` ships `landing/dist/` to Cloudflare Pages.

## Steps

1. Read the Vite 7 and Vite 8 migration guides for anything that affects this config or the SCSS pipeline.
2. Run `npm install --prefix landing -D vite@^8 sass@^1.99`.
3. Run `npm run build:landing` and compare `landing/dist/` with the Vite 6 build: asset names, CSS output, and image references.
4. Smoke-test `npm run dev:landing` at localhost:8788: the hero image, the caption, and the dev flags.
5. Run `npm audit --prefix landing`.

## Acceptance

- `landing/` builds and serves on Vite 8.x.
- `npm audit --prefix landing` reports no high or critical findings.
- The built page renders the same as before.
