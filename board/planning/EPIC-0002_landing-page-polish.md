---
type: epic
status: planning
created: 2026-04-03
---

# Landing Page Polish

Address the design critique findings (NOTE-0017, scored 25/40) and add content and behavior improvements. Work spans layout fixes, color introduction, content additions, and dynamic refresh behavior.

## Areas

### Content
- **NOTE-0006**: Add a "Why Is This Needed" section between the hero and endpoint docs. Explains what APOD is, why NASA's API is awkward, and what nasapicture.com solves. Concise, matching the existing voice.

### Design (from NOTE-0017 critique)
- **[P2] Dead zone**: `margin-bottom: 10rem` on `.hero-image-area` creates a scroll void. Reduce to 3-4rem.
- **[P2] Focus toggle hidden**: Lamp icon has no label, most users never discover it. Add text label or entrance animation.
- **[P2] No accent color**: Amber (#e8a838) specified in design direction but unused. Apply sparingly on interactive elements (copy hover, endpoint links, focus toggle).
- **[P3] Caption spread**: Title and date scatter across wide viewports. Constrain or cluster tighter.
- **Minor**: `--font-weight-medmium` typo, empty `<nav>`, `/optimized` missing from endpoint list, usage row animation delay.

### Behavior
- **TASK-0023**: Image fallback state. When the API is down and the image can't load, show a styled placeholder instead of a black void. Future tier: fall back to R2-archived image (requires TASK-0011).
- **NOTE-0010**: Auto-refresh on APOD rollover. Poll `/info` every 15-30min (only when tab visible), compare date, fade-transition to new image/caption on change.
- **NOTE-0016**: Local timezone rollover (nice-to-have). `?tz=` param on API, detect via `Intl.DateTimeFormat` on landing page. Timezones behind ET are straightforward; ahead-of-ET needs fallback (which `findLatestImage` already handles). Ties to EPIC-0003 (R2 archiving makes timezone-shifted "yesterday" trivial).

## Suggested Sequence

1. Layout/spacing fixes (dead zone, caption spread, minor bugs)
2. Introduce amber accent on interactive elements
3. "Why Is This Needed" content section
4. Focus toggle discoverability
5. Auto-refresh behavior
6. Local timezone (deferred until R2 archiving is in place)

## Related Notes

- NOTE-0006: Add a "Why Is This Needed" section
- NOTE-0010: Auto-refresh landing page on APOD rollover
- NOTE-0016: Local timezone APOD rollover
- NOTE-0017: Landing page design critique (April 2026)
