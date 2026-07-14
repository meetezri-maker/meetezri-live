import { JORDAN_RFV2_BLINK_TUNING } from "@/lib/avatar/jordanRfv2Config";
import {
  PHONEME_TO_SARA_V3_VISEME,
  SARA_V3_PHONEME_TO_VISEME_NAME,
} from "./saraV3VisemeMap";
import type { SaraV3AvatarDefinition, SaraV3VisemeTable } from "./saraV3Types";

export const SARA_V3_MODEL_URL = "/avatars/sara-v3.glb";
export const useSaraV3ForSara = true;

// B2.1: SaraV3 lip-sync tuning is now its own, no longer read from
// JORDAN_RFV2_FACE_TUNING. Values are unchanged from Jordan's at the time of
// the split, so this decoupling is behavior-neutral.
export const SARA_V3_LOOK_AHEAD_SECONDS = 0.04;
// B2.2: no longer the strength every viseme fires at — now a global ceiling
// applied after `profile.strength * phonemeWeight`. Keep it as a safety clamp.
export const SARA_V3_VISEME_MAX_STRENGTH = 0.86;

/**
 * B2.2 per-viseme intensity + jaw table. Replaces the two uniform scalars
 * (visemeMaxStrength / jawOpenMax) that made every phoneme render as one
 * generic shape with the same 0.22 jaw drop — bilabials included.
 *
 * jawOpen is authored per shape: PP is a lip closure (jaw shut), sibilants
 * keep the teeth near-together, open vowels drive the jaw hardest.
 *
 * The `viseme_rest` row exists for completeness. Rest strength at runtime
 * still comes from `lipSyncConfig.restStrength`.
 */
export const SARA_V3_VISEME_TABLE = {
  viseme_AA: { strength: 0.86, jawOpen: 0.3 },
  viseme_O: { strength: 0.82, jawOpen: 0.2 },
  viseme_E: { strength: 0.72, jawOpen: 0.14 },
  viseme_IH: { strength: 0.66, jawOpen: 0.12 },
  viseme_CH: { strength: 0.72, jawOpen: 0.06 },
  viseme_PP: { strength: 0.86, jawOpen: 0.02 },
  mouthRollLower: { strength: 0.45, jawOpen: 0.05 },
  viseme_rest: { strength: 0.18, jawOpen: 0 },
} as const satisfies SaraV3VisemeTable;

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
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
      "mouthRollLower",
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
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
      "mouthRollLower",
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
      "viseme_PP",
      "viseme_CH",
      "viseme_E",
      "mouthRollLower",
    ],
    // Weight-less projection: the shared AvatarVisemeConfig contract types this
    // as Record<string, string>. The driver reads the weighted map from
    // `saraV3.visemeMap` instead.
    phonemeToViseme: SARA_V3_PHONEME_TO_VISEME_NAME,
    caps: {
      lookAheadSeconds: SARA_V3_LOOK_AHEAD_SECONDS,
      visemeMaxStrength: SARA_V3_VISEME_MAX_STRENGTH,
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
    visemeMap: PHONEME_TO_SARA_V3_VISEME,
    visemeTable: SARA_V3_VISEME_TABLE,
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
      // C4 TEMP VALIDATION: influence ×1.5 for a clearer glance (range/logic and
      // blink timing unchanged). (Original: minInfluence 0.02, maxInfluence 0.035.)
      minInfluence: 0.03,
      maxInfluence: 0.0525,
      dampLambda: 12,
      blinkReductionFactor: 0.6,
    },
    // Coordinated idle-only micro-movement. All values are tiny additive
    // offsets layered on top of the idle expression base; they apply ONLY in
    // idle and smoothly decay to zero (via the expression runtime damping)
    // when leaving idle. Does not touch jawOpen or viseme_* / lip-sync.
    idleMicroMovementConfig: {
      // Continuous, very slow, very small "breathing" swell across the face.
      // C4 TEMP VALIDATION: amplitudes ×2.5, each capped at 0.03 so the idle
      // face is clearly readable while confirming the events reach the morphs.
      // (Original: smile 0.012, cheek 0.006, eyeSquint 0.005, eyebrow 0.008.)
      breathing: {
        speed: 0.8,
        smileAmplitude: 0.3, // was 0.012 (0.012*2.5=0.03, at cap)
        cheekAmplitude: 0.5, // was 0.006
        eyeSquintAmplitude: 0.25, // was 0.005
        eyebrowAmplitude: 0.5, // was 0.008
      },
      // Scheduled gentle, asymmetric micro-smiles (not constant).
      // C4 TEMP VALIDATION: faster + stronger for visual confirmation.
      // (Original: interval 8000–15000, smileLeft 0.05, smileRight 0.06, cheek 0.02.)
      smileEvent: {
        minIntervalMs: 3000,
        maxIntervalMs: 5000,
        smileLeftMax: 0.12,
        smileRightMax: 0.12,
        cheekMax: 0.06,
      },
      // Scheduled subtle brow relaxation/lift (never "surprised").
      // C4 TEMP VALIDATION: faster + stronger; fadeOut clamped to <=1s/phase.
      // (Original: interval 10000–20000, fadeOut [900,1500], eyebrowMax 0.05.)
      browEvent: {
        minIntervalMs: 4000,
        maxIntervalMs: 7000,
        fadeInMs: [500, 900],
        holdMs: [400, 900],
        fadeOutMs: [900, 1000],
        eyebrowMax: 0.1,
      },
    },
    // C4: idle-personality coordinator policy. The per-morph idle tuning already
    // lives in `idleMicroMovementConfig` (breathing / micro-smile / brow) and
    // `idleEyeballConfig` (gaze glances); this block holds only the C4
    // coordination values so nothing is hard-coded in the runtime.
    idleBehaviorConfig: {
      // On every (re)entry into idle, the micro-smile timer is rescheduled to a
      // fresh random time within this window. Keeps a smile from firing the
      // instant idle resumes and prevents the loop from lining up run to run.
      // Mirrors `idleMicroMovementConfig.smileEvent` interval on purpose.
      reentrySmileDelayMs: [8000, 15000],
      // Route the continuous breathing swell into C2's `idleBaseline` layer and
      // the discrete smile/brow events into the `scheduledMicro` layer. When
      // false, everything stays in `scheduledMicro` (pre-C4 grouping).
      routeBreathingToIdleBaseline: true,
    },
    // C5: listening-personality behavior. All values TEMP CURRENT-ASSET
    // COMPENSATION — the current SaraV3 GLB deforms weakly, so these run higher
    // than a final rig would need for the behavior to read on a client demo.
    // Re-tune (lower) after the updated GLB arrives. Nothing here is hard-coded
    // in the runtime; the coordinator reads every value from this block.
    listeningBehaviorConfig: {
      // Stable attentive baseline held for the whole listening state. Replaces
      // the static expressionConfig.listening base while C5 is enabled.
      // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      base: {
        mouthSmileLeft: 0.26,
        mouthSmileRight: 0.27,
        cheekSquintLeft: 0.28,
        cheekSquintRight: 0.285,
        eyebrows: 0.4,
        eyeSquintLeft: 0.05,
        eyeSquintRight: 0.05,
      },
      // Rare acknowledgement pulses (a soft smile beat or a brow lift) layered on
      // top of the baseline via C2's scheduledMicro slot. Randomized interval,
      // short fade-in / hold / fade-out. Peaks are TEMP high for weak-morph
      // visibility. TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      acknowledgement: {
        minIntervalMs: 6000,
        maxIntervalMs: 11000,
        fadeInMs: [250, 400],
        holdMs: [300, 600],
        fadeOutMs: [500, 800],
        smilePeak: 0.45,
        cheekPeak: 0.4,
        eyebrowPeak: 0.55,
        // Probability an acknowledgement is a smile beat (else a brow lift).
        smilePulseChance: 0.5,
      },
      // Eye attention (comfortable eye contact + tiny refocus) is provided by the
      // existing shared eyeLook drift (idleEyeConfig.modeScale.listening = 0.7):
      // no side glances, no scanning. A dedicated listening gaze is deferred to
      // C8, so C5 adds no new eye values and does not touch the eye runtime.
      eyeAttention: {
        reuseIdleEyeDrift: true,
      },
    },
    expressionConfig: {
      // Soft, neutral resting face. A gentle closed-mouth pleasantness with a
      // trace of eye warmth — deliberately low so it never reads as a grin.
      idle: {
        mouthSmileLeft: 0.5,
        mouthSmileRight: 0.8,
        cheekSquintLeft: 0.4,
        cheekSquintRight: 0.4,
        eyeSquintLeft: 0.03,
        eyeSquintRight: 0.03,
        eyebrows: 0.5,
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
    // C3: sentence-level speaking-sentiment gate. Conservative, symmetric,
    // bounded. Direction comes only from the compound's sign; a matching label
    // may add a small same-direction nudge but can never flip or rescue.
    sentimentGateConfig: {
      neutralThreshold: 0.4,
      maxPositiveDelta: 0.18,
      maxConcernDelta: 0.14,
      labelNudgeCap: 0.03,
      // Primary morph = mouthSmile (ratio 1). Cheek is a gentle Duchenne
      // support. A small brow raise is direction-safe for positive (matches the
      // attentive listening base, eyebrows: 0.14 > 0).
      positiveMorphRatios: {
        mouthSmile: 1,
        cheekSquint: 0.4,
        eyebrows: 0.2,
      },
      // Primary morph = mouthFrown (ratio 1) + a soft `sad`. Eyebrow direction
      // for concern is NOT verified on this GLB, so it is deliberately 0 (see
      // C3 notes) rather than guessed.
      concernMorphRatios: {
        mouthFrown: 1,
        sad: 0.7,
        eyebrows: 0,
      },
    },
    lipSyncConfig: {
      lookAheadSeconds: SARA_V3_LOOK_AHEAD_SECONDS,
      timingOffsetSeconds: 0,
      // B2.2: global ceiling on `profile.strength * phonemeWeight`.
      visemeMaxStrength: SARA_V3_VISEME_MAX_STRENGTH,
      // B2.2: superseded by SARA_V3_VISEME_TABLE[viseme].jawOpen for the
      // phoneme-driven path. Retained as the rollback value; the audio-driven
      // mouth fallback keeps its own separate jawOpenMax below.
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
