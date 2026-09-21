import type { SupportedPhoneme } from "./phonemeAliases";
import type { BlendshapePose } from "../types/facialAnimation";

export const femaleNativeVisemeRuntimeConfig = {
  useNativeVisemes: false,
  lipSyncMode: "Phoneme poses",
  nativeVisemeRuntimeMode: "Disabled"
} as const;

export type FemaleIntensityPresetId = "baseline" | "candidate-a" | "candidate-b" | "candidate-c" | "accepted";
/**
 * `absent` means the morph is named in this inventory but does NOT exist on the
 * shipped asset. It is distinct from `unsuitable`, which means the morph exists and
 * should not be used.
 */
export type FemaleVisemeStatus = "usable" | "partial" | "unsuitable" | "absent";
export type FemaleVisemeCategory = "silence" | "bilabial" | "labiodental" | "dental" | "alveolar" | "velar" | "postalveolar" | "sibilant" | "nasal" | "liquid" | "rounded" | "vowel" | "fallback";

/**
 * Multipliers `modelPoseTransform.intensityForMorph` applies to the female pose.
 *
 * They COMPOUND. `lipSync` is not a lip-sync-only scalar: it is the base factor for
 * every channel of the whole mixed pose — speech, emotion, cue and idle alike — and
 * each remaining field multiplies on top of it when the channel or the current
 * phoneme category matches. That compounding is what the 2026-08-13 re-derivation
 * removed; see the preset notes below.
 *
 * `idleExpressionScale` is not part of that stack. `AvatarModel` reads it once and
 * hands it to `IdleExpressionController` as `safetyScale`, before the transform
 * runs. It is a separate calibration with its own history and is deliberately
 * untouched here.
 */
export interface FemaleIntensityConfig {
  /** Base gain applied to every channel of the mixed pose. */
  lipSync: number;
  vowels: number;
  consonants: number;
  bilabials: number;
  jaw: number;
  blink: number;
  brows: number;
  smile: number;
  frown: number;
  cheek: number;
  nose: number;
  gaze: number;
  /** Naturalism/idle safety scale. Not part of the multiplier family above. */
  idleExpressionScale: number;
}

export interface FemaleIntensityPreset {
  id: FemaleIntensityPresetId;
  label: string;
  notes: string;
  values: FemaleIntensityConfig;
}

export interface FemaleVisemeInventoryEntry {
  actualMorphName: string;
  likelyPhonemeGroup: string;
  side: "combined" | "left" | "right";
  maximumSafeWeight: number;
  visualEffect: string;
  status: FemaleVisemeStatus;
  /**
   * Whether the morph is actually present on the shipped `female.glb`. Verified by
   * measurement rather than declared: see `scripts/female-stale-viseme-trace.mjs`,
   * which reads every mesh's morph dictionary off the real asset.
   */
  presentOnAsset: boolean;
}

export interface FemalePhonemeVisemeEntry {
  phonemes: SupportedPhoneme[];
  nativeViseme?: string;
  category: FemaleVisemeCategory;
  baseWeight: number;
  correctiveMorphs?: BlendshapePose;
  fallbackPose?: BlendshapePose;
  fallbackUsed: boolean;
  notes: string;
}

/**
 * Every viseme name this character's authoring has ever declared, and whether the
 * shipped asset actually carries it.
 *
 * `viseme_NN` and `viseme_TH` are declared but absent — measured, not assumed:
 * `scripts/female-stale-viseme-trace.mjs` reads the morph dictionary of every mesh in
 * `female.glb` and finds neither, and the same holds for Female-178 and Female.198.
 * They are kept here rather than deleted because they record what the phoneme map
 * still references and what a corrected export would need to supply; removing them
 * would erase that, and inventing substitutes would misrepresent the asset.
 */
export const femaleNativeVisemeInventory: FemaleVisemeInventoryEntry[] = [
  { actualMorphName: "viseme_rest", likelyPhonemeGroup: "silence / neutral", side: "combined", maximumSafeWeight: 1, visualEffect: "Neutral/rest mouth reference.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_PP", likelyPhonemeGroup: "P/B/M bilabial closure", side: "combined", maximumSafeWeight: 1, visualEffect: "Native closed-lip bilabial pose.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_AA", likelyPhonemeGroup: "AA/AH open vowel", side: "combined", maximumSafeWeight: 1, visualEffect: "Open vowel mouth shape.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_O", likelyPhonemeGroup: "AO/OW/OY rounded vowel", side: "combined", maximumSafeWeight: 1, visualEffect: "Rounded open O mouth shape.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_IH", likelyPhonemeGroup: "IH/IY high front vowel", side: "combined", maximumSafeWeight: 1, visualEffect: "Narrow high front vowel shape.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_E", likelyPhonemeGroup: "AE/EH/EY front vowel", side: "combined", maximumSafeWeight: 1, visualEffect: "Front vowel smile/spread shape.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_CH", likelyPhonemeGroup: "CH/JH/SH/ZH postalveolar", side: "combined", maximumSafeWeight: 1, visualEffect: "Affricate/postalveolar mouth pose.", status: "usable", presentOnAsset: true },
  { actualMorphName: "viseme_NN", likelyPhonemeGroup: "N/NG nasal", side: "combined", maximumSafeWeight: 1, visualEffect: "ABSENT from the shipped asset. T/D/N/NG/L articulate through their canonical femalePhonemeProfile poses instead.", status: "absent", presentOnAsset: false },
  { actualMorphName: "viseme_TH", likelyPhonemeGroup: "TH/DH dental", side: "combined", maximumSafeWeight: 1, visualEffect: "ABSENT from the shipped asset. TH/DH articulate through their canonical femalePhonemeProfile poses instead.", status: "absent", presentOnAsset: false }
];

/**
 * Every declared name, present or not.
 *
 * This is deliberately the full list: its consumers are `modelPoseTransform`'s
 * `mouthKeys` classification and `stripNativeVisemeTargets`, which must strip any
 * native-viseme name that could appear in a pose. Including a name the asset lacks
 * costs nothing there and keeps the guard strict if a future export adds it.
 */
export const femaleNativeVisemeNames = femaleNativeVisemeInventory.map((entry) => entry.actualMorphName);

/**
 * The subset that can actually deform this asset.
 *
 * Use this anywhere a name is OFFERED to a person — the diagnostic viseme selector in
 * `ModelControls` populated itself from the full list, so `viseme_NN` and `viseme_TH`
 * appeared as selectable options that silently rendered nothing.
 */
export const femaleRenderableVisemeNames = femaleNativeVisemeInventory
  .filter((entry) => entry.presentOnAsset)
  .map((entry) => entry.actualMorphName);

/** Declared but not present on the asset. Recorded so the gap stays visible. */
export const femaleAbsentVisemeNames = femaleNativeVisemeInventory
  .filter((entry) => !entry.presentOnAsset)
  .map((entry) => entry.actualMorphName);

/**
 * SUPERSEDED (2026-08-13). Retained as comparison points and referenced by tests and
 * diagnostics history; do not delete. Every one of them compounds category and
 * channel multipliers on top of `lipSync`, producing effective per-channel gains
 * from 1.5x to 4.89x on the same pose. `accepted` (Strong B) drove 22 distinct
 * authored values past the [0,1] clamp, including `AA` `jawOpen` and `UW`
 * `mouthPucker`, which compressed the open-vowel aperture ladder; `candidate-c`
 * collapsed AA and AE onto an identical fully-open jaw.
 * Evidence: `docs/evidence/female-intensity-rederivation/saturation-report.json`.
 */
const supersededNote =
  "SUPERSEDED 2026-08-13 by the uniform-gain re-derivation. Retained for A/B comparison and diagnostics history. Compounds category multipliers on top of lipSync; see docs/evidence/female-intensity-rederivation/.";

export const femaleIntensityPresets: Record<FemaleIntensityPresetId, FemaleIntensityPreset> = {
  baseline: {
    id: "baseline",
    label: "Female Baseline (superseded)",
    notes: `Previous accepted Candidate B profile retained as the pre-Strong-B comparison baseline. ${supersededNote} 4 authored values clamp under it.`,
    values: { lipSync: 1.25, vowels: 1.2, consonants: 1.28, bilabials: 1.18, jaw: 1.1, blink: 1.22, brows: 1.25, smile: 1.18, frown: 1.16, cheek: 1.14, nose: 1.12, gaze: 1.12, idleExpressionScale: 0.62 }
  },
  "candidate-a": {
    id: "candidate-a",
    label: "Female Strong A (superseded)",
    notes: `Lower strong comparison preset for visible female-only lift with bounded idle expression scaling. ${supersededNote} 14 authored values clamp under it.`,
    values: { lipSync: 1.38, vowels: 1.3, consonants: 1.42, bilabials: 1.3, jaw: 1.18, blink: 1.3, brows: 1.36, smile: 1.28, frown: 1.24, cheek: 1.22, nose: 1.18, gaze: 1.18, idleExpressionScale: 0.62 }
  },
  "candidate-b": {
    id: "candidate-b",
    label: "Female Strong B (superseded)",
    notes: `Was the accepted profile from the female blendshape strength pass until 2026-08-13. ${supersededNote} 22 authored values clamp under it, including AA jawOpen and UW mouthPucker.`,
    values: { lipSync: 1.5, vowels: 1.42, consonants: 1.55, bilabials: 1.42, jaw: 1.25, blink: 1.38, brows: 1.48, smile: 1.38, frown: 1.34, cheek: 1.3, nose: 1.24, gaze: 1.24, idleExpressionScale: 0.66 }
  },
  "candidate-c": {
    id: "candidate-c",
    label: "Female Strong C (superseded)",
    notes: `Upper strong comparison preset for manual review; never selected. ${supersededNote} 59 authored values clamp under it and AA/AE render as an identical fully-open jaw.`,
    values: { lipSync: 1.65, vowels: 1.55, consonants: 1.7, bilabials: 1.55, jaw: 1.32, blink: 1.46, brows: 1.58, smile: 1.48, frown: 1.42, cheek: 1.38, nose: 1.3, gaze: 1.3, idleExpressionScale: 0.7 }
  },
  /**
   * Re-derived 2026-08-13 from
   * `docs/evidence/female-intensity-rederivation/saturation-report.json`
   * (`node scripts/female-intensity-rederivation-diagnostics.mjs`).
   *
   * Every category and channel multiplier is 1.0, so the transform is now a single
   * uniform scalar. A uniform scalar cannot turn two distinct poses into the same
   * shape unless it clamps — which is exactly the failure the compounding stack
   * caused. The authored tables (`avatars/femalePhonemeProfile`,
   * `femaleEmotionPoseOverrides`, `femaleFacialCuePoseOverrides`) own the relative
   * shape; this preset owns nothing but overall loudness.
   *
   * Why the gain is 1.9 and not 1.0. The report bounds it from both sides:
   *
   *  - Lower bound 1.353 — `B`'s authored closure peaks at 0.739 (`mouthClose` 0.84
   *    x `defaultIntensity` 0.88). Below 1.353 a bilabial stop stops reaching full
   *    lip closure, which is the one clamp that is the intended shape.
   *  - Upper bound 1.982 — `UW`'s `mouthPucker` peaks at 0.5046 and is the first
   *    non-intentional value to clamp. The payload replay puts the practical
   *    ceiling slightly lower: unintended clipping first appears at gain 1.98.
   *
   * 1.9 is the largest swept gain with zero unintended clamps in both the static
   * authored-peak analysis and the payload replay while keeping >=4% headroom to the
   * first non-intentional clamp (its clamp ceiling is 1.043; 1.95's is 1.016).
   *
   * A gain of exactly 1.0 was measured and rejected on evidence, not taste. Two
   * findings block it. (1) `femalePhonemeProfile` re-authored WHICH channels carry
   * each shape but inherited the male table's amplitudes verbatim — all 44
   * `defaultIntensity` values and every `jawOpen` are byte-identical to
   * `minifaceMalePhonemeProfile` — so it is not amplitude-calibrated for this face
   * and does not yet own loudness. (2) The emotion layer structurally cannot own it:
   * `EmotionBlender` multiplies by `defaultIntensity` (0.55 for `angry`) and caps
   * each channel at 0.75, and `clampAvatarMorph` bounds an authored value at 1.0, so
   * `angry`'s `cheekSquint` cannot exceed 0.4125 before the transform. Reaching the
   * ~0.8 that `femaleEmotionPoseOverrides` documents as its target requires a gain
   * above 1. At unity the payload replay peaks `jawOpen` at 0.157 and `browInnerUp`
   * at 0.300, against 0.418 and 0.932 today — an under-drive on a face already
   * documented as barely legible.
   */
  accepted: {
    id: "accepted",
    label: "Female Accepted (uniform gain)",
    notes:
      "Accepted 2026-08-13. Single uniform gain of 1.9 with every category and channel multiplier at 1.0, so the transform preserves authored shape exactly and only scales loudness. Derived from docs/evidence/female-intensity-rederivation/saturation-report.json: safe window [1.353, 1.982], bounded below by bilabial closure on B and above by UW mouthPucker. Zero unintended clamps across all 42 phonemes, 8 emotions, 16 cues and the idle baseline. idleExpressionScale unchanged at 0.66 — the idle baseline does not clamp and it is a separate calibration.",
    values: { lipSync: 1.9, vowels: 1, consonants: 1, bilabials: 1, jaw: 1, blink: 1, brows: 1, smile: 1, frown: 1, cheek: 1, nose: 1, gaze: 1, idleExpressionScale: 0.66 }
  }
};

const fallback = (pose: BlendshapePose): BlendshapePose => pose;

export const femalePhonemeVisemeMap: Record<SupportedPhoneme, FemalePhonemeVisemeEntry> = {
  SIL: { phonemes: ["SIL"], nativeViseme: "viseme_rest", category: "silence", baseWeight: 0, fallbackUsed: false, notes: "Rest pose." },
  SP: { phonemes: ["SP"], nativeViseme: "viseme_rest", category: "silence", baseWeight: 0, fallbackUsed: false, notes: "Short pause rest pose." },
  PAUSE: { phonemes: ["PAUSE"], nativeViseme: "viseme_rest", category: "silence", baseWeight: 0, fallbackUsed: false, notes: "Pause rest pose." },
  P: { phonemes: ["P"], nativeViseme: "viseme_PP", category: "bilabial", baseWeight: 0.96, correctiveMorphs: { mouthPressLeft: 0.08, mouthPressRight: 0.08 }, fallbackUsed: false, notes: "Native bilabial closure with small pressure corrective." },
  B: { phonemes: ["B"], nativeViseme: "viseme_PP", category: "bilabial", baseWeight: 0.9, correctiveMorphs: { mouthPressLeft: 0.06, mouthPressRight: 0.06 }, fallbackUsed: false, notes: "Softer native bilabial closure." },
  M: { phonemes: ["M"], nativeViseme: "viseme_PP", category: "bilabial", baseWeight: 1, correctiveMorphs: { mouthPressLeft: 0.1, mouthPressRight: 0.1, mouthRollLower: 0.04 }, fallbackUsed: false, notes: "Full native bilabial closure with nasal-hold pressure." },
  F: { phonemes: ["F"], category: "labiodental", baseWeight: 0.82, fallbackPose: fallback({ mouthLowerDownLeft: 0.38, mouthLowerDownRight: 0.38, mouthUpperUpLeft: 0.22, mouthUpperUpRight: 0.22, jawOpen: 0.07 }), fallbackUsed: true, notes: "No native FF viseme; uses bounded ARKit-style labiodental fallback." },
  V: { phonemes: ["V"], category: "labiodental", baseWeight: 0.76, fallbackPose: fallback({ mouthLowerDownLeft: 0.32, mouthLowerDownRight: 0.32, mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18, jawOpen: 0.06 }), fallbackUsed: true, notes: "No native FF viseme; softer voiced fallback." },
  TH: { phonemes: ["TH"], nativeViseme: "viseme_TH", category: "dental", baseWeight: 0.92, correctiveMorphs: { jawForward: 0.04 }, fallbackUsed: false, notes: "Native dental viseme. viseme_TH is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  DH: { phonemes: ["DH"], nativeViseme: "viseme_TH", category: "dental", baseWeight: 0.78, correctiveMorphs: { jawForward: 0.03 }, fallbackUsed: false, notes: "Voiced dental uses softer native TH. viseme_TH is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  T: { phonemes: ["T"], nativeViseme: "viseme_NN", category: "alveolar", baseWeight: 0.62, correctiveMorphs: { jawOpen: 0.04 }, fallbackUsed: false, notes: "No DD viseme; NN is the closest native alveolar/nasal pose. viseme_NN is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  D: { phonemes: ["D"], nativeViseme: "viseme_NN", category: "alveolar", baseWeight: 0.56, correctiveMorphs: { jawOpen: 0.035 }, fallbackUsed: false, notes: "Softer NN fallback for voiced alveolar. viseme_NN is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  N: { phonemes: ["N"], nativeViseme: "viseme_NN", category: "nasal", baseWeight: 0.72, fallbackUsed: false, notes: "Native NN nasal pose. viseme_NN is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  K: { phonemes: ["K"], category: "velar", baseWeight: 0.55, fallbackPose: fallback({ jawOpen: 0.1, mouthStretchLeft: 0.04, mouthStretchRight: 0.04 }), fallbackUsed: true, notes: "No kk/KG viseme; bounded jaw fallback." },
  G: { phonemes: ["G"], category: "velar", baseWeight: 0.5, fallbackPose: fallback({ jawOpen: 0.09, mouthStretchLeft: 0.03, mouthStretchRight: 0.03 }), fallbackUsed: true, notes: "No kk/KG viseme; softer velar fallback." },
  NG: { phonemes: ["NG"], nativeViseme: "viseme_NN", category: "nasal", baseWeight: 0.62, fallbackUsed: false, notes: "Uses NN for nasal closure because no NG-specific target exists. viseme_NN is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  CH: { phonemes: ["CH"], nativeViseme: "viseme_CH", category: "postalveolar", baseWeight: 0.9, correctiveMorphs: { mouthPucker: 0.04 }, fallbackUsed: false, notes: "Native CH/affricate viseme." },
  JH: { phonemes: ["JH"], nativeViseme: "viseme_CH", category: "postalveolar", baseWeight: 0.82, correctiveMorphs: { mouthPucker: 0.03 }, fallbackUsed: false, notes: "Voiced affricate uses native CH softer." },
  SH: { phonemes: ["SH"], nativeViseme: "viseme_CH", category: "postalveolar", baseWeight: 0.78, correctiveMorphs: { mouthFunnel: 0.06 }, fallbackUsed: false, notes: "No SH target; native CH plus mild funnel." },
  ZH: { phonemes: ["ZH"], nativeViseme: "viseme_CH", category: "postalveolar", baseWeight: 0.7, correctiveMorphs: { mouthFunnel: 0.04 }, fallbackUsed: false, notes: "No ZH target; softer native CH." },
  S: { phonemes: ["S"], category: "sibilant", baseWeight: 0.62, fallbackPose: fallback({ mouthStretchLeft: 0.16, mouthStretchRight: 0.16, mouthClose: 0.12, jawOpen: 0.04 }), fallbackUsed: true, notes: "No SS viseme; bounded narrow fallback." },
  Z: { phonemes: ["Z"], category: "sibilant", baseWeight: 0.56, fallbackPose: fallback({ mouthStretchLeft: 0.12, mouthStretchRight: 0.12, mouthClose: 0.1, jawOpen: 0.035 }), fallbackUsed: true, notes: "No SS viseme; softer voiced fallback." },
  L: { phonemes: ["L"], nativeViseme: "viseme_NN", category: "liquid", baseWeight: 0.5, correctiveMorphs: { jawOpen: 0.06, mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.05 }, fallbackUsed: false, notes: "No L viseme; NN plus lower-lip opening is the closest native option. viseme_NN is ABSENT from this asset, so this entry never renders; playback uses the canonical femalePhonemeProfile pose. See docs/FEMALE_VISEME_INVENTORY_AUDIT.md." },
  R: { phonemes: ["R"], category: "liquid", baseWeight: 0.58, fallbackPose: fallback({ mouthPucker: 0.16, mouthFunnel: 0.12, jawOpen: 0.05 }), fallbackUsed: true, notes: "No RR viseme; rounded fallback." },
  W: { phonemes: ["W"], nativeViseme: "viseme_O", category: "rounded", baseWeight: 0.58, correctiveMorphs: { mouthPucker: 0.08 }, fallbackUsed: false, notes: "No U/W viseme; O plus pucker approximates W." },
  Y: { phonemes: ["Y"], nativeViseme: "viseme_IH", category: "vowel", baseWeight: 0.52, fallbackUsed: false, notes: "Uses high-front native IH for y-glide." },
  HH: { phonemes: ["HH"], nativeViseme: "viseme_AA", category: "vowel", baseWeight: 0.32, correctiveMorphs: { jawOpen: 0.04 }, fallbackUsed: false, notes: "Soft open vowel-like breath shape." },
  AA: { phonemes: ["AA"], nativeViseme: "viseme_AA", category: "vowel", baseWeight: 0.92, correctiveMorphs: { jawOpen: 0.08 }, fallbackUsed: false, notes: "Native open vowel." },
  AE: { phonemes: ["AE"], nativeViseme: "viseme_E", category: "vowel", baseWeight: 0.78, correctiveMorphs: { jawOpen: 0.06 }, fallbackUsed: false, notes: "Front vowel via native E." },
  AH: { phonemes: ["AH"], nativeViseme: "viseme_AA", category: "vowel", baseWeight: 0.78, correctiveMorphs: { jawOpen: 0.05 }, fallbackUsed: false, notes: "Softer AA for AH/schwa." },
  AO: { phonemes: ["AO"], nativeViseme: "viseme_O", category: "vowel", baseWeight: 0.88, correctiveMorphs: { jawOpen: 0.05 }, fallbackUsed: false, notes: "Native rounded O vowel." },
  AW: { phonemes: ["AW"], nativeViseme: "viseme_AA", category: "vowel", baseWeight: 0.72, correctiveMorphs: { mouthPucker: 0.08 }, fallbackUsed: false, notes: "AA with rounding corrective for diphthong." },
  AY: { phonemes: ["AY"], nativeViseme: "viseme_AA", category: "vowel", baseWeight: 0.7, correctiveMorphs: { mouthSmileLeft: 0.04, mouthSmileRight: 0.04 }, fallbackUsed: false, notes: "Open-to-front diphthong approximation." },
  EH: { phonemes: ["EH"], nativeViseme: "viseme_E", category: "vowel", baseWeight: 0.78, fallbackUsed: false, notes: "Native E front vowel." },
  ER: { phonemes: ["ER"], category: "liquid", baseWeight: 0.58, fallbackPose: fallback({ mouthPucker: 0.12, mouthFunnel: 0.1, jawOpen: 0.06 }), fallbackUsed: true, notes: "No RR/ER native viseme; rounded fallback." },
  EY: { phonemes: ["EY"], nativeViseme: "viseme_E", category: "vowel", baseWeight: 0.72, correctiveMorphs: { mouthSmileLeft: 0.03, mouthSmileRight: 0.03 }, fallbackUsed: false, notes: "Native E with mild spread." },
  IH: { phonemes: ["IH"], nativeViseme: "viseme_IH", category: "vowel", baseWeight: 0.78, fallbackUsed: false, notes: "Native IH." },
  IY: { phonemes: ["IY"], nativeViseme: "viseme_IH", category: "vowel", baseWeight: 0.82, correctiveMorphs: { mouthSmileLeft: 0.04, mouthSmileRight: 0.04 }, fallbackUsed: false, notes: "Native IH plus mild spread for EE/IY." },
  OW: { phonemes: ["OW"], nativeViseme: "viseme_O", category: "vowel", baseWeight: 0.86, correctiveMorphs: { mouthPucker: 0.06 }, fallbackUsed: false, notes: "Native O plus pucker." },
  OY: { phonemes: ["OY"], nativeViseme: "viseme_O", category: "vowel", baseWeight: 0.72, correctiveMorphs: { mouthSmileLeft: 0.03, mouthSmileRight: 0.03 }, fallbackUsed: false, notes: "O-front diphthong approximation." },
  UH: { phonemes: ["UH"], nativeViseme: "viseme_O", category: "rounded", baseWeight: 0.58, correctiveMorphs: { mouthPucker: 0.08 }, fallbackUsed: false, notes: "No U viseme; rounded O approximation." },
  UW: { phonemes: ["UW"], nativeViseme: "viseme_O", category: "rounded", baseWeight: 0.64, correctiveMorphs: { mouthPucker: 0.12 }, fallbackUsed: false, notes: "No U viseme; O plus pucker for OO/UW." }
};

export const femaleOculusVisemePresence = {
  viseme_sil: undefined,
  viseme_PP: "viseme_PP",
  viseme_FF: undefined,
  viseme_TH: "viseme_TH",
  viseme_DD: undefined,
  viseme_kk: undefined,
  viseme_CH: "viseme_CH",
  viseme_SS: undefined,
  viseme_nn: "viseme_NN",
  viseme_RR: undefined,
  viseme_aa: "viseme_AA",
  viseme_E: "viseme_E",
  viseme_I: "viseme_IH",
  viseme_O: "viseme_O",
  viseme_U: undefined
} as const;

export const femaleVisemeStandard = {
  classification: "mixed custom / partial Oculus-style viseme set with ARKit facial morphs",
  notes: [
    "Native names use the viseme_ prefix but only a subset of Oculus-style targets exists.",
    "Missing Oculus-style FF, DD, kk, SS, RR, U, and sil targets require documented fallbacks or approximations.",
    "The model also exposes ARKit-style mouth, jaw, brow, eye, cheek, and nose morphs."
  ],
  oculusPresence: femaleOculusVisemePresence
} as const;