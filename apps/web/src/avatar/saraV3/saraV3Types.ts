import type { AvatarDefinition, Vector3Config } from "@/lib/avatar/avatarConfigTypes";
import type { AvatarPhonemeTimeline, MorphBinding } from "@/lib/avatar/avatarMorphTypes";
import type { SaraV3VisemeMapEntry, SaraV3VisemeMorphName } from "./saraV3VisemeMap";
import type * as THREE from "three";

/** B2.2: per-viseme intensity and jaw opening, keyed by GLB morph name. */
export type SaraV3VisemeProfile = {
  readonly strength: number;
  readonly jawOpen: number;
};

export type SaraV3VisemeTable = Readonly<Record<SaraV3VisemeMorphName, SaraV3VisemeProfile>>;

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
    readonly visemeMap: Readonly<Record<string, SaraV3VisemeMapEntry>>;
    readonly visemeTable: SaraV3VisemeTable;
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
    /** C4: idle-personality coordinator policy (see saraV3IdleBehavior.ts). */
    readonly idleBehaviorConfig: {
      readonly reentrySmileDelayMs: readonly [number, number];
      readonly routeBreathingToIdleBaseline: boolean;
    };
    /**
     * EXPERIMENT (idle-only): "Attention Refresh" — a coordinated idle micro-event
     * with its own 5–10s schedule, separate from the existing micro-smile/brow
     * events (see saraV3AttentionRefresh.ts). Every value lives here; the runtime
     * hard-codes none. Peaks are TEMP CURRENT-ASSET COMPENSATION (weak-deforming
     * GLB) and intentionally visible for this experiment only.
     */
    readonly attentionRefreshConfig: {
      /** Own schedule window (ms) between successive Attention Refresh events. */
      readonly intervalMinMs: number;
      readonly intervalMaxMs: number;
      /** Per-fire combination probabilities (A blink-only … D eyeball-only). */
      readonly combinationWeights: {
        readonly a: number;
        readonly b: number;
        readonly c: number;
        readonly d: number;
      };
      /** Staged onset delays (ms) from event start — nothing starts together. */
      readonly browDelayMs: number;
      readonly cheekDelayMs: number;
      readonly eyeDelayMs: number;
      /** Shared brow/cheek envelope (ms): fade-in → hold → fade-out. */
      readonly fadeInMs: number;
      readonly holdMs: number;
      readonly fadeOutMs: number;
      /** Additive brow/cheek peaks (TEMP visible compensation for the weak GLB). */
      readonly eyebrowPeak: number;
      readonly cheekPeak: number;
      /** Tiny signed eyeball refocus — additive on top of the C8 gaze value and
       *  clamped to the shared gaze safety bound. Out-and-back, never held. */
      readonly eyeRefocusStrength: number;
      readonly eyeRefocusDurationMs: number;
    };
    /** C5: listening-personality behavior (see saraV3ListeningBehavior.ts). All
     *  values are TEMP current-asset compensation, re-tuned after the new GLB. */
    readonly listeningBehaviorConfig: {
      readonly base: Readonly<Record<string, number>>;
      readonly acknowledgement: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly fadeInMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly fadeOutMs: readonly [number, number];
        readonly smilePeak: number;
        readonly cheekPeak: number;
        readonly eyebrowPeak: number;
        readonly smilePulseChance: number;
      };
      readonly eyeAttention: {
        readonly reuseIdleEyeDrift: boolean;
      };
    };
    /** C6: thinking-personality behavior (see saraV3ThinkingBehavior.ts). All
     *  values are TEMP current-asset compensation, re-tuned after the new GLB. */
    readonly thinkingBehaviorConfig: {
      readonly base: Readonly<Record<string, number>>;
      readonly microEvent: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly fadeInMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly fadeOutMs: readonly [number, number];
        readonly eyebrowPeak: number;
        readonly cheekPeak: number;
        readonly lipPressPeak: number;
        readonly browShiftChance: number;
      };
      /** Declarative only — consumed by the C8 gaze controller, never written. */
      readonly gazeIntent: {
        readonly emitIntent: boolean;
        readonly direction: string;
        readonly strength: number;
      };
    };
    /** C7: speaking body-language behavior (see saraV3SpeakingBehavior.ts). All
     *  values are TEMP current-asset compensation, re-tuned after the new GLB. */
    readonly speakingBehaviorConfig: {
      /** Stable speaking baseline (mild cheek / small brow / very low smile /
       *  slight eye squint). Replaces expressionConfig.speaking while C7 runs. */
      readonly base: Readonly<Record<string, number>>;
      /** Multiplier applied to the baseline smile support when the C3 sentiment
       *  direction is `concern` — keeps concern speech empathetic, not cheerful. */
      readonly concernBaseSmileScale: number;
      /** Occasional phrase/sentence-level emphasis pulse, triggered at chunk
       *  boundaries (never per phoneme). */
      readonly emphasis: {
        /** Probability a new sentence/chunk boundary starts an emphasis pulse. */
        readonly chancePerChunk: number;
        readonly fadeInMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly fadeOutMs: readonly [number, number];
        readonly eyebrowPeak: number;
        readonly cheekPeak: number;
        readonly eyeSquintPeak: number;
        /** Very low smile support; zeroed entirely when direction is `concern`. */
        readonly smileSupportPeak: number;
        /** Extra scale on the emphasis smile support when direction is `positive`,
         *  so C7 never stacks onto C3's positive smile into a grin. */
        readonly positiveSmileScale: number;
      };
      /** Declarative only — consumed by the C8 gaze controller, never written. */
      readonly gazeIntent: {
        readonly emitIntent: boolean;
        readonly direction: string;
        readonly strength: number;
      };
    };
    /** C8: unified gaze controller tuning (see saraV3GazeController.ts). All
     *  influence magnitudes are TEMP current-asset compensation, re-tuned after
     *  the new GLB. `safety` is shared across every state (single clamp/damp
     *  contract that guarantees coordinated, non-crossed, non-snapping eyes). */
    readonly gazeConfig: {
      readonly safety: {
        /** Max signed influence on LeftEyeball/RightEyeball (horizontal gaze).
         *  Both eyes always receive the identical signed value. */
        readonly maxEyeballInfluence: number;
        /** Max magnitude of the signed vertical channel before it is split into
         *  the non-negative eyeLookUp / eyeLookDown pair (mirrored L/R). */
        readonly maxVerticalInfluence: number;
        /** Per-frame damp lambda easing the applied value toward its target. */
        readonly dampLambda: number;
        /** During a blink, horizontal eyeball movement is scaled down by
         *  `blinkValue * blinkReductionFactor` (preserves the pre-C8 feel). */
        readonly blinkReductionFactor: number;
      };
      readonly idle: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly moveMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly returnMs: readonly [number, number];
        readonly minInfluence: number;
        readonly maxInfluence: number;
        /** Chance a side glance also carries a small vertical refocus. */
        readonly verticalChance: number;
        readonly verticalInfluence: number;
      };
      readonly listening: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly moveMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly returnMs: readonly [number, number];
        readonly horizontalInfluence: number;
        readonly verticalInfluence: number;
        /** Probability a refocus is instead a rare brief gaze-away. */
        readonly gazeAwayChance: number;
        readonly gazeAwayInfluence: number;
      };
      readonly thinking: {
        /** Randomized delay before the first gaze-away fires after entering
         *  thinking — never zero, so nothing snaps away on the entry frame. */
        readonly entryDelayMs: readonly [number, number];
        /** Gap between successive gaze-away holds while thinking persists. */
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly moveMs: readonly [number, number];
        /** Longer than idle — a held, deliberate disengagement. */
        readonly holdMs: readonly [number, number];
        readonly returnMs: readonly [number, number];
        /** Applied horizontal influence = intentStrength * strengthScale. */
        readonly strengthScale: number;
        /** Horizontal sign for the away look: -1/+1 fixed side, 0 = random. */
        readonly horizontalBias: number;
        /** Slight downward cast that reads as "processing". */
        readonly verticalInfluence: number;
        /** Subtle drift used when C6 gazeIntent is inactive. */
        readonly fallback: {
          readonly minIntervalMs: number;
          readonly maxIntervalMs: number;
          readonly moveMs: readonly [number, number];
          readonly holdMs: readonly [number, number];
          readonly returnMs: readonly [number, number];
          readonly horizontalInfluence: number;
          readonly verticalInfluence: number;
        };
      };
      readonly speaking: {
        readonly minIntervalMs: number;
        readonly maxIntervalMs: number;
        readonly moveMs: readonly [number, number];
        readonly holdMs: readonly [number, number];
        readonly returnMs: readonly [number, number];
        readonly horizontalInfluence: number;
        readonly verticalInfluence: number;
        /** Optional brief emphasis glance when C7 gazeIntent is active. */
        readonly emphasisStrengthScale: number;
      };
    };
    /** C10: unified emotion-coordination tuning (see saraV3EmotionCoordinator.ts).
     *  The coordinator OWNS NO MORPHS — these knobs only scale the existing
     *  additive expression layers so opposing signals cannot co-exist. Boost
     *  values are TEMP current-asset compensation for the weak-deforming GLB. */
    readonly emotionCoordinatorConfig: {
      /** Ceiling on any single channel scale and on overall expressiveness. */
      readonly maxExpressiveness: number;
      /** Positive: amplify warm channels (per-unit-weight boost above 1). */
      readonly positiveSmileBoost: number;
      readonly positiveCheekBoost: number;
      readonly positiveEyeBoost: number;
      /** Positive: fully suppress opposing channels (1 → 0 at full weight). */
      readonly positiveFrownSuppression: number;
      readonly positiveSadSuppression: number;
      readonly positiveMouthPressSuppression: number;
      /** Concern: suppress the warm/engaged channels (1 → 0 at full weight). */
      readonly concernSmileSuppression: number;
      readonly concernCheekReduction: number;
      readonly concernEyeReduction: number;
      readonly concernBrowReduction: number;
      /** Concern: keep/boost the empathetic channels C3 already supplies. */
      readonly concernFrownBoost: number;
      readonly concernSadBoost: number;
      /** Reserved concern-tension lip-press boost; 0 preserves neutral-identity. */
      readonly mouthPressBoost: number;
    };
    /** C11: cross-state transition tuning (see saraV3StateTransitionController.ts).
     *  Durations only — C11 creates no new expression/event, it just crossfades
     *  the existing state baselines over these windows. All timings live here;
     *  the runtime hard-codes none. Conservative for the current asset. */
    readonly transitionConfig: {
      /** Eased-progress curve applied to the raw 0..1 transition progress. */
      readonly easing: SaraV3TransitionEasing;
      /** Fallback crossfade duration for any edge not explicitly listed. */
      readonly defaultMs: number;
      /** Per-edge crossfade durations, keyed `${from}To${Capitalized(to)}`. */
      readonly edges: Readonly<Record<string, number>>;
      /** Config/type-ready (currently inactive — no explicit barge-in signal). */
      readonly interruptionMs: number;
      /** Config/type-ready (currently not actively triggered). */
      readonly sessionStartMs: number;
      /** Config/type-ready (currently not actively triggered). */
      readonly sessionEndMs: number;
    };
    readonly expressionConfig: {
      readonly idle: Readonly<Record<string, number>>;
      readonly listening: Readonly<Record<string, number>>;
      readonly thinking: Readonly<Record<string, number>>;
      readonly speaking: Readonly<Record<string, number>>;
      readonly blendSpeed: number;
    };
    /** C3: sentence-level speaking-sentiment gate tuning. All magnitudes here. */
    readonly sentimentGateConfig: {
      /** |compound| below this → neutral (no overlay). */
      readonly neutralThreshold: number;
      /** Full-scale primary morph delta for positive sentiment. */
      readonly maxPositiveDelta: number;
      /** Full-scale primary morph delta for negative/concern sentiment. */
      readonly maxConcernDelta: number;
      /** Extra same-direction magnitude a matching label may add (never flips). */
      readonly labelNudgeCap: number;
      /** Positive overlay morph weights, relative to the primary (mouthSmile=1). */
      readonly positiveMorphRatios: {
        readonly mouthSmile: number;
        readonly cheekSquint: number;
        readonly eyebrows: number;
      };
      /** Concern overlay morph weights, relative to the primary (mouthFrown=1). */
      readonly concernMorphRatios: {
        readonly mouthFrown: number;
        readonly sad: number;
        readonly eyebrows: number;
      };
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
  /** B2.2: per-phoneme weight applied to the active viseme's strength/jaw. */
  activePhonemeWeight?: number;
  /** B2.2: min(profile.strength * weight, SARA_V3_VISEME_MAX_STRENGTH). */
  activeVisemeStrength?: number;
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

/**
 * C2: identifiers for the authoritative expression-layer stack, in formal
 * priority order (1 = safety guard … 7 = idle baseline). Every future
 * contributing module (C3 sentiment, C4–C7 state bodies, C10 emotion overlay)
 * plugs in as one of these layers rather than as an independent morph writer.
 */
export type SaraV3ExpressionLayerId =
  | "safetyGuard"
  | "lipSyncOwnership"
  | "blink"
  | "stateExpression"
  | "emotionOverlay"
  | "scheduledMicro"
  | "idleBaseline";

/**
 * C2: how a layer combines into the final target.
 *  - "additive" — its targets are summed into the combined value (all C2 layers).
 *  - "guard"    — contributes no targets; participates only as an ownership /
 *                 forbidden-morph filter.
 */
export type SaraV3ExpressionBlendMode = "additive" | "guard";

/**
 * C2: one entry in the ordered expression-layer list consumed by
 * `updateSaraV3ExpressionRuntime`. Kept intentionally minimal — this is a
 * contract, not a general animation framework.
 */
export type SaraV3ExpressionLayer = {
  readonly id: SaraV3ExpressionLayerId;
  /** Formal contract order (1..7). Additive layers are order-independent, so
   *  this is metadata for diagnostics and future non-additive layers. */
  readonly priority: number;
  readonly enabled: boolean;
  readonly blend: SaraV3ExpressionBlendMode;
  /** Additive contributions keyed by GLB morph name. Empty for guard layers. */
  readonly targets: Readonly<Record<string, number>>;
};

// ── C3: sentence-level speaking-sentiment gate ──────────────────────────────
export type SaraV3SentimentDirection = "neutral" | "positive" | "concern";

/** Result of evaluating the sentiment gate for one sentence/chunk. */
export type SaraV3SentimentGateResult = {
  direction: SaraV3SentimentDirection;
  /** Bounded emotion-overlay targets (empty for neutral). */
  targets: Record<string, number>;
  // Diagnostics-friendly breakdown.
  rawCompound: number | null;
  clampedCompound: number | null;
  label: string;
  normalizedMagnitude: number;
  labelNudge: number;
  finalMagnitude: number;
  neutralReason: string | null;
};

/** SaraV3-owned per-sentence speaking-emotion overlay state (C3). */
export type SaraV3EmotionOverlayState = {
  /** Overlay targets currently fed into C2's `emotionOverlayTargets` slot. */
  targets: Record<string, number>;
  /** Stable identity of the sentence the current overlay was evaluated for. */
  sentenceIdentity: unknown;
  /** Last gate result (for diagnostics); null before any evaluation. */
  lastResult: SaraV3SentimentGateResult | null;
};

/** C3 development-only diagnostics. */
export type SaraV3SentimentDiagnostics = {
  enabled: boolean;
  isSpeaking: boolean;
  rawCompound: number | null;
  clampedCompound: number | null;
  label: string;
  direction: SaraV3SentimentDirection;
  normalizedMagnitude: number;
  labelNudge: number;
  finalMagnitude: number;
  sentenceIdentity: string | null;
  emotionOverlayTargets: Record<string, number>;
  neutralReason: string | null;
};

export type SaraV3ExpressionDiagnostics = {
  activePresenceState: SaraV3RuntimeMode;
  baseExpressionTargets: Record<string, number>;
  scheduledSmileTargets: Record<string, number>;
  coordinatedBlinkSupport: Record<string, number>;
  finalAppliedExpressionMorphs: Record<string, number>;
  suppressedLipSyncConflicts: string[];
  // C2 (development-only) layer diagnostics.
  activeLayerIds?: SaraV3ExpressionLayerId[];
  layerPriorityOrder?: Array<{
    id: SaraV3ExpressionLayerId;
    priority: number;
    enabled: boolean;
    blend: SaraV3ExpressionBlendMode;
  }>;
  layerContributions?: Record<string, Record<string, number>>;
  suppressedByOwnership?: string[];
  finalCombinedTargets?: Record<string, number>;
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

// ── C4: idle-personality behavior layer ─────────────────────────────────────
/** Discrete idle micro-event currently in flight (for diagnostics/coordination). */
export type SaraV3IdleEventType = "none" | "smile" | "brow";
/** Envelope phase of the current idle micro-event. */
export type SaraV3IdleEventPhase = "inactive" | "fadeIn" | "hold" | "fadeOut";

/**
 * C4: lifecycle state owned by the idle behavior coordinator. Pure metadata —
 * the coordinator never writes morphs itself; it only routes the existing
 * runtime outputs into the C2 layer slots and tracks idle entry/exit.
 */
export type SaraV3IdleBehaviorState = {
  /** Whether idle was active on the previous frame (entry/exit edge detect). */
  wasIdle: boolean;
  /** Frame-clock timestamp (ms) idle was last entered, or null when not idle. */
  idleEnteredAtMs: number | null;
  /** Milliseconds spent in the current idle stretch (0 when not idle). */
  timeInIdleMs: number;
  /** Last non-empty routed idle-baseline (breathing) targets. */
  idleBaselineTargets: Record<string, number>;
  /** Last non-empty routed scheduled-micro (event) targets. */
  scheduledMicroTargets: Record<string, number>;
};

/**
 * C4: development-only idle-behavior diagnostics snapshot. Written to
 * `window.saraV3IdleBehaviorDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3IdleBehaviorDiagnostics = {
  enabled: boolean;
  idleActive: boolean;
  timeInIdleMs: number;
  /** Breathing driver phase in radians and its representative swell value (0..1). */
  breathingPhase: number;
  breathingValue: number;
  currentEventType: SaraV3IdleEventType;
  eventPhase: SaraV3IdleEventPhase;
  eventMagnitude: number;
  nextSmileAtMs: number;
  nextBrowAtMs: number;
  gazeActive: boolean;
  gazeValue: number;
  idleBaselineTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
};

// ── EXPERIMENT: idle "Attention Refresh" coordinated micro-event ─────────────
/** Which natural combination this Attention Refresh fired; "none" when idle. */
export type SaraV3AttentionRefreshCombination = "none" | "A" | "B" | "C" | "D";

/**
 * EXPERIMENT (idle-only): lifecycle + scheduler state for the Attention Refresh
 * event. It owns its own 5–10s schedule (independent of blink and of the smile
 * event). Brow/cheek are routed additively into C2's scheduledMicro slot; the
 * blink is delegated to the eye runtime (it just re-arms the next blink); the
 * tiny eyeball refocus is applied on top of the C8 gaze value and clamped to the
 * shared gaze safety bound. The module never owns smile/jaw/lip/viseme morphs.
 */
export type SaraV3AttentionRefreshState = {
  /** Idle on the previous frame (entry/exit edge detection). */
  wasIdle: boolean;
  /** Frame-clock timestamp (ms) the next event is allowed to start. */
  nextEventAtMs: number;
  /** When the in-flight event started, or null between events. */
  eventStartedAtMs: number | null;
  /** Total lifetime (ms) of the in-flight event (depends on the combination). */
  eventDurationMs: number;
  /** The combination selected for the in-flight event. */
  combination: SaraV3AttentionRefreshCombination;
  hasBlink: boolean;
  hasBrowCheek: boolean;
  hasEyeRefocus: boolean;
  /** Whether this event has already re-armed the eye runtime's blink. */
  blinkTriggered: boolean;
  /** Signed direction (-1/+1) of this event's eyeball refocus. */
  eyeRefocusSign: number;
  /** Last routed brow/cheek additive targets (into scheduledMicro). */
  scheduledMicroTargets: Record<string, number>;
  /** Last applied signed eyeball refocus offset (before C8 combine/clamp). */
  eyeRefocusOffset: number;
};

/**
 * EXPERIMENT: development-only Attention Refresh diagnostics. Written to
 * `window.saraV3AttentionRefreshDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3AttentionRefreshDiagnostics = {
  enabled: boolean;
  idleActive: boolean;
  eventActive: boolean;
  combination: SaraV3AttentionRefreshCombination;
  elapsedMs: number;
  eventDurationMs: number;
  nextEventAtMs: number;
  blinkTriggered: boolean;
  browValue: number;
  cheekValue: number;
  eyeRefocusOffset: number;
  scheduledMicroTargets: Record<string, number>;
  tempAssetCompensation: boolean;
};

// ── C5: listening-personality behavior layer ────────────────────────────────
/** Discrete listening acknowledgement currently in flight. */
export type SaraV3ListeningEventType = "none" | "smilePulse" | "browLift";
/** Envelope phase of the current listening acknowledgement. */
export type SaraV3ListeningEventPhase = "inactive" | "fadeIn" | "hold" | "fadeOut";

/**
 * C5: lifecycle + scheduler state owned by the listening behavior coordinator.
 * Pure metadata — the coordinator never writes morphs; it routes an attentive
 * baseline into C2's stateExpression override and acknowledgement pulses into
 * the scheduledMicro slot.
 */
export type SaraV3ListeningBehaviorState = {
  /** Whether listening was active on the previous frame (entry/exit edge). */
  wasListening: boolean;
  /** Frame-clock timestamp (ms) listening was last entered, or null. */
  enteredAtMs: number | null;
  /** Milliseconds spent in the current listening stretch (0 when not listening). */
  timeInListeningMs: number;
  /** Frame-clock timestamp for the next scheduled acknowledgement. */
  nextEventAtMs: number;
  /** When the current acknowledgement started, or null when none is active. */
  eventStartedAtMs: number | null;
  /** Type of the acknowledgement currently in flight. */
  eventType: SaraV3ListeningEventType;
  eventFadeInMs: number;
  eventHoldMs: number;
  eventFadeOutMs: number;
  /**
   * Peak magnitudes sampled once at the start of the current acknowledgement,
   * each in [70%, 100%] of its configured peak, and held for the whole envelope.
   */
  eventSmilePeak: number;
  eventCheekPeak: number;
  eventEyebrowPeak: number;
  /** Last routed baseline / acknowledgement target maps. */
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
};

/**
 * C5: development-only listening-behavior diagnostics. Written to
 * `window.saraV3ListeningBehaviorDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3ListeningBehaviorDiagnostics = {
  enabled: boolean;
  listeningActive: boolean;
  timeInListeningMs: number;
  baselineTargets: Record<string, number>;
  currentEventType: SaraV3ListeningEventType;
  eventPhase: SaraV3ListeningEventPhase;
  eventMagnitude: number;
  nextEventAtMs: number;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  /** True while the TEMP current-asset compensation values are in use. */
  tempAssetCompensation: boolean;
};

// ── C6: thinking-personality behavior layer ─────────────────────────────────
/** Discrete thinking micro-event currently in flight. Never a smile. */
export type SaraV3ThinkingEventType = "none" | "browShift" | "lipPress";
/** Envelope phase of the current thinking micro-event. */
export type SaraV3ThinkingEventPhase = "inactive" | "fadeIn" | "hold" | "fadeOut";

/**
 * C6: declarative gaze request published while thinking. C6 never writes a gaze
 * morph — this is metadata for the future C8 gaze controller to consume, so the
 * eye runtime stays the single gaze writer.
 */
export type SaraV3GazeIntent = {
  active: boolean;
  direction: string;
  strength: number;
};

/**
 * C8: the gaze "mode" the unified controller is currently driving, one per C1
 * behavior state. `sourceIntent` (on the controller state) carries the finer
 * detail (which scheduler / whether a C6/C7 intent is being honored).
 */
export type SaraV3GazeMode = "idle" | "listening" | "thinking" | "speaking";

/** Envelope phase of the current gaze event. */
export type SaraV3GazeEventPhase = "inactive" | "move" | "hold" | "return";

/**
 * C8: single-owner gaze controller state. Owns all four `eyeLook*` morphs plus
 * `LeftEyeball`/`RightEyeball`; blink stays owned by the eye runtime. Horizontal
 * gaze is one signed scalar written identically to both eyeballs (never crossed,
 * never divergent); vertical is one signed scalar split into the non-negative
 * up/down pair, mirrored L/R. Both channels are damped every frame — targets are
 * approached, never snapped.
 */
export type SaraV3GazeControllerState = {
  /** Presence mode seen last frame (entry/exit detection). */
  lastMode: SaraV3RuntimeMode | null;
  /** When the next gaze event is allowed to start. */
  nextEventAtMs: number;
  /** Start time of the in-flight event, or null when between events. */
  eventStartedAtMs: number | null;
  eventMoveMs: number;
  eventHoldMs: number;
  eventReturnMs: number;
  /** Signed pre-envelope targets sampled once at event start (already clamped). */
  eventTargetH: number;
  eventTargetV: number;
  /** Damped applied signed values (what actually reaches the morphs). */
  appliedH: number;
  appliedV: number;
  /** dt tracking for frame-rate-independent damping. */
  lastNowMs: number;
  /** Last resolved outputs (also surfaced to diagnostics/consumers). */
  eyeLookTargets: Record<string, number>;
  eyeballTargets: Record<string, number>;
  gazeMode: SaraV3GazeMode;
  sourceIntent: string;
  eventPhase: SaraV3GazeEventPhase;
  /** True on the frame a target had to be clamped to a safety bound. */
  clampApplied: boolean;
};

/**
 * C8: development-only gaze diagnostics. Written to
 * `window.saraV3GazeDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3GazeDiagnostics = {
  enabled: boolean;
  gazeActive: boolean;
  behaviorState: SaraV3RuntimeMode;
  gazeMode: SaraV3GazeMode;
  sourceIntent: string;
  targetDirection: { horizontal: number; vertical: number };
  eyeLookValues: Record<string, number>;
  eyeballValues: Record<string, number>;
  eventPhase: SaraV3GazeEventPhase;
  eventStartedAtMs: number | null;
  eventEndsAtMs: number | null;
  nextEventAtMs: number;
  clampApplied: boolean;
  tempAssetCompensation: boolean;
};

/**
 * C10: which single state personality owns the face this frame (derived from the
 * authoritative C1 mode — sentiment never changes ownership).
 */
export type SaraV3EmotionPersonality = "idle" | "listening" | "thinking" | "speaking";

/** C10: emotional polarity in effect (only ever non-neutral while speaking). */
export type SaraV3EmotionDirection = "neutral" | "positive" | "concern";

/**
 * C10: the normalized overlay DECISION. Owns no morphs — it is a set of
 * per-channel scalar multipliers (1 = unchanged) applied to the existing
 * additive expression layers so contradictory signals cannot co-exist. All
 * scales are 1 when disabled or emotionally neutral, so the output is
 * byte-identical to the pre-C10 (C3–C8) behavior in those cases.
 */
export type SaraV3EmotionCoordinatorDecision = {
  enabled: boolean;
  activePersonality: SaraV3EmotionPersonality;
  emotionDirection: SaraV3EmotionDirection;
  emotionIntensity: number;
  positiveWeight: number;
  concernWeight: number;
  smileScale: number;
  browScale: number;
  cheekScale: number;
  eyeScale: number;
  frownScale: number;
  sadScale: number;
  mouthPressScale: number;
};

/**
 * C10: development-only coordinator diagnostics. Written to
 * `window.saraV3EmotionCoordinatorDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3EmotionCoordinatorDiagnostics = {
  enabled: boolean;
  currentState: SaraV3RuntimeMode;
  activePersonality: SaraV3EmotionPersonality;
  emotionDirection: SaraV3EmotionDirection;
  emotionIntensity: number;
  positiveWeight: number;
  concernWeight: number;
  scales: Record<string, number>;
  /** Channels fully zeroed (scale === 0). */
  suppressedChannels: string[];
  /** Channels reduced but not zeroed (0 < scale < 1). */
  attenuatedChannels: string[];
  /** Channels amplified (scale > 1). */
  boostedChannels: string[];
  tempAssetCompensation: boolean;
};

/** C11: eased-progress curve for a transition (config-selected). */
export type SaraV3TransitionEasing = "smoothstep" | "easeInOutSine";

/**
 * C11: cross-state transition controller state. Metadata + a small crossfade
 * buffer only — it OWNS NO MORPHS and never replaces the authoritative C1
 * current state. It detects state edges, runs one time-boxed baseline crossfade
 * per edge, and hands the blended baseline back to the C2 stateExpression slot.
 */
export type SaraV3TransitionState = {
  /** Mode seen last frame (edge detection). */
  lastMode: SaraV3RuntimeMode | null;
  transitionActive: boolean;
  transitionFrom: SaraV3RuntimeMode | null;
  transitionTo: SaraV3RuntimeMode | null;
  transitionStartedAtMs: number;
  transitionDurationMs: number;
  /** Raw clamped progress 0..1. */
  transitionProgress: number;
  /** Eased progress 0..1 (per the configured curve). */
  easedProgress: number;
  transitionReason: string;
  /** How many times an in-flight transition was replaced by a newer edge. */
  replacementCount: number;
  /** Snapshot of the outgoing displayed baseline (the crossfade "from"). */
  fromBaseline: Record<string, number>;
  /** Last baseline actually displayed (blended while active, else current). */
  lastDisplayedBaseline: Record<string, number>;
};

/** C11: development-only transition diagnostics. */
export type SaraV3TransitionDiagnostics = {
  enabled: boolean;
  transitionActive: boolean;
  fromState: SaraV3RuntimeMode | null;
  toState: SaraV3RuntimeMode | null;
  startedAtMs: number;
  durationMs: number;
  rawProgress: number;
  easedProgress: number;
  transitionReason: string;
  replacementCount: number;
  /** Whether the stateExpression baseline crossfade is currently driving output. */
  baselineCrossfadeActive: boolean;
  /** C11 provides no gaze metadata — C8's own entry/exit handles transitions. */
  gazeTransitionMetadataActive: boolean;
  /** Source of the interruption signal, or "unavailable" when none is wired. */
  interruptionSource: string;
};

/**
 * C6: lifecycle + scheduler state owned by the thinking behavior coordinator.
 * Pure metadata — routes a concentration baseline into C2's stateExpression
 * override and micro-events into the scheduledMicro slot.
 */
export type SaraV3ThinkingBehaviorState = {
  wasThinking: boolean;
  enteredAtMs: number | null;
  timeInThinkingMs: number;
  nextEventAtMs: number;
  eventStartedAtMs: number | null;
  eventType: SaraV3ThinkingEventType;
  eventFadeInMs: number;
  eventHoldMs: number;
  eventFadeOutMs: number;
  /**
   * Peak magnitudes sampled once at the start of the current micro-event, each
   * in [70%, 100%] of its configured peak, and held for the whole envelope.
   */
  eventEyebrowPeak: number;
  eventCheekPeak: number;
  eventLipPressPeak: number;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
};

/**
 * C6: development-only thinking-behavior diagnostics. Written to
 * `window.saraV3ThinkingBehaviorDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3ThinkingBehaviorDiagnostics = {
  enabled: boolean;
  thinkingActive: boolean;
  timeInThinkingMs: number;
  baselineTargets: Record<string, number>;
  currentEventType: SaraV3ThinkingEventType;
  eventPhase: SaraV3ThinkingEventPhase;
  eventMagnitude: number;
  nextEventAtMs: number;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  /** Declarative gaze request for C8; no gaze morph is written by C6. */
  gazeIntent: SaraV3GazeIntent;
  /** True while the TEMP current-asset compensation values are in use. */
  tempAssetCompensation: boolean;
};

// ── C7: speaking body-language behavior layer ───────────────────────────────
/** Discrete speaking emphasis pulse currently in flight. */
export type SaraV3SpeakingEventType = "none" | "emphasis";
/** Envelope phase of the current speaking emphasis pulse. */
export type SaraV3SpeakingEventPhase = "inactive" | "fadeIn" | "hold" | "fadeOut";

/**
 * C7: lifecycle + chunk-trigger state owned by the speaking behavior coordinator.
 * Pure metadata — the coordinator never writes morphs; it routes a stable
 * speaking baseline into C2's stateExpression override and occasional
 * phrase/sentence emphasis pulses into the scheduledMicro slot. Emphasis is
 * triggered at sentence/chunk boundaries (a new AvatarPhonemeTimeline object
 * reference), never per phoneme.
 */
export type SaraV3SpeakingBehaviorState = {
  /** Whether speaking was active on the previous frame (entry/exit edge). */
  wasSpeaking: boolean;
  /** Frame-clock timestamp (ms) speaking was last entered, or null. */
  enteredAtMs: number | null;
  /** Milliseconds spent in the current speaking stretch (0 when not speaking). */
  timeInSpeakingMs: number;
  /**
   * Stable identity of the sentence/chunk last evaluated — the timeline object
   * reference. A null timeline while still speaking is a transient gap (held),
   * not a reset.
   */
  chunkIdentity: unknown;
  /** When the current emphasis pulse started, or null when none is active. */
  eventStartedAtMs: number | null;
  eventType: SaraV3SpeakingEventType;
  eventFadeInMs: number;
  eventHoldMs: number;
  eventFadeOutMs: number;
  /**
   * Peak magnitudes sampled once at the start of the current pulse, each in
   * [70%, 100%] of its configured peak, and held for the whole envelope. The
   * smile peak already bakes in the C3-direction scaling seen at event start.
   */
  eventEyebrowPeak: number;
  eventCheekPeak: number;
  eventEyeSquintPeak: number;
  eventSmilePeak: number;
  /** Last chunk-eligibility roll and its outcome (diagnostics only). */
  lastChanceRoll: number;
  lastChanceTriggered: boolean;
  /** Last routed baseline / emphasis target maps. */
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
};

/**
 * C7: development-only speaking-behavior diagnostics. Written to
 * `window.saraV3SpeakingBehaviorDiagnostics` under `import.meta.env.DEV` only.
 */
export type SaraV3SpeakingBehaviorDiagnostics = {
  enabled: boolean;
  speakingActive: boolean;
  timeInSpeakingMs: number;
  chunkIdentity: string | null;
  baselineTargets: Record<string, number>;
  currentEventType: SaraV3SpeakingEventType;
  eventPhase: SaraV3SpeakingEventPhase;
  eventMagnitude: number;
  /** Last chunk-boundary eligibility roll and whether it started a pulse. */
  lastChanceRoll: number;
  lastChanceTriggered: boolean;
  /** Sentiment direction seen from C3 this frame (drives smile suppression). */
  sentimentDirection: SaraV3SentimentDirection;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  /** Declarative gaze request for C8; no gaze morph is written by C7. */
  gazeIntent: SaraV3GazeIntent;
  /** True while the TEMP current-asset compensation values are in use. */
  tempAssetCompensation: boolean;
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
  activePhonemeWeight: number;
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
  // ── C4: exposed so the idle coordinator can read event phase/strength and
  // detect idle (re)entry without recomputing. `smileAdditiveTargets` stays the
  // authoritative combined output; the two split maps below always sum to it.
  /** Presence mode seen on the previous frame (for idle-entry detection). */
  lastActivePresenceState: SaraV3RuntimeMode | null;
  /** Current micro-smile envelope phase. */
  smilePhase: "idle" | "fadeIn" | "hold" | "fadeOut";
  /** Current micro-smile envelope strength (0..1). */
  smileStrength: number;
  /** Current idle brow-event envelope strength (0..1). */
  browEventStrength: number;
  /** Continuous idle "breathing" portion of the additive output (idle only). */
  breathingTargets: Record<string, number>;
  /** Discrete smile/brow event portion of the additive output. */
  eventTargets: Record<string, number>;
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
