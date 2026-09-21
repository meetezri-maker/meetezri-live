import type { BlendshapePose } from "../types/facialAnimation";
import type { FacialCueType } from "../types/avatarPayload";
import type { AvatarModelId } from "./avatarModelConfig";

export const facialCueToBlendshape: Record<FacialCueType, { channel: "mouth" | "brows" | "eyes" | "cheeks" | "head" | "gaze"; pose: BlendshapePose; notes: string }> = {
  brow_raise: { channel: "brows", pose: { browInnerUp: .3, browOuterUpLeft: .24, browOuterUpRight: .24 }, notes: "Manual brow lift." },
  brow_lower: { channel: "brows", pose: { browDownLeft: .28, browDownRight: .28 }, notes: "Manual brow lower." },
  small_smile: { channel: "mouth", pose: { mouthSmileLeft: .18, mouthSmileRight: .18 }, notes: "Small bounded smile." },
  full_smile: { channel: "mouth", pose: { mouthSmileLeft: .38, mouthSmileRight: .38, cheekSquintLeft: .14, cheekSquintRight: .14 }, notes: "Larger smile, still bounded against closure." },
  frown: { channel: "mouth", pose: { mouthFrownLeft: .28, mouthFrownRight: .28 }, notes: "Manual frown." },
  eye_squint: { channel: "eyes", pose: { eyeSquintLeft: .26, eyeSquintRight: .26 }, notes: "Manual squint." },
  eye_widen: { channel: "eyes", pose: { eyeWideLeft: .35, eyeWideRight: .35 }, notes: "Manual widen." },
  cheek_raise: { channel: "cheeks", pose: { cheekSquintLeft: .22, cheekSquintRight: .22 }, notes: "Cheek activation." },
  lip_press: { channel: "mouth", pose: { mouthPressLeft: .3, mouthPressRight: .3, mouthClose: .25 }, notes: "Press without replacing speech." },
  head_nod: { channel: "head", pose: {}, notes: "Handled by BoneController when head bones exist." },
  head_tilt_left: { channel: "head", pose: {}, notes: "Handled by BoneController when head bones exist." },
  head_tilt_right: { channel: "head", pose: {}, notes: "Handled by BoneController when head bones exist." },
  look_left: { channel: "gaze", pose: { eyeLookOutLeft: .2, eyeLookInRight: .2 }, notes: "Synchronized left look." },
  look_right: { channel: "gaze", pose: { eyeLookInLeft: .2, eyeLookOutRight: .2 }, notes: "Synchronized right look." },
  look_up: { channel: "gaze", pose: { eyeLookUpLeft: .18, eyeLookUpRight: .18 }, notes: "Synchronized up look." },
  look_down: { channel: "gaze", pose: { eyeLookDownLeft: .18, eyeLookDownRight: .18 }, notes: "Synchronized down look." }
};

/**
 * Per-model cue pose replacements, for the same reasons as
 * `femaleEmotionPoseOverrides`: browDownLeft/browDownRight carry no geometry on
 * female.glb, so the canonical `brow_lower` pose — which is built entirely from
 * that pair — renders as nothing at all on this model; and eyeSquintLeft/Right
 * deform the eyeballs outward rather than narrowing the lids.
 *
 * There is no brow-depression target to swap in; measurement found none on the
 * asset. This substitutes the nearest readable tension the face can produce
 * (cheekSquint lifts the lower lid, noseSneer adds mid-face tension), and is a
 * proxy rather than an equivalent.
 *
 * The gaze cues (look_left/look_right) also resolve to empty bindings on female,
 * but that is correct and intentional: EyeGeometryController owns gaze on this
 * asset and the eyeLook* channels are unbound so gaze is not double-driven.
 */
export const femaleFacialCuePoseOverrides: Partial<Record<FacialCueType, BlendshapePose>> = {
  // Cues carry no defaultIntensity multiplier, so these are bounded directly against
  // the female intensity preset. They were authored against the superseded Strong B
  // stack (cheek 1.5x1.3, nose 1.5x1.24) and clamped anyway — that stack reached
  // 4.29x on cheekSquint during a bilabial, because the preset scales the whole mixed
  // pose and its category factors apply to cue channels too. Under the uniform 1.9
  // gain accepted on 2026-08-13 they stay clear of the clamp in every phoneme
  // context; see docs/evidence/female-intensity-rederivation/.
  brow_lower: {
    cheekSquintLeft: .5, cheekSquintRight: .5,
    noseSneerLeft: .45, noseSneerRight: .45,
    mouthPressLeft: .25, mouthPressRight: .25
  },
  // Same eyeball-divergence problem as the emotion table: eyeSquint* deform the
  // Eyes mesh outward on this asset rather than narrowing the lids.
  eye_squint: {
    cheekSquintLeft: .5, cheekSquintRight: .5,
    noseSneerLeft: .2, noseSneerRight: .2
  }
};

/** The pose a cue should use on a given model, after dead-channel substitution. */
export const resolveFacialCuePose = (type: FacialCueType, modelId: AvatarModelId): BlendshapePose =>
  (modelId === "female" ? femaleFacialCuePoseOverrides[type] : undefined) ?? facialCueToBlendshape[type].pose;
