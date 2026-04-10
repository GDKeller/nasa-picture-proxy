---
type: epic
status: planning
created: 2026-04-09
---

# Social Sharing Previews

Make link previews render correctly on Twitter, Slack, Facebook, Discord, iMessage, and friends. Covers both the HTML surface (so crawlers see OG tags instead of image bytes) and the image asset itself (so the preview is sized and cropped for social platforms).

## Tasks

### TASK-0034: Serve OG HTML to social crawlers

Sniff `User-Agent` on image routes. Return HTML with OG + Twitter-card tags for known crawlers, unchanged image bytes for everyone else. Skips the upstream image fetch entirely on the crawler path.

### TASK-0033: Generate daily OG image via workers-og

Render a 1200x630 branded PNG once per day inside the Worker via Satori. Cached 24h keyed to date, regenerates at rollover. The OG HTML then points `og:image` at `/og` instead of `/sd`.

## Sequence

1. **TASK-0034 first** (OG HTML) — immediately fixes preview rendering even using the raw image URL for `og:image`
2. **TASK-0033 second** (OG image) — upgrades preview quality to a properly sized and branded card

## Related

- NOTE-0020 (OG HTML for crawlers) — spawning note for TASK-0034
- NOTE-0008 (OG image generation) — spawning note for TASK-0033
- TASK-0022 (annotated image endpoint) — shares the rendering pipeline with TASK-0033, candidate for refactor after both land
