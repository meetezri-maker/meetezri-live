import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { MobileBottomNav } from "./MobileBottomNav";

/**
 * Controllable stand-in for the desktop media query. jsdom has no layout, so
 * width-based queries never match on their own and cannot be driven by a resize.
 */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_: string, cb: () => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: () => void) => {
      listeners.delete(cb);
    }),
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql)
  );

  return {
    mql,
    listeners,
    setMatches(next: boolean) {
      mql.matches = next;
      act(() => {
        listeners.forEach((cb) => cb());
      });
    },
  };
}

const renderNav = () =>
  render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <MobileBottomNav />
    </MemoryRouter>
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MobileBottomNav drawer breakpoint hardening", () => {
  it("closes the drawer when the viewport reaches the desktop breakpoint", async () => {
    const media = stubMatchMedia(false);
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    media.setMatches(true);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /open navigation menu/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("subscribes to the desktop query once and cleans up on unmount", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderNav();

    expect(media.mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(media.listeners.size).toBe(1);

    unmount();

    expect(media.mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.listeners.size).toBe(0);
  });

  it("still opens normally below the desktop breakpoint", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /billing & credits/i })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when a drawer destination is selected", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    await user.click(await screen.findByRole("link", { name: /billing & credits/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
