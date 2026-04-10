---
type: task
status: backlog
priority: 2
created: 2026-04-09
parent: EPIC-0002
---

# Add a "Why is this needed" section to the landing page

Add a short content block between the hero image and the endpoint docs that explains what APOD is and what nasapicture.com solves. Spawned from NOTE-0006.

## What to cover

- **What is APOD?** NASA has published a new Astronomy Picture of the Day every day since 1995, each with a professional explanation from astronomers.
- **The problem.** NASA's API requires a key, rate-limits (30 req/hr on DEMO_KEY), sometimes returns videos instead of images, and doesn't offer a single stable URL that always points to "today's image."
- **What this solves.** A fixed URL that always returns today's image, no API key, no rate limits (edge-cached), no video days (auto-fallback). Drop it in an `<img>` tag.

## Tone and placement

- Concise, a few short paragraphs. Match the existing voice: clever, minimal, precise.
- Place between the hero image and the developer route docs so non-technical visitors get context before the technical details.
- Heading like "Why does this exist?" or "The problem with APOD."

## Acceptance

- New section renders cleanly on desktop and mobile
- Reads naturally to a non-technical visitor
- Does not compete with the hero image for attention
