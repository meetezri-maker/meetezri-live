import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { AnalyticsRouteTracker, emitAnalyticsPageViewForLocation } from "./AnalyticsRouteTracker";
import { trackGa4PageView } from "./ga4";
import { trackMetaPageView } from "./meta";

vi.mock("./config", () => ({
  canInitializeAnalytics: () => true,
}));

vi.mock("./ga4", () => ({
  trackGa4PageView: vi.fn(),
}));

vi.mock("./meta", () => ({
  trackMetaPageView: vi.fn(),
}));

function NavigationHarness() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate("/pricing?session_id=one#access_token=secret")}>pricing one</button>
      <button type="button" onClick={() => navigate("/pricing?session_id=two#refresh_token=secret")}>pricing two</button>
      <button type="button" onClick={() => navigate("/signup")}>signup</button>
      <button type="button" onClick={() => navigate("/app/active-session?sessionId=secret")}>app</button>
    </div>
  );
}

describe("AnalyticsRouteTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits one sanitized page view for an approved initial route", async () => {
    render(
      <MemoryRouter initialEntries={["/pricing?session_id=secret#access_token=secret"]}>
        <AnalyticsRouteTracker />
      </MemoryRouter>,
    );

    await waitFor(() => expect(trackGa4PageView).toHaveBeenCalledTimes(1));
    expect(trackGa4PageView).toHaveBeenCalledWith("/pricing", "Pricing");
    expect(trackMetaPageView).toHaveBeenCalledWith("/pricing");
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain("secret");
  });

  it("dedupes rerenders and query/hash-only changes that sanitize to the same path", async () => {
    const user = userEvent.setup();
    const { rerender, getByRole } = render(
      <MemoryRouter initialEntries={["/pricing?session_id=one"]}>
        <AnalyticsRouteTracker />
        <NavigationHarness />
      </MemoryRouter>,
    );

    await waitFor(() => expect(trackGa4PageView).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter initialEntries={["/pricing?session_id=one"]}>
        <AnalyticsRouteTracker />
        <NavigationHarness />
      </MemoryRouter>,
    );
    expect(trackGa4PageView).toHaveBeenCalledTimes(1);

    await user.click(getByRole("button", { name: "pricing two" }));
    expect(trackGa4PageView).toHaveBeenCalledTimes(1);
  });

  it("tracks a new approved sanitized path and ignores app/wellness routes", async () => {
    const user = userEvent.setup();
    const { getByRole } = render(
      <MemoryRouter initialEntries={["/pricing"]}>
        <AnalyticsRouteTracker />
        <NavigationHarness />
      </MemoryRouter>,
    );

    await waitFor(() => expect(trackGa4PageView).toHaveBeenCalledTimes(1));
    await user.click(getByRole("button", { name: "signup" }));
    await waitFor(() => expect(trackGa4PageView).toHaveBeenCalledTimes(2));
    expect(trackGa4PageView).toHaveBeenLastCalledWith("/signup", "Signup");

    await user.click(getByRole("button", { name: "app" }));
    expect(trackGa4PageView).toHaveBeenCalledTimes(2);
  });

  it("exposes a testable route emitter that returns only sanitized paths", () => {
    expect(emitAnalyticsPageViewForLocation({ pathname: "/verify-email", search: "?code=secret" })).toBe("/verify-email");
    expect(emitAnalyticsPageViewForLocation({ pathname: "/auth/callback", search: "?code=secret" })).toBeNull();
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain("code=secret");
  });
});
