/**
 * Preparation-only config contracts for multi-avatar support.
 *
 * The live Jordan runtime still reads the existing runtime constants directly.
 * These types give future per-avatar "brain folders" a stable shape without
 * changing camera, morph, blink, gaze, viseme, or session behavior today.
 */
export type AvatarId = "jordan" | "sara";

export type Vector3Tuple = readonly [number, number, number];
export type Vector3Object = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};
export type Vector3Config = Vector3Tuple | Vector3Object;
export type NumberRangeTuple = readonly [number, number];

export type AvatarModelConfig = {
  readonly url: string;
  readonly renderMode: "rfv2Morph" | "legacyHybrid" | "scaffold";
  readonly preload?: boolean;
};

export type AvatarCameraConfig = {
  readonly mode?: "fixed" | "auto" | "scaffold";
  readonly fov?: number;
  readonly position?: Vector3Config;
  readonly lookAt?: Vector3Config;
  readonly viewTuning?: Readonly<Record<string, unknown>>;
  readonly notes?: string;
};

export type AvatarGltfTransformConfig = {
  readonly position?: Vector3Config;
  readonly scale?: number | Vector3Config;
  readonly rotation?: Vector3Config;
  readonly notes?: string;
};

export type AvatarRootPartAlignmentConfig = {
  readonly names: readonly string[];
  readonly offset: Vector3Config;
  readonly scale?: number | Vector3Config;
};

export type AvatarRootAlignmentConfig = {
  readonly face: AvatarRootPartAlignmentConfig;
  readonly hair: AvatarRootPartAlignmentConfig;
  readonly body: AvatarRootPartAlignmentConfig;
};

export type AvatarMorphConfig = {
  readonly names?: readonly string[];
  readonly nameSet?: ReadonlySet<string>;
  readonly visemeNames?: readonly string[];
  readonly blinkMorphNames?: readonly string[];
  readonly requiredDriverMorphs?: readonly string[];
  readonly auditMorphs?: readonly string[];
  readonly expressionAuthorityMorphs?: readonly string[];
  readonly eyeMorphNames?: readonly string[];
  readonly legacyFallbackMorphs?: readonly string[];
  readonly expressionCaps?: Readonly<Record<string, number>>;
};

export type AvatarExpressionConfig = {
  readonly debug?: Readonly<Record<string, unknown>>;
  readonly faceTuning?: Readonly<Record<string, unknown>>;
  readonly idleTuning?: Readonly<Record<string, unknown>>;
  readonly listeningSmileTuning?: Readonly<Record<string, unknown>>;
  readonly listeningFaceTuning?: Readonly<Record<string, unknown>>;
  readonly idleBrowTuning?: Readonly<Record<string, unknown>>;
  readonly presets?: Readonly<Record<string, unknown>>;
  readonly presetTuning?: Readonly<Record<string, unknown>>;
};

export type AvatarBlinkConfig = {
  readonly morphNames?: readonly string[];
  readonly tuning?: Readonly<Record<string, unknown>>;
};

export type AvatarEyeFocusConfig = {
  readonly morphNames?: {
    readonly upLeft?: string;
    readonly upRight?: string;
    readonly downLeft?: string;
    readonly downRight?: string;
  };
  readonly tuning?: Readonly<Record<string, unknown>>;
  readonly intelligenceTuning?: Readonly<Record<string, unknown>>;
};

export type AvatarHeadPresenceConfig = {
  readonly tuning?: Readonly<Record<string, unknown>>;
  readonly headOffset?: {
    readonly x: number;
    readonly y: number;
  };
};

export type AvatarVisemeConfig = {
  readonly names?: readonly string[];
  readonly phonemeToViseme?: Readonly<Record<string, string>>;
  readonly visemeMap?: Readonly<Record<string, string>>;
  readonly caps?: {
    readonly visemeMaxStrength?: number;
    readonly jawOpenMax?: number;
    readonly restStrength?: number;
    readonly lookAheadSeconds?: number;
  };
};

export type AvatarPersonalityTimingConfig = {
  readonly reactionSpeed: number;
  readonly reactionDelayMultiplier: number;
  readonly stillnessPreference: number;
  readonly blinkCadenceMultiplier: number;
  readonly eyeEngagement: number;
  readonly headMovementAmount: number;
  readonly smileWarmth: number;
  readonly emotionalLatency: number;
  readonly empathySoftness: number;
  readonly expressiveness: number;
  readonly nervousSystemVariance: number;
  readonly listeningWarmth: number;
  readonly speakingEnergy: number;
  readonly thinkingStillness: number;
  readonly interruptionSensitivity: number;
};

export type AvatarDefinition = {
  readonly id: AvatarId;
  readonly displayName: string;
  readonly status: "active-reference" | "scaffold-incomplete";
  readonly model: AvatarModelConfig;
  readonly camera: AvatarCameraConfig;
  readonly gltfTransform: AvatarGltfTransformConfig;
  readonly morphs: AvatarMorphConfig;
  readonly expressions: AvatarExpressionConfig;
  readonly blink: AvatarBlinkConfig;
  readonly eyeFocus: AvatarEyeFocusConfig;
  readonly headPresence: AvatarHeadPresenceConfig;
  readonly visemes: AvatarVisemeConfig;
  readonly rootAlignment?: AvatarRootAlignmentConfig;
  readonly debug?: Readonly<Record<string, boolean>>;
  readonly personalityTiming?: AvatarPersonalityTimingConfig;
  readonly notes?: string;
};
