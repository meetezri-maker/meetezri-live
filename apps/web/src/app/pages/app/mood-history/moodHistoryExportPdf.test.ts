/**
 * Mood History PDF — real jsPDF and the bundled fonts. Text is read back from the content streams
 * (glyph IDs mapped through the embedded fonts), so assertions see exactly what is drawn.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';
import { buildMoodHistoryReport, type MoodHistoryExportEntry, type MoodHistoryExportInput, type MoodHistoryReport } from './moodHistoryReport';
import { buildMoodHistoryPdf, moodHistoryPdfFileName, moodReportNeedsArabicFont } from './moodHistoryExportPdf';
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

const URDU = 'آج میں نے بہت سکون محسوس کیا۔';
const local = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m);
const WEEK = { label: 'Week (Mon–Sun)', start: new Date(2026, 9, 26), end: new Date(2026, 10, 1, 23, 59, 59, 999) };
const entry = (id: string, d: number, h: number, over: Partial<MoodHistoryExportEntry> = {}): MoodHistoryExportEntry => ({
  id, created_at: local(d, h).toISOString(), mood: 'calm', intensity: 6, source: 'check-in', ...over,
});
function report(over: Partial<MoodHistoryExportInput> = {}): MoodHistoryReport {
  const r = buildMoodHistoryReport({
    entries: [], period: WEEK, sources: { checkIns: 'ok', journals: 'ok' },
    moodLabel: (m) => ({ calm: 'Calm', happy: 'Happy', anxious: 'Anxious' })[m] ?? null,
    timeZone: 'Asia/Karachi', generatedAt: local(28, 15), ...over,
  });
  if (r.kind !== 'ok') throw new Error(r.kind);
  return r.report;
}

type Internal = { pages: string[][]; getFont(): { id: string; metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } } };
const rev = (s: string) => Array.from(s).reverse().join('');
/** Left-to-right drawing order of a right-to-left line (digit runs kept, brackets mirrored). */
const rtlVisual = (s: string) =>
  rev(s).replace(/[0-9]+/g, (d) => rev(d)).replace(/[()[\]]/g, (c) => ({ '(': ')', ')': '(', '[': ']', ']': '[' })[c]!);

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
    const lines: Array<{ text: string; y: number }> = [];
    const re = /\/(F\d+)\s+[\d.]+\s+Tf[\s\S]*?([\d.-]+)\s+([\d.-]+)\s+Td\s*<([0-9A-Fa-f]+)>\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const map = byFont.get(m[1]);
      let s = '';
      for (let i = 0; i < m[4].length; i += 4) {
        const ch = map?.get(parseInt(m[4].slice(i, i + 4), 16)) ?? '�';
        s += /[ﻵ-ﻼ]/.test(ch) ? rev(ch.normalize('NFKC')) : ch;
      }
      lines.push({ text: s.normalize('NFKC').replace(/ /g, ' '), y: (841.89 - Number(m[3])) * 0.3528 });
    }
    const images = [...body.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/g)].map((x) => ({ w: +x[1] * 0.3528, h: +x[2] * 0.3528 }));
    return { lines, text: lines.map((l) => l.text), images };
  });
}

async function build(r: MoodHistoryReport, f: PdfFontFiles = fonts, withLogo = true) {
  const built = await buildMoodHistoryPdf(r, { fonts: f, logo: withLogo ? logo : null });
  return { ...built, pages: drawn(built.doc) };
}

describe('Mood History PDF', () => {
  it('has the branded title block, period, generated time and the footer on every page', async () => {
    const many = Array.from({ length: 40 }, (_, i) => entry(`m${i}`, 26 + (i % 7), 6 + (i % 14), { notes: `Note ${i}: ${'a calm and steady day '.repeat(4)}` }));
    const { pages } = await build(report({ entries: many }));
    const first = pages[0].text;
    expect(first).toContain('Mood History Report');
    expect(first).toContain('Reporting period: Week (Mon–Sun): 26 Oct 2026 – 1 Nov 2026 (inclusive)');
    expect(first).toContain('Generated: 28 Oct 2026, 15:00 (Asia/Karachi)');
    expect(first).toContain('Includes: Mood check-ins and journal entries that have a mood tag');
    expect(first).toContain('Entries: 40');
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p.text).toContain('Solace · Personal & confidential');
      expect(p.text).toContain(`Page ${i + 1} of ${pages.length}`);
      // Running header only from page 2.
      expect(p.text.includes('Mood History Report  ·  Week (Mon–Sun): 26 Oct 2026 – 1 Nov 2026 (inclusive)')).toBe(i > 0);
      // Nothing is drawn into the footer area or off the page.
      for (const l of p.lines) if (!/^Page |^Solace · /.test(l.text)) expect(l.y).toBeLessThan(275);
    });
    // The logo keeps its aspect ratio: about 22.4 × 9 mm, on page 1 only.
    expect(pages[0].images).toHaveLength(1);
    expect(pages[0].images[0].h).toBeCloseTo(9, 1);
    expect(pages[0].images[0].w).toBeCloseTo(22.36, 1);
    expect(pages.slice(1).every((p) => p.images.length === 0)).toBe(true);
  });

  it('shows every entry and value the CSV has, with intensity only where recorded (including 0)', async () => {
    const r = report({
      entries: [
        entry('c0', 27, 9, { intensity: 0, activities: ['walk', 'family, friends'], notes: '=SUM(A1) "quoted"' }),
        entry('j1', 28, 8, { source: 'journal', mood: 'happy', intensity: 9, notes: '<p>Good &amp; calm.</p><ul><li>Walked</li></ul>' }),
        entry('c1', 29, 21, { mood: '😊', intensity: 7 }),
      ],
    });
    const all = (await build(r)).pages.flatMap((p) => p.text);
    expect(all).toContain('27 Oct 2026, 09:00 · Mood check-in');
    expect(all).toContain('Mood: Calm  ·  Intensity: 0');
    expect(all).toContain('Activities: walk, family, friends');
    expect(all).toContain('=SUM(A1) "quoted"'); // no spreadsheet escaping in the PDF
    expect(all).toContain('28 Oct 2026, 08:00 · Journal entry');
    expect(all).toContain('Mood: Happy'); // journal rows have no intensity
    expect(all).toContain('Good & calm.');
    expect(all).toContain('- Walked');
    expect(all).toContain('Mood: [emoji]  ·  Intensity: 7'); // unlabelled stored value, emoji marked
    expect(all.some((l) => l.includes("Journal entries don't record an intensity"))).toBe(true);
    expect(all.some((l) => l.includes('each appears as [emoji]'))).toBe(true);
  });

  it('marks a partial report prominently, and says so when the partial period is empty', async () => {
    const partial = await build(report({ entries: [entry('c', 27, 9)], sources: { checkIns: 'ok', journals: 'failed' } }));
    expect(partial.pages[0].text.some((l) => l.startsWith('Partial: journal entries could not be loaded'))).toBe(true);
    const empty = await build(report({ entries: [], sources: { checkIns: 'ok', journals: 'failed' } }));
    expect(empty.pages[0].text).toContain('No mood entries in this period.');
    expect(empty.pages[0].text).toContain('Entries: 0');
  });

  it('splits long notes across pages without losing text, with a continuation label', async () => {
    const paras = Array.from({ length: 70 }, (_, i) => `Paragraph ${i + 1}: ${'small steady steps every day '.repeat(5)}end.`).join('\n');
    const unbroken = 'x'.repeat(300);
    const { pages } = await build(report({ entries: [entry('long', 27, 9, { notes: `${paras}\n${unbroken}` })] }));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const all = pages.flatMap((p) => p.text);
    expect(all.filter((l) => /^Paragraph \d+:/.test(l)).map((l) => Number(/^Paragraph (\d+):/.exec(l)![1]))).toEqual(
      Array.from({ length: 70 }, (_, i) => i + 1)
    );
    expect(all.filter((l) => /^x+$/.test(l)).join('')).toBe(unbroken);
    for (const p of pages.slice(1)) expect(p.text).toContain('27 Oct 2026, 09:00 · Mood check-in (continued)');
  });

  it('draws Urdu and mixed text in the right order', async () => {
    const mixed = 'آج Calm رہا، 3 بار walk کی۔';
    const r = report({ entries: [entry('u', 27, 9, { notes: `${URDU}\n${mixed}`, activities: ['سیر'] })] });
    expect(moodReportNeedsArabicFont(r)).toBe(true);
    const all = (await build(r)).pages.flatMap((p) => p.text);
    expect(all).toContain(rtlVisual(URDU));
    expect(all).toContain(`۔${rev('کی')} walk ${rev('بار')} 3 ،${rev('رہا')} Calm ${rev('آج')}`);
    expect(all).toContain(`Activities: ${rev('سیر')}`);
  });

  it('stops instead of dropping characters, and needs the Urdu font only for Urdu', async () => {
    const cjk = await build(report({ entries: [entry('c', 27, 9, { notes: 'Learning 你好' })] })).catch((e: unknown) => e);
    expect(cjk).toBeInstanceOf(PdfUnsupportedTextError);
    const urdu = report({ entries: [entry('u', 27, 9, { notes: URDU })] });
    const noUrduFont = await build(urdu, { latin: fonts.latin, arabic: null }).catch((e: unknown) => e);
    expect((noUrduFont as PdfUnsupportedTextError).reason).toBe('font-unavailable');
    // English with no fonts at all: Helvetica, still complete.
    const english = await buildMoodHistoryPdf(report({ entries: [entry('c', 27, 9, { notes: 'A quiet day' })] }), { fonts: { latin: null, arabic: null }, logo: null });
    expect(english.usedUnicodeFont).toBe(false);
    expect(english.doc.output()).toContain('A quiet day');
  });

  it('uses the Solace name when the logo is unavailable', async () => {
    const { pages } = await build(report({ entries: [entry('c', 27, 9)] }), fonts, false);
    expect(pages[0].images).toHaveLength(0);
    expect(pages[0].text[0]).toBe('Solace');
  });

  it('names the file after the period', () => {
    expect(moodHistoryPdfFileName(WEEK)).toBe('solace-mood-history-2026-10-26-to-2026-11-01.pdf');
  });
});
