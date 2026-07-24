/**
 * Progress Report PDF renderer — PRESENTATION ONLY.
 *
 * Every number, label, date and summary line is taken verbatim from the report
 * object returned by GET /api/gamification/report. Nothing is recalculated: no
 * progress, consistency, completion, reward, level or attention logic lives
 * here. The renderer only lays the backend response out on A4 pages.
 *
 * Reuses the repository's existing PDF infrastructure: jsPDF v4 (dynamically
 * imported so it stays out of the main bundle), A4/mm geometry, and the shared
 * `cleanPdfText` sanitiser from `lib/journalExport`.
 */
import type { jsPDF } from "jspdf";
import { cleanPdfText, localDateKey } from "@/lib/journalExport";
import {
  ITEM_TYPE_LABELS,
  originLabel,
  statusLabel,
  TRACKING_METHOD_LABELS,
  attentionReasonLabel,
  formatNumericProgress,
  formatReportDate,
  formatSignedPoints,
  humanizeToken,
  rewardSourceLabel,
} from "./progress-report.utils";
import type { ProgressReport, ProgressReportItem } from "./progress-report.types";

type Doc = jsPDF;

// --- Geometry (A4, millimetres) --------------------------------------------
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // side margin
const CONTENT_W = PAGE_W - M * 2; // 178
const CONTENT_TOP = 32; // below the running header band
const CONTENT_BOTTOM = 276; // above the footer

// --- Type scale (pt) --------------------------------------------------------
const T_TITLE = 23;
const T_SECTION = 16;
const T_CARD = 12;
const T_BODY = 10;
const T_META = 9;
const T_FOOTER = 8;

const LH_BODY = 4.6; // line height for 10pt body copy
const LH_META = 4.1;

// --- Solace palette (mirrors the app's violet/ink system) -------------------
const INK: RGB = [26, 21, 35];
const MUTED: RGB = [107, 114, 128];
const BRAND: RGB = [124, 58, 237]; // violet-600
const BORDER: RGB = [229, 231, 235];
const SURFACE: RGB = [247, 245, 255];
const TRACK: RGB = [226, 222, 240];
const POSITIVE: RGB = [5, 150, 105];
const CAUTION: RGB = [180, 83, 9];

type RGB = [number, number, number];

const EMPTY_TEXT = "No activity during this reporting period.";

interface Cursor {
  y: number;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

const ink = (d: Doc, c: RGB = INK) => d.setTextColor(c[0], c[1], c[2]);
const fill = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const stroke = (d: Doc, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);

function font(d: Doc, style: "normal" | "bold", size: number): void {
  d.setFont("helvetica", style);
  d.setFontSize(size);
}

/** Sanitise + wrap. Measured ONCE per block and reused for drawing (linear). */
function wrap(d: Doc, text: string, width: number): string[] {
  const clean = cleanPdfText(String(text ?? ""));
  if (!clean) return [];
  return d.splitTextToSize(clean, width) as string[];
}

/** Break to a new page when `needed` mm will not fit in the content band. */
function ensure(d: Doc, cur: Cursor, needed: number): void {
  if (cur.y + needed > CONTENT_BOTTOM) {
    d.addPage();
    cur.y = CONTENT_TOP;
  }
}

function drawLines(d: Doc, lines: string[], x: number, cur: Cursor, lineH: number): void {
  for (const line of lines) {
    // Long blocks continue naturally across pages.
    ensure(d, cur, lineH);
    d.text(line, x, cur.y);
    cur.y += lineH;
  }
}

/**
 * Section heading. Keeps the heading with its first content by requiring room
 * for the heading plus a minimum content block before breaking.
 */
function sectionHeader(d: Doc, cur: Cursor, title: string, minContent = 22): void {
  ensure(d, cur, 12 + minContent);
  font(d, "bold", T_SECTION);
  ink(d, INK);
  d.text(cleanPdfText(title), M, cur.y);
  cur.y += 2.5;
  stroke(d, BORDER);
  d.setLineWidth(0.3);
  d.line(M, cur.y, M + CONTENT_W, cur.y);
  cur.y += 6;
}

/** Muted one-line note used for empty sections. */
function emptyLine(d: Doc, cur: Cursor, text = EMPTY_TEXT): void {
  ensure(d, cur, LH_BODY + 2);
  font(d, "normal", T_BODY);
  ink(d, MUTED);
  d.text(text, M, cur.y);
  cur.y += LH_BODY + 4;
  ink(d, INK);
}

/**
 * Visual progress bar. Uses ONLY the backend percentage; the width is a direct
 * display ratio, clamped 0..100. Drawn as vectors so it prints cleanly and
 * remains legible in grayscale.
 */
function progressBar(d: Doc, x: number, y: number, w: number, pct: number): void {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const h = 3.2;
  fill(d, TRACK);
  d.roundedRect(x, y, w, h, 1.6, 1.6, "F");
  if (safe > 0) {
    fill(d, BRAND);
    d.roundedRect(x, y, Math.max((w * safe) / 100, 1.6), h, 1.6, 1.6, "F");
  }
}

/** Compact metric tile grid (3 per row). */
function statGrid(d: Doc, cur: Cursor, stats: Array<{ label: string; value: string }>): void {
  if (stats.length === 0) return;
  const perRow = 3;
  const gap = 4;
  const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow;
  const cardH = 18;

  for (let i = 0; i < stats.length; i += perRow) {
    const row = stats.slice(i, i + perRow);
    ensure(d, cur, cardH + gap);
    row.forEach((s, idx) => {
      const x = M + idx * (cardW + gap);
      fill(d, SURFACE);
      stroke(d, BORDER);
      d.setLineWidth(0.3);
      d.roundedRect(x, cur.y, cardW, cardH, 2, 2, "FD");

      font(d, "normal", T_META - 1);
      ink(d, MUTED);
      const labelLines = wrap(d, s.label, cardW - 6).slice(0, 1);
      if (labelLines[0]) d.text(labelLines[0], x + 3, cur.y + 6);

      font(d, "bold", T_CARD + 1);
      ink(d, INK);
      const valueLines = wrap(d, s.value, cardW - 6).slice(0, 1);
      if (valueLines[0]) d.text(valueLines[0], x + 3, cur.y + 13.5);
    });
    cur.y += cardH + gap;
  }
  cur.y += 2;
}

// ---------------------------------------------------------------------------
// Item cards (Goals / Personal Achievements)
// ---------------------------------------------------------------------------

/**
 * Renders one active item. Height is measured up-front so a card is NEVER
 * split across a page boundary.
 */
function itemCard(d: Doc, cur: Cursor, item: ProgressReportItem): void {
  const innerW = CONTENT_W - 8;

  font(d, "bold", T_CARD);
  const titleLines = wrap(d, item.title || "Untitled", innerW);

  const metaBits = [
    `Origin: ${originLabel(item.origin)}`,
    humanizeToken(item.category),
    statusLabel(item.status),
    item.priority ? `Priority: ${humanizeToken(item.priority)}` : null,
    `Tracking: ${TRACKING_METHOD_LABELS[item.trackingType]}`,
  ].filter(Boolean) as string[];
  font(d, "normal", T_META);
  const metaLines = wrap(d, metaBits.join("  ·  "), innerW);

  const numeric = formatNumericProgress(
    item.trackingType,
    item.currentValue,
    item.targetValue,
    item.trackingUnit
  );

  const detailBits: string[] = [];
  detailBits.push(
    item.consistencyRate === null
      ? `Consistency: Custom frequency (${item.activeCheckInDays} check-in days)`
      : `Consistency: ${item.consistencyRate}%`
  );
  const started = formatReportDate(item.startDate);
  const due = formatReportDate(item.targetDate);
  if (started) detailBits.push(`Started: ${started}`);
  detailBits.push(`Due: ${due ?? "No target date"}`);
  detailBits.push(`Check-ins: ${item.checkInsDuringPeriod}`);
  const detailLines = wrap(d, detailBits.join("  ·  "), innerW);

  const attention = [
    item.isOverdue ? attentionReasonLabel("overdue") : null,
    item.isApproachingTarget ? attentionReasonLabel("approaching_target") : null,
    item.hasNoRecentCheckIns ? attentionReasonLabel("no_recent_check_ins") : null,
  ].filter(Boolean) as string[];
  const attentionLines = attention.length ? wrap(d, attention.join("  ·  "), innerW) : [];

  // --- measured height (title, meta, progress block, details, attention) ---
  const h =
    5 +
    titleLines.length * 5 +
    metaLines.length * LH_META +
    2 +
    10 + // "Current Progress" value + bar
    (numeric ? LH_META : 0) +
    4 +
    LH_META + // period change line
    2 +
    detailLines.length * LH_META +
    (attentionLines.length ? 1 + attentionLines.length * LH_META : 0) +
    5;

  ensure(d, cur, h + 4);

  // Card surface
  fill(d, [255, 255, 255]);
  stroke(d, BORDER);
  d.setLineWidth(0.3);
  d.roundedRect(M, cur.y, CONTENT_W, h, 2.5, 2.5, "FD");

  const x = M + 4;
  let y = cur.y + 6.5;

  font(d, "bold", T_CARD);
  ink(d, INK);
  for (const line of titleLines) {
    d.text(line, x, y);
    y += 5;
  }

  font(d, "normal", T_META);
  ink(d, MUTED);
  for (const line of metaLines) {
    d.text(line, x, y);
    y += LH_META;
  }

  // Current progress (label + % + bar) — backend value, no recalculation.
  y += 2;
  font(d, "normal", T_META - 0.5);
  ink(d, MUTED);
  d.text("CURRENT PROGRESS", x, y);
  font(d, "bold", T_CARD);
  ink(d, INK);
  d.text(`${item.currentProgress}%`, M + CONTENT_W - 4, y, { align: "right" });
  y += 2.5;
  progressBar(d, x, y, innerW, item.currentProgress);
  y += 6;

  if (numeric) {
    font(d, "normal", T_META);
    ink(d, MUTED);
    d.text(cleanPdfText(numeric), x, y);
    y += LH_META;
  }

  // Period movement, explicitly distinct from current progress.
  y += 2;
  font(d, "normal", T_META);
  ink(d, INK);
  d.text(
    cleanPdfText(
      `Period: ${item.progressAtStart}% to ${item.progressAtEnd}%  (${formatSignedPoints(
        item.progressChange
      )} percentage points)`
    ),
    x,
    y
  );
  y += LH_META + 2;

  font(d, "normal", T_META);
  ink(d, MUTED);
  for (const line of detailLines) {
    d.text(line, x, y);
    y += LH_META;
  }

  if (attentionLines.length) {
    y += 1;
    ink(d, CAUTION);
    for (const line of attentionLines) {
      d.text(line, x, y);
      y += LH_META;
    }
  }

  ink(d, INK);
  cur.y += h + 4;
}

function itemsSection(
  d: Doc,
  cur: Cursor,
  title: string,
  items: ProgressReportItem[],
  emptyText: string
): void {
  sectionHeader(d, cur, title, items.length ? 34 : 10);
  if (items.length === 0) {
    emptyLine(d, cur, emptyText);
    return;
  }
  for (const item of items) itemCard(d, cur, item);
  cur.y += 2;
}

/** A labelled block of user-entered entries; long text wraps and continues. */
function entryBlock(
  d: Doc,
  cur: Cursor,
  heading: string,
  entries: Array<{ text: string; date: string; itemTitle: string }>
): void {
  ensure(d, cur, 12);
  font(d, "bold", T_BODY + 1);
  ink(d, INK);
  d.text(cleanPdfText(heading), M, cur.y);
  cur.y += 5;

  if (entries.length === 0) {
    emptyLine(d, cur, EMPTY_TEXT);
    return;
  }

  for (const entry of entries) {
    font(d, "normal", T_BODY);
    ink(d, INK);
    const bodyLines = wrap(d, entry.text, CONTENT_W - 4);
    // Keep at least the first line with its meta line.
    ensure(d, cur, LH_BODY * Math.min(bodyLines.length, 2) + LH_META + 3);
    drawLines(d, bodyLines, M + 2, cur, LH_BODY);

    const when = formatReportDate(entry.date);
    const metaText = [entry.itemTitle, when].filter(Boolean).join("  ·  ");
    font(d, "normal", T_META);
    ink(d, MUTED);
    drawLines(d, wrap(d, metaText, CONTENT_W - 4), M + 2, cur, LH_META);
    cur.y += 2.5;
    ink(d, INK);
  }
}

/** Simple 3-column list row (date / label / value) that never needs a table. */
function listRow(d: Doc, cur: Cursor, left: string, middle: string, right: string): void {
  const leftW = 32;
  const rightW = 26;
  const midW = CONTENT_W - leftW - rightW - 6;

  font(d, "normal", T_BODY);
  const midLines = wrap(d, middle, midW);
  const h = Math.max(LH_BODY, midLines.length * LH_BODY) + 2.5;
  ensure(d, cur, h);

  ink(d, MUTED);
  d.text(cleanPdfText(left), M, cur.y);

  ink(d, INK);
  let my = cur.y;
  for (const line of midLines) {
    d.text(line, M + leftW, my);
    my += LH_BODY;
  }

  font(d, "bold", T_BODY);
  d.text(cleanPdfText(right), M + CONTENT_W, cur.y, { align: "right" });
  font(d, "normal", T_BODY);

  cur.y += h;
  stroke(d, BORDER);
  d.setLineWidth(0.2);
  d.line(M, cur.y - 1.5, M + CONTENT_W, cur.y - 1.5);
}

// ---------------------------------------------------------------------------
// Running header + footer (stamped on every page once totals are known)
// ---------------------------------------------------------------------------

function stampChrome(d: Doc, generatedLabel: string, logo: LogoImage | null): void {
  const total = d.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    d.setPage(page);

    // Header band
    fill(d, SURFACE);
    d.rect(0, 0, PAGE_W, 20, "F");
    stroke(d, BORDER);
    d.setLineWidth(0.3);
    d.line(0, 20, PAGE_W, 20);

    let textX = M;
    if (logo) {
      try {
        d.addImage(logo.dataUrl, "PNG", M, 6.5, logo.width, logo.height);
        textX = M + logo.width + 4;
      } catch {
        /* fall back to the text wordmark below */
      }
    }
    if (!logo) {
      font(d, "bold", 12);
      ink(d, BRAND);
      d.text("Solace", textX, 12.5);
      textX += 18;
    }

    font(d, "normal", T_META);
    ink(d, MUTED);
    d.text("Goals & Achievements Progress Report", textX, 12.5);

    // Footer
    stroke(d, BORDER);
    d.setLineWidth(0.3);
    d.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14);
    font(d, "normal", T_FOOTER);
    ink(d, MUTED);
    d.text(`Page ${page} of ${total}`, M, PAGE_H - 9);
    d.text(`Generated: ${generatedLabel}`, PAGE_W - M, PAGE_H - 9, { align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Logo (optional — never blocks generation)
// ---------------------------------------------------------------------------

export interface LogoImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Dark wordmark on the white PDF page. Returns null if unavailable. */
async function loadLogo(): Promise<LogoImage | null> {
  try {
    if (typeof fetch !== "function" || typeof FileReader === "undefined") return null;
    const res = await fetch("/logos/logo white.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("logo read failed"));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:image")) return null;

    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      if (typeof Image === "undefined") return resolve(null);
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    const height = 7;
    const ratio = dims && dims.h > 0 ? dims.w / dims.h : 3.4;
    return { dataUrl, width: Math.min(height * ratio, 46), height };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** `solace-progress-report-YYYY-MM-DD.pdf` (generated date, user's local day). */
export function progressReportFileName(report: ProgressReport): string {
  const stamp = report.generatedAt ? new Date(report.generatedAt) : new Date();
  const day = Number.isNaN(stamp.getTime()) ? localDateKey(new Date()) : localDateKey(stamp);
  return `solace-progress-report-${day}.pdf`;
}

/**
 * Render the backend report into a multi-page A4 PDF document.
 * Pure presentation: no value below is computed, only formatted.
 */
export async function buildProgressReportPdf(report: ProgressReport): Promise<Doc> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const d = new JsPdf({ unit: "mm", format: "a4" }) as Doc;
  const logo = await loadLogo();

  const generatedLabel = formatReportDate(report.generatedAt) ?? "";
  const cur: Cursor = { y: CONTENT_TOP };

  // ---- Cover block -------------------------------------------------------
  font(d, "bold", T_TITLE);
  ink(d, INK);
  const titleLines = wrap(d, "Goals & Achievements Progress Report", CONTENT_W);
  for (const line of titleLines) {
    d.text(line, M, cur.y);
    cur.y += 9;
  }
  font(d, "normal", T_BODY + 1);
  ink(d, MUTED);
  d.text("Your personal wellness progress and growth.", M, cur.y);
  cur.y += 7;

  const coverMeta = [
    report.user.displayName ? cleanPdfText(report.user.displayName) : null,
    report.period.label,
    generatedLabel ? `Generated ${generatedLabel}` : null,
  ].filter(Boolean) as string[];
  font(d, "normal", T_META);
  ink(d, MUTED);
  d.text(cleanPdfText(coverMeta.join("  ·  ")), M, cur.y);
  cur.y += 9;

  // ---- Executive summary -------------------------------------------------
  const snap = report.currentSnapshot;
  const sum = report.periodSummary;
  sectionHeader(d, cur, "Executive Summary", 26);
  statGrid(d, cur, [
    { label: "Current level", value: String(snap.currentLevel) },
    { label: "Current points", value: String(snap.totalPoints) },
    { label: "Active goals", value: String(snap.activeGoals) },
    { label: "Active personal achievements", value: String(snap.activeAchievements) },
    {
      label: "Completed this period",
      value: String(sum.completedGoals + sum.completedAchievements),
    },
    { label: "Total check-ins", value: String(sum.totalCheckIns) },
    {
      label: "Overall consistency",
      value: sum.overallConsistencyRate === null ? "Not available" : `${sum.overallConsistencyRate}%`,
    },
  ]);

  // ---- Current snapshot: active items ------------------------------------
  itemsSection(d, cur, "Active Goals", report.activeGoals, "No active Goals.");
  itemsSection(
    d,
    cur,
    "Active Personal Achievements",
    report.activeAchievements,
    "No active Personal Achievements."
  );

  // ---- Period summary ----------------------------------------------------
  sectionHeader(d, cur, "Period Summary", 26);
  statGrid(d, cur, [
    { label: "Goals completed", value: String(sum.completedGoals) },
    { label: "Achievements completed", value: String(sum.completedAchievements) },
    { label: "Total check-ins", value: String(sum.totalCheckIns) },
    { label: "Active check-in days", value: String(sum.activeCheckInDays) },
    { label: "Points earned", value: String(sum.pointsEarned) },
    {
      label: "Overall consistency",
      value: sum.overallConsistencyRate === null ? "Not available" : `${sum.overallConsistencyRate}%`,
    },
    {
      label: "Tracked progress change",
      value: `${formatSignedPoints(sum.totalProgressChange)} pts`,
    },
  ]);

  // ---- Completed during the period ---------------------------------------
  sectionHeader(d, cur, "Completed During This Period", 16);
  if (report.completedDuringPeriod.length === 0) {
    emptyLine(d, cur);
  } else {
    for (const c of report.completedDuringPeriod) {
      listRow(
        d,
        cur,
        formatReportDate(c.completedAt) ?? "",
        `${c.title}  ·  ${ITEM_TYPE_LABELS[c.itemType]}  ·  ${originLabel(c.origin)}`,
        `${c.rewardPointsAwarded} pts`
      );
    }
    cur.y += 4;
  }

  // ---- Check-in activity + user-entered content ---------------------------
  sectionHeader(d, cur, "Check-In Activity", 24);
  const act = report.checkInActivity;
  statGrid(d, cur, [
    { label: "Total check-ins", value: String(act.totalCheckIns) },
    { label: "Active days", value: String(act.activeDays) },
    {
      label: "Most consistent item",
      value: act.mostConsistentItem ? `${act.mostConsistentItem.rate}%` : "Not available",
    },
  ]);
  if (act.mostConsistentItem) {
    font(d, "normal", T_META);
    ink(d, MUTED);
    ensure(d, cur, LH_META + 2);
    d.text(
      cleanPdfText(
        `Most consistent: ${act.mostConsistentItem.title} (${ITEM_TYPE_LABELS[act.mostConsistentItem.itemType]})`
      ),
      M,
      cur.y
    );
    cur.y += LH_META + 3;
    ink(d, INK);
  }

  const wb = report.wellbeingEntries;
  entryBlock(d, cur, "Wins", wb.wins);
  entryBlock(d, cur, "Challenges", wb.challenges);
  entryBlock(d, cur, "Reflections", wb.reflections);
  entryBlock(d, cur, "Notes", wb.notes);

  ensure(d, cur, 12);
  font(d, "bold", T_BODY + 1);
  ink(d, INK);
  d.text("Mood summary", M, cur.y);
  cur.y += 5;
  if (wb.moodCounts.length === 0) {
    emptyLine(d, cur);
  } else {
    font(d, "normal", T_BODY);
    ink(d, INK);
    const moodText = wb.moodCounts
      .map((m) => `${humanizeToken(m.mood)} - ${m.count}`)
      .join("   ·   ");
    drawLines(d, wrap(d, moodText, CONTENT_W), M, cur, LH_BODY);
    cur.y += 3;
  }

  // ---- Needs attention ---------------------------------------------------
  sectionHeader(d, cur, "Needs Attention", 16);
  if (report.needsAttention.length === 0) {
    emptyLine(d, cur, "No active items currently need attention based on this report period.");
  } else {
    for (const a of report.needsAttention) {
      // Exactly the backend's reasons — none inferred.
      const reasons = a.reasons.map((r) => attentionReasonLabel(r)).join("  ·  ");
      font(d, "bold", T_BODY);
      const titleLines2 = wrap(d, `${a.title}  (${ITEM_TYPE_LABELS[a.itemType]})`, CONTENT_W);
      font(d, "normal", T_META);
      const reasonLines = wrap(d, reasons, CONTENT_W - 2);
      ensure(d, cur, titleLines2.length * LH_BODY + reasonLines.length * LH_META + 4);

      font(d, "bold", T_BODY);
      ink(d, INK);
      drawLines(d, titleLines2, M, cur, LH_BODY);
      font(d, "normal", T_META);
      ink(d, CAUTION);
      drawLines(d, reasonLines, M + 2, cur, LH_META);
      ink(d, INK);
      cur.y += 2.5;
    }
  }

  // ---- Rewards & levels --------------------------------------------------
  sectionHeader(d, cur, "Rewards & Levels", 26);
  statGrid(d, cur, [
    { label: "Current level", value: String(snap.currentLevel) },
    { label: "Current points", value: String(snap.totalPoints) },
    { label: "Points earned this period", value: String(report.rewards.pointsEarned) },
  ]);

  font(d, "normal", T_META);
  ink(d, MUTED);
  ensure(d, cur, LH_META + 3);
  d.text(
    cleanPdfText(
      `Level progress: ${snap.pointsIntoLevel} of ${snap.pointsRequiredForNextLevel} points  ·  ${snap.pointsRemainingToNextLevel} to next level`
    ),
    M,
    cur.y
  );
  cur.y += LH_META + 1;
  progressBar(d, M, cur.y, CONTENT_W, (snap.pointsIntoLevel / snap.pointsRequiredForNextLevel) * 100);
  cur.y += 8;
  ink(d, INK);

  if (report.rewards.transactions.length === 0) {
    emptyLine(d, cur);
  } else {
    for (const t of report.rewards.transactions) {
      listRow(
        d,
        cur,
        formatReportDate(t.date) ?? "",
        rewardSourceLabel(t.sourceType),
        `+${t.points} pts`
      );
    }
    cur.y += 4;
  }

  // ---- Closing summary (verbatim) ----------------------------------------
  sectionHeader(d, cur, "Summary", 16);
  if (report.closingSummary.length === 0) {
    emptyLine(d, cur);
  } else {
    font(d, "normal", T_BODY);
    ink(d, INK);
    for (const line of report.closingSummary) {
      const lines = wrap(d, `-  ${line}`, CONTENT_W - 2);
      ensure(d, cur, lines.length * LH_BODY);
      drawLines(d, lines, M, cur, LH_BODY);
      cur.y += 1.5;
    }
  }

  // Stamp header/footer last, once the total page count is known.
  stampChrome(d, generatedLabel, logo);
  return d;
}

/**
 * Build + download the PDF using the repository's existing blob-download flow
 * (object URL + anchor click + revoke), matching the Journal export.
 */
export async function downloadProgressReportPdf(report: ProgressReport): Promise<void> {
  const doc = await buildProgressReportPdf(report);
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
}
