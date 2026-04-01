---
type: note
status: inbox
created: 2026-03-31
---

# Add a "Why Is This Needed" Section That Explains the APOD API

Add a section to the landing page that explains what the APOD API is, why it exists, and why a proxy like nasapicture.com is useful.

## What to cover

- **What is APOD?** — NASA publishes a new Astronomy Picture of the Day every day, with a professional explanation written by astronomers. It's been running since 1995.
- **The problem** — NASA's API requires an API key, has rate limits (30 req/hr on DEMO_KEY), sometimes returns videos instead of images, and doesn't offer a single stable URL that always points to "today's image."
- **What this solves** — nasapicture.com gives you a fixed URL that always returns today's image. No API key, no rate limits (edge-cached), no video days (auto-fallback). One URL, drop it in an `<img>` tag.

## Tone & placement

- Keep it concise — a few short paragraphs, not a wall of text. Match the existing voice (clever, minimal, precise).
- Place it between the hero image and the developer-facing route docs, so non-technical visitors get context before the technical details.
- Consider a heading like "Why does this exist?" or "The problem with APOD" — something that invites curiosity.
