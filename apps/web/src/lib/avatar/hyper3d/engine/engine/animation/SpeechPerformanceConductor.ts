import { minimumJerkShape } from "./SpeakingGestureDirector";
import type { PerformanceStateId } from "../behaviour/naturalism/PerformanceStateDirector";
import type { PerformanceAnchor, PlannedClause, SpeechPerformancePlan } from "./SpeechPerformancePlan";
import { neutralProsody, type ProsodyFrame } from "./SpeechProsody";

/**
 * The conductor: one interpretation of the utterance, consumed by every
 * subsystem.
 *
 * It writes no bone and no morph. Each frame it resolves the plan against the
 * AUDIO CLOCK — not wall time, not an accumulated delta — and publishes a
 * single intent. Head, neck, gaze and face then render that same intent with
 * their own offsets, which is the difference between coordinated delivery and
 * four schedulers that happen to be running at once.
 *
 * Anticipation is the reason this exists. A reactive system cannot start moving
 * before a word it has not heard yet; a planned one can, because the plan
 * already knows the word is coming.
 *
 * TWO LEVELS, ONE OUTPUT. The plan says WHERE the current sentence carries its
 * emphasis. The §P17 `PerformanceStateDirector` says WHAT emotional character is
 * active. Neither replaces the other: the state scales and colours what the
 * anchor asks for, so the same anchor delivered under SERIOUS_FOCUSED and under
 * WARM_ATTENTIVE is the same timing with a different body.
 */

export type PerformancePhase = "silent" | "entry" | "development" | "approach" | "commit" | "recover" | "resolve" | "hold";

/**
 * What the eyes are doing about the current anchor.
 *
 * Deliberately not a mirror of head angle. A speaker's eyes and head are only
 * loosely coupled, and the informative cases are the ones where they disagree —
 * the gaze holding dead still on the listener through a big emphatic nod is a
 * different act from the gaze sliding away on a contrast.
 */
export type GazeIntentMode = "engaged" | "lead" | "follow" | "offset" | "stabilize" | "settle";

/** Facial performance intent. Amplitudes, not morph names — owners map these. */
export interface FacePerformanceIntent {
  /** Inner-brow support (`browInnerUp`). */
  browInner: number;
  /** Outer-brow support (`browOuterUp*`). */
  browOuter: number;
  /** Warmth through the cheek, routed to the coordinated layer during speech. */
  cheek: number;
  /** Corner support, routed with the cheek. Small on this asset by measurement. */
  smile: number;
  /** Safe lower-face support (`mouthUpperUp*`, `noseSneer*`). */
  lowerFace: number;
  /**
   * Awake-eye support. Small by construction and clipped again by the owner —
   * see `awakeLidCeiling`. This is NOT a blink and must never read as one.
   */
  eyelid: number;
}

/**
 * FINAL MOTOR SPEECH — continuous motion INFLUENCE, never an angle.
 *
 * The planner's job changed here. It used to command `headPitch` and the head
 * eased toward it; that made the position smooth while the intention still
 * stepped, which is what read as an animation clip. It now publishes forces,
 * and `SpeakingMotorController` integrates them into a trajectory that never
 * restarts.
 *
 * Nothing in this structure is a destination. `biasPitch`/`biasYaw`/`biasRoll`
 * come closest and are still not one: they move the slowly-evolving REST of a
 * damped system, so they shift where the head would eventually settle rather
 * than where it is being sent.
 */
export interface MotorDrive {
  /** -1..1 acceleration influence per axis. Multiplied by the tuning's gain. */
  pitch: number;
  yaw: number;
  roll: number;
  /** Clause-level postural bias in DEGREES, applied to the evolving rest. */
  biasPitch: number;
  biasYaw: number;
  biasRoll: number;
  /** The signed rate of change of emphasis. Positive commits, negative releases. */
  emphasisImpulse: number;
  /** 0-1. Mid-phrase liveliness, from prosody. */
  continuation: number;
  /** 0-1. Pause settling: raises damping so momentum dissipates. */
  settle: number;
  /** 0-1. How fast this is being delivered. Scales the jerk ceiling only. */
  urgency: number;
}

export const neutralMotorDrive: MotorDrive = {
  pitch: 0, yaw: 0, roll: 0, biasPitch: 0, biasYaw: 0, biasRoll: 0,
  emphasisImpulse: 0, continuation: 0, settle: 1, urgency: 0.5
};

export interface PerformanceIntentFrame {
  /** Audio time this frame was resolved against. */
  clock: number;
  clauseIndex: number;
  /** 0-1 within the current clause, or -1 outside one. */
  clauseProgress: number;
  phase: PerformancePhase;
  /** 0-1, shared by head, gaze and face. The single coordination signal. */
  emphasis: number;
  /** The anchor currently being expressed, if any. */
  anchor: PerformanceAnchor | null;
  nextAnchorIn: number;
  /** Head orientation intent in DEGREES, relative to the speaking rest. */
  headPitch: number;
  headYaw: number;
  headRoll: number;
  /** Share of the head intent the neck should carry. */
  neckSupport: number;
  /** What the eyes are doing about this anchor. */
  gazeMode: GazeIntentMode;
  /** Gaze intent: 1 = fully engaged with the viewer, lower = drawn away. */
  gazeEngagement: number;
  gazeYawBias: number;
  gazePitchBias: number;
  /**
   * 0-1 damping applied to the gaze layer's OWN wandering.
   *
   * This is "viewer stabilization" as a quantity: during a committed emphasis a
   * speaker's eyes stop drifting and lock on. It suppresses the autonomous
   * glance target and the slow drift only — micro-saccades survive, because eyes
   * that are perfectly still are the other failure.
   */
  gazeStability: number;
  /** Face intent, consumed by the P17 expression path. */
  faceEmphasis: number;
  face: FacePerformanceIntent;
  /**
   * FINAL MOTOR SPEECH drive. Head and neck integrate this; gaze and face keep
   * reading the bounded intent above, so the whole performance stays coordinated
   * while only the head/neck chain gains physical momentum.
   */
  drive: MotorDrive;
  /** Which §P17 state coloured this frame. */
  stateId: PerformanceStateId;
  /** Why, in words, for the review panel and the timeline. */
  reason: string;
}

export const neutralFaceIntent: FacePerformanceIntent = {
  browInner: 0, browOuter: 0, cheek: 0, smile: 0, lowerFace: 0, eyelid: 0
};

export const silentPerformanceIntent: PerformanceIntentFrame = {
  clock: 0, clauseIndex: -1, clauseProgress: -1, phase: "silent", emphasis: 0, anchor: null,
  nextAnchorIn: Infinity, headPitch: 0, headYaw: 0, headRoll: 0, neckSupport: 0,
  gazeMode: "engaged", gazeEngagement: 1, gazeYawBias: 0, gazePitchBias: 0, gazeStability: 0,
  faceEmphasis: 0, face: { ...neutralFaceIntent }, drive: { ...neutralMotorDrive },
  stateId: "ATTENTIVE_NEUTRAL", reason: "not speaking"
};

/**
 * The §P17 state reduced to the four dimensions a speech anchor cares about.
 *
 * The director's signature is a face pose; this is how that state DELIVERS a
 * sentence. Kept as a separate small table rather than derived from the pose,
 * because "how committed is this person's head when they make a point" is not
 * recoverable from how much cheek they are holding.
 */
export interface PerformanceStateCharacter {
  id: PerformanceStateId;
  /** Scales cheek, smile and lower-face support on an anchor. */
  warmth: number;
  /** Slows and lengthens the approach: a serious point is made deliberately. */
  gravity: number;
  /** How readily the eyes leave the viewer to think. Drives `offset`. */
  introspection: number;
  /** Multiplier on head amplitude. */
  commitment: number;
  /** Which brow carries this state's emphasis. */
  brow: "inner" | "outer" | "neutral";
}

export const stateCharacters: Record<PerformanceStateId, PerformanceStateCharacter> = {
  ATTENTIVE_NEUTRAL: { id: "ATTENTIVE_NEUTRAL", warmth: 0.35, gravity: 0.35, introspection: 0.15, commitment: 1.0, brow: "outer" },
  WARM_ATTENTIVE: { id: "WARM_ATTENTIVE", warmth: 0.85, gravity: 0.2, introspection: 0.1, commitment: 1.05, brow: "outer" },
  SOFT_SMILE: { id: "SOFT_SMILE", warmth: 1.0, gravity: 0.1, introspection: 0.05, commitment: 0.95, brow: "outer" },
  INTERESTED: { id: "INTERESTED", warmth: 0.55, gravity: 0.3, introspection: 0.2, commitment: 1.15, brow: "outer" },
  THOUGHTFUL: { id: "THOUGHTFUL", warmth: 0.2, gravity: 0.55, introspection: 0.9, commitment: 0.8, brow: "inner" },
  SERIOUS_FOCUSED: { id: "SERIOUS_FOCUSED", warmth: 0.08, gravity: 1.0, introspection: 0.3, commitment: 1.2, brow: "outer" },
  CURIOUS: { id: "CURIOUS", warmth: 0.6, gravity: 0.25, introspection: 0.45, commitment: 1.1, brow: "inner" },
  CALM_LISTENING: { id: "CALM_LISTENING", warmth: 0.4, gravity: 0.45, introspection: 0.25, commitment: 0.75, brow: "neutral" }
};

export const defaultStateCharacter = stateCharacters.ATTENTIVE_NEUTRAL;

export interface ConductorTuning {
  id: string;
  label: string;
  /** How long before an anchor the body starts preparing, in seconds. */
  anticipationSeconds: number;
  /** How long the commitment takes to release, in seconds. */
  recoverySeconds: number;
  /** Degrees of pitch at full emphasis strength. */
  pitchAtFullEmphasis: number;
  /** Degrees of roll a contrast or question anchor adds. */
  rollAtFullEmphasis: number;
  /** Slow orientation evolution across a clause, in degrees. */
  clauseArcDegrees: number;
  /** Neck share of the head intent. */
  neckShare: number;
  /** Face lags the head by this much, in seconds. Anchor character adjusts it. */
  faceLagSeconds: number;
  /** Gaze leads the head by this much, in seconds. Anchor character adjusts it. */
  gazeLeadSeconds: number;
  /** Brow leads the head by this much. Support arrives with the commitment. */
  browLeadSeconds: number;
  /** Peak cheek/warmth an anchor can request, before the state's warmth scales it. */
  cheekAtFullEmphasis: number;
  /** Peak brow an anchor can request. */
  browAtFullEmphasis: number;
  /** Peak awake-lid support. Deliberately tiny; the owner clips it again. */
  eyelidAtFullEmphasis: number;
}

export const conductorTunings = {
  natural: {
    id: "natural", label: "Coordinated",
    anticipationSeconds: 0.18, recoverySeconds: 0.55,
    pitchAtFullEmphasis: 2.1, rollAtFullEmphasis: 1.1, clauseArcDegrees: 0.5,
    neckShare: 0.3, faceLagSeconds: 0.06, gazeLeadSeconds: 0.09, browLeadSeconds: 0.04,
    cheekAtFullEmphasis: 0.34, browAtFullEmphasis: 0.30, eyelidAtFullEmphasis: 0.05
  },
  strong: {
    id: "strong", label: "Strong coordinated",
    anticipationSeconds: 0.22, recoverySeconds: 0.62,
    pitchAtFullEmphasis: 3.2, rollAtFullEmphasis: 1.8, clauseArcDegrees: 0.8,
    neckShare: 0.33, faceLagSeconds: 0.07, gazeLeadSeconds: 0.11, browLeadSeconds: 0.05,
    cheekAtFullEmphasis: 0.46, browAtFullEmphasis: 0.42, eyelidAtFullEmphasis: 0.06
  },
  /**
   * PRESENCE PASS — Hyper3D coordination.
   *
   * Derived from `natural` by changing THREE fields, all of them timing. Every
   * amplitude is identical: `pitchAtFullEmphasis`, `rollAtFullEmphasis`,
   * `clauseArcDegrees`, `neckShare`, `cheekAtFullEmphasis`, `browAtFullEmphasis`
   * and `eyelidAtFullEmphasis` are byte-for-byte `natural`. Hardware review said
   * the individual shapes are acceptable and the problem is coordination, so only
   * the stagger moved.
   *
   * How the three numbers map to the brief's window. The sampler reads
   * `emphasisAt(clock + offsets.gaze)` and `emphasisAt(clock + offsets.brow)` —
   * a POSITIVE offset samples ahead, i.e. that channel LEADS — while the cheek
   * reads `emphasisAt(clock - offsets.cheek)`, so a positive `faceLagSeconds`
   * LAGS. The head itself carries no offset and sits at 0. Taking the gaze as the
   * zero reference, as the brief does:
   *
   *   channel   offset field              lands at
   *   gaze      gazeLeadSeconds  0.045    0 ms      (reference)
   *   head      (none)                    +45 ms    brief asks 30-60
   *   brow      browLeadSeconds -0.025    +70 ms    brief asks 50-90
   *   cheek     faceLagSeconds   0.050    +95 ms    brief asks 70-120
   *
   * `natural` spreads the same four channels over 150 ms in the order
   * gaze -> brow -> head -> cheek; this is 95 ms in the order the brief asks for,
   * gaze -> head -> brow -> cheek. `browLeadSeconds` is negative on purpose: the
   * brow now arrives just AFTER the head commits rather than announcing it, which
   * is what stops the face reading as a separate animation track.
   */
  // LOCKED after hardware review (coordination: MUCH BETTER). Pinned exactly by
  // hyper3dAcceptedBaseline.test.ts; do not retune without a new hardware test.
  hyper3dCoordinated: {
    id: "hyper3dCoordinated", label: "Hyper3D coordinated",
    anticipationSeconds: 0.18, recoverySeconds: 0.55,
    pitchAtFullEmphasis: 2.1, rollAtFullEmphasis: 1.1, clauseArcDegrees: 0.5,
    neckShare: 0.3, faceLagSeconds: 0.05, gazeLeadSeconds: 0.045, browLeadSeconds: -0.025,
    cheekAtFullEmphasis: 0.34, browAtFullEmphasis: 0.30, eyelidAtFullEmphasis: 0.05
  }
} satisfies Record<string, ConductorTuning>;

export type ConductorTuningId = keyof typeof conductorTunings;

/**
 * Per-consumer time offsets for one anchor, in seconds.
 *
 * Positive LEADS the head, negative FOLLOWS it. The brief's requirement is that
 * these are not universal constants — a thoughtful aside and a brisk agreement
 * do not stagger the same way — so they are derived from the anchor's character
 * and the active state, and only scaled by the tuning.
 */
interface ChannelOffsets {
  gaze: number;
  brow: number;
  cheek: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Scales the emphasis derivative into a drive, WITHOUT breaking its symmetry.
 *
 * The push and the release are deliberately different SHAPES — a tall narrow
 * acceleration into the stressed syllable, a low wide one out of it, because
 * anticipation is shorter than recovery. What must match is their AREA: equal
 * areas make an emphasis a push-and-release, unequal areas make it a
 * displacement, and a displacement is a target by another name.
 *
 * The first version scaled by 0.55 and clamped to +/-1, which saturated the
 * push (peak ~2.7) while leaving the release (peak ~0.93) untouched. Measured
 * on the production clip, that cost "Hello" and "David" about 30 % of their
 * net impulse in one direction. The scale here keeps the fastest realistic push
 * inside the bound, so the clamp is a guard rail rather than part of the shape.
 */
const IMPULSE_SCALE = 0.2;
const IMPULSE_BOUND = 2;
const shapeImpulse = (raw: number) => {
  const v = raw * IMPULSE_SCALE;
  return v < -IMPULSE_BOUND ? -IMPULSE_BOUND : v > IMPULSE_BOUND ? IMPULSE_BOUND : v;
};

export class SpeechPerformanceConductor {
  private plan: SpeechPerformancePlan | null = null;

  setPlan(plan: SpeechPerformancePlan | null) {
    this.plan = plan;
  }

  currentPlan() {
    return this.plan;
  }

  private clauseAt(clock: number): PlannedClause | null {
    if (!this.plan) return null;
    for (const c of this.plan.clauses) if (clock >= c.startsAt && clock <= c.endsAt) return c;
    return null;
  }

  /**
   * Resolves the plan at an audio time.
   *
   * Deliberately a PURE FUNCTION of the clock, the plan and the state character
   * — no accumulated state, no frame counter. Shifting the audio timeline shifts
   * the whole performance with it, a seek lands on exactly the pose that time
   * owns, and every consumer that resolves the same clock gets a bit-identical
   * frame. Any per-frame smoothing belongs to the consumers, which already have
   * followers built for it.
   */
  resolve(
    clock: number,
    tuning: ConductorTuning,
    character: PerformanceStateCharacter = defaultStateCharacter,
    prosody: ProsodyFrame = neutralProsody
  ): PerformanceIntentFrame {
    const plan = this.plan;
    if (!plan || !plan.clauses.length) {
      return { ...silentPerformanceIntent, clock, stateId: character.id, face: { ...neutralFaceIntent }, drive: { ...neutralMotorDrive } };
    }

    const clause = this.clauseAt(clock);
    // Between clauses the body settles; it does not gesture.
    if (!clause) {
      const next = plan.clauses.find((c) => c.startsAt > clock);
      /**
       * A pause is not a stop. The drive goes to zero and `settle` goes to one,
       * which raises damping so existing momentum DISSIPATES; the postural bias
       * of the clause just finished is held, so the head comes to rest where the
       * thought left it rather than being pulled back to centre.
       */
      const previous = [...plan.clauses].reverse().find((c) => c.endsAt <= clock);
      /**
       * The release tail of the last clause's anchors CONTINUES past the clause
       * boundary.
       *
       * Zeroing the drive here was wrong, and the impulse integral caught it: an
       * anchor near the end of a clause got the push half of its envelope and
       * lost the release half, leaving 79-80 % of its impulse one-signed on
       * "speaking" and "pace" against 2-30 % elsewhere. Physically that is a
       * shove with no follow-through, at exactly the place a speaker's head is
       * most visibly finishing a thought.
       *
       * A clause boundary is a fact about the TEXT. It is not a reason for the
       * body to stop mid-movement.
       */
      const shapedPause: ConductorTuning = {
        ...tuning,
        anticipationSeconds: tuning.anticipationSeconds * (1 + 0.45 * character.gravity),
        recoverySeconds: tuning.recoverySeconds * (1 + 0.3 * character.gravity)
      };
      const h = 1 / 120;
      const tail = shapeImpulse(
        (this.emphasisAt(clock + h, null, shapedPause) - this.emphasisAt(clock - h, null, shapedPause)) / (2 * h)
      );
      return {
        ...silentPerformanceIntent, clock,
        phase: "hold",
        gazeMode: "settle",
        // Settling is not staring: the eyes are released rather than pinned.
        gazeStability: 0.15,
        stateId: character.id,
        face: { ...neutralFaceIntent },
        drive: {
          ...neutralMotorDrive,
          ...(previous ? this.posturalBias(previous, character) : {}),
          pitch: tail * character.commitment,
          emphasisImpulse: tail,
          settle: 1,
          urgency: 0.35
        },
        nextAnchorIn: next ? next.startsAt - clock : Infinity,
        reason: next ? "pause: settling before next clause" : "pause: utterance finished"
      };
    }

    const progress = clamp01((clock - clause.startsAt) / Math.max(0.001, clause.endsAt - clause.startsAt));

    /**
     * A serious point is prepared for longer and released more slowly than a
     * light one. Applying the state to the SHAPE rather than only the amplitude
     * is what stops "same anchor, different state" from being a volume knob.
     */
    const shaped: ConductorTuning = {
      ...tuning,
      anticipationSeconds: tuning.anticipationSeconds * (1 + 0.45 * character.gravity),
      recoverySeconds: tuning.recoverySeconds * (1 + 0.3 * character.gravity)
    };

    /**
     * Emphasis is the sum of every anchor's shaped contribution, so a second
     * anchor arriving before the first has released builds on it rather than
     * restarting — which is what "recovery continues while speech continues"
     * means physically.
     */
    let emphasis = 0;
    let active: PerformanceAnchor | null = null;
    let bestWeight = 0;
    // Every anchor in the plan, for the reason given on `emphasisAt`: a
    // commitment that began in the previous clause is still being released here.
    for (const c of plan.clauses) {
      for (const a of c.anchors) {
        const contribution = this.anchorWeight(clock, a, shaped) * a.strength;
        emphasis += contribution;
        if (contribution > bestWeight) { bestWeight = contribution; active = a; }
      }
    }
    emphasis = clamp01(emphasis);

    const nextAnchor = clause.anchors.find((a) => a.at > clock);
    const nextAnchorIn = nextAnchor ? nextAnchor.at - clock : Infinity;

    /**
     * The clause arc. A slow orientation evolution across the clause, so the
     * head is physically engaged with the sentence even where no anchor is
     * active. It is a function of clause POSITION, so it cannot oscillate and
     * it is exactly zero outside a clause.
     */
    const arc = Math.sin(Math.PI * progress) * tuning.clauseArcDegrees;
    const closing = clause.ending === "final" || clause.ending === "exclamation";
    // A finished thought settles downward; a question lifts.
    const cadence = clause.ending === "question" ? -0.35 * progress * progress : closing ? 0.3 * progress * progress : 0;

    const anchorCharacter = active?.character ?? "emphasis";
    const rollSign = clause.index % 2 === 0 ? 1 : -1;
    const commit = character.commitment;
    const headPitch = emphasis * tuning.pitchAtFullEmphasis * commit + arc + cadence;
    const headRoll = (anchorCharacter === "contrast" || clause.ending === "question")
      ? rollSign * emphasis * tuning.rollAtFullEmphasis * commit
      : rollSign * emphasis * tuning.rollAtFullEmphasis * 0.35 * commit;
    // Yaw stays small and is only used to mark a turn in the argument.
    const headYaw = anchorCharacter === "contrast" ? rollSign * emphasis * 0.8 * commit : 0;

    const phase: PerformancePhase =
      emphasis < 0.05
        ? progress < 0.12 ? "entry" : progress > 0.88 ? "resolve" : "development"
        : active && clock < active.at - 0.02 ? "approach"
        : active && clock <= active.at + 0.08 ? "commit"
        : "recover";

    /**
     * Gaze, brow and cheek read the SAME emphasis curve, sampled at shifted
     * clocks. Staggering without separate intentions: it is one performance seen
     * slightly earlier and slightly later, so nothing can drift out of agreement
     * about WHICH word is being emphasised.
     */
    const offsets = this.offsetsFor(anchorCharacter, character, tuning);
    const gazeEmphasis = this.emphasisAt(clock + offsets.gaze, clause, shaped);
    const browEmphasis = this.emphasisAt(clock + offsets.brow, clause, shaped);
    const cheekEmphasis = this.emphasisAt(clock - offsets.cheek, clause, shaped);
    const faceEmphasis = cheekEmphasis;

    const gaze = this.gazeFor(anchorCharacter, character, gazeEmphasis, rollSign, phase, progress);
    const face = this.faceFor(anchorCharacter, character, tuning, browEmphasis, cheekEmphasis);
    const drive = this.driveFor(clock, clause, shaped, character, prosody, rollSign, anchorCharacter);

    return {
      clock, clauseIndex: clause.index, clauseProgress: progress, phase, emphasis, anchor: active, nextAnchorIn,
      headPitch, headYaw, headRoll,
      neckSupport: tuning.neckShare,
      gazeMode: gaze.mode,
      gazeEngagement: gaze.engagement,
      gazeYawBias: gaze.yaw,
      gazePitchBias: gaze.pitch,
      gazeStability: gaze.stability,
      faceEmphasis,
      face,
      drive,
      stateId: character.id,
      reason: active ? `${anchorCharacter} on "${active.word}" (${character.id})` : `clause ${clause.index} ${phase}`
    };
  }

  /**
   * Per-anchor, per-state channel offsets.
   *
   * The eyes go first and by the most on a thought that turns away; they barely
   * lead a nod of agreement, which is a whole-head act. The brow arrives with
   * the commitment. The cheek is the slowest thing on the face and lands after
   * it, more so when the state is grave.
   */
  private offsetsFor(anchor: PerformanceAnchor["character"], state: PerformanceStateCharacter, tuning: ConductorTuning): ChannelOffsets {
    const base = tuning.gazeLeadSeconds;
    switch (anchor) {
      case "contrast":
        // Up to ~0.20 s: the brief's outer bound, reached only when introspective.
        return { gaze: base + 0.11 * state.introspection, brow: tuning.browLeadSeconds, cheek: tuning.faceLagSeconds + 0.04 };
      case "affirmation":
        // The eyes ride WITH the nod rather than announcing it.
        return { gaze: -0.04, brow: tuning.browLeadSeconds * 0.5, cheek: tuning.faceLagSeconds * 0.5 };
      case "closing":
        return { gaze: base + 0.03, brow: tuning.browLeadSeconds, cheek: tuning.faceLagSeconds + 0.02 * state.gravity };
      case "opening":
        return { gaze: base + 0.05, brow: tuning.browLeadSeconds, cheek: tuning.faceLagSeconds };
      default:
        return { gaze: base * (1 - 0.25 * state.gravity), brow: tuning.browLeadSeconds, cheek: tuning.faceLagSeconds + 0.03 * state.gravity };
    }
  }

  /**
   * What the eyes do. NOT a function of head angle.
   *
   * The default under emphasis is `stabilize` — the eyes lock onto the listener
   * and their own wandering is damped — because that is what a speaker actually
   * does when making a point, and because it is the opposite of the "eyes follow
   * the head" tell that makes procedural avatars read as puppets. Only a
   * contrast, and only under an introspective state, takes the eyes away.
   */
  private gazeFor(
    anchor: PerformanceAnchor["character"],
    state: PerformanceStateCharacter,
    gazeEmphasis: number,
    rollSign: number,
    phase: PerformancePhase,
    progress: number
  ): { mode: GazeIntentMode; engagement: number; yaw: number; pitch: number; stability: number } {
    if (gazeEmphasis < 0.08) {
      // No anchor in play. The eyes are simply present, and released near the end.
      return progress > 0.9
        ? { mode: "settle", engagement: 1, yaw: 0, pitch: 0, stability: 0.1 }
        : { mode: "engaged", engagement: 1, yaw: 0, pitch: 0, stability: 0 };
    }
    if (anchor === "contrast" && state.introspection >= 0.5) {
      // A thought that turns away: the eyes leave first and by the most.
      const away = gazeEmphasis * state.introspection;
      return {
        mode: "offset",
        engagement: 1 - 0.55 * away,
        yaw: -rollSign * away * 1.8,
        pitch: -0.6 * away,
        stability: 0
      };
    }
    if (anchor === "contrast") {
      // The turn is marked, but the speaker stays with the listener.
      return { mode: "lead", engagement: 1 - 0.18 * gazeEmphasis, yaw: -rollSign * gazeEmphasis * 0.9, pitch: 0, stability: 0.25 * gazeEmphasis };
    }
    if (anchor === "affirmation") {
      // The eyes travel with the nod: a small downward ride, then back.
      return { mode: "follow", engagement: 1, yaw: 0, pitch: 0.45 * gazeEmphasis, stability: 0.4 * gazeEmphasis };
    }
    // Emphasis, opening, closing: viewer stabilization.
    return {
      mode: phase === "recover" ? "engaged" : "stabilize",
      engagement: 1,
      yaw: 0,
      pitch: 0,
      stability: gazeEmphasis
    };
  }

  /**
   * The facial half of the same anchor.
   *
   * Every amplitude here is a REQUEST in influence units. The owners clip them:
   * cheek/smile/lower-face are routed to the coordinated speech layer, which
   * applies its own ceilings and its bilabial suppression, and the eyelid is
   * clipped again to the awake ceiling. Nothing here writes a morph.
   */
  private faceFor(
    anchor: PerformanceAnchor["character"],
    state: PerformanceStateCharacter,
    tuning: ConductorTuning,
    browEmphasis: number,
    cheekEmphasis: number
  ): FacePerformanceIntent {
    const brow = browEmphasis * tuning.browAtFullEmphasis;
    const innerShare = state.brow === "inner" ? 0.9 : state.brow === "neutral" ? 0.45 : 0.22;
    const outerShare = state.brow === "outer" ? 0.95 : state.brow === "neutral" ? 0.5 : 0.25;
    /**
     * A contrast lifts the INNER brow whatever the state — it is the shape of
     * "but", and reading it off the state alone would lose the word.
     */
    const contrastLift = anchor === "contrast" ? 0.35 : 0;
    const warmthDrive = cheekEmphasis * state.warmth;
    /**
     * THOUGHTFUL and SERIOUS keep the lower face quiet: the brief asks for a
     * "quieter lower face" there, and it is also what stops every state from
     * resolving into the same pleasant expression.
     */
    const lowerGate = 1 - 0.6 * state.gravity;
    return {
      browInner: clamp01(brow * Math.min(1, innerShare + contrastLift)),
      browOuter: clamp01(brow * outerShare),
      cheek: clamp01(warmthDrive * tuning.cheekAtFullEmphasis),
      // Measured on this asset: the corner barely moves, so it garnishes only.
      smile: clamp01(warmthDrive * tuning.cheekAtFullEmphasis * 0.35),
      lowerFace: clamp01(warmthDrive * tuning.cheekAtFullEmphasis * 0.8 * lowerGate),
      eyelid: clamp01(warmthDrive * tuning.eyelidAtFullEmphasis)
    };
  }

  /**
   * The clause's postural bias, in degrees.
   *
   * Deterministic from the clause's own structure — index, ending, position in
   * the utterance — so the same sentence always adopts the same physical
   * journey, and a different sentence adopts a different one. This is NOT a
   * target: it moves the slowly-evolving rest of a damped integrator, so it
   * changes where the head would eventually settle, over seconds.
   *
   * No oscillator and no noise. The alternating term is a function of clause
   * INDEX, which cannot produce a periodic sway in time because clauses are not
   * evenly spaced.
   */
  private posturalBias(clause: PlannedClause, character: PerformanceStateCharacter) {
    const side = clause.index % 2 === 0 ? 1 : -1;
    const through = clause.positionInUtterance;
    return {
      // A speaker's head lowers slightly as an argument is delivered and lifts
      // for a question. Scaled by how committed the state is.
      biasPitch: (clause.ending === "question" ? -0.55 : clause.ending === "final" ? 0.5 : 0.3 + 0.3 * through) * character.commitment,
      // Attention drifts across the utterance rather than alternating per clause.
      biasYaw: side * (0.6 + 0.4 * through) * (1 - 0.4 * character.gravity),
      biasRoll: side * 0.3 * (1 - 0.5 * character.gravity)
    };
  }

  /**
   * Motor drive: forces, not angles.
   *
   * The load-bearing line is `impulse`. It is the TIME DERIVATIVE of the same
   * emphasis envelope every other consumer reads, and because that envelope is a
   * minimum-jerk shape its derivative is a smooth bipolar pulse — positive while
   * the speaker commits into the stressed syllable, negative while the
   * commitment is released. Fed to acceleration, that IS a nod: the head
   * accelerates down, decelerates, and momentum carries it back. Nothing
   * schedules a start, a peak or an end, and a second anchor arriving mid-release
   * simply adds another force to a head that is already moving.
   *
   * Prosody never sets a magnitude on its own. It scales what the semantic plan
   * already asked for, which is the difference between "the body delivers this
   * intention harder" and the energy-puppet coupling P18 removed.
   */
  private driveFor(
    clock: number,
    clause: PlannedClause,
    tuning: ConductorTuning,
    character: PerformanceStateCharacter,
    prosody: ProsodyFrame,
    rollSign: number,
    anchorCharacter: PerformanceAnchor["character"]
  ): MotorDrive {
    // Central difference on a pure function: still pure, still shift-invariant.
    const h = 1 / 120;
    const impulseRaw = (this.emphasisAt(clock + h, null, tuning) - this.emphasisAt(clock - h, null, tuning)) / (2 * h);
    const impulse = shapeImpulse(impulseRaw);

    /**
     * Prosodic gain. Bounded to [0.55, 1.6] so a quiet passage still moves and a
     * loud one cannot run away — the semantic plan stays in charge of whether
     * there is an intention at all.
     */
    const delivery = 0.55 + 0.7 * prosody.prominence + 0.35 * Math.max(0, prosody.activityChange);
    const gain = Math.min(1.6, delivery) * character.commitment;

    /**
     * Between anchors the head stays alive on the articulation contour itself.
     * `activityChange` is a derivative, so it is zero-mean and cannot ramp the
     * integrator anywhere; it modulates, it does not transport.
     */
    const alive = prosody.activityChange * prosody.continuation * 0.22;

    const contrast = anchorCharacter === "contrast";
    return {
      pitch: impulse * gain + alive,
      // A turn in the argument pushes the head sideways as it commits.
      yaw: (contrast ? rollSign * impulse * 0.7 : rollSign * impulse * 0.15) * gain,
      roll: rollSign * impulse * (contrast ? 0.55 : 0.3) * gain,
      ...this.posturalBias(clause, character),
      emphasisImpulse: impulse,
      continuation: prosody.continuation * prosody.activity,
      // Settling begins before the pause arrives, because the speaker knows.
      settle: Math.max(prosody.pauseApproach * 0.8, prosody.voiced ? 0 : 0.6),
      // Grave delivery is slower; a fast passage is allowed to change faster.
      urgency: Math.max(0, Math.min(1, 0.3 + 0.5 * prosody.rate + 0.3 * prosody.prominence - 0.25 * character.gravity))
    };
  }

  /** One anchor's shaped weight at a time. Zero outside its window. */
  private anchorWeight(clock: number, a: PerformanceAnchor, tuning: ConductorTuning): number {
    const start = a.at - tuning.anticipationSeconds;
    const end = a.at + tuning.recoverySeconds;
    if (clock < start || clock > end) return 0;
    return clock <= a.at
      ? minimumJerkShape((clock - start) / Math.max(0.001, tuning.anticipationSeconds))
      : 1 - minimumJerkShape((clock - a.at) / Math.max(0.001, tuning.recoverySeconds));
  }

  /**
   * The emphasis curve at an arbitrary time, summed over EVERY anchor in the
   * plan whose window covers that instant.
   *
   * Deliberately not scoped to a clause. Anchor windows extend past clause
   * boundaries by design — anticipation reaches back before the word and
   * recovery reaches forward after it — and clause-scoping truncated whichever
   * half fell outside. Measured on the production clip that cost "speaking" and
   * "pace" their release halves at pause boundaries (79-80 % of impulse
   * one-signed) and "coffee" its release at an abutting clause boundary (94 %),
   * against 2-30 % for anchors comfortably inside a clause.
   *
   * A clause is a fact about the TEXT. It bounds where progress, arc, cadence
   * and postural bias come from; it does not bound how long a physical
   * commitment takes to release.
   */
  private emphasisAt(clock: number, _clause: PlannedClause | null, tuning: ConductorTuning): number {
    const plan = this.plan;
    if (!plan) return 0;
    let total = 0;
    for (const c of plan.clauses) {
      for (const a of c.anchors) total += this.anchorWeight(clock, a, tuning) * a.strength;
    }
    return clamp01(total);
  }
}
