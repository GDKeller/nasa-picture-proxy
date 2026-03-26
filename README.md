# NASA Picture Proxy

A Cloudflare Worker that proxies [NASA's Astronomy Picture of the Day](https://apod.nasa.gov/apod/astropix.html) behind a fixed URL. An HTTP GET request returns today's image without needing an API key or parsing JSON.

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

Fetch metadata:

```bash
curl https://api.nasapicture.com/info | jq .
```

## Endpoints

| Path | Response |
|------|----------|
| `/` | Today's APOD image (HD, falls back to standard) |
| `/sd` | Standard resolution image |
| `/info` | JSON metadata (title, date, explanation, copyright) |
| `/about` | Plain-text description and route listing |

When the APOD of the day is a video, the proxy walks backwards up to 7 days to find the most recent image.

## How it works

Both the NASA API call and the upstream image fetch are cached at Cloudflare's edge via `cf: { cacheTtl, cacheEverything }`. Caching is purely edge-based; there's no KV, D1, or cron involved.

When the date rolls over, `formatDate(new Date())` produces a new date string, which changes the API request URL and therefore the cache key. The response updates automatically.

## Author

Built by [Grant Keller](https://grantkeller.dev).
