import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutOfCreditsModal } from "./OutOfCreditsModal";

const renderModal = (reason?: "duration" | "credits") => {
  const handlers = {
    onBuyMoreMinutes: vi.fn(),
    onUpgradePlan: vi.fn(),
    onReturnToDashboard: vi.fn(),
  };
  render(<OutOfCreditsModal open reason={reason} sessionTime={600} {...handlers} />);
  return handlers;
};

describe("OutOfCreditsModal", () => {
  it("tells the member their selected session time is up", () => {
    renderModal("duration");
    expect(screen.getByText("Your session time is up")).toBeTruthy();
    expect(
      screen.getByText("You’ve reached the time you selected for this session."),
    ).toBeTruthy();
    expect(screen.queryByText(/included minutes for this month/)).toBeNull();
    expect(screen.queryByText("0 minutes remaining")).toBeNull();
    expect(screen.queryByText("Buy More Minutes")).toBeNull();
  });

  it("offers only a return action for selected-time expiry", () => {
    const handlers = renderModal("duration");
    fireEvent.click(screen.getByRole("button", { name: "Return to Dashboard" }));
    expect(handlers.onReturnToDashboard).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps the existing account-exhaustion copy and actions", () => {
    const handlers = renderModal("credits");
    expect(screen.getByText("Talking Paused")).toBeTruthy();
    expect(screen.getByText("You've used all your included minutes for this month.")).toBeTruthy();
    expect(screen.getByText("0 minutes remaining")).toBeTruthy();
    fireEvent.click(screen.getByText("Buy More Minutes"));
    fireEvent.click(screen.getByText("Upgrade Your Plan"));
    fireEvent.click(screen.getByText("End Talking & Return to Dashboard"));
    expect(handlers.onBuyMoreMinutes).toHaveBeenCalledTimes(1);
    expect(handlers.onUpgradePlan).toHaveBeenCalledTimes(1);
    expect(handlers.onReturnToDashboard).toHaveBeenCalledTimes(1);
  });

  it("defaults to the account-exhaustion copy", () => {
    renderModal();
    expect(screen.getByText("Talking Paused")).toBeTruthy();
  });

  it("cannot be dismissed by Escape or an outside click", () => {
    const handlers = renderModal("duration");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(handlers.onReturnToDashboard).not.toHaveBeenCalled();
  });
});
