import type { BlendshapePose } from "../types/facialAnimation";
import type { EmotionName } from "../types/avatarPayload";
import type { AvatarModelId } from "./avatarModelConfig";

export interface EmotionPoseDefinition { emotion: EmotionName; pose: BlendshapePose; defaultIntensity: number; mouthStrategy: "boundedAdd" | "protectLipsync"; notes: string; }

export const emotionToBlendshape: Record<EmotionName, EmotionPoseDefinition> = {
  neutral: { emotion: "neutral", pose: {}, defaultIntensity: 0, mouthStrategy: "protectLipsync", notes: "No fixed smile or brow bias." },
  happy: { emotion: "happy", pose: { mouthSmileLeft: .24, mouthSmileRight: .24, cheekSquintLeft: .18, cheekSquintRight: .18, browOuterUpLeft: .05, browOuterUpRight: .05 }, defaultIntensity: .65, mouthStrategy: "protectLipsync", notes: "Smile and cheek engagement, bounded so bilabials remain closed." },
  sad: { emotion: "sad", pose: { browInnerUp: .22, mouthFrownLeft: .18, mouthFrownRight: .18, mouthShrugLower: .05, eyeSquintLeft: .06, eyeSquintRight: .06 }, defaultIntensity: .55, mouthStrategy: "protectLipsync", notes: "Restrained sadness with inner brow and soft downturn." },
  concerned: { emotion: "concerned", pose: { browInnerUp: .18, browDownLeft: .1, browDownRight: .1, mouthPressLeft: .09, mouthPressRight: .09, eyeSquintLeft: .08, eyeSquintRight: .08 }, defaultIntensity: .55, mouthStrategy: "protectLipsync", notes: "Mixed inner brow lift and knit." },
  surprised: { emotion: "surprised", pose: { eyeWideLeft: .35, eyeWideRight: .35, browInnerUp: .24, browOuterUpLeft: .22, browOuterUpRight: .22, jawOpen: .08 }, defaultIntensity: .7, mouthStrategy: "protectLipsync", notes: "Eyes and brows own most of the surprise; jaw add is mild." },
  angry: { emotion: "angry", pose: { browDownLeft: .28, browDownRight: .28, eyeSquintLeft: .16, eyeSquintRight: .16, mouthPressLeft: .12, mouthPressRight: .12, jawOpen: .03 }, defaultIntensity: .55, mouthStrategy: "protectLipsync", notes: "Tension without cartoon exaggeration." },
  calm: { emotion: "calm", pose: { eyeSquintLeft: .03, eyeSquintRight: .03, mouthPressLeft: .02, mouthPressRight: .02 }, defaultIntensity: .35, mouthStrategy: "protectLipsync", notes: "Reduced amplitude, not a smile." },
  empathetic: { emotion: "empathetic", pose: { browInnerUp: .13, cheekSquintLeft: .07, cheekSquintRight: .07, mouthSmileLeft: .09, mouthSmileRight: .09, eyeSquintLeft: .04, eyeSquintRight: .04 }, defaultIntensity: .55, mouthStrategy: "protectLipsync", notes: "Supportive expression with gentle eyes and a very small smile." }
};

/**
 * Per-model pose replacements for emotions whose canonical pose leans on a channel
 * that cannot render — or renders the wrong thing — on that asset.
 *
 * Two measured facts about female.glb drive every substitution below. Both come
 * from scripts/female-brow-channel-measurement.mjs and the mesh-ownership dump in
 * scripts/female-live-channel-inventory.mjs, against the real GLB.
 *
 * 1. browDownLeft/browDownRight are declared but carry no geometry on any
 *    primitive, and no other live target moves brow-region vertices downward —
 *    `eyebrows` is a brow RAISE. Influence is clamped to [0,1] by
 *    `clampAvatarMorph`, so a negative brow raise is not available either. Brow
 *    depression simply has no renderable equivalent on this face; real brow-lower
 *    geometry is an asset-production item, not something code can synthesise.
 *
 * 2. eyeSquintLeft/eyeSquintRight carry their geometry on the `Eyes` mesh, not the
 *    face. Each moves its own eyeball laterally OUTWARD (mean dx +0.00075 left,
 *    -0.00075 right) and leaves the eyelids untouched. Driving both, as the
 *    canonical poses do, pushes the eyeballs apart into a divergent, wall-eyed
 *    stare instead of narrowing the eyes — and it deforms the same eyeball
 *    geometry that EyeGeometryController owns for gaze.
 *
 * The genuine orbital-narrowing channel on this asset is cheekSquintLeft/Right,
 * which lifts the lower lid and cheek on the face mesh (+y, 323 vertices each).
 * That is what replaces eyeSquint here, with noseSneer for mid-face tension,
 * mouthPress for lip compression and mouthFrown for corner depression.
 *
 * On amplitude. These look large next to the canonical poses, and they are — because
 * the substitute channels are weak on this asset. Measured peak vertex travel at
 * influence 1.0, as a fraction of a full blink: cheekSquint 0.26, noseSneer 0.21,
 * mouthFrown 0.32, mouthPress 0.14. A first pass at canonical-looking amplitudes
 * (cheekSquint 0.3) rendered angry's strongest component at 8% of a blink, which is
 * below the perceptual floor at the shipped camera framing — it was measurably
 * different from neutral and visually identical to it.
 *
 * The values below sit near their ceilings: each is bounded so that
 * `authored x defaultIntensity x femaleIntensityPreset` stays under 1.0 and does not
 * clamp. When they were authored the preset multiplied cheek by 1.5x1.3, nose by
 * 1.5x1.24, frown by 1.5x1.34 and brows by 1.5x1.48 — and that compounding stack
 * pushed four of them past the clamp anyway once a consonant was being spoken, since
 * the preset scales the whole mixed pose and not just lip-sync. `angry`'s
 * `cheekSquint` and `noseSneer` and `concerned`'s `browInnerUp` all clamped mid-word.
 * The preset was re-derived on 2026-08-13 to a single uniform gain of 1.9, under
 * which none of these values clamp in any phoneme context; the authored numbers are
 * unchanged and are still the most this face can express.
 * See docs/FEMALE_REALISM_REMEDIATION.md and
 * docs/evidence/female-intensity-rederivation/ — expression legibility on this asset
 * is ultimately an asset-production problem, not a tuning one.
 *
 * `miniface-male` is deliberately absent from this table: all 51 of its targets
 * measured live, its browDown pair works, and its eyeSquint targets sit on the face
 * mesh as intended, so it keeps the canonical poses byte-identical.
 */
export const femaleEmotionPoseOverrides: Partial<Record<EmotionName, BlendshapePose>> = {
  // cheekSquint + noseSneer lead instead of browDown. browInnerUp is deliberately
  // omitted: this asset's inner-brow target pulls UP, and an up-and-in brow reads
  // as worried rather than angry, so adding it would fight the expression.
  angry: {
    cheekSquintLeft: .75, cheekSquintRight: .75,
    noseSneerLeft: .7, noseSneerRight: .7,
    mouthPressLeft: .5, mouthPressRight: .5,
    mouthFrownLeft: .35, mouthFrownRight: .35,
    jawForward: .12,
    jawOpen: .04
  },
  // Concern is mostly an inner-brow lift, which IS live here (browInnerUp binds to
  // browInnerUpLeft/Right). Dropping the dead knit component and letting the lift
  // carry the expression costs little.
  concerned: {
    // 0.62 -> 0.72 on 2026-08-13. The superseded preset multiplied brow channels by
    // 1.5 x 1.48 = 2.22; the re-derived uniform gain is 1.9. These three browInnerUp
    // values are rescaled by 2.22/1.9 = 1.168 so the brow lift lands where it was
    // authored to land — `concerned` is the one emotion this document records as
    // reading correctly, and it is not worth losing 14% of it to the preset change.
    // Verified non-clamping in every phoneme context:
    // docs/evidence/female-intensity-rederivation/saturation-report.json.
    browInnerUp: .72,
    cheekSquintLeft: .28, cheekSquintRight: .28,
    mouthPressLeft: .3, mouthPressRight: .3,
    mouthFrownLeft: .22, mouthFrownRight: .22,
    noseSneerLeft: .15, noseSneerRight: .15
  },
  // The remaining overrides exist only to keep the canonical eyeSquint component
  // off this asset's eyeballs. Amplitudes mirror the canonical poses, re-pointed at
  // cheekSquint; everything else in each pose is unchanged, except `browInnerUp`,
  // which carries the same 2.22/1.9 preset rescale as `concerned` above so the brow
  // lift renders at the amplitude it was authored for.
  sad: {
    // Rescaled with `concerned` above: 0.22 x 2.22/1.9.
    browInnerUp: .26,
    mouthFrownLeft: .18, mouthFrownRight: .18,
    mouthShrugLower: .05,
    cheekSquintLeft: .06, cheekSquintRight: .06
  },
  calm: {
    cheekSquintLeft: .03, cheekSquintRight: .03,
    mouthPressLeft: .02, mouthPressRight: .02
  },
  empathetic: {
    // Rescaled with `concerned` above: 0.13 x 2.22/1.9.
    browInnerUp: .15,
    cheekSquintLeft: .11, cheekSquintRight: .11,
    mouthSmileLeft: .09, mouthSmileRight: .09
  }
};

/** The pose an emotion should use on a given model, after dead-channel substitution. */
export const resolveEmotionPose = (emotion: EmotionName, modelId: AvatarModelId): BlendshapePose =>
  (modelId === "female" ? femaleEmotionPoseOverrides[emotion] : undefined) ?? emotionToBlendshape[emotion].pose;
