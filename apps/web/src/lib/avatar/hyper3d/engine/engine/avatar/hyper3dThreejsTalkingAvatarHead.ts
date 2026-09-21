import type { HeadMotionPose, HeadRotationTarget } from "../../types/facialAnimation";
import type { TimedPhoneme, TimedWord } from "../../types/avatarPayload";
import { hyper3dHeadNeckCalibration, hyper3dMorphCalibration } from "../../mappings/avatars/hyper3dCalibration";
import { distributeToRig } from "./hyper3dHeadPerformer";
import {
  calibrateHyper3dPose,
  hyper3dGazeCalibration,
  hyper3dGazePose
} from "../../mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "../../types/facialAnimation";
import { traceHyper3dGaze, type Hyper3dGazeTrace } from "./hyper3dFacialLiveliness";
import type { HeadPose } from "./hyper3dTrajectory";
import type { SpeechAcousticFrame } from "./upstream/threejs-talking-avatar/audioAnalysis";
import {
  NEUTRAL_BROW_CONCERN,
  ThreejsTalkingAvatarPerformance,
  type ConversationalPerformanceState,
  planHeadPerformance,
  type HeadPerformanceFrame,
  type HeadPerformancePlan,
  type UpstreamPhonemeInterval
} from "./upstream/threejs-talking-avatar/performance";

/**
 * ISOLATED EXPERIMENT — the `threejs-talking-avatar` head performance layer on
 * the Hyper3D rig.
 *
 *   upstream repo   https://github.com/majidmanzarpour/threejs-talking-avatar
 *   upstream commit 61ab8e3b1a14946b245926ac1b12e4f387b656ab
 *   licence         Apache License 2.0
 *
 * See `upstream/threejs-talking-avatar/PROVENANCE.md` for the file-by-file and
 * function-by-function accounting. THIS file contains no upstream behaviour: it
 * is only the seam between their pose and our rig.
 *
 *   upstream head performance (radians, rig-free)
 *          |
 *   THIS ADAPTER  — degrees, Hyper3D head/neck distribution, calibration
 *          |
 *   existing BoneController  — the one and only bone writer
 *          |
 *   Head_M / Neck_M
 *
 * OWNERSHIP. This replaces `resolveHyper3dSpeakingHead` for the frame; it never
 * blends with it. Whatever the shared pipeline, the TalkingHead carrier, the
 * idle/presence layer or the standalone nod generator produced is discarded, in
 * the same way and at the same seam as the accepted Hyper3D owner does. No
 * upstream code reaches a Three.js object: it never sees one.
 *
 * WHAT THIS LAYER OWNS in production: head/neck rotation, gaze, blink and brows.
 * WHAT IT CANNOT TOUCH: every mouth, jaw, lip, tongue and cheek channel. It
 * never names them, so our MFA lip sync and the accepted expression vocabulary
 * are untouched by construction. The warmth layer that DOES write mouth corners
 * and cheeks is `hyper3dFacialLiveliness.ts`, and it composites with `max` so it
 * can never reduce an articulation demand.
 */

/**
 * Which layer owns the Hyper3D head/neck. `"accepted"` is the production owner
 * (`hyper3dSpeakingHead`); `"threejs-talking-avatar"` is this isolated
 * experiment. The literal is the one the brief specifies.
 */
export type Hyper3dHeadPerformanceSourceId = "accepted" | "threejs-talking-avatar";


/**
 * The morph channels this experiment OWNS while it is on.
 *
 * Ownership is enforced by REPLACEMENT at the write seam: `AvatarModel` deletes
 * exactly these keys from the composed pose and then writes the experiment's
 * values, so no competing gaze, blink, brow or idle controller can contribute to
 * these regions, and nothing outside this list is touched.
 *
 * Note what is NOT here: every mouth, jaw, lip, tongue, cheek and smile channel.
 * Our MFA lip sync and the accepted expression vocabulary keep them, and this
 * layer cannot reach them because it never names them.
 */
export const THREEJS_TALKING_AVATAR_GAZE_CHANNELS = [
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookInRight",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeLookDownLeft",
  "eyeLookDownRight"
] as const;

export const THREEJS_TALKING_AVATAR_BLINK_CHANNELS = ["eyeBlinkLeft", "eyeBlinkRight"] as const;

/**
 * Only channels the Hyper3D calibration marks PASS with real measured travel:
 * `browInnerUp` 6.75 mm, `browOuterUpLeft` 7.02 mm, `browOuterUpRight` 6.76 mm,
 * `browDownLeft` / `browDownRight` ~6.6 mm.
 */
export const THREEJS_TALKING_AVATAR_BROW_CHANNELS = [
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "browDownLeft",
  "browDownRight"
] as const;

export const HYPER3D_THREEJS_TALKING_AVATAR_OWNER = "threejsTalkingAvatarHead";

export const THREEJS_TALKING_AVATAR_UPSTREAM = {
  repository: "https://github.com/majidmanzarpour/threejs-talking-avatar",
  commit: "61ab8e3b1a14946b245926ac1b12e4f387b656ab",
  licence: "Apache-2.0",
  files: [
    "demo/src/speech/ExpressivePerformanceController.ts",
    "demo/src/speech/AudioAnalysis.ts"
  ]
} as const;

/**
 * ACCEPTED BASELINE for this experiment.
 *
 * Upstream's own amplitude is 1.0x, and it measures at roughly 0.55 deg of pose
 * — about 0.35 deg on `Head_M` — on `david-natural-speech-paragraph`. Hardware
 * review accepted 3.0x as the Hyper3D baseline instead.
 *
 * This is PURELY a multiplier on the finished upstream pose, applied after the
 * performance layer and before the rig distribution. It changes no upstream
 * timing, no beat placement, no PCM prosody scoring, no smoothing constant, no
 * upstream clamp, and not the 70/30 head/neck split. Lip sync, expressions and
 * the audio clock are on other paths entirely and are not touched by it.
 *
 * The single source of truth: the store default and the adapter's own fallback
 * both read it, so the accepted baseline cannot drift between the two.
 */
export const THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE = 3;

const DEG = Math.PI / 180;

const zeroRotation = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });

/**
 * Degrees to bone radians, through the SAME per-asset calibration the accepted
 * Hyper3D owner uses, so an A/B compares motion GENERATION rather than two
 * different output conversions.
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
 * Trailing ARPAbet stress digit, when the aligner left one on the label.
 *
 * OUR PAYLOADS DO NOT CARRY ONE. MFA output in this project is stress-stripped
 * (`AA`, `AH`, not `AA1`, `AH0`), so this returns `undefined` for every phoneme
 * in the current payloads and upstream's stress term contributes 0. That is
 * reported honestly in the telemetry as `stressAvailable: false` rather than
 * being substituted with a guess. `intensity` is NOT mapped onto upstream's
 * `emphasis`: the two are different scales and inventing the conversion would be
 * fabricating an input.
 */
const arpabetStress = (phoneme: string): number | undefined => {
  const match = /(\d)$/.exec(phoneme);
  return match ? Number(match[1]) : undefined;
};

/**
 * Upstream's normalised gaze channel -> the EXISTING calibrated Hyper3D gaze
 * adapter, in degrees.
 *
 * This is a UNIT TRANSLATION, not a re-timing. Upstream produces `gazeX` /
 * `gazeY` on a normalised axis and converts them straight into unit morph
 * weights (`gazeRight = clamp01(gazeX)`). Hyper3D's gaze is expressed in degrees
 * of real eyeball rotation and goes through `hyper3dGazePose`, which owns the
 * safety rails (yaw +/-14 deg, up +7 deg, down -4.5 deg) and the per-influence
 * cap of 0.7. So full upstream deflection is mapped onto exactly the existing
 * rail and handed to the existing adapter, which still does the eye-morph
 * conversion and the capping.
 *
 * `hyper3dGazePose` amplifies its input by `gazeScale` before railing — that is
 * how the rest of the pipeline feeds it — so the scale is divided out here to
 * land on the rail rather than past it. Nothing about upstream's gaze timing,
 * its 0.075 s / 0.16 s response or its ambient scheduler is altered.
 *
 * SIGN. Upstream drives `morphs.gazeRight` from positive `gazeX`, naming sides
 * from the character's own frame, exactly as it does for `blinkLeft` and
 * `browLiftLeft`. `hyper3dGazePose` takes positive yaw as the character's LEFT.
 * Hence the negation. If hardware reports the gaze mirrored, this single sign is
 * the only thing to change.
 *
 * The DOWNWARD rail is deliberately tighter than the upward one in the existing
 * calibration, because `eyeLookDown` moves the lid and lash cards far more than
 * the eyeball. That asymmetry is preserved here rather than flattened.
 */
export const threejsTalkingAvatarGazeDegrees = (
  gazeX: number,
  gazeY: number,
  /**
   * DIAGNOSTIC MULTIPLIER, 1.0 in production.
   *
   * The gaze amplitude that ships is `SPEAKING_GAZE_POLICY.yawAmplitude` /
   * `.pitchAmplitude`, chosen once against the target. This parameter is left
   * so tests can sweep the rail; nothing in the render path passes it.
   */
  amplitude = 1
): { yawDegrees: number; pitchDegrees: number } => {
  const c = hyper3dGazeCalibration;
  const x = gazeX * amplitude;
  const y = gazeY * amplitude;
  const yawDegrees = (-x * c.maxYawDegrees) / c.gazeScale;
  const pitchRail = y >= 0 ? c.maxPitchUpDegrees : c.maxPitchDownDegrees;
  return { yawDegrees, pitchDegrees: (y * pitchRail) / c.gazeScale };
};

/**
 * Upstream's brow channels -> the Hyper3D ARKit-style brow morphs the
 * calibration proved live.
 *
 *   upstream `browLift`      -> `browOuterUpLeft` + `browOuterUpRight`
 *   upstream `browLiftLeft`  -> extra on `browOuterUpLeft`   (seeded asymmetry)
 *   upstream `browLiftRight` -> extra on `browOuterUpRight`  (seeded asymmetry)
 *   upstream `browConcern`   -> `browInnerUp`  (the asset's combined inner channel)
 *   upstream `browFurrow`    -> `browDownLeft` + `browDownRight`
 *
 * OMITTED, and documented rather than substituted: upstream's `eyeWiden`
 * (`browPulse * 0.025`) and `eyeSquint`. Those are LID channels belonging to the
 * affect/expression system this experiment is not integrating yet, and Hyper3D's
 * own calibration marks `eyeWideLeft` and `eyeSquintLeft` WEAK (4.28 mm and
 * 3.46 mm of travel). Driving them from a brow signal would be inventing a
 * channel, so they are left alone.
 *
 * Under the neutral affect this port fixes, `browConcern` sits at upstream's
 * 0.035 rest — below the asset's 0.05 `usefulMin`, so it renders as nothing —
 * and `browFurrow` is 0. `browLift` is the live channel. That is upstream's own
 * behaviour with no affect directive, not a reduction made here.
 *
 * The result goes through `calibrateHyper3dPose`, so the existing per-channel
 * gains and caps (0.6 on the lifts, 0.45 on the downs) still govern.
 */
/**
 * SEMANTIC BROWS ARE HELD OFF FOR THIS PASS.
 *
 * The prosodic brow pulse is already deleted at the source in `performance.ts`.
 * What remained was the SEMANTIC term — `AFFECT_TARGETS.warm.browLift` of 0.18 —
 * which reached a measured `browOuterUp` of 0.166, above the channel's 0.05
 * useful minimum, so the brows were quietly rendering a mild sustained lift.
 * The per-phrase affect gain added in this pass pushed that to 0.209.
 *
 * The brief for this pass is explicit: eye posture, warmth variation and vowel
 * differentiation first; brows are the NEXT isolated improvement. So the brow
 * pose is held at rest and the region stays OWNED by this layer — ownership is
 * what stops the idle-expression or speech-gesture controllers writing the brows
 * instead, and "off" has to mean nothing writes them, not that someone else does.
 *
 * Flipping this to `true` restores the semantic term with no other change.
 */
export const HYPER3D_SEMANTIC_BROWS_ENABLED = true;

/**
 * PER-ASSET BROW AMPLITUDES — measured, not assumed.
 *
 * Upstream's brow channels are GNM weights where 1.0 is that rig's full
 * deflection. Writing them raw put `question`'s `browLift` of 0.62 straight onto
 * `browOuterUp`, past this asset's measured `naturalMax` of 0.45. The useful
 * range had to be measured on THIS asset instead.
 *
 * MEASURED, off the shipped HC1 morph ladders in
 * `docs/evidence/hc-hyper3d-calibration/` — the rendered brow band's vertical
 * centroid at each influence step:
 *
 *   browInnerUp    0.25 -> -0.71 px   0.50 -> -1.75 px   0.75 -> -2.89 px   1.00 -> -3.98 px
 *   browDownLeft   0.25 -> +0.47 px   0.50 -> +0.67 px   0.75 -> +1.03 px   1.00 -> +1.25 px
 *
 * Both are linear in influence. The important finding is the RATIO: `browDown`
 * carries a comparable `travelMM` (7.31 mm against browInnerUp's 6.75 mm) but
 * moves the visible brow **3.2x less**, because most of its vertex travel is not
 * vertical brow motion. `travelMM` overstates it, and the furrow is therefore
 * ASSET-LIMITED however it is driven — see the concerned mapping below.
 *
* The reference lifts are subtle, so each affect's FULL target is mapped onto
 * the ACCEPTED HYPER3D EXPRESSION VOCABULARY'S own scale — the poses hardware has
 * already reviewed — rather than onto a number chosen here:
 *
 *   accepted `gentle-smile`  browOuterUp 0.12   <- the warm/friendly reference
 *   accepted `concerned`     browInnerUp 0.22, browDown 0.10
 *
 * Solving each reference against the affect that anchors it:
 *
 *   outerUp  warm      browLift 0.18            x 0.62 -> 0.112  (accepted 0.12)
 *   innerUp  concerned browConcern 0.68 - 0.035 x 0.34 -> 0.219  (accepted 0.22)
 *   down     concerned browFurrow 0.55          x 0.18 -> 0.099  (accepted 0.10)
 *
 * and every channel is additionally clamped to its measured `naturalMax`, so the
 * one genuinely strong state — `surprise`, browLift 0.88 — lands exactly at the
 * top of the natural range instead of running to the raw cap.
 */
export const HYPER3D_BROW_REFERENCE = {
  /** `browLift` -> `browOuterUpLeft/Right`. Anchored to accepted `gentle-smile`. */
  outerUp: 0.62,
  /** `browConcern` -> `browInnerUp`. Anchored to accepted `concerned`. */
  innerUp: 0.34,
  /** `browFurrow` -> `browDownLeft/Right`. Anchored to accepted `concerned`. */
  down: 0.18
} as const;

export interface UpstreamBrowFrame {
  browConcern: number;
  browLift: number;
  browLiftLeft: number;
  browLiftRight: number;
  browFurrow: number;
}

/**
 * The MAPPING, independent of whether it is currently delivered.
 *
 * Kept exported and tested so the channel translation stays correct while
 * `HYPER3D_SEMANTIC_BROWS_ENABLED` is false — re-enabling brows should be a flag
 * flip, not a rediscovery of how these channels map.
 */
export const mapBrowChannelsToHyper3d = (frame: UpstreamBrowFrame): BlendshapePose => {
  const pose: BlendshapePose = {};
  const reference = HYPER3D_BROW_REFERENCE;
  const put = (name: string, value: number) => {
    const entry = hyper3dMorphCalibration[name];
    // Below the channel's MEASURED useful minimum nothing renders, so writing it
    // would leave an invisible residue that never resolves to a neutral brow.
    if (value <= (entry?.usefulMin ?? 1e-4)) return;
    // Clamped to the measured NATURAL maximum, not the raw cap: a brow this
    // asset can physically reach is not the same as one a face would hold.
    pose[name] = Math.min(value, entry?.naturalMax ?? 1);
  };
  /**
   * `browConcern` carries a permanent neutral REST of 0.035 that upstream never
   * intends as a lift. Subtracting it is what makes NEUTRAL produce exactly zero
   * brow deformation rather than a constant sub-threshold residue.
   */
  const innerUp = Math.max(0, frame.browConcern - NEUTRAL_BROW_CONCERN);
  put("browOuterUpLeft", (frame.browLift + frame.browLiftLeft) * reference.outerUp);
  put("browOuterUpRight", (frame.browLift + frame.browLiftRight) * reference.outerUp);
  put("browInnerUp", innerUp * reference.innerUp);
  put("browDownLeft", frame.browFurrow * reference.down);
  put("browDownRight", frame.browFurrow * reference.down);
  return calibrateHyper3dPose(pose);
};

/** The production entry point: the mapping, gated off for this pass. */
export const threejsTalkingAvatarBrowPose = (frame: UpstreamBrowFrame): BlendshapePose =>
  HYPER3D_SEMANTIC_BROWS_ENABLED ? mapBrowChannelsToHyper3d(frame) : {};

/**
 * Upstream's eyelid closure -> the Hyper3D blink morphs, which the calibration
 * proves reach full closure at 1.0 and carry the lash cards with them.
 *
 * A straight 1:1 mapping through the existing calibration. Upstream's blink
 * SHAPE (52 ms close, 18 ms hold, 105 ms open), its cadence, its boundary
 * preference, its per-eye delay and its double blinks are all preserved exactly.
 */
export const threejsTalkingAvatarBlinkPose = (
  blinkLeft: number,
  blinkRight: number
): BlendshapePose => {
  const pose: BlendshapePose = {};
  if (blinkLeft > 1e-4) pose.eyeBlinkLeft = Math.min(1, blinkLeft);
  if (blinkRight > 1e-4) pose.eyeBlinkRight = Math.min(1, blinkRight);
  return calibrateHyper3dPose(pose);
};

/** Our MFA payload phonemes in the shape upstream's cue planner reads. */
export const toUpstreamPhonemes = (phonemes: readonly TimedPhoneme[]): UpstreamPhonemeInterval[] =>
  phonemes.map((phoneme) => ({
    startTime: phoneme.start_time,
    endTime: phoneme.end_time,
    normalizedPhone: phoneme.phoneme.replace(/\d+$/, "").toLowerCase(),
    stress: arpabetStress(phoneme.phoneme)
  }));

export interface ThreejsTalkingAvatarHeadPlanInput {
  readonly text: string;
  /** Upstream's `requestedAffect` input. See `performanceIntent.ts`. */
  readonly userText?: string;
  readonly phonemes: readonly TimedPhoneme[];
  /**
   * The payload's MFA word tier, when present. Passed straight through so
   * sentence intent is aligned to measured word intervals instead of estimated
   * by character proportion. Absent is legal and reported, not papered over.
   */
  readonly words?: readonly TimedWord[];
  readonly acousticFrames: readonly SpeechAcousticFrame[];
  readonly durationSeconds: number;
  /** Derive sentence-level intent as well as the response-level one. */
  readonly segmentIntent?: boolean;
}

/**
 * Builds the upstream plan from OUR data. Pure and deterministic, so it can be
 * memoized per payload and the same audio always yields the same head timeline.
 *
 * Returns `null` when there is no decoded PCM to analyse. Upstream's beat
 * detector scores energy, pitch, voicing and transients — every one of which
 * comes from the waveform — so without it there is nothing to plan. We report
 * that state instead of synthesising acoustic frames.
 */
export const buildThreejsTalkingAvatarHeadPlan = (
  input: ThreejsTalkingAvatarHeadPlanInput
): HeadPerformancePlan | null => {
  if (!input.acousticFrames.length) return null;
  return planHeadPerformance({
    text: input.text,
    userText: input.userText,
    phonemes: toUpstreamPhonemes(input.phonemes),
    words: input.words,
    acousticFrames: input.acousticFrames,
    durationSeconds: input.durationSeconds,
    segmentIntent: input.segmentIntent
  });
};

export interface ThreejsTalkingAvatarHeadTelemetry {
  owner: string;
  upstream: typeof THREEJS_TALKING_AVATAR_UPSTREAM;
  /** Whether a plan built from decoded PCM is loaded. */
  sourceLoaded: boolean;
  reason: string;
  speechActive: boolean;
  /** Our audio playback clock, in seconds. */
  clock: number;
  cueCount: number;
  activeBeats: number;
  /** Upstream's own output, before any rig conversion. Degrees. */
  performancePose: HeadPose;
  /** Degrees requested of each bone after the Hyper3D rig distribution. */
  headDegrees: HeadPose;
  neckDegrees: HeadPose;
  /** Degrees measured ON `Head_M` / `Neck_M` after the write. Null until the first frame. */
  appliedHeadDegrees: HeadPose | null;
  appliedNeckDegrees: HeadPose | null;
  motionScale: number;
  /** False on our payloads: MFA labels here are stress-stripped. */
  stressAvailable: boolean;
  acousticFrameCount: number;
  /** Which regions this layer is driving. Hardware isolation toggles. */
  regions: { head: boolean; gaze: boolean; blink: boolean; brows: boolean };
  /** Gaze in the existing calibrated domain: degrees of real eyeball rotation. */
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  /** The full gaze chain, for the "why are the eyes not moving" readout. */
  gazeTrace: Hyper3dGazeTrace | null;
  /** Eyelid closure 0-1, and how many blinks the upstream planner scheduled. */
  blinkLeft: number;
  blinkRight: number;
  blinkCount: number;
  /** The prosodic brow pulse, and the calibrated lift actually requested. */
  browPulse: number;
  browOuterUpLeft: number;
  browOuterUpRight: number;
  /** The gaze/blink/brow influences this layer wrote, after calibration. */
  facePose: BlendshapePose;
  /** Upstream's inferred affect, and where it came from. */
  affect: string;
  affectSource: string;
  affectIntensity: number;
  affectScale: number;
}

/** Read-only conversational readout for the DEV review panel. */
export interface ConversationalTelemetry {
  readonly state: string;
  readonly stateSource: "auto" | "override";
  readonly affect: string;
  readonly discourseAct: string;
  readonly intentSource: string;
  readonly confidence: number;
  readonly intensity: number;
  readonly segmentIndex: number;
  readonly segmentCount: number;
  readonly segmentText: string;
  readonly segmentStart: number;
  readonly segmentEnd: number;
  readonly clock: number;
  /** Which conversational states this application can actually prove right now. */
  readonly verifiedStates: readonly string[];
  /** The playback status the state was resolved from. */
  readonly observedStatus: string;
  /** How the active sentence was placed in time. Never guessed by the reader. */
  readonly alignmentSource: string;
  readonly alignmentConfidence: number;
}

export interface ThreejsTalkingAvatarHeadInput {
  /**
   * Upstream's conversation state, derived from real playback events. Omitted
   * means `speaking`, which is the locked baseline behaviour exactly.
   */
  conversationState?: ConversationalPerformanceState;
  /** Whatever the shared pipeline produced this frame. Discarded unless it is a preserved path. */
  incoming: HeadMotionPose;
  plan: HeadPerformancePlan | null;
  /** ON/OFF for the experiment itself. */
  enabled: boolean;
  /** Our audio playback clock, in seconds. */
  clock: number;
  deltaSeconds: number;
  speechActive: boolean;
  /**
   * Rig scaling only. 1.0 ships upstream's own amplitude unchanged; the accepted
   * Hyper3D baseline is `THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE`, which is
   * also the fallback when this is omitted.
   */
  motionScale?: number;
  acousticFrameCount?: number;
  stressAvailable?: boolean;
  /**
   * Per-region enables, for hardware isolation. All default ON. A region that is
   * off is simply not produced — the experiment writes nothing for it and the
   * existing controllers keep it.
   */
  regions?: { head?: boolean; gaze?: boolean; blink?: boolean; brows?: boolean };
  /**
   * DIAGNOSTIC ONLY, and absent from the production call site. Gaze amplitude is
   * set once in `SPEAKING_GAZE_POLICY`; this remains so a test can sweep the
   * rail without the policy being a variable at runtime.
   */
  gazeAmplitude?: number;
}

export interface ThreejsTalkingAvatarHeadResult {
  headMotion: HeadMotionPose;
  telemetry: ThreejsTalkingAvatarHeadTelemetry | null;
  /** Upstream's raw frame, for the tests and the panel. Null when off or unplanned. */
  frame: HeadPerformanceFrame | null;
  /**
   * The gaze, blink and brow influences to write, already calibrated. Null when
   * the experiment is off or unplanned, in which case the existing controllers
   * keep those regions untouched.
   *
   * Contains ONLY channels from `THREEJS_TALKING_AVATAR_GAZE_CHANNELS`,
   * `..._BLINK_CHANNELS` and `..._BROW_CHANNELS`. No mouth, jaw, lip, tongue,
   * cheek or smile channel can appear here.
   */
  facePose: BlendshapePose | null;
}

/**
 * The stateful upstream performer. One instance per mounted avatar: upstream's
 * `response()` smoothing integrates across frames, so its attack/release
 * constants only mean what upstream intended if the channel state persists.
 */
export const createThreejsTalkingAvatarPerformance = (): ThreejsTalkingAvatarPerformance =>
  new ThreejsTalkingAvatarPerformance();

export const resolveThreejsTalkingAvatarHead = (
  performance: ThreejsTalkingAvatarPerformance,
  input: ThreejsTalkingAvatarHeadInput
): ThreejsTalkingAvatarHeadResult => {
  const { incoming, plan, enabled, clock } = input;
  const motionScale = Number.isFinite(input.motionScale)
    ? (input.motionScale as number)
    : THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE;
  const regions = {
    head: input.regions?.head ?? true,
    gaze: input.regions?.gaze ?? true,
    blink: input.regions?.blink ?? true,
    brows: input.regions?.brows ?? true
  };

  // Preserved paths, identical to the accepted owner: the head/neck transform
  // diagnostic and authored payload head cues are content, not a competing
  // procedural generator.
  if (incoming.diagnosticActive) {
    return {
      headMotion: { ...incoming, owner: "headNeckTransformDiagnostic" },
      telemetry: null,
      frame: null,
      facePose: null
    };
  }
  if (incoming.manualActive) {
    return {
      headMotion: { ...incoming, owner: "payloadHeadCue" },
      telemetry: null,
      frame: null,
      facePose: null
    };
  }

  const base = (reason: string, sourceLoaded: boolean): ThreejsTalkingAvatarHeadTelemetry => ({
    owner: `${HYPER3D_THREEJS_TALKING_AVATAR_OWNER}:off`,
    upstream: THREEJS_TALKING_AVATAR_UPSTREAM,
    sourceLoaded,
    reason,
    speechActive: false,
    clock,
    cueCount: plan?.cues.length ?? 0,
    activeBeats: 0,
    performancePose: { yaw: 0, pitch: 0, roll: 0 },
    headDegrees: { yaw: 0, pitch: 0, roll: 0 },
    neckDegrees: { yaw: 0, pitch: 0, roll: 0 },
    appliedHeadDegrees: null,
    appliedNeckDegrees: null,
    motionScale,
    stressAvailable: Boolean(input.stressAvailable),
    acousticFrameCount: input.acousticFrameCount ?? 0,
    regions,
    gazeYawDegrees: 0,
    gazePitchDegrees: 0,
    gazeTrace: null,
    blinkLeft: 0,
    blinkRight: 0,
    blinkCount: plan?.blinks.length ?? 0,
    browPulse: 0,
    browOuterUpLeft: 0,
    browOuterUpRight: 0,
    facePose: {},
    affect: plan?.affect ?? "neutral",
    affectSource: plan?.intent.source ?? "text-fallback",
    affectIntensity: plan?.intensity ?? 0,
    affectScale: 0
  });

  /**
   * OFF returns the head and neck to rest and reports it. It does not fall back
   * to the accepted Hyper3D planner, and it touches nothing but the head and
   * neck rotation — lip sync, expressions, audio, eyes, jaw and materials are
   * all on other paths and are not referenced here.
   */
  if (!enabled) {
    performance.setPlan(null);
    performance.reset();
    return {
      headMotion: {
        ...incoming,
        active: false,
        head: zeroRotation(),
        neck: zeroRotation(),
        // Same follower as the active path, so OFF eases to rest instead of
        // snapping there.
        jerkLimited: false,
        owner: `${HYPER3D_THREEJS_TALKING_AVATAR_OWNER}:off`
      },
      telemetry: base(
        "PERFORMANCE OFF — head and neck held at rest; gaze, blink and brows returned to their existing controllers.",
        Boolean(plan)
      ),
      frame: null,
      facePose: null
    };
  }

  if (!plan) {
    performance.setPlan(null);
    return {
      headMotion: {
        ...incoming,
        active: false,
        head: zeroRotation(),
        neck: zeroRotation(),
        // Same follower as the active path, so OFF eases to rest instead of
        // snapping there.
        jerkLimited: false,
        owner: `${HYPER3D_THREEJS_TALKING_AVATAR_OWNER}:off`
      },
      telemetry: base(
        "NO SOURCE — the upstream beat detector reads energy, pitch, voicing and transients from decoded PCM, and none is available yet. No head motion is invented in its place.",
        false
      ),
      frame: null,
      facePose: null
    };
  }

  performance.setPlan(plan);
  if (input.conversationState) performance.setConversationState(input.conversationState);
  const frame = performance.sample({
    timeSeconds: clock,
    deltaSeconds: input.deltaSeconds,
    speechActive: input.speechActive
  });

  /**
   * Upstream degrees -> Hyper3D rig. `motionScale` is a rig-scaling control
   * only; at its 1.0 default upstream's own amplitude reaches the bones
   * unchanged, which is what the first hardware comparison is meant to judge.
   */
  const performancePose: HeadPose = {
    yaw: frame.yawDegrees * motionScale,
    pitch: frame.pitchDegrees * motionScale,
    roll: frame.rollDegrees * motionScale
  };
  const rig = distributeToRig(performancePose);

  /**
   * GAZE / BLINK / BROWS.
   *
   * `motionScale` is deliberately NOT applied to any of these. It is the
   * hardware-accepted HEAD baseline and nothing else; the eye and brow channels
   * arrive at upstream amplitude through the existing Hyper3D calibration, which
   * already owns their rails, gains and caps.
   */
  const gaze = threejsTalkingAvatarGazeDegrees(frame.gazeX, frame.gazeY, input.gazeAmplitude ?? 1);
  const gazePose = regions.gaze ? hyper3dGazePose(gaze.yawDegrees, gaze.pitchDegrees) : {};
  const blinkPose = regions.blink
    ? threejsTalkingAvatarBlinkPose(frame.blinkLeft, frame.blinkRight)
    : {};
  const browPose = regions.brows ? threejsTalkingAvatarBrowPose(frame) : {};
  const facePose: BlendshapePose = { ...gazePose, ...blinkPose, ...browPose };

  /**
   * HEAD OFF is an isolation toggle, not a different generator: the performance
   * layer still runs so gaze, blink and brows keep their timing, and only the
   * bone command is zeroed.
   */
  const headPose = regions.head ? rig : { head: { yaw: 0, pitch: 0, roll: 0 }, neck: { yaw: 0, pitch: 0, roll: 0 } };

  return {
    facePose,
    headMotion: {
      ...incoming,
      active: true,
      manualActive: false,
      head: toBoneRadians(headPose.head, false),
      neck: toBoneRadians(headPose.neck, true),
      /**
       * FIRST-ORDER, NOT JERK-LIMITED — and this is a fidelity decision, not a
       * tuning one.
       *
       * Upstream already smooths inside the performance layer (`response()`,
       * 0.2 s attack / 0.35 s release) and then its rig step is a plain
       * exponential lerp at rate 5.5 in `demo/src/portrait/GnmHead.ts`. Our
       * first-order bone follower (`avatarBoneConfig.smoothingSpeed`, rate 10)
       * is the direct analogue of that second stage.
       *
       * The third-order jerk limiter the ACCEPTED Hyper3D owner uses is OUR
       * addition, and this project already measured it delivering a 2.40 deg
       * target to the bone as 1.03 deg without a velocity feed-forward. Running
       * upstream's much smaller target through it would attenuate the very thing
       * the hardware test is meant to judge, and would make the A/B a comparison
       * of two output filters instead of two motion generators.
       */
      jerkLimited: false,
      owner: HYPER3D_THREEJS_TALKING_AVATAR_OWNER
    },
    telemetry: {
      ...base(
        frame.speechActive
          ? `THREEJS PERFORMANCE ON — upstream head beats, ${frame.activeBeats} of ${frame.cueCount} cue(s) active.`
          : "THREEJS PERFORMANCE ON — plan loaded, waiting for speech.",
        true
      ),
      owner: HYPER3D_THREEJS_TALKING_AVATAR_OWNER,
      speechActive: frame.speechActive,
      activeBeats: frame.activeBeats,
      performancePose: regions.head ? performancePose : { yaw: 0, pitch: 0, roll: 0 },
      headDegrees: headPose.head,
      neckDegrees: headPose.neck,
      gazeYawDegrees: regions.gaze ? gaze.yawDegrees : 0,
      gazePitchDegrees: regions.gaze ? gaze.pitchDegrees : 0,
      gazeTrace: regions.gaze
        ? traceHyper3dGaze(frame.gazeX, frame.gazeY, gaze.yawDegrees, gaze.pitchDegrees)
        : null,
      blinkLeft: regions.blink ? frame.blinkLeft : 0,
      blinkRight: regions.blink ? frame.blinkRight : 0,
      browPulse: regions.brows ? frame.browPulse : 0,
      browOuterUpLeft: browPose.browOuterUpLeft ?? 0,
      browOuterUpRight: browPose.browOuterUpRight ?? 0,
      facePose,
      affectScale: frame.affectScale
    },
    frame
  };
};
