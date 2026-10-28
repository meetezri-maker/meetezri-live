/**
 * PDF download guards: only the settled report for the selected range and account can be
 * exported; changes during generation cancel the download; repeated clicks run once.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  getReport: vi.fn(),
  download: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
  auth: { current: { user: { id: "user-a" } as { id: string } | null } },
}));

vi.mock("@/lib/api", () => ({ api: { gamification: { getReport: h.getReport } } }));
vi.mock("@/app/contexts/AuthContext", () => ({ useAuth: () => h.auth.current }));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("./progress-report.pdf", () => ({ downloadProgressReportPdf: h.download }));

import { ProgressReportPage } from "./ProgressReportPage";
import { PdfUnsupportedTextError } from "./progress-report.pdf-text";
import type { ProgressReport, ProgressReportRange } from "./progress-report.types";

const LABELS: Record<ProgressReportRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" };

const report = (range: ProgressReportRange, name = "Alex"): ProgressReport => ({
  version: 1, generatedAt: "2026-07-23T12:00:00.000Z", timezone: "UTC",
  period: { range, start: range === "all" ? null : "2026-06-24", end: "2026-07-23", label: LABELS[range] },
  user: { displayName: name },
  currentSnapshot: { totalPoints: 10, currentLevel: 1, pointsIntoLevel: 10, pointsRequiredForNextLevel: 100, pointsRemainingToNextLevel: 90, activeGoals: 0, activeAchievements: 0, completedGoalsAllTime: 1, completedAchievementsAllTime: 0 },
  periodSummary: { completedGoals: 0, completedAchievements: 0, totalCheckIns: 0, activeCheckInDays: 0, overallConsistencyRate: null, pointsEarned: 0, totalProgressChange: 0 },
  activeGoals: [], activeAchievements: [], completedDuringPeriod: [],
  checkInActivity: { totalCheckIns: 0, activeDays: 0, mostConsistentItem: null },
  wellbeingEntries: { wins: [], challenges: [], reflections: [], notes: [], moodCounts: [] },
  needsAttention: [], rewards: { pointsEarned: 0, transactions: [] }, closingSummary: [],
});

function renderPage(initialRange: ProgressReportRange = "30d") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/r?range=${initialRange}`]}>
        <Routes>
          <Route path="/r" element={<ProgressReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const utils = render(tree());
  return { ...utils, rerenderPage: () => utils.rerender(tree()) };
}

const downloadButton = () => screen.findByRole("button", { name: /Download PDF|Preparing PDF/ });
const pickRange = (label: RegExp) => fireEvent.click(screen.getByRole("button", { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.current = { user: { id: "user-a" } };
  h.download.mockResolvedValue("downloaded");
});

describe("Progress report PDF download guards", () => {
  it("is disabled while a new range loads, then exports the newly loaded period", async () => {
    let release7d: (r: ProgressReport) => void = () => {};
    h.getReport.mockImplementation((range: ProgressReportRange) =>
      range === "7d" ? new Promise((r) => { release7d = r; }) : Promise.resolve(report(range))
    );
    renderPage("30d");
    await waitFor(async () => expect(await downloadButton()).not.toBeDisabled());

    pickRange(/Last 7 Days/i);
    await waitFor(async () => expect(await downloadButton()).toBeDisabled()); // previous range still on screen

    await act(async () => release7d(report("7d")));
    const button = await downloadButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(h.download).toHaveBeenCalledTimes(1));
    expect((h.download.mock.calls[0][0] as ProgressReport).period.range).toBe("7d");
  });

  it("offers no export of the old range when the new range fails to load", async () => {
    h.getReport.mockImplementation((range: ProgressReportRange) =>
      range === "90d" ? Promise.reject(new Error("500")) : Promise.resolve(report(range))
    );
    renderPage("30d");
    await waitFor(async () => expect(await downloadButton()).not.toBeDisabled());
    pickRange(/Last 90 Days/i);
    await screen.findByText(/couldn.t load your Progress Report/i);
    expect(screen.queryByRole("button", { name: /Download PDF/ })).toBeNull();
    expect(h.download).not.toHaveBeenCalled();
  });

  it("runs one generation for repeated clicks", async () => {
    let finish: (v: string) => void = () => {};
    h.download.mockImplementation(() => new Promise((r) => { finish = r; }));
    h.getReport.mockResolvedValue(report("30d"));
    renderPage();
    const button = await downloadButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(h.download).toHaveBeenCalledTimes(1);
    await act(async () => finish("downloaded"));
  });

  it("cancels the download if the range or account changes during generation", async () => {
    let checkCurrent: () => boolean = () => true;
    let finish: () => void = () => {};
    h.download.mockImplementation((_r: ProgressReport, isStillCurrent: () => boolean) => {
      checkCurrent = isStillCurrent;
      return new Promise((resolve) => { finish = () => resolve(isStillCurrent() ? "downloaded" : "cancelled"); });
    });
    h.getReport.mockImplementation((range: ProgressReportRange) => Promise.resolve(report(range)));
    const { rerenderPage } = renderPage();
    const button = await downloadButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    expect(checkCurrent()).toBe(true);

    h.auth.current = { user: { id: "user-b" } };
    rerenderPage();
    expect(checkCurrent()).toBe(false);
    await act(async () => finish());
    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
  });

  it("never shows or exports another account's report while the new account's report loads", async () => {
    let releaseB: (r: ProgressReport) => void = () => {};
    h.getReport.mockImplementation(() =>
      h.auth.current?.user?.id === "user-b" ? new Promise((r) => { releaseB = r; }) : Promise.resolve(report("30d", "Account A"))
    );
    const { rerenderPage } = renderPage();
    await screen.findByText("Account A");
    h.auth.current = { user: { id: "user-b" } };
    rerenderPage();
    await waitFor(() => expect(screen.queryByText("Account A")).toBeNull());
    await act(async () => releaseB(report("30d", "Account B")));
    await screen.findByText("Account B");
  });

  it("shows a specific error when the report's text can't be drawn faithfully", async () => {
    h.getReport.mockResolvedValue(report("30d"));
    h.download.mockRejectedValueOnce(new PdfUnsupportedTextError(["م"], "font-unavailable"));
    h.download.mockRejectedValueOnce(new PdfUnsupportedTextError(["你", "好"], "no-glyph"));
    renderPage();
    const button = await downloadButton();
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(1));
    expect(h.toast.error.mock.calls[0][0]).toMatch(/fonts needed for this report couldn't be loaded, so the PDF wasn't downloaded/);

    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(2));
    expect(h.toast.error.mock.calls[1][0]).toBe("This report contains characters the PDF can't display (你 好), so it wasn't downloaded.");
  });
});
