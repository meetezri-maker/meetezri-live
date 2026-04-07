import { jsPDF } from "jspdf";
import { htmlToPlainText } from "./htmlPlainText";

/** Minimal shape for journal export (matches Journal page entry fields). */
export interface JournalExportEntry {
  id: string;
  title: string | null;
  content: string | null;
  mood_tags: string[];
  is_private: boolean | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  favorite?: boolean;
  /** Present on API payloads; UI also sets `favorite`. */
  is_favorite?: boolean | null;
}

/** YYYY-MM-DD in the user's local calendar — matches `<input type="date">` semantics. */
export function localDateKey(isoOrDate: string | Date): string {
  const d =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getEntryContent(e: JournalExportEntry): string {
  const c = e.content;
  return typeof c === "string" ? c : "";
}

export function getEntryFavorite(e: JournalExportEntry): boolean {
  return Boolean(e.favorite ?? e.is_favorite);
}

export function filterJournalEntriesByDateRange(
  entries: JournalExportEntry[],
  dateFrom: string,
  dateTo: string
): JournalExportEntry[] {
  if (!dateFrom && !dateTo) return [...entries];

  let from = dateFrom;
  let to = dateTo;
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return entries.filter((e) => {
    const key = localDateKey(e.created_at);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  });
}

export function buildJournalJsonExport(
  entries: JournalExportEntry[],
  exportedAt: Date
): string {
  const payload = {
    exportVersion: 1,
    app: "Ezri Journal",
    exportedAt: exportedAt.toISOString(),
    entryCount: entries.length,
    entries: entries
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((e) => ({
        id: e.id,
        title: e.title,
        contentHtml: getEntryContent(e) || null,
        contentPlain: (() => {
          const html = getEntryContent(e);
          return html ? htmlToPlainText(html) : "";
        })(),
        moodTags: Array.isArray(e.mood_tags) ? e.mood_tags : [],
        favorite: getEntryFavorite(e),
        isPrivate: e.is_private,
        location: e.location,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
  };
  return JSON.stringify(payload, null, 2);
}

const PDF_MARGIN = 20;
const PDF_LINE = 5.5;
const PDF_TITLE_SIZE = 13;
const PDF_BODY_SIZE = 10;
const PDF_META_SIZE = 9;
const PDF_BOTTOM = 287;

function nextY(doc: jsPDF, y: number, step: number): number {
  if (y + step > PDF_BOTTOM) {
    doc.addPage();
    return PDF_MARGIN + step;
  }
  return y + step;
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  maxW: number,
  y: number,
  lineH: number,
  draw: (line: string, yy: number) => void
): number {
  const lines = doc.splitTextToSize(text, maxW);
  let cy = y;
  for (const line of lines) {
    if (cy + lineH > PDF_BOTTOM) {
      doc.addPage();
      cy = PDF_MARGIN;
    }
    draw(line, cy);
    cy += lineH;
  }
  return cy;
}

export function buildJournalPdf(entries: JournalExportEntry[]): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - PDF_MARGIN * 2;

  let y = PDF_MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ezri Journal Export", PDF_MARGIN, y);
  y = nextY(doc, y, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_META_SIZE);
  doc.setTextColor(80, 80, 80);
  y = writeWrapped(
    doc,
    `Exported ${new Date().toLocaleString()} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
    maxW,
    y,
    PDF_LINE,
    (line, yy) => doc.text(line, PDF_MARGIN, yy)
  );
  y += 4;
  doc.setTextColor(0, 0, 0);

  const sorted = [...entries].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const title = e.title?.trim() || "Untitled Entry";
    const when = new Date(e.created_at).toLocaleString();
    const tags = Array.isArray(e.mood_tags) ? e.mood_tags : [];
    const moods = tags.length > 0 ? `Mood: ${tags.join(", ")}` : "";
    const fav = getEntryFavorite(e) ? " · Favorite" : "";
    const raw = getEntryContent(e);
    const plain = raw ? htmlToPlainText(raw) : "(No body)";

    if (i > 0) {
      y += 3;
      if (y + 8 > PDF_BOTTOM) {
        doc.addPage();
        y = PDF_MARGIN;
      }
      doc.setDrawColor(220, 220, 220);
      doc.line(PDF_MARGIN, y, pageW - PDF_MARGIN, y);
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_TITLE_SIZE);
    y = writeWrapped(doc, title, maxW, y, PDF_LINE + 1, (line, yy) =>
      doc.text(line, PDF_MARGIN, yy)
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_META_SIZE);
    doc.setTextColor(70, 70, 70);
    y = writeWrapped(
      doc,
      `${when}${fav}`,
      maxW,
      y,
      PDF_LINE,
      (line, yy) => doc.text(line, PDF_MARGIN, yy)
    );
    if (moods) {
      y = writeWrapped(doc, moods, maxW, y, PDF_LINE, (line, yy) =>
        doc.text(line, PDF_MARGIN, yy)
      );
    }
    doc.setTextColor(0, 0, 0);

    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_BODY_SIZE);
    y = writeWrapped(doc, plain, maxW, y, PDF_LINE, (line, yy) =>
      doc.text(line, PDF_MARGIN, yy)
    );
  }

  return doc;
}
