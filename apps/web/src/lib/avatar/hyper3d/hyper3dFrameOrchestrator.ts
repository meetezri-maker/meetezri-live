import type { BlendshapePose } from "./engine/types/facialAnimation";
import type { AvatarModelConfig } from "./engine/mappings/avatarModelConfig";
import type { SpeechAcousticFrame } from "./engine/engine/avatar/upstream/threejs-talking-avatar/audioAnalysis";
import type { HeadPerformancePlan } from "./engine/engine/avatar/upstream/threejs-talking-avatar/performance";
import type { SpeechPerformancePlan } from "./engine/engine/animation/SpeechPerformancePlan";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { transformPoseForAvatarModel, defaultFemaleVisemeTestState } from "./engine/engine/avatar/modelPoseTransform";
import {
  resolveThreejsTalkingAvatarHead,
  THREEJS_TALKING_AVATAR_BLINK_CHANNELS,
  THREEJS_TALKING_AVATAR_BROW_CHANNELS,
  THREEJS_TALKING_AVATAR_GAZE_CHANNELS,
  createThreejsTalkingAvatarPerformance,
} from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";

/** The stateful upstream performer — one per mounted avatar. */
type ThreejsTalkingAvatarPerformance = ReturnType<typeof createThreejsTalkingAvatarPerformance>;

/**
 * The performer, configured the way the accepted call site configures it.
 *
 * `ThreejsTalkingAvatarPerformance` ships BOTH of these OFF
 * (`affectEnabled = false`, `ambientGazeWhileSpeaking = false`) and
 * `AvatarModel` turns them on from the store, which defaults both to `true`:
 *
 *     AvatarModel.tsx:556  setAffectEnabled(hyper3dAffectEnabled)            // true
 *     AvatarModel.tsx:573  setAmbientGazeWhileSpeaking(hyper3dAmbientGaze)   // true
 *
 * Constructing the performer without them is what made `affectScale` evaluate to
 * 0 — `motionScale` is `affectEnabled && plan ? … : 0`, so warmth, eye softening,
 * cheek response and semantic brows all collapsed to nothing while the plan
 * itself was perfectly correct.
 *
 * `setConversationState` is deliberately NOT called: the accepted call site does
 * not call it either, so `stateAffectScale` stays at its constructor default of
 * `CONVERSATIONAL_STATE_POLICY.speaking.affectScale` (1.0).
 *
 * Both the production factory and the equivalence harness build the performer
 * through here, so the configuration cannot drift between them.
 */
export function createHyper3dPerformance(): ThreejsTalkingAvatarPerformance {
  const performance = createThreejsTalkingAvatarPerformance();
  performance.setAffectEnabled(true);
  performance.setAmbientGazeWhileSpeaking(true);
  return performance;
}
import {
  affectArticulationYield,
  hyper3dAffectPose,
  Hyper3dWarmthYieldFollower,
} from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { hyper3dGazePose } from "./engine/mappings/avatars/hyper3dCalibration";
import {
  ActivePresenceDirector,
  ACTIVE_PRESENCE_OWNER,
} from "./engine/engine/avatar/hyper3dActivePresence";
import { ACTIVE_PRESENCE_FACE_CHANNELS } from "./engine/mappings/avatars/hyper3dActivePresenceProfile";
import { defaultIdleExpressionSettings } from "./engine/engine/behaviour/IdleExpressionController";
import { defaultHeadNeckDiagnosticSettings } from "./engine/engine/animation/HeadNeckTransformDiagnostic";
import {
  HYPER3D_PRODUCTION_HEAD_MOTION_SCALE,
  HYPER3D_PRODUCTION_SPEAKING,
} from "./hyper3dProductionConfig";
import type { HeadMotionPose } from "./engine/types/facialAnimation";
import {
  applyHyper3dIdleShowcasePose,
  publishHyper3dIdleShowcaseDiagnostics,
  type Hyper3dIdleShowcaseRuntime,
  type Hyper3dIdleShowcaseYieldReason,
} from "./hyper3dIdleExpressionShowcase";
import {
  applyHyper3dEyelashTestPose,
  getHyper3dEyelashTestIntensity,
  getHyper3dEyelashTestState,
  hyper3dEyelashTestAvailable,
} from "./hyper3dEyelashTest";

/**
 * THE ACCEPTED FRAME SEQUENCE, in one place.
 *
 * Extracted so there is exactly ONE transcription of `AvatarModel.tsx`'s frame
 * order in Solace. The engine factory calls it to drive the GLB; the static
 * equivalence harness calls the SAME function to measure commands. A harness
 * that re-transcribed the sequence would only ever prove my notes agree with my
 * notes — and the first version of it did exactly that, silently omitting the
 * facial-liveliness step and reporting zero warmth.
 *
 * This function decides nothing. Every value comes from the ported accepted
 * modules; the order is the contract's, documented in
 * `docs/hyper3d-imperative-binding-contract.md` §D/§F.
 */

export type Hyper3dRuntimePieces = {
  config: AvatarModelConfig;
  controller: AvatarController;
  performance: ThreejsTalkingAvatarPerformance;
  activePresence: ActivePresenceDirector;
  warmthYield: Hyper3dWarmthYieldFollower;
  idleShowcase?: Hyper3dIdleShowcaseRuntime;
  headSupported: boolean;
};

export type Hyper3dFrameInput = {
  timeSeconds: number;
  deltaSeconds: number;
  isSpeaking: boolean;
  isListening?: boolean;
  isThinking?: boolean;
  isProcessing?: boolean;
  isInterrupted?: boolean;
  isAudioActive?: boolean;
  elapsedSeconds?: number;
  plan: HeadPerformancePlan | null;
  acousticFrames: readonly SpeechAcousticFrame[];
  /** Live-only sentence plan/clock. Omitted keeps static evaluation byte-identical. */
  speechPerformancePlan?: SpeechPerformancePlan | null;
  performanceClock?: number;
  headClock?: number;
  /** DEV-only: capture the accepted composition seams for one sampled frame. */
  captureReview?: boolean;
  /**
   * DEV-only lip-sync trace, preallocated by the caller and mutated in place.
   * Read-only with respect to the pose: omitting it changes nothing.
   */
  mouthTrace?: Hyper3dMouthTrace;
};

/** The speech mouth channels the lip-sync trace follows through every layer. */
export const HYPER3D_SPEECH_MOUTH_CHANNELS = [
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthStretchLeft",
  "mouthStretchRight",
] as const;

export type Hyper3dMouthStage = {
  jawOpen: number;
  mouthMax: number;
  channels: Record<string, number>;
};

export type Hyper3dMouthTrace = {
  timeSeconds: number;
  deltaSeconds: number;
  controllerEvaluated: boolean;
  controllerSpeechActive: boolean;
  currentPhoneme: string | null;
  /** Controller output after the model transform, before any ownership layer. */
  preOwnership: Hyper3dMouthStage;
  afterFaceOwnership: Hyper3dMouthStage;
  afterAffect: Hyper3dMouthStage;
  afterPresence: Hyper3dMouthStage;
  /** The pose handed to `MorphTargetController.write`. */
  final: Hyper3dMouthStage;
  presenceOwned: boolean;
  showcaseEligible: boolean;
  showcaseActive: boolean;
  showcaseYieldReason: Hyper3dIdleShowcaseYieldReason | null;
  /**
   * Phase 2G.1C (audit risk B3). `isSpeaking` is the conversation flag as THIS
   * frame saw it, which is what gates the showcase. `showcaseOwnsLowerFace` is
   * measured, not assumed: it is true only when an active showcase actually
   * changed a speech mouth channel between `afterPresence` and `final`.
   */
  isSpeaking: boolean;
  showcaseOwnsLowerFace: boolean;
  /** Filled by the engine factory from the real mesh after the write. */
  glb: {
    faceMeshResolved: boolean;
    teethMeshResolved: boolean;
    writtenMorphCount: number;
    jawOpenInfluence: number;
    teethJawOpenInfluence: number;
    mouthMaxInfluence: number;
    mouthMaxMorphName: string | null;
    channels: Record<string, number>;
  };
  /** Filled by the engine factory when the canvas size changes. DEV only. */
  viewport: Hyper3dViewportFacts | null;
};

/** Canvas, camera and projected avatar scale. Measured, never used to render. */
export type Hyper3dViewportFacts = {
  measuredAtMs: number;
  canvasCssWidth: number;
  canvasCssHeight: number;
  canvasBackingWidth: number;
  canvasBackingHeight: number;
  devicePixelRatio: number;
  rendererPixelRatio: number | null;
  cameraFov: number;
  cameraPosition: [number, number, number];
  avatarRootScale: [number, number, number];
  /** Rest-geometry bounding box of the `blendshapes` mesh (whole head), projected. */
  headBoxCssWidth: number | null;
  headBoxCssHeight: number | null;
  /** Rest-geometry box of vertices `jawOpen` moves (>10% of its max travel), projected. */
  jawRegionCssWidth: number | null;
  jawRegionCssHeight: number | null;
  /** Screen travel of the vertex `jawOpen` moves most, at influence 1.0. */
  jawOpenMaxVertexCssPxAtFullInfluence: number | null;
  jawOpenMaxTravelWorldMeters: number | null;
  note: string;
};

const createMouthStage = (): Hyper3dMouthStage => ({ jawOpen: 0, mouthMax: 0, channels: {} });

export function createHyper3dMouthTrace(): Hyper3dMouthTrace {
  return {
    timeSeconds: 0,
    deltaSeconds: 0,
    viewport: null,
    controllerEvaluated: false,
    controllerSpeechActive: false,
    currentPhoneme: null,
    preOwnership: createMouthStage(),
    afterFaceOwnership: createMouthStage(),
    afterAffect: createMouthStage(),
    afterPresence: createMouthStage(),
    final: createMouthStage(),
    presenceOwned: false,
    showcaseEligible: false,
    showcaseActive: false,
    showcaseYieldReason: null,
    isSpeaking: false,
    showcaseOwnsLowerFace: false,
    glb: {
      faceMeshResolved: false,
      teethMeshResolved: false,
      writtenMorphCount: 0,
      jawOpenInfluence: 0,
      teethJawOpenInfluence: 0,
      mouthMaxInfluence: 0,
      mouthMaxMorphName: null,
      channels: {},
    },
  };
}

function traceMouthStage(stage: Hyper3dMouthStage, pose: BlendshapePose) {
  let max = 0;
  for (const name of HYPER3D_SPEECH_MOUTH_CHANNELS) {
    const value = pose[name] ?? 0;
    stage.channels[name] = value;
    if (value > max) max = value;
  }
  stage.jawOpen = pose.jawOpen ?? 0;
  stage.mouthMax = max;
}

export type Hyper3dResolvedFrame = {
  pose: BlendshapePose;
  headMotion: HeadMotionPose;
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  /** True when the threejs layer owned gaze/blink/brows this frame. */
  facePoseOwned: boolean;
  /** True when Active Presence took ownership this frame. */
  presenceOwned: boolean;
  /** DEV-only, bounded downstream by the live adapter's sampled ring buffer. */
  review?: Hyper3dFrameReview;
};

export const HYPER3D_LOWER_FACE_REVIEW_CHANNELS = [
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthPressLeft",
  "mouthPressRight",
  "browInnerUp",
  "browDownLeft",
  "browDownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyeSquintLeft",
  "eyeSquintRight",
] as const;

export type Hyper3dFrameReview = {
  currentPhoneme: string | null;
  previousPhoneme: string | null;
  nextPhoneme: string | null;
  articulation: BlendshapePose;
  afterFaceOwnership: BlendshapePose;
  afterAffect: BlendshapePose;
  afterPresence: BlendshapePose;
  lowerFaceIntent: {
    bilabialClosure: number;
    bilabialShare: number;
    closureEnvelope: number;
  };
  expression: {
    speechActive: boolean;
    affect: string | null;
    intensity: number;
    affectScale: number;
    speechFade: number;
    affectEnvelope: number;
    smileMouth: number;
    browEngagement: number;
    eyeAffect: number;
    cheekResponse: number;
  };
};

const DEV = import.meta.env.DEV === true;

function reviewPose(pose: BlendshapePose): BlendshapePose {
  const selected: BlendshapePose = {};
  for (const name of HYPER3D_LOWER_FACE_REVIEW_CHANNELS) {
    selected[name] = pose[name] ?? 0;
  }
  return selected;
}

export function resolveHyper3dFrame(
  pieces: Hyper3dRuntimePieces,
  input: Hyper3dFrameInput,
): Hyper3dResolvedFrame {
  const { config, controller, performance, activePresence, warmthYield } = pieces;
  const t = input.timeSeconds;
  const delta = input.deltaSeconds;
  const captureReview = DEV && input.captureReview === true;
  const mouthTrace = DEV ? input.mouthTrace : undefined;

  // 1. the accepted evaluate, with the exact production option set.
  const frame = controller.evaluate(t, delta, {
    modelId: config.id,
    headSupported: pieces.headSupported,
    playbackActive: input.isSpeaking || t > 0,
    debugPose: {},
    debugCue: undefined,
    calibrationEnabled: true,
    phonemeTuningOverrides: {},
    speakingHeadMotionEnabled: true,
    transformDiagnostic: defaultHeadNeckDiagnosticSettings,
    naturalSpeakingMotionPreset: "accepted",
    speakingMotionProfile: HYPER3D_PRODUCTION_SPEAKING.speakingMotionProfile,
    conductorTuning: HYPER3D_PRODUCTION_SPEAKING.conductorTuning,
    ...("speechPerformancePlan" in input
      ? {
          livePerformancePlan: input.speechPerformancePlan ?? null,
          livePerformanceClock: input.performanceClock ?? t,
        }
      : null),
    motorTuning: HYPER3D_PRODUCTION_SPEAKING.motorTuning,
    // Hard-gated for this model — hardware rejected the carrier as a generator.
    talkingHeadTuning: HYPER3D_PRODUCTION_SPEAKING.talkingHeadTuning,
    idleExpressionSettings: {
      ...defaultIdleExpressionSettings,
      safetyScale: 1,
      idlePresence: null,
      performance: null,
      speakingIdleFloor: HYPER3D_PRODUCTION_SPEAKING.speakingIdleFloor,
      idleEngagement: null,
    },
    nativeVisemeDebugActive: false,
    audioPlaying: input.isSpeaking,
    paused: false,
  });

  // 2. model transform — for this asset, the Hyper3D calibration.
  const transformed = transformPoseForAvatarModel(
    config,
    frame.outputPose,
    frame.debug.currentPhoneme,
    defaultFemaleVisemeTestState,
    undefined,
  );
  let pose: BlendshapePose = transformed.pose;
  const articulationReview = captureReview ? reviewPose(pose) : undefined;
  if (mouthTrace) {
    mouthTrace.timeSeconds = t;
    mouthTrace.deltaSeconds = delta;
    mouthTrace.controllerEvaluated = true;
    mouthTrace.currentPhoneme = frame.debug.currentPhoneme ?? null;
    mouthTrace.controllerSpeechActive =
      Boolean(frame.debug.currentPhoneme) || (frame.debug.speechEnvelope?.speechActivity ?? 0) > 0.03;
    traceMouthStage(mouthTrace.preOwnership, pose);
  }

  // 3. lower-face prototype is female-only and ships "morph-only": a
  //    pass-through here, which is why no jaw value is touched.

  // 4. THE ONE HEAD OWNER, and the source of gaze/blink/brows and the affect frame.
  const resolved = resolveThreejsTalkingAvatarHead(performance, {
    incoming: frame.headMotion,
    plan: input.plan,
    enabled: true,
    clock: input.headClock ?? t,
    deltaSeconds: delta,
    speechActive: input.isSpeaking,
    motionScale: HYPER3D_PRODUCTION_HEAD_MOTION_SCALE,
    acousticFrameCount: input.acousticFrames.length,
    stressAvailable: false,
  });

  // 5. OWNERSHIP SEAM FIRST (`AvatarModel.tsx:1366-1406`). Gaze fallback when
  //    nothing was planned, otherwise delete-then-write for the regions the
  //    accepted layer owns.
  //
  //    ORDER IS LOAD-BEARING, and getting it backwards is a real defect the
  //    equivalence harness caught: the seam DELETES the brow channels, so an
  //    affect pass that ran before it had its entire brow contribution thrown
  //    away (`browMax` measured 0.0000 against an accepted 0.0989). Affect runs
  //    after, and MAXes on top of what the seam wrote.
  const facePose = resolved.facePose;
  if (!facePose) {
    const gaze = hyper3dGazePose(frame.gazeYawDegrees ?? 0, frame.gazePitchDegrees ?? 0);
    const names = Object.keys(gaze);
    if (names.length) {
      const withGaze: BlendshapePose = { ...pose };
      for (const name of names) withGaze[name] = Math.max(withGaze[name] ?? 0, gaze[name]);
      pose = withGaze;
    }
  } else {
    const owned: BlendshapePose = { ...pose };
    for (const name of THREEJS_TALKING_AVATAR_GAZE_CHANNELS) delete owned[name];
    for (const name of THREEJS_TALKING_AVATAR_BLINK_CHANNELS) delete owned[name];
    for (const name of THREEJS_TALKING_AVATAR_BROW_CHANNELS) delete owned[name];
    for (const [name, value] of Object.entries(facePose)) owned[name] = value;
    pose = owned;
  }
  const faceOwnershipReview = captureReview ? reviewPose(pose) : undefined;
  if (mouthTrace) traceMouthStage(mouthTrace.afterFaceOwnership, pose);

  // 6. FACIAL LIVELINESS (`AvatarModel.tsx:1421-1487`) — semantic affect,
  //    MAX-merged so an articulation demand on the same channel is never
  //    reduced. The yield is FOLLOWED, not sampled, because the bilabial seal
  //    releases within one frame.
  //
  //    Jaw is deliberately untouched here: the open-vowel jaw experiment was
  //    hardware-rejected, and no code in the accepted block names `jawOpen`.
  const affectFrame = resolved.frame;
  if (affectFrame) {
    const lively: BlendshapePose = { ...pose };
    const followedYield = warmthYield.step(
      affectArticulationYield(frame.lowerFaceIntent.bilabialClosure, lively),
      delta,
    );
    const affect = hyper3dAffectPose(
      affectFrame,
      frame.lowerFaceIntent.bilabialClosure,
      lively,
      undefined,
      followedYield,
    );
    for (const [name, value] of Object.entries(affect)) {
      lively[name] = Math.max(lively[name] ?? 0, value);
    }
    pose = lively;
  }
  const affectReview = captureReview ? reviewPose(pose) : undefined;
  if (mouthTrace) traceMouthStage(mouthTrace.afterAffect, pose);

  let headMotion = resolved.headMotion;

  // 7. ACTIVE PRESENCE — the idle owner. Replacement, and total: while speaking
  //    it hands the speaking values straight back.
  const presence = activePresence.sample({
    state: input.isSpeaking ? "speaking" : "idle",
    deltaSeconds: delta,
    enabled: true,
    speaking: {
      head: headMotion.head,
      neck: headMotion.neck,
      gazeYawDegrees: resolved.telemetry?.gazeYawDegrees ?? frame.gazeYawDegrees ?? 0,
      gazePitchDegrees: resolved.telemetry?.gazePitchDegrees ?? frame.gazePitchDegrees ?? 0,
      blinkLeft: pose.eyeBlinkLeft ?? 0,
      blinkRight: pose.eyeBlinkRight ?? 0,
      facePose: readPresenceHandoffPose(pose),
    },
  });

  let presenceOwned = false;
  if (presence?.owns) {
    presenceOwned = true;
    headMotion = {
      ...headMotion,
      active: true,
      head: presence.head,
      neck: presence.neck,
      owner: ACTIVE_PRESENCE_OWNER,
    };
    const owned: BlendshapePose = { ...pose };
    for (const name of THREEJS_TALKING_AVATAR_GAZE_CHANNELS) delete owned[name];
    for (const name of THREEJS_TALKING_AVATAR_BLINK_CHANNELS) delete owned[name];
    for (const name of ACTIVE_PRESENCE_FACE_CHANNELS) delete owned[name];
    for (const [name, value] of Object.entries(presence.facePose)) owned[name] = value;
    pose = owned;
  }

  const showcaseYieldReason: Hyper3dIdleShowcaseYieldReason | null = input.isSpeaking
    ? "speaking"
    : input.isListening === true
      ? "listening"
      : input.isThinking === true
        ? "thinking"
        : input.isProcessing === true
          ? "processing"
          : input.isInterrupted === true
            ? "interrupted"
            : input.isAudioActive === true
              ? "audio_active"
              : null;
  const showcaseSample = pieces.idleShowcase?.sample({
    eligible: showcaseYieldReason === null,
    elapsedSeconds: input.elapsedSeconds ?? t,
    yieldReason: showcaseYieldReason,
  });
  if (mouthTrace) {
    traceMouthStage(mouthTrace.afterPresence, pose);
    mouthTrace.presenceOwned = presenceOwned;
    mouthTrace.showcaseEligible = showcaseYieldReason === null;
    mouthTrace.showcaseActive = showcaseSample?.active === true;
    mouthTrace.showcaseYieldReason = showcaseYieldReason;
    mouthTrace.isSpeaking = input.isSpeaking === true;
  }
  if (showcaseSample) {
    pose = applyHyper3dIdleShowcasePose(pose, showcaseSample);
    publishHyper3dIdleShowcaseDiagnostics(showcaseSample.diagnostics);
  }

  /**
   * DEV EYELASH REVIEW — last, and deliberately so.
   *
   * It pins the FINAL eye channels, after Active Presence and the showcase, so
   * the reviewer sees the value that actually reaches `morph.write` rather than
   * one some later layer will still max-merge over. It touches the fourteen eye
   * channels and nothing else, so head motion, speech and warmth keep running
   * underneath — which is exactly what makes the "does Object_2002 follow
   * Head_M" check possible while an eye state stands still.
   *
   * In production `hyper3dEyelashTestAvailable` is false (it is behind
   * `import.meta.env.DEV`), the condition short-circuits on a boolean, and the
   * pose object is neither copied nor touched.
   */
  if (hyper3dEyelashTestAvailable) {
    const testState = getHyper3dEyelashTestState();
    if (testState !== "runtime") {
      pose = applyHyper3dEyelashTestPose(pose, testState, getHyper3dEyelashTestIntensity());
    }
  }
  if (mouthTrace) {
    const trace = mouthTrace;
    traceMouthStage(trace.final, pose);
    // B3, measured rather than inferred: an active showcase deletes its owned
    // set (which includes jawOpen and the mouth channels) before writing its own
    // pose, so a lower-face channel that DIFFERS across that one step is the
    // direct evidence that the showcase took the lower face on this frame.
    trace.showcaseOwnsLowerFace =
      trace.showcaseActive &&
      HYPER3D_SPEECH_MOUTH_CHANNELS.some(
        (name) => (trace.afterPresence.channels[name] ?? 0) !== (trace.final.channels[name] ?? 0),
      );
  }

  const review: Hyper3dFrameReview | undefined = captureReview
    ? {
        currentPhoneme: frame.debug.currentPhoneme ?? null,
        previousPhoneme: frame.debug.previousPhoneme ?? null,
        nextPhoneme: frame.debug.nextPhoneme ?? null,
        articulation: articulationReview!,
        afterFaceOwnership: faceOwnershipReview!,
        afterAffect: affectReview!,
        afterPresence: reviewPose(pose),
        lowerFaceIntent: { ...frame.lowerFaceIntent },
        expression: {
          speechActive: affectFrame?.speechActive ?? false,
          affect: affectFrame?.affect ?? null,
          intensity: resolved.telemetry?.affectIntensity ?? 0,
          affectScale: affectFrame?.affectScale ?? 0,
          speechFade: affectFrame?.speechFade ?? 0,
          affectEnvelope: affectFrame?.affectEnvelope ?? 0,
          smileMouth: affectFrame?.smileMouth ?? 0,
          browEngagement: affectFrame?.browEngagement ?? 0,
          eyeAffect: affectFrame?.eyeAffectScale ?? 0,
          cheekResponse: affectFrame?.cheekAffectScale ?? 0,
        },
      }
    : undefined;

  return {
    pose,
    headMotion,
    gazeYawDegrees: frame.gazeYawDegrees ?? 0,
    gazePitchDegrees: frame.gazePitchDegrees ?? 0,
    facePoseOwned: Boolean(facePose),
    presenceOwned,
    review,
  };
}

/** Verbatim from `AvatarModel.tsx:100`. Only channels Active Presence may own. */
export function readPresenceHandoffPose(pose: BlendshapePose): BlendshapePose {
  const handoff: BlendshapePose = {};
  for (const name of THREEJS_TALKING_AVATAR_GAZE_CHANNELS) {
    if (pose[name] !== undefined) handoff[name] = pose[name];
  }
  for (const name of ACTIVE_PRESENCE_FACE_CHANNELS) {
    if (pose[name] !== undefined) handoff[name] = pose[name];
  }
  return handoff;
}


