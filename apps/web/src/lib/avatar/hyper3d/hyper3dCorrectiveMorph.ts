import type { PhonemePoseDefinition, BlendshapePose } from "./engine/types/facialAnimation";
import type { SupportedPhoneme } from "./engine/mappings/phonemeAliases";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2 — `mouthLowerDownDeep`, the experimental lower-lip correction.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS IS FOR. Stage 1B built a corrective morph into
 * `female_2291-lowerlip-v2.glb` because the shipped asset has no channel that
 * drops the inner lower lip: `jawOpen` moves it 21.83 mm and
 * `mouthLowerDownLeft/Right` only 1.84-2.17 mm, a 10:1 ratio, and
 * `mouthLowerDown` is authored as a CHIN morph (10 % of its energy within 10 mm
 * of the lips). This module is the whole runtime side of that experiment.
 *
 * IT IS INERT UNLESS BOTH THINGS ARE TRUE: a DEV build has selected the
 * experimental asset, AND the controller was handed the corrective profile.
 * Production selects `female_2291.glb`, which has 51 morphs and no
 * `mouthLowerDownDeep`, and is handed the base profile — so the channel is never
 * written and this module contributes nothing. There is no code path by which a
 * production frame reads a corrective weight.
 *
 * NO NEW MACHINERY. The correction rides the EXISTING pipeline end to end:
 *
 *   it is a channel in a phoneme POSE, so `CoarticulationEngine` blends it with
 *   the same look-behind, look-ahead and duration-aware envelope as every other
 *   channel
 *
 *   `FacialPoseMixer` follows it with the one accepted follower
 *
 *   `calibrateHyper3dPose` caps it, and `MorphTargetController` writes it —
 *   still the single final morph writer
 *
 * No second clock, no second animation system, no second writer. The only thing
 * this module adds beyond a pose value is the bilabial suppression below, which
 * is one multiplier on one channel.
 */

/** The morph the experimental asset adds. Absent from the production GLB. */
export const CORRECTIVE_MORPH = "mouthLowerDownDeep";

/**
 * STAGE 1B MEASUREMENT WEIGHTS, and explicitly not accepted values.
 *
 * These are the weights the Stage 1B geometry was measured at — AA 0.85,
 * AH 0.50, AE 0.70 — scaled by each vowel's own aperture, so the vowel that
 * opens most receives most correction. At the asset's 3.0 mm amplitude they
 * deliver, on the inner lower lip:
 *
 *   AA   10.41 -> 12.19 mm      aperture 18.45 -> 20.23 mm
 *   AH    5.08 ->  6.13 mm      aperture 12.28 -> 13.33 mm
 *   AE    8.54 -> 10.00 mm      aperture 15.60 -> 17.06 mm
 *
 * with `jawOpen` byte-identical in both columns, so the aperture gain is lip
 * rather than jaw. EVERY OTHER PHONEME IS ZERO — not small, absent, so the
 * channel does not appear in their pose at all.
 */
export const CORRECTIVE_TARGETS: Readonly<Record<string, number>> = Object.freeze({
  AA: 0.85,
  AH: 0.5,
  AE: 0.7
});

/**
 * The phonemes whose closure the correction must never disturb.
 *
 * `P`, `B`, `M` are the bilabials. Their poses carry no correction, but a pose
 * carrying none is NOT the same as a frame carrying none — see the suppression
 * note below.
 */
export const BILABIAL_PHONEMES: ReadonlySet<string> = new Set(["P", "B", "M"]);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BILABIAL SUPPRESSION — the primary acceptance gate.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY ZEROING THE BILABIAL POSE IS NOT ENOUGH, and this is the whole reason the
 * mechanism exists. Three separate parts of the accepted pipeline carry a vowel
 * value forward into a following consonant:
 *
 *   COARTICULATION LOOK-BEHIND. `CoarticulationEngine` blends the PREVIOUS
 *   phoneme into the current one across `coarticulation_window` (80 ms shipped),
 *   so an AA immediately before an M contributes its pose — including the
 *   correction — into M's own frames.
 *
 *   ENVELOPE RELEASE. A phoneme's contribution does not end at its boundary; it
 *   falls over `release`, which overlaps the next label.
 *
 *   FOLLOWER LAG. `FacialPoseMixer` is an exponential follower. Even against a
 *   target that has already reached zero it approaches it geometrically, shedding
 *   a fixed fraction per frame and never arriving.
 *
 * WHAT WAS MEASURED, and it is why this mechanism has two halves rather than
 * one. The first implementation ramped only the TARGET, reaching zero at the
 * closure onset. Residual rendered correction inside closure intervals, over the
 * four aligned payloads:
 *
 *   lead   drain    max residual in closure
 *   0.12    0.00         0.09938
 *   0.14    0.06         0.02018
 *   0.18    0.09         0.01045
 *
 * No pair reached zero, and the reason is arithmetic rather than tuning:
 * `mouthLowerDownDeep` is not in `LIP_SHAPE_CHANNELS`, so it follows
 * `smoothingSpeedByRegion.mouth = 28`, and taking AA's 0.85 down to 0.01 costs
 * `ln(85)/28 = 159 ms` of pure drain BEFORE any ramp. Buying that from the
 * preceding vowel costs real articulation (median reach 75.3 % -> 70.9 % across
 * that table), and it still only approaches zero asymptotically. A target ramp
 * cannot outrun the follower it feeds, so it is the wrong instrument for an
 * exactness requirement.
 *
 * THE MECHANISM, therefore: ONE multiplier on ONE channel, evaluated once per
 * frame from the aligned timeline, APPLIED TWICE — once to the target and once
 * to the rendered value.
 *
 *   lead = (start of the next bilabial) - (now)
 *   suppression = 0                          when lead <= 0   (at or past onset)
 *               = smootherstep(lead / LEAD)  when 0 < lead < LEAD
 *               = 1                          when lead >= LEAD or none ahead
 *
 *   BEFORE THE FOLLOWER it scales the blended pose. This is what catches the
 *   coarticulation look-behind and the envelope release — a pose-only rule
 *   cannot, because the previous phoneme's correction is already mixed in. It
 *   also keeps the follower's own state low approaching a closure, which is what
 *   makes the release smooth rather than a step.
 *
 *   AFTER THE FOLLOWER it scales the output. This is what makes the guarantee
 *   EXACT: zero times anything is zero, so no amount of follower lag can carry
 *   correction into a closure. It is evaluated even on frames whose pose carries
 *   no correction at all — which is precisely the leaking case, since a bilabial
 *   pose has no correction channel for the first half to scale.
 *
 * Both halves are the same number on the same channel, so the suppression can
 * only ever REMOVE correction, never add closure. `mouthClose`, `mouthPress*`,
 * the jaw speeds and the convergence profile are untouched, and nothing
 * compensates anywhere else.
 *
 * "WHEN THE TIMELINE PROVIDES SUFFICIENT LEAD TIME", from §4 of the brief. It
 * sometimes does not — a 30 ms vowel immediately before a bilabial gives 30 ms,
 * not 140. The ramp handles that correctly by construction: it is a function of
 * the lead actually available, so a short lead simply starts the decay lower,
 * and the post-follower half holds regardless of how little warning there was.
 *
 * READ-ONLY, AND THAT IS STRUCTURAL. This function takes a time and a lookahead
 * and returns a number. It cannot write a clock, cannot move a phoneme and
 * cannot reach the audio — so "no timing drift" is a property of the signature,
 * not something the tests have to establish.
 */
/**
 * HOW LONG THE RAMP IS, and it is a dominance argument on measured numbers
 * rather than a guess at a comfortable-looking duration.
 *
 * Because the output side makes the closure exact at ANY lead, the lead no
 * longer buys safety — it buys smoothness, and it is paid for in articulation.
 * Over the four aligned payloads, gate on both sides, drain zero:
 *
 *   lead   residual   max step   reach   reach where gate is open
 *   0.06    0.00000     0.3545   75.9 %            78.5 %
 *   0.08    0.00000     0.2591   75.0 %            78.3 %
 *   0.10    0.00000     0.2401   74.0 %            78.7 %   <- shipped
 *   0.12    0.00000     0.2401   73.0 %            78.7 %
 *   0.14    0.00000     0.2401   71.9 %            78.7 %
 *   0.18    0.00000     0.2401   70.9 %            78.3 %
 *
 * 0.10 DOMINATES every longer lead: the same worst step to five decimals, and
 * strictly more articulation. The step stops improving at 0.10 because beyond
 * that the worst step is no longer the gate at all — it is the correction
 * RISING on the vowel after a closure, from a cleanly zeroed start, and that
 * saturates once the lead is long enough to zero it. Shortening further does buy
 * reach, but 0.08 costs +8 % on the step and 0.06 costs +48 %, because an 80 ms
 * ramp is 4.8 frames at 60 Hz and smootherstep's steepest point then lands
 * inside a single frame.
 *
 * The ungated channel's own worst step is 0.2273, so the gate's 0.2401 is 5.6 %
 * more motion than the correction already has — 0.038 mm of extra lower-lip
 * travel in a frame, at the asset's 3.0 mm amplitude. That excess is intrinsic
 * to removing the correction at all, not a tuning failure.
 */
export const CORRECTIVE_BILABIAL_LEAD_SECONDS = 0.1;

/**
 * THERE IS NO DRAIN MARGIN, and that is a measured result rather than an
 * omission.
 *
 * One was implemented first — hold the target at zero for some time BEFORE the
 * onset, so the follower has frames to shed in. With the post-follower half in
 * place that reasoning is void: the residual is exactly zero at every drain
 * including zero, because zero times the follower's state is zero. And a drain
 * is worse than useless, because it shortens the span the ramp has to cross and
 * the output side has no smoothing downstream of it:
 *
 *   drain   max step   median reach
 *   0.00      0.2401       74.0 %
 *   0.03      0.2401       73.0 %
 *   0.06      0.2718       70.9 %
 *   0.09      0.4704       70.7 %
 *
 * So the gate ramps across the whole lead and closes exactly at the onset. The
 * `drainSeconds` parameter below survives only so
 * `hyper3dCorrectiveSuppression.sweep.test.ts` can keep demonstrating this; no
 * caller passes it.
 */

const smootherstep = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * The suppression multiplier for this frame.
 *
 * `nextBilabialStart` is the audio-clock time at which the next P/B/M begins,
 * or `null` when none is within the horizon.
 *
 *   lead >= leadSeconds    -> 1     the correction is free
 *   lead <= drainSeconds   -> 0     closed (drainSeconds is 0: at and past the onset)
 *   between                -> smootherstep across the remaining window
 *
 * A non-finite value yields FULL suppression rather than a NaN, so a malformed
 * payload closes the correction down instead of leaking one — the safe direction
 * for a mechanism whose only job is to protect a closure.
 */
export const correctiveBilabialSuppression = (
  nowSeconds: number,
  nextBilabialStart: number | null,
  leadSeconds = CORRECTIVE_BILABIAL_LEAD_SECONDS,
  drainSeconds = 0
): number => {
  if (nextBilabialStart === null) return 1;
  if (!Number.isFinite(nextBilabialStart) || !Number.isFinite(nowSeconds)) return 0;
  const lead = nextBilabialStart - nowSeconds;
  if (!(lead > drainSeconds)) return 0;
  if (lead >= leadSeconds) return 1;
  const span = leadSeconds - drainSeconds;
  if (!(span > 0)) return 0;
  return smootherstep((lead - drainSeconds) / span);
};

/**
 * THE GATE'S TWO HALVES, as functions, so there is exactly one implementation.
 *
 * `AvatarController` calls both, on either side of the follower. The runtime and
 * sweep tests call the same two rather than re-deriving them, because a test
 * that re-implements the mechanism it is checking can agree with itself while
 * both halves are wrong — which is how the first version of this shipped a leak
 * past a passing suite.
 *
 * Both take the pose by reference and mutate one key, which is what the
 * controller already does with its own blended pose; neither reads any other
 * channel, and the factor is in [0,1], so neither can add correction.
 */

/**
 * BEFORE THE FOLLOWER: scale the blended correction target.
 *
 * Catches the coarticulation look-behind and the envelope release, which a
 * pose-only rule cannot — the previous phoneme's correction is already mixed in
 * by the time the pose exists. Also keeps the follower's own state low into a
 * closure, so the gate has little left to hide.
 */
export const applyCorrectiveTargetGate = (pose: BlendshapePose, suppression: number): void => {
  if (suppression >= 1) return;
  if (pose[CORRECTIVE_MORPH] === undefined) return;
  if (suppression <= 0) delete pose[CORRECTIVE_MORPH];
  else pose[CORRECTIVE_MORPH] *= suppression;
};

/**
 * AFTER THE FOLLOWER: the rendered correction, scaled.
 *
 * This is the half that makes the guarantee exact. The follower is geometric, so
 * against a target that reached zero it sheds a fraction per frame and never
 * arrives; scaling the target alone left a measured 0.099 inside closure
 * intervals. Zero times the follower's state is zero, whatever that state is.
 *
 * Applied even on frames whose pose carried no correction, which is precisely
 * the leaking case: a bilabial's pose has no correction channel for the first
 * half to scale.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT RETURNS A POSE INSTEAD OF MUTATING ONE, AND THAT IS NOT A STYLE CHOICE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `FacialPoseMixer.smooth` returns `this.current` BY REFERENCE — the follower's
 * own double-buffered state, not a copy. An in-place version of this function
 * therefore wrote into the follower: the gated value became the next frame's
 * starting point, so the suppression compounded frame over frame and persisted
 * after the gate reopened. It was measurable — median open-vowel reach fell from
 * 74.0 % to 73.6 % purely from that feedback — and it meant the gate was quietly
 * doing something the design does not claim, namely modifying accepted follower
 * state.
 *
 * So the gate copies. The copy is a shallow spread of one frame's pose, and it
 * happens ONLY when the gate is actually attenuating: at suppression 1, or with
 * the channel absent, the original object is returned untouched and nothing is
 * allocated. In production that is every frame.
 */
export const gateCorrectiveOutput = (pose: BlendshapePose, suppression: number): BlendshapePose => {
  if (suppression >= 1) return pose;
  if (pose[CORRECTIVE_MORPH] === undefined) return pose;
  const gated: BlendshapePose = { ...pose };
  gated[CORRECTIVE_MORPH] = suppression <= 0 ? 0 : pose[CORRECTIVE_MORPH]! * suppression;
  return gated;
};

/**
 * The corrective speech profile: the shipped Hyper3D table with
 * `mouthLowerDownDeep` added to the three open vowels and to nothing else.
 *
 * BUILT ONCE, held by identity. The controller compares profile objects to
 * decide whether its tuning cache is still valid, so handing it a fresh object
 * every frame would defeat that. Nothing else about any pose is touched — not
 * `jawOpen`, not `mouthLowerDown`, not attack, release, intensity, viseme or
 * category — so the only difference between this profile and production's is one
 * extra channel on AA, AH and AE.
 */
export const hyper3dCorrectiveProfile: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(hyper3dPhonemeToBlendshape as Record<string, PhonemePoseDefinition>).map(
        ([phoneme, definition]) => {
          const weight = CORRECTIVE_TARGETS[phoneme];
          if (weight === undefined) return [phoneme, definition];
          const withCorrection: PhonemePoseDefinition & {
            onsetPose?: BlendshapePose;
            offglidePose?: BlendshapePose;
          } = {
            ...(definition as PhonemePoseDefinition & {
              onsetPose?: BlendshapePose;
              offglidePose?: BlendshapePose;
            }),
            pose: { ...definition.pose, [CORRECTIVE_MORPH]: weight }
          };
          /**
           * A diphthong's glide ends carry the correction too, at the SAME value
           * at both ends — so `onset + offglide = 2 x pose` still holds and the
           * accepted pose remains the phoneme's exact temporal midpoint. None of
           * AA, AH or AE is a glide today; this is here so adding one later
           * cannot silently break that identity.
           */
          if (withCorrection.onsetPose) {
            withCorrection.onsetPose = { ...withCorrection.onsetPose, [CORRECTIVE_MORPH]: weight };
          }
          if (withCorrection.offglidePose) {
            withCorrection.offglidePose = { ...withCorrection.offglidePose, [CORRECTIVE_MORPH]: weight };
          }
          return [phoneme, withCorrection];
        }
      )
    )
  ) as Partial<Record<SupportedPhoneme, PhonemePoseDefinition>>;

/** Every phoneme whose pose this profile changes. For the identity proofs. */
export const CORRECTIVE_PHONEMES = Object.keys(CORRECTIVE_TARGETS);
