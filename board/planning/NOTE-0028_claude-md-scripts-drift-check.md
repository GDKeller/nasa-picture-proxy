---
type: note
status: inbox
created: 2026-04-11
---

# Drift check between CLAUDE.md commands and package.json scripts

The Commands section in `CLAUDE.md` hand-lists every npm script with a short description. It's useful curation (I can tell Claude *why* a command matters), but it silently drifts as scripts are added, renamed, or removed. Package.json can't natively import scripts from another file, so keeping them in sync needs tooling.

## Options considered

1. **`@package.json` reference in CLAUDE.md** — auto-syncs but pulls in deps/config noise and drops the inline annotations.
2. **Generator script** — maintain a `scripts.json` source of truth; a node script writes both `package.json` scripts and a marker-delimited block in CLAUDE.md on `prepare` or pre-commit. Most machinery, strongest guarantee.
3. **Drift check test** (this note) — a small vitest that parses `package.json` and asserts every script is mentioned in `CLAUDE.md` (or vice versa). Doesn't own the content, just catches staleness.

## Proposed approach

A single vitest under `test/` that:

- Reads `package.json` and extracts `scripts` keys.
- Reads `CLAUDE.md` and finds the fenced `bash` block under `## Commands`.
- Parses script names out of that block (`npm run <name>` or `npm <name>`).
- Fails if either side has entries missing from the other.

Optionally allow a small allowlist constant in the test for scripts we intentionally omit from CLAUDE.md (internal-only helpers), so the test stays a curation aid rather than a forcing function.

## Why this over generation

- Single-file Worker repo, low churn; generation is more machinery than the problem warrants.
- Curated wording in CLAUDE.md is the whole value — a generator would have to learn descriptions anyway.
- A failing test is self-explanatory and runs in CI alongside everything else.

## Acceptance

- `npm test` fails if a script is added to `package.json` without being documented in `CLAUDE.md` (or removed without being cleaned up).
- Allowlist mechanism exists for intentionally-undocumented scripts, with a comment explaining why each is excluded.
- Test runs in under a second and has no external dependencies.
