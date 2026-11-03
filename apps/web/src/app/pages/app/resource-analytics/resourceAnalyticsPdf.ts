/**
 * Resource Analytics PDF (export menu → Download PDF): the selected period's report snapshot as a
 * branded A4 document (see resourceAnalyticsPdfLayout). Built in a dedicated worker per export
 * with the shared HarfBuzz shaping engine; the PDF code, WebAssembly and fonts load only for a
 * PDF, and only the fonts the report needs are downloaded.
 */
import { PUBLIC_BRAND_LOGO_ON_LIGHT_PATH } from '@meetezri/public-content';
import { runShapedPdfWorker, type ShapedPdfProgress, type ShapedPdfResult } from '@/lib/pdf/shaped/pdfWorkerClient';
import type { ResourceAnalyticsPdfSnapshot } from './resourceAnalyticsReport';

export interface ResourceAnalyticsPdfWorkerRequest {
  snapshot: ResourceAnalyticsPdfSnapshot;
  locale?: string;
  logoUrl: string;
}

export function createResourceAnalyticsPdf(
  snapshot: ResourceAnalyticsPdfSnapshot,
  options: { signal?: AbortSignal; onProgress?: (p: ShapedPdfProgress) => void; locale?: string } = {}
): Promise<ShapedPdfResult> {
  const request: ResourceAnalyticsPdfWorkerRequest = { snapshot, locale: options.locale, logoUrl: PUBLIC_BRAND_LOGO_ON_LIGHT_PATH };
  return runShapedPdfWorker(
    () => new Worker(new URL('./resourceAnalyticsPdf.worker.ts', import.meta.url), { type: 'module' }),
    request,
    options
  );
}
