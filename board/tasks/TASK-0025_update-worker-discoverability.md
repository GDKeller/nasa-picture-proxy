---
type: task
status: todo
created: 2026-04-09
parent: NOTE-0005
blocked-by: TASK-0024
note: TASK-0026 (landing page listing) was dropped -- these routes are discoverable via /info and /about only
---

# Update Worker discoverability strings for metadata routes

Update four places in `src/index.ts` that list available routes:

1. **`/info` endpoints map** (~line 388): add `/date`, `/title`, `/explanation`, `/copyright` with descriptions
2. **`/about` ASCII art route listing** (~line 456): add four lines matching the existing format
3. **404 error message** (~line 478): append the new route names to the route list string
4. **`baseHeaders()` Link header** (~line 267): add the four new routes to the `rel="alternate"` / `rel="describedby"` Link header array

## Acceptance

- `/info` JSON response includes all four new routes in the `endpoints` object
- `/about` plain text lists all four new routes
- 404 response mentions the new routes
- `Link` response header on all endpoints includes the four new routes
