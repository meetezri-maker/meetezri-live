import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * DEV `?hyper3dLowerLipV2` AT THE REAL SEAM.
 *
 * Talk It Out picks its Hyper3D asset per companion, and that path used to
 * ignore the flag entirely: the companion's own GLB loaded while the controller
 * switched to the corrective profile. Here the real `AvatarRuntimeSwitch`
 * renders the real `Hyper3DImperativeHost`, and only the WebGL host is
 * replaced, so what is asserted is the asset id the engine is actually handed.
 *
 * The asset selection is resolved at module load, so every case sets the URL
 * first and then imports a fresh module graph.
 */

const hostCalls: Array<{ assetId?: string }> = [];

vi.mock("@/lib/avatar/hyper3d/hyper3dImperativeHost", () => ({
  createHyper3dImperativeHost: (options: { assetId?: string }) => {
    hostCalls.push({ assetId: options.assetId });
    return { getStatus: () => "running" as const, getFrameCount: () => 0, dispose: () => {} };
  },
}));

vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: () => <div data-testid="existing-avatar" />,
}));

vi.mock("@/lib/avatar/hyper3d/hyper3dFeatureFlag", () => ({
  isHyper3dAvatarEnabled: () => true,
  hyper3dAvatarFlagRawValue: () => "true",
  HYPER3D_AVATAR_FLAG: "VITE_HYPER3D_AVATAR_ENABLED",
}));

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

const propsForCompanion = (avatarLabel: string) => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel: avatarLabel,
  activeAvatarId: null,
  modelUrl: "/avatars/unused.glb",
  portraitUrl: "/avatars/Sara Mitchell.png",
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

async function hostAssetFor(label: string, query: string): Promise<string | undefined> {
  window.history.replaceState(null, "", `/app/session${query}`);
  vi.resetModules();
  const { AvatarRuntimeSwitch } = await import("./AvatarRuntimeSwitch");
  render(<AvatarRuntimeSwitch {...propsForCompanion(label)} />);
  await waitFor(() => expect(hostCalls.length).toBe(1));
  return hostCalls[0].assetId;
}

beforeEach(() => {
  hostCalls.length = 0;
  window.localStorage.removeItem("hyper3dLowerLipV2");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.localStorage.removeItem("hyper3dLowerLipV2");
  window.history.replaceState(null, "", "/");
});

describe("DEV lower-lip V2 asset selection at the companion seam", () => {
  it.each(["Sara Mitchell", "Maya Chen", "Alex"])(
    "?hyper3dLowerLipV2=1 hands %s's host the experimental asset",
    async (label) => {
      expect(await hostAssetFor(label, "?hyper3dLowerLipV2=1")).toBe("female_2291_lowerlip_v2");
    },
  );

  it.each([
    ["Sara Mitchell", "hyper3d_arfv2"],
    ["Maya Chen", "hyper3d_sara"],
    ["Alex", "hyper3d_frankie"],
  ])("?hyper3dLowerLipV2=0 restores %s's own asset (%s)", async (label, assetId) => {
    window.localStorage.setItem("hyper3dLowerLipV2", "1");
    expect(await hostAssetFor(label, "?hyper3dLowerLipV2=0")).toBe(assetId);
    // `=0` clears the sticky preference, so the next session is normal too.
    expect(window.localStorage.getItem("hyper3dLowerLipV2")).toBeNull();
  });

  it("without the flag every companion keeps its production asset", async () => {
    expect(await hostAssetFor("Sara Mitchell", "")).toBe("hyper3d_arfv2");
  });
});

describe("hyper3dDevAssetOverride", () => {
  const selection = (experimental: boolean) => ({
    assetId: "female_2291" as const,
    url: "/avatars/female_2291.glb",
    source: "default" as const,
    legacy: false,
    experimental,
  });

  it("swaps a companion's asset only when the experiment is selected", async () => {
    const { hyper3dDevAssetOverride } = await import(
      "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection"
    );
    expect(hyper3dDevAssetOverride("hyper3d_sara", selection(true))).toBe("female_2291_lowerlip_v2");
    expect(hyper3dDevAssetOverride("hyper3d_sara", selection(false))).toBe("hyper3d_sara");
    // A companion with no Hyper3D asset is never given one.
    expect(hyper3dDevAssetOverride(null, selection(true))).toBeNull();
  });

  it("is the identity in a production build, whatever the selection says", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { hyper3dDevAssetOverride, resolveHyper3dAsset } = await import(
      "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection"
    );
    expect(hyper3dDevAssetOverride("hyper3d_sara", selection(true))).toBe("hyper3d_sara");
    window.history.replaceState(null, "", "/app/session?hyper3dLowerLipV2=1");
    expect(resolveHyper3dAsset().experimental).toBe(false);
  });
});
