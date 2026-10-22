import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveSessionTimer, useSessionExpiry } from "./useSessionTimeLimit";

function useTimerHarness(running: boolean) {
  const sessionTimeRef = useRef(0);
  const isEndingRef = useRef(false);
  const [sessionTime, setSessionTime] = useState(0);
  useActiveSessionTimer(running, sessionTimeRef, isEndingRef, setSessionTime);
  return { sessionTime, sessionTimeRef, isEndingRef };
}

describe("useActiveSessionTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("counts one second per second while running", () => {
    const { result } = renderHook(() => useTimerHarness(true));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.sessionTime).toBe(5);
    expect(result.current.sessionTimeRef.current).toBe(5);
  });

  it("does not start before the session is running", () => {
    const { result } = renderHook(() => useTimerHarness(false));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.sessionTime).toBe(0);
  });

  it("excludes paused time and resumes from where it stopped", () => {
    const { result, rerender } = renderHook(({ running }) => useTimerHarness(running), {
      initialProps: { running: true },
    });
    act(() => vi.advanceTimersByTime(3_000));
    rerender({ running: false });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.sessionTime).toBe(3);
    rerender({ running: true });
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.sessionTime).toBe(5);
  });

  it("catches up when timer callbacks were delayed (background tab)", () => {
    const { result } = renderHook(() => useTimerHarness(true));
    act(() => {
      // Wall clock moves 30s while no interval callback runs, then one fires.
      vi.setSystemTime(Date.now() + 30_000);
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.sessionTime).toBe(31);
  });

  it("stops counting as soon as the session is ending", () => {
    const { result } = renderHook(() => useTimerHarness(true));
    act(() => vi.advanceTimersByTime(4_000));
    result.current.isEndingRef.current = true;
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.sessionTime).toBe(4);
  });
});

describe("useSessionExpiry", () => {
  const base = {
    selectedLimitSeconds: 600,
    accountCreditsSeconds: 3_600,
    selectedLimitResolved: true,
    ended: false,
  };

  it("fires once, at zero remaining and not before", () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook((elapsedSeconds: number) =>
      useSessionExpiry({ ...base, elapsedSeconds, onExpire }), { initialProps: 541 },
    );
    expect(onExpire).not.toHaveBeenCalled();
    rerender(599);
    expect(onExpire).not.toHaveBeenCalled();
    rerender(600);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith("duration");
    rerender(601);
    rerender(700);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("does not fire while the selected length is still loading", () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useSessionExpiry({ ...base, selectedLimitResolved: false, elapsedSeconds: 9_999, onExpire }),
    );
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not fire after the session was already ended (manual End first)", () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionExpiry({ ...base, ended: true, elapsedSeconds: 600, onExpire }));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("reports account exhaustion as its own reason", () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useSessionExpiry({ ...base, accountCreditsSeconds: 120, elapsedSeconds: 120, onExpire }),
    );
    expect(onExpire).toHaveBeenCalledWith("credits");
  });
});
