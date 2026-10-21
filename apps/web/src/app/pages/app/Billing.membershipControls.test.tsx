import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { billing, sessionsList, getCredits } = vi.hoisted(() => ({
  billing: {
    getSubscription: vi.fn(),
    getHistory: vi.fn(),
    getInvoices: vi.fn(),
    createPortalSession: vi.fn(),
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    buyCredits: vi.fn(),
    syncCredits: vi.fn(),
    syncSubscription: vi.fn(),
  },
  sessionsList: vi.fn(),
  getCredits: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    billing,
    sessions: { list: (...a: unknown[]) => sessionsList(...a) },
    getCredits: (...a: unknown[]) => getCredits(...a),
  },
  isApiError: () => false,
}));

/** Referentially stable: Billing re-fetches on `session.user.id`. */
const authValue = { session: { user: { id: "u1" } } };
vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/app/solace", () => ({
  SolaceSelect: ({ value, onValueChange, options, ariaLabel }: any) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

import { Billing } from "./Billing";

vi.setConfig({ testTimeout: 30000 });

const DAY = 24 * 60 * 60 * 1000;
const future = () => new Date(Date.now() + 5 * DAY).toISOString();
const past = () => new Date(Date.now() - 5 * DAY).toISOString();

function subscription(overrides: Record<string, unknown>) {
  return {
    id: "sub_1",
    user_id: "u1",
    plan_type: "trial",
    status: "active",
    start_date: new Date(Date.now() - 2 * DAY).toISOString(),
    end_date: future(),
    next_billing_at: null,
    billing_cycle: "monthly",
    payment_method: null,
    ...overrides,
  };
}

const invoice = {
  id: "in_1",
  created: new Date().toISOString(),
  description: "Grow membership",
  amount_due: 19,
  status: "paid",
};

let scrollIntoView: ReturnType<typeof vi.fn>;
let reducedMotionMatches = false;

function renderBilling() {
  return render(
    <MemoryRouter>
      <Billing />
    </MemoryRouter>
  );
}

async function waitForLoaded() {
  await screen.findByRole("heading", { name: /manage your plan/i });
}

const portalButtons = () => [
  screen.queryByRole("button", { name: /^manage plan$/i }),
  screen.queryByRole("button", { name: /update payment method/i }),
  screen.queryByRole("button", { name: /update preferences/i }),
];

function expectNoBillingMutation() {
  expect(billing.createPortalSession).not.toHaveBeenCalled();
  expect(billing.cancelSubscription).not.toHaveBeenCalled();
  expect(billing.createSubscription).not.toHaveBeenCalled();
  expect(billing.buyCredits).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  reducedMotionMatches = false;
  document.documentElement.className = "";
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotionMatches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  billing.getHistory.mockResolvedValue([]);
  billing.getInvoices.mockResolvedValue([]);
  billing.createPortalSession.mockResolvedValue({ portalUrl: "" });
  sessionsList.mockResolvedValue([]);
  getCredits.mockResolvedValue({ subscription: 30, purchased: 0, credits_seconds: 1800 });
});

afterEach(() => {
  document.documentElement.className = "";
});

describe("Billing membership controls — Discover / trial", () => {
  it.each([
    ["active trial", () => subscription({ plan_type: "trial", end_date: future() })],
    ["expired trial (status still active, end_date past)", () => subscription({ plan_type: "trial", end_date: past() })],
    [
      "API default trial (no subscription row)",
      () => subscription({ id: "default", plan_type: "trial", end_date: null }),
    ],
  ])("%s: shows Select Plan and hides Manage Plan, Cancel plan and rail portal buttons", async (_label, make) => {
    billing.getSubscription.mockResolvedValue(make());
    renderBilling();
    await waitForLoaded();

    expect(screen.getByRole("button", { name: /^select plan$/i })).toBeInTheDocument();
    for (const btn of portalButtons()) expect(btn).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    expect(screen.queryByText("Card on file")).toBeNull();
    expect(screen.getByText("No payment method on file")).toBeInTheDocument();
  });

  it("Select Plan smooth-scrolls to the plan section, focuses its heading, and makes no billing request", async () => {
    billing.getSubscription.mockResolvedValue(subscription({}));
    renderBilling();
    await waitForLoaded();
    const callsBefore = billing.getSubscription.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: /^select plan$/i }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("membership-plans"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /manage your plan/i }));
    expectNoBillingMutation();
    expect(billing.getSubscription.mock.calls.length).toBe(callsBefore);
  });

  it("uses an instant jump when the OS prefers reduced motion", async () => {
    reducedMotionMatches = true;
    billing.getSubscription.mockResolvedValue(subscription({}));
    renderBilling();
    await waitForLoaded();

    await userEvent.click(screen.getByRole("button", { name: /^select plan$/i }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it.each(["reduced-motion", "appearance-no-animations"])(
    "uses an instant jump when the app sets .%s",
    async (cls) => {
      document.documentElement.classList.add(cls);
      billing.getSubscription.mockResolvedValue(subscription({}));
      renderBilling();
      await waitForLoaded();

      await userEvent.click(screen.getByRole("button", { name: /^select plan$/i }));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    }
  );

  it("the existing Discover minutes CTA reuses the same scroll helper", async () => {
    billing.getSubscription.mockResolvedValue(subscription({}));
    renderBilling();
    await waitForLoaded();

    const section = screen.getByRole("heading", { name: /manage your plan/i }).closest("section");
    const ctas = screen
      .getAllByRole("button")
      .filter((b) => b.closest("section[aria-labelledby='more-minutes-heading']"));
    expect(ctas).toHaveLength(1);
    await userEvent.click(ctas[0]);

    expect(scrollIntoView.mock.contexts[0]).toBe(section);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /manage your plan/i }));
    expectNoBillingMutation();
  });

  it("keeps plan checkout entry points available", async () => {
    billing.getSubscription.mockResolvedValue(subscription({}));
    billing.createSubscription.mockResolvedValue({ checkoutUrl: "" });
    renderBilling();
    await waitForLoaded();

    await userEvent.click(screen.getByRole("button", { name: /choose grow/i }));
    expect(billing.createSubscription).toHaveBeenCalledWith({ plan_type: "core" });
    expect(screen.getByRole("button", { name: /upgrade to thrive/i })).toBeInTheDocument();
  });

  it("keeps access to existing invoices", async () => {
    billing.getSubscription.mockResolvedValue(subscription({ id: "default" }));
    billing.getInvoices.mockResolvedValue([invoice]);
    renderBilling();
    await waitForLoaded();

    expect(screen.getByRole("button", { name: /view all invoices/i })).toBeInTheDocument();
  });
});

describe("Billing membership controls — unconfirmed membership", () => {
  it("hides all membership actions when the billing fetch fails", async () => {
    billing.getSubscription.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderBilling();
    await waitForLoaded();

    expect(screen.queryByRole("button", { name: /^select plan$/i })).toBeNull();
    for (const btn of portalButtons()) expect(btn).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    expect(screen.queryByText("Card on file")).toBeNull();
  });

  it("hides all membership actions for an unrecognised plan_type", async () => {
    billing.getSubscription.mockResolvedValue(subscription({ plan_type: "enterprise_legacy" }));
    renderBilling();
    await waitForLoaded();

    expect(screen.queryByRole("button", { name: /^select plan$/i })).toBeNull();
    for (const btn of portalButtons()) expect(btn).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
  });

  it("shows no membership actions while loading", () => {
    billing.getSubscription.mockReturnValue(new Promise(() => {}));
    renderBilling();

    expect(screen.queryByRole("button", { name: /^select plan$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^manage plan$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
  });
});

describe("Billing membership controls — paid members", () => {
  it.each([
    ["core", "active"],
    ["pro", "active"],
    ["core", "trialing"],
    ["pro", "past_due"],
  ])("%s / %s: shows Manage Plan, Cancel plan and rail portal buttons; no Select Plan", async (plan, status) => {
    billing.getSubscription.mockResolvedValue(
      subscription({ plan_type: plan, status, next_billing_at: future(), end_date: null })
    );
    renderBilling();
    await waitForLoaded();

    expect(screen.queryByRole("button", { name: /^select plan$/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^manage plan$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /cancel plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update payment method/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update preferences/i })).toBeInTheDocument();
    expect(screen.getByText("Managed in Stripe")).toBeInTheDocument();
  });

  it("hero Manage Plan opens the Stripe billing portal", async () => {
    billing.getSubscription.mockResolvedValue(
      subscription({ plan_type: "pro", status: "active", next_billing_at: future(), end_date: null })
    );
    renderBilling();
    await waitForLoaded();

    await userEvent.click(screen.getByRole("button", { name: /^manage plan$/i }));
    await waitFor(() => expect(billing.createPortalSession).toHaveBeenCalledTimes(1));
  });

  it("Cancel plan opens the confirmation dialog and cancels on confirm", async () => {
    billing.getSubscription.mockResolvedValue(
      subscription({ plan_type: "core", status: "active", next_billing_at: future(), end_date: null })
    );
    billing.cancelSubscription.mockReturnValue(new Promise(() => {}));
    renderBilling();
    await waitForLoaded();

    await userEvent.click(screen.getByRole("button", { name: /cancel plan/i }));
    await userEvent.click(await screen.findByRole("button", { name: /yes, cancel plan/i }));
    expect(billing.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("canceled paid member in period keeps Manage Plan but has no Cancel plan", async () => {
    billing.getSubscription.mockResolvedValue(
      subscription({ plan_type: "core", status: "canceled", next_billing_at: future(), end_date: future() })
    );
    renderBilling();
    await waitForLoaded();

    expect(screen.getByRole("button", { name: /^manage plan$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^select plan$/i })).toBeNull();
  });

  it("shows the API payment-method label when present", async () => {
    billing.getSubscription.mockResolvedValue(
      subscription({ plan_type: "core", payment_method: "Visa •••• 4242", next_billing_at: future() })
    );
    renderBilling();
    await waitForLoaded();

    expect(screen.getByText("Visa •••• 4242")).toBeInTheDocument();
  });
});
