---
type: task
status: done
priority: 1
created: 2026-04-01
---

# Validate image URL hostname before fetching

The Worker fetches whatever URL NASA's API returns in `apod.url`/`apod.hdurl` with no hostname validation. If NASA's API were compromised or returned unexpected data, the Worker would fetch arbitrary URLs (SSRF-adjacent).

## Context

- 200 random APOD samples all return `apod.nasa.gov` as the image host
- NASA's API docs do not guarantee the domain — it's not contractually locked
- Cloudflare Workers `fetch()` can't reach private IPs, which limits practical SSRF risk
- Still worth guarding against as a defense-in-depth measure

## Implementation

- Allow `*.nasa.gov` hostnames (loose enough to survive NASA restructuring)
- Require HTTPS scheme
- Return a 502 with a clear error message if validation fails
- Log a warning on blocked URLs so false positives are caught quickly

## Also

- Clean up upstream header passthrough in `fetchImageCached` — only preserve `Content-Type` and `Content-Length` rather than spreading all upstream headers
