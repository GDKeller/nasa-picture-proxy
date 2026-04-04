---
type: task
status: done
created: 2026-04-02
parent: NOTE-0015
depends: TASK-0012
---

# Add Landing Page Build and Deploy

Configure Vite production build and update the deploy workflow.

## Scope

- Add `build` script to `landing/package.json` (`vite build`)
- Configure output to `landing/dist/`
- Add `deploy:landing` script to root `package.json` (`wrangler pages deploy landing/dist/ --project-name nasapicture-landing`)
- Add `landing/dist/` to `.gitignore`
- Verify built output matches current dev behavior
