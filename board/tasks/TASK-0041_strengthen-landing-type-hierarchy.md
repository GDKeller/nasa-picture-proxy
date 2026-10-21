---
type: task
status: backlog
priority: 3
created: 2026-10-20
parent: EPIC-0002
---

# Strengthen landing page type hierarchy

The impeccable design hook flags `landing/index.html` with `flat-type-hierarchy`: "Dominant heading and body roles are separated by less than 1.25× at every step, leaving the size hierarchy flat. Add at least one stronger size step." The finding predates the 2026-10-20 session; no recent change introduced it.

## Current state

Font sizes are raw `rem` values spread across partials, with no size tokens in `_variables.scss`. Range is 0.5rem to 1.2rem:

- `_hero.scss`: 0.65, 0.8, 0.9, 1.1, 1.2rem (caption title, tagline, stale notice, etc.)
- `_header.scss`: 1rem site heading, 0.8rem
- `_endpoints.scss`: 0.875rem `h2`, 0.75rem desc, 0.6rem type, 0.8rem
- `_footer.scss`: 0.8rem
- `_focus-mode.scss`: 0.5rem label (also tracked in TASK-0029)

## Decide first

The flat scale may be intentional. `landing/CLAUDE.md` says "The image is the hero" and "Earn trust through restraint". Decide one of:

1. **Intentional**: suppress the finding with `impeccable hooks ignore-value flat-type-hierarchy "*" --file landing/index.html --reason "<decision + evidence>"` and close this task.
2. **Real problem**: add one stronger step (e.g. the "API Endpoints" `h2` or the caption title) without competing with the APOD image.

## Implementation (if option 2)

1. Add semantic size tokens to `_variables.scss` (e.g. `--font-size-caption`, `--font-size-heading`) and replace the raw values they cover.
2. Give at least one heading role a ≥1.25× step over body text.
3. Check the hero still reads image-first at 400px, 1024px, and 1600px.

## Acceptance

- Either a recorded suppression with the reason, or the impeccable hook no longer reports `flat-type-hierarchy` for `landing/index.html`
- No heading visually competes with the APOD image
- WCAG AA contrast unchanged
