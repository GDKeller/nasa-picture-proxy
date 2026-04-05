---
type: note
status: inbox
created: 2026-03-31
---

# Auto-refresh landing page on APOD rollover

If a user leaves the landing page open, the image and caption should update automatically when NASA publishes the new APOD — no manual reload required.

## Approach: Self-correcting countdown + short-burst polling

Two phases: a coarse countdown that converges on midnight ET, then burst polling to catch the exact publish moment.

### Phase 1: Countdown

On page load, compute the offset between the user's clock and CF server time (from the `/info` response `Date` header). Use this offset to calculate a corrected "time until midnight ET." Run a `setInterval` every 5 minutes that recalculates the remaining time. This self-corrects for:
- Long `setTimeout` drift (browsers throttle timers in background tabs)
- Tabs hidden for hours or days (each tick recalculates from scratch)
- No single long timeout that fires late or not at all

When the countdown shows <5 minutes to midnight ET, transition to phase 2.

### Phase 2: Burst polling

Poll `/info` every 2 minutes, comparing `data.date` to `currentDate`. When the date changes, call `updateApod(data)` and stop polling. Cap at 30 minutes (15 requests max), then re-enter phase 1 and schedule the next midnight.

Total requests per rollover: ~15. Total requests the rest of the day: zero.

### Sequence

1. On page load, store `currentDate` from initial `/info` response
2. Compute clock offset from CF `Date` header: `serverTime - localTime`
3. Start 5-min `setInterval` that recalculates ms until midnight ET using the offset
4. When <5 min remain, clear the interval and start 2-min burst polling
5. When `data.date !== currentDate`, call `updateApod(data)`, stop polling, re-enter step 3 for next day
6. After 30 min with no date change, stop polling and re-enter step 3
7. On `visibilitychange` to visible, do an immediate `/info` check (catches long-hidden tabs)

### Image transition on rollover

- Fade out current image (remove `.loaded` class)
- Fetch new `/thumb`, set as wrapper background
- Cache-bust the image by appending the new date: `img.src = \`${API_BASE}/optimized?d=${data.date}\``
- Update aspect ratio from new dimensions
- On `img.load`, fade back in
- Respect `prefers-reduced-motion` (skip fade, show immediately)
- Swap happens regardless of focus mode

### Time source: CF `Date` header (preferred)

Use the `Date` response header from the initial `/info` fetch as the authoritative time source. This comes from Cloudflare's edge server (NTP-synced), so it's reliable regardless of the user's local clock. Parse it to compute ms until midnight ET, no extra requests needed.

```js
const res = await fetch(`${API_BASE}/info`);
const serverNow = new Date(res.headers.get('Date'));
// compute ms until midnight ET from serverNow
```

### Alternatives considered

**User's local clock** — Could use `new Date()` from the user's machine to compute time until midnight ET. Simpler, but assumes the user's clock is accurate. Rejected because clock skew on user machines is common enough to cause missed or premature rollovers.

**External time APIs** — worldtimeapi.org and timeapi.io are free, no-key options. Unnecessary here since we already get authoritative time from the CF `Date` header, but available if we ever need a dedicated time source.

### Edge cases

- **Browser image cache** — The `/optimized` URL doesn't change day-to-day, so the browser may serve a stale cached image on rollover. Bust it with a date query param: `/optimized?d=2026-04-05`. The Worker ignores query params for routing but the browser treats it as a new URL.
- **Multiple rollovers** — After each successful rollover, re-enter the countdown phase for the next midnight. Not a one-time setup.
- **Tab hidden for days** — The `visibilitychange` handler does an immediate `/info` check, catching any missed rollovers regardless of how long the tab was hidden.
- **Thumb cache busting** — Same browser cache issue as `/optimized` applies to `/thumb`. Append `?d=${data.date}` to the thumb fetch on rollover too.
- **Object URL cleanup** — Each rollover creates a new blob URL for the thumbnail via `URL.createObjectURL()`. Revoke the previous one with `URL.revokeObjectURL()` to avoid memory leaks.

### Implementation notes

- Refactor initial caption/image/thumbnail setup into a reusable `updateApod(data)` function
- All changes in `landing/index.html` script block, no Worker changes needed
- Cache keys are date-based and roll at midnight ET, so post-midnight `/info` requests will cache-miss for the new date and fetch fresh from NASA
- Zero new dependencies
