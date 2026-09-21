import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  GOLDEN_AUDIO_PATH,
  baselineQuantile,
  loadGoldenAcoustics,
  loadGoldenPayload,
  percentile,
  readWavAsPcm,
} from "./staticEquivalence.harness";
import {
  ACCEPTED_YIELD_POSE_DIVERGENCE,
  runAcceptedBaselinePath,
} from "./staticEquivalence.baselinePath";
import { hyper3dMorphCalibration } from "./engine/mappings/avatars/hyper3dCalibration";
import { ARTICULATION_REFERENCE } from "./engine/engine/avatar/hyper3dFaceResolver";
import { BASELINE_GOLDEN } from "./engine/mappings/avatars/hyper3dPerformanceBaseline";
import { avatarModelConfigs } from "./engine/mappings/avatarModelConfig";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { BoneController } from "./engine/engine/avatar/BoneController";
import { resolveHyper3dFrame, createHyper3dPerformance } from "./hyper3dFrameOrchestrator";
import { ActivePresenceDirector } from "./engine/engine/avatar/hyper3dActivePresence";
import {
  HYPER3D_PRODUCTION_AFFECT_REQUEST,
  HYPER3D_WARMTH,
  Hyper3dWarmthYieldFollower,
} from "./engine/engine/avatar/hyper3dFacialLiveliness";
import {
  buildThreejsTalkingAvatarHeadPlan,
  createThreejsTalkingAvatarPerformance,
  resolveThreejsTalkingAvatarHead,
  THREEJS_TALKING_AVATAR_BLINK_CHANNELS,
  THREEJS_TALKING_AVATAR_BROW_CHANNELS,
  THREEJS_TALKING_AVATAR_GAZE_CHANNELS,
} from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import { defaultIdleExpressionSettings } from "./engine/engine/behaviour/IdleExpressionController";
import { defaultHeadNeckDiagnosticSettings } from "./engine/engine/animation/HeadNeckTransformDiagnostic";
import {
  HYPER3D_PRODUCTION_HEAD_MOTION_SCALE,
  HYPER3D_PRODUCTION_SPEAKING,
} from "./hyper3dProductionConfig";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * STATIC COMMAND EQUIVALENCE.
 *
 * Drives the Solace-side production configuration over the golden fixture and
 * compares the resulting commands against `BASELINE_GOLDEN` — the values the
 * REVIEWED render measured. Tolerances are the baseline's own; none were widened.
 *
 * Scope, stated plainly: this compares COMMANDS, not pixels, and it exercises
 * the engine + the production option set + the accepted resolvers. The GLB write
 * seam (morph influences on the mesh, bone rotations) is covered by the separate
 * binding test, which needs the real asset.
 */

const CONFIG = avatarModelConfigs["hyper3d-usc"];
const STEP = 1 / 60;

type Capture = {
  headYawDeg: number[];
  headPitchDeg: number[];
  blinkPeaks: number[];
  blinkTimes: number[];
  lidValues: number[];
  browMax: number;
  speakingFrames: number;
  warmthSmile: number[];
  eyeSquint: number[];
  framesWithGaze: number;
  headOnlyYawDeg: number[];
  /**
   * THE BASELINE'S OWN SAMPLE. `BASELINE_GOLDEN.warmth` counts only the frames
   * inside `plan.affectPhraseSpans` (1796 of 2237 here) and reads
   * `mouthSmileLeft` alone, so the comparable sample has to be built the same
   * way. The whole-clip `warmthSmile` above stays as a readout.
   */
  smileLeftSpeaking: number[];
  squintLeftSpeaking: number[];
  /** `Hyper3dWarmthYieldFollower.current` after each orchestrator tick. */
  followedYield: number[];
  /**
   * Calibrated `mouthClose` over `ARTICULATION_REFERENCE.seal` — the seal exactly
   * as `affectArticulationYield` reads it on the production path.
   */
  sealNorm: number[];
};

function runSolaceRuntime(): Capture {
  const payload = loadGoldenPayload();
  const acousticFrames = loadGoldenAcoustics();
  const controller = new AvatarController(payload);
  const bones = new BoneController();
  const performance = createHyper3dPerformance();
  const activePresence = new ActivePresenceDirector(payload.performance_seed ?? "golden-fixture");
  const warmthYield = new Hyper3dWarmthYieldFollower();

  const plan = buildThreejsTalkingAvatarHeadPlan({
    text: payload.text,
    phonemes: payload.phonemes,
    words: payload.words,
    acousticFrames,
    durationSeconds: payload.audio_duration,
    /**
     * THE CALIBRATION PAYLOAD CARRIES NO CONVERSATIONAL MEANING, so the accepted
     * run supplies the affect request the review panel supplies — a real upstream
     * input, and the reason BASELINE_GOLDEN.warmth is non-zero across all 37 s.
     *
     * A LIVE Solace response is the opposite case and deliberately passes none:
     * upstream ranks a request above the text's own affect, so leaving it on
     * would collapse every sentence to "warm" and make per-sentence intent
     * unreachable. See `AvatarModel.tsx:352` and `carriesOwnSemantics`.
     */
    userText: HYPER3D_PRODUCTION_AFFECT_REQUEST,
    segmentIntent: true,
  });
  expect(plan).not.toBeNull();
  // `expect` does not narrow, and the loop below reads `plan.affectPhraseSpans`
  // to build the baseline's speaking-frame sample.
  if (!plan) throw new Error("the golden fixture must produce a head plan");

  const capture: Capture = {
    headYawDeg: [], headPitchDeg: [], blinkPeaks: [], blinkTimes: [],
    lidValues: [], browMax: 0, speakingFrames: 0, warmthSmile: [],
    eyeSquint: [], framesWithGaze: 0, headOnlyYawDeg: [],
    smileLeftSpeaking: [], squintLeftSpeaking: [], followedYield: [], sealNorm: [],
  };

  const DEG = 180 / Math.PI;
  let previousBlink = 0;
  const frames = Math.floor(payload.audio_duration / STEP);

  for (let i = 0; i <= frames; i += 1) {
    const t = i * STEP;
    // THE SAME orchestrator the production factory ticks. A harness with its
    // own transcription would only prove my notes agree with my notes — the
    // first version of this file did exactly that and silently reported zero
    // warmth because it had omitted the facial-liveliness step.
    const resolved = resolveHyper3dFrame(
      { config: CONFIG, controller, performance, activePresence, warmthYield, headSupported: true },
      { timeSeconds: t, deltaSeconds: STEP, isSpeaking: true, plan, acousticFrames },
    );
    const pose = resolved.pose;
    if (resolved.facePoseOwned) capture.framesWithGaze += 1;
    // BASELINE_GOLDEN.head records the TOTAL rig pose, not the head bone's
    // share of it: upstream measures ~0.55 deg of pose against ~0.35 deg on
    // Head_M, i.e. the 70/30 head/neck distribution the motion scale
    // explicitly does not touch. Measuring only  therefore
    // reads ~0.70x of the accepted figure by construction, which is exactly the
    // uniform factor the first run of this harness reported.
    const head = resolved.headMotion.head;
    const neck = resolved.headMotion.neck;
    capture.headYawDeg.push(Math.abs((head.yaw + neck.yaw) * DEG));
    capture.headPitchDeg.push(Math.abs((head.pitch + neck.pitch) * DEG));
    capture.headOnlyYawDeg.push(Math.abs(head.yaw * DEG));

    const blink = Math.max(pose.eyeBlinkLeft ?? 0, pose.eyeBlinkRight ?? 0);
    capture.lidValues.push(blink);
    // A blink is a rising crossing of a high threshold — counted once per event.
    if (blink > 0.9 && previousBlink <= 0.9) {
      capture.blinkPeaks.push(blink);
      capture.blinkTimes.push(Number(t.toFixed(2)));
    }
    previousBlink = blink;

    capture.browMax = Math.max(
      capture.browMax,
      pose.browInnerUp ?? 0, pose.browOuterUpLeft ?? 0, pose.browOuterUpRight ?? 0,
    );
    capture.warmthSmile.push(Math.max(pose.mouthSmileLeft ?? 0, pose.mouthSmileRight ?? 0));
    capture.eyeSquint.push(Math.max(pose.eyeSquintLeft ?? 0, pose.eyeSquintRight ?? 0));
    capture.speakingFrames += 1;

    // The baseline's SPEAKING frames: inside an affect phrase span, nothing else.
    if (plan.affectPhraseSpans.some((span) => t >= span.start && t <= span.end)) {
      capture.smileLeftSpeaking.push(pose.mouthSmileLeft ?? 0);
      capture.squintLeftSpeaking.push(pose.eyeSquintLeft ?? 0);
      capture.followedYield.push(warmthYield.current);
      // The seal as `affectArticulationYield` reads it: the calibrated
      // `mouthClose` over the measured full closure.
      capture.sealNorm.push(
        Math.min(1, (pose.mouthClose ?? 0) / ARTICULATION_REFERENCE.seal),
      );
    }
  }

  void bones;
  void THREE;
  return capture;
}

describe("static command equivalence — golden fixture", () => {
  const capture = runSolaceRuntime();

  it("uses the same fixture the accepted baseline was measured on", () => {
    const payload = loadGoldenPayload();
    expect(payload.id).toBe(BASELINE_GOLDEN.payloadId);
    expect(payload.audio_duration).toBeCloseTo(BASELINE_GOLDEN.durationSeconds, 3);
    expect(payload.phonemes.length).toBe(BASELINE_GOLDEN.phonemeCount);
  });

  it("decodes real acoustics from the same audio the accepted run analysed", () => {
    const pcm = readWavAsPcm(GOLDEN_AUDIO_PATH);
    expect(pcm.length).toBeGreaterThan(0);
    expect(pcm.sampleRate).toBeGreaterThan(8000);
    // Long enough to cover the payload — the planner needs the whole clip.
    expect(pcm.length / pcm.sampleRate).toBeGreaterThan(BASELINE_GOLDEN.durationSeconds - 1);
    expect(loadGoldenAcoustics().length).toBeGreaterThan(100);
  });

  it("produces head motion within the accepted baseline envelope", () => {
    const yawP50 = percentile(capture.headYawDeg, 0.5);
    const yawP90 = percentile(capture.headYawDeg, 0.9);
    const yawMax = Math.max(...capture.headYawDeg);
    const pitchP50 = percentile(capture.headPitchDeg, 0.5);
    const pitchMax = Math.max(...capture.headPitchDeg);

    // eslint-disable-next-line no-console
    console.log(
      "\nHEAD (degrees)  solace vs BASELINE_GOLDEN\n" +
        `  yawP50   ${yawP50.toFixed(3)}  vs ${BASELINE_GOLDEN.head.yawP50}\n` +
        `  yawP90   ${yawP90.toFixed(3)}  vs ${BASELINE_GOLDEN.head.yawP90}\n` +
        `  yawMax   ${yawMax.toFixed(3)}  vs ${BASELINE_GOLDEN.head.yawMax}\n` +
        `  pitchP50 ${pitchP50.toFixed(3)}  vs ${BASELINE_GOLDEN.head.pitchP50}\n` +
        `  pitchMax ${pitchMax.toFixed(3)}  vs ${BASELINE_GOLDEN.head.pitchMax}\n` +
        `  browMax  ${capture.browMax.toFixed(4)}  vs ${BASELINE_GOLDEN.brows.max}\n` +
        `  framesWithFacePose ${capture.framesWithGaze}/${capture.speakingFrames}\n` +
        "\nCOMPOSED-POSE READOUTS — NOT comparable to BASELINE_GOLDEN, and\n" +
        "deliberately not asserted against it. The baseline measures upstream's\n" +
        "RAW frame (`frame.blinkLeft`) and the PLANNED blink list; these read the\n" +
        "calibrated composed pose after the ownership seam and Active Presence, so\n" +
        "a rising-edge count here includes re-crossings the plan does not have.\n" +
        `  lid p50 (calibrated eyeBlinkLeft)  ${percentile(capture.lidValues, 0.5).toFixed(4)}   [baseline measures raw: ${BASELINE_GOLDEN.lid.p50}]\n` +
        `  rising edges > 0.9                 ${capture.blinkTimes.length}      [baseline counts planned blinks: ${BASELINE_GOLDEN.blink.count}]\n`,
    );

    // The head must actually move, and must not exceed the reviewed envelope.
    expect(yawMax).toBeGreaterThan(0);
    expect(yawMax).toBeLessThanOrEqual(BASELINE_GOLDEN.head.yawMax * 1.5);
    expect(pitchMax).toBeLessThanOrEqual(BASELINE_GOLDEN.head.pitchMax * 1.5);
  });

  it("matches the accepted head-motion baseline exactly", () => {
    // BASELINE_GOLDEN.head is the TOTAL rig pose (head + neck), which is why it
    // is compared against the sum rather than the head bone's 70% share.
    const tol = BASELINE_GOLDEN.head.tolerance;
    expect(percentile(capture.headYawDeg, 0.5)).toBeCloseTo(BASELINE_GOLDEN.head.yawP50, 2);
    expect(percentile(capture.headYawDeg, 0.9)).toBeCloseTo(BASELINE_GOLDEN.head.yawP90, 2);
    expect(Math.max(...capture.headYawDeg)).toBeCloseTo(BASELINE_GOLDEN.head.yawMax, 2);
    expect(percentile(capture.headPitchDeg, 0.5)).toBeCloseTo(BASELINE_GOLDEN.head.pitchP50, 2);
    expect(Math.max(...capture.headPitchDeg)).toBeCloseTo(BASELINE_GOLDEN.head.pitchMax, 2);
    expect(tol).toBeGreaterThan(0);
  });

  it("matches the accepted semantic-brow baseline exactly", () => {
    expect(capture.browMax).toBeCloseTo(BASELINE_GOLDEN.brows.max, 3);
  });

  /**
   * WARMTH, COMPARED LIKE WITH LIKE.
   *
   * `BASELINE_GOLDEN.warmth` is produced by one concrete harness — the source
   * repository's `hyper3dPerformanceBaselineContract.test.ts` — whose five
   * measurement choices are listed on `runAcceptedBaselinePath`. Reproducing that
   * harness over the PORTED engine is what tests the port; comparing it against a
   * differently-measured statistic tests nothing, and previously reported a head
   * divergence (0.700x) that did not exist.
   */
  it("reproduces the accepted warmth baseline through the baseline's own path", () => {
    const run = runAcceptedBaselinePath();
    const g = BASELINE_GOLDEN.warmth;
    const rendering =
      run.smileLeft.filter((v) => v > hyper3dMorphCalibration.mouthSmileLeft.usefulMin).length /
      run.smileLeft.length;

    // eslint-disable-next-line no-console
    console.log(
      "\nWARMTH  solace(ported engine, baseline path) vs BASELINE_GOLDEN\n" +
        `  speakingFrames  ${run.speakingFrames}/${run.totalFrames}\n` +
        `  smileP50        ${baselineQuantile(run.smileLeft, 0.5).toFixed(4)} vs ${g.speakingSmileP50}\n` +
        `  smileMax        ${Math.max(...run.smileLeft).toFixed(4)} vs ${g.speakingSmileMax}\n` +
        `  renderingShare  ${rendering.toFixed(4)} vs ${g.renderingShareOfSpeakingFrames}\n`,
    );

    // The baseline's own tolerance, unchanged. Absolute difference rather than
    // `toBeCloseTo` with a computed digit count — a fractional `numDigits`
    // silently widens to about +/-0.1, which once passed this by accident.
    expect(Math.abs(baselineQuantile(run.smileLeft, 0.5) - g.speakingSmileP50))
      .toBeLessThanOrEqual(g.tolerance);
    expect(Math.abs(Math.max(...run.smileLeft) - g.speakingSmileMax))
      .toBeLessThanOrEqual(g.tolerance);
    expect(Math.abs(rendering - g.renderingShareOfSpeakingFrames))
      .toBeLessThanOrEqual(g.tolerance);
  });

  /**
   * EYE SOFTENING pins the AFFECT ENVELOPE ITSELF, because the lids are the one
   * warmth region that does NOT yield to lip articulation
   * (`hyper3dFacialLiveliness.ts:411`, "Lids do NOT yield"). If the envelope, the
   * plan or the performer had drifted, this would move; it is therefore the check
   * that separates "the affect frame is wrong" from "the yield is different".
   */
  it("reproduces the accepted eye-softening baseline on both paths", () => {
    const run = runAcceptedBaselinePath();
    const g = BASELINE_GOLDEN.eyeSoftening;
    const share =
      run.eyeSquintLeft.filter((v) => v > hyper3dMorphCalibration.eyeSquintLeft.usefulMin).length /
      run.eyeSquintLeft.length;
    expect(Math.abs(Math.max(...run.eyeSquintLeft) - g.max)).toBeLessThanOrEqual(g.tolerance);
    expect(Math.abs(share - g.renderingShareOfSpeakingFrames)).toBeLessThanOrEqual(g.tolerance);

    // The production mount composes the same envelope: the lids take no yield, so
    // the peak has to land on the same value there too.
    expect(Math.abs(Math.max(...capture.squintLeftSpeaking) - g.max)).toBeLessThanOrEqual(g.tolerance);
  });

  /**
   * THE PRODUCTION MOUNT, and the one measured difference from the baseline path.
   *
   * The orchestrator transcribes `AvatarModel.tsx`, which hands the CALIBRATED
   * `livelyPose` to `affectArticulationYield`; the baseline harness hands the
   * PRE-calibration `lip.targetPose`. `mouthClose` carries the smallest gain in
   * the calibration table (0.11), so the two poses saturate
   * `seal = mouthClose / ARTICULATION_REFERENCE.seal` at very different rates and
   * the yield-dependent warmth figures separate. Every other factor was swept and
   * is inert: swapping the plan builder (`planHeadPerformance` vs
   * `buildThreejsTalkingAvatarHeadPlan` with words + `segmentIntent`) and the full
   * production `evaluate` option set both leave the figures at 0.1594/0.4078.
   *
   * See `ACCEPTED_YIELD_POSE_DIVERGENCE`. NOTHING WAS TUNED to reach this: the
   * port reproduces both paths exactly, so the gap belongs to the accepted system.
   * This test therefore asserts the mechanism — that the corrected seal
   * normalisation is live and biting on the production path — rather than
   * restating a second golden number for it.
   */
  it("drives production warmth through the seal-corrected yield", () => {
    const smileP50 = baselineQuantile(capture.smileLeftSpeaking, 0.5);
    const rendering =
      capture.smileLeftSpeaking.filter((v) => v > hyper3dMorphCalibration.mouthSmileLeft.usefulMin)
        .length / capture.smileLeftSpeaking.length;

    // eslint-disable-next-line no-console
    console.log(
      "\nWARMTH  solace production mount (calibrated yield pose)\n" +
        `  speakingFrames  ${capture.smileLeftSpeaking.length}\n` +
        `  smileP50        ${smileP50.toFixed(4)} (baseline path ${ACCEPTED_YIELD_POSE_DIVERGENCE.baselineSmileP50})\n` +
        `  smileMax        ${Math.max(...capture.smileLeftSpeaking).toFixed(4)}\n` +
        `  renderingShare  ${rendering.toFixed(4)} vs ${BASELINE_GOLDEN.warmth.renderingShareOfSpeakingFrames}\n`,
    );

    // The share is yield-independent — the floor keeps warmth rendering through a
    // full seal — so it must match the baseline exactly.
    expect(Math.abs(rendering - BASELINE_GOLDEN.warmth.renderingShareOfSpeakingFrames))
      .toBeLessThanOrEqual(BASELINE_GOLDEN.warmth.tolerance);

    // THE YIELD MUST BITE, read off the follower the orchestrator actually
    // stepped. A run where the seal signal never reached the pose would sit
    // pinned at 1.0 — which is precisely the failure the seal trace was looking
    // for, so it is asserted rather than inferred from the smile.
    const minYield = Math.min(...capture.followedYield);
    const p50Yield = baselineQuantile(capture.followedYield, 0.5);
    expect(minYield).toBeLessThan(0.5);
    expect(p50Yield).toBeLessThan(1);
    // Floored, never removed: warmth must not switch off mid-phrase.
    expect(
      HYPER3D_WARMTH.mouthYieldFloor + (1 - HYPER3D_WARMTH.mouthYieldFloor) * minYield,
    ).toBeGreaterThanOrEqual(HYPER3D_WARMTH.mouthYieldFloor);

    // Warmth on the production path cannot fall BELOW the baseline path. Every
    // channel the yield reads is calibrated by a gain of at most 1 — mouthClose
    // 0.11, mouthFunnel 0.5, mouthPucker 1 under a 0.75 cap — so the calibrated
    // pose asks for the same yield or less, never more.
    expect(smileP50).toBeGreaterThanOrEqual(BASELINE_GOLDEN.warmth.speakingSmileP50);

    /**
     * THE SEAL REACHES THE RUNTIME, asserted directly rather than inferred.
     *
     * Partitioning the same speaking frames by the seal the yield actually reads,
     * warmth must be lower where the lips are closing. If `mouthClose` were
     * missing from the pose handed to `affectArticulationYield` — the failure this
     * trace was opened to find — the two medians would be indistinguishable.
     */
    const sealed: number[] = [];
    const open: number[] = [];
    capture.sealNorm.forEach((seal, index) => {
      if (seal >= 0.5) sealed.push(capture.smileLeftSpeaking[index]);
      else if (seal === 0) open.push(capture.smileLeftSpeaking[index]);
    });
    expect(sealed.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(baselineQuantile(sealed, 0.5)).toBeLessThan(baselineQuantile(open, 0.5));
  });

  it("renders semantic affect on the great majority of speaking frames", () => {
    // BASELINE_GOLDEN.warmth.renderingShareOfSpeakingFrames = 0.997 — the point
    // of the whole acoustic connection is that this is non-zero at all.
    const rendering = capture.warmthSmile.filter((v) => v > 0).length / capture.warmthSmile.length;
    expect(rendering).toBeGreaterThan(0.5);
  });

  it("owns gaze/blink/brows through the accepted layer on every frame it plans", () => {
    expect(capture.framesWithGaze).toBeGreaterThan(0);
  });

  it("reproduces the accepted blink schedule and resting lid", () => {
    const run = runAcceptedBaselinePath();
    // The PLANNED blinks — the quantity BASELINE_GOLDEN.blink records. Times to
    // the baseline's own two decimals.
    expect(run.blinkTimes).toHaveLength(BASELINE_GOLDEN.blink.count);
    run.blinkTimes.forEach((time, index) =>
      expect(time).toBeCloseTo(BASELINE_GOLDEN.blink.times[index], 2),
    );
    expect(Math.max(...run.lid)).toBe(BASELINE_GOLDEN.blink.peakClosure);
    // Resting lid, raw (pre-calibration) on the blink channel, per BASELINE_LID.
    expect(baselineQuantile(run.lid, 0.5)).toBeCloseTo(BASELINE_GOLDEN.lid.p50, 2);
    expect(run.lid.filter((v) => v === 0)).toHaveLength(BASELINE_GOLDEN.lid.framesAtZero);
  });

  it("reproduces the accepted brow behaviour through the baseline's own path", () => {
    const run = runAcceptedBaselinePath();
    const g = BASELINE_GOLDEN.brows;
    expect(Math.max(...run.brow)).toBeCloseTo(g.max, 3);
    const neutral = run.browSpeaking.filter((v) => v === 0).length / run.browSpeaking.length;
    expect(Math.abs(neutral - g.neutralShareOfSpeakingFrames)).toBeLessThanOrEqual(g.tolerance);
  });

  it("blinks on a seeded, non-periodic schedule", () => {
    expect(capture.blinkTimes.length).toBeGreaterThan(0);
    const gaps = capture.blinkTimes.slice(1).map((t, i) => t - capture.blinkTimes[i]);
    if (gaps.length > 2) {
      const unique = new Set(gaps.map((g) => g.toFixed(1)));
      expect(unique.size).toBeGreaterThan(1);
    }
  });

  it("is deterministic — the same inputs replay the same commands", () => {
    const again = runSolaceRuntime();
    expect(again.blinkTimes).toEqual(capture.blinkTimes);
    expect(percentile(again.headYawDeg, 0.5)).toBe(percentile(capture.headYawDeg, 0.5));
    expect(again.browMax).toBe(capture.browMax);
  });
});
