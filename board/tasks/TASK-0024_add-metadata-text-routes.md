---
type: task
status: done
created: 2026-04-09
parent: NOTE-0005
---

# Add metadata text routes to Worker

**Decision: won't implement.** These routes were prototyped and reviewed but ultimately dropped.

On video days, the image routes fall back to the most recent image APOD via `findLatestImage()`, so `/title` etc. would need the same fallback to stay consistent. At that point the caller also needs `/date` to know which APOD the metadata describes, which means multiple requests for data already available in a single `/info` call. Individual plain-text field routes don't add value over `/info`.
