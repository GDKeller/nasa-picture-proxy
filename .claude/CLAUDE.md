# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APOD Proxy — a Cloudflare Worker that proxies NASA's Astronomy Picture of the Day API behind stable, fixed URLs.

## Commands

- `npm run dev` starts the API (localhost:8787) and landing page (localhost:8788) in the background. Check them with `npm run status`, stop them with `npm run stop`, and read logs with the `npm run log:*` scripts.
- Type-check with `npx tsc --noEmit`. There is no build artifact; Wrangler bundles `src/` directly.

## Architecture

Caching uses the Workers Cache API (`caches.default`) with a two-tier strategy — no KV, D1, or cron:
- **Primary cache** (6h TTL): APOD metadata keyed by ET date, image bytes keyed by NASA URL
- **Stale fallback** (24h TTL): same data under a `:stale` suffixed key, served when NASA's API is down or rate-limited

Cache keys are date-based in `America/New_York` timezone, so they roll over at midnight ET. Cache key URLs must use a zone-scoped hostname (`https://api.nasapicture.com/_cache/...`), not synthetic hostnames -- `caches.default` silently drops writes for unknown hosts.

The landing page (`landing/`) is served at `nasapicture.com` via Cloudflare Pages. The Worker serves `api.nasapicture.com` and `get.nasapicture.com`. Brand voice and design context live in `landing/CLAUDE.md`; read it before writing user-facing copy anywhere, including the Worker's `/about` text.

## Environment

- **`NASA_API_KEY`** — optional secret; falls back to `DEMO_KEY` (30 req/hr, sufficient behind cache). Set via `npx wrangler secret put NASA_API_KEY`.
- Local secrets go in `.dev.vars` (gitignored).

## Project Board

This project uses a structured board system for project management.

- **Ask before creating new board files** — don't auto-create tasks, ADRs, etc.
- Follow the board system spec for all documentation artifacts
- Use `/board:board-show` to see current board state
- Use `/board:board-add` to create new items
- Use `/board:board-update` after completing significant work to reconcile the board
- Use `/board:board-check` when starting work to find related board context
