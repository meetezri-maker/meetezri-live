import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProgressReportItemCard } from "./ProgressReportItemCard";
import { ProgressReportCompletedSection } from "./ProgressReportCompletedSection";
import { originLabel, statusLabel, isRewardPending } from "./progress-report.utils";
import type { ProgressReportItem, ProgressReportCompletion } from "./progress-report.types";

const baseItem = (over: Partial<ProgressReportItem> = {}): ProgressReportItem => ({
  id: "x",
  title: "Item",
  origin: "personal",
  iconName: null,
  category: "wellness",
  status: "active",
  priority: null,
  trackingType: "count",
  trackingUnit: null,
  currentValue: 1,
  targetValue: 10,
  currentProgress: 10,
  progressAtStart: 0,
  progressAtEnd: 10,
  progressChange: 10,
  checkInsDuringPeriod: 0,
  activeCheckInDays: 0,
  consistencyRate: null,
  startDate: null,
  targetDate: null,
  isOverdue: false,
  isApproachingTarget: false,
  hasNoRecentCheckIns: false,
  hasNoProgressDuringPeriod: false,
  rewardAwarded: false,
  ...over,
});

describe("origin/status helpers", () => {
  it("labels origin, defaulting missing to Personal", () => {
    expect(originLabel("system")).toBe("System");
    expect(originLabel("personal")).toBe("Personal");
    expect(originLabel(undefined)).toBe("Personal");
  });

  it("labels the reward-pending status distinctly (never Active 100%)", () => {
    expect(statusLabel("completed_reward_pending")).toBe("Completed · Reward pending");
    expect(isRewardPending("completed_reward_pending")).toBe(true);
    expect(isRewardPending("active")).toBe(false);
    expect(statusLabel("active")).toBe("Active");
  });
});

describe("ProgressReportItemCard — origin + system rendering", () => {
  it("shows a Personal origin badge and no icon for personal items", () => {
    render(<ProgressReportItemCard item={baseItem({ origin: "personal" })} itemType="achievement" />);
    const badge = screen.getByTestId("report-origin-badge");
    expect(badge).toHaveTextContent("Personal");
  });

  it("shows a System origin badge for system items", () => {
    render(
      <ProgressReportItemCard
        item={baseItem({ origin: "system", iconName: "footprints", title: "First Steps" })}
        itemType="achievement"
      />
    );
    expect(screen.getByTestId("report-origin-badge")).toHaveTextContent("System");
    expect(screen.getByText("First Steps")).toBeInTheDocument();
  });

  it("renders the reward-pending state instead of Active 100%", () => {
    render(
      <ProgressReportItemCard
        item={baseItem({
          origin: "system",
          status: "completed_reward_pending",
          currentProgress: 100,
          rewardAwarded: false,
        })}
        itemType="achievement"
      />
    );
    expect(screen.getByText("Completed · Reward pending")).toBeInTheDocument();
    expect(screen.queryByText(/^Active$/)).not.toBeInTheDocument();
  });

  it("renders locked (0%) and in-progress states from backend values", () => {
    const { rerender } = render(
      <ProgressReportItemCard item={baseItem({ origin: "system", status: "not_started", currentProgress: 0 })} itemType="achievement" />
    );
    expect(screen.getByText("0%")).toBeInTheDocument();

    rerender(
      <ProgressReportItemCard item={baseItem({ origin: "system", status: "active", currentProgress: 30 })} itemType="achievement" />
    );
    expect(screen.getByText("30%")).toBeInTheDocument();
  });
});

describe("ProgressReportCompletedSection — origin", () => {
  const completion = (over: Partial<ProgressReportCompletion> = {}): ProgressReportCompletion => ({
    itemType: "achievement",
    itemId: "s1",
    title: "First Steps",
    origin: "system",
    completedAt: "2026-07-19",
    rewardPointsAwarded: 10,
    trackingType: "count",
    finalCurrentValue: 1,
    finalTargetValue: 1,
    ...over,
  });

  it("shows the origin label and ledger points on a system completion", () => {
    render(<ProgressReportCompletedSection completions={[completion()]} />);
    const list = screen.getByTestId("report-completed-list");
    expect(within(list).getByText("First Steps")).toBeInTheDocument();
    expect(within(list).getByTestId("report-completed-origin")).toHaveTextContent("System");
    expect(within(list).getByText("10 points")).toBeInTheDocument();
  });

  it("renders mixed personal + system completions together", () => {
    render(
      <ProgressReportCompletedSection
        completions={[
          completion({ itemId: "s1", title: "First Steps", origin: "system" }),
          completion({ itemId: "g1", title: "Drink water", origin: "personal", itemType: "goal" }),
        ]}
      />
    );
    const badges = screen.getAllByTestId("report-completed-origin").map((n) => n.textContent);
    expect(badges).toEqual(expect.arrayContaining(["System", "Personal"]));
  });
});
