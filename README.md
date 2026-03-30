# NASA Picture Proxy

A Cloudflare Worker that proxies [NASA's Astronomy Picture of the Day (APOD)](https://apod.nasa.gov/apod/astropix.html) behind a fixed URL. An HTTP GET request returns today's image without needing an API key or parsing JSON.

[nasapicture.com](https://nasapicture.com) · [GitHub](https://github.com/GDKeller/nasa-picture-proxy)

![Today's APOD](https://api.nasapicture.com/image.jpg)

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

Returns data from the APOD API:
- Direct URLs of APOD images
- Date
- Image title
- Image explanation
- Copyright info

> [!TIP]
> For those without the tech savvy to understand (i.e. remember) "api", all routes are also accessible at `get.nasapicture.com`

## Endpoints

| Path | Response |
|------|----------|
| `/` | Today's APOD image (HD, falls back to standard) |
| `/image.jpg` | Same as `/` with file extension |
| `/sd` | Standard resolution image |
| `/image-sd.jpg` | Same as `/sd` with file extension |
| `/info` | JSON metadata (title, date, explanation, copyright) |
| `/about` | Plain-text description and route listing |

When the APOD of the day is a video, the proxy walks backwards up to 7 days to find the most recent image.

## How it works

Both the NASA API call and the upstream image fetch are cached at Cloudflare's edge via `cf: { cacheTtl, cacheEverything }`. Caching is purely edge-based; there's no KV, D1, or cron involved.

When the date rolls over, `formatDate(new Date())` produces a new date string, which changes the API request URL and therefore the cache key. The response updates automatically.

## Author

Built by [Grant Keller](https://grantkeller.dev).
