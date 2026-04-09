---
type: task
status: wontdo
created: 2026-04-09
parent: NOTE-0005
blocked-by: TASK-0024
---

# Add metadata routes to landing page endpoint list

Add `/date`, `/title`, `/explanation`, `/copyright` to the endpoint grid in `landing/index.html` (~line 87).

## Implementation

- Each route gets an `<a class="endpoint-row">` matching the existing pattern
- Route code, short description, and `text/plain` type badge
- Insert after the existing `/about` row

## Notes (from review)

- No SCSS changes needed: `_endpoints.scss` styles `.endpoint-row` generically, `:last-child` border rule auto-adjusts
- `min-width: 6rem` on `.endpoint-route` is slightly tight for `/explanation` (9 chars mono) but won't break, just shifts description column
- Adding four `text/plain` rows after `/about` doubles the list to eight rows -- consider whether a subtle grouping separator or label would help, or whether listing all four individually is warranted vs. just noting them in `/info`

## Acceptance

- All four routes appear in the landing page endpoint list
- Links point to `https://api.nasapicture.com/{route}` with `target="_blank"`
- Visual style matches existing endpoint rows
