---
type: note
status: processed
created: 2026-04-08
---

# Video APOD Handling: Walkback Bug + Video Frame Extraction

## Context

On 2026-04-08, today's APOD is a video (mp4). The `/info` endpoint correctly returns the video metadata/explanation, but image endpoints (`/`, `/sd`, `/optimized`, `/thumb`) return 500. Yesterday's APOD (2026-04-07) is also returning a 500 from NASA's API.

## Bug: `findLatestImage` Doesn't Survive Upstream Errors

`findLatestImage` (`src/index.ts:123`) walks backwards up to 7 days to find an image APOD. The loop calls `fetchApod` for each date, but if `fetchApod` throws (e.g. NASA returns 500 for a given date), the error propagates immediately and kills the entire walkback. It never tries the next day.

The loop only handles the `media_type === "video"` case (skips and continues). It doesn't handle fetch failures.

**Fix**: Wrap the `fetchApod` call in a try/catch inside the loop. On error, log it and continue to the next day. Only throw after exhausting all lookback days.

## Idea: Video Frame Extraction Instead of Walkback

When the APOD is a video, instead of walking back to find an older image, extract the first frame of the video and serve that as the image. This would keep the content current and match the `/info` metadata.

### Approaches to explore

1. **Cloudflare Stream** - If the video is uploaded/proxied through CF Stream, it can generate thumbnails. But the video lives on NASA's servers, so this may not apply directly.
2. **FFmpeg in a Worker** - Not feasible in the standard Workers runtime (no binary execution).
3. **External thumbnail service** - Use a video thumbnail API to grab the first frame. Adds a dependency.
4. **Client-side extraction** - On the landing page, load the video in a hidden `<video>` element, seek to frame 0, draw to canvas, export as image. Only works for the landing page, not the API image endpoints.
5. **NASA's own video thumbnails** - Some APOD video entries include a `thumbnail_url` field in the API response. Check if this is reliable enough to use as the image source.

### Recommendation

Start with option 5 (check for `thumbnail_url` in the API response). If NASA provides it reliably for video APODs, this is zero-dependency and the simplest path. Fall back to the fixed walkback logic if no thumbnail is available.
