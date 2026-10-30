/**
 * Goals & Achievements Progress Report PDF — PRESENTATION ONLY.
 *
 * Every number, label, date and summary line comes verbatim from the report returned by
 * GET /api/gamification/report. Nothing is recalculated here; the renderer only lays the
 * backend response out on A4 pages:
 *
 *   Cover (title, reporting dates, generated time + time zone)
 *   Summary — current snapshot (as of the period end) and activity during the period, once each
 *   Goal progress — active Goals, then active Personal Achievements
 *   Completed during this period
 *   Needs attention
 *   Check-in notes (wins, challenges, reflections, notes, moods)
 *   Points history
 *   Report notes (the backend's closing summary)
 *
 * Layout: every block is measured before it is drawn, separators sit below the full row,
 * tables repeat their header on continuation pages, and anything taller than a page flows
 * line by line instead of being clipped. Text uses the export-only Unicode font when it
 * loads (see progress-report.pdf-text.ts); text the font cannot draw is replaced by a visible
 * notice, never silently dropped.
 */
import type { jsPDF } from "jspdf";
import {
  ITEM_TYPE_LABELS,
  TRACKING_METHOD_LABELS,
  attentionReasonLabel,
  formatNumericProgress,
  formatSignedPoints,
  humanizeToken,
  originLabel,
  rewardSourceLabel,
  statusLabel,
} from "./progress-report.utils";
import type {
  ProgressReport,
  ProgressReportItem,
  ProgressReportItemType,
  ProgressReportTextEntry,
} from "./progress-report.types";
import {
  ARABIC_SCRIPT,
  EMOJI_MARKER,
  loadPdfFonts,
  setupPdfText,
  type PdfFontFiles,
  type PdfTextKit,
} from "./progress-report.pdf-text";
import { loadLogo, type LogoImage } from "@/lib/pdf/pdfLogo";

type Doc = jsPDF;
type RGB = [number, number, number];
type Style = "normal" | "bold";

// --- Geometry (A4, millimetres) ---------------------------------------------------------------
const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const CONTENT_W = PAGE_W - M * 2; // 174
const FIRST_TOP = 20;
const TOP = 27; // below the running header on continuation pages
const BOTTOM = 274; // content never goes below this
const FOOTER_RULE = 281;
const FOOTER_TEXT = 287;
/** Blocks up to this height (mm) are moved whole to the next page rather than split. */
const KEEP_TOGETHER_MAX = 90;

// --- Type (pt) --------------------------------------------------------------------------------
const T_TITLE = 19;
const T_SECTION = 13;
const T_SUB = 10.5;
const T_BODY = 9.5;
const T_META = 8.5;
const T_SMALL = 7.5;
const PT = 0.3528; // mm per pt

const lineH = (size: number) => size * PT * 1.42;
const ascent = (size: number) => size * PT * 0.78;
const descent = (size: number) => size * PT * 0.24;

// --- Print-friendly palette ---------------------------------------------------------------------
const INK: RGB = [17, 24, 39];
const BODY: RGB = [40, 46, 58];
const MUTED: RGB = [96, 104, 117];
const BRAND: RGB = [109, 40, 217];
const RULE: RGB = [221, 223, 230];
const TRACK: RGB = [232, 229, 243];
const CAUTION: RGB = [154, 72, 6];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** No-break space: keeps "27 Oct 2026" on one line when text wraps. */
const NBSP = " ";

/** "2026-10-27" → "27 Oct 2026" from the calendar parts (no time-zone conversion). */
export function formatReportDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? [Number(m[3]), month, m[1]].join(NBSP) : value;
}

/** The report's inclusive period, e.g. "Last 30 days: 29 Sep 2026 – 28 Oct 2026". */
export function formatReportPeriod(report: ProgressReport): string {
  const end = formatReportDay(report.period.end) ?? report.period.end;
  if (!report.period.start) return `${report.period.label}, through ${end}`;
  return `${report.period.label}: ${formatReportDay(report.period.start)} – ${end}`;
}

/** Generated time in the report's own time zone; falls back to this device's zone. */
export function formatGeneratedAt(report: ProgressReport): { text: string; timeZone: string } {
  const at = new Date(report.generatedAt);
  if (Number.isNaN(at.getTime())) return { text: "Not recorded", timeZone: report.timezone || "" };
  const fmt = (timeZone?: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(at);
  try {
    return { text: fmt(report.timezone), timeZone: report.timezone };
  } catch {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "device time";
    return { text: fmt(undefined), timeZone: local };
  }
}

/** `solace-goals-progress-report-2026-09-29-to-2026-10-28.pdf` (all time: `…-all-time-to-…`). */
export function progressReportFileName(report: ProgressReport): string {
  const safe = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
  const end = safe(report.period.end) ?? "undated";
  const start = safe(report.period.start);
  return start
    ? `solace-goals-progress-report-${start}-to-${end}.pdf`
    : `solace-goals-progress-report-all-time-to-${end}.pdf`;
}

// ---------------------------------------------------------------------------------------------
// Writer: cursor, pages, measured text
// ---------------------------------------------------------------------------------------------

interface Row {
  h: number;
  draw: (top: number) => void;
}

/** One wrapped line and the font family it is drawn in. */
interface Line {
  text: string;
  family: string;
}

class Writer {
  y = FIRST_TOP;
  private onPageBreak: (() => void) | null = null;

  constructor(readonly d: Doc, readonly kit: PdfTextKit) {}

  font(style: Style, size: number, color: RGB = BODY, family: string = this.kit.baseFamily): void {
    this.d.setFont(family, style);
    this.d.setFontSize(size);
    this.d.setTextColor(color[0], color[1], color[2]);
  }

  /** User-authored or backend text, normalised (NFC, trailing spaces removed); content is kept as typed. */
  safe(text: string | null | undefined): string {
    const t = (text ?? "").normalize("NFC").replace(/ /g, " ").replace(/[ \t]+$/gm, "");
    return t;
  }

  /** Wraps prepared text; long unbroken words are split so nothing runs past `width`. */
  wrap(text: string, width: number, style: Style, size: number, family: string = this.kit.baseFamily): string[] {
    if (!text) return [];
    this.d.setFont(family, style);
    this.d.setFontSize(size);
    const out: string[] = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) {
        out.push("");
        continue;
      }
      for (const line of this.d.splitTextToSize(para, width) as string[]) {
        if (this.d.getTextWidth(line) <= width + 0.5) {
          out.push(line);
          continue;
        }
        // splitTextToSize leaves a single over-long token intact: break it by characters.
        let chunk = "";
        for (const ch of Array.from(line)) {
          if (chunk && this.d.getTextWidth(chunk + ch) > width) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        if (chunk) out.push(chunk);
      }
    }
    return out;
  }

  /**
   * Prepares each paragraph (complete text, its font chosen by script, emoji marked) and wraps
   * it. Throws `PdfUnsupportedTextError` when a paragraph cannot be drawn faithfully.
   */
  layout(text: string, width: number, style: Style, size: number): Line[] {
    if (!text) return [];
    const out: Line[] = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) {
        out.push({ text: "", family: this.kit.baseFamily });
        continue;
      }
      const p = this.kit.prepare(para, style);
      for (const ln of this.wrap(p.text, width, style, size, p.family)) out.push({ text: ln, family: p.family });
    }
    return out;
  }

  /** Draws one wrapped line; right-to-left lines are right-aligned within the box. */
  line(text: string, x: number, baseline: number, width: number, align: "left" | "right" = "left"): void {
    if (!text) return;
    const opts = this.kit.textOptions(text);
    const rtl = !!opts;
    const right = align === "right" || rtl;
    this.d.text(text, right ? x + width : x, baseline, { ...(opts ?? {}), ...(right ? { align: "right" } : {}) });
  }

  newPage(): void {
    this.d.addPage();
    this.y = TOP;
    this.onPageBreak?.();
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) this.newPage();
  }

  withPageBreakHook<T>(hook: () => void, body: () => T): T {
    const prev = this.onPageBreak;
    this.onPageBreak = hook;
    try {
      return body();
    } finally {
      this.onPageBreak = prev;
    }
  }

  /**
   * Keeps a short block (an item card, a short note) together on one page; longer text flows
   * from where it is, keeping at least its first two rows with what precedes it.
   */
  block(rows: Row[], gapAfter = 0): void {
    const total = rows.reduce((s, r) => s + r.h, 0);
    if (total <= KEEP_TOGETHER_MAX) this.ensure(total);
    else this.ensure(rows.slice(0, 2).reduce((s, r) => s + r.h, 0));
    for (const r of rows) {
      this.ensure(r.h);
      r.draw(this.y);
      this.y += r.h;
    }
    this.y += gapAfter;
  }

  /** Rows for a wrapped paragraph (one row per line, so long text can cross pages). */
  textRows(
    text: string,
    opts: { style?: Style; size?: number; color?: RGB; x?: number; width?: number; padTop?: number }
  ): Row[] {
    const style = opts.style ?? "normal";
    const size = opts.size ?? T_BODY;
    const color = opts.color ?? BODY;
    const x = opts.x ?? M;
    const width = opts.width ?? CONTENT_W;
    const lines = this.layout(text, width, style, size);
    return lines.map((ln, i) => {
      const first = i === 0;
      const h = (first ? (opts.padTop ?? 0) + ascent(size) : lineH(size)) + (i === lines.length - 1 ? descent(size) : 0);
      return {
        h,
        draw: (top: number) => {
          this.font(style, size, color, ln.family);
          const baseline = top + (first ? (opts.padTop ?? 0) + ascent(size) : lineH(size));
          this.line(ln.text, x, baseline, width);
        },
      };
    });
  }

  space(h: number): Row {
    return { h, draw: () => undefined };
  }

  rule(color: RGB = RULE, width = 0.25, gapBefore = 2, gapAfter = 3): Row {
    return {
      h: gapBefore + gapAfter,
      draw: (top) => {
        this.d.setDrawColor(color[0], color[1], color[2]);
        this.d.setLineWidth(width);
        this.d.line(M, top + gapBefore, M + CONTENT_W, top + gapBefore);
      },
    };
  }

  /** Section heading kept with at least `minFollowing` mm of the content after it. */
  section(title: string, minFollowing = 24): void {
    const rows = [this.space(this.y > TOP + 1 ? 5 : 0), ...this.textRows(title, { style: "bold", size: T_SECTION, color: INK }), this.rule(BRAND, 0.5, 1.6, 4)];
    const h = rows.reduce((s, r) => s + r.h, 0);
    this.ensure(h + minFollowing);
    this.block(rows);
  }

  subheading(title: string, minFollowing = 10): void {
    const rows = [this.space(2), ...this.textRows(title, { style: "bold", size: T_SUB, color: INK }), this.space(1.5)];
    this.ensure(rows.reduce((s, r) => s + r.h, 0) + minFollowing);
    this.block(rows);
  }

  muted(text: string, gapAfter = 2): void {
    this.block(this.textRows(text, { size: T_BODY, color: MUTED }), gapAfter);
  }

  progressBar(x: number, top: number, w: number, pct: number): void {
    const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    const h = 2.6;
    this.d.setFillColor(TRACK[0], TRACK[1], TRACK[2]);
    this.d.roundedRect(x, top, w, h, 1.3, 1.3, "F");
    if (safe > 0) {
      this.d.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
      this.d.roundedRect(x, top, Math.max((w * safe) / 100, 2.6), h, 1.3, 1.3, "F");
    }
  }

  /**
   * Table with wrapped cells. Each row is measured first; its separator is drawn below the
   * whole row; the header repeats at the top of continuation pages.
   */
  table(columns: Array<{ label: string; width: number; align?: "left" | "right" }>, rows: string[][]): void {
    const padX = 1.5;
    const padTop = 2;
    const padBottom = 2;
    const xs: number[] = [];
    columns.reduce((x, c) => (xs.push(x), x + c.width), M);

    const drawHeader = () => {
      const h = padTop + ascent(T_META) + descent(T_META) + padBottom;
      this.font("bold", T_META, MUTED);
      columns.forEach((c, i) => this.line(c.label, xs[i] + padX, this.y + padTop + ascent(T_META), c.width - padX * 2, c.align));
      this.d.setDrawColor(RULE[0], RULE[1], RULE[2]);
      this.d.setLineWidth(0.4);
      this.d.line(M, this.y + h, M + CONTENT_W, this.y + h);
      this.y += h + 0.6;
    };

    const headerH = padTop + ascent(T_META) + descent(T_META) + padBottom + 0.6;
    const measured = rows.map((cells) => {
      const wrapped = cells.map((cell, i) => this.layout(cell, columns[i].width - padX * 2, "normal", T_BODY));
      const n = Math.max(1, ...wrapped.map((w) => w.length));
      return { wrapped, n, rowH: padTop + ascent(T_BODY) + (n - 1) * lineH(T_BODY) + descent(T_BODY) + padBottom };
    });
    // Never leave a header alone at the bottom of a page: keep it with its first row.
    this.ensure(headerH + Math.min(measured[0]?.rowH ?? 0, BOTTOM - TOP - headerH));
    drawHeader();

    this.withPageBreakHook(drawHeader, () => {
      for (const { wrapped, n, rowH } of measured) {
        if (rowH <= BOTTOM - TOP - headerH) {
          this.ensure(rowH);
          this.drawRow(wrapped, columns, xs, padX, padTop, 0, n);
          this.y += rowH;
          this.separator();
        } else {
          // Taller than a page: continue the row's lines on following pages.
          let from = 0;
          while (from < n) {
            const avail = BOTTOM - this.y - padTop - ascent(T_BODY) - descent(T_BODY) - padBottom;
            const fit = Math.max(1, Math.floor(avail / lineH(T_BODY)) + 1);
            const to = Math.min(n, from + fit);
            this.drawRow(wrapped, columns, xs, padX, padTop, from, to);
            this.y += padTop + ascent(T_BODY) + (to - from - 1) * lineH(T_BODY) + descent(T_BODY) + padBottom;
            from = to;
            if (from < n) this.newPage();
          }
          this.separator();
        }
      }
    });
    this.y += 2;
  }

  private drawRow(
    wrapped: Line[][],
    columns: Array<{ width: number; align?: "left" | "right" }>,
    xs: number[],
    padX: number,
    padTop: number,
    from: number,
    to: number
  ): void {
    wrapped.forEach((lines, i) => {
      lines.slice(from, to).forEach((ln, k) => {
        this.font("normal", T_BODY, BODY, ln.family);
        this.line(ln.text, xs[i] + padX, this.y + padTop + ascent(T_BODY) + k * lineH(T_BODY), columns[i].width - padX * 2, columns[i].align);
      });
    });
  }

  private separator(): void {
    this.d.setDrawColor(RULE[0], RULE[1], RULE[2]);
    this.d.setLineWidth(0.2);
    this.d.line(M, this.y, M + CONTENT_W, this.y);
  }
}

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------

const valueOrUnavailable = (v: number | null, suffix = "") => (v === null ? "Not available" : `${v}${suffix}`);

function cover(w: Writer, report: ProgressReport, logo: LogoImage | null, generated: { text: string; timeZone: string }, emojiReplaced: number): void {
  const { d } = w;
  if (logo) {
    try {
      d.addImage(logo.dataUrl, "PNG", M, w.y - 4, logo.width, logo.height);
      w.y += logo.height + 2;
    } catch {
      logo = null;
    }
  }
  if (!logo) {
    w.block(w.textRows("Solace", { style: "bold", size: 12, color: BRAND }), 2);
  }
  w.block(w.textRows("Goals & Achievements Progress Report", { style: "bold", size: T_TITLE, color: INK }), 2.5);
  const name = w.safe(report.user.displayName);
  if (name) w.block(w.textRows(name, { size: T_SUB, color: BODY }), 1.5);
  w.block(w.textRows(`Reporting period: ${formatReportPeriod(report)} (dates inclusive)`, { size: T_BODY, color: BODY }), 0.5);
  w.block(w.textRows(`Generated: ${generated.text} (${generated.timeZone || "time zone not recorded"})`, { size: T_BODY, color: MUTED }), 0.5);
  if (emojiReplaced > 0) {
    w.block(
      w.textRows(
        `Emoji can't be shown in this PDF. Each emoji appears as ${EMOJI_MARKER}; the rest of the text is unchanged and the original can be seen in the Solace app.`,
        { size: T_META, color: CAUTION, padTop: 1.5 }
      ),
      0
    );
  }
  w.block([w.rule(RULE, 0.3, 3, 1)]);
}

function summary(w: Writer, report: ProgressReport): void {
  const s = report.currentSnapshot;
  const p = report.periodSummary;
  const most = report.checkInActivity.mostConsistentItem;
  // The backend computes the snapshot when the report is generated (not at the period's end).
  const generated = formatGeneratedAt(report);
  const asOf = `${generated.text}${generated.timeZone ? `, ${generated.timeZone}` : ""}`;

  w.section("Summary", 30);
  w.subheading(`Current snapshot (as of ${asOf})`, 24);
  w.table(
    [
      { label: "Measure", width: 124 },
      { label: "Value", width: 50, align: "right" },
    ],
    [
      ["Level", String(s.currentLevel)],
      ["Total points (all time)", String(s.totalPoints)],
      ["Active Goals", String(s.activeGoals)],
      ["Active Personal Achievements", String(s.activeAchievements)],
      ["Goals completed (all time)", String(s.completedGoalsAllTime)],
      ["Personal Achievements completed (all time)", String(s.completedAchievementsAllTime)],
    ]
  );
  const levelText = `Level progress: ${s.pointsIntoLevel} of ${s.pointsRequiredForNextLevel} points into level ${s.currentLevel} · ${s.pointsRemainingToNextLevel} points to the next level`;
  const levelRows = w.textRows(levelText, { size: T_META, color: MUTED });
  w.block([
    ...levelRows,
    {
      h: 6,
      draw: (top) =>
        w.progressBar(M, top + 1.8, CONTENT_W, s.pointsRequiredForNextLevel > 0 ? (s.pointsIntoLevel / s.pointsRequiredForNextLevel) * 100 : 0),
    },
  ], 2);

  w.subheading(`During this period (${formatReportPeriod(report)})`, 24);
  const rows: string[][] = [
    ["Goals completed", String(p.completedGoals)],
    ["Personal Achievements completed", String(p.completedAchievements)],
    ["Check-ins", String(p.totalCheckIns)],
    ["Days with a check-in", String(p.activeCheckInDays)],
    ["Points earned", String(p.pointsEarned)],
    ["Overall consistency", valueOrUnavailable(p.overallConsistencyRate, "%")],
    ["Tracked progress change", `${formatSignedPoints(p.totalProgressChange)} percentage points`],
  ];
  if (most) {
    rows.push([
      `Most consistent: ${w.safe(most.title)} (${ITEM_TYPE_LABELS[most.itemType]})`,
      `${most.rate}%`,
    ]);
  }
  w.table(
    [
      { label: "Measure", width: 124 },
      { label: "Value", width: 50, align: "right" },
    ],
    rows
  );
}

function itemRows(w: Writer, item: ProgressReportItem, itemType: ProgressReportItemType): Row[] {
  const rows: Row[] = [];
  rows.push(...w.textRows(w.safe(item.title || "Untitled"), { style: "bold", size: T_SUB, color: INK }));

  const category = item.category ? w.safe(humanizeToken(item.category)) : null;
  const unit = item.trackingUnit ? w.safe(item.trackingUnit) : null;
  const meta = [
    `${originLabel(item.origin)} ${ITEM_TYPE_LABELS[itemType]}`,
    category,
    statusLabel(item.status),
    item.priority ? `Priority: ${humanizeToken(item.priority)}` : null,
    `Tracking: ${TRACKING_METHOD_LABELS[item.trackingType]}`,
  ].filter(Boolean);
  rows.push(...w.textRows(meta.join("  ·  "), { size: T_META, color: MUTED, padTop: 1 }));

  // Current progress: label + backend percentage, then the bar.
  rows.push({
    h: 2 + ascent(T_META) + descent(T_META),
    draw: (top) => {
      const base = top + 2 + ascent(T_META);
      w.font("normal", T_META, MUTED);
      w.line("Current progress", M, base, CONTENT_W);
      w.font("bold", T_BODY, INK);
      w.line(`${item.currentProgress}%`, M, base, CONTENT_W, "right");
    },
  });
  rows.push({ h: 5, draw: (top) => w.progressBar(M, top + 1, CONTENT_W, item.currentProgress) });

  const numeric = formatNumericProgress(item.trackingType, item.currentValue, item.targetValue, unit);
  if (numeric) rows.push(...w.textRows(numeric, { size: T_META, color: BODY }));

  rows.push(
    ...w.textRows(
      `This period: ${item.progressAtStart}% to ${item.progressAtEnd}% (${formatSignedPoints(item.progressChange)} percentage points)`,
      { size: T_META, color: BODY, padTop: 1 }
    )
  );

  const details = [
    `Check-ins this period: ${item.checkInsDuringPeriod}`,
    `Days with a check-in: ${item.activeCheckInDays}`,
    item.consistencyRate === null ? "Consistency: custom frequency (not calculated)" : `Consistency: ${item.consistencyRate}%`,
    item.startDate ? `Started: ${formatReportDay(item.startDate)}` : "Start date: not recorded",
    item.targetDate ? `Target date: ${formatReportDay(item.targetDate)}` : "No target date",
  ];
  rows.push(...w.textRows(details.join("  ·  "), { size: T_META, color: MUTED, padTop: 1 }));

  const attention = [
    item.isOverdue && attentionReasonLabel("overdue"),
    item.isApproachingTarget && attentionReasonLabel("approaching_target"),
    item.hasNoRecentCheckIns && attentionReasonLabel("no_recent_check_ins"),
    item.hasNoProgressDuringPeriod && attentionReasonLabel("no_progress_during_period"),
  ].filter(Boolean);
  if (attention.length) rows.push(...w.textRows(attention.join("  ·  "), { size: T_META, color: CAUTION, padTop: 1 }));

  rows.push(w.rule(RULE, 0.25, 3, 3.5));
  return rows;
}

function goalProgress(w: Writer, report: ProgressReport): void {
  w.section("Goal progress", 30);
  for (const [title, items, type, empty] of [
    ["Active Goals", report.activeGoals, "goal", "No active Goals."],
    ["Active Personal Achievements", report.activeAchievements, "achievement", "No active Personal Achievements."],
  ] as const) {
    w.subheading(title, 26);
    if (items.length === 0) {
      w.muted(empty, 3);
      continue;
    }
    for (const item of items) w.block(itemRows(w, item, type));
  }
}

function completed(w: Writer, report: ProgressReport): void {
  w.section("Completed during this period", 32);
  if (report.completedDuringPeriod.length === 0) {
    w.muted("Nothing was completed during this reporting period.");
    return;
  }
  w.table(
    [
      { label: "Date", width: 28 },
      { label: "Item", width: 86 },
      { label: "Type", width: 40 },
      { label: "Points", width: 20, align: "right" },
    ],
    report.completedDuringPeriod.map((c) => {
      const final = formatNumericProgress(c.trackingType, c.finalCurrentValue, c.finalTargetValue, null);
      return [
        formatReportDay(c.completedAt) ?? "",
        [w.safe(c.title || "Untitled"), final ? `Final: ${final}` : ""].filter(Boolean).join("\n"),
        `${originLabel(c.origin)} ${ITEM_TYPE_LABELS[c.itemType]}`,
        String(c.rewardPointsAwarded),
      ];
    })
  );
}

function attention(w: Writer, report: ProgressReport): void {
  w.section("Needs attention", 32);
  if (report.needsAttention.length === 0) {
    w.muted("No active items currently need attention for this reporting period.");
    return;
  }
  w.table(
    [
      { label: "Item", width: 80 },
      { label: "Type", width: 38 },
      { label: "Reason", width: 56 },
    ],
    report.needsAttention.map((a) => [
      w.safe(a.title || "Untitled"),
      ITEM_TYPE_LABELS[a.itemType],
      a.reasons.map((r) => attentionReasonLabel(r)).join("\n"),
    ])
  );
}

function checkInNotes(w: Writer, report: ProgressReport): void {
  const wb = report.wellbeingEntries;
  w.section("Check-in notes", 20);
  const groups: Array<[string, ProgressReportTextEntry[]]> = [
    ["Wins", wb.wins],
    ["Challenges", wb.challenges],
    ["Reflections", wb.reflections],
    ["Notes", wb.notes],
  ];
  for (const [title, entries] of groups) {
    w.subheading(title, 12);
    if (entries.length === 0) {
      w.muted(`No ${title.toLowerCase()} recorded in this period.`);
      continue;
    }
    for (const e of entries) {
      const meta = [w.safe(e.itemTitle), formatReportDay(e.date)].filter(Boolean).join("  ·  ");
      w.block(
        [
          ...w.textRows(w.safe(e.text), { size: T_BODY, color: BODY }),
          ...w.textRows(meta, { size: T_META, color: MUTED, padTop: 1 }),
        ],
        3
      );
    }
  }
  w.subheading("Moods noted in check-ins", 10);
  if (wb.moodCounts.length === 0) {
    w.muted("No moods were noted in check-ins during this period.");
  } else {
    w.block(
      w.textRows(
        wb.moodCounts.map((m) => `${w.safe(humanizeToken(m.mood) ?? m.mood)}: ${m.count}`).join("   ·   "),
        { size: T_BODY }
      ),
      2
    );
  }
}

function pointsHistory(w: Writer, report: ProgressReport): void {
  w.section("Points history", 28);
  if (report.rewards.transactions.length === 0) {
    w.muted("No points were earned during this reporting period.");
    return;
  }
  w.table(
    [
      { label: "Date", width: 28 },
      { label: "Source", width: 122 },
      { label: "Points", width: 24, align: "right" },
    ],
    report.rewards.transactions.map((t) => [
      formatReportDay(t.date) ?? "",
      [rewardSourceLabel(t.sourceType), t.reason ? w.safe(t.reason) : ""].filter(Boolean).join("\n"),
      `${t.points >= 0 ? "+" : ""}${t.points}`,
    ])
  );
}

function reportNotes(w: Writer, report: ProgressReport): void {
  w.section("Report notes", 14);
  if (report.closingSummary.length === 0) {
    w.muted("No additional notes for this reporting period.");
    return;
  }
  for (const line of report.closingSummary) {
    w.block(w.textRows(`•  ${w.safe(line)}`, { size: T_BODY }), 1.5);
  }
}

/** Running header (continuation pages) and footer (every page), stamped once totals are known. */
function stampPages(d: Doc, kit: PdfTextKit, report: ProgressReport): void {
  const total = d.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    d.setPage(page);
    d.setFont(kit.baseFamily, "normal");
    if (page > 1) {
      d.setFontSize(T_SMALL);
      d.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      d.text(`Goals & Achievements Progress Report  ·  ${formatReportPeriod(report)}`, M, 14);
      d.setDrawColor(RULE[0], RULE[1], RULE[2]);
      d.setLineWidth(0.25);
      d.line(M, 17, M + CONTENT_W, 17);
    }
    d.setDrawColor(RULE[0], RULE[1], RULE[2]);
    d.setLineWidth(0.25);
    d.line(M, FOOTER_RULE, M + CONTENT_W, FOOTER_RULE);
    d.setFontSize(T_SMALL);
    d.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    d.text("Solace", M, FOOTER_TEXT);
    d.text(`Page ${page} of ${total}`, M + CONTENT_W, FOOTER_TEXT, { align: "right" });
  }
}

/** Every string a user (or the backend) authored: checked before drawing, and scanned for Arabic script. */
function reportStrings(report: ProgressReport): Array<[string, Style]> {
  const out: Array<[string, Style]> = [];
  const add = (s: string | null | undefined, style: Style = "normal") => s && out.push([s, style]);
  add(report.user.displayName);
  for (const i of [...report.activeGoals, ...report.activeAchievements]) {
    add(i.title, "bold");
    add(humanizeToken(i.category));
    add(i.trackingUnit);
  }
  report.completedDuringPeriod.forEach((c) => add(c.title));
  report.needsAttention.forEach((a) => add(a.title));
  add(report.checkInActivity.mostConsistentItem?.title);
  const wb = report.wellbeingEntries;
  [...wb.wins, ...wb.challenges, ...wb.reflections, ...wb.notes].forEach((e) => {
    add(e.text);
    add(e.itemTitle);
  });
  wb.moodCounts.forEach((m) => add(humanizeToken(m.mood) ?? m.mood));
  report.rewards.transactions.forEach((t) => add(t.reason));
  report.closingSummary.forEach((l) => add(l));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Logo (optional — never blocks generation): shared with the other report PDFs.
// ---------------------------------------------------------------------------------------------

export { loadLogo, type LogoImage };

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

export interface BuildOptions {
  /** Report fonts; a missing Latin font falls back to Helvetica, a missing Arabic-script font fails Urdu text. */
  fonts: PdfFontFiles;
  logo?: LogoImage | null;
}

export interface BuiltReport {
  doc: Doc;
  /** How many emoji are shown as the "[emoji]" marker. */
  emojiReplacedCount: number;
  usedUnicodeFont: boolean;
}

/** Renders the backend report into an A4 PDF. Pure presentation: values are formatted, not computed. */
export async function buildProgressReportPdf(report: ProgressReport, options: BuildOptions): Promise<BuiltReport> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const d = new JsPdf({ unit: "mm", format: "a4" }) as Doc;
  d.setProperties({ title: "Goals & Achievements Progress Report", creator: "Solace" });
  const kit = setupPdfText(d, options.fonts);
  const w = new Writer(d, kit);

  // Fail before drawing anything if some text cannot be drawn faithfully; count emoji markers.
  let emojiReplaced = 0;
  for (const [text, style] of reportStrings(report)) {
    for (const para of w.safe(text).split("\n")) {
      if (para.trim()) emojiReplaced += kit.prepare(para, style).emojiReplaced;
    }
  }
  cover(w, report, options.logo ?? null, formatGeneratedAt(report), emojiReplaced);
  summary(w, report);
  goalProgress(w, report);
  completed(w, report);
  attention(w, report);
  checkInNotes(w, report);
  pointsHistory(w, report);
  reportNotes(w, report);
  stampPages(d, kit, report);

  return { doc: d, emojiReplacedCount: emojiReplaced, usedUnicodeFont: kit.unicode };
}

export type DownloadOutcome = "downloaded" | "cancelled";

/**
 * Loads the export-only fonts and logo, builds the PDF and saves it — unless `isStillCurrent`
 * reports that the account or range changed while it was being prepared. Throws
 * `PdfUnsupportedTextError` (nothing is downloaded) when some text cannot be drawn faithfully.
 */
export async function downloadProgressReportPdf(
  report: ProgressReport,
  isStillCurrent: () => boolean = () => true
): Promise<DownloadOutcome> {
  const needArabic = reportStrings(report).some(([text]) => ARABIC_SCRIPT.test(text));
  const [fonts, logo] = await Promise.all([loadPdfFonts(needArabic), loadLogo()]);
  if (!isStillCurrent()) return "cancelled";
  const { doc } = await buildProgressReportPdf(report, { fonts, logo });
  if (!isStillCurrent()) return "cancelled";

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = progressReportFileName(report);
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
