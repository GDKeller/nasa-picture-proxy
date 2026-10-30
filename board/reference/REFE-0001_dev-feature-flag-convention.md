---
type: reference
created: 2026-04-09
updated: 2026-10-30
---

# Dev feature flag convention

Cross-project shared convention for dev/debug toggles. Originated in conversations between NASA Picture Proxy and the portfolio project; this file is the local copy of the spec. All new dev/debug hooks in this repo MUST follow it.

## The distinction

Dev flags come in two fundamentally different shapes. Cramming both into one slot creates friction — modes steal the slot tools need, or tools pollute the modes dimension. Keep them separate.

- **Mode** — single-value render state. **One at a time. Mutually exclusive.** Examples: `fallback`, `stale`, `video`, `nasa-error`, `offline`.
- **Tools** — set of independent helper overlays. **Any combination on at once. Additive.** Examples: `palette`, `grid`, `cache-inspector`, `fps`.

## The convention

| Purpose | Query param | localStorage key | Shape | Example |
|---|---|---|---|---|
| Render mode | `?dev=<name>` | `dev-mode` | single value | `?dev=stale`, `?dev=off` |
| Helper tools | `?tools=<a,b,c>` | `dev-tools` | comma set | `?tools=palette,grid` |

## Semantics (declarative)

- The URL value is always the **complete desired state** for that dimension.
- **Modes:** `?dev=stale` replaces the current mode. `?dev=off` or `?dev=` clears it.
- **Tools:** `?tools=palette,grid` replaces the tool set entirely with `{palette, grid}`. `?tools=` clears the set.
- If a query param is **absent from the URL**, the stored localStorage value is **left untouched** — navigating to a clean URL does not lose your dev state.
- Both dimensions persist to localStorage on sync, so the query param only needs to appear **once per browser** to "stick."

## Programmatic escape hatch (browser)

When you can't or don't want to modify the URL:

```js
localStorage.setItem("dev-mode", "stale");
localStorage.setItem("dev-tools", "palette,grid");
// clear
localStorage.removeItem("dev-mode");
localStorage.removeItem("dev-tools");
```

## Reference implementation

A small vanilla-JS/TS module lives at `landing/src/lib/dev-flags.ts` (or wherever the landing build puts it). Small enough to copy-paste across projects — not published as a package yet.

Exposes:

- `getDevMode(): string | null` — current mode, or `null` if none set
- `getDevTools(): Set<string>` — current enabled tool set
- `hasTool(name: string): boolean` — convenience check
- `syncDevFlagsFromUrl(): void` — read URL params, mirror into localStorage. Call once at the top of the client script before reading flags.

### Usage pattern

```ts
import { syncDevFlagsFromUrl, hasTool, getDevMode } from "./lib/dev-flags";

syncDevFlagsFromUrl();

if (getDevMode() === "stale") {
  // force the stale-image fallback state
}
if (hasTool("palette")) {
  // reveal the palette picker overlay
}
```

## Worker-side (server)

Workers don't have localStorage or persistence between requests, so the "sticky" part of the spec only applies to browser clients. For the Worker (`src/index.ts`) the contract is:

- Read `?dev=<mode>` and `?tools=<csv>` from the request URL on each request
- Parse once at the entry point into a single `devFlags` object; everything downstream reads from that object (same "gate at the boundary" principle)
- **Gating:** only honor dev params when an env-driven flag is set. Preferred approach is reading `env.ENVIRONMENT === "development"` from `.dev.vars` (gitignored). Unset env is treated as production. Dev params on a production request are silently ignored.

The mode/tool **names** and kebab-case conventions are the same as browser-side.

## Naming

Short, scenario-oriented, kebab-case:

| Good | Bad |
|---|---|
| `?dev=video` | `?dev=force-video-thumbnail-branch` |
| `?dev=nasa-error` | `?dev=force-nasa-500` |
| `?tools=palette` | `?tools=show-theme-palette-overlay` |

Avoid implementation details in the name. `video` is a scenario; `force-video-thumbnail-branch` leaks internals.

## Current modes and tools (NASA Picture Proxy)

### Landing (`landing/index.html`)

| Param | Description |
|---|---|
| `?dev=fallback` | Force the "image not available" fallback state |
| `?dev=stale` | Simulate the stale fallback UI: adds the "Showing a recent image, today's is unavailable" notice to the caption. The image itself is still today's. |

> Landing currently uses the `?dev=` query param but **does not persist to `dev-mode` localStorage** and **does not honor `?dev=off` as a clear**. Retrofit tracked in TASK-0036.

### Worker (`src/index.ts`)

Gated on `env.ENVIRONMENT === "development"` (set in `.dev.vars`, gitignored). If the env var is unset or any other value, dev params are silently ignored and all requests go through the normal path.

| Param | Task | Description |
|---|---|---|
| `?dev=video` | TASK-0019 | Return a hard-coded video APOD fixture *with* a poster image so the video-poster branch of `resolveApod` can be exercised. Only short-circuits for today's date; walkback iterations still hit the normal path. Bypasses the APOD cache entirely so fixture runs never pollute real cached data. |
| `?dev=video-no-thumb` | TASK-0019 | Return a hard-coded video APOD fixture *without* a poster (`image: null`). `resolveApod` returns null for today, so the walkback path runs and pulls the next resolvable day. |
| `?dev=nasa-error` | TASK-0020, TASK-0044 | Skip the upstream APOD fetch and simulate an upstream failure: serve the stale cache entry if present, otherwise 502. The simulated failure applies to every date in the walkback, so the Worker serves the newest stale entry across today and the previous 7 days (`MAX_LOOKBACK_DAYS`), and returns 502 only when none is cached. Image bytes are still fetched from NASA. Bypasses the primary cache so every request reliably exercises the fallback. The apod.nasa.gov scrape that used to follow the stale check was removed in EPIC-0006. |

## Why this shape

- **Separate namespaces for exclusive vs. additive toggles.** Trying to combine two modes is nonsensical; combining two tools is natural. Splitting them keeps the semantics honest.
- **Kebab-case CSVs** are URL-safe and don't need escaping.
- **Declarative URL + sticky localStorage** means one link shared with someone can set their state, but navigating away doesn't clobber it.
- **Single registry.** This file is the authoritative list of dev modes and tools across NASA Picture Proxy. When you add a new one, add it here too.

## Prior art and sibling projects

- **Portfolio** — palette picker overlay originated the `?tools=` pattern (was previously `?palette=1` + `palette-picker` key; retrofit 2026-04-09)
- **NASA Picture Proxy (this repo)** — originated the `?dev=fallback` / `?dev=stale` mode shape. Landing page retrofit to the full shared convention (localStorage + `off` clear) tracked in TASK-0036.

## Open questions

- Third dimension for typed config values (e.g. `?config=delay:500,region:us-west`)? For now, piggyback on mode names like `?dev=slow-500` if needed — avoid premature dimension creep.
- Shared npm package? Not yet — the module is small enough to copy-paste, and each project stays free to evolve independently. Revisit if 3+ projects adopt and drift becomes a problem.

## Housekeeping

When a new dev mode or tool is added to the code, update the "Current modes and tools" tables above in the same change. This doc is the canonical registry for this repo.
