/**
 * Hybrid jaw mapping — PROTOTYPE, disabled by default.
 *
 * Splits one canonical jaw demand into a paired bone rotation plus a reduced
 * `jawOpen` morph corrective. Nothing here runs in production: the default mode
 * is `"morph-only"`, which reproduces today's behaviour exactly (0 degrees of
 * rotation, the morph passed through untouched).
 *
 * Why two bones and never one
 * ---------------------------
 * `FACIAL_C_Jaw` is half a jaw. It owns the chin pad and the jawline skin —
 * 1,562 weighted vertex entries across 25 descendants, all on `Face002_4` — and
 * it reaches neither the lips, nor the teeth, nor the tongue. Its sibling
 * `FACIAL_C_LowerLipRotation` owns the other half: the lower lip, the lower
 * teeth and the whole tongue chain. The two have identical rest transforms
 * (same pivot to 0.0 mm, same orientation to 1.9e-5 degrees, same parent
 * `FACIAL_C_FacialRoot`), so rotating BOTH by one angle is a single rigid jaw
 * rotation, while rotating either alone tears the jaw in half. Measured: driving
 * `FACIAL_C_Jaw` alone contributes exactly 0 mm of mouth aperture at every angle
 * while adding 7.1 mm of chin travel. See the Jaw Bone / Morph Hybrid
 * Feasibility Audit in docs/FEMALE_REALISM_REMEDIATION.md.
 *
 * Why the mapping is linear
 * -------------------------
 * Both mechanisms were swept against measured vertical lip aperture on the
 * shipped GLB (`scripts/female-hybrid-jaw-prototype-diagnostics.mjs`):
 *
 *   morph:  6.38629 mm of aperture per unit of `jawOpen`   (R2 = 1.0000000)
 *   bone:   1.17559 mm of aperture per degree, paired      (R2 = 0.9999232)
 *
 * The morph is exactly linear because a morph blend is a linear interpolation.
 * The bone is very slightly sublinear — a rotating radius contributes
 * r*sin(theta) — losing 1.3 % of its slope between 0.5 and 7 degrees. Matching
 * aperture at full demand gives a single constant:
 *
 *   degreesPerUnitJawDemand = 5.43624
 *
 * and across the whole 0..1 demand range that one constant tracks the morph's
 * aperture to within **0.026 mm** worst case, against a 6.4 mm full-scale
 * aperture — 0.4 %. A nonlinear curve was measured and rejected on that number:
 * it would be modelling an error smaller than a fortieth of a millimetre.
 */

/** Which mechanism carries the physical jaw articulation. */
export type HybridJawMode = "morph-only" | "bones-only" | "hybrid";

export interface FemaleHybridJawProfile {
  /**
   * The paired bones. BOTH must be present and BOTH always receive the same
   * angle; this is one jaw mechanism expressed as two bones, not two controls.
   */
  readonly pairedBoneNames: readonly [string, string];
  /**
   * Local rotation axis. Measured, not assumed: local +x drives the chin down
   * with zero lateral component and a symmetric jawline, +y is a pure lateral
   * slide, and +z swings the chin sideways with 6 mm of midline drift.
   */
  readonly openingAxis: "x" | "y" | "z";
  /** Sign of the opening direction on that axis. */
  readonly openingSign: 1 | -1;
  /** Aperture-matched conversion, derived above. */
  readonly degreesPerUnitJawDemand: number;
  /**
   * Hard safety rail, in degrees.
   *
   * Raised to 9 for Female.228, which is now the active development asset.
   *
   * The history matters: 6 was the original cap, P11 raised it to 7 — the limit
   * female.glb had been swept clean to — and Female.228 was then measured on its
   * own rather than inheriting that number. Driving its paired bones alone from
   * 4 to 12 degrees produced no geometric failure at any angle: the lower teeth
   * stay behind the lower lip, the upper arch does not move AT ALL (this asset
   * re-authored JawOpen and the parasitic rise is gone), the tongue tracks at
   * 0.96, and the backward arc grows FASTER than the drop, so the motion becomes
   * more rotational rather than less as it opens.
   *
   * 9 rather than 12 because the rail is a safety limit, not a target: 9 covers
   * the recommended configuration with headroom and still stops a runaway gain.
   * The rail is a cap, so this changes nothing at any configuration that does not
   * reach it, including every female.glb configuration measured so far.
   */
  readonly maxDegrees: number;
  /**
   * Fraction of the jaw demand left on the `jawOpen` morph in `hybrid` mode.
   * 1 reproduces production, 0 is bone-only. The bone takes `1 - retention`.
   */
  readonly morphRetention: number;
  /**
   * Nonlinear expansion of the jaw demand reaching the BONE, as
   * `d * (1 + k*d^2)` clamped to 1. 0 is the linear behaviour.
   *
   * P12 traced why live speech opens far less than a held pose can. The
   * coarticulated target reaches 100.5 % of what the phoneme asks for, and the
   * damped demand reaches only 54 % of it — the target is right and the follower
   * cannot cross the distance before the phoneme ends. Median live jaw rotation
   * was 1.81 degrees against a rail of 9, with the rail never once reached, so
   * neither the rail nor the gain was the limiting factor.
   *
   * A first-order lag is linear in its target, so raising the target raises what
   * is delivered. A flat gain raises everything equally — measured, it inflated
   * reduced vowels by as much as strong ones and cost bilabial seals. This curve
   * is quadratic in demand, so it is nearly inert where demand is small: at
   * k=1.4 an open vowel gains 38.6 % of jaw rotation while reduced vowels gain
   * 6.7 % and bilabials, whose demand is about 0.018, are untouched. Measured
   * over the whole clip it costs ZERO additional visibly-open closures.
   *
   * Applied to the bone share only. The morph corrective stays on the raw
   * demand, so the authored morph is never pushed past what it was authored for.
   */
  readonly jawDemandExpansion: number;
}

export const femaleHybridJawProfile: FemaleHybridJawProfile = {
  pairedBoneNames: ["FACIAL_C_Jaw", "FACIAL_C_LowerLipRotation"],
  openingAxis: "x",
  openingSign: 1,
  degreesPerUnitJawDemand: 5.43624,
  // Raised from 9: at k=1.4 the strongest live vowel asks for 9.30 degrees, and
  // a bound rail flattens the top of the ladder silently. Female.228's bone
  // geometry measured credible to 12, so 11 leaves headroom inside the verified
  // range while still capping a runaway.
  maxDegrees: 11,
  // Placeholder until the sweep picks one. `hybrid` mode is not reachable in
  // production, so this value renders nowhere.
  morphRetention: 0.2,
  // 0 keeps the shipped linear behaviour. The dev panel applies P12's measured
  // value; production is morph-only and reaches none of this.
  jawDemandExpansion: 0
};

/**
 * The ratio ladder the prototype sweeps. Each entry is aperture-matched by
 * construction: bone degrees and morph retention always sum to the same
 * aperture, so the sweep compares SHAPE at constant opening.
 *
 * These are measurement points. None of them is a recommended production value.
 */
export const femaleHybridJawRatioSweep = [1, 0.8, 0.6, 0.4, 0.2, 0] as const;

export interface HybridJawDrive {
  /** Degrees applied to BOTH paired bones. */
  degrees: number;
  /** The `jawOpen` influence that should be written after the split. */
  correctiveJawOpen: number;
  /** Retention actually used, after the mode forced it. */
  morphRetention: number;
  /** True when the drive was clamped by `maxDegrees`. */
  clamped: boolean;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Splits a jaw demand into bone rotation and morph corrective.
 *
 * Pure: the same inputs always give the same outputs, with no state and no
 * clock of its own. That is what keeps the bone phase-locked to the morph —
 * both come out of one call, from one demand value, in one frame. Any smoothing
 * belongs upstream, where the demand is produced, so that both halves inherit
 * exactly the same timing.
 *
 * @param demand Rendered `jawOpen` influence, i.e. what the morph would receive today.
 */
export const resolveHybridJawDrive = (
  demand: number,
  mode: HybridJawMode,
  profile: FemaleHybridJawProfile = femaleHybridJawProfile
): HybridJawDrive => {
  const jawDemand = clamp01(demand);
  const retention =
    mode === "morph-only" ? 1 : mode === "bones-only" ? 0 : clamp01(profile.morphRetention);
  /**
   * The bone sees an expanded demand; the morph corrective below does not. Pure
   * and stateless like the rest of this function, so bone and morph still come
   * out of one call from one demand and stay phase-locked.
   */
  const k = profile.jawDemandExpansion ?? 0;
  const boneDemand = k > 0 ? clamp01(jawDemand * (1 + k * jawDemand * jawDemand)) : jawDemand;
  const requested = boneDemand * (1 - retention) * profile.degreesPerUnitJawDemand;
  const degrees = Math.min(requested, profile.maxDegrees);
  return {
    degrees: degrees * profile.openingSign,
    correctiveJawOpen: jawDemand * retention,
    morphRetention: retention,
    clamped: requested > profile.maxDegrees
  };
};
