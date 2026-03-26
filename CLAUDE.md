# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APOD Proxy — a Cloudflare Worker that proxies NASA's Astronomy Picture of the Day API behind stable, fixed URLs. Serves today's APOD image (standard or HD) or JSON metadata. Falls back up to 7 days when the daily APOD is a video.

## Commands

```bash
npm run dev        # Local dev server at http://localhost:8787
npm run deploy     # Deploy to Cloudflare Workers
npx tsc --noEmit   # Type-check (no build artifact — Wrangler bundles directly)
```

## Architecture

Single-file Worker (`src/index.ts`) with three routes:

- `GET /` — proxies today's HD APOD image (falls back to standard if unavailable)
- `GET /sd` — proxies the standard-res version
- `GET /info` — returns JSON metadata

Caching is handled entirely by Cloudflare's edge cache via `cf: { cacheTtl, cacheEverything }` on fetch calls — no KV, D1, or cron. Cache key changes naturally when the date rolls over (new date string = new API URL).

The `findLatestImage` function walks backwards from today up to `MAX_LOOKBACK_DAYS` (7) to skip video APODs.

## Environment

- **`NASA_API_KEY`** — optional secret; falls back to `DEMO_KEY` (30 req/hr, sufficient behind cache). Set via `npx wrangler secret put NASA_API_KEY`.
- Local secrets go in `.dev.vars` (gitignored).
