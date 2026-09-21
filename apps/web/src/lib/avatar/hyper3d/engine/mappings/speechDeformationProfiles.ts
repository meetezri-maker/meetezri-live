import type { AvatarModelId } from "./avatarModelConfig";

/**
 * Per-model speech deformation profiles.
 *
 * Every model-specific number lives here. The controller itself contains no
 * female-only branches, so the male avatar is preserved by giving it a profile
 * with `enabled: false` — the controller then returns the phoneme pose untouched
 * and the male appearance is bit-identical to before this layer existed.
 *
 * Amplitudes were chosen against measured evidence, not ARKit convention:
 * `docs/evidence/coordinated-speech-deformation/female-lower-face-inventory.json`
 * records each target's peak vertex travel as a multiple of a full blink. On this
 * asset the lower-face targets are weak — a full-influence mouthUpperUpLeft travels
 * only 0.20x a blink — so supports that look large as numbers are small on screen.
 */

export interface SpeechDeformationLimits {
  jawOpen: number;
  mouthClose: number;
  upperLip: number;
  lowerLip: number;
  mouthCorner: number;
  cheek: number;
  pressure: number;
  funnel: number;
  pucker: number;
}

export interface SpeechWarmthConfig {
  /** Hard ceiling on the corner contribution, in influence units. */
  cornerCeiling: number;
  /** Hard ceiling on the cheek contribution. */
  cheekCeiling: number;
  /** How completely a fully rounded articulation cancels warmth. 1 = completely. */
  roundingSuppression: number;
  /** How completely a full bilabial closure cancels it. 1 = completely. */
  closureSuppression: number;
  /**
   * FINAL CONVERGENCE. Ceiling on conducted LOWER-FACE support, in influence
   * units, applied to `mouthUpperUp*` and `noseSneer*`.
   *
   * §P17.1 measured those two as the only channels that move visible tissue
   * below the nose on this asset — `mouthSmile` nets -0.03 mm of corner lift —
   * but they are `supportedChannels`, so during speech only this controller may
   * write them. Absent or 0 the mechanism is inert, which is every model except
   * the female avatar.
   */
  lowerFaceCeiling?: number;
}

export interface SpeechDeformationProfile {
  id: AvatarModelId;
  /** When false the controller is a pass-through. Preserves the shipped male look. */
  enabled: boolean;
  /**
   * Human-accepted global deformation strength for this model.
   *
   * This is the ACCEPTED BASELINE, not a tuning knob: it was arrived at by visual
   * review in the browser, so it is stored in the profile rather than left as
   * transient UI state. The dev panel's `strength` slider multiplies on top of it
   * and defaults to 1, so the shipped effective strength is exactly this value.
   */
  globalStrength: number;
  /**
   * Per-channel compensation applied AFTER globalStrength.
   *
   * globalStrength calms the whole face uniformly, which is the desired look, but
   * it also scales down channels that were already near the edge of perceptibility
   * (the cheeks especially). Compensation restores the BALANCE between channels
   * without restoring the old overall magnitude — it must never be used to undo
   * the accepted global value.
   */
  compensation: {
    jaw: number;
    upperLip: number;
    lowerLip: number;
    pressure: number;
    corners: number;
    cheek: number;
  };
  /** Canonical channels this model can actually render, measured from its GLB. */
  supportedChannels: string[];
  limits: SpeechDeformationLimits;
  /**
   * Phrase-level warmth merged by the coordinated layer (§P14).
   *
   * Absent, or with zero ceilings, the mechanism is inert.
   */
  warmth?: SpeechWarmthConfig;
  /**
   * Per-side multipliers that equalise RENDERED travel between paired morphs.
   *
   * A left/right morph pair on a real asset rarely moves the same amount of tissue
   * for the same influence, and driving both equally then renders lopsided. These
   * factors are measured, not chosen: see `docs/evidence/lower-face-regions/`.
   * They normalise around the geometric mean, so a pair's overall presence is
   * preserved while the lean is removed — deliberately NOT a reduction of the
   * stronger side to the weaker one, which would quietly lower the accepted level.
   *
   * The coordinated layer's own ±1-6% asymmetry then rides on top of a balanced
   * baseline instead of on top of a fixed structural lean.
   */
  sideBalance: Record<string, { left: number; right: number }>;
  /**
   * Ceilings that tie lip travel to the jaw aperture, in influence space.
   *
   * Both are re-applied AFTER per-channel compensation, which is the fix for a
   * defect this file's own comments claimed was impossible: the controller enforced
   * "the lower lip may not exceed the jaw" before compensation, and compensation
   * then multiplied the jaw by 0.45 and the lower lip by 1.15 — inverting the
   * relationship 2.56x immediately after establishing it.
   *
   * The coefficients are asset-derived. Per unit influence this GLB moves
   * jawOpen 0.429 of a blink, mouthShrugLower 0.383 and mouthUpperUp* 0.202, so a
   * coefficient of 1.0 means the lower lip may render at most 0.89x the jaw's
   * travel and the upper lip at most 0.47x — teeth exposure that develops with the
   * aperture instead of ahead of it.
   */
  jawCoupling: {
    /** Applies to the lower-lip channels while an opening is in progress. */
    lowerLip: number;
    /** Applies to the upper-lip channels on VOWELS only. */
    upperLip: number;
  };
  bilabials: {
    upperLipSupport: number;
    lowerLipSupport: number;
    pressureSupport: number;
    cheekCompression: number;
    jawMaximum: number;
    /** P is sharper than B; M sustains. Multipliers on attack/hold. */
    plosiveSharpness: number;
    voicedSoftness: number;
    nasalHold: number;
    /**
     * Multiplier on the JAW release speed while a bilabial closure is being demanded.
     *
     * A bilabial is a physical contact event: the jaw has to arrive, not merely head
     * in the right direction. The general-purpose `jawRelease` is deliberately slow
     * (§11 lowered it to 6 for smoothness on vowels) and at that rate the jaw is still
     * carrying half the preceding vowel's aperture when the lips are supposed to be
     * sealed. This scales the release speed — never the value — in proportion to the
     * closure demand, so vowel motion is untouched and the closure cannot step.
     *
     * 1 disables the mechanism, which is what the male profile uses.
     */
    jawClosureAcceleration: number;
  };
  vowels: {
    openJawSupport: number;
    upperLipSupport: number;
    lowerLipSupport: number;
    cheekRelaxation: number;
  };
  roundedSpeech: {
    funnelSupport: number;
    puckerSupport: number;
    cheekSupport: number;
    jawSupport: number;
    cornerNarrowing: number;
  };
  spreadSpeech: {
    cornerSupport: number;
    jawSupport: number;
    cheekSupport: number;
    maximumStretch: number;
  };
  consonants: {
    /** Ceiling on upper-lip lift for non-vowel families. */
    upperLipCeiling: number;
    /** Lower-face tension routed to noseSneer, kept very small. */
    tensionSupport: number;
    alveolarJaw: number;
    postalveolarRounding: number;
    velarJaw: number;
    rhoticRounding: number;
  };
  /** Debug isolation only; undefined means enabled. */
  overlapEnabled?: boolean;
  asymmetry: {
    ordinaryMinimum: number;
    ordinaryMaximum: number;
    expressiveMaximum: number;
    /** Seconds a phrase-level asymmetry choice persists before it may change. */
    phrasePersistence: number;
  };
  /**
   * Phase-aware damping speeds, in exponential-smoothing units (same convention as
   * `smoothingSpeedByRegion`). Higher is faster. Channels listed in
   * `ownedChannels` are damped HERE and excluded from the mixer's region damping,
   * so each channel keeps exactly one smoothing stage.
   */
  smoothing: {
    lipAttack: number;
    /** Bilabial seal. Separate from lip shaping so it can stay fast; see §11. */
    closureAttack: number;
    closureRelease: number;
    lipRelease: number;
    upperLipAttack: number;
    upperLipRelease: number;
    jawAttack: number;
    jawRelease: number;
    /**
     * Demand-adaptive multiplier on the jaw ATTACK only (§P13).
     *
     * `jawAttack` is scaled by `1 + jawOpeningResponse * target^2`, so it is
     * quadratic in the target the damper is chasing: inert where the target is
     * a closure, barely changed for a reduced vowel, and strongest for an open
     * one. 0 leaves the attack exactly as authored and is the off switch.
     *
     * Why the attack and not the amplitude: P12 measured the coarticulated
     * target reaching 100.5 % of what each phoneme asks for while the damped
     * demand reached 54 % of it, and delivery tracking DURATION rather than
     * vowel identity — 87 % for a 160 ms vowel against 47 % for a 40 ms one.
     * The target is already right; the follower cannot cross the distance in
     * the time a short vowel allows.
     *
     * Applied on the rising branch only, so `jawRelease` and the bilabial
     * closure acceleration below are untouched and the P/B/M architecture keeps
     * priority. Scaling the SPEED keeps the output a convex combination of its
     * previous value and its target, so no rate can overshoot.
     */
    jawOpeningResponse: number;
    cheekAttack: number;
    cheekRelease: number;
    cornerAttack: number;
    cornerRelease: number;
    pressureAttack: number;
    pressureRelease: number;
  };
}

/**
 * Male: pass-through.
 *
 * The male avatar's speech was not reported as a problem and the task forbids
 * changing its appearance. Rather than tune it to look the same, the controller is
 * disabled for it, which makes "unchanged" provable instead of approximate.
 */
export const minifaceMaleSpeechProfile: SpeechDeformationProfile = {
  id: "miniface-male",
  enabled: false,
  // Irrelevant while disabled, but neutral so a future enable cannot surprise.
  globalStrength: 1,
  compensation: { jaw: 1, upperLip: 1, lowerLip: 1, pressure: 1, corners: 1, cheek: 1 },
  supportedChannels: [],
  limits: { jawOpen: 1, mouthClose: 1, upperLip: 0, lowerLip: 0, mouthCorner: 0, cheek: 0, pressure: 0, funnel: 1, pucker: 1 },
  // Identity: this profile is disabled, and no equivalent measurement has been made
  // for miniface-male.glb. A future pass that enables the male path must measure its
  // own asset rather than inherit these.
  sideBalance: {},
  jawCoupling: { lowerLip: 1, upperLip: 1 },
  bilabials: { upperLipSupport: 0, lowerLipSupport: 0, pressureSupport: 0, cheekCompression: 0, jawMaximum: 1, plosiveSharpness: 1, voicedSoftness: 1, nasalHold: 1, jawClosureAcceleration: 1 },
  vowels: { openJawSupport: 0, upperLipSupport: 0, lowerLipSupport: 0, cheekRelaxation: 0 },
  roundedSpeech: { funnelSupport: 0, puckerSupport: 0, cheekSupport: 0, jawSupport: 0, cornerNarrowing: 0 },
  spreadSpeech: { cornerSupport: 0, jawSupport: 0, cheekSupport: 0, maximumStretch: 0 },
  consonants: { upperLipCeiling: 1, tensionSupport: 0, alveolarJaw: 0, postalveolarRounding: 0, velarJaw: 0, rhoticRounding: 0 },
  asymmetry: { ordinaryMinimum: 0, ordinaryMaximum: 0, expressiveMaximum: 0, phrasePersistence: 1 },
  smoothing: {
    lipAttack: 28, lipRelease: 28, closureAttack: 28, closureRelease: 28,
    upperLipAttack: 28, upperLipRelease: 28,
    jawAttack: 24, jawRelease: 24, jawOpeningResponse: 0,
    cheekAttack: 10, cheekRelease: 10, cornerAttack: 28, cornerRelease: 28,
    pressureAttack: 28, pressureRelease: 28
  }
};

/**
 * Female: the coordinated layer.
 *
 * Supports are deliberately modest. The measured travel of these targets is small
 * (0.16x-0.61x a blink at full influence), and at the portrait framing the lower
 * face occupies a small share of frame height, so the risk is under-reading rather
 * than over-driving. Every value below is an amplitude, never a timing.
 */
export const femaleSpeechProfile: SpeechDeformationProfile = {
  id: "female",
  enabled: true,
  // Human-accepted after browser review of the S2 build. Do not change without a
  // new visual review: the calmer face at this value is the accepted look.
  globalStrength: 0.12,
  /**
   * Measured compensation. See docs/evidence/speech-component-balance/cheek-analysis.json.
   *
   * globalStrength 0.12 scales every COORDINATED channel, but the jaw arrives from
   * the authored phoneme pose and passes through unscaled, so 0.12 silently made
   * the jaw dominant. Measured rendered travel as a fraction of a full blink:
   *
   *   jaw 0.214  |  closure 0.133  |  corners 0.0135  |  upper lip 0.0044  |  cheeks 0.004
   *
   * The jaw rendered 54x the cheeks. That single ratio is what reads as "the jaw
   * does too much" and "the cheeks cannot be seen" — not the global value.
   *
   * jaw 0.45  brought the jaw into the same regime as the lips without flattening
   *           AA/AH/AE, which stay distinct because the scale is multiplicative.
   *           **Raised to 0.70 on 2026-08-17.** A video review found the opposite
   *           complaint to the one 0.45 fixed: "jaw participation is too weak…
   *           lip/teeth change while the jaw/chin silhouette barely moves". The
   *           measurement agrees — see docs/FEMALE_REALISM_REMEDIATION.md §7 and
   *           docs/evidence/coordinated-speech-deformation/jaw-compensation-sweep.json.
   *           Settled rendered travel on AA, same methodology as the complaint that
   *           produced 0.45: 0.45 renders the jaw at 0.0965 of a blink, and the
   *           "jaw does too much" state was 0.214. 0.70 gives 0.1501, which is just
   *           under the midpoint of those two (0.1553 ≈ jaw 0.724) — the largest
   *           value that cannot be accused of restoring the old defect. Jaw against
   *           cheek goes 7.1x → 11x, against the 54x that triggered the original
   *           complaint; the ratio stays low because cheek compensation (3.2x) did
   *           not exist then. In a moving sequence the jaw also stops being
   *           out-travelled by its own lower lip on open vowels (jaw/lowerLip
   *           1.12 → 1.48).
   *
   *           **Raised to 1.0 on 2026-08-18**, i.e. the authored jaw now passes
   *           through this layer uncut. A review after §10 reported the mouth and
   *           teeth still do not open enough, which is direct evidence against the
   *           bound 0.70 was chosen under. That bound was "the largest value that
   *           cannot be accused of restoring the old defect", where the old defect
   *           was the jaw rendering 54x the cheeks. Cheek compensation (3.2x) now
   *           exists, so the ratio at 1.0 is 15.8x, not 54x — the ratio problem the
   *           compensation was introduced to solve is solved by a different value,
   *           and what remained was suppressing an absolute level that was never
   *           independently judged too large. Measured effect on the audit clip:
   *           jaw peak 0.295 -> 0.375 at the mixer, 0.561 -> 0.712 at the morph
   *           (+27%), with the open-vowel ladder not merely preserved but wider
   *           (AA 0.375 > AE 0.306 > AH 0.221 > IY 0.164 > UW 0.093). No frame
   *           clamps at the morph, so the ladder is not being flattened by
   *           saturation. The `limits.jawOpen` ceiling of 0.62 is NOT what was
   *           holding the jaw back and was left alone: it binds on 0 of 2236
   *           speaking frames, and no frame reaches even half of it.
   *
   *           Note for whoever revisits this: `globalStrength` is NOT an
   *           alternative lever for the jaw. It scales coordinated supports only,
   *           and the jaw is not one — it arrives from the authored phoneme pose
   *           and is touched by nothing in this layer except this compensation and
   *           the ceilings. Raising globalStrength raises the lips and cheeks
   *           around a jaw that does not move, which is the reviewed complaint
   *           made worse.
   * cheek 3.2 lifts cheeks from 0.004x to roughly corner level, still far below
   *           anything a viewer would consciously notice.
   * lowerLip 1.15 keeps the lower lip shaping the opening now that the jaw is
   *           lower, while staying under it — at 1.5 it overtook the jaw on AA and AE
   *           and read as a second competing opening.
   *
   * upperLip, pressure and corners stay at 1: all three were visually accepted at
   * 0.12 and must not be restored toward their pre-0.12 magnitudes.
   */
  compensation: { jaw: 1, upperLip: 1, lowerLip: 1.15, pressure: 1, corners: 1, cheek: 3.2 },
  /**
   * §P14 phrase-level warmth. ACTIVE, unlike the P12/P13 jaw levers.
   *
   * Those shipped inert because they belong to the hybrid-jaw prototype, which
   * production does not run. This is different: the coordinated layer IS the
   * production path for the female avatar, and P14 measured that the warmth
   * pulse never reached the speaking face at all — disabling its scheduler
   * outright changed not one frame of `mouthSmile` or `cheekSquint`, while the
   * same experiment on the brow scheduler changed the brow. Shipping this inert
   * would leave the defect in place.
   *
   * Chosen from a 0.04-0.34 sweep on the real clip. At these ceilings a visible
   * smile (>0.05) covers 6-18% of speaking frames across 16 seeds — occasional,
   * never constant — and every articulation channel is bit-identical to P13:
   * worst single-frame difference 0 on jaw, closure, pucker, funnel, press,
   * upper lip, lower lip, shrug and roll, and 0 mm of skinned lip-gap change at
   * every sampled bilabial.
   *
   * `roundingSuppression` and `closureSuppression` at 1 mean a fully rounded or
   * fully sealed mouth cancels warmth completely. They are the reason rounded
   * vowels stay rounded and the P/B/M seal is untouched; at 0 the smile during a
   * rounded vowel more than doubles (0.032 -> 0.087).
   */
  warmth: { cornerCeiling: 0.1, cheekCeiling: 0.22, roundingSuppression: 1, closureSuppression: 1, lowerFaceCeiling: 0.18 },
  // Measured live and directly supported on the updated female GLB. mouthStretch*,
  // mouthDimple* and cheekPuff are deliberately absent: they are Missing or Empty.
  supportedChannels: [
    "jawOpen", "mouthClose", "mouthPressLeft", "mouthPressRight",
    "mouthRollUpper", "mouthRollLower", "mouthShrugUpper", "mouthShrugLower",
    "mouthUpperUpLeft", "mouthUpperUpRight", "mouthLowerDownLeft", "mouthLowerDownRight",
    "mouthSmileLeft", "mouthSmileRight", "mouthFunnel", "mouthPucker",
    "cheekSquintLeft", "cheekSquintRight", "noseSneerLeft", "noseSneerRight"
  ],
  /**
   * Measured 2026-08-17 from public/models/female.glb, summed per-vertex morph
   * displacement (`docs/evidence/lower-face-regions/region-inventory.json`). The
   * right-over-left travel ratio at equal influence:
   *
   *   mouthPress 1.528  |  noseSneer 2.111  |  mouthUpperUp 1.080
   *   mouthSmile 1.055  |  mouthLowerDown 1.028  |  cheekSquint 0.900
   *
   * Identical under a whole-mesh sum and a significant-vertices-only sum, so these
   * are geometry rather than numerical noise. `mouthPress` is the one that matters
   * most in practice: it is the bilabial pressure channel, it peaks at influence
   * 0.43 on every P/B/M, and a 53% travel imbalance there is what reads as one
   * corner being independently pulled at exactly the strong-articulation moments
   * the 2026-08-17 review flagged. The coordinated layer's own asymmetry is at most
   * ±6%, so it was never the source.
   *
   * Each factor is sqrt(ratio) on the weaker side and 1/sqrt(ratio) on the stronger,
   * which equalises rendered travel while leaving the pair's mean unchanged.
   */
  sideBalance: {
    mouthSmile: { left: 1.027, right: 0.974 },
    mouthPress: { left: 1.236, right: 0.809 },
    mouthUpperUp: { left: 1.039, right: 0.962 },
    mouthLowerDown: { left: 1.014, right: 0.986 },
    cheekSquint: { left: 0.949, right: 1.054 },
    noseSneer: { left: 1.453, right: 0.688 }
  },
  jawCoupling: { lowerLip: 1, upperLip: 1 },
  limits: {
    jawOpen: 0.62,
    mouthClose: 1,
    upperLip: 0.34,
    lowerLip: 0.4,
    // Corners stay low on purpose: speech must never read as a held smile.
    mouthCorner: 0.22,
    // Cheeks are a supporting actor, consistent with the earlier cheek pass.
    cheek: 0.16,
    pressure: 0.72,
    funnel: 0.85,
    pucker: 0.85
  },
  bilabials: {
    // S2: 0.30 -> 0.15. Measured on the GLB, EVERY upper-lip channel moves the lip
    // UPWARD (mouthShrugUpper meanDY +8.8e-4 / meanDZ +1.8e-3; mouthUpperUp* pure
    // +1.1e-3 with no Z). There is no tuck-in morph on this asset, so a large
    // "upper lip support" during a closure literally lifts the lip off the teeth.
    // Driving it to the 0.34 limit is what exposed the upper teeth on P/B/M.
    // What remains is the forward-protrusion component, which reads as a seal.
    upperLipSupport: 0.15,
    lowerLipSupport: 0.26,
    pressureSupport: 0.62,
    cheekCompression: 0.13,
    // The jaw must stay nearly shut at closure; this is the ceiling, not a target.
    jawMaximum: 0.07,
    // S2: these are now RELEASE-TIME multipliers, not intensity multipliers.
    // Higher = faster release. P bursts open, M lets go slowly, B sits between.
    // Intensity separation failed because P and M both saturate the closure clamp.
    plosiveSharpness: 1.5,
    voicedSoftness: 1,
    nasalHold: 0.55,
    /**
     * 4.0, derived by sweep against a bound the asset sets for itself.
     *
     * The limit is not "how closed can the jaw get" but "how fast may it close": the
     * largest single-frame closing step must not exceed the largest single-frame
     * OPENING step the jaw already takes on the same clips, which is this face's own
     * demonstrated maximum rate rather than an invented threshold. Measured worst case
     * across all six probe sequences: opening 0.15176, and closing reaches 0.13710 at
     * 4.0 against 0.16339 at 5.0. So 4.0 is the last value that cannot be accused of
     * snapping. See docs/FEMALE_REALISM_REMEDIATION.md §14 and
     * docs/evidence/bilabial-jaw-closure/jaw-closure.json.
     */
    jawClosureAcceleration: 4
  },
  vowels: {
    openJawSupport: 0.52,
    // S2: 0.24 -> 0.17. mouthUpperUp* is pure vertical lift over 281 vertices —
    // the classic teeth-exposure channel. Open vowels may legitimately show teeth,
    // so this is reduced rather than removed.
    upperLipSupport: 0.17,
    lowerLipSupport: 0.34,
    cheekRelaxation: 0.55
  },
  roundedSpeech: {
    funnelSupport: 0.55,
    puckerSupport: 0.6,
    cheekSupport: 0.09,
    jawSupport: 0.26,
    cornerNarrowing: 0.7
  },
  spreadSpeech: {
    // S2: 0.17 -> 0.10 and the cap 0.22 -> 0.13. Spread vowels were measured as the
    // dominant smile source (corners settled at 0.173 on IY/IH/EH/EY, an order of
    // magnitude above every other family). A spread vowel needs mouth WIDTH, which
    // on this asset only mouthSmile* provides — so it is kept, but small enough
    // that it cannot read as a held pleasant expression.
    cornerSupport: 0.1,
    jawSupport: 0.2,
    // S2: cheeks removed from spread vowels entirely. Cheek squint plus wide
    // corners is precisely the geometry of a smile, and this pairing was the second
    // contributor to speech settling into one.
    cheekSupport: 0,
    maximumStretch: 0.13
  },
  consonants: {
    /**
     * Ceiling on upper-lip lift for every non-vowel family.
     *
     * The shared phoneme table authors mouthUpperUp* on F, V and L (0.22 / 0.18 /
     * 0.08), and that table is derived from the male profile, so it cannot be
     * retuned here without changing the male avatar. The coordinated layer owns
     * these channels, so the cap is applied at this layer instead. Open vowels are
     * exempt — they may legitimately show teeth.
     */
    upperLipCeiling: 0.14,
    tensionSupport: 0.1,
    alveolarJaw: 0.16,
    postalveolarRounding: 0.4,
    velarJaw: 0.2,
    rhoticRounding: 0.34
  },
  asymmetry: {
    ordinaryMinimum: 0.01,
    ordinaryMaximum: 0.035,
    expressiveMaximum: 0.06,
    // S2: 2.4 s -> 1.5 s. At 2.4 s a side could hold across several words, which is
    // what read as "stuck on one side". Shorter than a phrase still reads as
    // deliberate rather than jittery, because the value only changes on a boundary.
    phrasePersistence: 1.5
  },
  smoothing: {
    // Layered release. Release speed sets the ORDER things let go in, and the
    // brief asks for pressure -> upper lip -> corners -> jaw -> cheeks. Higher is
    // faster, so these must descend in exactly that sequence, with the gaps small
    // enough that the stages overlap rather than stepping one at a time.
    //
    //   pressure 20  >  upperLip 16  >  corner 12  >  jaw 9  >  cheek 5
    //
    // S2 fixed an inversion here: jaw (11) previously released faster than the
    // corners (9), so the mouth width outlived the jaw and the release read as
    // one synchronised block.
    //
    // 2026-08-18: every rate below except the closure pair was slowed, after a review
    // reported that motion still lacked smoothness. Measured cause: at the previous
    // rates a channel absorbed 39-45% of any target discontinuity in a SINGLE frame
    // (`upperLipAttack` 30 gives alpha 0.39 at 60 fps), so phoneme-boundary steps
    // passed through the smoother essentially intact. Response times were 1.7-2.0
    // frames for the lip and pressure groups — faster than any real articulator moves.
    // The ordering above is preserved throughout; only the magnitudes changed.
    // Evidence: docs/evidence/aperture-and-smoothness/.
    lipAttack: 20,
    lipRelease: 9,
    // Closure is exempt from the slowdown. A bilabial lasts 4-6 frames and the lips
    // must actually meet within it; slowing this pair with the rest cost 13% of
    // closure travel on P/B/M, which reads as lips that never quite seal.
    closureAttack: 34,
    closureRelease: 14,
    // The upper lip is the teeth-exposure channel, so it must return sooner than
    // the closure it supports rather than lingering lifted.
    upperLipAttack: 18,
    upperLipRelease: 11,
    jawAttack: 13.5,
    jawRelease: 6,
    jawOpeningResponse: 0,
    // Cheeks are last in and last out.
    cheekAttack: 5.5,
    cheekRelease: 3.5,
    cornerAttack: 10,
    cornerRelease: 8,
    pressureAttack: 30,
    pressureRelease: 14
  }
};

export const speechDeformationProfiles: Record<AvatarModelId, SpeechDeformationProfile> = {
  "miniface-male": minifaceMaleSpeechProfile,
  female: femaleSpeechProfile,
  /**
   * PHASE H1 placeholder. Hyper3D is a rendering-only integration for now, so it
   * reuses the current avatar's profile verbatim rather than getting a tuned one
   * of its own. Nothing about this asset has been measured for speech
   * deformation, and H1 never puts it into playback. Authoring a real profile is
   * H2+ work; this entry exists so the record stays exhaustive.
   */
  "hyper3d-usc": minifaceMaleSpeechProfile
};

export const getSpeechDeformationProfile = (id: AvatarModelId | undefined): SpeechDeformationProfile =>
  speechDeformationProfiles[id ?? "miniface-male"] ?? minifaceMaleSpeechProfile;

/**
 * Channels the coordinated controller damps itself.
 *
 * The mixer must skip its own region damping for these or every one of them would
 * be smoothed twice. Kept beside the profiles so the two lists cannot drift.
 */
export const coordinatedOwnedChannels: readonly string[] = femaleSpeechProfile.supportedChannels;
