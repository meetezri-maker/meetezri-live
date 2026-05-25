import type { AvatarDefinition } from "../avatarConfigTypes";

export const SARA_MORPH_NAMES = [
  "eye_close",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "viseme_rest",
  "mouthSmileLeft",
  "mouthSmileRight",
  "smile",
  "mouthFrownLeft",
  "mouthFrownRight",
  "sad",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "viseme_AA",
  "viseme_PP",
  "viseme_O",
  "viseme_IH",
  "viseme_E",
  "viseme_CH",
  "eyebrows",
  "jawOpen",
  "Mouth",
  "Eyes",
] as const;

export type SaraMorphName = (typeof SARA_MORPH_NAMES)[number];

export const SARA_MORPH_NAME_SET = new Set<string>(SARA_MORPH_NAMES);

export const SARA_VISEME_NAMES = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_PP",
  "viseme_CH",
  "viseme_E",
] as const satisfies readonly SaraMorphName[];

export const SARA_BLINK_MORPH_NAMES = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eye_close",
] as const satisfies readonly SaraMorphName[];

export const SARA_EXPRESSION_MORPH_NAMES = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "sad",
  "eyebrows",
  "jawOpen",
] as const satisfies readonly SaraMorphName[];

export const SARA_EYE_FOCUS_MORPH_NAMES = [
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
] as const satisfies readonly SaraMorphName[];

export const SARA_LEGACY_FALLBACK_MORPHS = [
  "Mouth",
  "Eyes",
  "smile",
] as const satisfies readonly SaraMorphName[];

export const SARA_REQUIRED_DRIVER_MORPHS = [
  ...SARA_VISEME_NAMES,
  "eyeBlinkLeft",
  "eyeBlinkRight",
  ...SARA_EXPRESSION_MORPH_NAMES,
  ...SARA_EYE_FOCUS_MORPH_NAMES,
] as const satisfies readonly SaraMorphName[];

export const SARA_MORPH_AUDIT_NAMES = SARA_MORPH_NAMES;

export const SARA_EXPRESSION_CAPS = {
  mouthSmileLeft: 0.16,
  mouthSmileRight: 0.16,
  mouthFrownLeft: 0.14,
  mouthFrownRight: 0.14,
  cheekSquintLeft: 0.12,
  cheekSquintRight: 0.12,
  eyebrows: 0.12,
  sad: 0.16,
  jawOpen: 0.2,
  eyeLookUpLeft: 0.06,
  eyeLookUpRight: 0.06,
  eyeLookDownLeft: 0.06,
  eyeLookDownRight: 0.06,
} as const satisfies Partial<Record<SaraMorphName, number>>;

export const PHONEME_TO_SARA_VISEME: Record<string, SaraMorphName> = {
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
  CH: "viseme_CH",
  SH: "viseme_CH",
  JH: "viseme_CH",
  S: "viseme_rest",
  Z: "viseme_rest",
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

export const SARA_FACE_TUNING = {
  lookAheadSeconds: 0.04,
  speechLerpSpeed: 12,
  decayLerpSpeed: 7,
  jawLerpSpeed: 6,
  emotionLerpSpeed: 2.5,
  gazeLerpSpeed: 2.5,
  visemeMaxStrength: 0.72,
} as const;

export const SARA_BLINK_TUNING = {
  idleDelayMs: [2800, 5600],
  listeningDelayMs: [3400, 6800],
  thinkingDelayMs: [3800, 7600],
  speakingDelayMs: [3200, 6400],
  fullBlinkDurationMs: [110, 170],
  partialBlinkDurationMs: [90, 140],
  slowBlinkDurationMs: [170, 250],
  partialProbability: 0.1,
  slowBlinkProbability: 0.06,
  doubleBlinkProbability: 0.03,
  fullBlinkMax: [0.75, 0.9],
  partialBlinkMax: [0.3, 0.5],
  slowBlinkMax: [0.55, 0.8],
  asymmetryAmount: [0.02, 0.06],
  asymmetryLagMs: [5, 14],
  speechEndBlinkDelayMs: [180, 500],
  minTimeBetweenBlinksMs: 900,
  recoveryMs: [90, 130],
  doubleBlinkGapMs: [100, 180],
} as const;

export const SARA_EYE_FOCUS_TUNING = {
  idleHoldMs: [2600, 5600],
  listeningHoldMs: [3600, 7600],
  thinkingHoldMs: [3200, 6600],
  speakingHoldMs: [2400, 5200],
  idleEyeMax: 0.038,
  listeningEyeMax: 0.032,
  thinkingDownMax: 0.05,
  speakingEyeMax: 0.028,
  blendSpeed: 2,
  asymmetryAmount: [0.02, 0.06],
  thinkingDownBias: 0.02,
  horizontalHeadYawMax: 0.005,
} as const;

export const SARA_EXPRESSION_PRESETS = {
  calmIdle: {
    visemeRest: [0.1, 0.16],
    mouthSmileLeft: [0.015, 0.04],
    mouthSmileRight: [0.015, 0.045],
    cheekSquintLeft: [0.01, 0.025],
    cheekSquintRight: [0.01, 0.03],
    eyebrows: [0.012, 0.035],
    sad: [0, 0],
    mouthFrownLeft: [0, 0],
    mouthFrownRight: [0, 0],
  },
  attentiveListening: {
    visemeRest: [0.12, 0.18],
    mouthSmileLeft: [0.035, 0.08],
    mouthSmileRight: [0.04, 0.085],
    cheekSquintLeft: [0.02, 0.055],
    cheekSquintRight: [0.02, 0.06],
    eyebrows: [0.03, 0.075],
    sad: [0, 0],
    mouthFrownLeft: [0, 0],
    mouthFrownRight: [0, 0],
  },
  warmSpeaking: {
    cheekSquintLeft: [0.015, 0.05],
    cheekSquintRight: [0.018, 0.055],
    eyebrows: [0.02, 0.06],
    mouthSmileLeft: [0.015, 0.055],
    mouthSmileRight: [0.018, 0.06],
    mouthFrownLeft: [0.015, 0.05],
    mouthFrownRight: [0.015, 0.05],
    sad: [0.04, 0.12],
  },
} as const;

export const SARA_EXPRESSION_PRESET_TUNING = {
  blendSpeed: 1.2,
  speakingBlendSpeed: 1.9,
  asymmetryAmount: [0.03, 0.08],
  sentimentSmileMultiplier: 0.85,
  sadSmileReduction: 0.35,
  speechEnergyCheekMultiplier: 0.85,
  maxPresetContribution: 0.8,
} as const;

export const SARA_HEAD_PRESENCE_TUNING = {
  idleYawMax: 0.01,
  listeningYawMax: 0.016,
  idleTiltMax: 0.006,
  listeningTiltMax: 0.009,
  minTargetHoldMs: 2600,
  maxTargetHoldMs: 6200,
  blendSpeed: 1,
} as const;

/**
 * Preparation-only Sara avatar config.
 *
 * Sara is prepared as a future morph-driven avatar but is not wired into the
 * live facial renderer yet. Camera/focus values are conservative starting
 * placeholders and still require visual tuning against the chosen GLB.
 *
 * The current Sara asset still has multiple roots/coordinate spaces. Best
 * long-term fix is a clean GLB re-export with one normalized avatar root.
 * Current config is a runtime stabilization layer, not a permanent asset fix.
 */
export const SARA_AVATAR_DEFINITION = {
  id: "sara",
  displayName: "Sara",
  status: "scaffold-incomplete",
  model: {
    url: "/avatars/Sara%20Mitchell--.glb",
    renderMode: "rfv2Morph",
    preload: false,
  },
  camera: {
  mode: "fixed",
  fov: 30,
  position: [0, 1.6, 5.5],
  lookAt: [0, 1.2, 0],
},

gltfTransform: {
  position: [0, -0.2, 0],
  scale: [8, 8, 8],
  rotation: [0, 0, 0],
},
  visualAnchor: {
    preferredMeshNames: ["model_19", "model_19.001"],
    enabledForProductionCamera: false,
    notes:
      "Temporary debug-only visual anchor until Sara is re-exported as one normalized root.",
  },
  // Sara runtime stabilization layer. Long-term fix: clean one-root GLB export.
  // Disable forceBasicMaterial after Sara's original materials render correctly.
  runtimeFix: {
    enabled: true,
    forceVisible: true,
    forceBasicMaterial: true,
    wireframe: false,
    normalizeVisibleMeshes: true,
    targetHeight: 1.8,
    preferredMeshNames: ["model_19", "model_19.001"],
    debug: true,
    debugAutoFrameCamera: false,
  },
  morphs: {
    names: SARA_MORPH_NAMES,
    nameSet: SARA_MORPH_NAME_SET,
    visemeNames: SARA_VISEME_NAMES,
    blinkMorphNames: SARA_BLINK_MORPH_NAMES,
    requiredDriverMorphs: SARA_REQUIRED_DRIVER_MORPHS,
    auditMorphs: SARA_MORPH_AUDIT_NAMES,
    expressionAuthorityMorphs: SARA_EXPRESSION_MORPH_NAMES,
    eyeMorphNames: SARA_EYE_FOCUS_MORPH_NAMES,
    legacyFallbackMorphs: SARA_LEGACY_FALLBACK_MORPHS,
    expressionCaps: SARA_EXPRESSION_CAPS,
  },
  expressions: {
    faceTuning: SARA_FACE_TUNING,
    presets: SARA_EXPRESSION_PRESETS,
    presetTuning: SARA_EXPRESSION_PRESET_TUNING,
  },
  blink: {
    morphNames: SARA_BLINK_MORPH_NAMES,
    tuning: SARA_BLINK_TUNING,
  },
  eyeFocus: {
    morphNames: {
      upLeft: "eyeLookUpLeft",
      upRight: "eyeLookUpRight",
      downLeft: "eyeLookDownLeft",
      downRight: "eyeLookDownRight",
    },
    tuning: SARA_EYE_FOCUS_TUNING,
  },
  headPresence: {
    tuning: SARA_HEAD_PRESENCE_TUNING,
  },
  visemes: {
    names: SARA_VISEME_NAMES,
    phonemeToViseme: PHONEME_TO_SARA_VISEME,
  },
  // Sara values are placeholders and not fully active until Sara behavior systems are wired.
  personalityTiming: {
    reactionSpeed: 1.05,
    reactionDelayMultiplier: 0.95,
    stillnessPreference: 0.95,
    blinkCadenceMultiplier: 0.9,
    eyeEngagement: 1.1,
    headMovementAmount: 1,
    smileWarmth: 1,
    emotionalLatency: 0.95,
    empathySoftness: 1,
    expressiveness: 1,
    nervousSystemVariance: 1.15,
    listeningWarmth: 1,
    speakingEnergy: 1,
    thinkingStillness: 1,
    interruptionSensitivity: 1,
  },
  notes:
    "Sara config is populated for future one-brain-folder support. It is not active in the current session runtime.",
} as const satisfies AvatarDefinition;
