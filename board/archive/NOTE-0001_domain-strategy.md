---
type: note
status: inbox
created: 2026-03-25
---

# Domain strategy for nasapicture.com

nasapicture.com is available. Planned structure:

- `nasapicture.com` → static splash/landing page (Cloudflare Pages)
- `api.nasapicture.com` → the Worker (developer-facing)
- `get.nasapicture.com` → same Worker (human-friendly alias for sharing)

Both subdomains point to the same Worker via CNAME. Landing page is a separate Cloudflare Pages project that embeds the image via `<img src="https://api.nasapicture.com">`.

`get.` subdomain exists so non-technical people can intuitively understand the URL.

Temp testing domain before purchase: nasapic.grantkeller.dev
