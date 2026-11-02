/**
 * Session Transcript PDF — real jsPDF and the bundled fonts. Text is read back from the content
 * streams (glyph IDs mapped through the embedded fonts), so assertions see exactly what is drawn.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';
import {
  RECORDED_TIMES_NOTE,
  SAVED_MESSAGES_NOTE,
  buildSessionTranscriptDocument,
  buildSessionTranscriptText,
  type TranscriptDocument,
  type TranscriptExportInput,
} from './sessionTranscriptExport';
import { buildSessionTranscriptPdf, transcriptNeedsArabicFont, transcriptPdfFileName } from './sessionTranscriptPdf';
import { PDF_ARABIC_FONT_FAMILY, PDF_FONT_FAMILY, PdfUnsupportedTextError, type PdfFontFiles } from '@/lib/pdf/pdfText';

const FONT_DIR = path.resolve(process.cwd(), 'public/fonts/pdf');
const readFont = (f: string) => fs.readFileSync(path.join(FONT_DIR, f)).toString('base64');
let fonts: PdfFontFiles;
let logo: { dataUrl: string; width: number; height: number };
beforeAll(() => {
  fonts = {
    latin: { regular: readFont('DejaVuSans.ttf'), bold: readFont('DejaVuSans-Bold.ttf') },
    arabic: { regular: readFont('Amiri-Regular.ttf'), bold: readFont('Amiri-Bold.ttf') },
  };
  const png = fs.readFileSync(path.resolve(process.cwd(), 'public/logos/logo white.png'));
  logo = { dataUrl: `data:image/png;base64,${png.toString('base64')}`, width: 9 * (png.readUInt32BE(16) / png.readUInt32BE(20)), height: 9 };
});

const URDU = 'آج میں نے بہت سکون محسوس کیا';
const at = (d: number, h: number, m = 0, s = 0) => new Date(2026, 9, d, h, m, s).toISOString();
const input = (over: Partial<TranscriptExportInput> = {}): TranscriptExportInput => ({
  session: {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    title: 'Evening check-in',
    started_at: at(27, 21, 0, 0),
    ended_at: at(27, 21, 25, 30),
    config: { summary: 'You talked about sleep and work stress.', summary_source: 'ai' },
  },
  messages: [
    { role: 'system', content: 'You are Solace. INTERNAL PROMPT', created_at: at(27, 21, 0, 0) },
    { role: 'user', content: 'Hello', created_at: at(27, 21, 0, 5) },
    { role: 'assistant', content: "Hi, I'm here.\n\nTake your time.", created_at: at(27, 21, 0, 9) },
    { role: 'tool', content: '{"secret":"x"}', created_at: at(27, 21, 0, 10) },
    { role: 'user', content: 'Work has been heavy this week.', created_at: null },
  ],
  companionName: 'Maya',
  exportedAt: new Date(2026, 9, 28, 9, 30),
  timeZone: 'Asia/Karachi',
  ...over,
});

const docOf = (i: TranscriptExportInput): TranscriptDocument => {
  const r = buildSessionTranscriptDocument(i);
  if (r.kind !== 'ok') throw new Error('expected ok');
  return r.doc;
};

type Internal = { pages: string[][]; getFont(): { id: string; metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } } };
const rev = (s: string) => Array.from(s).reverse().join('');
function drawn(doc: jsPDF) {
  const internal = doc.internal as unknown as Internal;
  const byFont = new Map<string, Map<number, string>>();
  const families = Object.keys(doc.getFontList()).filter((f) => f === PDF_FONT_FAMILY || f === PDF_ARABIC_FONT_FAMILY);
  for (const [family, style] of families.flatMap((f) => (['normal', 'bold'] as const).map((s) => [f, s] as const))) {
    doc.setFont(family, style);
    const font = internal.getFont();
    const map = new Map<number, string>();
    for (const [cp, gid] of Object.entries(font.metadata.cmap.unicode.codeMap)) {
      const c = Number(cp);
      if (!map.has(gid) || c < 0xfb50) map.set(gid, String.fromCodePoint(c));
    }
    byFont.set(font.id, map);
  }
  return internal.pages.slice(1).map((ops) => {
    const body = ops.join('\n');
    const lines: Array<{ text: string; x: number; y: number }> = [];
    const re = /\/(F\d+)\s+[\d.]+\s+Tf[\s\S]*?([\d.-]+)\s+([\d.-]+)\s+Td\s*<([0-9A-Fa-f]+)>\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const map = byFont.get(m[1]);
      let s = '';
      for (let i = 0; i < m[4].length; i += 4) {
        const ch = map?.get(parseInt(m[4].slice(i, i + 4), 16)) ?? '�';
        s += /[ﻵ-ﻼ]/.test(ch) ? rev(ch.normalize('NFKC')) : ch;
      }
      lines.push({ text: s.normalize('NFKC').replace(/ /g, ' '), x: Number(m[2]) * 0.3528, y: (841.89 - Number(m[3])) * 0.3528 });
    }
    return { lines, text: lines.map((l) => l.text) };
  });
}

async function build(t: TranscriptDocument, f: PdfFontFiles = fonts, withLogo = true) {
  const built = await buildSessionTranscriptPdf(t, { fonts: f, logo: withLogo ? logo : null });
  return { ...built, pages: drawn(built.doc) };
}

/** Body lines only (no header/footer), across all pages. */
const bodyLines = (pages: ReturnType<typeof drawn>) =>
  pages.flatMap((p, i) => p.lines.filter((l) => l.y > (i ? 20 : 0) && l.y < 278).map((l) => l.text));

describe('Session Transcript PDF', () => {
  it('draws the title block, saved summary, notes and every message with speaker and recorded time', async () => {
    const t = docOf(input());
    const { pages } = await build(t);
    const all = pages.flatMap((p) => p.text);
    const joined = all.join(' ');
    expect(all[0]).toBe('Session Transcript');
    for (const line of [
      'Session: Evening check-in',
      'Session ID: a1b2c3d4-0000-4000-8000-000000000001',
      'Companion: Maya',
      'Started: 27 Oct 2026, 21:00',
      'Duration: 25 min 30 s',
      'Exported: 28 Oct 2026, 09:30 (Asia/Karachi)',
      'Saved Summary (AI-generated)',
      'You talked about sleep and work stress.',
      'Conversation',
      'You  ·  21:00:05',
      'Hello',
      'Solace  ·  21:00:09',
      "Hi, I'm here.",
      'Take your time.',
      'You  ·  Time not recorded',
      'Work has been heavy this week.',
    ]) expect(all).toContain(line);
    expect(joined).toContain('Dates and times are in Asia/Karachi.');
    expect(joined.replace(/\s+/g, ' ')).toContain(`${SAVED_MESSAGES_NOTE} ${RECORDED_TIMES_NOTE}`);
    expect(joined).not.toMatch(/INTERNAL PROMPT|secret/);
    expect(pages[0].text).toContain('Solace · Personal & confidential');
    expect(pages[0].text).toContain('Page 1 of 1');
  });

  it('matches the TXT message for message, in order', async () => {
    const i = input({
      messages: Array.from({ length: 30 }, (_, n) => ({
        role: n % 2 ? 'assistant' : 'user',
        content: n === 7 ? 'line one\nline two' : `Message number ${n + 1}.`,
        created_at: n === 4 ? 'garbage' : at(27, 21, Math.floor(n / 6), (n * 7) % 60),
      })),
    });
    const t = docOf(i);
    const txt = buildSessionTranscriptText(i);
    if (txt.kind !== 'ok') throw new Error('expected ok');
    const body = bodyLines((await build(t)).pages);
    const heads = body.filter((l) => /^(You|Solace) {2}· {2}/.test(l));
    const txtHeads = [...txt.text.matchAll(/^\[(.+)\] (You|Solace):$/gm)].map((m) => `${m[2]}  ·  ${m[1]}`);
    expect(heads).toEqual(txtHeads);
    expect(heads).toHaveLength(30);
    let from = 0;
    for (const m of t.messages) {
      for (const line of m.content.split('\n')) {
        const idx = body.indexOf(line, from);
        expect(idx).toBeGreaterThan(-1);
        from = idx;
      }
    }
  });

  it('labels summary provenance and missing or zero durations', async () => {
    const base = input().session;
    const heuristic = await build(docOf(input({ session: { ...base, config: { summary: 'Saved text', summary_source: 'heuristic' } } })));
    expect(heuristic.pages[0].text).toContain('Saved Summary (automatically generated)');
    const none = await build(docOf(input({ session: { ...base, config: null, ended_at: null } })));
    expect(none.pages[0].text).toContain('No saved summary available.');
    expect(none.pages[0].text).toContain('Duration: Not recorded');
    const zero = await build(docOf(input({ session: { ...base, ended_at: base.started_at } })));
    expect(zero.pages[0].text).toContain('Duration: 0 s');
    const noStart = await build(docOf(input({ session: { ...base, started_at: null } })));
    expect(noStart.pages[0].text).toContain('Started: Not recorded');
  });

  it('flows long and oversized messages across pages with a running header, continuation labels and no truncation', async () => {
    const huge = Array.from({ length: 140 }, (_, n) => `Paragraph ${n + 1} of a very long reply that keeps going.`).join('\n');
    const unbroken = 'z'.repeat(600);
    const messages = [
      { role: 'user', content: 'Short opener', created_at: at(27, 21, 1) },
      { role: 'assistant', content: huge, created_at: at(27, 21, 2) },
      { role: 'user', content: unbroken, created_at: at(27, 21, 3) },
      ...Array.from({ length: 40 }, (_, n) => ({ role: n % 2 ? 'assistant' : 'user', content: `Follow-up ${n + 1}`, created_at: at(27, 21, 4, n) })),
    ];
    const { pages } = await build(docOf(input({ messages })));
    expect(pages.length).toBeGreaterThan(3);
    pages.forEach((p, i) => {
      expect(p.text).toContain('Solace · Personal & confidential');
      expect(p.text).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(p.text.includes('Session Transcript  ·  27 Oct 2026')).toBe(i > 0);
      for (const l of p.lines) {
        if (!/^Page |^Solace · /.test(l.text)) expect(l.y).toBeLessThan(275);
        expect(l.x).toBeGreaterThanOrEqual(17.9);
      }
      // A speaker heading is never the last body line on a page.
      const body = p.lines.filter((l) => l.y > (i ? 20 : 0) && l.y < 275).map((l) => l.text);
      expect(/^(You|Solace) {2}· {2}/.test(body[body.length - 1] ?? '')).toBe(false);
    });
    const all = bodyLines(pages);
    for (let n = 1; n <= 140; n++) expect(all.join('\n')).toContain(`Paragraph ${n} of a very long reply`);
    expect(all.filter((l) => l === 'Solace  ·  21:02:00 (continued)').length).toBeGreaterThan(0);
    expect(all.filter((l) => /^z+$/.test(l)).join('')).toBe(unbroken);
    for (let n = 1; n <= 40; n++) expect(all).toContain(`Follow-up ${n}`);
  });

  it('keeps the first message heading with its first lines', async () => {
    // Enough short messages to push one heading to the very bottom of a page at some point.
    for (const fill of [20, 21, 22, 23, 24, 25]) {
      const messages = Array.from({ length: fill }, (_, n) => ({ role: 'user', content: `m${n}`, created_at: at(27, 21, 0, n) }));
      messages.push({ role: 'assistant', content: Array.from({ length: 12 }, (_, n) => `tail line ${n}`).join('\n'), created_at: at(27, 21, 5) });
      const { pages } = await build(docOf(input({ messages })));
      pages.forEach((p, i) => {
        const body = p.lines.filter((l) => l.y > (i ? 20 : 0) && l.y < 275).map((l) => l.text);
        expect(/^(You|Solace) {2}· {2}/.test(body[body.length - 1] ?? '')).toBe(false);
      });
    }
  });

  it('draws Urdu and mixed text, and marks emoji with a note', async () => {
    const t = docOf(input({
      messages: [
        { role: 'user', content: URDU, created_at: at(27, 21, 1) },
        { role: 'assistant', content: `Thank you 😊 — ${URDU}`, created_at: at(27, 21, 2) },
      ],
    }));
    expect(transcriptNeedsArabicFont(t)).toBe(true);
    const r = await build(t);
    const all = r.pages.flatMap((p) => p.text);
    expect(all.some((l) => l.includes(rev('سکون')))).toBe(true);
    expect(all.some((l) => l.includes('Thank you [emoji]'))).toBe(true);
    expect(r.emojiReplacedCount).toBe(1);
    expect(all.join(' ')).toContain('each appears as [emoji]');
    expect(transcriptNeedsArabicFont(docOf(input()))).toBe(false);
  });

  it('stops instead of dropping characters, and handles font and logo failures', async () => {
    const cjk = await build(docOf(input({ messages: [{ role: 'user', content: '我很好', created_at: null }] }))).catch((e: unknown) => e);
    expect(cjk).toBeInstanceOf(PdfUnsupportedTextError);
    expect((cjk as PdfUnsupportedTextError).reason).toBe('no-glyph');
    const urdu = docOf(input({ messages: [{ role: 'user', content: URDU, created_at: null }] }));
    const noUrdu = await build(urdu, { latin: fonts.latin, arabic: null }).catch((e: unknown) => e);
    expect((noUrdu as PdfUnsupportedTextError).reason).toBe('font-unavailable');
    const english = await buildSessionTranscriptPdf(docOf(input()), { fonts: { latin: null, arabic: null }, logo: null });
    expect(english.usedUnicodeFont).toBe(false);
    expect(english.doc.output()).toContain('Work has been heavy this week.');
    const noLogo = await build(docOf(input()), fonts, false);
    expect(noLogo.pages[0].text[0]).toBe('Solace');
  });

  it('names the file with the TXT stem', () => {
    const t = docOf(input({ session: { ...input().session, id: '../../etc/passwd?x' } }));
    expect(transcriptPdfFileName(t)).toBe('solace-session-etcpasswdx-2026-10-27-transcript.pdf');
  });
});
