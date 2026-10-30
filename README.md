# NASA Picture Proxy

A Cloudflare Worker that proxies [NASA's Astronomy Picture of the Day (APOD)](https://science.nasa.gov/apod/) behind a fixed URL. An HTTP GET request returns today's image without needing an API key or parsing JSON.

[nasapicture.com](https://nasapicture.com) · [GitHub](https://github.com/GDKeller/nasa-picture-proxy)

![Today's APOD](https://api.nasapicture.com/image-sd.jpg)
*This is a static URL, but it'll be a different image when you visit this repo tomorrow.*

During a tinkering session, I wanted to set the background image of my homelab [homepage](https://github.com/gethomepage/homepage) dashboard to the APOD. I didn't want to inject additional JavaScript on the page and couldn't find an existing static URL. So, I built this proxy to share with anyone else who'd like to view the wonders of space easily, anywhere.


## Usage

Embed directly as an image:

```html
<img src="https://api.nasapicture.com/" alt="NASA Astronomy Picture of the Day" />
```

CSS background:

```css
body {
  background-image: url("https://api.nasapicture.com/");
  background-size: cover;
}
```

**Need a file extension?** Some contexts (RSS feeds, Open Graph tags, markdown renderers) require a URL that ends in an image extension. You can add `/image.jpg` or `/image-sd.jpg` as well:  
```
https://api.nasapicture.com/image.jpg
https://api.nasapicture.com/image-sd.jpg
```  

Fetch metadata:

```bash
curl https://api.nasapicture.com/info | jq .
```

Returns the day's APOD record from NASA's science.nasa.gov feed:
- Direct URLs of APOD images (and the video, on video days)
- Date
- Image title
- Image explanation
- Copyright info
- Link to the APOD article on science.nasa.gov

> [!TIP]
> For those without the tech savvy to understand (i.e. remember) "api", all routes are also accessible at `get.nasapicture.com`

## Endpoints

| Path | Response |
|------|----------|
| `/` | Today's APOD image (full resolution) |
| `/image.jpg` | Same as `/` with file extension |
| `/sd` | Standard resolution image |
| `/image-sd.jpg` | Same as `/sd` with file extension |
| `/optimized` | Optimized image (≤1200px, auto WebP/AVIF) |
| `/image-optimized.jpg` | Same as `/optimized` with file extension |
| `/thumb` | Tiny blurred thumbnail (32px WebP, ~1KB) |
| `/thumb.jpg` | Same as `/thumb` with file extension |
| `/info` | JSON metadata (title, date, explanation, copyright, image and article URLs, image dimensions) |
| `/about` | Plain-text description and route listing |

When the APOD of the day is a video, the proxy serves NASA's poster image for it, and `/info` returns the video's URL. If there's nothing to show (a video with no poster, or an image in a format browsers can't display), it walks backwards up to 7 days to find the most recent image.

## How it works

The Worker fetches each day's record from NASA's `apod-basic` feed on science.nasa.gov. "Today" is the date in `America/New_York`, so it rolls over at midnight ET. If NASA hasn't published today's entry yet, the proxy serves yesterday's.

The record and the image bytes are cached with the Workers Cache API (`caches.default`) for 6 hours. A second copy is kept for 24 hours and served if NASA's site is down. Cache keys carry a version, so a change of source or format never serves an entry cached by an older one. There's no KV, D1, or cron involved.

## Dev flags

`npm run dev` starts the Worker on `localhost:8787` and the landing page on `localhost:8788`. Add a `?dev=` query param to force a state that's hard to catch in the wild. Production ignores every flag.

Landing page (works on `localhost` only):

| Flag | Effect |
|------|--------|
| `?dev=fallback` | Shows the "Image not available" state and skips the `/info` and `/thumb` calls |
| `?dev=stale` | Adds the "Showing a recent image" notice to the caption |

Worker (needs `ENVIRONMENT=development` in `.dev.vars`). Flags apply to the image routes and `/info`. The landing page doesn't pass them along, so call the Worker directly, e.g. `localhost:8787/info?dev=video`:

| Flag | Effect |
|------|--------|
| `?dev=video` | Serves a video APOD fixture with a poster image |
| `?dev=video-no-thumb` | Fakes today as a video with no poster, so the proxy walks back to an earlier day |
| `?dev=nasa-error` | Skips NASA's feed and serves the newest stale copy still cached, otherwise a 502 |

The full convention and flag registry live in [REFE-0001](board/reference/REFE-0001_dev-feature-flag-convention.md).

## Author

Built by [Grant Keller](https://grantkeller.dev).
