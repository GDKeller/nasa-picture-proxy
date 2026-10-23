import { describe, it, expect } from "vitest";
import {
  parseDevFlags,
  resolveApod,
  devApodFixture,
  normalizeApod,
  apodAssetPath,
  type Apod,
} from "../src/index";
import image261020 from "./fixtures/apod-basic/261020.json";
import youtube261018 from "./fixtures/apod-basic/261018.json";
import mp4_261016 from "./fixtures/apod-basic/261016.json";
import videoNoPoster from "./fixtures/apod-basic/video-no-poster.json";
import logo from "./fixtures/apod-basic/logo.json";
import notFound from "./fixtures/apod-basic/404.json";

const ASSETS = "https://assets.science.nasa.gov";

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
// apodAssetPath
// ────────────────────────────────────────────────────────────
describe("apodAssetPath", () => {
  const path = "science/cds/apod/apod/2026/october/AntiRainbow_Esposti_5120.jpg";

  it("extracts the asset path from a dynamicimage URL, ignoring the query", () => {
    expect(apodAssetPath(`${ASSETS}/dynamicimage/assets/${path}?w=5120&h=3840&fit=clip`)).toBe(path);
  });

  it("extracts the asset path from a content/dam URL (older entries)", () => {
    expect(apodAssetPath(`${ASSETS}/content/dam/${path}?w=3000`)).toBe(path);
  });

  it("keeps percent-encoded filenames verbatim", () => {
    const encoded = "science/cds/apod/apod/2026/october/Harvest%20Moon%20Rise.jpg";
    expect(apodAssetPath(`${ASSETS}/dynamicimage/assets/${encoded}`)).toBe(encoded);
  });

  it("rejects the NASA logo, the placeholder thumbnail, videos, other hosts, and junk", () => {
    expect(apodAssetPath("https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png")).toBeNull();
    expect(apodAssetPath(`${ASSETS}/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png?w=594`)).toBeNull();
    expect(apodAssetPath(`${ASSETS}/content/dam/science/cds/apod/apod/2026/october/CRS35-Holland30s1080p.mp4`)).toBeNull();
    expect(apodAssetPath(`http://assets.science.nasa.gov/content/dam/${path}`)).toBeNull();
    expect(apodAssetPath(`https://evil.example/content/dam/${path}`)).toBeNull();
    expect(apodAssetPath("")).toBeNull();
    expect(apodAssetPath("not a url")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// normalizeApod (real recorded apod-basic responses)
// ────────────────────────────────────────────────────────────
describe("normalizeApod", () => {
  it("maps an image day to plain text and APOD asset URLs", () => {
    const apod = normalizeApod(image261020, "2026-10-20");
    const path = "science/cds/apod/apod/2026/october/AntiRainbow_Esposti_5120.jpg";

    expect(apod.date).toBe("2026-10-20");
    expect(apod.title).toBe("An Anticrepuscular Rainbow Fan");
    expect(apod.media_type).toBe("image");
    expect(apod.explanation).toMatch(/^This is an unusual rainbow\./);
    expect(apod.explanation).not.toMatch(/<|Explanation:/);
    expect(apod.copyright).toBe("Aurelia Degli Esposti");
    expect(apod.permalink).toBe("https://science.nasa.gov/image-article/apod-2026-october-20-an-anticrepuscular-rainbow-fan/");
    expect(apod.image).toEqual({
      sd: `${ASSETS}/dynamicimage/assets/${path}`,
      hd: `${ASSETS}/content/dam/${path}`,
      hdFallback: image261020.hdurl,
    });
  });

  it("keeps a YouTube day's poster as the image", () => {
    const apod = normalizeApod(youtube261018, "2026-10-18");
    expect(apod.media_type).toBe("video");
    expect(apod.image?.hd).toBe(`${ASSETS}/content/dam/science/cds/apod/apod/2026/october/SonifiedEagleNebulaPillars.jpg`);
    // Multi-line HTML credit flattens to one readable line.
    expect(apod.copyright).toBe(
      "Image Credit: NASA, ESA, & The Hubble Heritage Project (STScI/AURA); " +
      "Sonification: NASA, CXC, SAO, K. Arcand, M. Russo & A. Santaguida",
    );
  });

  it("keeps an MP4 day's poster as the image", () => {
    const apod = normalizeApod(mp4_261016, "2026-10-16");
    expect(apod.media_type).toBe("video");
    expect(apod.image?.hd).toMatch(/CRS35-Holland30s1080p\.jpg$/);
  });

  it("yields image: null for a video day with no poster (walkback, not an error)", () => {
    const apod = normalizeApod(videoNoPoster, "2026-10-16");
    expect(apod.media_type).toBe("video");
    expect(apod.image).toBeNull();
  });

  it("throws on an image day whose hdurl is not an APOD asset (the logo outage shape)", () => {
    expect(() => normalizeApod(logo, "2026-10-20")).toThrow(/no APOD image/);
  });

  it("throws when the record is for a different date", () => {
    expect(() => normalizeApod(image261020, "2026-10-19")).toThrow(/date mismatch/);
  });

  it("throws on schema failures", () => {
    expect(() => normalizeApod(notFound, "2026-12-31")).toThrow(/invalid record/);
    expect(() => normalizeApod({ ...image261020, title: " " }, "2026-10-20")).toThrow(/invalid record/);
    expect(() => normalizeApod({ ...image261020, media_type: "other" }, "2026-10-20")).toThrow(/invalid record/);
  });

  it("tolerates missing optional fields", () => {
    const apod = normalizeApod(
      { date: "2026-10-20", title: "T", media_type: "image", hdurl: image261020.hdurl },
      "2026-10-20",
    );
    expect(apod.explanation).toBe("");
    expect(apod.copyright).toBeNull();
    expect(apod.permalink).toBe("");
  });
});

// ────────────────────────────────────────────────────────────
// resolveApod
// ────────────────────────────────────────────────────────────
describe("resolveApod", () => {
  const image = {
    sd: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/april/test.jpg`,
    hd: `${ASSETS}/content/dam/science/cds/apod/apod/2026/april/test.jpg`,
    hdFallback: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/april/test.jpg?w=4000`,
  };
  const base: Apod = {
    date: "2026-04-10",
    title: "Test Image",
    explanation: "...",
    copyright: null,
    media_type: "image",
    permalink: "https://science.nasa.gov/image-article/test/",
    image,
    video_url: null,
  };

  it("resolves an image APOD with source=image", () => {
    const r = resolveApod(base);
    expect(r).not.toBeNull();
    expect(r!.source).toBe("image");
    expect(r!.image).toBe(image);
  });

  it("resolves a video APOD with a poster as video_thumbnail", () => {
    const r = resolveApod({ ...base, media_type: "video", video_url: "https://www.youtube.com/embed/abc" });
    expect(r!.source).toBe("video_thumbnail");
    expect(r!.image).toBe(image);
  });

  it("returns null for a video APOD without a poster", () => {
    expect(resolveApod({ ...base, media_type: "video", image: null })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// devApodFixture
// ────────────────────────────────────────────────────────────
describe("devApodFixture", () => {
  it("returns a video fixture with a poster on the APOD asset host for mode=video", () => {
    const f = devApodFixture("video", "2026-04-10");
    expect(f).not.toBeNull();
    expect(f!.date).toBe("2026-04-10");
    expect(f!.media_type).toBe("video");
    expect(f!.image).not.toBeNull();
    expect(apodAssetPath(f!.image!.hd)).not.toBeNull();
    expect(apodAssetPath(f!.image!.sd)).not.toBeNull();
    expect(f!.video_url).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
  });

  it("returns a video fixture without a poster for mode=video-no-thumb", () => {
    const f = devApodFixture("video-no-thumb", "2026-04-10");
    expect(f).not.toBeNull();
    expect(f!.media_type).toBe("video");
    expect(f!.image).toBeNull();
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
    const withPoster = devApodFixture("video", "2026-04-10")!;
    expect(resolveApod(withPoster)!.source).toBe("video_thumbnail");

    const noPoster = devApodFixture("video-no-thumb", "2026-04-10")!;
    expect(resolveApod(noPoster)).toBeNull();
  });
});
