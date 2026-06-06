/**
 * Sara RFv2 foundation only.
 *
 * These constants document Sara's future first-class RFv2 production path.
 * They are not wired into the live runtime, and Sara still uses the current
 * Sara V2 / legacyHybrid path. Do not activate this file until a later
 * explicit phase.
 */

export const SARA_RFV2_ENABLED = false;

export const SARA_RFV2_MODEL = {
  url: "/avatars/C2-.glb",
  notes: "Future Sara RFv2 production path. Not active yet.",
} as const;

export const SARA_RFV2_MORPH_NAMES = {
  visemes: {
    rest: "viseme_rest",
    aa: "viseme_AA",
    ih: "viseme_IH",
    e: "viseme_E",
    o: "viseme_O",
    pp: "viseme_PP",
    ch: "viseme_CH",
    sFallbackOptional: "viseme_S",
  },
  mouth: {
    jawOpen: "jawOpen",
    mouth: "Mouth",
    smileLeft: "mouthSmileLeft",
    smileRight: "mouthSmileRight",
    frownLeft: "mouthFrownLeft",
    frownRight: "mouthFrownRight",
  },
  eyes: {
    blinkLeft: "eyeBlinkLeft",
    blinkRight: "eyeBlinkRight",
    lookUpLeft: "eyeLookUpLeft",
    lookUpRight: "eyeLookUpRight",
    lookDownLeft: "eyeLookDownLeft",
    lookDownRight: "eyeLookDownRight",
  },
  cheeks: {
    squintLeft: "cheekSquintLeft",
    squintRight: "cheekSquintRight",
  },
  emotions: {
    smile: "smile",
    sad: "sad",
  },
} as const;

export const SARA_RFV2_PHONEME_TO_VISEME = {
  AA: "viseme_AA",
  AH: "viseme_AA",
  IH: "viseme_IH",
  IY: "viseme_IH",
  EH: "viseme_E",
  AE: "viseme_E",
  OW: "viseme_O",
  OY: "viseme_O",
  UW: "viseme_O",
  P: "viseme_PP",
  B: "viseme_PP",
  M: "viseme_PP",
  CH: "viseme_CH",
  JH: "viseme_CH",
  SH: "viseme_CH",
  ZH: "viseme_CH",
  S: "viseme_E",
  Z: "viseme_E",
  default: "viseme_rest",
} as const;

export const SARA_RFV2_FACE_TUNING = {
  lookAheadSeconds: 0.04,
  visemeMaxStrength: 0.18,
  jawOpenMax: 0.07,
  restStrength: 0.02,
  smoothingSpeed: 14,
  releaseSpeed: 10,
} as const;

export const SARA_RFV2_EXPRESSION_CAPS = {
  jawOpen: 0.09,
  mouthSmile: 0.08,
  mouthFrown: 0.06,
  cheekSquint: 0.05,
  blink: 1.0,
  eyeLook: 0.08,
  sad: 0.08,
} as const;

export const SARA_RFV2_BLINK_TUNING = {
  idleDelayRangeMs: [3800, 7500],
  listeningDelayRangeMs: [5000, 9000],
  speakingDelayRangeMs: [3500, 7000],
  blinkDurationMs: [100, 160],
  doubleBlinkChance: 0.08,
  partialBlinkChance: 0.12,
} as const;

export const SARA_RFV2_IDLE_TUNING = {
  smileWarmthRange: [0.015, 0.045],
  cheekSupportRange: [0.005, 0.025],
  stillnessRatio: 0.7,
} as const;

export const SARA_RFV2_LISTENING_TUNING = {
  smileWarmthRange: [0.025, 0.075],
  browLiftRange: [0.01, 0.05],
  cheekSupportRange: [0.01, 0.04],
  reactionDelayMs: [700, 1800],
} as const;

export const SARA_RFV2_CAMERA_REFERENCE = {
  notes:
    "Reference only. Do not activate here; the current live camera remains in saraV2Config.ts.",
} as const;
