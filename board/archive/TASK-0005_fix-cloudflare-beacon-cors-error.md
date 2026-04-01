---
type: task
status: closed
priority: 2
created: 2026-03-31
---

# Fix Cloudflare beacon CORS error

Cross-Origin Request Blocked for `https://static.cloudflareinsights.com/beacon.min.js`. The Cloudflare Web Analytics script is failing to load due to CORS policy.

## Context

This is injected by Cloudflare (Web Analytics), not by project code. Reproduces in production at https://nasapicture.com/. Likely caused by a Content-Security-Policy header or Cloudflare Web Analytics configuration issue. Investigate whether CSP headers need adjusting or the analytics snippet needs updating in the Cloudflare dashboard.

## Resolution

Not a bug — caused by browser tracking protection (e.g. Zen/Firefox) blocking requests to `static.cloudflareinsights.com`. The beacon fails gracefully and does not affect site functionality.
