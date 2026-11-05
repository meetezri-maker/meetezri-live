/**
 * Account Data Report layout (runs in the PDF worker): the allowlisted account fields from the
 * frozen snapshot, one Field / Value table per section, as a branded A4 document.
 *
 *   Title block — logo, "Account Data Report", generation date, time and time zone, that this is
 *                 a snapshot of the account as it was then, and what the report does and does
 *                 not contain
 *   Sections    — Account, Profile, Wellness preferences, Privacy settings, Notification
 *                 preferences, Emergency contacts, Membership: every field, values as stored
 */
import { BODY, CONTENT_W, INK, MUTED, T_BODY, T_META, T_TITLE } from '@/lib/pdf/pdfBrand';
import { CHROME_STRINGS, ShapedReportLayout, tableStrings, type TableColumn } from '@/lib/pdf/shaped/shapedLayout';
import { EMOJI_MARKER, ShapedPdfWriter, type ShapingProgress, type ShapingRuntime } from '@/lib/pdf/shaped/shapedPdf';
import { ACCOUNT_DATA_EMPTY_LIST, ACCOUNT_DATA_NOT_PROVIDED, type AccountDataPdfSnapshot } from './accountDataPdfSnapshot';

export const ACCOUNT_DATA_PDF_TITLE = 'Account Data Report';

export const ACCOUNT_DATA_SNAPSHOT_NOTE =
  'This is a snapshot of the values saved on your account when the report was generated. It is not a history of changes.';

export const ACCOUNT_DATA_LEGEND = `Values are shown as stored. “${ACCOUNT_DATA_NOT_PROVIDED}” means no value is saved for that field; “${ACCOUNT_DATA_EMPTY_LIST}” means an empty list.`;

export interface AccountDataPdfBuildOptions {
  /** Reader's locale: only used to choose Han glyph forms for CJK runs without kana/Hangul. */
  locale?: string;
  logoPng?: Uint8Array | null;
  onProgress?: (p: ShapingProgress) => void;
}

export interface AccountDataPdfBuildResult {
  bytes: Uint8Array;
  pages: number;
  emojiReplacedCount: number;
  fonts: string[];
}

export async function buildAccountDataPdf(
  s: AccountDataPdfSnapshot,
  runtime: ShapingRuntime,
  options: AccountDataPdfBuildOptions = {}
): Promise<AccountDataPdfBuildResult> {
  const w = await ShapedPdfWriter.create(runtime, { title: ACCOUNT_DATA_PDF_TITLE, locale: options.locale });

  // Saved values are drawn as stored (direction controls included), with emoji as "[emoji]".
  let emoji = 0;
  const prep = (text: string) => { const r = w.prepareText(text); emoji += r.emoji; return r.text; };
  const sections = s.sections.map((sec) => ({ title: sec.title, rows: sec.rows.map((r) => [r.label, prep(r.value)]) }));

  const meta = `Generated: ${s.generatedAt} (${s.timeZone})`;
  const scope = `This report contains: ${s.contents} ${s.exclusions}`;
  const zoneNote = [`Dates and times are in ${s.timeZone}; saved dates such as Account created are shown exactly as stored.`, emoji > 0 ? `Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.` : '']
    .filter(Boolean)
    .join(' ');
  const headerText = `${ACCOUNT_DATA_PDF_TITLE}  ·  Generated ${s.generatedAt}`;
  const columns: TableColumn[] = [{ label: 'Field', width: 64 }, { label: 'Value', width: CONTENT_W - 64 }];

  // Fetch only the fonts this report needs; unsupported text fails here, before any drawing.
  await w.ensureFonts(
    [meta, ACCOUNT_DATA_SNAPSHOT_NOTE, scope, ACCOUNT_DATA_LEGEND, zoneNote, headerText, ...CHROME_STRINGS, ...sections.flatMap((sec) => tableStrings(columns, sec.rows).regular)],
    [ACCOUNT_DATA_PDF_TITLE, 'Solace', ...sections.map((sec) => sec.title), ...tableStrings(columns, []).bold],
    options.onProgress
  );

  const L = new ShapedReportLayout(w);
  await L.logo(options.logoPng);
  L.place([
    ...L.textRows(ACCOUNT_DATA_PDF_TITLE, { size: T_TITLE, bold: true, color: INK }),
    L.space(2.5),
    ...L.textRows(meta, { size: T_BODY, color: INK }),
    ...L.textRows(ACCOUNT_DATA_SNAPSHOT_NOTE, { size: T_BODY, color: BODY, padTop: 1.5 }),
    ...L.textRows(scope, { size: T_META, color: MUTED, padTop: 2.5 }),
    ...L.textRows(ACCOUNT_DATA_LEGEND, { size: T_META, color: MUTED, padTop: 1 }),
    ...L.textRows(zoneNote, { size: T_META, color: MUTED, padTop: 1 }),
  ]);

  // Each section heading stays with its table's header and first rows.
  for (const sec of sections) L.table(columns, sec.rows, { lead: L.section(sec.title) });

  L.finish(headerText);
  const bytes = await w.save();
  return { bytes, pages: L.pages.length, emojiReplacedCount: emoji, fonts: w.fontFiles() };
}
