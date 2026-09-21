import type { BehaviorRandom } from "./BehaviorRandom";

/**
 * §P17. One authority that decides WHAT THE AVATAR IS DOING, and nothing else.
 *
 * Every pass up to P16 tuned independent systems: the head had a posture
 * scheduler, the brow and warmth had their own firing reasons, gaze had a third,
 * and the face could therefore choose an expression that had nothing to do with
 * what the head was doing. That is the "runs an idle animation" reading — the
 * parts are individually plausible and collectively unmotivated.
 *
 * This director writes NO morph and NO bone. It publishes an intention, and the
 * existing owners execute it: `HumanBehaviorController` for the face and head
 * posture, `GazeBehaviorController` for the eyes, the coordinated speech layer
 * for anything the mouth owns during speech. Ownership is unchanged, which is
 * the constraint that killed the P14 warmth pulse and must not be re-broken.
 *
 * Two properties make it read as a performance rather than a state machine:
 *
 *   SHARED INTENTION — every channel is derived from one state, so the brow and
 *   the cheeks and the head lean the same way at the same time.
 *
 *   OFFSET EXECUTION — they do not START at the same time. Each channel has its
 *   own onset delay, so the state arrives as a gesture rather than a cut.
 */

export type PerformanceStateId =
  | "ATTENTIVE_NEUTRAL"
  | "WARM_ATTENTIVE"
  | "SOFT_SMILE"
  | "INTERESTED"
  | "THOUGHTFUL"
  | "SERIOUS_FOCUSED"
  | "CURIOUS"
  | "CALM_LISTENING";

export const performanceStateIds: PerformanceStateId[] = [
  "ATTENTIVE_NEUTRAL", "WARM_ATTENTIVE", "SOFT_SMILE", "INTERESTED",
  "THOUGHTFUL", "SERIOUS_FOCUSED", "CURIOUS", "CALM_LISTENING"
];

/**
 * A state's coordinated signature.
 *
 * Face amplitudes are in influence units on channels P15 proved SAFE, and are
 * deliberately strong: the hardware verdict on P16 was "still kind of no
 * expressions", and P15 measured 3.4x of unused headroom on cheek and 2.6x on
 * brow. Nothing here touches `eyeSquint`, `browDown`, `eyeWide`, `mouthDimple`,
 * `cheekPuff` or `mouthStretch`, every one of which P15 measured as broken on
 * this asset.
 */
export interface PerformanceStateSignature {
  id: PerformanceStateId;
  label: string;
  /** Head orientation bias, in degrees, added to the P16 posture target. */
  headYawBias: number;
  headPitchBias: number;
  headRollBias: number;
  /** Multiplier on the P16 neck share for this state. */
  neckSupport: number;
  /** Gaze offset bias in degrees, applied through the existing gaze controller. */
  gazeYawBias: number;
  gazePitchBias: number;
  /** Face amplitudes, influence units on SAFE channels. */
  cheek: number;
  /**
   * Lower-lid warmth via `eyeBlink`, the only channel that reaches the eyes.
   *
   * §P17.1 cut these hard. P17 ran WARM at 0.30 and SOFT_SMILE at 0.42, which
   * is a sustained 30-42% blink: the hardware render read as sleepy, and it also
   * made the eyelash defect permanent rather than transient (see `upperLip`
   * below and the P17.1 notes). Warmth is carried by cheek and lower face now,
   * with the lid contributing only a hint.
   */
  eyelid: number;
  browInner: number;
  browOuter: number;
  smile: number;
  /** §P17.1 lower face: upper-lip lift (`mouthUpperUp`). */
  upperLip: number;
  /** §P17.1 lower face: nasolabial (`noseSneer`). */
  nasolabial: number;
  /** §P17.1 lower face: lower-lip support (`mouthShrugLower`). */
  lowerLip: number;
  /** Left/right spread as a fraction: 0.15 means the follow side is at 0.85. */
  asymmetry: number;
  /** Multiplier on the head follower frequency while this state is entering. */
  transitionSpeed: number;
  /** How long the state is held, in seconds. */
  holdSeconds: [number, number];
  /** How long before the head follows the eyes into this state, in seconds. */
  gazeLeadSeconds: number;
  /**
   * How much of a scheduled warmth micro-expression this state tolerates.
   *
   * Without this the idle event layer wrote `cheekSquint` up to 0.9 regardless
   * of state, and the rendered cheek correlated with the active state at
   * r = -0.067 against a shuffled control — the face was contradicting the head.
   * A serious or thoughtful state now damps a warmth event instead of letting
   * it argue with the orientation.
   */
  eventWarmth: number;
}

/**
 * The eight states.
 *
 * §P17.1 recomposed the face after hardware review rejected P17's:
 *
 *   EYES. P17 held `eyeBlink` at 0.30-0.42 for WARM and SOFT_SMILE, which is a
 *   permanent 30-42% blink. It rendered as sedated, and it also made the lash
 *   defect below permanent instead of transient. Warmth is now carried by cheek
 *   and lower face, with the lid at 0.03-0.11.
 *
 *   LOWER FACE. `mouthSmile` cannot lift this asset's corners - P14 measured a
 *   symmetric smile netting -0.03 mm, and P17.1 confirmed it visually at full
 *   drive. `mouthUpperUp`, `noseSneer` and `cheekSquint` DO move visible tissue,
 *   so the lower face is composed from those. `mouthShrugLower` is kept low on
 *   the warm states: it closes the lips, and the parted-lip rest is a large part
 *   of what reads as alive. It is used deliberately on THOUGHTFUL and
 *   SERIOUS_FOCUSED, where a firmer closed mouth is the point.
 *
 * Amplitudes were raised until the pairwise still-frame distance cleared the
 * programme's 0.296 mm visibility floor by a wide margin AND the signatures
 * differed semantically — THOUGHTFUL and SERIOUS_FOCUSED are the pair that has
 * to be argued rather than measured, so they are built from opposite brow
 * behaviour (inner-up worry versus outer-up alert restraint) and opposite head
 * pitch, not from different amounts of the same thing.
 */
export const performanceStates: Record<PerformanceStateId, PerformanceStateSignature> = {
  ATTENTIVE_NEUTRAL: {
    id: "ATTENTIVE_NEUTRAL", label: "Attentive neutral",
    headYawBias: 0, headPitchBias: 0, headRollBias: 0, neckSupport: 1,
    gazeYawBias: 0, gazePitchBias: 0,
            cheek: 0.14, eyelid: 0.03, browInner: 0.12, browOuter: 0.06, smile: 0.06, upperLip: 0.04, nasolabial: 0.04, lowerLip: 0.02,
    asymmetry: 0.06, transitionSpeed: 1, holdSeconds: [5, 10], gazeLeadSeconds: 0.05, eventWarmth: 0.35
  },
  WARM_ATTENTIVE: {
    id: "WARM_ATTENTIVE", label: "Warm attentive",
    // A small tilt is most of what reads as warmth before the face does anything.
    headYawBias: 1.5, headPitchBias: -0.8, headRollBias: 2.2, neckSupport: 1,
    gazeYawBias: 0, gazePitchBias: 0.3,
            cheek: 0.72, eyelid: 0.07, browInner: 0.20, browOuter: 0.22, smile: 0.40, upperLip: 0.34, nasolabial: 0.42, lowerLip: 0.05,
    asymmetry: 0.12, transitionSpeed: 1.05, holdSeconds: [4, 8], gazeLeadSeconds: 0.07, eventWarmth: 1
  },
  SOFT_SMILE: {
    id: "SOFT_SMILE", label: "Soft smile",
    headYawBias: 2, headPitchBias: -1.2, headRollBias: 3, neckSupport: 1,
    gazeYawBias: 0, gazePitchBias: 0.4,
    // Cheek-led and eye-supported. The corners are the one thing this asset
    // cannot do (P14: a symmetric mouthSmile nets -0.03 mm of corner lift), so
    // the smile is carried by cheek and eyelid and the corner only garnishes.
            cheek: 1.00, eyelid: 0.10, browInner: 0.18, browOuter: 0.30, smile: 0.58, upperLip: 0.52, nasolabial: 0.58, lowerLip: 0.08,
    asymmetry: 0.16, transitionSpeed: 1.1, holdSeconds: [3.5, 7], gazeLeadSeconds: 0.06, eventWarmth: 1
  },
  INTERESTED: {
    id: "INTERESTED", label: "Interested",
    headYawBias: -1.2, headPitchBias: -2.2, headRollBias: 1, neckSupport: 1.15,
    gazeYawBias: 0.8, gazePitchBias: 0.9,
    // Brow-led and eyes-first: the lift arrives before the warmth does.
            cheek: 0.34, eyelid: 0.04, browInner: 0.42, browOuter: 0.62, smile: 0.18, upperLip: 0.14, nasolabial: 0.12, lowerLip: 0.04,
    asymmetry: 0.1, transitionSpeed: 1.25, holdSeconds: [2.5, 5], gazeLeadSeconds: 0.14, eventWarmth: 0.5
  },
  THOUGHTFUL: {
    id: "THOUGHTFUL", label: "Thoughtful",
    // Looks away and down; the inner brow does the work.
    headYawBias: -3.5, headPitchBias: 2.6, headRollBias: -1.6, neckSupport: 0.9,
    gazeYawBias: -2.4, gazePitchBias: -1.6,
            cheek: 0.12, eyelid: 0.09, browInner: 0.75, browOuter: 0.10, smile: 0.02, upperLip: 0.02, nasolabial: 0.06, lowerLip: 0.18,
    asymmetry: 0.14, transitionSpeed: 0.85, holdSeconds: [6, 12], gazeLeadSeconds: 0.18, eventWarmth: 0.15
  },
  SERIOUS_FOCUSED: {
    id: "SERIOUS_FOCUSED", label: "Serious / focused",
    // The deliberate opposite of THOUGHTFUL: level head, stable gaze, outer brow
    // held low and inner brow quiet. `browDown` would be the natural channel and
    // moves exactly 0.0000 mm on this asset, so restraint is expressed by
    // ABSENCE of lift plus a firmer lid, not by a knit that cannot render.
    headYawBias: 0, headPitchBias: -0.4, headRollBias: 0, neckSupport: 0.8,
    gazeYawBias: 0, gazePitchBias: 0,
            cheek: 0.06, eyelid: 0.11, browInner: 0.05, browOuter: 0.04, smile: 0, upperLip: 0, nasolabial: 0.02, lowerLip: 0.26,
    asymmetry: 0.04, transitionSpeed: 1.15, holdSeconds: [4, 9], gazeLeadSeconds: 0.04, eventWarmth: 0.05
  },
  CURIOUS: {
    id: "CURIOUS", label: "Curious",
    // The tilt is the signature. Strongest roll of any state.
    headYawBias: 2.8, headPitchBias: -1, headRollBias: 4.5, neckSupport: 1.2,
    gazeYawBias: -1.8, gazePitchBias: 0.5,
            cheek: 0.30, eyelid: 0.04, browInner: 0.30, browOuter: 0.50, smile: 0.16, upperLip: 0.16, nasolabial: 0.14, lowerLip: 0.04,
    asymmetry: 0.2, transitionSpeed: 1.2, holdSeconds: [2.5, 5.5], gazeLeadSeconds: 0.1, eventWarmth: 0.45
  },
  CALM_LISTENING: {
    id: "CALM_LISTENING", label: "Calm listening",
    headYawBias: -2, headPitchBias: 0.8, headRollBias: -1, neckSupport: 1,
    gazeYawBias: -0.6, gazePitchBias: -0.3,
            cheek: 0.20, eyelid: 0.05, browInner: 0.08, browOuter: 0.05, smile: 0.08, upperLip: 0.06, nasolabial: 0.05, lowerLip: 0.06,
    asymmetry: 0.08, transitionSpeed: 0.9, holdSeconds: [8, 15], gazeLeadSeconds: 0.08, eventWarmth: 0.3
  }
};

/**
 * Transition graph. Weighted, not uniform: a face does not go from a smile to a
 * hard focus and back, and the brief calls that pattern out by name.
 */
const TRANSITIONS: Record<PerformanceStateId, [PerformanceStateId, number][]> = {
  ATTENTIVE_NEUTRAL: [["WARM_ATTENTIVE", 2.5], ["INTERESTED", 3], ["CALM_LISTENING", 1.5], ["THOUGHTFUL", 1.5], ["SERIOUS_FOCUSED", 1.5], ["CURIOUS", 1.5]],
  WARM_ATTENTIVE: [["SOFT_SMILE", 3], ["ATTENTIVE_NEUTRAL", 3], ["INTERESTED", 1.5], ["CALM_LISTENING", 1]],
  SOFT_SMILE: [["WARM_ATTENTIVE", 4], ["ATTENTIVE_NEUTRAL", 2], ["INTERESTED", 1]],
  INTERESTED: [["CURIOUS", 3], ["THOUGHTFUL", 2.5], ["ATTENTIVE_NEUTRAL", 2], ["SERIOUS_FOCUSED", 1.5], ["WARM_ATTENTIVE", 1.5]],
  THOUGHTFUL: [["ATTENTIVE_NEUTRAL", 3], ["SERIOUS_FOCUSED", 2], ["CALM_LISTENING", 1.5], ["INTERESTED", 1.5]],
  SERIOUS_FOCUSED: [["CALM_LISTENING", 3], ["ATTENTIVE_NEUTRAL", 3], ["THOUGHTFUL", 1.5]],
  CURIOUS: [["INTERESTED", 3.5], ["ATTENTIVE_NEUTRAL", 2], ["WARM_ATTENTIVE", 1.5]],
  CALM_LISTENING: [["ATTENTIVE_NEUTRAL", 3.5], ["CURIOUS", 1.5], ["WARM_ATTENTIVE", 1.5], ["THOUGHTFUL", 1]]
};

/**
 * Per-channel onset delays, in seconds, as fractions of one gesture.
 *
 * This is the "offset execution" half. The numbers are a family, not a table of
 * constants: gaze first because the eyes are the fastest thing on a face, then
 * the head, then brow, then the slower tissue of cheek and lid, and the corner
 * last because a smile finishes at the mouth.
 */
const ONSET = { gaze: 0.04, head: 0.09, brow: 0.14, cheekLid: 0.19, smile: 0.26 };

export interface PerformanceIntent {
  state: PerformanceStateId;
  previous: PerformanceStateId | null;
  timeInState: number;
  /** 0 while entering, 1 once the state is fully expressed. */
  blend: number;
  headYawBias: number;
  headPitchBias: number;
  headRollBias: number;
  neckSupport: number;
  gazeYawBias: number;
  gazePitchBias: number;
  cheek: number;
  eyelid: number;
  browInner: number;
  browOuter: number;
  smile: number;
  upperLip: number;
  nasolabial: number;
  lowerLip: number;
  asymmetry: number;
  /** Which side leads this state's asymmetry. Migrates between states. */
  asymmetrySide: 1 | -1;
  transitionSpeed: number;
  gazeLeadSeconds: number;
  /** Damping applied to scheduled warmth events that disagree with this state. */
  eventWarmth: number;
}

export const neutralPerformanceIntent: PerformanceIntent = {
  state: "ATTENTIVE_NEUTRAL", previous: null, timeInState: 0, blend: 0,
  headYawBias: 0, headPitchBias: 0, headRollBias: 0, neckSupport: 1,
  gazeYawBias: 0, gazePitchBias: 0,
  cheek: 0, eyelid: 0, browInner: 0, browOuter: 0, smile: 0, upperLip: 0, nasolabial: 0, lowerLip: 0,
  asymmetry: 0, asymmetrySide: 1, transitionSpeed: 1, gazeLeadSeconds: 0, eventWarmth: 1
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export class PerformanceStateDirector {
  private time = 0;
  private current: PerformanceStateId = "ATTENTIVE_NEUTRAL";
  private previous: PerformanceStateId | null = null;
  private enteredAt = 0;
  private holdUntil = 0;
  private side: 1 | -1 = 1;
  /**
   * The intention actually being executed, which lags the chosen state per
   * channel. Kept as state so a transition blends from where the face IS, never
   * through neutral — the brief's "state A -> ZERO FACE -> state B" failure.
   */
  private live: PerformanceIntent = { ...neutralPerformanceIntent };
  private held: PerformanceStateId | null = null;

  constructor(private random: BehaviorRandom) {}

  reset(time = 0) {
    this.time = time;
    this.current = "ATTENTIVE_NEUTRAL";
    this.previous = null;
    this.enteredAt = time;
    this.holdUntil = time + 6;
    this.side = 1;
    this.live = { ...neutralPerformanceIntent };
    this.held = null;
  }

  /** Pins one state for review. `null` returns to the scheduler. */
  hold(state: PerformanceStateId | null) {
    this.held = state;
    if (state && state !== this.current) {
      this.previous = this.current;
      this.current = state;
      this.enteredAt = this.time;
    }
  }

  heldState() {
    return this.held;
  }

  private choose(): PerformanceStateId {
    const options = TRANSITIONS[this.current];
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.random.next("performance-state") * total;
    for (const [id, w] of options) {
      roll -= w;
      if (roll <= 0) return id;
    }
    return options[options.length - 1][0];
  }

  update(deltaSeconds: number, holdScale: number, intensity: number): PerformanceIntent {
    this.time += deltaSeconds;
    if (!this.held && this.time >= this.holdUntil) {
      const next = this.choose();
      this.previous = this.current;
      this.current = next;
      this.enteredAt = this.time;
      const [lo, hi] = performanceStates[next].holdSeconds;
      this.holdUntil = this.time + (lo + this.random.next("performance-hold") * (hi - lo)) * holdScale;
      // Asymmetry migrates rather than favouring one side permanently.
      if (this.random.chance("performance-side", 0.5)) this.side = this.side === 1 ? -1 : 1;
    }

    const target = performanceStates[this.current];
    const elapsed = this.time - this.enteredAt;
    /**
     * Per-channel blend. Each channel starts at its own onset and takes its own
     * time, and every one of them interpolates FROM THE LIVE VALUE, so a state
     * change is a direct A-to-B blend and never passes through zero.
     */
    const ramp = (onset: number, duration: number) => smoothstep(onset, onset + duration / target.transitionSpeed, elapsed);
    const towards = (from: number, to: number, t: number) => from + (to - from) * t;
    const k = intensity;

    this.live = {
      state: this.current,
      previous: this.previous,
      timeInState: elapsed,
      blend: ramp(0, 0.5),
      headYawBias: towards(this.live.headYawBias, target.headYawBias, ramp(ONSET.head, 0.45)),
      headPitchBias: towards(this.live.headPitchBias, target.headPitchBias, ramp(ONSET.head, 0.45)),
      headRollBias: towards(this.live.headRollBias, target.headRollBias, ramp(ONSET.head, 0.45)),
      neckSupport: towards(this.live.neckSupport, target.neckSupport, ramp(ONSET.head, 0.45)),
      gazeYawBias: towards(this.live.gazeYawBias, target.gazeYawBias, ramp(ONSET.gaze, 0.3)),
      gazePitchBias: towards(this.live.gazePitchBias, target.gazePitchBias, ramp(ONSET.gaze, 0.3)),
      /**
       * The brow ramp is longer than the others (0.68 s against 0.45-0.7).
       *
       * `browInner` has the largest excursion of any channel — THOUGHTFUL sits
       * at 0.75 against SERIOUS_FOCUSED's 0.02 — so at the shared 0.5 s ramp the
       * SMILE->THOUGHTFUL, THOUGHTFUL->INTERESTED and INTERESTED->SERIOUS
       * transitions peaked at 0.067-0.076 influence per frame, over the
       * blink-derived snap bound of 0.064. Lengthening the ramp fixes the rate
       * without reducing the amplitude, which is what the hardware review asked
       * to keep.
       */
      browInner: towards(this.live.browInner, target.browInner * k, ramp(ONSET.brow, 0.68)),
      browOuter: towards(this.live.browOuter, target.browOuter * k, ramp(ONSET.brow, 0.68)),
      /**
       * Cheek gets the same treatment as the brow, for the same reason: its
       * largest excursion is SOFT_SMILE 0.85 down to THOUGHTFUL 0.12, which at
       * the shared ramp peaked at 0.067 per frame — just over the snap bound.
       */
      cheek: towards(this.live.cheek, target.cheek * k, ramp(ONSET.cheekLid, 0.78)),
      eyelid: towards(this.live.eyelid, target.eyelid * k, ramp(ONSET.cheekLid, 0.78)),
      smile: towards(this.live.smile, target.smile * k, ramp(ONSET.smile, 0.7)),
      /**
       * §P17.1 lower face. On the same onset as the smile, so the mouth
       * develops WITH the corner rather than after the upper face has already
       * finished — the "upper face expresses while the mouth stays dead"
       * complaint.
       */
      upperLip: towards(this.live.upperLip, target.upperLip * k, ramp(ONSET.smile, 0.7)),
      nasolabial: towards(this.live.nasolabial, target.nasolabial * k, ramp(ONSET.smile, 0.7)),
      lowerLip: towards(this.live.lowerLip, target.lowerLip * k, ramp(ONSET.smile, 0.75)),
      asymmetry: towards(this.live.asymmetry, target.asymmetry, ramp(ONSET.brow, 0.6)),
      asymmetrySide: this.side,
      transitionSpeed: target.transitionSpeed,
      gazeLeadSeconds: target.gazeLeadSeconds,
      eventWarmth: towards(this.live.eventWarmth, target.eventWarmth, ramp(ONSET.cheekLid, 0.6))
    };
    return this.live;
  }

  /** Seconds until the scheduler may change state again. 0 while held. */
  nextTransitionIn() {
    return this.held ? 0 : Math.max(0, this.holdUntil - this.time);
  }
}
