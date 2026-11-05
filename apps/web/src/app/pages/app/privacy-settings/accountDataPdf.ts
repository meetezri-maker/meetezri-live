/**
 * Account Data Report PDF (Privacy Settings → Export data → Download PDF). Built in a dedicated
 * worker per export with the shared HarfBuzz shaping engine; the PDF code, WebAssembly and fonts
 * load only for a PDF, and only the fonts the report needs are downloaded.
 */
import { PUBLIC_BRAND_LOGO_ON_LIGHT_PATH } from '@meetezri/public-content';
import { runShapedPdfWorker, type ShapedPdfProgress, type ShapedPdfResult } from '@/lib/pdf/shaped/pdfWorkerClient';
import type { AccountDataPdfSnapshot } from './accountDataPdfSnapshot';

export interface AccountDataPdfWorkerRequest {
  snapshot: AccountDataPdfSnapshot;
  locale?: string;
  logoUrl: string;
}

export function createAccountDataPdf(
  snapshot: AccountDataPdfSnapshot,
  options: { signal?: AbortSignal; onProgress?: (p: ShapedPdfProgress) => void; locale?: string } = {}
): Promise<ShapedPdfResult> {
  const request: AccountDataPdfWorkerRequest = { snapshot, locale: options.locale, logoUrl: PUBLIC_BRAND_LOGO_ON_LIGHT_PATH };
  return runShapedPdfWorker(
    () => new Worker(new URL('./accountDataPdf.worker.ts', import.meta.url), { type: 'module' }),
    request,
    options
  );
}
