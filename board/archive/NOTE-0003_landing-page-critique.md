---
type: note
status: inbox
created: 2026-03-26
---

# Landing page design critique (gallery revision)

## AI Slop Verdict: Pass

The gallery concept is a specific point of view, not a template. Restraint is genuine.

## What's Working

1. **Image presentation** — no frame, just shadow. Works with any APOD. Caption reads like a gallery placard.
2. **Usage row** — prose flowing into mono URLs feels natural. Copy buttons at 50% opacity are correctly subordinate.
3. **Endpoint list** — route/description/content-type is clean. Content-type column is a genuinely useful detail.

## Priority Issues

### 1. Info section has no visual boundary
Gallery hero ends at usage row, then "Endpoints" floats in the same void. The `.divider` element exists in CSS but was removed from HTML. Add it back, or give `.info` a subtle background (`--void-up`) to create a distinct zone.

### 2. Caption width is unconstrained
Caption stretches full-width but image sizes to content. On wide viewports with tall/narrow APODs, the caption will be wider than the image, breaking the placard illusion. Wrap img + caption in a container with `display: inline-flex; flex-direction: column` so caption matches image width.

### 3. H1 in header disappears on mobile
The three-column header flex squeezes the h1 on narrow viewports. No mobile-specific rule exists. Either hide it with sr-only on mobile or let the header wrap. Test at 375px.

### 4. Endpoint rows lack touch padding
`padding: 0.75rem 0` is too tight for mobile tap targets (need 44px). Add horizontal padding and increase vertical on mobile.

## Minor Issues

- No favicon
- Reduced-motion selector references `.usage` but class is now `.usage-row`
- Second copy button `data-copy` uses HTML entities — clipboard will copy literal `&lt;` not `<`
- `NASApicture` capitalization doesn't match `<title>` and OG tags
- Portrait-orientation APODs will leave large empty space on sides (acceptable for gallery metaphor?)
