---
type: task
status: todo
created: 2026-04-08
parent: EPIC-0004
blocked-by: TASK-0018
---

# Serve video APOD thumbnail instead of walking back

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

## Acceptance

- When APOD is a video with a thumbnail, image endpoints serve the thumbnail
- `/info` metadata reflects that the source is a video thumbnail
- When no thumbnail exists, walkback still works as before
