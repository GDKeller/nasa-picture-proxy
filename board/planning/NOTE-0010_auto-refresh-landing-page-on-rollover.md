---
type: note
status: inbox
created: 2026-03-31
---

# Auto-refresh landing page on APOD rollover

If a user leaves the landing page open, the image and caption should update automatically when NASA publishes the new APOD — no manual reload required.

## Considerations

- NASA publishes around midnight Eastern, but the exact time varies (sometimes delayed)
- Polling `/info` periodically and comparing the date to what's currently displayed is the simplest approach
- A reasonable interval might be every 15–30 minutes — frequent enough to catch the rollover without hammering the API (which is cached on the Worker side anyway)
- When a new date is detected: update the image `src`, caption title, and date, with a fade transition
- Should only poll when the tab is visible (`document.visibilityState`) to avoid wasting requests in background tabs
