import type { BlendshapePose } from "../../types/facialAnimation";
import type { SpeechDeformationProfile } from "../../mappings/speechDeformationProfiles";
import type { SpeechTransitionIntent } from "../lipsync/SpeechTransitionIntent";
import { familyOf, type PhonemeFamily } from "../lipsync/SpeechTransitionIntent";
import { smoothstep } from "../../utils/easing";
import { clamp } from "../../utils/clamp";
import { exponentialSmoothingAlpha, lerp } from "../../utils/lerp";

/**
 * Coordinated speech deformation.
 *
 * Turns the canonical phoneme pose into a coordinated lower-face response: one
 * muscular action instead of independent morph channels.
 *
 * Contract:
 *  - reads the pose the CoarticulationEngine already produced and the intent
 *    derived from its timestamp-bounded weights;
 *  - writes canonical channels only, never meshes, materials or influences;
 *  - introduces NO timing of its own — every temporal term is either the audio's
 *    own contribution weights or frame-rate-independent damping of them;
 *  - owns exactly one smoothing stage for the channels it writes, which the mixer
 *    then leaves alone.
 *
 * Channel ownership, per `docs/evidence/.../speech-pipeline-audit.json`:
 *  - THIS controller owns: jaw, lip closure, lip pressure, upper lip, lower lip,
 *    funnel, pucker, speech mouth corners, speech cheek support, lower-face tension.
 *  - The speaking-expression layer keeps: brows, upper-face emotion, eye softness,
 *    phrase-level warmth. It may not write any channel in `supportedChannels`.
 *
 * That last sentence was documentation only until 2026-08-16, and was not true:
 * `HumanBehaviorController`'s warmth pulse wrote `mouthSmile*`/`cheekSquint*` and
 * `EmotionBlender` wrote whatever its poses carried, both of which `FacialPoseMixer`
 * then SUMMED with this controller's output. It is now enforced at the source:
 * `AvatarController` derives the protected set from `supportedChannels` whenever
 * this layer is active and hands it to both, and neither writes a protected channel
 * while speech is running. `asymmetrySide` below is likewise authoritative — the
 * behaviour layer follows it instead of drawing its own side. See
 * `docs/FEMALE_REALISM_REMEDIATION.md` §6.
 */

export type SpeechDeformationMode = "legacy" | "coordinated";

export interface CoordinatedSpeechInput {
  phonemePose: BlendshapePose;
  previousPhoneme: string | null;
  currentPhoneme: string | null;
  nextPhoneme: string | null;
  phonemeProgress: number;
  speechEnergy: number;
  phraseProgress: number;
  isSpeaking: boolean;
  deltaSeconds: number;
  seed: number;
  transitionIntent: SpeechTransitionIntent;
  profile: SpeechDeformationProfile;
  mode?: SpeechDeformationMode;
  /** Dev-panel scalar, 1 in production. */
  strength?: number;
  /**
   * Phrase-level warmth, in influence units, routed here rather than written
   * directly (§P14).
   *
   * The header above says the speaking-expression layer keeps "phrase-level
   * warmth". P14 measured that this was not happening: `mouthSmile*` and
   * `cheekSquint*` are in `supportedChannels`, so `AvatarController` hands them
   * to `HumanBehaviorController` as protected and it deletes them wholesale
   * while speaking. Disabling the warmth scheduler entirely changed not one
   * frame of either channel, while the same experiment on the brow scheduler
   * changed the brow — the pulse was computed, scheduled and discarded.
   *
   * The fix keeps the ownership rule intact instead of relaxing it: the
   * behaviour layer REPORTS its warmth and this controller — still the only
   * writer — merges it under its own limits, side balance and damping. Zero is
   * inert and reproduces the previous output exactly.
   */
  expressionWarmth?: { smile: number; cheek: number; lowerFace?: number };
}

export interface CoordinatedSpeechDebug {
  transitionType: string;
  closureIntent: number;
  openingIntent: number;
  roundingIntent: number;
  spreadingIntent: number;
  pressureIntent: number;
  tensionIntent: number;
  /** Bilabial share of the coarticulation weights, passed through unmodified. */
  bilabialIntent: number;
  cheekIntent: number;
  /** Per-group contributions, for the debug panel. */
  upperLipContribution: number;
  lowerLipContribution: number;
  pressureContribution: number;
  jawSupport: number;
  cornerSupport: number;
  cheekSupport: number;
  /** Warmth actually merged this frame after suppression and ceilings (§P14). */
  warmthApplied: number;
  /** What the behaviour layer asked for, before ceilings and suppression (§P14). */
  warmthRequested: number;
  /** The suppression factor rounding and bilabial closure applied to it (§P14). */
  warmthSuppression: number;
  /** Which release stage is currently dominant, or "none" while attacking. */
  releasePhase: "none" | "pressure" | "upper-lip" | "corners" | "jaw" | "cheeks" | "settled";
  /** P / B / M timing character currently in effect. */
  bilabialTiming: "none" | "plosive" | "voiced" | "nasal";
  releaseScale: number;
  /** 0-1 closure demand applied to the jaw release speed this frame. */
  jawClosureDemand: number;
  overlap: number;
  /** globalStrength x panel multiplier, i.e. what actually scaled this frame. */
  effectiveStrength: number;
  /** Resolved speech jaw owner. Bone jaw is not animated on any current model. */
  jawOwner: "morph" | "bone" | "combined" | "none";
  asymmetrySide: "left" | "right" | "balanced";
  asymmetryAmount: number;
  clampedChannels: string[];
  jawValue: number;
  upperLip: number;
  lowerLip: number;
  corners: number;
  cheeks: number;
}

export interface CoordinatedSpeechOutput {
  pose: BlendshapePose;
  debug: CoordinatedSpeechDebug;
}

/** Which damping pair governs each owned channel. */
type SmoothingGroup = "lip" | "upperLip" | "jaw" | "cheek" | "corner" | "pressure" | "closure";

const SMOOTHING_GROUP: Record<string, SmoothingGroup> = {
  jawOpen: "jaw",
  // Closure has its own pair, separate from the lip-SHAPING channels below.
  // A seal is effectively binary — the lips either meet or they visibly do not — so
  // it must still complete inside the ~4-6 frames a bilabial lasts, while the shaping
  // channels can afford to be slowed for smoothness. Sharing one "lip" rate forced a
  // choice between the two: slowing the group for smoothness cost 13% of bilabial
  // closure travel. See docs/FEMALE_REALISM_REMEDIATION.md §11.
  mouthClose: "closure",
  mouthPressLeft: "pressure",
  mouthPressRight: "pressure",
  mouthRollUpper: "upperLip",
  mouthRollLower: "lip",
  mouthShrugUpper: "upperLip",
  mouthShrugLower: "lip",
  mouthUpperUpLeft: "upperLip",
  mouthUpperUpRight: "upperLip",
  mouthLowerDownLeft: "lip",
  mouthLowerDownRight: "lip",
  mouthFunnel: "lip",
  mouthPucker: "lip",
  mouthSmileLeft: "corner",
  mouthSmileRight: "corner",
  cheekSquintLeft: "cheek",
  cheekSquintRight: "cheek",
  noseSneerLeft: "cheek",
  noseSneerRight: "cheek"
};

/**
 * xorshift32, matching the naturalism layer's approach.
 *
 * Asymmetry must be deterministic under a seed and must change per phrase, never
 * per frame, so the stream is advanced only when a phrase index changes.
 */
const hash32 = (value: number) => {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
};

const setIfSupported = (
  pose: BlendshapePose,
  supported: Set<string>,
  clamped: string[],
  name: string,
  value: number,
  limit: number
) => {
  if (!supported.has(name)) return;
  if (!Number.isFinite(value) || value <= 0.0001) return;
  const capped = Math.min(value, limit);
  if (capped < value - 1e-6) clamped.push(name);
  pose[name] = clamp(Math.max(pose[name] ?? 0, capped));
};

export class CoordinatedSpeechDeformationController {
  /** Damped state, one entry per owned channel. Reused across frames. */
  private smoothed: Record<string, number> = {};
  /** Mutable output, reused so the hot path allocates nothing. */
  private pose: BlendshapePose = {};
  private clamped: string[] = [];
  private phraseIndex = -1;
  private asymmetrySide: "left" | "right" | "balanced" = "balanced";
  private asymmetryAmount = 0;
  private phraseElapsed = 0;
  /**
   * Per-phoneme release multiplier, the mechanism that separates P from M.
   *
   * S1 tried to separate them by intensity and failed: both saturated the closure
   * clamp and settled to identical values. They differ in TIME, not in size — a P
   * is a burst that clears instantly, an M is a hum that lets go slowly.
   */
  private releaseScale = 1;
  /**
   * How hard the jaw is being asked to close, 0-1, updated once per frame.
   *
   * Kept as instance state for the same reason `releaseScale` is: `damp()` runs per
   * channel after the pose is built, and this is a property of the frame rather than
   * of any one channel.
   */
  private jawClosureDemand = 0;
  private bilabialTiming: "none" | "plosive" | "voiced" | "nasal" = "none";
  /**
   * Eased vowel-family membership, in [0,1].
   *
   * `vowelFamily` is a boolean off the current phoneme, and it gates the upper-lip
   * jaw coupling below. Switching a ceiling on and off between two frames writes a
   * step into a channel that is otherwise smooth, and because the cap also writes
   * back into `smoothed`, that step becomes the smoother's new starting point rather
   * than something it can ease out of. Measured on the audit clip before this was
   * eased, the capped channels held the five worst single-frame steps in the whole
   * lower face — `mouthLowerDown*` moved 84% of their entire range in one frame,
   * against 0.22 for the uncapped jaw. See docs/FEMALE_REALISM_REMEDIATION.md §11.
   */
  private vowelWeight = 0;
  private debug: CoordinatedSpeechDebug = {
    transitionType: "other",
    closureIntent: 0, openingIntent: 0, roundingIntent: 0, spreadingIntent: 0, bilabialIntent: 0,
    pressureIntent: 0, tensionIntent: 0, cheekIntent: 0,
    upperLipContribution: 0, lowerLipContribution: 0, pressureContribution: 0,
    jawSupport: 0, cornerSupport: 0, cheekSupport: 0, warmthApplied: 0, warmthRequested: 0, warmthSuppression: 1,
    releasePhase: "none", bilabialTiming: "none", releaseScale: 1, jawClosureDemand: 0, overlap: 0,
    effectiveStrength: 1, jawOwner: "morph",
    asymmetrySide: "balanced", asymmetryAmount: 0, clampedChannels: [],
    jawValue: 0, upperLip: 0, lowerLip: 0, corners: 0, cheeks: 0
  };

  reset() {
    for (const key in this.smoothed) delete this.smoothed[key];
    for (const key in this.pose) delete this.pose[key];
    this.clamped.length = 0;
    this.phraseIndex = -1;
    this.phraseElapsed = 0;
    this.asymmetrySide = "balanced";
    this.asymmetryAmount = 0;
    this.releaseScale = 1;
    this.jawClosureDemand = 0;
    this.bilabialTiming = "none";
    this.vowelWeight = 0;
  }

  /**
   * Picks a phrase-level asymmetry.
   *
   * Deterministic in `seed` and the phrase index, so the same payload replays
   * identically. Sides alternate rather than being drawn independently, which
   * prevents a run of same-side draws reading as a permanent bias.
   */
  private updateAsymmetry(input: CoordinatedSpeechInput) {
    const { asymmetry } = input.profile;
    // Silence returns both sides to baseline: a stale asymmetry held through a
    // pause would read as a lopsided resting mouth.
    if (!input.isSpeaking || asymmetry.expressiveMaximum <= 0) {
      this.asymmetrySide = "balanced";
      this.asymmetryAmount = 0;
      this.phraseIndex = -1;
      return;
    }
    this.phraseElapsed += input.deltaSeconds;
    const index = Math.floor(input.phraseProgress) + Math.floor(this.phraseElapsed / Math.max(0.1, asymmetry.phrasePersistence));
    if (index === this.phraseIndex) return;
    this.phraseIndex = index;
    const roll = hash32(input.seed * 2654435761 + index * 40503);
    const expressive = input.speechEnergy > 0.55;
    const range = expressive ? asymmetry.expressiveMaximum : asymmetry.ordinaryMaximum;
    this.asymmetryAmount = lerp(asymmetry.ordinaryMinimum, range, roll);
    // Strict alternation off the PREVIOUS side rather than off the index parity.
    // Index parity looked balanced in aggregate but could repeat a side across a
    // reset or a phraseProgress jump, which is what read as sticking.
    this.asymmetrySide = this.asymmetrySide === "left" ? "right" : "left";
  }

  /**
   * Frame-rate-independent damping with separate attack and release speeds.
   *
   * A single speed for both directions is what made releases read as mechanical;
   * splitting them is the core of the phase-aware behaviour.
   */
  private damp(name: string, target: number, delta: number, profile: SpeechDeformationProfile) {
    const group = SMOOTHING_GROUP[name] ?? "lip";
    const previous = this.smoothed[name] ?? 0;
    const rising = target > previous;
    const speeds = profile.smoothing;
    const speed = rising
      ? group === "jaw" ? speeds.jawAttack
        : group === "cheek" ? speeds.cheekAttack
        : group === "corner" ? speeds.cornerAttack
        : group === "pressure" ? speeds.pressureAttack
        : group === "upperLip" ? speeds.upperLipAttack
        : group === "closure" ? speeds.closureAttack
        : speeds.lipAttack
      : group === "jaw" ? speeds.jawRelease
        : group === "cheek" ? speeds.cheekRelease
        : group === "corner" ? speeds.cornerRelease
        : group === "pressure" ? speeds.pressureRelease
        : group === "upperLip" ? speeds.upperLipRelease
        : group === "closure" ? speeds.closureRelease
        : speeds.lipRelease;
    // Per-phoneme release scaling: P snaps out, M lets go slowly. Applied only on
    // the way down so attack timing is owned by the bilabial shape below.
    let scaled = rising ? speed : speed * this.releaseScale;
    /**
     * Demand-adaptive jaw OPENING (§P13).
     *
     * The mirror of the closure acceleration below, on the other branch and for
     * the opposite reason: a short vowel's target is correct but the follower
     * cannot reach it in 40-60 ms. Quadratic in the target, so a closure target
     * is untouched, a reduced vowel barely moves and an open vowel opens
     * decisively. A response of exactly 0 leaves this expression untouched, so
     * the before/after is the real previous code path rather than an
     * approximation of it.
     */
    const openingResponse = speeds.jawOpeningResponse ?? 0;
    if (group === "jaw" && rising && openingResponse > 0) {
      const t = target < 0 ? 0 : target > 1 ? 1 : target;
      scaled *= 1 + openingResponse * t * t;
    }
    /**
     * Closure-aware jaw release.
     *
     * The jaw closing into a bilabial is a different event from the jaw relaxing out
     * of a vowel, and it was measurably failing: the coarticulated TARGET reaches
     * 0.030 three frames before the seal while the smoothed output is still at 0.245,
     * because `jawRelease` is 6 (alpha 0.095 per frame at 60 fps). Nothing upstream is
     * at fault — not the ceiling, which never binds, and not coarticulation, which has
     * already asked for a closed jaw.
     *
     * Scaling the SPEED rather than writing the value is what keeps this continuous:
     * the output stays a convex combination of its previous value and its target, so
     * no rate can produce a jump past the target, and the demand itself is a
     * smoothstep of a continuous intent rather than a switch. Applied on the closing
     * direction only, so opening into a vowel keeps §11's calibrated attack exactly.
     *
     * `releaseScale` is deliberately left in the product. It multiplies the approach
     * as well as the release, which gives P a faster closure than M — phonetically
     * right, and it is why the three land at different apertures rather than one. A
     * variant that faded it out during the approach was measured and rejected: it
     * improved M (0.232 -> 0.167) and cost P more than it gained (0.102 -> 0.147).
     *
     * An acceleration of exactly 1 leaves this expression untouched, so the mechanism
     * has a single off switch and the before/after in the diagnostics is the real
     * previous code path rather than an approximation of it.
     */
    const acceleration = profile.bilabials.jawClosureAcceleration;
    if (group === "jaw" && !rising && acceleration > 1 && this.jawClosureDemand > 0) {
      scaled *= 1 + (acceleration - 1) * this.jawClosureDemand;
    }
    const value = lerp(previous, target, exponentialSmoothingAlpha(scaled, delta));
    this.smoothed[name] = Number.isFinite(value) ? value : 0;
    return this.smoothed[name];
  }

  evaluate(input: CoordinatedSpeechInput): CoordinatedSpeechOutput {
    const { profile } = input;
    const pose = this.pose;
    for (const key in pose) delete pose[key];
    this.clamped.length = 0;

    // Legacy mode and the male profile are both pure pass-throughs, so switching
    // modes is a true A/B of the same pipeline rather than a different pipeline.
    if (!profile.enabled || input.mode === "legacy") {
      Object.assign(pose, input.phonemePose);
      this.debug.transitionType = input.transitionIntent.transitionType;
      this.debug.closureIntent = 0;
      this.debug.bilabialIntent = 0;
      this.debug.openingIntent = 0;
      this.debug.roundingIntent = 0;
      this.debug.spreadingIntent = 0;
      this.debug.pressureIntent = 0;
      this.debug.tensionIntent = 0;
      this.debug.cheekIntent = 0;
      this.debug.upperLipContribution = 0;
      this.debug.lowerLipContribution = 0;
      this.debug.pressureContribution = 0;
      this.debug.jawSupport = input.phonemePose.jawOpen ?? 0;
      this.debug.cornerSupport = 0;
      this.debug.cheekSupport = 0;
      this.debug.warmthApplied = 0;
      this.debug.warmthRequested = 0;
      this.debug.warmthSuppression = 1;
      this.debug.releasePhase = "none";
      this.debug.bilabialTiming = "none";
      this.debug.releaseScale = 1;
      this.jawClosureDemand = 0;
      this.debug.jawClosureDemand = 0;
      this.debug.overlap = 0;
      this.debug.effectiveStrength = 1;
      this.debug.jawOwner = "morph";
      this.debug.asymmetrySide = "balanced";
      this.debug.asymmetryAmount = 0;
      this.debug.clampedChannels = this.clamped;
      this.debug.jawValue = input.phonemePose.jawOpen ?? 0;
      this.debug.upperLip = 0;
      this.debug.lowerLip = 0;
      this.debug.corners = 0;
      this.debug.cheeks = 0;
      return { pose, debug: this.debug };
    }

    const supported = new Set(profile.supportedChannels);
    const intent = input.transitionIntent;
    // Accepted baseline from the profile, times the dev-panel multiplier (1 in
    // production). Storing the baseline in the profile rather than the slider is
    // what makes the human-accepted value the shipped value.
    const strength = clamp((input.strength ?? 1) * profile.globalStrength, 0, 1);
    const limits = profile.limits;
    const clampedList = this.clamped;

    // Start from the phoneme pose so articulation identity is never lost: this
    // layer SUPPORTS the existing lip sync, it does not replace it.
    for (const key in input.phonemePose) pose[key] = input.phonemePose[key];

    this.updateAsymmetry(input);
    const asym = this.asymmetryAmount * strength;
    const leftBias = this.asymmetrySide === "left" ? 1 + asym : this.asymmetrySide === "right" ? 1 - asym : 1;
    const rightBias = this.asymmetrySide === "right" ? 1 + asym : this.asymmetrySide === "left" ? 1 - asym : 1;

    const currentFamily = familyOf(input.currentPhoneme);

    // ---- articulatory overlap ----------------------------------------------
    // Real speech overlaps: the outgoing gesture is still resolving while the
    // incoming one is already forming. The intents alone are a weighted average,
    // which crossfades but does not OVERLAP — at the midpoint both are half
    // strength, so the face passes through a slack in-between pose and the change
    // reads as pose-to-pose.
    //
    // The fix is a small bilateral boost across a transition, held only while both
    // the outgoing and incoming contributions are live. It adds no smoothing and no
    // timing: `previousContribution` and `nextContribution` are the engine's own
    // timestamp-bounded weights, so this can only act inside a genuine transition.
    const crossfade = Math.min(intent.previousContribution + intent.nextContribution, 1);
    const overlapGain = (type: string) => {
      switch (type) {
        // A closure releasing into a vowel: the lips must still be resolving as the
        // jaw starts down, or the mouth pops open.
        case "closure-to-open": return 0.35;
        // Approaching a closure: the lips should already be travelling together.
        case "open-to-closure": return 0.4;
        // Rounding has to unwind before the lips can meet.
        case "rounded-to-closure": return 0.32;
        // Width collapsing into rounding is the slowest of the four to read.
        case "spread-to-rounded": return 0.3;
        case "vowel-to-vowel": return 0.22;
        // A constriction forming out of, or releasing into, a vowel. Added
        // 2026-08-17: these classified as "other" and so received no overlap at
        // all, which is most of connected speech travelling between two shapes
        // with nothing holding the outgoing gesture open. Placed between
        // consonant-cluster (0.18, two consonants barely apart) and closure-to-open
        // (0.35, a full bilabial seal releasing), and above vowel-to-vowel (0.22)
        // because the shape change is larger. Anticipating the constriction is
        // worth slightly more than leaving it, matching open-to-closure > closure-
        // to-open above.
        case "vowel-to-consonant": return 0.26;
        case "consonant-to-vowel": return 0.24;
        case "consonant-cluster": return 0.18;
        default: return 0;
      }
    };
    const overlap = profile.overlapEnabled === false ? 0 : crossfade * overlapGain(intent.transitionType);

    // Overlap must be ANTAGONIST-AWARE. Boosting both sides of an opposed pair
    // amplifies the in-between pose instead of resolving it, producing a mouth that
    // is simultaneously closing and opening — the unnatural hybrid shape. Measured
    // before this fix: min(closure, opening) peaked at 0.57 mid-transition.
    //
    // Instead the dominant gesture of each pair is boosted and its opposite is
    // attenuated by the same overlap. The two still coexist, so the transition
    // genuinely overlaps, but one clearly leads and the shape stays readable.
    // The attenuation is applied at 1.6x the boost: a transition needs a clear
    // leader more than it needs a strong follower, and asymmetric weighting is what
    // keeps the mid-transition shape readable rather than mushy.
    const resolve = (a: number, b: number): [number, number] =>
      a >= b
        ? [clamp(a * (1 + overlap)), clamp(b * Math.max(0, 1 - overlap * 1.6))]
        : [clamp(a * Math.max(0, 1 - overlap * 1.6)), clamp(b * (1 + overlap))];
    const [closure, opening] = resolve(intent.closureIntent, intent.openingIntent);
    const [rounding, spreading] = resolve(intent.roundingIntent, intent.spreadingIntent);
    const pressure = clamp(intent.pressureIntent * (1 + overlap));
    const tension = intent.tensionIntent;

    // ---- bilabials: closure leads, jaw is held nearly shut -------------------
    // P, B and M are separated by TIME, not by size. All three saturate the closure
    // clamp, so an intensity multiplier produced three identical settled poses.
    // What actually distinguishes them is how fast the closure lets go: a P is a
    // burst, an M is a hum. The multiplier below scales release speed only.
    if (currentFamily === "bilabial") {
      this.bilabialTiming =
        input.currentPhoneme === "P" ? "plosive"
          : input.currentPhoneme === "B" ? "voiced"
          : input.currentPhoneme === "M" ? "nasal"
          : "none";
    } else if ((this.smoothed.mouthClose ?? 0) < 0.05) {
      // Forget the timing only once the closure it belongs to has actually decayed
      // out of the OUTPUT. Testing the intent instead was the bug: intent drops to
      // zero on the first frame of silence, so the character was cleared before the
      // release it was meant to shape had even begun, and P, B and M all released
      // identically.
      this.bilabialTiming = "none";
    }
    this.releaseScale =
      this.bilabialTiming === "plosive" ? profile.bilabials.plosiveSharpness
        : this.bilabialTiming === "voiced" ? profile.bilabials.voicedSoftness
        : this.bilabialTiming === "nasal" ? profile.bilabials.nasalHold
        : 1;
    // Pressure still differs by voicing: a plosive builds more than a nasal.
    const pressureShape =
      this.bilabialTiming === "plosive" ? 1.1
        : this.bilabialTiming === "voiced" ? 0.88
        : this.bilabialTiming === "nasal" ? 0.72
        : 1;
    const closureDrive = clamp(closure * strength);
    /**
     * The closure demand the jaw smoother reads, as a smoothstep of the closure drive.
     *
     * Deliberately keyed on the DRIVE rather than on the phoneme family. At the frame
     * where this matters most the current phoneme is still the preceding vowel — the
     * measured trace shows closure intent reaching 0.85 three frames before the seal,
     * while `currentFamily` is still `openVowel` — so a family gate would switch the
     * mechanism on only after the moment it exists to serve. Reading the drive gives
     * the anticipation for free out of the coarticulation the engine already computes,
     * rather than adding a second predictor.
     *
     * Keyed on the closure INTENT, not on `closureDrive`. The drive is an amplitude —
     * it carries `globalStrength` (0.12), the human-accepted overall calm — so it
     * peaks around 0.12 on a full bilabial and reads as "no closure at all" against
     * any absolute threshold. The intent is the normalised demand, which is what this
     * needs. Using the drive was the first implementation and the mechanism silently
     * never fired.
     *
     * The lower edge sits above the closure intent every non-bilabial family reaches:
     * measured peaks are F 0.42, alveolars and sibilants 0.20, velars 0.14,
     * postalveolars 0.12 and vowels 0.00, against 1.00 for a bilabial. So P, B and M
     * are the only phonemes this touches, and no family gate is needed to say so.
     */
    this.jawClosureDemand = smoothstep(0.5, 0.95, closure);

    if (closureDrive > 0.02) {
      setIfSupported(pose, supported, clampedList, "mouthClose", closureDrive, limits.mouthClose);
      const press = closureDrive * profile.bilabials.pressureSupport * pressure * pressureShape;
      setIfSupported(pose, supported, clampedList, "mouthPressLeft", press * leftBias, limits.pressure);
      setIfSupported(pose, supported, clampedList, "mouthPressRight", press * rightBias, limits.pressure);
      // Upper lip participates in closure, but only through mouthShrugUpper, whose
      // motion is mostly forward (meanDZ 1.8e-3) rather than up (meanDY 8.8e-4) —
      // a seal, not a lift. mouthRollUpper is NOT written: femaleMorphMapping
      // aliases it to mouthShrugUpper * 0.52, so writing both drove one morph twice
      // and the smaller write was discarded by the max-merge anyway.
      const upper = closureDrive * profile.bilabials.upperLipSupport;
      setIfSupported(pose, supported, clampedList, "mouthShrugUpper", upper, limits.upperLip);
      const lower = closureDrive * profile.bilabials.lowerLipSupport;
      setIfSupported(pose, supported, clampedList, "mouthRollLower", lower * 0.8, limits.lowerLip);
      setIfSupported(pose, supported, clampedList, "mouthShrugLower", lower, limits.lowerLip);
      // Cheek compression scales with how emphatic the phrase is. A quiet "map"
      // barely moves them; an emphatic one shows real compression. This targets the
      // cheeks where they read rather than raising them everywhere.
      // Gated on the bilabial family. Alveolars carry a closure intent of 0.2,
      // which was enough to trip this branch and leak cheek onto S and T.
      const emphasis = 0.75 + 0.5 * clamp(input.speechEnergy);
      const compress = currentFamily === "bilabial"
        ? closureDrive * profile.bilabials.cheekCompression * emphasis
        : 0;
      setIfSupported(pose, supported, clampedList, "cheekSquintLeft", compress * leftBias, limits.cheek);
      setIfSupported(pose, supported, clampedList, "cheekSquintRight", compress * rightBias, limits.cheek);
    }

    // ---- labiodental F/V: lower lip to upper teeth, jaw stays out of it ------
    if (currentFamily === "labiodental" || intent.pressureIntent > 0.4) {
      const fv = clamp(pressure * strength) * (currentFamily === "labiodental" ? 1 : 0.4);
      const sharper = input.currentPhoneme === "F" ? 1.15 : input.currentPhoneme === "V" ? 0.85 : 1;
      setIfSupported(pose, supported, clampedList, "mouthRollLower", fv * 0.72 * sharper, limits.lowerLip);
      setIfSupported(pose, supported, clampedList, "mouthShrugLower", fv * 0.5 * sharper, limits.lowerLip);
      setIfSupported(pose, supported, clampedList, "mouthLowerDownLeft", fv * 0.3 * leftBias, limits.lowerLip);
      setIfSupported(pose, supported, clampedList, "mouthLowerDownRight", fv * 0.3 * rightBias, limits.lowerLip);
      // Upper lip stays relatively stable for F/V; only a small stabilising set.
      setIfSupported(pose, supported, clampedList, "mouthShrugUpper", fv * 0.1, limits.upperLip);
    }

    // ---- open vowels: jaw SUPPORTS, lips lead -------------------------------
    // The authored phoneme pose carries the vowel's identity (AA, AH and AE differ
    // in authored jaw and lower-lip travel). A flat family-constant support would
    // overwrite that and collapse all three onto one shape, so every support here
    // is scaled by the phoneme's OWN magnitude and the jaw is never overwritten —
    // it keeps its authored value and is only capped.
    if (opening > 0.05) {
      const open = clamp(opening * strength);
      const authoredJaw = input.phonemePose.jawOpen ?? 0;
      // 1.0 at the profile's strongest authored open vowel, less for weaker ones.
      const magnitude = clamp(authoredJaw / 0.5, 0.35, 1.2);
      const shaped = open * magnitude;
      const upper = shaped * profile.vowels.openJawSupport * profile.vowels.upperLipSupport * 2;
      setIfSupported(pose, supported, clampedList, "mouthUpperUpLeft", upper * leftBias, limits.upperLip);
      setIfSupported(pose, supported, clampedList, "mouthUpperUpRight", upper * rightBias, limits.upperLip);
      const lower = shaped * profile.vowels.lowerLipSupport;
      setIfSupported(pose, supported, clampedList, "mouthLowerDownLeft", lower * leftBias, limits.lowerLip);
      setIfSupported(pose, supported, clampedList, "mouthLowerDownRight", lower * rightBias, limits.lowerLip);
    }

    // ---- rounded vowels and postalveolar/rhotic rounding --------------------
    if (rounding > 0.04) {
      const round = clamp(rounding * strength);
      const familyGain =
        currentFamily === "postalveolar" ? profile.consonants.postalveolarRounding
          : currentFamily === "rhotic" ? profile.consonants.rhoticRounding
          : 1;
      setIfSupported(pose, supported, clampedList, "mouthFunnel", round * profile.roundedSpeech.funnelSupport * familyGain, limits.funnel);
      setIfSupported(pose, supported, clampedList, "mouthPucker", round * profile.roundedSpeech.puckerSupport * familyGain, limits.pucker);
      setIfSupported(pose, supported, clampedList, "jawOpen", round * profile.roundedSpeech.jawSupport, limits.jawOpen);
      // Gated on the family, not just on rounding intent: an open vowel with a
      // trace of authored funnel produced a non-zero rounding intent and leaked a
      // few thousandths of cheek onto AA, S and T. Cheeks belong to genuinely
      // rounded articulations only.
      const roundedFamily = currentFamily === "roundedVowel" || currentFamily === "postalveolar";
      const cheek = roundedFamily
        ? round * profile.roundedSpeech.cheekSupport * (0.75 + 0.5 * clamp(input.speechEnergy))
        : 0;
      setIfSupported(pose, supported, clampedList, "cheekSquintLeft", cheek * leftBias, limits.cheek);
      setIfSupported(pose, supported, clampedList, "cheekSquintRight", cheek * rightBias, limits.cheek);
      // Rounding narrows the mouth: corners must be pulled DOWN, not added to.
      const narrow = 1 - clamp(round * profile.roundedSpeech.cornerNarrowing);
      if (pose.mouthSmileLeft) pose.mouthSmileLeft *= narrow;
      if (pose.mouthSmileRight) pose.mouthSmileRight *= narrow;
    }

    // ---- spread vowels: modest corners, never a smile -----------------------
    if (spreading > 0.05) {
      const spread = clamp(spreading * strength);
      const corner = Math.min(spread * profile.spreadSpeech.cornerSupport, profile.spreadSpeech.maximumStretch);
      setIfSupported(pose, supported, clampedList, "mouthSmileLeft", corner * leftBias, limits.mouthCorner);
      setIfSupported(pose, supported, clampedList, "mouthSmileRight", corner * rightBias, limits.mouthCorner);
      setIfSupported(pose, supported, clampedList, "jawOpen", spread * profile.spreadSpeech.jawSupport, limits.jawOpen);
      const cheek = spread * profile.spreadSpeech.cheekSupport;
      setIfSupported(pose, supported, clampedList, "cheekSquintLeft", cheek * leftBias, limits.cheek);
      setIfSupported(pose, supported, clampedList, "cheekSquintRight", cheek * rightBias, limits.cheek);
    }

    // ---- consonant lower-face tension --------------------------------------
    if (tension > 0.1) {
      const tense = clamp(tension * strength) * profile.consonants.tensionSupport;
      setIfSupported(pose, supported, clampedList, "noseSneerLeft", tense * leftBias, limits.cheek);
      setIfSupported(pose, supported, clampedList, "noseSneerRight", tense * rightBias, limits.cheek);
      const jawGain =
        currentFamily === "alveolar" ? profile.consonants.alveolarJaw
          : currentFamily === "velar" ? profile.consonants.velarJaw
          : 0;
      if (jawGain > 0) setIfSupported(pose, supported, clampedList, "jawOpen", tense * jawGain, limits.jawOpen);
    }

    // ---- per-side travel balance -------------------------------------------
    // Equal influence on a left/right morph pair does not mean equal movement: on
    // this asset mouthPressRight moves 1.53x the tissue of mouthPressLeft, and
    // noseSneerRight 2.11x its partner. That structural lean is present on every
    // bilabial regardless of what the asymmetry system does, and it is what reads
    // as one corner being pulled on its own. Applied to whatever is in the pose —
    // authored phoneme values included, since those are lopsided on this rig too —
    // and before every downstream cap, so what those caps bind is already balanced.
    for (const [base, balance] of Object.entries(profile.sideBalance)) {
      for (const [side, factor] of [["Left", balance.left], ["Right", balance.right]] as const) {
        const name = `${base}${side}`;
        const value = pose[name];
        if (value === undefined || factor === 1) continue;
        pose[name] = clamp(value * factor);
      }
    }

    // ---- jaw hierarchy: the jaw supports, it never leads ---------------------
    // Applied last so no earlier rule can push the jaw past the closure ceiling.
    if (closureDrive > 0.15) {
      const ceiling = profile.bilabials.jawMaximum * (1 - closureDrive) + profile.bilabials.jawMaximum;
      if ((pose.jawOpen ?? 0) > ceiling) {
        pose.jawOpen = ceiling;
        clampedList.push("jawOpen");
      }
    }
    if ((pose.jawOpen ?? 0) > limits.jawOpen) {
      pose.jawOpen = limits.jawOpen;
      clampedList.push("jawOpen");
    }

    // ---- lower lip shapes the opening, it does not double it ----------------
    // On an open vowel the JAW creates the aperture. If the lower lip travels
    // further than the jaw it reads as a second, competing opening rather than as
    // tissue following the jaw. Enforced as a relationship rather than trusted to
    // a tuning value, so a later compensation change cannot silently break it.
    if (opening > 0.2) {
      const jawValue = pose.jawOpen ?? 0;
      for (const name of ["mouthLowerDownLeft", "mouthLowerDownRight", "mouthShrugLower"]) {
        if ((pose[name] ?? 0) > jawValue) {
          pose[name] = jawValue;
          clampedList.push(name);
        }
      }
    }

    // ---- consonant upper-lip ceiling ---------------------------------------
    // Applied after every rule so nothing upstream can exceed it. Vowels are exempt:
    // an open vowel showing teeth is correct, a consonant doing so is not.
    const vowelFamily =
      currentFamily === "openVowel" || currentFamily === "roundedVowel" || currentFamily === "spreadVowel";
    if (!vowelFamily && opening < 0.45) {
      // The ceiling scales with effective strength. Authored phoneme-pose values
      // (F, V and L carry mouthUpperUp* of 0.22 / 0.18 / 0.08) pass through this
      // layer UNSCALED, while coordinated supports are scaled by globalStrength.
      // An absolute ceiling therefore stopped binding the moment the accepted
      // global value dropped to 0.12, leaving consonants at 0.14 while open vowels
      // sat at 0.021 — the exact inversion of the intent. Scaling it keeps the cap
      // meaningful at any accepted global value.
      const ceiling = profile.consonants.upperLipCeiling * strength;
      for (const name of ["mouthShrugUpper", "mouthUpperUpLeft", "mouthUpperUpRight", "mouthRollUpper"]) {
        if ((pose[name] ?? 0) > ceiling) {
          pose[name] = ceiling;
          clampedList.push(name);
        }
      }
    }

    // ---- corner neutrality --------------------------------------------------
    // Speech must finish speech-neutral, never in a pleasant expression. Corner
    // width is only ever legitimate while a spread articulation is actually being
    // produced, so it is gated on live spreading intent rather than allowed to
    // decay from whatever the last vowel left behind.
    if (spreading <= 0.05) {
      if (pose.mouthSmileLeft !== undefined) pose.mouthSmileLeft = 0;
      if (pose.mouthSmileRight !== undefined) pose.mouthSmileRight = 0;
    }

    // ---- silence: everything the layer owns returns to neutral --------------
    if (!input.isSpeaking) {
      for (const name of profile.supportedChannels) pose[name] = 0;
    }

    // ---- per-channel compensation ------------------------------------------
    // Applied after globalStrength and before damping, so it rebalances channels
    // against each other without altering the accepted overall calm. Every result
    // is still bounded by the same per-channel limit, so compensation can restore
    // presence but can never exceed what the profile already permits.
    const comp = profile.compensation;
    const compensate = (name: string, factor: number, limit: number) => {
      const value = pose[name];
      if (value === undefined || factor === 1) return;
      pose[name] = Math.min(clamp(value * factor), limit);
    };
    compensate("jawOpen", comp.jaw, limits.jawOpen);
    for (const name of ["mouthShrugUpper", "mouthUpperUpLeft", "mouthUpperUpRight"]) {
      compensate(name, comp.upperLip, limits.upperLip);
    }
    for (const name of ["mouthRollLower", "mouthShrugLower", "mouthLowerDownLeft", "mouthLowerDownRight"]) {
      compensate(name, comp.lowerLip, limits.lowerLip);
    }
    compensate("mouthPressLeft", comp.pressure, limits.pressure);
    compensate("mouthPressRight", comp.pressure, limits.pressure);
    compensate("mouthSmileLeft", comp.corners, limits.mouthCorner);
    compensate("mouthSmileRight", comp.corners, limits.mouthCorner);
    for (const name of ["cheekSquintLeft", "cheekSquintRight"]) compensate(name, comp.cheek, limits.cheek);

    /**
     * ---- phrase-level warmth (§P14) ---------------------------------------
     *
     * Placed here, after compensation and before damping, for reasons that are
     * measurements rather than preferences. Three scalars sit upstream and all
     * three are the WRONG constraint for this contribution:
     *
     *   - `globalStrength` is 0.12, the human-accepted calm level for coordinated
     *     SPEECH SUPPORTS. Warmth is not a speech support; its amplitude was
     *     already calibrated by the behaviour layer's own `speechGain` and idle
     *     safety scale. Applied upstream, a requested 0.337 arrived as 0.040.
     *   - `compensation.cheek` is 3.2, a rendered-travel correction between
     *     articulation channels, and it is bounded by `limits.cheek`.
     *   - `limits.cheek` (0.16) and `limits.mouthCorner` (0.22) bound how much
     *     cheek and corner the ARTICULATION may use so speech never reads as a
     *     held smile. A scheduled expression with its own onset, release and
     *     spacing floor is exactly the thing that rule is not about — the idle
     *     path already puts 0.68 on `cheekSquint` on the same asset.
     *
     * So warmth carries its own ceilings and nothing else. What it does NOT get
     * to bypass:
     *
     *   - It is written by this controller, the single owner, not by the
     *     behaviour layer. Ownership is unchanged.
     *   - `Math.max`, never `+=`: warmth may raise a channel the articulation is
     *     holding low, but can never push an articulated shape past what the
     *     articulation asked for.
     *   - It runs BEFORE damping, so it inherits the corner and cheek attack and
     *     release rates and cannot step.
     *   - Rounding and bilabial closure suppress it, because a rounded or sealed
     *     mouth physically cannot hold a wide corner. That is what protects the
     *     P/B/M seal and keeps rounded vowels rounded.
     *
     * Exempt from corner neutrality above, deliberately: that rule exists so a
     * smile cannot be LEFT BEHIND by the last vowel. Warmth is not a leftover.
     */
    const warmthConfig = profile.warmth;
    const requestedWarmth = input.expressionWarmth;
    if (warmthConfig && requestedWarmth && (warmthConfig.cornerCeiling > 0 || warmthConfig.cheekCeiling > 0)) {
      /**
       * The closure suppressor is the BILABIAL SHARE, not the raw closure intent.
       *
       * A first cut used `closure` and warmth almost never reached the face:
       * `closureIntent` is high across most consonants, not just P/B/M, so
       * multiplying by it suppressed warmth nearly everywhere. This is the same
       * distinction §12 already had to draw for the jaw damper's closure gate.
       */
      const bilabial = clamp(closure * input.transitionIntent.bilabialIntent);
      const suppression =
        clamp(1 - rounding * warmthConfig.roundingSuppression) * clamp(1 - bilabial * warmthConfig.closureSuppression);
      const cornerAmount = Math.min(requestedWarmth.smile, warmthConfig.cornerCeiling) * suppression;
      const cheekAmount = Math.min(requestedWarmth.cheek, warmthConfig.cheekCeiling) * suppression;
      const raise = (name: string, amount: number, ceiling: number) => {
        if (!supported.has(name) || amount <= 0) return;
        const next = Math.min(clamp(Math.max(pose[name] ?? 0, amount)), ceiling);
        if (next > (pose[name] ?? 0)) pose[name] = next;
      };
      raise("mouthSmileLeft", cornerAmount * leftBias, warmthConfig.cornerCeiling);
      raise("mouthSmileRight", cornerAmount * rightBias, warmthConfig.cornerCeiling);
      raise("cheekSquintLeft", cheekAmount * leftBias, warmthConfig.cheekCeiling);
      raise("cheekSquintRight", cheekAmount * rightBias, warmthConfig.cheekCeiling);
      /**
       * FINAL CONVERGENCE lower-face support, merged here for the same reason
       * the corner and cheek are: these are owned channels, so a conducted
       * request has to arrive as a request. It inherits the identical
       * suppression — a sealed or rounded mouth cannot hold a lifted lip either
       * — and the identical `raise` semantics, so it can never reduce what the
       * articulation asked for or step past a ceiling.
       */
      const lowerCeiling = warmthConfig.lowerFaceCeiling ?? 0;
      if (lowerCeiling > 0) {
        const lowerAmount = Math.min(requestedWarmth.lowerFace ?? 0, lowerCeiling) * suppression;
        raise("mouthUpperUpLeft", lowerAmount * leftBias, lowerCeiling);
        raise("mouthUpperUpRight", lowerAmount * rightBias, lowerCeiling);
        // The nasolabial reads strongly on this asset; kept behind the lip lift
        // so support cannot resolve into a sneer.
        raise("noseSneerLeft", lowerAmount * 0.7 * leftBias, lowerCeiling);
        raise("noseSneerRight", lowerAmount * 0.7 * rightBias, lowerCeiling);
      }
      this.debug.warmthApplied = Math.max(cornerAmount, cheekAmount);
      this.debug.warmthRequested = Math.max(requestedWarmth.smile, requestedWarmth.cheek);
      this.debug.warmthSuppression = suppression;
    } else {
      this.debug.warmthApplied = 0;
      this.debug.warmthRequested = requestedWarmth ? Math.max(requestedWarmth.smile, requestedWarmth.cheek) : 0;
      this.debug.warmthSuppression = 1;
    }

    // ---- single owned smoothing stage, phase aware --------------------------
    for (const name of profile.supportedChannels) {
      const damped = this.damp(name, pose[name] ?? 0, input.deltaSeconds, profile);
      if (damped > 0.0001) pose[name] = clamp(damped);
      else delete pose[name];
    }

    // ---- jaw couplings, enforced on the DAMPED output ------------------------
    // Two defects share this fix.
    //
    // 1. The pre-compensation version of the lower-lip rule (above) is necessary but
    //    not sufficient, and its comment was wrong to claim that expressing a
    //    relationship rather than a tuning value meant "a later compensation change
    //    cannot silently break it". Compensation runs after it and does exactly
    //    that: jaw x0.45 against lower lip x1.15 inverts the relationship by 2.56x.
    //    Measured before this fix, the lower lip peaked at 0.325 influence against a
    //    jaw of 0.020 on labiodentals, and 0.162 against 0.140 on open vowels.
    //
    // 2. The upper lip had no such rule at all on vowels. The consonant ceiling
    //    exempts them ("an open vowel showing teeth is correct"), which is right,
    //    but it left teeth exposure governed by nothing that knows how far the jaw
    //    actually opened — the mechanism behind the review's "teeth flash": the lips
    //    part over a jaw that has barely moved.
    //
    // Enforced after damping rather than on the targets because the smoother
    // is itself a source of the same inversion: upperLipAttack 30 against jawAttack
    // 19 means the upper lip reaches its target 1.6x faster than the jaw reaches
    // its, so equal targets still render lips-before-aperture. The damped state is
    // written back so the smoother resumes from the capped value instead of
    // continuing to integrate above it.
    // Both gates below are RAMPED rather than switched. The couplings themselves are
    // unchanged — the ceiling is still `dampedJaw x coupling` and the damped state is
    // still written back so the smoother resumes from the capped value. What changed
    // is that a channel is now pulled toward its ceiling in proportion to how far the
    // gate is open, so crossing the gate is a slope instead of a step.
    //
    // Why this mattered more than the smoothing rates: a binary gate on a continuous
    // signal produces a discontinuity no attack rate can absorb, and the write-back
    // makes that discontinuity the smoother's new state. The five worst single-frame
    // steps in the lower face were all capped channels, and none of the uncapped ones
    // came close. See docs/FEMALE_REALISM_REMEDIATION.md §11.
    const coupling = profile.jawCoupling;
    const cap = (names: string[], ceiling: number, gate: number) => {
      if (gate <= 0) return;
      for (const name of names) {
        const value = pose[name] ?? 0;
        if (value <= ceiling) continue;
        const next = value + (ceiling - value) * gate;
        pose[name] = next;
        this.smoothed[name] = next;
        clampedList.push(name);
      }
    };
    const dampedJaw = pose.jawOpen ?? 0;
    // Ramped over the band just above the old hard threshold of 0.2, so the coupling
    // reaches full authority by the time the mouth is genuinely opening.
    cap(
      ["mouthLowerDownLeft", "mouthLowerDownRight", "mouthShrugLower"],
      dampedJaw * coupling.lowerLip,
      smoothstep(0.2, 0.38, opening)
    );
    // Vowel membership eases OUT but never eases IN.
    //
    // §7's invariant is that on a vowel the upper lip may not out-travel the jaw —
    // that is the whole teeth-flash fix, and `coordinatedSpeechDeformation.test.ts`
    // asserts it frame by frame. Easing the gate in violated it: for the two or three
    // frames the ramp was climbing, the upper lip sat up to 34% above the ceiling.
    // Smoothness is not worth weakening a correctness rule, so entry is instant and
    // only the release is ramped. That still removes half the discontinuity, because
    // leaving a vowel is the edge where the cap lets go and the lip springs back.
    this.vowelWeight = vowelFamily
      ? 1
      : lerp(this.vowelWeight, 0, exponentialSmoothingAlpha(profile.smoothing.upperLipRelease, input.deltaSeconds));
    cap(
      ["mouthUpperUpLeft", "mouthUpperUpRight", "mouthShrugUpper", "mouthRollUpper"],
      dampedJaw * coupling.upperLip,
      this.vowelWeight
    );

    const upperLip = Math.max(pose.mouthShrugUpper ?? 0, pose.mouthUpperUpLeft ?? 0, pose.mouthUpperUpRight ?? 0, pose.mouthRollUpper ?? 0);
    const lowerLip = Math.max(pose.mouthShrugLower ?? 0, pose.mouthLowerDownLeft ?? 0, pose.mouthLowerDownRight ?? 0, pose.mouthRollLower ?? 0);
    const corners = Math.max(pose.mouthSmileLeft ?? 0, pose.mouthSmileRight ?? 0);
    const cheeks = Math.max(pose.cheekSquintLeft ?? 0, pose.cheekSquintRight ?? 0);

    this.debug.transitionType = intent.transitionType;
    this.debug.closureIntent = closure;
    this.debug.openingIntent = opening;
    this.debug.roundingIntent = rounding;
    this.debug.spreadingIntent = spreading;
    this.debug.pressureIntent = pressure;
    this.debug.tensionIntent = tension;
    this.debug.bilabialIntent = intent.bilabialIntent;
    this.debug.cheekIntent = cheeks;
    this.debug.upperLipContribution = upperLip;
    this.debug.lowerLipContribution = lowerLip;
    this.debug.pressureContribution = Math.max(pose.mouthPressLeft ?? 0, pose.mouthPressRight ?? 0);
    this.debug.jawSupport = pose.jawOpen ?? 0;
    this.debug.cornerSupport = corners;
    this.debug.cheekSupport = cheeks;
    this.debug.bilabialTiming = this.bilabialTiming;
    this.debug.releaseScale = this.releaseScale;
    this.debug.jawClosureDemand = this.jawClosureDemand;
    this.debug.overlap = overlap;
    this.debug.effectiveStrength = strength;
    // Traced, not assumed: BoneController caches only head and neck, and the
    // lower-face bone prototype is off by default, so in production nothing
    // rotates a jaw bone and speech jaw is entirely the JawOpen morph. This
    // layer never writes a bone in any mode.
    this.debug.jawOwner = "morph";
    // Reports which stage of the layered release is still holding a value. The
    // order mirrors the profile's descending release speeds.
    this.debug.releasePhase = input.isSpeaking
      ? "none"
      : this.debug.pressureContribution > 0.01 ? "pressure"
        : upperLip > 0.01 ? "upper-lip"
        : corners > 0.01 ? "corners"
        : (pose.jawOpen ?? 0) > 0.01 ? "jaw"
        : cheeks > 0.01 ? "cheeks"
        : "settled";
    this.debug.asymmetrySide = this.asymmetrySide;
    this.debug.asymmetryAmount = this.asymmetryAmount;
    this.debug.clampedChannels = clampedList;
    this.debug.jawValue = pose.jawOpen ?? 0;
    this.debug.upperLip = upperLip;
    this.debug.lowerLip = lowerLip;
    this.debug.corners = corners;
    this.debug.cheeks = cheeks;

    return { pose, debug: this.debug };
  }
}

export type { PhonemeFamily };

/**
 * Development-panel settings.
 *
 * Production runs with the defaults; every override here exists so a human can
 * isolate one part of the coordination while judging it in the browser.
 */
export interface SpeechDeformationSettings {
  enabled: boolean;
  mode: SpeechDeformationMode;
  strength: number;
  seed: number;
  /** Per-group multipliers, applied on top of the profile. 1 = profile value. */
  upperLipSupport: number;
  lowerLipSupport: number;
  jawSupport: number;
  cheekSupport: number;
  cornerAsymmetry: number;
  /** Damping overrides; 1 = profile value. */
  lipAttack: number;
  lipRelease: number;
  jawAttack: number;
  jawRelease: number;
  /**
   * Absolute override for the demand-adaptive jaw opening response (§P13), NOT a
   * multiplier — the profile ships it at 0 and a multiplier could never leave 0.
   * `null` uses the profile value.
   */
  jawOpeningResponse: number | null;
  /**
   * Multiplier on the §P14 warmth ceilings. 1 is production; 0 restores the
   * P13 speaking face exactly, which is what makes the panel's A/B honest.
   */
  warmthScale: number;
  cheekAttack: number;
  cheekRelease: number;
  /** Visual-isolation toggles. All default true; debug only. */
  cheekEnabled: boolean;
  upperLipEnabled: boolean;
  lowerLipEnabled: boolean;
  jawEnabled: boolean;
  overlapEnabled: boolean;
  asymmetryEnabled: boolean;
  /** Holds the last evaluated pose, for inspecting a single frame. */
  freezeFrame: boolean;
  /** Debug-only phoneme override; null uses the payload. */
  forcedPhoneme: string | null;
}

export const defaultSpeechDeformationSettings: SpeechDeformationSettings = {
  enabled: true,
  mode: "coordinated",
  strength: 1,
  warmthScale: 1,
  seed: 1,
  upperLipSupport: 1,
  lowerLipSupport: 1,
  jawSupport: 1,
  cheekSupport: 1,
  cornerAsymmetry: 1,
  lipAttack: 1,
  lipRelease: 1,
  jawAttack: 1,
  jawRelease: 1,
  jawOpeningResponse: null,
  cheekAttack: 1,
  cheekRelease: 1,
  cheekEnabled: true,
  upperLipEnabled: true,
  lowerLipEnabled: true,
  jawEnabled: true,
  overlapEnabled: true,
  asymmetryEnabled: true,
  freezeFrame: false,
  forcedPhoneme: null
};

/**
 * Applies dev-panel multipliers to a profile.
 *
 * Returns the profile unchanged when every multiplier is 1, so production never
 * pays for an object clone and the shipped values are provably in effect.
 */
export const applySpeechDeformationSettings = (
  profile: SpeechDeformationProfile,
  settings: SpeechDeformationSettings
): SpeechDeformationProfile => {
  const allToggled =
    settings.cheekEnabled && settings.upperLipEnabled && settings.lowerLipEnabled &&
    settings.jawEnabled && settings.overlapEnabled && settings.asymmetryEnabled;
  const unchanged =
    settings.upperLipSupport === 1 && settings.lowerLipSupport === 1 && settings.jawSupport === 1 &&
    settings.cheekSupport === 1 && settings.cornerAsymmetry === 1 && settings.lipAttack === 1 &&
    settings.lipRelease === 1 && settings.jawAttack === 1 && settings.jawRelease === 1 &&
    (settings.jawOpeningResponse === null || settings.jawOpeningResponse === undefined) &&
    settings.warmthScale === 1 &&
    settings.cheekAttack === 1 && settings.cheekRelease === 1 && allToggled;
  if (unchanged && settings.enabled) return profile;
  if (!settings.enabled) return { ...profile, enabled: false };
  // Isolation toggles zero a channel's COMPENSATION and limit rather than adding a
  // new write path, so no additional final morph writer is introduced.
  const off = (enabled: boolean, value: number) => (enabled ? value : 0);
  return {
    ...profile,
    /**
     * One scalar for the whole warmth mechanism (§P14), so the dev panel has a
     * single A/B lever rather than two sliders. 0 restores the P13 speaking
     * face exactly; 1 is production.
     */
    warmth: profile.warmth
      ? {
          ...profile.warmth,
          cornerCeiling: profile.warmth.cornerCeiling * settings.warmthScale,
          cheekCeiling: profile.warmth.cheekCeiling * settings.warmthScale
        }
      : profile.warmth,
    compensation: {
      ...profile.compensation,
      cheek: off(settings.cheekEnabled, profile.compensation.cheek),
      upperLip: off(settings.upperLipEnabled, profile.compensation.upperLip),
      lowerLip: off(settings.lowerLipEnabled, profile.compensation.lowerLip),
      jaw: off(settings.jawEnabled, profile.compensation.jaw)
    },
    overlapEnabled: settings.overlapEnabled,
    limits: {
      ...profile.limits,
      upperLip: profile.limits.upperLip * settings.upperLipSupport,
      lowerLip: profile.limits.lowerLip * settings.lowerLipSupport,
      jawOpen: profile.limits.jawOpen * settings.jawSupport,
      cheek: profile.limits.cheek * settings.cheekSupport
    },
    asymmetry: settings.asymmetryEnabled
      ? {
          ...profile.asymmetry,
          ordinaryMaximum: profile.asymmetry.ordinaryMaximum * settings.cornerAsymmetry,
          expressiveMaximum: profile.asymmetry.expressiveMaximum * settings.cornerAsymmetry
        }
      : { ...profile.asymmetry, ordinaryMinimum: 0, ordinaryMaximum: 0, expressiveMaximum: 0 },
    smoothing: {
      ...profile.smoothing,
      lipAttack: profile.smoothing.lipAttack * settings.lipAttack,
      lipRelease: profile.smoothing.lipRelease * settings.lipRelease,
      jawAttack: profile.smoothing.jawAttack * settings.jawAttack,
      jawRelease: profile.smoothing.jawRelease * settings.jawRelease,
      jawOpeningResponse: settings.jawOpeningResponse ?? profile.smoothing.jawOpeningResponse,
      cheekAttack: profile.smoothing.cheekAttack * settings.cheekAttack,
      cheekRelease: profile.smoothing.cheekRelease * settings.cheekRelease
    }
  };
};
