import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

globalThis.IntersectionObserver ??= class {
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

Element.prototype.scrollIntoView = vi.fn();
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;

vi.mock("@/app/components/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("../../components/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("@/lib/api", () => ({
  api: { joinFoundingCircle: vi.fn() },
}));

import { EarlyAccess } from "@/app/pages/EarlyAccess";
import { FOUNDER } from "./prelaunch.content";
import {
  FOUNDER_VIDEO_POSTER_SIZES,
  PRELAUNCH_HERO_BG,
  PRELAUNCH_MOMENT_IMAGE_SIZES,
} from "./prelaunch.imagery";

const publicDir = path.resolve(import.meta.dirname, "../../../../public");
const humanWidths = [320, 480, 640, 800] as const;
const founderWidths = [480, 768, 1024, 1536] as const;
const targets = [
  {
    src: "/community/scene-bedroom.jpg",
    base: "/community/scene-bedroom",
    width: 800,
    height: 533,
    sizes: PRELAUNCH_MOMENT_IMAGE_SIZES,
    variants: [[320, 213], [480, 320], [640, 426], [800, 533]] as const,
    sha256: "880dad8b10072b63e4b40296eb1ad1d7ec53e5c4005d6a6868ccb59318c8ea46",
  },
  {
    src: "/community/scene-stars.jpg",
    base: "/community/scene-stars",
    width: 800,
    height: 534,
    sizes: PRELAUNCH_MOMENT_IMAGE_SIZES,
    variants: [[320, 214], [480, 320], [640, 427], [800, 534]] as const,
    sha256: "48b955ea15932379dc2e2e1350f5003884ac31ca0910c0a003e411ef229a763b",
  },
  {
    src: "/community/scene-water.jpg",
    base: "/community/scene-water",
    width: 800,
    height: 533,
    sizes: PRELAUNCH_MOMENT_IMAGE_SIZES,
    variants: [[320, 213], [480, 320], [640, 426], [800, 533]] as const,
    sha256: "4ec6698c46b9ea08a723c2eb516c99360836f801c503cee75075f17eaebdb837",
  },
  {
    src: "/solace/onboarding-complete-twilight-lake.jpg",
    base: "/solace/onboarding-complete-twilight-lake",
    width: 1536,
    height: 1024,
    sizes: FOUNDER_VIDEO_POSTER_SIZES,
    variants: [[480, 320], [768, 512], [1024, 683], [1536, 1024]] as const,
    sha256: "84d90580b517e96b63a44b4ca2de6c43f3390fc8d39acf5a7420f83d003b1e0e",
  },
] as const;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/early-access"]}>
      <Routes>
        <Route path="/early-access" element={<EarlyAccess />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectedSrcSet(base: string, widths: readonly number[], format: "avif" | "webp") {
  return widths.map((width) => `${base}-${width}.${format} ${width}w`).join(", ");
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

afterEach(() => cleanup());

describe("Early Access Package 4 responsive images", () => {
  it("renders the four target pictures with exact sources and preserved fallback behavior", () => {
    renderPage();

    for (const target of targets) {
      const fallback = document.querySelector<HTMLImageElement>(`img[src="${target.src}"]`);
      const picture = fallback?.closest("picture");
      const sources = picture?.querySelectorAll("source");
      const widths = target.width === 1536 ? founderWidths : humanWidths;

      expect(fallback).not.toBeNull();
      expect(picture).not.toBeNull();
      expect(sources).toHaveLength(2);
      expect(sources?.[0]).toHaveAttribute("type", "image/avif");
      expect(sources?.[0]).toHaveAttribute(
        "srcset",
        expectedSrcSet(target.base, widths, "avif"),
      );
      expect(sources?.[1]).toHaveAttribute("type", "image/webp");
      expect(sources?.[1]).toHaveAttribute(
        "srcset",
        expectedSrcSet(target.base, widths, "webp"),
      );
      expect(sources?.[0]).toHaveAttribute("sizes", target.sizes);
      expect(sources?.[1]).toHaveAttribute("sizes", target.sizes);
      expect(fallback).toHaveAttribute("alt", "");
      expect(fallback).toHaveAttribute("width", String(target.width));
      expect(fallback).toHaveAttribute("height", String(target.height));
      expect(fallback).toHaveAttribute("loading", "lazy");
      expect(fallback).toHaveAttribute("decoding", "async");
      expect(fallback).not.toHaveAttribute("fetchpriority");
      expect(fallback).toHaveClass("h-full", "w-full", "object-cover");
      expect(picture?.querySelectorAll(`img[src="${target.src}"]`)).toHaveLength(1);
    }

    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(document.querySelector('img[fetchpriority="high"]')).toHaveAttribute(
      "src",
      PRELAUNCH_HERO_BG,
    );
    expect(document.querySelectorAll('link[rel="preload"]')).toHaveLength(0);
  });

  it("preserves founder button semantics and pointer and keyboard activation", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("founder") as HTMLElement;
    const trigger = within(section).getByRole("button", {
      name: `Play the founder video: ${FOUNDER.videoTitle}`,
    });

    expect(trigger).toHaveAttribute("type", "button");
    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("ships every variant with the approved signature and dimensions and preserves originals", () => {
    for (const target of targets) {
      const relativeBase = target.base.slice(1);
      for (const [width, height] of target.variants) {
        const avif = readFileSync(path.join(publicDir, `${relativeBase}-${width}.avif`));
        const webp = readFileSync(path.join(publicDir, `${relativeBase}-${width}.webp`));

        expect(avif.subarray(4, 12).toString("ascii")).toBe("ftypavif");
        expect(readAvifDimensions(avif)).toEqual([width, height]);
        expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
        expect(readWebpDimensions(webp)).toEqual([width, height]);
      }

      const original = readFileSync(path.join(publicDir, target.src.slice(1)));
      expect(createHash("sha256").update(original).digest("hex")).toBe(target.sha256);
    }
  });
});
