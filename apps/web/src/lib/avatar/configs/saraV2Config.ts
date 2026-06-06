import type { AvatarDefinition } from "../avatarConfigTypes";
import {
  PHONEME_TO_SARA_VISEME,
  SARA_BLINK_MORPH_NAMES,
  SARA_BLINK_TUNING,
  SARA_EXPRESSION_CAPS,
  SARA_EXPRESSION_MORPH_NAMES,
  SARA_EXPRESSION_PRESETS,
  SARA_EXPRESSION_PRESET_TUNING,
  SARA_EYE_FOCUS_MORPH_NAMES,
  SARA_EYE_FOCUS_TUNING,
  SARA_FACE_TUNING,
  SARA_HEAD_PRESENCE_TUNING,
  SARA_LEGACY_FALLBACK_MORPHS,
  SARA_MORPH_AUDIT_NAMES,
  SARA_MORPH_NAMES,
  SARA_MORPH_NAME_SET,
  SARA_REQUIRED_DRIVER_MORPHS,
  SARA_VISEME_NAMES,
} from "./saraConfig";

export const SARA_V2_MODEL_URL = "/avatars/C2-new.glb";

export const SARA_V2_ROOT_ALIGNMENT = {
  face: {
    names: ["Face_Rig", "Face Rig", "Face"],
    offset: [0, 0.45, 0.08],
    scale: [1, 1, 1],
  },
  hair: {
    names: ["model_19"],
    offset: [0, 0.45, 0.09],
    scale: [1, 1, 1],
  },
  body: {
    names: ["Armature", "Character", "model_0"],
    offset: [0, 0, 0],
    scale: [1, 1, 1],
  },
} as const;

export const SARA_V2_DEBUG_FLAGS = {
  framing: false,
  hierarchy: false,
  boundsHelpers: false,
  materialOverride: false,
} as const;

export const SARA_V2_ALIGNMENT_OPTIONS = {
  attachHairToFace: true,
  faceScale: 1,
  hairScale: 1,
} as const;

export const SARA_V2_VISEME_CAPS = {
  visemeMaxStrength: 0.24,
  jawOpenMax: 0.1,
  restStrength: 0.02,
  lookAheadSeconds: 0.04,
  attackSpeed: 18,
  releaseSpeed: 22,
  jawReleaseSpeed: 26,
  restReleaseSpeed: 28,
  opennessMultipliers: {
    viseme_AA: 1,
    viseme_O: 0.75,
    viseme_IH: 0.45,
    viseme_E: 0.45,
    viseme_CH: 0.55,
    viseme_PP: 0.15,
    viseme_rest: 0,
  },
  jawSupport: {
    viseme_AA: 0.1,
    viseme_O: 0.06,
    viseme_IH: 0.035,
    viseme_E: 0.035,
    viseme_CH: 0.04,
    viseme_PP: 0,
    viseme_rest: 0,
  },
} as const;

export const SARA_V2_PHONEME_TO_VISEME = {
  ...PHONEME_TO_SARA_VISEME,
  S: "viseme_E",
  Z: "viseme_E",
} as const;

type SaraV2AvatarDefinition = AvatarDefinition & {
  readonly saraV2Alignment: typeof SARA_V2_ALIGNMENT_OPTIONS;
};

export const SARA_V2_AVATAR_DEFINITION = {
  id: "sara",
  displayName: "Sara",
  status: "active-reference",
  model: {
    url: SARA_V2_MODEL_URL,
    renderMode: "legacyHybrid",
    preload: false,
  },
  camera: {
    mode: "fixed",
    fov: 6,
    position: [0, 1.80, 4.7],
    lookAt: [0, 1.55, 0],
    notes:
      "Sara V2 closer live portrait camera for /avatars/C2-.glb; alignment remains Sara-only.",
  },
  gltfTransform: {
    position: [0, -1.0, 0],
    scale: [0.25, 0.25, 0.25],
    rotation: [0, 0, 0],
    notes: "Sara V2 starting transform; do not apply to Jordan.",
  },
  rootAlignment: SARA_V2_ROOT_ALIGNMENT,
  saraV2Alignment: SARA_V2_ALIGNMENT_OPTIONS,
  debug: SARA_V2_DEBUG_FLAGS,
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
    phonemeToViseme: SARA_V2_PHONEME_TO_VISEME,
    visemeMap: SARA_V2_PHONEME_TO_VISEME,
    caps: SARA_V2_VISEME_CAPS,
  },
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
    "Sara V2 live config for C2-.glb. Keep old Sara config files available for fallback/reference.",
} as const satisfies SaraV2AvatarDefinition;

export const SARA_V2_CONFIG = SARA_V2_AVATAR_DEFINITION;
