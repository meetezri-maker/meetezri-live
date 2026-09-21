import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import {
  __resetHyper3dEngineFactoryForTests,
  isHyper3dRuntimeCommitted,
} from "@/lib/avatar/hyper3d/hyper3dEngineRegistry";

/**
 * Phase 2F.2 — the seam publishes which avatar actually committed, so live
 * metadata association follows the mounted avatar without a second flag read.
 * Flag off, fallback and unmount must all leave the existing avatar's semantics.
 */

vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: () => <div data-testid="existing-avatar" />,
}));

let hostBehaviour: "idle" | "fail-async" = "idle";

vi.mock("./Hyper3DImperativeHost", () => ({
  Hyper3DImperativeHost: (props: { onFailure: (failure: { stage: string; message: string }) => void }) => {
    if (hostBehaviour === "fail-async") {
      queueMicrotask(() => props.onFailure({ stage: "engine-init", message: "GLB failed to load" }));
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
  __resetHyper3dEngineFactoryForTests();
  flagState.enabled = false;
  hostBehaviour = "idle";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AvatarRuntimeSwitch runtime commit signal", () => {
  it("flag off: the existing avatar commits and Hyper3D association stays off", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    expect(await screen.findByTestId("existing-avatar")).toBeTruthy();
    expect(isHyper3dRuntimeCommitted()).toBe(false);
  });

  it("flag on: Hyper3D commits; unmount clears it", async () => {
    flagState.enabled = true;
    const view = render(<AvatarRuntimeSwitch {...props()} />);
    expect(await screen.findByTestId("hyper3d-avatar")).toBeTruthy();
    await waitFor(() => expect(isHyper3dRuntimeCommitted()).toBe(true));
    view.unmount();
    expect(isHyper3dRuntimeCommitted()).toBe(false);
  });

  it("fallback latch returns association to the existing avatar's behaviour", async () => {
    flagState.enabled = true;
    hostBehaviour = "fail-async";
    render(<AvatarRuntimeSwitch {...props()} />);
    expect(await screen.findByTestId("existing-avatar")).toBeTruthy();
    await waitFor(() => expect(isHyper3dRuntimeCommitted()).toBe(false));
  });
});
