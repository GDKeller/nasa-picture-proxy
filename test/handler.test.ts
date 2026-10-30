import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker, { apodCacheUrl, normalizeApod } from "../src/index";

// ────────────────────────────────────────────────────────────
// In-memory stand-ins for globals the Worker reaches for. Node gives us
// Request/Response/fetch/URL natively; we only need to fake `caches.default`
// and route outbound `fetch` calls. The tests call the default export's
// fetch handler directly — no wrangler, no miniflare, no real network.
// ────────────────────────────────────────────────────────────

interface CacheEntry {
  body: ArrayBuffer;
  headers: [string, string][];
}

function createCache() {
  const store = new Map<string, CacheEntry>();
  const cache = {
    async match(req: Request | string): Promise<Response | undefined> {
      const url = typeof req === "string" ? req : req.url;
      const entry = store.get(url);
      if (!entry) return undefined;
      return new Response(entry.body.slice(0), { headers: entry.headers });
    },
    async put(req: Request | string, res: Response): Promise<void> {
      const url = typeof req === "string" ? req : req.url;
      const body = await res.arrayBuffer();
      const headers: [string, string][] = [];
      res.headers.forEach((value, key) => headers.push([key, value]));
      store.set(url, { body, headers });
    },
    async delete(req: Request | string): Promise<boolean> {
      const url = typeof req === "string" ? req : req.url;
      return store.delete(url);
    },
    // helpers for assertions
    _keys: () => Array.from(store.keys()),
    _size: () => store.size,
  };
  return cache;
}

type CacheMock = ReturnType<typeof createCache>;

// Node's Request drops Cloudflare's `cf` init, so it is recorded separately.
type CfInit = { image?: Record<string, unknown> } | undefined;

interface FetchCall {
  url: string;
  method: string;
  userAgent: string | null;
  cf: CfInit;
}

type RouteHandler = (req: Request, cf: CfInit) => Response | Promise<Response>;

function createFetchMock() {
  const routes: Array<{ match: (url: string) => boolean; handler: RouteHandler }> = [];
  const calls: FetchCall[] = [];

  const fn: typeof fetch = async (input, init) => {
    const req =
      input instanceof Request
        ? new Request(input, init)
        : new Request(typeof input === "string" ? input : String(input), init);
    const cf = (init as { cf?: CfInit } | undefined)?.cf;
    calls.push({ url: req.url, method: req.method, userAgent: req.headers.get("User-Agent"), cf });
    for (const route of routes) {
      if (route.match(req.url)) return route.handler(req, cf);
    }
    throw new Error(`fetch mock: no route for ${req.url}`);
  };

  return Object.assign(fn, {
    calls,
    when(matcher: string | RegExp, handler: RouteHandler) {
      const match =
        typeof matcher === "string"
          ? (url: string) => url.includes(matcher)
          : (url: string) => matcher.test(url);
      routes.push({ match, handler });
    },
    urlsMatching(pattern: string | RegExp): string[] {
      return calls
        .map((c) => c.url)
        .filter((u) => (typeof pattern === "string" ? u.includes(pattern) : pattern.test(u)));
    },
  });
}

type FetchMock = ReturnType<typeof createFetchMock>;

// ────────────────────────────────────────────────────────────
// Test harness state
// ────────────────────────────────────────────────────────────

let cache: CacheMock;
let fetchMock: FetchMock;
let originalFetch: typeof fetch | undefined;
let originalCaches: typeof caches | undefined;

const DEV_ENV = { ENVIRONMENT: "development" };
const PROD_ENV = {};

// Pin "now" to a deterministic instant so todayET() always returns 2026-04-10.
// 16:00 UTC on 2026-04-10 is 12:00 ET — safely inside the same ET day.
const PINNED_NOW = new Date("2026-04-10T16:00:00Z");
const TODAY = "2026-04-10";
const YESTERDAY = "2026-04-09";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);

  cache = createCache();
  fetchMock = createFetchMock();

  originalFetch = globalThis.fetch;
  originalCaches = (globalThis as unknown as { caches?: typeof caches }).caches;

  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  (globalThis as unknown as { caches: { default: CacheMock } }).caches = {
    default: cache,
  };

});

afterEach(() => {
  vi.useRealTimers();
  if (originalFetch) {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  }
  if (originalCaches) {
    (globalThis as unknown as { caches: typeof caches }).caches = originalCaches;
  } else {
    delete (globalThis as unknown as { caches?: unknown }).caches;
  }
});

// ────────────────────────────────────────────────────────────
// Canned responses
// ────────────────────────────────────────────────────────────

const ASSETS = "https://assets.science.nasa.gov";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function imageResponse(label: string, contentType = "image/jpeg"): Response {
  // Label the body so we can assert which mocked image was served.
  const bytes = new TextEncoder().encode(`IMAGE:${label}`);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
    },
  });
}

/** apod-basic keys entries by YYMMDD. */
function yymmdd(date: string): string {
  return date.slice(2).replaceAll("-", "");
}

/** A raw apod-basic record the way science.nasa.gov sends it. */
function apodBasic(date: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    title: `Image for ${date}`,
    media_type: "image",
    explanation: `<strong>Explanation: </strong>Explanation for ${date}.`,
    copyright: `<a href="mailto:x">Photographer</a>`,
    hdurl: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/april/${date}.jpg?w=4000&h=3000`,
    permalink: `https://science.nasa.gov/image-article/apod-${date}/`,
    basic_html: "",
    ...overrides,
  };
}

function notFound(): Response {
  return jsonResponse({ code: "apod_basic_not_found", message: "APOD not found.", data: { status: 404 } }, 404);
}

/** Route the apod-basic request for one date. */
function upstream(date: string, handler: RouteHandler): void {
  fetchMock.when(`/apod-basic/${yymmdd(date)}?`, handler);
}

function invoke(
  path: string, env: Record<string, string> = DEV_ENV, headers: Record<string, string> = {},
): Promise<Response> {
  const req = new Request(`http://localhost:8787${path}`, { headers });
  // Silence the handler's per-request console noise during tests.
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  return Promise.resolve(worker.fetch(req, env)).finally(() => logSpy.mockRestore());
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("?dev=video — video APOD with poster", () => {
  it("/info reports media_type=video and image_source=video_thumbnail", async () => {
    fetchMock.when(ASSETS, () => imageResponse("video-poster"));

    const res = await invoke("/info?dev=video");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.media_type).toBe("video");
    expect(body.image_source).toBe("video_thumbnail");
    expect(body.title).toMatch(/video/i);
    // Fixture pinned to today
    expect(body.date).toBe(TODAY);
    // url is the video, hdurl is the poster we serve at /
    expect(body.url).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
    expect(body.hdurl).toMatch(/^https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/cds\/apod\//);
  });

  it("/ serves the poster image bytes", async () => {
    fetchMock.when(ASSETS, () => imageResponse("video-poster"));

    const res = await invoke("/?dev=video");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/image\//);
    const body = await res.text();
    expect(body).toBe("IMAGE:video-poster");
  });

  it("never calls the APOD API (fixture short-circuits upstream)", async () => {
    fetchMock.when(ASSETS, () => imageResponse("video-poster"));

    await invoke("/?dev=video");
    expect(fetchMock.urlsMatching("apod-basic")).toEqual([]);
  });

  it("does not pollute the primary cache (fixture writes skipped)", async () => {
    fetchMock.when(ASSETS, () => imageResponse("video-poster"));

    await invoke("/info?dev=video");

    const apodCacheKeys = cache._keys().filter((k) => k.startsWith(apodCacheUrl("")));
    expect(apodCacheKeys).toEqual([]);
  });
});

describe("?dev=video-no-thumb — walkback to earlier day", () => {
  it("falls back to the next day's real APOD when today's fixture has no poster", async () => {
    // Today's fixture is unresolvable. Walkback asks NASA for yesterday.
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Yesterday Image" })));
    fetchMock.when(ASSETS, () => imageResponse("yesterday-hd"));

    const res = await invoke("/info?dev=video-no-thumb");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.image_source).toBe("image");
    expect(body.date).toBe(YESTERDAY);
    expect(body.title).toBe("Yesterday Image");
  });

  it("/ serves the walked-back image's bytes", async () => {
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY)));
    fetchMock.when(ASSETS, () => imageResponse("yesterday-hd"));

    const res = await invoke("/?dev=video-no-thumb");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("IMAGE:yesterday-hd");
  });

  it("keeps walking back when the next day is a video without a poster", async () => {
    // Yesterday is ALSO a video with no poster → walkback continues.
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { media_type: "video", hdurl: "" })));
    upstream("2026-04-08", () => jsonResponse(apodBasic("2026-04-08", { title: "Two days ago" })));
    fetchMock.when(ASSETS, () => imageResponse("two-days-ago"));

    const res = await invoke("/info?dev=video-no-thumb");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.date).toBe("2026-04-08");
    expect(body.title).toBe("Two days ago");
  });
});

describe("?dev=nasa-error — upstream failure", () => {
  it("serves the stale cache entry when one is present", async () => {
    // Pre-populate stale cache with a known value.
    const staleUrl = apodCacheUrl(`${TODAY}:stale`);
    const staleBody = normalizeApod(apodBasic(TODAY, { title: "From Stale Cache" }), TODAY);
    await cache.put(
      new Request(staleUrl),
      new Response(JSON.stringify(staleBody), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.title).toBe("From Stale Cache");
    expect(body.date).toBe(TODAY);
    // nasa-error skips the API, and there is no other data source to fall
    // through to. (The dimensions probe still fetches the image URL.)
    expect(fetchMock.urlsMatching("apod-basic")).toEqual([]);
  });

  it("returns 502 when nothing is cached", async () => {
    // /info uses findLatestResolvable, which walks back MAX_LOOKBACK_DAYS+1
    // days. Every day fails the same way, so the final error comes from the
    // walkback loop, not the inner error from a single date.
    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toMatch(/No image found/);
    expect(fetchMock.calls).toEqual([]);
  });
});

describe("upstream validation", () => {
  it("treats 404 apod_basic_not_found as unpublished and walks back, caching nothing for that day", async () => {
    // A stale entry for today must not be served: unpublished is not an
    // outage. (An outage would serve this entry instead of walking back.)
    await cache.put(new Request(apodCacheUrl(`${TODAY}:stale`)),
      jsonResponse(normalizeApod(apodBasic(TODAY, { title: "From Stale Cache" }), TODAY)));
    upstream(TODAY, notFound);
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Yesterday" })));
    fetchMock.when(ASSETS, () => imageResponse("yesterday"));

    const res = await invoke("/info");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.date).toBe(YESTERDAY);
    expect(body.title).toBe("Yesterday");
    expect(cache._keys()).not.toContain(apodCacheUrl(TODAY));
  });

  it("treats any other 404 as an upstream failure and serves the stale entry", async () => {
    const staleUrl = apodCacheUrl(`${TODAY}:stale`);
    const staleBody = normalizeApod(apodBasic(TODAY, { title: "From Stale Cache" }), TODAY);
    await cache.put(new Request(staleUrl), jsonResponse(staleBody));
    upstream(TODAY, () => jsonResponse({ code: "rest_no_route" }, 404));
    fetchMock.when(ASSETS, () => imageResponse("stale"));

    const res = await invoke("/info");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("From Stale Cache");
  });

  it("rejects a logo-shaped record (image day, no APOD image) and never caches it", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, {
      title: "NASA Science",
      hdurl: "https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
    })));
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Real Image" })));
    fetchMock.when(ASSETS, () => imageResponse("real"));

    const res = await invoke("/info");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Real Image");
    expect(body.date).toBe(YESTERDAY);
    expect(cache._keys().filter((k) => k.includes(TODAY))).toEqual([]);
  });

  it("rejects a record for a different date and never caches it", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(YESTERDAY)));
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Yesterday" })));
    fetchMock.when(ASSETS, () => imageResponse("yesterday"));

    const res = await invoke("/info");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Yesterday");
    expect(cache._keys().filter((k) => k.includes(TODAY))).toEqual([]);
  });

  it("rejects a record that fails the schema (empty title) and never caches it", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, { title: "  " })));
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Yesterday" })));
    fetchMock.when(ASSETS, () => imageResponse("yesterday"));

    const res = await invoke("/info");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Yesterday");
    expect(cache._keys().filter((k) => k.includes(TODAY))).toEqual([]);
  });

  it("returns 502 on a 5xx when nothing is cached", async () => {
    fetchMock.when("/apod-basic/", () => new Response("<html>Bad Gateway</html>", { status: 502 }));

    const res = await invoke("/info");
    expect(res.status).toBe(502);
    expect(cache._keys().filter((k) => k.startsWith(apodCacheUrl("")))).toEqual([]);
  });
});

describe("ENVIRONMENT gating", () => {
  it("silently ignores ?dev=video in production and hits the real API", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, { title: "Real Image Today" })));
    fetchMock.when(ASSETS, () => imageResponse("real-today"));

    const res = await invoke("/info?dev=video", PROD_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // Response is the real API result, not the fixture
    expect(body.title).toBe("Real Image Today");
    expect(body.image_source).toBe("image");
    expect(body.media_type).toBe("image");
    // Real APOD API must have been called
    expect(fetchMock.urlsMatching("apod-basic").length).toBeGreaterThan(0);
  });

  it("silently ignores ?dev=nasa-error in production (normal API path runs)", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, () => imageResponse("real"));

    const res = await invoke("/info?dev=nasa-error", PROD_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.image_source).toBe("image");
  });
});

describe("unknown dev modes", () => {
  it("falls through to the normal API path when the mode is not a recognized fixture", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, { title: "Normal" })));
    fetchMock.when(ASSETS, () => imageResponse("normal"));

    const res = await invoke("/info?dev=palette");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Normal");
    expect(body.image_source).toBe("image");
  });
});

describe("normal (no dev flag) path", () => {
  it("/info fetches apod-basic for today with a descriptive User-Agent and no api.nasa.gov call", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, { title: "Plain" })));
    fetchMock.when(ASSETS, () => imageResponse("plain"));

    const res = await invoke("/info");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Plain");
    expect(body.image_source).toBe("image");
    expect(body.explanation).toBe(`Explanation for ${TODAY}.`);
    expect(body.copyright).toBe("Photographer");
    expect(body.permalink).toBe(`https://science.nasa.gov/image-article/apod-${TODAY}/`);
    expect(body.url).toBe(`${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/april/${TODAY}.jpg`);
    expect(body.hdurl).toBe(`${ASSETS}/content/dam/science/cds/apod/apod/2026/april/${TODAY}.jpg`);

    const apiCalls = fetchMock.calls.filter((c) => c.url.includes("apod-basic"));
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].url).toBe(
      `https://science.nasa.gov/wp-json/wp/v2/apod-basic/${yymmdd(TODAY)}?_fields=date,title,media_type,explanation,copyright,hdurl,permalink,basic_html`,
    );
    expect(apiCalls[0].userAgent).toBe("nasa-picture-proxy/1.0 (+https://nasapicture.com)");
    expect(fetchMock.urlsMatching("api.nasa.gov")).toEqual([]);
  });

  it("caches the API response so the next request is a cache hit", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, () => imageResponse("plain"));

    await invoke("/info");
    const callsAfterFirst = fetchMock.urlsMatching("apod-basic").length;

    await invoke("/info");
    const callsAfterSecond = fetchMock.urlsMatching("apod-basic").length;

    expect(callsAfterSecond).toBe(callsAfterFirst); // no additional upstream calls
  });

  it("/sd serves the dynamicimage rendition and / serves the content/dam original", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when("/content/dam/", () => imageResponse("original"));
    fetchMock.when("/dynamicimage/", () => imageResponse("rendition"));
    const path = `science/cds/apod/apod/2026/april/${TODAY}.jpg`;

    expect(await (await invoke("/sd")).text()).toBe("IMAGE:rendition");
    expect(await (await invoke("/")).text()).toBe("IMAGE:original");
    // Each route's first choice served: the param-less 1280px rendition for
    // /sd (not NASA's full-size hdurl), the original for /.
    expect(fetchMock.urlsMatching(ASSETS)).toEqual([
      `${ASSETS}/dynamicimage/assets/${path}`,
      `${ASSETS}/content/dam/${path}`,
    ]);
  });
});

describe("image resolution", () => {
  it("/ falls back to NASA's hdurl when the derived original is missing", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when("/content/dam/", () => new Response("nope", { status: 404 }));
    fetchMock.when("/dynamicimage/", () => imageResponse("hdurl-as-given"));

    const res = await invoke("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("IMAGE:hdurl-as-given");
    // The original was tried first, then the fallback.
    expect(fetchMock.urlsMatching("/content/dam/").length).toBeGreaterThan(0);
    expect(fetchMock.urlsMatching("?w=4000")).toHaveLength(1);
  });

  it("/optimized and /thumb transform the original and fall back the same way", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when("/content/dam/", () => new Response("nope", { status: 404 }));
    fetchMock.when("/dynamicimage/", () => imageResponse("transformed", "image/webp"));
    const path = `science/cds/apod/apod/2026/april/${TODAY}.jpg`;
    const tried = [`${ASSETS}/content/dam/${path}`, `${ASSETS}/dynamicimage/assets/${path}?w=4000&h=3000`];
    const transforms = () => fetchMock.calls.filter((c) => c.url.startsWith(ASSETS)).map((c) => [c.url, c.cf]);

    const optimized = await invoke("/optimized");
    expect(optimized.status).toBe(200);
    expect(await optimized.text()).toBe("IMAGE:transformed");
    const optimizedOpts = { image: { fit: "scale-down", width: 1200, quality: 85 } };
    expect(transforms()).toEqual(tried.map((url) => [url, optimizedOpts]));

    fetchMock.calls.length = 0;
    const thumb = await invoke("/thumb");
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get("Content-Type")).toBe("image/webp");
    const thumbOpts = { image: { fit: "scale-down", width: 32, quality: 30, format: "webp", blur: 5 } };
    expect(transforms()).toEqual(tried.map((url) => [url, thumbOpts]));
  });

  it("/optimized picks the format from Accept and varies on it", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, () => imageResponse("avif", "image/avif"));

    const res = await invoke("/optimized", DEV_ENV, { Accept: "image/avif,image/webp,*/*" });
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(fetchMock.calls.find((c) => c.cf)?.cf?.image?.format).toBe("avif");
  });

  it("takes the real image from basic_html when hdurl is the placeholder thumbnail", async () => {
    const real = `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/april/real_${TODAY}.jpg`;
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, {
      hdurl: `${ASSETS}/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png?w=594`,
      basic_html: `<a href="https://science.nasa.gov/apod/archive/">Archive</a>\n<a href="${real}">\n<IMG SRC="${real}" alt="x">\n</a>`,
    })));
    fetchMock.when(ASSETS, () => imageResponse("real"));

    const res = await invoke("/info");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.date).toBe(TODAY);
    expect(body.hdurl).toBe(`${ASSETS}/content/dam/science/cds/apod/apod/2026/april/real_${TODAY}.jpg`);
  });

  it("refuses to fetch a non-APOD image URL even from a cached entry", async () => {
    // Defense in depth: a poisoned cache entry must not turn the Worker into
    // an open proxy.
    const poisoned = normalizeApod(apodBasic(TODAY), TODAY);
    poisoned.image = {
      sd: "https://evil.example/x.jpg",
      hd: "https://evil.example/x.jpg",
      hdFallback: "https://evil.example/x.jpg",
    };
    await cache.put(new Request(apodCacheUrl(TODAY)), jsonResponse(poisoned));

    for (const path of ["/", "/sd", "/optimized", "/thumb", "/info"]) {
      expect((await invoke(path)).status, path).toBe(502);
    }
    expect(fetchMock.urlsMatching("evil.example")).toEqual([]);
  });
});

/** An image or dimensions cache key, built from the same versioned base. */
function cacheKey(kind: "image" | "dimensions", url: string, suffix = ""): string {
  return apodCacheUrl("").replace(/apod\/$/, `${kind}/${encodeURIComponent(url)}${suffix}`);
}

describe("failure handling", () => {
  const path = `science/cds/apod/apod/2026/april/${TODAY}.jpg`;

  it("serves today's stale entry when apod-basic can't be reached", async () => {
    await cache.put(new Request(apodCacheUrl(`${TODAY}:stale`)),
      jsonResponse(normalizeApod(apodBasic(TODAY, { title: "From Stale Cache" }), TODAY)));
    upstream(TODAY, () => { throw new TypeError("fetch failed"); });
    fetchMock.when(ASSETS, () => imageResponse("stale"));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect(body.title).toBe("From Stale Cache");
    expect(body.date).toBe(TODAY);
  });

  it("serves an image's stale copy when the image host can't be reached", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    await cache.put(new Request(cacheKey("image", `${ASSETS}/content/dam/${path}`, ":stale")), imageResponse("stale-original"));
    fetchMock.when("/content/dam/", () => { throw new TypeError("connection reset"); });
    fetchMock.when("/dynamicimage/", () => imageResponse("hdurl-as-given"));

    expect(await (await invoke("/")).text()).toBe("IMAGE:stale-original");
  });

  it("never caches or serves a 200 that isn't an image, and tries the next candidate", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when("/content/dam/", () => new Response("<html>blocked</html>", { headers: { "Content-Type": "text/html" } }));
    fetchMock.when("/dynamicimage/", () => imageResponse("hdurl-as-given"));

    const res = await invoke("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("IMAGE:hdurl-as-given");
    const imageKeys = cache._keys().filter((k) => k.includes("/image/"));
    expect(imageKeys.some((k) => k.includes(encodeURIComponent("/dynamicimage/")))).toBe(true);
    expect(imageKeys.filter((k) => k.includes(encodeURIComponent("/content/dam/")))).toEqual([]);
  });

  it("marks 502s no-store so a brief failure isn't cached downstream", async () => {
    fetchMock.when("/apod-basic/", () => new Response("down", { status: 503 }));

    for (const route of ["/", "/info"]) {
      const res = await invoke(route);
      expect(res.status).toBe(502);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("/info reports the original's width and height", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, (_req, cf) => cf?.image?.format === "json"
      ? jsonResponse({ original: { width: 5120, height: 3840 } })
      : imageResponse("image"));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect([body.width, body.height]).toEqual([5120, 3840]);
    expect(fetchMock.calls.find((c) => c.cf?.image?.format === "json")?.url).toBe(`${ASSETS}/content/dam/${path}`);
  });
});

describe("unusual records", () => {
  it("serves a Webb image hosted outside the APOD asset tree (2026-08-26)", async () => {
    const webb = "science/missions/webb/science/2026/08/STScI-01KX6D0XBHSYP7Q1EM5QTC43RP.png";
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, { hdurl: `${ASSETS}/dynamicimage/assets/${webb}?w=4000&h=4000` })));
    fetchMock.when(ASSETS, () => imageResponse("webb", "image/png"));

    const res = await invoke("/");
    expect(await res.text()).toBe("IMAGE:webb");
    expect(fetchMock.urlsMatching(ASSETS)).toEqual([`${ASSETS}/content/dam/${webb}`]);
  });

  it("caches an iframe day as unresolvable and walks past it without refetching", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY, {
      media_type: "iframe",
      hdurl: `${ASSETS}/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png`,
    })));
    upstream(YESTERDAY, () => jsonResponse(apodBasic(YESTERDAY, { title: "Yesterday" })));
    fetchMock.when(ASSETS, () => imageResponse("yesterday"));

    for (let i = 0; i < 2; i++) {
      const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
      expect(body.date).toBe(YESTERDAY);
    }
    expect(fetchMock.urlsMatching(`/apod-basic/${yymmdd(TODAY)}?`)).toHaveLength(1);
  });
});

describe("cache key versioning", () => {
  it("ignores entries cached under the old unversioned keys", async () => {
    // What production cached on 2026-10-20: the NASA logo, in both tiers.
    const old = normalizeApod(apodBasic(TODAY, { title: "Old Source" }), TODAY);
    await cache.put(new Request(`https://api.nasapicture.com/_cache/apod/${TODAY}`), jsonResponse(old));
    await cache.put(new Request(`https://api.nasapicture.com/_cache/apod/${TODAY}:stale`), jsonResponse(old));
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect(body.title).toBe(`Image for ${TODAY}`);
    expect(fetchMock.urlsMatching("apod-basic").length).toBeGreaterThan(0);

    // The old stale tier is not a fallback either.
    await cache.delete(new Request(apodCacheUrl(TODAY)));
    await cache.delete(new Request(apodCacheUrl(`${TODAY}:stale`)));
    const failed = await invoke("/info?dev=nasa-error");
    expect(failed.status).toBe(502);
  });
});

describe("cache integrity", () => {
  const hd = `${ASSETS}/content/dam/science/cds/apod/apod/2026/april/${TODAY}.jpg`;

  it("serves today even when the cache write fails", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, () => imageResponse("today"));
    vi.spyOn(cache, "put").mockRejectedValue(new Error("put failed"));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect(body.date).toBe(TODAY);
  });

  it("refetches a day whose primary entry doesn't parse", async () => {
    await cache.put(new Request(apodCacheUrl(TODAY)), new Response("{not json"));
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    fetchMock.when(ASSETS, () => imageResponse("today"));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect(body.title).toBe(`Image for ${TODAY}`);
    expect(fetchMock.urlsMatching("apod-basic")).toHaveLength(1);
  });

  it("never serves a wrong-shape stale entry, and deletes it", async () => {
    const staleKey = apodCacheUrl(`${TODAY}:stale`);
    await cache.put(new Request(staleKey), jsonResponse({ title: "Half a record" }));

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(502);
    expect(cache._keys()).not.toContain(staleKey);
  });

  it("re-probes dimensions when the cached entry is invalid", async () => {
    upstream(TODAY, () => jsonResponse(apodBasic(TODAY)));
    await cache.put(new Request(cacheKey("dimensions", hd)), jsonResponse({ width: "wide" }));
    fetchMock.when(ASSETS, (_req, cf) => cf?.image?.format === "json"
      ? jsonResponse({ original: { width: 5120, height: 3840 } })
      : imageResponse("image"));

    const body = (await (await invoke("/info")).json()) as Record<string, unknown>;
    expect([body.width, body.height]).toEqual([5120, 3840]);
  });
});
