import type { MinifaceMalePhonemeDefinition } from "./minifaceMalePhonemeProfile";

/**
 * Phoneme poses authored against female.glb's real geometry.
 *
 * Why this file exists
 * --------------------
 * The female model was driving its mouth from `minifaceMalePhonemeProfile`, with
 * only a per-category intensity multiplier applied on top. That multiplier changes
 * how far a shape goes, never which shape it is, so the female face was making the
 * male face's mouth shapes — and, worse, silently dropping the ones it cannot make.
 *
 * Measured facts this table is built on (scripts/female-articulation-measurement.mjs
 * and scripts/female-live-channel-inventory.mjs, both over the shipped GLB):
 *
 *  1. `mouthStretchLeft`/`mouthStretchRight` are bound to an EMPTY target list on
 *     this asset. The male table uses them in 20 of its 39 phonemes — every
 *     sibilant, every front vowel, every spread diphthong. All of that shaping was
 *     being discarded before it reached the face.
 *
 *  2. There is no lip-spread capability on this asset at all. Outward corner travel
 *     peaks at 3.5e-5 model units across every live target, against 3.8e-3 of
 *     aperture travel from JawOpen — two orders of magnitude smaller. Nothing here
 *     can widen the mouth, so nothing in this table pretends to.
 *
 *  3. `mouthSmileLeft`/`mouthSmileRight` move their vertices purely in +y: they are
 *     corner RAISERS, not spreaders. They are the closest readable substitute for
 *     the male table's stretch component and are used sparingly for that, kept low
 *     enough that speech never settles into a held smile.
 *
 *  4. `mouthClose` has no dedicated target and resolves to the composite in
 *     `avatarModelConfig` (mouthPress + mouthShrug + mouthRollLower). Bilabial
 *     closure is therefore driven through that composite, as the brief requires.
 *
 *  5. `cheekPuff` and the `mouthDimple*` pair carry no geometry and are unused here.
 *
 * Native `viseme_*` targets are deliberately NOT used. Six of them are live
 * (AA, E, IH, O, CH, PP, rest) but `femaleNativeVisemeRuntimeConfig.useNativeVisemes`
 * is false and `modelPoseTransform` strips every native-viseme name from the pose on
 * that path, so any value written to them would be discarded. Two more that
 * `femaleVisemeConfig` still claims exist — `viseme_NN` and `viseme_TH` — are absent
 * from this asset entirely, which is the likely reason that path was abandoned.
 *
 * Timing and dominance values (attack, release, holdBias, defaultIntensity,
 * jawDominance, lipDominance, coarticulation windows) are carried over from the male
 * profile unchanged. Those were calibrated against MFA-aligned audio and describe how
 * a phoneme behaves in time, which is a property of speech, not of face geometry.
 * Only the morph target poses are re-authored here.
 */
export const femaleProfileMetadata = {
  version: "1.0.0-measured-geometry",
  avatarId: "female",
  glbFile: "public/models/female.glb",
  phonemeSet: "arpabet",
  authoredAt: "2026-08-12",
  calibrationStatus: "AUTHORED_AGAINST_MEASURED_LIVE_GEOMETRY",
  evidence: [
    "docs/evidence/live-channel-inventory/live-channel-inventory.json",
    "docs/evidence/live-channel-inventory/female-articulation.json",
    "docs/evidence/female-phoneme-profile/female-phoneme-peaks.json"
  ],
  notes:
    "Poses authored against measured live targets. Lip spread is unavailable on this asset; the male table's mouthStretch component is replaced by a bounded corner raise (mouthSmile) plus upper-lip lift (mouthUpperUp). Human visual acceptance recorded separately."
} as const;

const p = (definition: MinifaceMalePhonemeDefinition) => definition;
const base = {
  attack: 0.035,
  holdBias: 0.55,
  release: 0.055,
  intensityMin: 0,
  intensityMax: 1,
  coarticulationBefore: 0.45,
  coarticulationAfter: 0.55
};
const silence = (phoneme: string) =>
  p({
    ...base,
    phoneme,
    viseme: "REST",
    category: "silence",
    morphTargets: {},
    attack: 0.06,
    release: 0.12,
    defaultIntensity: 0,
    jawDominance: 0,
    lipDominance: 0,
    notes: "Rest pose and gradual pause recovery."
  });

export const femalePhonemeProfile: Record<string, MinifaceMalePhonemeDefinition> = {
  SIL: silence("SIL"),
  SP: silence("SP"),
  PAUSE: silence("PAUSE"),
  _: silence("_"),
  UNKNOWN: silence("UNKNOWN"),

  // --- bilabials: closure through the mouthClose composite ------------------
  P: p({
    ...base,
    phoneme: "P",
    viseme: "PP",
    category: "consonant",
    morphTargets: { mouthClose: 0.8, mouthPressLeft: 0.3, mouthPressRight: 0.3, jawOpen: 0.01 },
    attack: 0.018,
    release: 0.04,
    defaultIntensity: 0.95,
    jawDominance: 0.1,
    lipDominance: 1,
    notes: "Crisp bilabial closure through the composite. Closure is preserved against emotion smiles."
  }),
  B: p({
    ...base,
    phoneme: "B",
    viseme: "PP",
    category: "consonant",
    morphTargets: { mouthClose: 0.84, mouthPressLeft: 0.32, mouthPressRight: 0.32, jawOpen: 0.015 },
    attack: 0.02,
    release: 0.045,
    defaultIntensity: 0.88,
    jawDominance: 0.1,
    lipDominance: 0.95,
    notes: "Bilabial closure with less pressure than P."
  }),
  M: p({
    ...base,
    phoneme: "M",
    viseme: "PP",
    category: "consonant",
    morphTargets: { mouthClose: 0.96, mouthPressLeft: 0.52, mouthPressRight: 0.52, mouthRollLower: 0.1, jawOpen: 0.01 },
    attack: 0.025,
    release: 0.065,
    defaultIntensity: 0.96,
    jawDominance: 0.08,
    lipDominance: 1,
    notes: "Longest closed-mouth bilabial; adds lower-lip roll on top of the composite."
  }),

  // --- labiodentals: lower lip to upper teeth -------------------------------
  // mouthRollLower is added here where the male table used mouthStretch: rolling the
  // lower lip inward is the actual F/V articulation and this asset can do it.
  F: p({
    ...base,
    phoneme: "F",
    viseme: "FF",
    category: "consonant",
    morphTargets: {
      mouthLowerDownLeft: 0.38, mouthLowerDownRight: 0.38,
      mouthUpperUpLeft: 0.24, mouthUpperUpRight: 0.24,
      mouthRollLower: 0.1,
      jawOpen: 0.07
    },
    attack: 0.024,
    release: 0.048,
    defaultIntensity: 0.84,
    jawDominance: 0.3,
    lipDominance: 0.85,
    notes: "Labiodental: lower lip draws in and up under the upper teeth."
  }),
  V: p({
    ...base,
    phoneme: "V",
    viseme: "FF",
    category: "consonant",
    morphTargets: {
      mouthLowerDownLeft: 0.32, mouthLowerDownRight: 0.32,
      mouthUpperUpLeft: 0.19, mouthUpperUpRight: 0.19,
      mouthRollLower: 0.08,
      jawOpen: 0.065
    },
    attack: 0.03,
    release: 0.055,
    defaultIntensity: 0.77,
    jawDominance: 0.28,
    lipDominance: 0.8,
    notes: "Voiced labiodental; softer than F."
  }),

  // --- dentals --------------------------------------------------------------
  TH: p({
    ...base,
    phoneme: "TH",
    viseme: "TH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.16, jawForward: 0.1,
      mouthLowerDownLeft: 0.18, mouthLowerDownRight: 0.18,
      mouthUpperUpLeft: 0.06, mouthUpperUpRight: 0.06,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05
    },
    defaultIntensity: 0.78,
    jawDominance: 0.5,
    lipDominance: 0.55,
    notes: "Interdental: jaw forward with the lower lip dropped. No native viseme_TH on this asset."
  }),
  DH: p({
    ...base,
    phoneme: "DH",
    viseme: "TH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.13, jawForward: 0.08,
      mouthLowerDownLeft: 0.14, mouthLowerDownRight: 0.14,
      mouthUpperUpLeft: 0.05, mouthUpperUpRight: 0.05,
      mouthSmileLeft: 0.04, mouthSmileRight: 0.04
    },
    defaultIntensity: 0.72,
    jawDominance: 0.45,
    lipDominance: 0.5,
    notes: "Voiced dental; softer than TH."
  }),

  // --- alveolars and nasals -------------------------------------------------
  T: p({
    ...base,
    phoneme: "T",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1, mouthClose: 0.16,
      mouthUpperUpLeft: 0.04, mouthUpperUpRight: 0.04,
      mouthSmileLeft: 0.03, mouthSmileRight: 0.03
    },
    attack: 0.02,
    release: 0.035,
    defaultIntensity: 0.72,
    jawDominance: 0.35,
    lipDominance: 0.45,
    notes: "Alveolar stop; brief near-closure."
  }),
  D: p({
    ...base,
    phoneme: "D",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.09, mouthClose: 0.12,
      mouthUpperUpLeft: 0.03, mouthUpperUpRight: 0.03,
      mouthSmileLeft: 0.02, mouthSmileRight: 0.02
    },
    attack: 0.024,
    release: 0.04,
    defaultIntensity: 0.68,
    jawDominance: 0.32,
    lipDominance: 0.42,
    notes: "Voiced alveolar stop."
  }),
  N: p({
    ...base,
    phoneme: "N",
    viseme: "DD",
    category: "consonant",
    morphTargets: { jawOpen: 0.08, mouthClose: 0.12, mouthPressLeft: 0.07, mouthPressRight: 0.07 },
    defaultIntensity: 0.62,
    jawDominance: 0.28,
    lipDominance: 0.42,
    notes: "Alveolar nasal. No native viseme_NN on this asset."
  }),
  NG: p({
    ...base,
    phoneme: "NG",
    viseme: "KK",
    category: "consonant",
    morphTargets: { jawOpen: 0.08, mouthClose: 0.08, mouthPressLeft: 0.04, mouthPressRight: 0.04 },
    defaultIntensity: 0.58,
    jawDominance: 0.25,
    lipDominance: 0.28,
    notes: "Velar nasal; mouth stays nearly closed."
  }),
  L: p({
    ...base,
    phoneme: "L",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.14,
      mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1,
      mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.05,
      mouthSmileLeft: 0.04, mouthSmileRight: 0.04
    },
    defaultIntensity: 0.67,
    jawDominance: 0.42,
    lipDominance: 0.5,
    notes: "Lateral; upper lip lifts to expose the tongue tip."
  }),

  // --- velars ---------------------------------------------------------------
  K: p({
    ...base,
    phoneme: "K",
    viseme: "KK",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.12, mouthClose: 0.08,
      mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.05,
      mouthSmileLeft: 0.03, mouthSmileRight: 0.03
    },
    attack: 0.022,
    release: 0.038,
    defaultIntensity: 0.68,
    jawDominance: 0.36,
    lipDominance: 0.35,
    notes: "Velar stop; jaw carries it since the constriction is not visible."
  }),
  G: p({
    ...base,
    phoneme: "G",
    viseme: "KK",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1, mouthClose: 0.06,
      mouthLowerDownLeft: 0.04, mouthLowerDownRight: 0.04,
      mouthSmileLeft: 0.02, mouthSmileRight: 0.02
    },
    defaultIntensity: 0.64,
    jawDominance: 0.34,
    lipDominance: 0.32,
    notes: "Voiced velar stop."
  }),

  // --- postalveolars: funnel and pucker -------------------------------------
  CH: p({
    ...base,
    phoneme: "CH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.12, mouthFunnel: 0.2, mouthPucker: 0.1, mouthShrugUpper: 0.05 },
    attack: 0.025,
    release: 0.045,
    defaultIntensity: 0.74,
    jawDominance: 0.42,
    lipDominance: 0.7,
    notes: "Affricate; protruded funnel."
  }),
  JH: p({
    ...base,
    phoneme: "JH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.11, mouthFunnel: 0.16, mouthPucker: 0.07 },
    defaultIntensity: 0.7,
    jawDominance: 0.38,
    lipDominance: 0.65,
    notes: "Voiced affricate."
  }),
  SH: p({
    ...base,
    phoneme: "SH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.1, mouthFunnel: 0.24, mouthPucker: 0.12, mouthShrugUpper: 0.05 },
    defaultIntensity: 0.76,
    jawDominance: 0.32,
    lipDominance: 0.75,
    notes: "Postalveolar fricative; strongest funnel of the group."
  }),
  ZH: p({
    ...base,
    phoneme: "ZH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.09, mouthFunnel: 0.2, mouthPucker: 0.09 },
    defaultIntensity: 0.68,
    jawDominance: 0.3,
    lipDominance: 0.68,
    notes: "Voiced postalveolar fricative."
  }),

  // --- sibilants ------------------------------------------------------------
  // The male table spreads the lips here. This asset cannot spread, so the narrow
  // aperture is made by near-closure plus a small corner raise instead.
  S: p({
    ...base,
    phoneme: "S",
    viseme: "SS",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.06, mouthClose: 0.14,
      mouthSmileLeft: 0.06, mouthSmileRight: 0.06,
      mouthUpperUpLeft: 0.06, mouthUpperUpRight: 0.06
    },
    attack: 0.018,
    release: 0.035,
    defaultIntensity: 0.7,
    jawDominance: 0.18,
    lipDominance: 0.65,
    notes: "Narrow sibilant channel. No lip spread available; near-closure carries it."
  }),
  Z: p({
    ...base,
    phoneme: "Z",
    viseme: "SS",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.055, mouthClose: 0.12,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.05, mouthUpperUpRight: 0.05
    },
    defaultIntensity: 0.65,
    jawDominance: 0.17,
    lipDominance: 0.6,
    notes: "Voiced sibilant; softer than S."
  }),

  // --- liquids and glides ---------------------------------------------------
  R: p({
    ...base,
    phoneme: "R",
    viseme: "RR",
    category: "consonant",
    morphTargets: { jawOpen: 0.09, mouthPucker: 0.2, mouthFunnel: 0.13, mouthShrugUpper: 0.06 },
    defaultIntensity: 0.7,
    jawDominance: 0.25,
    lipDominance: 0.72,
    notes: "Rounded approximant."
  }),
  ER: p({
    ...base,
    phoneme: "ER",
    viseme: "RR",
    category: "vowel",
    morphTargets: { jawOpen: 0.16, mouthPucker: 0.18, mouthFunnel: 0.14, mouthShrugUpper: 0.06 },
    defaultIntensity: 0.74,
    jawDominance: 0.46,
    lipDominance: 0.68,
    notes: "R-coloured vowel; more jaw than R."
  }),
  W: p({
    ...base,
    phoneme: "W",
    viseme: "WQ",
    category: "consonant",
    morphTargets: { jawOpen: 0.07, mouthPucker: 0.46, mouthFunnel: 0.28 },
    defaultIntensity: 0.8,
    jawDominance: 0.22,
    lipDominance: 0.9,
    notes: "Tight rounded glide."
  }),
  Y: p({
    ...base,
    phoneme: "Y",
    viseme: "EE",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.14, mouthUpperUpRight: 0.14
    },
    defaultIntensity: 0.68,
    jawDominance: 0.26,
    lipDominance: 0.7,
    notes: "High front glide; corner raise stands in for the unavailable spread."
  }),
  HH: p({
    ...base,
    phoneme: "HH",
    viseme: "HH",
    category: "consonant",
    morphTargets: { jawOpen: 0.12, mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.05 },
    defaultIntensity: 0.52,
    jawDominance: 0.35,
    lipDominance: 0.18,
    notes: "Breathy consonant; light mouth opening only."
  }),

  // --- rounded vowels -------------------------------------------------------
  UW: p({
    ...base,
    phoneme: "UW",
    viseme: "WQ",
    category: "vowel",
    morphTargets: { jawOpen: 0.1, mouthPucker: 0.58, mouthFunnel: 0.4 },
    defaultIntensity: 0.87,
    jawDominance: 0.32,
    lipDominance: 0.95,
    notes: "Tightest rounding in the set."
  }),
  UH: p({
    ...base,
    phoneme: "UH",
    viseme: "WQ",
    category: "vowel",
    morphTargets: { jawOpen: 0.18, mouthPucker: 0.24, mouthFunnel: 0.18 },
    defaultIntensity: 0.72,
    jawDominance: 0.48,
    lipDominance: 0.62,
    notes: "Lax rounded vowel."
  }),
  AO: p({
    ...base,
    phoneme: "AO",
    viseme: "OH",
    category: "vowel",
    morphTargets: { jawOpen: 0.44, mouthFunnel: 0.3, mouthPucker: 0.15 },
    defaultIntensity: 0.84,
    jawDominance: 0.72,
    lipDominance: 0.78,
    notes: "Open rounded vowel."
  }),
  OW: p({
    ...base,
    phoneme: "OW",
    viseme: "OH",
    category: "vowel",
    morphTargets: { jawOpen: 0.22, mouthFunnel: 0.38, mouthPucker: 0.34 },
    defaultIntensity: 0.85,
    jawDominance: 0.56,
    lipDominance: 0.86,
    notes: "Closing rounded diphthong."
  }),
  OY: p({
    ...base,
    phoneme: "OY",
    viseme: "OH",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.24, mouthFunnel: 0.25, mouthPucker: 0.21,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05
    },
    defaultIntensity: 0.8,
    jawDominance: 0.54,
    lipDominance: 0.78,
    notes: "Rounded-to-front diphthong."
  }),
  AW: p({
    ...base,
    phoneme: "AW",
    viseme: "OH",
    category: "vowel",
    morphTargets: { jawOpen: 0.39, mouthFunnel: 0.19, mouthPucker: 0.11 },
    defaultIntensity: 0.8,
    jawDominance: 0.72,
    lipDominance: 0.58,
    notes: "Open-to-rounded diphthong."
  }),

  // --- front vowels ---------------------------------------------------------
  IY: p({
    ...base,
    phoneme: "IY",
    viseme: "EE",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.14,
      mouthSmileLeft: 0.07, mouthSmileRight: 0.07,
      mouthUpperUpLeft: 0.26, mouthUpperUpRight: 0.26
    },
    defaultIntensity: 0.84,
    jawDominance: 0.38,
    lipDominance: 0.88,
    notes: "Highest front vowel. The male table's 0.38 stretch is replaced by a bounded corner raise plus upper-lip lift."
  }),
  IH: p({
    ...base,
    phoneme: "IH",
    viseme: "EE",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.18,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18
    },
    defaultIntensity: 0.74,
    jawDominance: 0.45,
    lipDominance: 0.72,
    notes: "Lax high front vowel."
  }),
  EH: p({
    ...base,
    phoneme: "EH",
    viseme: "E",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.29,
      mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1
    },
    defaultIntensity: 0.78,
    jawDominance: 0.58,
    lipDominance: 0.62,
    notes: "Mid front vowel."
  }),
  EY: p({
    ...base,
    phoneme: "EY",
    viseme: "E",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.21,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.16, mouthUpperUpRight: 0.16
    },
    defaultIntensity: 0.78,
    jawDominance: 0.52,
    lipDominance: 0.68,
    notes: "Mid-to-high front diphthong."
  }),
  AE: p({
    ...base,
    phoneme: "AE",
    viseme: "AA",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.51,
      mouthLowerDownLeft: 0.18, mouthLowerDownRight: 0.18,
      mouthSmileLeft: 0.06, mouthSmileRight: 0.06,
      mouthUpperUpLeft: 0.11, mouthUpperUpRight: 0.11
    },
    defaultIntensity: 0.85,
    jawDominance: 0.82,
    lipDominance: 0.62,
    notes: "Open front vowel."
  }),

  // --- open vowels ----------------------------------------------------------
  AA: p({
    ...base,
    phoneme: "AA",
    viseme: "AA",
    category: "vowel",
    morphTargets: { jawOpen: 0.58, mouthLowerDownLeft: 0.2, mouthLowerDownRight: 0.2, mouthFunnel: 0.02 },
    attack: 0.045,
    release: 0.07,
    defaultIntensity: 0.9,
    jawDominance: 0.95,
    lipDominance: 0.44,
    notes: "Widest aperture in the set; jaw dominant."
  }),
  AH: p({
    ...base,
    phoneme: "AH",
    viseme: "AA",
    category: "vowel",
    morphTargets: { jawOpen: 0.41, mouthLowerDownLeft: 0.11, mouthLowerDownRight: 0.11 },
    defaultIntensity: 0.78,
    jawDominance: 0.74,
    lipDominance: 0.42,
    notes: "Schwa / mid central vowel."
  }),
  AY: p({
    ...base,
    phoneme: "AY",
    viseme: "AA",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.44,
      mouthSmileLeft: 0.05, mouthSmileRight: 0.05,
      mouthUpperUpLeft: 0.05, mouthUpperUpRight: 0.05
    },
    defaultIntensity: 0.82,
    jawDominance: 0.78,
    lipDominance: 0.55,
    notes: "Open-to-front diphthong."
  })
};
