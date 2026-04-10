---
type: task
status: todo
priority: 1
created: 2026-04-08
updated: 2026-04-09
parent: EPIC-0004
---

# Serve video APOD thumbnail instead of walking back

**Priority 1** — today's-image reliability. Video APOD days have repeatedly forced the service to show stale (days-old) content; this fix keeps the image current.

> TASK-0018 (walkback error handling) is already done (shipped in commit `997371e`), so this task is no longer blocked.

## Problem

When today's APOD is a video, the service walks back up to 7 days to find an image. This means the image endpoints can show content that's days old and doesn't match the `/info` metadata.

## Approach

NASA's APOD API sometimes includes a `thumbnail_url` field for video entries. If present, serve that as the image instead of walking back.

1. Add `thumbnail_url?: string` to the `ApodResponse` type
2. In `findLatestImage` (or a new function), check today's APOD first: if `media_type === "video"` and `thumbnail_url` exists, return that entry with the thumbnail URL mapped to the `url`/`hdurl` fields
3. If no thumbnail is available, fall back to the existing walkback logic
4. Update `/info` to indicate when the image is a video thumbnail (e.g. `"source": "video_thumbnail"`)

## Open questions

- How reliably does NASA populate `thumbnail_url`? Need to check a few video APOD dates via the API.
- Should the landing page show the video itself (embedded player) when the APOD is a video, with the thumbnail as a fallback for image-only endpoints?

## Local testing

Follow the project dev flag convention in **REFE-0001** (`?dev=<mode>`, localhost/dev-env gated). We already have one real video sample: NASA's 2026-04-08 APOD was a video (see NOTE-0026 in archive). Grab that API response and hard-code it so the video branch can be exercised on demand.

1. **Capture the sample response.** `curl "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=2026-04-08"` and save the JSON (media_type, url, thumbnail_url, title, explanation, date). Store it as a constant in `src/index.ts` or a sibling fixture file.
2. **Add `?dev=video` mode.** When `devFlags.mode === "video"`, `fetchApod` returns the hard-coded fixture instead of hitting NASA. This exercises the "`media_type === "video"` + `thumbnail_url` present" branch.
3. **Exercise it:**
   - `curl "http://localhost:8787/?dev=video"` → image endpoint returns the video's thumbnail bytes
   - `curl "http://localhost:8787/info?dev=video"` → metadata reflects `"source": "video_thumbnail"`
   - `curl "http://localhost:8787/"` (no dev param) → today's normal path is unchanged
4. **Test the no-thumbnail fallback.** Add a second fixture (or a second mode value like `?dev=video-no-thumb`) with `thumbnail_url` omitted. Verify walkback still kicks in and serves an earlier-day image.
5. **Tail logs** with `npm run log:api` to confirm the video branch logs clearly when it fires.
6. **Register the mode** in REFE-0001 "Current modes" table as part of this task.

## Acceptance

- When APOD is a video with a thumbnail, image endpoints serve the thumbnail
- `/info` metadata reflects that the source is a video thumbnail
- When no thumbnail exists, walkback still works as before
- `?dev=video` fixture-based test path is gated per REFE-0001 and cannot fire in production
- REFE-0001 "Current modes" table is updated
