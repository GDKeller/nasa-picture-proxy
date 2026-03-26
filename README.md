# APOD Proxy

A Cloudflare Worker that serves NASA's Astronomy Picture of the Day from a **stable, never-changing URL**.

Use it anywhere you need a fixed image URL that automatically updates daily — CSS backgrounds, digital signage, wallpaper feeds, etc.

## Routes

| Path | Response |
|------|----------|
| `/` | Today's APOD image (standard res) |
| `/hd` | Today's APOD image (high res) |
| `/info` | JSON metadata (title, date, explanation, copyright) |

When the APOD is a video (happens occasionally), the worker walks backwards up to 7 days to find the most recent image.

## How it works

Both the NASA API call and the upstream image fetch use Cloudflare's [edge cache](https://developers.cloudflare.com/workers/runtime-apis/request/#requestinitcfproperties) via `cf: { cacheTtl, cacheEverything }`. First request per edge location per hour is a cache miss; everything after that is served directly from cache. No KV, no cron, no external storage.

When the date rolls over, `formatDate(new Date())` produces a new date string, which changes the API request URL — a new cache key — so the response updates automatically.

## Setup

```bash
npm install
```

### Local development

```bash
npx wrangler dev
# Runs at http://localhost:8787
```

### Deploy

```bash
npx wrangler deploy
```

Your worker will be live at `https://apod-proxy.<your-subdomain>.workers.dev`.

### NASA API key (optional)

Without a key, the worker uses `DEMO_KEY` which is rate-limited to 30 requests/hour. Since the edge cache absorbs nearly all traffic, this is fine for most use cases. For higher limits (1,000 req/hr), get a free key at [api.nasa.gov](https://api.nasa.gov) and set it as a secret:

```bash
npx wrangler secret put NASA_API_KEY
```

### Custom domain (optional)

To serve from your own domain, add a [`routes`](https://developers.cloudflare.com/workers/configuration/routing/routes/) entry to `wrangler.toml`:

```toml
routes = [
  { pattern = "apod.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

## Usage examples

```css
body {
  background-image: url("https://apod-proxy.YOUR_SUBDOMAIN.workers.dev/hd");
  background-size: cover;
}
```

```html
<img
  src="https://apod-proxy.YOUR_SUBDOMAIN.workers.dev/"
  alt="NASA Astronomy Picture of the Day"
/>
```

```bash
curl -s https://apod-proxy.YOUR_SUBDOMAIN.workers.dev/info | jq .
```

## Cost

Free. The Cloudflare Workers free tier includes 100,000 requests/day. The NASA API key is also free.
