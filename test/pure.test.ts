import { describe, it, expect } from "vitest";
import {
  parseDevFlags,
  resolveApod,
  parseApodHtml,
  devApodFixture,
  type ApodResponse,
} from "../src/index";

// ────────────────────────────────────────────────────────────
// parseDevFlags
// ────────────────────────────────────────────────────────────
describe("parseDevFlags", () => {
  const prod = {}; // ENVIRONMENT unset = production

  it("returns disabled flags in production regardless of query params", () => {
    const url = new URL("https://api.nasapicture.com/info?dev=video&tools=palette,grid");
    const flags = parseDevFlags(url, prod);
    expect(flags.enabled).toBe(false);
    expect(flags.mode).toBeNull();
    expect(flags.tools.size).toBe(0);
  });

  it("honors ?dev=<mode> when ENVIRONMENT=development", () => {
    const url = new URL("https://api.nasapicture.com/?dev=video");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.enabled).toBe(true);
    expect(flags.mode).toBe("video");
  });

  it("treats ?dev=off as a clear (null mode)", () => {
    const url = new URL("https://api.nasapicture.com/?dev=off");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.mode).toBeNull();
  });

  it("treats ?dev= (empty value) as a clear", () => {
    const url = new URL("https://api.nasapicture.com/?dev=");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.mode).toBeNull();
  });

  it("parses ?tools=<csv> into a set", () => {
    const url = new URL("https://api.nasapicture.com/?tools=palette,grid,fps");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.tools).toEqual(new Set(["palette", "grid", "fps"]));
  });

  it("trims whitespace and ignores empty entries in ?tools", () => {
    const url = new URL("https://api.nasapicture.com/?tools=palette,%20,grid,");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.tools).toEqual(new Set(["palette", "grid"]));
  });

  it("treats ENVIRONMENT values other than 'development' as production", () => {
    const url = new URL("https://api.nasapicture.com/?dev=video");
    const flags = parseDevFlags(url, { ENVIRONMENT: "staging" });
    expect(flags.enabled).toBe(false);
    expect(flags.mode).toBeNull();
  });

  it("leaves mode and tools independent (both can coexist)", () => {
    const url = new URL("https://api.nasapicture.com/?dev=stale&tools=palette,grid");
    const flags = parseDevFlags(url, { ENVIRONMENT: "development" });
    expect(flags.mode).toBe("stale");
    expect(flags.tools).toEqual(new Set(["palette", "grid"]));
  });
});

// ────────────────────────────────────────────────────────────
// resolveApod
// ────────────────────────────────────────────────────────────
describe("resolveApod", () => {
  const baseImage: ApodResponse = {
    date: "2026-04-10",
    title: "Test Image",
    explanation: "...",
    url: "https://apod.nasa.gov/apod/image/2604/test_sd.jpg",
    hdurl: "https://apod.nasa.gov/apod/image/2604/test_hd.jpg",
    media_type: "image",
  };

  it("resolves an image APOD, preferring hdurl for the HD URL", () => {
    const r = resolveApod(baseImage);
    expect(r).not.toBeNull();
    expect(r!.source).toBe("image");
    expect(r!.imageUrl).toBe(baseImage.url);
    expect(r!.imageHdUrl).toBe(baseImage.hdurl);
  });

  it("falls back to url for HD when hdurl is absent", () => {
    const r = resolveApod({ ...baseImage, hdurl: undefined });
    expect(r!.imageHdUrl).toBe(baseImage.url);
  });

  it("resolves a video APOD with thumbnail_url as video_thumbnail", () => {
    const r = resolveApod({
      date: "2026-04-08",
      title: "Test Video",
      explanation: "...",
      url: "https://www.youtube.com/embed/abc",
      media_type: "video",
      thumbnail_url: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
    });
    expect(r).not.toBeNull();
    expect(r!.source).toBe("video_thumbnail");
    expect(r!.imageUrl).toBe("https://img.youtube.com/vi/abc/maxresdefault.jpg");
    expect(r!.imageHdUrl).toBe("https://img.youtube.com/vi/abc/maxresdefault.jpg");
  });

  it("returns null for a video APOD without a thumbnail_url", () => {
    const r = resolveApod({
      date: "2026-04-08",
      title: "Test Video",
      explanation: "...",
      url: "https://www.youtube.com/embed/abc",
      media_type: "video",
    });
    expect(r).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// devApodFixture
// ────────────────────────────────────────────────────────────
describe("devApodFixture", () => {
  it("returns a video fixture with thumbnail_url for mode=video", () => {
    const f = devApodFixture("video", "2026-04-10");
    expect(f).not.toBeNull();
    expect(f!.date).toBe("2026-04-10");
    expect(f!.media_type).toBe("video");
    expect(f!.thumbnail_url).toBeTruthy();
    expect(new URL(f!.thumbnail_url!).hostname).toMatch(/\.youtube\.com|\.ytimg\.com/);
  });

  it("returns a video fixture without thumbnail_url for mode=video-no-thumb", () => {
    const f = devApodFixture("video-no-thumb", "2026-04-10");
    expect(f).not.toBeNull();
    expect(f!.media_type).toBe("video");
    expect(f!.thumbnail_url).toBeUndefined();
  });

  it("returns null for unknown modes (so the handler falls through)", () => {
    expect(devApodFixture("nasa-error", "2026-04-10")).toBeNull();
    expect(devApodFixture("palette", "2026-04-10")).toBeNull();
    expect(devApodFixture("", "2026-04-10")).toBeNull();
  });

  it("stamps the requested date onto the fixture", () => {
    expect(devApodFixture("video", "2020-01-01")!.date).toBe("2020-01-01");
  });

  it("produces fixtures that flow through resolveApod correctly", () => {
    const withThumb = devApodFixture("video", "2026-04-10")!;
    expect(resolveApod(withThumb)!.source).toBe("video_thumbnail");

    const noThumb = devApodFixture("video-no-thumb", "2026-04-10")!;
    expect(resolveApod(noThumb)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// parseApodHtml
// ────────────────────────────────────────────────────────────
describe("parseApodHtml", () => {
  it("parses a typical image APOD page with en-dash title separator", () => {
    // Shape mirrors real apYYMMDD.html pages (newer format uses "YYYY Month D – Title").
    const html = `<!doctype html>
<html><head><title> APOD: 2026 April 8 – Earthset
</title></head>
<body>
<center>
<p>2026 April 8
<br>
<a href="image/2604/earthset_original.jpg">
<IMG SRC="image/2604/earthset_700.jpg" alt="Earthset">
</a>
</center>
<center>
<b> Earthset </b> <br>
<b> Image Credit: </b>
NASA
</center> <p>
<b> Explanation: </b>
The crew of Artemis II watched Earth set behind the Moon.
<p> <hr>
</body></html>`;
    const apod = parseApodHtml(html, "2026-04-08");

    expect(apod.title).toBe("Earthset");
    expect(apod.date).toBe("2026-04-08");
    expect(apod.media_type).toBe("image");
    expect(apod.url).toBe("https://apod.nasa.gov/apod/image/2604/earthset_700.jpg");
    expect(apod.hdurl).toBe("https://apod.nasa.gov/apod/image/2604/earthset_original.jpg");
    expect(apod.explanation).toContain("Artemis II");
    expect(apod.copyright).toContain("NASA");
  });

  it("parses the older double-space title separator format", () => {
    const html = `<html><head><title> APOD: 2025 January 1  Happy New Year
</title></head>
<body>
<a href="image/2501/newyear_original.jpg">
<IMG SRC="image/2501/newyear_700.jpg">
</a>
<b>Explanation:</b> Fireworks above a dark sky.
<p>
</body></html>`;
    const apod = parseApodHtml(html, "2025-01-01");
    expect(apod.title).toBe("Happy New Year");
    expect(apod.date).toBe("2025-01-01");
    expect(apod.media_type).toBe("image");
  });

  it("detects video pages by the presence of an iframe", () => {
    const html = `<html><head><title> APOD: 2026 April 7 – Comet Death
</title></head>
<body>
<iframe src="https://www.youtube.com/embed/xyz"></iframe>
<b>Explanation:</b> A comet disintegrates near the Sun.
</body></html>`;
    const apod = parseApodHtml(html, "2026-04-07");
    expect(apod.media_type).toBe("video");
    expect(apod.title).toBe("Comet Death");
  });

  it("prefixes relative image paths with the APOD base URL", () => {
    const html = `<html><head><title> APOD: 2026 April 8 – Earthset</title></head>
<body><a href="image/2604/foo.jpg"><IMG SRC="image/2604/foo_sd.jpg"></a></body></html>`;
    const apod = parseApodHtml(html, "2026-04-08");
    expect(apod.hdurl).toMatch(/^https:\/\/apod\.nasa\.gov\/apod\/image\//);
    expect(apod.url).toMatch(/^https:\/\/apod\.nasa\.gov\/apod\/image\//);
  });

  it("strips a leading en-dash, em-dash, or hyphen from the title", () => {
    for (const sep of ["–", "—", "-"]) {
      const html = `<html><head><title> APOD: 2026 April 8 ${sep} Earthset</title></head>
<body><a href="image/2604/x.jpg"><IMG SRC="image/2604/x_sd.jpg"></a></body></html>`;
      expect(parseApodHtml(html, "2026-04-08").title).toBe("Earthset");
    }
  });

  it("gracefully falls back when the title tag is missing", () => {
    const html = `<html><body><a href="image/2604/x.jpg"><IMG SRC="image/2604/x_sd.jpg"></a></body></html>`;
    const apod = parseApodHtml(html, "2026-04-08");
    expect(apod.title).toBe("Astronomy Picture of the Day");
    expect(apod.date).toBe("2026-04-08"); // falls back to the requested date
  });
});
