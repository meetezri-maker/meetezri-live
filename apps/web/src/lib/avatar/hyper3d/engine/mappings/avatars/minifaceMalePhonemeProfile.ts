export interface PhonemeBlendshapePose {
  morphTargets: Record<string, number>;
  attack?: number;
  release?: number;
  coarticulationBefore?: number;
  coarticulationAfter?: number;
  holdBias?: number;
  dominance?: number;
  minimumContribution?: number;
  category?: string;
  notes?: string;
}

export interface MinifaceMalePhonemeDefinition extends PhonemeBlendshapePose {
  phoneme: string;
  viseme: string;
  category: "vowel" | "consonant" | "silence";
  defaultIntensity: number;
  intensityMin: number;
  intensityMax: number;
  jawDominance: number;
  lipDominance: number;
}

export const minifaceMaleProfileMetadata = {
  version: "0.2.0-generated-visual-baseline",
  avatarId: "miniface-male",
  glbFile: "public/models/miniface-male.glb",
  phonemeSet: "arpabet",
  calibratedAt: "2026-07-28",
  calibrationStatus: "GENERATED_MFA_VISUAL_BASELINE",
  notes:
    "Generated MFA matched-audio baseline tuned in Task 7 for visible mouth/lip phoneme review. Full-sentence human signoff is still pending."
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

export const minifaceMalePhonemeProfile: Record<string, MinifaceMalePhonemeDefinition> = {
  SIL: silence("SIL"),
  SP: silence("SP"),
  PAUSE: silence("PAUSE"),
  _: silence("_"),
  UNKNOWN: silence("UNKNOWN"),
  P: p({
    ...base,
    phoneme: "P",
    viseme: "PP",
    category: "consonant",
    morphTargets: { mouthClose: 0.78, mouthPressLeft: 0.28, mouthPressRight: 0.28, jawOpen: 0.01 },
    attack: 0.018,
    release: 0.04,
    defaultIntensity: 0.95,
    jawDominance: 0.1,
    lipDominance: 1,
    notes: "Crisp bilabial closure. Closure is preserved against emotion smiles."
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
    morphTargets: {
      mouthClose: 0.96,
      mouthPressLeft: 0.52,
      mouthPressRight: 0.52,
      mouthRollLower: 0.08,
      jawOpen: 0.01
    },
    attack: 0.025,
    release: 0.065,
    defaultIntensity: 0.96,
    jawDominance: 0.08,
    lipDominance: 1,
    notes: "Longest closed-mouth bilabial; lips press more than B."
  }),
  F: p({
    ...base,
    phoneme: "F",
    viseme: "FF",
    category: "consonant",
    morphTargets: {
      mouthLowerDownLeft: 0.36,
      mouthLowerDownRight: 0.36,
      mouthUpperUpLeft: 0.22,
      mouthUpperUpRight: 0.22,
      jawOpen: 0.07,
      mouthStretchLeft: 0.06,
      mouthStretchRight: 0.06
    },
    attack: 0.024,
    release: 0.048,
    defaultIntensity: 0.84,
    jawDominance: 0.3,
    lipDominance: 0.85,
    notes: "Approximates lower lip to upper teeth; no tooth contact morph exists."
  }),
  V: p({
    ...base,
    phoneme: "V",
    viseme: "FF",
    category: "consonant",
    morphTargets: {
      mouthLowerDownLeft: 0.31,
      mouthLowerDownRight: 0.31,
      mouthUpperUpLeft: 0.18,
      mouthUpperUpRight: 0.18,
      jawOpen: 0.065,
      mouthSmileLeft: 0.025,
      mouthSmileRight: 0.025
    },
    attack: 0.03,
    release: 0.055,
    defaultIntensity: 0.77,
    jawDominance: 0.28,
    lipDominance: 0.8,
    notes: "Voiced F variant, slightly softer and less stretched."
  }),
  TH: p({
    ...base,
    phoneme: "TH",
    viseme: "TH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.16,
      jawForward: 0.1,
      mouthStretchLeft: 0.1,
      mouthStretchRight: 0.1,
      mouthLowerDownLeft: 0.16,
      mouthLowerDownRight: 0.16
    },
    defaultIntensity: 0.78,
    jawDominance: 0.5,
    lipDominance: 0.55,
    notes: "Tongue is unavailable, so jaw-forward open shaping approximates interdental contact."
  }),
  DH: p({
    ...base,
    phoneme: "DH",
    viseme: "TH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.13,
      jawForward: 0.08,
      mouthStretchLeft: 0.08,
      mouthStretchRight: 0.08,
      mouthLowerDownLeft: 0.12,
      mouthLowerDownRight: 0.12
    },
    defaultIntensity: 0.72,
    jawDominance: 0.45,
    lipDominance: 0.5,
    notes: "Softer voiced TH approximation."
  }),
  T: p({
    ...base,
    phoneme: "T",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1,
      mouthClose: 0.16,
      mouthStretchLeft: 0.05,
      mouthStretchRight: 0.05
    },
    attack: 0.02,
    release: 0.035,
    defaultIntensity: 0.72,
    jawDominance: 0.35,
    lipDominance: 0.45,
    notes: "Alveolar stop approximated without tongue controls."
  }),
  D: p({
    ...base,
    phoneme: "D",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.09,
      mouthClose: 0.12,
      mouthStretchLeft: 0.04,
      mouthStretchRight: 0.04
    },
    attack: 0.024,
    release: 0.04,
    defaultIntensity: 0.68,
    jawDominance: 0.32,
    lipDominance: 0.42,
    notes: "Voiced alveolar stop, restrained mouth motion."
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
    notes: "Nasal alveolar with relaxed lips."
  }),
  L: p({
    ...base,
    phoneme: "L",
    viseme: "DD",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.14,
      mouthStretchLeft: 0.08,
      mouthStretchRight: 0.08,
      mouthUpperUpLeft: 0.08,
      mouthUpperUpRight: 0.08
    },
    defaultIntensity: 0.67,
    jawDominance: 0.42,
    lipDominance: 0.5,
    notes: "Distinct from T through a slightly more open lifted-mouth shape."
  }),
  K: p({
    ...base,
    phoneme: "K",
    viseme: "KK",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.11,
      mouthStretchLeft: 0.06,
      mouthStretchRight: 0.06,
      mouthClose: 0.08
    },
    attack: 0.022,
    release: 0.038,
    defaultIntensity: 0.68,
    jawDominance: 0.36,
    lipDominance: 0.35,
    notes: "Back stop approximated with compact jaw opening."
  }),
  G: p({
    ...base,
    phoneme: "G",
    viseme: "KK",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1,
      mouthStretchLeft: 0.04,
      mouthStretchRight: 0.04,
      mouthClose: 0.06
    },
    defaultIntensity: 0.64,
    jawDominance: 0.34,
    lipDominance: 0.32,
    notes: "Voiced K variant."
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
    notes: "Back nasal with minimal visible articulation."
  }),
  CH: p({
    ...base,
    phoneme: "CH",
    viseme: "CH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.12,
      mouthFunnel: 0.18,
      mouthPucker: 0.08,
      mouthStretchLeft: 0.05,
      mouthStretchRight: 0.05
    },
    attack: 0.025,
    release: 0.045,
    defaultIntensity: 0.74,
    jawDominance: 0.42,
    lipDominance: 0.7,
    notes: "Affricate with mild rounding and aperture."
  }),
  JH: p({
    ...base,
    phoneme: "JH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.11, mouthFunnel: 0.15, mouthPucker: 0.06 },
    defaultIntensity: 0.7,
    jawDominance: 0.38,
    lipDominance: 0.65,
    notes: "Softer voiced CH."
  }),
  SH: p({
    ...base,
    phoneme: "SH",
    viseme: "CH",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.1,
      mouthFunnel: 0.22,
      mouthPucker: 0.1,
      mouthStretchLeft: 0.04,
      mouthStretchRight: 0.04
    },
    defaultIntensity: 0.76,
    jawDominance: 0.32,
    lipDominance: 0.75,
    notes: "Postalveolar fricative, protected from excessive smoothing."
  }),
  ZH: p({
    ...base,
    phoneme: "ZH",
    viseme: "CH",
    category: "consonant",
    morphTargets: { jawOpen: 0.09, mouthFunnel: 0.19, mouthPucker: 0.08 },
    defaultIntensity: 0.68,
    jawDominance: 0.3,
    lipDominance: 0.68,
    notes: "Voiced SH variant."
  }),
  S: p({
    ...base,
    phoneme: "S",
    viseme: "SS",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.06,
      mouthStretchLeft: 0.16,
      mouthStretchRight: 0.16,
      mouthClose: 0.12
    },
    attack: 0.018,
    release: 0.035,
    defaultIntensity: 0.7,
    jawDominance: 0.18,
    lipDominance: 0.65,
    notes: "Narrow stretched fricative, kept distinct from SH."
  }),
  Z: p({
    ...base,
    phoneme: "Z",
    viseme: "SS",
    category: "consonant",
    morphTargets: {
      jawOpen: 0.055,
      mouthStretchLeft: 0.13,
      mouthStretchRight: 0.13,
      mouthClose: 0.1
    },
    defaultIntensity: 0.65,
    jawDominance: 0.17,
    lipDominance: 0.6,
    notes: "Voiced S variant."
  }),
  R: p({
    ...base,
    phoneme: "R",
    viseme: "RR",
    category: "consonant",
    morphTargets: { jawOpen: 0.09, mouthPucker: 0.18, mouthFunnel: 0.12, mouthShrugUpper: 0.05 },
    defaultIntensity: 0.7,
    jawDominance: 0.25,
    lipDominance: 0.72,
    notes: "Tighter rounded mouth than neutral consonants."
  }),
  ER: p({
    ...base,
    phoneme: "ER",
    viseme: "RR",
    category: "vowel",
    morphTargets: { jawOpen: 0.16, mouthPucker: 0.16, mouthFunnel: 0.13, mouthShrugUpper: 0.06 },
    defaultIntensity: 0.74,
    jawDominance: 0.46,
    lipDominance: 0.68,
    notes: "Rhotic vowel with rounded tension."
  }),
  W: p({
    ...base,
    phoneme: "W",
    viseme: "WQ",
    category: "consonant",
    morphTargets: { jawOpen: 0.07, mouthPucker: 0.42, mouthFunnel: 0.26 },
    defaultIntensity: 0.8,
    jawDominance: 0.22,
    lipDominance: 0.9,
    notes: "Rounded glide anticipating following vowels."
  }),
  UW: p({
    ...base,
    phoneme: "UW",
    viseme: "WQ",
    category: "vowel",
    morphTargets: { jawOpen: 0.1, mouthPucker: 0.56, mouthFunnel: 0.38 },
    defaultIntensity: 0.87,
    jawDominance: 0.32,
    lipDominance: 0.95,
    notes: "Strongest pucker among rounded vowels."
  }),
  UH: p({
    ...base,
    phoneme: "UH",
    viseme: "WQ",
    category: "vowel",
    morphTargets: { jawOpen: 0.18, mouthPucker: 0.22, mouthFunnel: 0.18 },
    defaultIntensity: 0.72,
    jawDominance: 0.48,
    lipDominance: 0.62,
    notes: "Relaxed rounded central vowel."
  }),
  IY: p({
    ...base,
    phoneme: "IY",
    viseme: "EE",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.14,
      mouthStretchLeft: 0.38,
      mouthStretchRight: 0.38,
      mouthSmileLeft: 0.04,
      mouthSmileRight: 0.04
    },
    defaultIntensity: 0.84,
    jawDominance: 0.38,
    lipDominance: 0.88,
    notes: "High front vowel with strongest horizontal stretch."
  }),
  IH: p({
    ...base,
    phoneme: "IH",
    viseme: "EE",
    category: "vowel",
    morphTargets: { jawOpen: 0.18, mouthStretchLeft: 0.24, mouthStretchRight: 0.24 },
    defaultIntensity: 0.74,
    jawDominance: 0.45,
    lipDominance: 0.72,
    notes: "Less stretched and slightly more open than IY."
  }),
  Y: p({
    ...base,
    phoneme: "Y",
    viseme: "EE",
    category: "consonant",
    morphTargets: { jawOpen: 0.1, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
    defaultIntensity: 0.68,
    jawDominance: 0.26,
    lipDominance: 0.7,
    notes: "Palatal glide with EE anticipation."
  }),
  EH: p({
    ...base,
    phoneme: "EH",
    viseme: "E",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.24,
      mouthStretchLeft: 0.18,
      mouthStretchRight: 0.18,
      mouthLowerDownLeft: 0.08,
      mouthLowerDownRight: 0.08
    },
    defaultIntensity: 0.78,
    jawDominance: 0.58,
    lipDominance: 0.62,
    notes: "Open-mid front vowel."
  }),
  EY: p({
    ...base,
    phoneme: "EY",
    viseme: "E",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.21,
      mouthStretchLeft: 0.22,
      mouthStretchRight: 0.22,
      mouthSmileLeft: 0.04,
      mouthSmileRight: 0.04
    },
    defaultIntensity: 0.78,
    jawDominance: 0.52,
    lipDominance: 0.68,
    notes: "Diphthong leaning toward EE stretch."
  }),
  AA: p({
    ...base,
    phoneme: "AA",
    viseme: "AA",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.5,
      mouthLowerDownLeft: 0.18,
      mouthLowerDownRight: 0.18,
      mouthFunnel: 0.02
    },
    attack: 0.045,
    release: 0.07,
    defaultIntensity: 0.9,
    jawDominance: 0.95,
    lipDominance: 0.44,
    notes: "Open vowel with largest jaw motion."
  }),
  AE: p({
    ...base,
    phoneme: "AE",
    viseme: "AA",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.42,
      mouthStretchLeft: 0.21,
      mouthStretchRight: 0.21,
      mouthLowerDownLeft: 0.16,
      mouthLowerDownRight: 0.16
    },
    defaultIntensity: 0.85,
    jawDominance: 0.82,
    lipDominance: 0.62,
    notes: "Wide open front vowel."
  }),
  AH: p({
    ...base,
    phoneme: "AH",
    viseme: "AA",
    category: "vowel",
    morphTargets: { jawOpen: 0.34, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
    defaultIntensity: 0.78,
    jawDominance: 0.74,
    lipDominance: 0.42,
    notes: "Neutral open vowel."
  }),
  AO: p({
    ...base,
    phoneme: "AO",
    viseme: "OH",
    category: "vowel",
    morphTargets: { jawOpen: 0.36, mouthFunnel: 0.29, mouthPucker: 0.14 },
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
    morphTargets: { jawOpen: 0.22, mouthFunnel: 0.36, mouthPucker: 0.32 },
    defaultIntensity: 0.85,
    jawDominance: 0.56,
    lipDominance: 0.86,
    notes: "Combines funnel, pucker, and moderate jaw opening."
  }),
  OY: p({
    ...base,
    phoneme: "OY",
    viseme: "OH",
    category: "vowel",
    morphTargets: {
      jawOpen: 0.24,
      mouthFunnel: 0.24,
      mouthPucker: 0.2,
      mouthStretchLeft: 0.08,
      mouthStretchRight: 0.08
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
    morphTargets: { jawOpen: 0.32, mouthFunnel: 0.18, mouthPucker: 0.1 },
    defaultIntensity: 0.8,
    jawDominance: 0.72,
    lipDominance: 0.58,
    notes: "Open-to-rounded diphthong."
  }),
  AY: p({
    ...base,
    phoneme: "AY",
    viseme: "AA",
    category: "vowel",
    morphTargets: { jawOpen: 0.36, mouthStretchLeft: 0.12, mouthStretchRight: 0.12 },
    defaultIntensity: 0.82,
    jawDominance: 0.78,
    lipDominance: 0.55,
    notes: "Open-to-front diphthong."
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
  })
};
