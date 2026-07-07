import type { AvatarDefinition, Vector3Config } from "@/lib/avatar/avatarConfigTypes";
import type { AvatarPhonemeTimeline, MorphBinding } from "@/lib/avatar/avatarMorphTypes";
import type * as THREE from "three";

export type SaraV3AvatarDefinition = AvatarDefinition & {
  readonly saraV3: {
    readonly modelUrl: string;
    readonly rawRenderAuditMode: boolean;
    readonly environmentConfig: {
      readonly enabled: boolean;
      /**
       * "hdri" loads the portrait HDRI at `url` via RGBELoader + PMREM.
       * "roomEnvironmentPmrem" is the original neutral RoomEnvironment path and
       * remains the fallback (on HDRI load failure) and the one-line rollback.
       */
      readonly source: string;
      /** Environment intensity applied when the HDRI path is active. */
      readonly intensity: number;
      /**
       * Environment intensity applied when the RoomEnvironment PMREM path is
       * active (explicit `source: "roomEnvironmentPmrem"` or HDRI-load fallback).
       * Preserves the original 0.35 look independent of the HDRI `intensity`.
       */
      readonly roomEnvironmentIntensity?: number;
      /** Portrait HDRI URL (served from public/). Used when source === "hdri". */
      readonly url?: string;
      /**
       * Renderer tone-mapping toggle used when this avatar owns the renderer.
       * Default "ACESFilmic"; "AgX" is provided to A/B against the Blender viewport.
       */
      readonly toneMapping?: "ACESFilmic" | "AgX";
      readonly backgroundMode: "unchanged";
      readonly captureComparisonDiagnostics: boolean;
      /**
       * Analytic light-rig intensities applied ONLY when SaraV3 IBL is active
       * (env enabled). Lets the HDRI provide base illumination while a single
       * rim light separates hair/jawline from the background. When env is
       * disabled these overrides are not applied and the legacy shared light
       * values remain — that is the rollback path.
       */
      readonly analyticLightRig?: {
        readonly ambientIntensity: number;
        readonly hemisphereIntensity: number;
        readonly keyIntensity: number;
        readonly fillIntensity: number;
        readonly rimIntensity: number;
        readonly rimColor: number;
        readonly rimPosition: readonly [number, number, number];
        readonly roomWarmthIntensity: number;
      };
    };
    readonly materialPassConfig: {
      /**
       * Master flag. true → per-category `applySaraV3MaterialPass` runs.
       * false → legacy `applySaraV3MaterialFixes` (the pre-existing behavior,
       * kept intact) runs instead. Rollback is this one line.
       */
      readonly enabled: boolean;
      readonly eyes: {
        readonly roughness: number;
        readonly envMapIntensity: number;
      };
      readonly hair: {
        /** renderOrder for outer alpha-carded strands (Material.002). */
        readonly blendRenderOrder: number;
        /** renderOrder for inner/scalp/brow-lash geometry (Material.001). */
        readonly innerRenderOrder: number;
        /**
         * Hair metalness override. The GLB bakes strand metalness at
         * ~0.545 which reads as wet plastic under IBL; hair is dielectric.
         */
        readonly metalness: number;
        /**
         * Roughness floor (`roughness = max(authored, minRoughness)`). The
         * July 2026 eyelash re-export shipped the hair with low roughness,
         * so direct lights bounced off the bang cards as a broad white/gray
         * sheen. 0.85 removes it while keeping a hint of specular life.
         */
        readonly minRoughness: number;
        /**
         * alphaTest fallback for any hair material whose cards are hard-edged
         * (kept for tuning; the shipped choice is documented per material in
         * saraV3MaterialPass.ts).
         */
        readonly hardEdgeAlphaTest: number;
      };
    };
    readonly scale: number | Vector3Config;
    readonly position: Vector3Config;
    readonly rotation: Vector3Config;
    readonly faceMeshHints: readonly string[];
    readonly bodyMeshHints: readonly string[];
    readonly hairMeshHints: readonly string[];
    readonly morphNameMap: Readonly<Record<string, string>>;
    readonly visemeMap: Readonly<Record<string, string>>;
    readonly blinkConfig: {
      readonly closeMs: number;
      readonly holdMs: number;
      readonly openMs: number;
      readonly minIntervalMs: number;
      readonly maxIntervalMs: number;
      readonly max: number;
      readonly asymmetryMax: number;
    };
    readonly presenceConfig: {
      readonly defaultMode: SaraV3RuntimeMode;
    };
    readonly idleEyeConfig: {
      readonly enabled: boolean;
      readonly verticalAmplitude: number;
      readonly primarySpeed: number;
      readonly secondarySpeed: number;
      readonly modeScale: Readonly<Record<SaraV3RuntimeMode, number>>;
    };
    readonly idleEyeballConfig: {
      readonly enabled: boolean;
      readonly minIntervalMs: number;
      readonly maxIntervalMs: number;
      readonly moveMs: readonly [number, number];
      readonly holdMs: readonly [number, number];
      readonly returnMs: readonly [number, number];
      readonly minInfluence: number;
      readonly maxInfluence: number;
      readonly dampLambda: number;
      readonly blinkReductionFactor: number;
    };
    readonly idleMicroMovementConfig: {
      readonly breathing: {
        readonly speed: number;
        readonly smileAmplitude: number;
        readonly cheekAmplitude: number;
        readonly eyeSquintAmplitude: number;
        readonly eyebrowAmplitude: number;
      };
      readonly smileEvent: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly smileLeftMax: number;
        readonly smileRightMax: number;
        readonly cheekMax: number;
      };
      readonly browEvent: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly fadeInMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly fadeOutMs: readonly [number, number];
        readonly eyebrowMax: number;
      };
    };
    readonly expressionConfig: {
      readonly idle: Readonly<Record<string, number>>;
      readonly listening: Readonly<Record<string, number>>;
      readonly thinking: Readonly<Record<string, number>>;
      readonly speaking: Readonly<Record<string, number>>;
      readonly blendSpeed: number;
    };
    readonly lipSyncConfig: {
      readonly lookAheadSeconds: number;
      readonly timingOffsetSeconds: number;
      readonly visemeMaxStrength: number;
      readonly jawOpenMax: number;
      readonly restStrength: number;
      readonly attackSpeed: number;
      readonly releaseSpeed: number;
      readonly jawReleaseSpeed: number;
      readonly restReleaseSpeed: number;
      readonly audioDrivenMouthFallback: {
        readonly enabled: boolean;
        readonly jawOpenMax: number;
        readonly visemeAAMax: number;
        readonly attackSpeed: number;
        readonly releaseSpeed: number;
      };
    };
    readonly materialFixConfig: {
      readonly doubleSided: boolean;
      readonly forceDepthWrite: boolean;
      readonly forceDepthTest: boolean;
    };
    readonly diagnosticsEnabled: boolean;
  };
};

export type SaraV3RuntimeMode = "idle" | "listening" | "thinking" | "speaking";

export type SaraV3DiscoveryResult = {
  readonly meshCount: number;
  readonly skinnedMeshCount: number;
  readonly faceMeshCandidates: readonly string[];
 readonly selectedFaceMesh: THREE.Mesh | null;
  readonly groupedFaceMeshes: readonly THREE.Mesh[];
  readonly groupedFaceMeshNames: readonly string[];
  readonly groupedMorphNames: readonly string[];
  readonly groupedMissingMorphsByMesh: Readonly<Record<string, readonly string[]>>;
  readonly hairMeshCandidates: readonly string[];
  readonly selectedHairMesh: THREE.Object3D | null;
  readonly bodyMeshCandidates: readonly string[];
  readonly selectedBodyMesh: THREE.Object3D | null;
  readonly morphTargetNames: readonly string[];
  readonly missingRequiredMorphs: readonly string[];
};

export type SaraV3BindingSet = ReadonlyMap<string, readonly MorphBinding[]>;

export type SaraV3ControllerState = {
  readonly root: THREE.Group;
  readonly faceMesh: THREE.Mesh | null;
  readonly bodyMesh: THREE.Object3D | null;
  readonly hairMesh: THREE.Object3D | null;
  readonly bindings: SaraV3BindingSet;
  readonly morphNames: readonly string[];
};

export type SaraV3Diagnostics = {
  saraV3Loaded: boolean;
  modelUrl: string;
  rootName: string | null;
  meshCount: number;
  skinnedMeshCount: number;
  faceMeshCandidates?: string[];
  selectedFaceMesh?: string | null;
  groupedFaceMeshBindingActive?: boolean;
  groupedFaceMeshNames?: string[];
  groupedFaceMeshCount?: number;
  groupedMorphNames?: string[];
  groupedMissingMorphsByMesh?: Record<string, string[]>;
  morphWriteMode?: "groupedFaceMeshes" | "selectedFaceMeshFallback";
  hairMeshCandidates: string[];
  bodyMeshCandidates: string[];
  morphTargetNames: string[];
  hasJawOpen: boolean;
  hasVisemeAA: boolean;
  hasEyeBlinkLeft: boolean;
  hasEyeBlinkRight: boolean;
  missingRequiredMorphs: string[];
  activePhoneme?: string | null;
  activeViseme?: string | null;
  appliedMorphs?: Record<string, number>;
  presenceState?: SaraV3RuntimeMode;
};

export type SaraV3LipSyncDiagnostics = {
  isSpeaking: boolean;
  audioCurrentTime: number;
  audioStartedAt: number | null;
  audioDuration: number | null;
  originalFirstTimelineStart: number | null;
  rebasedFirstTimelineStart: number | null;
  timelineRebasedToZero: boolean;
  timelineUnitConverted: boolean;
  timelineLength: number;
  firstTimelineItem: {
    phoneme: string;
    start: number;
    end: number | null;
  } | null;
  lastTimelineItem: {
    phoneme: string;
    start: number;
    end: number | null;
  } | null;
  activePhoneme: string | null;
  activeViseme: string | null;
  activePhonemeStart: number | null;
  activePhonemeEnd: number | null;
  lookupTime: number;
  effectiveLookupTime: number;
  previousLookupTime: number | null;
  lookAheadSeconds: number;
  timingOffsetSeconds: number;
  normalizedTimeline: boolean;
  timelineStartsAtZero: boolean;
  timelineDuration: number;
  appliedMorphs: Record<string, number>;
  jawOpenValue: number;
  possibleTimingIssue: string | null;
};

export type SaraV3WelcomeLipSyncDiagnostics = {
  welcomeAudioPlaying: boolean;
  welcomeAudioCurrentTime: number;
  welcomeAudioDuration: number | null;
  welcomeHasAvatarData: boolean;
  welcomeTimelineLength: number;
  welcomeTimelineFirstItem: {
    phoneme: string;
    start: number;
    end: number | null;
  } | null;
  welcomeTimelineLastItem: {
    phoneme: string;
    start: number;
    end: number | null;
  } | null;
  saraV3TimelineLength: number;
  saraV3IsSpeaking: boolean;
  saraV3ActivePhoneme: string | null;
  saraV3ActiveViseme: string | null;
  saraV3AppliedMorphs: Record<string, number>;
  reasonLipsNotMoving: string | null;
};

export type SaraV3WelcomePlaybackAudit = {
  welcomeTriggered: boolean;
  audioElementCreated: boolean;
  playCalled: boolean;
  playResolved: boolean;
  playRejected: boolean;
  playRejectReason: string | null;
  audioSrcExists: boolean;
  audioPaused: boolean | null;
  audioEnded: boolean;
  currentTime: number;
  duration: number | null;
  usingSameAudioClockAsSaraV3: boolean;
  diagnosticsCheckedAfterEnded: boolean;
  selectedRuntime: string | null;
  reason: string | null;
  lastWelcomePlaybackSummary?: {
    ended: boolean;
    finalCurrentTime: number;
    finalDuration: number | null;
    hadAvatarData: boolean;
    timelineLength: number;
    playResolved: boolean;
    playRejected: boolean;
    playRejectReason: string | null;
    fallbackExpected: boolean;
  } | null;
};

export type SaraV3ExpressionDiagnostics = {
  activePresenceState: SaraV3RuntimeMode;
  baseExpressionTargets: Record<string, number>;
  scheduledSmileTargets: Record<string, number>;
  coordinatedBlinkSupport: Record<string, number>;
  finalAppliedExpressionMorphs: Record<string, number>;
  suppressedLipSyncConflicts: string[];
};

export type SaraV3EyeDiagnostics = {
  nextBlinkAtMs: number;
  blinkActive: boolean;
  blinkValue: number;
  blinkPhase: "idle" | "closing" | "hold" | "opening";
  blinkProgress: number;
  leftBlinkTarget: number;
  rightBlinkTarget: number;
  eyebrowBlinkSupport: number;
  cheekBlinkSupport: number;
  nextBlinkDelayMs: number;
  appliedEyeMorphs: Record<string, number>;
  coordinatedMorphs: Record<string, number>;
};

export type SaraV3SmileDiagnostics = {
  nextSmileAtMs: number;
  smileActive: boolean;
  smilePhase: "idle" | "fadeIn" | "hold" | "fadeOut";
  smileProgress: number;
  smileAdditiveTargets: Record<string, number>;
  blockedByBlink: boolean;
  lastCollisionAvoidedAtMs: number | null;
};

export type SaraV3HairDiagnostics = {
  hairFixApplied: boolean;
  hairMeshNames: string[];
  hairMaterialNames: string[];
  targetedMeshes?: string[];
  targetedMaterials?: string[];
  alphaTest: number;
  depthWrite: boolean;
  depthTest: boolean;
  side: string;
  frontHairSide?: string;
  backHairSide?: string;
  renderOrderApplied?: boolean;
  renderOrder?: number;
  backHairRestored?: boolean;
  frontHairPreserved?: boolean;
  testedAlphaValues: number[];
};

export type SaraV3HairPartDiagnostics = {
  face4Role: string;
  face9Role: string;
  testedSettings: Array<{
    label: string;
    face4Side: string;
    face9Side: string;
    selected: boolean;
  }>;
  recommendedBackHairTarget: string | null;
  frontHairPreserved: boolean;
};

export type SaraV3MeshMaterialDiagnosticEntry = {
  meshName: string;
  materialName: string;
  materialType: string;
  transparent: boolean | null;
  alphaTest: number | null;
  opacity: number | null;
  depthWrite: boolean | null;
  side: string | null;
  renderOrder: number;
};

export type SaraV3MeshMaterialDiagnostics = {
  meshes: SaraV3MeshMaterialDiagnosticEntry[];
};

export type SaraV3TextureAudit = {
  slot: string;
  textureName: string | null;
  colorSpace: string | null;
  encoding: string | null;
  flipY: boolean | null;
};

export type SaraV3MaterialAudit = {
  meshName: string;
  materialName: string;
  materialType: string;
  transparent: boolean | null;
  opacity: number | null;
  alphaTest: number | null;
  depthWrite: boolean | null;
  depthTest: boolean | null;
  side: string | null;
  renderOrder: number;
  roughness: number | null;
  metalness: number | null;
  envMapIntensity: number | null;
  reflectivity: number | null;
  color: string | null;
  textures: SaraV3TextureAudit[];
};

export type SaraV3RenderAudit = {
  rendererSettings: {
    outputColorSpace: string | null;
    toneMapping: string | null;
    toneMappingExposure: number | null;
    physicallyCorrectLights: boolean | null;
  };
  environmentAudit: {
    sceneEnvironmentType: string | null;
    sceneBackgroundType: string | null;
    environmentAssignedToScene: boolean;
    backgroundAssignedToScene: boolean;
    pmremGeneratorUsed: boolean;
    hdriUsed: boolean;
    environmentIntensity: number | null;
  };
  materialAudit: SaraV3MaterialAudit[];
  hairMaterialAudit: SaraV3MaterialAudit[];
  faceMaterialAudit: SaraV3MaterialAudit[];
  eyeMaterialAudit: SaraV3MaterialAudit[];
  clothingMaterialAudit: SaraV3MaterialAudit[];
  textureAudit: SaraV3TextureAudit[];
  exposureSweepPlan: {
    currentExposure: number | null;
    plannedValues: number[];
    automationAvailable: boolean;
  };
};

export type SaraV3RawAudit = {
  rawRenderAuditMode: boolean;
  cameraAppliedInRawAudit: boolean;
  cameraConfigSource: string | null;
  modelUrl: string;
  sceneObject: string | null;
  sceneName: string | null;
  childCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  meshNames: string[];
  materialNames: string[];
  materialTypes: string[];
  morphTargetNamesByMesh: Record<string, string[]>;
  totalMorphTargetCount: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
  boundingBoxSize: [number, number, number] | null;
  boundingBoxCenter: [number, number, number] | null;
  rootPosition: [number, number, number];
  rootRotation: [number, number, number];
  rootScale: [number, number, number];
  cameraPosition: [number, number, number];
  cameraLookAt: [number, number, number] | null;
  cameraFov: number | null;
  cameraNear: number | null;
  cameraFar: number | null;
  cameraRotation: [number, number, number];
  rendererOutputColorSpace: string | null;
  rendererToneMapping: string | null;
  rendererExposure: number | null;
  environmentExists: boolean;
  lightsSummary: Array<{
    name: string;
    type: string;
    intensity: number | null;
    color: string | null;
    position: [number, number, number] | null;
  }>;
};

export type SaraV3VisemeDriverState = {
  readonly morphValues: Map<string, number>;
  activePhoneme: string | null;
  activeViseme: string | null;
  appliedMorphs: Record<string, number>;
  previousLookupTime: number | null;
};

export type SaraV3ExpressionState = {
  readonly morphValues: Map<string, number>;
  baseExpressionTargets: Record<string, number>;
  scheduledSmileTargets: Record<string, number>;
  coordinatedBlinkSupport: Record<string, number>;
  finalAppliedExpressionMorphs: Record<string, number>;
  suppressedLipSyncConflicts: string[];
};

export type SaraV3PresenceState = {
  currentMode: SaraV3RuntimeMode;
};

export type SaraV3EyeRuntimeState = {
  nextBlinkAtMs: number;
  blinkStartedAtMs: number | null;
  blinkValue: number;
  blinkAsymmetry: number;
  leftBlinkTarget: number;
  rightBlinkTarget: number;
  nextBlinkDelayMs: number;
  appliedEyeMorphs: Record<string, number>;
  coordinatedMorphs: Record<string, number>;
  nextEyeballAtMs: number;
  eyeballStartedAtMs: number | null;
  eyeballMoveMs: number;
  eyeballHoldMs: number;
  eyeballReturnMs: number;
  eyeballTarget: number;
  eyeballValue: number;
  lastNowMs: number;
};

export type SaraV3SmileRuntimeState = {
  nextSmileAtMs: number;
  smileStartedAtMs: number | null;
  smileFadeInMs: number;
  smileHoldMs: number;
  smileFadeOutMs: number;
  smileLeftTarget: number;
  smileRightTarget: number;
  cheekLeftTarget: number;
  cheekRightTarget: number;
  smileAdditiveTargets: Record<string, number>;
  blockedByBlink: boolean;
  lastCollisionAvoidedAtMs: number | null;
  nextBrowAtMs: number;
  browStartedAtMs: number | null;
  browFadeInMs: number;
  browHoldMs: number;
  browFadeOutMs: number;
  browTarget: number;
};

export type UpdateSaraV3VisemeArgs = {
  state: SaraV3VisemeDriverState;
  bindings: SaraV3BindingSet;
  timeline: AvatarPhonemeTimeline | null;
  audioCurrentTime: number;
  audioLevel?: number;
  isSpeaking: boolean;
  dt: number;
};
