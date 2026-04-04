---
type: task
status: done
created: 2026-04-02
parent: NOTE-0015
---

# Add Vite to Landing Page

Set up Vite as the dev server for `landing/`, replacing `npx serve`.

## Scope

- Init `landing/package.json` with Vite as a dev dependency
- Create `landing/vite.config.ts` pointing at `index.html` as the entry
- Install `sass` as a dev dependency (needed for TASK-0013)
- Update root `package.json` dev scripts to use Vite instead of `npx serve`
- Verify HMR works on file changes
