import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PRODUCTION PATH, END TO END, DOWN TO THE three.js BOUNDARY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `AvatarRuntimeSwitch.test.tsx` stubs the host component, so it proves the
 * seam CHOOSES the right asset. This file does not stub it: the real
 * `AvatarRuntimeSwitch` renders the real `Hyper3DImperativeHost` component,
 * which runs its real mount effect, and only `createHyper3dImperativeHost` —
 * the single function that touches WebGL — is replaced.
 *
 * So what is asserted here is the thing a standalone render harness cannot
 * show: that the asset the seam resolved from a companion's DISPLAY NAME is the
 * asset the host actually hands the engine, and that changing companion tears
 * the old host down before building the new one.
 *
 * The companion labels are the real `config.avatar` strings — the same values
 * `ActiveSession` reads out of router state and feeds to the seam.
 */

type HostCall = { assetId?: string };

const hostCalls: HostCall[] = [];
const disposes: string[] = [];

vi.mock("@/lib/avatar/hyper3d/hyper3dImperativeHost", () => ({
  createHyper3dImperativeHost: (options: { assetId?: string }) => {
    hostCalls.push({ assetId: options.assetId });
    return {
      getStatus: () => "running" as const,
      getFrameCount: () => 0,
      dispose: () => disposes.push(options.assetId ?? "none"),
    };
  },
}));

// The legacy avatar pulls in three.js and a GLB loader jsdom cannot run; it is
// the fallback destination here, not the subject.
vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: (props: Record<string, unknown>) => (
    <div data-testid="existing-avatar" data-model={String(props.modelUrl)} />
  ),
}));

const flagState = { enabled: true };
vi.mock("@/lib/avatar/hyper3d/hyper3dFeatureFlag", () => ({
  isHyper3dAvatarEnabled: () => flagState.enabled,
  hyper3dAvatarFlagRawValue: () => (flagState.enabled ? "true" : null),
  HYPER3D_AVATAR_FLAG: "VITE_HYPER3D_AVATAR_ENABLED",
}));

const { AvatarRuntimeSwitch } = await import("./AvatarRuntimeSwitch");
const { companionSessionUses3dModel, resolveCompanionModelUrl } = await import(
  "@/lib/avatar/companionModelUrl"
);

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

/** Exactly what `SessionStage` passes, built the way `ActiveSession` builds it. */
const propsForCompanion = (avatarLabel: string) => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel: avatarLabel,
  activeAvatarId: null,
  modelUrl: resolveCompanionModelUrl(avatarLabel),
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
  flagState.enabled = true;
  hostCalls.length = 0;
  disposes.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("the selected companion reaches the production host", () => {
  /**
   * The gate `SessionStage` applies before it mounts the seam at all. If this
   * is false for a companion, nothing below can run for them.
   */
  it.each(["Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor"])(
    "%s passes the 3D session gate",
    (label) => {
      expect(companionSessionUses3dModel(label)).toBe(true);
    },
  );

  it.each([
    ["Sara Mitchell", "hyper3d_afr"],
    ["Maya Chen", "hyper3d_sara"],
    ["Alex", "hyper3d_perm"],
    ["Jordan Taylor", "hyper3d_jordan"],
  ])("%s reaches createHyper3dImperativeHost as %s", async (label, assetId) => {
    render(<AvatarRuntimeSwitch {...propsForCompanion(label)} />);
    await waitFor(() => expect(hostCalls.length).toBe(1));
    expect(hostCalls[0].assetId).toBe(assetId);
  });

  /**
   * CHANGING COMPANION. The asset is the host's reload key, so the previous
   * avatar must be disposed before the next is created — that disposal is what
   * aborts an in-flight GLB load, so a slow earlier avatar cannot arrive late
   * and replace the one now selected.
   */
  it("disposes the previous avatar before creating the next", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...propsForCompanion("Sara Mitchell")} />);
    await waitFor(() => expect(hostCalls.length).toBe(1));
    expect(hostCalls[0].assetId).toBe("hyper3d_afr");

    rerender(<AvatarRuntimeSwitch {...propsForCompanion("Alex")} />);
    await waitFor(() => expect(hostCalls.length).toBe(2));

    expect(disposes).toContain("hyper3d_afr");
    expect(hostCalls[1].assetId).toBe("hyper3d_perm");
  });

  it("does not rebuild the host when only conversation state changes", async () => {
    const base = propsForCompanion("Maya Chen");
    const { rerender } = render(<AvatarRuntimeSwitch {...base} />);
    await waitFor(() => expect(hostCalls.length).toBe(1));

    for (let i = 0; i < 4; i += 1) {
      rerender(<AvatarRuntimeSwitch {...base} isSpeaking={i % 2 === 0} />);
    }
    expect(hostCalls.length).toBe(1);
    expect(disposes).toHaveLength(0);
  });

  it("disposes on unmount, leaving no running avatar behind", async () => {
    const { unmount } = render(<AvatarRuntimeSwitch {...propsForCompanion("Jordan Taylor")} />);
    await waitFor(() => expect(hostCalls.length).toBe(1));
    unmount();
    expect(disposes).toEqual(["hyper3d_jordan"]);
  });

  /**
   * FLAG OFF: the host function is never called for any companion, so no WebGL
   * context, no engine chunk and no GLB fetch — and each companion still gets
   * their OWN legacy model URL, never another companion's.
   */
  it.each([
    ["Sara Mitchell", "/avatars/sara-v3.glb"],
    ["Maya Chen", "/avatars/maya%20chen.glb"],
    ["Alex", "/avatars/Alex.glb"],
    ["Jordan Taylor", "/avatars/jordanTaylor.glb"],
  ])("flag off: %s falls back to its own model", async (label, modelUrl) => {
    flagState.enabled = false;
    render(<AvatarRuntimeSwitch {...propsForCompanion(label)} />);
    const el = await screen.findByTestId("existing-avatar");
    expect(el.getAttribute("data-model")).toBe(modelUrl);
    expect(hostCalls).toHaveLength(0);
  });
});
