---
type: note
status: inbox
created: 2026-04-11
---

# Preserve original APOD filename on download

When a user downloads an image from `api.nasapicture.com` (or `get.`), the browser saves it as `api.nasapicture.jpg`, derived from the hostname because the URL path has no meaningful filename. We should set `Content-Disposition` so downloads use the original NASA asset name (e.g. `NGC1234_hubble1200.jpg`), preserving provenance and making the filename searchable against apod.nasa.gov.

## Problem

All image endpoints currently return only `Content-Type`, so browsers fall back to `<hostname>.<ext>` when the user hits "Save image as...". Every image from the proxy ends up named the same thing, which is unhelpful for anyone collecting wallpapers or citing sources.

## Proposed fix

Add a `Content-Disposition: inline; filename="<original>"` header to image responses. Using `inline` (not `attachment`) keeps the image displayed in-browser when hit directly, and only influences the filename on save.

The original filename is always the last path segment of the NASA URL:

```
https://apod.nasa.gov/apod/image/2604/NGC1234_hubble1200.jpg
                                      └───────── filename ──┘
```

`resolved.imageHdUrl` / `resolved.imageUrl` in `src/index.ts` already hold this URL by the time we build the response, so extraction is a one-liner.

## Affected endpoints

From `src/index.ts:608-685`:

- `/` and `/image.jpg` — serve `imageHdUrl`, extension matches source
- `/sd` and `/image-sd.jpg` — serve `imageUrl` (standard res), extension matches source
- `/optimized` and `/image-optimized.jpg` — **extension needs rewriting**: the response may be WebP/AVIF depending on `Accept`, so we should swap the original extension to match the actual `Content-Type` the transform returned
- `/thumb` and `/thumb.jpg` — same caveat as optimized (always WebP). Lower priority since thumbnails aren't meant for downloading, but consistency is cheap.
- `/info` and `/about` — skip, not image responses

## Implementation sketch

1. Add a helper:
   ```ts
   function filenameFromUrl(url: string, overrideExt?: string): string {
     const pathname = new URL(url).pathname;
     const last = pathname.split("/").pop() || "apod.jpg";
     // Strip anything unsafe for a header value, keep it ASCII.
     const safe = last.replace(/[^A-Za-z0-9._-]/g, "_");
     if (!overrideExt) return safe;
     return safe.replace(/\.[^.]+$/, `.${overrideExt}`);
   }
   ```
2. In each image branch, compute the filename and pass it into `baseHeaders` (or set directly on the response):
   ```ts
   "Content-Disposition": `inline; filename="${filename}"`,
   ```
3. For `/optimized` and `/thumb`, derive `overrideExt` from the actual response `Content-Type` (`image/webp` → `webp`, `image/avif` → `avif`, else `jpg`).

## Safety notes

- NASA image URLs are trusted (validated by `validateImageUrl`), but a filename is still header input. Restrict to `[A-Za-z0-9._-]` so a malformed URL can't inject a CR/LF or a stray `"`.
- Video thumbnails come from YouTube/Vimeo (`maxresdefault.jpg`, etc.) and won't have meaningful names. That's fine — any original filename is better than `api.nasapicture.jpg`.
- `Content-Disposition` with `inline` does NOT force a download; it only affects the suggested filename if the user chooses to save. Existing `<img src>` consumers are unaffected.

## Out of scope

- RFC 5987 `filename*=UTF-8''...` encoding for non-ASCII names. NASA filenames are ASCII in practice; revisit only if that changes.
- Changing the route URLs themselves (e.g. `/image/NGC1234.jpg`). That would affect caching and is a bigger design call.

## Acceptance

- `curl -I https://api.nasapicture.com/ | grep -i content-disposition` returns the original NASA filename.
- Saving the image in a browser uses that filename, not `api.nasapicture.jpg`.
- `/optimized` download filenames carry `.webp` / `.avif` when the response is transformed.
- Existing image consumers (landing page, `<img>` embeds) still work identically.
