/**
 * Session Transcript PDF (row download menu / popup "Export Transcript" → Download PDF): the same
 * transcript document as the TXT, as a branded A4 reading document (see sessionTranscriptPdfLayout).
 *
 * Built in a Web Worker with HarfBuzz text shaping, so scripts such as Bengali, Devanagari, Arabic
 * and CJK are drawn correctly. Each export uses its own worker, which is terminated when the
 * export finishes, fails or is cancelled (releasing the transcript data); the PDF code, WebAssembly
 * and fonts are loaded only for a PDF, and only the fonts the transcript needs are downloaded.
 */
import { PUBLIC_BRAND_LOGO_ON_LIGHT_PATH } from "@meetezri/public-content";
import { PdfUnsupportedTextError } from "@/lib/pdf/pdfText";
import type { TranscriptDocument } from "./sessionTranscriptExport";

/** e.g. `solace-session-<id>-2026-10-27-transcript.pdf` (same safe stem as the TXT). */
export function transcriptPdfFileName(doc: Pick<TranscriptDocument, "fileStem">): string {
  return `${doc.fileStem}.pdf`;
}

export interface TranscriptPdfWorkerRequest {
  doc: TranscriptDocument;
  locale?: string;
  logoUrl: string;
}
export type TranscriptPdfWorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "done"; bytes: Uint8Array; pages: number; emojiReplacedCount: number; fonts: string[] }
  | { type: "error"; kind: "unsupported"; characters: string[] }
  | { type: "error"; kind: "fonts" | "failed" };

export interface TranscriptPdfProgress {
  /** Fonts downloaded so far, and how many this transcript needs. */
  fontsLoaded: number;
  fontsTotal: number;
}

export interface TranscriptPdf {
  bytes: Uint8Array<ArrayBuffer>;
  pages: number;
  emojiReplacedCount: number;
}

export interface CreateTranscriptPdfOptions {
  signal?: AbortSignal;
  onProgress?: (p: TranscriptPdfProgress) => void;
  /** Reader's locale, used only to choose Han glyph forms (see shapedPdf.hanFamilyForRun). */
  locale?: string;
}

const abortError = () => new DOMException("The PDF export was cancelled.", "AbortError");

/**
 * Builds the PDF in a dedicated worker. Rejects with `PdfUnsupportedTextError` ("no-glyph" for text
 * no bundled font can draw, "font-unavailable" when fonts cannot be loaded), an `AbortError` when
 * `signal` aborts (the worker is terminated at once), or an Error when the worker fails.
 */
export function createSessionTranscriptPdf(t: TranscriptDocument, options: CreateTranscriptPdfOptions = {}): Promise<TranscriptPdf> {
  const { signal, onProgress, locale } = options;
  return new Promise<TranscriptPdf>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const worker = new Worker(new URL("./sessionTranscriptPdf.worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = () => {
      settled = true;
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      finish();
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<TranscriptPdfWorkerResponse>) => {
      if (settled) return;
      if (data.type === "progress") {
        onProgress?.({ fontsLoaded: data.loaded, fontsTotal: data.total });
        return;
      }
      finish();
      // Bytes received from a worker are always backed by a plain ArrayBuffer (transferred or cloned).
      if (data.type === "done") resolve({ bytes: data.bytes as Uint8Array<ArrayBuffer>, pages: data.pages, emojiReplacedCount: data.emojiReplacedCount });
      else if (data.kind === "unsupported") reject(new PdfUnsupportedTextError(data.characters, "no-glyph"));
      else if (data.kind === "fonts") reject(new PdfUnsupportedTextError([], "font-unavailable"));
      else reject(new Error("The PDF could not be created."));
    };
    const onFailure = (event: Event) => {
      event.preventDefault?.();
      if (settled) return;
      finish();
      reject(new Error("The PDF worker failed to start or crashed."));
    };
    worker.onerror = onFailure;
    worker.onmessageerror = onFailure;
    const request: TranscriptPdfWorkerRequest = { doc: t, locale, logoUrl: PUBLIC_BRAND_LOGO_ON_LIGHT_PATH };
    worker.postMessage(request);
  });
}
