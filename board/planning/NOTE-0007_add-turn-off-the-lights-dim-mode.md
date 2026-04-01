---
type: note
status: inbox
created: 2026-03-31
---

# Add a "Turn Off the Lights" Icon for Semi-Isolated Image Viewing

Add a toggle icon that dims everything on the landing page except the APOD hero image. Creates a semi-isolated viewing experience — visitors can focus on the image without navigating away or opening it in a new tab.

## Behavior

- **Toggle on**: All surrounding UI (text, nav, starfield, glows) fades to near-black. The hero image remains at full brightness/opacity. A subtle vignette or dark overlay covers everything else.
- **Toggle off**: Click/tap the icon again, press Escape, or click anywhere outside the image to restore the normal view.
- Transition should be smooth (~300–400ms fade) and respect `prefers-reduced-motion`.

## Icon & placement

- Position the icon near the hero image — top-right corner overlay or just below the image.
- Icon options: a simple lightbulb outline, a circle-half (like a dim switch), or an eye icon. Should be immediately recognizable without a label.
- On hover/focus, show a tooltip: "Focus mode" or "Dim surroundings."

## Implementation notes

- Pure CSS overlay approach preferred (no JS framework needed beyond toggling a class/data attribute).
- The image should stay in place in the DOM — don't reposition or clone it. Just layer a dark overlay behind it with a higher z-index on the image.
- Consider whether the starfield canvas should pause or just be hidden behind the overlay.
