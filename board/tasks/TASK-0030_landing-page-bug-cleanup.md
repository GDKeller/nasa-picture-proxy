---
type: task
status: backlog
priority: 3
created: 2026-04-09
parent: EPIC-0002
---

# Landing page bug cleanup

Residual bugs from NOTE-0017 that are small enough to batch into a single cleanup pass. (Several other items from the original critique have already been resolved by subsequent landing work.)

## Items

### 1. `--font-weight-medmium` typo in `_hero.scss`
`landing/src/styles/_hero.scss:43` has `font-weight: var(--font-weight-medmium)` (typo: "medmium"). The variable defined in `_variables.scss:20` is the correctly-spelled `--font-weight-medium`. The typo'd reference resolves to nothing, so the rule silently does nothing.

**Fix**: change `_hero.scss:43` from `var(--font-weight-medmium)` to `var(--font-weight-medium)`. No edit to `_variables.scss` needed — the variable name there is already correct.

### 2. Endpoint list missing `/optimized` and `/thumb`
`landing/index.html` endpoint list (around line 87) shows only `/`, `/sd`, `/info`, `/about`. `/optimized` and `/thumb` are valid routes and should be documented alongside the others. Keep `/` prominent as the primary use case.

### 3. Verify caption spread on wide viewports
NOTE-0017 flagged that title and date spread across the full image width on desktop, feeling scattered rather than intimate. Verify against the current layout and tighten if still an issue (constrain caption width or cluster elements under the image edge). Close as verified-fixed if no longer applicable.

### 4. README endpoint table missing `/optimized` and `/thumb`
`README.md:56-61` lists only `/`, `/image.jpg`, `/sd`, `/image-sd.jpg`, `/info`, `/about`. Missing `/optimized`, `/image-optimized.jpg`, `/thumb`, and `/thumb.jpg`. Source of truth is the route arrays at `src/index.ts:608-611` and the `/about` route listing at `src/index.ts:690-697`; match descriptions to those.

## Acceptance

- Typo fixed; rule resolves to the intended weight (visually verified)
- Endpoint list includes `/optimized` and `/thumb` with descriptions consistent with existing rows
- Caption layout feels intimate on wide viewports, or explicitly verified as already resolved
- README endpoint table lists every route in `src/index.ts`, including `.jpg` aliases
