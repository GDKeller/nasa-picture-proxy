---
type: task
status: closed
priority: 2
created: 2026-03-31
---

# Fix Cloudflare beacon SRI hash mismatch

The `integrity` attribute (sha512) on the Cloudflare Web Analytics beacon script does not match the content of the fetched resource. The computed hash is a zero-byte hash, suggesting the resource failed to load (likely related to the CORS error in TASK-0005) and the browser is comparing against an empty response.

## Context

Reproduces in production at https://nasapicture.com/. This is a downstream symptom of the CORS failure — if TASK-0005 is resolved, this will likely resolve too. If not, the SRI hash in the injected snippet may be stale and need regeneration via the Cloudflare dashboard.

## Resolution

Downstream of TASK-0005. Browser tracking protection blocks the beacon fetch, so the browser hashes an empty response — hence the mismatch. Not a real issue.
