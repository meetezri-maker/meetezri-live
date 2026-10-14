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
import { resolveHyper3dCompanionAsset } from "@/lib/avatar/hyper3d/hyper3dCompanionAssets";
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
export interface AvatarRuntimeSwitchProps {
  sessionRoomThemeKey: SessionBackdropPresetKey;
  rawAvatarLabel: string | undefined;
  activeAvatarId: string | null;
  modelUrl: string;
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
  const [hyper3dFailed, setHyper3dFailed] = useState(false);
  const latchedRef = useRef(false);

  /**
   * THIS COMPANION'S ASSET, or `null` when they have none.
   *
   * Not a hook — a pure table lookup over props, so it adds nothing to the hook
   * sequence and cannot reorder the effects below.
   */
  const hyper3dAssetId = resolveHyper3dCompanionAsset(
    props.rawAvatarLabel,
    props.activeAvatarId,
  );
  const hyper3dEligible = hyper3dAssetId !== null;

  /**
   * THE LATCH BELONGS TO ONE ASSET, SO IT IS RELEASED WHEN THE ASSET CHANGES.
   *
   * A failure latched for, say, Alex is evidence that `perm.glb` could not be
   * loaded or bound. It says nothing about Maya Chen, and carrying it across
   * would strand every later companion on the legacy avatar for the rest of the
   * page's life after one bad asset. Clearing it on a real asset change keeps
   * the original guarantee exactly where it was written — no retry for the
   * companion that failed, no reload loop, no session reset — while letting the
   * next companion be judged on their own asset.
   *
   * The ref is reset with the state so the two cannot disagree, and this runs
   * during render rather than in an effect so the very first render after the
   * change already takes the Hyper3D branch instead of flashing the fallback.
   */
  const latchedAssetRef = useRef(hyper3dAssetId);
  if (latchedAssetRef.current !== hyper3dAssetId) {
    latchedAssetRef.current = hyper3dAssetId;
    if (latchedRef.current) {
      latchedRef.current = false;
      setHyper3dFailed(false);
    }
  }

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
    !hyper3dRequested || !hyper3dEligible || hyper3dFailed
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

  const latchFallback = useCallback((reason: string, expected: boolean) => {
    if (latchedRef.current) return;
    latchedRef.current = true;
    if (expected) {
      console.info(`[Avatar] ${reason} Using the existing Solace avatar.`);
    } else {
      console.warn(
        `[Avatar] Hyper3D unavailable — falling back to the existing Solace avatar. Reason: ${reason}`,
      );
    }
    recordHyper3dPath(
      { fellBackToSolaceAvatar: true, fallbackReason: reason },
      `fallback latched: ${reason}`,
    );
    setHyper3dFailed(true);
  }, []);

  const handleHostFailure = useCallback(
    (failure: Hyper3dHostFailure) => {
      recordHyper3dPath({ hostFailureStage: failure.stage });
      // `engine-missing` is the expected state until the engine is ported: the
      // flag is on but this build carries no Hyper3D engine. Not a fault.
      latchFallback(failure.message, failure.stage === "engine-missing");
    },
    [latchFallback],
  );

  const handleRenderFailure = useCallback(
    (reason: string) => latchFallback(reason, false),
    [latchFallback],
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

  // Gating the RENDER is what keeps Hyper3D out of an unmapped companion's
  // session entirely: the host's three.js work, its engine `import()` and its
  // GLB fetch all live in `Hyper3DImperativeHost`'s mount effect, which never
  // runs if it is not rendered. Nothing above this line touches three.js.
  if (!hyper3dRequested || !hyper3dAssetId || hyper3dFailed) {
    return renderExistingAvatar();
  }

  return (
    <AvatarFailureBoundary
      // Keyed by asset so a change rebuilds the boundary too: an error boundary
      // that has already caught stays in its error state until it is remounted,
      // and the previous companion's failure must not swallow the next one's
      // first render.
      key={hyper3dAssetId}
      renderFallback={renderExistingAvatar}
      onFailure={handleRenderFailure}
    >
      <Hyper3DImperativeHost
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
