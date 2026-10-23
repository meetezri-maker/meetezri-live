import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";

/**
 * BIANCA, DAMIAN, SASHA: OWN MODEL -> OWN PORTRAIT (2026-10-23).
 *
 * No backup GLB, no legacy avatar. The same seam machinery as Romy's and
 * Frankie's chains — attempt tokens, dispose-before-construct, one count per
 * attempt, Retry as the only backwards edge — with the backup step absent.
 *
 * `AvatarRuntimeSwitch`, the companion and backup tables, `normalizeCompanionId`
 * and the portrait/model resolvers are REAL, fed the props `ActiveSession`
 * builds from `config.avatar`. Only the host, the legacy avatar and the flag
 * are replaced.
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
const { resolveCompanionModelUrl, resolveCompanionPortraitUrl, resolveCompanionAvatarRuntime } =
  await import("@/lib/avatar/companionModelUrl");

const ref = <T,>(value: T): MutableRefObject<T> => ({ current: value });

/** Built the way `ActiveSession` / `SessionStage` build the stage props. */
const props = (label: string) => ({
  sessionRoomThemeKey: "calm" as never,
  rawAvatarLabel: label,
  activeAvatarId: resolveCompanionAvatarRuntime(label),
  modelUrl: resolveCompanionModelUrl(label),
  portraitUrl: resolveCompanionPortraitUrl(label),
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

const portraitSrc = () => document.querySelector("img")?.getAttribute("src") ?? "";
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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

const NEW_THREE = [
  ["Bianca", "hyper3d_bianca", "/avatars/Bianca.png"],
  ["Damian", "hyper3d_damian", "/avatars/Damian.png"],
  ["Sasha", "hyper3d_sasha", "/avatars/Sasha.png"],
] as const;

describe.each(NEW_THREE)("%s", (label, asset, portrait) => {
  it("mounts exactly its own Hyper3D asset", async () => {
    render(<AvatarRuntimeSwitch {...props(label)} />);
    await screen.findByTestId("hyper3d-avatar");
    expect(hosts.map((h) => h.assetId)).toEqual([asset]);
  });

  it("goes straight to its own portrait with Retry after one failure — no backup, no legacy", async () => {
    render(<AvatarRuntimeSwitch {...props(label)} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);

    await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());
    expect(portraitSrc()).toBe(portrait);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
    expect(hosts.map((h) => h.assetId)).toEqual([asset]);
    expect(lifecycle).toEqual([`mount:${asset}`, `dispose:${asset}`]);
  });

  it("counts a duplicate or late failure once and never starts a second host", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props(label)} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0], "first");
    await failFrom(hosts[0], "duplicate");
    for (let i = 0; i < 10; i += 1) rerender(<AvatarRuntimeSwitch {...props(label)} />);
    await failFrom(hosts[0], "late");

    expect(hosts).toHaveLength(1);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("Retry starts a fresh attempt the old host cannot reach", async () => {
    render(<AvatarRuntimeSwitch {...props(label)} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await act(async () => {
      screen.getByRole("button", { name: /retry/i }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(asset),
    );
    expect(hosts.map((h) => h.assetId)).toEqual([asset, asset]);
    await failFrom(hosts[0], "stale from the first attempt");
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe(asset);
  });

  it("with Hyper3D disabled shows its portrait and initialises no model", async () => {
    flagState.enabled = false;
    render(<AvatarRuntimeSwitch {...props(label)} />);

    await waitFor(() => expect(portraitSrc()).toBe(portrait));
    expect(hosts).toHaveLength(0);
    expect(screen.queryByTestId("existing-avatar")).toBeNull();
    expect(threeAvatarRenders).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});

describe("switching between companions", () => {
  it("disposes Bianca's live attempt before Damian's starts and ignores its late failure", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props("Bianca")} />);
    await screen.findByTestId("hyper3d-avatar");
    const biancaHost = hosts[0];

    rerender(<AvatarRuntimeSwitch {...props("Damian")} />);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_damian"),
    );
    expect(biancaHost.disposed).toBe(true);
    expect(lifecycle.indexOf("dispose:hyper3d_bianca")).toBeLessThan(
      lifecycle.indexOf("mount:hyper3d_damian"),
    );

    await failFrom(biancaHost, "late rejection from Bianca's file");
    expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_damian");
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("judges Sasha afresh after Bianca exhausted hers", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props("Bianca")} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() => expect(screen.queryByTestId("hyper3d-avatar")).toBeNull());

    rerender(<AvatarRuntimeSwitch {...props("Sasha")} />);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_sasha"),
    );
  });

  it("leaves Romy's and Frankie's backups to them alone", async () => {
    const { rerender } = render(<AvatarRuntimeSwitch {...props("Sara Mitchell")} />);
    await screen.findByTestId("hyper3d-avatar");
    await failFrom(hosts[0]);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_romy_backup"),
    );

    rerender(<AvatarRuntimeSwitch {...props("Alex")} />);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_frankie"),
    );
    await failFrom(hosts[hosts.length - 1]);
    await waitFor(() =>
      expect(screen.getByTestId("hyper3d-avatar").dataset.asset).toBe("hyper3d_perm"),
    );
    expect(hosts.map((h) => h.assetId)).toEqual([
      "hyper3d_arfv2",
      "hyper3d_romy_backup",
      "hyper3d_frankie",
      "hyper3d_perm",
    ]);
  });
});
