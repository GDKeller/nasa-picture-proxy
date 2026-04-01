# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APOD Proxy — a Cloudflare Worker that proxies NASA's Astronomy Picture of the Day API behind stable, fixed URLs. Serves today's APOD image (standard or HD) or JSON metadata. Falls back up to 7 days when the daily APOD is a video.

## Commands

```bash
npm run dev        # Local dev server at http://localhost:8787
npm run deploy     # Deploy to Cloudflare Workers
npx tsc --noEmit   # Type-check (no build artifact — Wrangler bundles directly)
npm run api        # API dev server only (no landing page)
npm run log        # Tail both API and landing page logs
npm run stop       # Kill dev servers
```

## Architecture

Single-file Worker (`src/index.ts`) with these routes (plus `.jpg` aliases for each image endpoint):

- `GET /` — proxies today's HD APOD image (falls back to standard if unavailable)
- `GET /sd` — proxies the standard-res version
- `GET /optimized` — optimized image (≤1200px, auto WebP/AVIF via Cloudflare Image Transformations)
- `GET /info` — returns JSON metadata
- `GET /about` — plain-text description and attribution

Caching uses the Workers Cache API (`caches.default`) with a two-tier strategy — no KV, D1, or cron:
- **Primary cache** (6h TTL): APOD metadata keyed by ET date, image bytes keyed by NASA URL
- **Stale fallback** (24h TTL): same data under a `:stale` suffixed key, served when NASA's API is down or rate-limited

Cache keys are date-based in `America/New_York` timezone, so they roll over at midnight ET.

The `findLatestImage` function walks backwards from today up to `MAX_LOOKBACK_DAYS` (7) to skip video APODs.

The landing page (`landing/index.html`) is a static site served at `nasapicture.com`. The Worker serves `api.nasapicture.com` and `get.nasapicture.com`.

## Environment

- **`NASA_API_KEY`** — optional secret; falls back to `DEMO_KEY` (30 req/hr, sufficient behind cache). Set via `npx wrangler secret put NASA_API_KEY`.
- Local secrets go in `.dev.vars` (gitignored).

## Design Context

### Users
Everyone — developers integrating the API into dashboards and side projects, tinkerers building for fun, and general visitors who stumble on the domain out of curiosity about space. The landing page should be immediately understandable to non-technical visitors while giving developers everything they need.

### Brand Personality
**Clever, minimal, precise.** The voice is confident and concise — says a lot with few words. Engineering craft without jargon. Personality comes through in small details (the /about ASCII art, "That's it. That's the whole integration."), never through excess.

### Emotional Goals
**Awe + simplicity.** Visitors should feel wonder at the cosmos (the APOD image does the heavy lifting) and relief at how easy the tool is. The design should get out of the way of the content while still feeling crafted.

### Aesthetic Direction
- **Theme**: Dark space — deep navy (#0a0e17) with atmospheric depth (starfield, glows), not flat black
- **Accent**: Warm amber/gold (#e8a838) — deliberate contrast to typical blue/purple space sites
- **Typography**: Instrument Serif (headings), DM Sans (body), JetBrains Mono (code) — no generic fonts
- **Layout**: Generous whitespace, content-forward, max-width constrained (~5xl)
- **Motion**: Subtle and purposeful — twinkling stars, staggered fade-ins, gentle hover lifts. Always respect `prefers-reduced-motion`
- **Anti-references**: No AI slop aesthetics, no purple gradients on white, no cookie-cutter SaaS layouts

### Design Principles
1. **The image is the hero** — everything else supports it. Never compete with the APOD for attention.
2. **Earn trust through restraint** — fewer elements, better. If it doesn't serve the visitor, remove it.
3. **Craft in the details** — personality lives in small moments (ASCII art, code comments, hover states), not in loud design choices.
4. **Accessible by default** — WCAG AA contrast, semantic HTML, reduced-motion alternatives. Accessibility is not optional.
5. **One file, zero friction** — the landing page mirrors the API philosophy: simple to deploy, simple to understand.

## Project Board

This project uses a structured board system for project management.

- **Ask before creating new board files** — don't auto-create tasks, ADRs, etc.
- Follow the board system spec for all documentation artifacts
- Use `/board:board-show` to see current board state
- Use `/board:board-add` to create new items
- Use `/board:board-update` after completing significant work to reconcile the board
- Use `/board:board-check` when starting work to find related board context
