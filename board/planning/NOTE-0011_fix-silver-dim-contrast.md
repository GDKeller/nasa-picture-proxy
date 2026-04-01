---
type: note
status: inbox
created: 2026-04-01
---

# Fix silver-dim text color for WCAG contrast compliance

The `--silver-dim` color on text fails WCAG AA contrast checks against the dark background.

## Proposed changes

- `--silver`: bring up to `#eeeff2`
- `--silver-dim`: bring up to `#b8bcc6`
