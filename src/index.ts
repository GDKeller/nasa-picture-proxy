/**
 * APOD Proxy — Cloudflare Worker
 *
 * Serves NASA's Astronomy Picture of the Day (science.nasa.gov/apod) from a
 * stable URL. Caches both the APOD record and the image bytes in Cloudflare's
 * edge cache, with no KV, no cron, and no external storage.
 *
 * Routes:
 *   GET /          → today's APOD image (high res, falls back to standard)
 *   GET /sd        → today's APOD image (standard res)
 *   GET /optimized → optimized image (≤1200px, auto WebP/AVIF)
 *   GET /thumb     → tiny thumbnail (32px, blurred WebP)
 *   GET /info      → JSON metadata (includes image dimensions)
 *   GET /about     → plain-text description and attribution
 */

import { z } from "zod";

export interface Env {
  ENVIRONMENT?: string;
}

// NASA's APOD feed. A WordPress REST endpoint on science.nasa.gov, keyed by
// YYMMDD, no API key. See EPIC-0006 for the verified field behavior.
const APOD_BASIC_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const APOD_BASIC_FIELDS = "date,title,media_type,explanation,copyright,hdurl,permalink,basic_html";
const APOD_ASSET_HOST = "https://assets.science.nasa.gov";
const USER_AGENT = "nasa-picture-proxy/1.0 (+https://nasapicture.com)";
const MAX_LOOKBACK_DAYS = 7;
const CACHE_TTL = 21600;      // 6 hours — APOD changes once/day
const STALE_CACHE_TTL = 86400; // 24 hours — fallback when the APOD source is down

// Prefix for every cache key. Bump the version whenever the cached shape or
// the upstream source changes; old keys are never read again and expire on
// their own. The host must be in our zone or caches.default drops the write.
export const CACHE_BASE = "https://api.nasapicture.com/_cache/v2";

// Upstream record, trimmed by `_fields`. Only what the proxy cannot work
// without is required; everything else degrades to empty.
const ApodBasic = z.object({
  date: z.string(),
  title: z.string().trim().min(1),
  media_type: z.enum(["image", "video"]),
  explanation: z.string().nullish(),
  copyright: z.string().nullish(),
  hdurl: z.string().nullish(),
  permalink: z.string().nullish(),
  basic_html: z.string().nullish(),
});

export interface ApodImage {
  sd: string;         // 1280px rendition (dynamicimage path, no params)
  hd: string;         // original bytes (content/dam path)
  hdFallback: string; // hdurl as NASA sent it, in case the original is missing
}

// Normalized, plain-text model. This is what gets cached.
export interface Apod {
  date: string;
  title: string;
  explanation: string;
  copyright: string | null;
  media_type: "image" | "video";
  permalink: string;
  image: ApodImage | null; // null only on video days without a usable poster
  video_url: string | null;
}

export type ImageSource = "image" | "video_thumbnail";

export interface ResolvedApod {
  apod: Apod;
  image: ApodImage;
  source: ImageSource;
}

export interface DevFlags {
  enabled: boolean;
  mode: string | null;
  tools: Set<string>;
}

const inflightApod = new Map<string, Promise<Apod | null>>();

/** Test-only: clear the in-flight promise map between test cases. */
export function __resetInflightApod(): void {
  inflightApod.clear();
}

// ────────────────────────────────────────────────────────────
// Dev flag fixtures — only reachable when env.ENVIRONMENT === "development".
// Registered in REFE-0001. When a new mode is added here, update that table.
// ────────────────────────────────────────────────────────────
const DEV_POSTER_PATH = "science/cds/apod/apod/2026/october/SonifiedEagleNebulaPillars.jpg";

const VIDEO_FIXTURE: Apod = {
  date: "2026-10-18",
  title: "Fixture: Video APOD (dev=video)",
  explanation:
    "Dev fixture used to exercise the video-poster branch locally. " +
    "Shape mirrors a normalized apod-basic video entry. " +
    "See TASK-0019, TASK-0042 and REFE-0001 for context.",
  copyright: null,
  media_type: "video",
  permalink: "https://science.nasa.gov/image-article/apod-2026-october-18-sonified-eagle-nebula-pillars/",
  image: {
    sd: `${APOD_ASSET_HOST}/dynamicimage/assets/${DEV_POSTER_PATH}`,
    hd: `${APOD_ASSET_HOST}/content/dam/${DEV_POSTER_PATH}`,
    hdFallback: `${APOD_ASSET_HOST}/dynamicimage/assets/${DEV_POSTER_PATH}?w=3048&h=1708`,
  },
  video_url: "https://www.youtube.com/embed/DzrCEm1ZBRY",
};

const VIDEO_FIXTURE_NO_POSTER: Apod = {
  ...VIDEO_FIXTURE,
  title: "Fixture: Video APOD no poster (dev=video-no-thumb)",
  image: null,
  video_url: `${APOD_ASSET_HOST}/content/dam/science/cds/apod/apod/2026/october/CRS35-Holland30s1080p.mp4`,
};

export function devApodFixture(mode: string, date: string): Apod | null {
  if (mode === "video") return { ...VIDEO_FIXTURE, date };
  if (mode === "video-no-thumb") return { ...VIDEO_FIXTURE_NO_POSTER, date };
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

// ────────────────────────────────────────────────────────────
// Upstream normalization
// ────────────────────────────────────────────────────────────

// APOD photography lives under one asset tree. Anything else on the host
// (site chrome, the generic news thumbnail, videos) is not an APOD image.
const APOD_ASSET_PATH =
  /^\/(?:dynamicimage\/assets|content\/dam)\/(science\/cds\/apod\/.+\.(?:jpe?g|png|gif|webp))$/i;

/** Asset path under assets.science.nasa.gov, or null when the URL points anywhere else. */
export function apodAssetPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "assets.science.nasa.gov") return null;
  return parsed.pathname.match(APOD_ASSET_PATH)?.[1] ?? null;
}

function apodImage(url: string): ApodImage | null {
  const path = apodAssetPath(url);
  if (!path) return null;
  return {
    sd: `${APOD_ASSET_HOST}/dynamicimage/assets/${path}`,
    hd: `${APOD_ASSET_HOST}/content/dam/${path}`,
    hdFallback: url,
  };
}

// basic_html is the legacy APOD page layout. It is the only place the video
// embed lives, and the only place the real image lives when hdurl is the
// generic placeholder thumbnail (some older entries).
function imageFromHtml(html: string): ApodImage | null {
  for (const m of html.matchAll(/(?:href|src|poster)="([^"]+)"/gi)) {
    const image = apodImage(m[1].replace(/&amp;/gi, "&"));
    if (image) return image;
  }
  return null;
}

function videoUrlFromHtml(html: string): string | null {
  const m = html.match(/<iframe[^>]+src="([^"]+)"/i) ?? html.match(/<source[^>]+src="([^"]+)"/i);
  if (!m) return null;
  const src = m[1].replace(/&amp;/gi, "&");
  return src.startsWith("//") ? `https:${src}` : src;
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>|<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate an apod-basic record and map it to the internal model. Throws on
 * anything that must never be cached or served: schema failures, a record
 * for a different date, or an image day with no APOD image (the 2026-10-20
 * logo outage looked exactly like that).
 */
export function normalizeApod(raw: unknown, date: string): Apod {
  const parsed = ApodBasic.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid record: ${z.prettifyError(parsed.error)}`);
  }
  const rec = parsed.data;
  if (rec.date !== date) {
    throw new Error(`date mismatch: asked ${date}, got ${rec.date}`);
  }

  const html = rec.basic_html ?? "";
  const image = apodImage(rec.hdurl ?? "") ?? imageFromHtml(html);
  if (rec.media_type === "image" && !image) {
    throw new Error(`no APOD image in hdurl (${rec.hdurl}) or basic_html`);
  }

  const copyright = stripHtml(rec.copyright ?? "");
  return {
    date: rec.date,
    title: stripHtml(rec.title),
    explanation: stripHtml(rec.explanation ?? "").replace(/^Explanation:\s*/, ""),
    copyright: copyright || null,
    media_type: rec.media_type,
    permalink: rec.permalink ?? "",
    image,
    video_url: rec.media_type === "video" ? videoUrlFromHtml(html) : null,
  };
}

export function resolveApod(apod: Apod): ResolvedApod | null {
  if (!apod.image) return null;
  return {
    apod,
    image: apod.image,
    source: apod.media_type === "video" ? "video_thumbnail" : "image",
  };
}

// ────────────────────────────────────────────────────────────
// Fetch and cache
// ────────────────────────────────────────────────────────────

function apodCacheUrl(key: string): string {
  return `${CACHE_BASE}/apod/${key}`;
}

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function writeApodCaches(
  cache: Cache, cacheReq: Request, staleReq: Request, apod: Apod,
): Promise<void> {
  const body = JSON.stringify(apod);
  const cacheHeaders = { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` };
  const staleHeaders = { "Content-Type": "application/json", "Cache-Control": `public, max-age=${STALE_CACHE_TTL}` };
  await Promise.all([
    cache.put(cacheReq, new Response(body, { headers: cacheHeaders })),
    cache.put(staleReq, new Response(body, { headers: staleHeaders })),
  ]);
}

/** Cached APOD for a date, or null when NASA has not published it yet. */
async function fetchApod(log: string[], devFlags: DevFlags, date: string): Promise<Apod | null> {
  // Dev fixture short-circuit: only for today's date, bypasses cache entirely
  // so fixture runs never pollute real cached data.
  if (devFlags.enabled && devFlags.mode && date === todayET()) {
    const fixture = devApodFixture(devFlags.mode, date);
    if (fixture) {
      log.push(`  [fetchApod] ${date} → dev fixture (${devFlags.mode})`);
      return fixture;
    }
  }

  const cache = caches.default;
  const cacheReq = new Request(apodCacheUrl(date));
  const staleReq = new Request(apodCacheUrl(`${date}:stale`));

  // nasa-error bypasses the primary cache so every request exercises the
  // stale fallback path rather than hitting warm data.
  const bypassCache = devFlags.enabled && devFlags.mode === "nasa-error";

  if (!bypassCache) {
    const cached = await cache.match(cacheReq);
    if (cached) {
      log.push(`  [fetchApod] ${date} → cache HIT`);
      return cached.json() as Promise<Apod>;
    }
  }

  // Deduplicate concurrent requests for the same date
  const inflight = inflightApod.get(date);
  if (inflight) {
    log.push(`  [fetchApod] ${date} → coalesced with in-flight request`);
    return inflight;
  }

  const promise = fetchApodFromUpstream(log, devFlags, date, cacheReq, staleReq);
  inflightApod.set(date, promise);
  try {
    return await promise;
  } finally {
    inflightApod.delete(date);
  }
}

async function handleUpstreamFailure(
  log: string[], cache: Cache, staleReq: Request, date: string, reason: string,
): Promise<Apod> {
  // Stale cache is the only fallback. The HTML scrape that used to follow it
  // was removed in EPIC-0006: NASA's old APOD site redirects every page to
  // the science.nasa.gov index now.
  const stale = await cache.match(staleReq);
  if (stale) {
    log.push(`  [fetchApod] ${date} → stale cache fallback (${reason})`);
    return stale.json() as Promise<Apod>;
  }

  throw new Error(`APOD source failed: ${reason}`);
}

async function fetchApodFromUpstream(
  log: string[], devFlags: DevFlags, date: string, cacheReq: Request, staleReq: Request,
): Promise<Apod | null> {
  const cache = caches.default;

  if (devFlags.enabled && devFlags.mode === "nasa-error") {
    log.push(`  [fetchApod] ${date} → dev simulated nasa-error (skipping upstream)`);
    return handleUpstreamFailure(log, cache, staleReq, date, "simulated by ?dev=nasa-error");
  }

  // apod-basic keys entries by YYMMDD, like the old apYYMMDD.html pages did.
  const yymmdd = date.slice(2).replaceAll("-", "");
  const res = await fetch(`${APOD_BASIC_URL}/${yymmdd}?_fields=${APOD_BASIC_FIELDS}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  log.push(`  [fetchApod] ${date} → ${res.status}`);

  if (res.status === 404) {
    const body = await res.json().catch(() => null) as { code?: string } | null;
    if (body?.code === "apod_basic_not_found") {
      // Not published yet (NASA posts at 00:05 ET). Not an outage, and
      // nothing to cache: the walkback serves the previous day.
      log.push(`  [fetchApod] ${date} → not published`);
      return null;
    }
    return handleUpstreamFailure(log, cache, staleReq, date, `404 ${JSON.stringify(body)}`);
  }

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    log.push(`  [fetchApod] body=${body}`);
    return handleUpstreamFailure(log, cache, staleReq, date, `status ${res.status}`);
  }

  let apod: Apod;
  try {
    apod = normalizeApod(await res.json(), date);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return handleUpstreamFailure(log, cache, staleReq, date, msg);
  }

  await writeApodCaches(cache, cacheReq, staleReq, apod);
  return apod;
}

async function findLatestResolvable(log: string[], devFlags: DevFlags): Promise<ResolvedApod> {
  let unresolvable = 0;
  let errors = 0;

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    try {
      const apod = await fetchApod(log, devFlags, date);
      const resolved = apod && resolveApod(apod);
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

// Only APOD photography is ever fetched. Everything the proxy serves comes
// through normalizeApod, so this is defense in depth against a bad cache entry.
function validateImageUrl(url: string): void {
  if (!apodAssetPath(url)) {
    throw new Error(`Blocked image fetch: not an APOD asset (${url.slice(0, 80)})`);
  }
}

/**
 * Try each image URL in order and return the first that serves. The HD
 * original is derived from NASA's hdurl, so hdurl itself is the fallback.
 */
// ponytail: a 404 on the original is re-paid on every request before the
// cached fallback hits. Add a short negative cache if that shows up in logs.
async function firstThatServes<T>(
  log: string[], urls: string[], attempt: (url: string) => Promise<T>,
): Promise<T> {
  let lastErr: unknown = new Error("no image candidates");
  for (const url of new Set(urls)) {
    try {
      return await attempt(url);
    } catch (err) {
      lastErr = err;
      log.push(`  [image] ${url.slice(0, 80)}… → ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  throw lastErr;
}

async function fetchImageCached(log: string[], url: string): Promise<Response> {
  validateImageUrl(url);

  const cache = caches.default;
  const cacheReq = new Request(`${CACHE_BASE}/image/${encodeURIComponent(url)}`);
  const staleReq = new Request(`${CACHE_BASE}/image/${encodeURIComponent(url)}:stale`);

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
  const cacheKey = `${CACHE_BASE}/dimensions/${encodeURIComponent(imageUrl)}`;
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
        const { image } = await findLatestResolvable(log, devFlags);
        const candidates = sdPaths.includes(pathname)
          ? [image.sd, image.hdFallback]
          : [image.hd, image.hdFallback];

        const upstream = await firstThatServes(log, candidates, (url) => fetchImageCached(log, url));
        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        res = new Response(upstream.body, {
          headers: baseHeaders(origin, { "Content-Type": contentType }),
        });
      } else if (optimizedPaths.includes(pathname) || thumbPaths.includes(pathname)) {
        const { image } = await findLatestResolvable(log, devFlags);
        const thumb = thumbPaths.includes(pathname);

        const imageOpts: RequestInitCfPropertiesImage = thumb
          ? { fit: "scale-down", width: 32, quality: 30, format: "webp", blur: 5 }
          : { fit: "scale-down", width: 1200, quality: 85 };

        if (!thumb) {
          const accept = request.headers.get("Accept") || "";
          if (/image\/avif/.test(accept)) {
            imageOpts.format = "avif";
          } else if (/image\/webp/.test(accept)) {
            imageOpts.format = "webp";
          }
        }

        const label = thumb ? "thumb" : "optimized";
        const upstream = await firstThatServes(log, [image.hd, image.hdFallback], async (url) => {
          validateImageUrl(url);
          log.push(`  [${label}] ${url.slice(0, 80)}… → cf.image ${JSON.stringify(imageOpts)}`);
          const transformed = await fetch(url, { cf: { image: imageOpts } });
          if (!transformed.ok) {
            throw new Error(`Image transform failed: ${transformed.status}`);
          }
          return transformed;
        });

        const contentType = upstream.headers.get("Content-Type") || (thumb ? "image/webp" : "image/jpeg");

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
          const { apod, source, image } = await findLatestResolvable(log, devFlags);
          const dimensions = await fetchImageDimensions(log, image.hd);

          res = new Response(
            JSON.stringify({
              title: apod.title,
              date: apod.date,
              explanation: apod.explanation,
              media_type: apod.media_type,
              url: apod.media_type === "video" ? apod.video_url : image.sd,
              hdurl: image.hd,
              permalink: apod.permalink,
              copyright: apod.copyright,
              width: dimensions?.width ?? null,
              height: dimensions?.height ?? null,
              image_source: source,
              endpoints,
            }, null, 2),
            { headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          res = new Response(
            JSON.stringify({ error: message, endpoints }, null, 2),
            { status: 502, headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
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
          "  On video days, serves the video's poster or the latest image.",
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
          "  APOD:     https://science.nasa.gov/apod/",
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
      res = new Response(
        JSON.stringify({ error: message }),
        { status: 502, headers: baseHeaders(origin, { "Content-Type": "application/json" }) },
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
