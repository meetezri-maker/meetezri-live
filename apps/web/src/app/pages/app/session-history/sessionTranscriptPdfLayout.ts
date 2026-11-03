/**
 * Session Transcript PDF layout (runs in the PDF worker): the same transcript document as the TXT,
 * as a branded A4 reading document drawn with the shaped text writer.
 *
 *   Title block  — logo, "Session Transcript", session title and ID, recorded companion, recorded
 *                  start and duration, export time and time zone (+ the [emoji] note when used)
 *   Summary      — the saved summary under its provenance heading
 *   Conversation — the saved-messages and recorded-times notes, then every user/assistant message
 *                  with its speaker and recorded time, word for word, in a single column
 *
 * Long messages continue on following pages under a "(continued)" label; nothing is truncated.
 */
import { format } from "date-fns";
import type { PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import {
  BODY, BOTTOM, BRAND, CONTENT_W, FIRST_TOP, FOOTER_LEFT, FOOTER_RULE, FOOTER_TEXT, HEADER_RULE, HEADER_TEXT, INK, MARGIN, MUTED,
  NBSP, PAGE_W, RULE, T_BODY, T_META, T_SECTION, T_SMALL, T_TITLE, TOP,
} from "@/lib/pdf/pdfBrand";
import { EMOJI_MARKER, ShapedPdfWriter, type Rgb, type ShapedLine, type ShapingProgress, type ShapingRuntime } from "@/lib/pdf/shaped/shapedPdf";
import { RECORDED_TIMES_NOTE, SAVED_MESSAGES_NOTE, type TranscriptDocument } from "./sessionTranscriptExport";

export const TRANSCRIPT_PDF_TITLE = "Session Transcript";

/** pt per mm (the brand geometry is in mm, the PDF in pt). */
const MM = 72 / 25.4;
const PAGE_H = 297;

/** "27 Oct 2026, 21:00" in local time (no-break spaces keep the date on one line). */
const dateTime = (d: Date) => `${format(d, "d MMM yyyy").replace(/ /g, NBSP)}, ${format(d, "HH:mm")}`;

interface Row {
  /** Height in mm. */
  h: number;
  keepWithNext?: boolean;
  draw(top: number): void;
}

export interface TranscriptPdfBuildOptions {
  /** Reader's locale: only used to choose Han glyph forms for CJK runs without kana/Hangul. */
  locale?: string;
  logoPng?: Uint8Array | null;
  onProgress?: (p: ShapingProgress) => void;
}

export interface TranscriptPdfBuildResult {
  bytes: Uint8Array;
  pages: number;
  emojiReplacedCount: number;
  fonts: string[];
}

export async function buildShapedTranscriptPdf(t: TranscriptDocument, runtime: ShapingRuntime, options: TranscriptPdfBuildOptions = {}): Promise<TranscriptPdfBuildResult> {
  const w = await ShapedPdfWriter.create(runtime, { title: TRANSCRIPT_PDF_TITLE, locale: options.locale });
  const doc = w.doc;

  // Emoji → "[emoji]" in everything drawn from the stored session (the drawn and copyable text is
  // what the reader sees); everything else is drawn exactly as stored.
  let emoji = 0;
  const prep = (s: string) => { const r = w.prepareText(s); emoji += r.emoji; return r.text; };
  const title = prep(t.title);
  const companion = t.companion ? prep(t.companion) : null;
  const summaryBody = prep(t.summary.body);
  const messages = t.messages.map((m) => ({ ...m, content: prep(m.content) }));

  const meta = [
    `Session: ${title}`,
    `Session ID: ${t.sessionId}`,
    ...(companion ? [`Companion: ${companion}`] : []),
    `Started: ${t.started ? dateTime(t.started) : "Not recorded"}`,
    `Duration: ${t.duration}`,
    `Exported: ${dateTime(t.exportedAt)} (${t.timeZone})`,
  ];
  const zoneNote = [`Dates and times are in ${t.timeZone}.`, emoji > 0 ? `Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.` : ""].filter(Boolean).join(" ");
  const notes = `${SAVED_MESSAGES_NOTE} ${RECORDED_TIMES_NOTE}`;
  const headerText = `${TRANSCRIPT_PDF_TITLE}  ·  ${t.started ? format(t.started, "d MMM yyyy") : "Start not recorded"}`;
  const labels = messages.map((m) => `${m.speaker}  ·  ${m.time}`);

  // Fetch only the fonts this document needs; unsupported text fails here, before any drawing.
  await w.ensureFonts(
    [...meta, zoneNote, summaryBody, notes, headerText, FOOTER_LEFT, "Page 0123456789 of", ...labels.map((l) => `${l} (continued)`), ...messages.map((m) => m.content)],
    [TRANSCRIPT_PDF_TITLE, t.summary.heading, "Conversation", ...labels, "Solace"],
    options.onProgress,
  );

  // --- Flow ------------------------------------------------------------------------------------
  const pages: PDFPage[] = [];
  let page: PDFPage | null = null;
  let y = FIRST_TOP;
  let onPageBreak: (() => void) | null = null;
  const newPage = () => {
    page = doc.addPage([PAGE_W * MM, PAGE_H * MM]);
    pages.push(page);
    y = pages.length === 1 ? FIRST_TOP : TOP;
    onPageBreak?.();
  };
  const ensure = (h: number) => { if (!page || y + h > BOTTOM) newPage(); };
  const place = (rows: Row[], keep = 0) => {
    if (keep > 0) ensure(Math.min(keep, BOTTOM - TOP));
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      ensure(r.keepWithNext && next ? r.h + next.h : r.h);
      r.draw(y);
      y += r.h;
    });
  };
  const space = (h: number): Row => ({ h, draw: () => undefined });
  const textRows = (text: string, o: { size: number; bold?: boolean; color: Rgb; padTop?: number; keepWithNext?: boolean; lang?: string }): Row[] => {
    const rows: Row[] = [];
    for (const para of text.split("\n")) {
      const lines: ShapedLine[] = para.trim()
        ? w.layoutParagraph(para, { size: o.size, bold: o.bold, width: CONTENT_W * MM, lang: o.lang })
        : [{ height: o.size * 1.45, ascent: o.size, draw: () => undefined }];
      for (const line of lines) {
        const pad = rows.length === 0 ? o.padTop ?? 0 : 0;
        rows.push({ h: pad + line.height / MM, keepWithNext: o.keepWithNext, draw: (top) => line.draw(page!, MARGIN * MM, (top + pad) * MM, o.color) });
      }
    }
    return rows;
  };
  const height = (rows: Row[]) => rows.reduce((s, r) => s + r.h, 0);

  // --- Title block -------------------------------------------------------------------------------
  newPage();
  let logoDrawn = false;
  if (options.logoPng) {
    try {
      const img = await doc.embedPng(options.logoPng);
      const h = 9, lw = Math.min(h * (img.width / img.height), 42);
      page!.drawImage(img, { x: MARGIN * MM, y: (PAGE_H - (y - 4) - h) * MM, width: lw * MM, height: h * MM });
      y += h + 2;
      logoDrawn = true;
    } catch {
      // Fall back to the text mark below.
    }
  }
  if (!logoDrawn) place([...textRows("Solace", { size: 12, bold: true, color: BRAND }), space(2)]);
  const header: Row[] = [...textRows(TRANSCRIPT_PDF_TITLE, { size: T_TITLE, bold: true, color: INK }), space(2.5)];
  meta.forEach((line, i) => header.push(...textRows(line, { size: T_BODY, color: line.startsWith("Session ID:") || line.startsWith("Exported:") ? MUTED : i === 0 ? INK : BODY, padTop: i === 0 ? 0 : 0.8 })));
  header.push(...textRows(zoneNote, { size: T_META, color: MUTED, padTop: 2.5 }));
  place(header);

  const ruleRow = (): Row => ({
    h: 1.6 + 4,
    draw: (top) => page!.drawLine({ start: { x: MARGIN * MM, y: (PAGE_H - top - 1.6) * MM }, end: { x: (MARGIN + CONTENT_W) * MM, y: (PAGE_H - top - 1.6) * MM }, thickness: 0.5 * MM, color: rgb(BRAND[0] / 255, BRAND[1] / 255, BRAND[2] / 255) }),
  });
  const section = (sectionTitle: string): Row[] => [space(5), ...textRows(sectionTitle, { size: T_SECTION, bold: true, color: INK, keepWithNext: true }), ruleRow()];

  // --- Saved summary -----------------------------------------------------------------------------
  const summary = textRows(summaryBody, { size: T_BODY, color: BODY });
  place([...section(t.summary.heading), ...summary], height([...section(t.summary.heading), ...summary.slice(0, 2)]));

  // --- Conversation ------------------------------------------------------------------------------
  place([...section("Conversation"), ...textRows(notes, { size: T_META, color: MUTED }), space(3)], 40);
  messages.forEach((m, index) => {
    const label = labels[index];
    // Speakers differ by label and colour only: Solace in brand violet, you in ink.
    const heading = textRows(label, { size: T_BODY, bold: true, color: m.speaker === "Solace" ? BRAND : INK, padTop: index ? 3 : 0 });
    const body = textRows(m.content, { size: T_BODY, color: BODY, padTop: 1 });
    // Keep the speaker/time heading with the first lines of the message.
    place(heading, height([...heading, ...body.slice(0, 2)]));
    const cont = textRows(`${label} (continued)`, { size: T_META, color: MUTED });
    onPageBreak = () => { for (const r of cont) { r.draw(y); y += r.h; } y += 2; };
    place(body);
    onPageBreak = null;
  });

  // --- Running header (pages 2+) and footer ----------------------------------------------------------
  const ruleAt = (p: PDFPage, at: number) => p.drawLine({ start: { x: MARGIN * MM, y: (PAGE_H - at) * MM }, end: { x: (MARGIN + CONTENT_W) * MM, y: (PAGE_H - at) * MM }, thickness: 0.25 * MM, color: rgb(RULE[0] / 255, RULE[1] / 255, RULE[2] / 255) });
  const small = (p: PDFPage, text: string, x: number, baseline: number) => {
    const [line] = w.layoutParagraph(text, { size: T_SMALL, width: CONTENT_W * MM, lang: "en", baseDir: "ltr" });
    line.draw(p, x, baseline * MM - line.ascent, MUTED);
  };
  pages.forEach((p, i) => {
    if (i > 0) {
      small(p, headerText, MARGIN * MM, HEADER_TEXT);
      ruleAt(p, HEADER_RULE);
    }
    ruleAt(p, FOOTER_RULE);
    small(p, FOOTER_LEFT, MARGIN * MM, FOOTER_TEXT);
    const label = `Page ${i + 1} of ${pages.length}`;
    small(p, label, (MARGIN + CONTENT_W) * MM - w.measure(label, T_SMALL), FOOTER_TEXT);
  });

  const bytes = await w.save();
  return { bytes, pages: pages.length, emojiReplacedCount: emoji, fonts: w.fontFiles() };
}
