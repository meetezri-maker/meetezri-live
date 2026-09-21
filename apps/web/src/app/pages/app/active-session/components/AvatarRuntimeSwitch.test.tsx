import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * Phase 2A foundation guards.
 *
 * These prove the three safety properties the migration rests on — the flag
 * defaults to the existing avatar, a Hyper3D failure falls back without a retry
 * loop, and neither path is allowed to throw into the session. They assert
 * nothing about how the avatar looks or behaves.
 */

const threeAvatarRenders = vi.fn();
const hostMounts = vi.fn();

// Both implementations are stubbed: this file tests the SEAM, and the real
// ThreeAvatar pulls in three.js and a GLB loader that jsdom cannot run.
vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: (props: Record<string, unknown>) => {
    threeAvatarRenders(props);
    return <div data-testid="existing-avatar" />;
  },
}));

let hostBehaviour: "idle" | "fail-async" | "throw-on-render" = "idle";

vi.mock("./Hyper3DImperativeHost", () => ({
  Hyper3DImperativeHost: (props: {
    onFailure: (failure: { stage: string; message: string }) => void;
  }) => {
    hostMounts();
    if (hostBehaviour === "throw-on-render") {
      throw new Error("rig binding exploded");
    }
    if (hostBehaviour === "fail-async") {
      // The async channel: GLB/texture/init/animation-frame faults arrive this
      // way, never through React.
      queueMicrotask(() =>
        props.onFailure({ stage: "engine-init", message: "GLB failed to load" }),
      );
    }
    return <div data-testid="hyper3d-avatar" />;
  },
}));

const flagState = { enabled: false };
vi.mock("@/lib/avatar/hyper3d/hyper3dFeatureFlag", () => ({
  isHyper3dAvatarEnabled: () => flagState.enabled,
  hyper3dAvatarFlagRawValue: () => (flagState.enabled ? "true" : null),
  HYPER3D_AVATAR_FLAG: "VITE_HYPER3D_AVATAR_ENABLED",
}));

const { AvatarRuntimeSwitch } = await import("./AvatarRuntimeSwitch");

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

const props = () => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel: "Sara Mitchell",
  activeAvatarId: "sarah",
  modelUrl: "/avatars/Sara Mitchell.glb",
  viewTuning: { mouthDriveMultiplier: 1 } as never,
  fixedViewportConfig: null,
  useRfv2Morphs: false,
  useSaraRfv2Preview: false,
  onSaraRfv2Fallback: vi.fn(),
  isSpeaking: false,
  isListening: false,
  isThinking: false,
  mouthAudioLevelRef: ref(0),
  avatarPhonemeTimelineRef: ref<AvatarPhonemeTimeline | null>(null),
  avatarAudioCurrentTimeRef: ref(0),
  speechTextRef: ref(""),
  speechCharIndexRef: ref(0),
  speechPulseRef: ref(0),
  latestUserTextRef: ref(""),
  latestJordanTextRef: ref(""),
  userSpeechStartedAtMsRef: ref(0),
  userLastSpeechAtMsRef: ref(0),
  jordanSpeechStartedAtMsRef: ref(0),
  jordanLastSpeechAtMsRef: ref(0),
  sentimentCompoundRef: ref<number | undefined>(undefined),
});

beforeEach(() => {
  flagState.enabled = false;
  hostBehaviour = "idle";
  threeAvatarRenders.mockClear();
  hostMounts.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("avatar runtime switch — flag", () => {
  it("renders the existing Solace avatar when the flag is unset", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    expect(await screen.findByTestId("existing-avatar")).toBeTruthy();
    expect(hostMounts).not.toHaveBeenCalled();
  });

  it("renders Hyper3D only when the flag is on", async () => {
    flagState.enabled = true;
    render(<AvatarRuntimeSwitch {...props()} />);
    expect(await screen.findByTestId("hyper3d-avatar")).toBeTruthy();
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
  });

  it("passes the existing avatar exactly the props it received before", async () => {
    const given = props();
    render(<AvatarRuntimeSwitch {...given} />);
    await screen.findByTestId("existing-avatar");

    const forwarded = threeAvatarRenders.mock.calls[0][0];
    // The refs are the live channel between ActiveSession and the avatar; they
    // must arrive by identity, not copied.
    expect(forwarded.avatarPhonemeTimelineRef).toBe(given.avatarPhonemeTimelineRef);
    expect(forwarded.avatarAudioCurrentTimeRef).toBe(given.avatarAudioCurrentTimeRef);
    expect(forwarded.mouthAudioLevelRef).toBe(given.mouthAudioLevelRef);
    expect(forwarded.sentimentCompoundRef).toBe(given.sentimentCompoundRef);
    expect(forwarded.onSaraRfv2Fallback).toBe(given.onSaraRfv2Fallback);
    expect(forwarded.modelUrl).toBe(given.modelUrl);
  });
});

describe("avatar runtime switch — fallback", () => {
  it("falls back to the existing avatar when the host reports an async failure", async () => {
    flagState.enabled = true;
    hostBehaviour = "fail-async";
    render(<AvatarRuntimeSwitch {...props()} />);

    expect(await screen.findByTestId("existing-avatar")).toBeTruthy();
    expect(screen.queryByTestId("hyper3d-avatar")).toBeNull();
  });

  it("falls back when Hyper3D throws during render", async () => {
    flagState.enabled = true;
    hostBehaviour = "throw-on-render";
    render(<AvatarRuntimeSwitch {...props()} />);

    expect(await screen.findByTestId("existing-avatar")).toBeTruthy();
  });

  it("does not retry Hyper3D after a failure — no reload loop", async () => {
    flagState.enabled = true;
    hostBehaviour = "fail-async";
    const { rerender } = render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("existing-avatar");

    const mountsAfterFailure = hostMounts.mock.calls.length;
    // Re-render the way a live session does, many times over.
    for (let i = 0; i < 5; i += 1) {
      rerender(<AvatarRuntimeSwitch {...props()} isSpeaking={i % 2 === 0} />);
    }

    await waitFor(() => expect(screen.getByTestId("existing-avatar")).toBeTruthy());
    expect(hostMounts.mock.calls.length).toBe(mountsAfterFailure);
  });

  it("keeps rendering an avatar throughout — the stage is never empty", async () => {
    flagState.enabled = true;
    hostBehaviour = "fail-async";
    render(<AvatarRuntimeSwitch {...props()} />);
    // Whatever happens to Hyper3D, something is always on the stage: the
    // session must never be left staring at a blank canvas.
    await waitFor(() => {
      expect(
        screen.queryByTestId("existing-avatar") ?? screen.queryByTestId("hyper3d-avatar"),
      ).toBeTruthy();
    });
  });
});
