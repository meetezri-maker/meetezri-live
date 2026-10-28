/**
 * Wellness Plan printing on the real page: every print action uses one preparation path, the
 * printed copy matches what is displayed (with an honest saved/draft label), printing never
 * saves, repeated clicks open one dialog, account changes cancel, and print state is cleaned up.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  auth: { current: { user: { id: "user-a" } as { id: string } | null } },
  get: vi.fn(),
  save: vi.fn(),
  contacts: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/contexts/AuthContext", () => ({ useAuth: () => h.auth.current }));
vi.mock("@/app/contexts/SafetyContext", () => ({ useSafety: () => ({ userRegion: "US" }) }));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/lib/api", () => ({
  api: {
    wellnessPlan: { get: h.get, save: h.save, clear: vi.fn() },
    emergencyContacts: { getAll: h.contacts },
  },
}));

import { SafetyPlan } from "./SafetyPlan";

const PLAN = {
  id: "plan-1",
  user_id: "user-a",
  warning_signs: ["Not sleeping", "آج میں بہت پریشان ہوں۔ (2 دن)"],
  coping_strategies: [`A very long strategy ${"that keeps going ".repeat(30)}end`],
  social_distractions: [],
  trusted_contacts: ["Mum — 07700 900123"],
  professional_support: { reasons_to_live: ["My dog"] },
  environment_safety: ["The park"],
  last_updated: "2026-10-27T09:00:00.000Z",
};

const CONTACTS = [
  { id: "c1", user_id: "user-a", name: "Alexandria Catherine Montgomery-Smythe", phone: "+44 7700 900 123 ext. 4567" },
  { id: "c2", user_id: "user-a", name: "Bilal", phone: null },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SafetyPlan />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const utils = render(tree());
  return { ...utils, rerenderPage: () => utils.rerender(tree()) };
}

const printDoc = () => document.body.querySelector<HTMLElement>(".wellness-plan-print-doc");
const docText = () => (printDoc()?.textContent ?? "").replace(/\s+/g, " ");
const ready = () => screen.findByRole("button", { name: /Print Plan/ });

let printSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  h.auth.current = { user: { id: "user-a" } };
  h.get.mockResolvedValue(PLAN);
  h.contacts.mockResolvedValue(CONTACTS);
  printSpy = vi.fn(() => {
    // Real browsers fire these around the dialog.
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));
  });
  window.print = printSpy as unknown as typeof window.print;
});
afterEach(() => {
  Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
});

describe("Wellness Plan printing", () => {
  it("prints the displayed plan, contacts and resources from every print action, without saving", async () => {
    renderPage();
    await ready();
    await waitFor(() => expect(docText()).toContain("Alexandria Catherine Montgomery-Smythe"));

    const actions = [/Print Plan/, /Save as PDF/, /Export Plan \(PDF\)/];
    for (const [i, name] of actions.entries()) {
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(i + 1));
    }

    const text = docText();
    expect(text).toContain("Wellness Plan");
    expect(text).toMatch(/Printed \d{1,2} \w{3} \d{4}, \d{2}:\d{2} \(/);
    expect(text).toContain("Saved plan. Matches the plan saved to your account when this was printed.");
    for (const title of ["Warning Signs", "Coping Strategies", "Healthy Distractions", "People I Can Contact", "Safe Places", "Reasons to Live", "Trusted Contacts", "Recovery Readiness"]) {
      expect(text).toContain(title);
    }
    expect(text).toContain("آج میں بہت پریشان ہوں۔ (2 دن)");
    expect(text).toContain(PLAN.coping_strategies[0].replace(/\s+/g, " "));
    expect(text).toContain("Mum — 07700 900123");
    expect(text).toContain("Nothing added yet."); // empty Healthy Distractions
    expect(text).toContain("+44 7700 900 123 ext. 4567");
    expect(text).toContain("Bilal: No phone on file");
    expect(text).toContain("Helpful Resources — Available 24/7");
    expect(h.save).not.toHaveBeenCalled();
    // Print state is removed once printing finishes.
    expect(document.documentElement.classList.contains("wellness-plan-printing")).toBe(false);
  });

  it("labels unsaved and saving edits as a current draft", async () => {
    let finishSave: (v: unknown) => void = () => {};
    h.save.mockImplementation(() => new Promise((r) => { finishSave = r; }));
    renderPage();
    await ready();
    fireEvent.click(screen.getAllByRole("button", { name: /Remove item 1/ })[0]);

    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(docText()).toContain("Current draft. Includes changes that hadn't been saved");
    expect(docText()).not.toContain("Not sleeping");

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1), { timeout: 3000 }); // autosave, unchanged
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(2));
    expect(docText()).toContain("Current draft. Changes were still being saved");
    expect(h.save).toHaveBeenCalledTimes(1); // printing didn't save

    await act(async () => finishSave({ id: "plan-1" }));
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(3));
    expect(docText()).toContain("Saved plan.");
  });

  it("labels newer edits a draft when an older save completes after them", async () => {
    const saves: Array<(v: unknown) => void> = [];
    h.save.mockImplementation(() => new Promise((r) => saves.push(r)));
    renderPage();
    await ready();

    // 1. Content A ("Not sleeping" removed) starts saving.
    fireEvent.click(screen.getAllByRole("button", { name: /Remove item 1/ })[0]);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect((h.save.mock.calls[0][0] as { warning_signs: string[] }).warning_signs).toEqual([PLAN.warning_signs[1]]);

    // 2. The user changes the plan to content B while A is saving.
    fireEvent.click(screen.getAllByRole("button", { name: /Remove item 1/ })[0]);

    // 3. Save A completes (the editor now calls everything saved).
    await act(async () => saves[0]({ id: "plan-1" }));

    // 4. Printing B says it is a draft, and prints B.
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(docText()).toContain("Current draft.");
    expect(docText()).not.toContain("Saved plan.");
    expect(docText()).not.toContain(PLAN.warning_signs[1]);
    expect(h.save).toHaveBeenCalledTimes(1); // printing didn't save
  });

  it("keeps a failed save labelled as a draft", async () => {
    h.save.mockRejectedValue(new Error("offline"));
    renderPage();
    await ready();
    fireEvent.click(screen.getAllByRole("button", { name: /Remove item 1/ })[0]);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(docText()).toContain("Current draft.");
  });

  it("opens one dialog for repeated clicks and cancels if the account changes while preparing", async () => {
    let fontsReady: () => void = () => {};
    Object.defineProperty(document, "fonts", {
      value: { ready: new Promise<void>((r) => { fontsReady = r; }) },
      configurable: true,
    });
    const { rerenderPage } = renderPage();
    await ready();
    const button = screen.getByRole("button", { name: /Print Plan/ });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: /Save as PDF/ }));

    h.auth.current = { user: { id: "user-b" } };
    h.get.mockReturnValue(new Promise(() => {}));
    rerenderPage();
    await act(async () => fontsReady());
    await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith("The signed-in account changed, so the plan wasn't printed."));
    expect(printSpy).not.toHaveBeenCalled();
    // Nothing from account A remains printable for account B.
    expect(docText()).not.toContain("Not sleeping");
    expect(docText()).not.toContain("Alexandria");
  });

  it("supports the browser's own print command and cleans up on unmount", async () => {
    const { unmount } = renderPage();
    await ready();
    const html = document.documentElement;
    expect(html.classList.contains("wellness-plan-print-page")).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(html.classList.contains("wellness-plan-printing")).toBe(true);
    expect(docText()).toContain("Not sleeping");
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(html.classList.contains("wellness-plan-printing")).toBe(false);

    unmount();
    expect(html.classList.contains("wellness-plan-print-page")).toBe(false);
    expect(printDoc()).toBeNull();
  });

  it("recovers if the print dialog can't open", async () => {
    printSpy.mockImplementation(() => {
      throw new Error("blocked");
    });
    renderPage();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Couldn't open the print dialog. Please try again."));
    expect(document.documentElement.classList.contains("wellness-plan-printing")).toBe(false);
    // The page still works and can print again.
    printSpy.mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: /Print Plan/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(2));
  });

  it("doesn't print the plan before it has loaded", async () => {
    h.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(docText()).toContain("Your wellness plan hadn't finished loading, so it isn't included.");
    expect(within(printDoc()!).queryByText("Warning Signs")).toBeNull();
  });
});
