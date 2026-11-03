/// <reference lib="webworker" />
/**
 * Session Transcript PDF worker: builds the PDF off the main thread. It loads HarfBuzz's
 * WebAssembly and only the fonts the transcript needs, all from the app's own origin, and posts
 * progress, the finished PDF bytes, or an error. The page terminates the worker when the export
 * finishes or is cancelled, which releases the transcript data and fonts. Nothing is stored.
 */
import hbWasmUrl from "harfbuzzjs/hb.wasm?url";
import subsetWasmUrl from "harfbuzzjs/hb-subset.wasm?url";
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError, type FontManifest, type ShapingAssets } from "@/lib/pdf/shaped/shapedPdf";
import type { TranscriptDocument } from "./sessionTranscriptExport";
import { buildShapedTranscriptPdf } from "./sessionTranscriptPdfLayout";
import type { TranscriptPdfWorkerRequest, TranscriptPdfWorkerResponse } from "./sessionTranscriptPdf";

/**
 * Versioned font folder, served with immutable caching. Its files never change: new or updated
 * fonts go in a new folder (VERSION in scripts/pdf-fonts/fetch-pdf-fonts.mjs) and this path moves.
 */
const FONT_BASE = `${import.meta.env.BASE_URL}fonts/pdf/noto/v1`;

async function bytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const assets: ShapingAssets = {
  hbWasm: () => bytes(hbWasmUrl),
  subsetWasm: () => bytes(subsetWasmUrl),
  manifest: async () => {
    const res = await fetch(`${FONT_BASE}/manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as FontManifest;
  },
  font: (file) => bytes(`${FONT_BASE}/${file}`),
};

const post = (message: TranscriptPdfWorkerResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<TranscriptPdfWorkerRequest>) => {
  try {
    const runtime = await createShapingRuntime(assets);
    const logo = await bytes(data.logoUrl).catch(() => null);
    const result = await buildShapedTranscriptPdf(data.doc as TranscriptDocument, runtime, {
      locale: data.locale,
      logoPng: logo,
      onProgress: (p) => post({ type: "progress", loaded: p.loaded, total: p.total }),
    });
    post({ type: "done", bytes: result.bytes, pages: result.pages, emojiReplacedCount: result.emojiReplacedCount, fonts: result.fonts }, [result.bytes.buffer]);
  } catch (error) {
    if (error instanceof UnsupportedCharactersError) post({ type: "error", kind: "unsupported", characters: error.characters });
    else if (error instanceof FontLoadError) post({ type: "error", kind: "fonts" });
    else post({ type: "error", kind: "failed" });
  }
};
