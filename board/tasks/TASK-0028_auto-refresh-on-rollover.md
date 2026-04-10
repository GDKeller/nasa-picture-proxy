---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0002
---

# Auto-refresh landing page on APOD rollover

When a user leaves the landing page open, the image and caption should update automatically when NASA publishes the new APOD. Spawned from NOTE-0010.

## Step 0: Extract `updateApod(data)` helper

The landing page currently sets the image, caption, and dimensions inline in a Promise chain in `landing/index.html` (around lines 224-253). Before any of the rollover logic can be wired up, refactor this into a reusable `updateApod(data)` function that takes a fresh `/info` response and updates the DOM. This function does not exist yet — it needs to be created as the first step, and the initial page load should then call it.

## Approach

Two phases: a coarse countdown that converges on midnight ET, then burst polling to catch the exact publish moment.

### Phase 1: countdown

- On page load, store `currentDate` from initial `/info` response
- Compute clock offset from that response's `Date` header: `serverTime - localTime`
- `setInterval` every 5 minutes recalculates ms until midnight ET using the offset. Self-corrects for timer drift and background-tab throttling.

### Phase 2: burst polling

- When under 5 minutes remain, clear the interval and poll `/info` every 2 minutes
- When `data.date !== currentDate`, call `updateApod(data)`, stop polling, re-enter phase 1
- Cap burst at 30 minutes (15 requests max); if no change, re-enter phase 1

### Visibility handler

- On `visibilitychange` to visible, do an immediate `/info` check to catch long-hidden tabs

## Image transition on rollover

- Fade out current image (remove `.loaded`), fetch new `/thumb`, set as wrapper background
- Cache-bust: `img.src = ${API_BASE}/optimized?d=${data.date}`. Apply `?d=${data.date}` to the `/thumb` fetch too, since the same browser-cache problem applies.
- Update aspect ratio from new dimensions; fade back in on `img.load`
- Respect `prefers-reduced-motion` (skip fade, show immediately)
- **Revoke previous blob URL** — each rollover creates a new blob URL via `URL.createObjectURL()` for the thumbnail. Call `URL.revokeObjectURL()` on the previous one before creating the next, otherwise memory leaks accumulate across rollovers. This is easy to forget and is the most common bug pattern for this kind of refresh loop.

## Implementation notes

- All changes in `landing/index.html` script block, no Worker changes
- Cache keys roll at midnight ET so post-midnight `/info` requests cache-miss and fetch fresh from NASA
- Zero new dependencies

## Acceptance

- Tab open across midnight ET updates image and caption with a fade transition
- `visibilitychange` triggers an immediate check after long-hidden state
- Respects `prefers-reduced-motion`
- No memory leak from blob URLs across rollovers
