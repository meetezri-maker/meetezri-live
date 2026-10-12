import { readFileSync } from "node:fs";
import { CoarticulationEngine } from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { SpeechBoundaryTimeline } from "./engine/engine/timeline/SpeechBoundaryTimeline";
import { TimelineCursor } from "./engine/engine/timeline/TimelineCursor";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  HYPER3D_DEADLINE_MAX_SPEEDS,
  HYPER3D_LANDING_EXPONENTS,
  getMouthTransitionProfile,
  resolveMouthDeadline,
  type MouthDeadlineOverride
} from "./engine/mappings/avatarBlendshapeConfig";
import type { AvatarPayload } from "./engine/types/avatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";
import {
  BILABIAL_PHONEMES,
  HYPER3D_DEADLINE_ELIGIBLE,
  HYPER3D_REACH_CHANNELS,
  REACH_FLOOR,
  countJawCycles,
  median,
  percentile,
  poseDistanceMM,
  summarizeReach,
  travelMM,
  type MotionReport,
  type ReachReport,
  type ReachSample
} from "./hyper3dDeadlineInstrumentation";
import {
  ARRIVAL_BAND,
  collectArrivalFrame,
  summarizeArrival,
  type ArrivalReport,
  type ArrivalSample,
  type OriginMemo
} from "./hyper3dArrivalDiagnostics";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEADLINE COMPARISON, over the golden aligned corpus.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ONE RUNNER, THREE MODES, and §10 of the brief is the whole specification: the
 * same payload object, the same phoneme array, the same timestamps, the same
 * clock, the same frame deltas, the same engine, the same profile, the same
 * calibration. The ONLY difference between a CURRENT run and a DEADLINE run is
 * the `maxSpeed` handed to `withMouthDeadline`, and CURRENT hands it `null`,
 * which returns the production profile by identity.
 *
 * It is the PRODUCTION classes doing the work — `TimelineCursor`,
 * `CoarticulationEngine`, `FacialPoseMixer`, `calibrateHyper3dPose` — driven on
 * the same audio clock `AvatarController` drives them on, and the deadline is
 * read from the same `activePhoneme` lookup the blend consumed. There is no
 * second lip-sync engine here and no re-implementation of the follower.
 *
 * WHAT IT DELIBERATELY LEAVES OUT. Emotion, cues, idle expression, warmth, the
 * head, gaze and blink. They write channels this comparison does not measure and
 * none of them can reach the deadline layer, so including them would add
 * variance without adding evidence. The articulation channel is the one under
 * test and it is the one that is driven.
 *
 * NOT SHIPPED CODE. Node-only (it reads the fixture from disk) and imported by
 * the regression and by nothing on a render path.
 */

const AVATAR_TEST = "/home/marqlinux/avatar-test";

export const CORPUS_PAYLOADS: readonly { id: string; path: string }[] = Object.freeze([
  { id: "david-natural-speech-paragraph", path: `${AVATAR_TEST}/src/data/tuning/generated/david-natural-speech-paragraph.payload.json` },
  { id: "14-natural-mixed", path: `${AVATAR_TEST}/src/data/tuning/generated/14-natural-mixed.payload.json` },
  { id: "15-fast-mixed", path: `${AVATAR_TEST}/src/data/tuning/generated/15-fast-mixed.payload.json` },
  { id: "16-slow-mixed", path: `${AVATAR_TEST}/src/data/tuning/generated/16-slow-mixed.payload.json` }
]);

export const loadPayload = (path: string): AvatarPayload =>
  JSON.parse(readFileSync(path, "utf8")) as AvatarPayload;

/** The render frame rate the whole pipeline is tuned at. */
export const FRAME_SECONDS = 1 / 60;

/**
 * `current` and `d44` are retained for regression rather than for tuning: the
 * hardware verdict locked 34 as the working baseline and ruled 44 out, and §16
 * asks for the old implementation to stay reachable.
 */
export type DeadlineModeId =
  | "production"
  | "current"
  | "d34"
  | "d44"
  | "d34soft"
  | "d34softB"
  | "d34softC";

/**
 * THE OVERRIDE EACH MEASUREMENT MODE APPLIES.
 *
 * `production` applies NONE, so it measures whatever the `hyper3d-usc` profile
 * actually carries. Every other mode states its own configuration explicitly
 * rather than inheriting it, so a comparison keeps its meaning if production is
 * ever retuned — and so the regression that asserts `production` renders
 * identically to `d34soft` is a real check rather than a tautology.
 *
 * `current` is `"off"`, not "no override". Since 34 SOFT became the production
 * default, "no override" means 34 SOFT; the pre-deadline follower now has to be
 * asked for.
 */
export const DEADLINE_MODE_OVERRIDES: Readonly<Record<DeadlineModeId, MouthDeadlineOverride>> =
  Object.freeze({
    production: null,
    current: "off",
    d34: { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: null },
    d44: { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d44, landingExponent: null },
    d34soft: { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: HYPER3D_LANDING_EXPONENTS.a },
    d34softB: { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: HYPER3D_LANDING_EXPONENTS.b },
    d34softC: { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: HYPER3D_LANDING_EXPONENTS.c }
  });

export interface CorpusRunResult {
  mode: DeadlineModeId;
  payloadId: string;
  frames: number;
  seconds: number;
  reach: ReachReport;
  motion: MotionReport;
  /**
   * THE TIMELINE FINGERPRINT. One entry per frame: the clock, the id of the
   * label the cursor resolved and the seconds remaining in it. Two runs whose
   * fingerprints are equal cannot differ in audio timing, phoneme timestamps,
   * label occupancy or deadline derivation — that is what makes "drift is zero"
   * a comparison rather than an assertion about intent.
   */
  timeline: readonly string[];
  /** Median bilabial closure timing error, ms (rendered peak vs demanded peak). */
  closureTimingErrorMs: number;
  /** Peak rendered `mouthClose` over the run — the seal this must not weaken. */
  closurePeak: number;
  /** The rendered pose on every frame, for a bit-equivalence comparison. */
  rendered: readonly BlendshapePose[];
  /** How many frames the deadline layer accelerated at least one channel on. */
  acceleratedFrames: number;
  /** Highest convergence speed demanded over the whole run. */
  peakDemandedSpeed: number;
  /** §11 / §14 — where the layer accelerates, and how fast the mouth arrives. */
  arrival: ArrivalReport;
  /**
   * Per-frame mouth speeds, mm/s, kept so a candidate can be quoted at p50, p90,
   * p95 and peak rather than at one percentile.
   */
  velocities: readonly number[];
  /** Per-frame mouth ACCELERATION magnitudes, mm/s². */
  accelerations: readonly number[];
  /**
   * Seconds spent with the mouth already near the label's shape before the label
   * ends, summed over labels — §13's "time near target before phoneme end".
   */
  nearTargetSeconds: number;
  /**
   * The same thing as a SHARE of the channel-seconds a label actually demanded a
   * visible shape on. The comparable form, and the one §15 criterion 1 is read
   * against: a candidate that lowered arrival velocity by never arriving would
   * show it here.
   */
  nearTargetShare: number;
  /** The cross-check: the mixer's own accelerated-channel count, summed. */
  mixerAcceleratedChannelFrames: number;
  /** The recomputation's accelerated channel-frame count. Must equal the above. */
  recomputedAcceleratedChannelFrames: number;
}

type Window = {
  id: string;
  phoneme: string;
  seconds: number;
  demand: BlendshapePose;
  reached: BlendshapePose;
  closureDemandAt: number;
  closureDemandPeak: number;
  closureRenderedAt: number;
  closureRenderedPeak: number;
};

/**
 * Drive one payload through the production chain at one deadline cap.
 *
 * `cap === null` is CURRENT and takes the accepted follower by identity.
 */
export function runCorpus(
  payload: AvatarPayload,
  payloadId: string,
  mode: DeadlineModeId,
  /**
   * The speech profile to articulate with. Defaults to the shipped Hyper3D
   * table; a caller passes the pre-refinement table to A/B a shape change
   * through the identical chain. Nothing else about the run differs.
   */
  speechProfile: typeof hyper3dPhonemeToBlendshape = hyper3dPhonemeToBlendshape
): CorpusRunResult {
  const override = DEADLINE_MODE_OVERRIDES[mode];
  const cursor = new TimelineCursor(payload);
  const engine = new CoarticulationEngine();
  const mixer = new FacialPoseMixer();
  const boundaries = new SpeechBoundaryTimeline(payload);
  const profile = resolveMouthDeadline(getMouthTransitionProfile("hyper3d-usc"), override);
  const coarticulationWindow = payload.behaviour_settings?.coarticulation_window ?? 0.08;

  const reach: ReachSample[] = [];
  const velocities: number[] = [];
  const accelerations: number[] = [];
  const jawSeries: number[] = [];
  const closureErrorsMs: number[] = [];
  const timeline: string[] = [];
  const rendered: BlendshapePose[] = [];
  const arrivalSamples: ArrivalSample[] = [];
  const origins: OriginMemo = new Map();
  const arrived = new Set<string>();
  let previousSmoothed: Record<string, number> = {};
  let previousVelocity = 0;
  let nearTargetSeconds = 0;
  let demandChannelSeconds = 0;
  let mixerAcceleratedChannelFrames = 0;
  let window: Window | null = null;
  let previous: BlendshapePose = {};
  let allTravel = 0;
  let jawTravel = 0;
  let closurePeak = 0;
  let acceleratedFrames = 0;
  let peakDemandedSpeed = 0;
  let frames = 0;

  const closeWindow = () => {
    if (!window) return;
    for (const [channel, demand] of Object.entries(window.demand)) {
      if (demand < REACH_FLOOR) continue;
      if (!HYPER3D_REACH_CHANNELS.includes(channel)) continue;
      reach.push({
        phoneme: window.phoneme,
        channel,
        labelSeconds: window.seconds,
        reach: (window.reached[channel] ?? 0) / demand
      });
    }
    if (BILABIAL_PHONEMES.has(window.phoneme) && window.closureDemandPeak >= REACH_FLOOR) {
      closureErrorsMs.push((window.closureRenderedAt - window.closureDemandAt) * 1000);
    }
    window = null;
  };

  /**
   * The clock. Advanced by a FIXED frame delta and read by every consumer, which
   * is the one property the comparison depends on: no mode can change it,
   * because nothing downstream of it writes it.
   */
  for (let frame = 0; ; frame += 1) {
    const t = frame * FRAME_SECONDS;
    if (t > payload.audio_duration) break;
    frames += 1;

    const clock = cursor.seek(t);
    const current = cursor.activePhoneme(clock);
    const previousLabel = cursor.previousPhoneme(clock);
    const next = cursor.nextPhoneme(clock);

    const lip = engine.blend({
      time: clock,
      current,
      previous: previousLabel,
      next,
      windowSeconds: coarticulationWindow,
      profile: speechProfile
    });
    const mixed = mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);

    const settling = boundaries.proximityAt(clock)?.insidePauseKind === "sentence";
    /**
     * THE DEADLINE, derived exactly as `AvatarController` derives it: the END of
     * the label the cursor just resolved, minus the clock the blend just used.
     */
    const secondsRemaining = current ? current.end_time - clock : null;
    timeline.push(
      `${clock.toFixed(6)}|${current?.id ?? "-"}|${current?.phoneme ?? "-"}|${(secondsRemaining ?? -1).toFixed(6)}|${settling ? "S" : "-"}`
    );

    /**
     * The seal gate, resolved exactly as the mixer resolves it, so the arrival
     * diagnostics below sample the same frames the layer actually reached.
     */
    const sealing = profile ? (mixed.pose.mouthClose ?? 0) >= profile.sealClosureThreshold : false;
    const beforeSmooth = { ...previousSmoothed };
    const smoothed = mixer.smooth(mixed.pose, FRAME_SECONDS, undefined, profile, settling, secondsRemaining);
    const frameReport = mixer.deadlineFrame();
    if (frameReport.acceleratedChannels > 0) acceleratedFrames += 1;
    mixerAcceleratedChannelFrames += frameReport.acceleratedChannels;
    if (frameReport.peakSpeed > peakDemandedSpeed) peakDemandedSpeed = frameReport.peakSpeed;
    if (profile && current) {
      collectArrivalFrame(
        {
          phoneme: current.phoneme,
          labelId: current.id,
          labelSeconds: current.end_time - current.start_time,
          secondsRemaining: secondsRemaining ?? 0,
          sealing,
          settling,
          deltaSeconds: FRAME_SECONDS,
          previousSmoothed: beforeSmooth,
          target: mixed.pose,
          smoothed,
          mouth: profile,
          deadline: profile.deadline
        },
        origins,
        arrived,
        arrivalSamples
      );
    }
    /**
     * §13's "time near target before phoneme end", in CHANNEL-seconds: for every
     * eligible channel the label actually asks for a visible shape, how long the
     * follower holds within the arrival band of it. Counted against the total
     * demanded channel-seconds below, so it reads as a SHARE and is comparable
     * between candidates regardless of how much speech a payload contains.
     *
     * This is the metric that would expose a landing curve that bought calm by
     * never arriving: it can only rise if the mouth gets there and stays.
     */
    if (current) {
      for (const channel of HYPER3D_DEADLINE_ELIGIBLE) {
        const demand = mixed.pose[channel] ?? 0;
        if (demand < REACH_FLOOR) continue;
        demandChannelSeconds += FRAME_SECONDS;
        if ((smoothed[channel] ?? 0) / demand >= ARRIVAL_BAND) nearTargetSeconds += FRAME_SECONDS;
      }
    }
    previousSmoothed = { ...smoothed };

    const pose = calibrateHyper3dPose(smoothed as BlendshapePose);
    rendered.push(pose);

    // Reach is measured in the FOLLOWER's domain, per label; see the module note.
    if (!current) {
      closeWindow();
    } else {
      if (!window || window.id !== current.id) {
        closeWindow();
        window = {
          id: current.id,
          phoneme: current.phoneme,
          seconds: current.end_time - current.start_time,
          demand: {},
          reached: {},
          closureDemandAt: 0,
          closureDemandPeak: 0,
          closureRenderedAt: 0,
          closureRenderedPeak: 0
        };
      }
      const open = window;
      for (const [name, value] of Object.entries(mixed.pose)) {
        if (value > (open.demand[name] ?? 0)) open.demand[name] = value;
      }
      for (const [name, value] of Object.entries(smoothed)) {
        if (value > (open.reached[name] ?? 0)) open.reached[name] = value;
      }
      const closeDemand = mixed.pose.mouthClose ?? 0;
      if (closeDemand > open.closureDemandPeak) {
        open.closureDemandPeak = closeDemand;
        open.closureDemandAt = clock;
      }
      const closeRendered = smoothed.mouthClose ?? 0;
      if (closeRendered > open.closureRenderedPeak) {
        open.closureRenderedPeak = closeRendered;
        open.closureRenderedAt = clock;
      }
    }

    const travelled = poseDistanceMM(pose, previous, HYPER3D_REACH_CHANNELS);
    allTravel += travelled;
    const velocity = travelled / FRAME_SECONDS;
    velocities.push(velocity);
    accelerations.push(Math.abs(velocity - previousVelocity) / FRAME_SECONDS);
    previousVelocity = velocity;
    jawTravel += Math.abs(travelMM("jawOpen", (pose.jawOpen ?? 0) - (previous.jawOpen ?? 0)));
    jawSeries.push(pose.jawOpen ?? 0);
    if ((pose.mouthClose ?? 0) > closurePeak) closurePeak = pose.mouthClose ?? 0;
    previous = pose;
  }
  closeWindow();

  const seconds = frames * FRAME_SECONDS;
  return {
    mode,
    payloadId,
    frames,
    seconds,
    reach: summarizeReach(reach),
    motion: {
      pathRateMMPerSecond: seconds > 0 ? allTravel / seconds : 0,
      velocityP90MMPerSecond: percentile(velocities, 0.9),
      jawCyclesPerSecond: seconds > 0 ? countJawCycles(jawSeries) / seconds : 0,
      jawShare: allTravel > 0 ? jawTravel / allTravel : 0
    },
    timeline,
    closureTimingErrorMs: median(closureErrorsMs),
    closurePeak,
    rendered,
    acceleratedFrames,
    peakDemandedSpeed,
    arrival: summarizeArrival(arrivalSamples, profile?.deadline?.maxSpeed ?? 0),
    velocities,
    accelerations,
    nearTargetSeconds,
    nearTargetShare: demandChannelSeconds > 0 ? nearTargetSeconds / demandChannelSeconds : 0,
    mixerAcceleratedChannelFrames,
    recomputedAcceleratedChannelFrames: arrivalSamples.length
  };
}
