import type { BlendshapePose, HeadRotationTarget } from "../../types/facialAnimation";
import {
  hyper3dGazePose,
  hyper3dHeadNeckCalibration,
  calibrateHyper3dMorph
} from "../../mappings/avatars/hyper3dCalibration";
import { HYPER3D_RIG_PROFILE } from "../../mappings/avatars/hyper3dPerformanceProfile";
import type { HeadPose } from "./hyper3dTrajectory";
import { BehaviorRandom } from "../behaviour/naturalism/BehaviorRandom";
import { exponentialSmoothingAlpha } from "../../utils/lerp";
import { clamp } from "../../utils/clamp";
import { smoothstep } from "../../utils/easing";
import {
  RESTING_LID_CLOSURE,
  sampleEyelid
} from "./upstream/threejs-talking-avatar/performance";
import {
  ACTIVE_PRESENCE_BLINK,
  ACTIVE_PRESENCE_DEFAULT_SEED,
  ACTIVE_PRESENCE_EVENT_SECONDS,
  ACTIVE_PRESENCE_EVENT_WEIGHTS,
  ACTIVE_PRESENCE_FACE,
  ACTIVE_PRESENCE_FACE_CHANNELS,
  ACTIVE_PRESENCE_GAZE,
  ACTIVE_PRESENCE_GAZE_RAILS,
  ACTIVE_PRESENCE_HANDOFF,
  ACTIVE_PRESENCE_HEAD,
  ACTIVE_PRESENCE_HEAD_RAILS,
  ACTIVE_PRESENCE_MAX_CONSECUTIVE_HOLDS,
  ACTIVE_PRESENCE_UPPER_FACE,
  REAL_DEGREES_PER_ADAPTER_DEGREE,
  activePresenceNaturalMax,
  activePresenceUsefulMin,
  type ActivePresenceEventKind,
  type ActivePresenceUpperFaceVariant
} from "../../mappings/avatars/hyper3dActivePresenceProfile";

/**
 * HYPER3D ACTIVE PRESENCE — THE IDLE PERFORMANCE OWNER.
 *
 * P1.3 IS THE HARDWARE-ACCEPTED BASELINE. The behaviour in this file is locked:
 * `hyper3dActivePresenceBaseline.ts` holds the expected values and
 * `hyper3dActivePresenceBaselineContract.test.ts` asserts them, including four
 * independent hashes of the reviewed 60-second head, gaze, blink and face
 * traces. A change to any of them fails the build and names the region.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS
 * ─────────────────────────────────────────────────────────────────────────────
 * A behavioural layer for the periods when the avatar is NOT SPEAKING. It is not
 * an idle animation: there is no loop, no sine, no fixed interval and no clip.
 * ONE seeded planner emits occasional presence EVENTS, and each event decides
 * how much — if any — of the head, the gaze, the lids and the face moves.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES NOT TOUCH
 * ─────────────────────────────────────────────────────────────────────────────
 * The accepted speaking performance is frozen. This file imports exactly three
 * things from it, all of them READ-ONLY and none of them a speaking decision:
 *
 *   `sampleEyelid`          the accepted blink TRAJECTORY, so the idle blink is
 *                           the same shape rather than a second one
 *   `RESTING_LID_CLOSURE`   the accepted resting lid, so the eyes do not pop
 *                           open at the handoff
 *   `HYPER3D_RIG_PROFILE`   the accepted 70/30 head/neck rig split, read as
 *                           shares so an ordinary idle event is distributed by
 *                           exactly the numbers the accepted head uses
 *
 * It calls no planner, no performer, no conductor and no speaking constant. It
 * never names `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`, a viseme, a
 * bilabial seal or a tongue channel — see `ACTIVE_PRESENCE_FACE_CHANNELS`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNERSHIP — ONE VALUE PER CHANNEL PER FRAME
 * ─────────────────────────────────────────────────────────────────────────────
 * `resolveActivePresence` takes what the SPEAKING owner produced this frame and
 * returns what should actually be written. In `SPEAKING` it hands the speaking
 * values straight back, untouched and unblended. In `IDLE` it returns its own.
 * Across the bounded handoff window it returns ONE convex combination of the
 * two, computed here. There is therefore never a frame on which two layers each
 * contribute to the same channel — the caller writes a single value it was
 * given, and `frame.owner` says who decided it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Only `IDLE` and `SPEAKING` exist, because only those two have a verified
 * source in this application (see `conversationalPerformanceState.ts`).
 * `LISTENING` and `THINKING` are NOT invented here. When a real conversation
 * application supplies a user-turn or agent-processing signal, IDLE subdivides
 * inside this planner without any of this architecture changing.
 */

export const ACTIVE_PRESENCE_OWNER = "hyper3dActivePresence";

/**
 * WHY THE SHARED RANDOM SOURCE IS WARMED, AND WHY IT IS NOT MODIFIED.
 *
 * `BehaviorRandom` is the project's existing deterministic source and is reused
 * here rather than duplicated. Its per-name streams are xorshift32 seeded by an
 * FNV hash, and a freshly seeded xorshift32 has correlated LOW-ORDER OUTPUT for
 * its first few steps. That is not a theoretical concern: on the review seed the
 * `blink-long` stream opened 0.035, 0.079, 0.121, 0.094, 0.008, 0.214, 0.050 —
 * seven of eight draws under a 0.17 probability — which turned an "occasional
 * long gap" into EVERY gap and produced a 5-blinks-per-minute cadence with a
 * gap CV of 0.075. A near-constant interval is precisely the fixed-period
 * scheduler the brief forbids, arrived at by accident.
 *
 * `BehaviorRandom` itself is NOT changed: every accepted naturalism, blink,
 * gaze and stillness test depends on its exact sequences. Instead each named
 * stream is advanced `WARMUP_DRAWS` times the first time this planner touches
 * it. The source stays shared, the determinism is unaffected — the same seed
 * still gives the same plan — and the correlated opening is simply not used.
 */
const WARMUP_DRAWS = 12;

class PresenceRandom {
  private warmed = new Set<string>();
  constructor(private inner: BehaviorRandom) {}

  get seed() {
    return this.inner.seed;
  }

  private warm(name: string) {
    if (this.warmed.has(name)) return;
    this.warmed.add(name);
    for (let i = 0; i < WARMUP_DRAWS; i += 1) this.inner.next(name);
  }

  next(name: string) {
    this.warm(name);
    return this.inner.next(name);
  }

  chance(name: string, probability: number) {
    return this.next(name) < probability;
  }

  signAvoiding(name: string, avoid: -1 | 1 | 0) {
    this.warm(name);
    return this.inner.signAvoiding(name, avoid);
  }
}

/** The two states this application can prove. Nothing else is reachable. */
export type ActivePresenceState = "idle" | "speaking";

/** Who decided the values on a frame. */
export type ActivePresenceOwnership =
  /** Disabled, or a diagnostic holds the face. Speaking values pass through. */
  | "off"
  /** Speech is playing. The accepted speaking owner is untouched. */
  | "speaking"
  /** Speech has just stopped: returning to neutral engagement from the real pose. */
  | "settling"
  /** Active Presence owns the idle contribution outright. */
  | "idle"
  /** Speech has begun: handing the channels back over `releaseSeconds`. */
  | "releasing";

// ---------------------------------------------------------------------------
// the planner
// ---------------------------------------------------------------------------

export interface ActivePresenceEvent {
  readonly index: number;
  readonly kind: ActivePresenceEventKind;
  readonly start: number;
  readonly end: number;
  /** Absolute gaze departure target, adapter domain. Zero means "stay on camera". */
  readonly gaze: { readonly yaw: number; readonly pitch: number };
  /** When the eyes return to camera. Equal to `start` when there is no departure. */
  readonly gazeReturn: number;
  /** Delta applied to the head's orientation centre, in degrees of pose. */
  readonly head: HeadPose;
  /**
   * When the head delta ENGAGES, absolute seconds. On a coordinated attention
   * event this is 100-250 ms after the eyes move — the lead the brief asks for.
   * Equal to `start` for a posture change, which leads with the head.
   */
  readonly headAt: number;
  /**
   * When the head delta is WITHDRAWN, or `null` when it persists entirely.
   *
   * BOTH kinds of head event now have one. An attention shift withdraws its
   * whole head component after the eyes come home; a posture change withdraws
   * all but `headPersistentShare` of it after a brief hold. Before P1.4 a
   * posture change had no release at all and the head sat off-centre for a
   * measured mean of 18.23 s.
   */
  readonly headReleaseAt: number | null;
  /**
   * The fraction of the head delta that survives the release.
   *
   * 0 for an attention shift — a look leaves nothing behind. A small share for a
   * posture change, because a posture change genuinely is a change of posture.
   */
  readonly headPersistentShare: number;
  /** True for an uncommon strong reorientation. Changes size and neck share only. */
  readonly strong: boolean;
  /** 0 when the event carries no warmth. */
  readonly warmth: number;
  /** The upper-face variant riding this event, or `null`. */
  readonly upperFace: ActivePresenceUpperFaceVariant | null;
  /**
   * When the upper-face envelope STARTS, absolute seconds.
   *
   * Usually the event's own start, but a `SOFT_FOCUS` is timed to the moment
   * the eyes come home instead — the brief's "return-to-viewer -> brief
   * eye-softening". A facial response to an arrival has to land on the arrival.
   */
  readonly upperFaceAt: number;
  /**
   * The envelope's three durations, drawn per event: fade in, readable hold at
   * full value, fade out. Explicit durations rather than a smoothing constant,
   * so an expression is guaranteed to ARRIVE before it starts leaving.
   */
  readonly upperFaceFadeIn: number;
  readonly upperFaceHold: number;
  readonly upperFaceFadeOut: number;
  /** Human-readable reason, for the review panel. Never used for behaviour. */
  readonly reason: string;
}

export interface ActivePresenceBlink {
  readonly time: number;
  readonly double: boolean;
  /** True when this blink was placed BY a gaze shift rather than by the gap draw. */
  readonly coupledToShift: boolean;
}

export interface ActivePresencePlan {
  readonly seed: string;
  readonly durationSeconds: number;
  readonly events: readonly ActivePresenceEvent[];
  readonly blinks: readonly ActivePresenceBlink[];
}

/**
 * THE SHARED PLANNER.
 *
 * One instance, one seeded source, one cursor. Head, gaze, warmth and blink are
 * decided TOGETHER inside `nextEvent`, which is the whole reason the result does
 * not read as four independent random processes: a gaze departure can bring a
 * trace of head with it, a posture change can bring the eyes, and a blink can be
 * placed by an attention shift rather than by its own clock.
 *
 * `BehaviorRandom` is the project's existing deterministic source and is reused
 * rather than duplicated. Each decision draws from a NAMED stream, so adding a
 * draw to one behaviour never shifts another's sequence — the property the
 * existing naturalism tests already depend on.
 */
export class ActivePresencePlanner {
  private random: PresenceRandom;
  private cursor = 0;
  private index = 0;
  private nextBlinkAt = 0;
  private lastKind: ActivePresenceEventKind | null = null;
  private holdRun = 0;
  /** Set by a strong reorientation; claimed by the next eligible event. */
  private pendingReset = false;
  private lastGazeSign: -1 | 1 | 0 = 0;
  private lastHeadSign: -1 | 1 | 0 = 0;
  private lastBlinkAt = Number.NEGATIVE_INFINITY;
  private pendingBlinks: ActivePresenceBlink[] = [];

  constructor(private seedText: string = ACTIVE_PRESENCE_DEFAULT_SEED) {
    this.random = new PresenceRandom(new BehaviorRandom(seedText));
    this.primeBlink();
  }

  get seed() {
    return this.seedText;
  }

  /** Where the planner has decided up to. */
  get plannedUntil() {
    return this.cursor;
  }

  reset(seedText = this.seedText, startTime = 0) {
    this.seedText = seedText;
    this.random = new PresenceRandom(new BehaviorRandom(seedText));
    this.cursor = startTime;
    this.index = 0;
    this.lastKind = null;
    this.holdRun = 0;
    this.pendingReset = false;
    this.lastGazeSign = 0;
    this.lastHeadSign = 0;
    this.lastBlinkAt = Number.NEGATIVE_INFINITY;
    this.pendingBlinks = [];
    this.nextBlinkAt = startTime;
    this.primeBlink();
  }

  /**
   * The first blink is drawn from the ordinary gap distribution rather than
   * being placed at zero, so entering idle never starts with a blink.
   */
  private primeBlink() {
    this.nextBlinkAt = this.cursor + this.drawBlinkGap();
  }

  /**
   * ONE DRAW, TWO BRANCHES — inverse transform over the gap mixture.
   *
   * The long-gap branch is not a separate `chance()` on a second stream. A
   * single uniform decides both WHICH branch and WHERE inside it, so the two
   * cannot correlate with each other and there is one less stream whose opening
   * has to be trusted. It is also exactly how a mixture distribution is
   * sampled, rather than two coupled coin flips.
   */
  private drawBlinkGap() {
    const b = ACTIVE_PRESENCE_BLINK;
    const u = this.random.next("blink-gap");
    if (u < b.longGapProbability) {
      const inner = u / b.longGapProbability;
      return b.longGapMinSeconds + inner * b.longGapRangeSeconds;
    }
    const inner = (u - b.longGapProbability) / (1 - b.longGapProbability);
    return b.gapMinSeconds + inner * b.gapRangeSeconds;
  }

  /**
   * Draws a kind from the weighted mix, then rejects an immediate repeat of a
   * MOVING kind once. Two posture adjustments back to back read as a gesture,
   * and two attention shifts back to back are exactly the ping-pong the brief
   * rules out. HOLD may repeat freely: consecutive holds are long stillness,
   * which is the point.
   */
  private drawKind(): ActivePresenceEventKind {
    const pick = (streamName: string, excludeHold: boolean): ActivePresenceEventKind => {
      const entries = Object.entries(ACTIVE_PRESENCE_EVENT_WEIGHTS).filter(
        ([kind]) => !excludeHold || kind !== "HOLD"
      );
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      const roll = this.random.next(streamName) * total;
      let acc = 0;
      for (const [kind, weight] of entries) {
        acc += weight;
        if (roll < acc) return kind as ActivePresenceEventKind;
      }
      return entries.length ? (entries[entries.length - 1][0] as ActivePresenceEventKind) : "HOLD";
    };
    // After a run of quiet events, HOLD is excluded from the draw entirely.
    const excludeHold = this.holdRun >= ACTIVE_PRESENCE_MAX_CONSECUTIVE_HOLDS;
    const first = pick("event-kind", excludeHold);
    // A MOVING kind never repeats immediately: two posture adjustments in a row
    // read as a gesture, and two attention shifts in a row are the ping-pong the
    // brief rules out. HOLD may repeat, up to the run cap above.
    if (first !== "HOLD" && first === this.lastKind) return pick("event-kind-retry", excludeHold);
    return first;
  }

  /** The next event, and any blinks that fall inside it. Deterministic. */
  nextEvent(): ActivePresenceEvent {
    const kind = this.drawKind();
    const span = ACTIVE_PRESENCE_EVENT_SECONDS[kind];
    const duration = span.min + this.random.next(`event-duration-${kind}`) * span.range;
    const start = this.cursor;
    const end = start + duration;

    let gaze = { yaw: 0, pitch: 0 };
    let gazeReturn = start;
    let head: HeadPose = { yaw: 0, pitch: 0, roll: 0 };
    let headAt = start;
    let headReleaseAt: number | null = null;
    let headPersistentShare = 0;
    let strong = false;
    let warmth = 0;
    let upperFace: ActivePresenceUpperFaceVariant | null = null;
    /**
     * Where the facial envelope starts. Overridden to the gaze return for a
     * `SOFT_FOCUS`, which is a response to the eyes coming home.
     */
    let upperFaceAt = start;
    let reason = "quiet hold";

    if (kind === "ATTENTION_SHIFT") {
      const g = ACTIVE_PRESENCE_GAZE;
      const h = ACTIVE_PRESENCE_HEAD;
      // `signAvoiding` is the existing anti-ping-pong draw: it favours the side
      // opposite the last departure without ever guaranteeing it.
      const sign = this.random.signAvoiding("gaze-side", this.lastGazeSign);
      this.lastGazeSign = sign;
      const yaw = sign * (g.yawMinDegrees + this.random.next("gaze-yaw") * g.yawRangeDegrees);
      const flat = this.random.chance("gaze-flat", g.flatProbability);
      const pitch = flat
        ? 0
        : (this.random.next("gaze-pitch-sign") < 0.5 ? -1 : 1) *
          (g.pitchFloorShare + (1 - g.pitchFloorShare) * this.random.next("gaze-pitch")) *
          g.pitchRangeDegrees;
      gaze = { yaw, pitch };
      gazeReturn =
        start + g.holdMinSeconds + this.random.next("gaze-hold") * g.holdRangeSeconds;
      if (this.random.chance("gaze-head-companion", g.headCompanionProbability)) {
        /**
         * EYES LEAD, HEAD FOLLOWS PARTIALLY, THEN SETTLES BACK.
         *
         * The head engages `gazeLead` after the eyes and is withdrawn
         * `returnLag` after they come home, so the whole gesture reads as one
         * intention with a natural ordering rather than two things moving at
         * once. Both delays are drawn here, by this planner, from its own
         * streams — there is no second scheduler and no timer.
         */
        headAt =
          start + h.gazeLeadMinSeconds + this.random.next("gaze-lead") * h.gazeLeadRangeSeconds;
        headReleaseAt =
          gazeReturn +
          h.returnLagMinSeconds +
          this.random.next("gaze-return-lag") * h.returnLagRangeSeconds;
        // A look leaves nothing behind.
        headPersistentShare = 0;
        head = {
          yaw: sign * h.yawDeltaDegrees * g.headCompanionScale,
          pitch:
            (pitch >= 0 ? 1 : -1) *
            h.pitchDeltaDegrees *
            g.headCompanionScale *
            this.random.next("gaze-head-pitch"),
          roll: 0
        };
        reason = "attention shift, eyes lead and head follows";
        // The upper face may SUPPORT a coordinated attention event, lightly.
        if (this.random.chance("upper-curious", ACTIVE_PRESENCE_UPPER_FACE.curiousProbability)) {
          upperFace = "CURIOUS_RESPONSE";
        }
      } else {
        reason = "attention shift, eyes alone";
        if (this.random.chance("upper-soft-focus", ACTIVE_PRESENCE_UPPER_FACE.softFocusProbability)) {
          upperFace = "SOFT_FOCUS";
          // RETURN TO VIEWER -> a brief eye-softening. The response belongs on
          // the arrival, not on the departure that preceded it.
          upperFaceAt = gazeReturn;
          reason = "attention shift, eyes alone, softening on return";
        }
      }
      // BLINK COUPLING. Placed by the shift, inside the shift, when the coupling
      // draw and the separation rule both allow it.
      if (this.random.chance("blink-couple", ACTIVE_PRESENCE_BLINK.shiftCouplingProbability)) {
        const at =
          start +
          ACTIVE_PRESENCE_BLINK.shiftCouplingMinSeconds +
          this.random.next("blink-couple-offset") * ACTIVE_PRESENCE_BLINK.shiftCouplingRangeSeconds;
        this.placeBlink(at, true);
      }
    } else if (kind === "POSTURE_ADJUST") {
      const h = ACTIVE_PRESENCE_HEAD;
      strong = this.random.chance("head-strong", h.strongProbability);
      const sign = this.random.signAvoiding("head-side", this.lastHeadSign);
      this.lastHeadSign = sign;
      const single = this.random.chance("head-single-axis", h.singleAxisProbability);
      const yawShare = this.random.next("head-yaw");
      const pitchShare = this.random.next("head-pitch");
      // One axis suppressed makes an adjustment read as a single settle rather
      // than a compound move. Which axis survives is itself a draw.
      const dropPitch =
        single && this.random.next("head-axis-choice") < h.singleAxisDropsPitchProbability;
      const dropYaw = single && !dropPitch;
      /**
       * The share is drawn on [floor, 1], not [0, 1]. Same draw, same order;
       * only how far the head is asked to go changes. See `adjustmentShareFloor`.
       */
      const floored = (share: number) =>
        h.adjustmentShareFloor + (1 - h.adjustmentShareFloor) * share;
      const yawPeak = strong ? h.strongYawDeltaDegrees : h.yawDeltaDegrees;
      const pitchPeak = strong ? h.strongPitchDeltaDegrees : h.pitchDeltaDegrees;
      const rollPeak = strong ? h.strongRollDeltaDegrees : h.rollDeltaDegrees;
      head = {
        yaw: dropYaw ? 0 : sign * yawPeak * floored(yawShare),
        pitch: dropPitch
          ? 0
          : (this.random.next("head-pitch-sign") < 0.5 ? -1 : 1) * pitchPeak * floored(pitchShare),
        // Roll trails the yaw's side and stays the most restrained axis.
        roll: sign * rollPeak * floored(this.random.next("head-roll")) * 0.45
      };
      /**
       * DEPART, HOLD BRIEFLY, RETURN — P1.4.
       *
       * The hold is drawn on its own named stream, so the event plan, the
       * durations and the whole blink schedule are untouched by its existence.
       * A strong reorientation is allowed a longer hold than an ordinary one,
       * but still under about a second and a quarter.
       */
      const holdMin = strong ? h.strongPostureHoldMinSeconds : h.postureHoldMinSeconds;
      const holdRange = strong ? h.strongPostureHoldRangeSeconds : h.postureHoldRangeSeconds;
      // Measured from ARRIVAL, not from the event start — see `postureTravelSeconds`.
      headReleaseAt =
        start + h.postureTravelSeconds + holdMin + this.random.next("posture-hold") * holdRange;
      headPersistentShare = h.posturePersistentShare;
      reason = strong
        ? "strong reorientation"
        : single
          ? "posture adjust, single axis"
          : "posture adjust";
      if (this.random.chance("head-gaze-companion", h.gazeCompanionProbability)) {
        const g = ACTIVE_PRESENCE_GAZE;
        gaze = {
          yaw: sign * (g.yawMinDegrees + this.random.next("head-gaze-yaw") * g.yawRangeDegrees * 0.6),
          pitch: 0
        };
        gazeReturn =
          start + g.holdMinSeconds + this.random.next("head-gaze-hold") * g.holdRangeSeconds;
        reason = strong ? "strong reorientation, eyes follow" : "posture adjust, eyes follow";
      }
      /**
       * ACTIVITY BUDGET. A strong reorientation carries NO upper face and no
       * warmth: the head is the event. The next event picks up an
       * ATTENTIVE_RESET instead, so the face comes back afterwards rather than
       * competing during.
       *
       * P1.3 extends the same offer to an ORDINARY posture settle, at a
       * probability well under a half, so a posture change is SOMETIMES
       * followed by the face settling too — never always.
       */
      if (
        strong ||
        this.random.chance("upper-posture-reset", ACTIVE_PRESENCE_UPPER_FACE.postureResetProbability)
      ) {
        this.pendingReset = true;
      }
    } else if (kind === "SOFT_WARMTH") {
      const f = ACTIVE_PRESENCE_FACE;
      warmth = f.strengthMin + this.random.next("warmth-strength") * f.strengthRange;
      // Warmth ALWAYS brings the brows with it. A smile that moves only the
      // mouth is the "only the lips were pulled" reading the brief rules out.
      upperFace = "ATTENTIVE_WARMTH";
      reason = "soft warmth";
      // ACTIVITY BUDGET: a visible warmth event carries no head displacement.
      // `head` is left at zero, which is what keeps the two from colliding.
    }

    /**
     * ATTENTIVE_RESET — the face returning after a strong reorientation.
     *
     * Claimed by the FIRST event after the strong one that is not already
     * carrying a variant, so it is a consequence of the reorientation rather
     * than an independently scheduled twitch.
     */
    if (this.pendingReset && kind !== "POSTURE_ADJUST" && !upperFace) {
      upperFace = "ATTENTIVE_RESET";
      this.pendingReset = false;
      reason = reason === "quiet hold" ? "settling attention after reorientation" : reason;
    }

    /**
     * THE FACIAL ENVELOPE'S DURATIONS.
     *
     * Drawn on their own named streams. `BehaviorRandom` advances each named
     * stream independently, which is why P1.3 can add facial decisions without
     * moving a single head, gaze, blink or timing value — proved bit-identical
     * in `hyper3dActivePresenceFaceLife.test.ts`.
     */
    const u = ACTIVE_PRESENCE_UPPER_FACE;
    const upperFaceFadeIn =
      u.fadeInMinSeconds + this.random.next("upper-fade-in") * u.fadeInRangeSeconds;
    const upperFaceHold = u.holdMinSeconds + this.random.next("upper-hold") * u.holdRangeSeconds;
    const upperFaceFadeOut =
      u.fadeOutMinSeconds + this.random.next("upper-fade-out") * u.fadeOutRangeSeconds;

    // Blinks scheduled by their own gap, inside this event's span.
    while (this.nextBlinkAt < end) {
      this.placeBlink(this.nextBlinkAt, false);
      this.nextBlinkAt += this.drawBlinkGap();
    }

    this.lastKind = kind;
    this.holdRun = kind === "HOLD" ? this.holdRun + 1 : 0;
    this.cursor = end;
    const event: ActivePresenceEvent = {
      index: this.index,
      kind,
      start,
      end,
      gaze,
      gazeReturn,
      head,
      headAt,
      headReleaseAt,
      headPersistentShare,
      strong,
      warmth,
      upperFace,
      upperFaceAt,
      upperFaceFadeIn,
      upperFaceHold,
      upperFaceFadeOut,
      reason
    };
    this.index += 1;
    return event;
  }

  private placeBlink(time: number, coupledToShift: boolean) {
    if (time - this.lastBlinkAt < ACTIVE_PRESENCE_BLINK.minSeparationSeconds) return;
    this.lastBlinkAt = time;
    this.pendingBlinks.push({
      time,
      double: this.random.chance("blink-double", ACTIVE_PRESENCE_BLINK.doubleProbability),
      coupledToShift
    });
    // A coupled blink resets the ordinary gap, so coupling never produces a
    // burst: the next scheduled blink is a full gap away from THIS one.
    if (coupledToShift && this.nextBlinkAt < time + ACTIVE_PRESENCE_BLINK.minSeparationSeconds) {
      this.nextBlinkAt = time + this.drawBlinkGap();
    }
  }

  /** Blinks decided since the last drain. The director consumes these. */
  drainBlinks(): ActivePresenceBlink[] {
    const blinks = this.pendingBlinks;
    this.pendingBlinks = [];
    return blinks;
  }
}

/**
 * A COMPLETE, REPLAYABLE PLAN — the deterministic hardware review, and the
 * subject of the periodicity analysis.
 *
 * Pure: same seed and duration in, byte-identical plan out, with no clock, no
 * `Math.random` and no reliance on frame rate.
 */
export const planActivePresence = (
  seed: string,
  durationSeconds: number
): ActivePresencePlan => {
  const planner = new ActivePresencePlanner(seed);
  const events: ActivePresenceEvent[] = [];
  const blinks: ActivePresenceBlink[] = [];
  while (planner.plannedUntil < durationSeconds) {
    events.push(planner.nextEvent());
    blinks.push(...planner.drainBlinks());
  }
  return {
    seed,
    durationSeconds,
    events,
    blinks: blinks.filter((blink) => blink.time <= durationSeconds)
  };
};

// ---------------------------------------------------------------------------
// plan statistics — the stillness measurements the brief asks for
// ---------------------------------------------------------------------------

export interface ActivePresencePlanStatistics {
  readonly seed: string;
  readonly durationSeconds: number;
  readonly eventCount: number;
  readonly eventsPerMinute: number;
  readonly kindCounts: Record<ActivePresenceEventKind, number>;
  /** Share of the plan's wall time spent in an event that moves nothing. */
  readonly quietShare: number;
  readonly longestQuietSeconds: number;
  readonly meanEventSeconds: number;
  readonly blinkCount: number;
  readonly blinksPerMinute: number;
  readonly blinkGapMin: number;
  readonly blinkGapMax: number;
  readonly blinkGapMean: number;
  /** Coefficient of variation of the blink gaps. A fixed cadence would be 0. */
  readonly blinkGapCv: number;
  readonly doubleBlinks: number;
  readonly coupledBlinks: number;
  readonly gazeDepartures: number;
  readonly postureAdjustments: number;
  readonly warmthEvents: number;
  /** Uncommon strong reorientations. */
  readonly strongEvents: number;
  /** Coordinated events where the eyes move first and the head follows. */
  readonly eyeLeadEvents: number;
  readonly meanGazeLeadSeconds: number;
  /** Upper-face events, by variant. */
  readonly upperFaceEvents: number;
  readonly upperFaceByVariant: Record<string, number>;
  /**
   * Largest normalised autocorrelation of the event-onset train at any non-zero
   * lag. A looped or fixed-period schedule spikes toward 1; an irregular one
   * stays low. This is the periodicity analysis, not a claim about it.
   */
  readonly peakOnsetAutocorrelation: number;
  readonly peakOnsetLagSeconds: number;
}

export const analyseActivePresencePlan = (
  plan: ActivePresencePlan
): ActivePresencePlanStatistics => {
  const kindCounts = {
    HOLD: 0,
    ATTENTION_SHIFT: 0,
    POSTURE_ADJUST: 0,
    SOFT_WARMTH: 0,
    SETTLE: 0
  } as Record<ActivePresenceEventKind, number>;
  let quiet = 0;
  let longestQuiet = 0;
  let run = 0;
  let total = 0;
  for (const event of plan.events) {
    kindCounts[event.kind] += 1;
    const span = Math.min(event.end, plan.durationSeconds) - event.start;
    if (span <= 0) continue;
    total += span;
    const moves =
      event.gaze.yaw !== 0 ||
      event.gaze.pitch !== 0 ||
      event.head.yaw !== 0 ||
      event.head.pitch !== 0 ||
      event.head.roll !== 0 ||
      event.warmth !== 0;
    if (moves) {
      run = 0;
    } else {
      quiet += span;
      run += span;
      longestQuiet = Math.max(longestQuiet, run);
    }
  }
  /** Events where the head is deferred behind the eyes, and by how long. */
  const leads = plan.events
    .filter((event) => event.headAt > event.start)
    .map((event) => event.headAt - event.start);
  const gaps = plan.blinks.slice(1).map((blink, i) => blink.time - plan.blinks[i].time);
  const gapMean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const gapVariance = gaps.length
    ? gaps.reduce((a, b) => a + (b - gapMean) ** 2, 0) / gaps.length
    : 0;

  /**
   * ONSET AUTOCORRELATION. The event onsets are rendered as an impulse train at
   * 20 Hz and correlated against themselves at every lag from 0.5 s to half the
   * plan. Zero-mean, so a constant offset cannot manufacture correlation.
   */
  const rate = 20;
  const bins = Math.ceil(plan.durationSeconds * rate);
  const train = new Array<number>(bins).fill(0);
  for (const event of plan.events) {
    const bin = Math.floor(event.start * rate);
    if (bin >= 0 && bin < bins) train[bin] = 1;
  }
  const mean = train.reduce((a, b) => a + b, 0) / Math.max(1, bins);
  const centred = train.map((v) => v - mean);
  const energy = centred.reduce((a, b) => a + b * b, 0);
  let peak = 0;
  let peakLag = 0;
  for (let lag = Math.floor(0.5 * rate); lag < Math.floor(bins / 2); lag += 1) {
    let acc = 0;
    for (let i = 0; i + lag < bins; i += 1) acc += centred[i] * centred[i + lag];
    const normalised = energy > 0 ? acc / energy : 0;
    if (normalised > peak) {
      peak = normalised;
      peakLag = lag / rate;
    }
  }

  return {
    seed: plan.seed,
    durationSeconds: plan.durationSeconds,
    eventCount: plan.events.length,
    eventsPerMinute: (plan.events.length / plan.durationSeconds) * 60,
    kindCounts,
    quietShare: total > 0 ? quiet / total : 0,
    longestQuietSeconds: longestQuiet,
    meanEventSeconds: plan.events.length ? total / plan.events.length : 0,
    blinkCount: plan.blinks.length,
    blinksPerMinute: (plan.blinks.length / plan.durationSeconds) * 60,
    blinkGapMin: gaps.length ? Math.min(...gaps) : 0,
    blinkGapMax: gaps.length ? Math.max(...gaps) : 0,
    blinkGapMean: gapMean,
    blinkGapCv: gapMean > 0 ? Math.sqrt(gapVariance) / gapMean : 0,
    doubleBlinks: plan.blinks.filter((b) => b.double).length,
    coupledBlinks: plan.blinks.filter((b) => b.coupledToShift).length,
    gazeDepartures: plan.events.filter((e) => e.gaze.yaw !== 0 || e.gaze.pitch !== 0).length,
    postureAdjustments: plan.events.filter(
      (e) => e.head.yaw !== 0 || e.head.pitch !== 0 || e.head.roll !== 0
    ).length,
    warmthEvents: plan.events.filter((e) => e.warmth > 0).length,
    strongEvents: plan.events.filter((e) => e.strong).length,
    eyeLeadEvents: leads.length,
    meanGazeLeadSeconds: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0,
    upperFaceEvents: plan.events.filter((e) => e.upperFace).length,
    upperFaceByVariant: plan.events.reduce<Record<string, number>>((acc, e) => {
      if (e.upperFace) acc[e.upperFace] = (acc[e.upperFace] ?? 0) + 1;
      return acc;
    }, {}),
    peakOnsetAutocorrelation: peak,
    peakOnsetLagSeconds: peakLag
  };
};

// ---------------------------------------------------------------------------
// the director
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

/**
 * Degrees of pose -> bone radians, through the SAME per-asset head/neck
 * calibration the accepted speaking owner uses.
 *
 * Deliberately a local function rather than an import from the speaking
 * adapter: the idle trajectory SOURCE must be separate, and a shared conversion
 * would couple the two. `hyper3dActivePresence.test.ts` asserts this produces
 * bit-identical radians to the accepted conversion for the same degrees, so the
 * separation cannot drift into a discrepancy.
 */
export const activePresenceBoneRadians = (pose: HeadPose, neck: boolean): HeadRotationTarget => {
  const k = hyper3dHeadNeckCalibration;
  const neckScale = neck ? k.neckScale : 1;
  return {
    pitch: pose.pitch * DEG * k.pitchScale * neckScale,
    yaw: pose.yaw * DEG * k.yawScale * neckScale,
    roll: pose.roll * DEG * k.rollScale * neckScale
  };
};

/** What the accepted speaking owner produced this frame, in its own units. */
export interface ActivePresenceSpeakingFrame {
  readonly head: HeadRotationTarget;
  readonly neck: HeadRotationTarget;
  /** Adapter-domain gaze, the units `hyper3dGazePose` takes. */
  readonly gazeYawDegrees: number;
  readonly gazePitchDegrees: number;
  /** Calibrated eyelid influence, blink and resting lid already composited. */
  readonly blinkLeft: number;
  readonly blinkRight: number;
  /** The speaking warmth pose, already calibrated. Only the shared channels are read. */
  readonly facePose: BlendshapePose;
}

export interface ActivePresenceInput {
  readonly state: ActivePresenceState;
  readonly deltaSeconds: number;
  readonly enabled: boolean;
  readonly speaking: ActivePresenceSpeakingFrame;
}

export interface ActivePresenceTelemetry {
  readonly owner: string;
  readonly state: ActivePresenceState;
  readonly ownership: ActivePresenceOwnership;
  readonly seed: string;
  readonly enabled: boolean;
  /** Seconds since this director entered idle. Zero while speaking. */
  readonly idleSeconds: number;
  readonly eventKind: ActivePresenceEventKind | null;
  /** True while the current event is an uncommon strong reorientation. */
  readonly eventStrong: boolean;
  /** The upper-face variant riding the current event, and its envelope level. */
  readonly upperFaceVariant: ActivePresenceUpperFaceVariant | null;
  readonly upperFaceLevel: number;
  /** Seconds the head lags the eyes on the current event. 0 when it leads. */
  readonly gazeLeadSeconds: number;
  /** The neck's share of the pose this frame: accepted, or the strong split. */
  readonly neckShare: { yaw: number; pitch: number; roll: number };
  readonly eventReason: string;
  readonly eventAgeSeconds: number;
  readonly eventIndex: number;
  readonly nextEventKind: ActivePresenceEventKind | null;
  readonly nextEventInSeconds: number;
  /** Degrees of POSE, before the rig split. What a reviewer should read. */
  readonly headDegrees: HeadPose;
  readonly headBoneDegrees: HeadPose;
  readonly neckBoneDegrees: HeadPose;
  /** Adapter domain, and the visual eyeball rotation it corresponds to. */
  readonly gazeYawDegrees: number;
  readonly gazePitchDegrees: number;
  readonly gazeVisualYawDegrees: number;
  readonly gazeVisualPitchDegrees: number;
  readonly gazeEngaged: boolean;
  readonly blink: number;
  readonly nextBlinkInSeconds: number;
  readonly blinkDouble: boolean;
  /** The idle facial presence above the accepted resting tone, 0-1. */
  readonly warmth: number;
  readonly facePose: BlendshapePose;
  /** 1 = Active Presence owns the frame outright; 0 = the speaking owner does. */
  readonly blend: number;
  readonly reason: string;
}

export interface ActivePresenceFrame {
  readonly head: HeadRotationTarget;
  readonly neck: HeadRotationTarget;
  readonly gazeYawDegrees: number;
  readonly gazePitchDegrees: number;
  /**
   * Every morph influence to WRITE this frame: gaze, blink and the idle facial
   * presence, already calibrated. Only channels from the gaze list, the blink
   * pair and `ACTIVE_PRESENCE_FACE_CHANNELS` can appear.
   */
  readonly facePose: BlendshapePose;
  readonly ownership: ActivePresenceOwnership;
  /** True while Active Presence is contributing anything at all. */
  readonly owns: boolean;
  readonly telemetry: ActivePresenceTelemetry;
}

const ZERO_HEAD: HeadPose = { yaw: 0, pitch: 0, roll: 0 };

/**
 * The ACCEPTED rig distribution, as neck shares.
 *
 * Read from `HYPER3D_RIG_PROFILE` rather than restated, so an ordinary idle
 * event is split by exactly the same numbers the accepted speaking head uses and
 * the two can never drift apart.
 */
const HYPER3D_RIG_PROFILE_SHARES = {
  yaw: HYPER3D_RIG_PROFILE.yaw.neck,
  pitch: HYPER3D_RIG_PROFILE.pitch.neck,
  roll: HYPER3D_RIG_PROFILE.roll.neck
};

/**
 * Splits ONE pose across the two bones at a given neck share.
 *
 * The head takes the remainder, always, so the two shares sum to exactly 1 and
 * the neck can never carry a rotation the head did not ask for. At the accepted
 * shares this is `distributeToRig` by identity — asserted in the tests — and the
 * only thing a strong reorientation changes is where the same number is split.
 */
const distributeIdlePose = (
  pose: HeadPose,
  neckShare: { yaw: number; pitch: number; roll: number }
) => ({
  head: {
    yaw: pose.yaw * (1 - neckShare.yaw),
    pitch: pose.pitch * (1 - neckShare.pitch),
    roll: pose.roll * (1 - neckShare.roll)
  },
  neck: {
    yaw: pose.yaw * neckShare.yaw,
    pitch: pose.pitch * neckShare.pitch,
    roll: pose.roll * neckShare.roll
  }
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpRotation = (
  a: HeadRotationTarget,
  b: HeadRotationTarget,
  t: number
): HeadRotationTarget => ({
  pitch: lerp(a.pitch, b.pitch, t),
  yaw: lerp(a.yaw, b.yaw, t),
  roll: lerp(a.roll, b.roll, t)
});

/**
 * THE IDLE PERFORMER.
 *
 * One instance per mounted avatar. Everything it exposes is derived from its own
 * planner and its own smoothers; it holds no reference to any speaking object.
 */
export class ActivePresenceDirector {
  private planner: ActivePresencePlanner;
  private time = 0;
  private idleSeconds = 0;
  private event: ActivePresenceEvent | null = null;
  private next: ActivePresenceEvent | null = null;
  private blinks: ActivePresenceBlink[] = [];

  /**
   * The head's slowly-moving orientation centre, in degrees of pose. A POSTURE
   * event moves this and leaves it moved; the recentring brings it home.
   */
  private centre: HeadPose = { ...ZERO_HEAD };
  /**
   * The TRANSIENT head offset carried by a coordinated attention event.
   *
   * Held separately from `centre` for one reason: a look is not a posture. The
   * head goes part of the way the eyes went, holds, and comes back — so this
   * offset engages at `headAt`, is withdrawn at `headReleaseAt`, and never
   * becomes part of where the head lives.
   */
  private transient: HeadPose = { ...ZERO_HEAD };
  private transientTarget: HeadPose = { ...ZERO_HEAD };
  /** The rendered head pose, following `centre` + `transient`. */
  private head: HeadPose = { ...ZERO_HEAD };
  /** Whether the current event's persistent delta has been folded in yet. */
  private centreApplied = true;
  /** The neck's share of the pose this frame. Ordinary or strong, never its own. */
  private neckShare: { yaw: number; pitch: number; roll: number } = {
    ...HYPER3D_RIG_PROFILE_SHARES
  };

  /**
   * Upper-face envelope, driven by the same event plan.
   *
   * An explicit fade-in / hold / fade-out rather than a smoothing constant, so
   * the shape is guaranteed to ARRIVE at full value and stay there for a
   * readable stretch before it leaves. `upperFrom` is the absolute start.
   */
  private upperFace: ActivePresenceUpperFaceVariant | null = null;
  private upperLevel = 0;
  private upperFrom = Number.POSITIVE_INFINITY;
  private upperFadeIn = 0;
  private upperHold = 0;
  private upperFadeOut = 0;

  private gazeYaw = 0;
  private gazePitch = 0;

  private warmth = 0;
  private warmthTarget = 0;
  private warmthReleaseAt = Number.POSITIVE_INFINITY;

  private ownership: ActivePresenceOwnership = "off";
  private blend = 0;
  private wasSpeaking = false;
  private settleUntil = 0;
  private reason = "not started";

  constructor(seed: string = ACTIVE_PRESENCE_DEFAULT_SEED) {
    this.planner = new ActivePresencePlanner(seed);
  }

  get seed() {
    return this.planner.seed;
  }

  /**
   * Full reset. Used by RESET PRESENCE and by the deterministic review, so a
   * replay of the same seed produces the same minute every time.
   */
  reset(seed = this.planner.seed) {
    this.planner.reset(seed, 0);
    this.time = 0;
    this.idleSeconds = 0;
    this.event = null;
    this.next = null;
    this.blinks = [];
    this.centre = { ...ZERO_HEAD };
    this.transient = { ...ZERO_HEAD };
    this.transientTarget = { ...ZERO_HEAD };
    this.head = { ...ZERO_HEAD };
    this.centreApplied = true;
    this.neckShare = { ...HYPER3D_RIG_PROFILE_SHARES };
    this.upperFace = null;
    this.upperLevel = 0;
    this.upperFrom = Number.POSITIVE_INFINITY;
    this.gazeYaw = 0;
    this.gazePitch = 0;
    this.warmth = 0;
    this.warmthTarget = 0;
    this.warmthReleaseAt = Number.POSITIVE_INFINITY;
    this.ownership = "off";
    this.blend = 0;
    this.wasSpeaking = false;
    this.settleUntil = 0;
    this.reason = "reset";
  }

  /**
   * SPEAKING -> IDLE. Called on the frame speech stops.
   *
   * Active Presence initialises from the pose that is ACTUALLY RENDERED rather
   * than from zero: the head centre starts where the speaking head left the
   * bones, the eyes start where the speaking gaze left them, and warmth starts
   * at whatever the speaking face was carrying. Then a SETTLE event runs those
   * back to neutral engagement with the ordinary smoothers, so nothing snaps.
   *
   * The planner is NOT reset here — resetting it on every utterance would make
   * the first minute after every clip identical, which is its own kind of loop.
   */
  private adoptFromSpeaking(speaking: ActivePresenceSpeakingFrame) {
    const k = hyper3dHeadNeckCalibration;
    // Bone radians back to degrees of pose. `distributeToRig` gave the head 70%
    // of yaw/pitch and 80% of roll, so the inverse recovers the pose the
    // speaking owner asked for rather than the bone's share of it.
    const headShare = { yaw: 0.7, pitch: 0.7, roll: 0.8 };
    this.head = {
      yaw: speaking.head.yaw / DEG / k.yawScale / headShare.yaw,
      pitch: speaking.head.pitch / DEG / k.pitchScale / headShare.pitch,
      roll: speaking.head.roll / DEG / k.rollScale / headShare.roll
    };
    // Clamped to the idle rails on entry: a speaking pose can legitimately be
    // outside them, and the settle is what brings it in.
    this.centre = { ...ZERO_HEAD };
    this.transient = { ...ZERO_HEAD };
    this.transientTarget = { ...ZERO_HEAD };
    this.centreApplied = true;
    this.neckShare = { ...HYPER3D_RIG_PROFILE_SHARES };
    this.upperFace = null;
    this.upperLevel = 0;
    this.upperFrom = Number.POSITIVE_INFINITY;
    this.gazeYaw = speaking.gazeYawDegrees;
    this.gazePitch = speaking.gazePitchDegrees;
    this.warmth = 0;
    this.warmthTarget = 0;
    this.warmthReleaseAt = Number.POSITIVE_INFINITY;
    this.settleUntil = this.time + ACTIVE_PRESENCE_HANDOFF.settleSeconds;
    // The SETTLE event is INJECTED, never drawn: it exists because speech ended,
    // not because the scheduler chose it.
    this.event = {
      index: -1,
      kind: "SETTLE",
      start: this.time,
      end: this.settleUntil,
      gaze: { yaw: 0, pitch: 0 },
      gazeReturn: this.time,
      head: { ...ZERO_HEAD },
      headAt: this.time,
      headReleaseAt: null,
      headPersistentShare: 0,
      strong: false,
      warmth: 0,
      upperFace: null,
      upperFaceAt: this.time,
      upperFaceFadeIn: ACTIVE_PRESENCE_UPPER_FACE.fadeInMinSeconds,
      upperFaceHold: ACTIVE_PRESENCE_UPPER_FACE.holdMinSeconds,
      upperFaceFadeOut: ACTIVE_PRESENCE_UPPER_FACE.fadeOutMinSeconds,
      reason: "settling out of speech"
    };
    this.next = null;
    this.idleSeconds = 0;
  }

  /** Pulls the next planned event and folds its head delta into the centre. */
  private advance() {
    const event = this.next ?? this.planner.nextEvent();
    this.blinks.push(...this.planner.drainBlinks());
    this.event = event;
    this.next = null;
    /**
     * The head delta is NOT applied here. It is applied at `event.headAt`, which
     * for a coordinated attention event is 100-250 ms after the eyes move — the
     * lead the brief asks for. `centreApplied` tracks whether this event's
     * persistent delta has landed yet.
     */
    this.centreApplied = !(event.head.yaw || event.head.pitch || event.head.roll);
    // A strong reorientation shifts more of the SAME pose onto the neck.
    this.neckShare = event.strong
      ? { ...ACTIVE_PRESENCE_HEAD.strongNeckShare }
      : { ...HYPER3D_RIG_PROFILE_SHARES };
    /**
     * EXPRESSIONS DO NOT STACK.
     *
     * A new variant is armed only when the previous envelope has fully
     * released. Overwriting a running one replaced the rendered shape between
     * two frames — measured as a 0.062 step on `browOuterUpLeft`, which is a
     * quarter of the channel's whole excursion arriving in 16 ms, i.e. exactly
     * the brow twitch the brief rules out.
     *
     * Dropping the newcomer is also the right behaviour and not merely the
     * convenient fix: two expressions overlapping is not one character
     * responding, it is two systems talking over each other.
     */
    if (event.upperFace && this.upperFace === null) {
      this.upperFace = event.upperFace;
      this.upperFrom = event.upperFaceAt;
      this.upperFadeIn = event.upperFaceFadeIn;
      this.upperHold = event.upperFaceHold;
      this.upperFadeOut = event.upperFaceFadeOut;
    }
    if (event.warmth > 0) {
      this.warmthTarget = event.warmth;
      this.warmthReleaseAt =
        event.start +
        ACTIVE_PRESENCE_FACE.attackSeconds +
        ACTIVE_PRESENCE_FACE.holdMinSeconds +
        (event.warmth - ACTIVE_PRESENCE_FACE.strengthMin) *
          (ACTIVE_PRESENCE_FACE.holdRangeSeconds / ACTIVE_PRESENCE_FACE.strengthRange);
    }
  }

  /** The event that will follow the current one. Peeked for the review panel. */
  private peek(): ActivePresenceEvent | null {
    if (!this.next) {
      this.next = this.planner.nextEvent();
      this.blinks.push(...this.planner.drainBlinks());
    }
    return this.next;
  }

  private blinkValue(now: number): { value: number; nextIn: number; double: boolean } {
    // The ACCEPTED trajectory, called directly. No second blink shape exists.
    let value = 0;
    let double = false;
    let nextIn = Number.POSITIVE_INFINITY;
    for (const blink of this.blinks) {
      const sampled = sampleEyelid(now, blink.time, 1);
      if (sampled > value) {
        value = sampled;
        double = blink.double;
      }
      if (blink.double) {
        value = Math.max(
          value,
          sampleEyelid(
            now,
            blink.time + ACTIVE_PRESENCE_BLINK.doubleOffsetSeconds,
            ACTIVE_PRESENCE_BLINK.doubleStrength
          )
        );
      }
      if (blink.time > now) nextIn = Math.min(nextIn, blink.time - now);
    }
    // Blinks more than a few seconds past are dropped so the list cannot grow
    // without bound in a long idle.
    this.blinks = this.blinks.filter((blink) => blink.time > now - 3);
    return { value, nextIn, double };
  }

  /**
   * THE IDLE FACIAL PRESENCE.
   *
   * The accepted `hyper3dPresenceBaseline` is the FLOOR — the muscle tone
   * hardware signed off — and the warmth envelope adds above it. Below a
   * channel's measured `usefulMin` nothing is written at all, so a resting face
   * leaves no invisible residue, and every value is capped at the channel's
   * measured `naturalMax`.
   */
  /**
   * THE IDLE FACE — base engagement plus whatever the current event adds.
   *
   * `warmth` is 0 for most of an idle minute, and at 0 this returns the BASE
   * RESTING ENGAGEMENT: a softly pleasant, awake face rather than a neutral
   * mask. `upper` is the upper-face envelope, which is separate because brows
   * and lids move on their own events.
   *
   * Every value is capped at the channel's measured `naturalMax` and dropped
   * entirely below its measured `usefulMin`, so nothing invisible is written and
   * nothing is pushed past what this asset can hold naturally.
   */
  private facePose(warmth: number, upper: number): BlendshapePose {
    const f = ACTIVE_PRESENCE_FACE;
    const pose: BlendshapePose = {};
    const put = (channel: (typeof ACTIVE_PRESENCE_FACE_CHANNELS)[number], value: number) => {
      if (value <= activePresenceUsefulMin(channel)) return;
      pose[channel] = Math.min(value, activePresenceNaturalMax(channel));
    };
    /** Base, plus the event's share of the distance from base to peak. */
    const rise = (base: number, peak: number, amount: number) => base + (peak - base) * amount;
    const variant = this.upperFace ? ACTIVE_PRESENCE_UPPER_FACE.variants[this.upperFace] : null;
    const upperOn = variant && upper > 1e-4 ? upper : 0;

    /**
     * THE LOWER FACE takes contributions from BOTH systems, resolved with `max`
     * rather than summed.
     *
     * A warmth event and an upper-face variant can overlap — ATTENTIVE_WARMTH
     * rides a warmth event by design — and adding them would push the mouth and
     * cheeks past anything the two were sized for. `max` means the stronger
     * intention wins the channel and neither is inflated by the other.
     */
    const variantCheek = variant ? variant.cheek * upperOn : 0;
    const variantSmile = variant ? variant.smile * upperOn : 0;

    put("mouthSmileLeft", Math.max(rise(f.baseSmileLeft, f.smilePeak, warmth), f.baseSmileLeft + variantSmile));
    put(
      "mouthSmileRight",
      Math.max(
        rise(f.baseSmileRight, f.smilePeak * f.followRatio, warmth),
        f.baseSmileRight + variantSmile * f.followRatio
      )
    );
    put("mouthDimpleLeft", rise(f.baseDimpleLeft, f.dimplePeak, warmth));
    put("mouthDimpleRight", rise(f.baseDimpleRight, f.dimplePeak * f.followRatio, warmth));
    put(
      "cheekSquintLeft",
      Math.max(rise(f.baseCheekLeft, f.cheekPeak, warmth), f.baseCheekLeft + variantCheek)
    );
    put(
      "cheekSquintRight",
      Math.max(
        rise(f.baseCheekRight, f.cheekPeak * f.followRatio, warmth),
        f.baseCheekRight + variantCheek * f.followRatio
      )
    );

    /**
     * THE LIDS, same resolution: a warmth smile narrows them and so does a
     * SOFT_FOCUS, and the two happening together must not close the eye further
     * than either would alone.
     */
    const warmthLid =
      warmth > f.eyeSquintEngageThreshold
        ? rise(
            f.baseEyeSquintLeft,
            f.eyeSquintPeak,
            smoothstep(f.eyeSquintEngageThreshold, 1, warmth)
          )
        : f.baseEyeSquintLeft;
    const upperLid = variant ? variant.eyeSquint * upperOn : 0;
    put("eyeSquintLeft", Math.max(warmthLid, f.baseEyeSquintLeft + upperLid));
    put(
      "eyeSquintRight",
      Math.max(
        warmthLid * f.followRatio + f.baseEyeSquintRight * (1 - f.followRatio),
        f.baseEyeSquintRight + upperLid * f.followRatio
      )
    );

    /**
     * THE BROWS. Zero at rest — a resting brow is a neutral brow, and the base
     * engagement is carried by the mouth, cheeks and lids. They move only when
     * an event asks them to, which is what keeps this from being a twitch.
     */
    if (variant && upperOn > 0) {
      put("browOuterUpLeft", variant.outerUp * upperOn);
      put("browOuterUpRight", variant.outerUp * variant.outerUpFollow * upperOn);
      put("browInnerUp", variant.innerUp * upperOn);
    }
    return pose;
  }

  /**
   * ONE FRAME.
   *
   * Returns what to WRITE, never what to add. The caller replaces the owned
   * channels with these values; it does not composite them with anything.
   */
  sample(input: ActivePresenceInput): ActivePresenceFrame {
    const delta = clamp(input.deltaSeconds, 0, 0.1);
    const speaking = input.speaking;

    /**
     * ONE CLOCK, AND IT ONLY RUNS WHILE THIS LAYER OWNS THE FRAME.
     *
     * `this.time` is the IDLE clock: the same clock the planner's cursor, the
     * scheduled blink times, the settle window and the warmth release are all
     * expressed in. It is advanced below, AFTER ownership is resolved, and only
     * while Active Presence is actually contributing.
     *
     * This is not an optimisation. The first version advanced it every frame,
     * so a six-second utterance moved the director six seconds ahead of a
     * planner cursor that had not moved at all. On the return to idle every
     * planned event and every scheduled blink was already in the past: the eyes
     * stopped departing, blinks stopped rendering, and the director burned one
     * event per frame trying to catch up. The two clocks are now the same clock,
     * so they cannot disagree.
     */

    // ── STATE AND OWNERSHIP ────────────────────────────────────────────────
    // SPEECH WINS IMMEDIATELY. The moment the state is `speaking` the blend
    // begins collapsing toward the speaking owner; nothing here can hold a
    // channel to finish an idle motion.
    if (!input.enabled) {
      this.ownership = "off";
      this.blend = 0;
      this.reason = "ACTIVE PRESENCE OFF — the speaking owner keeps every channel.";
    } else if (input.state === "speaking") {
      this.blend = Math.max(
        0,
        this.blend - delta / Math.max(1e-4, ACTIVE_PRESENCE_HANDOFF.releaseSeconds)
      );
      this.ownership = this.blend > 0 ? "releasing" : "speaking";
      this.reason =
        this.blend > 0
          ? "IDLE -> SPEAKING — handing head, gaze, lids and face back to the speaking owner."
          : "SPEAKING — the accepted speaking performance owns every channel.";
      this.idleSeconds = 0;
    } else {
      if (this.wasSpeaking) this.adoptFromSpeaking(speaking);
      this.idleSeconds += delta;
      this.blend = Math.min(
        1,
        this.blend + delta / Math.max(1e-4, ACTIVE_PRESENCE_HANDOFF.releaseSeconds)
      );
      const settling = this.time < this.settleUntil;
      this.ownership = settling ? "settling" : "idle";
      this.reason = settling
        ? "SPEAKING -> IDLE — settling from the rendered pose to neutral engagement."
        : "IDLE — Active Presence owns the idle contribution.";
    }
    this.wasSpeaking = input.state === "speaking";

    // The idle clock advances only while this layer is contributing. `releasing`
    // counts: the idle values are still being faded out and must keep moving,
    // or a blink caught by the handoff would freeze half closed.
    const contributing =
      this.ownership === "idle" || this.ownership === "settling" || this.ownership === "releasing";
    if (contributing) this.time += delta;

    // ── THE PLAN ──────────────────────────────────────────────────────────
    // Events advance only while Active Presence owns the frame, so a long
    // utterance does not silently burn through the idle plan.
    if (this.ownership === "idle" || this.ownership === "settling") {
      // A `while`, not an `if`: a long clamped frame (a tab returning to the
      // foreground) can span a short event, and the plan must not fall behind
      // its own clock. The guard bounds it against a pathological delta.
      let guard = 0;
      while ((!this.event || this.time >= this.event.end) && guard < 64) {
        this.advance();
        guard += 1;
      }
      this.peek();
    }

    const event = this.event;

    // ── HEAD ──────────────────────────────────────────────────────────────
    /**
     * ENGAGEMENT AND RELEASE.
     *
     * A posture delta lands at `headAt` and stays — the head now lives there.
     * An attention event's delta lands at `headAt` (after the eyes) and is
     * withdrawn at `headReleaseAt` (after the eyes come home), so the head
     * follows and then settles back rather than accumulating a look into a
     * posture. Both are decided by the plan, not by a timer here.
     */
    if (event && !this.centreApplied && this.time >= event.headAt) {
      this.centreApplied = true;
      /**
       * ONE ENGAGE PATH for both kinds of head event.
       *
       * `headPersistentShare` of the delta folds into the orientation centre and
       * stays; the remainder goes to the transient and is withdrawn at
       * `headReleaseAt`. An attention shift has a share of 0 — a look leaves
       * nothing behind — and a posture change keeps a small residual so the
       * drift the layer was built around survives while the visible excursion
       * becomes temporary.
       */
      const share = event.headPersistentShare;
      if (share > 0) {
        const railed = ACTIVE_PRESENCE_HEAD_RAILS;
        this.centre = {
          yaw: clamp(
            this.centre.yaw + event.head.yaw * share,
            -railed.yawDegrees,
            railed.yawDegrees
          ),
          pitch: clamp(
            this.centre.pitch + event.head.pitch * share,
            -railed.pitchDegrees,
            railed.pitchDegrees
          ),
          roll: clamp(
            this.centre.roll + event.head.roll * share,
            -railed.rollDegrees,
            railed.rollDegrees
          )
        };
      }
      if (event.headReleaseAt !== null) {
        this.transientTarget = {
          yaw: event.head.yaw * (1 - share),
          pitch: event.head.pitch * (1 - share),
          roll: event.head.roll * (1 - share)
        };
      }
    }
    if (event && event.headReleaseAt !== null && this.time >= event.headReleaseAt) {
      this.transientTarget = { ...ZERO_HEAD };
    }

    /**
     * The centre drifts back toward zero once the head has ARRIVED, so a run of
     * same-sign adjustments cannot walk the head into a permanent tilt and every
     * event ends in a settle. Gated on arrival so the decay never fights the
     * approach — see `recenterArrivalDegrees`.
     */
    const distanceToCentre =
      Math.abs(this.head.yaw - this.transient.yaw - this.centre.yaw) +
      Math.abs(this.head.pitch - this.transient.pitch - this.centre.pitch) +
      Math.abs(this.head.roll - this.transient.roll - this.centre.roll);
    if (distanceToCentre < ACTIVE_PRESENCE_HEAD.recenterArrivalDegrees) {
      const recenter = Math.min(1, ACTIVE_PRESENCE_HEAD.recenterPerSecond * delta);
      this.centre = {
        yaw: this.centre.yaw * (1 - recenter),
        pitch: this.centre.pitch * (1 - recenter),
        roll: this.centre.roll * (1 - recenter)
      };
    }

    const headAlpha = exponentialSmoothingAlpha(ACTIVE_PRESENCE_HEAD.settleSpeed, delta);
    this.transient = {
      yaw: this.transient.yaw + (this.transientTarget.yaw - this.transient.yaw) * headAlpha,
      pitch: this.transient.pitch + (this.transientTarget.pitch - this.transient.pitch) * headAlpha,
      roll: this.transient.roll + (this.transientTarget.roll - this.transient.roll) * headAlpha
    };

    /**
     * The rendered pose follows centre + transient asymptotically. One
     * first-order follower, no oscillator, no phase, no loop: move, decelerate,
     * hold, settle.
     */
    const rails = ACTIVE_PRESENCE_HEAD_RAILS;
    const target = {
      yaw: this.centre.yaw + this.transient.yaw,
      pitch: this.centre.pitch + this.transient.pitch,
      roll: this.centre.roll + this.transient.roll
    };
    this.head = {
      yaw: clamp(
        this.head.yaw + (target.yaw - this.head.yaw) * headAlpha,
        -rails.yawDegrees,
        rails.yawDegrees
      ),
      pitch: clamp(
        this.head.pitch + (target.pitch - this.head.pitch) * headAlpha,
        -rails.pitchDegrees,
        rails.pitchDegrees
      ),
      roll: clamp(
        this.head.roll + (target.roll - this.head.roll) * headAlpha,
        -rails.rollDegrees,
        rails.rollDegrees
      )
    };

    // ── GAZE ──────────────────────────────────────────────────────────────
    // Away fast, back slower, and camera-engaged whenever no departure is live.
    const departing = Boolean(event && this.time < event.gazeReturn);
    const targetYaw = departing ? event!.gaze.yaw : 0;
    const targetPitch = departing ? event!.gaze.pitch : 0;
    const gazeAlpha = exponentialSmoothingAlpha(
      departing ? ACTIVE_PRESENCE_GAZE.departSpeed : ACTIVE_PRESENCE_GAZE.returnSpeed,
      delta
    );
    this.gazeYaw = clamp(
      this.gazeYaw + (targetYaw - this.gazeYaw) * gazeAlpha,
      -ACTIVE_PRESENCE_GAZE_RAILS.yawDegrees,
      ACTIVE_PRESENCE_GAZE_RAILS.yawDegrees
    );
    this.gazePitch = clamp(
      this.gazePitch + (targetPitch - this.gazePitch) * gazeAlpha,
      -ACTIVE_PRESENCE_GAZE_RAILS.pitchDegrees,
      ACTIVE_PRESENCE_GAZE_RAILS.pitchDegrees
    );

    // ── WARMTH ────────────────────────────────────────────────────────────
    if (this.time > this.warmthReleaseAt) this.warmthTarget = 0;
    const warmthAlpha = exponentialSmoothingAlpha(
      1 /
        Math.max(
          0.05,
          this.warmthTarget > this.warmth
            ? ACTIVE_PRESENCE_FACE.attackSeconds
            : ACTIVE_PRESENCE_FACE.releaseSeconds
        ),
      delta
    );
    this.warmth += (this.warmthTarget - this.warmth) * warmthAlpha;
    if (this.warmth < 1e-4) this.warmth = 0;

    // ── UPPER FACE ────────────────────────────────────────────────────────
    /**
     * FADE IN, HOLD, FADE OUT — explicit durations, smoothstep on each edge.
     *
     * P1.2 used the same exponential follower as warmth, which reaches 63% of a
     * shape in one time constant and 90% only after 2.3 of them: at a 0.62 s
     * constant most of a short event was spent ramping and the expression was
     * never fully READ. This arrives, holds at full value, and leaves.
     */
    if (this.upperFace) {
      const since = this.time - this.upperFrom;
      const total = this.upperFadeIn + this.upperHold + this.upperFadeOut;
      if (since < 0) {
        this.upperLevel = 0;
      } else if (since < this.upperFadeIn) {
        this.upperLevel = smoothstep(0, this.upperFadeIn, since);
      } else if (since < this.upperFadeIn + this.upperHold) {
        this.upperLevel = 1;
      } else if (since < total) {
        this.upperLevel = 1 - smoothstep(this.upperFadeIn + this.upperHold, total, since);
      } else {
        this.upperLevel = 0;
        // Released fully: drop the variant so the next event's shape starts clean.
        this.upperFace = null;
        this.upperFrom = Number.POSITIVE_INFINITY;
      }
    } else {
      this.upperLevel = 0;
    }

    // ── BLINK ─────────────────────────────────────────────────────────────
    const blink = this.blinkValue(this.time);
    // The ACCEPTED resting lid, composited exactly as the accepted layer does:
    // `max`, on the same channel, so a blink still reaches full closure and the
    // eyes never pop open across the handoff.
    const lid = Math.max(blink.value, RESTING_LID_CLOSURE);
    const lidInfluence = Math.min(1, calibrateHyper3dMorph("eyeBlinkLeft", lid));
    const lidInfluenceRight = Math.min(1, calibrateHyper3dMorph("eyeBlinkRight", lid));

    // ── COMPOSE ───────────────────────────────────────────────────────────
    const idleFace = this.facePose(this.warmth, this.upperLevel);
    const idleGaze = hyper3dGazePose(this.gazeYaw, this.gazePitch);
    /**
     * ONE pose, split across the two bones. `distributeIdlePose` at the accepted
     * shares is `distributeToRig` by identity; a strong reorientation moves a
     * modest amount of the SAME number onto the neck. There is no second
     * trajectory and the neck cannot lead.
     */
    const rig = distributeIdlePose(this.head, this.neckShare);
    const idleHead = activePresenceBoneRadians(rig.head, false);
    const idleNeck = activePresenceBoneRadians(rig.neck, true);

    const blend = this.blend;
    const owns = blend > 0;

    /**
     * THE SINGLE WRITE VALUE.
     *
     * Every channel below is ONE number, produced here. At blend 1 it is the
     * idle value, at blend 0 the speaking value, and in between exactly one
     * convex combination — never a sum of two layers.
     */
    const facePose: BlendshapePose = {};
    if (owns) {
      const speakingFace = speaking.facePose;
      const names = new Set([...Object.keys(idleGaze), ...Object.keys(idleFace)]);
      for (const name of Object.keys(speakingFace)) names.add(name);
      for (const name of names) {
        const idleValue = idleGaze[name] ?? idleFace[name] ?? 0;
        const speakingValue = speakingFace[name] ?? 0;
        const value = lerp(speakingValue, idleValue, blend);
        if (value > 1e-4) facePose[name] = value;
      }
      facePose.eyeBlinkLeft = lerp(speaking.blinkLeft, lidInfluence, blend);
      facePose.eyeBlinkRight = lerp(speaking.blinkRight, lidInfluenceRight, blend);
    }

    const head = owns ? lerpRotation(speaking.head, idleHead, blend) : speaking.head;
    const neck = owns ? lerpRotation(speaking.neck, idleNeck, blend) : speaking.neck;
    const gazeYawDegrees = owns
      ? lerp(speaking.gazeYawDegrees, this.gazeYaw, blend)
      : speaking.gazeYawDegrees;
    const gazePitchDegrees = owns
      ? lerp(speaking.gazePitchDegrees, this.gazePitch, blend)
      : speaking.gazePitchDegrees;

    return {
      head,
      neck,
      gazeYawDegrees,
      gazePitchDegrees,
      facePose,
      ownership: this.ownership,
      owns,
      telemetry: {
        owner: owns ? ACTIVE_PRESENCE_OWNER : `${ACTIVE_PRESENCE_OWNER}:off`,
        state: input.state,
        ownership: this.ownership,
        seed: this.planner.seed,
        enabled: input.enabled,
        idleSeconds: this.idleSeconds,
        eventKind: event?.kind ?? null,
        eventStrong: Boolean(event?.strong),
        upperFaceVariant: this.upperFace,
        upperFaceLevel: this.upperLevel,
        gazeLeadSeconds: event ? Math.max(0, event.headAt - event.start) : 0,
        neckShare: { ...this.neckShare },
        eventReason: event?.reason ?? "",
        eventAgeSeconds: event ? Math.max(0, this.time - event.start) : 0,
        eventIndex: event?.index ?? -1,
        nextEventKind: this.next?.kind ?? null,
        nextEventInSeconds: event ? Math.max(0, event.end - this.time) : 0,
        headDegrees: { ...this.head },
        headBoneDegrees: rig.head,
        neckBoneDegrees: rig.neck,
        gazeYawDegrees: this.gazeYaw,
        gazePitchDegrees: this.gazePitch,
        gazeVisualYawDegrees: this.gazeYaw * REAL_DEGREES_PER_ADAPTER_DEGREE,
        gazeVisualPitchDegrees: this.gazePitch * REAL_DEGREES_PER_ADAPTER_DEGREE,
        gazeEngaged: Math.abs(this.gazeYaw) < 0.05 && Math.abs(this.gazePitch) < 0.05,
        blink: blink.value,
        nextBlinkInSeconds: Number.isFinite(blink.nextIn) ? blink.nextIn : 0,
        blinkDouble: blink.double,
        warmth: this.warmth,
        facePose: idleFace,
        blend,
        reason: this.reason
      }
    };
  }
}

/** The functional entry point, so a test can drive one frame without a class. */
export const resolveActivePresence = (
  director: ActivePresenceDirector,
  input: ActivePresenceInput
): ActivePresenceFrame => director.sample(input);
