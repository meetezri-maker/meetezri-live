import { minifaceMalePhonemeProfile, type MinifaceMalePhonemeDefinition } from "./avatars/minifaceMalePhonemeProfile";
import { femalePhonemeProfile } from "./avatars/femalePhonemeProfile";
import { DIPHTHONG_GLIDES, hyper3dPhonemeProfile } from "./avatars/hyper3dVowelProfile";
import type { AvatarModelId } from "./avatarModelConfig";
import type { SupportedPhoneme } from "./phonemeAliases";
import type { PhonemePoseDefinition } from "../types/facialAnimation";

const toRuntimeDefinition = (definition: MinifaceMalePhonemeDefinition): PhonemePoseDefinition => ({
  phoneme: definition.phoneme,
  viseme: definition.viseme,
  category: definition.category,
  pose: definition.morphTargets,
  attack: definition.attack ?? 0.035,
  holdBias: definition.holdBias ?? 0.55,
  release: definition.release ?? 0.055,
  defaultIntensity: definition.defaultIntensity,
  intensityMin: definition.intensityMin,
  intensityMax: definition.intensityMax,
  jawDominance: definition.jawDominance,
  lipDominance: definition.lipDominance,
  coarticulationBefore: definition.coarticulationBefore ?? 0.45,
  coarticulationAfter: definition.coarticulationAfter ?? 0.55,
  notes: definition.notes ?? ""
});

const toRuntimeProfile = (profile: Record<string, MinifaceMalePhonemeDefinition>) =>
  Object.fromEntries(
    Object.entries(profile)
      .filter(([phoneme]) => phoneme !== "_" && phoneme !== "UNKNOWN")
      .map(([phoneme, definition]) => [phoneme, toRuntimeDefinition(definition)])
  ) as Record<SupportedPhoneme, PhonemePoseDefinition>;

export const phonemeToBlendshape = toRuntimeProfile(minifaceMalePhonemeProfile);

/**
 * Female speech poses, authored against female.glb's measured geometry rather than
 * inherited from the male table. See `avatars/femalePhonemeProfile.ts` for why the
 * shapes differ — chiefly that this asset has no lip-spread capability and no
 * renderable `mouthStretch*`, which the male table relies on in 20 of 39 phonemes.
 */
export const femalePhonemeToBlendshape = toRuntimeProfile(femalePhonemeProfile);

/**
 * Hyper3D speech poses: the male table with DIFFERENTIATED VOWELS, the corrected
 * postalveolars and the two consonants that measured below their own visibility
 * thresholds. P, B and M are the male entries unchanged — see
 * `avatars/hyper3dVowelProfile.ts` for every measurement that drove them.
 *
 * The five diphthongs additionally carry an `onsetPose`/`offglidePose` pair. The
 * glide table is attached HERE, in the one place the runtime profile is built,
 * rather than inside the pose table, so `hyper3dPhonemeProfile` keeps the male
 * table's exact shape and the accepted `morphTargets` contracts keep holding.
 */
export const hyper3dPhonemeToBlendshape = Object.fromEntries(
  Object.entries(toRuntimeProfile(hyper3dPhonemeProfile)).map(([phoneme, definition]) => {
    const glide = DIPHTHONG_GLIDES[phoneme];
    return glide
      ? [phoneme, { ...definition, onsetPose: glide.onset, offglidePose: glide.offglide }]
      : [phoneme, definition];
  })
) as Record<SupportedPhoneme, PhonemePoseDefinition>;

export const unknownPhonemeFallback = toRuntimeDefinition(minifaceMalePhonemeProfile.UNKNOWN);

/** The speech profile a model should articulate with. */
export const getPhonemeProfile = (modelId: AvatarModelId) => {
  if (modelId === "female") return femalePhonemeToBlendshape;
  if (modelId === "hyper3d-usc") return hyper3dPhonemeToBlendshape;
  return phonemeToBlendshape;
};
