---
type: task
status: done
priority: 3
created: 2026-03-31
---

# Improve copy-to-clipboard UX on usage examples

The URL and `<img>` example text in the usage row should be clickable to copy (not just the small copy icon). Also improve visual feedback and discoverability.

## Changes

- Make the entire `<code>` text area clickable to copy, not just the icon button
- Add a `title="Click to copy"` tooltip on the clickable area
- Show the word "Copied" as visual feedback (in addition to the existing checkmark icon swap)
