import type { BlendshapePose } from "./engine/types/facialAnimation";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  calibrateHyper3dPose,
  hyper3dMorphCalibration
} from "./engine/mappings/avatars/hyper3dCalibration";
import { BILABIAL_SEAL_LEVEL, CoarticulationEngine } from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { SpeechBoundaryTimeline } from "./engine/engine/timeline/SpeechBoundaryTimeline";
import {
  HYPER3D_DEADLINE_MAX_SPEEDS,
  HYPER3D_LANDING_EXPONENTS,
  getMouthTransitionProfile,
  resolveMouthDeadline,
  type MouthDeadlineOverride
} from "./engine/mappings/avatarBlendshapeConfig";
import {
  BILABIAL_PHONEMES,
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

/**
 * DEV-ONLY ARTICULATION REVIEW HARNESS. Default off, absent from production builds.
 *
 * WHAT THIS IS NOT. It is not a lip-sync engine, not a second morph owner and it
 * owns no clock, no envelope and no timing of any kind. It PINS the lower-face
 * channels to one phoneme's target so a reviewer can stand a mouth shape still
 * and look at it — which is the one thing live speech makes impossible, because
 * every shape on screen is an exponential follower chasing a triangular envelope
 * through its neighbours.
 *
 * WHY IT WRITES CANONICAL CHANNELS AND NEVER A MORPH TARGET. Exactly the reason
 * `hyper3dEyelashTest` does: there is one production path,
 *
 *   phoneme table -> canonical channels -> calibrateHyper3dPose -> morph.write
 *
 * and a harness that bypassed it would prove nothing. The pose below is built
 * from `hyper3dPhonemeToBlendshape` — the SAME object the CoarticulationEngine
 * reads — and put through `calibrateHyper3dPose`, the SAME function
 * `transformPoseForAvatarModel` applies. Nothing is re-authored, re-derived or
 * copied.
 *
 * WHAT IT DELIBERATELY REMOVES, and this is the point of it:
 *
 *   coarticulation   no previous/next contribution, so a shape is its own
 *   the envelope     held at 1.0 instead of `compressedEnvelope`'s triangle
 *   the smoother     no `FacialPoseMixer.smooth` follower to lag behind it
 *
 * So `CALIBRATED` shows what a phoneme would render if its label were long
 * enough for the pipeline to deliver it in full. Live speech renders LESS than
 * this, never more — which is exactly the gap a reviewer needs to see.
 *
 * `AUTHORED` drops the calibration too, showing `pose x defaultIntensity`. The
 * difference between the two columns IS the asset gain/cap, isolated, so
 * "mapping problem" and "gain problem" can be told apart by looking rather than
 * by arguing.
 */

/** Enabled with `?hyper3dArticulationTest=1`, cleared with `=0`. Sticky in between. */
export const HYPER3D_ARTICULATION_TEST_FLAG = "hyper3dArticulationTest";

/**
 * The lower-face channels this harness owns while a state is pinned.
 *
 * ALL of them are cleared before a state writes its own, so no residue from
 * speech, Active Presence, warmth or the idle showcase can bleed into the shape
 * under inspection. Cheeks, nose, brows and every eye channel are deliberately
 * ABSENT: they are not speech shape, and leaving them live keeps the rest of the
 * face doing what it normally does underneath — the same property that makes the
 * eyelash harness's head-follow check meaningful.
 */
export const HYPER3D_ARTICULATION_TEST_CHANNELS: readonly string[] = Object.freeze([
  "jawOpen", "jawForward", "jawLeft", "jawRight",
  "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight",
  "mouthFrownLeft", "mouthFrownRight",
  "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthPressLeft", "mouthPressRight",
  "mouthRollUpper", "mouthRollLower",
  "mouthShrugUpper", "mouthShrugLower",
  "mouthDimpleLeft", "mouthDimpleRight",
  "mouthLeft", "mouthRight"
]);

/** How the pinned pose is scaled before it is written. */
export type Hyper3dArticulationMode = "calibrated" | "authored";

/**
 * HELD, or DELIVERED at a label length.
 *
 * `held` is the original harness: the target, with the envelope, the smoother
 * and coarticulation taken out of the way — the value production would reach if
 * the label were long enough.
 *
 * The three delivery modes answer the other half of the question, and the half
 * the apex-hold work changed: what the same phoneme actually RENDERS when it is
 * a 70 / 90 / 150 ms label. They run the real `CoarticulationEngine` and the
 * real `FacialPoseMixer` on a looping one-label timeline, so the reviewer sees
 * the shipped envelope and the shipped follower rather than a description of
 * them. 150 ms is included because it is the length at which the apex hold is
 * measured to be inert: if 70 and 150 look the same on the face, the fix worked.
 */
export type Hyper3dArticulationDelivery = "held" | "d70" | "d90" | "d150";

export const HYPER3D_DELIVERY_MS: Readonly<Record<Exclude<Hyper3dArticulationDelivery, "held">, number>> = {
  d70: 70,
  d90: 90,
  d150: 150
};

/** Which end of a diphthong's within-label trajectory to hold. */
export type Hyper3dArticulationGlide = "onset" | "mid" | "offglide";

export interface Hyper3dArticulationTarget {
  id: string;
  label: string;
  family: string;
  /** A phoneme in `hyper3dPhonemeToBlendshape`, or null for a synthetic target. */
  phoneme: string | null;
  /**
   * A CONNECTED SEQUENCE. When present the delivery runner loops these labels
   * back to back instead of one label between silences, so the reviewer sees
   * TRANSITIONS rather than shapes. A sequence has no held pose, so selecting
   * one implies a delivery length.
   */
  phonemes?: readonly string[];
  note?: string;
}

/**
 * Every speech phoneme, grouped by the articulation families the review asks
 * for, plus NEUTRAL and the four combination targets.
 *
 * The full inventory is listed rather than a shortlist because the families that
 * turned out to need looking at hardest — the alveolar and velar stops — are the
 * ones a shortlist would have left out.
 */
export const HYPER3D_ARTICULATION_TARGETS: readonly Hyper3dArticulationTarget[] = Object.freeze([
  { id: "runtime", label: "RUNTIME", family: "—", phoneme: null, note: "Production path, nothing overridden. Live speech, live coarticulation, live smoothing." },
  { id: "neutral", label: "NEUTRAL", family: "—", phoneme: null, note: "Every lower-face channel at zero. The rest pose every shape below is measured against." },

  { id: "AA", label: "AA", family: "A. open vowel", phoneme: "AA" },
  { id: "AH", label: "AH", family: "A. open vowel", phoneme: "AH", note: "The most frequent vowel in English. Watch how little lip shape it carries." },
  { id: "AE", label: "AE", family: "A. open vowel", phoneme: "AE" },
  { id: "AW", label: "AW", family: "A. open vowel", phoneme: "AW" },
  { id: "AY", label: "AY", family: "A. open vowel", phoneme: "AY" },

  { id: "IY", label: "IY", family: "B. front/spread", phoneme: "IY" },
  { id: "IH", label: "IH", family: "B. front/spread", phoneme: "IH" },
  { id: "EH", label: "EH", family: "B. front/spread", phoneme: "EH" },
  { id: "EY", label: "EY", family: "B. front/spread", phoneme: "EY" },
  { id: "Y", label: "Y", family: "B. front/spread", phoneme: "Y" },

  { id: "AO", label: "AO", family: "C. rounded", phoneme: "AO" },
  { id: "OW", label: "OW", family: "C. rounded", phoneme: "OW" },
  { id: "UW", label: "UW", family: "C. rounded", phoneme: "UW" },
  { id: "UH", label: "UH", family: "C. rounded", phoneme: "UH" },
  { id: "OY", label: "OY", family: "C. rounded", phoneme: "OY" },
  { id: "ER", label: "ER", family: "C. rounded", phoneme: "ER" },

  { id: "P", label: "P", family: "D. bilabial", phoneme: "P" },
  { id: "B", label: "B", family: "D. bilabial", phoneme: "B" },
  { id: "M", label: "M", family: "D. bilabial", phoneme: "M" },

  { id: "F", label: "F", family: "E. labiodental", phoneme: "F" },
  { id: "V", label: "V", family: "E. labiodental", phoneme: "V" },

  { id: "TH", label: "TH", family: "F. dental/alveolar", phoneme: "TH" },
  { id: "DH", label: "DH", family: "F. dental/alveolar", phoneme: "DH" },
  { id: "T", label: "T", family: "F. dental/alveolar", phoneme: "T" },
  { id: "D", label: "D", family: "F. dental/alveolar", phoneme: "D" },
  { id: "N", label: "N", family: "F. dental/alveolar", phoneme: "N" },
  { id: "L", label: "L", family: "F. dental/alveolar", phoneme: "L" },

  { id: "S", label: "S", family: "G. sibilant/affricate", phoneme: "S" },
  { id: "Z", label: "Z", family: "G. sibilant/affricate", phoneme: "Z" },
  { id: "SH", label: "SH", family: "G. sibilant/affricate", phoneme: "SH" },
  { id: "ZH", label: "ZH", family: "G. sibilant/affricate", phoneme: "ZH" },
  { id: "CH", label: "CH", family: "G. sibilant/affricate", phoneme: "CH" },
  { id: "JH", label: "JH", family: "G. sibilant/affricate", phoneme: "JH" },

  { id: "K", label: "K", family: "H. velar/other", phoneme: "K" },
  { id: "G", label: "G", family: "H. velar/other", phoneme: "G" },
  { id: "NG", label: "NG", family: "H. velar/other", phoneme: "NG" },
  { id: "R", label: "R", family: "H. velar/other", phoneme: "R" },
  { id: "W", label: "W", family: "H. velar/other", phoneme: "W" },
  { id: "HH", label: "HH", family: "H. velar/other", phoneme: "HH" },

  { id: "openVowel", label: "OPEN VOWEL", family: "I. combination", phoneme: "AA", note: "Family exemplar: the top of the aperture ladder. Both teeth rows should be visible." },
  { id: "spreadVowel", label: "SPREAD VOWEL", family: "I. combination", phoneme: "IY", note: "Family exemplar: the top of the spread ladder. Width without corner lift." },
  { id: "roundVowel", label: "ROUND VOWEL", family: "I. combination", phoneme: "UW", note: "Family exemplar: the top of the rounding ladder. A small protruded oval." },
  { id: "bilabialSeal", label: "FULL BILABIAL SEAL", family: "I. combination", phoneme: "M", note: `M with mouthClose forced to the production seal level (${BILABIAL_SEAL_LEVEL}) that CoarticulationEngine asserts on every P/B/M. Do the lips actually meet?` },

  /**
   * CONNECTED SEQUENCES. Chosen from the measured transition ranking rather
   * than picked: `AA->N`, `AA->T` and `AA->M` are among the highest-velocity
   * transitions in the aligned corpus, and each is 85-94 % jaw. The vowel
   * triplets isolate shape change with the aperture almost constant, which is
   * where "forming a shape" either reads or does not.
   */
  { id: "seqOpenFrontRound", label: "AA·IY·UW·AH", family: "J. connected", phoneme: null, phonemes: ["AA", "IY", "UW", "AH"], note: "Aperture, spread and rounding in turn. Does each shape read as its own, or does it look like one mouth opening and closing?" },
  { id: "seqAhIyAh", label: "AH·IY·AH", family: "J. connected", phoneme: null, phonemes: ["AH", "IY", "AH"], note: "Pure spread change. The jaw barely moves here — if this looks like up-and-down motion, the shape channels are too weak." },
  { id: "seqUwIyUw", label: "UW·IY·UW", family: "J. connected", phoneme: null, phonemes: ["UW", "IY", "UW"], note: "Round to spread and back, aperture near constant. The widest pure shape excursion in the language." },
  { id: "seqMaaM", label: "M·AA·M", family: "J. connected", phoneme: null, phonemes: ["M", "AA", "M"], note: "Seal, open, seal. Do the lips actually meet at both ends, and does the jaw slam or settle?" },
  { id: "seqBiyB", label: "B·IY·B", family: "J. connected", phoneme: null, phonemes: ["B", "IY", "B"], note: "Closure against a spread vowel — the context in which B measured weakest." },
  { id: "seqTaaKiy", label: "T·AA·K·IY", family: "J. connected", phoneme: null, phonemes: ["T", "AA", "K", "IY"], note: "The collapsed stops against open and front vowels. T and K should not look identical." },
  { id: "seqAaNaa", label: "AA·N·AA", family: "J. connected", phoneme: null, phonemes: ["AA", "N", "AA"], note: "MEASURED WORST CASE: 169 mm/s peak, 92 % of it jaw. This is the transition the 'lips move faster than the voice' report is about." },

  /**
   * THE SHAPE-REFINEMENT REVIEW SET, from §8 of the refinement brief. Each one
   * is a transition the measurement says something specific about, so a reviewer
   * can check the claim rather than form a general impression.
   */
  { id: "seqShapeOpenLadder", label: "AA·AE·AH", family: "L. shape review", phoneme: null, phonemes: ["AA", "AE", "AH"], note: "The open ladder. Measured as the BEST-separated vowel family (2.47-4.26 mm) but the most jaw-dominated (20-32 % lip). Three distinct open shapes, or three jaw amplitudes? This is the asset limitation, reported and not fixed." },
  { id: "seqShapeUwIy", label: "UW·IY", family: "L. shape review", phoneme: null, phonemes: ["UW", "IY"], note: "Round to spread, the widest shape excursion there is, and IY now carries the new corner pocket. Aperture barely moves — if this reads as up-and-down, the shapes are still losing." },
  { id: "seqShapeIyAa", label: "IY·AA", family: "L. shape review", phoneme: null, phonemes: ["IY", "AA"], note: "Spread-narrow to open-wide: both ladders at once. IY-AA is far apart by measurement; this is the sanity check that the pocket did not soften the contrast." },
  { id: "seqShapeOwEh", label: "OW·EH", family: "L. shape review", phoneme: null, phonemes: ["OW", "EH"], note: "Rounded to front, similar aperture. OW is untouched by this pass; EH deliberately gets no pocket. Does the rounding release cleanly into a spread shape?" },
  { id: "seqShapeAwAy", label: "AW·AY", family: "L. shape review", phoneme: null, phonemes: ["AW", "AY"], note: "Two diphthongs sharing an open onset and diverging — AW rounds, AY spreads. Both carry glides, so watch the SECOND half of each label." },
  { id: "seqShapeTiy", label: "T·IY", family: "L. shape review", phoneme: null, phonemes: ["T", "IY"], note: "An alveolar stop into the most spread vowel. T's own retraction cue and IY's pocket are both lateral — do they read as two events or one?" },
  { id: "seqShapeKaa", label: "K·AA", family: "L. shape review", phoneme: null, phonemes: ["K", "AA"], note: "A velar stop into the widest aperture. K must NOT read as front: its lower-lip drop is deliberately the opposite cue from T's retraction." },
  { id: "seqShapeFuw", label: "F·UW", family: "L. shape review", phoneme: null, phonemes: ["F", "UW"], note: "Labiodental into strong rounding. F measured healthy (0.30 lowerDown) and UW is the top of the rounding ladder; both untouched by this pass." },
  { id: "seqShapeRzh", label: "R·ZH·R", family: "L. shape review", phoneme: null, phonemes: ["R", "ZH", "R"], note: "THE PAIR THIS PASS FIXED. R and ZH measured 0.131 mm apart — the closest different-viseme shapes in the inventory — and are now 0.662 mm apart. /r/ should read as more protruded than /ʒ/, and still clearly not /w/." },

  /**
   * THE SENTENCE PAUSE. `SIL` runs at a fixed 850 ms whatever label length is
   * selected, because that is the measured median of a real sentence pause
   * (33 runs across nine aligned fixtures, median 830 ms) — scaling it with the
   * phoneme length would make it a different kind of gap.
   */
  { id: "seqSentencePause", label: "SPEECH · PAUSE · SPEECH", family: "K. sentence pause", phoneme: null, phonemes: ["AA", "T", "IY", "SIL", "M", "AA", "N"], note: "A real 850 ms sentence pause between two phrases. Does the mouth SETTLE into a soft, present posture and hold it — or collapse dead and cold-start? Watch the settle readout." }
]);

/** A real sentence pause, from the measured median of 33 aligned silence runs. */
export const HYPER3D_DEV_SENTENCE_PAUSE_MS = 850;

export type Hyper3dArticulationTestState = string;

/** Mutable review state. DEV only; production never reads a non-runtime value. */
let currentState: Hyper3dArticulationTestState = "runtime";
let currentMode: Hyper3dArticulationMode = "calibrated";
let currentGlide: Hyper3dArticulationGlide = "mid";
let currentDelivery: Hyper3dArticulationDelivery = "held";
let currentJawMode: Hyper3dArticulationJawMode = "asymmetric";
/**
 * The target-convergence comparison. `production` is the DEV default, so a
 * developer who opens the panel without choosing anything is watching exactly
 * what ships — the `hyper3d-usc` profile's own accepted 34 SOFT values, with no
 * override applied at all.
 *
 * AND IT IS NOT WHAT MAKES PRODUCTION WORK. A production frame never reads this
 * variable: the orchestrator consults it only behind
 * `hyper3dArticulationTestAvailable`, which is false outside a DEV build with
 * the flag set, so production passes `null` and the controller returns the
 * profile by identity. Deleting this entire module would not change a single
 * production frame.
 */
let currentDeadlineMode: Hyper3dDeadlineMode = "production";
let currentIntensity = 1;
const listeners = new Set<() => void>();

const notify = () => { for (const listener of listeners) listener(); };

export const subscribeHyper3dArticulationTest = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getHyper3dArticulationTestState = () => currentState;
export const getHyper3dArticulationTestMode = () => currentMode;
export const getHyper3dArticulationTestGlide = () => currentGlide;
export const getHyper3dArticulationTestIntensity = () => currentIntensity;

export const setHyper3dArticulationTestState = (state: Hyper3dArticulationTestState) => {
  if (state === currentState) return;
  currentState = state;
  resetDeliveryRun();
  notify();
};

export const setHyper3dArticulationTestMode = (mode: Hyper3dArticulationMode) => {
  if (mode === currentMode) return;
  currentMode = mode;
  notify();
};

export const setHyper3dArticulationTestGlide = (glide: Hyper3dArticulationGlide) => {
  if (glide === currentGlide) return;
  currentGlide = glide;
  notify();
};

/**
 * The A/B for the asymmetric jaw. `asymmetric` is production; `symmetric`
 * passes no profile to the mixer, which is the pre-G trajectory exactly.
 * Shapes are not toggled — they live in the phoneme table and both modes
 * therefore show the shipped ones.
 */
export type Hyper3dArticulationJawMode = "asymmetric" | "symmetric";

export const getHyper3dArticulationTestJawMode = () => currentJawMode;

export const setHyper3dArticulationTestJawMode = (mode: Hyper3dArticulationJawMode) => {
  if (mode === currentJawMode) return;
  currentJawMode = mode;
  resetDeliveryRun();
  notify();
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TARGET-CONVERGENCE COMPARISON — now 34 BASELINE vs 34 SOFT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every mode runs over ONE unchanged timeline. Nothing about the audio clock,
 * the phoneme timestamps, the envelope, coarticulation or the strengths differs
 * between them; the only things that move are the ceiling on how fast the
 * follower may converge to the CURRENT label's target, and how much of that
 * assistance survives as the channel approaches the target.
 *
 * THE TWO MODES THE HARDWARE TEST IS ABOUT, and they are the only two promoted:
 *
 *   `d34`       34 BASELINE. The hardware-chosen working baseline.
 *   `d34soft`   34 SOFT. Cap 34, with the measured soft-landing curve
 *               (exponent 0.5) withdrawing assistance as the shape forms.
 *
 * RETAINED FOR REGRESSION AND DEBUGGING, not for tuning (§16). `current` is the
 * pre-deadline production follower and is what §6's failure mode is measured
 * against; `d44` was ruled out by hardware as too fast; `d34softB` and
 * `d34softC` are the two rejected landing candidates, kept so the choice stays
 * reproducible from this repository rather than from a report.
 *
 * The mode reaches BOTH paths the reviewer can watch — the connected-speech
 * runner below and the live RUNTIME target, through the frame orchestrator — so
 * "the same utterance in two modes" is literally the same utterance.
 */
export type Hyper3dDeadlineMode =
  | "production"
  | "d34"
  | "current"
  | "d44"
  | "d34softB"
  | "d34softC";

/**
 * `production` APPLIES NO OVERRIDE AT ALL. It is not "a mode that happens to
 * match production" — selecting it means the panel hands the controller `null`
 * and the frame runs the `hyper3d-usc` profile's own accepted 34 SOFT values.
 * That is what makes it a true reference point for the others: a reviewer
 * comparing against it is comparing against the shipped path, not against a
 * reconstruction of it.
 */
export const HYPER3D_DEADLINE_PRIMARY_MODES: readonly Hyper3dDeadlineMode[] = Object.freeze([
  "production",
  "d34"
]);

/** Everything else, behind a disclosure so it cannot be picked by accident. */
export const HYPER3D_DEADLINE_REGRESSION_MODES: readonly Hyper3dDeadlineMode[] = Object.freeze([
  "current",
  "d44",
  "d34softB",
  "d34softC"
]);

export const HYPER3D_DEADLINE_MODES: readonly Hyper3dDeadlineMode[] = Object.freeze([
  ...HYPER3D_DEADLINE_PRIMARY_MODES,
  ...HYPER3D_DEADLINE_REGRESSION_MODES
]);

/** What the panel prints, and what the report refers to. */
export const HYPER3D_DEADLINE_MODE_LABELS: Readonly<Record<Hyper3dDeadlineMode, string>> =
  Object.freeze({
    production: "PRODUCTION (34 SOFT)",
    d34: "34 BASELINE",
    current: "PRE-DEADLINE",
    d44: "44 (rejected)",
    d34softB: "34 SOFT-B (rejected)",
    d34softC: "34 SOFT-C (rejected)"
  });

export const getHyper3dDeadlineMode = () => currentDeadlineMode;

/**
 * THE OVERRIDE THIS MODE APPLIES, and the only thing the DEV panel contributes
 * to a frame.
 *
 *   `production`  `null`  — no override. The profile's own 34 SOFT.
 *   `current`     `"off"` — strip the deadline, the pre-deadline follower.
 *   everything else        an explicit cap and landing exponent.
 *
 * `null` AND `"off"` ARE NOT THE SAME THING, and conflating them is the one
 * mistake this shape exists to prevent. Before 34 SOFT was promoted they were
 * indistinguishable — "supply no cap" and "run no deadline" described one
 * state. Now `null` means "run production" and `"off"` means "run the thing
 * production replaced", so the off state is named rather than encoded as a
 * falsy number.
 *
 * EVERY SOFT MODE IS CAPPED AT 34. The landing curve withdraws assistance; it
 * never raises the ceiling, and no soft mode can reach 44.
 */
export const getHyper3dDeadlineOverride = (): MouthDeadlineOverride => {
  switch (currentDeadlineMode) {
    case "production":
      return null;
    case "current":
      return "off";
    case "d34":
      return { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: null };
    case "d44":
      return { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d44, landingExponent: null };
    case "d34softB":
      return { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: HYPER3D_LANDING_EXPONENTS.b };
    case "d34softC":
      return { maxSpeed: HYPER3D_DEADLINE_MAX_SPEEDS.d34, landingExponent: HYPER3D_LANDING_EXPONENTS.c };
  }
};

/**
 * The cap and landing that are EFFECTIVELY in force, for the panel's readout.
 *
 * Resolved through `resolveMouthDeadline` against the real `hyper3d-usc`
 * profile rather than read off the mode, so `PRODUCTION (34 SOFT)` prints 34
 * and ^0.5 because that is what the profile carries — not because the panel was
 * told to say so. If production were ever retuned, this readout would follow it
 * without anyone remembering to update the panel.
 */
const effectiveDeadline = () =>
  resolveMouthDeadline(getMouthTransitionProfile("hyper3d-usc"), getHyper3dDeadlineOverride())
    ?.deadline ?? null;

export const getHyper3dDeadlineMaxSpeed = (): number | null => effectiveDeadline()?.maxSpeed ?? null;

export const getHyper3dDeadlineLanding = (): number | null =>
  effectiveDeadline()?.landingExponent ?? null;

export const setHyper3dDeadlineMode = (mode: Hyper3dDeadlineMode) => {
  if (mode === currentDeadlineMode) return;
  currentDeadlineMode = mode;
  resetDeliveryRun();
  notify();
};

export const getHyper3dArticulationTestDelivery = () => currentDelivery;

export const setHyper3dArticulationTestDelivery = (delivery: Hyper3dArticulationDelivery) => {
  if (delivery === currentDelivery) return;
  currentDelivery = delivery;
  resetDeliveryRun();
  notify();
};

export const setHyper3dArticulationTestIntensity = (intensity: number) => {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  if (clamped === currentIntensity) return;
  currentIntensity = clamped;
  notify();
};

/**
 * Whether the harness is available at all.
 *
 * Guarded exactly like `hyper3dEyelashTest`: DEV build, then query parameter,
 * then stored preference. A blocked storage API or an exotic location must never
 * decide this, and must never throw on a module-load path.
 */
export const isHyper3dArticulationTestEnabled = (): boolean => {
  if (!import.meta.env?.DEV) return false;
  try {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search).get(HYPER3D_ARTICULATION_TEST_FLAG);
    if (query !== null) {
      const wanted = query !== "0" && query !== "false";
      try {
        if (wanted) window.localStorage?.setItem(HYPER3D_ARTICULATION_TEST_FLAG, "1");
        else window.localStorage?.removeItem(HYPER3D_ARTICULATION_TEST_FLAG);
      } catch { /* the query parameter still decides THIS session */ }
      return wanted;
    }
    return window.localStorage?.getItem(HYPER3D_ARTICULATION_TEST_FLAG) === "1";
  } catch {
    return false;
  }
};

/** Resolved once, so the frame path costs one boolean read and nothing else. */
export const hyper3dArticulationTestAvailable: boolean = isHyper3dArticulationTestEnabled();

export const hyper3dArticulationTarget = (id: string) =>
  HYPER3D_ARTICULATION_TARGETS.find((entry) => entry.id === id);

type PhonemeDefinition = {
  pose: BlendshapePose;
  defaultIntensity: number;
  viseme: string;
  category: string;
  onsetPose?: BlendshapePose;
  offglidePose?: BlendshapePose;
};

const definitionFor = (phoneme: string): PhonemeDefinition | undefined =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, PhonemeDefinition>)[phoneme];

/** True when this phoneme carries a within-label trajectory (the five diphthongs). */
export const hyper3dArticulationHasGlide = (id: string) => {
  const target = hyper3dArticulationTarget(id);
  if (!target?.phoneme) return false;
  const definition = definitionFor(target.phoneme);
  return Boolean(definition?.onsetPose && definition?.offglidePose);
};

export interface Hyper3dArticulationReadout {
  /** The pose that is written, i.e. exactly what reaches `morph.write`. */
  pose: BlendshapePose;
  /** `pose x defaultIntensity x intensity`, before any asset gain or cap. */
  authored: BlendshapePose;
  phoneme: string | null;
  viseme: string | null;
  defaultIntensity: number;
  sealForced: boolean;
}

/**
 * The channel values a pinned state holds, and the readout the panel prints.
 *
 * ONE function produces both, so the numbers on the panel cannot drift from the
 * numbers on the face: the `pose` field below IS the object the frame path
 * writes, not a recomputation of it.
 */
export const hyper3dArticulationReadout = (
  state: Hyper3dArticulationTestState,
  mode: Hyper3dArticulationMode,
  glide: Hyper3dArticulationGlide,
  intensity: number
): Hyper3dArticulationReadout => {
  const empty: Hyper3dArticulationReadout = {
    pose: {}, authored: {}, phoneme: null, viseme: null, defaultIntensity: 0, sealForced: false
  };
  if (state === "runtime" || state === "neutral") return empty;
  const target = hyper3dArticulationTarget(state);
  if (!target?.phoneme) return empty;
  const definition = definitionFor(target.phoneme);
  if (!definition) return empty;

  const source =
    glide === "onset" && definition.onsetPose
      ? definition.onsetPose
      : glide === "offglide" && definition.offglidePose
        ? definition.offglidePose
        : definition.pose;

  const scale = definition.defaultIntensity * Math.min(1, Math.max(0, intensity));
  const authored: BlendshapePose = {};
  for (const [name, value] of Object.entries(source)) {
    const scaled = value * scale;
    if (scaled > 0) authored[name] = Math.min(1, scaled);
  }
  /**
   * The seal is the one value a stop does NOT get from its own pose: the engine
   * asserts `mouthClose = max(pose, BILABIAL_SEAL_LEVEL x seal)` on every P/B/M.
   * The combination target reproduces that assertion by reading the same
   * constant, so what is held here is the real closure demand rather than a
   * number chosen for the panel.
   */
  const sealForced = state === "bilabialSeal";
  if (sealForced) {
    authored.mouthClose = Math.max(authored.mouthClose ?? 0, BILABIAL_SEAL_LEVEL * Math.min(1, Math.max(0, intensity)));
  }

  return {
    pose: mode === "authored" ? authored : calibrateHyper3dPose(authored),
    authored,
    phoneme: target.phoneme,
    viseme: definition.viseme ?? null,
    defaultIntensity: definition.defaultIntensity,
    sealForced
  };
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RUNTIME DELIVERY — the same phoneme, through the shipped envelope and follower.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOT A SECOND SPEECH ENGINE. It instantiates the production
 * `CoarticulationEngine` and the production `FacialPoseMixer` — the same classes
 * `AvatarController` builds — and drives them with a looping one-label timeline.
 * There is no clock of its own: it advances on the frame delta the orchestrator
 * already passes, so it cannot drift from the renderer. It exists only while the
 * DEV flag is on and a delivery mode is selected, and it writes through the one
 * `MorphTargetController` like everything else.
 *
 * The timeline is SIL -> phoneme -> SIL, repeating, which is exactly the isolated
 * measurement the delivery tables are quoted from. Neighbour coarticulation is
 * therefore absent by construction: the reviewer is looking at what this phoneme
 * can deliver on its own at this label length.
 */
const DELIVERY_LEAD_SECONDS = 0.25;
const DELIVERY_TAIL_SECONDS = 0.25;

type TimedLabel = { id: string; phoneme: string; start_time: number; end_time: number; intensity: number };

export interface Hyper3dDeliveryStats {
  /** Peak geometric speed of the whole mouth over the last cycle, mm/s. */
  peakVelocityMMPerSecond: number;
  /** Share of that cycle's travel carried by `jawOpen`. */
  jawShare: number;
  /** Total distance the mouth travelled over the last cycle, mm. */
  pathLengthMM: number;
  cycleSeconds: number;
  /** True while the runner is inside a sentence pause and settling. */
  settling: boolean;
  /**
   * §9 OF THE BRIEF — the deadline comparison's instrumentation, over the last
   * completed cycle. Present in every mode, so CURRENT reads on the same ruler.
   */
  reach: ReachReport;
  motion: MotionReport;
  /**
   * TIMELINE DRIFT, in seconds, and it is a measurement and not an assertion.
   * The clock the phoneme lookup used minus the clock the deadline was computed
   * from, captured at the two call sites separately. Structurally zero — no code
   * on this path writes a clock — and reported so that stops being a claim.
   */
  timelineDriftSeconds: number;
  /**
   * Bilabial closure timing error, ms: peak rendered `mouthClose` against peak
   * demanded. `mouthClose` is not an eligible channel, so this must not move
   * between modes, which is the point of printing it.
   */
  closureTimingErrorMs: number;
}

/** What the deadline layer is doing on the frame now on screen. §9's live block. */
export interface Hyper3dDeadlineReadout {
  mode: Hyper3dDeadlineMode;
  /** The cap in force, or `null` with no deadline. */
  maxSpeed: number | null;
  /** The soft-landing exponent in force, or `null` for a baseline mode. */
  landing: number | null;
  /** The label the deadline belongs to, or `null` in silence. */
  phoneme: string | null;
  labelMs: number;
  remainingMs: number;
  /** True when the layer raised at least one channel above its baseline speed. */
  accelerating: boolean;
  acceleratedChannels: number;
  /** The highest convergence speed demanded this frame, or 0. */
  peakSpeed: number;
}

/** Per-label accumulators for the reach measurement. Reset on every label edge. */
type LabelWindow = {
  index: number;
  phoneme: string;
  seconds: number;
  /** Peak TARGET the mixer was handed, per channel. */
  demand: BlendshapePose;
  /** Peak RENDERED value the follower produced, per channel. */
  reached: BlendshapePose;
  /** Clock at which `mouthClose` peaked, demanded and rendered. */
  closureDemandAt: number;
  closureDemandPeak: number;
  closureRenderedAt: number;
  closureRenderedPeak: number;
};

type DeliveryRun = {
  engine: CoarticulationEngine;
  mixer: FacialPoseMixer;
  clock: number;
  key: string;
  labels: TimedLabel[];
  boundaries: SpeechBoundaryTimeline;
  settling: boolean;
  cycle: number;
  /** Peak per channel over the last completed cycle, for a readable panel. */
  peak: BlendshapePose;
  settled: BlendshapePose;
  previous: BlendshapePose;
  live: {
    peakVel: number;
    jawTravel: number;
    allTravel: number;
    /** Per-frame mouth speeds, for the p90 the brief asks for. */
    velocities: number[];
    /** Rendered `jawOpen` per frame, for the cycle count. */
    jawSeries: number[];
    reach: ReachSample[];
    closureErrorsMs: number[];
    driftSeconds: number;
  };
  /** The label currently being measured, or `null` in silence. */
  window: LabelWindow | null;
  stats: Hyper3dDeliveryStats;
  readout: Hyper3dDeadlineReadout;
};

let deliveryRun: DeliveryRun | null = null;

function resetDeliveryRun() {
  deliveryRun = null;
}

/** The peak each channel reached over the last completed cycle, for the panel. */
export const getHyper3dArticulationDelivered = (): BlendshapePose => ({ ...(deliveryRun?.settled ?? {}) });

const emptyReach: ReachReport = summarizeReach([]);

const idleStats: Hyper3dDeliveryStats = {
  peakVelocityMMPerSecond: 0,
  jawShare: 0,
  pathLengthMM: 0,
  cycleSeconds: 0,
  settling: false,
  reach: emptyReach,
  motion: {
    pathRateMMPerSecond: 0,
    velocityP90MMPerSecond: 0,
    jawCyclesPerSecond: 0,
    jawShare: 0
  },
  timelineDriftSeconds: 0,
  closureTimingErrorMs: 0
};

/** Transition character over the last completed cycle. Zeroed when idle. */
export const getHyper3dArticulationDeliveryStats = (): Hyper3dDeliveryStats =>
  deliveryRun?.stats ?? idleStats;

const idleDeadlineReadout = (): Hyper3dDeadlineReadout => ({
  mode: currentDeadlineMode,
  maxSpeed: getHyper3dDeadlineMaxSpeed(),
  landing: getHyper3dDeadlineLanding(),
  phoneme: null,
  labelMs: 0,
  remainingMs: 0,
  accelerating: false,
  acceleratedChannels: 0,
  peakSpeed: 0
});

/**
 * The LIVE readout, published by the frame orchestrator out of the production
 * smoother's own report. This is what makes the RUNTIME target instrumented:
 * the reviewer watching real speech reads the same four numbers as the reviewer
 * watching the connected-speech runner, and both come from the mixer that
 * produced the frame rather than from a re-derivation of it.
 */
let liveDeadlineReadout: Hyper3dDeadlineReadout = idleDeadlineReadout();

export const publishHyper3dDeadlineFrame = (
  phoneme: string | null | undefined,
  frame:
    | {
        armed: boolean;
        acceleratedChannels: number;
        peakSpeed: number;
        secondsRemaining: number;
        labelSeconds: number;
      }
    | undefined
) => {
  if (!frame) {
    liveDeadlineReadout = idleDeadlineReadout();
    return;
  }
  liveDeadlineReadout = {
    mode: currentDeadlineMode,
    maxSpeed: getHyper3dDeadlineMaxSpeed(),
    landing: getHyper3dDeadlineLanding(),
    phoneme: phoneme ?? null,
    labelMs: frame.labelSeconds * 1000,
    remainingMs: Math.max(0, frame.secondsRemaining) * 1000,
    accelerating: frame.acceleratedChannels > 0,
    acceleratedChannels: frame.acceleratedChannels,
    peakSpeed: frame.peakSpeed
  };
};

/**
 * The live deadline block §9 asks for. Reflects the frame on screen — the DEV
 * runner's when a sequence is running, the production frame's otherwise — and in
 * CURRENT mode reports exactly that: a cap of `null` and never accelerating.
 */
export const getHyper3dDeadlineReadout = (): Hyper3dDeadlineReadout => {
  const frame = deliveryRun?.readout ?? liveDeadlineReadout;
  /**
   * THE SELECTION IS READ LIVE, the frame numbers are read from the frame.
   *
   * `mode`, `maxSpeed` and `landing` describe what is SELECTED, so they are
   * re-resolved on every read: a reviewer who has just switched mode must see
   * the new mode immediately, even on a frame that has not been produced yet,
   * and a panel that reported the mode a stale frame was rendered under would be
   * the one piece of instrumentation capable of mislabelling a video.
   */
  return {
    ...frame,
    mode: currentDeadlineMode,
    maxSpeed: getHyper3dDeadlineMaxSpeed(),
    landing: getHyper3dDeadlineLanding()
  };
};

/** Geometric distance between two rendered poses, over the harness's channels. */
const mouthDistanceMM = (a: BlendshapePose, b: BlendshapePose) =>
  poseDistanceMM(a, b, HYPER3D_ARTICULATION_TEST_CHANNELS);

/**
 * Builds the looping timeline: SIL, then each label back to back, then SIL.
 * A single phoneme is just the one-label case, so held and connected share one
 * runner rather than acquiring a second.
 */
function buildLabels(phonemes: readonly string[], duration: number) {
  const labels: TimedLabel[] = [
    { id: "dev-lead", phoneme: "SIL", start_time: 0, end_time: DELIVERY_LEAD_SECONDS, intensity: 1 }
  ];
  let cursor = DELIVERY_LEAD_SECONDS;
  phonemes.forEach((phoneme, index) => {
    // A SIL inside a sequence is a real sentence pause, not a scaled label.
    const span = phoneme === "SIL" ? HYPER3D_DEV_SENTENCE_PAUSE_MS / 1000 : duration;
    labels.push({ id: `dev-${index}`, phoneme, start_time: cursor, end_time: cursor + span, intensity: 1 });
    cursor += span;
  });
  labels.push({ id: "dev-tail", phoneme: "SIL", start_time: cursor, end_time: cursor + DELIVERY_TAIL_SECONDS, intensity: 1 });
  return { labels, cycle: cursor + DELIVERY_TAIL_SECONDS };
}

function stepDelivery(
  phonemes: readonly string[],
  durationMs: number,
  intensity: number,
  deltaSeconds: number
): BlendshapePose {
  const duration = durationMs / 1000;
  /**
   * THE DEADLINE MODE IS NOT IN THE KEY, deliberately. Switching mode must not
   * rebuild the timeline — §10 requires the same audio, the same phoneme
   * sequence and the same timing in all three modes, so the labels, the cycle
   * length and the clock are identical and only the follower's ceiling changes.
   * `setHyper3dDeadlineMode` resets the run so the measurements start clean.
   */
  const key = `${phonemes.join(">")}|${durationMs}|${intensity.toFixed(3)}`;
  if (!deliveryRun || deliveryRun.key !== key) {
    const { labels, cycle } = buildLabels(phonemes, duration);
    deliveryRun = {
      engine: new CoarticulationEngine(),
      mixer: new FacialPoseMixer(),
      clock: 0,
      key,
      labels,
      // The production boundary detector, over this sequence as a payload.
      boundaries: new SpeechBoundaryTimeline({ phonemes: labels, pauses: [], audio_duration: cycle } as never),
      settling: false,
      cycle,
      peak: {},
      settled: {},
      previous: {},
      live: {
        peakVel: 0,
        jawTravel: 0,
        allTravel: 0,
        velocities: [],
        jawSeries: [],
        reach: [],
        closureErrorsMs: [],
        driftSeconds: 0
      },
      window: null,
      stats: idleStats,
      readout: {
        mode: currentDeadlineMode,
        maxSpeed: getHyper3dDeadlineMaxSpeed(),
        landing: getHyper3dDeadlineLanding(),
        phoneme: null,
        labelMs: 0,
        remainingMs: 0,
        accelerating: false,
        acceleratedChannels: 0,
        peakSpeed: 0
      }
    };
  }
  const run = deliveryRun;
  const previousClock = run.clock;
  // A hidden tab or a long frame must not fast-forward the sequence past itself.
  const step = Math.min(Math.max(deltaSeconds, 0), 1 / 20);
  run.clock = (run.clock + step) % run.cycle;
  if (run.clock < previousClock) {
    // The sequence just wrapped: publish the cycle's measurements, start fresh.
    closeLabelWindow(run);
    run.settled = run.peak;
    run.stats = {
      peakVelocityMMPerSecond: run.live.peakVel,
      jawShare: run.live.allTravel > 0 ? run.live.jawTravel / run.live.allTravel : 0,
      pathLengthMM: run.live.allTravel,
      cycleSeconds: run.cycle,
      settling: run.settling,
      reach: summarizeReach(run.live.reach),
      motion: {
        pathRateMMPerSecond: run.cycle > 0 ? run.live.allTravel / run.cycle : 0,
        velocityP90MMPerSecond: percentile(run.live.velocities, 0.9),
        jawCyclesPerSecond: run.cycle > 0 ? countJawCycles(run.live.jawSeries) / run.cycle : 0,
        jawShare: run.live.allTravel > 0 ? run.live.jawTravel / run.live.allTravel : 0
      },
      timelineDriftSeconds: run.live.driftSeconds,
      closureTimingErrorMs: median(run.live.closureErrorsMs)
    };
    run.peak = {};
    run.live = {
      peakVel: 0,
      jawTravel: 0,
      allTravel: 0,
      velocities: [],
      jawSeries: [],
      reach: [],
      closureErrorsMs: [],
      driftSeconds: 0
    };
  }

  // The engine's own three-slot view of the timeline, resolved from the clock.
  const at = run.labels.findIndex((l) => run.clock >= l.start_time && run.clock < l.end_time);
  const index = at < 0 ? run.labels.length - 1 : at;
  const active = run.labels[index];
  const current = active.phoneme === "SIL" ? undefined : { ...active, intensity };
  const previousLabel = [...run.labels.slice(0, index)].reverse().find((l) => l.phoneme !== "SIL");
  const nextLabel = run.labels.slice(index + 1).find((l) => l.phoneme !== "SIL");
  /**
   * The clock the phoneme lookup just used. Captured so the drift measurement
   * compares two independently taken readings rather than asserting they agree.
   */
  const lookupClock = run.clock;

  const lip = run.engine.blend({
    time: run.clock,
    current,
    previous: previousLabel,
    next: nextLabel,
    windowSeconds: 0.08,
    profile: hyper3dPhonemeToBlendshape
  });
  const mixed = run.mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
  /**
   * The PRODUCTION jaw profile, so the connected mode shows the shipped
   * asymmetric jaw rather than a symmetric approximation of it. `symmetric`
   * passes `undefined`, which is the pre-G trajectory exactly — that is the
   * whole A/B, and it needs no second engine because the profile is a
   * parameter of the one smoother.
   *
   * THE DEADLINE CAP rides on the same profile, through `withMouthDeadline`,
   * and in CURRENT mode that call returns the profile object itself.
   */
  /**
   * The settle gate, from the SAME `SpeechBoundaryTimeline` production uses,
   * built over this sequence's own labels. The DEV runner therefore exercises
   * the real settle rather than approximating it, and a sequence with no long
   * `SIL` simply never triggers one.
   */
  const settling = run.boundaries.proximityAt(run.clock)?.insidePauseKind === "sentence";
  /**
   * SECONDS LEFT IN THE CURRENT LABEL — the deadline, and `null` in silence.
   * Read from the label the lookup above resolved and the clock it read, so
   * nothing here can describe a timeline the engine did not just use.
   */
  const deadlineClock = run.clock;
  const secondsRemaining = current ? active.end_time - deadlineClock : null;
  run.live.driftSeconds = lookupClock - deadlineClock;
  const smoothed = run.mixer.smooth(
    mixed.pose,
    Math.max(deltaSeconds, 1e-4),
    undefined,
    resolveMouthDeadline(
      currentJawMode === "asymmetric" ? getMouthTransitionProfile("hyper3d-usc") : undefined,
      getHyper3dDeadlineOverride()
    ),
    settling,
    secondsRemaining
  );
  const rendered = calibrateHyper3dPose(smoothed as BlendshapePose);
  run.settling = settling;

  const deadlineFrame = run.mixer.deadlineFrame();
  run.readout = {
    mode: currentDeadlineMode,
    maxSpeed: getHyper3dDeadlineMaxSpeed(),
    landing: getHyper3dDeadlineLanding(),
    phoneme: current ? active.phoneme : null,
    labelMs: current ? (active.end_time - active.start_time) * 1000 : 0,
    remainingMs: secondsRemaining === null ? 0 : Math.max(0, secondsRemaining) * 1000,
    accelerating: deadlineFrame.acceleratedChannels > 0,
    acceleratedChannels: deadlineFrame.acceleratedChannels,
    peakSpeed: deadlineFrame.peakSpeed
  };

  /**
   * REACH, per label. The window closes on the label EDGE rather than on a timer,
   * so the peak demanded and the peak reached are compared over exactly the span
   * the deadline was computed against.
   */
  if (!current) {
    closeLabelWindow(run);
  } else {
    if (!run.window || run.window.index !== index) {
      closeLabelWindow(run);
      run.window = {
        index,
        phoneme: active.phoneme,
        seconds: active.end_time - active.start_time,
        demand: {},
        reached: {},
        closureDemandAt: 0,
        closureDemandPeak: 0,
        closureRenderedAt: 0,
        closureRenderedPeak: 0
      };
    }
    const window = run.window;
    for (const [name, value] of Object.entries(mixed.pose)) {
      if (value > (window.demand[name] ?? 0)) window.demand[name] = value;
    }
    for (const [name, value] of Object.entries(smoothed)) {
      if (value > (window.reached[name] ?? 0)) window.reached[name] = value;
    }
    const closeDemand = mixed.pose.mouthClose ?? 0;
    if (closeDemand > window.closureDemandPeak) {
      window.closureDemandPeak = closeDemand;
      window.closureDemandAt = run.clock;
    }
    const closeRendered = smoothed.mouthClose ?? 0;
    if (closeRendered > window.closureRenderedPeak) {
      window.closureRenderedPeak = closeRendered;
      window.closureRenderedAt = run.clock;
    }
  }

  const travelled = mouthDistanceMM(rendered, run.previous);
  if (step > 1e-5) {
    const velocity = travelled / step;
    if (velocity > run.live.peakVel) run.live.peakVel = velocity;
    run.live.velocities.push(velocity);
  }
  run.live.allTravel += travelled;
  run.live.jawTravel += Math.abs(travelMM("jawOpen", (rendered.jawOpen ?? 0) - (run.previous.jawOpen ?? 0)));
  run.live.jawSeries.push(rendered.jawOpen ?? 0);
  run.previous = rendered;
  for (const [name, value] of Object.entries(rendered)) {
    if (value > (run.peak[name] ?? 0)) run.peak[name] = value;
  }
  return rendered;
}

/**
 * Flush the open label into reach samples. Only channels that were asked for a
 * VISIBLE shape are counted; see `REACH_FLOOR`.
 */
function closeLabelWindow(run: DeliveryRun) {
  const window = run.window;
  if (!window) return;
  run.window = null;
  for (const [channel, demand] of Object.entries(window.demand)) {
    if (demand < REACH_FLOOR) continue;
    run.live.reach.push({
      phoneme: window.phoneme,
      channel,
      labelSeconds: window.seconds,
      reach: (window.reached[channel] ?? 0) / demand
    });
  }
  if (BILABIAL_PHONEMES.has(window.phoneme) && window.closureDemandPeak >= REACH_FLOOR) {
    run.live.closureErrorsMs.push((window.closureRenderedAt - window.closureDemandAt) * 1000);
  }
}

/**
 * Overlays the pinned state onto the resolved pose, or returns it untouched.
 *
 * `runtime` and a disabled harness both return the SAME OBJECT, not a copy, so
 * the production frame path allocates nothing and behaves identically to a build
 * where this module does not exist.
 *
 * Only the lower-face channels above are touched. Head, neck, gaze, blink,
 * brows, cheeks, warmth and Active Presence pass through, so the rest of the
 * face keeps behaving normally while one mouth shape stands still.
 */
export const applyHyper3dArticulationTestPose = (
  pose: BlendshapePose,
  state: Hyper3dArticulationTestState,
  mode: Hyper3dArticulationMode,
  glide: Hyper3dArticulationGlide,
  intensity: number,
  delivery: Hyper3dArticulationDelivery = "held",
  deltaSeconds = 0
): BlendshapePose => {
  if (state === "runtime") return pose;
  const next: BlendshapePose = { ...pose };
  for (const channel of HYPER3D_ARTICULATION_TEST_CHANNELS) next[channel] = 0;
  const target = hyper3dArticulationTarget(state);
  /**
   * A connected sequence has no held pose, so it always runs. A single phoneme
   * runs only when a delivery length is selected. Both take the same runner.
   */
  const sequence = target?.phonemes ?? (target?.phoneme ? [target.phoneme] : null);
  const running = target?.phonemes ? (delivery === "held" ? "d90" : delivery) : delivery;
  if (sequence && running !== "held") {
    const rendered = stepDelivery(sequence, HYPER3D_DELIVERY_MS[running], intensity, deltaSeconds);
    for (const [channel, value] of Object.entries(rendered)) next[channel] = value;
    return next;
  }
  const readout = hyper3dArticulationReadout(state, mode, glide, intensity);
  for (const [channel, value] of Object.entries(readout.pose)) next[channel] = value;
  return next;
};

/**
 * Per-channel geometry for the panel: what this influence is worth in
 * millimetres on `female_2291.glb`, and whether it clears the influence at which
 * this asset was measured to move visibly at all.
 *
 * Both numbers come from `hyper3dMorphCalibration`, which is the asset's own
 * measured table — the panel states the asset's facts, it does not hold any.
 */
export const hyper3dArticulationChannelFacts = (name: string, value: number) => {
  const entry = hyper3dMorphCalibration[name];
  if (!entry) return { travelMM: null, millimetres: null, usefulMin: null, visible: null, cap: null, gain: null };
  return {
    travelMM: entry.travelMM,
    millimetres: entry.travelMM * value,
    usefulMin: entry.usefulMin,
    visible: value >= entry.usefulMin,
    cap: entry.cap,
    gain: entry.gain
  };
};
