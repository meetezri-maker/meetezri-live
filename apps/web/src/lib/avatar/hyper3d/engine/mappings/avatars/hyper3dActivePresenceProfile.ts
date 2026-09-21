import { hyper3dGazeCalibration, hyper3dMorphCalibration } from "./hyper3dCalibration";

/**
 * HYPER3D ACTIVE PRESENCE — THE IDLE BEHAVIOURAL ENVELOPE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * P1.4 IS THE HARDWARE-ACCEPTED BASELINE. THESE VALUES ARE LOCKED.
 * ─────────────────────────────────────────────────────────────────────────────
 * Every constant below is pinned by `hyper3dActivePresenceBaseline.ts` and
 * asserted by `hyper3dActivePresenceBaselineContract.test.ts`. Changing one
 * fails the build with the old and new numbers side by side, on purpose.
 *
 * To change a protected value: change it here, change the literal in the
 * baseline in the SAME commit, and state the measurement that justifies it in
 * `docs/HYPER3D_ACTIVE_PRESENCE.md`. A protected value must not move silently.
 *
 * The comments below record the measurements each value was derived from, and
 * the P1/P1.1/P1.2 candidates that were rejected on the way here. They are the
 * reasoning, not a changelog — keep them with the values they explain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS, AND WHAT IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * These constants describe the avatar WHILE SHE IS NOT SPEAKING. Nothing here is
 * read on a speaking frame, and no value in `hyper3dPerformanceBaseline.ts` is
 * referenced, reused or re-derived by it. The accepted speaking performance —
 * head 3.0x, speaking gaze policy, blink trajectory, resting lid, semantic
 * affect, semantic brows, the vowel table, the bilabial seal, coarticulation and
 * the MFA timeline — is frozen and untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE IDLE AUDIT MEASURED (60 s, plan loaded, state `idle`, affect on,
 * production affect request "please sound warm and friendly")
 * ─────────────────────────────────────────────────────────────────────────────
 *   head yaw / pitch / roll      0.000 deg on EVERY frame. Completely frozen.
 *   gaze                         p90 0.121, max 0.356 adapter-deg (1.14 deg of
 *                                real eyeball rotation). Alive but invisible.
 *   blink                        14 in 60 s, gaps 2.87-5.37 s. Already good.
 *   resting lid                  0.163 p50. Already correct.
 *   smileMouth                   0.393 p50, HELD CONSTANT for the whole minute
 *   cheekRaise                   0.448 p50, HELD CONSTANT
 *   rendered idle affect pose    mouthSmile 0.257, mouthDimple 0.125,
 *                                cheekSquint 0.247 — a PERMANENT SMILE.
 *
 * So the two defects are precise: a frozen head, and a held smile. Everything
 * below is scaled against those measurements rather than chosen by feel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNITS
 * ─────────────────────────────────────────────────────────────────────────────
 * HEAD is in DEGREES OF POSE, before `distributeToRig` splits it 70/30 (80/20 in
 * roll) across `Head_M` and `Neck_M`. GAZE is in the ADAPTER DOMAIN — the same
 * units `hyper3dGazePose` takes, which multiplies by `gazeScale` (3.2) to reach
 * real eyeball rotation. `REAL_DEGREES_PER_ADAPTER_DEGREE` below is that factor,
 * so a brief written in visual degrees can be read straight off these numbers.
 */

/** Adapter-domain gaze -> degrees of real eyeball rotation. */
export const REAL_DEGREES_PER_ADAPTER_DEGREE = hyper3dGazeCalibration.gazeScale;

/** Visual degrees -> the units `hyper3dGazePose` expects. */
export const visualDegreesToAdapter = (visualDegrees: number) =>
  visualDegrees / REAL_DEGREES_PER_ADAPTER_DEGREE;

/**
 * SAFETY RAILS — hard clamps, not targets.
 *
 * ─── P1.2 ────────────────────────────────────────────────────────────────
 * Widened to carry the review's visible envelope. P1/P1.1 railed at 1.5 / 1.0 /
 * 0.35 deg, which was sized for a "posture maintenance" reading that hardware
 * judged indistinguishable from a stationary model. The candidate now asks for
 * ordinary events up to 3.0 deg of yaw and uncommon reorientations to 4.5 deg,
 * so the rails sit above the largest event the planner can draw plus the
 * accumulation headroom the recentring needs.
 *
 * They remain HARD CLAMPS and not targets: `ActivePresenceDirector` clamps every
 * axis every frame, so no accumulation of posture drift, no smoothing overshoot
 * and no future retune can put the head somewhere a person would not be.
 */
export const ACTIVE_PRESENCE_HEAD_RAILS = {
  yawDegrees: 5,
  pitchDegrees: 2.8,
  rollDegrees: 0.9
} as const;

/**
 * GAZE RAILS, in the adapter domain.
 *
 * 3.0 visual degrees horizontally and 1.0 vertically — the top of the brief's
 * "usually 1-3 deg / usually <1 deg". Compare the ACCEPTED SPEAKING gaze, whose
 * golden p90 is 1.014 adapter-deg (3.24 visual) and max 2.308 (7.4 visual): idle
 * departures are therefore SUBSTANTIALLY INSIDE the already-calibrated speaking
 * rail, which is what the brief asks for, and nothing here widens that rail.
 */
export const ACTIVE_PRESENCE_GAZE_RAILS = {
  yawDegrees: visualDegreesToAdapter(3),
  pitchDegrees: visualDegreesToAdapter(1)
} as const;

/**
 * EVENT KINDS.
 *
 * Conceptual, per the brief. What matters is that ONE planner emits all of them,
 * so a gaze departure, a posture adjustment and a moment of warmth are decisions
 * of the same scheduler rather than three coincidences.
 *
 *   HOLD             nothing moves. The most common event by design.
 *   ATTENTION_SHIFT  a gaze departure, sometimes with a trace of head.
 *   POSTURE_ADJUST   a head/neck orientation change, sometimes with gaze.
 *   SOFT_WARMTH      a small, slow warmth in the mouth corners and cheeks.
 *   SETTLE           the return to neutral engagement after speech.
 */
export const ACTIVE_PRESENCE_EVENT_KINDS = [
  "HOLD",
  "ATTENTION_SHIFT",
  "POSTURE_ADJUST",
  "SOFT_WARMTH",
  "SETTLE"
] as const;

/**
 * UPPER-FACE VARIANTS — P1.2.
 *
 * These are NOT new events and they do NOT get a scheduler. Each is a variant
 * that the existing planner may attach to an event it has already drawn, so the
 * brows and lids move as part of one intention rather than on a clock of their
 * own:
 *
 *   ATTENTIVE_WARMTH   rides a SOFT_WARMTH. Brows lift with the smile.
 *   CURIOUS_RESPONSE   rides an ATTENTION_SHIFT that also moves the head.
 *                      An asymmetric outer-brow lift — the "what's that" look.
 *   SOFT_FOCUS         rides an eyes-only ATTENTION_SHIFT. Lids soften, brows
 *                      barely move: attention narrowing rather than opening.
 *   ATTENTIVE_RESET    follows a STRONG posture change or a warmth release.
 *                      The upper face returns to base through a brief lift.
 */
export const ACTIVE_PRESENCE_UPPER_FACE_VARIANTS = [
  "ATTENTIVE_WARMTH",
  "CURIOUS_RESPONSE",
  "SOFT_FOCUS",
  "ATTENTIVE_RESET"
] as const;

export type ActivePresenceUpperFaceVariant =
  (typeof ACTIVE_PRESENCE_UPPER_FACE_VARIANTS)[number];

export type ActivePresenceEventKind = (typeof ACTIVE_PRESENCE_EVENT_KINDS)[number];

/**
 * EVENT MIX — the weights the planner draws a kind from.
 *
 * HOLD dominates on purpose. §10 of the brief is explicit that stillness is part
 * of the performance, so the scheduler's most likely decision is "do nothing for
 * a while". The three moving kinds together are a minority of events, and each
 * one is itself mostly a hold with a small change at its start.
 *
 * SETTLE is absent: it is never DRAWN, only INJECTED by the speech handoff.
 */
export const ACTIVE_PRESENCE_EVENT_WEIGHTS: Record<
  Exclude<ActivePresenceEventKind, "SETTLE">,
  number
> = {
  HOLD: 0.42,
  ATTENTION_SHIFT: 0.27,
  POSTURE_ADJUST: 0.23,
  SOFT_WARMTH: 0.08
};

/**
 * The cap on CONSECUTIVE quiet events.
 *
 * Stillness is the point, but an unbounded weighted draw does not produce
 * "mostly still" — it produces occasional very long dead stretches. The review
 * seed's first plan held for 34.9 s of a 60 s review, which is not presence, it
 * is a paused render. Two holds back to back is up to ~18 s of near-complete
 * stillness, which is already a long time to watch a face not move.
 *
 * This is the same anti-run rule `BehaviorMemory.pickSide` already applies to
 * left/right (`sideRun >= 2`), applied to the quiet kind rather than to a side.
 * It does not make the schedule periodic: WHEN the third event lands and WHAT it
 * is are still drawn, and the two preceding holds are themselves irregular.
 */
export const ACTIVE_PRESENCE_MAX_CONSECUTIVE_HOLDS = 2;

/**
 * EVENT DURATIONS, in seconds. Each is a range the planner samples irregularly;
 * there is no fixed period anywhere and no value is a multiple of another.
 *
 * A HOLD is long — up to nine seconds of an almost completely still face — and
 * a moving event's duration is the time before the NEXT decision, not the length
 * of the motion, which is much shorter and set by the trajectory constants.
 */
export const ACTIVE_PRESENCE_EVENT_SECONDS: Record<
  ActivePresenceEventKind,
  { readonly min: number; readonly range: number }
> = {
  HOLD: { min: 3.1, range: 5.9 },
  ATTENTION_SHIFT: { min: 2.3, range: 3.4 },
  POSTURE_ADJUST: { min: 2.9, range: 4.1 },
  SOFT_WARMTH: { min: 3.7, range: 4.3 },
  SETTLE: { min: 1.4, range: 0.8 }
};

/**
 * HEAD BEHAVIOUR — posture maintenance, not gesture.
 *
 * A POSTURE_ADJUST moves the head's resting ORIENTATION by a small delta and
 * leaves it there; it does not swing out and back. That is the difference the
 * brief is pointing at between posture and gesturing, and it is why the
 * amplitudes below are DELTAS from wherever the head already is, re-clamped to
 * the rails, rather than absolute targets.
 *
 * The delta is drawn from a fraction of the rail so a single adjustment can
 * never reach it, and the ORIENTATION CENTRE is pulled gently back toward zero
 * so a run of same-sign draws cannot walk the head into a permanent tilt.
 */
export const ACTIVE_PRESENCE_HEAD = {
  /**
   * ORDINARY EVENT — peak delta of one adjustment, per axis, in degrees of pose.
   *
   * ─── P1.5, HEAD ROTATION STRENGTH ────────────────────────────────────────
   *
   * Hardware accepted the P1.4 attention/return behaviour and asked for one
   * thing: the head rotation is still not strong enough. Only these four
   * magnitudes moved. Release timing, hold timing, `posturePersistentShare`,
   * the recentring, the event schedule, gaze, blink and the whole face are
   * untouched, and their traces are asserted byte-identical.
   *
   *   ordinary yaw     3.9  -> 4.875   (+25%)   travel 2.923 -> 3.654 deg
   *   ordinary pitch   2.0  -> 2.4     (+20%)   travel 1.549 -> 1.859 deg
   *   strong yaw       4.5  -> 5.4     (+20%)
   *   strong pitch     2.5  -> 2.75    (+10%)
   *   roll             0.7  -> 0.7     UNCHANGED, as instructed
   *
   * WHY STRONG DID NOT SCALE BY THE FULL 25%. At 5.625 / 3.0 the rendered pose
   * reached the 5.0 deg yaw rail and was CLAMPED on 16 frames of a ten-minute
   * run — the flattened top of a trajectory, which is exactly what the rail
   * exists to prevent rather than something to ship. 5.4 / 2.75 is the largest
   * pair that never touches either rail on any seed measured, and it keeps a
   * strong reorientation above an ordinary one: at 5.0 the strong median fell
   * BELOW the ordinary median, which would have made the uncommon event the
   * smaller one.
   *
   * ─── P1.2, THE STRONG VISUAL CANDIDATE ──────────────────────────────────
   *
   * P1 and P1.1 both failed hardware for the same reason: the idle behaviour was
   * optimised down before it was ever proven visually. P1.1 rendered a 60-second
   * review maximum of 0.727 deg of yaw and 0.467 of pitch and still read as a
   * waiting model.
   *
   * The philosophy for this candidate is inverted: MAKE IT OBVIOUS FIRST, and
   * reduce afterwards only what looks excessive. If telemetry is needed to prove
   * a movement happened, the movement is too weak for this review.
   *
   * The requested ordinary envelope is yaw +/-1.5-3.0 deg, pitch +/-0.5-1.5 and
   * roll +/-0.3-0.7. These are the peaks of an ordinary draw; the share floor
   * below sets where a typical one lands inside them.
   *
   * ROLL rejoins the floored draw at this scale. At P1.1's 0.18 deg it was a
   * rounding error; at 0.7 it is a real, if very restrained, head tilt, and the
   * brief asks for it.
   */
  yawDeltaDegrees: 4.875,
  pitchDeltaDegrees: 2.4,
  rollDeltaDegrees: 0.7,
  /**
   * UNCOMMON STRONG REORIENTATION — yaw ~3-4.5 deg, pitch ~1.5-2.5 deg.
   *
   * A different SIZE of the same event, not a different event: same planner,
   * same trajectory, same hold, same settle. The brief's 6 deg ceiling from the
   * original specification is deliberately NOT used yet — we know this camera
   * and this character, so the candidate starts below it.
   */
  strongYawDeltaDegrees: 5.4,
  strongPitchDeltaDegrees: 2.75,
  strongRollDeltaDegrees: 0.9,
  /**
   * How often a POSTURE_ADJUST is a strong reorientation.
   *
   * Low on purpose. "Uncommon" is the whole character of these: roughly one in
   * five posture events, which on a 60-second review is about one. Raising this
   * would turn a reorientation into a mannerism, and the brief is explicit that
   * event FREQUENCY must not rise to create motion.
   */
  strongProbability: 0.22,
  /**
   * Seconds for the pose to reach a new orientation. Long: a posture change is
   * a settle, not a move. `exponentialSmoothingAlpha` is the project's existing
   * follower, so this is a time constant and the motion is asymptotic —
   * move, decelerate, hold, settle, with no pendulum and no oscillator.
   *
   * P1.2 raises it slightly: at four times the amplitude, P1.1's 1.6 s time
   * constant made a strong reorientation drift rather than move. This is still
   * a 1.1 s constant, i.e. the head is still easing into place, never snapping.
   */
  settleSpeed: 2.2,
  /**
   * P1.4 — HOW LONG A POSTURE EVENT HOLDS ITS OFF-CENTRE POSE.
   *
   * THE DEFECT this fixes. A `POSTURE_ADJUST` used to fold its delta into the
   * orientation centre and NEVER release it — only the 0.16/s recentring brought
   * it home, at a half-life of about 4.3 s. Measured on the review minute, the
   * head sat beyond 0.75 deg of neutral for a mean of 18.23 s and a maximum of
   * 19.37 s: a third of the minute spent looking away from the viewer. That is
   * the "avoiding the viewer" reading, and it was a structural omission rather
   * than an amplitude problem.
   *
   * A posture change now DEPARTS, HOLDS BRIEFLY, and RETURNS, through the same
   * transient mechanism an attention shift already used. No second scheduler,
   * no new writer, and the event plan is untouched.
   */
  postureHoldMinSeconds: 0.28,
  postureHoldRangeSeconds: 0.5,
  /**
   * THE DEPARTURE TRAVEL, and why the hold is measured from the END of it.
   *
   * The first attempt set the release at `start + hold`, which fired while the
   * follower was still travelling: the head turned around before it arrived and
   * the review maximum HALVED, from 3.34 deg to 1.66. A hold shorter than the
   * travel is not a short hold, it is a smaller movement.
   *
   * The release is now `arrival + hold`, and `settleSpeed` is set so the head
   * substantially arrives inside this window: at 2.2 the follower reaches 70% of
   * its target in 0.55 s and 86% in 0.9 s, which is the brief's 0.5-1.0 s
   * departure travel. The easing is the same first-order follower it has always
   * been — only its time constant moved, from 1.11 s to 0.45 s — and the peak
   * head speed rises to about 6 deg/s, still an order of magnitude below a real
   * head turn.
   */
  postureTravelSeconds: 0.9,
  /** A strong reorientation may hold longer, but not for multiple seconds. */
  strongPostureHoldMinSeconds: 0.6,
  strongPostureHoldRangeSeconds: 0.55,
  /**
   * The share of a posture delta that PERSISTS after the return.
   *
   * Not zero, because a posture change genuinely is a change of posture — a head
   * that returns to exactly the same orientation every time is a gesture, not a
   * person shifting. The residual keeps the slow drift the layer was built
   * around while the visible excursion becomes temporary.
   *
   * Sized so a full-draw ordinary event leaves 0.65 deg (3.6 x 0.18) and a full
   * strong one 0.81 deg — both at or under the 0.75-0.9 deg band that reads as
   * "near neutral", so the residual never registers as looking away.
   */
  posturePersistentShare: 0.18,
  /**
   * Fraction of the current orientation centre pulled back to zero per second,
   * applied ONLY ONCE THE HEAD HAS ARRIVED — see `recenterArrivalDegrees`.
   *
   * P1.2 raises it from 0.055 to 0.16. At P1.1's amplitudes a 5.5%/s decay was
   * enough; at four times the displacement it left the head living 1-3 deg off
   * centre for most of a minute (6.1% of review frames within 1 deg of neutral).
   * At 0.16 the offset halves about every 4.3 s, so the head visibly returns
   * toward centre across a hold — the SETTLE in "move, decelerate, hold, settle".
   */
  recenterPerSecond: 0.16,
  /**
   * The recentring does not run while the head is still travelling.
   *
   * Applying it continuously fought the approach: a strong 3.47 deg
   * reorientation rendered only 2.54 deg because the target was decaying before
   * the follower reached it, and raising the amplitude to compensate would have
   * been tuning one mistake with another. Gating on arrival means an event
   * reaches its target first and settles afterwards, which is the shape the
   * brief asks for rather than a compromise between the two.
   */
  recenterArrivalDegrees: 0.3,
  /**
   * A POSTURE_ADJUST carries gaze this often. Below this the head moves and the
   * eyes simply stay where they were — one of the brief's "eyes move alone" and
   * "sometimes a tiny head change accompanies attention" cases.
   */
  gazeCompanionProbability: 0.34,
  /** Chance one axis of an adjustment is suppressed entirely, so it reads as a single-axis settle. */
  singleAxisProbability: 0.42,
  /**
   * When one axis IS suppressed, this is the chance it is the PITCH.
   *
   * Below a half on purpose. It makes pitch the axis that participates most
   * OFTEN (~84% of adjustments) while yaw is the one that travels furthest,
   * which is how "subtle pitch variation, smaller yaw variation" and a yaw rail
   * wider than the pitch rail are satisfied at the same time.
   */
  singleAxisDropsPitchProbability: 0.38,
  /**
   * THE FLOOR ON AN ADJUSTMENT'S SHARE — introduced in P1.1, kept in P1.2.
   *
   * The share of a delta is drawn on [floor, 1] rather than [0, 1]. P1 drew it
   * uniformly and most adjustments landed in the invisible bottom of the range:
   * per-event peaks were yaw median 0.217 deg against a maximum of 0.674, a 3.1x
   * spread, so the TYPICAL event was a fifth of a degree while the rare one was
   * two thirds.
   *
   * Scaling alone cannot fix a distribution. Lifting that median by multiplier
   * would have carried the maximum up with it in the same proportion. The floor
   * lifts the median hard and the maximum barely, which is what makes a typical
   * event visible without making the peaks extreme.
   */
  adjustmentShareFloor: 0.7,
  /**
   * NECK SHARE — P1.2 §4.
   *
   * The accepted rig distribution (70/30 yaw and pitch, 80/20 roll) is used for
   * every ORDINARY event and is not touched. A STRONG reorientation shifts a
   * modest amount of the same pose onto the neck, because a person turning
   * further does turn from lower down.
   *
   * This is not an independent neck trajectory and cannot become one: the neck
   * receives a FRACTION OF THE SAME NUMBER, decided by the same event, on the
   * same frame. `hyper3dActivePresenceHeadVisibility.test.ts` asserts the shares
   * sum to exactly 1 and that the neck never exceeds the head.
   */
  strongNeckShare: { yaw: 0.4, pitch: 0.4, roll: 0.28 },
  /**
   * EYES LEAD, HEAD FOLLOWS — P1.2 §5.
   *
   * On a coordinated attention event the eyes move first and the head follows
   * 100-250 ms later. On the way back the eyes return first and the head settles
   * afterwards. Both delays are drawn per event inside the range, by the same
   * planner, so this is coordination rather than a second scheduler.
   */
  gazeLeadMinSeconds: 0.1,
  gazeLeadRangeSeconds: 0.15,
  /**
   * How long after the eyes return before the head begins to settle back.
   *
   * P1.4 tightens it from 0.18-0.52 s to 0.12-0.34 s so eye contact is
   * re-established sooner. It is deliberately NOT zero and never can be: the
   * eyes must arrive first and the head follow, or the two move as one rigid
   * unit. The minimum is more than seven frames at 60 Hz.
   */
  returnLagMinSeconds: 0.12,
  returnLagRangeSeconds: 0.22
} as const;

/**
 * GAZE BEHAVIOUR — attention, not scanning.
 *
 * An ATTENTION_SHIFT departs, HOLDS, and returns to camera; the rest of the
 * event is a camera-engaged hold. `holdSeconds` is the departure only, so the
 * engaged share of idle time is dominated by the event durations above.
 */
export const ACTIVE_PRESENCE_GAZE = {
  /** Departure amplitude, adapter domain. 1.0-3.0 visual degrees. */
  yawMinDegrees: visualDegreesToAdapter(1),
  yawRangeDegrees: visualDegreesToAdapter(2),
  /**
   * Vertical stays under a visual degree, and is often exactly zero.
   *
   * When it is not zero it is drawn from the UPPER part of the range
   * (`pitchFloorShare` below), because a vertical component of a twentieth of a
   * degree is not a small movement, it is an invisible one that still costs a
   * draw. Either the eyes change height or they do not.
   */
  pitchRangeDegrees: visualDegreesToAdapter(0.85),
  pitchFloorShare: 0.35,
  /**
   * How long the eyes stay away before returning to camera.
   *
   * P1.4 shortens it from 0.55-1.90 s to 0.30-0.85 s. The gaze was already the
   * better-behaved half — 94% of the review minute was viewer-facing — but a
   * departure that could hold for nearly two seconds is the upper end of what
   * reads as "still engaged", and the brief asks for a brief READABLE hold
   * rather than a long one. Amplitude is untouched: this changes when the eyes
   * come back, not how far they go.
   */
  holdMinSeconds: 0.3,
  holdRangeSeconds: 0.55,
  /** Departure and return time constants. The return is slower than the departure. */
  departSpeed: 7.4,
  returnSpeed: 4.1,
  /**
   * An ATTENTION_SHIFT carries head this often.
   *
   * P1.2 raises it from 0.28 to 0.42 — not to add motion, but because the
   * eye-leads-head coordination the brief asks for only exists on the events
   * that HAVE a head component. Below this the eyes move alone, which the brief
   * requires to stay common: at 0.42 a clear majority of gaze events are still
   * eyes-only.
   */
  headCompanionProbability: 0.42,
  /**
   * The head trace, as a fraction of a full POSTURE_ADJUST delta.
   *
   * P1.1 reduced this from 0.42 while the delta itself grew, so the companion
   * rose in absolute terms (0.344 -> 0.391 deg) but stayed clearly SMALLER than
   * the smallest posture adjustment (0.805 deg). A trace that reaches posture
   * amplitude is no longer a trace — it is a second kind of head turn on the
   * back of an eye movement, which is what the brief rules out.
   */
  headCompanionScale: 0.34,
  /** Chance the vertical component is exactly zero, so most shifts are horizontal only. */
  flatProbability: 0.4
} as const;

/**
 * BLINK SCHEDULING — the ACCEPTED TRAJECTORY, an idle CADENCE.
 *
 * The shape is not touched and is not re-implemented: the director calls
 * upstream's own `sampleEyelid`, the same function the accepted speaking blink
 * uses, and composites the accepted `RESTING_LID_CLOSURE` under it exactly as
 * the accepted layer does. Only WHEN a blink happens is decided here.
 *
 * The measured idle cadence today is 14 blinks/min with 2.87-5.37 s gaps and no
 * doubles. What changes: a wider gap distribution so occasional LONG open
 * periods appear, and upstream's own 8.5% double-blink probability and 255 ms
 * second beat, reused rather than re-invented.
 */
export const ACTIVE_PRESENCE_BLINK = {
  /**
   * Gap between blinks. Wide and irregular: 1.5 s to 6.1 s on the ordinary
   * branch, 6.8 s to 11.2 s on the long one. The mixture's mean is 4.7 s, i.e.
   * about 13 blinks a minute — close to the 14/min the accepted idle already
   * measures, with a far wider spread.
   */
  gapMinSeconds: 1.5,
  gapRangeSeconds: 4.6,
  /**
   * One gap in six is drawn from the LONG tail instead — the "occasional longer
   * open-eye period". Drawing it as a separate branch rather than widening the
   * main range is what keeps typical gaps typical.
   */
  longGapProbability: 0.17,
  longGapMinSeconds: 6.8,
  longGapRangeSeconds: 4.4,
  /** Upstream's own double-blink probability and second beat. Not re-tuned. */
  doubleProbability: 0.085,
  doubleOffsetSeconds: 0.255,
  doubleStrength: 0.9,
  /**
   * A blink lands shortly after an ATTENTION_SHIFT this often. This is the
   * coordination the brief asks for: the blink scheduler is not an independent
   * random process running beside the gaze one.
   */
  shiftCouplingProbability: 0.38,
  shiftCouplingMinSeconds: 0.09,
  shiftCouplingRangeSeconds: 0.24,
  /** Never two blinks closer than this, coupling included. */
  minSeparationSeconds: 1.15
} as const;

/**
 * RESTING FACIAL LIFE — P1.2.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO LAYERS, AND THE DIFFERENCE BETWEEN THEM IS THE POINT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   BASE RESTING ENGAGEMENT   always present. A softly pleasant, awake face.
 *   + OCCASIONAL EXPRESSION   a genuine small smile that arrives and leaves.
 *
 * P1 floored the idle face on the accepted `hyper3dPresenceBaseline` — mouth
 * corner 0.050, cheek 0.068, no lid term at all. That baseline was authored as
 * MUSCLE TONE, deliberately below anything readable as an expression, and
 * hardware's verdict on it was that the resting face has insufficient life.
 *
 * So the base rises to a level that is visible at review framing, and the warmth
 * event rises further so there is real CONTRAST between resting and warm. The
 * thing being avoided is not a visible resting face; it is a PERMANENT SMILE —
 * the 0.257 constant mouth corner the P1 audit found and removed. Base
 * engagement is less than half of that, and the peak that exceeds it is
 * transient by construction.
 *
 * Every value is against this asset's own measured band, not a generic ARKit
 * number:
 *
 *   channel            usefulMin  naturalMax   P1 rest   P1.2 base   P1.2 warm peak
 *   mouthSmile L/R        0.03       0.45      0.050     0.130       0.300
 *   mouthDimple L/R       0.04       0.30      0.040     0.085       0.200
 *   cheekSquint L/R       0.06       0.45      0.068     0.115       0.280
 *   eyeSquint L/R         0.10       0.45      —         0.110       0.220
 *
 * THE LID TERM IS NEW and is the reason the base does not read as "only the lips
 * were pulled". `eyeSquint` measures 3.46 mm of travel on this asset — its
 * weakest expression channel — so 0.110 is a genuinely small narrowing that sits
 * just above the 0.10 useful minimum. It is the Duchenne cue that makes the
 * mouth corner read as warmth rather than as a shape.
 */
export const ACTIVE_PRESENCE_FACE = {
  /**
   * BASE RESTING ENGAGEMENT — the always-present attitude.
   *
   * Left/right differ slightly on every channel. A real face is not symmetric at
   * rest, and the accepted baseline already established that asymmetry; this
   * keeps it and scales it.
   */
  baseSmileLeft: 0.13,
  baseSmileRight: 0.118,
  baseDimpleLeft: 0.085,
  baseDimpleRight: 0.072,
  baseCheekLeft: 0.115,
  baseCheekRight: 0.103,
  baseEyeSquintLeft: 0.11,
  baseEyeSquintRight: 0.1,
  /**
   * WARMTH PEAKS — reached only during a SOFT_WARMTH event, and reached from the
   * base rather than from zero.
   *
   * ─── P1.3 ───────────────────────────────────────────────────────────────
   * Hardware passed the head, gaze and blink and returned one finding on the
   * face: the warm event exists but reads too close to the resting face. The
   * BASE IS UNCHANGED — a larger permanent smile is explicitly not the goal —
   * and only the EXCURSION above it grows, by 30%:
   *
   *   channel      base    P1.2 peak   excursion   P1.3 peak   excursion
   *   smile        0.130     0.300       0.170       0.351       0.221
   *   cheek        0.115     0.280       0.165       0.330       0.215
   *   dimple       0.085     0.200       0.115       0.234       0.149
   *   eyeSquint    0.110     0.220       0.110       0.253       0.143
   *
   * Every peak stays inside the channel's measured `naturalMax` (0.45 for the
   * smile, cheek and lid; 0.30 for the dimple), so this is a bigger RESPONSE,
   * not a bigger face.
   */
  smilePeak: 0.384,
  dimplePeak: 0.256,
  cheekPeak: 0.362,
  eyeSquintPeak: 0.274,
  /**
   * The lid still joins only the stronger half of warmth events. A lid that
   * narrows on every one reads as sleepiness rather than attention.
   */
  eyeSquintEngageThreshold: 0.45,
  /** Right side trails the left, so warmth is never a symmetric mask. */
  followRatio: 0.92,
  /**
   * P1.3 — A BRIEF PLEASANT RESPONSE, not a smile pose.
   *
   * P1.2's envelope (0.95 s attack, 1.0-2.5 s hold, 1.85 s release, all on an
   * exponential follower) made the single warmth event in the review minute run
   * for 10.2 seconds of visible facial activity. At that length it stops being
   * a response to anything and becomes a held expression — the reading the brief
   * describes as a smile pose.
   *
   * Shortened to roughly 2.7-3.9 s end to end. Still slow enough that it can
   * never look like a reaction: the corners take more than half a second to
   * arrive and over a second to leave.
   */
  attackSeconds: 0.55,
  holdMinSeconds: 0.9,
  holdRangeSeconds: 1.2,
  releaseSeconds: 1.25,
  /** Strength of one event, so warmth events differ from each other. */
  strengthMin: 0.62,
  strengthRange: 0.38
} as const;

/**
 * UPPER-FACE PRESENCE — P1.2 §8.
 *
 * IDLE ONLY, and structurally unable to become the rejected prosodic speech brow
 * pulse: nothing here is driven by acoustics, prominence or a phoneme, and the
 * whole layer is off the moment the state is `speaking`.
 *
 * Channels are the ones this asset's calibration proved, with the measured brow
 * travel behind each: `browInnerUp` 6.75 mm, `browOuterUpLeft` 7.02 mm,
 * `browOuterUpRight` 6.76 mm. The FURROW (`browDown*`) is deliberately unused —
 * it moves the visible brow 3.2x less than its travel suggests and reads as
 * concern rather than attention.
 *
 * Amplitudes are anchored to the ACCEPTED HYPER3D EXPRESSION VOCABULARY, whose
 * poses hardware has already reviewed, rather than to numbers chosen here:
 *
 *   accepted `gentle-smile`  browOuterUp 0.12
 *   accepted `concerned`     browInnerUp 0.22
 */
export const ACTIVE_PRESENCE_UPPER_FACE = {
  /**
   * PER-VARIANT SHAPES — P1.3.
   *
   * P1.2 gave the four variants the same three channels at different sizes, so
   * they were four intensities of one expression rather than four expressions.
   * Hardware's verdict was that they are not visually distinct. Each now has a
   * DIFFERENT DOMINANT REGION, which is what makes them tell apart:
   *
   *   ATTENTIVE_WARMTH   cheek and lid led, with a trace of mouth. Warmth
   *                      WITHOUT a brow event — the pleasant, quiet one.
   *   CURIOUS_RESPONSE   brow led and strongly asymmetric (follow side 0.42),
   *                      with the inner brow raised. The "what's that" look.
   *   SOFT_FOCUS         lid only. Attention narrowing, essentially no brow and
   *                      no mouth — the opposite shape to CURIOUS_RESPONSE.
   *   ATTENTIVE_RESET    a modest, near-symmetric brow lift and nothing else:
   *                      the face coming back rather than expressing.
   *
   * `cheek` and `smile` are new here. Without them ATTENTIVE_WARMTH could only
   * speak through the brows, which is the wrong region for warmth entirely —
   * it is why that variant read as just another small brow move.
   *
   * NO FURROW. `browDown*` is permitted by the brief "where already validated",
   * and it is measured on this asset, but it moves the visible brow 3.2x less
   * than its travel suggests and its rendered meaning is concern. Spending a
   * channel that reads as an unhappy face to add distinctness to an IDLE
   * presence layer is a bad trade, so the distinctness comes from which region
   * leads instead.
   */
  variants: {
    ATTENTIVE_WARMTH: {
      outerUp: 0.115,
      outerUpFollow: 0.8,
      // ZERO, not a trace. `browInnerUp`'s measured useful minimum is 0.05, so
      // any value at or below it renders as nothing — writing one would be a
      // number in the table that never reaches the face. Warmth speaks through
      // the cheek, the lid and the mouth, which is the correct region for it.
      innerUp: 0,
      eyeSquint: 0.115,
      cheek: 0.069,
      smile: 0.035
    },
    CURIOUS_RESPONSE: {
      outerUp: 0.276,
      outerUpFollow: 0.42,
      innerUp: 0.161,
      eyeSquint: 0,
      cheek: 0,
      smile: 0
    },
    SOFT_FOCUS: {
      // LID ONLY, and the brow is exactly zero rather than 0.03 — which was
      // below `browOuterUp`'s 0.05 useful minimum and never rendered anyway.
      // Stating it as zero is what makes this the opposite shape to
      // CURIOUS_RESPONSE rather than a quieter version of it.
      outerUp: 0,
      outerUpFollow: 0,
      innerUp: 0,
      eyeSquint: 0.161,
      cheek: 0.023,
      smile: 0
    },
    ATTENTIVE_RESET: {
      outerUp: 0.15,
      outerUpFollow: 0.9,
      // Zero for the same reason as ATTENTIVE_WARMTH: 0.04 is below
      // `browInnerUp`'s 0.05 useful minimum and would never have rendered. The
      // reset is an OUTER brow lift and a return, which is a shape this asset
      // can actually hold.
      innerUp: 0,
      eyeSquint: 0.02,
      cheek: 0,
      smile: 0
    }
  },
  /**
   * AN EXPLICIT ENVELOPE — P1.3, and this replaces the exponential follower.
   *
   * P1.2 eased the upper face with `exponentialSmoothingAlpha` at a 0.62 s time
   * constant, which never actually arrives: it reaches 63% of the shape in
   * 0.62 s and 90% only after 1.43 s, so most of a short event was spent
   * ramping and the READABLE part of the expression was brief. That is the
   * "visually quiet" reading.
   *
   * These are DURATIONS, not time constants, and the envelope is a smoothstep
   * across each of them — so the shape arrives fully, is held at full value for
   * a readable stretch, and then leaves. Each of the three is drawn per event
   * inside its range.
   */
  fadeInMinSeconds: 0.25,
  fadeInRangeSeconds: 0.2,
  holdMinSeconds: 0.5,
  holdRangeSeconds: 0.6,
  fadeOutMinSeconds: 0.35,
  fadeOutRangeSeconds: 0.3,
  /** How often an eligible event actually carries its variant. */
  curiousProbability: 0.55,
  softFocusProbability: 0.45,
  /**
   * A settle after an ORDINARY posture change may also carry a reset — the
   * brief's "posture settle -> optional small attentive reset".
   *
   * Below a half deliberately. §5 is explicit that a facial event must not fire
   * after every head or gaze event, and a reset on every posture change is
   * exactly that.
   */
  postureResetProbability: 0.4
} as const;

/**
 * BODY PRESENCE — DISABLED, on measured evidence.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE RIG AUDIT FOUND
 * ─────────────────────────────────────────────────────────────────────────────
 * `scripts/hyper3d-body-presence-audit.mjs`, against the shipped
 * `additional_body.fbx` (222,438 vertices, 57 bones), evidence in
 * `docs/evidence/hyper3d-body-presence/`.
 *
 * The bones exist and are genuinely weighted:
 *
 *   Spine1_M   3,300 dominated vertices, mean weight 0.741
 *   Chest_M    4,160 dominated vertices, mean weight 0.667
 *
 * But `Neck_M` and `Head_M` are DESCENDANTS of both, and the rig has no
 * separate rib or breathing control, so every chest motion is a whole-upper-body
 * motion. Measured displacement per 1 deg of rotation, in rendered millimetres:
 *
 *   bone       axis   body surface   HEAD
 *   Chest_M    pitch     4.393 mm     7.111 mm
 *   Spine1_M   pitch     6.475 mm     9.132 mm
 *   Head_M     pitch     0.470 mm     2.646 mm      <- the reference
 *
 * One degree of CHEST pitch drags the head 2.7x further than one degree of HEAD
 * pitch moves it. That is a bow, not a breath. To keep the head effect at a
 * fifth of the head layer's own motion the chest would have to stay under about
 * 0.06 deg, which displaces the chest surface by 0.28 mm — invisible at this
 * framing. Any amplitude large enough to SEE on the chest puts an unowned world
 * head pitch outside the head rails and reads as a nod.
 *
 * Translation does not help: the head is rigidly parented, so a chest rise is a
 * whole-upper-body rise rather than a chest expansion.
 *
 * The shoulders are clean of head coupling (0.000 mm of head displacement) and
 * well weighted, but 85% of what a shoulder rotation moves is the ARM below it
 * (subtree 21,401 vertices against 3,263 dominated), so shoulder breathing is a
 * shrug at this framing.
 *
 * The brief's instruction for this case is explicit: report it and leave body
 * presence disabled rather than faking it. Flipping this to `true` without a rig
 * that can carry it would add a nod the head owner does not know about.
 */
export const ACTIVE_PRESENCE_BODY = {
  enabled: false,
  reason:
    "Neck_M and Head_M are descendants of Chest_M/Spine1_M and the rig has no separate rib control. 1 deg of chest pitch displaces the head 7.111 mm against Head_M's own 2.646 mm/deg — a bow, not a breath. Any chest-visible amplitude puts unowned world head pitch outside the head rails. See docs/evidence/hyper3d-body-presence/."
} as const;

/**
 * SPEAKING -> IDLE and IDLE -> SPEAKING.
 *
 * `settleSeconds` is how long after speech stops before the planner is allowed
 * to schedule anything: the face returns to neutral engagement first, from the
 * pose it is ACTUALLY in, and only then does idle begin. `releaseSeconds` is the
 * crossfade back to the speaking owner, computed inside the presence resolver so
 * exactly one value per channel per frame is ever written.
 *
 * The release is short because speech wins immediately. It delays no phoneme:
 * articulation is on the MFA path and is never read, written or blended here.
 */
export const ACTIVE_PRESENCE_HANDOFF = {
  settleSeconds: 1.45,
  releaseSeconds: 0.26
} as const;

/**
 * The fixed seed the deterministic hardware review replays.
 *
 * NOT A HAND-AUTHORED DEMO. This is an ordinary production seed and its plan
 * comes out of the same planner, with the same probabilities, that ships. It was
 * SELECTED — by scanning seeds for one whose sixty seconds happens to contain
 * every element the review is asked to show: an uncommon strong reorientation,
 * an eyes-lead-head event, a visible warmth event, all four upper-face variants,
 * a long attentive hold, and a blink cadence with a healthy spread.
 *
 * Choosing which representative minute to record is a review decision. Authoring
 * a theatrical sequence would be a different thing entirely, and is not what this
 * is: nothing anywhere reads this constant except the review button and the
 * tests, and the planner cannot tell which seed it was given.
 */
export const ACTIVE_PRESENCE_REVIEW_SEED = "hyper3d-active-presence-review-530";

/** The production seed. Different plan, same architecture. */
export const ACTIVE_PRESENCE_DEFAULT_SEED = "hyper3d-active-presence-1";

/**
 * CHANNELS ACTIVE PRESENCE MAY WRITE.
 *
 * The list is the enforcement, exactly as the accepted speaking layer's is: the
 * resolver builds its pose through a helper that refuses any name absent from
 * here, and a test asserts the intersection with the central speech channels is
 * empty. `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`, every viseme,
 * every lip-seal channel and every tongue channel are unreachable because they
 * are not named.
 */
export const ACTIVE_PRESENCE_FACE_CHANNELS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  /**
   * P1.2 — THE UPPER FACE.
   *
   * Added to the OWNED list, which is what makes them safe. In P1 the accepted
   * seam deleted the brow channels and rewrote them from the speaking layer,
   * whose idle brow output is empty — so idle brows were pinned at exactly zero
   * by a layer that was not trying to express anything. Owning them here means
   * one writer decides them in idle and one writer decides them while speaking.
   *
   * `browDownLeft` / `browDownRight` are deliberately NOT here: the furrow reads
   * as concern and this asset moves the visible brow 3.2x less than its measured
   * travel suggests, so it is not a channel idle presence should be spending.
   */
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight"
] as const;

/**
 * CHANNELS ACTIVE PRESENCE MUST NEVER WRITE, named so the test can be explicit
 * rather than inferring the complement of a whitelist.
 */
export const ACTIVE_PRESENCE_FORBIDDEN_CHANNELS = [
  "jawOpen",
  "jawForward",
  "jawLeft",
  "jawRight",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthLeft",
  "mouthRight",
  "tongueOut"
] as const;

/**
 * The measured resting values the face layer floors onto, resolved from the
 * accepted baseline at module load so the two can never disagree.
 */
export const activePresenceUsefulMin = (channel: string) =>
  hyper3dMorphCalibration[channel]?.usefulMin ?? 0;

export const activePresenceNaturalMax = (channel: string) =>
  hyper3dMorphCalibration[channel]?.naturalMax ?? 1;
