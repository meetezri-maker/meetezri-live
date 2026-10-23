import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * FRANKIE'S PRIMARY -> BACKUP -> PORTRAIT CHAIN (2026-10-23).
 *
 *   frankie.glb (`hyper3d_frankie`) -> perm.glb (`hyper3d_perm`) -> his portrait
 *
 * The same seam machinery as Romy's chain in `avatarBackupChain.test.tsx` —
 * attempt tokens, dispose-before-construct, one count per attempt, Retry as the
 * only backwards edge — exercised for the second companion that uses it, so
 * nothing in the seam can quietly assume the backup is Romy's.
 *
 * MOCKED decision-making only: which asset each host is handed, in what order,
 * and which callbacks may count. GLB loading is browser evidence.
 *
 * `AvatarRuntimeSwitch`, the companion table, the backup table and
 * `normalizeCompanionId` are all REAL; only the host, the legacy avatar and the
 * feature flag are replaced.
 */

const threeAvatarRenders = vi.fn();

vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: (props: Record<string, unknown>) => {
    threeAvatarRenders(props);
    return <div data-testid="existing-avatar" data-model={String(props.modelUrl)} />;
  },
}));

type HostRecord = {
  assetId: string;
  onFailure: (failure: { stage: string; message: string }) => void;
  disposed: boolean;
};

const hosts: HostRecord[] = [];
const lifecycle: string[] = [];

vi.mock("./Hyper3DImperativeHost", async () => {
  const { useEffect } = await import("react");
  return {
    Hyper3DImperativeHost: (props: {
      assetId: string;
      onFailure: (failure: { stage: string; message: string }) => void;
    }) => {
      const existing = hosts.find((h) => h.assetId === props.assetId && !h.disposed);
      if (existing) existing.onFailure = props.onFailure;
      else hosts.push({ assetId: props.assetId, onFailure: props.onFailure, disposed: false });

      useEffect(() => {
        lifecycle.push(`mount:${props.assetId}`);
        const mounted = hosts[hosts.length - 1];
        return () => {
          mounted.disposed = true;
          lifecycle.push(`dispose:${props.assetId}`);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <div data-testid="hyper3d-avatar" data-asset={props.assetId} />;
    },
  };
});

const flagState = { enabled: true };
vi.mock("@/lib/avatar/hyper3d/hyper3dFeatureFlag", () => ({
  isHyper3dAvatarEnabled: () => flagState.enabled,
  hyper3dAvatarFlagRawValue: () => (flagState.enabled ? "true" : null),
  HYPER3D_AVATAR_FLAG: "VITE_HYPER3D_AVATAR_ENABLED",
}));

const { AvatarRuntimeSwitch } = await import("./AvatarRuntimeSwitch");
const { HYPER3D_ASSET_URLS, hyper3dBackupAssetFor } = await import(
  "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection"
);
const { companionHasNoLegacyModel, resolveHyper3dCompanionAsset } = await import(
  "@/lib/avatar/hyper3d/hyper3dCompanionAssets"
);
const { resolveCompanionModelUrl, resolveCompanionPortraitUrl, normalizeCompanionId } =
  await import("@/lib/avatar/companionModelUrl");
const { resolveEzriAvatarName } = await import("@/lib/ezri/avatarNameForCompanion");
const { resolveCompanionVoiceGender, resolveEzriWsVoiceForCompanion } = await import(
  "@/lib/ezri/voiceForCompanion"
);

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

/** Built the way `ActiveSession` builds Frankie's stage props from `config.avatar`. */
const props = (rawAvatarLabel = "Alex", activeAvatarId: string | null = "alex") => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel,
  activeAvatarId,
  modelUrl: resolveCompanionModelUrl(rawAvatarLabel),
  portraitUrl: resolveCompanionPortraitUrl(rawAvatarLabel),
  viewTuning: {} as never,
  fixedViewportConfig: null,
  useRfv2Morphs: false,
  useSaraRfv2Preview: false,
  onSaraRfv2Fallback: () => {},
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

const PRIMARY = "hyper3d_frankie";
const BACKUP = "hyper3d_perm";

const portraitSrc = () => document.querySelector("img")?.getAttribute("src") ?? "";

const failFrom = async (host: HostRecord, message = "GLB failed to load") => {
  await act(async () => {
    host.onFailure({ stage: "engine-init", message });
  });
};

/** Drive Frankie to the terminal state: primary fails, backup fails. */
const exhaust = async () => {
  await screen.findByTestId("hyper3d-avatar");
  await failFrom(hosts[0]);
  await waitFor(() => expect(hosts.length).toBe(2));
  await failFrom(hosts[1]);
  await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());
};

beforeEach(() => {
  hosts.length = 0;
  lifecycle.length = 0;
  threeAvatarRenders.mockClear();
  flagState.enabled = true;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("Frankie's chain is declared on his own files", () => {
  it("keeps his canonical identity and maps it to frankie.glb", () => {
    expect(normalizeCompanionId("Alex")).toBe("alex");
    expect(normalizeCompanionId("Alex Rivera")).toBe("alex");
    expect(resolveHyper3dCompanionAsset("Alex", null)).toBe(PRIMARY);
    expect(resolveHyper3dCompanionAsset(undefined, "alex")).toBe(PRIMARY);
    expect(HYPER3D_ASSET_URLS[PRIMARY]).toBe("/avatars/hyper3d/frankie.glb");
  });

  it("backs frankie.glb with perm.glb, unchanged", () => {
    expect(hyper3dBackupAssetFor(PRIMARY)).toBe(BACKUP);
    expect(HYPER3D_ASSET_URLS[BACKUP]).toBe("/avatars/hyper3d/perm.glb");
    // The backup is terminal: it has no backup of its own, so no third attempt.
    expect(hyper3dBackupAssetFor(BACKUP)).toBeNull();
  });

  it("routes Frankie through the no-legacy policy", () => {
    expect(companionHasNoLegacyModel("Alex", "alex")).toBe(true);
    expect(companionHasNoLegacyModel(undefined, "alex")).toBe(true);
  });

  it("leaves who Frankie is and how he sounds unchanged", () => {
    expect(resolveEzriAvatarName("Alex")).toBe("Frankie");
    expect(resolveEzriAvatarName("Alex Rivera")).toBe("Frankie");
    expect(resolveCompanionVoiceGender("Alex")).toBe("male");
    expect(resolveEzriWsVoiceForCompanion("Alex")).toBe("echo");
    expect(resolveEzriWsVoiceForCompanion("Alex", "Voice 4")).toBe("cedar");
    expect(resolveEzriWsVoiceForCompanion("Alex", "Voice 1")).toBe("echo");
  });

  it("leaves Tessa and Andre on their existing legacy fallback", () => {
    expect(companionHasNoLegacyModel("Maya Chen", "maya")).toBe(false);
    expect(companionHasNoLegacyModel("Jordan Taylor", "jordan")).toBe(false);
  });
});

describe("frankie.glb -> perm.glb -> portrait", () => {
  it("starts on frankie.glb and never touches perm.glb while it holds", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY]);
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY);
  });

  it("starts perm.glb once after a primary failure, disposing the primary first", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0], "face mesh did not resolve");

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP),
    );
    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY, BACKUP]);
    expect(lifecycle).toEqual([`mount:${PRIMARY}`, `dispose:${PRIMARY}`, `mount:${BACKUP}`]);
  });

  it("shows Frankie's portrait with Retry when both fail — never Alex.glb", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await exhaust();

    expect(portraitSrc()).toBe("/avatars/Alex.png");
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY, BACKUP]);
  });

  it("makes exactly two attempts — no third host, no loop", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props()} />);
    await exhaust();

    for (let i = 0; i < 20; i += 1) rerender(<AvatarRuntimeSwitch {...props()} />);
    await failFrom(hosts[0], "late duplicate from the dead primary");
    await failFrom(hosts[1], "late duplicate from the dead backup");

    expect(hosts.length).toBe(2);
  });
});

describe("only one failure counts per attempt", () => {
  it("a duplicate primary failure cannot exhaust an unfailed backup", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    await failFrom(hosts[0], "first report");
    await failFrom(hosts[0], "duplicate report");

    await waitFor(() => expect(hosts.length).toBe(2));
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("ignores a stale primary failure that lands after perm.glb mounted", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    const primaryHost = hosts[0];
    await failFrom(primaryHost);
    await waitFor(() => expect(hosts.length).toBe(2));

    // The ~62 MB frankie.glb load rejecting long after the swap.
    await failFrom(primaryHost, "late rejection from the dead primary");

    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP);
    expect(hosts.length).toBe(2);
  });
});

describe("Retry", () => {
  it("starts a fresh frankie.glb attempt that the old failures cannot reach", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await exhaust();

    await act(async () => {
      screen.getByRole("button", { name: /retry/i }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY),
    );
    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY, BACKUP, PRIMARY]);

    await failFrom(hosts[0], "stale from cycle 1 primary");
    await failFrom(hosts[1], "stale from cycle 1 backup");
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY);

    // And the fresh cycle still has its backup available.
    await failFrom(hosts[2], "fresh primary failure");
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP),
    );
  });
});

describe("switching companion", () => {
  it("disposes Frankie's live attempt and ignores its late callbacks", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));
    const frankieBackupHost = hosts[1];

    rerender(<AvatarRuntimeSwitch {...props("Jordan Taylor", "jordan")} />);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_jordan"),
    );
    expect(frankieBackupHost.disposed).toBe(true);
    expect(lifecycle.indexOf(`dispose:${BACKUP}`)).toBeLessThan(
      lifecycle.indexOf("mount:hyper3d_jordan"),
    );

    // perm.glb rejecting after Andre mounted must not touch Andre's machine.
    await failFrom(frankieBackupHost, "late rejection from Frankie's backup");
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_jordan");
    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY, BACKUP, "hyper3d_jordan"]);
  });

  it("judges Frankie afresh after another companion exhausted their chain", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props("Sara Mitchell", "sarah")} />);
    await exhaust();

    rerender(<AvatarRuntimeSwitch {...props()} />);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY),
    );
  });

  it("Andre still falls back to his own legacy avatar, never to Frankie's files", async () => {
    render(<AvatarRuntimeSwitch {...props("Jordan Taylor", "jordan")} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);

    const legacy = await screen.findByTestId("existing-avatar");
    expect(legacy.dataset.model).toBe("/avatars/jordanTaylor.glb");
    expect(hosts.map((h) => h.assetId)).toEqual(["hyper3d_jordan"]);
  });
});

describe("Hyper3D disabled", () => {
  beforeEach(() => {
    flagState.enabled = false;
  });

  it("shows Frankie's portrait without starting either model or Alex.glb", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);

    await waitFor(() => expect(portraitSrc()).toBe("/avatars/Alex.png"));
    expect(hosts).toHaveLength(0);
    expect(screen.queryByTestId("hyper3d-avatar")).toBeNull();
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
    // Retry cannot change a build-time flag, so none is offered.
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
