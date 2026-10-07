import { render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import activeSessionSource from "../ActiveSession.tsx?raw";

import { UserCameraPip } from "./UserCameraPip";

/**
 * Regression guard for the camera OFF → ON preview.
 *
 * The real `ActiveSession` cannot be rendered here (Supabase, three.js, the
 * realtime websocket), so this file tests the SEAM the bug lived in, the same
 * way `AvatarRuntimeSwitch.test.tsx` does: the real `UserCameraPip` provides the
 * `open` gate that unmounts the `<video>`, and the harness transcribes the two
 * lines from `ActiveSession.tsx` that decide binding — the `pipOpen` expression
 * (`ActiveSession.tsx:5607`) and the stream-attach effect
 * (`ActiveSession.tsx:3490-3501`).
 *
 * The bug: turning the camera off unmounts the `<video>`; turning it on remounts
 * a *fresh* element with no `srcObject`, while `stream` keeps its object
 * identity — so an effect keyed on `[stream]` alone never re-runs and the
 * preview stays blank. `isCameraOff` in the dependency array is what rebinds it.
 */

/** Minimal stand-in: the effect only assigns it, nothing reads its members. */
const makeStream = (id: string) => ({ id }) as unknown as MediaStream;

let play: ReturnType<typeof vi.fn>;

function PreviewHarness({
  stream,
  isCameraOff,
  bindOnCameraToggle,
}: {
  stream: MediaStream | null;
  isCameraOff: boolean;
  /** false reproduces the pre-fix `[stream]` dependency array. */
  bindOnCameraToggle: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Transcribed from ActiveSession.tsx:3490-3501.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => {
      /* ignore */
    });
    // A constant second dep keeps the array length stable while still
    // reproducing the old behaviour, where only `stream` could re-trigger.
  }, [stream, bindOnCameraToggle ? isCameraOff : null]);

  return (
    <UserCameraPip
      // ActiveSession.tsx:5607
      open={Boolean(stream) && !isCameraOff}
      pipPos={{ left: 0, bottom: 0 }}
      videoRef={videoRef}
      isCameraOff={isCameraOff}
      isMuted={false}
      onPointerDown={() => {}}
      onPointerMove={() => {}}
      onPointerUp={() => {}}
    />
  );
}

beforeEach(() => {
  // jsdom's HTMLMediaElement.play() throws "not implemented".
  play = vi.fn(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("camera preview stream binding", () => {
  it("attaches the stream to the video element while the camera is on", () => {
    const stream = makeStream("s1");
    const { container } = render(
      <PreviewHarness stream={stream} isCameraOff={false} bindOnCameraToggle />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("unmounts the video element while the camera is off", () => {
    const stream = makeStream("s1");
    const { container, rerender } = render(
      <PreviewHarness stream={stream} isCameraOff={false} bindOnCameraToggle />,
    );
    expect(container.querySelector("video")).not.toBeNull();

    rerender(<PreviewHarness stream={stream} isCameraOff bindOnCameraToggle />);
    expect(container.querySelector("video")).toBeNull();
  });

  it("rebinds the unchanged stream to the remounted element after OFF → ON", () => {
    const stream = makeStream("s1");
    const { container, rerender } = render(
      <PreviewHarness stream={stream} isCameraOff={false} bindOnCameraToggle />,
    );
    const firstVideo = container.querySelector("video");

    rerender(<PreviewHarness stream={stream} isCameraOff bindOnCameraToggle />);
    rerender(
      <PreviewHarness stream={stream} isCameraOff={false} bindOnCameraToggle />,
    );

    const secondVideo = container.querySelector("video");
    expect(secondVideo).not.toBeNull();
    // A genuinely new DOM node — this is what made the old deps insufficient.
    expect(secondVideo).not.toBe(firstVideo);
    // Same stream object: the toggle reuses the live track, it does not re-acquire.
    expect(secondVideo!.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("leaves the remounted element unbound with the pre-fix [stream] deps", () => {
    const stream = makeStream("s1");
    const { container, rerender } = render(
      <PreviewHarness
        stream={stream}
        isCameraOff={false}
        bindOnCameraToggle={false}
      />,
    );
    const firstVideo = container.querySelector("video");
    expect(firstVideo!.srcObject).toBe(stream);

    rerender(
      <PreviewHarness stream={stream} isCameraOff bindOnCameraToggle={false} />,
    );
    rerender(
      <PreviewHarness
        stream={stream}
        isCameraOff={false}
        bindOnCameraToggle={false}
      />,
    );

    const secondVideo = container.querySelector("video");
    expect(secondVideo).not.toBe(firstVideo);
    // The reported bug: fresh element, never rebound, blank preview.
    expect(secondVideo!.srcObject).toBeFalsy();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps isCameraOff in the real effect's dependency array", () => {
    // The harness above proves the mechanism but does not import ActiveSession,
    // so without this the one-line fix could be reverted without a red test.
    // Delete this check if the binding ever moves to a callback ref, which would
    // make the dependency array irrelevant.
    const attach = activeSessionSource.indexOf("el.srcObject = stream;");
    expect(attach).toBeGreaterThan(-1);
    const depsStart = activeSessionSource.indexOf("}, [", attach);
    expect(depsStart).toBeGreaterThan(-1);
    const deps = activeSessionSource.slice(
      depsStart,
      activeSessionSource.indexOf("]", depsStart),
    );
    expect(deps).toContain("stream");
    expect(deps).toContain("isCameraOff");
  });

  it("still rebinds when the stream itself is replaced", () => {
    const first = makeStream("s1");
    const { container, rerender } = render(
      <PreviewHarness stream={first} isCameraOff={false} bindOnCameraToggle />,
    );
    expect(container.querySelector("video")!.srcObject).toBe(first);

    // The mic-only → camera-on path, which swaps in a new MediaStream.
    const second = makeStream("s2");
    rerender(
      <PreviewHarness stream={second} isCameraOff={false} bindOnCameraToggle />,
    );
    expect(container.querySelector("video")!.srcObject).toBe(second);
  });
});
