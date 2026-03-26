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

let cachedImage: { date: string; apod: ApodResponse } | null = null;

async function findLatestImage(apiKey: string): Promise<ApodResponse> {
  const today = formatDate(new Date());

  if (cachedImage && cachedImage.date === today) {
    return cachedImage.apod;
  }

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);

    try {
      const apod = await fetchApod(formatDate(d), apiKey);
      if (apod.media_type === "image") {
        cachedImage = { date: today, apod };
        return apod;
      }
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

    const reqUrl = new URL(request.url);
    const { pathname } = reqUrl;
    const origin = reqUrl.origin;

    try {
      const apiKey = env.NASA_API_KEY || "DEMO_KEY";

      if (pathname === "/" || pathname === "/sd") {
        const apod = await findLatestImage(apiKey);
        const imageUrl = pathname === "/sd"
          ? apod.url
          : (apod.hdurl || apod.url);

        const upstream = await fetchImageCached(imageUrl);
        const contentType = upstream.headers.get("Content-Type") || "image/jpeg";

        const altRoute = pathname === "/sd" ? "/" : "/sd";
        const altLabel = pathname === "/sd" ? "High resolution" : "Standard resolution";

        return new Response(upstream.body, {
          headers: corsHeaders({
            "Content-Type": contentType,
            "Link": [
              `<${origin}${altRoute}>; rel="alternate"; title="${altLabel}"`,
              `<${origin}/info>; rel="describedby"`,
            ].join(", "),
          }),
        });
      }

      if (pathname === "/info") {
        const apod = await fetchApod(formatDate(new Date()), apiKey);

        return new Response(
          JSON.stringify({
            title: apod.title,
            date: apod.date,
            explanation: apod.explanation,
            media_type: apod.media_type,
            url: apod.url,
            hdurl: apod.hdurl ?? null,
            copyright: apod.copyright ?? null,
            endpoints: {
              "/": "Today's APOD image (high resolution, falls back to standard)",
              "/sd": "Today's APOD image (standard resolution)",
              "/info": "JSON metadata for today's APOD",
              "/about": "Plain-text description and attribution",
            },
          }, null, 2),
          {
            headers: corsHeaders({
              "Content-Type": "application/json",
              "Link": [
                `<${origin}/>; rel="alternate"; type="image/*"; title="HD image"`,
                `<${origin}/sd>; rel="alternate"; type="image/*"; title="SD image"`,
              ].join(", "),
            }),
          },
        );
      }

      if (pathname === "/about") {
        const text = [
          "Proxy for NASA's Astronomy Picture of the Day.",
          "Returns today's image at a static URL, no API key required.",
          "Video days are skipped automatically.",
          "Useful for wallpapers, <img> sources, and other zero-JS environments.",
          "",
          "Built by Grant Keller — https://grantkeller.dev",
        ].join("\n");

        return new Response(text, {
          headers: corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
        });
      }

      return new Response(
        JSON.stringify({ error: "Not found. Routes: /, /sd, /info, /about" }),
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
