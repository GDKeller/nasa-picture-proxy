---
type: task
status: closed
priority: 3
created: 2026-03-31
---

# Fix hero section missing heading

The `.hero` `<section>` element lacks an `h2`–`h6` heading, flagged as a warning by the W3C validator. Sections should have identifying headings for document outline and accessibility.

## Fix options

- Add a visually-hidden heading (e.g., `<h2 class="sr-only">Today's Astronomy Picture</h2>`)
- Change the `<section>` to a `<div>` if it doesn't represent a distinct document section
