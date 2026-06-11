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
