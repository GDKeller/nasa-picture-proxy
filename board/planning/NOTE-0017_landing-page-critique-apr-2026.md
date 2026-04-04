---
type: note
status: inbox
created: 2026-04-03T21:30:00-05:00
---

# Landing page design critique (April 2026)

Captured: 2026-04-03 ~9:30 PM CT, dev site at localhost:8788

## Anti-Patterns Verdict: Pass

No AI slop detected. No purple gradients, glassmorphism, glowing accents, or template layouts. Color palette is disciplined void-black-to-silver monochrome. Typography from Adobe Typekit (Source Serif 4 Display, Source Sans 3, Source Code Pro) is distinctive. Layout trusts the APOD image to carry the page.

## Design Health Score: 25/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Image invisible while loading; silent /info failure |
| 2 | Match System / Real World | 4 | -- |
| 3 | User Control and Freedom | 3 | Focus mode exits work (Esc, overlay) |
| 4 | Consistency and Standards | 3 | Animated-bottom-border reused cleanly |
| 5 | Error Prevention | 3 | -- |
| 6 | Recognition Rather Than Recall | 2 | Focus toggle unlabeled; copy affordance subtle |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; single path |
| 8 | Aesthetic and Minimalist Design | 3 | 10rem dead zone undermines minimalism |
| 9 | Error Recovery | 2 | `.catch(() => {})` on /info -- zero feedback |
| 10 | Help and Documentation | 2 | Endpoint list is only docs |

Cognitive load checklist: 1 failure (low, good).

## What's Working

1. **Image is the hero** -- fills ~80vh on desktop, everything recedes. Focus mode ("dim the lights") with 1.5s transition is cinematic and on-brand.
2. **Usage row nails the pitch** -- "New day, new photo, same URL" + copyable URL + img tag. Entire value prop in two lines. Copy interaction with "Copied" badge provides real feedback.
3. **Typography is distinctive** -- Source Serif/Sans/Code Pro family creates hierarchy through subtlety, not volume.

## Priority Issues

### [P2] Dead zone -- `margin-bottom: 10rem` on `.hero-image-area`
Creates massive scroll void on desktop between usage row and endpoints. Users think the page ends. Endpoints section uses `.fade-up` (opacity: 0) and IntersectionObserver may never fire if nobody scrolls through the void.
**Fix**: Reduce to 3-4rem.
**Command**: `/arrange`

### [P2] Focus toggle is hidden
Lamp icon (1rem, silver-dimmer) in top-right has no label. `title="Dim the lights"` only shows as browser tooltip. Most users will never discover it.
**Fix**: Add text label at desktop widths, or a one-time entrance animation.
**Command**: `/delight`

### [P2] No accent color in use
Design spec calls for amber (#e8a838) but it appears nowhere except the tiny logo dot. All interactive elements (copy buttons, endpoint links, usage URLs) are the same silver-gray as non-interactive text.
**Fix**: Apply amber sparingly on copy icon hover, "Copied" badge, endpoint route hover.
**Command**: `/colorize`

### [P3] Image loading -- empty void on slow connections
Hero image starts opacity: 0, transitions on load. On slow connections, users see empty dark rectangle with no loading indication.
**Fix**: Add subtle CSS-only loading shimmer or placeholder gradient.
**Command**: `/delight`

### [P3] Caption layout spreads on wide viewports
Title and date in caption span full image width on desktop, feeling scattered rather than intimate.
**Fix**: Constrain caption width or cluster elements tighter under the image edge.
**Command**: `/arrange`

## Persona Red Flags

**Jordan (First-Timer)**: Code blocks in usage row look static, not clickable. Copy icon is 12x12px at 50% opacity. Scrolls past usage row, sees void, assumes page is done. Focus toggle: "Is that a settings button?"

**Casey (Mobile User)**: Second usage item wraps awkwardly at narrow widths. Copy icon well below 44px touch target. "Copied" badge is tiny and easy to miss.

**Pat (Developer Integrator)**: API URL isn't visually distinguished from surrounding text. All four endpoints given equal weight when `/` is 90% use case. `/optimized` endpoint not listed at all.

## Open Questions

1. **Priority direction**: Issues span layout/spacing (dead zone, caption spread), color/affordance (no accent color, hidden focus toggle), and loading/polish (empty void during image fetch). Which area first?
2. **Scope**: Address top 3 only, all issues, or layout only?
3. **Color level**: The page is fully monochromatic. Design spec calls for amber (#e8a838). Options: minimal (1-2 touches on copy hover/badge only), strategic (3-4 touches on endpoints, copy, focus toggle), or keep monochrome.

## Suggested Action Sequence

1. **`/arrange`** -- Fix 10rem dead zone, caption spread, usage row mobile wrapping
2. **`/colorize`** -- Introduce amber accent on interactive elements (copy, endpoints, focus toggle)
3. **`/delight`** -- Focus toggle discoverability, image loading placeholder
4. **`/polish`** -- Final pass after fixes

## Minor Observations

- `--font-weight-medmium` typo in `_hero.scss:39` -- variable doesn't resolve
- Empty `<nav>` element in header -- screen readers announce empty navigation landmark
- `/optimized` endpoint missing from endpoint list despite being a valid route
- `.usage-row` animation delay 0.8s means primary interactive content invisible for nearly a second
