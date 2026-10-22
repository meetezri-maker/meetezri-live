import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activeSegmentElapsedSeconds,
  isPersistedSessionClosed,
  isRetryableEndError,
  persistedSelectedMinutes,
  rememberEndedSession,
  resolveSessionExpiry,
  runCleanupSteps,
  sendWithRetry,
  wasSessionEndedInThisTab,
} from "./sessionExpiry";

const limits = {
  selectedLimitSeconds: 20 * 60,
  accountCreditsSeconds: 60 * 60,
  selectedLimitResolved: true,
};

describe("resolveSessionExpiry", () => {
  it("does not expire with 59 seconds remaining", () => {
    expect(resolveSessionExpiry({ ...limits, elapsedSeconds: 20 * 60 - 59 })).toBeNull();
    expect(resolveSessionExpiry({ ...limits, elapsedSeconds: 20 * 60 - 1 })).toBeNull();
  });

  it("expires exactly when the selected time reaches zero", () => {
    expect(resolveSessionExpiry({ ...limits, elapsedSeconds: 20 * 60 })).toBe("duration");
  });

  it("does not expire while the selected length is still being recovered", () => {
    expect(
      resolveSessionExpiry({ ...limits, selectedLimitResolved: false, elapsedSeconds: 99_999 }),
    ).toBeNull();
  });

  it("does not expire on credits before the balance has loaded", () => {
    expect(
      resolveSessionExpiry({
        selectedLimitSeconds: null,
        accountCreditsSeconds: null,
        selectedLimitResolved: true,
        elapsedSeconds: 99_999,
      }),
    ).toBeNull();
  });

  it("still enforces the selected length when the balance failed to load", () => {
    expect(
      resolveSessionExpiry({ ...limits, accountCreditsSeconds: null, elapsedSeconds: 20 * 60 }),
    ).toBe("duration");
  });

  it("reports account exhaustion separately from the selected length", () => {
    expect(
      resolveSessionExpiry({ ...limits, accountCreditsSeconds: 5 * 60, elapsedSeconds: 5 * 60 }),
    ).toBe("credits");
  });

  it("prefers the selected length when both run out together", () => {
    expect(
      resolveSessionExpiry({ ...limits, accountCreditsSeconds: 20 * 60, elapsedSeconds: 20 * 60 }),
    ).toBe("duration");
  });
});

describe("activeSegmentElapsedSeconds", () => {
  it("adds whole wall-clock seconds to the time banked before this stretch", () => {
    expect(activeSegmentElapsedSeconds(30, 1_000, 1_000)).toBe(30);
    expect(activeSegmentElapsedSeconds(30, 1_000, 1_999)).toBe(30);
    expect(activeSegmentElapsedSeconds(30, 1_000, 6_000)).toBe(35);
  });

  it("never goes backwards when the clock does", () => {
    expect(activeSegmentElapsedSeconds(30, 10_000, 4_000)).toBe(30);
  });
});

describe("runCleanupSteps", () => {
  it("runs every step even when one throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ran: string[] = [];
    const failed = runCleanupSteps([
      ["a", () => ran.push("a")],
      [
        "b",
        () => {
          throw new Error("boom");
        },
      ],
      ["c", () => ran.push("c")],
    ]);
    expect(ran).toEqual(["a", "c"]);
    expect(failed).toEqual(["b"]);
    warn.mockRestore();
  });
});

describe("sendWithRetry", () => {
  const noWait = () => Promise.resolve();
  const networkError = () => new TypeError("Failed to fetch");

  it("retries a failed end request and reports success", async () => {
    const send = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce({});
    await expect(sendWithRetry(send, [1, 1], noWait, isRetryableEndError)).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of attempts and reports failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(networkError());
    await expect(sendWithRetry(send, [1, 1], noWait, isRetryableEndError)).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(3);
    error.mockRestore();
  });

  it("does not retry errors that cannot succeed on retry", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("bad"), { status: 400 }));
    await expect(sendWithRetry(send, [1, 1], noWait, isRetryableEndError)).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe("isRetryableEndError", () => {
  it.each([
    [new TypeError("Failed to fetch"), true],
    [Object.assign(new Error("x"), { status: 503 }), true],
    [Object.assign(new Error("x"), { status: 429 }), true],
    [Object.assign(new Error("x"), { status: 404 }), false],
    [new Error("Session expired. Please login again."), false],
  ])("%s -> %s", (error, expected) => {
    expect(isRetryableEndError(error)).toBe(expected);
  });
});

describe("persisted session state", () => {
  it("treats completed, ended or missing sessions as closed", () => {
    expect(isPersistedSessionClosed({ status: "completed" })).toBe(true);
    expect(isPersistedSessionClosed({ status: "active", ended_at: "2026-01-01T00:00:00Z" })).toBe(
      true,
    );
    expect(isPersistedSessionClosed(null)).toBe(true);
    expect(isPersistedSessionClosed({ status: "active", ended_at: null })).toBe(false);
  });

  it("recovers the selected length only from a live session", () => {
    expect(persistedSelectedMinutes({ status: "active", duration_minutes: 20 })).toBe(20);
    expect(persistedSelectedMinutes({ status: "completed", duration_minutes: 7 })).toBeNull();
    expect(persistedSelectedMinutes({ status: "active", duration_minutes: null })).toBeNull();
  });
});

describe("ended session marker", () => {
  afterEach(() => window.sessionStorage.clear());

  it("blocks reopening only the session that ended in this tab", () => {
    rememberEndedSession("s1");
    expect(wasSessionEndedInThisTab("s1")).toBe(true);
    expect(wasSessionEndedInThisTab("s2")).toBe(false);
    expect(wasSessionEndedInThisTab(null)).toBe(false);
  });
});
