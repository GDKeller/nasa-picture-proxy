---
type: task
status: closed
priority: 2
created: 2026-03-31
---

# Fix empty datetime attribute on time element

The `<time datetime="">` element in the landing page HTML (line 477) has an empty `datetime` attribute. The value is populated by JS after load, but the initial server-rendered HTML is invalid per the W3C validator — `datetime` must match a valid time-datetime format if present.

## Fix options

- Remove the `datetime` attribute from the initial HTML and only add it via JS when the value is available
- Pre-populate with a fallback date server-side
