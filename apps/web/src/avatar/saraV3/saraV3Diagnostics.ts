import type { SaraV3BehaviorDiagnostics } from "./saraV3BehaviorTypes";
import type {
  SaraV3AttentionRefreshDiagnostics,
  SaraV3EmotionCoordinatorDiagnostics,
  SaraV3GazeDiagnostics,
  SaraV3IdleBehaviorDiagnostics,
  SaraV3ListeningBehaviorDiagnostics,
  SaraV3SentimentDiagnostics,
  SaraV3SpeakingBehaviorDiagnostics,
  SaraV3ThinkingBehaviorDiagnostics,
  SaraV3TransitionDiagnostics,
} from "./saraV3Types";
import type {
  SaraV3Diagnostics,
  SaraV3HairDiagnostics,
  SaraV3EyeDiagnostics,
  SaraV3ExpressionDiagnostics,
  SaraV3LipSyncDiagnostics,
  SaraV3WelcomeLipSyncDiagnostics,
  SaraV3WelcomePlaybackAudit,
  SaraV3MeshMaterialDiagnostics,
  SaraV3HairPartDiagnostics,
  SaraV3RawAudit,
  SaraV3RenderAudit,
  SaraV3SmileDiagnostics,
} from "./saraV3Types";

declare global {
  interface Window {
    saraV3Diagnostics?: SaraV3Diagnostics;
    saraV3HairDiagnostics?: SaraV3HairDiagnostics;
    saraV3HairPartDiagnostics?: SaraV3HairPartDiagnostics;
    saraV3MeshMaterialDiagnostics?: SaraV3MeshMaterialDiagnostics;
    saraV3LipSyncDiagnostics?: SaraV3LipSyncDiagnostics;
    saraV3WelcomeLipSyncDiagnostics?: SaraV3WelcomeLipSyncDiagnostics;
    saraV3WelcomePlaybackAudit?: SaraV3WelcomePlaybackAudit;
    saraV3EyeDiagnostics?: SaraV3EyeDiagnostics;
    saraV3ExpressionDiagnostics?: SaraV3ExpressionDiagnostics;
    saraV3SmileDiagnostics?: SaraV3SmileDiagnostics;
    saraV3BehaviorDiagnostics?: SaraV3BehaviorDiagnostics;
    saraV3IdleBehaviorDiagnostics?: SaraV3IdleBehaviorDiagnostics;
    saraV3AttentionRefreshDiagnostics?: SaraV3AttentionRefreshDiagnostics;
    saraV3ListeningBehaviorDiagnostics?: SaraV3ListeningBehaviorDiagnostics;
    saraV3ThinkingBehaviorDiagnostics?: SaraV3ThinkingBehaviorDiagnostics;
    saraV3SpeakingBehaviorDiagnostics?: SaraV3SpeakingBehaviorDiagnostics;
    saraV3GazeDiagnostics?: SaraV3GazeDiagnostics;
    saraV3EmotionCoordinatorDiagnostics?: SaraV3EmotionCoordinatorDiagnostics;
    saraV3TransitionDiagnostics?: SaraV3TransitionDiagnostics;
    saraV3SentimentDiagnostics?: SaraV3SentimentDiagnostics;
    saraV3RawAudit?: SaraV3RawAudit;
    saraV3RenderAudit?: SaraV3RenderAudit;
    saraV3EnvironmentDiagnostics?: Record<string, unknown>;
    saraV3ViewDiagnostics?: Record<string, unknown>;
    saraV3RenderAuditTools?: {
      setExposure: (value: number) => unknown;
      resetExposure: () => unknown;
      runExposureSweep: () => unknown;
    };
  }
}

export function writeSaraV3Diagnostics(update: Partial<SaraV3Diagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3Diagnostics = {
    saraV3Loaded: false,
    modelUrl: "",
    rootName: null,
    meshCount: 0,
    skinnedMeshCount: 0,
    hairMeshCandidates: [],
    bodyMeshCandidates: [],
    morphTargetNames: [],
    hasJawOpen: false,
    hasVisemeAA: false,
    hasEyeBlinkLeft: false,
    hasEyeBlinkRight: false,
    missingRequiredMorphs: [],
    ...(window.saraV3Diagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3HairDiagnostics(update: Partial<SaraV3HairDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3HairDiagnostics = {
    hairFixApplied: false,
    hairMeshNames: [],
    hairMaterialNames: [],
    targetedMeshes: [],
    targetedMaterials: [],
    alphaTest: 0.35,
    depthWrite: false,
    depthTest: true,
    side: "DoubleSide",
    frontHairSide: "FrontSide",
    backHairSide: "DoubleSide",
    renderOrderApplied: false,
    renderOrder: 10,
    backHairRestored: false,
    frontHairPreserved: false,
    testedAlphaValues: [0.25, 0.35, 0.45],
    ...(window.saraV3HairDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3HairPartDiagnostics(update: Partial<SaraV3HairPartDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3HairPartDiagnostics = {
    face4Role: "unverified",
    face9Role: "unverified",
    testedSettings: [],
    recommendedBackHairTarget: null,
    frontHairPreserved: false,
    ...(window.saraV3HairPartDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3MeshMaterialDiagnostics(
  update: Partial<SaraV3MeshMaterialDiagnostics>
) {
  if (typeof window === "undefined") return;
  window.saraV3MeshMaterialDiagnostics = {
    meshes: [],
    ...(window.saraV3MeshMaterialDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3LipSyncDiagnostics(update: Partial<SaraV3LipSyncDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3LipSyncDiagnostics = {
    isSpeaking: false,
    audioCurrentTime: 0,
    audioStartedAt: null,
    audioDuration: null,
    originalFirstTimelineStart: null,
    rebasedFirstTimelineStart: null,
    timelineRebasedToZero: false,
    timelineUnitConverted: false,
    timelineLength: 0,
    firstTimelineItem: null,
    lastTimelineItem: null,
    activePhoneme: null,
    activeViseme: null,
    activePhonemeStart: null,
    activePhonemeEnd: null,
    lookupTime: 0,
    effectiveLookupTime: 0,
    previousLookupTime: null,
    lookAheadSeconds: 0,
    timingOffsetSeconds: 0,
    normalizedTimeline: false,
    timelineStartsAtZero: false,
    timelineDuration: 0,
    appliedMorphs: {},
    jawOpenValue: 0,
    possibleTimingIssue: null,
    ...(window.saraV3LipSyncDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3WelcomeLipSyncDiagnostics(
  update: Partial<SaraV3WelcomeLipSyncDiagnostics>
) {
  if (typeof window === "undefined") return;
  window.saraV3WelcomeLipSyncDiagnostics = {
    welcomeAudioPlaying: false,
    welcomeAudioCurrentTime: 0,
    welcomeAudioDuration: null,
    welcomeHasAvatarData: false,
    welcomeTimelineLength: 0,
    welcomeTimelineFirstItem: null,
    welcomeTimelineLastItem: null,
    saraV3TimelineLength: 0,
    saraV3IsSpeaking: false,
    saraV3ActivePhoneme: null,
    saraV3ActiveViseme: null,
    saraV3AppliedMorphs: {},
    reasonLipsNotMoving: null,
    ...(window.saraV3WelcomeLipSyncDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3WelcomePlaybackAudit(
  update: Partial<SaraV3WelcomePlaybackAudit>
) {
  if (typeof window === "undefined") return;
  window.saraV3WelcomePlaybackAudit = {
    welcomeTriggered: false,
    audioElementCreated: false,
    playCalled: false,
    playResolved: false,
    playRejected: false,
    playRejectReason: null,
    audioSrcExists: false,
    audioPaused: null,
    audioEnded: false,
    currentTime: 0,
    duration: null,
    usingSameAudioClockAsSaraV3: false,
    diagnosticsCheckedAfterEnded: false,
    selectedRuntime: null,
    reason: null,
    lastWelcomePlaybackSummary: null,
    ...(window.saraV3WelcomePlaybackAudit ?? {}),
    ...update,
  };
}

export function writeSaraV3ExpressionDiagnostics(update: Partial<SaraV3ExpressionDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3ExpressionDiagnostics = {
    activePresenceState: "idle",
    baseExpressionTargets: {},
    scheduledSmileTargets: {},
    coordinatedBlinkSupport: {},
    finalAppliedExpressionMorphs: {},
    suppressedLipSyncConflicts: [],
    ...(window.saraV3ExpressionDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3EyeDiagnostics(update: Partial<SaraV3EyeDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3EyeDiagnostics = {
    nextBlinkAtMs: 0,
    blinkActive: false,
    blinkValue: 0,
    blinkPhase: "idle",
    blinkProgress: 0,
    leftBlinkTarget: 0,
    rightBlinkTarget: 0,
    eyebrowBlinkSupport: 0,
    cheekBlinkSupport: 0,
    nextBlinkDelayMs: 0,
    appliedEyeMorphs: {},
    coordinatedMorphs: {},
    ...(window.saraV3EyeDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3SmileDiagnostics(update: Partial<SaraV3SmileDiagnostics>) {
  if (typeof window === "undefined") return;
  window.saraV3SmileDiagnostics = {
    nextSmileAtMs: 0,
    smileActive: false,
    smilePhase: "idle",
    smileProgress: 0,
    smileAdditiveTargets: {},
    blockedByBlink: false,
    lastCollisionAvoidedAtMs: null,
    ...(window.saraV3SmileDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C1: development-only behavior-engine diagnostics. Gated on `import.meta.env.DEV`
 * so production builds neither run nor ship this write — keeping the rollback
 * (engine-disabled) path byte-for-byte equivalent to today in production.
 */
export function writeSaraV3BehaviorDiagnostics(update: Partial<SaraV3BehaviorDiagnostics>) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3BehaviorDiagnostics = {
    activePath: "legacyPresence",
    currentState: "idle",
    previousState: null,
    enteredAt: 0,
    stateElapsed: 0,
    transitionReason: null,
    interrupted: false,
    effectiveMode: "idle",
    ...(window.saraV3BehaviorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C4: development-only idle-behavior diagnostics. Gated on `import.meta.env.DEV`
 * so production neither runs nor ships this write — the idle personality layer
 * emits no production logs.
 */
export function writeSaraV3IdleBehaviorDiagnostics(
  update: Partial<SaraV3IdleBehaviorDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3IdleBehaviorDiagnostics = {
    enabled: false,
    idleActive: false,
    timeInIdleMs: 0,
    breathingPhase: 0,
    breathingValue: 0,
    currentEventType: "none",
    eventPhase: "inactive",
    eventMagnitude: 0,
    nextSmileAtMs: 0,
    nextBrowAtMs: 0,
    gazeActive: false,
    gazeValue: 0,
    idleBaselineTargets: {},
    scheduledMicroTargets: {},
    ...(window.saraV3IdleBehaviorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * EXPERIMENT: development-only Attention Refresh diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write.
 */
export function writeSaraV3AttentionRefreshDiagnostics(
  update: Partial<SaraV3AttentionRefreshDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3AttentionRefreshDiagnostics = {
    enabled: false,
    idleActive: false,
    eventActive: false,
    combination: "none",
    elapsedMs: 0,
    eventDurationMs: 0,
    nextEventAtMs: 0,
    blinkTriggered: false,
    browValue: 0,
    cheekValue: 0,
    eyeRefocusOffset: 0,
    scheduledMicroTargets: {},
    tempAssetCompensation: false,
    ...(window.saraV3AttentionRefreshDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C5: development-only listening-behavior diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * listening personality layer emits no production logs.
 */
export function writeSaraV3ListeningBehaviorDiagnostics(
  update: Partial<SaraV3ListeningBehaviorDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3ListeningBehaviorDiagnostics = {
    enabled: false,
    listeningActive: false,
    timeInListeningMs: 0,
    baselineTargets: {},
    currentEventType: "none",
    eventPhase: "inactive",
    eventMagnitude: 0,
    nextEventAtMs: 0,
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
    tempAssetCompensation: false,
    ...(window.saraV3ListeningBehaviorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C6: development-only thinking-behavior diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * thinking personality layer emits no production logs.
 */
export function writeSaraV3ThinkingBehaviorDiagnostics(
  update: Partial<SaraV3ThinkingBehaviorDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3ThinkingBehaviorDiagnostics = {
    enabled: false,
    thinkingActive: false,
    timeInThinkingMs: 0,
    baselineTargets: {},
    currentEventType: "none",
    eventPhase: "inactive",
    eventMagnitude: 0,
    nextEventAtMs: 0,
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
    gazeIntent: { active: false, direction: "none", strength: 0 },
    tempAssetCompensation: false,
    ...(window.saraV3ThinkingBehaviorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C7: development-only speaking-behavior diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * speaking body-language layer emits no production logs.
 */
export function writeSaraV3SpeakingBehaviorDiagnostics(
  update: Partial<SaraV3SpeakingBehaviorDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3SpeakingBehaviorDiagnostics = {
    enabled: false,
    speakingActive: false,
    timeInSpeakingMs: 0,
    chunkIdentity: null,
    baselineTargets: {},
    currentEventType: "none",
    eventPhase: "inactive",
    eventMagnitude: 0,
    lastChanceRoll: 0,
    lastChanceTriggered: false,
    sentimentDirection: "neutral",
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
    gazeIntent: { active: false, direction: "none", strength: 0 },
    tempAssetCompensation: false,
    ...(window.saraV3SpeakingBehaviorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C8: development-only gaze-controller diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * gaze controller emits no production logs.
 */
export function writeSaraV3GazeDiagnostics(update: Partial<SaraV3GazeDiagnostics>) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3GazeDiagnostics = {
    enabled: false,
    gazeActive: false,
    behaviorState: "idle",
    gazeMode: "idle",
    sourceIntent: "none",
    targetDirection: { horizontal: 0, vertical: 0 },
    eyeLookValues: {},
    eyeballValues: {},
    eventPhase: "inactive",
    eventStartedAtMs: null,
    eventEndsAtMs: null,
    nextEventAtMs: 0,
    clampApplied: false,
    tempAssetCompensation: false,
    ...(window.saraV3GazeDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C10: development-only emotion-coordinator diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * coordinator emits no production logs.
 */
export function writeSaraV3EmotionCoordinatorDiagnostics(
  update: Partial<SaraV3EmotionCoordinatorDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3EmotionCoordinatorDiagnostics = {
    enabled: false,
    currentState: "idle",
    activePersonality: "idle",
    emotionDirection: "neutral",
    emotionIntensity: 0,
    positiveWeight: 0,
    concernWeight: 0,
    scales: {},
    suppressedChannels: [],
    attenuatedChannels: [],
    boostedChannels: [],
    tempAssetCompensation: false,
    ...(window.saraV3EmotionCoordinatorDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C11: development-only transition-engine diagnostics. Gated on
 * `import.meta.env.DEV` so production neither runs nor ships this write — the
 * transition engine emits no production logs.
 */
export function writeSaraV3TransitionDiagnostics(
  update: Partial<SaraV3TransitionDiagnostics>
) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3TransitionDiagnostics = {
    enabled: false,
    transitionActive: false,
    fromState: null,
    toState: null,
    startedAtMs: 0,
    durationMs: 0,
    rawProgress: 0,
    easedProgress: 0,
    transitionReason: "none",
    replacementCount: 0,
    baselineCrossfadeActive: false,
    gazeTransitionMetadataActive: false,
    interruptionSource: "unavailable",
    ...(window.saraV3TransitionDiagnostics ?? {}),
    ...update,
  };
}

/**
 * C3: development-only sentiment-gate diagnostics. Gated on `import.meta.env.DEV`
 * so production neither runs nor ships this write.
 */
export function writeSaraV3SentimentDiagnostics(update: Partial<SaraV3SentimentDiagnostics>) {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  window.saraV3SentimentDiagnostics = {
    enabled: false,
    isSpeaking: false,
    rawCompound: null,
    clampedCompound: null,
    label: "",
    direction: "neutral",
    normalizedMagnitude: 0,
    labelNudge: 0,
    finalMagnitude: 0,
    sentenceIdentity: null,
    emotionOverlayTargets: {},
    neutralReason: null,
    ...(window.saraV3SentimentDiagnostics ?? {}),
    ...update,
  };
}

export function writeSaraV3RawAudit(update: Partial<SaraV3RawAudit>) {
  if (typeof window === "undefined") return;
  window.saraV3RawAudit = {
    rawRenderAuditMode: false,
    cameraAppliedInRawAudit: false,
    cameraConfigSource: null,
    modelUrl: "",
    sceneObject: null,
    sceneName: null,
    childCount: 0,
    meshCount: 0,
    skinnedMeshCount: 0,
    meshNames: [],
    materialNames: [],
    materialTypes: [],
    morphTargetNamesByMesh: {},
    totalMorphTargetCount: 0,
    boundingBox: null,
    boundingBoxSize: null,
    boundingBoxCenter: null,
    rootPosition: [0, 0, 0],
    rootRotation: [0, 0, 0],
    rootScale: [1, 1, 1],
    cameraPosition: [0, 0, 0],
    cameraLookAt: null,
    cameraFov: null,
    cameraNear: null,
    cameraFar: null,
    cameraRotation: [0, 0, 0],
    rendererOutputColorSpace: null,
    rendererToneMapping: null,
    rendererExposure: null,
    environmentExists: false,
    lightsSummary: [],
    ...(window.saraV3RawAudit ?? {}),
    ...update,
  };
}

export function writeSaraV3RenderAudit(update: Partial<SaraV3RenderAudit>) {
  if (typeof window === "undefined") return;
  window.saraV3RenderAudit = {
    rendererSettings: {
      outputColorSpace: null,
      toneMapping: null,
      toneMappingExposure: null,
      physicallyCorrectLights: null,
    },
    environmentAudit: {
      sceneEnvironmentType: null,
      sceneBackgroundType: null,
      environmentAssignedToScene: false,
      backgroundAssignedToScene: false,
      pmremGeneratorUsed: false,
      hdriUsed: false,
      environmentIntensity: null,
    },
    materialAudit: [],
    hairMaterialAudit: [],
    faceMaterialAudit: [],
    eyeMaterialAudit: [],
    clothingMaterialAudit: [],
    textureAudit: [],
    exposureSweepPlan: {
      currentExposure: null,
      plannedValues: [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5],
      automationAvailable: false,
    },
    ...(window.saraV3RenderAudit ?? {}),
    ...update,
  };
}
