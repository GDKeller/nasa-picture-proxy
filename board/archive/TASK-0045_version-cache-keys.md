---
type: task
status: done
priority: 1
created: 2026-10-20
parent: EPIC-0006
---

# Version cache keys so pre-migration entries are never read

Make the cache key scheme change whenever the cached shape or upstream source changes, so the migration never serves data cached from the old source.

## Context

- **Metadata keys are date-only.** `apodCacheUrl` (`src/index.ts:143-145`) builds `https://api.nasapicture.com/_cache/apod/${date}`, plus a `:stale` variant (180-181).
- **The bad entries outlive a deploy.** The NASA-logo `ApodResponse` cached on 2026-10-20 stays readable for up to 6h in the primary tier and up to 24h in the stale tier.
- **Cache is read before any new code runs.** `fetchApod` (163-209) checks the cache first, so a code fix alone would still serve the logo.
- **Image and dimension caches mostly fix themselves.** They are keyed by upstream URL (`/_cache/image/…` at 452-453, `/_cache/dimensions/…` at 502-504), so they recover once metadata yields new URLs. The logo bytes sit under one shared key, which never needs to be read again.

## Implementation

1. Add a version segment to every `_cache` key (`/_cache/v2/apod/…`, `/_cache/v2/image/…`, `/_cache/v2/dimensions/…`), defined once as a constant. Add a comment at the constant saying to bump it whenever the cached shape or upstream source changes.
2. Don't purge and don't wait for TTLs. Old keys are never read again and expire on their own.
3. Known limit: responses already sent carry `Cache-Control: public, max-age=21600` (`baseHeaders`, 553-568). Browsers and downstream proxies that fetched the logo may keep showing it for up to 6h after deploy. The Worker can't recall those.

## Acceptance

- A test seeds an entry under the old unversioned key and proves it is ignored.
- The key version lives in a single constant used by every cache key.
- `npx tsc --noEmit` and `npm test` pass.
