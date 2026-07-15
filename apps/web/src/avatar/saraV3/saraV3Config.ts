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
      // C6: lip compression — a concentration ("processing") cue, not a smile
      // and not a frown. Verified present on the Face.002 face mesh with a rest
      // weight of 0, and already bound (bindSaraV3MorphTargets binds the whole
      // morph dictionary). NOT owned by lip-sync (that owns jawOpen + visemes +
      // mouthRollLower), and thinking never overlaps speaking.
      mouthPressLeft: "mouthPressLeft",
      mouthPressRight: "mouthPressRight",
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
    // EXPERIMENT (idle-only): "Attention Refresh". A coordinated idle micro-event
    // on its OWN 5–10s schedule, separate from the existing micro-smile/brow
    // events (those stay exactly as they are). When it fires it randomly picks one
    // of four natural combinations, so it never runs the same sequence twice:
    //   A ~40% blink only
    //   B ~30% blink + tiny brow + tiny cheek
    //   C ~20% blink + tiny brow + tiny cheek + tiny eyeball refocus
    //   D ~10% tiny eyeball refocus only
    // Onsets are staged (brows follow the blink, cheeks follow the brows, the
    // eyeball refocus follows last) and the whole event lasts ~600–700 ms. The
    // blink is delegated to the existing blink runtime (so it keeps its natural
    // per-blink variety); brow/cheek are additive into C2's scheduledMicro slot;
    // the eyeball refocus is layered on top of the C8 gaze value and clamped to
    // the shared gaze safety bound (`gazeConfig.safety.maxEyeballInfluence`).
    // Peaks are TEMP CURRENT-ASSET COMPENSATION — the current GLB deforms weakly,
    // so they run intentionally visible for this experiment only. Re-tune after
    // the updated GLB. Nothing here is hard-coded in the runtime.
    attentionRefreshConfig: {
      intervalMinMs: 5000,
      intervalMaxMs: 10000,
      combinationWeights: { a: 0.4, b: 0.3, c: 0.2, d: 0.1 },
      // Staged onsets (ms): blink at 0, brows at 40, cheeks at 80, eyeball at 120.
      browDelayMs: 40,
      cheekDelayMs: 80,
      eyeDelayMs: 120,
      // Shared brow/cheek envelope. brow (delay 40) peaks at 180 ms, cheek
      // (delay 80) at 220 ms → brows peak before cheeks. Cheek fully relaxes at
      // 80+140+200+220 = 640 ms → the whole event is ~640 ms (within 600–700).
      fadeInMs: 140,
      holdMs: 200,
      fadeOutMs: 220,
      // TEMP CURRENT-ASSET COMPENSATION peaks (weak GLB). eyebrow within 0.04–0.08,
      // cheek within 0.02–0.05.
      eyebrowPeak: 0.6,
      cheekPeak: 0.5,
      // Tiny eyeball refocus: slightly above the current idle refocus strength for
      // this experiment (C8 idle vertical 0.03 / horizontal ≤ 0.0525), still under
      // the shared safety cap (0.06). Out-and-back over ~275 ms (within 200–350),
      // returns smoothly to center and is never held away.
      eyeRefocusStrength: 0.4,
      eyeRefocusDurationMs: 275,
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
        eyebrows: 0.6,
        eyeSquintLeft: 0.5,
        eyeSquintRight: 0.5,
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
    // C6: thinking-personality behavior. All values TEMP CURRENT-ASSET
    // COMPENSATION — the current SaraV3 GLB deforms weakly, so these run higher
    // than a final rig would need in order to read on a client demo. Re-tune
    // (lower) after the updated GLB arrives. Nothing is hard-coded in the
    // runtime; the coordinator reads every value from this block.
    //
    // Emotional read is deliberately "processing", not "upset": smile is near
    // zero, frown/sad are present only at trace levels for a thoughtful cast,
    // and the load-bearing cues are brow engagement + lip compression.
    // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
    thinkingBehaviorConfig: {
      base: {
        // Near-zero: thinking is not a smile, but a hard 0 reads grumpy.
        mouthSmileLeft: 0.02,
        mouthSmileRight: 0.02,
        // Controlled brow concentration. Kept under the micro-event peak so the
        // two never sum past 1.0 (0.42 + 0.52 = 0.94).
        eyebrows: 0.42,
        cheekSquintLeft: 0.16,
        cheekSquintRight: 0.165,
        eyeSquintLeft: 0.08,
        eyeSquintRight: 0.08,
        // Trace only — enough for a thoughtful cast, far below a sad read.
        mouthFrownLeft: 0.07,
        mouthFrownRight: 0.07,
        sad: 0.04,
        // Lip compression = the clearest non-sad "concentrating" cue we have.
        mouthPressLeft: 0.1,
        mouthPressRight: 0.1,
      },
      // Rare thinking micro-events. Deliberately NO smile event and NO repeated
      // concern pulse — only a brow shift (with a touch of cheek emphasis) or a
      // lip-press beat.
      microEvent: {
        minIntervalMs: 5000,
        maxIntervalMs: 10000,
        fadeInMs: [250, 500],
        holdMs: [300, 700],
        fadeOutMs: [500, 900],
        eyebrowPeak: 0.52,
        cheekPeak: 0.28,
        lipPressPeak: 0.22,
        // Probability a micro-event is a brow shift (else a lip press).
        browShiftChance: 0.5,
      },
      // C8 hand-off: while thinking, gaze should briefly disengage. C6 does NOT
      // write any gaze morph (that would create a second gaze writer alongside
      // the eye runtime) — it only publishes this intent as metadata for the
      // future gaze controller to consume. Purely declarative today.
      gazeIntent: {
        emitIntent: true,
        direction: "away",
        // Suggested strength for C8; unused until the gaze controller lands.
        strength: 0.35,
      },
    },
    // C7: speaking body-language behavior. All values TEMP CURRENT-ASSET
    // COMPENSATION — the current SaraV3 GLB deforms weakly, so these run higher
    // than a final rig would need in order to read on a client demo. Re-tune
    // (lower) after the updated GLB arrives. Nothing is hard-coded in the
    // runtime; the coordinator reads every value from this block.
    //
    // The read is "naturally engaged while speaking", beyond lip-sync: a mild
    // held baseline plus occasional phrase/sentence-level emphasis. It must never
    // animate per phoneme, never read as a constant smile, and never flip or
    // exaggerate C3 sentiment (concern suppresses the smile support entirely).
    // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
    speakingBehaviorConfig: {
      base: {
        // Very low smile support — lip-sync owns the mouth; this only keeps the
        // face warm between words. Suppressed further under C3 concern.
        mouthSmileLeft: 0.1,
        mouthSmileRight: 0.105,
        // Controlled cheek support — the main "engaged" cue that survives weak
        // deformation without reading as a grin.
        cheekSquintLeft: 0.22,
        cheekSquintRight: 0.225,
        // Small, steady brow activity (kept under the emphasis peak so the two
        // never sum past ~0.8 at a hold: 0.30 + 0.50 = 0.80).
        eyebrows: 0.3,
        // Slight eye engagement.
        eyeSquintLeft: 0.05,
        eyeSquintRight: 0.05,
        // No frown / sad by default — speaking is neutral-engaged, not upset.
      },
      // When C3 direction is `concern`, scale the baseline smile support down so
      // concern speech stays empathetic (cheek/brow engagement remain).
      concernBaseSmileScale: 0.35,
      // Occasional phrase/sentence emphasis pulse. Triggered only at sentence /
      // chunk boundaries (a new phoneme-timeline object reference), never per
      // phoneme, and only ~1 in 3 boundaries. Randomized envelope + magnitude.
      emphasis: {
        chancePerChunk: 0.35,
        fadeInMs: [200, 400],
        holdMs: [200, 500],
        fadeOutMs: [400, 800],
        eyebrowPeak: 0.5,
        cheekPeak: 0.35,
        eyeSquintPeak: 0.1,
        // Very low, and only applied when C3 direction is not `concern`.
        smileSupportPeak: 0.12,
        // Extra scale on the emphasis smile support under C3 `positive`, so C7
        // never stacks onto C3's positive smile into a grin.
        positiveSmileScale: 0.5,
      },
      // C7 keeps a forward, engaged read and writes NO gaze morph (that would be
      // a second gaze writer alongside the eye runtime). It emits no intent by
      // default — a dedicated speaking gaze is deferred to C8; head motion to C9.
      gazeIntent: {
        emitIntent: false,
        direction: "forward",
        strength: 0,
      },
    },
    // C8: unified gaze controller. One authoritative owner for all gaze morphs
    // across idle / listening / thinking / speaking. Blink stays owned by the
    // eye runtime. Horizontal gaze is one signed scalar written identically to
    // LeftEyeball/RightEyeball (coordinated, never crossed); vertical is one
    // signed scalar split into the non-negative eyeLookUp*/eyeLookDown* pair,
    // mirrored L/R. `safety` is the single clamp/damp contract shared by every
    // state. Influence magnitudes are intentionally high for the weak-deforming
    // current GLB. TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
    gazeConfig: {
      safety: {
        // Underlying LeftEyeball/RightEyeball delta is large (~0.42), so a small
        // influence already reads as a clear glance. Hard cap for every state.
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        maxEyeballInfluence: 0.06,
        // Vertical (eyeLook*) cap. TEMP CURRENT-ASSET COMPENSATION — re-tune
        // after updated GLB.
        maxVerticalInfluence: 0.06,
        // Damped, never snapped. Higher = quicker settle.
        dampLambda: 10,
        // Reduce eyeball movement during a blink (matches pre-C8 idle feel).
        blinkReductionFactor: 0.6,
      },
      // Idle: occasional subtle side glance + tiny vertical refocus, randomized
      // timing, smooth return to center. Mirrors the pre-C8 idleEyeballConfig.
      idle: {
        minIntervalMs: 3000,
        maxIntervalMs: 6000,
        moveMs: [800, 1500],
        holdMs: [400, 1200],
        returnMs: [800, 1400],
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        minInfluence: 0.03,
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        maxInfluence: 0.0525,
        verticalChance: 0.4,
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        verticalInfluence: 0.03,
      },
      // Listening: mostly direct eye contact with tiny refocus shifts; a very
      // rare brief gaze-away. No idle-style side scanning.
      listening: {
        minIntervalMs: 2500,
        maxIntervalMs: 5000,
        moveMs: [400, 800],
        holdMs: [300, 700],
        returnMs: [400, 800],
        // Tiny — reads as attentive micro-adjustment, not a glance.
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        horizontalInfluence: 0.018,
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        verticalInfluence: 0.022,
        // Very rare — most refocuses stay centered.
        gazeAwayChance: 0.12,
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        gazeAwayInfluence: 0.04,
      },
      // Thinking: a controlled gaze-away with a configurable direction, held
      // longer than idle, returning smoothly. Consumes C6 gazeIntent
      // (direction "away", strength). Falls back to a subtle drift when the
      // intent is inactive.
      thinking: {
        // Never zero — a beat of eye contact before disengaging on entry.
        entryDelayMs: [350, 900],
        minIntervalMs: 2600,
        maxIntervalMs: 5200,
        moveMs: [500, 900],
        holdMs: [1200, 2600],
        returnMs: [600, 1100],
        // Applied horizontal = intentStrength * strengthScale (then clamped).
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        strengthScale: 0.16,
        // Fixed look-aside side; 0 would randomize L/R each away event.
        horizontalBias: -1,
        // Slight downward cast reads as "processing".
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        verticalInfluence: -0.03,
        fallback: {
          minIntervalMs: 2500,
          maxIntervalMs: 4500,
          moveMs: [500, 900],
          holdMs: [500, 1000],
          returnMs: [500, 900],
          // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
          horizontalInfluence: 0.025,
          // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
          verticalInfluence: -0.02,
        },
      },
      // Speaking: mostly re-engaged eye contact with small natural refocus, and
      // an optional brief emphasis glance when C7 gazeIntent is active. C7 emits
      // an inactive intent by default → resolves to neutral/direct gaze.
      speaking: {
        minIntervalMs: 1800,
        maxIntervalMs: 3600,
        moveMs: [300, 600],
        holdMs: [200, 500],
        returnMs: [400, 700],
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        horizontalInfluence: 0.02,
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        verticalInfluence: 0.015,
        // Applied emphasis horizontal = intentStrength * emphasisStrengthScale.
        // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
        emphasisStrengthScale: 0.12,
      },
    },
    // C10: unified emotion coordinator. NOT another emotion generator and NOT a
    // morph writer — it is the "conductor" that scales the already-produced
    // additive layers (C3 sentiment, C4/C5/C6/C7 state personalities) so
    // contradictory facial signals (smile-while-concerned, sad+smile,
    // brow+concern, etc.) cannot co-exist. Every value below is a scalar knob;
    // at neutral all channel scales resolve to 1 → output identical to C3–C8.
    // Boosts are intentionally high for the weak-deforming current GLB.
    // TEMP CURRENT-ASSET COMPENSATION — re-tune (toward ~1.2 / smaller) after GLB.
    emotionCoordinatorConfig: {
      // Ceiling on any single channel scale AND on overall expressiveness.
      // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      maxExpressiveness: 1.8,
      // Positive: amplify the warm channels (boost per unit of sentiment weight).
      // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      positiveSmileBoost: 0.6,
      positiveCheekBoost: 0.5,
      positiveEyeBoost: 0.3,
      // Positive: fully retire the opposing channels (scale → 0 at full weight).
      positiveFrownSuppression: 1.0,
      positiveSadSuppression: 1.0,
      positiveMouthPressSuppression: 1.0,
      // Concern: fully suppress the smile; reduce (not kill) the engaged cues.
      concernSmileSuppression: 1.0,
      // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      concernCheekReduction: 0.6,
      concernEyeReduction: 0.5,
      concernBrowReduction: 0.4,
      // Concern: keep/boost the empathetic channels C3 already supplies.
      // TEMP CURRENT-ASSET COMPENSATION — re-tune after updated GLB.
      concernFrownBoost: 0.4,
      concernSadBoost: 0.3,
      // Reserved: extra lip-press under concern tension. Inert today (mouthPress
      // is thinking-only, always neutral sentiment); 0 preserves neutral-identity.
      mouthPressBoost: 0.0,
    },
    // C11: cross-state transition engine. Durations only — C11 introduces no new
    // expression or behavior event; it crossfades the EXISTING state baselines
    // between the outgoing and incoming state over these windows so handoffs feel
    // intentional instead of relying on the fixed expression damp alone. Every
    // timing lives here; the runtime hard-codes none. Ranges are conservative for
    // the current asset — safe to widen slightly after the updated GLB.
    transitionConfig: {
      // "easeInOutSine" or "smoothstep" — both are gentle S-curves.
      easing: "easeInOutSine",
      // Fallback for any edge not explicitly listed below.
      defaultMs: 350,
      edges: {
        // Normal state transitions (250–500 ms).
        idleToListening: 350,
        listeningToIdle: 350,
        listeningToThinking: 350,
        thinkingToListening: 350,
        thinkingToIdle: 350,
        // Speaking entry — snappy so speech reads immediately (150–300 ms).
        // (Lip-sync/audio is unaffected; this only crossfades the non-mouth
        // expression baseline.)
        idleToSpeaking: 220,
        listeningToSpeaking: 220,
        thinkingToSpeaking: 220,
        // Speaking exit — a touch longer to settle back (250–450 ms).
        speakingToListening: 340,
        speakingToIdle: 340,
        speakingToThinking: 340,
      },
      // Config/type-ready but INACTIVE: no explicit session-layer barge-in signal
      // exists that can be consumed without coupling to Workstream B timing, so
      // C11 never triggers an interruption transition (see controller docs).
      interruptionMs: 150,
      // Config/type-ready but not actively triggered (no session lifecycle hook).
      sessionStartMs: 550,
      sessionEndMs: 450,
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
