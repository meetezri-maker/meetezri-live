/**
 * Progress PDF — real jsPDF and the bundled fonts. Text is read back from the content streams
 * (glyph IDs mapped through the embedded fonts), so assertions see exactly what is drawn.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';
import { buildProgressReport, SESSION_LIST_LIMIT_CAP, type ProgressExportInput } from './progressReportModel';
import { buildProgressPdf, progressPdfFileName, progressPdfSections, progressReportNeedsArabicFont } from './progressExportPdf';
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

const iso = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();
const NOW = new Date(2026, 9, 28, 15, 0);
const input = (over: Partial<ProgressExportInput> = {}): ProgressExportInput => ({
  range: 'this_month', now: NOW, timeZone: 'Asia/Karachi',
  sessions: { ok: true, data: [{ started_at: iso(9, 2), ended_at: iso(9, 2, 13) }, { started_at: iso(9, 27), ended_at: null }] },
  moods: { ok: true, data: [] },
  journals: { ok: true, data: [{ created_at: iso(9, 5) }] },
  currentStreakDays: 0,
  stats: { ok: true, data: {
    weeklyProgress: [{ name: 'Week 1', sessions: 1, mood: 0, wellness: 2 }, { name: 'Week 2', sessions: 0, mood: 4, wellness: 0 }],
    wellnessScore: [{ subject: 'Emotional', A: 62, fullMark: 100 }, { subject: 'Social', A: 0, fullMark: 100 }, { subject: 'Focus', A: 40, fullMark: 100 }],
    monthlyActivity: [{ month: 'Sep', value: 0 }, { month: 'Oct', value: 9 }],
  } },
  tools: { ok: true, data: [{ toolId: 'box', toolTitle: '=SUM(1,1) Box Breathing', sessionsCompleted: 5, totalSeconds: 905 }] },
  ...over,
});

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
    const rules = [...body.matchAll(/([\d.]+)\s+([\d.]+)\s+m\s+([\d.]+)\s+([\d.]+)\s+l\s+S/g)].filter((x) => x[2] === x[4]).map((x) => (841.89 - Number(x[2])) * 0.3528);
    return { lines, text: lines.map((l) => l.text), rules };
  });
}

async function build(i: ProgressExportInput, f: PdfFontFiles = fonts, withLogo = true) {
  const report = buildProgressReport(i);
  const built = await buildProgressPdf(report, { fonts: f, logo: withLogo ? logo : null });
  return { ...built, report, pages: drawn(built.doc) };
}

describe('Progress PDF', () => {
  it('shows every report row with its value, unit, scope and status (parity with the CSV)', async () => {
    const { report, pages } = await build(input());
    const all = pages.flatMap((p) => p.text);
    const joined = all.join(' ');
    for (const s of progressPdfSections(report)) {
      expect(all).toContain(s.title);
      if (s.scope !== null) expect(joined).toContain(`Scope: ${s.scope}`);
      if (s.unit) expect(joined).toContain(`Unit: ${s.unit}`);
    }
    for (const r of report.rows) {
      expect(joined).toContain(r.metric);
      expect(all).toContain(r.value === null ? 'Not available' : String(r.value));
      expect(joined).toContain(r.status);
    }
    expect(joined).toContain('=SUM(1,1) Box Breathing'); // no spreadsheet escaping in the PDF
    // Mixed scopes stay per row; the unknown scope stays explicit.
    expect(joined).toContain('Scope unknown');
    expect(joined).toContain('All time');
    expect(joined).toContain('Last 28 days (server time)');
  });

  it('separates the selected period, the current snapshot and fixed windows', async () => {
    const { pages } = await build(input());
    const all = pages.flatMap((p) => p.text);
    expect(all).toContain('Reporting period: This Month: 1 Oct 2026 – 28 Oct 2026 (inclusive)');
    expect(all).toContain('Generated: 28 Oct 2026, 15:00 (Asia/Karachi)');
    expect(all).toContain('Scope: Selected period: This Month (2026-10-01 to 2026-10-28)');
    expect(all).toContain('Scope: As of 2026-10-28');
    expect(all.join(' ')).toContain('Other sections cover the windows stated with them, not the selected period.');
    // Genuine zeros stay 0.
    expect(all.filter((l) => l === '0').length).toBeGreaterThanOrEqual(4);
  });

  it('marks missing sources Not available (never 0) and explains the partial report', async () => {
    const { pages } = await build(input({ journals: { ok: false }, stats: { ok: false }, currentStreakDays: null }));
    const all = pages.flatMap((p) => p.text);
    const joined = all.join(' ');
    expect(all.filter((l) => l === 'Not available').length).toBe(5); // journals, streak, 3 server sections
    expect(joined).toContain('Partial: journal entries; weekly activity, wellness scores and monthly activity.');
    expect(joined).toContain('Unavailable: could not be loaded');
  });

  it('keeps a capped talk count labelled as a lower bound', async () => {
    const many = Array.from({ length: SESSION_LIST_LIMIT_CAP }, (_, i) => ({ started_at: iso(9, 1 + (i % 27)), ended_at: iso(9, 1 + (i % 27), 13) }));
    const { pages } = await build(input({ sessions: { ok: true, data: many, limited: true } }));
    const joined = pages.flatMap((p) => p.text).join(' ');
    expect(joined).toContain('200');
    expect(joined).toContain('Lower bound: only the most recent 200 talks could be loaded');
    expect(joined).toContain('Partial: talks counted from the most recent 200 only.');
  });

  it('flows long tables across pages with repeated headers, the branded footer and no overlaps', async () => {
    const tools = Array.from({ length: 70 }, (_, i) => ({
      toolId: `t${i}`,
      toolTitle: i === 3 ? `A very long tool name ${'that keeps going '.repeat(30)}end` : i === 5 ? 'x'.repeat(260) : `Tool ${i + 1}`,
      sessionsCompleted: i, totalSeconds: i * 60,
    }));
    const { pages } = await build(input({ tools: { ok: true, data: tools } }));
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      expect(p.text).toContain('Solace · Personal & confidential');
      expect(p.text).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(p.text.some((l) => l.startsWith('Progress Report  ·  This Month'))).toBe(i > 0);
      for (const l of p.lines) if (!/^Page |^Solace · /.test(l.text)) expect(l.y).toBeLessThan(275);
      // No separator is drawn through a line of text.
      for (const y of p.rules) for (const l of p.lines) expect(y > l.y - 2.6 && y < l.y + 0.6).toBe(false);
    });
    const toolPages = pages.filter((p) => p.text.some((l) => /^Tool \d+: /.test(l)));
    for (const p of toolPages.slice(1)) expect(p.text).toContain('Metric');
    const all = pages.flatMap((p) => p.text);
    // The unbroken name wraps inside its cell without losing characters (lines of a cell are drawn in order).
    const squashed = all.join('').replace(/\s/g, '');
    expect(squashed).toContain(`${'x'.repeat(260)}:wellnesstoolsessionscompleted`);
    expect(squashed).toContain(`${'x'.repeat(260)}:totaltime`);
    expect(squashed).toContain(`Averylongtoolname${'thatkeepsgoing'.repeat(30)}end:totaltime`);
    for (let i = 0; i < 70; i++) if (i !== 3 && i !== 5) expect(all).toContain(`Tool ${i + 1}: total time`);
  });

  it('draws Urdu tool names and marks emoji', async () => {
    const r = await build(input({ tools: { ok: true, data: [
      { toolId: 'u', toolTitle: 'سانس کی مشق', sessionsCompleted: 2, totalSeconds: 300 },
      { toolId: 'e', toolTitle: 'Calm 😊', sessionsCompleted: 1, totalSeconds: 60 },
    ] } }));
    expect(progressReportNeedsArabicFont(r.report)).toBe(true);
    const all = r.pages.flatMap((p) => p.text);
    expect(all.some((l) => l.includes(rev('مشق')) && l.includes(rev('سانس')))).toBe(true);
    expect(all).toContain('Calm [emoji]: total time');
    expect(r.emojiReplacedCount).toBe(2);
    expect(all.join(' ')).toContain('each appears as [emoji]');
  });

  it('stops instead of dropping characters, and handles font and logo failures', async () => {
    const cjk = await build(input({ tools: { ok: true, data: [{ toolId: 'c', toolTitle: '呼吸', sessionsCompleted: 1, totalSeconds: 1 }] } })).catch((e: unknown) => e);
    expect(cjk).toBeInstanceOf(PdfUnsupportedTextError);
    const urdu = input({ tools: { ok: true, data: [{ toolId: 'u', toolTitle: 'سانس', sessionsCompleted: 1, totalSeconds: 1 }] } });
    const noUrdu = await build(urdu, { latin: fonts.latin, arabic: null }).catch((e: unknown) => e);
    expect((noUrdu as PdfUnsupportedTextError).reason).toBe('font-unavailable');
    const english = await buildProgressPdf(buildProgressReport(input()), { fonts: { latin: null, arabic: null }, logo: null });
    expect(english.usedUnicodeFont).toBe(false);
    expect(english.doc.output()).toContain('Box Breathing');
    const noLogo = await build(input(), fonts, false);
    expect(noLogo.pages[0].text[0]).toBe('Solace');
  });

  it('names the file after the range and date', () => {
    expect(progressPdfFileName('last_month', NOW)).toBe('solace-progress-last-month-2026-10-28.pdf');
  });
});
