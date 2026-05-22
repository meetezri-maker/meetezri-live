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

export const JORDAN_EYE_FOCUS_TUNING = {
  idleHoldMs: [2500, 5500],
  listeningHoldMs: [3500, 7500],
  thinkingHoldMs: [3000, 6500],
  speakingHoldMs: [2200, 5000],
  idleEyeMax: 0.045,
  listeningEyeMax: 0.035,
  thinkingDownMax: 0.055,
  speakingEyeMax: 0.03,
  blendSpeed: 2.2,
  asymmetryAmount: [0.03, 0.08],
  thinkingDownBias: 0.025,
  horizontalHeadYawMax: 0.006,
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

export const JORDAN_LISTENING_FACE_TUNING = {
  browBase: [0.03, 0.07],
  browPeak: [0.08, 0.12],
  smileLeft: [0.04, 0.09],
  smileRight: [0.04, 0.1],
  concernFrown: [0.04, 0.1],
  cheek: [0.02, 0.07],
  headTiltRadians: [0.006, 0.018],
  targetHoldMs: [2500, 5000],
  blendSpeed: 1.8,
  asymmetryAmount: [0.04, 0.1],
} as const;

export const JORDAN_IDLE_BROW_TUNING = {
  baseMin: 0.01,
  baseMax: 0.03,
  peakMin: 0.035,
  peakMax: 0.045,
  peakProbability: 0.18,
  maxValue: 0.05,
  targetHoldMs: [4000, 9000],
  blendSpeed: 1,
} as const;

export const JORDAN_EXPRESSION_PRESETS = {
  calmIdle: {
    visemeRest: [0.14, 0.2],
    mouthSmileLeft: [0.025, 0.055],
    mouthSmileRight: [0.03, 0.065],
    cheekSquintLeft: [0.015, 0.035],
    cheekSquintRight: [0.018, 0.04],
    eyebrows: [0.018, 0.045],
    sad: [0, 0],
    mouthFrownLeft: [0, 0],
    mouthFrownRight: [0, 0],
    eyeLookDownLeft: [0.005, 0.02],
    eyeLookDownRight: [0.005, 0.02],
    eyeLookUpLeft: [0, 0.012],
    eyeLookUpRight: [0, 0.012],
  },
  attentiveListening: {
    visemeRest: [0.16, 0.22],
    mouthSmileLeft: [0.06, 0.12],
    mouthSmileRight: [0.07, 0.13],
    cheekSquintLeft: [0.035, 0.08],
    cheekSquintRight: [0.04, 0.09],
    eyebrows: [0.04, 0.095],
    sad: [0, 0],
    mouthFrownLeft: [0, 0],
    mouthFrownRight: [0, 0],
    eyeLookDownLeft: [0.005, 0.018],
    eyeLookDownRight: [0.005, 0.018],
    eyeLookUpLeft: [0.005, 0.018],
    eyeLookUpRight: [0.005, 0.018],
  },
  warmSpeaking: {
    cheekSquintLeft: [0.025, 0.07],
    cheekSquintRight: [0.03, 0.08],
    eyebrows: [0.025, 0.075],
    mouthSmileLeft: [0.02, 0.07],
    mouthSmileRight: [0.025, 0.08],
    mouthFrownLeft: [0.02, 0.07],
    mouthFrownRight: [0.02, 0.07],
    sad: [0.06, 0.16],
  },
} as const;

export const JORDAN_EXPRESSION_PRESET_TUNING = {
  blendSpeed: 1.4,
  speakingBlendSpeed: 2.2,
  asymmetryAmount: [0.04, 0.1],
  sentimentSmileMultiplier: 1,
  sadSmileReduction: 0.3,
  speechEnergyCheekMultiplier: 1,
  maxPresetContribution: 1,
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

// Phase 1 only: configuration foundation for Jordan's future Behavioral Timing Engine.
// This is intentionally not wired into runtime orchestration yet.
// Existing blink, eye focus, expression, head/neck, viseme, and session systems remain authoritative.
// Phase 2 scheduler work can consume this config to coordinate FaceTime-like timing safely.
export const DEBUG_JORDAN_BEHAVIOR_TIMING = false;
export const DEBUG_JORDAN_PERSONALITY_TIMING = false;
export const ENABLE_JORDAN_PERSONALITY_TIMING = false;

export const JORDAN_BEHAVIOR_TIMING_CONFIG = {
  stillnessWindows: {
    idle: [5000, 11000],
    listening: [3500, 8500],
    thinking: [4500, 10000],
    speaking: [2500, 6500],
  },
  reactionDelay: {
    listeningAck: [700, 1800],
    empathySoften: [900, 2400],
    thinkingAbsorb: [1200, 3000],
    turnEndRelease: [150, 450],
  },
  reactionCooldowns: {
    brow: [3500, 7500],
    smileTwitch: [4000, 9000],
    headTilt: [6000, 14000],
    eyeRefocus: [2500, 6500],
    blinkCluster: [5000, 12000],
  },
  reactionProbabilities: {
    listeningAck: 0.42,
    empathySoften: 0.24,
    microSmile: 0.34,
    browLift: 0.28,
    browKnit: 0.16,
    headTilt: 0.18,
    microHeadShake: 0.08,
    eyeRefocus: 0.52,
    stillness: 0.35,
  },
  behaviorWeightsByState: {
    idle: {
      stillness: 0.7,
      microBehavior: 0.22,
      reaction: 0.08,
    },
    listening: {
      stillness: 0.55,
      microBehavior: 0.3,
      reaction: 0.15,
    },
    thinking: {
      stillness: 0.65,
      microBehavior: 0.25,
      reaction: 0.1,
    },
    speaking: {
      stillness: 0.5,
      microBehavior: 0.35,
      reaction: 0.15,
    },
  },
  emotionalLatencyBySentiment: {
    happy: {
      minDelayMs: 400,
      maxDelayMs: 1200,
      reactionScale: 1.05,
    },
    neutral: {
      minDelayMs: 700,
      maxDelayMs: 1800,
      reactionScale: 1,
    },
    sad: {
      minDelayMs: 1000,
      maxDelayMs: 2600,
      reactionScale: 0.75,
    },
    anxious: {
      minDelayMs: 900,
      maxDelayMs: 2200,
      reactionScale: 0.85,
    },
  },
  behaviorIntensityRanges: {
    browLift: [0.015, 0.06],
    browKnit: [0.015, 0.05],
    microSmile: [0.02, 0.08],
    concernFrown: [0.02, 0.07],
    cheekSupport: [0.015, 0.06],
    headTiltRadians: [0.004, 0.016],
    headYawRadians: [0.003, 0.012],
    eyeRefocus: [0.008, 0.035],
  },
  behaviorIntentNames: [
    "idle_stillness",
    "idle_micro_adjust",
    "listening_ack",
    "listening_soft_smile",
    "empathy_soften",
    "thinking_absorb",
    "eye_refocus",
    "brow_soft_lift",
    "brow_concern",
    "micro_head_tilt",
    "micro_head_shake",
    "turn_end_release",
    "soft_processing_pause",
    "speaking_emphasis",
    "speaking_soften",
    "speaking_settle",
    "user_sentence_end",
    "jordan_sentence_end",
    "user_pause_ack",
    "long_pause_stillness",
    "processing_pause",
    "anticipation_focus",
    "emotional_emphasis",
    "turn_taking_settle",
    "pre_speech_focus",
    "post_speech_release",
  ],
} as const;

export const JORDAN_SPEAKING_BEHAVIOR_TUNING = {
  speechEnergySmoothingSpeed: 3.2,
  cheekEnergyRange: [0.015, 0.07],
  browEnergyRange: [0.012, 0.06],
  smileEnergyRange: [0.01, 0.055],
  frownEnergyRange: [0.01, 0.055],
  eyeRefocusRange: [0.006, 0.025],
  headSupportYawRange: [0.002, 0.007],
  headSupportTiltRange: [0.002, 0.006],
  turnEndReleaseDelayMs: [150, 450],
  turnEndSettleMs: [600, 1400],
  speakingStillnessChance: 0.35,
  maxSpeakingSupport: 0.08,
} as const;

export const JORDAN_EMOTIONAL_MODULATION_TUNING = {
  happy: {
    reactionSpeedMultiplier: 1.15,
    reactionDelayMultiplier: 0.85,
    eyeEngagementMultiplier: 1.12,
    cheekWarmthMultiplier: 1.18,
    smileMultiplier: 1.15,
    blinkDelayMultiplier: 0.95,
    stillnessMultiplier: 0.9,
  },
  neutral: {
    reactionSpeedMultiplier: 1,
    reactionDelayMultiplier: 1,
    eyeEngagementMultiplier: 1,
    cheekWarmthMultiplier: 1,
    smileMultiplier: 1,
    blinkDelayMultiplier: 1,
    stillnessMultiplier: 1,
  },
  sad: {
    reactionSpeedMultiplier: 0.75,
    reactionDelayMultiplier: 1.35,
    eyeEngagementMultiplier: 0.75,
    cheekWarmthMultiplier: 0.55,
    smileMultiplier: 0.35,
    blinkDelayMultiplier: 1.25,
    stillnessMultiplier: 1.25,
    concernMultiplier: 1.2,
  },
  anxious: {
    reactionSpeedMultiplier: 0.85,
    reactionDelayMultiplier: 1.2,
    eyeEngagementMultiplier: 0.85,
    cheekWarmthMultiplier: 0.65,
    smileMultiplier: 0.45,
    blinkDelayMultiplier: 1.15,
    stillnessMultiplier: 1.2,
    concernMultiplier: 1.15,
  },
  thinking: {
    reactionSpeedMultiplier: 0.8,
    reactionDelayMultiplier: 1.25,
    eyeEngagementMultiplier: 0.7,
    cheekWarmthMultiplier: 0.45,
    smileMultiplier: 0.35,
    blinkDelayMultiplier: 1.2,
    stillnessMultiplier: 1.35,
    thinkingDownBiasMultiplier: 1.25,
  },
} as const;

export const JORDAN_MOTION_INDEPENDENCE_TUNING = {
  channelOffsetsMs: {
    blink: [120, 900],
    eye: [0, 450],
    brow: [160, 650],
    mouth: [240, 850],
    cheek: [280, 900],
    head: [350, 1200],
  },
  channelJitterMs: {
    idle: [80, 320],
    listening: [120, 480],
    thinking: [180, 650],
    speaking: [80, 300],
  },
  channelCooldownMs: {
    blink: [900, 2200],
    eye: [700, 1800],
    brow: [1800, 4200],
    mouth: [2200, 5200],
    cheek: [2200, 5200],
    head: [3500, 9000],
  },
  maxChannelsPerEvent: {
    idle: 2,
    listening: 3,
    thinking: 2,
    speaking: 2,
  },
  probabilityByChannel: {
    blink: 0.42,
    eye: 0.62,
    brow: 0.36,
    mouth: 0.34,
    cheek: 0.32,
    head: 0.18,
  },
  imperfectCoordinationAmount: [0.65, 1.35],
  interruptionVarianceMs: [120, 650],
  allowNoReactionProbability: 0.22,
} as const;

export const JORDAN_CONVERSATIONAL_AWARENESS_TUNING = {
  sentenceEndBlinkDelayMs: [120, 420],
  sentenceEndSettleMs: [600, 1400],
  userPauseThresholdMs: [900, 1800],
  longPauseThresholdMs: [2200, 4200],
  acknowledgmentDelayMs: [650, 1800],
  processingPauseDelayMs: [900, 2400],
  anticipationPauseMs: [180, 650],
  emotionalEmphasisDelayMs: [700, 2200],
  emotionalEmphasisCooldownMs: [4500, 11000],
  turnTakingCooldownMs: [900, 2400],
  maxAwarenessEventsPerTurn: 3,
  sentenceEndEventProbability: 0.72,
  userPauseAckProbability: 0.46,
  longPauseStillnessProbability: 0.58,
  anticipationFocusProbability: 0.52,
  emotionalEmphasisProbability: 0.38,
} as const;

export const JORDAN_FINAL_HUMANIZATION_TUNING = {
  targetStillnessRatio: 0.7,
  targetMicroBehaviorRatio: 0.2,
  targetReactionRatio: 0.1,
  maxRepeatedIntentCount: 2,
  repeatedIntentCooldownMs: [8000, 18000],
  overactivityWindowMs: 12000,
  maxEventsPerWindow: {
    idle: 3,
    listening: 4,
    thinking: 3,
    speaking: 4,
  },
  minimumStillnessAfterReactionMs: [1200, 3200],
  sameChannelRepeatPenalty: 0.55,
  sameIntentRepeatPenalty: 0.45,
  subtletyMultiplier: {
    idle: 0.75,
    listening: 0.85,
    thinking: 0.7,
    speaking: 0.8,
  },
  randomnessJitterMultiplier: 1.25,
  noReactionProbabilityBoost: {
    idle: 0.25,
    listening: 0.18,
    thinking: 0.28,
    speaking: 0.15,
  },
} as const;

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
