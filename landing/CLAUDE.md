# CLAUDE.md (landing page)

Loads when working under `landing/`. Brand voice and visual design for the landing page and any user-facing copy, including the Worker's `/about` text.

## Design Context

### Users
Everyone — developers integrating the API into dashboards and side projects, tinkerers building for fun, and general visitors who stumble on the domain out of curiosity about space. The landing page should be immediately understandable to non-technical visitors while giving developers everything they need.

### Brand Personality
**Clever, minimal, precise.** The voice is confident and concise — says a lot with few words. Engineering craft without jargon. Personality comes through in small details (the /about ASCII art, "That's it. That's the whole integration."), never through excess.

### Emotional Goals
**Awe + simplicity.** Visitors should feel wonder at the cosmos (the APOD image does the heavy lifting) and relief at how easy the tool is. The design should get out of the way of the content while still feeling crafted.

### Aesthetic Direction
- **Theme**: Dark space — deep void (#05070c) with atmospheric depth, not flat black
- **Accent**: Warm amber/gold (#e8a838) — planned but not yet implemented; current palette is monochrome silver with NASA blue
- **Typography**: Source Serif 4 Display (headings), Source Sans 3 (body), Source Code Pro (code) — Adobe Typekit, no generic fonts
- **Layout**: Generous whitespace, content-forward, max-width constrained (~5xl)
- **Motion**: Subtle and purposeful — twinkling stars, staggered fade-ins, gentle hover lifts. Always respect `prefers-reduced-motion`
- **Anti-references**: No AI slop aesthetics, no purple gradients on white, no cookie-cutter SaaS layouts

### Design Principles
1. **The image is the hero** — everything else supports it. Never compete with the APOD for attention.
2. **Earn trust through restraint** — fewer elements, better. If it doesn't serve the visitor, remove it.
3. **Craft in the details** — personality lives in small moments (ASCII art, code comments, hover states), not in loud design choices.
4. **Accessible by default** — WCAG AA contrast, semantic HTML, reduced-motion alternatives. Accessibility is not optional.
5. **Zero friction** — the landing page mirrors the API philosophy: simple to deploy, simple to understand.
