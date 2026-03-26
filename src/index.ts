/**
 * APOD Proxy — Cloudflare Worker
 *
 * Serves NASA's Astronomy Picture of the Day from a stable URL.
 * Uses Cloudflare's edge cache for both the API response and the
 * image bytes — no KV, no cron, no external storage.
 *
 * Routes:
 *   GET /     → today's APOD image (standard res)
 *   GET /hd   → today's APOD image (high res)
 *   GET /info → JSON metadata
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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchApod(date: string, apiKey: string): Promise<ApodResponse> {
  const url = `${NASA_APOD_URL}?api_key=${apiKey}&date=${date}`;

  const res = await fetch(url, {
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });

  if (!res.ok) {
    throw new Error(`NASA API ${res.status} for ${date}`);
  }

  return res.json() as Promise<ApodResponse>;
}

async function findLatestImage(apiKey: string): Promise<ApodResponse> {
  const now = new Date();

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);

    try {
      const apod = await fetchApod(formatDate(d), apiKey);
      if (apod.media_type === "image") return apod;
    } catch {
      continue;
    }
  }

  throw new Error("No image APOD found in the last week");
}

async function fetchImageCached(url: string): Promise<Response> {
  const res = await fetch(url, {
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });

  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  return res;
}

function corsHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
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

    const { pathname } = new URL(request.url);

    try {
      const apiKey = env.NASA_API_KEY || "DEMO_KEY";
      const apod = await findLatestImage(apiKey);

      if (pathname === "/" || pathname === "/hd") {
        const imageUrl = pathname === "/hd"
          ? (apod.hdurl || apod.url)
          : apod.url;

        const upstream = await fetchImageCached(imageUrl);
        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        return new Response(upstream.body, {
          headers: corsHeaders({ "Content-Type": contentType }),
        });
      }

      if (pathname === "/info") {
        return new Response(
          JSON.stringify({
            title: apod.title,
            date: apod.date,
            explanation: apod.explanation,
            url: apod.url,
            hdurl: apod.hdurl ?? null,
            copyright: apod.copyright ?? null,
          }, null, 2),
          { headers: corsHeaders({ "Content-Type": "application/json" }) },
        );
      }

      return new Response(
        JSON.stringify({ error: "Not found. Routes: /, /hd, /info" }),
        { status: 404, headers: corsHeaders({ "Content-Type": "application/json" }) },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 502, headers: corsHeaders({ "Content-Type": "application/json" }) },
      );
    }
  },
};
