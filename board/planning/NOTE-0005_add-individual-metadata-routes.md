---
type: note
status: inbox
created: 2026-03-30
---

# Add individual metadata routes

Add dedicated routes for individual APOD metadata fields, so consumers can fetch just what they need without parsing JSON from `/info`:

- `/date` — today's APOD date
- `/title` — image title
- `/explanation` — description text
- `/copyright` — copyright holder (if any)

Returns plain text. Useful for shell scripts, widgets, and other lightweight integrations.
