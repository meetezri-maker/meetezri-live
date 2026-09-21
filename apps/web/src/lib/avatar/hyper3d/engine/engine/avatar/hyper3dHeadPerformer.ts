import {
  HYPER3D_DEADBAND,
  HYPER3D_GESTURE_STRENGTH,
  HYPER3D_GESTURE_TIMING,
  HYPER3D_MOTION_PROFILE,
  HYPER3D_NOD_PROFILE,
  HYPER3D_PHRASE_TIMING,
  HYPER3D_RIG_PROFILE,
  expressionCharacter,
  type Hyper3dProminenceLevel
} from "../../mappings/avatars/hyper3dPerformanceProfile";
import type { PerformancePlan, PhraseSegment } from "./hyper3dPerformancePlanner";
import {
  clonePose,
  neutralPose,
  sampleTrajectory,
  type HeadPose,
  type Trajectory
} from "./hyper3dTrajectory";

/**
 * HYPER3D FINAL SPEAKING PERFORMANCE — the ONE head/neck motion owner.
 *
 *   PERFORMANCE PLANNER -> [ EVENT-DRIVEN STATE MACHINE -> TRAJECTORY SOLVER ] -> RIG DISTRIBUTION
 *                                        this file
 *
 * Everything the Hyper3D speaking head does is decided here and nowhere else.
 * No other layer adds to its output: the TalkingHead carrier, the standalone nod
 * generator and the idle/presence head are all off the Hyper3D speaking path,
 * and `hyper3dSpeakingHead.ts` REPLACES rather than blends, so there is no
 * additive term left for anything to sneak into.
 *
 * WHY THE TIMELINE IS RESOLVED UP FRONT
 *
 * A per-frame state machine ticked with the renderer's variable delta is
 * frame-rate dependent by construction: the same clip resolves differently at
 * 60 fps and at 144 fps, scrubbing produces a pose that depends on how you got
 * there, and "the same MFA input produces an identical head timeline" becomes
 * something you hope for rather than something you can test.
 *
 * So the state machine runs ONCE, at payload load, over the planner's events,
 * and emits an ordered, non-overlapping list of trajectory segments. Sampling is
 * then a pure function of the clock. Determinism, scrub-safety and the review
 * requirement all fall out of that one decision, and the state machine still
 * runs exactly as specified — HOLD/MOVE/GESTURE/SETTLE, one event at a time,
 * each trajectory seeded from the pose the previous one actually ended on.
 *
 * "Every new trajectory starts from the actual current resolved pose" is
 * structurally true here: `pose` below is only ever advanced by a committed
 * segment's endpoint, and there is no second writer that could move the head
 * behind the state machine's back.
 */

export type HeadState = "HOLD" | "MOVE" | "GESTURE" | "SETTLE";

export type HeadSegmentKind =
  | "move"
  | "move-settle"
  | "gesture-down"
  | "gesture-return"
  | "gesture-settle"
  | "release"
  | "release-settle";

export interface HeadSegment {
  index: number;
  state: HeadState;
  kind: HeadSegmentKind;
  t0: number;
  duration: number;
  /** Pose at the START of this segment's window. Derived from `span`. */
  from: HeadPose;
  /** Pose at the END of this segment's window. Derived from `span`. */
  to: HeadPose;
  /**
   * STAGE 2.3 — the CONTINUOUS trajectory this segment is a WINDOW onto.
   *
   * A MOVE and the SETTLE that follows it are two windows onto ONE span, and so
   * are a gesture return and its settle. This is the whole of the fix for the
   * bounce hardware reported after the forced gesture.
   *
   * Before, each was its own quintic. The quintic is zero-velocity at BOTH
   * endpoints by construction, so splitting one travel across two of them forced
   * the head to decelerate to a complete stop at the interior waypoint and then
   * accelerate again to cover the last tenth. Measured on test-005: the gesture
   * return reached 0.827 deg at -0.000 deg/s at 4.380 s, then re-accelerated to
   * -2.73 deg/s to reach 0.652 deg. That dead stop followed by a second, smaller
   * move IS the "returns to an intermediate pose and then makes another
   * correction" the review saw, and the same shape appeared at every
   * MOVE -> SETTLE join, which is where the phrase-boundary hitch came from.
   *
   * Sampling the shared span instead makes position, velocity AND acceleration
   * continuous across the join while changing nothing else: the state machine
   * still emits MOVE then SETTLE, the boundaries and durations are identical,
   * and there is still exactly ONE trajectory solver. `from`/`to` remain the
   * window's own endpoints, so anything reading them still sees where this
   * segment starts and ends.
   */
  span: Trajectory;
  phraseId: number;
  prominence: Hyper3dProminenceLevel;
  gestureId: string | null;
  reason: string;
}

/** Every event the state machine considered, and what it did about it. */
export interface HeadDecision {
  time: number;
  phraseId: number;
  event: "phrase" | "prominence" | "release";
  accepted: boolean;
  outcome: "MOVE" | "GESTURE" | "HOLD" | "RELEASE";
  reason: string;
}

export interface HeadTimeline {
  segments: HeadSegment[];
  decisions: HeadDecision[];
  plan: PerformancePlan;
  gesturesEnabled: boolean;
  /** Where the head releases toward rest. */
  releaseTime: number;
}

const HARD_CAPS = {
  yaw: HYPER3D_MOTION_PROFILE.hardYawCap,
  pitch: HYPER3D_MOTION_PROFILE.hardPitchCap,
  roll: HYPER3D_MOTION_PROFILE.hardRollCap
} as const;

const bound = (v: number, max: number) => (v > max ? max : v < -max ? -max : v);

/**
 * §15 RUNTIME SAFETY — the hard caps.
 *
 * Applied twice on purpose: once when the state machine constructs a target, so
 * no trajectory is ever built that would need clamping mid-flight (clamping a
 * live trajectory is what turns a cap into a visible flat spot), and once again
 * on the resolved pose immediately before the rig distribution, as the guarantee
 * that nothing at all reaches the bone outside these bounds.
 */
export const applyHardCaps = (pose: HeadPose): HeadPose => ({
  yaw: bound(pose.yaw, HARD_CAPS.yaw),
  pitch: bound(pose.pitch, HARD_CAPS.pitch),
  roll: bound(pose.roll, HARD_CAPS.roll)
});

const withinDeadband = (from: HeadPose, to: HeadPose) =>
  Math.abs(to.yaw - from.yaw) < HYPER3D_DEADBAND.yaw &&
  Math.abs(to.pitch - from.pitch) < HYPER3D_DEADBAND.pitch &&
  Math.abs(to.roll - from.roll) < HYPER3D_DEADBAND.roll;

const travelMagnitude = (from: HeadPose, to: HeadPose) =>
  Math.hypot(to.yaw - from.yaw, to.pitch - from.pitch, to.roll - from.roll);

const mix = (min: number, max: number, f: number) => min + (max - min) * (f < 0 ? 0 : f > 1 ? 1 : f);

/**
 * Move and settle durations scale with how far the head is actually travelling,
 * so a small correction is quick and a real turn takes its time. Content-driven
 * rather than hashed: the same travel always takes the same time.
 */
const moveDurations = (from: HeadPose, to: HeadPose) => {
  const reference = Math.hypot(
    HYPER3D_MOTION_PROFILE.normalYawMax * 2,
    HYPER3D_MOTION_PROFILE.normalPitchMax * 2,
    HYPER3D_MOTION_PROFILE.normalRollMax * 2
  );
  const f = travelMagnitude(from, to) / reference;
  return {
    move: mix(HYPER3D_PHRASE_TIMING.moveMinSeconds, HYPER3D_PHRASE_TIMING.moveMaxSeconds, f),
    settle: mix(HYPER3D_PHRASE_TIMING.settleMinSeconds, HYPER3D_PHRASE_TIMING.settleMaxSeconds, f)
  };
};

const gestureDurations = (nodDegrees: number) => {
  const span = HYPER3D_NOD_PROFILE.strong - HYPER3D_NOD_PROFILE.micro;
  const f = span > 0 ? (Math.abs(nodDegrees) - HYPER3D_NOD_PROFILE.micro) / span : 0;
  return {
    down: mix(HYPER3D_GESTURE_TIMING.downMinSeconds, HYPER3D_GESTURE_TIMING.downMaxSeconds, f),
    back: mix(HYPER3D_GESTURE_TIMING.returnMinSeconds, HYPER3D_GESTURE_TIMING.returnMaxSeconds, f),
    settle: HYPER3D_GESTURE_TIMING.settleSeconds
  };
};

interface ScheduledEvent {
  time: number;
  order: number;
  kind: "phrase" | "prominence";
  phrase: PhraseSegment;
  prominenceLevel: Hyper3dProminenceLevel;
  prominenceId: string;
  prominenceReason: string;
}

/**
 * Runs the state machine over the plan and emits the resolved timeline.
 *
 * Legal flow, enforced by construction — there is no path through this function
 * that emits any other order:
 *
 *   HOLD -> MOVE    -> SETTLE -> HOLD
 *   HOLD -> GESTURE -> SETTLE -> HOLD
 *
 * A gesture occupies the head from its downstroke through its settle, and
 * `cursor` is not released until that settle ends. Any prominence event that
 * would begin inside that window is rejected outright with its reason recorded,
 * which is what "a new gesture must not hard-interrupt an active gesture" means
 * in a resolved timeline: the interruption cannot be expressed.
 */
export const buildHeadTimeline = (plan: PerformancePlan, options: { gestures: boolean }): HeadTimeline => {
  const segments: HeadSegment[] = [];
  const decisions: HeadDecision[] = [];
  const character = expressionCharacter(plan.expression);

  let pose = neutralPose();
  /** The pose the head is currently PLANNED to hold — a gesture returns to this. */
  let plannedPose = neutralPose();
  /** End of the last committed segment. Nothing may start before it. */
  let cursor = Number.NEGATIVE_INFINITY;
  let lastGestureSettleEnd = Number.NEGATIVE_INFINITY;

  const releaseTime = plan.phrases.length
    ? plan.phrases[plan.phrases.length - 1].end + HYPER3D_PHRASE_TIMING.tailHoldSeconds
    : 0;

  const push = (segment: Omit<HeadSegment, "index">) => {
    segments.push({ ...segment, index: segments.length });
  };

  type WindowMeta = Pick<HeadSegment, "state" | "kind" | "phraseId" | "prominence" | "gestureId" | "reason">;

  /**
   * Emits a travel and its settle as TWO WINDOWS ONTO ONE TRAJECTORY.
   *
   * `firstDuration` is where the state changes, not where the motion restarts.
   * The interior pose is SAMPLED from the shared span rather than lerped to a
   * separate waypoint, so there is no second destination and no interior stop —
   * see the `span` field on `HeadSegment`.
   */
  const pushPair = (span: Trajectory, firstDuration: number, first: WindowMeta, second: WindowMeta) => {
    const mid = sampleTrajectory(span, span.t0 + firstDuration).pose;
    push({ ...first, t0: span.t0, duration: firstDuration, from: clonePose(span.from), to: clonePose(mid), span });
    push({
      ...second,
      t0: span.t0 + firstDuration,
      duration: span.duration - firstDuration,
      from: clonePose(mid),
      to: clonePose(span.to),
      span
    });
  };

  const schedule: ScheduledEvent[] = [];
  plan.phrases.forEach((phrase, i) => {
    schedule.push({
      time: phrase.start,
      order: i * 2,
      kind: "phrase",
      phrase,
      prominenceLevel: "NONE",
      prominenceId: "",
      prominenceReason: ""
    });
  });
  for (const event of plan.prominence) {
    if (event.level === "NONE") continue;
    const phrase = plan.phrases.find((p) => p.id === event.phraseId);
    if (!phrase) continue;
    schedule.push({
      time: event.apexTime,
      order: event.phraseId * 2 + 1,
      kind: "prominence",
      phrase,
      prominenceLevel: event.level,
      prominenceId: event.id,
      prominenceReason: event.reason
    });
  }
  schedule.sort((a, b) => a.time - b.time || a.order - b.order);

  /** Start of the next phrase after `time`, or the release, whichever comes first. */
  const nextBoundaryAfter = (time: number) => {
    const next = plan.phrases.find((p) => p.start > time + 1e-9);
    return next ? next.start : releaseTime;
  };

  for (const event of schedule) {
    if (event.kind === "phrase") {
      const target = applyHardCaps(event.phrase.targetPose);
      const startAt = Math.max(event.time, cursor);

      if (withinDeadband(pose, target)) {
        plannedPose = clonePose(pose);
        decisions.push({
          time: event.time,
          phraseId: event.phrase.id,
          event: "phrase",
          accepted: false,
          outcome: "HOLD",
          reason:
            `phrase ${event.phrase.id} target is inside the deadband ` +
            `(dyaw ${Math.abs(target.yaw - pose.yaw).toFixed(3)} < ${HYPER3D_DEADBAND.yaw}, ` +
            `dpitch ${Math.abs(target.pitch - pose.pitch).toFixed(3)} < ${HYPER3D_DEADBAND.pitch}, ` +
            `droll ${Math.abs(target.roll - pose.roll).toFixed(3)} < ${HYPER3D_DEADBAND.roll}) — staying in HOLD`
        });
        continue;
      }

      const { move, settle } = moveDurations(pose, target);
      pushPair(
        { t0: startAt, duration: move + settle, from: clonePose(pose), to: clonePose(target) },
        move,
        {
          state: "MOVE",
          kind: "move",
          phraseId: event.phrase.id,
          prominence: "NONE",
          gestureId: null,
          reason: `MOVE to phrase ${event.phrase.id} pose — ${event.phrase.poseReason}`
        },
        {
          state: "SETTLE",
          kind: "move-settle",
          phraseId: event.phrase.id,
          prominence: "NONE",
          gestureId: null,
          reason: `SETTLE onto phrase ${event.phrase.id} pose — the tail of the same trajectory, not a second move`
        }
      );
      pose = clonePose(target);
      plannedPose = clonePose(target);
      cursor = startAt + move + settle;
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "phrase",
        accepted: true,
        outcome: "MOVE",
        reason: `MOVE ${move.toFixed(3)}s + SETTLE ${settle.toFixed(3)}s to yaw ${target.yaw.toFixed(2)} pitch ${target.pitch.toFixed(2)} roll ${target.roll.toFixed(2)}`
      });
      continue;
    }

    // ---- prominence -------------------------------------------------------
    if (!options.gestures) {
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "prominence",
        accepted: false,
        outcome: "HOLD",
        reason: `${event.prominenceLevel} prominence ignored — review mode is PHRASE MOTION, gestures are off`
      });
      continue;
    }

    const requested = HYPER3D_GESTURE_STRENGTH[event.prominenceLevel] * character.gestureAmplitude;
    if (requested <= 1e-6) {
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "prominence",
        accepted: false,
        outcome: "HOLD",
        reason: `${event.prominenceLevel} prominence suppressed by the active expression (gesture amplitude ${character.gestureAmplitude})`
      });
      continue;
    }
    const nodDegrees = Math.min(requested, HYPER3D_NOD_PROFILE.hardCap);
    const { down, back, settle } = gestureDurations(nodDegrees);
    const downStart = event.time - down;
    const settleEnd = event.time + back + settle;

    if (downStart < cursor - 1e-9) {
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "prominence",
        accepted: false,
        outcome: "HOLD",
        reason: `${event.prominenceLevel} prominence dropped — its downstroke would start at ${downStart.toFixed(3)}s while motion is still active until ${cursor.toFixed(3)}s. An active gesture is never hard-interrupted.`
      });
      continue;
    }
    if (downStart < lastGestureSettleEnd + HYPER3D_GESTURE_TIMING.refractorySeconds - 1e-9) {
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "prominence",
        accepted: false,
        outcome: "HOLD",
        reason: `${event.prominenceLevel} prominence dropped — inside the ${HYPER3D_GESTURE_TIMING.refractorySeconds}s refractory period after the gesture that settled at ${lastGestureSettleEnd.toFixed(3)}s`
      });
      continue;
    }
    const boundary = nextBoundaryAfter(event.time);
    if (settleEnd > boundary + 1e-9) {
      decisions.push({
        time: event.time,
        phraseId: event.phrase.id,
        event: "prominence",
        accepted: false,
        outcome: "HOLD",
        reason: `${event.prominenceLevel} prominence dropped — it would still be settling at ${settleEnd.toFixed(3)}s, past the next phrase boundary at ${boundary.toFixed(3)}s. Phrase structure is the primary constraint.`
      });
      continue;
    }

    /**
     * The apex.
     *
     * Built from the pose the head is ACTUALLY holding, capped at construction so
     * a nod stacked on a phrase pose that already leans down cannot exceed the
     * pitch cap, and limited so the gesture's own travel never exceeds the nod
     * hard cap regardless of where it started.
     */
    const rawApexPitch = pose.pitch + nodDegrees;
    const cappedApex = applyHardCaps({ yaw: pose.yaw, pitch: rawApexPitch, roll: pose.roll });
    const travel = cappedApex.pitch - pose.pitch;
    const limitedTravel = Math.sign(travel) * Math.min(Math.abs(travel), HYPER3D_NOD_PROFILE.hardCap);
    const apexPose: HeadPose = { yaw: pose.yaw, pitch: pose.pitch + limitedTravel, roll: pose.roll };

    /**
     * The return target is the NEXT PLANNED POSE, not neutral. Neutral is used
     * only when neutral genuinely is what is planned — which, mid-utterance, it
     * never is.
     */
    const returnTarget = clonePose(plannedPose);

    /**
     * The downstroke is its own span, and must be: the apex is a genuine
     * direction reversal, so zero velocity there is correct rather than a defect.
     */
    push({
      state: "GESTURE",
      kind: "gesture-down",
      t0: downStart,
      duration: down,
      from: clonePose(pose),
      to: clonePose(apexPose),
      span: { t0: downStart, duration: down, from: clonePose(pose), to: clonePose(apexPose) },
      phraseId: event.phrase.id,
      prominence: event.prominenceLevel,
      gestureId: event.prominenceId,
      reason: `GESTURE downstroke ${limitedTravel.toFixed(2)} deg, landing on the apex at ${event.time.toFixed(3)}s — ${event.prominenceReason}`
    });
    /**
     * The return and its settle are ONE span onto the planned phrase pose. The
     * gesture therefore lands continuously on the pose the next phrase is
     * already holding, with no interior stop and no second correction.
     */
    pushPair(
      { t0: event.time, duration: back + settle, from: clonePose(apexPose), to: clonePose(returnTarget) },
      back,
      {
        state: "GESTURE",
        kind: "gesture-return",
        phraseId: event.phrase.id,
        prominence: event.prominenceLevel,
        gestureId: event.prominenceId,
        reason: `GESTURE return toward the planned phrase pose (pitch ${returnTarget.pitch.toFixed(2)}), not neutral`
      },
      {
        state: "SETTLE",
        kind: "gesture-settle",
        phraseId: event.phrase.id,
        prominence: event.prominenceLevel,
        gestureId: event.prominenceId,
        reason: `SETTLE onto the planned phrase pose — the tail of the return, not a second correction`
      }
    );

    pose = clonePose(returnTarget);
    cursor = settleEnd;
    lastGestureSettleEnd = settleEnd;
    decisions.push({
      time: event.time,
      phraseId: event.phrase.id,
      event: "prominence",
      accepted: true,
      outcome: "GESTURE",
      reason: `GESTURE accepted: ${event.prominenceLevel}, ${limitedTravel.toFixed(2)} deg, down ${down.toFixed(3)}s / return ${back.toFixed(3)}s / settle ${settle.toFixed(3)}s`
    });
  }

  // ---- release toward rest ------------------------------------------------
  if (plan.phrases.length) {
    const target = neutralPose();
    const startAt = Math.max(releaseTime, cursor);
    const lastPhraseId = plan.phrases[plan.phrases.length - 1].id;
    if (withinDeadband(pose, target)) {
      decisions.push({
        time: releaseTime,
        phraseId: lastPhraseId,
        event: "release",
        accepted: false,
        outcome: "HOLD",
        reason: "the head is already inside the deadband of rest — no release move is worth making"
      });
    } else {
      const { move, settle } = moveDurations(pose, target);
      pushPair(
        { t0: startAt, duration: move + settle, from: clonePose(pose), to: clonePose(target) },
        move,
        {
          state: "MOVE",
          kind: "release",
          phraseId: lastPhraseId,
          prominence: "NONE",
          gestureId: null,
          reason: "MOVE to rest — the utterance has ended, so rest genuinely is the next planned target"
        },
        {
          state: "SETTLE",
          kind: "release-settle",
          phraseId: lastPhraseId,
          prominence: "NONE",
          gestureId: null,
          reason: "SETTLE at rest — the tail of the same trajectory"
        }
      );
      decisions.push({
        time: releaseTime,
        phraseId: lastPhraseId,
        event: "release",
        accepted: true,
        outcome: "RELEASE",
        reason: `RELEASE to rest over ${move.toFixed(3)}s + ${settle.toFixed(3)}s`
      });
    }
  }

  decisions.sort((a, b) => a.time - b.time);
  return { segments, decisions, plan, gesturesEnabled: options.gestures, releaseTime };
};

// ---------------------------------------------------------------------------
// rig distribution
// ---------------------------------------------------------------------------

export interface RigDistribution {
  /** Degrees requested of the head bone. */
  head: HeadPose;
  /** Degrees requested of the neck bone. */
  neck: HeadPose;
}

/**
 * §11 — HYPER3D RIG DISTRIBUTION.
 *
 * The last thing that happens to a solved pose, after the hard caps and outside
 * the planner entirely. The planner never sees these ratios, which is what keeps
 * "how the rig is driven" from leaking into "what the performance is".
 *
 * The accepted axis and sign mapping is untouched: `hyper3dCalibration.ts` proved
 * every bone axis lands on its intended world axis with a positive sign, so
 * pitch/yaw/roll pass through with no remap and no flip.
 */
export const distributeToRig = (pose: HeadPose): RigDistribution => {
  const r = HYPER3D_RIG_PROFILE;
  return {
    head: { yaw: pose.yaw * r.yaw.head, pitch: pose.pitch * r.pitch.head, roll: pose.roll * r.roll.head },
    neck: { yaw: pose.yaw * r.yaw.neck, pitch: pose.pitch * r.pitch.neck, roll: pose.roll * r.roll.neck }
  };
};

// ---------------------------------------------------------------------------
// sampling
// ---------------------------------------------------------------------------

/** §14 — everything the review panel needs about one head motion frame. */
export interface HeadFrame {
  /** Planner output, exactly as specified in the brief. */
  phraseId: number;
  state: HeadState;
  targetPose: HeadPose;
  gesture: {
    type: Hyper3dProminenceLevel;
    strength: number;
    apexTime: number;
    endTime: number;
  } | null;
  reason: string;

  /** Instrumentation. */
  prominence: Hyper3dProminenceLevel;
  /** The resolved pose in degrees, after the hard caps. */
  currentPose: HeadPose;
  /** Where the active trajectory is going. Equal to `currentPose` while holding. */
  destinationPose: HeadPose;
  /** Degrees per second, per axis. */
  angularVelocity: HeadPose;
  /** Degrees per second squared, per axis. */
  angularAcceleration: HeadPose;
  trajectoryStart: number;
  trajectoryEnd: number;
  /** True when a cap actually clamped this frame. Should never be true in review. */
  capped: boolean;
  /** Head and neck shares in degrees. */
  rig: RigDistribution;
}

const zero = neutralPose;

const findSegment = (segments: HeadSegment[], t: number) => {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (t < s.t0) hi = mid - 1;
    else if (t >= s.t0 + s.duration) lo = mid + 1;
    else {
      found = mid;
      break;
    }
  }
  return found;
};

/** The last segment that has already finished at `t`, or -1. */
const previousSegment = (segments: HeadSegment[], t: number) => {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].t0 + segments[mid].duration <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

const capsWouldClamp = (pose: HeadPose) =>
  Math.abs(pose.yaw) > HARD_CAPS.yaw + 1e-9 ||
  Math.abs(pose.pitch) > HARD_CAPS.pitch + 1e-9 ||
  Math.abs(pose.roll) > HARD_CAPS.roll + 1e-9;

/**
 * Resolves one frame. Pure: the clock is the only input that varies, so
 * scrubbing, replaying and stepping all produce identical results.
 */
export const resolveHeadFrame = (timeline: HeadTimeline, t: number): HeadFrame => {
  const { segments } = timeline;
  const active = findSegment(segments, t);

  const phraseAt = timeline.plan.phrases.find((p) => t >= p.start && t <= p.end);
  /**
   * The most recent decision at or before `t`, found by walking backwards rather
   * than copying and reversing the list — this runs on every rendered frame.
   */
  let lastDecision: HeadDecision | null = null;
  for (let i = timeline.decisions.length - 1; i >= 0; i--) {
    if (timeline.decisions[i].time <= t) {
      lastDecision = timeline.decisions[i];
      break;
    }
  }

  let state: HeadState = "HOLD";
  let pose: HeadPose;
  let destination: HeadPose;
  let velocity = zero();
  let acceleration = zero();
  let phraseId = phraseAt?.id ?? -1;
  let prominence: Hyper3dProminenceLevel = "NONE";
  let reason: string;
  let trajectoryStart = t;
  let trajectoryEnd = t;
  let gesture: HeadFrame["gesture"] = null;

  if (active >= 0) {
    const segment = segments[active];
    /**
     * Sampled on the SHARED span, not on this window's own endpoints. That is
     * what makes velocity and acceleration continuous across a MOVE -> SETTLE or
     * return -> settle join instead of dropping to zero and restarting.
     */
    const sample = sampleTrajectory(segment.span, t);
    state = segment.state;
    pose = sample.pose;
    // Where the motion is ACTUALLY going. Reporting the window end here is what
    // made the panel show two return destinations for one gesture.
    destination = clonePose(segment.span.to);
    velocity = sample.velocity;
    acceleration = sample.acceleration;
    phraseId = segment.phraseId;
    prominence = segment.prominence;
    reason = segment.reason;
    trajectoryStart = segment.t0;
    trajectoryEnd = segment.t0 + segment.duration;
    if (segment.gestureId) {
      let first = active;
      while (first > 0 && segments[first - 1].gestureId === segment.gestureId) first--;
      let last_ = active;
      while (last_ + 1 < segments.length && segments[last_ + 1].gestureId === segment.gestureId) last_++;
      const down = segments[first].kind === "gesture-down" ? segments[first] : undefined;
      const last = segments[last_];
      gesture = {
        type: segment.prominence,
        strength: down ? down.to.pitch - down.from.pitch : 0,
        apexTime: down ? down.t0 + down.duration : segment.t0,
        endTime: last.t0 + last.duration
      };
    }
  } else {
    const previous = previousSegment(segments, t);
    pose = previous >= 0 ? clonePose(segments[previous].to) : zero();
    destination = clonePose(pose);
    if (previous >= 0) phraseId = segments[previous].phraseId;
    reason = lastDecision
      ? `HOLD — ${lastDecision.reason}`
      : segments.length
        ? "HOLD at rest — the utterance has not started"
        : "HOLD at rest — no plan";
  }

  const capped = capsWouldClamp(pose);
  const safePose = applyHardCaps(pose);

  return {
    phraseId,
    state,
    targetPose: destination,
    gesture,
    reason,
    prominence,
    currentPose: safePose,
    destinationPose: destination,
    angularVelocity: velocity,
    angularAcceleration: acceleration,
    trajectoryStart,
    trajectoryEnd,
    capped,
    rig: distributeToRig(safePose)
  };
};
