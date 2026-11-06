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

describe("branding and line spacing", () => {
  const PT = 0.3528;
  /** Drawn lines with their position (mm from the page top) and font size. */
  const placed = (doc: jsPDF) => {
    const texts = drawnPages(doc);
    return (doc.internal as unknown as Internal).pages.slice(1).map((ops, p) =>
      [...ops.join("\n").matchAll(/\/F\d+\s+([\d.]+)\s+Tf[\s\S]*?([\d.-]+)\s+([\d.-]+)\s+Td/g)].map((m, i) => ({
        text: texts[p][i],
        size: +m[1],
        left: +m[2] * PT,
        top: (841.89 - +m[3]) * PT,
      }))
    );
  };
  const content = (lines: ReturnType<typeof placed>[number]) => lines.filter((l) => l.top > 18 && l.top < 278).sort((a, b) => a.top - b.top);
  const SECTION_HEADINGS = ["Summary", "Goal progress", "Completed during this period", "Needs attention", "Check-in notes", "Points history", "Report notes"];
  const SUBHEADINGS = ["Active Goals", "Active Personal Achievements", "Wins", "Challenges", "Reflections", "Notes", "Moods noted in check-ins"];

  it("uses the approved footer and running header on every page", async () => {
    const tx = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, sourceType: "personal_goal_completion", sourceItemId: "g", points: i, reason: null, createdAt: "2026-07-01T00:00:00Z", date: "2026-07-01" }));
    const { pages } = await build(makeReport({ rewards: { pointsEarned: 1, transactions: tx } }));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((lines, i) => {
      expect(lines).toContain("Solace · Personal & confidential");
      expect(lines).toContain(`Page ${i + 1} of ${pages.length}`);
      if (i > 0) {
        expect(lines.includes("Solace")).toBe(false); // page 1 has the text mark when no logo is supplied
        expect(lines).toContain("Goals & Achievements Progress Report  ·  Last 30 days: 24 Jun 2026 – 23 Jul 2026");
      }
    });
  });

  it("gives wrapped Urdu the Journal line spacing, and leaves English spacing as it was", async () => {
    const urdu = Array.from({ length: 6 }, () => URDU_FULL).join(" ");
    const english = "Steady progress on small daily things ".repeat(14);
    const { doc } = await build(withNotes([urdu, english]));
    const lines = placed(doc).flat();
    const stepsOf = (test: (t: string) => boolean) => {
      const tops = lines.filter((l) => l.size === 9.5 && test(l.text)).map((l) => l.top);
      return tops.slice(1).map((t, i) => t - tops[i]);
    };
    const urduSteps = stepsOf((t) => /[؀-ۿ]/.test(t));
    expect(urduSteps.length).toBeGreaterThanOrEqual(2);
    for (const s of urduSteps) expect(s).toBeCloseTo(9.5 * PT * 1.95, 1);
    const englishSteps = stepsOf((t) => t.includes("Steady progress") || t.startsWith("daily things") || t.startsWith("small daily"));
    expect(englishSteps.length).toBeGreaterThanOrEqual(2);
    for (const s of englishSteps) expect(s).toBeCloseTo(9.5 * PT * 1.42, 1);
  });

  it("measures Urdu table rows with the taller lines, keeping them inside their row", async () => {
    const tx = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, sourceType: "personal_goal_completion", sourceItemId: "g", points: i, reason: `${URDU_FULL} ${URDU_FULL} ${URDU_FULL} ${URDU_FULL} ${URDU_FULL}`, createdAt: "2026-07-01T00:00:00Z", date: "2026-07-01" }));
    const { doc } = await build(makeReport({ rewards: { pointsEarned: 1, transactions: tx } }));
    for (const ops of (doc.internal as unknown as Internal).pages.slice(1)) {
      const body = ops.join("\n");
      const rows = [...body.matchAll(/([\d.]+)\s+([\d.]+)\s+m\s+([\d.]+)\s+([\d.]+)\s+l\s+S/g)].filter((m) => m[2] === m[4]).map((m) => +m[2]);
      const texts = [...body.matchAll(/\/F\d+\s+([\d.]+)\s+Tf[\s\S]*?([\d.-]+)\s+([\d.-]+)\s+Td/g)].map((m) => +m[3]);
      for (const y of rows) for (const t of texts) expect(Math.abs(y - t)).toBeGreaterThan(1.5); // pt: no rule on a baseline
    }
  });

  it("never leaves a heading alone at the foot of a page, across report sizes", async () => {
    const reports: ProgressReport[] = [];
    for (let goals = 1; goals <= 7; goals += 1) {
      for (const title of ["Morning walk", "روزانہ صبح کی سیر"]) {
        for (const wins of [0, 2, 9]) {
          reports.push({
            ...withNotes(wins ? [URDU_FULL] : []),
            activeGoals: Array.from({ length: goals }, (_, i) => goal({ id: `g${i}`, title })),
            wellbeingEntries: {
              ...makeReport().wellbeingEntries,
              wins: Array.from({ length: wins }, (_, i) => ({ text: i % 2 ? Array.from({ length: 5 }, () => URDU_FULL).join(" ") : "Ran my first 5k", date: "2026-07-19", itemId: "g1", itemType: "goal" as const, itemTitle: "Morning walk" })),
            },
          });
        }
      }
    }
    for (const report of reports) {
      const { doc, pages } = await build(report);
      placed(doc).forEach((lines, p) => {
        const body = content(lines);
        expect(body.length, `page ${p + 1} is blank`).toBeGreaterThan(0);
        if (p === pages.length - 1) return;
        const last = body[body.length - 1];
        expect([...SECTION_HEADINGS, ...SUBHEADINGS].includes(last.text) && last.size >= 10.5, `"${last.text}" stranded on page ${p + 1}`).toBe(false);
      });
    }
  }, 60000);

  it("moves an oversized row to the next page when its first line does not fit, then continues it intact", async () => {
    const BOTTOM = 274;
    const reasons = Array.from({ length: 90 }, (_, i) => (i % 10 === 9 ? URDU_COVERED : `Reason line ${i}`));
    const tx = (id: string, points: number, reason: string | null) => ({ id, sourceType: "personal_goal_completion", sourceItemId: "g", points, reason, createdAt: "2026-07-01T00:00:00Z", date: "2026-07-01" });
    const bodyPad = 2; // the table's top and bottom cell padding
    const firstLineH = bodyPad * 2 + 9.5 * PT * (0.78 + 0.24);
    const expected = ["1 Jul 2026", "Goal completion", "+999", ...reasons.map((r) => (r === URDU_COVERED ? rtlVisual(r) : r))];

    // Filler rows are as tall as the oversized row's first line, so one count leaves too little room for it.
    let exercised = 0;
    for (let fillers = 1; fillers <= 36; fillers += 1) {
      const transactions = [
        ...Array.from({ length: fillers }, (_, i) => tx(`f${i}`, i + 1, null)),
        tx("oversized", 999, reasons.join("\n")),
        tx("after", 1000, null),
      ];
      const { doc } = await build(makeReport({ rewards: { pointsEarned: 1, transactions } }));
      const pages = placed(doc);

      // No blank pages, and nothing below the content limit (or a rule through the footer).
      pages.forEach((lines, p) => {
        expect(lines.filter((l) => l.top > 18 && l.top < 280).length, `page ${p + 1} is blank`).toBeGreaterThan(0);
        for (const l of lines) if (l.top < 280) expect(l.top, `"${l.text}" on page ${p + 1}`).toBeLessThanOrEqual(BOTTOM);
      });

      const pageOf = (text: string) => pages.findIndex((lines) => lines.some((l) => l.text === text));
      const startPage = pageOf("+999");
      const endPage = pageOf("+1000");
      const start = pages[startPage].find((l) => l.text === "+999")!;
      const previousPage = pageOf(`+${fillers}`);
      const previous = pages[previousPage].find((l) => l.text === `+${fillers}`)!;

      // The row: every value once, in reading order, across all its pages.
      const rowLines = pages.flatMap((lines, p) =>
        lines
          .filter((l) => p >= startPage && p <= endPage && l.top >= 18 && l.top < 280)
          .filter((l) => (p > startPage || l.top >= start.top) && (p < endPage || l.top < pages[endPage].find((x) => x.text === "+1000")!.top))
          .filter((l) => !["Date", "Source", "Points"].includes(l.text))
          .sort((a, b) => a.top - b.top || a.left - b.left)
      );
      expect(rowLines.map((l) => l.text)).toEqual(expected);
      // Date, source and points share the first line.
      expect(rowLines.slice(0, 3).every((l) => l.top === start.top)).toBe(true);
      // The header repeats on every page the row touches.
      for (let p = startPage; p <= endPage; p += 1) {
        for (const label of ["Date", "Source", "Points"]) expect(pages[p].map((l) => l.text), `page ${p + 1}`).toContain(label);
      }

      const room = BOTTOM - (previous.top + 9.5 * PT * 0.24 + bodyPad);
      if (previousPage === startPage - 1 && room < firstLineH) {
        exercised += 1;
        // It moved: the first content under the repeated header, and it continues onto a further page.
        const header = pages[startPage].find((l) => l.text === "Points")!;
        expect(pages[startPage].filter((l) => l.top < 280 && l.top > header.top).sort((a, b) => a.top - b.top)[0].text).toBe("1 Jul 2026");
        expect(endPage).toBeGreaterThan(startPage);
      }
    }
    expect(exercised).toBeGreaterThan(0);
  }, 60000);

  it("draws the logo at its own proportions, 9 mm high", async () => {
    const png = fs.readFileSync(path.resolve(process.cwd(), "public/logos/logo white.png"));
    const ratio = png.readUInt32BE(16) / png.readUInt32BE(20);
    const logo = { dataUrl: `data:image/png;base64,${png.toString("base64")}`, width: Math.min(9 * ratio, 42), height: 9 };
    const { doc } = await buildProgressReportPdf(makeReport(), { fonts, logo });
    const m = /([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s+\/I\d+ Do/.exec((doc.internal as unknown as Internal).pages[1].join("\n"));
    expect(m).not.toBeNull();
    expect(+m![2] * PT).toBeCloseTo(9, 1);
    expect(+m![1] / +m![2]).toBeCloseTo(logo.width / logo.height, 1);
    expect(+m![3] * PT).toBeCloseTo(18, 1);
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
