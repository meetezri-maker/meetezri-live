import { minifaceMalePhonemeProfile } from "./minifaceMalePhonemeProfile";
import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * HYPER3D VOWEL DIFFERENTIATION.
 *
 * THE MEASUREMENT. Running the production payload through every vowel and taking
 * the median of each occurrence's peak COMPOSED + CALIBRATED output, five vowels
 * resolved to one pose. Euclidean distance over
 * {jaw, funnel, pucker, stretch, roll, close, lowerDown, upperUp, press, smile}:
 *
 *     EY-IH  0.038      <- the same pose to three decimal places
 *     EH-EY  0.106      EH-IH  0.109
 *     AY-EY  0.122      AY-EH  0.122      AY-IH  0.136
 *     AH-AY  0.130      AH-EH  0.145
 *     AW-AY  0.140      <- a ROUNDED vowel nearer an unrounded one than its own family
 *
 * The whole front/mid family {AH, AY, EH, EY, IH} sat at jaw 0.10-0.21 with
 * stretch 0.10-0.19, and the rounded family was incoherent: UW measured pucker
 * 0.487 but OW only 0.272, AO 0.150 and AW 0.080 — AW read as neither round nor
 * open. The reference frames, by contrast, hold a very large contrast: the open
 * frames are wide with both teeth rows visible, and the rounded frames (9.50 s,
 * 11.50 s) are a small protruded oval with the corners drawn right in.
 *
 * THE CORRECTION. Vowel poses only, on three axes that the calibration measured
 * as strong on this asset:
 *
 *   APERTURE  `jawOpen`   35.19 mm travel. Ladder AA > AE > AO > AW > AY > AH >
 *                         OY > EH > OW > EY/ER > UH > IH > IY > UW.
 *   ROUNDING  `mouthPucker` protrudes 11.2 mm while changing the lip gap by
 *                         0.1 mm — the clean rounder — led by pucker with
 *                         `mouthFunnel` (gain 0.5, an OPENER on this asset) as a
 *                         secondary.
 *   SPREAD    `mouthStretch` 10.39 mm. Ladder IY > EY > AE > EH > IH.
 *
 * Each vowel is separated from its nearest neighbour on at least two axes, so no
 * pair can collapse again by one channel being clamped.
 *
 * WHAT IS NOT TOUCHED, by construction rather than by convention: this table
 * contains VOWELS ONLY. Every consonant — and therefore every P, B and M — is
 * spread from `minifaceMalePhonemeProfile` unchanged, so bilabial closure,
 * release and the seal above it are literally the same objects. No global jaw
 * multiplier is introduced and no open-vowel gain: the rejected 1.25x experiment
 * stays deleted, and each of these is a per-phoneme demand.
 *
 * The `miniface-male` avatar keeps its own reviewed table untouched — this is a
 * third entry in `getPhonemeProfile`'s existing per-model switch, the same
 * mechanism `femalePhonemeProfile` already uses.
 */

/** Vowel pose overrides. Everything absent here keeps the male table's value. */
const VOWEL_POSES: Record<string, BlendshapePose> = {
  // ---- open ---------------------------------------------------------------
  // The widest aperture in the language, and the reference's widest frames show
  // both teeth rows. `mouthUpperUp` lifts the upper lip 7.53 mm to reveal them.
  AA: { jawOpen: 0.56, mouthLowerDownLeft: 0.2, mouthLowerDownRight: 0.2, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1, mouthFunnel: 0.02 },
  // Open AND spread — the axis that separates it from AA.
  AE: { jawOpen: 0.48, mouthStretchLeft: 0.3, mouthStretchRight: 0.3, mouthLowerDownLeft: 0.16, mouthLowerDownRight: 0.16, mouthUpperUpLeft: 0.07, mouthUpperUpRight: 0.07 },
  // The most frequent vowel on the clip (34 occurrences). Pulled DOWN from 0.34
  // so AA and AE stand clearly above it instead of the three sharing a band.
  AH: { jawOpen: 0.3, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },

  // ---- open + rounded -----------------------------------------------------
  // Was the weakest of the rounded family at composed pucker 0.150. Open jaw and
  // real rounding together, which is what /ɔ/ is.
  AO: { jawOpen: 0.44, mouthFunnel: 0.34, mouthPucker: 0.34, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
  // /aʊ/ — opens then rounds. At composed pucker 0.080 it read as neither, and
  // measured closer to AY than to OW.
  AW: { jawOpen: 0.42, mouthFunnel: 0.26, mouthPucker: 0.26 },
  // /ɔɪ/ — rounded onset, front offglide. Its stretch is removed: a rounded
  // vowel with lateral spread is what blurred it toward the front family.
  OY: { jawOpen: 0.3, mouthFunnel: 0.3, mouthPucker: 0.38 },

  // ---- front / spread -----------------------------------------------------
  // /aɪ/ — an OPEN onset gliding front. After the first pass it was still the
  // closest pair in the inventory (AY-EH 0.093), differing on jaw alone. Now it
  // is further open AND less spread, so it separates from EH in both directions.
  AY: { jawOpen: 0.46, mouthStretchLeft: 0.16, mouthStretchRight: 0.16, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12 },
  EH: { jawOpen: 0.26, mouthStretchLeft: 0.24, mouthStretchRight: 0.24, mouthLowerDownLeft: 0.08, mouthLowerDownRight: 0.08 },
  // EY and IH were the closest pair in the whole inventory (0.038). They now
  // differ on jaw AND stretch, in opposite directions.
  EY: { jawOpen: 0.2, mouthStretchLeft: 0.34, mouthStretchRight: 0.34, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 },
  IH: { jawOpen: 0.15, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  // The narrowest aperture and the widest spread — the far end of both ladders.
  IY: { jawOpen: 0.11, mouthStretchLeft: 0.5, mouthStretchRight: 0.5, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 },

  // ---- rounded ------------------------------------------------------------
  ER: { jawOpen: 0.2, mouthPucker: 0.22, mouthFunnel: 0.16, mouthShrugUpper: 0.06 },
  OW: { jawOpen: 0.24, mouthFunnel: 0.4, mouthPucker: 0.5 },
  UH: { jawOpen: 0.18, mouthPucker: 0.34, mouthFunnel: 0.22 },
  // Already the strongest rounder and the reference's tightest shape; nudged so
  // the top of the ladder stays clearly above OW.
  UW: { jawOpen: 0.1, mouthPucker: 0.66, mouthFunnel: 0.4 }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AFFRICATES — THE "change" REGRESSION.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE REPORT. The word "change" in `semantic_F_emphatic` does not read as the
 * spoken word.
 *
 * THE MEASUREMENT, through the production coarticulation path on the real MFA
 * alignment (CH 6.620-6.720, EY 6.720-6.920, N 6.920-6.970, JH 6.970-7.100):
 *
 *   phoneme  rendered lip movement over its own window
 *   CH       0.78 mm of protrusion, against 0.88 mm of funnel OPENING
 *   EY       2.95 mm of widening, jaw ~6 mm of lip gap
 *   N        nothing — mouthClose 0.007 and mouthPress 0.039 are both BELOW
 *            their own measured useful minimums (0.03 / 0.08)
 *   JH       0.55 mm of protrusion
 *
 * The word renders as one wide vowel bracketed by sub-millimetre lip movement.
 * That is the defect, and it is not subjective.
 *
 * THE CAUSE, and it is specific rather than a tuning opinion. `mouthFunnel`'s
 * gain is 0.5 on this asset — deliberately halved in `hyper3dCalibration.ts`
 * because funnel OPENS the lips (+18.3 mm at 1.0) instead of rounding them, so
 * "rounding comes from pucker". The vowel pass then re-authored every rounded
 * VOWEL to compensate for that halving:
 *
 *   phoneme   male pucker -> Hyper3D pucker
 *   AW              0.10  ->  0.26      (x2.60)
 *   AO              0.14  ->  0.34      (x2.43)
 *   OY              0.20  ->  0.38      (x1.90)
 *   OW              0.32  ->  0.50      (x1.56)
 *   UH             0.22  ->  0.34      (x1.55)
 *   ER              0.16  ->  0.22      (x1.38)
 *   UW              0.56  ->  0.66      (x1.18)
 *
 * THE AFFRICATES WERE NEVER RE-AUTHORED. `VOWEL_POSES` covers vowels only, so
 * CH and JH kept male-table values that were written against a FULL-GAIN funnel,
 * and they are funnel-led (CH funnel 0.18 against pucker 0.08, a 2.25:1 ratio)
 * on the one asset where funnel is the wrong channel and runs at half strength.
 *
 * THE PROOF THAT IT IS COARTICULATION-SENSITIVE, not merely small. The SAME CH
 * pose renders at:
 *
 *   1.53 mm of protrusion in "chose"   (next phoneme OW, pucker 0.50 — reinforces)
 *   0.78 mm of protrusion in "change"  (next phoneme EY, stretch 0.34 — opposes)
 *
 * Half the articulation, from the same pose, decided by what follows it. That is
 * exactly "CH gets overwhelmed by EY", measured.
 *
 * THE CORRECTION. Only CH and JH, and only their two rounding channels: pucker
 * leads and funnel drops to support, which is the identical reasoning the
 * calibration already applies to U/OO. Jaw, stretch, intensity, attack, release,
 * coarticulation weights, viseme and category are untouched.
 *
 *   CH   pucker 0.08 -> 0.20   funnel 0.18 -> 0.10
 *   JH   pucker 0.06 -> 0.16   funnel 0.15 -> 0.085
 *
 * MEASURED AFTER, on the same real alignments:
 *
 *   word       phoneme   before            after
 *   change     CH        0.78 mm fwd   ->  1.94 mm fwd   (funnel open 0.88 -> 0.49)
 *   change     JH        0.55 mm fwd   ->  1.47 mm fwd   (funnel open 0.69 -> 0.39)
 *   changing   CH        0.78 mm fwd   ->  1.94 mm fwd
 *   changing   JH        0.54 mm fwd   ->  1.45 mm fwd
 *   chose      CH        1.53 mm fwd   ->  1.94 mm fwd
 *   jacket     JH        0.58 mm fwd   ->  1.43 mm fwd
 *
 * The target was chosen against a WORKING REFERENCE rather than picked: "chose"
 * already rendered its CH at 1.53 mm and was accepted in the affricate tuning
 * fixture, so the failing contexts are brought up to that level and no further.
 * A stronger candidate (CH pucker 0.26) was measured at 2.52 mm and rejected —
 * it would have pushed the already-accepted "chose" 65% past where it was signed
 * off, to fix a word that does not need it.
 *
 * WHAT WAS DELIBERATELY NOT CHANGED, and why:
 *
 *   the funnel GAIN     global; every rounded vowel depends on it
 *   N                   a nasal SHOULD be restrained, and N is in most words
 *   EY                  in the accepted vowel table; see the note below
 *   SH, ZH              the identical inherited pattern, but not in this word
 *   P/B/M               untouched, and asserted byte-identical
 *
 * OPEN OBSERVATION, reported rather than fixed. EY holds ONE pose for its whole
 * 200 ms — `mouthStretchLeft` sits at exactly 0.284 for nine consecutive frames
 * — so the diphthong does not visibly transition. Giving /eɪ/ a real onset-to-
 * offglide would be new machinery and a change to the accepted vowel table, so
 * it is measured, recorded, and left for a hardware decision.
 */
export const AFFRICATE_POSES: Record<string, BlendshapePose> = {
  CH: {
    jawOpen: 0.12,
    mouthFunnel: 0.1,
    mouthPucker: 0.2,
    mouthStretchLeft: 0.05,
    mouthStretchRight: 0.05
  },
  JH: { jawOpen: 0.11, mouthFunnel: 0.085, mouthPucker: 0.16 }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONSONANT READABILITY — the three that measured below their own thresholds.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE MEASUREMENT. Every consonant was driven through the production path
 * (`AvatarController.evaluate` -> `calibrateHyper3dPose`) over all 22 aligned
 * payloads, and the peak influence inside each phoneme's own window was taken
 * per occurrence. The number that decides visibility is the phoneme's
 * IDENTIFYING channel — the one that is not jaw and not the generic spread every
 * consonant inherits from coarticulation — against that channel's own
 * `usefulMin` in `hyper3dCalibration.ts`.
 *
 *   phoneme  identifying channel   median peak   usefulMin   verdict
 *   DH       mouthLowerDown        0.069         0.08        BELOW
 *   L        mouthUpperUp          0.035         0.05        BELOW
 *   SH       mouthPucker           0.067         0.04        above, but 0.88 mm
 *   ZH       mouthPucker           0.064         0.04        above, but 0.84 mm
 *   TH       mouthLowerDown        0.106         0.08        above  -> UNTOUCHED
 *   F        mouthLowerDown        0.300         0.08        above  -> UNTOUCHED
 *   V        mouthLowerDown        0.191         0.08        above  -> UNTOUCHED
 *   R        mouthPucker           0.097         0.04        1.27 mm -> UNTOUCHED
 *   W        mouthPucker           0.233         0.04        3.05 mm -> UNTOUCHED
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * S AND Z — THE ONE GENUINE DUPLICATE LEFT IN THE INVENTORY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Over all 22 aligned payloads, the closest pair of DIFFERENT visemes in the
 * whole rendered inventory was `S`-`IH` at 0.0213 — closer than the 0.038 that
 * the accepted vowel pass existed to fix. Their rendered poses:
 *
 *              jawOpen   mouthStretch
 *   S           0.051        0.112
 *   IH          0.066        0.112
 *
 * The same mouth. `S` carries `viseme: "SS"` and `IH` carries `viseme: "EE"` —
 * these are not a voicing pair and not a shared viseme; a sibilant and a vowel
 * are rendering identically.
 *
 * THE CAUSE, measured rather than guessed. `S` asks for a jaw of 0.06 and gets
 * 0.051 — 1.72x its own demand — because it is a 90 ms label sitting between
 * vowels and the neighbours bleed straight through it. Raising its aperture
 * demand cannot help: the aperture is not its own. And its authored teeth-
 * together cue is `mouthClose: 0.12`, which on this asset calibrates to
 * 0.12 x 0.7 x 0.11 = 0.0092 — a THIRD of `mouthClose`'s 0.03 useful minimum,
 * so it renders as literally nothing.
 *
 * THE CORRECTION is on the one axis that is `S`'s own and that its vowel
 * neighbours do not drive: LIP RETRACTION. /s/ is more retracted than /ɪ/, so
 * `mouthStretch` 0.16 -> 0.26 separates them on spread while both keep their
 * near-closed aperture. No channel is added, `mouthClose` is not touched — the
 * seal channel stays the bilabials' — and the aperture is unchanged.
 *
 * `Z` TAKES THE SAME VALUE, 0.13 -> 0.26, NOT A PROPORTIONAL ONE. Scaling both
 * by the same factor was tried first and measured worse in two ways: `Z`'s
 * spread crossed THROUGH `IH` on the way up (Z-IH 0.0408 -> 0.0301, i.e. the
 * change made a distinct pair closer), and the S-Z distance grew from 0.037 to
 * 0.092 — about the size of the R-W difference, an S/Z contrast a real face does
 * not make. /s/ and /z/ are ONE lip posture that differ at the larynx, so they
 * get one spread value; the pair still renders slightly apart (0.034) because
 * `Z` keeps its own lower `defaultIntensity` and aperture.
 *
 * MEASURED OVER THE WHOLE CORPUS at this value: no pair of DIFFERENT visemes is
 * closer than 0.0489 (`R`-`G`) anywhere in the inventory, against the 0.03 floor
 * — so this is the setting at which the inventory has no collapse left, and it
 * was chosen from a sweep rather than picked. 0.30 and above buy nothing further
 * and only widen S against Z.
 *
 * DH and L are literal threshold failures: the channel that carries the sound's
 * identity moves less than the amount this asset was measured to render at all,
 * so the distinction each pose was authored to make does not exist on screen.
 * L's own male-table note says it is "distinct from T through a slightly more
 * open lifted-mouth shape" — that lift is `mouthUpperUp` at 0.08, and it renders
 * at 0.035. The authored distinction is invisible.
 *
 * SH and ZH are the case the affricate pass MEASURED AND DEFERRED in the block
 * above: "the identical inherited pattern, but not in this word". They are
 * funnel-led (SH funnel 0.22 against pucker 0.10) on the one asset where
 * `mouthFunnel` OPENS the lips (+18.3 mm at 1.0) and runs at half gain for that
 * reason. Their protrusion measures 0.88 mm and 0.84 mm, both BELOW the 1.2 mm
 * floor the affricate pass established from the already-accepted "chose" (which
 * rendered 1.53 mm before that correction and 1.94 mm after). They are corrected
 * by the same rule and to the same band, not to a new number.
 *
 * THE CORRECTION, one channel each except the postalveolars, which get the two
 * rounding channels CH/JH already got:
 *
 *   SH   funnel 0.22 -> 0.12   pucker 0.10 -> 0.22
 *   ZH   funnel 0.19 -> 0.105  pucker 0.08 -> 0.18
 *   DH   mouthLowerDown 0.12 -> 0.17
 *   L    mouthUpperUp   0.08 -> 0.14
 *   S    mouthStretch   0.16 -> 0.26
 *   Z    mouthStretch   0.13 -> 0.26
 *
 * Jaw, stretch, jawForward, intensity, attack, release, coarticulation weights,
 * viseme and category are untouched on all four, and no channel is added or
 * removed from any pose.
 *
 * SH/ZH ARE NOW VERY CLOSE TO CH/JH, AND THAT IS CORRECT rather than a new
 * duplicate. All four carry `viseme: "CH"` in the male table this inherits from,
 * because /ʃ ʒ tʃ dʒ/ share one lip posture — the affricates differ from the
 * fricatives by a TONGUE closure that this asset cannot render. Separating them
 * would be inventing a distinction the face does not make. See the duplicate
 * report in `hyper3dFinalLipShapes.test.ts`.
 */
export const CONSONANT_POSES: Record<string, BlendshapePose> = {
  SH: {
    jawOpen: 0.1,
    mouthFunnel: 0.12,
    mouthPucker: 0.22,
    mouthStretchLeft: 0.04,
    mouthStretchRight: 0.04
  },
  ZH: { jawOpen: 0.09, mouthFunnel: 0.105, mouthPucker: 0.18 },
  DH: {
    jawOpen: 0.13,
    jawForward: 0.08,
    mouthStretchLeft: 0.08,
    mouthStretchRight: 0.08,
    mouthLowerDownLeft: 0.17,
    mouthLowerDownRight: 0.17
  },
  L: {
    jawOpen: 0.14,
    mouthStretchLeft: 0.08,
    mouthStretchRight: 0.08,
    mouthUpperUpLeft: 0.14,
    mouthUpperUpRight: 0.14
  },
  S: {
    jawOpen: 0.06,
    mouthStretchLeft: 0.26,
    mouthStretchRight: 0.26,
    mouthClose: 0.12
  },
  Z: {
    jawOpen: 0.055,
    mouthStretchLeft: 0.26,
    mouthStretchRight: 0.26,
    mouthClose: 0.1
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DIPHTHONGS — ONE LABEL, TWO TARGETS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE OPEN OBSERVATION FROM THE AFFRICATE PASS, now closed. That block recorded:
 * "EY holds ONE pose for its whole 200 ms — `mouthStretchLeft` sits at exactly
 * 0.284 for nine consecutive frames — so the diphthong does not visibly
 * transition", and left it for a hardware decision.
 *
 * THE MEASUREMENT, extended to the whole family through the production path over
 * every aligned payload. For each occurrence the per-frame calibrated values were
 * traced inside the phoneme's own window and the RATIO between its channels
 * taken. In all 84 occurrences of EY/AY/AW/OW/OY the ratio is constant to three
 * decimal places for the entire label: every channel rises and falls together on
 * one envelope. The shape does not change; only its amplitude does. A diphthong
 * is the one class of sound DEFINED by its movement, so this is a defect and not
 * a preference.
 *
 * THE CORRECTION, and its deliberate constraint. Each diphthong gets an ONSET
 * and an OFFGLIDE, and the coarticulation engine interpolates between them
 * across the phoneme's own progress. The two ends are authored SYMMETRICALLY
 * ABOUT THE ACCEPTED POSE:
 *
 *     onset = accepted - glide        offglide = accepted + glide
 *
 * so the accepted vowel pose remains exactly the phoneme's temporal midpoint and
 * the mean shape over the label is arithmetically unchanged. The accepted vowel
 * table is not retuned — it is re-anchored from "the whole label" to "the middle
 * of the label", which is what a diphthong nucleus is. `hyper3dFinalLipShapes`
 * asserts the midpoint identity channel by channel.
 *
 * The directions are the phonetics, not taste:
 *
 *   EY /eɪ/   open, relaxed  ->  narrower and more spread      (the brief's own example)
 *   AY /aɪ/   wide open      ->  closing and spreading
 *   AW /aʊ/   wide open      ->  closing and rounding
 *   OW /oʊ/   open round     ->  tighter, stronger rounding
 *   OY /ɔɪ/   strong round   ->  releasing the round, closing
 *
 * WHAT THIS IS NOT. No new engine, no second clock, no phoneme table of its own:
 * the interpolation is a two-pose lerp driven by the phoneme's EXISTING label
 * boundaries, evaluated inside `CoarticulationEngine` where `currentDef.pose`
 * was already being read. Attack, release, sustain, coarticulation windows and
 * MFA timing are untouched, and a phoneme without a glide renders from `pose`
 * along exactly the previous code path.
 *
 * LADDER PRESERVED. The strongest value any of these reaches is OW's offglide
 * pucker at 0.60, which stays below UW's 0.66 — the top of the accepted rounding
 * ladder is still UW. AY's onset jaw of 0.54 stays below AA's 0.56. OY gains no
 * `mouthStretch` at either end: the vowel pass removed its lateral spread
 * deliberately, and re-introducing it would undo that.
 */
export interface DiphthongGlide {
  readonly onset: BlendshapePose;
  readonly offglide: BlendshapePose;
}

export const DIPHTHONG_GLIDES: Record<string, DiphthongGlide> = {
  EY: {
    onset: { jawOpen: 0.25, mouthStretchLeft: 0.26, mouthStretchRight: 0.26, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 },
    offglide: { jawOpen: 0.15, mouthStretchLeft: 0.42, mouthStretchRight: 0.42, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 }
  },
  AY: {
    onset: { jawOpen: 0.54, mouthStretchLeft: 0.08, mouthStretchRight: 0.08, mouthLowerDownLeft: 0.14, mouthLowerDownRight: 0.14 },
    offglide: { jawOpen: 0.38, mouthStretchLeft: 0.24, mouthStretchRight: 0.24, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 }
  },
  AW: {
    onset: { jawOpen: 0.52, mouthFunnel: 0.18, mouthPucker: 0.14 },
    offglide: { jawOpen: 0.32, mouthFunnel: 0.34, mouthPucker: 0.38 }
  },
  OW: {
    onset: { jawOpen: 0.29, mouthFunnel: 0.34, mouthPucker: 0.4 },
    offglide: { jawOpen: 0.19, mouthFunnel: 0.46, mouthPucker: 0.6 }
  },
  OY: {
    // The first draft scaled all three channels by nearly the same factor
    // (0.667 / 0.667 / 0.652), which is an AMPLITUDE change wearing a glide's
    // clothes: it measured 0.55° of shape rotation against the family's 18°
    // median. /ɔɪ/ releases its ROUNDING far faster than it closes its jaw, so
    // the rounding now falls to 0.50 / 0.46 of its onset while the jaw only
    // falls to 0.76 — divergent ratios, which is what makes it a shape.
    onset: { jawOpen: 0.34, mouthFunnel: 0.4, mouthPucker: 0.52 },
    offglide: { jawOpen: 0.26, mouthFunnel: 0.2, mouthPucker: 0.24 }
  }
};

/**
 * The Hyper3D speech profile: the male table with the vowel poses replaced.
 *
 * Only `morphTargets` is overridden. `attack`, `release`, `holdBias`,
 * `defaultIntensity`, `coarticulation*`, `viseme` and `category` are the male
 * table's, so timing and blending are unchanged and only the SHAPES differ.
 */
export const hyper3dPhonemeProfile = Object.fromEntries(
  Object.entries(minifaceMalePhonemeProfile).map(([phoneme, definition]) => {
    const pose = VOWEL_POSES[phoneme] ?? AFFRICATE_POSES[phoneme] ?? CONSONANT_POSES[phoneme];
    return pose ? [phoneme, { ...definition, morphTargets: pose }] : [phoneme, definition];
  })
) as typeof minifaceMalePhonemeProfile;

/**
 * The VOWELS this table changes. Deliberately still exactly the fifteen the
 * accepted baseline pins — the affricate correction is a separate list so that
 * contract keeps meaning what it meant.
 */
export const HYPER3D_TUNED_VOWELS = Object.keys(VOWEL_POSES);

/** The AFFRICATES this table changes. See the block above for the measurements. */
export const HYPER3D_TUNED_AFFRICATES = Object.keys(AFFRICATE_POSES);

/**
 * The OTHER CONSONANTS this table changes, kept as a third list for the same
 * reason the affricates are a second one: each contract keeps meaning exactly
 * what it meant when it was accepted.
 */
export const HYPER3D_TUNED_CONSONANTS = Object.keys(CONSONANT_POSES);

/** The diphthongs given a within-phoneme trajectory. Their POSES are unchanged. */
export const HYPER3D_GLIDING_DIPHTHONGS = Object.keys(DIPHTHONG_GLIDES);

/** Every phoneme whose pose differs from the male table, for the identity proofs. */
export const HYPER3D_RETUNED_PHONEMES = [
  ...HYPER3D_TUNED_VOWELS,
  ...HYPER3D_TUNED_AFFRICATES,
  ...HYPER3D_TUNED_CONSONANTS
];
