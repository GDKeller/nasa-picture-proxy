---
type: note
status: inbox
created: 2026-03-26
---

# Landing page for nasapicture.com

Static landing page hosted on Cloudflare Pages, living in `landing/` subdirectory of this repo.

## Plan
- Single `index.html` in `landing/`
- APOD image as hero via `<img src="https://api.nasapicture.com/">`
- Brief explanation of what the proxy is
- Endpoint listing
- Credit/link to Grant Keller
- Dark theme (space photos)
- Engineering-forward tone with personality (similar to /about endpoint)

## Deploy
- Connect repo to Cloudflare Pages
- Set build output directory to `landing/`
- Assign `nasapicture.com` as custom domain
