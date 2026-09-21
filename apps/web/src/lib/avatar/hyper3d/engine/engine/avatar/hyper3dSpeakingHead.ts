import type { HeadMotionPose, HeadRotationTarget } from "../../types/facialAnimation";
import { hyper3dHeadNeckCalibration } from "../../mappings/avatars/hyper3dCalibration";
import {
  HYPER3D_DIAGNOSTIC_GESTURE,
  HYPER3D_RIG_PROBES,
  type Hyper3dHeadReviewMode,
  type Hyper3dProminenceLevel,
  type Hyper3dRigProbeId
} from "../../mappings/avatars/hyper3dPerformanceProfile";
import { buildPerformancePlan, type PerformancePlan, type PerformancePlanInput, type ProminenceEvent } from "./hyper3dPerformancePlanner";
import { buildHeadTimeline, distributeToRig, resolveHeadFrame, type HeadFrame, type HeadState, type HeadTimeline } from "./hyper3dHeadPerformer";
import type { HeadPose } from "./hyper3dTrajectory";

/**
 * HYPER3D FINAL SPEAKING PERFORMANCE — the ownership seam.
 *
 * This is the ONLY function that produces a Hyper3D speaking head pose, and it
 * REPLACES the shared pipeline's head rather than adding to it. That is the
 * whole mechanism behind "exactly one final owner":
 *
 *   - whatever the TalkingHead carrier produced is discarded here
 *   - whatever the idle/presence layer produced for the HEAD is discarded here
 *     (idle still drives the FACE; only its head share is dropped)
 *   - the old standalone nod generator is not consulted at all
 *   - nothing is added AFTER this point — `AvatarModel` hands the result
 *     straight to `BoneController.apply`
 *
 * It is a pure function so a test can hand it a deliberately hostile incoming
 * pose — a large carrier rotation, a large idle rotation — and prove none of it
 * survives. That is a real proof of ownership rather than a grep for an import.
 *
 * TWO PATHS ARE DELIBERATELY PRESERVED, exactly as the brief requires:
 *
 *   - the head/neck transform DIAGNOSTIC, which must be able to command the
 *     bones directly, and
 *   - payload head CUES (`head_nod`, `head_tilt_*`, `look_*`), which are authored
 *     content rather than a competing procedural generator.
 *
 * Both pass through untouched. Every other Hyper3D speaking frame is ours.
 */

export const HYPER3D_HEAD_OWNER = "hyper3dSpeakingHead";

export interface Hyper3dHeadTelemetry {
  owner: string;
  mode: Hyper3dHeadReviewMode;
  state: HeadState;
  reason: string;
  phraseId: number;
  prominence: Hyper3dProminenceLevel;
  /** Degrees. */
  currentPose: HeadPose;
  destinationPose: HeadPose;
  angularVelocity: HeadPose;
  angularAcceleration: HeadPose;
  trajectoryStart: number;
  trajectoryEnd: number;
  capped: boolean;
  /** Degrees requested of each bone after the rig distribution. */
  headDegrees: HeadPose;
  neckDegrees: HeadPose;
  /**
   * STAGE 2.3 — degrees ACTUALLY on the bone, read back off the rig after the
   * write.
   *
   * The review reported a 2.40 deg gesture as invisible while the panel showed
   * 2.40, because every number above is what was REQUESTED. `currentPose` is the
   * planner's solved pose, `headDegrees`/`neckDegrees` are its rig shares, and
   * none of them had been through the output filter yet. These two are measured
   * on `Head_M` and `Neck_M` themselves, so a request that does not arrive is
   * visible in the panel instead of having to be inferred from hardware.
   *
   * Populated by `AvatarModel` from `BoneController`; `null` until the first
   * frame is written.
   */
  appliedHeadDegrees: HeadPose | null;
  appliedNeckDegrees: HeadPose | null;
  /**
   * STAGE 2.3 — the clock this frame was SAMPLED at, in seconds.
   *
   * The same value `AvatarModel` reads from the audio element, and the same
   * domain the MFA phoneme times and therefore the plan are in. Surfaced so the
   * live panel can show it next to the resolved segment: if the head is not
   * moving, the first question is whether the sampler is advancing at all.
   */
  clock: number;
  /** Segments in the timeline actually being sampled. 0 means no plan is loaded. */
  segmentCount: number;
  /** True when a plan exists for this payload and this review mode selected it. */
  timelineLoaded: boolean;
  gesture: HeadFrame["gesture"];
  /** True while the DIAGNOSTIC forced-gesture timeline is driving the head. */
  diagnosticGesture: boolean;
}

const DEG = Math.PI / 180;

/** The review timelines, built once per payload. Selecting a mode picks one. */
export interface Hyper3dHeadTimelines {
  phrase: HeadTimeline;
  phraseNods: HeadTimeline;
  /** DIAGNOSTIC ONLY. Never selected unless the diagnostic toggle is on. */
  diagnosticGesture: HeadTimeline;
}

/**
 * DIAGNOSTIC ONLY — the single forced prominence event.
 *
 * A real `ProminenceEvent`, in the same shape the detector emits, so the state
 * machine cannot tell it apart and runs its normal
 * `GESTURE -> SETTLE -> HOLD` path over it. Its features are all zero and its
 * basis is `none`, which is the truth: nothing was measured. Every field that a
 * human or a log will see says DIAGNOSTIC.
 */
export const forcedDiagnosticProminence = (plan: PerformancePlan): ProminenceEvent | null => {
  const { apexTimeSeconds, level, id, note } = HYPER3D_DIAGNOSTIC_GESTURE;
  const phrase = plan.phrases.find((p) => apexTimeSeconds >= p.start && apexTimeSeconds <= p.end);
  if (!phrase) return null;
  return {
    id,
    phraseId: phrase.id,
    unitIndex: -1,
    apexTime: apexTimeSeconds,
    phoneme: "DIAG",
    word: null,
    level,
    features: {
      energy: 0,
      duration: 0,
      phrasePosition: phrase.duration > 0 ? (apexTimeSeconds - phrase.start) / phrase.duration : 0,
      energyZ: 0,
      durationZ: 0,
      positionScore: 0,
      score: 0,
      normalizationBasis: "none",
      sampleCount: 0,
      maxAttainableScore: 0,
      f0Available: false
    },
    reason: `DIAGNOSTIC FORCED GESTURE @${apexTimeSeconds.toFixed(2)}s (${level}) — ${note}`
  };
};

/**
 * Builds the plan and the timelines. Deterministic and pure, so it can be
 * memoized on the payload and reused for every frame of that payload.
 *
 * The diagnostic timeline is built from the SAME plan with its prominence list
 * replaced by the single forced event — a derived plan object, not a change to
 * the planner, the state machine or the solver, all three of which run exactly
 * as they do in production.
 */
export const buildHyper3dHeadTimelines = (input: PerformancePlanInput): Hyper3dHeadTimelines | null => {
  if (!input.phonemes?.length) return null;
  const plan = buildPerformancePlan(input);
  if (!plan.phrases.length) return null;
  const forced = forcedDiagnosticProminence(plan);
  const diagnosticPlan: PerformancePlan = { ...plan, prominence: forced ? [forced] : [] };
  return {
    phrase: buildHeadTimeline(plan, { gestures: false }),
    phraseNods: buildHeadTimeline(plan, { gestures: true }),
    diagnosticGesture: buildHeadTimeline(diagnosticPlan, { gestures: true })
  };
};

const zeroRotation = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });

/**
 * Degrees to the bone's radians, through the per-asset calibration.
 *
 * The calibration ships at 1.0 on every axis — the axes were proven to match
 * before any amplitude was touched — so this is a pass-through today and the
 * single place to adjust if hardware says the motion reads too large or small,
 * without the planner or the state machine changing at all.
 */
const toBoneRadians = (pose: HeadPose, neck: boolean): HeadRotationTarget => {
  const k = hyper3dHeadNeckCalibration;
  const neckScale = neck ? k.neckScale : 1;
  return {
    pitch: pose.pitch * DEG * k.pitchScale * neckScale,
    yaw: pose.yaw * DEG * k.yawScale * neckScale,
    roll: pose.roll * DEG * k.rollScale * neckScale
  };
};

/**
 * The rig share of the trajectory's OWN velocity, in rad/s.
 *
 * The same distribution and the same single degrees-to-radians conversion as the
 * pose — differentiating a linear map is the map itself — so the feed-forward
 * can never disagree with the position it is meant to accompany.
 */
const toBoneRadiansPerSecond = (velocity: HeadPose, neck: boolean): HeadRotationTarget =>
  toBoneRadians(velocity, neck);

export interface Hyper3dSpeakingHeadInput {
  /** Whatever the shared pipeline produced for this frame. Discarded unless it is a preserved path. */
  incoming: HeadMotionPose;
  timelines: Hyper3dHeadTimelines | null;
  mode: Hyper3dHeadReviewMode;
  clock: number;
  /**
   * DIAGNOSTIC ONLY. Swaps the detected prominence for the single forced event
   * so hardware can judge the gesture trajectory on its own. Applies only in
   * `phraseNods`; production review of that mode uses real detection.
   */
  diagnosticGesture?: boolean;
  /**
   * STAGE 2.3 TEMPORARY RIG-OUTPUT REVIEW. A fixed bone command sent down the
   * same final path as a speaking frame. Overrides the timeline while set, and
   * is `null`/absent in every production frame.
   */
  rigProbe?: Hyper3dRigProbeId | null;
}

export interface Hyper3dSpeakingHeadResult {
  headMotion: HeadMotionPose;
  telemetry: Hyper3dHeadTelemetry | null;
}

export const resolveHyper3dSpeakingHead = (input: Hyper3dSpeakingHeadInput): Hyper3dSpeakingHeadResult => {
  const { incoming, timelines, mode, clock } = input;
  const diagnostic = Boolean(input.diagnosticGesture) && mode === "phraseNods";

  // Preserved paths: the transform diagnostic and authored payload cues.
  if (incoming.diagnosticActive) {
    return { headMotion: { ...incoming, owner: "headNeckTransformDiagnostic" }, telemetry: null };
  }
  if (incoming.manualActive) {
    return { headMotion: { ...incoming, owner: "payloadHeadCue" }, telemetry: null };
  }

  /**
   * STAGE 2.3 TEMPORARY RIG-OUTPUT REVIEW.
   *
   * Deliberately placed AFTER the two preserved paths and BEFORE the timeline,
   * so the probe uses the identical downstream application — same conversion,
   * same `jerkLimited` follower, same `BoneController` quaternion composition —
   * and differs from a speaking frame only in where the degrees came from. That
   * is what makes it evidence about the rig rather than about itself.
   */
  const probe = input.rigProbe ? HYPER3D_RIG_PROBES[input.rigProbe] : null;
  if (probe) {
    const head: HeadPose = { ...probe.head };
    const neck: HeadPose = { ...probe.neck };
    return {
      headMotion: {
        ...incoming,
        active: true,
        manualActive: false,
        head: toBoneRadians(head, false),
        neck: toBoneRadians(neck, true),
        jerkLimited: true,
        owner: `${HYPER3D_HEAD_OWNER}:rigProbe`
      },
      telemetry: {
        owner: `${HYPER3D_HEAD_OWNER}:rigProbe`,
        mode,
        state: "HOLD",
        reason: `DIAGNOSTIC RIG PROBE — ${probe.label}. Fixed bone command through the production rig path; the planner, the state machine and the trajectory solver are not involved.`,
        phraseId: -1,
        prominence: "NONE",
        currentPose: { yaw: head.yaw + neck.yaw, pitch: head.pitch + neck.pitch, roll: head.roll + neck.roll },
        destinationPose: { yaw: head.yaw + neck.yaw, pitch: head.pitch + neck.pitch, roll: head.roll + neck.roll },
        angularVelocity: { yaw: 0, pitch: 0, roll: 0 },
        angularAcceleration: { yaw: 0, pitch: 0, roll: 0 },
        trajectoryStart: clock,
        trajectoryEnd: clock,
        capped: false,
        headDegrees: head,
        neckDegrees: neck,
        appliedHeadDegrees: null,
        appliedNeckDegrees: null,
        clock,
        segmentCount: 0,
        timelineLoaded: false,
        gesture: null,
        diagnosticGesture: false
      }
    };
  }

  const timeline =
    mode === "phrase"
      ? timelines?.phrase
      : mode === "phraseNods"
        ? diagnostic
          ? timelines?.diagnosticGesture
          : timelines?.phraseNods
        : null;

  if (!timeline) {
    /**
     * STAGE 2.3. This branch used to return `telemetry: null` for everything
     * except HEAD OFF, so a missing plan — no phonemes, or a payload that
     * segmented into no phrases — reached the review panel as "not running" with
     * no way to tell it apart from the panel simply not being wired up. It now
     * always reports, and says which of the two it is.
     */
    const noPlan = mode !== "off";
    return {
      headMotion: {
        ...incoming,
        active: false,
        head: zeroRotation(),
        neck: zeroRotation(),
        jerkLimited: true,
        owner: `${HYPER3D_HEAD_OWNER}:off`
      },
      telemetry:
        {
              owner: `${HYPER3D_HEAD_OWNER}:off`,
              mode,
              state: "HOLD",
              reason: noPlan
                ? `NO PLAN — review mode is ${mode} but no head timeline is loaded for this payload. The payload has no MFA phonemes, or they segmented into no phrases, so there is nothing to sample.`
                : "HEAD OFF — review mode holds the bones at rest",
              phraseId: -1,
              prominence: "NONE",
              currentPose: { yaw: 0, pitch: 0, roll: 0 },
              destinationPose: { yaw: 0, pitch: 0, roll: 0 },
              angularVelocity: { yaw: 0, pitch: 0, roll: 0 },
              angularAcceleration: { yaw: 0, pitch: 0, roll: 0 },
              trajectoryStart: clock,
              trajectoryEnd: clock,
              capped: false,
              headDegrees: { yaw: 0, pitch: 0, roll: 0 },
              neckDegrees: { yaw: 0, pitch: 0, roll: 0 },
              appliedHeadDegrees: null,
              appliedNeckDegrees: null,
              clock,
              segmentCount: 0,
              timelineLoaded: false,
              gesture: null,
              diagnosticGesture: false
            }
    };
  }

  const frame = resolveHeadFrame(timeline, clock);
  /**
   * The trajectory's OWN velocity, distributed across the rig exactly as the
   * pose is, and fed forward into the bone follower.
   *
   * Without it the critically damped follower tracked this trajectory 167 ms
   * late and delivered the forced 2.40 deg gesture to the bone as 1.03 deg at
   * the apex — the measured cause of "the gesture is not clearly visible". The
   * follower is unchanged and still bounds jerk; it is simply told what the
   * target is doing instead of having to infer it from position error.
   */
  const rigVelocity = distributeToRig(frame.angularVelocity);
  const rigAcceleration = distributeToRig(frame.angularAcceleration);

  return {
    headMotion: {
      ...incoming,
      active: true,
      manualActive: false,
      head: toBoneRadians(frame.rig.head, false),
      neck: toBoneRadians(frame.rig.neck, true),
      headVelocity: toBoneRadiansPerSecond(rigVelocity.head, false),
      neckVelocity: toBoneRadiansPerSecond(rigVelocity.neck, true),
      headAcceleration: toBoneRadiansPerSecond(rigAcceleration.head, false),
      neckAcceleration: toBoneRadiansPerSecond(rigAcceleration.neck, true),
      // The composed pose goes through the existing third-order follower, which
      // bounds jerk at the bone without changing the trajectory's shape.
      jerkLimited: true,
      owner: HYPER3D_HEAD_OWNER
    },
    telemetry: {
      owner: HYPER3D_HEAD_OWNER,
      mode,
      state: frame.state,
      reason: frame.reason,
      phraseId: frame.phraseId,
      prominence: frame.prominence,
      currentPose: frame.currentPose,
      destinationPose: frame.destinationPose,
      angularVelocity: frame.angularVelocity,
      angularAcceleration: frame.angularAcceleration,
      trajectoryStart: frame.trajectoryStart,
      trajectoryEnd: frame.trajectoryEnd,
      capped: frame.capped,
      headDegrees: frame.rig.head,
      neckDegrees: frame.rig.neck,
      appliedHeadDegrees: null,
      appliedNeckDegrees: null,
      clock,
      segmentCount: timeline.segments.length,
      timelineLoaded: true,
      gesture: frame.gesture,
      diagnosticGesture: diagnostic
    }
  };
};
