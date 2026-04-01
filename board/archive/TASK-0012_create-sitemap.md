---
type: task
status: done
priority: 3
created: 2026-04-01
---

# Create sitemap.xml for nasapicture.com

Add a `sitemap.xml` to the `landing/` directory and reference it from `robots.txt`.

The site is a single-page landing, so the sitemap is simple — just the root URL. Still valuable for SEO signals and search engine discovery.

## Steps

- Add `landing/sitemap.xml` with the root URL (`https://nasapicture.com/`)
- Update `landing/robots.txt` to include `Sitemap: https://nasapicture.com/sitemap.xml`
- Deploy via Cloudflare Pages
