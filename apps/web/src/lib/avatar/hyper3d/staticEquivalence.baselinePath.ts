import { AvatarController } from "./engine/engine/avatar/AvatarController";
import {
  ThreejsTalkingAvatarPerformance,
  planHeadPerformance,
} from "./engine/engine/avatar/upstream/threejs-talking-avatar/performance";
import {
  threejsTalkingAvatarBrowPose,
  toUpstreamPhonemes,
} from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import {
  HYPER3D_PRODUCTION_AFFECT_REQUEST,
  Hyper3dWarmthYieldFollower,
  affectArticulationYield,
  hyper3dAffectPose,
} from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { loadGoldenAcoustics, loadGoldenPayload } from "./staticEquivalence.harness";
import type { TimedPhoneme } from "./engine/types/avatarPayload";

/**
 * THE BASELINE'S OWN MEASUREMENT PATH, reproduced over the SOLACE-PORTED ENGINE.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ───────────────────────────────────────────────────────────────────────────────
 * `BASELINE_GOLDEN` is not an abstract record of "the reviewed render" — every
 * figure in it is produced by one concrete harness in the source repository,
 * `avatar-test/src/tests/hyper3dPerformanceBaselineContract.test.ts`, and that
 * harness makes four measurement choices this file copies EXACTLY:
 *
 *   1. SPEAKING FRAMES are the frames inside `plan.affectPhraseSpans` — 1796 of
 *      2237 on this clip, which is the same 1796 the `AFFECT_REFERENCE.eyeSquint`
 *      note quotes. Not every frame of the payload.
 *   2. The warmth channel read is `mouthSmileLeft`, not `max(left, right)`.
 *   3. The quantile is `sorted[floor(p * n)]` — see `baselineQuantile`.
 *   4. The rendering share counts values ABOVE the channel's `usefulMin`, not
 *      merely above zero.
 *   5. The pose handed to `affectArticulationYield` is `lip.targetPose`, the
 *      PRE-CALIBRATION speech pose.
 *
 * Point 5 is load-bearing and is the one real behavioural difference between
 * this path and the Solace production mount. See the note on
 * `ACCEPTED_YIELD_POSE_DIVERGENCE` below.
 *
 * Running this path over the ported engine is the only way to compare like with
 * like against `BASELINE_GOLDEN`: measuring the right runtime with a different
 * estimator is exactly how this harness previously reported a head divergence
 * (0.700x) that did not exist.
 */

const STEP = 1 / 60;

export interface BaselinePathRun {
  /** Frames inside `plan.affectPhraseSpans`. */
  readonly speakingFrames: number;
  readonly totalFrames: number;
  /** `affect.mouthSmileLeft` on speaking frames. */
  readonly smileLeft: number[];
  /** `affect.cheekSquintLeft` on speaking frames. */
  readonly cheekLeft: number[];
  /** `affect.eyeSquintLeft` on speaking frames — the un-yielded lid channel. */
  readonly eyeSquintLeft: number[];
  /** Upstream's raw lid, every frame. */
  readonly lid: number[];
  /** Semantic brow magnitude, every frame. */
  readonly brow: number[];
  /** Semantic brow magnitude, speaking frames only. */
  readonly browSpeaking: number[];
  /** Planned blink times, in seconds. */
  readonly blinkTimes: number[];
  /** The followed articulation yield, speaking frames only. */
  readonly followedYield: number[];
}

/** One pass of the accepted configuration over the golden payload. */
export function runAcceptedBaselinePath(): BaselinePathRun {
  const source = loadGoldenPayload();
  const acousticFrames = loadGoldenAcoustics();

  const plan = planHeadPerformance({
    text: source.text,
    userText: HYPER3D_PRODUCTION_AFFECT_REQUEST,
    phonemes: toUpstreamPhonemes(source.phonemes as TimedPhoneme[]),
    acousticFrames,
    durationSeconds: source.audio_duration,
  });

  const performance = new ThreejsTalkingAvatarPerformance();
  performance.setPlan(plan);
  performance.setAffectEnabled(true);
  performance.setAmbientGazeWhileSpeaking(true);

  const controller = new AvatarController(source);
  const warmthYield = new Hyper3dWarmthYieldFollower();

  const smileLeft: number[] = [];
  const cheekLeft: number[] = [];
  const eyeSquintLeft: number[] = [];
  const lid: number[] = [];
  const brow: number[] = [];
  const browSpeaking: number[] = [];
  const followed: number[] = [];
  let speakingFrames = 0;
  let totalFrames = 0;

  for (let index = 0; index * STEP <= source.audio_duration; index += 1) {
    const t = index * STEP;
    totalFrames += 1;

    const lip = controller.evaluate(t, STEP, {
      modelId: "hyper3d-usc",
      headSupported: true,
      playbackActive: true,
      audioPlaying: true,
    } as never);
    const frame = performance.sample({
      timeSeconds: t,
      deltaSeconds: STEP,
      speechActive: true,
    });

    // PRE-CALIBRATION POSE, exactly as the baseline harness passes it.
    const followedYield = warmthYield.step(
      affectArticulationYield(lip.lowerFaceIntent.bilabialClosure, lip.targetPose),
      STEP,
    );
    const affect = hyper3dAffectPose(
      frame,
      lip.lowerFaceIntent.bilabialClosure,
      lip.targetPose,
      undefined,
      followedYield,
    ) as Record<string, number>;

    const brows = threejsTalkingAvatarBrowPose(frame) as Record<string, number>;
    const browValue = Math.max(
      brows.browOuterUpLeft ?? 0,
      brows.browOuterUpRight ?? 0,
      brows.browInnerUp ?? 0,
    );
    lid.push(frame.blinkLeft);
    brow.push(browValue);

    if (plan.affectPhraseSpans.some((span) => t >= span.start && t <= span.end)) {
      speakingFrames += 1;
      smileLeft.push(affect.mouthSmileLeft ?? 0);
      cheekLeft.push(affect.cheekSquintLeft ?? 0);
      eyeSquintLeft.push(affect.eyeSquintLeft ?? 0);
      browSpeaking.push(browValue);
      followed.push(followedYield);
    }
  }

  return {
    speakingFrames,
    totalFrames,
    smileLeft,
    cheekLeft,
    eyeSquintLeft,
    lid,
    brow,
    browSpeaking,
    blinkTimes: plan.blinks.map((blink) => blink.time),
    followedYield: followed,
  };
}

/**
 * THE ONE MEASURED DIFFERENCE BETWEEN THE BASELINE PATH AND THE PRODUCTION MOUNT.
 *
 * Both paths run the same engine, the same plan and the same affect frame. They
 * differ in a single argument — the pose handed to `affectArticulationYield`:
 *
 *   baseline harness   `lip.targetPose`   PRE-calibration
 *   accepted runtime   `livelyPose`       POST-calibration (`AvatarModel.tsx:1440`,
 *                                          via `finalPose` <- `posedForWrite` <-
 *                                          `transformPoseForAvatarModel`, which
 *                                          applies `calibrateHyper3dPose` for
 *                                          `hyper3d-usc`; `morph.write` does not
 *                                          calibrate again)
 *
 * `mouthClose` carries the smallest gain in the calibration table (0.11), so the
 * pre-calibration pose is ~9x larger on that channel and saturates
 * `seal = mouthClose / ARTICULATION_REFERENCE.seal` far more often. The seal
 * reference is itself a CALIBRATED figure — 0.101376, the measured full closure —
 * and `AvatarModel.tsx:419` reads articulation signals through
 * `readArticulation(calibrateHyper3dPose(raw))`, so the calibrated pose is the
 * scale the function is written against.
 *
 * MEASURED, both over the Solace-ported engine, same fixture, same conventions:
 *
 *   pose handed to the yield     speakingSmileP50   speakingSmileMax
 *   `lip.targetPose`             0.1594             0.4078     <- BASELINE_GOLDEN
 *   calibrated `livelyPose`      0.2011             0.4395     <- accepted runtime
 *
 * NOTHING HERE WAS TUNED. The port reproduces BOTH figures exactly; the gap is a
 * property of the accepted system, not of the migration. The production
 * orchestrator transcribes `AvatarModel.tsx` and therefore reads 0.2011, and the
 * equivalence suite asserts the baseline figure through the baseline's own path
 * rather than restating it as a new golden for the runtime path.
 */
export const ACCEPTED_YIELD_POSE_DIVERGENCE = {
  baselineHarnessPose: "lip.targetPose (pre-calibration)",
  acceptedRuntimePose: "livelyPose (post-calibration, AvatarModel.tsx:1440)",
  baselineSmileP50: 0.159,
  runtimeSmileP50: 0.201,
} as const;
