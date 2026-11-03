/**
 * Resource Analytics PDF layout (runs in the PDF worker): the page's metrics and breakdowns for
 * the selected period, from a frozen snapshot, as a branded A4 document of readable tables.
 *
 *   Title block — logo, period and its exact range, generation time and time zone, the data
 *                 source (with the browser-fallback warning when it applies) and data limits
 *   Overview    — the four page metrics with their change vs the first half of the period
 *   Highlights  — active days, most used category, most active periods, top days
 *   Timeline    — interactions, views and engagements per day or week (zeros included)
 *   Resources   — every resource used in the period, ranked as on the page, then the breakdowns
 *                 by resource type and safety state
 *
 * Nothing is scored or interpreted here: every number comes from the snapshot unchanged.
 */
import { BODY, CAUTION, CONTENT_W, INK, MUTED, T_BODY, T_META, T_TITLE } from '@/lib/pdf/pdfBrand';
import { CHROME_STRINGS, ShapedReportLayout, tableStrings, type TableColumn } from '@/lib/pdf/shaped/shapedLayout';
import { EMOJI_MARKER, ShapedPdfWriter, type ShapingProgress, type ShapingRuntime } from '@/lib/pdf/shaped/shapedPdf';
import type { ResourceAnalyticsPdfSnapshot } from './resourceAnalyticsReport';

export const RESOURCE_ANALYTICS_PDF_TITLE = 'Resource Analytics';

export const RESOURCE_ANALYTICS_DEFINITIONS =
  'Interactions are views plus engagements. Engagements are calls, texts, visits, shares and copies. ' +
  'The support response rate is the share of interactions that were engagements.';

export interface ResourceAnalyticsPdfBuildOptions {
  /** Reader's locale: only used to choose Han glyph forms for CJK runs without kana/Hangul. */
  locale?: string;
  logoPng?: Uint8Array | null;
  onProgress?: (p: ShapingProgress) => void;
}

export interface ResourceAnalyticsPdfBuildResult {
  bytes: Uint8Array;
  pages: number;
  emojiReplacedCount: number;
  fonts: string[];
}

const n = (v: number) => v.toLocaleString('en-US');

export async function buildResourceAnalyticsPdf(
  s: ResourceAnalyticsPdfSnapshot,
  runtime: ShapingRuntime,
  options: ResourceAnalyticsPdfBuildOptions = {}
): Promise<ResourceAnalyticsPdfBuildResult> {
  const w = await ShapedPdfWriter.create(runtime, { title: RESOURCE_ANALYTICS_PDF_TITLE, locale: options.locale });

  // Recorded text (resource names, safety states) is drawn as stored, with emoji as "[emoji]".
  let emoji = 0;
  const prep = (text: string) => { const r = w.prepareText(text); emoji += r.emoji; return r.text; };
  const resources = s.resources.map((r) => ({ ...r, name: prep(r.name), type: prep(r.type) }));
  const byType = s.byType.map((t) => ({ ...t, type: prep(t.type) }));
  const bySafetyState = s.bySafetyState.map((t) => ({ ...t, state: prep(t.state) }));
  const highlights = s.highlights.map((h) => ({ ...h, value: prep(h.value) }));
  const empty = resources.length === 0;

  const meta = [`Period: ${s.periodLabel}`, s.periodRange, `Generated: ${s.generatedAt} (${s.timeZone})`];
  const zoneNote = [`Dates and times are in ${s.timeZone}.`, emoji > 0 ? `Emoji can't be shown in this PDF; each appears as ${EMOJI_MARKER}.` : '']
    .filter(Boolean)
    .join(' ');
  const headerText = `${RESOURCE_ANALYTICS_PDF_TITLE}  ·  ${s.periodLabel}`;
  const emptyNote = 'No activity recorded in this period.';

  // --- Tables -------------------------------------------------------------------------------------
  const overviewCols: TableColumn[] = [{ label: 'Metric', width: 62 }, { label: 'Value', width: 26, align: 'right' }, { label: '', width: 4 }, { label: 'Change', width: CONTENT_W - 92 }];
  const overviewRows = s.metrics.map((m) => [m.label, m.value, '', m.change]);
  const highlightCols: TableColumn[] = [{ label: 'Highlight', width: 62 }, { label: 'Value', width: CONTENT_W - 62 }];
  const highlightRows = highlights.map((h) => [h.label, h.value]);
  const timelineCols: TableColumn[] = [
    { label: s.timeline.interval === 'Weekly' ? 'Week' : 'Day', width: 66 },
    { label: 'Interactions', width: 36, align: 'right' },
    { label: 'Views', width: 36, align: 'right' },
    { label: 'Engagements', width: CONTENT_W - 138, align: 'right' },
  ];
  const timelineRows = s.timeline.rows.map((r) => [r.period, n(r.interactions), n(r.views), n(r.engagements)]);
  const resourceCols: TableColumn[] = [
    { label: '#', width: 9, align: 'right' },
    { label: '', width: 2 },
    { label: 'Resource', width: 55 },
    { label: 'Type', width: 37 },
    { label: 'Views', width: 16, align: 'right' },
    { label: 'Engagements', width: 28, align: 'right' },
    { label: '', width: 3 },
    { label: 'Last used', width: CONTENT_W - 150 },
  ];
  const resourceRows = resources.map((r) => [String(r.rank), '', r.name, r.type, n(r.views), n(r.engagements), '', r.lastUsed]);
  const detailCols: TableColumn[] = [
    { label: 'Resource', width: 72 },
    { label: 'Calls', width: 18, align: 'right' },
    { label: 'Texts', width: 18, align: 'right' },
    { label: 'Visits', width: 18, align: 'right' },
    { label: '', width: 4 },
    { label: 'First used', width: CONTENT_W - 130 },
  ];
  const detailRows = resources.map((r) => [r.name, n(r.calls), n(r.texts), n(r.visits), '', r.firstUsed]);
  const typeCols: TableColumn[] = [{ label: 'Resource type', width: 110 }, { label: 'Interactions', width: CONTENT_W - 110, align: 'right' }];
  const typeRows = byType.map((t) => [t.type, n(t.interactions)]);
  const stateCols: TableColumn[] = [{ label: 'Safety state', width: 110 }, { label: 'Interactions', width: CONTENT_W - 110, align: 'right' }];
  const stateRows = bySafetyState.map((t) => [t.state, n(t.interactions)]);

  const tables: Array<[TableColumn[], string[][]]> = [
    [overviewCols, overviewRows], [highlightCols, highlightRows], [timelineCols, timelineRows], [resourceCols, resourceRows],
    [detailCols, detailRows], [typeCols, typeRows], [stateCols, stateRows],
  ];
  const sectionTitles = ['Overview', 'Highlights', `Support Activity Timeline (${s.timeline.interval})`, 'Resources', 'Activity by resource type', 'Activity by safety state'];
  const notes = [
    s.comparisonNote, RESOURCE_ANALYTICS_DEFINITIONS, s.timeline.note ?? '', emptyNote, s.sourceLabel, s.warning ?? '', ...s.limits, zoneNote,
    'Ranked by views plus engagements, as on the page.', 'Engagement types per resource. Engagements also include shares and copies.',
    'No safety state was recorded for this activity.',
  ];

  // Fetch only the fonts this report needs; unsupported text fails here, before any drawing.
  await w.ensureFonts(
    [...meta, ...notes, headerText, ...CHROME_STRINGS, ...tables.flatMap(([c, r]) => tableStrings(c, r).regular)],
    [RESOURCE_ANALYTICS_PDF_TITLE, ...sectionTitles, 'Solace', ...tables.flatMap(([c, r]) => tableStrings(c, r).bold)],
    options.onProgress
  );

  // --- Title block --------------------------------------------------------------------------------
  const L = new ShapedReportLayout(w);
  await L.logo(options.logoPng);
  L.place([
    ...L.textRows(RESOURCE_ANALYTICS_PDF_TITLE, { size: T_TITLE, bold: true, color: INK }),
    L.space(2.5),
    ...meta.flatMap((line, i) => L.textRows(line, { size: T_BODY, color: i === 0 ? INK : i === 2 ? MUTED : BODY, padTop: i ? 0.8 : 0 })),
    ...L.textRows(s.sourceLabel, { size: T_BODY, color: BODY, padTop: 2.5 }),
    ...(s.warning ? L.textRows(s.warning, { size: T_BODY, color: CAUTION, padTop: 1 }) : []),
    ...s.limits.flatMap((l) => L.textRows(l, { size: T_META, color: MUTED, padTop: 1 })),
    ...L.textRows(zoneNote, { size: T_META, color: MUTED, padTop: 2.5 }),
  ]);

  const note = (text: string, padTop = 2) => L.textRows(text, { size: T_META, color: MUTED, padTop });
  const section = (title: string, intro: string[] = []) => {
    const rows = [...L.section(title), ...intro.flatMap((t, i) => note(t, i ? 1 : 0)), ...(intro.length ? [L.space(2)] : [])];
    L.place(rows, L.height(rows) + 20);
  };

  // --- Overview and highlights ----------------------------------------------------------------------
  section('Overview');
  L.table(overviewCols, overviewRows);
  L.place([...note(s.comparisonNote), ...note(RESOURCE_ANALYTICS_DEFINITIONS, 1)]);

  section('Highlights');
  L.table(highlightCols, highlightRows);

  // --- Timeline ---------------------------------------------------------------------------------------
  section(`Support Activity Timeline (${s.timeline.interval})`, s.timeline.note ? [s.timeline.note] : []);
  if (timelineRows.length) L.table(timelineCols, timelineRows);
  else L.place(note(emptyNote, 0));

  // --- Resources and breakdowns ---------------------------------------------------------------------
  section('Resources', empty ? [] : ['Ranked by views plus engagements, as on the page.']);
  if (empty) L.place(note(emptyNote, 0));
  else {
    L.table(resourceCols, resourceRows);
    L.place([...note('Engagement types per resource. Engagements also include shares and copies.', 4), L.space(2)]);
    L.table(detailCols, detailRows);
  }

  section('Activity by resource type');
  if (typeRows.length) L.table(typeCols, typeRows);
  else L.place(note(emptyNote, 0));

  section('Activity by safety state');
  if (stateRows.length) L.table(stateCols, stateRows);
  else L.place(note(empty ? emptyNote : 'No safety state was recorded for this activity.', 0));

  L.finish(headerText);
  const bytes = await w.save();
  return { bytes, pages: L.pages.length, emojiReplacedCount: emoji, fonts: w.fontFiles() };
}
