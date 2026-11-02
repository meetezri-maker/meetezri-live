/**
 * Session Transcript PDF (row download menu / popup "Export Transcript" → Download PDF): the same
 * transcript document as the TXT, as a branded A4 reading document.
 *
 *   Title block  — logo, "Session Transcript", session title and ID, recorded companion, recorded
 *                  start and duration, export time and time zone
 *   Summary      — the saved summary under its provenance heading (or "No saved summary available.")
 *   Conversation — the saved-messages and recorded-times notes, then every user/assistant message
 *                  with its speaker and recorded time, word for word, in a single column
 *
 * Long messages continue on following pages under a "(continued)" label; nothing is truncated.
 * Loaded on demand, so the TXT download never loads jsPDF or the fonts.
 */
import type { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ARABIC_SCRIPT, EMOJI_MARKER, loadPdfFonts, setupPdfText, type PdfFontFiles } from "@/lib/pdf/pdfText";
import { loadLogo, type LogoImage } from "@/lib/pdf/pdfLogo";
import { PdfWriter, stampPages, type Row } from "@/lib/pdf/pdfWriter";
import { BODY, BRAND, INK, MUTED, NBSP, T_BODY, T_META, T_SECTION, T_TITLE } from "@/lib/pdf/pdfBrand";
import { RECORDED_TIMES_NOTE, SAVED_MESSAGES_NOTE, type TranscriptDocument } from "./sessionTranscriptExport";

export const TRANSCRIPT_PDF_TITLE = "Session Transcript";

/** e.g. `solace-session-<id>-2026-10-27-transcript.pdf` (same safe stem as the TXT). */
export function transcriptPdfFileName(doc: Pick<TranscriptDocument, "fileStem">): string {
  return `${doc.fileStem}.pdf`;
}

/** "27 Oct 2026, 21:00" in local time (no-break spaces keep the date on one line). */
const dateTime = (d: Date) => `${format(d, "d MMM yyyy").replace(/ /g, NBSP)}, ${format(d, "HH:mm")}`;

/** Every string drawn from the stored session, for font choice and the coverage check. */
function sessionStrings(doc: TranscriptDocument): string[] {
  const lines = [doc.title, doc.companion ?? "", doc.summary.body, ...doc.messages.map((m) => m.content)];
  return lines.flatMap((s) => s.split("\n")).filter((s) => s.trim());
}

export function transcriptNeedsArabicFont(doc: TranscriptDocument): boolean {
  return sessionStrings(doc).some((s) => ARABIC_SCRIPT.test(s));
}

export interface TranscriptPdfBuildOptions {
  fonts: PdfFontFiles;
  logo?: LogoImage | null;
}

export interface BuiltTranscriptPdf {
  doc: jsPDF;
  emojiReplacedCount: number;
  usedUnicodeFont: boolean;
}

export async function buildSessionTranscriptPdf(t: TranscriptDocument, options: TranscriptPdfBuildOptions): Promise<BuiltTranscriptPdf> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ unit: "mm", format: "a4" });
  doc.setProperties({ title: TRANSCRIPT_PDF_TITLE, creator: "Solace" });
  const kit = setupPdfText(doc, options.fonts);
  const w = new PdfWriter(doc, kit);

  // Fail before drawing anything if some text cannot be drawn faithfully; count emoji markers.
  let emoji = 0;
  for (const s of sessionStrings(t)) emoji += kit.prepare(s).emojiReplaced;

  // --- Title block ------------------------------------------------------------------------------
  w.logo(options.logo ?? null);
  const header: Row[] = [
    ...w.textRows(TRANSCRIPT_PDF_TITLE, { style: "bold", size: T_TITLE, color: INK }),
    w.space(2.5),
    ...w.textRows(`Session: ${t.title}`, { size: T_BODY, color: INK }),
    ...w.textRows(`Session ID: ${t.sessionId}`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
  ];
  if (t.companion) header.push(...w.textRows(`Companion: ${t.companion}`, { size: T_BODY, color: BODY, padTop: 0.8 }));
  header.push(
    ...w.textRows(`Started: ${t.started ? dateTime(t.started) : "Not recorded"}`, { size: T_BODY, color: BODY, padTop: 0.8 }),
    ...w.textRows(`Duration: ${t.duration}`, { size: T_BODY, color: BODY, padTop: 0.8 }),
    ...w.textRows(`Exported: ${dateTime(t.exportedAt)} (${t.timeZone})`, { size: T_BODY, color: MUTED, padTop: 0.8 }),
    ...w.textRows(
      [`Dates and times are in ${t.timeZone}.`, emoji > 0 ? `Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.` : ""].filter(Boolean).join(" "),
      { size: T_META, color: MUTED, padTop: 2.5 }
    )
  );
  w.place(header);

  const section = (title: string): Row[] => [
    w.space(5),
    ...w.textRows(title, { style: "bold", size: T_SECTION, color: INK, keepWithNext: true }),
    w.rule(BRAND, 0.5, 1.6, 4),
  ];

  // --- Saved summary ----------------------------------------------------------------------------
  const summary = w.textRows(t.summary.body, { size: T_BODY, color: BODY });
  w.place([...section(t.summary.heading), ...summary], [...section(t.summary.heading), ...summary.slice(0, 2)].reduce((s, r) => s + r.h, 0));

  // --- Conversation -----------------------------------------------------------------------------
  const notes = w.textRows(`${SAVED_MESSAGES_NOTE} ${RECORDED_TIMES_NOTE}`, { size: T_META, color: MUTED });
  w.place([...section("Conversation"), ...notes, w.space(3)], 40);

  t.messages.forEach((m, index) => {
    const label = `${m.speaker}  ·  ${m.time}`;
    // Speakers differ by label and colour only (restrained): Solace in brand violet, you in ink.
    const heading = w.textRows(label, { style: "bold", size: T_BODY, color: m.speaker === "Solace" ? BRAND : INK, padTop: index ? 3 : 0 });
    const body = w.textRows(m.content, { size: T_BODY, color: BODY, padTop: 1 });
    // Keep the speaker/time heading with the first lines of the message.
    w.place(heading, [...heading, ...body.slice(0, 2)].reduce((s, r) => s + r.h, 0));
    const cont = w.textRows(`${label} (continued)`, { size: T_META, color: MUTED });
    w.setPageBreakHook(() => {
      for (const r of cont) {
        r.draw(w.y);
        w.y += r.h;
      }
      w.y += 2;
    });
    w.place(body);
    w.setPageBreakHook(null);
  });

  const headerText = `${TRANSCRIPT_PDF_TITLE}  ·  ${t.started ? format(t.started, "d MMM yyyy") : "Start not recorded"}`;
  stampPages(doc, kit, headerText);
  return { doc, emojiReplacedCount: emoji, usedUnicodeFont: kit.unicode };
}

/**
 * Loads the PDF fonts (the Urdu font only when the transcript needs it) and the logo, then builds
 * the PDF. Throws `PdfUnsupportedTextError` when text cannot be drawn faithfully.
 */
export async function createSessionTranscriptPdf(t: TranscriptDocument): Promise<BuiltTranscriptPdf> {
  const [fonts, logo] = await Promise.all([loadPdfFonts(transcriptNeedsArabicFont(t)), loadLogo()]);
  return buildSessionTranscriptPdf(t, { fonts, logo });
}
