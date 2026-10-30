---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0002
---

# Fix focus toggle markup and discoverability

The focus toggle now has visible "Focus" text alongside the icon, but the markup was not updated when the label was added. Spawned from NOTE-0017 (remaining items).

## Problems

- **Accessible-name mismatch.** `index.html:131` has `aria-label="Dim the lights"` but the visible `<span class="label">` says "Focus". When a button has visible text, `aria-label` overrides what screen readers announce, so sighted users see "Focus" while screen reader users hear "Dim the lights". WCAG 2.5.3 (Label in Name) failure.
- **No toggle semantics.** This is a binary on/off toggle but has no `aria-pressed` state. Assistive tech can't tell whether focus mode is active.
- **Redundant `title` tooltip.** Now that text is visible, the `title="Dim the lights"` attribute is noise (and also stale).
- **Tiny label size.** `.label` is `font-size: 0.5rem` (~8px) at `_focus-mode.scss:29`, smaller than ideal for discoverability.

## Fix

- Remove `aria-label` (let the visible "Focus" text be the accessible name), or update it to match the visible text
- Remove the `title` attribute
- Add `aria-pressed` reflecting focus-mode state, updated in the click handler when `.focus-mode` is toggled on `body`
- Bump `.label` font-size so it reads clearly without squinting (tune alongside icon for balance)

## Acceptance

- Accessible name matches visible text (no mismatch flagged by axe / Lighthouse)
- `aria-pressed="true"` when focus mode is active, `"false"` otherwise
- Label is readable at default zoom without squinting
- Existing focus-mode behavior (overlay, Esc, overlay click to exit) is unchanged
