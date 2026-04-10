---
type: task
status: backlog
priority: 3
created: 2026-04-09
parent: EPIC-0002
---

# Retrofit landing page dev flags to the shared convention

The landing page already uses `?dev=fallback` and `?dev=stale` query params (`landing/index.html:151-155`), but it predates the cross-project shared convention documented in REFE-0001. Retrofit to match.

## Gaps vs. REFE-0001

1. **No localStorage persistence.** Current implementation reads the URL param on each page load only. Per the spec, flags should persist to `dev-mode` / `dev-tools` keys so the param only needs to appear once per browser to "stick."
2. **No `?dev=off` clear semantics.** The spec defines `?dev=off` and `?dev=` as explicit clears. Currently there's no way to clear persisted state other than removing the param manually.
3. **No `?tools=` support.** Not used yet, but the module should expose it from the start so future overlays can use it without re-wiring.
4. **Inline script instead of shared module.** Current flag parsing lives inline in `landing/index.html`. Per REFE-0001, the reference implementation should be a shared vanilla-JS/TS module at `landing/src/lib/dev-flags.ts` that exposes `getDevMode()`, `getDevTools()`, `hasTool()`, and `syncDevFlagsFromUrl()`.

## Implementation

1. Create `landing/src/lib/dev-flags.ts` implementing the four exports from REFE-0001.
2. Gate persistence on `location.hostname === 'localhost'` — the current gating pattern (don't write localStorage in production).
3. Refactor `landing/index.html` to import the module and call `syncDevFlagsFromUrl()` at the top of the script block, then read via `getDevMode()` instead of the current inline `new URLSearchParams(location.search).get('dev')`.
4. Verify the existing `?dev=fallback` and `?dev=stale` still work identically, plus:
   - `?dev=off` clears the persisted mode
   - Navigating to a param-less URL preserves the persisted mode
   - `localStorage.setItem('dev-mode', 'stale')` also works (programmatic escape hatch)

## Local testing

- `http://localhost:8788/?dev=fallback` → fallback state visible
- Navigate to `http://localhost:8788/` (no param) → fallback state should PERSIST because it's in localStorage
- `http://localhost:8788/?dev=off` → clears, normal state returns
- Devtools: `localStorage.setItem('dev-mode', 'stale'); location.reload()` → stale state visible

## Acceptance

- `landing/src/lib/dev-flags.ts` exists and matches the REFE-0001 reference implementation shape
- Existing `?dev=fallback` / `?dev=stale` behavior preserved
- `?dev=off` clears persisted mode; bare `?dev=` also clears
- Persisted state survives navigation to a clean URL
- `localStorage` keys are `dev-mode` and `dev-tools` exactly
- REFE-0001 "Current modes" table for landing has the retrofit note removed
