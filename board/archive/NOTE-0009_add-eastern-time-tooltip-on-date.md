---
type: note
status: inbox
created: 2026-03-31
---

# Add Eastern Time explanation tooltip on date

The APOD date in the hero caption can appear to be "tomorrow" for users in western US time zones (e.g. PT), since NASA publishes the APOD on Eastern Time. Add a subtle tooltip or hover note on the date explaining this.

## Ideas

- Tooltip on hover over the date (e.g. "NASA publishes on Eastern Time")
- Small inline note like "ET" next to the date
- A `title` attribute on the `<time>` element as the simplest approach
