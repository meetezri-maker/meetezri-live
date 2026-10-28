/**
 * Goals & Achievements PDF — tests against the real jsPDF engine and the bundled fonts.
 *
 * Text is read back from the generated content streams: each line's glyph IDs are mapped to
 * characters through the embedded font, so assertions see exactly what is drawn, left to right.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import type { jsPDF } from "jspdf";
import {
  buildProgressReportPdf,
  formatGeneratedAt,
  formatReportDay,
  formatReportPeriod,
  progressReportFileName,
} from "./progress-report.pdf";
import {
  EMOJI_MARKER,
  PDF_ARABIC_FONT_FAMILY,
  PDF_FONT_FAMILY,
  PdfUnsupportedTextError,
  loadPdfFonts,
  type PdfFontFiles,
} from "./progress-report.pdf-text";
import type { ProgressReport, ProgressReportItem } from "./progress-report.types";

const FONT_DIR = path.resolve(process.cwd(), "public/fonts/pdf");
const readFont = (f: string) => fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
let fonts: PdfFontFiles;
beforeAll(() => {
  fonts = {
    latin: { regular: readFont("DejaVuSans.ttf"), bold: readFont("DejaVuSans-Bold.ttf") },
    arabic: { regular: readFont("Amiri-Regular.ttf"), bold: readFont("Amiri-Bold.ttf") },
  };
});

// --- fixtures ----------------------------------------------------------------------------------
const URDU_FULL = "آج میں نے بہت سکون محسوس کیا۔"; // heh goal (ہ in بہت), yeh barree (ے), Urdu full stop
const URDU_COVERED = "میں 25 منٹ پڑھا";

const goal = (over: Partial<ProgressReportItem> = {}): ProgressReportItem => ({
  id: "g1", title: "Morning walk", origin: "personal", category: "wellness", status: "active", priority: "high",
  trackingType: "count", trackingUnit: "workouts", currentValue: 18, targetValue: 25, currentProgress: 72,
  progressAtStart: 40, progressAtEnd: 72, progressChange: 32, checkInsDuringPeriod: 9, activeCheckInDays: 9,
  consistencyRate: 64, startDate: "2026-05-01", targetDate: "2026-08-30", isOverdue: false, isApproachingTarget: false,
  hasNoRecentCheckIns: false, hasNoProgressDuringPeriod: false, rewardAwarded: false, ...over,
});

function makeReport(over: Partial<ProgressReport> = {}): ProgressReport {
  return {
    version: 1,
    generatedAt: "2026-07-23T12:00:00.000Z",
    timezone: "Asia/Karachi",
    period: { range: "30d", start: "2026-06-24", end: "2026-07-23", label: "Last 30 days" },
    user: { displayName: "Alex Rivera" },
    currentSnapshot: { totalPoints: 350, currentLevel: 4, pointsIntoLevel: 50, pointsRequiredForNextLevel: 100, pointsRemainingToNextLevel: 50, activeGoals: 1, activeAchievements: 1, completedGoalsAllTime: 3, completedAchievementsAllTime: 0 },
    periodSummary: { completedGoals: 1, completedAchievements: 0, totalCheckIns: 18, activeCheckInDays: 12, overallConsistencyRate: 57, pointsEarned: 20, totalProgressChange: 27 },
    activeGoals: [goal()],
    activeAchievements: [goal({ id: "a1", title: "Read every evening", trackingType: "manual_milestone", currentValue: null, targetValue: null, trackingUnit: null, currentProgress: 50, consistencyRate: null })],
    completedDuringPeriod: [{ itemType: "goal", itemId: "g9", title: "Drink more water", completedAt: "2026-07-19", rewardPointsAwarded: 20, trackingType: "count", finalCurrentValue: 30, finalTargetValue: 30 }],
    checkInActivity: { totalCheckIns: 18, activeDays: 12, mostConsistentItem: { itemType: "goal", itemId: "g1", title: "Morning walk", rate: 64 } },
    wellbeingEntries: {
      wins: [{ text: "Ran my first 5k", date: "2026-07-19", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" }],
      challenges: [], reflections: [], notes: [], moodCounts: [{ mood: "calm", count: 4 }],
    },
    needsAttention: [{ itemType: "goal", itemId: "g1", title: "Morning walk", reasons: ["overdue", "no_recent_check_ins"] }],
    rewards: { pointsEarned: 20, transactions: [{ id: "t1", sourceType: "personal_goal_completion", sourceItemId: "g9", points: 20, reason: null, createdAt: "2026-07-19T10:00:00.000Z", date: "2026-07-19" }] },
    closingSummary: ["You completed 1 Goal during this reporting period."],
    ...over,
  };
}

// --- reading the generated PDF -----------------------------------------------------------------
type Internal = {
  pages: string[][];
  getFont(): { id: string; metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } };
};

/** Drawn lines per page, as characters in drawing order (presentation forms folded with NFKC). */
function drawnPages(doc: jsPDF): string[][] {
  const internal = doc.internal as unknown as Internal;
  // One glyph-ID → character map per embedded font (regular and bold use different IDs).
  const byFont = new Map<string, Map<number, string>>();
  const families = Object.keys(doc.getFontList()).filter((f) => f === PDF_FONT_FAMILY || f === PDF_ARABIC_FONT_FAMILY);
  for (const [family, style] of families.flatMap((f) => (["normal", "bold"] as const).map((s) => [f, s] as const))) {
    doc.setFont(family, style);
    const font = internal.getFont();
    const map = new Map<number, string>();
    for (const [cp, gid] of Object.entries(font.metadata.cmap.unicode.codeMap)) {
      const c = Number(cp);
      if (!map.has(gid) || c < 0xfb50) map.set(gid, String.fromCodePoint(c));
    }
    byFont.set(font.id, map);
  }
  return internal.pages.slice(1).map((ops) => {
    const lines: string[] = [];
    const body = ops.join("\n");
    const re = /\/(F\d+)\s+[\d.]+\s+Tf[\s\S]*?<([0-9A-Fa-f]+)>\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const map = byFont.get(m[1]);
      const hex = m[2];
      let s = "";
      for (let i = 0; i < hex.length; i += 4) {
        const gid = parseInt(hex.slice(i, i + 4), 16);
        const ch = map?.get(gid) ?? "�";
        // A lam-alef ligature is one glyph; drawn left to right its parts read alef, then lam.
        s += /[ﻵ-ﻼ]/.test(ch) ? rev(ch.normalize("NFKC")) : ch;
      }
      lines.push(s.normalize("NFKC").replace(/ /g, " "));
    }
    return lines;
  });
}

const rev = (s: string) => Array.from(s).reverse().join("");
/**
 * Expected left-to-right drawing order of a right-to-left line: characters reversed, digit runs
 * kept in reading order, brackets mirrored. (Applying it twice gives back the typed text.)
 */
const rtlVisual = (s: string) =>
  rev(s)
    .replace(/[0-9]+/g, (d) => rev(d))
    .replace(/[()[\]]/g, (c) => ({ "(": ")", ")": "(", "[": "]", "]": "[" })[c]!);

const withNotes = (notes: string[]) =>
  makeReport({
    wellbeingEntries: {
      ...makeReport().wellbeingEntries,
      notes: notes.map((text, i) => ({ text, date: "2026-07-20", itemId: `g${i}`, itemType: "goal" as const, itemTitle: "Morning walk" })),
    },
  });

async function build(report: ProgressReport, f: PdfFontFiles = fonts) {
  const built = await buildProgressReportPdf(report, { fonts: f, logo: null });
  return { ...built, pages: f.latin || f.arabic ? drawnPages(built.doc) : [] };
}

// ===============================================================================================
describe("dates, period and file name", () => {
  it("formats date-only values from their calendar parts (no time-zone shift)", () => {
    expect(formatReportDay("2026-07-01")?.replace(/ /g, " ")).toBe("1 Jul 2026");
    expect(formatReportDay("2026-12-31")?.replace(/ /g, " ")).toBe("31 Dec 2026");
    expect(formatReportDay(null)).toBeNull();
  });

  it("states the inclusive reporting dates, and never invents a start for all time", () => {
    const plain = (s: string) => s.replace(/ /g, " ");
    expect(plain(formatReportPeriod(makeReport()))).toBe("Last 30 days: 24 Jun 2026 – 23 Jul 2026");
    expect(plain(formatReportPeriod(makeReport({ period: { range: "all", start: null, end: "2026-07-23", label: "All time" } })))).toBe(
      "All time, through 23 Jul 2026"
    );
  });

  it("shows the generated time in the report's time zone, falling back to the device zone", () => {
    expect(formatGeneratedAt(makeReport())).toEqual({ text: "23 Jul 2026, 17:00", timeZone: "Asia/Karachi" });
    const fallback = formatGeneratedAt(makeReport({ timezone: "Not/AZone" }));
    expect(fallback.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("names the file after the actual period", () => {
    expect(progressReportFileName(makeReport())).toBe("solace-goals-progress-report-2026-06-24-to-2026-07-23.pdf");
    expect(progressReportFileName(makeReport({ period: { range: "all", start: null, end: "2026-07-23", label: "All time" } }))).toBe(
      "solace-goals-progress-report-all-time-to-2026-07-23.pdf"
    );
  });
});

describe("content", () => {
  it("renders sections in reading order with real dates and page numbers on every page", async () => {
    const { pages } = await build(makeReport());
    const all = pages.flat();
    const order = ["Summary", "Goal progress", "Completed during this period", "Needs attention", "Check-in notes", "Points history", "Report notes"]
      .map((h) => all.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(all).toContain("Goals & Achievements Progress Report");
    expect(all).toContain("Reporting period: Last 30 days: 24 Jun 2026 – 23 Jul 2026 (dates inclusive)");
    expect(all).toContain("Generated: 23 Jul 2026, 17:00 (Asia/Karachi)");
    // The snapshot is computed when the report is generated, so it is labelled with that time.
    expect(all).toContain("Current snapshot (as of 23 Jul 2026, 17:00, Asia/Karachi)");
    pages.forEach((lines, i) => expect(lines).toContain(`Page ${i + 1} of ${pages.length}`));
  });

  it("shows each summary measure once, keeping all-time and period values distinct", async () => {
    const all = (await build(makeReport())).pages.flat();
    const count = (s: string) => all.filter((l) => l === s).length;
    expect(count("Total points (all time)")).toBe(1);
    expect(count("Points earned")).toBe(1);
    expect(count("Check-ins")).toBe(1);
    expect(count("Goals completed (all time)")).toBe(1);
    expect(count("Goals completed")).toBe(1);
    expect(all).toContain("350"); // total points (all time)
    expect(all).toContain("20"); // points earned in the period
  });

  it("keeps zeros, and says 'Not available' only for missing values", async () => {
    const all = (await build(makeReport({ periodSummary: { ...makeReport().periodSummary, overallConsistencyRate: null, completedAchievements: 0 } }))).pages.flat();
    expect(all).toContain("Not available");
    expect(all.filter((l) => l === "0").length).toBeGreaterThanOrEqual(2);
    expect(all.some((l) => l.includes("Consistency: custom frequency (not calculated)"))).toBe(true);
  });

  it("shows honest empty states", async () => {
    const all = (await build(makeReport({
      activeGoals: [], activeAchievements: [], completedDuringPeriod: [], needsAttention: [],
      wellbeingEntries: { wins: [], challenges: [], reflections: [], notes: [], moodCounts: [] },
      rewards: { pointsEarned: 0, transactions: [] }, closingSummary: [],
    }))).pages.flat();
    for (const msg of [
      "No active Goals.", "No active Personal Achievements.", "Nothing was completed during this reporting period.",
      "No active items currently need attention for this reporting period.", "No points were earned during this reporting period.",
    ]) expect(all).toContain(msg);
  });

  it("wraps long and unbroken text without truncating it", async () => {
    const unbroken = "Supercalifragilisticexpialidocious".repeat(5);
    const longName = `${"Very long display name ".repeat(8)}end`;
    const { pages } = await build(makeReport({
      user: { displayName: longName },
      completedDuringPeriod: [{ ...makeReport().completedDuringPeriod[0], title: unbroken }],
    }));
    const all = pages.flat();
    const parts = all.filter((l) => /^[A-Za-z]+$/.test(l) && unbroken.includes(l) && l.length > 10);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.join("")).toBe(unbroken);
    expect(all.join(" ").replace(/\s+/g, " ")).toContain(longName);
  });

  it("repeats table headers on continuation pages", async () => {
    const tx = Array.from({ length: 80 }, (_, i) => ({ id: `t${i}`, sourceType: "personal_goal_completion", sourceItemId: "g", points: i, reason: null, createdAt: "2026-07-01T00:00:00Z", date: "2026-07-01" }));
    const { pages } = await build(makeReport({ rewards: { pointsEarned: 1, transactions: tx } }));
    const withRows = pages.filter((lines) => lines.includes("+79") || lines.some((l) => /^\+\d+$/.test(l)));
    expect(withRows.length).toBeGreaterThanOrEqual(2);
    for (const lines of withRows) expect(lines).toContain("Source");
  });

  it("never draws a separator through text, and keeps text inside the margins", async () => {
    const tx = Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, sourceType: "personal_goal_completion", sourceItemId: "g", points: i, reason: i % 3 ? null : "Bonus", createdAt: "2026-07-01T00:00:00Z", date: "2026-07-01" }));
    const { doc } = await build(makeReport({ rewards: { pointsEarned: 1, transactions: tx }, activeGoals: Array.from({ length: 6 }, (_, i) => goal({ id: `g${i}` })) }));
    const pages = (doc.internal as unknown as Internal).pages.slice(1);
    for (const ops of pages) {
      const body = ops.join("\n");
      const texts = [...body.matchAll(/\/F\d+\s+([\d.]+)\s+Tf[\s\S]*?([\d.-]+)\s+([\d.-]+)\s+Td/g)].map((m) => ({ size: +m[1], y: +m[3] }));
      const rules = [...body.matchAll(/([\d.]+)\s+([\d.]+)\s+m\s+([\d.]+)\s+([\d.]+)\s+l\s+S/g)].filter((m) => m[2] === m[4]).map((m) => +m[2]);
      for (const y of rules) {
        for (const t of texts) {
          expect(y > t.y - t.size * 0.22 + 0.3 && y < t.y + t.size * 0.78 - 0.3).toBe(false);
        }
      }
      for (const t of texts) {
        const fromTopMm = (841.89 - t.y) * 0.3528;
        expect(fromTopMm).toBeGreaterThan(8);
        expect(fromTopMm).toBeLessThan(290);
      }
    }
  });
});

describe("multilingual text", () => {
  it("draws complete Urdu, including ہ ے and ۔, in right-to-left order", async () => {
    const { pages, usedUnicodeFont, emojiReplacedCount } = await build(withNotes([URDU_FULL, URDU_COVERED]));
    const all = pages.flat();
    expect(usedUnicodeFont).toBe(true);
    expect(emojiReplacedCount).toBe(0);
    expect(all).toContain(rtlVisual(URDU_FULL));
    // Drawn left to right: پڑھا منٹ 25 میں, the number kept in reading order.
    expect(all).toContain(`${rev("پڑھا")} ${rev("منٹ")} 25 ${rev("میں")}`);
    expect(all.join("")).not.toContain("�");
  });

  it("keeps numbers, punctuation and brackets in place in right-to-left lines", async () => {
    const text = "میں نے (3) کتابیں پڑھیں، اور 45 منٹ چلا! [ہفتہ 2]؟";
    const { pages } = await build(withNotes([text]));
    expect(pages.flat()).toContain(rtlVisual(text));
  });

  it("orders Urdu inside an English line, and English inside an Urdu line", async () => {
    const { pages } = await build({ ...withNotes(["آج Calm رہا 3 بار"]), activeGoals: [goal({ title: "Goal: پاکستان ٹھیک" })] });
    const all = pages.flat();
    expect(all).toContain(`Goal: ${rev("ٹھیک")} ${rev("پاکستان")}`);
    expect(all).toContain(`${rev("بار")} 3 ${rev("رہا")} Calm ${rev("آج")}`);
  });

  it("wraps long Urdu over several lines without losing or reordering words", async () => {
    const text = Array.from({ length: 6 }, () => URDU_FULL).join(" ");
    const { pages } = await build(withNotes([text]));
    const lines = pages.flat().filter((l) => /[؀-ۿ]/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.map((l) => rtlVisual(l)).join(" ")).toBe(text);
  });

  it("shows emoji as a marker and keeps the rest of the text", async () => {
    const { pages, emojiReplacedCount } = await build(withNotes(["Great day 😊 with family 👨‍👩‍👧 and friends 🇵🇰!"]));
    const all = pages.flat();
    expect(all).toContain(`Great day ${EMOJI_MARKER} with family ${EMOJI_MARKER} and friends ${EMOJI_MARKER}!`);
    expect(emojiReplacedCount).toBe(3);
    expect(all.some((l) => l.startsWith("Emoji can't be shown in this PDF."))).toBe(true);
  });

  it("does not add the emoji note when there are no emoji", async () => {
    const all = (await build(makeReport())).pages.flat();
    expect(all.some((l) => l.startsWith("Emoji can't be shown"))).toBe(false);
  });

  it("fails instead of drawing a report with characters missing", async () => {
    const err = await build(withNotes(["Learning 你好 today"])).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdfUnsupportedTextError);
    expect((err as PdfUnsupportedTextError).reason).toBe("no-glyph");
    expect((err as PdfUnsupportedTextError).characters).toEqual(["你", "好"]);
  });
});

describe("font loading", () => {
  it("falls back to Helvetica for text it can draw when the Latin font cannot load", async () => {
    const built = await buildProgressReportPdf(makeReport(), { fonts: { latin: null, arabic: null }, logo: null });
    expect(built.usedUnicodeFont).toBe(false);
    const raw = built.doc.output();
    expect(raw).toContain("Goals & Achievements Progress Report");
    expect(raw).toContain("Morning walk");
  });

  it("fails (no PDF) when Urdu is present but its font cannot load", async () => {
    for (const f of [{ latin: fonts.latin, arabic: null }, { latin: null, arabic: null }]) {
      const err = await buildProgressReportPdf(withNotes([URDU_COVERED]), { fonts: f, logo: null }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PdfUnsupportedTextError);
      expect((err as PdfUnsupportedTextError).reason).toBe("font-unavailable");
    }
  });

  it("fails (no PDF) when the Latin font is missing and text needs more than Helvetica has", async () => {
    const err = await buildProgressReportPdf(withNotes(["Привет"]), { fonts: { latin: null, arabic: null }, logo: null }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdfUnsupportedTextError);
    expect((err as PdfUnsupportedTextError).reason).toBe("font-unavailable");
  });

  it("fetches the Urdu font only when needed, and reports failed loads as null", async () => {
    const ok = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    await loadPdfFonts(false, ok as unknown as typeof fetch);
    expect(ok.mock.calls.map((c) => String(c[0])).some((u) => u.includes("Amiri"))).toBe(false);

    const failing = vi.fn(async () => new Response("", { status: 404 }));
    await expect(loadPdfFonts(true, failing as unknown as typeof fetch)).resolves.toEqual({ latin: null, arabic: null });
  });
});
