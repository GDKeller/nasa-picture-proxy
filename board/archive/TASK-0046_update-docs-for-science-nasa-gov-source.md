---
type: task
status: done
priority: 1
created: 2026-10-20
parent: EPIC-0006
blocked_by: [TASK-0042, TASK-0043, TASK-0044]
---

# Update docs and user-facing text for the science.nasa.gov source

Bring every doc and user-facing string in line with the new source. Follow `landing/CLAUDE.md` for voice on anything user-facing, including `/about`.

## Items

1. **README.md**
   - The intro link `https://apod.nasa.gov/apod/astropix.html` becomes `https://science.nasa.gov/apod/`.
   - "Returns data from the APOD API" needs to name the new source.
   - Update the video paragraph to describe what TASK-0043 ships (NASA poster on YouTube days, walkback on MP4 days).
   - Rewrite the caching section. It is already inaccurate: it describes `cf: { cacheTtl, cacheEverything }` and `formatDate(new Date())`, but the code uses `caches.default` with versioned keys and `todayET`.
2. **`/info` contract.** If TASK-0042/0043 add `permalink` or change what `url` means on video days, update the README endpoint table and the landing `/info` row (`landing/index.html`, "Title, date, explanation, URLs, copyright").
3. **`/about` text** (`src/index.ts`, around 744-746). "Video days are skipped automatically" has been wrong since TASK-0019. Name NASA's site as the source.
4. **Header comment** at `src/index.ts:2-6`.
5. **`.claude/CLAUDE.md`**
   - Update the Project Overview ("proxies NASA's Astronomy Picture of the Day API").
   - Update the cache notes ("when NASA's API is down or rate-limited").
   - Remove the `NASA_API_KEY` / `DEMO_KEY` Environment entry.
6. **Landing footer link** (`landing/index.html`, around 135-136) becomes `https://science.nasa.gov/apod/`.
7. **REFE-0001** dev-mode table, if TASK-0044 changed the `nasa-error` semantics.

## Acceptance

- `rg -n 'api\.nasa\.gov|apod\.nasa\.gov|DEMO_KEY|NASA_API_KEY' --glob '!board/archive/**' --glob '!.specstory/**'` returns nothing, apart from EPIC-0006's history notes.
- `/about` and the landing copy read in the brand voice from `landing/CLAUDE.md`.
