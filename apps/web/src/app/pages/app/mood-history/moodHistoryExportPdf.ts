/**
 * Mood History PDF ("Export" menu → Download PDF): the same report model as the CSV, as a
 * branded A4 document.
 *
 *   Title block — logo, "Mood History Report", reporting period, generated time and time zone,
 *                 included sources, entry count, partial-data notice when journals failed
 *   Entries     — one block per entry, oldest first: date · time · source, then mood, recorded
 *                 intensity (check-ins), activities, and the full notes across the page width
 *
 * Nothing is truncated: notes flow onto following pages under a "(continued)" label. Text uses
 * the shared Solace PDF fonts and shaping (Urdu right-to-left); emoji become "[emoji]" with a
 * note; any other character the fonts can't draw stops the export (`PdfUnsupportedTextError`).
 * Loaded on demand, so the CSV download never loads jsPDF or the fonts.
 */
import type { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ARABIC_SCRIPT, EMOJI_MARKER, loadPdfFonts, setupPdfText, type PdfFontFiles } from "@/lib/pdf/pdfText";
import { loadLogo, type LogoImage } from "@/lib/pdf/pdfLogo";
import { PdfWriter, stampPages, type Row } from "@/lib/pdf/pdfWriter";
import { BOTTOM, BRAND, BODY, CAUTION, INK, MUTED, NBSP, T_BODY, T_META, T_SECTION, T_TITLE } from "@/lib/pdf/pdfBrand";
import {
  MOOD_REPORT_PARTIAL,
  moodHistoryFileStem,
  type MoodHistoryReport,
  type MoodHistoryReportRow,
} from "./moodHistoryReport";

export const MOOD_PDF_TITLE = "Mood History Report";

/** e.g. `solace-mood-history-2026-10-26-to-2026-11-01.pdf` */
export function moodHistoryPdfFileName(period: { start: Date; end: Date }): string {
  return `${moodHistoryFileStem(period)}.pdf`;
}

/** "27 Oct 2026" (local calendar; no-break spaces keep it on one line). */
const day = (d: Date) => format(d, "d MMM yyyy").replace(/ /g, NBSP);

export function moodReportPeriodText(report: Pick<MoodHistoryReport, "period">): string {
  const { label, start, end } = report.period;
  return `${label}: ${day(start)} – ${day(end)} (inclusive)`;
}

function moodText(row: MoodHistoryReportRow): string {
  if (!row.moodLabel) return row.mood || "Not recorded";
  // Show the stored value too when it isn't simply the label (e.g. a legacy emoji tag).
  return row.mood && row.mood.toLowerCase() !== row.moodLabel.toLowerCase() ? `${row.moodLabel} (${row.mood})` : row.moodLabel;
}

function entryHeading(row: MoodHistoryReportRow): string {
  return `${day(row.at)}, ${format(row.at, "HH:mm")} · ${row.sourceLabel}`;
}

function entryDetails(row: MoodHistoryReportRow): string[] {
  const first = [`Mood: ${moodText(row)}`];
  if (row.intensity !== null) first.push(`Intensity: ${row.intensity}`);
  const lines = [first.join("  ·  ")];
  if (row.activities.length) lines.push(`Activities: ${row.activities.join(", ")}`);
  return lines;
}

/** Every string drawn from the user's entries, for font choice and the coverage check. */
function entryStrings(report: MoodHistoryReport): Array<[string, "normal" | "bold"]> {
  const out: Array<[string, "normal" | "bold"]> = [];
  for (const row of report.rows) {
    for (const line of entryDetails(row)) out.push([line, "normal"]);
    for (const para of row.notes.split("\n")) if (para.trim()) out.push([para, "normal"]);
  }
  return out;
}

export function moodReportNeedsArabicFont(report: MoodHistoryReport): boolean {
  return entryStrings(report).some(([text]) => ARABIC_SCRIPT.test(text));
}

export interface MoodPdfBuildOptions {
  fonts: PdfFontFiles;
  logo?: LogoImage | null;
}

export interface BuiltMoodPdf {
  doc: jsPDF;
  emojiReplacedCount: number;
  usedUnicodeFont: boolean;
}

export async function buildMoodHistoryPdf(report: MoodHistoryReport, options: MoodPdfBuildOptions): Promise<BuiltMoodPdf> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ unit: "mm", format: "a4" });
  doc.setProperties({ title: MOOD_PDF_TITLE, creator: "Solace" });
  const kit = setupPdfText(doc, options.fonts);
  const w = new PdfWriter(doc, kit);

  // Fail before drawing anything if some text cannot be drawn faithfully; count emoji markers.
  let emoji = 0;
  for (const [text, style] of entryStrings(report)) emoji += kit.prepare(text, style).emojiReplaced;

  // --- Title block ------------------------------------------------------------------------------
  w.logo(options.logo ?? null);
  const period = moodReportPeriodText(report);
  const generated = `${format(report.generatedAt, "d MMM yyyy, HH:mm")} (${report.timeZone})`;
  const hasJournalRows = report.rows.some((r) => r.source === "journal");
  const header: Row[] = [
    ...w.textRows(MOOD_PDF_TITLE, { style: "bold", size: T_TITLE, color: INK }),
    w.space(2.5),
    ...w.textRows(`Reporting period: ${period}`, { size: T_BODY }),
    ...w.textRows(`Generated: ${generated}`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
    ...w.textRows(`Includes: ${report.includes}`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
    ...w.textRows(`Entries: ${report.rows.length}`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
  ];
  if (report.partial) header.push(w.notice(`${MOOD_REPORT_PARTIAL}.`, CAUTION, { padTop: 3 }));
  const notes: string[] = [`Dates and times are in ${report.timeZone}.`];
  if (hasJournalRows) notes.push("Journal entries don't record an intensity, so none is shown for them.");
  if (emoji > 0) notes.push(`Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}. The original entries are unchanged in the Solace app.`);
  header.push(...w.textRows(notes.join(" "), { size: T_META, color: MUTED, padTop: 2.5 }));
  w.place(header);

  // --- Entries ----------------------------------------------------------------------------------
  w.place([
    w.space(5),
    ...w.textRows("Entries", { style: "bold", size: T_SECTION, color: INK, keepWithNext: true }),
    w.rule(BRAND, 0.5, 1.6, 4),
  ], 30);

  if (report.rows.length === 0) {
    w.place(w.textRows("No mood entries in this period.", { size: T_BODY, color: MUTED }));
  }

  report.rows.forEach((row, index) => {
    const heading = w.textRows(entryHeading(row), { style: "bold", size: T_BODY, color: INK });
    const details = entryDetails(row).flatMap((line) => w.textRows(line, { size: T_BODY, color: BODY, padTop: 1 }));
    const body = row.notes.trim() ? w.textRows(row.notes, { size: T_BODY, color: BODY, padTop: 2 }) : [];
    const head = [...heading, ...details];
    // Keep the entry's heading and details with the first lines of its notes.
    const keep = [...head, ...body.slice(0, 2)].reduce((s, r) => s + r.h, 0);
    w.place(head, keep);

    const label = w.textRows(`${entryHeading(row)} (continued)`, { size: T_META, color: MUTED });
    w.setPageBreakHook(() => {
      for (const r of label) {
        r.draw(w.y);
        w.y += r.h;
      }
      w.y += 2;
    });
    w.place(body);
    w.setPageBreakHook(null);

    // Separator between entries — dropped at a page break rather than drawn atop the next page.
    const separator = w.rule(undefined, 0.25, 3.5, 4.5);
    if (index < report.rows.length - 1 && w.y + separator.h <= BOTTOM) w.place([separator]);
  });

  stampPages(doc, kit, `${MOOD_PDF_TITLE}  ·  ${period}`);
  return { doc, emojiReplacedCount: emoji, usedUnicodeFont: kit.unicode };
}

/**
 * Loads the PDF fonts (the Urdu font only when the report needs it) and the logo, then builds
 * the PDF. Throws `PdfUnsupportedTextError` when text cannot be drawn faithfully.
 */
export async function createMoodHistoryPdf(report: MoodHistoryReport): Promise<BuiltMoodPdf> {
  const [fonts, logo] = await Promise.all([loadPdfFonts(moodReportNeedsArabicFont(report)), loadLogo()]);
  return buildMoodHistoryPdf(report, { fonts, logo });
}
