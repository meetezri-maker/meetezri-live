import {
  LIP_SHAPE_CHANNELS,
  deadlineConvergenceSpeed,
  isDeadlineEligibleChannel,
  type MouthDeadlineProfile,
  type MouthTransitionProfile
} from "./engine/mappings/avatarBlendshapeConfig";
import { exponentialSmoothingAlpha } from "./engine/utils/lerp";
import { median, percentile, travelMM } from "./hyper3dDeadlineInstrumentation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ARRIVAL DIAGNOSTICS — where Deadline 34 arrives too aggressively.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §11 AND §14 OF THE BRIEF, and nothing else. This module answers one question
 * with measurement rather than intuition: at what COMPLETION of the requested
 * movement is the deadline layer still demanding extra speed, and how fast is
 * the channel travelling at the moment it arrives.
 *
 * IT RECOMPUTES, IT DOES NOT RE-IMPLEMENT. Every per-channel speed below comes
 * from `deadlineConvergenceSpeed` — the exact function `FacialPoseMixer` calls —
 * fed the exact inputs the mixer was fed on that frame (`from` is the previous
 * frame's SMOOTHED value, which is what `this.current[key]` holds; `to` is the
 * combined target; the baseline is resolved by the same rule). The corpus runner
 * cross-checks the recomputation against the mixer's own per-frame report, so a
 * divergence between the two is a test failure rather than a silent wrong number.
 *
 * TWO NORMALIZATIONS ARE MEASURED, because §5 asks for the right one rather than
 * a guessed one:
 *
 *   TARGET-RELATIVE    completion = rendered / target
 *                      error      = (target - rendered) / target
 *
 *   EXCURSION-RELATIVE completion = (rendered - origin) / (target - origin)
 *                      where `origin` is the rendered value at the frame this
 *                      channel's movement toward THIS label began.
 *
 * They disagree in exactly one case and it is the interesting one: a SHORT HOP
 * from an already-high value (origin 0.40 -> target 0.50). Excursion-relative
 * calls that 0 % complete and would hand it full assistance; target-relative
 * calls it 80 % complete and would hand it almost none. The distributions below
 * are what decide which of those is the behaviour the visual complaint is about.
 *
 * NOT SHIPPED. Measurement only, imported by the corpus runner and the
 * regression, and by nothing on a render path.
 */

/** Completion at or above which a channel counts as having ARRIVED, for §14. */
export const ARRIVAL_BAND = 0.85;

/**
 * Completion at or above which a channel is in its FINAL APPROACH.
 *
 * 0.70 is read off the measured Deadline 34 distribution rather than chosen: it
 * is the level above which 22 % of accelerated channel-frames sit, so it is
 * populated enough to give a stable median on every payload while still being
 * unambiguously "the shape is mostly made".
 */
export const APPROACH_BAND = 0.7;

/** One frame of one eligible channel while the deadline layer was armed. */
export interface ArrivalSample {
  phoneme: string;
  channel: string;
  labelSeconds: number;
  secondsRemaining: number;
  /** The value the follower started this frame from (previous frame's smoothed). */
  from: number;
  /** The target the follower was handed this frame. */
  to: number;
  /** The rendered value at the frame this channel began moving toward `to`. */
  origin: number;
  /** `from / to`, the target-relative completion. */
  targetCompletion: number;
  /** `(from - origin) / (to - origin)`, the excursion-relative completion. */
  excursionCompletion: number;
  /** Absolute remaining target error, in channel units. */
  error: number;
  /** The speed the deadline formula demanded, before any landing term. */
  demandedSpeed: number;
  /** The speed actually applied by the follower this frame. */
  appliedSpeed: number;
  /** The channel's accepted follower speed, with no assistance. */
  baselineSpeed: number;
  /** Geometric speed of this channel this frame, mm/s. */
  velocityMMPerSecond: number;
  /** True on the frame this channel first entered the arrival band. */
  arriving: boolean;
}

/**
 * The accepted follower speed for one channel, by the SAME rule
 * `FacialPoseMixer.writeSmoothedValue` applies. Duplicated here only to feed the
 * recomputation; the corpus runner asserts the two agree.
 */
export const baselineSpeedFor = (
  channel: string,
  from: number,
  to: number,
  mouth: MouthTransitionProfile,
  sealing: boolean
): number => {
  if (channel.startsWith("jaw")) return to < from && !sealing ? mouth.closeSpeed : mouth.openSpeed;
  if (mouth.lipShapeSpeed !== undefined && LIP_SHAPE_CHANNELS.includes(channel)) return mouth.lipShapeSpeed;
  return 28;
};

/** Per-channel transition memo: where this label's movement started. */
export type OriginMemo = Map<string, { labelId: string; origin: number }>;

export interface ArrivalFrameInput {
  phoneme: string;
  labelId: string;
  labelSeconds: number;
  secondsRemaining: number;
  sealing: boolean;
  settling: boolean;
  deltaSeconds: number;
  /** Previous frame's SMOOTHED pose — what the mixer's `from` reads. */
  previousSmoothed: Record<string, number>;
  /** This frame's combined target — what the mixer's `to` reads. */
  target: Record<string, number>;
  /** This frame's smoothed result, for the applied-speed and velocity readings. */
  smoothed: Record<string, number>;
  mouth: MouthTransitionProfile;
  deadline: MouthDeadlineProfile | undefined;
}

/**
 * Collect one frame's eligible-channel samples.
 *
 * `origins` is mutated: a channel whose label changed, or that was not moving
 * toward this target, re-anchors its origin to the value it is starting from.
 * That is what makes `excursionCompletion` mean "progress through THIS
 * phoneme's requested movement" rather than progress from zero.
 */
export function collectArrivalFrame(
  input: ArrivalFrameInput,
  origins: OriginMemo,
  arrived: Set<string>,
  out: ArrivalSample[]
) {
  const { target, previousSmoothed, smoothed, mouth, deadline } = input;
  if (input.settling) return;
  for (const channel of Object.keys(target)) {
    if (!isDeadlineEligibleChannel(channel)) continue;
    const from = previousSmoothed[channel] ?? 0;
    const to = target[channel] ?? 0;
    const baselineSpeed = baselineSpeedFor(channel, from, to, mouth, input.sealing);
    /**
     * The same gate the follower applies. A channel the layer would not touch is
     * not a sample: measuring frames the mechanism cannot reach would describe
     * the envelope rather than the arrival.
     */
    if (!deadline || input.sealing) continue;
    const demandedSpeed = deadlineConvergenceSpeed(
      channel,
      from,
      to,
      baselineSpeed,
      input.secondsRemaining,
      deadline
    );
    if (demandedSpeed <= baselineSpeed) {
      // Not accelerated this frame. Still re-anchor the origin if the label moved.
      const memo = origins.get(channel);
      if (!memo || memo.labelId !== input.labelId) {
        origins.set(channel, { labelId: input.labelId, origin: from });
        arrived.delete(channel);
      }
      continue;
    }
    let memo = origins.get(channel);
    if (!memo || memo.labelId !== input.labelId) {
      memo = { labelId: input.labelId, origin: from };
      origins.set(channel, memo);
      arrived.delete(channel);
    }
    const excursion = to - memo.origin;
    /**
     * TINY EXCURSION SAFETY. An excursion at or below the layer's own tolerance
     * carries no measurable completion, so it reports 1 — fully complete — which
     * is the honest answer and is also the answer that keeps a landing curve from
     * dividing by something near zero.
     */
    const excursionCompletion =
      Math.abs(excursion) <= deadline.tolerance ? 1 : (from - memo.origin) / excursion;
    const targetCompletion = to > deadline.tolerance ? from / to : 1;
    const applied = smoothed[channel] ?? 0;
    /**
     * The speed the follower actually used, recovered from the step it took:
     * `applied = from + (to - from) * (1 - exp(-s dt))`, solved for `s`.
     */
    const travelledShare = to === from ? 0 : (applied - from) / (to - from);
    const appliedSpeed =
      travelledShare > 0 && travelledShare < 1
        ? -Math.log(1 - travelledShare) / Math.max(1e-9, input.deltaSeconds)
        : demandedSpeed;
    const wasArrived = arrived.has(channel);
    const nowArrived = targetCompletion >= ARRIVAL_BAND;
    if (nowArrived) arrived.add(channel);
    out.push({
      phoneme: input.phoneme,
      channel,
      labelSeconds: input.labelSeconds,
      secondsRemaining: input.secondsRemaining,
      from,
      to,
      origin: memo.origin,
      targetCompletion,
      excursionCompletion,
      error: to - from,
      demandedSpeed,
      appliedSpeed,
      baselineSpeed,
      velocityMMPerSecond: Math.abs(travelMM(channel, applied - from)) / Math.max(1e-9, input.deltaSeconds),
      arriving: nowArrived && !wasArrived
    });
  }
}

export interface ArrivalReport {
  frames: number;
  /** Distribution of target-relative completion over accelerated channel-frames. */
  targetCompletion: { p10: number; p25: number; p50: number; p75: number; p90: number };
  excursionCompletion: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Share of accelerated channel-frames above each completion level. */
  shareAbove: Record<string, number>;
  /** Milliseconds of label remaining, over accelerated channel-frames. */
  remainingMs: { p10: number; p50: number; p90: number };
  demandedSpeed: { p50: number; p90: number; max: number };
  appliedSpeed: { mean: number; p50: number; p90: number };
  /** Share of accelerated channel-frames running at or near the cap. */
  atCapShare: number;
  /** §14 — velocity on the frame a channel first enters the arrival band. */
  arrivalVelocity: { samples: number; p50: number; p90: number; p95: number };
  /**
   * §14, IN ITS USABLE FORM. Velocity over EVERY accelerated channel-frame in
   * the final approach, `targetCompletion >= APPROACH_BAND`, rather than only the
   * single frame that crosses the arrival band.
   *
   * The crossing event fires at most once per channel per label, which is 10-21
   * samples on the short fixtures — too few for a median to be read. The approach
   * band carries roughly a fifth of all accelerated channel-frames, so it is
   * stable on every payload, and it is the same quantity the visual complaint is
   * about: how fast the mouth is still travelling once the shape is mostly made.
   */
  approachVelocity: { samples: number; p50: number; p90: number; p95: number };
  /** Share of accelerated channel-frames that are already inside the band. */
  acceleratedInsideBandShare: number;
}

const quantiles = (values: readonly number[]) => ({
  p10: percentile(values, 0.1),
  p25: percentile(values, 0.25),
  p50: median(values),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.9)
});

export function summarizeArrival(samples: readonly ArrivalSample[], cap: number): ArrivalReport {
  const targetCompletions = samples.map((s) => s.targetCompletion);
  const excursionCompletions = samples.map((s) => s.excursionCompletion);
  const arrivals = samples.filter((s) => s.arriving).map((s) => s.velocityMMPerSecond);
  const approach = samples
    .filter((s) => s.targetCompletion >= APPROACH_BAND)
    .map((s) => s.velocityMMPerSecond);
  const shareAbove: Record<string, number> = {};
  for (const level of [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]) {
    shareAbove[`${Math.round(level * 100)}%`] =
      samples.length === 0 ? 0 : samples.filter((s) => s.targetCompletion >= level).length / samples.length;
  }
  const appliedSpeeds = samples.map((s) => s.appliedSpeed);
  return {
    frames: samples.length,
    targetCompletion: quantiles(targetCompletions),
    excursionCompletion: quantiles(excursionCompletions),
    shareAbove,
    remainingMs: {
      p10: percentile(samples.map((s) => s.secondsRemaining * 1000), 0.1),
      p50: median(samples.map((s) => s.secondsRemaining * 1000)),
      p90: percentile(samples.map((s) => s.secondsRemaining * 1000), 0.9)
    },
    demandedSpeed: {
      p50: median(samples.map((s) => s.demandedSpeed)),
      p90: percentile(samples.map((s) => s.demandedSpeed), 0.9),
      max: samples.reduce((max, s) => Math.max(max, s.demandedSpeed), 0)
    },
    appliedSpeed: {
      mean: appliedSpeeds.length === 0 ? 0 : appliedSpeeds.reduce((a, b) => a + b, 0) / appliedSpeeds.length,
      p50: median(appliedSpeeds),
      p90: percentile(appliedSpeeds, 0.9)
    },
    atCapShare:
      samples.length === 0 ? 0 : samples.filter((s) => s.demandedSpeed >= cap - 1e-9).length / samples.length,
    arrivalVelocity: {
      samples: arrivals.length,
      p50: median(arrivals),
      p90: percentile(arrivals, 0.9),
      p95: percentile(arrivals, 0.95)
    },
    approachVelocity: {
      samples: approach.length,
      p50: median(approach),
      p90: percentile(approach, 0.9),
      p95: percentile(approach, 0.95)
    },
    acceleratedInsideBandShare:
      samples.length === 0
        ? 0
        : samples.filter((s) => s.targetCompletion >= ARRIVAL_BAND).length / samples.length
  };
}

/** Sanity: the alpha the recomputed speed implies, for the cross-check. */
export const alphaFor = exponentialSmoothingAlpha;
