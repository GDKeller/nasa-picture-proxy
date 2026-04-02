---
type: task
status: todo
created: 2026-04-02
parent: NOTE-0015
depends: TASK-0012
---

# Extract Inline Styles to SCSS

Move the inline `<style>` block from `landing/index.html` into SCSS files imported by Vite.

## Scope

- Extract styles from the `<style>` tag into `.scss` files (e.g. `landing/src/styles/main.scss`)
- Organize into partials by section (header, hero, endpoints, footer, focus mode, animations)
- Import the entry SCSS file in the HTML via `<link>` or a JS entry point
- Remove the inline `<style>` block from `index.html`
- No Tailwind, pure SCSS
