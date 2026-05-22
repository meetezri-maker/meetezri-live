import type { AvatarDefinition } from "../avatarConfigTypes";
import { getCompanionViewTuning } from "../companionViewTuning";
import {
  DEBUG_JORDAN_EXPRESSION_TEST,
  DEBUG_JORDAN_LISTENING_MORPH_TEST,
  DEBUG_JORDAN_PHONEMES,
  DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
  DEBUG_JORDAN_TEST_MORPH,
  DEBUG_JORDAN_TEST_VALUE,
  JORDAN_BLINK_MORPH_NAMES,
  JORDAN_EXPRESSION_AUTHORITY_MORPHS,
  JORDAN_EXPRESSION_CAPS,
  JORDAN_EXPRESSION_PRESETS,
  JORDAN_EXPRESSION_PRESET_TUNING,
  JORDAN_EYE_FOCUS_TUNING,
  JORDAN_EYE_INTELLIGENCE_TUNING,
  JORDAN_HEAD_OFFSET_X,
  JORDAN_HEAD_OFFSET_Y,
  JORDAN_HEAD_PRESENCE_TUNING,
  JORDAN_IDLE_BROW_TUNING,
  JORDAN_LISTENING_FACE_TUNING,
  JORDAN_LISTENING_SMILE_TUNING,
  JORDAN_MORPH_NAMES,
  JORDAN_MORPH_NAME_SET,
  JORDAN_RFV2_BLINK_TUNING,
  JORDAN_RFV2_FACE_TUNING,
  JORDAN_RFV2_IDLE_TUNING,
  JORDAN_RFV2_MORPH_AUDIT_NAMES,
  JORDAN_RFV2_REQUIRED_DRIVER_MORPHS,
  JORDAN_VISEME_NAMES,
  PHONEME_TO_JORDAN_VISEME,
} from "../jordanRfv2Config";

/**
 * Preparation-only Jordan avatar definition.
 *
 * This file references the existing Jordan RFv2 constants so future registry
 * migration has a single avatar definition to move toward. The live runtime
 * still reads `jordanRfv2Config.ts`, `companionModelUrl.ts`, and
 * `ActiveSession.tsx` directly.
 */
export const JORDAN_AVATAR_DEFINITION = {
  id: "jordan",
  displayName: "Jordan Taylor",
  status: "active-reference",
  model: {
    url: "/avatars/jordanTaylor.glb",
    renderMode: "rfv2Morph",
    preload: true,
  },
  camera: {
    fov: 11,
    position: [0, 0.55, 3.0],
    lookAt: [0, 0.65, 0],
    viewTuning: getCompanionViewTuning("jordan"),
    notes:
      "Reference-only copy of Jordan's current RFv2 fixed camera/framing path.",
  },
  gltfTransform: {
    position: [0, -1.65, 0],
    scale: [1.35, 1.35, 1.35],
    rotation: [0, 0, 0],
    notes: "Reference-only copy of Jordan's current RFv2 GLB transform.",
  },
  morphs: {
    names: JORDAN_MORPH_NAMES,
    nameSet: JORDAN_MORPH_NAME_SET,
    visemeNames: JORDAN_VISEME_NAMES,
    blinkMorphNames: JORDAN_BLINK_MORPH_NAMES,
    requiredDriverMorphs: JORDAN_RFV2_REQUIRED_DRIVER_MORPHS,
    auditMorphs: JORDAN_RFV2_MORPH_AUDIT_NAMES,
    expressionAuthorityMorphs: JORDAN_EXPRESSION_AUTHORITY_MORPHS,
    expressionCaps: JORDAN_EXPRESSION_CAPS,
  },
  expressions: {
    debug: {
      phonemes: DEBUG_JORDAN_PHONEMES,
      expressionTest: DEBUG_JORDAN_EXPRESSION_TEST,
      listeningMorphTest: DEBUG_JORDAN_LISTENING_MORPH_TEST,
      strongExpressionVerify: DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
      testMorph: DEBUG_JORDAN_TEST_MORPH,
      testValue: DEBUG_JORDAN_TEST_VALUE,
    },
    faceTuning: JORDAN_RFV2_FACE_TUNING,
    idleTuning: JORDAN_RFV2_IDLE_TUNING,
    listeningSmileTuning: JORDAN_LISTENING_SMILE_TUNING,
    listeningFaceTuning: JORDAN_LISTENING_FACE_TUNING,
    idleBrowTuning: JORDAN_IDLE_BROW_TUNING,
    presets: JORDAN_EXPRESSION_PRESETS,
    presetTuning: JORDAN_EXPRESSION_PRESET_TUNING,
  },
  blink: {
    morphNames: JORDAN_BLINK_MORPH_NAMES,
    tuning: JORDAN_RFV2_BLINK_TUNING,
  },
  eyeFocus: {
    morphNames: {
      upLeft: "eyeLookUpLeft",
      upRight: "eyeLookUpRight",
      downLeft: "eyeLookDownLeft",
      downRight: "eyeLookDownRight",
    },
    tuning: JORDAN_EYE_FOCUS_TUNING,
    intelligenceTuning: JORDAN_EYE_INTELLIGENCE_TUNING,
  },
  headPresence: {
    tuning: JORDAN_HEAD_PRESENCE_TUNING,
    headOffset: {
      x: JORDAN_HEAD_OFFSET_X,
      y: JORDAN_HEAD_OFFSET_Y,
    },
  },
  visemes: {
    names: JORDAN_VISEME_NAMES,
    phonemeToViseme: PHONEME_TO_JORDAN_VISEME,
  },
  // Jordan is calm, grounded, slower, warm, and less reactive.
  personalityTiming: {
    reactionSpeed: 0.85,
    reactionDelayMultiplier: 1.15,
    stillnessPreference: 1.18,
    blinkCadenceMultiplier: 1.05,
    eyeEngagement: 0.9,
    headMovementAmount: 0.75,
    smileWarmth: 1.05,
    emotionalLatency: 1.2,
    empathySoftness: 1.15,
    expressiveness: 0.85,
    nervousSystemVariance: 1.1,
    listeningWarmth: 1.1,
    speakingEnergy: 0.85,
    thinkingStillness: 1.25,
    interruptionSensitivity: 0.85,
  },
  notes:
    "Architecture foundation only. Do not route live Jordan rendering through this definition until byte-for-byte parity is verified.",
} as const satisfies AvatarDefinition;

export {
  DEBUG_JORDAN_EXPRESSION_TEST,
  DEBUG_JORDAN_LISTENING_MORPH_TEST,
  DEBUG_JORDAN_PHONEMES,
  DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
  DEBUG_JORDAN_TEST_MORPH,
  DEBUG_JORDAN_TEST_VALUE,
  JORDAN_BLINK_MORPH_NAMES,
  JORDAN_EXPRESSION_AUTHORITY_MORPHS,
  JORDAN_EXPRESSION_CAPS,
  JORDAN_EXPRESSION_PRESETS,
  JORDAN_EXPRESSION_PRESET_TUNING,
  JORDAN_EYE_FOCUS_TUNING,
  JORDAN_EYE_INTELLIGENCE_TUNING,
  JORDAN_HEAD_OFFSET_X,
  JORDAN_HEAD_OFFSET_Y,
  JORDAN_HEAD_PRESENCE_TUNING,
  JORDAN_IDLE_BROW_TUNING,
  JORDAN_LISTENING_FACE_TUNING,
  JORDAN_LISTENING_SMILE_TUNING,
  JORDAN_MORPH_NAMES,
  JORDAN_MORPH_NAME_SET,
  JORDAN_RFV2_BLINK_TUNING,
  JORDAN_RFV2_FACE_TUNING,
  JORDAN_RFV2_IDLE_TUNING,
  JORDAN_RFV2_MORPH_AUDIT_NAMES,
  JORDAN_RFV2_REQUIRED_DRIVER_MORPHS,
  JORDAN_VISEME_NAMES,
  PHONEME_TO_JORDAN_VISEME,
};
