/**
 * Runs one shaped-PDF worker for one export: posts the request, reports font progress, and
 * terminates the worker as soon as it finishes, fails or `signal` aborts (releasing the report
 * data and fonts it holds). Late messages after that are ignored.
 */
import { PdfUnsupportedTextError } from "@/lib/pdf/pdfText";

export type ShapedPdfWorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "done"; bytes: Uint8Array; pages: number; emojiReplacedCount: number; fonts: string[] }
  | { type: "error"; kind: "unsupported"; characters: string[] }
  | { type: "error"; kind: "fonts" | "failed" };

export interface ShapedPdfResult {
  bytes: Uint8Array<ArrayBuffer>;
  pages: number;
  emojiReplacedCount: number;
}

export interface ShapedPdfProgress {
  /** Fonts downloaded so far, and how many this document needs. */
  fontsLoaded: number;
  fontsTotal: number;
}

export const pdfAbortError = () => new DOMException("The PDF export was cancelled.", "AbortError");

/**
 * Rejects with `PdfUnsupportedTextError` ("no-glyph" for text no bundled font can draw,
 * "font-unavailable" when fonts cannot be loaded), an `AbortError` when `signal` aborts, or an
 * Error when the worker fails.
 */
export function runShapedPdfWorker(
  createWorker: () => Worker,
  request: unknown,
  options: { signal?: AbortSignal; onProgress?: (p: ShapedPdfProgress) => void } = {}
): Promise<ShapedPdfResult> {
  const { signal, onProgress } = options;
  return new Promise<ShapedPdfResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(pdfAbortError());
      return;
    }
    const worker = createWorker();
    let settled = false;
    const finish = () => {
      settled = true;
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      finish();
      reject(pdfAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<ShapedPdfWorkerResponse>) => {
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
    worker.postMessage(request);
  });
}
