/**
 * Conversations UI with the REAL (API) service: preview labels hidden, deep-link loading, and the
 * client-side safety layer. Fetch, Supabase, the crisis-report API and SafetyContext are mocked.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafetyState } from "@/app/types/safety";

const safety = vi.hoisted(() => ({
  state: "NORMAL" as SafetyState,
  updateState: vi.fn(async () => undefined),
}));
vi.mock("@/app/contexts/SafetyContext", () => ({
  useSafety: () => ({ currentState: safety.state, updateState: safety.updateState }),
}));

const reportCrisisEvent = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/api", () => ({ api: { reportCrisisEvent } }));

const analyze = vi.hoisted(() => vi.fn());
vi.mock("@/app/utils/safetyDetection", () => ({ analyzeTextForSafety: analyze }));

import { createApiConversationService } from "./apiConversationService";
import {
  ConversationSafety,
  EMERGENCY_RESOURCES_PATH,
  resetConversationSafetyThrottle,
  type ConversationSafetyHandle,
} from "./components/ConversationSafety";
import { ConversationServiceProvider } from "./ConversationsServiceContext";
import { ConversationsPage } from "./ConversationsPage";
import { CONVERSATIONS_ROUTE_PATTERN } from "./conversationsFlag";
import { stubMatchMedia } from "./testUtils";

const CONV = "11111111-1111-4111-8111-111111111111";
const T0 = "2026-11-20T10:00:00.000Z";
const summary = {
  id: CONV,
  companion_key: "Sara Mitchell",
  title: "Trouble sleeping",
  preview: "Hello.",
  created_at: T0,
  updated_at: T0,
  last_message_at: T0,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function apiService(listDelay?: Promise<void>) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(`/conversations/${CONV}/messages?limit=100`)) {
      return json({ items: [{ id: "m1", conversation_id: CONV, role: "assistant", content: "Hello.", status: "complete", created_at: T0 }] });
    }
    if (url.includes("/conversations?limit=")) {
      if (listDelay) await listDelay;
      return json({ items: [summary], next_cursor: null });
    }
    throw new Error(`unexpected ${url}`);
  });
  return createApiConversationService({
    apiBase: "/api",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getAccessToken: async () => "t",
  });
}

function renderPage(path: string, service = apiService()) {
  return render(
    <ConversationServiceProvider service={service}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={CONVERSATIONS_ROUTE_PATTERN} element={<ConversationsPage />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ConversationServiceProvider>
  );
}

beforeEach(() => {
  stubMatchMedia({ "(min-width: 1024px)": true, "(min-width: 1280px)": true });
  safety.state = "NORMAL";
  resetConversationSafetyThrottle();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Conversations page with the API service", () => {
  it("loads saved conversations and shows no preview labels", async () => {
    renderPage("/app/conversations");
    expect(await screen.findByText("Trouble sleeping")).toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("shows a loading state for a deep link until the list arrives, then the thread", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    renderPage(`/app/conversations/${CONV}`, apiService(gate));

    expect(await screen.findByText("Loading your conversation…")).toBeInTheDocument();
    expect(screen.queryByText("This conversation isn’t available")).not.toBeInTheDocument();

    await act(async () => release());
    expect(await screen.findByRole("heading", { name: "Romy" })).toBeInTheDocument();
    expect(await screen.findByText("Hello.", { selector: "div" })).toBeInTheDocument();
    expect(screen.queryByText(/Preview · replies are simulated/)).not.toBeInTheDocument();
  });
});

describe("ConversationSafety", () => {
  function renderSafety(variant: "page" | "compact" = "page") {
    const ref = createRef<ConversationSafetyHandle>();
    const utils = render(
      <MemoryRouter initialEntries={["/app/conversations/x"]}>
        <ConversationSafety ref={ref} variant={variant} />
        <LocationProbe />
      </MemoryRouter>
    );
    return { ref, ...utils };
  }

  it("reports concerning messages (throttled) and moves the shared safety state", () => {
    analyze.mockReturnValue({
      suggestedState: "HIGH_RISK",
      confidence: 0.8,
      matchedKeywords: ["hopeless"],
      detectedSignals: ["hopelessness"],
    });
    const { ref } = renderSafety();

    ref.current!.check("I feel hopeless");
    ref.current!.check("still hopeless");

    expect(reportCrisisEvent).toHaveBeenCalledTimes(1);
    expect(reportCrisisEvent).toHaveBeenCalledWith({
      riskLevel: "high",
      eventType: "keyword_detection",
      keywords: ["hopeless"],
      aiConfidence: 80,
      notes: "Auto-detected in text conversation (HIGH_RISK)",
    });
    expect(safety.updateState).toHaveBeenCalledWith("HIGH_RISK", "conversation_analysis", ["hopelessness"]);
  });

  it("does nothing for ordinary messages", () => {
    analyze.mockReturnValue({ suggestedState: "NORMAL", confidence: 0.5, matchedKeywords: [], detectedSignals: [] });
    const { ref } = renderSafety();
    ref.current!.check("Tell me about breathing exercises");
    expect(reportCrisisEvent).not.toHaveBeenCalled();
    expect(safety.updateState).not.toHaveBeenCalled();
  });

  it("never throws, even if analysis fails", () => {
    analyze.mockImplementation(() => {
      throw new Error("boom");
    });
    const { ref } = renderSafety();
    expect(() => ref.current!.check("anything")).not.toThrow();
  });

  it("shows the Safety Alert banner when the state escalates, linking to Emergency Resources", () => {
    const { rerender } = renderSafety("page");
    expect(screen.queryByText("Safety Alert!")).not.toBeInTheDocument();

    safety.state = "ELEVATED_CONCERN";
    rerender(
      <MemoryRouter initialEntries={["/app/conversations/x"]}>
        <ConversationSafety variant="page" />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.getByText("Safety Alert!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Resources" }));
    expect(screen.getByTestId("location")).toHaveTextContent(EMERGENCY_RESOURCES_PATH);
  });

  it("quick chat goes straight to Emergency Resources on HIGH_RISK (the window hides itself)", async () => {
    const { rerender } = renderSafety("compact");
    safety.state = "HIGH_RISK";
    rerender(
      <MemoryRouter initialEntries={["/app/conversations/x"]}>
        <ConversationSafety variant="compact" />
        <LocationProbe />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(EMERGENCY_RESOURCES_PATH));
  });
});
