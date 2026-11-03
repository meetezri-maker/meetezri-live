/// <reference lib="webworker" />
/**
 * Session Transcript PDF worker: builds the PDF off the main thread. It loads HarfBuzz's
 * WebAssembly and only the fonts the transcript needs, all from the app's own origin, and posts
 * progress, the finished PDF bytes, or an error. The page terminates the worker when the export
 * finishes or is cancelled, which releases the transcript data and fonts. Nothing is stored.
 */
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError } from "@/lib/pdf/shaped/shapedPdf";
import { fetchBytes, shapingAssets } from "@/lib/pdf/shaped/workerAssets";
import type { TranscriptDocument } from "./sessionTranscriptExport";
import { buildShapedTranscriptPdf } from "./sessionTranscriptPdfLayout";
import type { TranscriptPdfWorkerRequest, TranscriptPdfWorkerResponse } from "./sessionTranscriptPdf";

const post = (message: TranscriptPdfWorkerResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<TranscriptPdfWorkerRequest>) => {
  try {
    const runtime = await createShapingRuntime(shapingAssets);
    const logo = await fetchBytes(data.logoUrl).catch(() => null);
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
