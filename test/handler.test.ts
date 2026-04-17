import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker, {
  __resetInflightApod,
  type ApodResponse,
} from "../src/index";

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

interface FetchCall {
  url: string;
  method: string;
}

type RouteHandler = (req: Request) => Response | Promise<Response>;

function createFetchMock() {
  const routes: Array<{ match: (url: string) => boolean; handler: RouteHandler }> = [];
  const calls: FetchCall[] = [];

  const fn: typeof fetch = async (input, init) => {
    const req =
      input instanceof Request
        ? new Request(input, init)
        : new Request(typeof input === "string" ? input : String(input), init);
    calls.push({ url: req.url, method: req.method });
    for (const route of routes) {
      if (route.match(req.url)) return route.handler(req);
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

  __resetInflightApod();
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

function nasaImage(date: string, title = `Image for ${date}`): ApodResponse {
  return {
    date,
    title,
    explanation: `Explanation for ${date}.`,
    url: `https://apod.nasa.gov/apod/image/2604/${date}_sd.jpg`,
    hdurl: `https://apod.nasa.gov/apod/image/2604/${date}_hd.jpg`,
    media_type: "image",
  };
}

function nasaVideoNoThumb(date: string): ApodResponse {
  return {
    date,
    title: `Real video ${date}`,
    explanation: `Video for ${date}.`,
    url: `https://www.youtube.com/embed/real-${date}`,
    media_type: "video",
  };
}

// Encode an HTML string as UTF-16 LE with a BOM, matching the weird encoding
// NASA silently serves for at least one APOD page (ap260408.html — "Earthset").
// The `Content-Type` header still claims charset=UTF-8, so the scraper cannot
// trust it and has to sniff the BOM. This helper lets us reproduce that exact
// quirk in a test.
function utf16leBomResponse(html: string, status = 200): Response {
  const bytes = new Uint8Array(2 + html.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < html.length; i++) {
    const code = html.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return new Response(bytes, {
    status,
    // Mimic NASA: wrong charset header on purpose.
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}

// Minimal APOD page HTML — exercises the same code path parseApodHtml uses
// in production, but is small enough to embed.
function apodPageHtml(date: string, title: string): string {
  const [y, m, d] = date.split("-");
  const monthName = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][Number(m) - 1];
  return `<!doctype html>
<html><head><title> APOD: ${y} ${monthName} ${Number(d)} – ${title}
</title></head>
<body>
<a href="image/2604/scraped_original.jpg">
<IMG SRC="image/2604/scraped_700.jpg">
</a>
<b>Explanation:</b> Scraped page for ${date}.
<p>
</body></html>`;
}

function invoke(path: string, env: Record<string, string> = DEV_ENV): Promise<Response> {
  const req = new Request(`http://localhost:8787${path}`);
  // Silence the handler's per-request console noise during tests.
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  return Promise.resolve(worker.fetch(req, env)).finally(() => logSpy.mockRestore());
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("?dev=video — video APOD with thumbnail", () => {
  it("/info reports media_type=video and image_source=video_thumbnail", async () => {
    fetchMock.when("img.youtube.com", () => imageResponse("video-thumbnail"));

    const res = await invoke("/info?dev=video");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.media_type).toBe("video");
    expect(body.image_source).toBe("video_thumbnail");
    expect(body.title).toMatch(/video/i);
    // Fixture pinned to today
    expect(body.date).toBe(TODAY);
  });

  it("/ serves the thumbnail image bytes", async () => {
    fetchMock.when("img.youtube.com", () => imageResponse("video-thumbnail"));

    const res = await invoke("/?dev=video");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/image\//);
    const body = await res.text();
    expect(body).toBe("IMAGE:video-thumbnail");
  });

  it("never calls the NASA JSON API (fixture short-circuits upstream)", async () => {
    fetchMock.when("img.youtube.com", () => imageResponse("video-thumbnail"));

    await invoke("/?dev=video");
    expect(fetchMock.urlsMatching("api.nasa.gov/planetary/apod")).toEqual([]);
  });

  it("does not pollute the primary cache (fixture writes skipped)", async () => {
    fetchMock.when("img.youtube.com", () => imageResponse("video-thumbnail"));

    await invoke("/info?dev=video");

    const apodCacheKeys = cache._keys().filter((k) => k.includes("/_cache/apod/"));
    expect(apodCacheKeys).toEqual([]);
  });
});

describe("?dev=video-no-thumb — walkback to earlier day", () => {
  it("falls back to the next day's real APOD when today's fixture has no thumbnail", async () => {
    // Today's fixture is unresolvable. Walkback asks NASA for yesterday.
    fetchMock.when(`date=${YESTERDAY}`, () => jsonResponse(nasaImage(YESTERDAY, "Yesterday Image")));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("yesterday-hd"));

    const res = await invoke("/info?dev=video-no-thumb");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.image_source).toBe("image");
    expect(body.date).toBe(YESTERDAY);
    expect(body.title).toBe("Yesterday Image");
  });

  it("/ serves the walked-back image's bytes", async () => {
    fetchMock.when(`date=${YESTERDAY}`, () => jsonResponse(nasaImage(YESTERDAY)));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("yesterday-hd"));

    const res = await invoke("/?dev=video-no-thumb");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("IMAGE:yesterday-hd");
  });

  it("skips further walkback when the next day is also unresolvable (video-no-thumb) and tries the day after", async () => {
    // Yesterday is ALSO a video with no thumbnail → walkback continues.
    fetchMock.when(`date=${YESTERDAY}`, () => jsonResponse(nasaVideoNoThumb(YESTERDAY)));
    fetchMock.when("date=2026-04-08", () => jsonResponse(nasaImage("2026-04-08", "Two days ago")));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("two-days-ago"));

    const res = await invoke("/info?dev=video-no-thumb");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.date).toBe("2026-04-08");
    expect(body.title).toBe("Two days ago");
  });
});

describe("?dev=nasa-error — scrape fallback", () => {
  it("scrape fires when primary + stale cache are both empty", async () => {
    // Return a valid HTML page from the scrape endpoint.
    fetchMock.when(`ap260410.html`, () =>
      new Response(apodPageHtml(TODAY, "Scraped Today"), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      }),
    );

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.title).toBe("Scraped Today");
    expect(body.date).toBe(TODAY);
    expect(body.image_source).toBe("image");
    // NASA JSON API must NOT have been hit (dev=nasa-error skips upstream)
    expect(fetchMock.urlsMatching("api.nasa.gov/planetary/apod")).toEqual([]);
    // Scrape page MUST have been hit
    expect(fetchMock.urlsMatching("ap260410.html").length).toBe(1);
  });

  it("populates both primary and stale caches after a successful scrape", async () => {
    fetchMock.when(`ap260410.html`, () =>
      new Response(apodPageHtml(TODAY, "Scraped Today"), { status: 200 }),
    );

    await invoke("/info?dev=nasa-error");

    const apodKeys = cache._keys().filter((k) => k.includes(`/_cache/apod/${TODAY}`));
    // Primary + stale suffix
    expect(apodKeys.some((k) => k.endsWith(TODAY))).toBe(true);
    expect(apodKeys.some((k) => k.endsWith(`${TODAY}:stale`))).toBe(true);
  });

  it("stale cache wins over scrape when stale is present", async () => {
    // Pre-populate stale cache with a known value.
    const staleUrl = `https://api.nasapicture.com/_cache/apod/${TODAY}:stale`;
    const staleBody: ApodResponse = nasaImage(TODAY, "From Stale Cache");
    await cache.put(
      new Request(staleUrl),
      new Response(JSON.stringify(staleBody), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    // The scrape route would return a DIFFERENT title — if the test fails
    // and scrape runs, the response would contain "Scraped Today" instead.
    fetchMock.when(`ap260410.html`, () =>
      new Response(apodPageHtml(TODAY, "Scraped Today"), { status: 200 }),
    );

    const res = await invoke("/info?dev=nasa-error");
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.title).toBe("From Stale Cache");
    // Scrape endpoint MUST NOT have been called.
    expect(fetchMock.urlsMatching("ap260410.html")).toEqual([]);
  });

  it("decodes UTF-16 LE pages with BOM even when Content-Type lies about UTF-8", async () => {
    // Real-world quirk: NASA served ap260408.html as UTF-16 LE with BOM while
    // the Content-Type header still claimed charset=UTF-8. If the scraper
    // trusts the header and uses res.text(), every char comes out interleaved
    // with NULs and all regexes fail to match. Reproducing here.
    fetchMock.when("ap260410.html", () =>
      utf16leBomResponse(apodPageHtml(TODAY, "Earthset")),
    );

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.title).toBe("Earthset");
    expect(body.date).toBe(TODAY);
    expect(body.image_source).toBe("image");
    // The extracted image URL must be a real absolute HTTPS URL — if decoding
    // failed the regex wouldn't have matched and url would be empty, which
    // would later throw "Invalid URL string" from validateImageUrl.
    expect(body.url).toMatch(/^https:\/\/apod\.nasa\.gov\/apod\/image\//);
  });

  it("decodes UTF-16 BE pages with BOM", async () => {
    // Defensive: BE BOM detection is symmetric with LE. Covers the other branch.
    const html = apodPageHtml(TODAY, "BigEndian");
    const bytes = new Uint8Array(2 + html.length * 2);
    bytes[0] = 0xfe;
    bytes[1] = 0xff;
    for (let i = 0; i < html.length; i++) {
      const code = html.charCodeAt(i);
      bytes[2 + i * 2] = (code >> 8) & 0xff;
      bytes[2 + i * 2 + 1] = code & 0xff;
    }
    fetchMock.when("ap260410.html", () =>
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      }),
    );

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("BigEndian");
  });

  it("returns 502 when scrape also fails and nothing else is cached", async () => {
    // Every day in the walkback will 404 the scrape. /info uses
    // findLatestResolvable which walks back MAX_LOOKBACK_DAYS+1 days,
    // so the final error comes from the walkback loop, not the inner
    // NasaApiError from a single date.
    fetchMock.when(/ap\d{6}\.html$/, () => new Response("not found", { status: 404 }));

    const res = await invoke("/info?dev=nasa-error");
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toMatch(/No image found/);
    // Scrape was attempted for today's date at minimum
    expect(fetchMock.urlsMatching("ap260410.html").length).toBeGreaterThan(0);
  });
});

describe("ENVIRONMENT gating", () => {
  it("silently ignores ?dev=video in production and hits the real API", async () => {
    fetchMock.when(`date=${TODAY}`, () => jsonResponse(nasaImage(TODAY, "Real Image Today")));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("real-today"));

    const res = await invoke("/info?dev=video", PROD_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // Response is the real API result, not the fixture
    expect(body.title).toBe("Real Image Today");
    expect(body.image_source).toBe("image");
    expect(body.media_type).toBe("image");
    // Real NASA API must have been called
    expect(fetchMock.urlsMatching("api.nasa.gov/planetary/apod").length).toBeGreaterThan(0);
  });

  it("silently ignores ?dev=nasa-error in production (normal API path runs)", async () => {
    fetchMock.when(`date=${TODAY}`, () => jsonResponse(nasaImage(TODAY)));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("real"));

    const res = await invoke("/info?dev=nasa-error", PROD_ENV);
    expect(res.status).toBe(200);
    // Scrape must NOT have run — it's only reachable via the upstream-failure path.
    expect(fetchMock.urlsMatching("ap260410.html")).toEqual([]);
  });
});

describe("unknown dev modes", () => {
  it("falls through to the normal API path when the mode is not a recognized fixture", async () => {
    fetchMock.when(`date=${TODAY}`, () => jsonResponse(nasaImage(TODAY, "Normal")));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("normal"));

    const res = await invoke("/info?dev=palette");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Normal");
    expect(body.image_source).toBe("image");
  });
});

describe("normal (no dev flag) path is unchanged", () => {
  it("/info hits the real NASA API in dev env when no dev flag is set", async () => {
    fetchMock.when(`date=${TODAY}`, () => jsonResponse(nasaImage(TODAY, "Plain")));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("plain"));

    const res = await invoke("/info");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Plain");
    expect(body.image_source).toBe("image");
  });

  it("caches the API response so the next request is a cache hit", async () => {
    fetchMock.when(`date=${TODAY}`, () => jsonResponse(nasaImage(TODAY)));
    fetchMock.when("apod.nasa.gov/apod/image/", () => imageResponse("plain"));

    await invoke("/info");
    const callsAfterFirst = fetchMock.urlsMatching("api.nasa.gov/planetary/apod").length;

    await invoke("/info");
    const callsAfterSecond = fetchMock.urlsMatching("api.nasa.gov/planetary/apod").length;

    expect(callsAfterSecond).toBe(callsAfterFirst); // no additional upstream calls
  });
});
