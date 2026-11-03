import { describe, it, expect, vi } from 'vitest';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';
import { runShapedPdfWorker, type ShapedPdfWorkerResponse } from './pdfWorkerClient';

class FakeWorker {
  onmessage: ((e: MessageEvent<ShapedPdfWorkerResponse>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessageerror: ((e: Event) => void) | null = null;
  posted: unknown[] = [];
  terminate = vi.fn();
  postMessage(m: unknown) { this.posted.push(m); }
  send(data: ShapedPdfWorkerResponse) { this.onmessage?.({ data } as MessageEvent<ShapedPdfWorkerResponse>); }
}
const start = (options: Parameters<typeof runShapedPdfWorker>[2] = {}) => {
  const w = new FakeWorker();
  const p = runShapedPdfWorker(() => w as unknown as Worker, { report: 1 }, options);
  return { w, p };
};

describe('runShapedPdfWorker', () => {
  it('posts the request, reports progress, resolves with the bytes and terminates the worker', async () => {
    const onProgress = vi.fn();
    const { w, p } = start({ onProgress });
    expect(w.posted).toEqual([{ report: 1 }]);
    w.send({ type: 'progress', loaded: 1, total: 2 });
    expect(onProgress).toHaveBeenCalledWith({ fontsLoaded: 1, fontsTotal: 2 });
    const bytes = new Uint8Array([37, 80]);
    w.send({ type: 'done', bytes, pages: 2, emojiReplacedCount: 1, fonts: [] });
    await expect(p).resolves.toEqual({ bytes, pages: 2, emojiReplacedCount: 1 });
    expect(w.terminate).toHaveBeenCalledTimes(1);
    w.send({ type: 'progress', loaded: 2, total: 2 }); // late: ignored
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('maps worker errors and terminates on each', async () => {
    const cases: Array<[ShapedPdfWorkerResponse, (e: unknown) => void]> = [
      [{ type: 'error', kind: 'unsupported', characters: ['ߒ'] }, (e) => { expect(e).toBeInstanceOf(PdfUnsupportedTextError); expect((e as PdfUnsupportedTextError).reason).toBe('no-glyph'); }],
      [{ type: 'error', kind: 'fonts' }, (e) => expect((e as PdfUnsupportedTextError).reason).toBe('font-unavailable')],
      [{ type: 'error', kind: 'failed' }, (e) => expect((e as Error).message).toBe('The PDF could not be created.')],
    ];
    for (const [message, check] of cases) {
      const { w, p } = start();
      w.send(message);
      check(await p.catch((e) => e));
      expect(w.terminate).toHaveBeenCalledTimes(1);
    }
    const { w, p } = start();
    w.onerror?.(new Event('error'));
    expect(String(await p.catch((e) => e))).toContain('failed to start or crashed');
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates at once on abort, ignores a late result, and never starts for an aborted signal', async () => {
    const c = new AbortController();
    const { w, p } = start({ signal: c.signal });
    c.abort();
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
    expect(w.terminate).toHaveBeenCalledTimes(1);
    w.send({ type: 'done', bytes: new Uint8Array(), pages: 1, emojiReplacedCount: 0, fonts: [] });

    const created = vi.fn();
    await expect(runShapedPdfWorker(created, {}, { signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(created).not.toHaveBeenCalled();
  });
});
