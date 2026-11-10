import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = path.resolve(import.meta.dirname, "../../../../public");
const variants = [
  [640, 427],
  [960, 640],
  [1280, 853],
  [1536, 1024],
] as const;

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

describe("Early Access responsive background assets", () => {
  it("ships every approved AVIF and WebP width with matching format and dimensions", () => {
    for (let image = 1; image <= 6; image += 1) {
      for (const [width, height] of variants) {
        const base = path.join(publicDir, `community/early-access-bg${image}-${width}`);
        const avif = readFileSync(`${base}.avif`);
        const webp = readFileSync(`${base}.webp`);

        expect(avif.subarray(4, 12).toString("ascii")).toBe("ftypavif");
        expect(readAvifDimensions(avif)).toEqual([width, height]);
        expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
        expect(readWebpDimensions(webp)).toEqual([width, height]);
      }
    }
  });

  it("keeps corresponding bg3 and bg6 variants byte-identical", () => {
    const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

    for (const [width] of variants) {
      expect(
        sha256(readFileSync(path.join(publicDir, `community/early-access-bg3-${width}.avif`))),
      ).toBe(
        sha256(readFileSync(path.join(publicDir, `community/early-access-bg6-${width}.avif`))),
      );
      expect(
        sha256(readFileSync(path.join(publicDir, `community/early-access-bg3-${width}.webp`))),
      ).toBe(
        sha256(readFileSync(path.join(publicDir, `community/early-access-bg6-${width}.webp`))),
      );
    }
  });
});
