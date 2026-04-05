---
type: note
status: inbox
created: 2026-03-30
---

# Add individual metadata routes

Add dedicated routes for individual APOD metadata fields, so consumers can fetch just what they need without parsing JSON from `/info`:

- `/date` — today's APOD date (e.g. `2026-04-05`)
- `/title` — image title
- `/explanation` — description text
- `/copyright` — copyright holder, or `none` if public domain

Returns plain text (`text/plain; charset=utf-8`). Useful for shell scripts, widgets, and other lightweight integrations.

## Implementation details

### Routing

All four routes live in `src/index.ts` alongside the existing route branches. Add a single block after the `/about` handler that matches any of the four paths, calls `fetchApod()` once, then returns the requested field. No `.jpg` aliases needed since these are text endpoints.

```
} else if (["/date", "/title", "/explanation", "/copyright"].includes(pathname)) {
  const apod = await fetchApod(log, apiKey);
  const fieldMap: Record<string, string> = {
    "/date": apod.date,
    "/title": apod.title,
    "/explanation": apod.explanation,
    "/copyright": apod.copyright ?? "none",
  };
  res = new Response(fieldMap[pathname], {
    headers: baseHeaders(origin, { "Content-Type": "text/plain; charset=utf-8" }),
  });
}
```

### Caching

No new cache logic required. These routes call `fetchApod()`, which already caches the NASA API response with the standard 6h primary / 24h stale strategy. The `baseHeaders()` helper sets `Cache-Control: public, max-age=21600` on the response, so Cloudflare's edge and browsers will cache the plain-text responses too.

### Response behavior

- Uses `fetchApod()` (today's date), not `findLatestImage()`, since metadata should reflect whatever today's APOD actually is, even if it's a video.
- `/copyright` returns the literal string `none` when the field is absent (public domain images). An empty 200 response would be ambiguous for shell consumers piping output.
- Error handling falls through to the existing outer `catch` block, which returns JSON error responses with appropriate status codes (429 for rate limits, 502 otherwise).

### Discoverability

After adding the routes:

1. **`/info` endpoint map** — add all four paths to the `endpoints` object so they appear in the JSON response.
2. **`/about` ASCII art** — add the routes to the plain-text route listing.
3. **`baseHeaders` Link header** — optionally add `rel="describedby"` links for `/title` and `/date`, though this is low priority since the Link header is already dense.
4. **404 message** — update the fallback error string to mention the new routes.
5. **Landing page** — if the landing page lists available endpoints, update it there too.

### Testing

Verify manually with `curl`:

```bash
curl -s https://api.nasapicture.com/date
curl -s https://api.nasapicture.com/title
curl -s https://api.nasapicture.com/explanation
curl -s https://api.nasapicture.com/copyright
```

Confirm each returns plain text with correct `Content-Type` and `Cache-Control` headers. Test a video APOD day to verify `/copyright` returns `none` gracefully.
