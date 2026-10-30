/**
 * Progress PDF ("Export Report" menu → Download PDF): the same report model as the CSV, as a
 * branded A4 document.
 *
 *   Title block — logo, "Progress Report", reporting period, generated time and time zone,
 *                 completeness notice when something could not be loaded or is a lower bound
 *   Sections    — Selected-period activity, Current snapshot, Weekly activity, Wellness scores,
 *                 Monthly activity, Wellness tools: one table each, with the section's scope
 *                 (and unit) stated above it when every row shares it, or per row when they differ
 *
 * Every CSV row appears, with its metric, value, unit, scope and status. A missing value is shown
 * as "Not available" (never 0). Loaded on demand, so the CSV never loads jsPDF or the fonts.
 */
import type { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ARABIC_SCRIPT, EMOJI_MARKER, loadPdfFonts, setupPdfText, type PdfFontFiles } from "@/lib/pdf/pdfText";
import { loadLogo, type LogoImage } from "@/lib/pdf/pdfLogo";
import { PdfWriter, stampPages, type Row, type TableColumn } from "@/lib/pdf/pdfWriter";
import { BODY, BRAND, CAUTION, CONTENT_W, INK, MUTED, NBSP, T_BODY, T_META, T_SECTION, T_TITLE } from "@/lib/pdf/pdfBrand";
import { progressFileStem, type ProgressExportReport, type ProgressReportRow } from "./progressReportModel";
import type { ProgressTimeRange } from "./progressInsights";

export const PROGRESS_PDF_TITLE = "Progress Report";

/** e.g. `solace-progress-this-month-2026-10-28.pdf` */
export function progressPdfFileName(range: ProgressTimeRange, now: Date): string {
  return `${progressFileStem(range, now)}.pdf`;
}

const day = (d: Date) => format(d, "d MMM yyyy").replace(/ /g, NBSP);

export function progressPeriodText(report: Pick<ProgressExportReport, "range" | "rangeLabel" | "bounds">): string {
  return report.range === "all"
    ? `${report.rangeLabel}, up to ${day(report.bounds.end)}`
    : `${report.rangeLabel}: ${day(report.bounds.start)} – ${day(report.bounds.end)} (inclusive)`;
}

/** The PDF's sections, in order, and which model rows each holds. */
const SECTIONS: Array<{ title: string; pick: (r: ProgressReportRow) => boolean }> = [
  { title: "Selected-period activity", pick: (r) => r.section === "Summary" && r.kind === "selected-period" },
  { title: "Current snapshot", pick: (r) => r.section === "Summary" && r.kind === "snapshot" },
  { title: "Weekly activity", pick: (r) => r.section === "Weekly activity" },
  { title: "Wellness scores", pick: (r) => r.section === "Wellness scores" },
  { title: "Monthly activity", pick: (r) => r.section === "Monthly activity" },
  { title: "Wellness tools", pick: (r) => r.section === "Wellness tools" },
];

export const PROGRESS_NOT_AVAILABLE = "Not available";
const valueText = (r: ProgressReportRow) => (r.value === null ? PROGRESS_NOT_AVAILABLE : String(r.value));
const same = (values: string[]) => values.length > 0 && values.every((v) => v === values[0]);

interface SectionLayout {
  title: string;
  rows: ProgressReportRow[];
  /** Scope/unit shared by every row (stated once above the table), or null (a column). */
  scope: string | null;
  unit: string | null;
  columns: TableColumn[];
  cells: string[][];
}

function layoutSection(title: string, rows: ProgressReportRow[]): SectionLayout {
  const scope = same(rows.map((r) => r.scope)) ? rows[0].scope : null;
  const unit = same(rows.map((r) => r.unit)) ? rows[0].unit : null;
  // Wide enough for "Not available" on one line.
  const fixed: TableColumn[] = [{ label: "Value", width: 30, align: "right" }];
  if (unit === null) fixed.push({ label: "Unit", width: 30 });
  if (scope === null) fixed.push({ label: "Scope", width: 42 });
  fixed.push({ label: "Status", width: 38 });
  const metricW = CONTENT_W - fixed.reduce((s, c) => s + c.width, 0);
  const columns = [{ label: "Metric", width: metricW }, ...fixed];
  const cells = rows.map((r) => [
    r.metric,
    valueText(r),
    ...(unit === null ? [r.unit] : []),
    ...(scope === null ? [r.scope] : []),
    r.status,
  ]);
  return { title, rows, scope, unit, columns, cells };
}

export function progressPdfSections(report: ProgressExportReport): SectionLayout[] {
  return SECTIONS.map((s) => ({ title: s.title, rows: report.rows.filter(s.pick) }))
    .filter((s) => s.rows.length > 0)
    .map((s) => layoutSection(s.title, s.rows));
}

/** Every string drawn from the report data, for font choice and the coverage check. */
function reportStrings(report: ProgressExportReport): string[] {
  return report.rows.flatMap((r) => [r.metric, r.unit, r.scope, r.status]).filter(Boolean);
}

export function progressReportNeedsArabicFont(report: ProgressExportReport): boolean {
  return reportStrings(report).some((s) => ARABIC_SCRIPT.test(s));
}

export interface ProgressPdfBuildOptions {
  fonts: PdfFontFiles;
  logo?: LogoImage | null;
}

export interface BuiltProgressPdf {
  doc: jsPDF;
  emojiReplacedCount: number;
  usedUnicodeFont: boolean;
}

export async function buildProgressPdf(report: ProgressExportReport, options: ProgressPdfBuildOptions): Promise<BuiltProgressPdf> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ unit: "mm", format: "a4" });
  doc.setProperties({ title: PROGRESS_PDF_TITLE, creator: "Solace" });
  const kit = setupPdfText(doc, options.fonts);
  const w = new PdfWriter(doc, kit);

  // Fail before drawing anything if some text cannot be drawn faithfully; count emoji markers.
  let emoji = 0;
  for (const text of reportStrings(report)) for (const line of text.split("\n")) if (line.trim()) emoji += kit.prepare(line).emojiReplaced;

  // --- Title block ------------------------------------------------------------------------------
  w.logo(options.logo ?? null);
  const period = progressPeriodText(report);
  const header: Row[] = [
    ...w.textRows(PROGRESS_PDF_TITLE, { style: "bold", size: T_TITLE, color: INK }),
    w.space(2.5),
    ...w.textRows(`Reporting period: ${period}`, { size: T_BODY }),
    ...w.textRows(`Generated: ${format(report.now, "d MMM yyyy, HH:mm")} (${report.timeZone})`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
  ];
  if (report.issues.length) {
    header.push(
      w.notice(
        `${report.completeness}. Values that could not be loaded are shown as "${PROGRESS_NOT_AVAILABLE}", and lower bounds are labelled, so the affected totals may be incomplete.`,
        CAUTION,
        { padTop: 3 }
      )
    );
  }
  const notes = [
    `Selected-period counts use ${report.timeZone}. Other sections cover the windows stated with them, not the selected period.`,
  ];
  if (emoji > 0) notes.push(`Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.`);
  header.push(...w.textRows(notes.join(" "), { size: T_META, color: MUTED, padTop: 2.5 }));
  w.place(header);

  // --- Sections ---------------------------------------------------------------------------------
  for (const s of progressPdfSections(report)) {
    const lead: Row[] = [
      w.space(5),
      ...w.textRows(s.title, { style: "bold", size: T_SECTION, color: INK }),
      w.rule(BRAND, 0.5, 1.6, 3),
    ];
    if (s.scope !== null) lead.push(...w.textRows(`Scope: ${s.scope}`, { size: T_META, color: BODY }));
    if (s.unit) lead.push(...w.textRows(`Unit: ${s.unit}`, { size: T_META, color: BODY, padTop: 0.6 }));
    lead.push(w.space(2));
    w.table(s.columns, s.cells, lead);
  }

  stampPages(doc, kit, `${PROGRESS_PDF_TITLE}  ·  ${period}`);
  return { doc, emojiReplacedCount: emoji, usedUnicodeFont: kit.unicode };
}

/**
 * Loads the PDF fonts (the Urdu font only when the report needs it) and the logo, then builds
 * the PDF. Throws `PdfUnsupportedTextError` when text cannot be drawn faithfully.
 */
export async function createProgressPdf(report: ProgressExportReport): Promise<BuiltProgressPdf> {
  const [fonts, logo] = await Promise.all([loadPdfFonts(progressReportNeedsArabicFont(report)), loadLogo()]);
  return buildProgressPdf(report, { fonts, logo });
}
