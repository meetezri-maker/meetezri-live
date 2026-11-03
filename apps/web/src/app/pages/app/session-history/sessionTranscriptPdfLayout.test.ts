/**
 * Session Transcript PDF with the real shaping engine (HarfBuzz WebAssembly, bundled Noto fonts).
 * The PDF is read back from its content streams: each line's /ActualText (the text as stored) and
 * the glyphs drawn for it (positions, fonts).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { readShapedPdf } from '@/lib/pdf/shaped/readShapedPdf.testing';
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError, type FontManifest, type ShapingAssets, type ShapingRuntime } from '@/lib/pdf/shaped/shapedPdf';
import { buildSessionTranscriptDocument, buildSessionTranscriptText, type TranscriptExportInput } from './sessionTranscriptExport';
import { buildShapedTranscriptPdf } from './sessionTranscriptPdfLayout';

const WEB = process.cwd();
const FONT_DIR = path.join(WEB, 'public/fonts/pdf/noto/v1');
const read = (p: string) => new Uint8Array(fs.readFileSync(p));
function assets(overrides: Partial<ShapingAssets> = {}) {
  const fontCalls: string[] = [];
  const a: ShapingAssets = {
    hbWasm: async () => read(path.join(WEB, 'node_modules/harfbuzzjs/hb.wasm')),
    subsetWasm: async () => read(path.join(WEB, 'node_modules/harfbuzzjs/hb-subset.wasm')),
    manifest: async () => JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'manifest.json'), 'utf8')) as FontManifest,
    font: async (file) => { fontCalls.push(file); return read(path.join(FONT_DIR, file)); },
    ...overrides,
  };
  return { assets: a, fontCalls };
}

let runtime: ShapingRuntime;
let fontCalls: string[];
beforeAll(async () => {
  const a = assets();
  fontCalls = a.fontCalls;
  runtime = await createShapingRuntime(a.assets);
});

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const input = (contents: string[], over: Partial<TranscriptExportInput> = {}): TranscriptExportInput => ({
  session: { id: 'a1b2c3d4-0000-4000-8000-000000000001', title: 'Evening check-in', started_at: at(27, 21), ended_at: at(27, 21, 25), config: { summary: 'You talked about sleep.', summary_source: 'ai' } },
  messages: [
    { role: 'system', content: 'INTERNAL PROMPT', created_at: at(27, 21) },
    ...contents.map((content, i) => ({ role: i % 2 ? 'assistant' : 'user', content, created_at: at(27, 21, i + 1) })),
  ],
  companionName: 'Maya',
  exportedAt: new Date(2026, 9, 28, 9, 30),
  timeZone: 'Asia/Dhaka',
  ...over,
});
const docOf = (i: TranscriptExportInput) => {
  const r = buildSessionTranscriptDocument(i);
  if (r.kind !== 'ok') throw new Error('expected a document');
  return r.doc;
};

const readPdf = readShapedPdf;

describe('Session Transcript PDF (shaped, real engine)', () => {
  it('draws the confirmed failing Bengali characters with shaping (conjuncts, pre-base vowels)', async () => {
    const exact = 'ছ ড প য হ — পা পে প্য হ্য ডা ছে যে প্প';
    const t = docOf(input([exact, 'পে ক্ষ', 'আমি আজ ভালো আছি। ডাক্তার বলেছেন যে ছোট হাঁটা সাহায্য করে — সপ্তাহে ৩ বার (৫০%)।']));
    const r = await buildShapedTranscriptPdf(t, runtime, { locale: 'bn-BD' });
    const [page] = await readPdf(r.bytes);
    expect(page.text).toContain(exact);
    const span = page.spans.find((s) => s.text === 'পে ক্ষ')!;
    // 6 characters → 4 glyphs (প, the ে sign, space, the ক্ষ conjunct).
    expect(span.glyphs.length).toBeLessThan('পে ক্ষ'.length);
    // Written in logical order (প first) but the ে sign is drawn to its left.
    expect(span.glyphs[1].x).toBeLessThan(span.glyphs[0].x);
    expect(span.glyphs.every((g) => g.font.includes('NotoSansBengali') || g.font.includes('NotoSans'))).toBe(true);
  });

  it('keeps branding, metadata, notes and every message word for word, in order', async () => {
    const i = input(['Hello', "Hi, I'm here.\n\nTake your time.", 'Work has been heavy — کام بہت زیادہ تھا، 75% کم نیند۔']);
    const t = docOf(i);
    const r = await buildShapedTranscriptPdf(t, runtime, { logoPng: read(path.join(WEB, 'public/logos/logo white.png')) });
    const pages = await readPdf(r.bytes);
    const all = pages.flatMap((p) => p.text);
    for (const line of ['Session Transcript', 'Session: Evening check-in', 'Session ID: a1b2c3d4-0000-4000-8000-000000000001', 'Duration: 25 min', 'Saved Summary (AI-generated)',
      'You talked about sleep.', 'Conversation', 'Solace · Personal & confidential', `Page 1 of ${pages.length}`]) expect(all).toContain(line);
    expect(all.join(' ')).toMatch(/Started: 27 Oct 2026, 21:00/);
    expect(all.join(' ')).toContain('Dates and times are in Asia/Dhaka.');
    expect(all.join(' ').replace(/\s+/g, ' ')).toContain('This export contains the messages saved for this session.');
    expect(all.join(' ')).not.toContain('INTERNAL PROMPT');
    // Parity with the TXT: every message heading and line, in order.
    const txt = buildSessionTranscriptText(i);
    if (txt.kind !== 'ok') throw new Error('expected text');
    const heads = all.filter((l) => /^(You|Solace) {2}· {2}/.test(l));
    expect(heads).toEqual([...txt.text.matchAll(/^\[(.+)\] (You|Solace):$/gm)].map((m) => `${m[2]}  ·  ${m[1]}`));
    let from = 0;
    for (const m of t.messages) for (const line of m.content.split('\n').filter(Boolean)) {
      const idx = all.findIndex((l, k) => k >= from && l === line);
      expect(idx).toBeGreaterThanOrEqual(from);
      from = idx;
    }
    // Metadata.
    const meta = await PDFDocument.load(r.bytes);
    expect(meta.getTitle()).toBe('Session Transcript');
    expect(meta.getCreator()).toBe('Solace');
  });

  it('keeps direction isolates in the text and replaces emoji with [emoji] and a note', async () => {
    const isolated = 'User ⁧علی⁩ 2 sessions, app ⁨Solace 2.0!⁩ جديد';
    const t = docOf(input([isolated, 'Feeling better 😊 👍🏽 🇵🇰 today']));
    const r = await buildShapedTranscriptPdf(t, runtime);
    const all = (await readPdf(r.bytes)).flatMap((p) => p.text);
    expect(all).toContain(isolated); // stored text, isolates included
    expect(all).toContain('Feeling better [emoji] [emoji] [emoji] today');
    expect(r.emojiReplacedCount).toBe(3);
    expect(all.join(' ')).toContain("Emoji can't be shown in this PDF; each appears as [emoji].");
  });

  it('chooses CJK fonts per run (never from kana elsewhere), using the reader locale only as a tie-breaker', async () => {
    const zh = '今天我感觉好多了，谢谢你的倾听。';
    const ja = '今日は気分がとてもいいです。';
    const kanjiOnly = '本日東京散歩大変満足。';
    const ko = '오늘은 기분이 좋아요.';
    const traditional = '今日我覺得好好多，多謝你聽我講。';
    const t = docOf(input([zh, ja, kanjiOnly, ko, traditional]));
    const fontOf = async (locale: string) => {
      const pages = await readPdf((await buildShapedTranscriptPdf(t, runtime, { locale })).bytes);
      const spans = pages.flatMap((p) => p.spans);
      return (text: string) => [...new Set(spans.find((s) => s.text === text)!.glyphs.map((g) => g.font.replace(/^[A-Z]{6}\+/, '')))];
    };
    const en = await fontOf('en-US');
    expect(en(ja)).toEqual(['NotoSansJP-Regular']); // kana in this line
    expect(en(zh)).toEqual(['NotoSansSC-Regular']); // not influenced by the Japanese line
    expect(en(kanjiOnly)).toEqual(['NotoSansSC-Regular']); // ambiguous: Simplified Chinese forms
    expect(en(ko)).toEqual(['NotoSansKR-Regular']);
    expect(en(traditional)).toEqual(['NotoSansSC-Regular']); // Traditional text, non-Chinese locale: SC forms
    const hk = await fontOf('zh-HK');
    expect(hk(traditional)).toEqual(['NotoSansTC-Regular']);
    // Simplified-only characters (谢 觉 听) are not in the Traditional font: they fall back to SC, nothing is dropped.
    expect(hk(zh).sort()).toEqual(['NotoSansSC-Regular', 'NotoSansTC-Regular']);
    expect(hk(ja)).toEqual(['NotoSansJP-Regular']);
    const jp = await fontOf('ja-JP');
    expect(jp(kanjiOnly)).toEqual(['NotoSansJP-Regular']);
  });

  it('downloads only the fonts a transcript needs', async () => {
    const a = assets();
    const rt = await createShapingRuntime(a.assets);
    await buildShapedTranscriptPdf(docOf(input(['আমি ভালো আছি', 'Fine, thanks.'])), rt);
    expect(a.fontCalls.sort()).toEqual(['NotoSans-Bold.ttf', 'NotoSans-Regular.ttf', 'NotoSansBengali-Regular.ttf']);
  });

  it('rejects text no bundled font can draw before downloading any font', async () => {
    const a = assets();
    const rt = await createShapingRuntime(a.assets);
    const err = await buildShapedTranscriptPdf(docOf(input(['Hello ߒߞߏ ᏣᎳᎩ'])), rt).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedCharactersError);
    expect((err as UnsupportedCharactersError).characters).toEqual(expect.arrayContaining(['ߒ', 'Ꮳ']));
    expect(a.fontCalls).toEqual([]);
  });

  it('reports a font download failure as FontLoadError', async () => {
    const a = assets({ font: vi.fn(async () => { throw new Error('HTTP 503'); }) });
    const rt = await createShapingRuntime(a.assets);
    await expect(buildShapedTranscriptPdf(docOf(input(['আমি ভালো আছি'])), rt)).rejects.toBeInstanceOf(FontLoadError);
  });

  it('flows long multilingual messages across pages with the running header and continuation labels', async () => {
    const long = Array.from({ length: 60 }, (_, n) => `অনুচ্ছেদ ${n + 1}: আমরা ঘুম এবং কাজের চাপ নিয়ে অনেক কথা বলেছি — paragraph ${n + 1} — ہم نے بات کی۔`).join('\n');
    const t = docOf(input(['Start', long, 'End']));
    const r = await buildShapedTranscriptPdf(t, runtime);
    const pages = await readPdf(r.bytes);
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      expect(p.text).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(p.text.includes('Session Transcript  ·  27 Oct 2026')).toBe(i > 0);
    });
    const all = pages.flatMap((p) => p.text);
    expect(all.some((l) => /^Solace {2}· {2}.+ \(continued\)$/.test(l))).toBe(true);
    // Wrapped lines carry their own ActualText (with the trailing space), so joining them restores each paragraph.
    const joined = all.join('');
    for (const line of long.split('\n')) expect(joined).toContain(line);
    expect(all).toContain('End');
    fontCalls.length = 0;
  });
});

// noto/v1 is served with immutable caching (vercel.json): browsers may keep its files for a year,
// so they must never change in place. New or updated fonts go in a new version folder.
describe('Session Transcript PDF font assets', () => {
  const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(FONT_DIR, file))).digest('hex');

  it('keeps the published v1 folder unchanged', () => {
    expect(sha256('manifest.json')).toBe('1ead90fb7d8f58e6fb7ce3b6c3546440a0124cc7478d42a63a73304359a8d557');
    type PublishedManifest = { version: string; faces: Record<string, { file: string; sha256: string; licence: string }> };
    const manifest = JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'manifest.json'), 'utf8')) as PublishedManifest;
    expect(manifest.version).toBe('v1');
    for (const face of Object.values(manifest.faces)) {
      expect(sha256(face.file), face.file).toBe(face.sha256);
      expect(fs.existsSync(path.join(FONT_DIR, face.licence)), face.licence).toBe(true);
    }
  });

  it('loads fonts from the folder of the manifest version', () => {
    const workerAssets = fs.readFileSync(path.join(WEB, 'src/lib/pdf/shaped/workerAssets.ts'), 'utf8');
    expect(workerAssets).toContain('fonts/pdf/noto/v1`');
    const vercel = JSON.parse(fs.readFileSync(path.join(WEB, 'vercel.json'), 'utf8')) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    expect(vercel.headers.find((h) => h.source === '/fonts/pdf/noto/v1/(.*)')?.headers).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ]);
  });
});
