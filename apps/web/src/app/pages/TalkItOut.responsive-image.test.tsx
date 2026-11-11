import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { getPublicSeo } from "@meetezri/public-content";
import { TalkItOut } from "./TalkItOut";
import { TALK_IT_OUT_HERO_SIZES } from "../content/public/talkItOutContent";

const publicDir = path.resolve(import.meta.dirname, "../../../public");
const originalPath = path.join(publicDir, "talk-it-out/talk-it-out.jpg");
const originalSha256 = "0b712a9a2093d9ee5c53792bf48eea8a6fe33f39acdf6079fdfdea296a8c95e7";
const variants = [
  [480, 256],
  [768, 410],
  [1024, 546],
  [1400, 747],
] as const;

function renderPage(): string {
  return renderToString(
    <StaticRouter location="/talk-it-out">
      <MemoryRouter initialEntries={["/talk-it-out"]}>
        <TalkItOut />
      </MemoryRouter>
    </StaticRouter>,
  );
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

describe("Talk It Out responsive public image", () => {
  it("renders one responsive picture while preserving fallback semantics and priority", () => {
    const html = renderPage();
    document.body.innerHTML = html;

    const fallback = document.querySelector<HTMLImageElement>(
      'img[src="/talk-it-out/talk-it-out.jpg"]',
    );
    const picture = fallback?.closest("picture");
    const sources = picture?.querySelectorAll("source");

    expect(document.querySelectorAll('picture img[src="/talk-it-out/talk-it-out.jpg"]')).toHaveLength(1);
    expect(sources).toHaveLength(2);
    expect(sources?.[0]).toHaveAttribute("type", "image/avif");
    expect(sources?.[0]).toHaveAttribute(
      "srcset",
      "/talk-it-out/talk-it-out-480.avif 480w, /talk-it-out/talk-it-out-768.avif 768w, /talk-it-out/talk-it-out-1024.avif 1024w, /talk-it-out/talk-it-out-1400.avif 1400w",
    );
    expect(sources?.[1]).toHaveAttribute("type", "image/webp");
    expect(sources?.[1]).toHaveAttribute(
      "srcset",
      "/talk-it-out/talk-it-out-480.webp 480w, /talk-it-out/talk-it-out-768.webp 768w, /talk-it-out/talk-it-out-1024.webp 1024w, /talk-it-out/talk-it-out-1400.webp 1400w",
    );
    expect(sources?.[0]).toHaveAttribute("sizes", TALK_IT_OUT_HERO_SIZES);
    expect(sources?.[1]).toHaveAttribute("sizes", TALK_IT_OUT_HERO_SIZES);
    expect(fallback).toHaveAttribute(
      "alt",
      "A stream flowing beneath a wooden bridge toward a cabin at sunset.",
    );
    expect(fallback).toHaveAttribute("width", "1717");
    expect(fallback).toHaveAttribute("height", "916");
    expect(fallback).toHaveAttribute("loading", "eager");
    expect(fallback).toHaveAttribute("decoding", "async");
    expect(fallback).not.toHaveAttribute("fetchpriority");
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(html.match(/\/talk-it-out\/talk-it-out\.jpg/g)).toHaveLength(1);
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+talk-it-out/);
  });

  it("preserves the approved public metadata image and description", () => {
    expect(getPublicSeo("/talk-it-out")).toMatchObject({
      canonicalUrl: "https://www.talktosolace2.ai/talk-it-out",
      robots: "index,follow",
      openGraph: {
        image: "https://www.talktosolace2.ai/community/hero-lake.jpg",
        imageAlt: "Mountains above a cloud-filled valley at sunset.",
      },
      twitter: {
        image: "https://www.talktosolace2.ai/community/hero-lake.jpg",
        imageAlt: "Mountains above a cloud-filled valley at sunset.",
      },
    });
  });

  it("ships every approved asset with the correct format and dimensions", () => {
    for (const [width, height] of variants) {
      const base = path.join(publicDir, `talk-it-out/talk-it-out-${width}`);
      const avif = readFileSync(`${base}.avif`);
      const webp = readFileSync(`${base}.webp`);

      expect(avif.subarray(4, 12).toString("ascii")).toBe("ftypavif");
      expect(readAvifDimensions(avif)).toEqual([width, height]);
      expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(readWebpDimensions(webp)).toEqual([width, height]);
    }

    expect(createHash("sha256").update(readFileSync(originalPath)).digest("hex")).toBe(originalSha256);
  });
});
