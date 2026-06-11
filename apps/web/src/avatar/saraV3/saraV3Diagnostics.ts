import type { SaraV3Diagnostics, SaraV3RawAudit, SaraV3RenderAudit } from "./saraV3Types";

declare global {
  interface Window {
    saraV3Diagnostics?: SaraV3Diagnostics;
    saraV3RawAudit?: SaraV3RawAudit;
    saraV3RenderAudit?: SaraV3RenderAudit;
    saraV3EnvironmentDiagnostics?: Record<string, unknown>;
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
    faceMeshCandidates: [],
    selectedFaceMesh: null,
    groupedFaceMeshBindingActive: false,
    groupedFaceMeshNames: [],
    groupedFaceMeshCount: 0,
    groupedMorphNames: [],
    groupedMissingMorphsByMesh: {},
    morphWriteMode: "selectedFaceMeshFallback",
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
