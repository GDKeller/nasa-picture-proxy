---
type: note
status: done
created: 2026-04-01
---

# Fix invalid robots.txt on nasapicture.com

The current `robots.txt` at nasapicture.com contained the full landing page HTML appended after the valid directives. Crawlers would misparse or ignore the rules.

## Cause

The landing site is deployed via Cloudflare Pages (`nasapicture-landing` project). There was no `robots.txt` in `landing/`, so Pages' SPA catch-all served `index.html` for `/robots.txt`. Cloudflare's managed bot protection then prepended its directives to the HTML response — resulting in valid robots rules followed by an entire HTML document.

## Fix

Added `landing/robots.txt` with a simple `Allow: /`. Cloudflare's managed content (AI bot blocks, content signals) prepends cleanly to this instead of to HTML. Will take effect on next Pages deploy.
