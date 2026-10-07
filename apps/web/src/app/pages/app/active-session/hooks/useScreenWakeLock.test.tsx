import { act, render } from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScreenWakeLock } from "./useScreenWakeLock";

type FakeSentinel = WakeLockSentinel & {
  release: ReturnType<typeof vi.fn>;
  emitRelease: () => void;
};

let visibility: DocumentVisibilityState;
let sentinels: FakeSentinel[];
let request: ReturnType<typeof vi.fn>;
/** Resolvers for pending `request("screen")` calls while `defer` is on. */
let deferred: Array<() => void>;
let defer: boolean;

const makeSentinel = (): FakeSentinel => {
  const listeners = new Set<() => void>();
  return {
    released: false,
    type: "screen",
    release: vi.fn(() => Promise.resolve()),
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    emitRelease: () => listeners.forEach((listener) => listener()),
  } as unknown as FakeSentinel;
};

const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
};

/** Let the hook's promise chains settle. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function Harness({ active }: { active: boolean }) {
  useScreenWakeLock(active);
  return null;
}

beforeEach(() => {
  visibility = "visible";
  sentinels = [];
  deferred = [];
  defer = false;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  request = vi.fn(() => {
    const sentinel = makeSentinel();
    sentinels.push(sentinel);
    if (!defer) return Promise.resolve(sentinel as WakeLockSentinel);
    return new Promise<WakeLockSentinel>((resolve) => {
      deferred.push(() => resolve(sentinel as WakeLockSentinel));
    });
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    writable: true,
    value: { request },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { wakeLock?: unknown }).wakeLock;
});

describe("useScreenWakeLock", () => {
  it("does not request a lock before the session is active", async () => {
    render(<Harness active={false} />);
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it("requests a screen lock once the session becomes active", async () => {
    const { rerender } = render(<Harness active={false} />);
    await flush();
    rerender(<Harness active />);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("screen");
  });

  it("holds the lock across re-renders between conversation turns", async () => {
    const { rerender } = render(<Harness active />);
    await flush();
    for (let turn = 0; turn < 5; turn += 1) {
      rerender(<Harness active />);
      await flush();
    }
    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinels[0].release).not.toHaveBeenCalled();
  });

  it("releases the lock when the session ends and does not re-acquire", async () => {
    const { rerender } = render(<Harness active />);
    await flush();
    rerender(<Harness active={false} />);
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases the lock on unmount", async () => {
    const { unmount } = render(<Harness active />);
    await flush();
    unmount();
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it("re-acquires when the page becomes visible again during the same session", async () => {
    render(<Harness active />);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(sentinels[1].release).not.toHaveBeenCalled();
  });

  it("does not request while the page is hidden at session start", async () => {
    visibility = "hidden";
    render(<Harness active />);
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it("does not throw or request when the API is unavailable", async () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    expect(() => render(<Harness active />)).not.toThrow();
    await flush();
    expect(sentinels).toHaveLength(0);
  });

  it("survives a rejected request without an unhandled rejection", async () => {
    const onUnhandled = vi.fn();
    window.addEventListener("unhandledrejection", onUnhandled);
    request.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));

    const { rerender, unmount } = render(<Harness active />);
    await flush();
    // The session keeps running, and a later visibility return retries cleanly.
    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    rerender(<Harness active={false} />);
    await flush();
    unmount();
    await flush();
    expect(onUnhandled).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", onUnhandled);
  });

  it("swallows a rejected release", async () => {
    const onUnhandled = vi.fn();
    window.addEventListener("unhandledrejection", onUnhandled);
    const { rerender } = render(<Harness active />);
    await flush();
    sentinels[0].release.mockImplementation(() =>
      Promise.reject(new Error("already released")),
    );
    rerender(<Harness active={false} />);
    await flush();
    expect(onUnhandled).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", onUnhandled);
  });

  it("does not issue duplicate or overlapping requests", async () => {
    defer = true;
    render(<Harness active />);
    await flush();
    // Request still in flight: repeated visibility churn must not pile requests up.
    setVisibility("visible");
    setVisibility("visible");
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    act(() => deferred.forEach((resolve) => resolve()));
    await flush();
    setVisibility("visible");
    await flush();
    // Now held, so a redundant "visible" event must not request a second lock.
    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinels[0].release).not.toHaveBeenCalled();
  });

  it("immediately releases a lock that resolves after cleanup", async () => {
    defer = true;
    const { unmount } = render(<Harness active />);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    unmount();
    await flush();
    expect(sentinels[0].release).not.toHaveBeenCalled();

    act(() => deferred.forEach((resolve) => resolve()));
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it("does not let an old owner teardown release a newer lock", async () => {
    // Remount the owner (new session) while the first request is still in flight.
    defer = true;
    const first = render(<Harness active />);
    await flush();
    first.unmount();

    defer = false;
    const second = render(<Harness active />);
    await flush();
    const newLock = sentinels[sentinels.length - 1];
    expect(newLock.release).not.toHaveBeenCalled();

    // The stale request now resolves: only the stale sentinel is released.
    act(() => deferred.forEach((resolve) => resolve()));
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
    expect(newLock.release).not.toHaveBeenCalled();

    second.unmount();
    await flush();
    expect(newLock.release).toHaveBeenCalledTimes(1);
  });

  it("forgets a sentinel the browser released on its own", async () => {
    render(<Harness active />);
    await flush();
    act(() => sentinels[0].emitRelease());
    await flush();

    // Our reference is clear, so returning to the page acquires a fresh lock.
    setVisibility("visible");
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(sentinels[0].release).not.toHaveBeenCalled();
  });

  it("holds exactly one lock under React Strict Mode", async () => {
    render(
      <StrictMode>
        <Harness active />
      </StrictMode>,
    );
    await flush();
    const held = sentinels.filter((sentinel) => sentinel.release.mock.calls.length === 0);
    expect(held).toHaveLength(1);
  });

  it("keeps the lock while only unrelated session state churns", async () => {
    function Churn() {
      const [tick, setTick] = useState(0);
      useScreenWakeLock(true);
      useEffect(() => {
        if (tick < 10) setTick((value) => value + 1);
      }, [tick]);
      return null;
    }
    render(<Churn />);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinels[0].release).not.toHaveBeenCalled();
  });
});
