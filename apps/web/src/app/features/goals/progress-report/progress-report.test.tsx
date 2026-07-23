import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { getReport } = vi.hoisted(() => ({ getReport: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { gamification: { getReport } } }));

import { ProgressReportPage } from "./ProgressReportPage";
import { progressReportQueryKey } from "./progress-report.queries";
import { normalizeRange } from "./progress-report.utils";
import type { ProgressReport } from "./progress-report.types";

// --- fixture: exact backend-provided values ---------------------------------
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
      activeGoals: 2,
      activeAchievements: 1,
      completedGoalsAllTime: 3,
      completedAchievementsAllTime: 2,
    },
    periodSummary: {
      completedGoals: 1,
      completedAchievements: 1,
      totalCheckIns: 18,
      activeCheckInDays: 12,
      overallConsistencyRate: 57,
      pointsEarned: 30,
      totalProgressChange: 27,
    },
    activeGoals: [
      {
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
      },
      {
        id: "g2",
        title: "Journal practice",
        category: "personal_growth",
        status: "active",
        priority: "medium",
        trackingType: "manual_milestone",
        trackingUnit: null,
        currentValue: null,
        targetValue: null,
        currentProgress: 75,
        progressAtStart: 50,
        progressAtEnd: 75,
        progressChange: 25,
        checkInsDuringPeriod: 5,
        activeCheckInDays: 5,
        consistencyRate: null,
        startDate: "2026-06-01",
        targetDate: null,
        isOverdue: false,
        isApproachingTarget: false,
        hasNoRecentCheckIns: false,
        hasNoProgressDuringPeriod: false,
        rewardAwarded: false,
      },
    ],
    activeAchievements: [
      {
        id: "a1",
        title: "Read every evening",
        category: "personal",
        status: "active",
        priority: null,
        trackingType: "manual_milestone",
        trackingUnit: null,
        currentValue: null,
        targetValue: null,
        currentProgress: 50,
        progressAtStart: 25,
        progressAtEnd: 50,
        progressChange: 25,
        checkInsDuringPeriod: 4,
        activeCheckInDays: 4,
        consistencyRate: 80,
        startDate: null,
        targetDate: null,
        isOverdue: false,
        isApproachingTarget: false,
        hasNoRecentCheckIns: false,
        hasNoProgressDuringPeriod: false,
        rewardAwarded: false,
      },
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
      wins: [
        { text: "Ran my first 5k", date: "2026-07-19", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" },
      ],
      challenges: [
        { text: "Rain made it hard", date: "2026-07-18", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" },
      ],
      reflections: [
        { text: "Felt steadier this week", date: "2026-07-17", itemId: "g1", itemType: "goal", itemTitle: "Morning walk" },
      ],
      notes: [
        { text: "Finished chapter 4", date: "2026-07-16", itemId: "a1", itemType: "achievement", itemTitle: "Read every evening" },
      ],
      moodCounts: [
        { mood: "calm", count: 4 },
        { mood: "motivation", count: 3 },
      ],
    },
    needsAttention: [
      {
        itemType: "goal",
        itemId: "g1",
        title: "Morning walk",
        reasons: ["overdue", "no_recent_check_ins"],
      },
    ],
    rewards: {
      pointsEarned: 30,
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
      "You checked in on 12 different days.",
      "You earned 30 points.",
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
    rewards: { pointsEarned: 0, transactions: [] },
    currentSnapshot: {
      ...makeReport().currentSnapshot,
      completedGoalsAllTime: 0,
      completedAchievementsAllTime: 0,
    },
  });

function LocationProbe() {
  const [params] = useSearchParams();
  return <div data-testid="location-range">{params.get("range") ?? ""}</div>;
}

function renderPage(initialEntry = "/app/settings/achievements/progress-report") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/app/settings/achievements/progress-report"
            element={
              <>
                <ProgressReportPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/app/settings/achievements" element={<div>Goals and Achievements page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getReport.mockResolvedValue(makeReport());
});

// ===========================================================================
describe("query behaviour", () => {
  it("defaults to the 30d range", async () => {
    renderPage();
    await waitFor(() => expect(getReport).toHaveBeenCalledWith("30d"));
  });

  it("respects a valid range from the URL", async () => {
    renderPage("/app/settings/achievements/progress-report?range=90d");
    await waitFor(() => expect(getReport).toHaveBeenCalledWith("90d"));
  });

  it("falls back to 30d for an invalid URL range", async () => {
    renderPage("/app/settings/achievements/progress-report?range=1y");
    await waitFor(() => expect(getReport).toHaveBeenCalledWith("30d"));
    expect(normalizeRange("1y")).toBe("30d");
    expect(normalizeRange(null)).toBe("30d");
  });

  it("requests the correct endpoint when the range changes and stays on the page", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });

    await user.click(screen.getByTestId("report-range-7d"));

    await waitFor(() => expect(getReport).toHaveBeenCalledWith("7d"));
    // URL query updated, still on the report page.
    await waitFor(() => expect(screen.getByTestId("location-range")).toHaveTextContent("7d"));
    expect(screen.getByRole("heading", { name: "Progress Report", level: 1 })).toBeInTheDocument();
  });

  it("uses a distinct, stable cache key per range", () => {
    expect(progressReportQueryKey("30d")).toEqual(["gamification-progress-report", "30d"]);
    expect(progressReportQueryKey("7d")).not.toEqual(progressReportQueryKey("30d"));
    // Stable across calls (no refetch loops from unstable keys).
    expect(progressReportQueryKey("7d")).toEqual(progressReportQueryKey("7d"));
  });

  it("goes through the authenticated API client", async () => {
    renderPage();
    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(1));
  });
});

// ===========================================================================
describe("state handling", () => {
  it("shows the structural skeleton first and no empty-state message", async () => {
    getReport.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("report-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("report-empty-state")).not.toBeInTheDocument();
  });

  it("renders the error state and retries via refetch", async () => {
    const user = userEvent.setup();
    getReport.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    const alert = await screen.findByTestId("report-error-state");
    expect(within(alert).getByText("We couldn’t load your Progress Report.")).toBeInTheDocument();
    // No raw error text leaked.
    expect(alert.textContent).not.toContain("boom");

    getReport.mockResolvedValue(makeReport());
    await user.click(screen.getByTestId("report-retry"));
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
  });

  it("shows the whole-report empty state with a way back", async () => {
    getReport.mockResolvedValue(emptyReport());
    renderPage();
    const empty = await screen.findByTestId("report-empty-state");
    expect(
      within(empty).getByText(/will appear here once you begin tracking/i)
    ).toBeInTheDocument();
    expect(within(empty).getByRole("link", { name: /Back to Goals & Achievements/i })).toBeInTheDocument();
  });

  it("shows compact section-level empty states", async () => {
    getReport.mockResolvedValue(
      makeReport({
        activeGoals: [],
        activeAchievements: [],
        completedDuringPeriod: [],
        wellbeingEntries: {
          wins: [],
          challenges: [],
          reflections: [],
          notes: [],
          moodCounts: [],
        },
      })
    );
    renderPage();
    expect(await screen.findByText("No active Goals.")).toBeInTheDocument();
    expect(screen.getByText("No active Personal Achievements.")).toBeInTheDocument();
    expect(
      screen.getByText("No Goals or Personal Achievements were completed during this period.")
    ).toBeInTheDocument();
    expect(screen.getByText("No wins were recorded during this period.")).toBeInTheDocument();
    expect(screen.getByText("No challenges were recorded during this period.")).toBeInTheDocument();
  });
});

// ===========================================================================
describe("report rendering (backend values displayed verbatim)", () => {
  beforeEach(() => {
    getReport.mockResolvedValue(makeReport());
  });

  it("renders the header with name, period label and description", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText(/A summary of your Goals, Personal Achievements/i)).toBeInTheDocument();
  });

  it("omits the name entirely when displayName is null", async () => {
    getReport.mockResolvedValue(makeReport({ user: { displayName: null } }));
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
    expect(screen.queryByText(/Unknown User/i)).not.toBeInTheDocument();
  });

  it("renders the current snapshot from backend values", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Current Snapshot" });
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.getByText("50 / 100 points")).toBeInTheDocument();
    expect(screen.getByText(/50 points remaining to level 5/)).toBeInTheDocument();
  });

  it("renders the period summary, including exact consistency and signed change", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Period Summary" });
    expect(screen.getByText("57%")).toBeInTheDocument(); // exact backend value
    expect(screen.getByText("+27 percentage points")).toBeInTheDocument();
    expect(
      screen.getByText(/Based on completed check-ins compared with expected check-ins/i)
    ).toBeInTheDocument();
  });

  it("shows Not available when overall consistency is null", async () => {
    getReport.mockResolvedValue(
      makeReport({
        periodSummary: { ...makeReport().periodSummary, overallConsistencyRate: null },
      })
    );
    renderPage();
    await screen.findByRole("heading", { name: "Period Summary" });
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });

  it("renders active Goals with current vs period progress clearly separated", async () => {
    renderPage();
    const goals = await screen.findByTestId("report-active-goals");
    const card = within(goals).getByText("Morning walk").closest("article") as HTMLElement;

    expect(within(card).getByText("Current Progress")).toBeInTheDocument();
    expect(within(card).getByText("72%")).toBeInTheDocument();
    expect(within(card).getByText("Change During This Period")).toBeInTheDocument();
    expect(within(card).getByText(/40%/)).toBeInTheDocument();
    expect(within(card).getByText("+32 percentage points")).toBeInTheDocument();
    // numeric tracking with unit
    expect(within(card).getByText("18 / 25 workouts")).toBeInTheDocument();
    // exact backend consistency, not recomputed from 9/…
    expect(within(card).getByText(/64%/)).toBeInTheDocument();
  });

  it("renders active Personal Achievements under the correct label", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Active Personal Achievements" })
    ).toBeInTheDocument();
    const list = screen.getByTestId("report-active-achievements");
    expect(within(list).getByText("Read every evening")).toBeInTheDocument();
  });

  it("renders completed items with ledger reward points", async () => {
    renderPage();
    const list = await screen.findByTestId("report-completed-list");
    expect(within(list).getByText("Goal Completed")).toBeInTheDocument();
    expect(within(list).getByText("Drink more water")).toBeInTheDocument();
    expect(within(list).getByText("20 points")).toBeInTheDocument(); // from the ledger
  });

  it("renders check-in activity and the most consistent item", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Check-In Activity" });
    const block = screen.getByText("Most consistent item").parentElement as HTMLElement;
    expect(block.textContent).toContain("Morning walk");
    expect(block.textContent).toContain("Goal");
    expect(block.textContent).toContain("64%");
  });

  it("renders wins, challenges, reflections, neutral notes and mood counts", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /Wins, Challenges, Reflections/i });

    expect(within(screen.getByTestId("report-wins")).getByText("Ran my first 5k")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("report-challenges")).getByText("Rain made it hard")
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("report-reflections")).getByText("Felt steadier this week")
    ).toBeInTheDocument();

    // Achievement note stays NEUTRAL: in notes, never in wins/challenges.
    const notes = screen.getByTestId("report-notes");
    expect(within(notes).getByText("Finished chapter 4")).toBeInTheDocument();
    expect(within(screen.getByTestId("report-wins")).queryByText("Finished chapter 4")).toBeNull();

    const moods = screen.getByTestId("report-moods");
    expect(within(moods).getByText(/Calm/)).toBeInTheDocument();
    expect(within(moods).getByText("4")).toBeInTheDocument();
  });

  it("renders one attention entry carrying all backend reason labels", async () => {
    renderPage();
    const list = await screen.findByTestId("report-attention-list");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(within(list).getByText("Past target date")).toBeInTheDocument();
    expect(within(list).getByText("No recent check-ins")).toBeInTheDocument();
    // Exactly one card for the flagged item.
    expect(within(list).getAllByText("Morning walk")).toHaveLength(1);
  });

  it("maps reward source codes to friendly labels", async () => {
    renderPage();
    const list = await screen.findByTestId("report-reward-transactions");
    expect(within(list).getByText("Goal completion")).toBeInTheDocument();
    expect(within(list).queryByText("personal_goal_completion")).toBeNull();
    expect(within(list).getByText("+20 points")).toBeInTheDocument();
  });

  it("renders the backend closing summary lines verbatim", async () => {
    renderPage();
    const summary = await screen.findByTestId("report-closing-summary");
    expect(
      within(summary).getByText("You completed 1 Goal during this reporting period.")
    ).toBeInTheDocument();
    expect(within(summary).getByText("You checked in on 12 different days.")).toBeInTheDocument();
    expect(within(summary).getByText("You earned 30 points.")).toBeInTheDocument();
  });

  it("renders an unmodified neutral fallback summary line", async () => {
    getReport.mockResolvedValue(
      makeReport({ closingSummary: ["No tracked progress activity in this period."] })
    );
    renderPage();
    const summary = await screen.findByTestId("report-closing-summary");
    expect(
      within(summary).getByText("No tracked progress activity in this period.")
    ).toBeInTheDocument();
  });
});

// ===========================================================================
describe("manual milestone display", () => {
  it("shows a Goal milestone as a percentage with no fake numeric fraction", async () => {
    renderPage();
    const goals = await screen.findByTestId("report-active-goals");
    const card = within(goals).getByText("Journal practice").closest("article") as HTMLElement;
    expect(within(card).getByText("75%")).toBeInTheDocument();
    // Labelled as milestone-based (tracking chip + explanatory line).
    expect(within(card).getAllByText(/Milestone-based/).length).toBeGreaterThan(0);
    expect(card.textContent).not.toMatch(/\/\s*100\s*units/i);
    expect(card.textContent).not.toMatch(/75\s*\/\s*100/);
  });

  it("shows an Achievement milestone as a percentage", async () => {
    renderPage();
    const list = await screen.findByTestId("report-active-achievements");
    const card = within(list).getByText("Read every evening").closest("article") as HTMLElement;
    expect(within(card).getByText("50%")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/50\s*\/\s*100/);
  });

  it("shows custom frequency instead of 0% consistency", async () => {
    renderPage();
    const goals = await screen.findByTestId("report-active-goals");
    const card = within(goals).getByText("Journal practice").closest("article") as HTMLElement;
    expect(within(card).getByText(/Custom frequency/)).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/\b0%\b/);
  });
});

// ===========================================================================
describe("accessibility", () => {
  it("uses a single h1 and section headings", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Current Snapshot", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active Goals", level: 2 })).toBeInTheDocument();
  });

  it("exposes an accessible, keyboard-usable range control", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });

    const group = screen.getByRole("group", { name: "Report period" });
    const sevenDay = within(group).getByRole("button", { name: "Last 7 Days" });
    expect(sevenDay).toHaveAttribute("aria-pressed", "false");

    sevenDay.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(getReport).toHaveBeenCalledWith("7d"));
  });

  it("gives progress bars accessible names and values", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("progressbar", { name: "Morning walk current progress" })
    ).toBeInTheDocument();
  });

  it("gives the back action an accessible name", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Progress Report", level: 1 });
    expect(
      screen.getByRole("link", { name: /Back to Goals & Achievements/i })
    ).toBeInTheDocument();
  });
});
