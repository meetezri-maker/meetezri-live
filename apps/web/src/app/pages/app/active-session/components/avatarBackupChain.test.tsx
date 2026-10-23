import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * ROMY'S PRIMARY -> BACKUP -> TERMINAL CHAIN.
 *
 * These are MOCKED tests of the seam's decision-making: which asset is handed
 * to the host, in what order, how many times, and which callbacks are allowed
 * to count. Nothing here proves a GLB loads — that is browser evidence and is
 * reported separately.
 *
 * The host mock records every mount and hands back its `onFailure`, so a test
 * can fire a failure from a SPECIFIC host at a time of its choosing. That is
 * what makes the stale and duplicate cases expressible at all: both are about
 * a callback arriving from a host that is no longer the live one.
 */

const threeAvatarRenders = vi.fn();

vi.mock("./ThreeAvatar", () => ({
  ThreeAvatar: (props: Record<string, unknown>) => {
    threeAvatarRenders(props);
    return <div data-testid="existing-avatar" />;
  },
}));

type HostRecord = {
  assetId: string;
  onFailure: (failure: { stage: string; message: string }) => void;
  disposed: boolean;
};

/** Every host ever mounted, oldest first, each with its own failure channel. */
const hosts: HostRecord[] = [];
/** Mount/dispose interleaving, so ordering can be asserted rather than assumed. */
const lifecycle: string[] = [];

vi.mock("./Hyper3DImperativeHost", async () => {
  const { useEffect } = await import("react");
  return {
    Hyper3DImperativeHost: (props: {
      assetId: string;
      onFailure: (failure: { stage: string; message: string }) => void;
    }) => {
      const record: HostRecord = {
        assetId: props.assetId,
        onFailure: props.onFailure,
        disposed: false,
      };
      // Keep the newest callback identity for this asset's live host.
      const existing = hosts.find((h) => h.assetId === props.assetId && !h.disposed);
      if (existing) existing.onFailure = props.onFailure;
      else hosts.push(record);

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
const { HYPER3D_ASSET_BACKUPS, hyper3dBackupAssetFor } = await import(
  "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection"
);
const { resolveHyper3dCompanionAsset } = await import(
  "@/lib/avatar/hyper3d/hyper3dCompanionAssets"
);

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

const props = (rawAvatarLabel = "Sara Mitchell", activeAvatarId = "sarah") => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel,
  activeAvatarId,
  modelUrl: "/avatars/unused-legacy.glb",
  portraitUrl: "/avatars/Sara Mitchell.png",
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

const PRIMARY = "hyper3d_arfv2";
const BACKUP = "hyper3d_romy_backup";

/** The portrait img is decorative (empty alt), so it has no "img" role to query. */
const portraitSrc = () =>
  document.querySelector("img")?.getAttribute("src") ?? "";

const failFrom = async (host: HostRecord, message = "GLB failed to load") => {
  await act(async () => {
    host.onFailure({ stage: "engine-init", message });
  });
};

beforeEach(() => {
  hosts.length = 0;
  lifecycle.length = 0;
  threeAvatarRenders.mockClear();
  flagState.enabled = true;
});

describe("Romy's backup is declared, and reachable from Romy only", () => {
  it("maps Romy's primary to her backup snapshot", () => {
    expect(hyper3dBackupAssetFor(PRIMARY)).toBe(BACKUP);
  });

  /**
   * Since 2026-10-23 Frankie has a backup of his own (`perm.glb`, covered in
   * `frankieBackupChain.test.tsx`). Each entry is one companion's own file.
   */
  it("holds exactly Romy's and Frankie's backups", () => {
    expect(HYPER3D_ASSET_BACKUPS).toEqual({
      [PRIMARY]: BACKUP,
      hyper3d_frankie: "hyper3d_perm",
    });
  });

  it.each(["Maya Chen", "Jordan Taylor"])(
    "gives %s no backup, so the chain cannot engage for them",
    (label) => {
      const assetId = resolveHyper3dCompanionAsset(label, null);
      expect(assetId).not.toBe(BACKUP);
      expect(hyper3dBackupAssetFor(assetId)).toBeNull();
    },
  );

  it("never routes Frankie to Romy's backup", () => {
    expect(hyper3dBackupAssetFor(resolveHyper3dCompanionAsset("Alex", null))).not.toBe(BACKUP);
  });

  it("is never a companion's primary asset", () => {
    for (const label of ["Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor"]) {
      expect(resolveHyper3dCompanionAsset(label, null)).not.toBe(BACKUP);
    }
  });
});

describe("primary -> backup -> exhausted", () => {
  it("starts on the primary and never touches the backup while it holds", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY]);
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY);
  });

  it("advances to the backup on a primary failure", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    await failFrom(hosts[0]);

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP),
    );
    expect(hosts.map((h) => h.assetId)).toEqual([PRIMARY, BACKUP]);
  });

  it("disposes the primary BEFORE the backup is constructed", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));

    expect(lifecycle).toEqual([
      `mount:${PRIMARY}`,
      `dispose:${PRIMARY}`,
      `mount:${BACKUP}`,
    ]);
  });

  it("shows the portrait with a retry when the backup also fails", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));
    await failFrom(hosts[1]);

    await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());
    expect(portraitSrc()).toContain("Sara Mitchell.png");
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    // Never the retired legacy avatar.
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
  });

  it("makes exactly two attempts, ever — no third host, no loop", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));
    await failFrom(hosts[1]);
    await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());

    for (let i = 0; i < 20; i += 1) {
      rerender(<AvatarRuntimeSwitch {...props()} />);
    }
    // And a late duplicate from each dead host, for good measure.
    await failFrom(hosts[0]);
    await failFrom(hosts[1]);

    expect(hosts.length).toBe(2);
  });
});

describe("only one failure counts per attempt", () => {
  it("a primary failure reported twice must not exhaust an unfailed backup", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    const primaryHost = hosts[0];
    await failFrom(primaryHost, "first report");
    await failFrom(primaryHost, "duplicate report");

    await waitFor(() => expect(hosts.length).toBe(2));
    // Still on the backup, still rendering 3D — NOT exhausted.
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("ignores a stale primary failure that lands after the backup mounted", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");

    const primaryHost = hosts[0];
    await failFrom(primaryHost);
    await waitFor(() => expect(hosts.length).toBe(2));

    // The ~43 MB primary load rejecting long after the swap.
    await failFrom(primaryHost, "late rejection from the dead primary");

    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(BACKUP);
    expect(hosts.length).toBe(2);
  });
});

describe("retry is the one backwards edge, and it is clean", () => {
  it("returns to the primary with a host the old failures cannot reach", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));
    await failFrom(hosts[1]);
    const retry = await screen.findByRole("button", { name: /retry/i });

    await act(async () => {
      retry.click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY),
    );

    // Late callbacks from BOTH exhausted-cycle hosts must not re-exhaust it.
    await failFrom(hosts[0], "stale from cycle 1 primary");
    await failFrom(hosts[1], "stale from cycle 1 backup");

    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(PRIMARY);
  });
});

describe("changing companion resets the machine", () => {
  it("a different companion is judged on their own asset", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props()} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(hosts.length).toBe(2));
    await failFrom(hosts[1]);
    await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());

    rerender(<AvatarRuntimeSwitch {...props("Maya Chen", "maya")} />);

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_sara"),
    );
  });

  it("Maya falls back to her own legacy avatar, never to Romy's portrait or backup", async () => {
    render(<AvatarRuntimeSwitch {...props("Maya Chen", "maya")} />);
    await screen.findByTestId("hyper3d-avatar");

    await failFrom(hosts[0]);

    await screen.findByTestId("existing-avatar");
    expect(hosts.map((h) => h.assetId)).toEqual(["hyper3d_sara"]);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});

describe("Hyper3D disabled", () => {
  beforeEach(() => {
    flagState.enabled = false;
  });

  it("shows Romy's portrait, initializes no Hyper3D host, and offers no retry", async () => {
    render(<AvatarRuntimeSwitch {...props()} />);

    await waitFor(() => expect(portraitSrc()).toContain("Sara Mitchell.png"));
    expect(hosts).toHaveLength(0);
    expect(screen.queryByTestId("hyper3d-avatar")).toBeNull();
    // Never the retired sara-v3 path.
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("leaves the other companions on their existing legacy avatar", async () => {
    render(<AvatarRuntimeSwitch {...props("Maya Chen", "maya")} />);

    await screen.findByTestId("existing-avatar");
    expect(hosts).toHaveLength(0);
  });
});
