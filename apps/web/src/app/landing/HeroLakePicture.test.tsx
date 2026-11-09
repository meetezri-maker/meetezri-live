import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { getPublicSeo } from "@meetezri/public-content";
import { About } from "../pages/About";
import { HowItWorks } from "../pages/HowItWorks";
import { Landing } from "../pages/Landing";
import { Pricing } from "../pages/Pricing";
import { Safety } from "../pages/Safety";
import { TalkItOut } from "../pages/TalkItOut";
import { Terms } from "../pages/Terms";

const widths = [640, 960, 1280, 1600] as const;
const heights = [427, 640, 854, 1067] as const;
const publicDir = path.resolve(import.meta.dirname, "../../../public");

const pages = [
  ["/", Landing],
  ["/how-it-works", HowItWorks],
  ["/about", About],
  ["/safety", Safety],
  ["/pricing", Pricing],
  ["/talk-it-out", TalkItOut],
] as const;

function renderPage(Page: () => JSX.Element, pathname: string): Document {
  document.body.innerHTML = renderToString(
    <StaticRouter location={pathname}>
      <MemoryRouter initialEntries={[pathname]}>
        <Page />
      </MemoryRouter>
    </StaticRouter>,
  );
  return document;
}

function expectedSrcSet(extension: "avif" | "webp"): string {
  return widths.map((width) => `/community/hero-lake-${width}.${extension} ${width}w`).join(", ");
}

function readAvifDimensions(bytes: Buffer): [number, number] {
  const ispe = bytes.indexOf(Buffer.from("ispe"));
  expect(ispe).toBeGreaterThan(0);
  return [bytes.readUInt32BE(ispe + 8), bytes.readUInt32BE(ispe + 12)];
}

function readWebpDimensions(bytes: Buffer): [number, number] {
  const vp8 = bytes.indexOf(Buffer.from("VP8 "));
  expect(vp8).toBeGreaterThan(0);
  const frameHeader = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), vp8);
  expect(frameHeader).toBeGreaterThan(vp8);
  return [
    bytes.readUInt16LE(frameHeader + 3) & 0x3fff,
    bytes.readUInt16LE(frameHeader + 5) & 0x3fff,
  ];
}

describe("responsive hero lake package", () => {
  it("renders the shared AVIF, WebP, and JPEG fallback contract on public heroes", () => {
    for (const [pathname, Page] of pages) {
      const result = renderPage(Page, pathname);
      const pictures = result.querySelectorAll("picture");
      expect(pictures, pathname).toHaveLength(1);

      const sources = pictures[0].querySelectorAll("source");
      expect(sources, pathname).toHaveLength(2);
      expect(sources[0]).toHaveAttribute("type", "image/avif");
      expect(sources[0]).toHaveAttribute("srcset", expectedSrcSet("avif"));
      expect(sources[0]).toHaveAttribute("sizes", "100vw");
      expect(sources[1]).toHaveAttribute("type", "image/webp");
      expect(sources[1]).toHaveAttribute("srcset", expectedSrcSet("webp"));
      expect(sources[1]).toHaveAttribute("sizes", "100vw");

      const fallback = pictures[0].querySelector("img");
      expect(fallback).toHaveAttribute("src", "/community/hero-lake.jpg");
      expect(fallback).toHaveAttribute("alt", "");
      expect(fallback).toHaveAttribute("width", "1600");
      expect(fallback).toHaveAttribute("height", "1067");
      expect(fallback).toHaveAttribute("loading", "eager");
      expect(fallback).toHaveAttribute("fetchpriority", "high");
      expect(result.querySelectorAll('img[fetchpriority="high"]'), pathname).toHaveLength(1);
    }
  });

  it("keeps Terms eager at default priority", () => {
    const result = renderPage(Terms, "/terms");
    const pictures = result.querySelectorAll("picture");
    expect(pictures).toHaveLength(1);
    const fallback = pictures[0].querySelector("img");
    expect(fallback).toHaveAttribute("src", "/community/hero-lake.jpg");
    expect(fallback).toHaveAttribute("alt", "");
    expect(fallback).toHaveAttribute("width", "1600");
    expect(fallback).toHaveAttribute("height", "1067");
    expect(fallback).toHaveAttribute("loading", "eager");
    expect(fallback).not.toHaveAttribute("fetchpriority");
    expect(result.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(0);
  });

  it("ships exactly the approved files with matching magic bytes and dimensions", () => {
    for (const [index, width] of widths.entries()) {
      const expectedDimensions = [width, heights[index]];
      const avif = readFileSync(path.join(publicDir, `community/hero-lake-${width}.avif`));
      const webp = readFileSync(path.join(publicDir, `community/hero-lake-${width}.webp`));

      expect(avif.subarray(4, 12).toString("ascii")).toBe("ftypavif");
      expect(readAvifDimensions(avif)).toEqual(expectedDimensions);
      expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(readWebpDimensions(webp)).toEqual(expectedDimensions);
    }
  });

  it("keeps fixed-page social metadata on the original JPEG with approved alt text", () => {
    for (const [pathname] of pages) {
      const seo = getPublicSeo(pathname);
      expect(seo?.openGraph.image).toBe("https://www.talktosolace2.ai/community/hero-lake.jpg");
      expect(seo?.twitter.image).toBe("https://www.talktosolace2.ai/community/hero-lake.jpg");
      expect(seo?.openGraph.imageAlt).toBe("Mountains above a cloud-filled valley at sunset.");
      expect(seo?.twitter.imageAlt).toBe("Mountains above a cloud-filled valley at sunset.");
    }
  });
});
