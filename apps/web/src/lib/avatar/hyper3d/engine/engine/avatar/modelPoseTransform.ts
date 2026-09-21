import type { AvatarModelConfig } from "../../mappings/avatarModelConfig";
import { calibrateHyper3dPose } from "../../mappings/avatars/hyper3dCalibration";
import {
  femaleIntensityPresets,
  femaleNativeVisemeNames,
  femaleNativeVisemeRuntimeConfig,
  femalePhonemeVisemeMap,
  type FemaleIntensityPresetId,
  type FemalePhonemeVisemeEntry
} from "../../mappings/femaleVisemeConfig";
import type { SupportedPhoneme } from "../../mappings/phonemeAliases";
import type { BlendshapePose } from "../../types/facialAnimation";

export interface FemaleVisemeTestState {
  enabled: boolean;
  selectedViseme: string;
  weight: number;
  correctivesEnabled: boolean;
  playbackMappingEnabled: boolean;
  intensityPreset: FemaleIntensityPresetId;
}

export interface FemaleVisemeRuntimeDebug {
  runtimePhoneme?: string;
  resolvedFemaleViseme?: string;
  nativeVisemeWeight: number;
  intensityMultiplier: number;
  correctiveMorphs: BlendshapePose;
  finalMorphWeights: BlendshapePose;
  fallbackUsed: boolean;
  preset: FemaleIntensityPresetId;
}

export interface ModelPoseTransformResult {
  pose: BlendshapePose;
  debug?: FemaleVisemeRuntimeDebug;
}

export const defaultFemaleVisemeTestState: FemaleVisemeTestState = {
  enabled: false,
  selectedViseme: "viseme_PP",
  weight: 1,
  correctivesEnabled: true,
  playbackMappingEnabled: false,
  intensityPreset: "accepted"
};

const mouthKeys = new Set([
  "jawOpen", "JawOpen", "jawForward", "jawLeft", "jawRight",
  "mouthClose", "mouthFunnel", "mouthPucker", "mouthSmileLeft", "mouthSmileRight", "smile",
  "mouthFrownLeft", "mouthFrownRight", "sad", "mouthStretchLeft", "mouthStretchRight",
  "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthUpperUpLeft", "mouthUpperUpRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
  // Dimple_ZZ and the mouthDimple* pair no longer exist (or carry no geometry) on
  // the updated female GLB. They are kept here because this set only classifies a
  // channel as mouth-owned: a name that never appears in a pose is inert, and the
  // male avatar and any future asset may still use them.
  "mouthShrugUpper", "mouthDimpleLeft", "mouthDimpleRight", "Dimple_ZZ",
  ...femaleNativeVisemeNames
]);

const clamp01 = (value: number) => Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
const clonePose = (pose: BlendshapePose): BlendshapePose => ({ ...pose });
const stripNativeVisemeTargets = (pose: BlendshapePose) => {
  const next: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) if (!femaleNativeVisemeNames.includes(name)) next[name] = value;
  return next;
};
const maxInto = (pose: BlendshapePose, name: string, value: number) => {
  const clamped = clamp01(value);
  if (clamped <= 0) return;
  pose[name] = Math.max(pose[name] ?? 0, clamped);
};

const scalePose = (pose: BlendshapePose, multiplierFor: (name: string) => number) => {
  const next: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) next[name] = clamp01(value * multiplierFor(name));
  return next;
};

const intensityForMorph = (name: string, preset: FemaleIntensityPresetId, phonemeEntry?: FemalePhonemeVisemeEntry) => {
  const values = femaleIntensityPresets[preset].values;
  let multiplier = values.lipSync;
  if (phonemeEntry?.category === "vowel" || phonemeEntry?.category === "rounded") multiplier *= values.vowels;
  else if (phonemeEntry?.category && phonemeEntry.category !== "silence") multiplier *= values.consonants;
  if (phonemeEntry?.category === "bilabial") multiplier *= values.bilabials;
  if (/jaw|Jaw/.test(name)) multiplier *= values.jaw;
  if (/eyeBlink|eye_close/.test(name)) multiplier *= values.blink;
  if (/brow|eyebrow/i.test(name)) multiplier *= values.brows;
  if (/Smile|smile/.test(name)) multiplier *= values.smile;
  if (/Frown|frown|sad/.test(name)) multiplier *= values.frown;
  if (/cheek/i.test(name)) multiplier *= values.cheek;
  if (/nose/i.test(name)) multiplier *= values.nose;
  if (/eyeLook|Eyeball/.test(name)) multiplier *= values.gaze;
  return multiplier;
};

const stripMouthPose = (pose: BlendshapePose, preset: FemaleIntensityPresetId, phonemeEntry?: FemalePhonemeVisemeEntry) => {
  const next: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) {
    if (!mouthKeys.has(name)) next[name] = clamp01(value * intensityForMorph(name, preset, phonemeEntry));
  }
  return next;
};

const addEntryPose = (
  pose: BlendshapePose,
  entry: FemalePhonemeVisemeEntry,
  preset: FemaleIntensityPresetId,
  correctivesEnabled: boolean
) => {
  const baseMultiplier = intensityForMorph(entry.nativeViseme ?? "fallback", preset, entry);
  if (entry.nativeViseme) maxInto(pose, entry.nativeViseme, entry.baseWeight * baseMultiplier);
  if (entry.fallbackPose) {
    const scaledFallback = scalePose(entry.fallbackPose, (name) => intensityForMorph(name, preset, entry));
    for (const [name, value] of Object.entries(scaledFallback)) maxInto(pose, name, value * entry.baseWeight);
  }
  if (correctivesEnabled && entry.correctiveMorphs) {
    const scaledCorrectives = scalePose(entry.correctiveMorphs, (name) => intensityForMorph(name, preset, entry));
    for (const [name, value] of Object.entries(scaledCorrectives)) maxInto(pose, name, value);
  }
};

const createDebug = (
  runtimePhoneme: string | undefined,
  entry: FemalePhonemeVisemeEntry | undefined,
  preset: FemaleIntensityPresetId,
  finalMorphWeights: BlendshapePose,
  correctivesEnabled: boolean
): FemaleVisemeRuntimeDebug => ({
  runtimePhoneme,
  resolvedFemaleViseme: entry?.nativeViseme,
  nativeVisemeWeight: entry?.nativeViseme ? finalMorphWeights[entry.nativeViseme] ?? 0 : 0,
  intensityMultiplier: entry ? intensityForMorph(entry.nativeViseme ?? "fallback", preset, entry) : femaleIntensityPresets[preset].values.lipSync,
  correctiveMorphs: correctivesEnabled ? { ...(entry?.correctiveMorphs ?? {}) } : {},
  finalMorphWeights: clonePose(finalMorphWeights),
  fallbackUsed: entry?.fallbackUsed ?? false,
  preset
});

export const transformPoseForAvatarModel = (
  config: AvatarModelConfig,
  pose: BlendshapePose,
  runtimePhoneme: string | undefined,
  femaleVisemeTest: FemaleVisemeTestState,
  /**
   * Canonical names that bypass the female intensity preset. Used by the morph
   * proof controls so a 0-1 slider maps one-to-one onto the morph influence.
   */
  rawCanonicalNames?: ReadonlySet<string>
): ModelPoseTransformResult => {
  /**
   * PHASE HC2 — the Hyper3D adapter.
   *
   * Deliberately thin. It takes the pose the existing speech controller already
   * produced and applies the asset's per-channel gain and cap BY SEMANTIC NAME.
   * It adds no channel, removes no channel, re-times nothing, and never resolves
   * a morph by index. Phoneme decisions, P/B/M logic, vowel logic, coarticulation
   * and MFA timing all happen upstream and arrive here already decided.
   *
   * `rawCanonicalNames` is honoured for the same reason the female path honours
   * it: the calibration panel drives raw influences one-to-one, so a slider at
   * 0.5 must render 0.5 rather than 0.5 x gain.
   */
  if (config.id === "hyper3d-usc") {
    if (!rawCanonicalNames?.size) return { pose: calibrateHyper3dPose(pose) };
    const calibrated: typeof pose = {};
    for (const [name, value] of Object.entries(pose)) {
      calibrated[name] = rawCanonicalNames.has(name) ? value : calibrateHyper3dPose({ [name]: value })[name] ?? 0;
    }
    return { pose: calibrated };
  }
  if (config.id !== "female") return { pose };
  const preset = femaleVisemeTest.intensityPreset;
  const rawNames = rawCanonicalNames;
  const scaleFor = (name: string, entry?: FemalePhonemeVisemeEntry) =>
    rawNames?.has(name) ? 1 : intensityForMorph(name, preset, entry);

  if (femaleVisemeTest.enabled) {
    const entry = Object.values(femalePhonemeVisemeMap).find((candidate) => candidate.nativeViseme === femaleVisemeTest.selectedViseme);
    const finalPose = stripMouthPose(pose, preset, entry);
    maxInto(finalPose, femaleVisemeTest.selectedViseme, femaleVisemeTest.weight);
    if (entry && femaleVisemeTest.correctivesEnabled && entry.correctiveMorphs) {
      const scaledCorrectives = scalePose(entry.correctiveMorphs, (name) => intensityForMorph(name, preset, entry));
      for (const [name, value] of Object.entries(scaledCorrectives)) maxInto(finalPose, name, value * femaleVisemeTest.weight);
    }
    return { pose: finalPose, debug: createDebug(runtimePhoneme, entry, preset, finalPose, femaleVisemeTest.correctivesEnabled) };
  }

  const entry = runtimePhoneme ? femalePhonemeVisemeMap[runtimePhoneme as SupportedPhoneme] : undefined;
  if (!femaleNativeVisemeRuntimeConfig.useNativeVisemes) {
    const scaled = stripNativeVisemeTargets(scalePose(pose, (name) => scaleFor(name, entry)));
    return { pose: scaled, debug: { ...createDebug(runtimePhoneme, entry, preset, scaled, femaleVisemeTest.correctivesEnabled), resolvedFemaleViseme: undefined, nativeVisemeWeight: 0, fallbackUsed: false } };
  }

  if (femaleVisemeTest.playbackMappingEnabled && entry && entry.category !== "silence") {
    const finalPose = stripMouthPose(pose, preset, entry);
    addEntryPose(finalPose, entry, preset, femaleVisemeTest.correctivesEnabled);
    return { pose: finalPose, debug: createDebug(runtimePhoneme, entry, preset, finalPose, femaleVisemeTest.correctivesEnabled) };
  }

  const scaled = scalePose(pose, (name) => intensityForMorph(name, preset, entry));
  return { pose: scaled, debug: createDebug(runtimePhoneme, entry, preset, scaled, femaleVisemeTest.correctivesEnabled) };
};