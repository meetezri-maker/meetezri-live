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
 * the feature flag, the failure boundary, and the fallback to the existing
 * Solace avatar. Nothing else in the codebase asks the question, and no product
 * logic outside this file changed to accommodate Hyper3D.
 *
 * Resolution order:
 *
 *   flag off ........................ existing Solace avatar   (the default)
 *   flag on, Hyper3D healthy ........ Hyper3D
 *   flag on, Hyper3D fails .......... existing Solace avatar, latched
 *
 * FAILURE IS A ONE-WAY LATCH. Once Hyper3D has failed for this stage it is not
 * retried: no reload loop, no session reset, no audio restart. The swap is a
 * single React state change in this component, so the session, the WebSocket,
 * the audio scheduler and the transcript never learn that it happened.
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
    !hyper3dRequested || hyper3dFailed ? "existing-solace-avatar" : "hyper3d";
  useEffect(() => {
    recordHyper3dPath(
      {
        flagRawValue: hyper3dAvatarFlagRawValue(),
        flagResolved: hyper3dRequested,
        selectedBranch: committedBranch,
      },
      `avatar branch: ${committedBranch}`,
    );
  }, [hyper3dRequested, committedBranch]);

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

  if (!hyper3dRequested || hyper3dFailed) {
    return renderExistingAvatar();
  }

  return (
    <AvatarFailureBoundary
      renderFallback={renderExistingAvatar}
      onFailure={handleRenderFailure}
    >
      <Hyper3DImperativeHost
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
