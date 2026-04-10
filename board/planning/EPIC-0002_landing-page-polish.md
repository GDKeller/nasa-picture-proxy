---
type: epic
status: planning
created: 2026-04-03
updated: 2026-04-09
---

# Landing Page Polish

Address remaining items from the design critique (NOTE-0017) and add content and behavior improvements. Several original findings have already been resolved by subsequent landing work — see "Already done" below.

## Tasks

### Content
- **TASK-0027**: Add a "Why is this needed" section between the hero and endpoint docs. From NOTE-0006.

### Design refinement (remaining NOTE-0017 items)
- **TASK-0029**: Fix focus toggle markup and discoverability. The visible "Focus" label shipped but `aria-label`/`title` still say "Dim the lights" (accessible-name mismatch), there's no `aria-pressed` state, and the label font size is too small.
- **TASK-0030**: Landing page bug cleanup — `--font-weight-medmium` typo, `/optimized` and `/thumb` missing from the endpoint list, verify caption spread on wide viewports.

### Behavior
- **TASK-0028**: Auto-refresh on APOD rollover. Self-correcting countdown + burst polling, fade transition, visibility-change handler. All in `landing/index.html` JS. From NOTE-0010.
- **TASK-0031**: Local timezone APOD rollover (blocked by TASK-0011). `?tz=` param on API + `Intl.DateTimeFormat` detection on landing. Phase 1 handles west-of-ET without R2; Phase 2 needs the archive. From NOTE-0016.

## Already done (from NOTE-0017)

- ~~[P2] 10rem dead zone~~ — fixed, now `margin-bottom: 3rem` at `_hero.scss:7`
- ~~[P3] Image loading empty void~~ — thumbnail placeholder + pre-sized container shipped in commit `44b4816`
- ~~Empty `<nav>` in header~~ — removed in commit `cb80f4c`

## Deferred / dropped

- **Amber accent color (#e8a838)** — original design spec called for it but we're keeping the monochrome palette for now. May revisit.

## Suggested sequence

1. TASK-0030 (quick cleanup) — small, unblocks reading the critique as "closed out"
2. TASK-0029 (focus toggle) — a11y fix, small
3. TASK-0027 (why-is-this-needed) — content addition
4. TASK-0028 (auto-refresh) — behavior, larger
5. TASK-0031 (local timezone) — deferred until TASK-0011 ships

## Related notes

- NOTE-0006, NOTE-0010, NOTE-0016, NOTE-0017 — all archived as processed after spawning the tasks above
