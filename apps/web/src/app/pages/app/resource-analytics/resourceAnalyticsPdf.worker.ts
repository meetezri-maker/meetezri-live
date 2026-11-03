/// <reference lib="webworker" />
/**
 * Resource Analytics PDF worker: lays out the frozen report snapshot off the main thread with the
 * shared shaping engine, loading HarfBuzz's WebAssembly and only the fonts the report needs from
 * the app's own origin. The page terminates the worker when the export ends or is cancelled.
 */
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError } from '@/lib/pdf/shaped/shapedPdf';
import { fetchBytes, shapingAssets } from '@/lib/pdf/shaped/workerAssets';
import type { ShapedPdfWorkerResponse } from '@/lib/pdf/shaped/pdfWorkerClient';
import { buildResourceAnalyticsPdf } from './resourceAnalyticsPdfLayout';
import type { ResourceAnalyticsPdfWorkerRequest } from './resourceAnalyticsPdf';

const post = (message: ShapedPdfWorkerResponse, transfer: Transferable[] = []) =>
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<ResourceAnalyticsPdfWorkerRequest>) => {
  try {
    const runtime = await createShapingRuntime(shapingAssets);
    const logo = await fetchBytes(data.logoUrl).catch(() => null);
    const result = await buildResourceAnalyticsPdf(data.snapshot, runtime, {
      locale: data.locale,
      logoPng: logo,
      onProgress: (p) => post({ type: 'progress', loaded: p.loaded, total: p.total }),
    });
    post({ type: 'done', bytes: result.bytes, pages: result.pages, emojiReplacedCount: result.emojiReplacedCount, fonts: result.fonts }, [result.bytes.buffer]);
  } catch (error) {
    if (error instanceof UnsupportedCharactersError) post({ type: 'error', kind: 'unsupported', characters: error.characters });
    else if (error instanceof FontLoadError) post({ type: 'error', kind: 'fonts' });
    else post({ type: 'error', kind: 'failed' });
  }
};
