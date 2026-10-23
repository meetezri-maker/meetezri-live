import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Loader2 } from "lucide-react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import type { CompanionViewTuning } from "@/lib/avatar/companionViewTuning";
import type { SessionBackdropPresetKey } from "@/lib/sessionBackdropPresets";
import {
  HYPER3D_AVATAR_FLAG,
  hyper3dAvatarFlagRawValue,
  isHyper3dAvatarEnabled,
} from "@/lib/avatar/hyper3d/hyper3dFeatureFlag";
import {
  recordHyper3dPath,
  type Hyper3dPathBranch,
} from "@/lib/avatar/hyper3d/hyper3dPathDiagnostics";
import type { Hyper3dHostFailure } from "@/lib/avatar/hyper3d/hyper3dImperativeHost";
import { setHyper3dRuntimeCommitted } from "@/lib/avatar/hyper3d/hyper3dEngineRegistry";
import {
  companionHasNoLegacyModel,
  resolveHyper3dCompanionAsset,
} from "@/lib/avatar/hyper3d/hyper3dCompanionAssets";
import { hyper3dBackupAssetFor } from "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection";
import { AvatarUnavailableNotice } from "./AvatarUnavailableNotice";
import type { FixedAvatarViewportConfig } from "./ThreeAvatar";
import { AvatarFailureBoundary } from "./AvatarFailureBoundary";
import { Hyper3DImperativeHost } from "./Hyper3DImperativeHost";

const ThreeAvatar = lazy(() =>
  import("./ThreeAvatar").then((m) => ({ default: m.ThreeAvatar })),
);

/**
 * THE ONE SEAM.
 *
 * Every decision about WHICH avatar implementation runs is made here, once:
 * the feature flag, the companion-to-asset mapping, the failure boundary, and
 * the fallback to the existing Solace avatar. Nothing else in the codebase asks
 * the question, and no product logic outside this file changed to accommodate
 * Hyper3D.
 *
 * Resolution order:
 *
 *   flag off ............................... existing Solace avatar (default)
 *   flag on, companion has no Hyper3D asset  existing Solace avatar
 *   flag on, mapped companion, healthy ..... Hyper3D, that companion's asset
 *   flag on, mapped companion, failed ...... existing Solace avatar, latched
 *
 * FOUR COMPANIONS, ONE RUNTIME. Eligibility used to be the single question "is
 * this Sara"; it is now "does this companion have an asset", answered by
 * `resolveHyper3dCompanionAsset`. That function returns `null` for anyone
 * unmapped, so the behaviour it replaces is preserved exactly where it matters:
 * an unrecognised companion never mounts `Hyper3DImperativeHost`, never creates
 * a WebGL renderer, never dynamically imports the engine chunk and never
 * fetches a GLB.
 *
 * THE ASSET IS RESOLVED HERE AND NOWHERE ELSE, and that is the identity
 * guarantee. The engine is handed a file id, never a companion, so it cannot
 * substitute one person for another; and because `null` means "not eligible"
 * rather than "use the default", a mapping miss falls back to that companion's
 * own existing avatar instead of quietly rendering somebody else's face under
 * the right name and the right voice.
 *
 * FAILURE IS A ONE-WAY LATCH, PER AVATAR. Once Hyper3D has failed for this
 * companion it is not retried: no reload loop, no session reset, no audio
 * restart. The swap is a single React state change in this component, so the
 * session, the WebSocket, the audio scheduler and the transcript never learn
 * that it happened. Selecting a DIFFERENT companion clears the latch, because
 * the latch is evidence about one asset and says nothing about another.
 *
 * Two independent failure channels feed the same latch, because they catch
 * different things — see `AvatarFailureBoundary` (render-phase) and
 * `createHyper3dImperativeHost` (async init, GLB/texture load, rig and morph
 * binding, animation frame, lost WebGL context).
 */
/**
 * Primary, then this companion's declared backup, then a terminal state.
 * Forward-only; the single backwards edge is the member's Retry.
 */
type Hyper3dAttempt = "primary" | "backup" | "exhausted";

export interface AvatarRuntimeSwitchProps {
  sessionRoomThemeKey: SessionBackdropPresetKey;
  rawAvatarLabel: string | undefined;
  activeAvatarId: string | null;
  modelUrl: string;
  /** Shown when no 3D avatar can run — see `AvatarUnavailableNotice`. */
  portraitUrl: string;
  viewTuning: CompanionViewTuning;
  fixedViewportConfig: FixedAvatarViewportConfig | null | undefined;
  useRfv2Morphs: boolean;
  useSaraRfv2Preview: boolean;
  onSaraRfv2Fallback: (reason: string) => void;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  mouthAudioLevelRef: MutableRefObject<number>;
  avatarPhonemeTimelineRef: MutableRefObject<AvatarPhonemeTimeline | null>;
  avatarAudioCurrentTimeRef: MutableRefObject<number>;
  speechTextRef: MutableRefObject<string>;
  speechCharIndexRef: MutableRefObject<number>;
  speechPulseRef: MutableRefObject<number>;
  latestUserTextRef: MutableRefObject<string>;
  latestJordanTextRef: MutableRefObject<string>;
  userSpeechStartedAtMsRef: MutableRefObject<number>;
  userLastSpeechAtMsRef: MutableRefObject<number>;
  jordanSpeechStartedAtMsRef: MutableRefObject<number>;
  jordanLastSpeechAtMsRef: MutableRefObject<number>;
  sentimentCompoundRef: MutableRefObject<number | undefined>;
}

const AVATAR_LOADING_FALLBACK = (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
    <Loader2 className="h-10 w-10 animate-spin text-purple-300" aria-hidden />
    <p className="text-sm text-white/70">Loading avatar…</p>
  </div>
);

export function AvatarRuntimeSwitch(props: AvatarRuntimeSwitchProps) {
  // Read once per mount. Flipping the env var takes effect on the next session,
  // never mid-session, so the avatar cannot change under a live conversation.
  const [hyper3dRequested] = useState(isHyper3dAvatarEnabled);

  /**
   * THIS COMPANION'S ASSET, or `null` when they have none.
   *
   * Not a hook — a pure table lookup over props, so it adds nothing to the hook
   * sequence and cannot reorder the effects below.
   */
  const primaryAssetId = resolveHyper3dCompanionAsset(
    props.rawAvatarLabel,
    props.activeAvatarId,
  );
  const backupAssetId = hyper3dBackupAssetFor(primaryAssetId);
  const noLegacyModel = companionHasNoLegacyModel(
    props.rawAvatarLabel,
    props.activeAvatarId,
  );

  /**
   * WHICH ATTEMPT THIS COMPANION IS ON, AND THE TOKEN THAT MAKES IT SAFE.
   *
   * The machine only ever moves forward — `primary` -> `backup` -> `exhausted`
   * — plus one backwards edge the MEMBER drives, the Retry button. No timer, no
   * automatic re-entry, so no loop is expressible.
   *
   * `token` identifies ONE attempt by ONE host. It is not the asset id: after a
   * retry, or after switching companion and back, the same asset id is rendered
   * again by a different host, and a callback from the dead host must not be
   * mistaken for the live one's. Every transition mints a new token, so a stale
   * callback can never match.
   */
  const [attempt, setAttempt] = useState<Hyper3dAttempt>("primary");
  const [token, setToken] = useState(0);

  /**
   * Render-time mirrors, so the failure callbacks read the CURRENT values
   * without being rebuilt on every transition. A callback that was rebuilt
   * would be a different function identity, which would itself remount the
   * host — the opposite of what a stale-callback guard is for.
   */
  const activeTokenRef = useRef(token);
  activeTokenRef.current = token;
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  /** The token whose failure has already been counted. `null` = none yet. */
  const reportedTokenRef = useRef<number | null>(null);
  const backupAssetIdRef = useRef(backupAssetId);
  backupAssetIdRef.current = backupAssetId;

  const hyper3dAssetId =
    attempt === "primary"
      ? primaryAssetId
      : attempt === "backup"
        ? backupAssetId
        : null;
  const hyper3dEligible = hyper3dAssetId !== null;

  /**
   * THE MACHINE BELONGS TO ONE COMPANION, SO IT RESETS WHEN THE COMPANION DOES.
   *
   * A failure for Romy is evidence about Romy's two files. It says nothing
   * about Maya Chen, and carrying it across would strand every later companion
   * for the rest of the page's life after one bad asset. Resetting on a real
   * PRIMARY change — the companion's own asset, not the attempt's — restores
   * the original guarantee exactly where it was written: no automatic retry for
   * the companion that failed, no reload loop, no session reset, while the next
   * companion is judged on their own files.
   *
   * It runs during render rather than in an effect so the first render after
   * the change already takes the Hyper3D branch instead of flashing a fallback,
   * and it mints a fresh token so nothing in flight from the previous companion
   * can report into the new one.
   */
  const machineOwnerRef = useRef(primaryAssetId);
  if (machineOwnerRef.current !== primaryAssetId) {
    machineOwnerRef.current = primaryAssetId;
    reportedTokenRef.current = null;
    setAttempt("primary");
    setToken((n) => n + 1);
  }

  /**
   * ONE FAILURE REPORT PER ATTEMPT, AND NEVER FROM A DEAD ONE.
   *
   * Two independent channels report faults — the render-phase boundary and the
   * imperative host — and either can fire more than once or late. Three things
   * have to be true and none of them follow from the asset id:
   *
   *   stale      a ~43 MB primary load can reject AFTER the backup host has
   *              mounted. Advancing on that would exhaust a backup that never
   *              actually failed. The token the callback was minted with no
   *              longer matches, so it is dropped.
   *   duplicate  a primary failure reported twice must count once. The first
   *              report records its token here and the second sees it already
   *              recorded.
   *   recurring  after a retry, or after leaving this companion and coming
   *              back, the SAME asset id is rendered by a NEW host. The token
   *              differs, so the old host's late callback still cannot match.
   *
   * The ref is written during the transition rather than in an effect, so a
   * second callback arriving in the same tick — before React has re-rendered —
   * is already too late to count.
   */
  const advance = useCallback(
    (forToken: number, reason: string, expected: boolean) => {
      if (reportedTokenRef.current === forToken) return; // duplicate
      if (activeTokenRef.current !== forToken) return; // stale or dead host
      reportedTokenRef.current = forToken;

      if (expected) {
        console.info(`[Avatar] ${reason} Using the existing Solace avatar.`);
      } else {
        console.warn(
          `[Avatar] Hyper3D unavailable — falling back. Reason: ${reason}`,
        );
      }
      recordHyper3dPath(
        { fellBackToSolaceAvatar: true, fallbackReason: reason },
        `attempt ${attemptRef.current} failed (token ${forToken}): ${reason}`,
      );

      setAttempt((current) =>
        current === "primary" && backupAssetIdRef.current ? "backup" : "exhausted",
      );
      setToken((n) => n + 1);
    },
    [],
  );

  /**
   * THE ONE BACKWARDS EDGE, AND IT IS THE MEMBER'S TO TAKE.
   *
   * A fresh token means every host and boundary from the exhausted cycle is
   * dead to the machine: their callbacks cannot match, so a retry cannot be
   * exhausted by the failures that preceded it.
   */
  const retry = useCallback(() => {
    reportedTokenRef.current = null;
    setAttempt("primary");
    setToken((n) => n + 1);
  }, []);

  /**
   * WHAT ACTUALLY COMMITTED, recorded at commit time rather than during render.
   *
   * A render can be discarded (Suspense, concurrent re-render), and a diagnostic
   * written from one would claim a branch the user never saw — which is exactly
   * the confusion this record exists to remove. `useEffect` only runs for the
   * tree that was committed.
   *
   * The raw flag value is recorded alongside the resolved one because
   * `isHyper3dAvatarEnabled` reads a Vite compile-time substitution: a dev server
   * that was not restarted is otherwise indistinguishable from a flag that is
   * genuinely off.
   */
  const committedBranch: Hyper3dPathBranch =
    !hyper3dRequested || !hyper3dEligible
      ? "existing-solace-avatar"
      : "hyper3d";
  useEffect(() => {
    recordHyper3dPath(
      {
        flagRawValue: hyper3dAvatarFlagRawValue(),
        flagResolved: hyper3dRequested,
        selectedBranch: committedBranch,
      },
      // The asset is named because "flag on, existing avatar" has two distinct
      // causes — unmapped companion, or a failure for a mapped one — and with
      // four companions the asset is what tells them apart in a log.
      `avatar branch: ${committedBranch} (hyper3d asset: ${hyper3dAssetId ?? "none"})`,
    );
  }, [hyper3dRequested, hyper3dAssetId, committedBranch]);

  // Same commit-time rule: live metadata association follows the avatar that
  // actually mounted, so a fallback restores the existing avatar's behaviour.
  useEffect(() => {
    setHyper3dRuntimeCommitted(committedBranch === "hyper3d");
    return () => setHyper3dRuntimeCommitted(false);
  }, [committedBranch]);

  /**
   * The token these handlers belong to is captured at RENDER time, so each
   * mounted host and boundary carries the token it was created under. A host
   * that outlives its attempt keeps reporting its own, stale token.
   */
  const handleHostFailure = useCallback(
    (failure: Hyper3dHostFailure) => {
      recordHyper3dPath({ hostFailureStage: failure.stage });
      // `engine-missing` is the expected state until the engine is ported: the
      // flag is on but this build carries no Hyper3D engine. Not a fault.
      advance(token, failure.message, failure.stage === "engine-missing");
    },
    [advance, token],
  );

  const handleRenderFailure = useCallback(
    (reason: string) => advance(token, reason, false),
    [advance, token],
  );

  const renderExistingAvatar = useCallback(
    () => (
      <Suspense fallback={AVATAR_LOADING_FALLBACK}>
        <ThreeAvatar
          sessionRoomThemeKey={props.sessionRoomThemeKey}
          rawAvatarLabel={props.rawAvatarLabel}
          activeAvatarId={props.activeAvatarId}
          modelUrl={props.modelUrl}
          viewTuning={props.viewTuning}
          fixedViewportConfig={props.fixedViewportConfig}
          useRfv2Morphs={props.useRfv2Morphs}
          useSaraRfv2Preview={props.useSaraRfv2Preview}
          onSaraRfv2Fallback={props.onSaraRfv2Fallback}
          isSpeaking={props.isSpeaking}
          isListening={props.isListening}
          isThinking={props.isThinking}
          mouthAudioLevelRef={props.mouthAudioLevelRef}
          avatarPhonemeTimelineRef={props.avatarPhonemeTimelineRef}
          avatarAudioCurrentTimeRef={props.avatarAudioCurrentTimeRef}
          speechTextRef={props.speechTextRef}
          speechCharIndexRef={props.speechCharIndexRef}
          speechPulseRef={props.speechPulseRef}
          latestUserTextRef={props.latestUserTextRef}
          latestJordanTextRef={props.latestJordanTextRef}
          userSpeechStartedAtMsRef={props.userSpeechStartedAtMsRef}
          userLastSpeechAtMsRef={props.userLastSpeechAtMsRef}
          jordanSpeechStartedAtMsRef={props.jordanSpeechStartedAtMsRef}
          jordanLastSpeechAtMsRef={props.jordanLastSpeechAtMsRef}
          sentimentCompoundRef={props.sentimentCompoundRef}
        />
      </Suspense>
    ),
    [props],
  );

  /**
   * THE TERMINAL PICTURE, and the two routes to it.
   *
   * A companion with no legacy model left cannot be shown `ThreeAvatar`: her
   * files carry ARKit morphs no legacy runtime reads, and the retired
   * `sara-v3.glb` is a different character. So she gets her portrait instead —
   * the same `StaticSessionPortrait` the 2D companions already use.
   *
   * Retry is offered ONLY when Hyper3D is actually available. While the flag is
   * off, no button can change a build-time constant, and a control that cannot
   * succeed is worse than none.
   */
  const renderPortraitState = (retryable: boolean) => (
    <AvatarUnavailableNotice
      portraitUrl={props.portraitUrl}
      isSpeaking={props.isSpeaking}
      onRetry={retryable ? retry : undefined}
    />
  );

  // Gating the RENDER is what keeps Hyper3D out of an unmapped companion's
  // session entirely: the host's three.js work, its engine `import()` and its
  // GLB fetch all live in `Hyper3DImperativeHost`'s mount effect, which never
  // runs if it is not rendered. Nothing above this line touches three.js.
  if (!hyper3dRequested) {
    return noLegacyModel ? renderPortraitState(false) : renderExistingAvatar();
  }
  if (!hyper3dAssetId) {
    // `exhausted`, or a companion with no Hyper3D asset at all.
    return noLegacyModel ? renderPortraitState(true) : renderExistingAvatar();
  }

  return (
    <AvatarFailureBoundary
      // Keyed by asset AND token. The asset alone is not enough: a retry, or
      // leaving this companion and coming back, renders the SAME asset id under
      // a new host, and an error boundary that has already caught stays in its
      // error state until it is remounted. The token guarantees that remount.
      key={`${hyper3dAssetId}:${token}`}
      renderFallback={() =>
        noLegacyModel ? renderPortraitState(true) : renderExistingAvatar()
      }
      onFailure={handleRenderFailure}
    >
      <Hyper3DImperativeHost
        // Same key, same reason: unmounting the previous host runs its effect
        // cleanup, which disposes the previous engine, renderer and scene
        // BEFORE this one is constructed.
        key={`${hyper3dAssetId}:${token}`}
        assetId={hyper3dAssetId}
        avatarAudioCurrentTimeRef={props.avatarAudioCurrentTimeRef}
        mouthAudioLevelRef={props.mouthAudioLevelRef}
        isSpeaking={props.isSpeaking}
        isListening={props.isListening}
        isThinking={props.isThinking}
        onFailure={handleHostFailure}
      />
    </AvatarFailureBoundary>
  );
}

/** Exported for diagnostics and the non-regression checklist. */
export const AVATAR_RUNTIME_FLAG = HYPER3D_AVATAR_FLAG;
