---
type: note
status: inbox
created: 2026-04-01
---

# Local timezone APOD rollover

Users might find it useful (both in the API and the landing page) to choose to get the new image at midnight in their local timezone, instead of when it actually rolls over in ET.

## The problem

APOD publishes once per day, keyed to Eastern Time. A user in Tokyo (UTC+9) sees the image roll over at 1pm JST -- awkward if they want "a new picture every morning." Conversely, a user in PST sees it change at 9pm, which might actually be fine.

## Possible API surface

A query parameter like `?tz=Asia/Tokyo` or `?tz=UTC%2B9` on any image endpoint. The Worker would compute "today" in the requested timezone instead of ET, and request that date's APOD.

## Key constraint

If a user's local date is ahead of ET (e.g., it's April 2 in Tokyo but still April 1 in ET), the April 2 APOD doesn't exist yet. The Worker would need to fall back to the most recent available date, which is what `findLatestImage` already does via lookback. So this might mostly work out of the box -- the timezone param just changes which date the lookback starts from.

## Landing page

Could detect timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and pass it to the API. Or let users toggle between "NASA time" and "local time" if we want to keep it explicit.

## Phasing

Nice-to-have, not critical. Phase 1 could just handle timezones behind ET (west of Eastern), which is straightforward -- the requested date always exists. Timezones ahead of ET (where the date might not exist yet) can come later if there's demand.

## Related

Ties naturally into TASK-0011 (R2 storage layer for image archiving). If we're storing the last N images anyway, serving a timezone-shifted "yesterday" from the archive is trivial. Any tasks spawned from this note are likely blocked by TASK-0011.

## Open questions

- Caching implications: timezone-varied requests would reduce cache hit rates since each timezone produces a different date key during the rollover window
