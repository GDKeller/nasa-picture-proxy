/**
 * APOD Proxy — Cloudflare Worker
 *
 * Serves NASA's Astronomy Picture of the Day from a stable URL.
 * Uses Cloudflare's edge cache for both the API response and the
 * image bytes — no KV, no cron, no external storage.
 *
 * Routes:
 *   GET /      → today's APOD image (high res, falls back to standard)
 *   GET /sd    → today's APOD image (standard res)
 *   GET /info  → JSON metadata
 *   GET /about → plain-text description and attribution
 */

export interface Env {
  NASA_API_KEY?: string;
}

const NASA_APOD_URL = "https://api.nasa.gov/planetary/apod";
const MAX_LOOKBACK_DAYS = 7;
const CACHE_TTL = 3600;

interface ApodResponse {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
}

class NasaApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function apodCacheUrl(key: string): string {
  return `http://apod-cache/${key}`;
}

async function fetchApod(log: string[], apiKey: string, date?: string): Promise<ApodResponse> {
  const cacheKey = date ?? "today";

  const cache = caches.default;
  const cacheReq = new Request(apodCacheUrl(cacheKey));
  const cached = await cache.match(cacheReq);
  if (cached) {
    log.push(`  [fetchApod] ${cacheKey} → cache HIT`);
    return cached.json() as Promise<ApodResponse>;
  }

  const url = date
    ? `${NASA_APOD_URL}?api_key=${apiKey}&date=${date}`
    : `${NASA_APOD_URL}?api_key=${apiKey}`;

  const res = await fetch(url);

  const cfCache = res.headers.get("cf-cache-status") ?? "none";
  log.push(`  [fetchApod] ${cacheKey} → ${res.status} (cf-cache: ${cfCache})`);

  if (!res.ok) {
    const body = await res.text();
    log.push(`  [fetchApod] body=${body}`);
    throw new NasaApiError(res.status,
      res.status === 429
        ? "NASA API rate limit exceeded — try again later"
        : `NASA API returned ${res.status}`
    );
  }

  const apod = await res.json() as ApodResponse;
  await cache.put(cacheReq, new Response(JSON.stringify(apod), {
    headers: { "Cache-Control": `public, max-age=${CACHE_TTL}` },
  }));
  return apod;
}

async function findLatestImage(log: string[], apiKey: string): Promise<ApodResponse> {
  let videoStreak = 0;

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const date = i === 0
      ? undefined
      : (() => { const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); })();

    const apod = await fetchApod(log, apiKey, date);
    if (apod.media_type === "image") return apod;
    videoStreak++;
  }

  throw new Error(
    `Today's APOD is a video, and the last ${videoStreak} days have been too — no image available`
  );
}

function validateImageUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`Blocked image fetch: non-HTTPS scheme (${parsed.protocol})`);
  }
  if (!parsed.hostname.endsWith(".nasa.gov")) {
    throw new Error(`Blocked image fetch: unexpected host (${parsed.hostname})`);
  }
}

async function fetchImageCached(log: string[], url: string): Promise<Response> {
  validateImageUrl(url);

  const cache = caches.default;
  const cacheReq = new Request(url);
  const cached = await cache.match(cacheReq);
  if (cached) {
    log.push(`  [fetchImage] ${url.slice(0, 80)}… → cache HIT`);
    return cached;
  }

  const res = await fetch(url);

  log.push(`  [fetchImage] ${url.slice(0, 80)}… → ${res.status}`);

  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("Content-Type") || "image/jpeg";
  const contentLength = res.headers.get("Content-Length");
  const cacheHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
  };
  if (contentLength) cacheHeaders["Content-Length"] = contentLength;

  const cloned = res.clone();
  await cache.put(cacheReq, new Response(cloned.body, { headers: cacheHeaders }));
  return res;
}

function baseHeaders(origin: string, headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
    "Link": [
      `<${origin}/>; rel="alternate"; type="image/*"; title="HD image"`,
      `<${origin}/sd>; rel="alternate"; type="image/*"; title="SD image"`,
      `<${origin}/info>; rel="describedby"`,
      `<${origin}/about>; rel="about"`,
    ].join(", "),
    ...headers,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. This API only supports GET requests." }),
        { status: 405, headers: { "Allow": "GET, OPTIONS", "Content-Type": "application/json" } },
      );
    }

    const reqUrl = new URL(request.url);
    const { pathname } = reqUrl;
    const origin = reqUrl.origin;
    const start = Date.now();

    const log: string[] = [];
    let res: Response;

    try {
      const apiKey = env.NASA_API_KEY || "DEMO_KEY";

      const sdPaths = ["/sd", "/image-sd.jpg"];
      const hdPaths = ["/", "/image.jpg"];

      if (hdPaths.includes(pathname) || sdPaths.includes(pathname)) {
        const apod = await findLatestImage(log, apiKey);
        const imageUrl = sdPaths.includes(pathname)
          ? apod.url
          : (apod.hdurl || apod.url);

        const upstream = await fetchImageCached(log, imageUrl);
        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        res = new Response(upstream.body, {
          headers: baseHeaders(origin, { "Content-Type": contentType }),
        });
      } else if (pathname === "/info") {
        const endpoints = {
          "/": "Today's APOD image (high resolution, falls back to standard)",
          "/image.jpg": "Same as / with file extension (for contexts that need one)",
          "/sd": "Today's APOD image (standard resolution)",
          "/image-sd.jpg": "Same as /sd with file extension",
          "/info": "JSON metadata for today's APOD",
          "/about": "Plain-text description and attribution",
        };

        try {
          const apod = await fetchApod(log, apiKey);

          res = new Response(
            JSON.stringify({
              title: apod.title,
              date: apod.date,
              explanation: apod.explanation,
              media_type: apod.media_type,
              url: apod.url,
              hdurl: apod.hdurl ?? null,
              copyright: apod.copyright ?? null,
              endpoints,
            }, null, 2),
            { headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = err instanceof NasaApiError && err.statusCode === 429 ? 429 : 502;
          res = new Response(
            JSON.stringify({ error: message, endpoints }, null, 2),
            { status, headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
          );
        }
      } else if (pathname === "/about") {
        const text = [
          "",
          "     .        *          .          *          .        *",
          "   .         *                        .          .",
          "                 _   _    _    ____    _",
          "     *          | \\ | |  / \\  / ___|  / \\         .",
          "        .       |  \\| | / _ \\ \\___ \\ / _ \\",
          "           .    | |\\  |/ ___ \\ ___) / ___ \\   *",
          "     .          |_| \\_/_/   \\_\\____/_/   \\_\\        .",
          "  *                              .                *",
          "        .    *        .    *          .        .",
          "",
          "                   ── APOD Proxy ──",
          "",
          "  Proxy for NASA's Astronomy Picture of the Day.",
          "  Returns today's image at a static URL, no API key required.",
          "  Video days are skipped automatically.",
          "  Useful for wallpapers, <img> sources, and other zero-JS environments.",
          "",
          "  Usage:",
          `    <img src="${origin}/">`,
          "",
          "  Routes:",
          "    /             HD image (default)",
          "    /image.jpg    HD image (with extension)",
          "    /sd           Standard resolution",
          "    /image-sd.jpg Standard resolution (with extension)",
          "    /info         JSON metadata",
          "    /about        This page",
          "",
          "  Homepage: https://nasapicture.com",
          "",
          "  Built by Grant Keller | https://grantkeller.dev",
          "",
        ].join("\n");

        res = new Response(text, {
          headers: baseHeaders(origin, { "Content-Type": "text/plain; charset=utf-8" }),
        });
      } else {
        res = new Response(
          JSON.stringify({ error: "Not found. Routes: /, /sd, /info, /about" }),
          { status: 404, headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = err instanceof NasaApiError && err.statusCode === 429 ? 429 : 502;
      res = new Response(
        JSON.stringify({ error: message }),
        { status, headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
      );
    }

    console.log(`────────────────────────────────────────`);
    console.log(`${request.method} ${pathname} → ${res.status} (${Date.now() - start}ms)`);
    for (const line of log) console.log(line);
    return res;
  },
};
