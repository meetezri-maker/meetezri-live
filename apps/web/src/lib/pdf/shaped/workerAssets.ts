/// <reference lib="webworker" />
/**
 * Shaping assets for the PDF workers: HarfBuzz's WebAssembly (hashed build assets) and the
 * versioned Noto fonts, all from the app's own origin. Nothing is stored; the HTTP cache serves
 * repeat exports.
 */
import hbWasmUrl from "harfbuzzjs/hb.wasm?url";
import subsetWasmUrl from "harfbuzzjs/hb-subset.wasm?url";
import type { FontManifest, ShapingAssets } from "./shapedPdf";

/**
 * Versioned font folder, served with immutable caching. Its files never change: new or updated
 * fonts go in a new folder (VERSION in scripts/pdf-fonts/fetch-pdf-fonts.mjs) and this path moves.
 */
export const FONT_BASE = `${import.meta.env.BASE_URL}fonts/pdf/noto/v1`;

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export const shapingAssets: ShapingAssets = {
  hbWasm: () => fetchBytes(hbWasmUrl),
  subsetWasm: () => fetchBytes(subsetWasmUrl),
  manifest: async () => {
    const res = await fetch(`${FONT_BASE}/manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as FontManifest;
  },
  font: (file) => fetchBytes(`${FONT_BASE}/${file}`),
};
