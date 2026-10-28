/**
 * Journal Export PDF: a single-column, print-friendly reading document.
 *
 *   Header — logo, "Journal Export", selected dates, generated time and time zone, entry count
 *   Entries — title, recorded date · mood · favorite, then the entry text with its paragraphs,
 *             line breaks, headings, lists and quotes (see journalRichText.ts)
 *
 * Every line is measured before it is placed. An entry's title and details stay with its first
 * lines; long entries continue on following pages under a "continued" label; nothing is
 * truncated. Text is drawn with the same fonts, shaping and right-to-left handling as the
 * Goals & Achievements report (progress-report.pdf-text.ts): Urdu in Amiri, other text in
 * DejaVu Sans. Emoji become "[emoji]"; any other character the fonts cannot draw stops the
 * export with `PdfUnsupportedTextError` instead of producing an unfaithful PDF.
 */
import type { jsPDF } from "jspdf";
import {
  ARABIC_SCRIPT,
  EMOJI_MARKER,
  PDF_ARABIC_FONT_FAMILY,
  loadPdfFonts,
  setupPdfText,
  type PdfFontFiles,
  type PdfTextKit,
} from "@/app/features/goals/progress-report/progress-report.pdf-text";
import { journalHtmlToLines, IMAGE_MARKER, type JournalLine } from "./journalRichText";
import {
  getEntryContent,
  getEntryFavorite,
  journalMoodLabel,
  sortJournalEntries,
  type JournalExportEntry,
} from "./journalExport";

type Doc = jsPDF;
type RGB = [number, number, number];
type Style = "normal" | "bold";

// --- Geometry (A4, millimetres) — as in the Goals report ----------------------------------------
const PAGE_W = 210;
const M = 18;
const CONTENT_W = PAGE_W - M * 2; // 174
const FIRST_TOP = 20;
const TOP = 27; // below the running header on continuation pages
const BOTTOM = 274;
const FOOTER_RULE = 281;
const FOOTER_TEXT = 287;
const LIST_INDENT = 6;
const QUOTE_INDENT = 5;

// --- Type (pt) ----------------------------------------------------------------------------------
const T_TITLE = 19;
const T_ENTRY = 12.5;
const T_BODY = 10;
const T_META = 8.5;
const T_SMALL = 7.5;
/** Headings inside an entry stay smaller than the entry title (T_ENTRY). */
const HEADING_SIZES = [0, 11.5, 11, 10.5, 10, 10, 10];
const PT = 0.3528;

const lineH = (size: number) => size * PT * 1.45;
const ascent = (size: number) => size * PT * 0.78;
const descent = (size: number) => size * PT * 0.24;

/** Line metrics per font: Amiri's tall marks and deep descenders need more room than DejaVu. */
function metrics(family: string, size: number) {
  return family === PDF_ARABIC_FONT_FAMILY
    ? { lineH: size * PT * 1.95, ascent: size * PT * 1.02, descent: size * PT * 0.6 }
    : { lineH: lineH(size), ascent: ascent(size), descent: descent(size) };
}

// --- Print-friendly palette ---------------------------------------------------------------------
const INK: RGB = [17, 24, 39];
const BODY: RGB = [40, 46, 58];
const MUTED: RGB = [96, 104, 117];
const BRAND: RGB = [109, 40, 217];
const RULE: RGB = [221, 223, 230];
const QUOTE_BAR: RGB = [196, 181, 253];
const CAUTION: RGB = [154, 72, 6];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NBSP = " ";
const LIST_BULLETS = ["•", "–", "·"];

/** "2026-10-27" → "27 Oct 2026" from the calendar parts (no time-zone conversion). */
export function formatJournalDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? [Number(m[3]), month, m[1]].join(NBSP) : value;
}

/** The selected range, stated as inclusive calendar days. */
export function formatJournalRange(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) return `${formatJournalDay(dateFrom)} – ${formatJournalDay(dateTo)} (inclusive)`;
  if (dateFrom) return `From ${formatJournalDay(dateFrom)} (inclusive)`;
  if (dateTo) return `Up to and including ${formatJournalDay(dateTo)}`;
  return "All dates";
}

/** A date-time in the given zone, e.g. "28 Oct 2026, 15:00"; null when unreadable. */
export function formatJournalDateTime(value: string | Date, timeZone: string): string | null {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(at);
  }
}

// ---------------------------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------------------------

interface Row {
  h: number;
  /** Keep this row on the same page as the next one (headings). */
  keepWithNext?: boolean;
  /** Distance from the row top to its text baseline (text rows). */
  baseline?: number;
  draw: (top: number) => void;
}

interface Laid {
  text: string;
  family: string;
}

class Writer {
  y = FIRST_TOP;
  private onPageBreak: (() => void) | null = null;

  constructor(readonly d: Doc, readonly kit: PdfTextKit) {}

  font(style: Style, size: number, color: RGB, family: string = this.kit.baseFamily): void {
    this.d.setFont(family, style);
    this.d.setFontSize(size);
    this.d.setTextColor(color[0], color[1], color[2]);
  }

  /** Prepares one paragraph (font by script, emoji marked) and wraps it; long words are split. */
  layout(text: string, width: number, style: Style, size: number): Laid[] {
    if (!text) return [];
    const p = this.kit.prepare(text, style);
    this.d.setFont(p.family, style);
    this.d.setFontSize(size);
    const out: Laid[] = [];
    for (const line of this.d.splitTextToSize(p.text, width) as string[]) {
      if (this.d.getTextWidth(line) <= width + 0.5) {
        out.push({ text: line, family: p.family });
        continue;
      }
      let chunk = "";
      for (const ch of Array.from(line)) {
        if (chunk && this.d.getTextWidth(chunk + ch) > width) {
          out.push({ text: chunk, family: p.family });
          chunk = ch;
        } else chunk += ch;
      }
      if (chunk) out.push({ text: chunk, family: p.family });
    }
    return out;
  }

  /** Draws a line inside [left, left + width]; right-to-left paragraphs align right. */
  line(text: string, left: number, baseline: number, width: number, opts: Record<string, boolean> | undefined): void {
    if (!text) return;
    if (opts) this.d.text(text, left + width, baseline, { ...opts, align: "right" });
    else this.d.text(text, left, baseline);
  }

  newPage(): void {
    this.d.addPage();
    this.y = TOP;
    this.onPageBreak?.();
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) this.newPage();
  }

  setPageBreakHook(hook: (() => void) | null): void {
    this.onPageBreak = hook;
  }

  /** Places rows, keeping the first `keep` mm together and headings with what follows. */
  place(rows: Row[], keep = 0): void {
    if (keep > 0) this.ensure(Math.min(keep, BOTTOM - TOP));
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      this.ensure(r.keepWithNext && next ? r.h + next.h : r.h);
      r.draw(this.y);
      this.y += r.h;
    });
  }

  /** Rows for a wrapped paragraph: one row per line, so long text can cross pages. */
  textRows(
    text: string,
    o: { style?: Style; size?: number; color?: RGB; indent?: number; padTop?: number; keepWithNext?: boolean; rtlOf?: string }
  ): Row[] {
    const style = o.style ?? "normal";
    const size = o.size ?? T_BODY;
    const color = o.color ?? BODY;
    const indent = o.indent ?? 0;
    const width = CONTENT_W - indent;
    const lines = this.layout(text, width, style, size);
    // One base direction for the whole paragraph (from its first strong character).
    const opts = this.kit.textOptions(o.rtlOf ?? text);
    const mt = metrics(lines[0]?.family ?? this.kit.baseFamily, size);
    return lines.map((ln, i) => {
      const baseline = i === 0 ? (o.padTop ?? 0) + mt.ascent : mt.lineH;
      return {
        h: baseline + (i === lines.length - 1 ? mt.descent : 0),
        keepWithNext: o.keepWithNext,
        baseline,
        draw: (top: number) => {
          this.font(style, size, color, ln.family);
          this.line(ln.text, opts ? M : M + indent, top + baseline, width, opts);
        },
      };
    });
  }

  rule(color: RGB, lineWidth: number, before: number, after: number): Row {
    return {
      h: before + after,
      draw: (top) => {
        this.d.setDrawColor(color[0], color[1], color[2]);
        this.d.setLineWidth(lineWidth);
        this.d.line(M, top + before, M + CONTENT_W, top + before);
      },
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Entry body
// ---------------------------------------------------------------------------------------------

function bodyRows(w: Writer, lines: JournalLine[]): Row[] {
  const rows: Row[] = [];
  for (const l of lines) {
    const size = l.kind === "heading" ? HEADING_SIZES[l.level ?? 3] : T_BODY;
    if (l.paragraphBefore) rows.push({ h: lineH(T_BODY) * 0.55, draw: () => undefined });

    if (l.kind === "rule") {
      rows.push(w.rule(RULE, 0.3, 2, 2.5));
      continue;
    }
    if (!l.text && !l.marker) {
      rows.push({ h: lineH(T_BODY), draw: () => undefined }); // an empty line in the entry
      continue;
    }

    const depthIndent = l.depth ? (l.depth - 1) * LIST_INDENT + (l.kind === "list-item" || l.marker ? 0 : LIST_INDENT) : 0;
    if (l.marker) {
      // List item: marker in its own column, text with a hanging indent.
      const marker = l.marker === "•" ? LIST_BULLETS[((l.depth ?? 1) - 1) % LIST_BULLETS.length] : l.marker;
      const rtl = !!w.kit.textOptions(l.text);
      const textRows = w.textRows(l.text || " ", { size, indent: depthIndent + LIST_INDENT });
      const first = textRows[0];
      if (first) {
        const drawText = first.draw;
        first.draw = (top) => {
          drawText(top);
          w.font("normal", size, MUTED);
          const baseline = top + (first.baseline ?? ascent(size));
          if (rtl) w.d.text(marker, M + CONTENT_W - depthIndent, baseline, { align: "right" });
          else w.d.text(marker, M + depthIndent, baseline);
        };
      }
      rows.push(...textRows);
      continue;
    }

    if (l.kind === "quote") {
      const rtl = !!w.kit.textOptions(l.text);
      const qRows = w.textRows(l.text, { size, indent: depthIndent + QUOTE_INDENT });
      for (const r of qRows) {
        const drawText = r.draw;
        r.draw = (top) => {
          drawText(top);
          w.d.setDrawColor(QUOTE_BAR[0], QUOTE_BAR[1], QUOTE_BAR[2]);
          w.d.setLineWidth(0.8);
          const x = rtl ? M + CONTENT_W - depthIndent - 1 : M + depthIndent + 1;
          w.d.line(x, top, x, top + r.h);
        };
      }
      rows.push(...qRows);
      continue;
    }

    const heading = l.kind === "heading";
    rows.push(
      ...w.textRows(l.text, {
        style: heading ? "bold" : "normal",
        size,
        color: heading ? INK : BODY,
        indent: depthIndent,
        padTop: heading ? 1.5 : 0,
        keepWithNext: heading,
      })
    );
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

export interface JournalPdfInput {
  entries: JournalExportEntry[];
  dateFrom: string;
  dateTo: string;
  generatedAt: Date;
  /** Time zone for entry dates/times (the device zone used by the date filter). */
  timeZone: string;
}

export interface LogoImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface JournalPdfBuildOptions {
  fonts: PdfFontFiles;
  logo?: LogoImage | null;
}

export interface BuiltJournalPdf {
  doc: Doc;
  emojiReplacedCount: number;
  imageCount: number;
  usedUnicodeFont: boolean;
}

interface PreparedEntry {
  title: string;
  meta: string;
  lines: JournalLine[];
}

function prepareEntries(input: JournalPdfInput): PreparedEntry[] {
  return sortJournalEntries(input.entries).map((e) => {
    const title = (e.title ?? "").normalize("NFC").trim() || "Untitled entry";
    const when = formatJournalDateTime(e.created_at, input.timeZone) ?? "Date not recorded";
    const moods = (Array.isArray(e.mood_tags) ? e.mood_tags : []).map(journalMoodLabel).filter(Boolean);
    const meta = [when.replace(/ /g, NBSP), moods.length ? `Mood: ${moods.join(", ")}` : null, getEntryFavorite(e) ? "Favorite" : null]
      .filter(Boolean)
      .join("  ·  ");
    const lines = journalHtmlToLines(getEntryContent(e).normalize("NFC"));
    return { title, meta, lines };
  });
}

/** Every string drawn from the user's entries (to choose fonts and check coverage up front). */
function entryStrings(entries: PreparedEntry[]): Array<[string, Style]> {
  const out: Array<[string, Style]> = [];
  for (const e of entries) {
    out.push([e.title, "bold"], [e.meta, "normal"]);
    for (const l of e.lines) if (l.text) out.push([l.text, l.kind === "heading" ? "bold" : "normal"]);
  }
  return out;
}

/** Renders the selected entries into an A4 PDF. */
export async function buildJournalPdf(input: JournalPdfInput, options: JournalPdfBuildOptions): Promise<BuiltJournalPdf> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const d = new JsPdf({ unit: "mm", format: "a4" }) as Doc;
  d.setProperties({ title: "Journal Export", creator: "Solace" });
  const kit = setupPdfText(d, options.fonts);
  const w = new Writer(d, kit);
  const entries = prepareEntries(input);

  // Fail before drawing anything if some text cannot be drawn faithfully; count markers.
  let emoji = 0;
  let images = 0;
  for (const [text, style] of entryStrings(entries)) emoji += kit.prepare(text, style).emojiReplaced;
  for (const e of entries) for (const l of e.lines) images += l.images ?? 0;

  // --- Header -----------------------------------------------------------------------------------
  const logo = options.logo ?? null;
  let drewLogo = false;
  if (logo) {
    try {
      d.addImage(logo.dataUrl, "PNG", M, w.y - 4, logo.width, logo.height);
      w.y += logo.height + 2;
      drewLogo = true;
    } catch {
      drewLogo = false;
    }
  }
  const header: Row[] = [];
  if (!drewLogo) header.push(...w.textRows("Solace", { style: "bold", size: 12, color: BRAND }), { h: 2, draw: () => undefined });
  header.push(...w.textRows("Journal Export", { style: "bold", size: T_TITLE, color: INK }), { h: 2.5, draw: () => undefined });
  const generated = formatJournalDateTime(input.generatedAt, input.timeZone) ?? "Not recorded";
  header.push(
    ...w.textRows(`Dates: ${formatJournalRange(input.dateFrom, input.dateTo)}`, { size: T_BODY }),
    ...w.textRows(`Generated: ${generated} (${input.timeZone})`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
    ...w.textRows(`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
    ...w.textRows(`Entry days and times use the ${input.timeZone} time zone, as in the date filter.`, { size: T_META, color: MUTED, padTop: 1.2 })
  );
  const notes: string[] = [];
  if (emoji > 0) notes.push(`Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.`);
  if (images > 0) notes.push(`Images aren't included in this PDF; each appears as ${IMAGE_MARKER}.`);
  if (notes.length) header.push(...w.textRows(`${notes.join(" ")} The original entries are unchanged in the Solace app.`, { size: T_META, color: CAUTION, padTop: 1.5 }));
  header.push(w.rule(RULE, 0.3, 3.5, 5));
  w.place(header);

  if (entries.length === 0) {
    w.place(w.textRows("No journal entries in this selection.", { size: T_BODY, color: MUTED }));
  }

  // --- Entries ----------------------------------------------------------------------------------
  entries.forEach((e, index) => {
    const titleRows = w.textRows(e.title, { style: "bold", size: T_ENTRY, color: INK });
    const metaRows = w.textRows(e.meta, { size: T_META, color: MUTED, padTop: 1.2 });
    const body = e.lines.length
      ? bodyRows(w, e.lines)
      : w.textRows("This entry has no text.", { size: T_BODY, color: MUTED });
    const gap: Row = { h: 3.2, draw: () => undefined };
    const head = [...titleRows, ...metaRows, gap];
    // Keep the title and details with the first lines of the entry.
    const keep = [...head, ...body.slice(0, 2)].reduce((s, r) => s + r.h, 0);

    // Continuation label on pages this entry flows onto.
    const firstTitleLine = w.layout(e.title, CONTENT_W - 30, "normal", T_META)[0]?.text ?? "";
    const label = `${firstTitleLine}${w.layout(e.title, CONTENT_W - 30, "normal", T_META).length > 1 ? "…" : ""} (continued)`;
    const labelRows = w.textRows(label, { size: T_META, color: MUTED, rtlOf: e.title });
    w.place(head, keep);
    w.setPageBreakHook(() => {
      for (const r of labelRows) {
        r.draw(w.y);
        w.y += r.h;
      }
      w.y += 2.5;
    });
    w.place(body);
    w.setPageBreakHook(null);
    // Separator between entries — dropped at a page break rather than drawn atop the next page.
    const separator = w.rule(RULE, 0.25, 4.5, 5.5);
    if (index < entries.length - 1 && w.y + separator.h <= BOTTOM) w.place([separator]);
  });

  stampPages(d, kit, input);
  return { doc: d, emojiReplacedCount: emoji, imageCount: images, usedUnicodeFont: kit.unicode };
}

/** Running header (continuation pages) and footer (every page), once totals are known. */
function stampPages(d: Doc, kit: PdfTextKit, input: JournalPdfInput): void {
  const total = d.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    d.setPage(page);
    d.setFont(kit.baseFamily, "normal");
    d.setFontSize(T_SMALL);
    d.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    d.setDrawColor(RULE[0], RULE[1], RULE[2]);
    d.setLineWidth(0.25);
    if (page > 1) {
      d.text(`Journal Export  ·  ${formatJournalRange(input.dateFrom, input.dateTo)}`, M, 14);
      d.line(M, 17, M + CONTENT_W, 17);
    }
    d.line(M, FOOTER_RULE, M + CONTENT_W, FOOTER_RULE);
    d.text("Solace", M, FOOTER_TEXT);
    d.text(`Page ${page} of ${total}`, M + CONTENT_W, FOOTER_TEXT, { align: "right" });
  }
}

/** True when any entry text uses Arabic script (the Urdu font is then loaded). */
export function journalNeedsArabicFont(entries: JournalExportEntry[]): boolean {
  return entries.some(
    (e) =>
      ARABIC_SCRIPT.test(e.title ?? "") ||
      (e.mood_tags ?? []).some((t) => ARABIC_SCRIPT.test(journalMoodLabel(t))) ||
      journalHtmlToLines(getEntryContent(e)).some((l) => ARABIC_SCRIPT.test(l.text))
  );
}

/**
 * Loads the export fonts (Urdu only when needed) and the logo, then builds the PDF.
 * Throws `PdfUnsupportedTextError` when text cannot be drawn faithfully.
 */
export async function createJournalPdf(input: JournalPdfInput): Promise<BuiltJournalPdf> {
  const { loadLogo } = await import("@/app/features/goals/progress-report/progress-report.pdf");
  const [fonts, logo] = await Promise.all([loadPdfFonts(journalNeedsArabicFont(input.entries)), loadLogo()]);
  return buildJournalPdf(input, { fonts, logo });
}
