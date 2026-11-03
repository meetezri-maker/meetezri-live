/**
 * Session Transcript PDF client: one worker per export, progress forwarding, error mapping, and
 * termination on completion, failure and cancellation. (The PDF itself is covered by
 * sessionTranscriptPdfLayout.test.ts with the real shaping engine.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSessionTranscriptPdf, transcriptPdfFileName, type TranscriptPdfWorkerResponse } from './sessionTranscriptPdf';
import { buildSessionTranscriptDocument, type TranscriptDocument } from './sessionTranscriptExport';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<TranscriptPdfWorkerResponse>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessageerror: ((e: Event) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor(readonly url: URL | string, readonly options?: WorkerOptions) { FakeWorker.instances.push(this); }
  postMessage(message: unknown) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  reply(data: TranscriptPdfWorkerResponse) { this.onmessage?.({ data } as MessageEvent<TranscriptPdfWorkerResponse>); }
}

const doc = (): TranscriptDocument => {
  const r = buildSessionTranscriptDocument({
    session: { id: 'abc-123', title: 'Evening check-in', started_at: new Date(2026, 9, 27, 21).toISOString(), ended_at: new Date(2026, 9, 27, 21, 20).toISOString(), config: null },
    messages: [{ role: 'user', content: 'আমি ভালো আছি', created_at: new Date(2026, 9, 27, 21, 1).toISOString() }],
    companionName: 'Maya', exportedAt: new Date(2026, 9, 28, 9, 30), timeZone: 'Asia/Dhaka',
  });
  if (r.kind !== 'ok') throw new Error('expected a document');
  return r.doc;
};
const worker = () => FakeWorker.instances[FakeWorker.instances.length - 1];

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

describe('createSessionTranscriptPdf (worker client)', () => {
  it('builds in a module worker, forwards font progress and terminates the worker when done', async () => {
    const onProgress = vi.fn();
    const t = doc();
    const pending = createSessionTranscriptPdf(t, { onProgress, locale: 'bn-BD' });
    const w = worker();
    expect(w.options).toEqual({ type: 'module' });
    expect(w.posted).toHaveLength(1);
    expect(w.posted[0]).toMatchObject({ doc: t, locale: 'bn-BD' });
    expect((w.posted[0] as { logoUrl: string }).logoUrl).toMatch(/\.png$/);
    w.reply({ type: 'progress', loaded: 1, total: 2 });
    expect(onProgress).toHaveBeenCalledWith({ fontsLoaded: 1, fontsTotal: 2 });
    const bytes = new TextEncoder().encode('%PDF-1.7');
    w.reply({ type: 'done', bytes, pages: 1, emojiReplacedCount: 0, fonts: ['NotoSans-Regular.ttf'] });
    await expect(pending).resolves.toEqual({ bytes, pages: 1, emojiReplacedCount: 0 });
    expect(w.terminated).toBe(true);
  });

  it('maps worker errors and always terminates the worker', async () => {
    const unsupported = createSessionTranscriptPdf(doc());
    worker().reply({ type: 'error', kind: 'unsupported', characters: ['ߒ'] });
    const e1 = await unsupported.catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(PdfUnsupportedTextError);
    expect(e1).toMatchObject({ reason: 'no-glyph', characters: ['ߒ'] });
    expect(worker().terminated).toBe(true);

    const fonts = createSessionTranscriptPdf(doc());
    worker().reply({ type: 'error', kind: 'fonts' });
    await expect(fonts).rejects.toMatchObject({ reason: 'font-unavailable' });
    expect(worker().terminated).toBe(true);

    const failed = createSessionTranscriptPdf(doc());
    worker().reply({ type: 'error', kind: 'failed' });
    await expect(failed).rejects.toThrow('The PDF could not be created.');
    expect(worker().terminated).toBe(true);

    // The worker script or its WebAssembly fails to load.
    const crashed = createSessionTranscriptPdf(doc());
    worker().onerror?.(new Event('error'));
    await expect(crashed).rejects.toThrow(/worker failed/);
    expect(worker().terminated).toBe(true);
  });

  it('terminates the worker immediately when cancelled, and ignores late messages', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const pending = createSessionTranscriptPdf(doc(), { signal: controller.signal, onProgress });
    const w = worker();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(w.terminated).toBe(true);
    w.reply({ type: 'progress', loaded: 1, total: 1 });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('does not start a worker for an already-cancelled export', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createSessionTranscriptPdf(doc(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('names the file with the TXT stem', () => {
    expect(transcriptPdfFileName(doc())).toBe('solace-session-abc-123-2026-10-27-transcript.pdf');
  });
});
