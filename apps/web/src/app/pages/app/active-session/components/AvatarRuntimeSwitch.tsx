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
import { normalizeCompanionId } from "@/lib/avatar/companionModelUrl";
import type { FixedAvatarViewportConfig } from "./ThreeAvatar";
import { AvatarFailureBoundary } from "./AvatarFailureBoundary";
import { Hyper3DImperativeHost } from "./Hyper3DImperativeHost";

const ThreeAvatar = lazy(() =>
  import("./ThreeAvatar").then((m) => ({ default: m.ThreeAvatar })),
);

/**
 * `activeAvatarId` carries the RUNTIME key, not the canonical companion id.
 *
 * `SessionStage` builds it as
 * `resolvedAvatarKey ?? fixedViewportConfig?.avatarId ?? companionCanonicalId`,
 * and `resolvedAvatarKey` comes from `resolveCompanionAvatarRuntime`, so for
 * Sara it is `"sara"` (legacy hybrid) or `"saraV3"` — never `"sarah"`. With
 * `useSaraV3ForSara === true` the live value today is `"saraV3"`, and
 * `normalizeCompanionId("saraV3")` returns `null`, so keying Hyper3D off that
 * prop alone would silently deny Sara the runtime she is supposed to get.
 *
 * These are therefore the Sara RUNTIME keys, checked beside the canonical id.
 */
const SARA_AVATAR_RUNTIME_KEYS: ReadonlySet<string> = new Set(["sara", "saraV3"]);

/**
 * Is this session's companion Sara?
 *
 * `rawAvatarLabel` is the authoritative signal: it is `config.avatar` verbatim
 * (e.g. `"Sara Mitchell"`), the same value `ActiveSession` feeds to
 * `normalizeCompanionId` to derive `companionCanonicalId`. `activeAvatarId` is
 * consulted as well so this holds if a caller ever supplies only the runtime
 * key — see `SARA_AVATAR_RUNTIME_KEYS`.
 *
 * Pure and cheap, so it is computed per render rather than frozen at mount.
 * That is safe because `SessionStage` only mounts this component when
 * `companionSessionUses3dModel` has already resolved the companion to Sara or
 * Jordan, so the answer is settled before the first render and cannot arrive
 * late.
 */
function isSaraCompanion(
  rawAvatarLabel: string | undefined,
  activeAvatarId: string | null,
): boolean {
  if (normalizeCompanionId(rawAvatarLabel) === "sarah") return true;
  if (!activeAvatarId) return false;
  if (SARA_AVATAR_RUNTIME_KEYS.has(activeAvatarId)) return true;
  return normalizeCompanionId(activeAvatarId) === "sarah";
}

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
 *   flag on, companion is not Sara .. existing Solace avatar
 *   flag on, Sara, Hyper3D healthy .. Hyper3D
 *   flag on, Sara, Hyper3D fails .... existing Solace avatar, latched
 *
 * HYPER3D REPLACES SARA ONLY. The flag is a migration switch for one companion,
 * not a global avatar override: Jordan keeps his existing 3D model on the flag's
 * "on" setting, and every other companion is untouched. Eligibility is resolved
 * here, in the same seam as the flag, so no other file learns the distinction —
 * and because the host is only RENDERED for Sara, a Jordan session never mounts
 * `Hyper3DImperativeHost`, never creates a WebGL renderer, never dynamically
 * imports the engine chunk and never fetches the Hyper3D GLB.
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
   * SARA ONLY. Not a hook — a pure read of props, so it adds nothing to the
   * hook sequence and cannot reorder the two effects below.
   */
  const hyper3dEligible = isSaraCompanion(props.rawAvatarLabel, props.activeAvatarId);

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
      // The companion is named because "flag on, existing avatar" now has two
      // distinct causes, and they are not otherwise distinguishable here.
      `avatar branch: ${committedBranch} (hyper3d eligible: ${hyper3dEligible})`,
    );
  }, [hyper3dRequested, hyper3dEligible, committedBranch]);

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

  // Gating the RENDER is what keeps Hyper3D out of a Jordan session entirely:
  // the host's three.js work, its engine `import()` and its GLB fetch all live
  // in `Hyper3DImperativeHost`'s mount effect, which never runs if it is not
  // rendered. Nothing above this line touches three.js.
  if (!hyper3dRequested || !hyper3dEligible || hyper3dFailed) {
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
