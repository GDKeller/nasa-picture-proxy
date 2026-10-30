---
type: task
status: done
created: 2026-04-06
parent: EPIC-0002
---

# Add static favicon bundle and OG image

Replace the single SVG favicon with a full favicon bundle for cross-browser/device support, and add a static OG image for consistent social sharing previews.

- Favicon bundle: `.ico`, `.svg`, `96x96.png`, `apple-touch-icon.png`, web app manifest icons
- Web app manifest with correct site name and dark theme colors
- Static `og-image.jpg` for OG/Twitter cards (replaces dynamic APOD URL that got stale in crawler caches)
- Added `og:site_name`, `og:locale` meta tags
- Removed unnecessary `offers` from JSON-LD schema
- Corrected `theme-color` to match actual void background (`#05070c`)
