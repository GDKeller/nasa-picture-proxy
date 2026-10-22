/**
 * APOD Proxy — Cloudflare Worker
 *
 * Serves NASA's Astronomy Picture of the Day from a stable URL.
 * Uses Cloudflare's edge cache for both the API response and the
 * image bytes — no KV, no cron, no external storage.
 *
 * Routes:
 *   GET /          → today's APOD image (high res, falls back to standard)
 *   GET /sd        → today's APOD image (standard res)
 *   GET /optimized → optimized image (≤1200px, auto WebP/AVIF)
 *   GET /thumb     → tiny thumbnail (32px, blurred WebP)
 *   GET /info      → JSON metadata (includes image dimensions)
 *   GET /about     → plain-text description and attribution
 */

export interface Env {
  NASA_API_KEY?: string;
  ENVIRONMENT?: string;
}

const NASA_APOD_URL = "https://api.nasa.gov/planetary/apod";
const MAX_LOOKBACK_DAYS = 7;
const CACHE_TTL = 21600;      // 6 hours — APOD changes once/day
const STALE_CACHE_TTL = 86400; // 24 hours — fallback when NASA API is down/rate-limited

// Hosts allowed for image fetches. NASA hosts the photography itself; YouTube
// and Vimeo host video thumbnails linked from video APOD entries.
const ALLOWED_IMAGE_HOSTS = [
  ".nasa.gov",
  ".ytimg.com",
  ".youtube.com",
  ".vimeocdn.com",
];

export interface ApodResponse {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
  thumbnail_url?: string;
}

export type ImageSource = "image" | "video_thumbnail";

export interface ResolvedApod {
  apod: ApodResponse;
  imageUrl: string;
  imageHdUrl: string;
  source: ImageSource;
}

export interface DevFlags {
  enabled: boolean;
  mode: string | null;
  tools: Set<string>;
}

class NasaApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const inflightApod = new Map<string, Promise<ApodResponse>>();

/** Test-only: clear the in-flight promise map between test cases. */
export function __resetInflightApod(): void {
  inflightApod.clear();
}

// ────────────────────────────────────────────────────────────
// Dev flag fixtures — only reachable when env.ENVIRONMENT === "development".
// Registered in REFE-0001. When a new mode is added here, update that table.
// ────────────────────────────────────────────────────────────
const VIDEO_FIXTURE_BASE: Omit<ApodResponse, "thumbnail_url"> = {
  date: "2026-04-08",
  title: "Fixture: Video APOD (dev=video)",
  explanation:
    "Dev fixture used to exercise the video-thumbnail branch locally. " +
    "Shape mirrors NASA's API response for video media_type entries. " +
    "See TASK-0019 and REFE-0001 for context.",
  url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  media_type: "video",
};

const VIDEO_FIXTURE_WITH_THUMB: ApodResponse = {
  ...VIDEO_FIXTURE_BASE,
  thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
};

const VIDEO_FIXTURE_NO_THUMB: ApodResponse = {
  ...VIDEO_FIXTURE_BASE,
  title: "Fixture: Video APOD no thumbnail (dev=video-no-thumb)",
};

export function devApodFixture(mode: string, date: string): ApodResponse | null {
  if (mode === "video") return { ...VIDEO_FIXTURE_WITH_THUMB, date };
  if (mode === "video-no-thumb") return { ...VIDEO_FIXTURE_NO_THUMB, date };
  return null;
}

export function parseDevFlags(url: URL, env: Env): DevFlags {
  const enabled = env.ENVIRONMENT === "development";
  if (!enabled) {
    return { enabled: false, mode: null, tools: new Set() };
  }
  const rawMode = url.searchParams.get("dev");
  const mode = rawMode && rawMode !== "off" && rawMode !== "" ? rawMode : null;
  const toolsCsv = url.searchParams.get("tools");
  const tools = new Set(
    toolsCsv
      ? toolsCsv.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  );
  return { enabled, mode, tools };
}

export function resolveApod(apod: ApodResponse): ResolvedApod | null {
  if (apod.media_type === "image") {
    return {
      apod,
      imageUrl: apod.url,
      imageHdUrl: apod.hdurl || apod.url,
      source: "image",
    };
  }
  if (apod.media_type === "video" && apod.thumbnail_url) {
    return {
      apod,
      imageUrl: apod.thumbnail_url,
      imageHdUrl: apod.thumbnail_url,
      source: "video_thumbnail",
    };
  }
  return null;
}

function apodCacheUrl(key: string): string {
  return `https://api.nasapicture.com/_cache/apod/${key}`;
}

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function writeApodCaches(
  cache: Cache, cacheReq: Request, staleReq: Request, apod: ApodResponse,
): Promise<void> {
  const body = JSON.stringify(apod);
  const cacheHeaders = { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` };
  const staleHeaders = { "Content-Type": "application/json", "Cache-Control": `public, max-age=${STALE_CACHE_TTL}` };
  await Promise.all([
    cache.put(cacheReq, new Response(body, { headers: cacheHeaders })),
    cache.put(staleReq, new Response(body, { headers: staleHeaders })),
  ]);
}

async function fetchApod(
  log: string[], devFlags: DevFlags, apiKey: string, date?: string,
): Promise<ApodResponse> {
  const resolvedDate = date ?? todayET();
  const cacheKey = resolvedDate;

  // Dev fixture short-circuit: only for today's date, bypasses cache entirely
  // so fixture runs never pollute real cached data.
  if (devFlags.enabled && devFlags.mode && resolvedDate === todayET()) {
    const fixture = devApodFixture(devFlags.mode, resolvedDate);
    if (fixture) {
      log.push(`  [fetchApod] ${cacheKey} → dev fixture (${devFlags.mode})`);
      return fixture;
    }
  }

  const cache = caches.default;
  const cacheReq = new Request(apodCacheUrl(cacheKey));
  const staleReq = new Request(apodCacheUrl(`${cacheKey}:stale`));

  // nasa-error bypasses the primary cache so every request exercises the
  // stale fallback path rather than hitting warm data.
  const bypassCache = devFlags.enabled && devFlags.mode === "nasa-error";

  if (!bypassCache) {
    const cached = await cache.match(cacheReq);
    if (cached) {
      log.push(`  [fetchApod] ${cacheKey} → cache HIT`);
      return cached.json() as Promise<ApodResponse>;
    }
  }

  // Deduplicate concurrent requests for the same date
  const inflight = inflightApod.get(cacheKey);
  if (inflight) {
    log.push(`  [fetchApod] ${cacheKey} → coalesced with in-flight request`);
    return inflight;
  }

  const promise = fetchApodFromNasa(log, devFlags, apiKey, resolvedDate, cacheKey, cacheReq, staleReq);
  inflightApod.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightApod.delete(cacheKey);
  }
}

async function handleUpstreamFailure(
  log: string[],
  cache: Cache,
  staleReq: Request,
  cacheKey: string,
  upstreamStatus: number,
): Promise<ApodResponse> {
  // Stale cache is the only fallback. The HTML scrape that used to follow it
  // was removed in EPIC-0006: NASA's old APOD site redirects every page to
  // the science.nasa.gov index now.
  const stale = await cache.match(staleReq);
  if (stale) {
    log.push(`  [fetchApod] ${cacheKey} → stale cache fallback`);
    return stale.json() as Promise<ApodResponse>;
  }

  throw new NasaApiError(
    upstreamStatus,
    upstreamStatus === 429
      ? "NASA API rate limit exceeded — try again later"
      : `NASA API returned ${upstreamStatus}`,
  );
}

async function fetchApodFromNasa(
  log: string[], devFlags: DevFlags, apiKey: string, resolvedDate: string, cacheKey: string,
  cacheReq: Request, staleReq: Request,
): Promise<ApodResponse> {
  const cache = caches.default;

  if (devFlags.enabled && devFlags.mode === "nasa-error") {
    log.push(`  [fetchApod] ${cacheKey} → dev simulated nasa-error (skipping upstream)`);
    return handleUpstreamFailure(log, cache, staleReq, cacheKey, 500);
  }

  const url = `${NASA_APOD_URL}?api_key=${apiKey}&date=${resolvedDate}`;
  const res = await fetch(url);

  const cfCache = res.headers.get("cf-cache-status") ?? "none";
  log.push(`  [fetchApod] ${cacheKey} → ${res.status} (cf-cache: ${cfCache})`);

  if (!res.ok) {
    const body = await res.text();
    log.push(`  [fetchApod] body=${body}`);
    return handleUpstreamFailure(log, cache, staleReq, cacheKey, res.status);
  }

  const apod = await res.json() as ApodResponse;
  await writeApodCaches(cache, cacheReq, staleReq, apod);
  return apod;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function findLatestResolvable(
  log: string[], devFlags: DevFlags, apiKey: string,
): Promise<ResolvedApod> {
  let unresolvable = 0;
  let errors = 0;

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    try {
      const apod = await fetchApod(log, devFlags, apiKey, date);
      const resolved = resolveApod(apod);
      if (resolved) {
        if (i > 0 || resolved.source !== "image") {
          log.push(`  [findLatest] ${date} → ${resolved.source} (lookback=${i})`);
        }
        return resolved;
      }
      unresolvable++;
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : "unknown";
      log.push(`  [findLatest] ${date} → error, skipping (${msg})`);
    }
  }

  throw new Error(
    `No image found in last ${MAX_LOOKBACK_DAYS + 1} days (${unresolvable} unresolvable, ${errors} errors)`,
  );
}

function validateImageUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`Blocked image fetch: non-HTTPS scheme (${parsed.protocol})`);
  }
  if (!ALLOWED_IMAGE_HOSTS.some((suffix) => parsed.hostname.endsWith(suffix))) {
    throw new Error(`Blocked image fetch: unexpected host (${parsed.hostname})`);
  }
}

async function fetchImageCached(log: string[], url: string): Promise<Response> {
  validateImageUrl(url);

  const cache = caches.default;
  const cacheReq = new Request(`https://api.nasapicture.com/_cache/image/${encodeURIComponent(url)}`);
  const staleReq = new Request(`https://api.nasapicture.com/_cache/image/${encodeURIComponent(url)}:stale`);

  const cached = await cache.match(cacheReq);
  if (cached) {
    log.push(`  [fetchImage] ${url.slice(0, 80)}… → cache HIT`);
    return cached;
  }

  const res = await fetch(url);

  log.push(`  [fetchImage] ${url.slice(0, 80)}… → ${res.status}`);

  if (!res.ok) {
    // Try stale cache before giving up
    const stale = await cache.match(staleReq);
    if (stale) {
      log.push(`  [fetchImage] ${url.slice(0, 80)}… → stale cache fallback`);
      return stale;
    }
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("Content-Type") || "image/jpeg";
  const contentLength = res.headers.get("Content-Length");
  const cacheHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
  };
  if (contentLength) cacheHeaders["Content-Length"] = contentLength;

  const staleCacheHeaders = { ...cacheHeaders, "Cache-Control": `public, max-age=${STALE_CACHE_TTL}` };

  const arrayBuffer = await res.arrayBuffer();
  await Promise.all([
    cache.put(cacheReq, new Response(arrayBuffer, { headers: cacheHeaders })),
    cache.put(staleReq, new Response(arrayBuffer, { headers: staleCacheHeaders })),
  ]);
  return new Response(arrayBuffer, { headers: cacheHeaders });
}

interface ImageDimensions {
  width: number;
  height: number;
}

async function fetchImageDimensions(log: string[], imageUrl: string): Promise<ImageDimensions | null> {
  validateImageUrl(imageUrl);

  const cache = caches.default;
  const cacheKey = `https://api.nasapicture.com/_cache/dimensions/${encodeURIComponent(imageUrl)}`;
  const cacheReq = new Request(cacheKey);
  const staleReq = new Request(`${cacheKey}:stale`);

  const cached = await cache.match(cacheReq);
  if (cached) {
    log.push(`  [dimensions] ${imageUrl.slice(0, 80)}… → cache HIT`);
    return cached.json() as Promise<ImageDimensions>;
  }

  try {
    const res = await fetch(imageUrl, {
      cf: { image: { format: "json" } },
    });

    if (!res.ok) {
      const stale = await cache.match(staleReq);
      if (stale) {
        log.push(`  [dimensions] ${imageUrl.slice(0, 80)}… → stale cache fallback`);
        return stale.json() as Promise<ImageDimensions>;
      }
      log.push(`  [dimensions] ${imageUrl.slice(0, 80)}… → ${res.status} (failed)`);
      return null;
    }

    const info = await res.json() as { original: { width: number; height: number } };
    const dimensions: ImageDimensions = {
      width: info.original.width,
      height: info.original.height,
    };

    log.push(`  [dimensions] ${imageUrl.slice(0, 80)}… → ${dimensions.width}×${dimensions.height}`);

    const body = JSON.stringify(dimensions);
    await Promise.all([
      cache.put(cacheReq, new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` },
      })),
      cache.put(staleReq, new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${STALE_CACHE_TTL}` },
      })),
    ]);
    return dimensions;
  } catch (err) {
    log.push(`  [dimensions] ${imageUrl.slice(0, 80)}… → error: ${err instanceof Error ? err.message : "unknown"}`);
    const stale = await cache.match(staleReq);
    if (stale) return stale.json() as Promise<ImageDimensions>;
    return null;
  }
}

function baseHeaders(origin: string, headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
    "X-Content-Type-Options": "nosniff",
    "Link": [
      `<${origin}/>; rel="alternate"; type="image/*"; title="HD image"`,
      `<${origin}/sd>; rel="alternate"; type="image/*"; title="SD image"`,
      `<${origin}/optimized>; rel="alternate"; type="image/*"; title="Optimized image"`,
      `<${origin}/thumb>; rel="alternate"; type="image/webp"; title="Thumbnail"`,
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
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. This API only supports GET requests." }),
        { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS", "Content-Type": "application/json" } },
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
      const devFlags = parseDevFlags(reqUrl, env);
      if (devFlags.enabled && (devFlags.mode || devFlags.tools.size)) {
        log.push(
          `  [devFlags] mode=${devFlags.mode ?? "-"} tools=${
            devFlags.tools.size ? Array.from(devFlags.tools).join(",") : "-"
          }`,
        );
      }

      const sdPaths = ["/sd", "/image-sd.jpg"];
      const hdPaths = ["/", "/image.jpg"];
      const optimizedPaths = ["/optimized", "/image-optimized.jpg"];
      const thumbPaths = ["/thumb", "/thumb.jpg"];

      if (hdPaths.includes(pathname) || sdPaths.includes(pathname)) {
        const resolved = await findLatestResolvable(log, devFlags, apiKey);
        const imageUrl = sdPaths.includes(pathname)
          ? resolved.imageUrl
          : resolved.imageHdUrl;

        const upstream = await fetchImageCached(log, imageUrl);
        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        res = new Response(upstream.body, {
          headers: baseHeaders(origin, { "Content-Type": contentType }),
        });
      } else if (optimizedPaths.includes(pathname)) {
        const resolved = await findLatestResolvable(log, devFlags, apiKey);
        const imageUrl = resolved.imageHdUrl;
        validateImageUrl(imageUrl);

        const imageOpts: RequestInitCfPropertiesImage = {
          fit: "scale-down",
          width: 1200,
          quality: 85,
        };

        const accept = request.headers.get("Accept") || "";
        if (/image\/avif/.test(accept)) {
          imageOpts.format = "avif";
        } else if (/image\/webp/.test(accept)) {
          imageOpts.format = "webp";
        }

        log.push(`  [optimized] ${imageUrl.slice(0, 80)}… → cf.image ${JSON.stringify(imageOpts)}`);

        const upstream = await fetch(imageUrl, {
          cf: { image: imageOpts },
        });

        if (!upstream.ok) {
          throw new Error(`Image transform failed: ${upstream.status}`);
        }

        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        res = new Response(upstream.body, {
          headers: baseHeaders(origin, { "Content-Type": contentType }),
        });
      } else if (thumbPaths.includes(pathname)) {
        const resolved = await findLatestResolvable(log, devFlags, apiKey);
        const imageUrl = resolved.imageHdUrl;
        validateImageUrl(imageUrl);

        const imageOpts: RequestInitCfPropertiesImage = {
          fit: "scale-down",
          width: 32,
          quality: 30,
          format: "webp",
          blur: 5,
        };

        log.push(`  [thumb] ${imageUrl.slice(0, 80)}… → cf.image ${JSON.stringify(imageOpts)}`);

        const upstream = await fetch(imageUrl, {
          cf: { image: imageOpts },
        });

        if (!upstream.ok) {
          throw new Error(`Thumbnail transform failed: ${upstream.status}`);
        }

        const contentType = upstream.headers.get("Content-Type") || "image/webp";

        res = new Response(upstream.body, {
          headers: baseHeaders(origin, { "Content-Type": contentType }),
        });
      } else if (pathname === "/info") {
        const endpoints = {
          "/": "Today's APOD image (high resolution, falls back to standard)",
          "/image.jpg": "Same as / with file extension (for contexts that need one)",
          "/sd": "Today's APOD image (standard resolution)",
          "/image-sd.jpg": "Same as /sd with file extension",
          "/optimized": "Optimized image (≤1200px, auto WebP/AVIF)",
          "/image-optimized.jpg": "Same as /optimized with file extension",
          "/thumb": "Tiny blurred thumbnail (32px WebP, ~1KB)",
          "/thumb.jpg": "Same as /thumb with file extension",
          "/info": "JSON metadata for today's APOD (includes image dimensions)",
          "/about": "Plain-text description and attribution",
        };

        try {
          const resolved = await findLatestResolvable(log, devFlags, apiKey);
          const { apod, source, imageHdUrl } = resolved;
          const dimensions = await fetchImageDimensions(log, imageHdUrl);

          res = new Response(
            JSON.stringify({
              title: apod.title,
              date: apod.date,
              explanation: apod.explanation,
              media_type: apod.media_type,
              url: apod.url,
              hdurl: apod.hdurl ?? null,
              copyright: apod.copyright ?? null,
              width: dimensions?.width ?? null,
              height: dimensions?.height ?? null,
              image_source: source,
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
          "    /                    HD image (default)",
          "    /image.jpg           HD image (with extension)",
          "    /sd                  Standard resolution",
          "    /image-sd.jpg        Standard resolution (with extension)",
          "    /optimized           Optimized (≤1200px, auto WebP/AVIF)",
          "    /image-optimized.jpg Optimized (with extension)",
          "    /thumb               Tiny blurred thumbnail (32px WebP)",
          "    /thumb.jpg           Thumbnail (with extension)",
          "    /info                JSON metadata (with dimensions)",
          "    /about               This page",
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
          JSON.stringify({ error: "Not found. Routes: /, /sd, /optimized, /thumb, /info, /about" }),
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

    if (request.method === "HEAD") {
      return new Response(null, { status: res.status, headers: res.headers });
    }
    return res;
  },
};
