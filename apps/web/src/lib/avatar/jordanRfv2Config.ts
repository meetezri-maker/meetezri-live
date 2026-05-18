export const DEBUG_JORDAN_PHONEMES = true;
export const DEBUG_JORDAN_EXPRESSION_TEST = false;
export const DEBUG_JORDAN_LISTENING_MORPH_TEST = false;
export const DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY = false;
export const DEBUG_JORDAN_TEST_MORPH = "eyeBlinkLeft";
export const DEBUG_JORDAN_TEST_VALUE = 1.0;

export const JORDAN_MORPH_NAMES = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_S",
  "viseme_PP",
  "sad",
  "eye_blink",
  "eyebrows",
  "viseme_CH",
  "viseme_E",
  "eyeBlinkRight",
  "eyeBlinkLeft",
  "mouthSmileRight",
  "mouthSmileLeft",
  "jawOpen",
  "eyeLookUpRight",
  "eyeLookUpLeft",
  "eyeLookDownRight",
  "eyeLookDownLeft",
  "mouthFrownRight",
  "mouthFrownLeft",
  "cheekSquintRight",
  "cheekSquintLeft",
] as const;

export type JordanMorphName = (typeof JORDAN_MORPH_NAMES)[number];

export const JORDAN_MORPH_NAME_SET = new Set<string>(JORDAN_MORPH_NAMES);

export const JORDAN_VISEME_NAMES: JordanMorphName[] = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_S",
  "viseme_PP",
  "viseme_CH",
  "viseme_E",
];

export const JORDAN_BLINK_MORPH_NAMES: JordanMorphName[] = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eye_blink",
];

export const JORDAN_RFV2_REQUIRED_DRIVER_MORPHS: JordanMorphName[] = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_S",
  "viseme_PP",
  "viseme_CH",
  "viseme_E",
  "eyeBlinkRight",
  "eyeBlinkLeft",
  "mouthSmileLeft",
  "mouthSmileRight",
  "jawOpen",
  "eyeLookUpRight",
  "eyeLookUpLeft",
  "eyeLookDownRight",
  "eyeLookDownLeft",
  "mouthFrownLeft",
  "mouthFrownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "sad",
  "eyebrows",
];

export const JORDAN_RFV2_MORPH_AUDIT_NAMES: JordanMorphName[] = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_S",
  "viseme_PP",
  "viseme_CH",
  "viseme_E",
  "eyeBlinkRight",
  "eyeBlinkLeft",
  "mouthSmileRight",
  "mouthSmileLeft",
  "jawOpen",
  "eyeLookUpRight",
  "eyeLookUpLeft",
  "eyeLookDownRight",
  "eyeLookDownLeft",
  "mouthFrownRight",
  "mouthFrownLeft",
  "cheekSquintRight",
  "cheekSquintLeft",
  "sad",
  "eyebrows",
];

export const JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE: JordanMorphName[] = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyebrows",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "jawOpen",
];

export const JORDAN_RFV2_LISTENING_MORPH_TEST_SEQUENCE: JordanMorphName[] = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyebrows",
  "sad",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "jawOpen",
];

export const JORDAN_EXPRESSION_CAPS = {
  mouthSmileLeft: 0.22,
  mouthSmileRight: 0.22,
  mouthFrownLeft: 0.2,
  mouthFrownRight: 0.2,
  cheekSquintLeft: 0.18,
  cheekSquintRight: 0.18,
  eyebrows: 0.18,
  sad: 0.25,
  jawOpen: 0.22,
  eyeLookUpLeft: 0.08,
  eyeLookUpRight: 0.08,
  eyeLookDownLeft: 0.08,
  eyeLookDownRight: 0.08,
} as const satisfies Partial<Record<JordanMorphName, number>>;

export const JORDAN_EXPRESSION_AUTHORITY_MORPHS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyebrows",
  "sad",
  "jawOpen",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
] as const satisfies readonly JordanMorphName[];

export const JORDAN_RFV2_FACE_TUNING = {
  lookAheadSeconds: 0.04,
  speechLerpSpeed: 15,
  decayLerpSpeed: 8.5,
  jawLerpSpeed: 7.5,
  emotionLerpSpeed: 3.2,
  gazeLerpSpeed: 3.2,
  visemeMaxStrength: 0.86,
} as const;

export const JORDAN_RFV2_IDLE_TUNING = {
  breathingSpeed: 0.00125,
  breathingAmount: 0.006,
  idleRestMin: 0.16,
  idleRestMax: 0.22,
  idleSmileMax: 1,
  idleBrowMax: 0.068,
  idleCheekMax: 0.052,
  gazeMax: 0.052,
  gazeChangeIntervalMin: 4200,
  gazeChangeIntervalMax: 7600,
  idleBlendSpeed: 1.85,
} as const;

export const JORDAN_EYE_INTELLIGENCE_TUNING = {
  gazeSpeed: 2.15,
  gazeStrength: 0.036,
  focusHoldMin: 1000,
  focusHoldMax: 3000,
  eyeDriftAmount: 0.012,
  listeningFocusAmount: 0.72,
  thinkingDownwardBias: 0.018,
  emotionalBlendSpeed: 3.4,
  asymmetryAmount: 0.006,
} as const;

export const JORDAN_LISTENING_SMILE_TUNING = {
  blendInSpeed: 0.85,
  blendOutSpeed: 0.75,
  sadReduction: 0.3,
  smileLeftMin: 1,
  smileLeftMax: 1,
  smileRightMin: 1,
  smileRightMax: 1,
  cheekLeftMin: 0.18,
  cheekLeftMax: 0.35,
  cheekRightMin: 0.2,
  cheekRightMax: 0.38,
  browMin: 0.06,
  browMax: 0.12,
} as const;

export const JORDAN_HEAD_PRESENCE_TUNING = {
  idleYawMax: 0.014,
  listeningYawMax: 0.02,
  idleTiltMax: 0.008,
  listeningTiltMax: 0.011,
  minTargetHoldMs: 2500,
  maxTargetHoldMs: 6000,
  blendSpeed: 1.15,
} as const;

export const JORDAN_RFV2_BLINK_TUNING = {
  idleDelayMs: [2400, 4800],
  listeningDelayMs: [3200, 6500],
  thinkingDelayMs: [3800, 7500],
  speakingDelayMs: [3000, 6000],
  fullBlinkDurationMs: [100, 150],
  partialBlinkDurationMs: [80, 130],
  slowBlinkDurationMs: [160, 240],
  partialProbability: 0.14,
  slowBlinkProbability: 0.08,
  doubleBlinkProbability: 0.04,
  fullBlinkMax: [0.8, 0.95],
  partialBlinkMax: [0.35, 0.6],
  slowBlinkMax: [0.6, 0.85],
  asymmetryAmount: [0.03, 0.08],
  asymmetryLagMs: [5, 15],
  speechEndBlinkDelayMs: [150, 450],
  minTimeBetweenBlinksMs: 800,
  recoveryMs: [80, 120],
  doubleBlinkGapMs: [90, 180],
} as const;

export const JORDAN_PROCEDURAL_BLINK_TUNING = JORDAN_RFV2_BLINK_TUNING;

export const JORDAN_HEAD_OFFSET_Y = 0.44;
export const JORDAN_HEAD_OFFSET_X = -0.01;

export const PHONEME_TO_JORDAN_VISEME: Record<string, JordanMorphName> = {
  AA: "viseme_AA",
  AH: "viseme_AA",
  AE: "viseme_AA",
  AY: "viseme_AA",
  EY: "viseme_E",
  EH: "viseme_E",
  IH: "viseme_IH",
  IY: "viseme_IH",
  AO: "viseme_O",
  OW: "viseme_O",
  OY: "viseme_O",
  UW: "viseme_O",
  UH: "viseme_O",
  P: "viseme_PP",
  B: "viseme_PP",
  M: "viseme_PP",
  S: "viseme_S",
  Z: "viseme_S",
  CH: "viseme_CH",
  SH: "viseme_CH",
  JH: "viseme_CH",
  PAUSE: "viseme_rest",
  SIL: "viseme_rest",
  REST: "viseme_rest",
  SP: "viseme_rest",
  HH: "viseme_rest",
  DH: "viseme_rest",
  TH: "viseme_rest",
  D: "viseme_rest",
  T: "viseme_rest",
  N: "viseme_rest",
  L: "viseme_rest",
  R: "viseme_rest",
  K: "viseme_rest",
  G: "viseme_rest",
  Y: "viseme_rest",
  W: "viseme_rest",
  F: "viseme_rest",
  V: "viseme_rest",
};
