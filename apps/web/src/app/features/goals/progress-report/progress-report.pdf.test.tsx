import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- recording fake jsPDF ---------------------------------------------------
const { docs, JsPdfMock, failNext, toastError } = vi.hoisted(() => {
  interface TextCall { page: number; text: string; x: number; y: number }
  interface RectCall { page: number; x: number; y: number; w: number; h: number; style: string }

  const docs: FakeDoc[] = [];
  const failNext = { value: false };

  class FakeDoc {
    pages = 1;
    current = 1;
    texts: TextCall[] = [];
    rects: RectCall[] = [];
    images = 0;

    addPage() {
      this.pages += 1;
      this.current = this.pages;
    }
    setPage(n: number) {
      this.current = n;
    }
    getNumberOfPages() {
      return this.pages;
    }
    /** Approximate width-based wrapper so wrapping behaviour is exercised. */
    splitTextToSize(text: string, width: number): string[] {
      const perLine = Math.max(8, Math.floor(width / 1.9));
      const words = String(text).split(/\s+/).filter(Boolean);
      const out: string[] = [];
      let line = "";
      for (const w of words) {
        if (line && (line + " " + w).length > perLine) {
          out.push(line);
          line = w;
        } else {
          line = line ? `${line} ${w}` : w;
        }
      }
      if (line) out.push(line);
      return out.length ? out : [""];
    }
    text(t: string, x: number, y: number) {
      this.texts.push({ page: this.current, text: String(t), x, y });
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    roundedRect(x: number, y: number, w: number, h: number, _rx: number, _ry: number, style: string) {
      this.rects.push({ page: this.current, x, y, w, h, style });
    }
    rect(x: number, y: number, w: number, h: number, style: string) {
      this.rects.push({ page: this.current, x, y, w, h, style });
    }
    line() {}
    addImage() {
      this.images += 1;
    }
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    output() {
      return new Blob(["%PDF-1.4"], { type: "application/pdf" });
    }
    save() {}
  }

  const JsPdfMock = vi.fn(() => {
    if (failNext.value) {
      failNext.value = false;
      throw new Error("pdf boom");
    }
    const d = new FakeDoc();
    docs.push(d);
    return d;
  });

  return { docs, JsPdfMock, failNext, toastError: vi.fn() };
});

vi.mock("jspdf", () => ({ jsPDF: JsPdfMock }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import {
  buildProgressReportPdf,
  downloadProgressReportPdf,
  progressReportFileName,
} from "./progress-report.pdf";
import { ProgressReportDownloadButton } from "./ProgressReportDownloadButton";
import type { ProgressReport, ProgressReportItem } from "./progress-report.types";

// --- fixtures ---------------------------------------------------------------
const goal = (over: Partial<ProgressReportItem> = {}): ProgressReportItem => ({
  id: "g1",
  title: "Morning walk",
  category: "wellness",
  status: "active",
  priority: "high",
  trackingType: "count",
  trackingUnit: "workouts",
  currentValue: 18,
  targetValue: 25,
  currentProgress: 72,
  progressAtStart: 40,
  progressAtEnd: 72,
  progressChange: 32,
  checkInsDuringPeriod: 9,
  activeCheckInDays: 9,
  consistencyRate: 64,
  startDate: "2026-05-01",
  targetDate: "2026-08-30",
  isOverdue: false,
  isApproachingTarget: false,
  hasNoRecentCheckIns: false,
  hasNoProgressDuringPeriod: false,
  rewardAwarded: false,
  ...over,
});

function makeReport(over: Partial<ProgressReport> = {}): ProgressReport {
  return {
    version: 1,
    generatedAt: "2026-07-23T12:00:00.000Z",
    timezone: "UTC",
    period: { range: "30d", start: "2026-06-24", end: "2026-07-23", label: "Last 30 days" },
    user: { displayName: "Alex Rivera" },
    currentSnapshot: {
      totalPoints: 350,
      currentLevel: 4,
      pointsIntoLevel: 50,
      pointsRequiredForNextLevel: 100,
      pointsRemainingToNextLevel: 50,
      activeGoals: 1,
      activeAchievements: 1,
      completedGoalsAllTime: 3,
      completedAchievementsAllTime: 2,
    },
    periodSummary: {
      completedGoals: 1,
      completedAchievements: 0,
      totalCheckIns: 18,
      activeCheckInDays: 12,
      overallConsistencyRate: 57,
      pointsEarned: 20,
      totalProgressChange: 27,
    },
    activeGoals: [goal()],
    activeAchievements: [
      goal({ id: "a1", title: "Read every evening", trackingType: "manual_milestone", currentValue: null, targetValue: null, trackingUnit: null, currentProgress: 50, consistencyRate: null }),
    ],
    completedDuringPeriod: [
      {
        itemType: "goal",
        itemId: "g9",
        title: "Drink more water",
        completedAt: "2026-07-19",
        rewardPointsAwarded: 20,
        trackingType: "count",
        finalCurrentValue: 30,
        finalTargetValue: 30,
      },
    ],
    checkInActivity: {
      totalCheckIns: 18,
      activeDays: 12,
      mostConsistentItem: { itemType: "goal", itemId: "g1", title: "Morning walk", rate: 64 },
    },
    wellbeingEntries: {
      wins: [{ text: "Ran my first 5k", date: "2026-07-19", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" }],
      challenges: [{ text: "Rain made it hard", date: "2026-07-18", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" }],
      reflections: [],
      notes: [],
      moodCounts: [{ mood: "calm", count: 4 }],
    },
    needsAttention: [
      { itemType: "goal", itemId: "g1", title: "Morning walk", reasons: ["overdue", "no_recent_check_ins"] },
    ],
    rewards: {
      pointsEarned: 20,
      transactions: [
        {
          id: "t1",
          sourceType: "personal_goal_completion",
          sourceItemId: "g9",
          points: 20,
          reason: "Goal completed",
          createdAt: "2026-07-19T10:00:00.000Z",
          date: "2026-07-19",
        },
      ],
    },
    closingSummary: [
      "You completed 1 Goal during this reporting period.",
      "You earned 20 points.",
    ],
    ...over,
  };
}

const emptyReport = (): ProgressReport =>
  makeReport({
    activeGoals: [],
    activeAchievements: [],
    completedDuringPeriod: [],
    checkInActivity: { totalCheckIns: 0, activeDays: 0, mostConsistentItem: null },
    wellbeingEntries: { wins: [], challenges: [], reflections: [], notes: [], moodCounts: [] },
    needsAttention: [],
    rewards: { pointsEarned: 0, transactions: [] },
    closingSummary: [],
  });

/** All text drawn on a given page, joined. */
const pageText = (d: { texts: Array<{ page: number; text: string }> }, page: number) =>
  d.texts.filter((t) => t.page === page).map((t) => t.text).join(" ");
const allText = (d: { texts: Array<{ text: string }> }) => d.texts.map((t) => t.text).join(" ");

beforeEach(() => {
  vi.clearAllMocks();
  docs.length = 0;
  failNext.value = false;
  // Logo fetch is unavailable in jsdom -> renderer must degrade to a text header.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
});

// ===========================================================================
describe("file naming", () => {
  it("uses solace-progress-report-YYYY-MM-DD.pdf from the generated date", () => {
    expect(progressReportFileName(makeReport())).toBe("solace-progress-report-2026-07-23.pdf");
  });

  it("always produces a safe dated filename", () => {
    expect(progressReportFileName(makeReport({ generatedAt: "not-a-date" }))).toMatch(
      /^solace-progress-report-\d{4}-\d{2}-\d{2}\.pdf$/
    );
  });
});

// ===========================================================================
describe("document structure", () => {
  it("renders the cover title, subtitle and period", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string; page: number }> };
    const text = allText(d);
    expect(text).toContain("Goals & Achievements Progress Report");
    expect(text).toContain("Your personal wellness progress and growth.");
    expect(text).toContain("Last 30 days");
    expect(text).toContain("Alex Rivera");
  });

  it("renders every required section heading", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string; page: number }> };
    const text = allText(d);
    for (const heading of [
      "Executive Summary",
      "Active Goals",
      "Active Personal Achievements",
      "Period Summary",
      "Completed During This Period",
      "Check-In Activity",
      "Needs Attention",
      "Rewards & Levels",
      "Summary",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("uses a text wordmark when no logo image is available", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as {
      texts: Array<{ text: string }>;
      images: number;
    };
    expect(d.images).toBe(0);
    expect(allText(d)).toContain("Solace");
  });
});

// ===========================================================================
describe("header and footer on every page", () => {
  it("stamps the running header and Page X of Y on all pages", async () => {
    const many = Array.from({ length: 14 }, (_, i) => goal({ id: `g${i}`, title: `Goal number ${i}` }));
    const d = (await buildProgressReportPdf(makeReport({ activeGoals: many }))) as unknown as {
      pages: number;
      texts: Array<{ page: number; text: string }>;
    };
    expect(d.pages).toBeGreaterThan(1);

    for (let p = 1; p <= d.pages; p += 1) {
      const text = pageText(d, p);
      expect(text).toContain("Solace");
      expect(text).toContain("Goals & Achievements Progress Report");
      expect(text).toContain(`Page ${p} of ${d.pages}`);
      expect(text).toContain("Generated:");
    }
  });
});

// ===========================================================================
describe("pagination", () => {
  it("produces multiple pages for a large report", async () => {
    const many = Array.from({ length: 30 }, (_, i) => goal({ id: `g${i}`, title: `Goal ${i}` }));
    const wins = Array.from({ length: 60 }, (_, i) => ({
      text: `Win number ${i} with a reasonably long description that needs wrapping across lines.`,
      date: "2026-07-19",
      itemId: "g1",
      itemType: "goal" as const,
      itemTitle: "Morning walk",
    }));
    const d = (await buildProgressReportPdf(
      makeReport({ activeGoals: many, wellbeingEntries: { ...makeReport().wellbeingEntries, wins } })
    )) as unknown as { pages: number };
    expect(d.pages).toBeGreaterThan(3);
  });

  it("never splits an item card across a page boundary", async () => {
    const many = Array.from({ length: 20 }, (_, i) => goal({ id: `g${i}`, title: `Goal ${i}` }));
    const d = (await buildProgressReportPdf(makeReport({ activeGoals: many }))) as unknown as {
      rects: Array<{ page: number; y: number; h: number; style: string }>;
    };
    // Card surfaces are the full-width outlined rects; each must fit its page.
    const cards = d.rects.filter((r) => r.style === "FD" && r.h > 25);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.y + card.h).toBeLessThanOrEqual(297);
    }
  });
});

// ===========================================================================
describe("progress bars", () => {
  it("draws a filled bar sized from the backend percentage only", async () => {
    const d = (await buildProgressReportPdf(
      makeReport({ activeGoals: [goal({ currentProgress: 72 })], activeAchievements: [] })
    )) as unknown as { rects: Array<{ w: number; h: number; style: string }> };

    const bars = d.rects.filter((r) => r.h === 3.2 && r.style === "F");
    expect(bars.length).toBeGreaterThanOrEqual(2); // track + fill
    const track = bars.find((b) => b.w === 170);
    const fillBar = bars.find((b) => Math.abs(b.w - 170 * 0.72) < 0.01);
    expect(track).toBeTruthy();
    expect(fillBar).toBeTruthy(); // width is exactly 72% of the track
  });

  it("clamps out-of-range percentages safely", async () => {
    const d = (await buildProgressReportPdf(
      makeReport({ activeGoals: [goal({ currentProgress: 250 })], activeAchievements: [] })
    )) as unknown as { rects: Array<{ w: number; h: number; style: string }> };
    const bars = d.rects.filter((r) => r.h === 3.2 && r.style === "F");
    // No bar may exceed its track (item bars 170mm, level bar 178mm full width).
    for (const b of bars) expect(b.w).toBeLessThanOrEqual(178.001);
    // The 250% item bar is clamped to exactly its 170mm track, never wider.
    expect(bars.some((b) => Math.abs(b.w - 170) < 0.01)).toBe(true);
  });

  it("prints the percentage next to the bar", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    expect(allText(d)).toContain("72%");
  });
});

// ===========================================================================
describe("content rendering (backend values verbatim)", () => {
  it("renders item detail using backend values", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("Morning walk");
    expect(text).toContain("18 / 25 workouts");
    expect(text).toContain("Consistency: 64%");
    expect(text).toContain("Period: 40% to 72%");
    expect(text).toContain("+32 percentage points");
  });

  it("shows custom frequency instead of a 0% consistency", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    expect(allText(d)).toContain("Consistency: Custom frequency");
  });

  it("renders completed items with ledger points", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("Drink more water");
    expect(text).toContain("20 pts");
  });

  it("renders rewards with friendly labels, never raw codes", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("Goal completion");
    expect(text).toContain("+20 pts");
    expect(text).not.toContain("personal_goal_completion");
  });

  it("renders backend attention reasons and infers none", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("Past target date");
    expect(text).toContain("No recent check-ins");
    expect(text).not.toContain("Target date is approaching");
  });

  it("renders the closing summary lines verbatim", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("You completed 1 Goal during this reporting period.");
    expect(text).toContain("You earned 20 points.");
  });

  it("renders mood summary counts", async () => {
    const d = (await buildProgressReportPdf(makeReport())) as unknown as { texts: Array<{ text: string }> };
    expect(allText(d)).toContain("Calm - 4");
  });
});

// ===========================================================================
describe("long content", () => {
  it("wraps a very long note over many lines without truncating it", async () => {
    const longText = Array.from({ length: 90 }, (_, i) => `sentence${i}`).join(" ");
    const d = (await buildProgressReportPdf(
      makeReport({
        wellbeingEntries: {
          ...makeReport().wellbeingEntries,
          notes: [
            { text: longText, date: "2026-07-19", itemId: "a1", itemType: "achievement", itemTitle: "Read every evening" },
          ],
        },
      })
    )) as unknown as { texts: Array<{ text: string }> };

    const joined = allText(d);
    // First and last fragments both present -> nothing cut off.
    expect(joined).toContain("sentence0");
    expect(joined).toContain("sentence89");
  });
});

// ===========================================================================
describe("empty report", () => {
  it("keeps every section and shows the empty message", async () => {
    const d = (await buildProgressReportPdf(emptyReport())) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    for (const heading of [
      "Executive Summary",
      "Active Goals",
      "Active Personal Achievements",
      "Period Summary",
      "Completed During This Period",
      "Check-In Activity",
      "Needs Attention",
      "Rewards & Levels",
      "Summary",
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain("No activity during this reporting period.");
    expect(text).toContain("No active Goals.");
  });
});

// ===========================================================================
describe("download button", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("renders an accessible Download PDF button", () => {
    render(<ProgressReportDownloadButton report={makeReport()} />);
    expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
  });

  it("downloads a file with the dated Solace name", async () => {
    const user = userEvent.setup();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("solace-progress-report-2026-07-23.pdf");
      });

    render(<ProgressReportDownloadButton report={makeReport()} />);
    await user.click(screen.getByRole("button", { name: /Download PDF/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(JsPdfMock).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows a toast and recovers when generation fails", async () => {
    const user = userEvent.setup();
    failNext.value = true;

    render(<ProgressReportDownloadButton report={makeReport()} />);
    const button = screen.getByRole("button", { name: /Download PDF/i });
    await user.click(button);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Unable to generate your report. Please try again.")
    );
    // Control is restored, not stuck in a pending state.
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("exposes a busy state while generating", async () => {
    render(<ProgressReportDownloadButton report={makeReport()} />);
    const button = screen.getByRole("button", { name: /Download PDF/i });
    expect(button).toHaveAttribute("aria-busy", "false");
  });
});

// ===========================================================================
describe("no additional API calls", () => {
  it("builds entirely from the passed report object", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("no network"));
    vi.stubGlobal("fetch", fetchSpy);
    await buildProgressReportPdf(makeReport());
    // The only fetch attempted is the optional local logo asset.
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).toContain("/logos/");
    }
  });
});

describe("system achievements in the PDF (Phase 5)", () => {
  it("renders a system achievement with its origin label", async () => {
    const report = makeReport({
      activeAchievements: [
        goal({ id: "s1", title: "First Steps", origin: "system", iconName: "footprints", status: "active", currentProgress: 30 }),
      ],
    });
    const d = (await buildProgressReportPdf(report)) as unknown as { texts: Array<{ text: string }> };
    const text = allText(d);
    expect(text).toContain("First Steps");
    expect(text).toContain("Origin: System");
  });

  it("renders the reward-pending status verbatim (never Active 100%)", async () => {
    const report = makeReport({
      activeAchievements: [
        goal({ id: "s1", title: "First Steps", origin: "system", status: "completed_reward_pending", currentProgress: 100 }),
      ],
    });
    const d = (await buildProgressReportPdf(report)) as unknown as { texts: Array<{ text: string }> };
    expect(allText(d)).toContain("Completed · Reward pending");
  });

  it("renders a system completion with origin + ledger reward, and no invented reward without a ledger row", async () => {
    const withReward = makeReport({
      completedDuringPeriod: [
        {
          itemType: "achievement",
          itemId: "s1",
          title: "First Steps",
          origin: "system",
          completedAt: "2026-07-19",
          rewardPointsAwarded: 10,
          trackingType: "count",
          finalCurrentValue: 1,
          finalTargetValue: 1,
        },
      ],
    });
    const d1 = (await buildProgressReportPdf(withReward)) as unknown as { texts: Array<{ text: string }> };
    const t1 = allText(d1);
    expect(t1).toContain("First Steps");
    expect(t1).toContain("System");
    expect(t1).toContain("10 pts");

    const noReward = makeReport({
      completedDuringPeriod: [
        {
          itemType: "achievement",
          itemId: "s2",
          title: "Mood Master",
          origin: "system",
          completedAt: "2026-07-19",
          rewardPointsAwarded: 0, // no ledger row yet
          trackingType: "count",
          finalCurrentValue: 7,
          finalTargetValue: 7,
        },
      ],
    });
    const d2 = (await buildProgressReportPdf(noReward)) as unknown as { texts: Array<{ text: string }> };
    expect(allText(d2)).toContain("0 pts");
  });

  it("paginates a mixed personal + system report across multiple pages", async () => {
    const many = Array.from({ length: 16 }, (_, i) =>
      goal({ id: `s${i}`, title: `System achievement ${i}`, origin: i % 2 ? "system" : "personal" })
    );
    const d = (await buildProgressReportPdf(
      makeReport({ activeAchievements: many })
    )) as unknown as { pages: number; texts: Array<{ page: number; text: string }> };
    expect(d.pages).toBeGreaterThan(1);
    for (let p = 1; p <= d.pages; p += 1) {
      expect(pageText(d, p)).toContain(`Page ${p} of ${d.pages}`);
    }
  });
});
