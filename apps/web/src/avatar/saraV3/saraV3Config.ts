import {
  JORDAN_RFV2_BLINK_TUNING,
  JORDAN_RFV2_FACE_TUNING,
  PHONEME_TO_JORDAN_VISEME,
} from "@/lib/avatar/jordanRfv2Config";
import type { SaraV3AvatarDefinition } from "./saraV3Types";

export const SARA_V3_MODEL_URL = "/avatars/sara-v3.glb";
export const useSaraV3ForSara = true;

export const saraV3CameraConfig = {
  fov: 12,
  position: [0, 1.25, 3.0],
  lookAt: [0, 1.25, 0],
};

export const SARA_V3_AVATAR_DEFINITION = {
  id: "saraV3",
  displayName: "Sara V3",
  status: "active-reference",
  model: {
    url: SARA_V3_MODEL_URL,
    renderMode: "legacyHybrid",
    preload: false,
  },
  camera: {
    mode: "fixed",
    fov: 8,
    position: [0, 1.30, 3.0],
    lookAt: [0, 1.30, 0],
    notes: "Sara head framing with Jordan session-room camera distance (z=3.0).",
  },
  gltfTransform: {
    position: [0, 0, 0],
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    notes: "SaraV3 transform is isolated from Sara Hybrid and Jordan.",
  },
  morphs: {
    names: [
      "viseme_rest",
      "viseme_AA",
      "viseme_IH",
      "viseme_O",
      "viseme_S",
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
      "jawOpen",
      "eyeBlinkLeft",
      "eyeBlinkRight",
      "mouthSmileLeft",
      "mouthSmileRight",
      "mouthFrownLeft",
      "mouthFrownRight",
      "cheekSquintLeft",
      "cheekSquintRight",
      "eyebrows",
      "sad",
    ],
    visemeNames: [
      "viseme_rest",
      "viseme_AA",
      "viseme_IH",
      "viseme_O",
      "viseme_S",
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
    ],
    blinkMorphNames: ["eyeBlinkLeft", "eyeBlinkRight"],
    requiredDriverMorphs: ["viseme_AA", "jawOpen", "eyeBlinkLeft", "eyeBlinkRight"],
  },
  expressions: {},
  blink: {
    morphNames: ["eyeBlinkLeft", "eyeBlinkRight"],
    tuning: JORDAN_RFV2_BLINK_TUNING,
  },
  eyeFocus: {},
  headPresence: {},
  visemes: {
    names: [
      "viseme_rest",
      "viseme_AA",
      "viseme_IH",
      "viseme_O",
      "viseme_S",
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
    ],
    phonemeToViseme: PHONEME_TO_JORDAN_VISEME,
    caps: {
      lookAheadSeconds: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds,
      visemeMaxStrength: JORDAN_RFV2_FACE_TUNING.visemeMaxStrength,
      jawOpenMax: 0.22,
      restStrength: 0.18,
    },
  },
  personalityTiming: {
    reactionSpeed: 1,
    reactionDelayMultiplier: 1,
    stillnessPreference: 1,
    blinkCadenceMultiplier: 1,
    eyeEngagement: 1,
    headMovementAmount: 1,
    smileWarmth: 1,
    emotionalLatency: 1,
    empathySoftness: 1,
    expressiveness: 1,
    nervousSystemVariance: 1,
    listeningWarmth: 1,
    speakingEnergy: 1,
    thinkingStillness: 1,
    interruptionSensitivity: 1,
  },
  saraV3: {
    modelUrl: SARA_V3_MODEL_URL,
    rawRenderAuditMode: false,
    environmentConfig: {
      // A1: image-based lighting on, lit by a portrait studio HDRI.
      enabled: true,
      // "hdri" | "roomEnvironmentPmrem" (fallback + rollback).
      source: "hdri",
      // Portrait/studio HDRI (CC0, Poly Haven "brown_photostudio_02", 1k).
      url: "/avatars/hdri/brown_photostudio_02_1k.hdr",
      // HDRI environment intensity (tunable). Base skin illumination.
      intensity: 1.0,
      // Intensity used when the RoomEnvironment PMREM fallback/rollback is active.
      roomEnvironmentIntensity: 0.35,
      // Renderer tone mapping: "ACESFilmic" (default) | "AgX".
      toneMapping: "ACESFilmic",
      backgroundMode: "unchanged",
      // A3: enabled so the before/after comparison + per-category luma metrics
      // populate window.saraV3EnvironmentDiagnostics. Inert unless
      // rawRenderAuditMode is also on, so it is safe to leave true in the live app.
      captureComparisonDiagnostics: true,
      // Applied only while IBL is active; HDRI carries base light, one rim
      // light separates hair/jawline from the background. Disabling the
      // environment reverts to the shared legacy light values.
      analyticLightRig: {
        ambientIntensity: 0.35,
        hemisphereIntensity: 0.12,
        keyIntensity: 0.55,
        fillIntensity: 0.18,
        rimIntensity: 0.95,
        rimColor: 0xbcd2ff,
        rimPosition: [-2.4, 4.2, -4.5],
        roomWarmthIntensity: 0.12,
      },
    },
    materialPassConfig: {
      // A2: per-category material pass. false → legacy applySaraV3MaterialFixes. shaz
      enabled: true,
      eyes: {
        // Low cornea roughness + envMap boost so the HDRI yields a catchlight.
        roughness: 0.1,
        envMapIntensity: 2.0,
      },
      hair: {
        blendRenderOrder: 22,
        innerRenderOrder: 20,
        // Neutralize the wrong baked hair metalness (0.545) — hair is dielectric.
        metalness: 0.0,
        // Floor, not override: kills the white/gray specular sheen on the
        // bangs from the July 2026 re-export (verified live in console).
        minRoughness: 0.85,
        hardEdgeAlphaTest: 0.4,
      },
    },
    scale: [1, 1, 1],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    faceMeshHints: ["face", "head", "skin", "facemesh"],
    bodyMeshHints: ["body", "character", "torso", "armature"],
    hairMeshHints: ["hair", "brow", "lash", "scalp"],
    morphNameMap: {
      visemeRest: "viseme_rest",
      visemeAA: "viseme_AA",
      visemeIH: "viseme_IH",
      visemeO: "viseme_O",
      visemeS: "viseme_S",
      visemePP: "viseme_PP",
      visemeCH: "viseme_CH",
      visemeE: "viseme_E",
      jawOpen: "jawOpen",
      eyeBlinkLeft: "eyeBlinkLeft",
      eyeBlinkRight: "eyeBlinkRight",
      smileLeft: "mouthSmileLeft",
      smileRight: "mouthSmileRight",
      frownLeft: "mouthFrownLeft",
      frownRight: "mouthFrownRight",
      cheekLeft: "cheekSquintLeft",
      cheekRight: "cheekSquintRight",
      eyebrows: "eyebrows",
      sad: "sad",
      // New SaraV3 GLB morphs (previously unused). The global "smile" morph is
      // intentionally NOT mapped to avoid double-driving the smile alongside
      // mouthSmileLeft/mouthSmileRight.
      eyeSquintLeft: "eyeSquintLeft",
      eyeSquintRight: "eyeSquintRight",
      eyeLookUpLeft: "eyeLookUpLeft",
      eyeLookUpRight: "eyeLookUpRight",
      eyeLookDownLeft: "eyeLookDownLeft",
      eyeLookDownRight: "eyeLookDownRight",
      // Actual eyeball-gaze morph targets. These live on the separate eye mesh
      // (Face002_2) and are what visibly rotate the eyeballs (the eyeLook*
      // morphs above only deform the eyelid/socket skin on the face mesh).
      leftEyeball: "LeftEyeball",
      rightEyeball: "RightEyeball",
    },
    visemeMap: PHONEME_TO_JORDAN_VISEME,
    blinkConfig: {
      closeMs: 75,
      holdMs: 35,
      openMs: 115,
      minIntervalMs: 3500,
      maxIntervalMs: 6500,
      max: JORDAN_RFV2_BLINK_TUNING.fullBlinkMax[1],
      asymmetryMax: 0.035,
    },
    presenceConfig: {
      defaultMode: "idle",
    },
    // Extremely lightweight idle eye "aliveness": a very subtle, slow vertical
    // drift driven purely by time. NOT a gaze system and no head movement.
    idleEyeConfig: {
      enabled: true,
      verticalAmplitude: 0.05,
      primarySpeed: 0.35,
      secondarySpeed: 0.13,
      modeScale: {
        idle: 1,
        listening: 0.7,
        thinking: 0.4,
        speaking: 0.4,
      },
    },
    // Idle-only eyeball gaze, driven via the LeftEyeball/RightEyeball morphs
    // (NOT mesh rotation, NOT the eyeLook* morphs). Event-based glances with a
    // slow damp; both eyes share the same target so the gaze stays coordinated.
    // Influence stays tiny because the underlying morph delta is large (~0.42).
    idleEyeballConfig: {
      enabled: true,
      minIntervalMs: 3000,
      maxIntervalMs: 6000,
      moveMs: [800, 1500],
      holdMs: [400, 1200],
      returnMs: [800, 1400],
      minInfluence: 0.02,
      maxInfluence: 0.035,
      dampLambda: 12,
      blinkReductionFactor: 0.6,
    },
    // Coordinated idle-only micro-movement. All values are tiny additive
    // offsets layered on top of the idle expression base; they apply ONLY in
    // idle and smoothly decay to zero (via the expression runtime damping)
    // when leaving idle. Does not touch jawOpen or viseme_* / lip-sync.
    idleMicroMovementConfig: {
      // Continuous, very slow, very small "breathing" swell across the face.
      breathing: {
        speed: 0.8,
        smileAmplitude: 0.012,
        cheekAmplitude: 0.006,
        eyeSquintAmplitude: 0.005,
        eyebrowAmplitude: 0.008,
      },
      // Scheduled gentle, asymmetric micro-smiles (not constant).
      smileEvent: {
        minIntervalMs: 8000,
        maxIntervalMs: 15000,
        smileLeftMax: 0.05,
        smileRightMax: 0.06,
        cheekMax: 0.02,
      },
      // Scheduled subtle brow relaxation/lift (never "surprised").
      browEvent: {
        minIntervalMs: 10000,
        maxIntervalMs: 20000,
        fadeInMs: [500, 900],
        holdMs: [400, 900],
        fadeOutMs: [900, 1500],
        eyebrowMax: 0.05,
      },
    },
    expressionConfig: {
      // Soft, neutral resting face. A gentle closed-mouth pleasantness with a
      // trace of eye warmth — deliberately low so it never reads as a grin.
      idle: {
        mouthSmileLeft: 0.08,
        mouthSmileRight: 0.085,
        cheekSquintLeft: 0.01,
        cheekSquintRight: 0.01,
        eyeSquintLeft: 0.03,
        eyeSquintRight: 0.03,
        eyebrows: 0.03,
      },
      // Attentive and warm, but still clearly not a full grin. Slight brow
      // raise + genuine (Duchenne) eye/cheek engagement to read as "listening".
      listening: {
        mouthSmileLeft: 0.24,
        mouthSmileRight: 0.25,
        cheekSquintLeft: 0.14,
        cheekSquintRight: 0.142,
        eyeSquintLeft: 0.1,
        eyeSquintRight: 0.1,
        eyebrows: 0.14,
      },
      // Natural, contemplative. A whisper of smile keeps it from reading
      // grumpy; a faint brow/frown/sad gives a thoughtful cast.
      thinking: {
        mouthSmileLeft: 0.05,
        mouthSmileRight: 0.05,
        mouthFrownLeft: 0.02,
        mouthFrownRight: 0.02,
        eyebrows: 0.05,
        sad: 0.01,
      },
      // Near-neutral base — lip-sync owns the mouth. Just a gentle pleasant
      // undertone so the face stays alive between words.
      speaking: {
        mouthSmileLeft: 0.06,
        mouthSmileRight: 0.06,
        cheekSquintLeft: 0.02,
        cheekSquintRight: 0.02,
        eyeSquintLeft: 0.02,
        eyeSquintRight: 0.02,
        eyebrows: 0.03,
      },
      blendSpeed: 3.5,
    },
    lipSyncConfig: {
      lookAheadSeconds: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds,
      timingOffsetSeconds: 0,
      visemeMaxStrength: JORDAN_RFV2_FACE_TUNING.visemeMaxStrength,
      jawOpenMax: 0.22,
      restStrength: 0.18,
      attackSpeed: 18,
      releaseSpeed: 12,
      jawReleaseSpeed: 16,
      restReleaseSpeed: 12,
      audioDrivenMouthFallback: {
        enabled: true,
        jawOpenMax: 0.35,
        visemeAAMax: 0.38,
        attackSpeed: 18,
        releaseSpeed: 10,
      },
    },
    materialFixConfig: {
      doubleSided: true,
      forceDepthWrite: true,
      forceDepthTest: true,
    },
    diagnosticsEnabled: true,
  },
  notes: "SaraV3 is isolated from Sara Hybrid and reuses Jordan timing only as a starting baseline.",
} as const satisfies SaraV3AvatarDefinition;
