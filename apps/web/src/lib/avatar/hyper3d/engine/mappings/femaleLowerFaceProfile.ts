/**
 * Integrated lower-face bone mapping — PROTOTYPE, disabled by default.
 *
 * Extends the hybrid jaw with one more mechanism: `FACIAL_C_MouthUpper`, a
 * central-upper-lip depressor driven by bilabial closure demand.
 *
 * Why this bone, and why only for bilabials
 * -----------------------------------------
 * The Full Facial Bone Capability Audit swept all 500 weighted facial bones and
 * found exactly one new capability outside the jaw. `FACIAL_C_MouthUpper` about
 * local +x gives **-0.4283 mm of central-upper-lip travel per degree** at
 * R2 = 1.000000, with the upper teeth moving 0.000 mm, corner spread unchanged
 * to four decimals, and 4.4 % collateral. Every morph that touches the same
 * vertices pushes the other way — `mouthShrugUpper` at direction cosine -0.539,
 * `mouthUpperUp` at -0.988 — and morph influences are clamped at zero on this
 * pipeline, so the downward direction of that axis is unreachable through
 * morphs. The bone reaches it.
 *
 * It is restricted to bilabial closure because that is the only place the audit
 * showed a defect worth fixing: at P, B and M the upper lip performs under 10 %
 * of the closure travel, and the lower lip does the rest. Making it a general
 * speech or expression bone would put a second writer on the upper lip for no
 * measured gain.
 *
 * Why the drive signal is what it is
 * ----------------------------------
 * `bilabialClosure` = the coordinated layer's overlap-resolved closure envelope
 * multiplied by the bilabial share of the coarticulation weights. The envelope
 * supplies anticipation and release shaping that is already tuned; the share is
 * exactly zero for every non-bilabial by construction rather than by threshold,
 * so an F (closure intent 0.42) or a T (0.2) cannot drive this bone at all.
 *
 * Why the demand is then damped
 * -----------------------------
 * That raw product is NOT usable as-is, and the measurement is unambiguous: on a
 * real payload it jumps 0.84 in one 16.7 ms frame entering the seal, and it
 * REBOUNDS from 0.249 to 0.488 during the release. Both come from the share
 * being a ratio whose denominator collapses at a phoneme boundary — as the stop
 * stops being "current" it becomes "previous" with a fresh contribution, and the
 * ratio briefly rises while the underlying gesture is falling.
 *
 * The morph path never shows this because the coordinated layer damps its
 * closure channels: measured over the same frames, `mouthPressLeft` runs
 * 0.036 -> 0.107 -> 0.263 -> 0.396 -> 0.477 -> 0.527 -> 0.556 -> 0.503 -> 0.370,
 * smooth and monotone throughout. An undamped bone alongside damped morphs would
 * be out of phase with the very channels it is supporting.
 *
 * So the demand carries the SAME smoothing stage, with the SAME constants, read
 * from the shipped female profile: `closureAttack` 34 and `closureRelease` 14.
 * This is not a second timing system — it is the closure channel's own damping,
 * applied to the closure signal, which is what puts the bone in phase with the
 * morphs rather than ahead of them.
 */

/** Which lower-face mechanisms are active. `morph-only` is production. */
export type LowerFaceMode = "morph-only" | "hybrid-jaw" | "hybrid-lower-face";

export interface FemaleUpperLipProfile {
  /** Single bone. It has no sibling sharing its pivot; the audit checked all 789. */
  readonly boneName: string;
  readonly axis: "x" | "y" | "z";
  readonly sign: 1 | -1;
  /**
   * Degrees at full bilabial closure demand. The bone is linear to R2 = 1.0
   * across 0.5..6 degrees, so this is a plain scale.
   */
  readonly maxDegrees: number;
  /** Hard rail. The audit swept to 6 degrees; nothing should exceed that. */
  readonly railDegrees: number;
  /**
   * Exponential smoothing speeds for the demand, in the same units as
   * `speechDeformationProfiles.smoothing`. These are that profile's own
   * `closureAttack` / `closureRelease`, restated here so the bone and the
   * closure morphs cannot drift apart if one is retuned without the other.
   */
  readonly attackSpeed: number;
  readonly releaseSpeed: number;
}

export const femaleUpperLipProfile: FemaleUpperLipProfile = {
  boneName: "FACIAL_C_MouthUpper",
  axis: "x",
  sign: 1,
  // Chosen by the angle sweep in the integrated prototype diagnostics, not
  // assumed. See docs/FEMALE_REALISM_REMEDIATION.md.
  maxDegrees: 2.5,
  railDegrees: 6,
  attackSpeed: 34,
  releaseSpeed: 14
};

/** Angles the prototype sweep compares. Measurement points, not recommendations. */
export const femaleUpperLipAngleSweep = [0, 1, 2, 2.5, 3, 4] as const;

export interface UpperLipDrive {
  /** Degrees applied to the upper-lip bone. */
  degrees: number;
  /** The damped demand that produced it. */
  demand: number;
  /** The raw demand before damping, for diagnostics. */
  rawDemand: number;
  /** True when the rail bound the request. */
  clamped: boolean;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Maps a damped bilabial closure demand to an upper-lip bone angle.
 *
 * One continuous mapping, deliberately with no phoneme in it. P, B and M differ
 * in TIMING, not in how far the lip travels, and the coarticulation engine
 * already expresses that difference in the demand it produces. A per-phoneme
 * angle table would be a second, contradictory statement of the same thing.
 *
 * Pure: the damping happens in the controller, which owns the only state.
 */
export const resolveUpperLipDrive = (
  dampedDemand: number,
  rawDemand: number,
  active: boolean,
  profile: FemaleUpperLipProfile = femaleUpperLipProfile
): UpperLipDrive => {
  const demand = active ? clamp01(dampedDemand) : 0;
  const requested = demand * profile.maxDegrees;
  const degrees = Math.min(requested, profile.railDegrees);
  return {
    degrees: degrees * profile.sign,
    demand,
    rawDemand: clamp01(rawDemand),
    clamped: requested > profile.railDegrees
  };
};
