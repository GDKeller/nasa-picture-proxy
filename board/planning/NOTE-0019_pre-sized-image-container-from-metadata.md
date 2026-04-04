---
type: note
status: inbox
created: 2026-04-03
---

# Pre-size image container using metadata

The landing page already fetches `/info` independently of the image (`fetch(\`${API_BASE}/info\`)`). If the metadata includes image dimensions, the container can be set to the correct aspect ratio before the image loads, preventing layout shift and giving a visible frame for the thumbnail placeholder (NOTE-0018).

## Current state

- The `/info` response includes `title`, `date`, `explanation`, `url`, `hdurl`, `copyright` -- **no dimensions**.
- NASA's APOD API does not return image dimensions.
- The hero image uses `max-height: 80vh` with `height: auto`, so the container size is unknown until load.
- Current CLS: the image pops in at `opacity: 1` with no reserved space, but since it fades in (no reflow of surrounding content pushed down) the visual shift is minimal. The real problem is the empty void, not layout shift per se.

## Approach

Add `width` and `height` fields to the `/info` response by measuring the image in the Worker:

1. After fetching the APOD image URL from NASA, make a HEAD request or fetch a small portion to read dimensions
2. Cloudflare Image Transformations can return original dimensions via the `cf-image` response header when processing -- we could extract them from the `/optimized` fetch
3. Cache dimensions alongside the APOD metadata (same 6h/24h two-tier strategy)

The landing page would then:
```js
fetch(`${API_BASE}/info`)
  .then(r => r.json())
  .then(data => {
    if (data.width && data.height) {
      const img = document.getElementById('hero-img');
      img.width = data.width;
      img.height = data.height;
      // Browser reserves correct aspect ratio space via width/height attributes
    }
  });
```

## Open questions

- Is the HEAD request approach reliable for NASA's image CDN, or do we need to fetch actual bytes?
- Does `cf: { image: ... }` expose original dimensions in response headers? If so, we get this for free from the existing `/optimized` path.
- Should we store the aspect ratio (simpler) or full pixel dimensions (more useful)?

## Relationship to NOTE-0018

These two notes complement each other: NOTE-0018 provides the visual placeholder, this note provides the correctly-sized container to put it in. Together they eliminate both the empty void and any layout shift.
