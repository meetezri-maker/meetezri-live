import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
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
vi.mock("@/lib/api", () => ({ api: { joinFoundingCircle: vi.fn() } }));

import { EarlyAccess } from "@/app/pages/EarlyAccess";
import { ONBOARDING_COMPANION_SELECTION_BG } from "@/lib/solace/referenceImagery";
import {
  PRELAUNCH_HERO_AVIF_SRCSET,
  PRELAUNCH_HERO_BG,
  PRELAUNCH_HERO_SIZES,
  PRELAUNCH_HERO_WEBP_SRCSET,
} from "./prelaunch.imagery";

const publicDir = path.resolve(import.meta.dirname, "../../../../public");
const variants = [[640, 512], [960, 768], [1200, 960], [1402, 1122]] as const;
const originalHashes = {
  "community/hero-early.png": "7e97b95ae9692e5009b1d3fe43bc282a65013e09376f0f6e4df2b0f2740092ce",
  "community/hero-early-640.webp": "c359f60b08c3c1f7114e54dab9de7e405fca99bc9ffb7ca974e21a6b5eae1dec",
  "community/hero-early-960.webp": "4be7ba5ad91c7d25d5e71ff0b13ecc552e90e24b4809b933a4740f067f412372",
  "community/hero-early-1200.webp": "41ff695278c5b30dd831f7487904a13f90ec735c95bb26bcb2c111ce65e33097",
  "community/hero-early-1402.webp": "ba48a510e9ad63a03b681865dcc0d2d4bad5e3f6e4a4cbf557367fb571683d9b",
  "solace/companion-selection-calm-mountain.jpg": "991d981e1e198fb69969e4d5e9937c5e520798bc2f6f176b93b470542ee60624",
} as const;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/early-access"]}>
      <Routes>
        <Route path="/early-access" element={<EarlyAccess />} />
      </Routes>
    </MemoryRouter>,
  );
}

function readAvifDimensions(bytes: Buffer): [number, number] {
  const ispe = bytes.indexOf(Buffer.from("ispe"));
  expect(ispe).toBeGreaterThan(0);
  return [bytes.readUInt32BE(ispe + 8), bytes.readUInt32BE(ispe + 12)];
}

afterEach(() => cleanup());

describe("Early Access Package 5 hero AVIF sources", () => {
  it("renders AVIF before the preserved WebP and PNG fallback", () => {
    renderPage();

    const fallback = document.querySelector<HTMLImageElement>(`img[src="${PRELAUNCH_HERO_BG}"]`);
    const picture = fallback?.closest("picture");
    const sources = picture?.querySelectorAll("source");

    expect(fallback).not.toBeNull();
    expect(document.querySelectorAll(`picture img[src="${PRELAUNCH_HERO_BG}"]`)).toHaveLength(1);
    expect(sources).toHaveLength(2);
    expect(sources?.[0]).toHaveAttribute("type", "image/avif");
    expect(sources?.[0]).toHaveAttribute("srcset", PRELAUNCH_HERO_AVIF_SRCSET);
    expect(sources?.[0]).toHaveAttribute("sizes", PRELAUNCH_HERO_SIZES);
    expect(sources?.[1]).toHaveAttribute("type", "image/webp");
    expect(sources?.[1]).toHaveAttribute("srcset", PRELAUNCH_HERO_WEBP_SRCSET);
    expect(sources?.[1]).toHaveAttribute("sizes", PRELAUNCH_HERO_SIZES);
    expect(PRELAUNCH_HERO_SIZES).toBe("100vw");

    expect(fallback).toHaveAttribute("alt", "");
    expect(fallback).toHaveAttribute("width", "1402");
    expect(fallback).toHaveAttribute("height", "1122");
    expect(fallback).toHaveAttribute("loading", "eager");
    expect(fallback).toHaveAttribute("decoding", "async");
    expect(fallback).toHaveAttribute("fetchpriority", "high");
    expect(fallback).toHaveClass("h-full", "w-full", "object-cover", "object-[center_55%]");
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(document.querySelector('img[fetchpriority="high"]')).toBe(fallback);
    expect(document.querySelectorAll('link[rel="preload"][href*="hero-early"]')).toHaveLength(0);
  });

  it("ships the exact AVIF candidates and preserves every existing asset byte-for-byte", () => {
    expect(PRELAUNCH_HERO_AVIF_SRCSET).toBe(
      variants.map(([width]) => `/community/hero-early-${width}.avif ${width}w`).join(", "),
    );
    expect(PRELAUNCH_HERO_WEBP_SRCSET).toBe(
      variants.map(([width]) => `/community/hero-early-${width}.webp ${width}w`).join(", "),
    );

    for (const [width, height] of variants) {
      const avif = readFileSync(path.join(publicDir, `community/hero-early-${width}.avif`));
      expect(avif.subarray(4, 12).toString("ascii")).toBe("ftypavif");
      expect(readAvifDimensions(avif)).toEqual([width, height]);
    }

    for (const [relativePath, expectedHash] of Object.entries(originalHashes)) {
      const bytes = readFileSync(path.join(publicDir, relativePath));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
    }
  });

  it("keeps the private onboarding image separate from the Early Access hero", () => {
    expect(ONBOARDING_COMPANION_SELECTION_BG).toBe(
      "/solace/companion-selection-calm-mountain.jpg",
    );
    expect(PRELAUNCH_HERO_BG).toBe("/community/hero-early.png");
    expect(PRELAUNCH_HERO_BG).not.toBe(ONBOARDING_COMPANION_SELECTION_BG);
  });
});
