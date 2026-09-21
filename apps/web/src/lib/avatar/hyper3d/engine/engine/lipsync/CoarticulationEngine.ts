import { phonemeToBlendshape } from "../../mappings/phonemeToBlendshape";
import type { TimedPhoneme } from "../../types/avatarPayload";
import type {
  BlendshapePose,
  CoarticulationDebugState,
  PhonemePoseDefinition
} from "../../types/facialAnimation";
import type { SupportedPhoneme } from "../../mappings/phonemeAliases";
import { clampAvatarMorph } from "../../mappings/avatarBlendshapeConfig";
import { clamp } from "../../utils/clamp";
import { smoothstep } from "../../utils/easing";
import { normalizePhoneme } from "./PhonemeNormalizer";

const ENGINE_DEFAULT_WINDOW = 0.08;

/**
 * Fraction of a phoneme reserved for a flat top. **Shipped at 0: off.**
 *
 * This exists because a second, larger defect was measured here and then
 * deliberately NOT fixed in this pass. `compressedEnvelope` scales attack and
 * release to fill the phoneme exactly when their sum exceeds its duration, so
 * the two smoothsteps meet at a point and the envelope is a triangle with a
 * one-sample peak. On the 37-second natural-speech paragraph that applies to
 * **96 of 126 vowel occurrences (76 %)** — AA needs 115 ms before any sustain
 * exists and the clip's median phoneme is 70 ms.
 *
 * Reserving a sustain fixes it, and the numbers are tempting: at 0.4 the target
 * loses 19 % of its direction reversals, badly-served vowels gain 38 % delivery
 * and same-vowel variance falls 21 %. It was rejected anyway, on the end-to-end
 * measurement rather than the simulation. Making room for a flat top compresses
 * the ramps, so each remaining move is steeper: rendered worst step per frame
 * goes 1.818 -> 2.428 mm (+34 %) and rendered p99 jerk 174,888 -> 190,150
 * (+8.7 %), with the amplitude range essentially unchanged so that is a real
 * steepening and not just a bigger mouth. Trading reversals for step size is
 * exactly the trade this pass was told not to accept.
 *
 * Left as a parameter, at zero, because it is a real finding with a real fix
 * that belongs with a jaw-damper change rather than alone, and because the tests
 * drive it to prove the mechanism it controls is the one described.
 * See docs/FEMALE_REALISM_REMEDIATION.md and
 * docs/evidence/coarticulation-envelope/.
 */
export const ENVELOPE_SUSTAIN_FRACTION = 0;

/**
 * The weight a phoneme's own look-ahead ramp has already reached by the instant
 * it starts, in the same units as `nextWeight` below. **This is the fix this
 * pass ships.**
 *
 * The defect: that ramp climbs to 0.35 and is then THROWN AWAY. The look-ahead
 * window is `time < next.start_time`, so on the very frame the phoneme becomes
 * `current` its `nextWeight` drops to zero while its own envelope restarts from
 * `smoothstep(start, start, t) = 0`. Measured on the natural-speech paragraph:
 * **348 of 380 phonemes (91.6 %) lose contribution on the frame they begin**,
 * median drop 0.146, worst 0.30 — the face pulls back from a sound at the moment
 * it starts making it. That is the discontinuity P4 traced from the rendered jaw
 * all the way up to here.
 *
 * Starting the attack from the level the look-ahead already reached makes the
 * handoff continuous. The envelope is later multiplied by `defaultIntensity`, so
 * the equivalent floor in envelope units is this divided by that.
 *
 * Measured end to end against the pre-fix path, same payload, rendered geometry:
 * target p99 jerk -10.0 %, rendered aperture p99 jerk -7.0 %, direction
 * reversals -15.6 %, same-vowel variance -9.4 %, worst-served vowels up on 9 of
 * 11 vowels, and the worst single per-frame step unchanged (+2.4 %). Every one
 * of the three lower-face modes improves, and so does the male path.
 */
export const ENVELOPE_LOOKAHEAD_CARRY = 0.35;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AFFRICATE SUSTAIN — the `"changing"` correction.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE REPORT. Hardware: overall lip sync improved, `"change"` is better,
 * `"changing"` still looks slightly off.
 *
 * THE MEASUREMENT, on the real MFA alignments through the production path. The
 * two words differ in one number that matters:
 *
 *   word      JH label   rendered protrusion
 *   change     130 ms    1.31 mm
 *   jacket      90 ms    1.26 mm
 *   changing    70 ms    0.93 mm   <- BELOW the 1.2 mm affricate family floor
 *
 * `changing`'s JH is the ONLY affricate occurrence in the corpus below the floor
 * `hyper3dAffricateFamily` established from the already-accepted `"chose"`. The
 * CH is fine in both words (1.60 mm in `change`, 1.69 mm in `changing`), so the
 * divergence is JH and only JH.
 *
 * THE CAUSE, and it is NOT the pose — the pose is identical in all three words.
 * `ENVELOPE_SUSTAIN_FRACTION` is 0, so `compressedEnvelope` scales attack and
 * release to fill the label exactly and the envelope is a TRIANGLE with a
 * one-sample peak. `FacialPoseMixer.smooth` then low-passes the mouth region at
 * speed 28, i.e. alpha = 1 - e^(-28/60) = 0.373 per frame, so reaching a target
 * takes about five frames at it. Measured, engine output against rendered:
 *
 *   change    JH  engine envelope 1.000 for FOUR consecutive frames -> renders 89 %
 *   changing  JH  engine envelope 0.988 for ONE frame               -> renders 64 %
 *
 * A 70 ms label is four frames at 60 Hz. The triangle spends one of them at the
 * apex, and a 0.373 follower cannot climb a one-frame spike. This is the same
 * class of defect as the bilabial flicker that `bilabialSeal` exists to fix —
 * "the closure apex is not strong" — arriving at the affricate instead of the
 * stop.
 *
 * THE CORRECTION. The affricates get the sustain the global envelope does not
 * have: a flat top, so the apex lasts long enough for the existing output
 * smoother to reach it. `compressedEnvelope` already takes `sustainFraction` as
 * a parameter — this pass changes WHICH VALUE two phonemes get, and adds no
 * mechanism, no clock and no second lip-sync path.
 *
 * WHY NOT GLOBALLY. Because that was already measured and rejected: at 0.4 for
 * every phoneme the rendered worst step per frame went 1.818 -> 2.428 mm (+34 %)
 * and p99 jerk +8.7 %, which is the trade this project declined. Scoped to CH
 * and JH it reaches 20 occurrences in the whole corpus, and the cost is measured
 * in `hyper3dChangingBoundary.test.ts` rather than assumed.
 *
 * WHY BY PHONEME AND NOT BY VISEME. `SH` and `ZH` carry `viseme: "CH"` too, and
 * the brief for this pass freezes them. Naming the two phonemes makes it
 * impossible for this to reach a fricative.
 *
 * WHAT IS NOT CHANGED: the CH and JH POSES, which the previous pass tuned and
 * hardware accepted; `attack`; `release`; `holdBias`; the coarticulation
 * windows; `ENVELOPE_SUSTAIN_FRACTION` itself, which stays 0 for every other
 * phoneme; and the bilabial seal, which has its own trajectory and never reads
 * this.
 */
export const AFFRICATE_SUSTAIN_FRACTION = 0.5;

/**
 * The phonemes the sustain applies to, named rather than derived from `viseme`
 * so it can never reach `SH` or `ZH`, which share that viseme and are frozen.
 */
export const AFFRICATE_SUSTAIN_PHONEMES: ReadonlySet<string> = new Set(["CH", "JH"]);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE-FRAME APEX ON SHORT PHONEMES — MEASURED, AND DELIBERATELY NOT FIXED.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scanning all 371 words in the corpus for apex width — how many frames a
 * phoneme's lead channel spends within 90 % of its own peak — one-frame apexes
 * are the most common finding: 240 words contain at least one, almost all led by
 * `jawOpen`. The rate tracks label duration, and the phonemes that already have
 * a targeted fix sit at the bottom of the table, which is itself a check that
 * those fixes work:
 *
 *   AH 41/99 = 41 %   AO 6/15 = 40 %   AA 7/34 = 21 %   AE 6/42 = 14 %
 *   ...
 *   CH 18 %   JH 11 %   <- affricate sustain
 *   EY / AW / OY  0 %   <- diphthong glide
 *
 * AN OPEN-VOWEL SUSTAIN WAS BUILT AND REJECTED ON ITS OWN NUMBERS:
 *
 *   sustain   one-frame apex   median jaw peak   step p95   p99     max
 *   0.00        60/190 = 32 %      4.69 mm        1.301    2.024   3.703
 *   0.45        59/190 = 31 %      5.23 mm        1.399    2.174   3.881
 *   0.50        57/190 = 30 %      5.28 mm        1.406    2.197   3.881
 *
 * It does not fix the thing it was for — the apex rate is self-normalising,
 * because a sustain raises the peak that the 90 % band is measured against — and
 * it costs +7.5 % on step p95 and +7.4 % on p99. That is the same direction and
 * the same trade the GLOBAL sustain experiment was rejected for, with no
 * compensating gain.
 *
 * It is also the wrong shape of fix. A 60 ms label is 3.6 frames at 60 Hz, and a
 * real 60 ms vowel does peak briefly; holding it longer would make short vowels
 * read as long ones. The open vowels were separately measured to reach 16.5 mm
 * of lip gap on tokens held 150 ms or more — inside the 15-18 mm conversational
 * band — so an 11.5 % amplitude rise would overshoot exactly the tokens that
 * already deliver correctly.
 *
 * Recorded rather than deleted, because "the apex is one frame" is a real
 * observation that will be made again, and the answer is that the envelope is
 * not where it should be fixed.
 */


/**
 * The look-ahead ceiling and bonus for a gesture that PROTRUDES the lips. These
 * are the existing rounded-vowel numbers, lifted into named constants so the
 * affricates can share them rather than acquire a second set. Unchanged in
 * value from the accepted build.
 */
export const ROUNDING_ANTICIPATION_CEILING = 0.45;
export const ROUNDING_ANTICIPATION_BONUS = 0.08;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NASAL LIP CARRY — the `-ing` tail.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE REPORT. `"change"` improved and was accepted; `"changing"` still looked
 * slightly off after its JH was brought from 0.93 mm to 1.22 mm, so the defect
 * was not the affricate's amplitude.
 *
 * THE MEASUREMENT. Tracing the whole word as a time series and scoring each
 * frame by how much VISIBLE articulation it carries — travel above each
 * channel's own `usefulMin`, summed — gives the word's visual envelope:
 *
 *   change     2.8 2.9 2.9 3.0 2.7 1.8 | 3.2 ... 8.1 ... 3.1 | 2.3 1.4 | 1.2 ... 2.0 2.0 1.3 1.0
 *   changing   0.9 1.7 2.1 2.4 2.6 2.4 1.7 | 2.9 ... 7.6 ... 3.4 | 3.6 2.8 | 2.3 ... 1.4 | 1.8 ... 3.3 2.5 1.3 | 1.5 1.1 0.8 0.7 0.5 0.3 0.0
 *
 * `change` never drops below 1.0 mm and finishes on a 1.3 mm plateau.
 * `changing` decays monotonically to LITERALLY ZERO and spends its last six
 * frames — the whole 120 ms `NG` — below 1.0 mm. The mouth arrives at rest
 * roughly 80 ms before the word's audio ends.
 *
 * IT IS SYSTEMATIC, not one take. Scoring the final frame of every word in the
 * corpus that ends into silence:
 *
 *   evening  NG  0.00     speaking NG  0.00     changing NG  0.01
 *   feeling  NG  0.00     morning  NG  0.00     timing   NG  0.04
 *   handling NG  0.12
 *   ...
 *   jacket   T   1.25     change   JH  1.30     home     M   1.38     room  M  3.25
 *
 * Every `-ing` word in the project sits at the top of that list. Nothing else
 * does. The `M`-final words — `home`, `them`, `room` — are all above 1.38 mm,
 * so this is not "nasals" in general.
 *
 * THE CAUSE. `NG`'s own pose is near-neutral by design ({jawOpen 0.08,
 * mouthClose 0.08, mouthPress 0.04} at `defaultIntensity` 0.58, which renders
 * below `mouthPress`'s own useful minimum), and the preceding vowel's look-behind
 * lasts `windowSeconds * coarticulationAfter` = 0.08 x 0.55 = 44 ms of a 120-150
 * ms label. After 44 ms nothing is driving the lips at all, and `NG`'s release
 * is then a release TO nothing.
 *
 * WHY THE LIPS SHOULD NOT DO THAT. /ŋ/ is articulated at the VELUM with the
 * tongue. The lips are entirely free, and in real speech they hold the shape of
 * the preceding vowel across the whole nasal — a face does not return to rest in
 * the middle of "changing".
 *
 * THE CORRECTION. The existing look-behind is extended across the nasal and tied
 * to the nasal's OWN envelope, so the vowel's lip shape persists through it and
 * then releases WITH it. No new mechanism, no clock, and `NG`'s own pose is not
 * touched — the brief's "do not make NG itself exaggerated".
 *
 * WHY `NG` ONLY:
 *
 *   M   BILABIAL. The lips close for it; carrying a vowel through would fight
 *       the seal. Frozen, and `M`-final words already end at 1.38-3.25 mm.
 *   N   EXCLUDED, and this is the load-bearing exclusion. In `"change"` the N
 *       sits between EY and JH — holding EY's spread there would fight JH's
 *       rounding, which is exactly the failure mode the brief warns about. N is
 *       also very often syllable-INITIAL, where carrying the previous vowel
 *       forward is simply wrong.
 *   NG  In English /ŋ/ is the one nasal that can NEVER begin a syllable. It is
 *       always coda, so carrying the preceding vowel through it is always the
 *       right thing and can never bleed a vowel into a following onset.
 *
 * `change`, `chose`, `jacket`, `beige`, `she` and `blue backpack` contain no NG,
 * so this cannot reach any of them — proven by construction, and asserted.
 */
export const NASAL_LIP_CARRY_PHONEMES: ReadonlySet<string> = new Set(["NG"]);

/**
 * How much of the preceding vowel's pose the lips keep across the nasal, as a
 * weight in the same units as the look-behind's own 0.35 ceiling.
 *
 * BELOW THE MECHANISM'S OWN CEILING. The look-behind's existing maximum is the
 * literal `* 0.35` a few lines below, so the carry can never contribute more
 * than an ordinary look-behind frame was always allowed to. What changes is WHEN
 * it is available, not how strong it may be.
 *
 * CHOSEN BY A STOPPING RULE, not by taste: it is the SMALLEST value at which no
 * `-ing` word in the corpus has a single frame left below 0.35 mm of visible
 * articulation. The sweep, over all seven of them:
 *
 *   carry   worst dead run   weakest tail   worst nasal/vowel ratio
 *   0.00      2 frames          0.00 mm            1.001
 *   0.20      1 frame           0.20 mm            1.001
 *   0.25      1 frame           0.28 mm            1.014
 *   0.30      0 frames          0.36 mm            1.089   <- shipped
 *   0.35      0 frames          0.44 mm            1.168
 *
 * The last column is the "do not exaggerate NG" check: the nasal's rendered peak
 * against the peak of the vowel it follows. Note that the PRE-FIX path already
 * measures 1.001 — the existing look-behind can already let a nasal edge past
 * its vowel — so the question is how far this moves it, and 0.30 is the point
 * where the defect is gone and the excess is still 9 % on one channel of one
 * occurrence (`timing`, whose IH is a short under-delivered label). 0.35 buys a
 * slightly longer tail for 17 %, and buys nothing on the defect itself.
 */
export const NASAL_LIP_CARRY = 0.3;

/**
 * BILABIAL SEAL — the `"blue backpack"` closure/release fix.
 *
 * THE DEFECT. `compressedEnvelope` scales attack and release to fill the
 * phoneme exactly (`ENVELOPE_SUSTAIN_FRACTION` is 0), so a short phoneme's
 * envelope is a TRIANGLE with a one-sample peak. `closurePreservation` then
 * gates the full 0.7 seal on `currentEnvelope > 0.45`, which that triangle
 * crosses for a single frame. Measured on the repaired `"backpack"`, whose
 * `/k p/` cluster gives the P a 35 ms label:
 *
 *     12.133  K  mouthClose 0.174
 *     12.150  P  mouthClose 0.280
 *     12.167  P  mouthClose 0.700   <- apex, ONE frame at 60 Hz
 *     12.183  P  mouthClose 0.011
 *
 * 17 ms of seal. The lips technically close and instantly reopen, which reads as
 * a flicker rather than a bilabial — "the closure apex is not strong".
 *
 * THE FIX, and only this. The seal is given its own trajectory instead of
 * inheriting the phoneme's triangular envelope:
 *
 *   LEAD     the lips reach the seal by the label's START, ramping in over the
 *            preceding interval. This is what real bilabial closure does — the
 *            lips shut during the offglide of the previous sound — and it is the
 *            half that a short label cannot supply from inside itself.
 *   HOLD     full seal for the whole label except its release ramp.
 *   RELEASE  a FIXED short ramp that ends exactly at the label boundary, so the
 *            following vowel is already rising on the next frame and nothing
 *            lingers past the stop.
 *
 * The lead is capped at a fraction of the PRECEDING phoneme so it can never
 * swallow a short vowel, and the release is capped at a fraction of the stop so
 * it can never start before the apex.
 *
 * WHAT THIS IS NOT. It writes `mouthClose` only, on P/B/M only. No jaw value, no
 * global multiplier, no attack/release constant, no coarticulation window and no
 * other channel is touched — see `docs/hyper3d-target-matched-performance.md`.
 */
export const BILABIAL_SEAL_LEVEL = 0.7;
/** How early the lips reach full closure, and its cap as a share of the previous phoneme. */
export const BILABIAL_SEAL_LEAD_SECONDS = 0.045;
export const BILABIAL_SEAL_LEAD_PREVIOUS_SHARE = 0.6;
/** How long the release takes, and its cap as a share of the stop itself. */
export const BILABIAL_SEAL_RELEASE_SECONDS = 0.035;
export const BILABIAL_SEAL_RELEASE_SHARE = 0.5;

export interface BilabialSealOptions {
  readonly leadSeconds?: number;
  readonly releaseSeconds?: number;
  readonly level?: number;
}

/**
 * The seal trajectory of one bilabial stop, 0-1, at `time`.
 *
 * `precedingSeconds` is the duration of whatever immediately precedes the stop;
 * it only ever SHORTENS the lead. Returns 0 outside `[start - lead, end]`, so
 * the seal cannot survive the label boundary.
 */
export const bilabialSeal = (
  event: { start_time: number; end_time: number },
  time: number,
  precedingSeconds = Number.POSITIVE_INFINITY,
  options: BilabialSealOptions = {}
): number => {
  const duration = Math.max(0.001, event.end_time - event.start_time);
  const lead = Math.min(
    options.leadSeconds ?? BILABIAL_SEAL_LEAD_SECONDS,
    Math.max(0, precedingSeconds) * BILABIAL_SEAL_LEAD_PREVIOUS_SHARE
  );
  const release = Math.min(
    options.releaseSeconds ?? BILABIAL_SEAL_RELEASE_SECONDS,
    duration * BILABIAL_SEAL_RELEASE_SHARE
  );
  if (time <= event.start_time - lead || time >= event.end_time) return 0;
  const rise = lead > 0 ? smoothstep(event.start_time - lead, event.start_time, time) : 1;
  const fall = 1 - smoothstep(event.end_time - release, event.end_time, time);
  return clamp(Math.min(rise, fall));
};

export function scalePose(pose: BlendshapePose, weight: number): BlendshapePose {
  const out: BlendshapePose = {};
  for (const key in pose) out[key] = clampAvatarMorph(key, pose[key] * weight);
  return out;
}

export function addPose(a: BlendshapePose, b: BlendshapePose, weight = 1): BlendshapePose {
  if (weight <= 0) return a;
  for (const key in b) a[key] = clampAvatarMorph(key, (a[key] ?? 0) + b[key] * weight);
  return a;
}

/**
 * THE WITHIN-PHONEME GLIDE — the whole of the diphthong fix.
 *
 * A diphthong is one MFA label with two targets, and rendering it from a single
 * pose held one shape for its entire duration: measured on every one of the 84
 * EY/AY/AW/OW/OY occurrences in the aligned corpus, the ratio between a
 * diphthong's channels was constant to three decimal places across the whole
 * label. Only the amplitude moved, on the envelope every phoneme shares.
 *
 * When a definition carries `onsetPose` and `offglidePose` — only the five
 * diphthongs in `DIPHTHONG_GLIDES` do — the pose is interpolated between them
 * across the phoneme's own label, and the accepted `pose` is their midpoint.
 * Everything else returns `definition.pose` by identity, so every other phoneme
 * takes the byte-identical previous path.
 *
 * `progress` is linear in the LABEL, not in the envelope: the shape must keep
 * gliding while the envelope is already releasing, which is exactly what an
 * offglide is. It introduces no clock, no window and no constant of its own.
 */
/**
 * THE WITHIN-PHONEME GLIDE — the diphthong trajectory.
 *
 * A diphthong is one MFA label with two targets, and rendering it from a single
 * pose held one shape for its entire duration. When a definition carries
 * `onsetPose` and `offglidePose` — only the five diphthongs in
 * `DIPHTHONG_GLIDES` do — the pose is interpolated between them across the
 * phoneme's own label, and the accepted `pose` is their midpoint. Everything
 * else returns `definition.pose` BY IDENTITY, so every other phoneme takes the
 * byte-identical previous path.
 *
 * `progress` is linear in the LABEL, not in the envelope: the shape must keep
 * gliding while the envelope is already releasing, which is exactly what an
 * offglide is. It introduces no clock, no window and no constant of its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE GLIDE IS NOT CONTEXT-AWARE, measured rather than assumed
 * ─────────────────────────────────────────────────────────────────────────────
 * A context-dependent offglide was built and REJECTED on its own numbers. The
 * idea: rotate the glide about its midpoint so its ends lean toward the
 * neighbouring phonemes — `h' = h + pull * (next - previous) / 2` — which keeps
 * the accepted midpoint exactly and would deliver "EY -> N reduces stretch
 * slightly before the nasal" as arithmetic rather than a special case.
 *
 * The motivating measurement was real: across all 90 diphthong boundaries in the
 * corpus the glide's direction points AWAY from the next phoneme's target on 86,
 * median 118 degrees, and those boundaries carry a median per-frame step of
 * 1.40 mm against the corpus's own 1.30 mm 95th percentile.
 *
 * The fix did not move either number:
 *
 *   pull   boundary step (median)   preparation distance to the next target
 *   0.00          1.388 mm                        4.17 mm
 *   0.50          1.381 mm                        4.23 mm      <- no better
 *   0.75          1.383 mm                        4.24 mm
 *
 * THE REASON, and it is the useful part. The look-ahead ALREADY prepares the
 * vowel for what follows: `nextWeight` reaches 0.35 of the next phoneme's pose
 * during the vowel's final frames — measured at 0.318 on the last EY frame of
 * `"changing"` — so roughly a third of the rendered shape at a vowel's end is
 * already the next sound. Leaning the glide's endpoint adds a SECOND path for
 * the same information, and the arithmetic simply lands where coarticulation had
 * already put it.
 *
 * It also could not be made consistent. `blend` sees three phonemes, so a
 * diphthong in the `previous` slot knows what follows but not what preceded it.
 * Any default for the missing side makes that slot lean differently from the
 * same phoneme's `current` slot — measured as an inverted lean on `"change"`,
 * where EY's rendered peak went UP rather than down. Fixing that needs the
 * engine to track more than three phonemes, which is a redesign.
 *
 * Recorded here rather than deleted silently, because "the offglide should
 * prepare for the next sound" is a reasonable thing to ask for twice, and the
 * answer is that it already does.
 */
export const glidingPose = (
  definition: PhonemePoseDefinition,
  event: { start_time: number; end_time: number } | undefined,
  time: number,
  /** Test-only. `"linear"` reproduces the pre-easing glide exactly. */
  easing: "smootherstep" | "linear" = "smootherstep"
): BlendshapePose => {
  const { onsetPose, offglidePose } = definition;
  if (!onsetPose || !offglidePose || !event) return definition.pose;
  const duration = event.end_time - event.start_time;
  if (!(duration > 0)) return definition.pose;
  const linear = clamp((time - event.start_time) / duration);
  /**
   * THE GLIDE IS EASED, NOT RAMPED — and this is a TIMING change only.
   *
   * Measured on the final rendered trace, every diphthong had a U-shaped
   * velocity profile across its own label: fastest at the edges, slowest in the
   * middle. Velocity by label decile, mm per frame:
   *
   *   EY  1.23 1.06 0.94 0.65 0.56 0.40 0.33 0.46 0.90 1.04
   *   AY  2.33 1.91 1.57 1.31 0.53 0.31 0.23 0.48 1.48 1.87
   *   AW  1.49 1.72 1.20 1.07 0.62 0.45 0.31 0.62 1.37 1.72
   *   OW  1.22 1.33 1.43 1.02 0.70 0.60 0.35 0.50 1.21 1.80
   *   OY  1.29 1.55 1.19 0.39 0.57 0.28 0.17 0.52 1.31 1.57
   *
   * That is backwards for the one sound class defined by its movement. The edges
   * are fast because the ENVELOPE is ramping and the neighbours are handing over;
   * the middle is where the envelope plateaus and the glide is the only thing
   * left moving the mouth — and a linear ramp spreads its swing so thinly over
   * the label that three of the five drop below 0.30 mm/frame there, which is
   * the threshold at which the rest of this analysis calls a mouth stalled.
   *
   * `smootherstep` (6t^5 - 15t^4 + 10t^3) puts the glide's motion where the
   * envelope is flat and takes it out of the edges where the envelope is already
   * busy: its derivative is 0 at both ends and 1.875x linear at the centre. The
   * gentler `smoothstep` was measured first and moved the trough about half as
   * far, leaving AY and OY still under 0.30.
   *
   * Measured at the trough (deciles 6-7), linear -> smootherstep:
   *
   *   EY  0.33 -> 0.45    AY  0.23 -> 0.35    AW  0.31 -> 0.51
   *   OW  0.35 -> 0.47    OY  0.17 -> 0.33
   *
   * and the cost across the whole corpus is p95 velocity 1.717 -> 1.727 mm and
   * p99 2.266 -> 2.283 mm, with the worst single frame unchanged at 3.759 mm.
   *
   * WHAT THIS DOES NOT CHANGE, by construction:
   *
   *   THE MIDPOINT   `smoothstep(0.5) = 0.5` exactly, so the pose at the label's
   *                  temporal centre is the accepted vowel pose, untouched.
   *   THE AMPLITUDE  The curve is monotonic from 0 to 1, so its total variation
   *                  is 1 — identical to linear. Net travel across the label is
   *                  unchanged; only its DISTRIBUTION in time moves.
   *   THE ENDS       `previous` and `next` slots clamp to progress 0 and 1, where
   *                  smoothstep is the identity, so neighbours see the same
   *                  onset and offglide they saw before.
   */
  const progress =
    easing === "linear" ? linear : linear * linear * linear * (linear * (linear * 6 - 15) + 10);
  const pose: BlendshapePose = {};
  for (const key in onsetPose)
    pose[key] = onsetPose[key] + ((offglidePose[key] ?? 0) - onsetPose[key]) * progress;
  // A channel present only at the offglide fades in from nothing rather than
  // appearing. None of the five shipped glides needs this, but a table that
  // added one must not step.
  for (const key in offglidePose) if (!(key in pose)) pose[key] = offglidePose[key] * progress;
  return pose;
};

export interface CoarticulationInput {
  time: number;
  current?: TimedPhoneme;
  previous?: TimedPhoneme;
  next?: TimedPhoneme;
  windowSeconds?: number;
  profile?: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>>;
  /** Test-only overrides. Production always uses the module constants. */
  envelopeSustainFraction?: number;
  envelopeLookAheadCarry?: number;
  /**
   * Test-only overrides for the two halves of the `"changing"` correction.
   * Driving `affricateSustainFraction` to 0 and `affricateAnticipation` to false
   * reproduces the pre-fix path EXACTLY, which is how the regression proves the
   * mechanisms it names are the ones that moved.
   */
  affricateSustainFraction?: number;
  affricateAnticipation?: boolean;
  /**
   * Test-only override for the nasal lip carry. 0 reproduces the pre-fix path
   * exactly, which is how the `-ing` regression proves the mechanism it names is
   * the one that moved.
   */
  nasalLipCarry?: number;
  /**
   * Test-only override for the diphthong glide's progress curve. `"linear"`
   * reproduces the pre-easing path exactly, which is how the flow regression
   * proves the mechanism it names is the one that moved.
   */
  glideEasing?: "smootherstep" | "linear";
  /** Test-only overrides for the bilabial seal. Production uses the constants. */
  bilabialSeal?: BilabialSealOptions;
}

export interface CoarticulationResult {
  pose: BlendshapePose;
  weights: CoarticulationDebugState;
}

const definitionFor = (
  event?: TimedPhoneme,
  profile: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>> = phonemeToBlendshape
): PhonemePoseDefinition | undefined => {
  if (!event) return undefined;
  return profile[normalizePhoneme(event.phoneme) ?? "SIL"];
};

const intensityFor = (event?: TimedPhoneme) => clamp(event?.intensity ?? 0);

/**
 * The contribution envelope of one phoneme over its own interval.
 *
 * Shape: rise from the carried look-ahead level to 1 over `attack`, hold, then
 * fall to 0 over `release`. The ramps are compressed only as far as the sustain
 * budget allows, so a flat top always survives however short the phoneme is.
 *
 * `sustainFraction` and `lookAheadCarry` are parameters rather than constants so
 * the tests can drive the pre-fix behaviour (0, 0) as a negative control and
 * show the metrics actually move.
 */
const compressedEnvelope = (
  definition: PhonemePoseDefinition,
  event: TimedPhoneme,
  time: number,
  sustainFraction = ENVELOPE_SUSTAIN_FRACTION,
  lookAheadCarry = ENVELOPE_LOOKAHEAD_CARRY
) => {
  if (time < event.start_time || time > event.end_time) return 0;
  const duration = Math.max(0.001, event.end_time - event.start_time);
  let attack = Math.max(0.001, definition.attack);
  let release = Math.max(0.001, definition.release);
  const rampBudget = duration * (1 - clamp(sustainFraction, 0, 0.95));
  const total = attack + release;
  if (total > rampBudget) {
    const scale = rampBudget / total;
    attack *= scale;
    release *= scale;
  }
  // Only phonemes that actually get a look-ahead ramp may carry one in. A
  // phoneme with no `coarticulationBefore` was never blended as `next`, so
  // starting it above zero would be inventing a contribution rather than
  // continuing one.
  const carry =
    lookAheadCarry > 0 && definition.coarticulationBefore > 0
      ? Math.min(0.95, lookAheadCarry / Math.max(0.05, definition.defaultIntensity))
      : 0;
  const rise = smoothstep(event.start_time, event.start_time + attack, time);
  const attackWeight = carry + (1 - carry) * rise;
  const releaseWeight = 1 - smoothstep(event.end_time - release, event.end_time, time);
  return clamp(Math.min(attackWeight, releaseWeight));
};

export class CoarticulationEngine {
  private pose: BlendshapePose = {};
  private weights: CoarticulationDebugState = {
    previous: 0,
    current: 0,
    next: 0,
    previousContribution: 0,
    currentContribution: 0,
    nextContribution: 0,
    effectiveLookBehind: 0,
    effectiveLookAhead: 0,
    closurePreservation: false
  };

  reset() {
    for (const key in this.pose) delete this.pose[key];
    this.weights.previous = 0;
    this.weights.current = 0;
    this.weights.next = 0;
    this.weights.previousContribution = 0;
    this.weights.currentContribution = 0;
    this.weights.nextContribution = 0;
    this.weights.previousPhoneme = undefined;
    this.weights.currentPhoneme = undefined;
    this.weights.nextPhoneme = undefined;
    this.weights.dominantPhoneme = undefined;
    this.weights.effectiveLookBehind = 0;
    this.weights.effectiveLookAhead = 0;
    this.weights.closurePreservation = false;
  }

  blend(input: CoarticulationInput): CoarticulationResult {
    this.reset();
    const windowSeconds = input.windowSeconds ?? ENGINE_DEFAULT_WINDOW;
    const profile = input.profile ?? phonemeToBlendshape;
    const currentDef = definitionFor(input.current, profile);
    const previousDef = definitionFor(input.previous, profile);
    const nextDef = definitionFor(input.next, profile);
    const effectiveLookBehind = previousDef
      ? Math.max(0, windowSeconds * previousDef.coarticulationAfter)
      : 0;
    const effectiveLookAhead = nextDef
      ? Math.max(0, windowSeconds * nextDef.coarticulationBefore)
      : 0;

    /**
     * THE AFFRICATE SUSTAIN. `Math.max` rather than a replacement, so a test
     * driving the global sustain UP still gets what it asked for, and driving
     * `affricateSustainFraction` to 0 reproduces the pre-fix envelope exactly.
     */
    const baseSustain = input.envelopeSustainFraction ?? ENVELOPE_SUSTAIN_FRACTION;
    const sustainFraction =
      currentDef && AFFRICATE_SUSTAIN_PHONEMES.has(currentDef.phoneme)
        ? Math.max(baseSustain, input.affricateSustainFraction ?? AFFRICATE_SUSTAIN_FRACTION)
        : baseSustain;
    const currentEnvelope =
      currentDef && input.current
        ? compressedEnvelope(
            currentDef,
            input.current,
            input.time,
            sustainFraction,
            input.envelopeLookAheadCarry ?? ENVELOPE_LOOKAHEAD_CARRY
          )
        : 0;
    let previousWeight = 0;
    let nextWeight = 0;

    if (
      previousDef &&
      input.previous &&
      input.time >= input.previous.end_time &&
      input.time <= input.previous.end_time + effectiveLookBehind
    ) {
      previousWeight =
        (1 -
          smoothstep(
            input.previous.end_time,
            input.previous.end_time + effectiveLookBehind,
            input.time
          )) *
        0.35;
    }

    /**
     * THE NASAL LIP CARRY. Across a non-labial coda nasal the preceding vowel's
     * lip shape is held rather than allowed to decay out inside the label, and it
     * is scaled by the NASAL'S OWN ENVELOPE so it rises and releases with the
     * nasal instead of on a schedule of its own. `Math.max` so it can only ever
     * ADD to the normal look-behind, never shorten it.
     */
    if (
      previousDef &&
      input.previous &&
      currentDef &&
      (input.nasalLipCarry ?? NASAL_LIP_CARRY) > 0 &&
      NASAL_LIP_CARRY_PHONEMES.has(currentDef.phoneme) &&
      input.time >= input.previous.end_time
    ) {
      previousWeight = Math.max(
        previousWeight,
        (input.nasalLipCarry ?? NASAL_LIP_CARRY) * currentEnvelope
      );
    }

    if (
      nextDef &&
      input.next &&
      input.time >= input.next.start_time - effectiveLookAhead &&
      input.time < input.next.start_time
    ) {
      nextWeight =
        smoothstep(input.next.start_time - effectiveLookAhead, input.next.start_time, input.time) *
        0.35;
      /**
       * ROUNDING ANTICIPATION. A gesture that PROTRUDES the lips needs lead time
       * that a spread or neutral one does not, so the look-ahead ceiling is
       * raised for it. `WQ` and `OH` — /w/, /u/, /o/ — have always had this.
       *
       * THE AFFRICATES ARE THE SAME CASE, and this pass adds them because the
       * `"changing"` trace proved it. On this asset CH and JH are a ROUNDING
       * gesture: the previous pass re-authored both to be pucker-led precisely
       * because `mouthFunnel` opens the lips here. A 70 ms JH is four frames at
       * 60 Hz, and `FacialPoseMixer` low-passes the mouth at 0.373 per frame, so
       * where the climb STARTS decides where it ends — the label is too short to
       * recover from a low start. Raising the anticipation is what gives it the
       * running start, and it is the identical mechanism, ceiling and bonus that
       * the rounded vowels already use rather than a new one.
       *
       * NAMED BY PHONEME, not by viseme: `SH` and `ZH` carry `viseme: "CH"` too
       * and are frozen for this pass, so the affricates are listed explicitly.
       */
      const anticipatesRounding =
        nextDef.viseme === "WQ" ||
        nextDef.viseme === "OH" ||
        ((input.affricateAnticipation ?? true) && AFFRICATE_SUSTAIN_PHONEMES.has(nextDef.phoneme));
      if (anticipatesRounding)
        nextWeight = Math.min(
          ROUNDING_ANTICIPATION_CEILING,
          nextWeight + ROUNDING_ANTICIPATION_BONUS
        );
    }

    if (["FF", "TH", "SS", "CH"].includes(currentDef?.viseme ?? "")) {
      previousWeight *= 0.55;
      nextWeight *= 0.55;
    }

    if (currentDef?.viseme === "PP") {
      previousWeight *= 0.25;
      nextWeight *= 0.25;
    }

    const previousContribution = previousWeight * intensityFor(input.previous);
    const currentContribution =
      currentEnvelope * intensityFor(input.current) * (currentDef?.defaultIntensity ?? 0);
    const nextContribution = nextWeight * intensityFor(input.next);

    /**
     * The glide is resolved at each of the three contribution sites, so a
     * diphthong hands its NEIGHBOURS the end it is actually adjacent to: the
     * previous phoneme contributes its offglide, the next contributes its onset,
     * and the current one contributes wherever it has reached. For every
     * non-diphthong `glidingPose` returns `definition.pose` unchanged.
     */
    /**
     * The glide is resolved at each of the three contribution sites, so a
     * diphthong hands its NEIGHBOURS the end it is actually adjacent to: the
     * previous phoneme contributes its offglide, the next contributes its onset,
     * and the current one contributes wherever it has reached. For every
     * non-diphthong `glidingPose` returns `definition.pose` unchanged.
     */
    const easing = input.glideEasing;
    if (previousDef)
      addPose(this.pose, glidingPose(previousDef, input.previous, input.time, easing), previousContribution);
    if (currentDef)
      addPose(this.pose, glidingPose(currentDef, input.current, input.time, easing), currentContribution);
    if (nextDef)
      addPose(this.pose, glidingPose(nextDef, input.next, input.time, easing), nextContribution);

    /**
     * THE BILABIAL SEAL. Two branches, both writing only `mouthClose`:
     *
     *   CURRENT is a stop  hold the seal across the label and release it inside
     *                      the label, so the next sound is visible immediately.
     *   NEXT is a stop     the LEAD — the lips are already closing while the
     *                      previous sound finishes. This is the half a 35 ms
     *                      label cannot produce from inside itself.
     */
    let seal = 0;
    if (currentDef?.viseme === "PP" && input.current)
      seal = Math.max(
        seal,
        bilabialSeal(
          input.current,
          input.time,
          input.previous ? input.previous.end_time - input.previous.start_time : undefined,
          input.bilabialSeal
        ) * intensityFor(input.current)
      );
    if (nextDef?.viseme === "PP" && input.next && input.time < input.next.start_time)
      seal = Math.max(
        seal,
        bilabialSeal(
          input.next,
          input.time,
          input.current ? input.current.end_time - input.current.start_time : undefined,
          input.bilabialSeal
        ) * intensityFor(input.next)
      );
    const sealLevel = input.bilabialSeal?.level ?? BILABIAL_SEAL_LEVEL;
    const closurePreservation = seal > 0;
    if (closurePreservation)
      this.pose.mouthClose = Math.max(this.pose.mouthClose ?? 0, sealLevel * seal);

    this.weights.previous = clamp(previousWeight);
    this.weights.current = clamp(currentEnvelope);
    this.weights.next = clamp(nextWeight);
    this.weights.previousContribution = clamp(previousContribution);
    this.weights.currentContribution = clamp(currentContribution);
    this.weights.nextContribution = clamp(nextContribution);
    this.weights.previousPhoneme = input.previous?.phoneme;
    this.weights.currentPhoneme = input.current?.phoneme;
    this.weights.nextPhoneme = input.next?.phoneme;
    this.weights.dominantPhoneme = [
      { phoneme: input.previous?.phoneme, contribution: previousContribution },
      { phoneme: input.current?.phoneme, contribution: currentContribution },
      { phoneme: input.next?.phoneme, contribution: nextContribution }
    ]
      .filter((entry): entry is { phoneme: string; contribution: number } =>
        Boolean(entry.phoneme)
      )
      .sort((a, b) => b.contribution - a.contribution)[0]?.phoneme;
    this.weights.effectiveLookBehind = effectiveLookBehind;
    this.weights.effectiveLookAhead = effectiveLookAhead;
    this.weights.closurePreservation = closurePreservation;
    return { pose: { ...this.pose }, weights: { ...this.weights } };
  }
}
