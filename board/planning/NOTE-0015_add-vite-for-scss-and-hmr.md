---
type: note
status: inbox
created: 2026-04-01
---

# Add Vite for SCSS and HMR

The landing page (`landing/index.html`) is currently a single HTML file with all styles inlined, served in dev via `npx serve`. This works but has two pain points:

1. **No HMR** — every change requires a manual browser refresh
2. **No SCSS** — styles are plain CSS inlined in a `<style>` tag, making them harder to organize as the page grows

## What this would change

- Add Vite as a dev dependency for the landing page
- Extract inline styles into one or more `.scss` files imported by the HTML
- Replace `npx serve landing` in the `dev` / `dev:landing` scripts with `vite` (dev server with HMR)
- Add a `build` step that outputs a static `dist/` for production deployment
- Vite's built-in PostCSS pipeline can also handle Tailwind if that's added later

## Open questions

- Should Vite live at the project root or in a `landing/` sub-package with its own `vite.config.ts`?
- Does the production landing page stay on Cloudflare Pages, or continue deploying as static files alongside the Worker?
- Worth adding Tailwind at the same time, or keep it pure SCSS for now?
