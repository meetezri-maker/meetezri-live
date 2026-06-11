import {
  memo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from "react";
import { Loader2 } from "lucide-react";
import {
  DEBUG_JORDAN_EXPRESSION_TEST,
  DEBUG_JORDAN_BEHAVIOR_TIMING,
  DEBUG_JORDAN_LISTENING_MORPH_TEST,
  DEBUG_JORDAN_PHONEMES,
  DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
  DEBUG_JORDAN_TEST_MORPH,
  DEBUG_JORDAN_TEST_VALUE,
  JORDAN_EYE_INTELLIGENCE_TUNING,
  JORDAN_EYE_FOCUS_TUNING,
  JORDAN_EXPRESSION_AUTHORITY_MORPHS,
  JORDAN_EXPRESSION_CAPS,
  JORDAN_EXPRESSION_PRESETS,
  JORDAN_EXPRESSION_PRESET_TUNING,
  JORDAN_EMOTIONAL_MODULATION_TUNING,
  JORDAN_FINAL_HUMANIZATION_TUNING,
  JORDAN_HEAD_PRESENCE_TUNING,
  JORDAN_HEAD_OFFSET_X,
  JORDAN_HEAD_OFFSET_Y,
  JORDAN_IDLE_BROW_TUNING,
  JORDAN_LISTENING_FACE_TUNING,
  JORDAN_MORPH_NAME_SET,
  JORDAN_MORPH_NAMES,
  JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE,
  JORDAN_RFV2_BLINK_TUNING,
  JORDAN_RFV2_FACE_TUNING,
  JORDAN_RFV2_IDLE_TUNING,
  JORDAN_RFV2_LISTENING_MORPH_TEST_SEQUENCE,
  JORDAN_RFV2_MORPH_AUDIT_NAMES,
  JORDAN_RFV2_REQUIRED_DRIVER_MORPHS,
  JORDAN_SPEAKING_BEHAVIOR_TUNING,
  type JordanMorphName,
} from "@/lib/avatar/jordanRfv2Config";
import {
  createJordanBehaviorTimingState,
  updateJordanBehaviorTimingScheduler,
  type JordanBehaviorTimingEvent,
  type JordanBehaviorTimingState,
} from "@/lib/avatar/jordanBehaviorTimingScheduler";
import {
  findActiveJordanPhoneme,
  findActiveSaraPhoneme,
  hasInvalidJordanPhonemeTimestamps,
  normalizeAvatarPhonemeTimeline,
  normalizeMorphName,
  normalizePhonemeLabelForDebug,
} from "@/lib/avatar/phonemeToViseme";
import {
  getJordanBlinkMode,
  getSentimentLabel,
  isJordanBlinkMorph,
  isLikelyJordanMainFaceMesh,
  isPositiveSentiment,
  isRfv2BlinkMorphName,
  isRfv2ExpressionMorphName,
  isRfv2VisemeMorphName,
  isSadSentiment,
  jordanJawSupportForViseme,
} from "@/lib/avatar/avatarExpressionUtils";
import type {
  AvatarPhonemeTimeline,
  AvatarRenderMode,
  MorphBinding,
} from "@/lib/avatar/avatarMorphTypes";
import type {
  AvatarCameraConfig,
  AvatarGltfTransformConfig,
  Vector3Object,
  Vector3Config,
} from "@/lib/avatar/avatarConfigTypes";
import type { CompanionViewTuning } from "@/lib/avatar/companionViewTuning";
import { SARA_V2_AVATAR_DEFINITION } from "@/lib/avatar/configs/saraV2Config";
import { prepareSaraV2Scene } from "@/lib/avatar/saraV2Runtime";
import {
  createSaraV2PresenceState,
  isSaraV2PresenceMorph,
  updateSaraV2Presence,
  type SaraV2PresenceMode,
  type SaraV2PresenceState,
} from "@/lib/avatar/saraV2PresenceRuntime";
import { SARA_RFV2_BINDING_PROFILE } from "@/lib/avatar/saraRfv2BindingProfile";
import {
  bindSaraRfv2FaceMorphTargets,
  applySaraRfv2MorphTargets,
  createSaraRfv2MorphApplierState,
  SARA_RFV2_MORPH_APPLIER_EMPTY_DIAGNOSTICS,
  type SaraRfv2FaceMorphBinding,
  type SaraRfv2MorphApplierDiagnostics,
  type SaraRfv2MorphApplierState,
} from "@/lib/avatar/saraRfv2MorphApplier";
import {
  computeSaraRfv2VisemeTargets,
  createSaraRfv2PhonemeState,
  resolveSaraRfv2ActivePhoneme,
  type SaraRfv2PhonemeState,
} from "@/lib/avatar/saraRfv2PhonemeDriver";
import {
  createSaraRfv2SmoothingState,
  smoothSaraRfv2Targets,
  type SaraRfv2SmoothingState,
} from "@/lib/avatar/saraRfv2SmoothingLayer";
import {
  SARA_V3_AVATAR_DEFINITION,
  applySaraV3Environment,
  captureSaraV3EnvironmentComparison,
  createSaraV3EyeRuntimeState,
  createSaraV3ExpressionState,
  createSaraV3ModelController,
  createSaraV3PresenceState,
  createSaraV3SmileRuntimeState,
  createSaraV3VisemeDriverState,
  runSaraV3RawRenderAudit,
  updateSaraV3EyeRuntime,
  updateSaraV3ExpressionRuntime,
  updateSaraV3PresenceRuntime,
  updateSaraV3SmileRuntime,
  updateSaraV3VisemeDriver,
  type SaraV3ControllerState,
  type SaraV3EyeRuntimeState,
  type SaraV3ExpressionState,
  type SaraV3PresenceState,
  type SaraV3SmileRuntimeState,
  type SaraV3VisemeDriverState,
} from "@/avatar/saraV3";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSpeechOpennessAt } from "../utils/speech";

export type FixedAvatarViewportConfig = {
  avatarId: string;
  debugLabel: string;
  camera: AvatarCameraConfig;
  gltfTransform: AvatarGltfTransformConfig;
};

const DEBUG_SARA_FRAMING = false;
const SARA_RFV2_BINDING_RETRY_LIMIT = 45;
const SARA_RFV2_PREVIEW_CAMERA_FRAMES = {
  upperBody: {
    label: "RFv2 Frame Upper Body",
    position: [0, 1.45, 4.7],
    lookAt: [0, 1.25, 0],
  },
  face: {
    label: "RFv2 Frame Face",
    position: [0, 1.5, 4.9],
    lookAt: [0, 1.28, 0],
  },
} as const;
const SARA_RFV2_PREVIEW_DEFAULT_CAMERA_FRAME =
  SARA_RFV2_PREVIEW_CAMERA_FRAMES.upperBody;
const SARA_VISUAL_ANCHOR_MESH_NAMES = new Set([
  "Face",
  "Character",
  "Character.002",
]);
const SARA_V2_PRESENCE_FACE_MESH_NAMES = new Set([
  "Face_1",
  "Face_2",
  "Face_3",
  "Face_4",
]);
const SARA_V2_BLINK_TEST_VALUES = [0.25, 0.5, 0.75, 1] as const;
const SARA_V2_BLINK_TEST_MORPHS = new Set([
  "eyeBlinkLeft",
  "eyeBlinkRight",
]);
const SARA_V2_EYE_LOOK_MORPHS = new Set([
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
]);
const SARA_HYBRID_AVATAR_IDS = new Set(["sara", "sarah"]);
const SARA_OVERSIZED_SHELL_MESH_NAMES = new Set([
  "model_19",
  "model_19.001",
  "Object_2",
  "Object_0",
]);

type SaraV2BlinkTestState = {
  left: number | null;
  right: number | null;
  lastCommand: string | null;
  updatedAtMs: number | null;
};

type SaraV2RecentActivePhonemeDiagnostic = {
  time: number;
  audioCurrentTime: number;
  speechTime: number;
  phoneme: string | null;
  viseme: string | null;
};

function clampSaraV2BlinkTestValue(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return THREE.MathUtils.clamp(numericValue, 0, 1);
}

function getSaraHybridPresenceDisabledReason(args: {
  isSaraAvatar: boolean;
  isLegacyHybrid: boolean;
  isSaraHybrid: boolean;
  isRfv2Preview: boolean;
  isRfv2MorphMode: boolean;
  modelMatchesSaraHybrid: boolean;
}): string {
  if (args.isSaraHybrid) return "Sara Hybrid presence active.";
  if (!args.isSaraAvatar) return "Presence disabled: active avatar is not Sara.";
  if (args.isRfv2Preview) return "Presence disabled: Sara RFv2 Preview is active.";
  if (args.isRfv2MorphMode) return "Presence disabled: RFv2 morph mode is active.";
  if (!args.isLegacyHybrid) return "Presence disabled: avatar mode is not legacyHybrid.";
  if (!args.modelMatchesSaraHybrid) {
    return "Presence disabled: model is not the Sara Hybrid live model.";
  }
  return "Presence disabled: Sara Hybrid viewport gate did not match.";
}

function isSaraFixedViewportConfig(
  config: FixedAvatarViewportConfig | null | undefined
): config is FixedAvatarViewportConfig {
  return config?.avatarId === "sara";
}

function isVector3Object(value: Vector3Config): value is Vector3Object {
  return !Array.isArray(value) && "x" in value && "y" in value && "z" in value;
}

function vector3FromConfig(
  value: Vector3Config | undefined,
  fallback: readonly [number, number, number]
): THREE.Vector3 {
  if (value && isVector3Object(value)) {
    return new THREE.Vector3(value.x, value.y, value.z);
  }
  if (value) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function applyVector3Config(
  target: THREE.Vector3 | THREE.Euler,
  value: Vector3Config | undefined,
  fallback: readonly [number, number, number]
) {
  const next = vector3FromConfig(value, fallback);
  target.set(next.x, next.y, next.z);
}

function applyScaleConfig(
  target: THREE.Object3D,
  value: AvatarGltfTransformConfig["scale"],
  fallbackScalar: number
) {
  if (typeof value === "number") {
    target.scale.setScalar(value);
    return;
  }
  applyVector3Config(target.scale, value, [
    fallbackScalar,
    fallbackScalar,
    fallbackScalar,
  ]);
}

function isSaraVisualAnchorMesh(child: THREE.Object3D): boolean {
  const mesh = child as THREE.Mesh;
  return SARA_VISUAL_ANCHOR_MESH_NAMES.has(child.name || "") ||
    SARA_VISUAL_ANCHOR_MESH_NAMES.has(mesh.geometry?.name || "");
}

function isSaraV2PresenceFaceMesh(child: THREE.Object3D): boolean {
  const mesh = child as THREE.Mesh;
  return (
    SARA_V2_PRESENCE_FACE_MESH_NAMES.has(child.name || "") ||
    SARA_V2_PRESENCE_FACE_MESH_NAMES.has(mesh.geometry?.name || "")
  );
}

function isSaraOversizedShellMesh(child: THREE.Object3D): boolean {
  const mesh = child as THREE.Mesh;
  return SARA_OVERSIZED_SHELL_MESH_NAMES.has(child.name || "") ||
    SARA_OVERSIZED_SHELL_MESH_NAMES.has(mesh.geometry?.name || "");
}

function meshDiagnosticCategory(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("face")) return "face";
  if (normalized.includes("body")) return "body";
  if (normalized.includes("top")) return "top";
  if (normalized.includes("bottom")) return "bottom";
  if (normalized.includes("footwear") || normalized.includes("shoe")) return "footwear";
  if (normalized.includes("hair")) return "hair";
  if (normalized.includes("eye")) return "eyes";
  if (normalized.includes("teeth") || normalized.includes("tooth")) return "teeth";
  if (normalized.includes("tongue")) return "tongue";
  if (normalized.includes("head")) return "head";
  if (normalized.includes("skin")) return "skin";
  return null;
}

type SaraObjectBoundsDiagnostic = {
  name: string;
  type: string;
  parentName: string;
  visible: boolean;
  isMesh: boolean;
  isSkinnedMesh: boolean;
  isBone: boolean;
  isRenderableMesh: boolean;
  childCount: number;
  worldPosition?: number[];
  worldScale?: number[];
  localBoundingBox?: {
    min: number[];
    max: number[];
  };
  min: number[];
  max: number[];
  center: number[];
  size: number[];
  maxDimension: number;
  volume: number;
  nonZero: boolean;
};

function serializableBox(box: THREE.Box3) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    min: box.min.toArray(),
    max: box.max.toArray(),
    center: center.toArray(),
    size: size.toArray(),
  };
}

function computeSaraVisibleRenderMeshBounds(root: THREE.Object3D): {
  box: THREE.Box3;
  meshCount: number;
  meshNames: string[];
  meshBounds: SaraObjectBoundsDiagnostic[];
} {
  const visibleBox = new THREE.Box3();
  let hasBounds = false;
  const meshNames: string[] = [];
  const meshBounds: SaraObjectBoundsDiagnostic[] = [];

  root.traverse((child) => {
    const isMesh = Boolean((child as THREE.Mesh).isMesh);
    const isSkinnedMesh = Boolean((child as THREE.SkinnedMesh).isSkinnedMesh);
    if (!child.visible || (!isMesh && !isSkinnedMesh)) return;

    const mesh = child as THREE.Mesh | THREE.SkinnedMesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const positionAttribute = geometry?.attributes?.position;
    if (!geometry || !positionAttribute) return;

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }

    child.updateWorldMatrix(true, false);
    const childBox = new THREE.Box3().expandByObject(child);
    if (childBox.isEmpty()) return;

    const size = childBox.getSize(new THREE.Vector3());
    const center = childBox.getCenter(new THREE.Vector3());
    const worldPosition = child.getWorldPosition(new THREE.Vector3());
    const worldScale = child.getWorldScale(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const volume = size.x * size.y * size.z;
    const localBoundingBox = geometry.boundingBox
      ? {
          min: geometry.boundingBox.min.toArray(),
          max: geometry.boundingBox.max.toArray(),
        }
      : undefined;
    meshNames.push(child.name || "(unnamed mesh)");
    meshBounds.push({
      name: child.name || "(unnamed mesh)",
      type: child.type,
      parentName: child.parent?.name || "(no parent)",
      visible: child.visible,
      isMesh,
      isSkinnedMesh,
      isBone: Boolean((child as THREE.Bone).isBone),
      isRenderableMesh: true,
      childCount: child.children.length,
      worldPosition: worldPosition.toArray(),
      worldScale: worldScale.toArray(),
      localBoundingBox,
      min: childBox.min.toArray(),
      max: childBox.max.toArray(),
      center: center.toArray(),
      size: size.toArray(),
      maxDimension,
      volume,
      nonZero: size.x > 0 && size.y > 0 && size.z > 0,
    });

    if (!hasBounds) {
      visibleBox.copy(childBox);
      hasBounds = true;
    } else {
      visibleBox.union(childBox);
    }
  });

  return { box: visibleBox, meshCount: meshNames.length, meshNames, meshBounds };
}

function computeSaraVisualAnchorBounds(root: THREE.Object3D): {
  box: THREE.Box3;
  meshCount: number;
  meshNames: string[];
  meshBounds: SaraObjectBoundsDiagnostic[];
} {
  const anchorBox = new THREE.Box3();
  let hasBounds = false;
  const meshNames: string[] = [];
  const meshBounds: SaraObjectBoundsDiagnostic[] = [];

  root.traverse((child) => {
    const isMesh = Boolean((child as THREE.Mesh).isMesh);
    const isSkinnedMesh = Boolean((child as THREE.SkinnedMesh).isSkinnedMesh);
    if (
      !child.visible ||
      (!isMesh && !isSkinnedMesh) ||
      !isSaraVisualAnchorMesh(child)
    ) {
      return;
    }

    const mesh = child as THREE.Mesh | THREE.SkinnedMesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const positionAttribute = geometry?.attributes?.position;
    if (!geometry || !positionAttribute) return;

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }

    child.updateWorldMatrix(true, false);
    const childBox = new THREE.Box3().expandByObject(child);
    if (childBox.isEmpty()) return;

    const size = childBox.getSize(new THREE.Vector3());
    const center = childBox.getCenter(new THREE.Vector3());
    const worldPosition = child.getWorldPosition(new THREE.Vector3());
    const worldScale = child.getWorldScale(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const volume = size.x * size.y * size.z;
    const localBoundingBox = geometry.boundingBox
      ? {
          min: geometry.boundingBox.min.toArray(),
          max: geometry.boundingBox.max.toArray(),
        }
      : undefined;
    meshNames.push(child.name || "(unnamed mesh)");
    meshBounds.push({
      name: child.name || "(unnamed mesh)",
      type: child.type,
      parentName: child.parent?.name || "(no parent)",
      visible: child.visible,
      isMesh,
      isSkinnedMesh,
      isBone: Boolean((child as THREE.Bone).isBone),
      isRenderableMesh: true,
      childCount: child.children.length,
      worldPosition: worldPosition.toArray(),
      worldScale: worldScale.toArray(),
      localBoundingBox,
      min: childBox.min.toArray(),
      max: childBox.max.toArray(),
      center: center.toArray(),
      size: size.toArray(),
      maxDimension,
      volume,
      nonZero: size.x > 0 && size.y > 0 && size.z > 0,
    });

    if (!hasBounds) {
      anchorBox.copy(childBox);
      hasBounds = true;
    } else {
      anchorBox.union(childBox);
    }
  });

  return { box: anchorBox, meshCount: meshNames.length, meshNames, meshBounds };
}

function computeSaraTopObjectBounds(
  root: THREE.Object3D,
  limit = 20
): SaraObjectBoundsDiagnostic[] {
  const diagnostics: SaraObjectBoundsDiagnostic[] = [];
  root.traverse((child) => {
    const childBox = new THREE.Box3().setFromObject(child);
    if (childBox.isEmpty()) return;
    const size = childBox.getSize(new THREE.Vector3());
    const center = childBox.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const isMesh = Boolean((child as THREE.Mesh).isMesh);
    const isSkinnedMesh = Boolean((child as THREE.SkinnedMesh).isSkinnedMesh);
    diagnostics.push({
      name: child.name || "(unnamed object)",
      type: child.type,
      parentName: child.parent?.name || "(no parent)",
      visible: child.visible,
      isMesh,
      isSkinnedMesh,
      isBone: Boolean((child as THREE.Bone).isBone),
      isRenderableMesh: isMesh || isSkinnedMesh,
      childCount: child.children.length,
      min: childBox.min.toArray(),
      max: childBox.max.toArray(),
      center: center.toArray(),
      size: size.toArray(),
      maxDimension,
      volume: size.x * size.y * size.z,
      nonZero: size.x > 0 && size.y > 0 && size.z > 0,
    });
  });
  return diagnostics
    .sort((a, b) => b.maxDimension - a.maxDimension)
    .slice(0, limit);
}

type SaraRfv2PreviewAssetDiagnostics = {
  detectedAsset: string;
  topLevelRoots: string[];
  faceRootFound: boolean;
  faceRootName: string | null;
  faceRootPath: string | null;
  faceMeshFound: boolean;
  faceMeshPath: string | null;
  faceMorphNames: string[];
  bodyRootFound: boolean;
  hairRootFound: boolean;
  hairDiagnostics: SaraRfv2HairDiagnostics;
};

type SaraTransformNodeAudit = {
  name: string;
  type: string;
  path: string;
  parentPath: string | null;
  visible: boolean;
  localPosition: number[];
  localRotation: number[];
  localScale: number[];
  worldPosition: number[];
  worldRotation: number[];
  worldScale: number[];
};

type SaraTransformHierarchySnapshot = {
  mode: "Current Hybrid" | "Sara RFv2 Preview";
  modelPath: string;
  timestamp: string;
  topLevelRoots: string[];
  avatarRoot: SaraTransformNodeAudit | null;
  faceAlignmentGroup: SaraTransformNodeAudit | null;
  faceRig: SaraTransformNodeAudit | null;
  character: SaraTransformNodeAudit | null;
  hairRoots: SaraTransformNodeAudit[];
  transformCorrections: string[];
  createsNewGroups: boolean;
  reparentedNodes: string[];
  movedNodes: string[];
  notes: string[];
};

type SaraTransformAudit = {
  currentHybrid: SaraTransformHierarchySnapshot | null;
  saraRfv2Preview: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewBeforePrepare: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewAfterPrepare: SaraTransformHierarchySnapshot | null;
  comparison: {
    currentHybridAvailable: boolean;
    saraRfv2PreviewAvailable: boolean;
    avatarRootNames: {
      currentHybrid: string | null;
      saraRfv2Preview: string | null;
    };
    faceAlignmentGroupPresent: {
      currentHybrid: boolean;
      saraRfv2Preview: boolean;
    };
    faceRigPaths: {
      currentHybrid: string | null;
      saraRfv2Preview: string | null;
    };
    characterPaths: {
      currentHybrid: string | null;
      saraRfv2Preview: string | null;
    };
    hairRootPaths: {
      currentHybrid: string[];
      saraRfv2Preview: string[];
    };
  };
  rfv2PreviewChanges: {
    createsNewGroups: boolean;
    reparentedNodes: string[];
    movedNodes: string[];
  };
  rfv2PreviewOperationClaims: {
    createsNewGroups: false;
    reparentsNodes: false;
    movesFaceRig: false;
    movesCharacter: false;
    movesHair: false;
    morphApplierReparents: false;
    morphApplierMoves: false;
    morphApplierScales: false;
    morphApplierRotates: false;
  };
};

type SaraRfv2CameraFrameDiagnostics = {
  cameraPosition: number[];
  lookAt: number[];
  boundsCenter: number[] | null;
  boundsSize: number[] | null;
  framingMode: string;
};

type SaraRfv2HairDiagnostics = {
  hairMeshCount: number;
  hairMeshNames: string[];
  hairMaterialNames: string[];
  hairVisible: Record<string, boolean>;
  hairRenderOrder: Record<string, number>;
  hairDepthWrite: Record<string, boolean | null>;
  hairAlphaTest: Record<string, number | null>;
  hairTransparent: Record<string, boolean | null>;
  hairColorValues: Record<string, string | null>;
  hasMap: Record<string, boolean>;
  hasAlphaMap: Record<string, boolean>;
  opacity: Record<string, number | null>;
  alphaTestBeforeAfter: Record<string, { before: number | null; after: number | null }>;
  transparentBeforeAfter: Record<string, { before: boolean | null; after: boolean | null }>;
  hairWorldBounds: ReturnType<typeof serializableBox> | null;
};

function createEmptySaraRfv2PreviewAssetDiagnostics(): SaraRfv2PreviewAssetDiagnostics {
  return {
    detectedAsset: "",
    topLevelRoots: [],
    faceRootFound: false,
    faceRootName: null,
    faceRootPath: null,
    faceMeshFound: false,
    faceMeshPath: null,
    faceMorphNames: [],
    bodyRootFound: false,
    hairRootFound: false,
    hairDiagnostics: {
      hairMeshCount: 0,
      hairMeshNames: [],
      hairMaterialNames: [],
      hairVisible: {},
      hairRenderOrder: {},
      hairDepthWrite: {},
      hairAlphaTest: {},
      hairTransparent: {},
      hairColorValues: {},
      hasMap: {},
      hasAlphaMap: {},
      opacity: {},
      alphaTestBeforeAfter: {},
      transparentBeforeAfter: {},
      hairWorldBounds: null,
    },
  };
}

function objectPath(object: THREE.Object3D): string {
  const parts: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    parts.unshift(current.name || current.type);
    current = current.parent;
  }
  return parts.join(" > ");
}

function normalizedSceneName(name: string): string {
  return name.trim().replace(/[._\s-]/g, "").toLowerCase();
}

function hasSaraRfv2FaceBindingProbes(
  dictionary: Record<string, number> | undefined
): boolean {
  return Boolean(
    dictionary &&
      SARA_RFV2_BINDING_PROFILE.face.requiredMorphs.every(
        (morphName) => morphName in dictionary
      )
  );
}

function isSaraRfv2PreviewFaceRoot(object: THREE.Object3D): boolean {
  return SARA_RFV2_BINDING_PROFILE.face.rootCandidates.some(
    (candidate) => normalizedSceneName(object.name || "") === normalizedSceneName(candidate)
  );
}

function isSaraRfv2PreviewFaceMesh(object: THREE.Object3D): boolean {
  const mesh = object as THREE.Mesh;
  return (
    normalizedSceneName(object.name || "") ===
      normalizedSceneName(SARA_RFV2_BINDING_PROFILE.face.meshName) &&
    (object as THREE.SkinnedMesh).isSkinnedMesh === true &&
    hasSaraRfv2FaceBindingProbes(mesh.morphTargetDictionary as Record<string, number> | undefined)
  );
}

function isSaraRfv2PreviewBodyObject(object: THREE.Object3D): boolean {
  const normalized = normalizedSceneName(object.name || "");
  return [
    ...SARA_RFV2_BINDING_PROFILE.body.rootCandidates,
    ...SARA_RFV2_BINDING_PROFILE.body.forbiddenMeshNames,
  ].some((candidate) => normalized === normalizedSceneName(candidate));
}

function isSaraRfv2PreviewHairObject(object: THREE.Object3D): boolean {
  const name = object.name || "";
  const normalized = normalizedSceneName(name);
  const mesh = object as THREE.Mesh;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const materialHasHairName = materials
    .filter(Boolean)
    .some((material: any) => String(material.name || "").toLowerCase().includes("hair"));
  return (
    SARA_RFV2_BINDING_PROFILE.hair.rootCandidates.some(
      (candidate) => normalized === normalizedSceneName(candidate)
    ) ||
    normalized.startsWith("hairmush") ||
    name.includes("Hair_mush") ||
    name.toLowerCase().includes("hair") ||
    materialHasHairName
  );
}

function serializeSaraTransformNode(object: THREE.Object3D | null): SaraTransformNodeAudit | null {
  if (!object) return null;
  object.updateWorldMatrix(true, false);
  const worldPosition = object.getWorldPosition(new THREE.Vector3());
  const worldQuaternion = object.getWorldQuaternion(new THREE.Quaternion());
  const worldRotation = new THREE.Euler().setFromQuaternion(worldQuaternion, object.rotation.order);
  const worldScale = object.getWorldScale(new THREE.Vector3());
  return {
    name: object.name || object.type,
    type: object.type,
    path: objectPath(object),
    parentPath: object.parent ? objectPath(object.parent) : null,
    visible: object.visible,
    localPosition: object.position.toArray(),
    localRotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    localScale: object.scale.toArray(),
    worldPosition: worldPosition.toArray(),
    worldRotation: [worldRotation.x, worldRotation.y, worldRotation.z],
    worldScale: worldScale.toArray(),
  };
}

function firstObjectByPredicate(
  root: THREE.Object3D,
  predicate: (object: THREE.Object3D) => boolean
): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (!found && predicate(child)) {
      found = child;
    }
  });
  return found;
}

function collectSaraHairRoots(root: THREE.Object3D): THREE.Object3D[] {
  const roots: THREE.Object3D[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const name = child.name || "";
    const isHairAuditRoot =
      isSaraRfv2PreviewHairObject(child) ||
      name.toLowerCase().includes("hair") ||
      SARA_OVERSIZED_SHELL_MESH_NAMES.has(name) ||
      SARA_OVERSIZED_SHELL_MESH_NAMES.has(mesh.geometry?.name || "");
    if (!isHairAuditRoot) return;
    const hasHairAncestor = roots.some((candidate) => {
      let current: THREE.Object3D | null = child.parent;
      while (current) {
        if (current === candidate) return true;
        current = current.parent;
      }
      return false;
    });
    if (!hasHairAncestor) roots.push(child);
  });
  return roots;
}

function createSaraTransformHierarchySnapshot(args: {
  mode: "Current Hybrid" | "Sara RFv2 Preview";
  modelPath: string;
  avatarRoot: THREE.Object3D | null;
  gltfScene: THREE.Object3D;
  transformCorrections: readonly string[];
}): SaraTransformHierarchySnapshot {
  args.avatarRoot?.updateMatrixWorld(true);
  args.gltfScene.updateMatrixWorld(true);
  const faceAlignmentGroup =
    args.gltfScene.getObjectByName("FaceAlignmentGroup") ??
    firstObjectByPredicate(args.gltfScene, (child) => child.name === "FaceAlignmentGroup");
  const faceRig =
    firstObjectByPredicate(args.gltfScene, isSaraRfv2PreviewFaceRoot) ??
    args.gltfScene.getObjectByName("Face_Rig") ??
    args.gltfScene.getObjectByName("Face Rig");
  const character =
    args.gltfScene.getObjectByName("Character") ??
    args.gltfScene.getObjectByName("Character.002") ??
    firstObjectByPredicate(args.gltfScene, isSaraRfv2PreviewBodyObject);
  const hairRoots = collectSaraHairRoots(args.gltfScene);
  return {
    mode: args.mode,
    modelPath: args.modelPath,
    timestamp: new Date().toISOString(),
    topLevelRoots: args.gltfScene.children.map((child) => child.name || child.type),
    avatarRoot: serializeSaraTransformNode(args.avatarRoot),
    faceAlignmentGroup: serializeSaraTransformNode(faceAlignmentGroup),
    faceRig: serializeSaraTransformNode(faceRig),
    character: serializeSaraTransformNode(character),
    hairRoots: hairRoots
      .map((root) => serializeSaraTransformNode(root))
      .filter((entry): entry is SaraTransformNodeAudit => entry !== null),
    transformCorrections: [...args.transformCorrections],
    createsNewGroups: false,
    reparentedNodes: [],
    movedNodes: [],
    notes: [],
  };
}

function vectorsDiffer(left: readonly number[], right: readonly number[], epsilon = 0.000001): boolean {
  return left.length !== right.length || left.some((value, index) => Math.abs(value - right[index]) > epsilon);
}

function compareSaraTransformNodes(
  before: SaraTransformNodeAudit | null,
  after: SaraTransformNodeAudit | null,
  label: string
): {
  reparentedNodes: string[];
  movedNodes: string[];
} {
  if (!before || !after) return { reparentedNodes: [], movedNodes: [] };
  const reparentedNodes =
    before.parentPath !== after.parentPath
      ? [`${label}: ${before.parentPath ?? "(none)"} -> ${after.parentPath ?? "(none)"}`]
      : [];
  const moved =
    vectorsDiffer(before.localPosition, after.localPosition) ||
    vectorsDiffer(before.localRotation, after.localRotation) ||
    vectorsDiffer(before.localScale, after.localScale) ||
    vectorsDiffer(before.worldPosition, after.worldPosition) ||
    vectorsDiffer(before.worldRotation, after.worldRotation) ||
    vectorsDiffer(before.worldScale, after.worldScale);
  return {
    reparentedNodes,
    movedNodes: moved ? [label] : [],
  };
}

function diffSaraTransformHierarchySnapshots(
  before: SaraTransformHierarchySnapshot | null,
  after: SaraTransformHierarchySnapshot | null
): Pick<SaraTransformHierarchySnapshot, "createsNewGroups" | "reparentedNodes" | "movedNodes"> {
  if (!before || !after) {
    return {
      createsNewGroups: false,
      reparentedNodes: [],
      movedNodes: [],
    };
  }
  const reparentedNodes: string[] = [];
  const movedNodes: string[] = [];
  const comparedNodes = [
    ["AvatarRoot", before.avatarRoot, after.avatarRoot],
    ["FaceAlignmentGroup", before.faceAlignmentGroup, after.faceAlignmentGroup],
    ["Face_Rig", before.faceRig, after.faceRig],
    ["Character", before.character, after.character],
  ] as const;
  comparedNodes.forEach(([label, beforeNode, afterNode]) => {
    const result = compareSaraTransformNodes(beforeNode, afterNode, label);
    reparentedNodes.push(...result.reparentedNodes);
    movedNodes.push(...result.movedNodes);
  });
  before.hairRoots.forEach((beforeHair) => {
    const afterHair =
      after.hairRoots.find((candidate) => candidate.path === beforeHair.path) ??
      after.hairRoots.find((candidate) => candidate.name === beforeHair.name) ??
      null;
    const result = compareSaraTransformNodes(beforeHair, afterHair, `Hair:${beforeHair.name}`);
    reparentedNodes.push(...result.reparentedNodes);
    movedNodes.push(...result.movedNodes);
  });
  const beforeGroupPaths = new Set<string>();
  const afterGroupPaths = new Set<string>();
  if (before.faceAlignmentGroup) beforeGroupPaths.add(before.faceAlignmentGroup.path);
  if (after.faceAlignmentGroup) afterGroupPaths.add(after.faceAlignmentGroup.path);
  const createsNewGroups = [...afterGroupPaths].some((path) => !beforeGroupPaths.has(path));
  return {
    createsNewGroups,
    reparentedNodes,
    movedNodes,
  };
}

function createSaraTransformAudit(args: {
  currentHybrid: SaraTransformHierarchySnapshot | null;
  saraRfv2Preview: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewBeforePrepare: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewAfterPrepare: SaraTransformHierarchySnapshot | null;
}): SaraTransformAudit {
  const rfv2PreviewChanges = diffSaraTransformHierarchySnapshots(
    args.saraRfv2PreviewBeforePrepare,
    args.saraRfv2PreviewAfterPrepare
  );
  return {
    currentHybrid: args.currentHybrid,
    saraRfv2Preview: args.saraRfv2Preview,
    saraRfv2PreviewBeforePrepare: args.saraRfv2PreviewBeforePrepare,
    saraRfv2PreviewAfterPrepare: args.saraRfv2PreviewAfterPrepare,
    comparison: {
      currentHybridAvailable: Boolean(args.currentHybrid),
      saraRfv2PreviewAvailable: Boolean(args.saraRfv2Preview),
      avatarRootNames: {
        currentHybrid: args.currentHybrid?.avatarRoot?.name ?? null,
        saraRfv2Preview: args.saraRfv2Preview?.avatarRoot?.name ?? null,
      },
      faceAlignmentGroupPresent: {
        currentHybrid: Boolean(args.currentHybrid?.faceAlignmentGroup),
        saraRfv2Preview: Boolean(args.saraRfv2Preview?.faceAlignmentGroup),
      },
      faceRigPaths: {
        currentHybrid: args.currentHybrid?.faceRig?.path ?? null,
        saraRfv2Preview: args.saraRfv2Preview?.faceRig?.path ?? null,
      },
      characterPaths: {
        currentHybrid: args.currentHybrid?.character?.path ?? null,
        saraRfv2Preview: args.saraRfv2Preview?.character?.path ?? null,
      },
      hairRootPaths: {
        currentHybrid: args.currentHybrid?.hairRoots.map((root) => root.path) ?? [],
        saraRfv2Preview: args.saraRfv2Preview?.hairRoots.map((root) => root.path) ?? [],
      },
    },
    rfv2PreviewChanges,
    rfv2PreviewOperationClaims: {
      createsNewGroups: false,
      reparentsNodes: false,
      movesFaceRig: false,
      movesCharacter: false,
      movesHair: false,
      morphApplierReparents: false,
      morphApplierMoves: false,
      morphApplierScales: false,
      morphApplierRotates: false,
    },
  };
}

function findSaraRfv2RootObject(
  root: THREE.Object3D,
  names: readonly string[]
): THREE.Object3D | null {
  for (const name of names) {
    const exact = root.getObjectByName(name);
    if (exact) return exact;
  }
  return firstObjectByPredicate(root, (object) =>
    names.some((name) => normalizedSceneName(object.name || "") === normalizedSceneName(name))
  );
}

function createSaraRfv2TransformDiagnostics(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const faceRig = findSaraRfv2RootObject(root, ["Face_Rig", "Face Rig"]);
  const character = findSaraRfv2RootObject(root, ["Character"]);
  const sketchfab = findSaraRfv2RootObject(root, ["Sketchfab_model"]);
  const faceAlignmentGroup = root.getObjectByName("FaceAlignmentGroup");
  const faceRigTransform = serializeSaraTransformNode(faceRig);
  const characterTransform = serializeSaraTransformNode(character);
  const sketchfabTransform = serializeSaraTransformNode(sketchfab);
  const transformMismatchWarnings: string[] = [];

  if (faceAlignmentGroup) {
    transformMismatchWarnings.push(
      "FaceAlignmentGroup exists in Sara RFv2 Preview; new sara.glb should keep the original Face_Rig hierarchy."
    );
  }
  if (faceRigTransform?.path.includes("FaceAlignmentGroup")) {
    transformMismatchWarnings.push(
      "Face_Rig is under FaceAlignmentGroup; RFv2 Preview should not wrap or separately scale Face_Rig."
    );
  }
  if (!faceRigTransform) transformMismatchWarnings.push("Face_Rig root was not found.");
  if (!characterTransform) transformMismatchWarnings.push("Character root was not found.");
  if (!sketchfabTransform) transformMismatchWarnings.push("Sketchfab_model root was not found.");

  const rootParentPath = objectPath(root);
  const expectedParent = rootParentPath;
  [
    ["Face_Rig", faceRigTransform],
    ["Character", characterTransform],
    ["Sketchfab_model", sketchfabTransform],
  ].forEach(([label, transform]) => {
    if (!transform) return;
    if (transform.parentPath !== expectedParent) {
      transformMismatchWarnings.push(
        `${label} parent is ${transform.parentPath ?? "(none)"}, expected shared root ${expectedParent}.`
      );
    }
  });

  return {
    rfv2UsesNewSaraTransform: true,
    oldFaceAlignmentSkipped: true,
    faceRigWorldTransform: faceRigTransform,
    characterWorldTransform: characterTransform,
    sketchfabWorldTransform: sketchfabTransform,
    transformMismatchWarnings,
  };
}

function getSaraRfv2VisibleBoundsDiagnostics(root: THREE.Object3D): {
  boundsCenter: number[] | null;
  boundsSize: number[] | null;
} {
  root.updateMatrixWorld(true);
  const visibleBounds = computeSaraVisibleRenderMeshBounds(root);
  if (visibleBounds.box.isEmpty()) {
    return {
      boundsCenter: null,
      boundsSize: null,
    };
  }
  const center = visibleBounds.box.getCenter(new THREE.Vector3());
  const size = visibleBounds.box.getSize(new THREE.Vector3());
  return {
    boundsCenter: center.toArray(),
    boundsSize: size.toArray(),
  };
}

function createSaraRfv2CameraFrameDiagnostics(
  camera: THREE.PerspectiveCamera,
  root?: THREE.Object3D | null
): SaraRfv2CameraFrameDiagnostics {
  const boundsDiagnostics = root
    ? getSaraRfv2VisibleBoundsDiagnostics(root)
    : { boundsCenter: null, boundsSize: null };
  return {
    cameraPosition: camera.position.toArray(),
    lookAt: Array.isArray(camera.userData.fixedLookAt)
      ? camera.userData.fixedLookAt
      : [],
    boundsCenter: boundsDiagnostics.boundsCenter,
    boundsSize: boundsDiagnostics.boundsSize,
    framingMode: SARA_RFV2_PREVIEW_DEFAULT_CAMERA_FRAME.label,
  };
}

function writeSaraTransformAuditToWindow(args: {
  currentHybrid?: SaraTransformHierarchySnapshot | null;
  saraRfv2Preview?: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewBeforePrepare?: SaraTransformHierarchySnapshot | null;
  saraRfv2PreviewAfterPrepare?: SaraTransformHierarchySnapshot | null;
}) {
  if (typeof window === "undefined") return;
  const existingFailureDiagnostics =
    ((window as any).saraLiveRfv2FailureDiagnostics as
      | { transformAudit?: SaraTransformAudit }
      | undefined) ?? {};
  const existingTransformAudit = existingFailureDiagnostics.transformAudit;
  const currentHybrid = args.currentHybrid ?? existingTransformAudit?.currentHybrid ?? null;
  const saraRfv2Preview =
    args.saraRfv2Preview ?? existingTransformAudit?.saraRfv2Preview ?? null;
  const saraRfv2PreviewBeforePrepare =
    args.saraRfv2PreviewBeforePrepare ??
    existingTransformAudit?.saraRfv2PreviewBeforePrepare ??
    null;
  const saraRfv2PreviewAfterPrepare =
    args.saraRfv2PreviewAfterPrepare ??
    existingTransformAudit?.saraRfv2PreviewAfterPrepare ??
    null;
  (window as any).saraLiveRfv2FailureDiagnostics = {
    ...existingFailureDiagnostics,
    transformAudit: createSaraTransformAudit({
      currentHybrid,
      saraRfv2Preview,
      saraRfv2PreviewBeforePrepare,
      saraRfv2PreviewAfterPrepare,
    }),
  };
}

function forceVisibleUpTree(object: THREE.Object3D | null) {
  let current: THREE.Object3D | null = object;
  while (current) {
    current.visible = true;
    current = current.parent;
  }
}

function forceRenderableMesh(object: THREE.Object3D) {
  const mesh = object as THREE.Mesh;
  const skinnedMesh = object as THREE.SkinnedMesh;
  if (!mesh.isMesh && !skinnedMesh.isSkinnedMesh) return;
  object.visible = true;
  object.frustumCulled = false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.filter(Boolean).forEach((material: any) => {
    material.depthTest = true;
    material.depthWrite = true;
    material.needsUpdate = true;
  });
}

function isSaraRfv2PreviewHairMesh(object: THREE.Object3D): object is THREE.Mesh {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh && !(object as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if (isSaraRfv2PreviewHairObject(object)) return true;
  const path = objectPath(object);
  return path.includes("Sketchfab_model") || path.includes("Hair_mush");
}

type SaraRfv2HairMaterialPrepDiagnostic = {
  hasMap: boolean;
  hasAlphaMap: boolean;
  opacity: number | null;
  alphaTestBeforeAfter: { before: number | null; after: number | null };
  transparentBeforeAfter: { before: boolean | null; after: boolean | null };
};

function prepareSaraRfv2HairMaterial(
  material: any
): SaraRfv2HairMaterialPrepDiagnostic | null {
  if (!material) return null;
  const alphaTestBefore =
    typeof material.alphaTest === "number" ? material.alphaTest : null;
  const transparentBefore =
    typeof material.transparent === "boolean" ? material.transparent : null;
  const hasMap = Boolean(material.map);
  const hasAlphaMap = Boolean(material.alphaMap);
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  material.depthTest = true;
  material.opacity = 1;
  if (hasAlphaMap) {
    material.transparent = true;
    material.alphaTest = 0.35;
  } else {
    material.transparent = false;
    material.alphaTest = 0;
  }
  if (material.color?.isColor) {
    const color = material.color as THREE.Color;
    const maxChannel = Math.max(color.r, color.g, color.b);
    if (maxChannel < 0.08) {
      color.setRGB(0.09, 0.065, 0.045);
    } else if (maxChannel < 0.14) {
      color.multiplyScalar(1.25);
    }
  }
  material.needsUpdate = true;
  return {
    hasMap,
    hasAlphaMap,
    opacity: typeof material.opacity === "number" ? material.opacity : null,
    alphaTestBeforeAfter: {
      before: alphaTestBefore,
      after: typeof material.alphaTest === "number" ? material.alphaTest : null,
    },
    transparentBeforeAfter: {
      before: transparentBefore,
      after: typeof material.transparent === "boolean" ? material.transparent : null,
    },
  };
}

function prepareSaraRfv2HairRendering(root: THREE.Object3D): SaraRfv2HairDiagnostics {
  const hairMeshes: THREE.Mesh[] = [];
  const materialPrepDiagnostics: Record<string, SaraRfv2HairMaterialPrepDiagnostic> = {};
  root.traverse((child) => {
    if (!isSaraRfv2PreviewHairMesh(child)) return;
    const mesh = child as THREE.Mesh;
    hairMeshes.push(mesh);
    forceVisibleUpTree(mesh);
    mesh.visible = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 13;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.filter(Boolean).forEach((material: any, materialIndex: number) => {
      const materialName = material.name || `${mesh.name || `(mesh ${mesh.id})`}:material${materialIndex}`;
      const diagnosticKey = `${mesh.name || `(mesh ${mesh.id})`}:${materialName}`;
      const prepDiagnostic = prepareSaraRfv2HairMaterial(material);
      if (prepDiagnostic) {
        materialPrepDiagnostics[diagnosticKey] = prepDiagnostic;
      }
    });
  });

  root.updateMatrixWorld(true);
  const hairBounds = new THREE.Box3();
  let hasHairBounds = false;
  const materialNames = new Set<string>();
  const hairVisible: Record<string, boolean> = {};
  const hairRenderOrder: Record<string, number> = {};
  const hairDepthWrite: Record<string, boolean | null> = {};
  const hairAlphaTest: Record<string, number | null> = {};
  const hairTransparent: Record<string, boolean | null> = {};
  const hairColorValues: Record<string, string | null> = {};
  const hasMap: Record<string, boolean> = {};
  const hasAlphaMap: Record<string, boolean> = {};
  const opacity: Record<string, number | null> = {};
  const alphaTestBeforeAfter: Record<
    string,
    { before: number | null; after: number | null }
  > = {};
  const transparentBeforeAfter: Record<
    string,
    { before: boolean | null; after: boolean | null }
  > = {};

  hairMeshes.forEach((mesh) => {
    const meshName = mesh.name || `(mesh ${mesh.id})`;
    hairVisible[meshName] = mesh.visible;
    hairRenderOrder[meshName] = mesh.renderOrder;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
    materials.forEach((material: any, materialIndex: number) => {
      const materialName = material.name || `${meshName}:material${materialIndex}`;
      materialNames.add(materialName);
      const diagnosticKey = `${meshName}:${materialName}`;
      hairDepthWrite[diagnosticKey] =
        typeof material.depthWrite === "boolean" ? material.depthWrite : null;
      hairAlphaTest[diagnosticKey] =
        typeof material.alphaTest === "number" ? material.alphaTest : null;
      hairTransparent[diagnosticKey] =
        typeof material.transparent === "boolean" ? material.transparent : null;
      hairColorValues[diagnosticKey] =
        material.color?.isColor ? `#${(material.color as THREE.Color).getHexString()}` : null;
      hasMap[diagnosticKey] = Boolean(material.map);
      hasAlphaMap[diagnosticKey] = Boolean(material.alphaMap);
      opacity[diagnosticKey] =
        typeof material.opacity === "number" ? material.opacity : null;
      alphaTestBeforeAfter[diagnosticKey] =
        materialPrepDiagnostics[diagnosticKey]?.alphaTestBeforeAfter ?? {
          before: null,
          after: hairAlphaTest[diagnosticKey],
        };
      transparentBeforeAfter[diagnosticKey] =
        materialPrepDiagnostics[diagnosticKey]?.transparentBeforeAfter ?? {
          before: null,
          after: hairTransparent[diagnosticKey],
        };
    });
    const meshBox = new THREE.Box3().setFromObject(mesh);
    if (!meshBox.isEmpty()) {
      if (!hasHairBounds) {
        hairBounds.copy(meshBox);
        hasHairBounds = true;
      } else {
        hairBounds.union(meshBox);
      }
    }
  });

  return {
    hairMeshCount: hairMeshes.length,
    hairMeshNames: hairMeshes.map((mesh) => mesh.name || `(mesh ${mesh.id})`),
    hairMaterialNames: Array.from(materialNames).sort(),
    hairVisible,
    hairRenderOrder,
    hairDepthWrite,
    hairAlphaTest,
    hairTransparent,
    hairColorValues,
    hasMap,
    hasAlphaMap,
    opacity,
    alphaTestBeforeAfter,
    transparentBeforeAfter,
    hairWorldBounds: hasHairBounds ? serializableBox(hairBounds) : null,
  };
}

function prepareSaraRfv2PreviewScene(
  root: THREE.Object3D,
  modelUrl: string
): SaraRfv2PreviewAssetDiagnostics {
  const topLevelRoots = root.children.map((child) => child.name || child.type);
  let faceRoot: THREE.Object3D | null = null;
  let faceMesh: THREE.Mesh | null = null;
  let bodyRoot: THREE.Object3D | null = null;
  let hairRoot: THREE.Object3D | null = null;

  root.traverse((child) => {
    if (!faceRoot && isSaraRfv2PreviewFaceRoot(child)) {
      faceRoot = child;
    }
    if (!faceMesh && isSaraRfv2PreviewFaceMesh(child)) {
      faceMesh = child as THREE.Mesh;
    }
    if (!bodyRoot && isSaraRfv2PreviewBodyObject(child)) {
      bodyRoot = child;
    }
    if (!hairRoot && isSaraRfv2PreviewHairObject(child)) {
      hairRoot = child;
    }
  });

  forceVisibleUpTree(faceRoot);
  forceVisibleUpTree(faceMesh);
  forceVisibleUpTree(bodyRoot);
  forceVisibleUpTree(hairRoot);

  root.traverse((child) => {
    const underFace =
      faceRoot !== null && (child === faceRoot || child.parent === faceRoot || objectPath(child).includes("Face Rig"));
    const underBody =
      bodyRoot !== null && (child === bodyRoot || objectPath(child).includes("Character"));
    const underHair =
      hairRoot !== null &&
      (child === hairRoot ||
        objectPath(child).includes("Sketchfab_model") ||
        objectPath(child).includes("Hair_mush") ||
        isSaraRfv2PreviewHairObject(child));
    if (underFace || underBody || underHair || isSaraRfv2PreviewFaceMesh(child)) {
      child.visible = true;
      forceRenderableMesh(child);
    }
  });
  const hairDiagnostics = prepareSaraRfv2HairRendering(root);

  root.updateMatrixWorld(true);

  const faceDictionary =
    (faceMesh?.morphTargetDictionary as Record<string, number> | undefined) ?? {};

  return {
    detectedAsset: modelUrl || SARA_RFV2_BINDING_PROFILE.assetPath,
    topLevelRoots,
    faceRootFound: Boolean(faceRoot),
    faceRootName: faceRoot?.name || null,
    faceRootPath: faceRoot ? objectPath(faceRoot) : null,
    faceMeshFound: Boolean(faceMesh),
    faceMeshPath: faceMesh ? objectPath(faceMesh) : null,
    faceMorphNames: Object.keys(faceDictionary).sort((a, b) => faceDictionary[a] - faceDictionary[b]),
    bodyRootFound: Boolean(bodyRoot),
    hairRootFound: Boolean(hairRoot),
    hairDiagnostics,
  };
}

// Crisis keyword popup (public, user-facing).
const CRISIS_KEYWORD_MODAL_ENABLED = false;
// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists — covers Ready Player Me, Blender ARKit, Mixamo, CC3/CC4,
// MetaHuman, and most custom Blender rigs.
// ─────────────────────────────────────────────────────────────────────────────


// function isBlink(name: string): boolean {
//   const lower = name.toLowerCase();
//   return BLINK_KEYWORDS.some((k) => lower.includes(k));
// }

// function isMouth(name: string): boolean {
//   const lower = name.toLowerCase();
//   return MOUTH_KEYWORDS.some((k) => lower === k || lower.includes(k));
// }



// Exact names for your current file
// IMPORTANT: do not force-map "eyes" as a blink target on this GLB,
// it is not a safe eyelid morph and animating it can hide the head/face.
const EXACT_EYE_NAMES: string[] = [];
const EXACT_MOUTH_NAMES = ["mouth"];

// Generic fallbacks for other rigs
const BLINK_KEYWORDS = [
  "blink",
  "eyeblink",
  "eye_blink",
  "eyelid",
  "eye_lid",
  "upperlid",
  "lowerlid",
  "lid",
  "eyeclose",
  "eye_close",
  "eyesclosed",
  "eyes_closed",
  "wink",
  "closeeye",
  "close_eye",
  "eyeblinkleft",
  "eyeblinkright",
  "eyesquintleft",
  "eyesquintright",
  // NOTE: do NOT include generic "eyes" here — it frequently maps to a non-blink
  // control and will deform/hide the face instead of closing eyelids.
];

const MOUTH_KEYWORDS = [
  "mouth",
  "jaw",
  "viseme",
  "mouthopen",
  "mouth_open",
  "jawopen",
  "jaw_open",
  "open",
  "aa",
  "ah",
  "oh",
  "ee",
  "ih",
  "uh",
];

function classifySaraV2MouthSource(name: string): string {
  const lower = name.toLowerCase();
  if (isSaraV2MouthInteriorMorph(name)) return "mouthInterior";
  if (lower.includes("viseme")) return "viseme";
  if (lower.includes("jaw") || lower.includes("open")) return "jaw/open";
  if (lower.includes("smile") || lower.includes("frown")) return "smile/frown";
  if (lower.includes("mouth")) return "mouth";
  return "other";
}

function normalizeSaraV2MorphName(name: string): string {
  return name.trim().replace(/[._\s-]/g, "").toLowerCase();
}

function isSaraV2JawOpenMorph(name: string): boolean {
  return normalizeSaraV2MorphName(name) === "jawopen";
}

function isSaraV2VisemeMorph(name: string): boolean {
  return name.trim().toLowerCase().startsWith("viseme");
}

const SARA_V2_ALLOWED_PHONEME_MORPHS = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_E",
  "viseme_O",
  "viseme_PP",
  "viseme_CH",
  "viseme_S",
  "jawOpen",
] as const;

const SARA_V2_ALLOWED_PHONEME_MORPH_SET = new Set(
  SARA_V2_ALLOWED_PHONEME_MORPHS.map((name) => normalizeSaraV2MorphName(name))
);

function isSaraV2AllowedPhonemeMorph(name: string): boolean {
  return SARA_V2_ALLOWED_PHONEME_MORPH_SET.has(normalizeSaraV2MorphName(name));
}

function isSaraV2VisemeAAMorph(name: string): boolean {
  return normalizeSaraV2MorphName(name) === "visemeaa";
}

function isSaraV2GenericOpenMorph(name: string): boolean {
  const normalized = normalizeSaraV2MorphName(name);
  return (
    normalized === "mouth" ||
    normalized === "mouthopen" ||
    (normalized.includes("open") && normalized !== "jawopen")
  );
}

function isSaraV2SmileFrownMorph(name: string): boolean {
  const normalized = normalizeSaraV2MorphName(name);
  return normalized.includes("mouthsmile") || normalized.includes("mouthfrown");
}

function isSaraV2MouthInteriorMorph(name: string): boolean {
  const normalized = normalizeSaraV2MorphName(name);
  return (
    normalized.includes("teeth") ||
    normalized.includes("tooth") ||
    normalized.includes("tongue") ||
    normalized.includes("mouthinterior")
  );
}

function saraV2MouthCapFor(name: string, speaking: boolean): number {
  if (isSaraV2MouthInteriorMorph(name)) return 0.02;
  if (isSaraV2SmileFrownMorph(name) && speaking) return 0.04;

  if (isSaraV2VisemeAAMorph(name)) return 0.65;
  if (isSaraV2VisemeMorph(name)) return 0.55;
  if (isSaraV2JawOpenMorph(name)) return 0.35;
  if (isSaraV2GenericOpenMorph(name)) return 0.18;
  return 0.06;
}

function saraV2OpenDriverKind(name: string): "viseme" | "jawOpen" | "genericOpen" | "other" {
  if (isSaraV2VisemeMorph(name)) return "viseme";
  if (isSaraV2JawOpenMorph(name)) return "jawOpen";
  if (isSaraV2GenericOpenMorph(name)) return "genericOpen";
  return "other";
}

function isSaraV2GenericMouthReleaseTarget(name: string): boolean {
  if (isSaraV2AllowedPhonemeMorph(name)) return false;
  const normalized = normalizeSaraV2MorphName(name);
  return (
    isSaraV2VisemeMorph(name) ||
    isSaraV2GenericOpenMorph(name) ||
    isSaraV2MouthInteriorMorph(name) ||
    normalized.includes("jaw") ||
    normalized.includes("mouth") ||
    normalized.includes("open") ||
    normalized.includes("teeth") ||
    normalized.includes("tooth") ||
    normalized.includes("tongue")
  );
}

function isBlinkName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (EXACT_EYE_NAMES.includes(lower)) return true;
  // Some rigs only expose a generic "eyes" morph. We allow it as a last-resort
  // blink target (we clamp it very conservatively in the blink animator).
  if (lower === "eyes") return true;
  return BLINK_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function isMouthName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (EXACT_MOUTH_NAMES.includes(lower)) return true;
  return MOUTH_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function isRfv2BodyMeshName(name: string): boolean {
  const normalized = name.trim().replace(/[._\s-]/g, "").toLowerCase();
  return (
    normalized === "body" ||
    normalized === "body001" ||
    normalized === "top" ||
    normalized === "top001" ||
    normalized === "bottom" ||
    normalized === "bottom001" ||
    normalized === "footwear" ||
    normalized === "footwear001"
  );
}

function isRfv2HeadRootName(name: string): boolean {
  return name.trim().replace(/[._\s-]/g, "").toLowerCase() === "bones001";
}

function isUpperEyelidBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("eyelidupper") ||
    n.includes("eyelid_upper") ||
    n.includes("upperlid") ||
    n.includes("upper_lid") ||
    n.includes("lashupper") ||
    n.includes("upperlash") ||
    n.includes("lashesupper")
  );
}

function isLowerEyelidBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("eyelidlower") ||
    n.includes("eyelid_lower") ||
    n.includes("lowerlid") ||
    n.includes("lower_lid") ||
    n.includes("lashlower") ||
    n.includes("lowerlash") ||
    n.includes("lasheslower")
  );
}

type JordanPresenceState = "speaking" | "listening" | "thinking" | "idle";
type JordanExpressionPresetName = "calmIdle" | "attentiveListening" | "warmSpeaking";
type JordanEmotionalModulationMode = keyof typeof JORDAN_EMOTIONAL_MODULATION_TUNING;
type JordanEmotionalModulationProfile =
  (typeof JORDAN_EMOTIONAL_MODULATION_TUNING)[JordanEmotionalModulationMode];
type JordanEyeFocusState = {
  up: number;
  down: number;
  asym: number;
  yaw: number;
  holding: boolean;
  holdMs: number;
};
type JordanHeadPresenceTarget = {
  yaw: number;
  tilt: number;
};
type JordanListeningFaceTarget = {
  brow: number;
  smileLeft: number;
  smileRight: number;
  frownLeft: number;
  frownRight: number;
  cheekLeft: number;
  cheekRight: number;
  headTilt: number;
  holdMs: number;
};
type JordanIdleBehaviorContribution = {
  eyeUp: number;
  eyeDown: number;
  eyeAsym: number;
  brow: number;
  visemeRest: number;
  smileLeft: number;
  smileRight: number;
  cheekLeft: number;
  cheekRight: number;
  headYaw: number;
  headTilt: number;
};
type JordanListeningBehaviorContribution = {
  eyeUp: number;
  eyeDown: number;
  eyeAsym: number;
  brow: number;
  smileLeft: number;
  smileRight: number;
  cheekLeft: number;
  cheekRight: number;
  frownLeft: number;
  frownRight: number;
  sad: number;
  headYaw: number;
  headTilt: number;
  smileMultiplier: number;
  emotionalLatencyScale: number;
};
type JordanSpeakingBehaviorContribution = {
  cheekLeft: number;
  cheekRight: number;
  brow: number;
  smileLeft: number;
  smileRight: number;
  frownLeft: number;
  frownRight: number;
  sad: number;
  eyeUp: number;
  eyeDown: number;
  eyeAsym: number;
  headYaw: number;
  headTilt: number;
  turnEndReleaseActive: boolean;
  softProcessingPauseActive: boolean;
};

type JordanBlinkType = "full" | "partial" | "slow" | "double";
type JordanBlinkMode = "split" | "fallback";
type JordanBlinkAnimationType = Exclude<JordanBlinkType, "double">;

type JordanExpressionAuthorityEntry = {
  requestedTargetValue: number;
  clampLimit: number | null;
  valueAfterClamp: number;
  previousSmoothedValue: number;
  finalAppliedMorphTargetInfluence: number | null;
  overwrittenLater: boolean;
};

type JordanPhonemeDebugState = {
  audioCurrentTime: number;
  lookAheadMs: number;
  phonemeTimelineLength: number;
  activePhoneme: string | null;
  normalizedPhoneme: string | null;
  activeViseme: JordanMorphName | null;
  activeVisemeTargetValue: number;
  jawOpenValue: number;
  fallbackModeActive: boolean;
  oldMouthDriverSkipped: boolean;
};

const EMPTY_JORDAN_PHONEME_DEBUG_STATE: JordanPhonemeDebugState = {
  audioCurrentTime: 0,
  lookAheadMs: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds * 1000,
  phonemeTimelineLength: 0,
  activePhoneme: null,
  normalizedPhoneme: null,
  activeViseme: null,
  activeVisemeTargetValue: 0,
  jawOpenValue: 0,
  fallbackModeActive: false,
  oldMouthDriverSkipped: true,
};

const EMPTY_JORDAN_LISTENING_FACE_TARGET: JordanListeningFaceTarget = {
  brow: 0,
  smileLeft: 0,
  smileRight: 0,
  frownLeft: 0,
  frownRight: 0,
  cheekLeft: 0,
  cheekRight: 0,
  headTilt: 0,
  holdMs: 0,
};
const EMPTY_JORDAN_IDLE_BEHAVIOR_CONTRIBUTION: JordanIdleBehaviorContribution = {
  eyeUp: 0,
  eyeDown: 0,
  eyeAsym: 0,
  brow: 0,
  visemeRest: 0,
  smileLeft: 0,
  smileRight: 0,
  cheekLeft: 0,
  cheekRight: 0,
  headYaw: 0,
  headTilt: 0,
};
const EMPTY_JORDAN_LISTENING_BEHAVIOR_CONTRIBUTION: JordanListeningBehaviorContribution = {
  eyeUp: 0,
  eyeDown: 0,
  eyeAsym: 0,
  brow: 0,
  smileLeft: 0,
  smileRight: 0,
  cheekLeft: 0,
  cheekRight: 0,
  frownLeft: 0,
  frownRight: 0,
  sad: 0,
  headYaw: 0,
  headTilt: 0,
  smileMultiplier: 1,
  emotionalLatencyScale: 1,
};
const EMPTY_JORDAN_SPEAKING_BEHAVIOR_CONTRIBUTION: JordanSpeakingBehaviorContribution = {
  cheekLeft: 0,
  cheekRight: 0,
  brow: 0,
  smileLeft: 0,
  smileRight: 0,
  frownLeft: 0,
  frownRight: 0,
  sad: 0,
  eyeUp: 0,
  eyeDown: 0,
  eyeAsym: 0,
  headYaw: 0,
  headTilt: 0,
  turnEndReleaseActive: false,
  softProcessingPauseActive: false,
};

function scaleJordanIdleBehaviorContribution(
  contribution: JordanIdleBehaviorContribution,
): JordanIdleBehaviorContribution {
  const scale = JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier.idle;
  return {
    eyeUp: contribution.eyeUp * scale,
    eyeDown: contribution.eyeDown * scale,
    eyeAsym: contribution.eyeAsym * scale,
    brow: contribution.brow * scale,
    visemeRest: contribution.visemeRest * scale,
    smileLeft: contribution.smileLeft * scale,
    smileRight: contribution.smileRight * scale,
    cheekLeft: contribution.cheekLeft * scale,
    cheekRight: contribution.cheekRight * scale,
    headYaw: contribution.headYaw * scale,
    headTilt: contribution.headTilt * scale,
  };
}

function scaleJordanListeningBehaviorContribution(
  contribution: JordanListeningBehaviorContribution,
): JordanListeningBehaviorContribution {
  const scale = JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier.listening;
  return {
    eyeUp: contribution.eyeUp * scale,
    eyeDown: contribution.eyeDown * scale,
    eyeAsym: contribution.eyeAsym * scale,
    brow: contribution.brow * scale,
    smileLeft: contribution.smileLeft * scale,
    smileRight: contribution.smileRight * scale,
    cheekLeft: contribution.cheekLeft * scale,
    cheekRight: contribution.cheekRight * scale,
    frownLeft: contribution.frownLeft * scale,
    frownRight: contribution.frownRight * scale,
    sad: contribution.sad * scale,
    headYaw: contribution.headYaw * scale,
    headTilt: contribution.headTilt * scale,
    smileMultiplier: contribution.smileMultiplier,
    emotionalLatencyScale: contribution.emotionalLatencyScale,
  };
}

function scaleJordanSpeakingBehaviorContribution(
  contribution: JordanSpeakingBehaviorContribution,
): JordanSpeakingBehaviorContribution {
  const scale = JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier.speaking;
  return {
    cheekLeft: contribution.cheekLeft * scale,
    cheekRight: contribution.cheekRight * scale,
    brow: contribution.brow * scale,
    smileLeft: contribution.smileLeft * scale,
    smileRight: contribution.smileRight * scale,
    frownLeft: contribution.frownLeft * scale,
    frownRight: contribution.frownRight * scale,
    sad: contribution.sad * scale,
    eyeUp: contribution.eyeUp * scale,
    eyeDown: contribution.eyeDown * scale,
    eyeAsym: contribution.eyeAsym * scale,
    headYaw: contribution.headYaw * scale,
    headTilt: contribution.headTilt * scale,
    turnEndReleaseActive: contribution.turnEndReleaseActive,
    softProcessingPauseActive: contribution.softProcessingPauseActive,
  };
}

function avatarModeLabel(mode: AvatarRenderMode): string {
  return mode;
}

function storeFaceBoneDefault(bone: THREE.Bone, map: Map<string, { x: number; y: number; z: number }>) {
  if (!map.has(bone.uuid)) {
    map.set(bone.uuid, {
      x: bone.rotation.x,
      y: bone.rotation.y,
      z: bone.rotation.z,
    });
  }
}

function isJawBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("jawline")) return false;
  return n.includes("jaw");
}

function isChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("chin");
}

function isJawlineBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("jawline");
}

function isMouthInteriorBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("mouthinterior");
}

function isUnderChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("underchin");
}

/** Driven separately from the main mouth loop — subtle puff / smile sync. */
function isCheekMorphName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (/eye/.test(lower) && /squint/.test(lower) && !/cheek/.test(lower)) {
    return false;
  }
  return (
    lower.includes("cheek") ||
    lower.includes("nasolabial") ||
    lower.includes("puff") ||
    lower.includes("buccinator") ||
    (lower.includes("smile") && !lower.includes("eye")) ||
    (lower.includes("squint") && lower.includes("cheek"))
  );
}

function isCheekBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("cheek") ||
    n.includes("zygomatic") ||
    n.includes("nasolabial") ||
    n.includes("buccinator") ||
    (n.includes("smile") &&
      (n.includes("facial") || /l_|_l|r_|_r|left|right/.test(n)))
  );
}

/** T1 / MetaHuman: cheek movers — skip 12IPV chains; include all CheekLower* (not only 1–2). */
function isPrimaryCheekBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  if (n.includes("cheekinner")) return true;
  if (n.includes("cheeklower")) return true;
  if (n.includes("nasolabialbulge")) return true;
  if (n.includes("masseter")) return true;
  if (n.includes("zygomatic")) return true;
  return false;
}

/** Only MetaHuman / T1 main mandible — other “jaw*” bones can move the whole head/torso visually. */
function isMainMandibleBoneName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === "facial_c_jaw";
}

/** Animate a small set of chin movers only (not every 12IPV chin helper). */
function isPrimaryChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  return (
    n === "facial_c_chin" ||
    n === "facial_c_chin1" ||
    n === "facial_c_chin2" ||
    n === "facial_c_chin3"
  );
}

/** Center mouth/lip drivers (stronger deltas than peripheral chain bones). */
function isCenterLipBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  return (
    n === "facial_c_mouthupper" ||
    n === "facial_c_mouthlower" ||
    n === "facial_c_lipupper" ||
    n === "facial_c_liplower" ||
    n === "facial_c_lowerliprotation"
  );
}

function isCheekRelatedMorphKeyForLog(name: string): boolean {
  const lower = name.toLowerCase();
  return /cheek|smile|nasolabial|puff|squint/.test(lower);
}
function isDiagnosticBoneName(name: string): boolean {
  return /head|neck|spine|jaw/i.test(name);
}

function isJordanIdlePresenceBoneName(name: string): boolean {
  const normalized = name.trim().replace(/[._\s-]/g, "").toLowerCase();
  return normalized === "head" || normalized === "neck";
}

function resolveJordanPresenceState({
  speaking,
  listening,
  thinking,
}: {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}): JordanPresenceState {
  if (speaking) return "speaking";
  if (thinking) return "thinking";
  if (listening) return "listening";
  return "idle";
}

const JORDAN_IDLE_SCHEDULER_CONSUMED_EVENT_TYPES = new Set<
  JordanBehaviorTimingEvent["type"]
>([
  "idle_stillness",
  "idle_micro_adjust",
  "eye_refocus",
  "brow_soft_lift",
  "micro_head_tilt",
  "long_pause_stillness",
  "processing_pause",
]);
const JORDAN_LISTENING_SCHEDULER_CONSUMED_EVENT_TYPES = new Set<
  JordanBehaviorTimingEvent["type"]
>([
  "listening_ack",
  "listening_soft_smile",
  "empathy_soften",
  "eye_refocus",
  "brow_soft_lift",
  "brow_concern",
  "micro_head_tilt",
  "micro_head_shake",
  "soft_processing_pause",
  "user_sentence_end",
  "user_pause_ack",
  "long_pause_stillness",
  "processing_pause",
  "anticipation_focus",
  "emotional_emphasis",
  "pre_speech_focus",
]);
const JORDAN_SPEAKING_SCHEDULER_CONSUMED_EVENT_TYPES = new Set<
  JordanBehaviorTimingEvent["type"]
>([
  "eye_refocus",
  "brow_soft_lift",
  "micro_head_tilt",
  "turn_end_release",
  "soft_processing_pause",
  "speaking_emphasis",
  "speaking_soften",
  "speaking_settle",
  "jordan_sentence_end",
  "turn_taking_settle",
  "post_speech_release",
  "pre_speech_focus",
  "anticipation_focus",
  "emotional_emphasis",
]);

function hashJordanBehaviorEventId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function eventDirection(event: JordanBehaviorTimingEvent, salt = 0): 1 | -1 {
  return ((hashJordanBehaviorEventId(event.id) + salt) % 2 === 0 ? 1 : -1);
}

function strongestJordanIdleEvent(
  events: JordanBehaviorTimingEvent[],
  type: JordanBehaviorTimingEvent["type"],
): JordanBehaviorTimingEvent | null {
  return events
    .filter((event) => event.type === type)
    .sort((a, b) => b.intensity * b.weight - a.intensity * a.weight)[0] ?? null;
}

function jordanMotionChannelIsActive(
  event: JordanBehaviorTimingEvent,
  channel: NonNullable<JordanBehaviorTimingEvent["channels"]>[number]["channel"],
  nowMs: number,
): boolean {
  if (!event.channels || event.channels.length === 0) {
    return true;
  }

  return event.channels.some((motionChannel) => {
    if (motionChannel.channel !== channel) {
      return false;
    }

    const interruptedAtMs =
      typeof motionChannel.metadata?.interruptedAtMs === "number"
        ? motionChannel.metadata.interruptedAtMs
        : null;

    if (motionChannel.interrupted && interruptedAtMs !== null && nowMs >= interruptedAtMs) {
      return false;
    }

    return motionChannel.startsAtMs <= nowMs && motionChannel.endsAtMs >= nowMs;
  });
}

function strongestJordanChannelEvent(
  events: JordanBehaviorTimingEvent[],
  type: JordanBehaviorTimingEvent["type"],
  channel: NonNullable<JordanBehaviorTimingEvent["channels"]>[number]["channel"],
  nowMs: number,
): JordanBehaviorTimingEvent | null {
  return events
    .filter(
      (event) =>
        event.type === type && jordanMotionChannelIsActive(event, channel, nowMs)
    )
    .sort((a, b) => b.intensity * b.weight - a.intensity * a.weight)[0] ?? null;
}

function strongestJordanChannelEventOfTypes(
  events: JordanBehaviorTimingEvent[],
  types: JordanBehaviorTimingEvent["type"][],
  channel: NonNullable<JordanBehaviorTimingEvent["channels"]>[number]["channel"],
  nowMs: number,
): JordanBehaviorTimingEvent | null {
  return events
    .filter(
      (event) =>
        types.includes(event.type) &&
        jordanMotionChannelIsActive(event, channel, nowMs)
    )
    .sort((a, b) => b.intensity * b.weight - a.intensity * a.weight)[0] ?? null;
}

function jordanBehaviorEventRamp(
  event: JordanBehaviorTimingEvent,
  nowMs: number,
  offsetMs: number,
  riseMs: number,
): number {
  return THREE.MathUtils.clamp(
    (nowMs - event.startsAtMs - offsetMs) / Math.max(riseMs, 1),
    0,
    1
  );
}

function hasConcernedJordanListeningSentiment(sentimentLabel: string): boolean {
  const normalized = sentimentLabel.toLowerCase();
  return (
    normalized.includes("sad") ||
    normalized.includes("negative") ||
    normalized.includes("crisis") ||
    normalized.includes("anxious") ||
    normalized.includes("stress") ||
    normalized.includes("stressed") ||
    normalized.includes("worried")
  );
}

function normalizeJordanEmotionalModulationMode(
  sentimentLabel: string,
  presenceState: JordanPresenceState,
): JordanEmotionalModulationMode {
  if (presenceState === "thinking") {
    return "thinking";
  }

  const normalized = sentimentLabel.toLowerCase();

  if (
    normalized.includes("happy") ||
    normalized.includes("positive") ||
    normalized.includes("warm") ||
    normalized.includes("supportive") ||
    normalized.includes("hopeful") ||
    normalized.includes("joy")
  ) {
    return "happy";
  }

  if (
    normalized.includes("anxious") ||
    normalized.includes("worried") ||
    normalized.includes("stress") ||
    normalized.includes("stressed")
  ) {
    return "anxious";
  }

  if (
    normalized.includes("sad") ||
    normalized.includes("negative") ||
    normalized.includes("crisis") ||
    normalized.includes("serious") ||
    normalized.includes("down")
  ) {
    return "sad";
  }

  return "neutral";
}

function getJordanEmotionalModulationProfile(
  mode: JordanEmotionalModulationMode,
): JordanEmotionalModulationProfile {
  return JORDAN_EMOTIONAL_MODULATION_TUNING[mode];
}

function resolveJordanIdleBehaviorContribution(
  events: JordanBehaviorTimingEvent[],
  nowMs: number,
  modulationProfile: JordanEmotionalModulationProfile,
): JordanIdleBehaviorContribution {
  const contribution = { ...EMPTY_JORDAN_IDLE_BEHAVIOR_CONTRIBUTION };
  const eyeEvent = strongestJordanChannelEventOfTypes(
    events,
    ["eye_refocus", "processing_pause", "long_pause_stillness"],
    "eye",
    nowMs
  );
  const browEvent = strongestJordanChannelEvent(events, "brow_soft_lift", "brow", nowMs);
  const mouthEvent = strongestJordanChannelEvent(events, "idle_micro_adjust", "mouth", nowMs);
  const cheekEvent = strongestJordanChannelEvent(events, "idle_micro_adjust", "cheek", nowMs);
  const headEvent = strongestJordanChannelEvent(events, "micro_head_tilt", "head", nowMs);

  if (eyeEvent) {
    const eyeAmount =
      THREE.MathUtils.clamp(eyeEvent.intensity, 0.008, 0.025) *
      modulationProfile.eyeEngagementMultiplier;
    if (eventDirection(eyeEvent) > 0) {
      contribution.eyeUp = eyeAmount;
    } else {
      contribution.eyeDown = eyeAmount;
    }
    contribution.eyeAsym = eyeAmount * 0.16 * eventDirection(eyeEvent, 7);
  }

  if (browEvent) {
    contribution.brow = THREE.MathUtils.clamp(browEvent.intensity, 0.012, 0.04);
  }

  if (mouthEvent) {
    const mouthAmount = THREE.MathUtils.clamp(mouthEvent.intensity, 0.02, 0.08);
    contribution.visemeRest = THREE.MathUtils.clamp(mouthAmount * 0.31, 0.005, 0.025);
    contribution.smileLeft =
      THREE.MathUtils.clamp(mouthAmount * 0.26, 0.005, 0.025) *
      modulationProfile.smileMultiplier *
      (eventDirection(mouthEvent, 3) > 0 ? 1 : 0.72);
    contribution.smileRight =
      THREE.MathUtils.clamp(mouthAmount * 0.26, 0.005, 0.025) *
      modulationProfile.smileMultiplier *
      (eventDirection(mouthEvent, 3) > 0 ? 0.72 : 1);
  }

  if (cheekEvent) {
    const cheekAmount = THREE.MathUtils.clamp(cheekEvent.intensity, 0.02, 0.08);
    contribution.cheekLeft =
      THREE.MathUtils.clamp(cheekAmount * 0.18, 0.004, 0.018) *
      modulationProfile.cheekWarmthMultiplier *
      (eventDirection(cheekEvent, 11) > 0 ? 1 : 0.76);
    contribution.cheekRight =
      THREE.MathUtils.clamp(cheekAmount * 0.18, 0.004, 0.018) *
      modulationProfile.cheekWarmthMultiplier *
      (eventDirection(cheekEvent, 11) > 0 ? 0.76 : 1);
  }

  if (headEvent) {
    contribution.headYaw =
      THREE.MathUtils.clamp(headEvent.intensity * 0.62, 0.003, 0.009) *
      eventDirection(headEvent, 17);
    contribution.headTilt =
      THREE.MathUtils.clamp(headEvent.intensity * 0.38, 0.002, 0.006) *
      eventDirection(headEvent, 23);
  }

  contribution.eyeUp = THREE.MathUtils.clamp(contribution.eyeUp, 0, 0.025);
  contribution.eyeDown = THREE.MathUtils.clamp(
    contribution.eyeDown +
      ((modulationProfile as { thinkingDownBiasMultiplier?: number })
        .thinkingDownBiasMultiplier
        ? 0.006 *
          ((modulationProfile as { thinkingDownBiasMultiplier?: number })
            .thinkingDownBiasMultiplier ?? 1)
        : 0),
    0,
    0.03
  );
  contribution.smileLeft = THREE.MathUtils.clamp(contribution.smileLeft, 0, 0.025);
  contribution.smileRight = THREE.MathUtils.clamp(contribution.smileRight, 0, 0.025);
  contribution.cheekLeft = THREE.MathUtils.clamp(contribution.cheekLeft, 0, 0.018);
  contribution.cheekRight = THREE.MathUtils.clamp(contribution.cheekRight, 0, 0.018);

  return contribution;
}

function resolveJordanListeningBehaviorContribution(
  events: JordanBehaviorTimingEvent[],
  nowMs: number,
  sentimentLabel: string,
  modulationProfile: JordanEmotionalModulationProfile,
): JordanListeningBehaviorContribution {
  const contribution = { ...EMPTY_JORDAN_LISTENING_BEHAVIOR_CONTRIBUTION };
  const concernedSentiment = hasConcernedJordanListeningSentiment(sentimentLabel);
  const concernScale =
    (modulationProfile as { concernMultiplier?: number }).concernMultiplier ?? 1;
  const smileScale = (concernedSentiment ? 0.35 : 1) * modulationProfile.smileMultiplier;

  const ackTypes: JordanBehaviorTimingEvent["type"][] = [
    "listening_ack",
    "user_sentence_end",
    "user_pause_ack",
  ];
  const ackBrowEvent = strongestJordanChannelEventOfTypes(events, ackTypes, "brow", nowMs);
  if (ackBrowEvent) {
    const browRamp = jordanBehaviorEventRamp(ackBrowEvent, nowMs, 0, 220);
    contribution.brow = Math.max(
      contribution.brow,
      THREE.MathUtils.clamp(ackBrowEvent.intensity * 1.1, 0.02, 0.07) * browRamp
    );
  }

  const ackMouthEvent = strongestJordanChannelEventOfTypes(events, ackTypes, "mouth", nowMs);
  if (ackMouthEvent) {
    const smileRamp = jordanBehaviorEventRamp(ackMouthEvent, nowMs, 140, 260);
    const smile = THREE.MathUtils.clamp(ackMouthEvent.intensity * 0.85, 0.02, 0.06) * smileRamp * smileScale;
    contribution.smileLeft = Math.max(contribution.smileLeft, smile * (eventDirection(ackMouthEvent, 5) > 0 ? 1 : 0.82));
    contribution.smileRight = Math.max(contribution.smileRight, smile * (eventDirection(ackMouthEvent, 5) > 0 ? 0.82 : 1));
  }

  const ackCheekEvent = strongestJordanChannelEventOfTypes(events, ackTypes, "cheek", nowMs);
  if (ackCheekEvent) {
    const smileRamp = jordanBehaviorEventRamp(ackCheekEvent, nowMs, 140, 260);
    const cheek =
      THREE.MathUtils.clamp(ackCheekEvent.intensity * 0.7, 0.015, 0.05) *
      smileRamp *
      modulationProfile.cheekWarmthMultiplier;
    contribution.cheekLeft = Math.max(contribution.cheekLeft, cheek);
    contribution.cheekRight = Math.max(contribution.cheekRight, cheek * 0.92);
  }

  const ackHeadEvent = strongestJordanChannelEventOfTypes(events, ackTypes, "head", nowMs);
  if (ackHeadEvent) {
    const headRamp = jordanBehaviorEventRamp(ackHeadEvent, nowMs, 220, 320);
    contribution.headTilt += THREE.MathUtils.clamp(ackHeadEvent.intensity * 0.16, 0.003, 0.01) * headRamp * eventDirection(ackHeadEvent, 9);
  }

  const softSmileEvent = strongestJordanChannelEvent(events, "listening_soft_smile", "mouth", nowMs);
  if (softSmileEvent) {
    const smileRamp = jordanBehaviorEventRamp(softSmileEvent, nowMs, 120, 340);
    const smile = THREE.MathUtils.clamp(softSmileEvent.intensity, 0.015, 0.055) * smileRamp * smileScale;
    contribution.smileLeft = Math.max(contribution.smileLeft, smile * 0.95);
    contribution.smileRight = Math.max(contribution.smileRight, smile);
  }

  const softSmileCheekEvent = strongestJordanChannelEvent(events, "listening_soft_smile", "cheek", nowMs);
  if (softSmileCheekEvent) {
    const smileRamp = jordanBehaviorEventRamp(softSmileCheekEvent, nowMs, 120, 340);
    const cheek = THREE.MathUtils.clamp(softSmileCheekEvent.intensity * 0.82, 0.012, 0.045) * smileRamp;
    contribution.cheekLeft = Math.max(contribution.cheekLeft, cheek * 0.92);
    contribution.cheekRight = Math.max(contribution.cheekRight, cheek);
  }

  const empathyEvent = strongestJordanChannelEventOfTypes(
    events,
    ["empathy_soften", "emotional_emphasis"],
    "brow",
    nowMs
  );
  const concernEvent = strongestJordanChannelEventOfTypes(
    events,
    ["brow_concern", "emotional_emphasis"],
    "brow",
    nowMs
  );
  const strongestConcernEvent =
    empathyEvent && concernEvent
      ? empathyEvent.intensity >= concernEvent.intensity
        ? empathyEvent
        : concernEvent
      : empathyEvent ?? concernEvent;
  if (strongestConcernEvent) {
    const browRamp = jordanBehaviorEventRamp(strongestConcernEvent, nowMs, 0, 260);
    const concernRamp = jordanBehaviorEventRamp(strongestConcernEvent, nowMs, 120, 360);
    contribution.brow = Math.max(
      contribution.brow,
      THREE.MathUtils.clamp(strongestConcernEvent.intensity * 1.15, 0.02, 0.07) *
        browRamp *
        concernScale
    );
    void concernRamp;
    contribution.emotionalLatencyScale = concernedSentiment ? 1.25 : 1;
  }

  const concernMouthEvent =
    strongestJordanChannelEventOfTypes(
      events,
      ["empathy_soften", "emotional_emphasis"],
      "mouth",
      nowMs
    ) ??
    strongestJordanChannelEventOfTypes(
      events,
      ["brow_concern", "emotional_emphasis"],
      "mouth",
      nowMs
    );
  if (concernMouthEvent && (concernedSentiment || concernMouthEvent.type === "empathy_soften")) {
    const concernRamp = jordanBehaviorEventRamp(concernMouthEvent, nowMs, 120, 360);
    contribution.frownLeft = Math.max(
      contribution.frownLeft,
      THREE.MathUtils.clamp(concernMouthEvent.intensity, 0.02, 0.07) *
        concernRamp *
        concernScale
    );
    contribution.frownRight = Math.max(
      contribution.frownRight,
      THREE.MathUtils.clamp(concernMouthEvent.intensity * 0.92, 0.02, 0.07) *
        concernRamp *
        concernScale
    );
    contribution.sad = Math.max(
      contribution.sad,
      THREE.MathUtils.clamp(concernMouthEvent.intensity * 1.7, 0.04, 0.12) *
        concernRamp *
        concernScale
    );
    contribution.smileMultiplier = Math.min(contribution.smileMultiplier, concernedSentiment ? 0.35 : 0.55);
  }

  const browLiftEvent = strongestJordanChannelEvent(events, "brow_soft_lift", "brow", nowMs);
  if (browLiftEvent) {
    contribution.brow = Math.max(
      contribution.brow,
      THREE.MathUtils.clamp(browLiftEvent.intensity, 0.015, 0.06) *
        jordanBehaviorEventRamp(browLiftEvent, nowMs, 0, 220)
    );
  }

  const eyeEvent = strongestJordanChannelEventOfTypes(
    events,
    ["eye_refocus", "anticipation_focus", "pre_speech_focus"],
    "eye",
    nowMs
  );
  if (eyeEvent) {
    const eyeAmount =
      THREE.MathUtils.clamp(eyeEvent.intensity, 0.008, 0.028) *
      jordanBehaviorEventRamp(eyeEvent, nowMs, 180, 260) *
      modulationProfile.eyeEngagementMultiplier;
    if (eventDirection(eyeEvent, 13) > 0) {
      contribution.eyeUp = Math.max(contribution.eyeUp, eyeAmount);
    } else {
      contribution.eyeDown = Math.max(contribution.eyeDown, eyeAmount);
    }
    contribution.eyeAsym = eyeAmount * 0.12 * eventDirection(eyeEvent, 19);
  }

  const pauseEvent = strongestJordanChannelEventOfTypes(
    events,
    ["soft_processing_pause", "processing_pause", "long_pause_stillness"],
    "eye",
    nowMs
  );
  if (pauseEvent) {
    const pauseRamp = jordanBehaviorEventRamp(pauseEvent, nowMs, 0, 420);
    contribution.eyeDown = Math.max(
      contribution.eyeDown,
      0.01 *
        pauseRamp *
        (((modulationProfile as { thinkingDownBiasMultiplier?: number })
          .thinkingDownBiasMultiplier ?? 1))
    );
    contribution.brow = Math.max(contribution.brow, 0.018 * pauseRamp);
    contribution.smileMultiplier = Math.min(contribution.smileMultiplier, 0.72);
  }

  const headTiltEvent = strongestJordanChannelEvent(events, "micro_head_tilt", "head", nowMs);
  if (headTiltEvent) {
    const headRamp = jordanBehaviorEventRamp(headTiltEvent, nowMs, 180, 360);
    contribution.headTilt +=
      THREE.MathUtils.clamp(headTiltEvent.intensity * 0.58, 0.003, 0.01) *
      headRamp *
      eventDirection(headTiltEvent, 29);
    contribution.headYaw +=
      THREE.MathUtils.clamp(headTiltEvent.intensity * 0.42, 0.003, 0.008) *
      headRamp *
      eventDirection(headTiltEvent, 31);
  }

  const headShakeEvent = strongestJordanChannelEvent(events, "micro_head_shake", "head", nowMs);
  if (headShakeEvent) {
    contribution.headYaw +=
      THREE.MathUtils.clamp(headShakeEvent.intensity * 0.34, 0.003, 0.008) *
      jordanBehaviorEventRamp(headShakeEvent, nowMs, 120, 340) *
      eventDirection(headShakeEvent, 37);
  }

  contribution.brow = THREE.MathUtils.clamp(contribution.brow, 0, 0.08);
  contribution.smileLeft = THREE.MathUtils.clamp(contribution.smileLeft, 0, 0.06);
  contribution.smileRight = THREE.MathUtils.clamp(contribution.smileRight, 0, 0.06);
  contribution.cheekLeft = THREE.MathUtils.clamp(contribution.cheekLeft, 0, 0.05);
  contribution.cheekRight = THREE.MathUtils.clamp(contribution.cheekRight, 0, 0.05);
  contribution.frownLeft = THREE.MathUtils.clamp(contribution.frownLeft, 0, 0.07);
  contribution.frownRight = THREE.MathUtils.clamp(contribution.frownRight, 0, 0.07);
  contribution.sad = THREE.MathUtils.clamp(contribution.sad, 0, 0.12);
  contribution.headYaw = THREE.MathUtils.clamp(contribution.headYaw, -0.01, 0.01);
  contribution.headTilt = THREE.MathUtils.clamp(contribution.headTilt, -0.01, 0.01);

  return contribution;
}

function resolveJordanSpeakingBehaviorContribution({
  events,
  releaseEvents,
  nowMs,
  sentimentLabel,
  speechEnergy,
  modulationProfile,
}: {
  events: JordanBehaviorTimingEvent[];
  releaseEvents: JordanBehaviorTimingEvent[];
  nowMs: number;
  sentimentLabel: string;
  speechEnergy: number;
  modulationProfile: JordanEmotionalModulationProfile;
}): JordanSpeakingBehaviorContribution {
  const contribution = { ...EMPTY_JORDAN_SPEAKING_BEHAVIOR_CONTRIBUTION };
  const concernedSentiment = hasConcernedJordanListeningSentiment(sentimentLabel);
  const positiveSentiment = sentimentLabel.toLowerCase().includes("positive") ||
    sentimentLabel.toLowerCase().includes("happy");
  const energy = THREE.MathUtils.clamp(speechEnergy, 0, 1);
  const energyCurve = Math.pow(energy, 0.85);
  const rangeByEnergy = (range: readonly [number, number], scale = 1) =>
    THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(range[0], range[1], energyCurve) * scale,
      0,
      JORDAN_SPEAKING_BEHAVIOR_TUNING.maxSpeakingSupport
    );

  contribution.cheekLeft = rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.cheekEnergyRange, 0.92);
  contribution.cheekRight = rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.cheekEnergyRange, 1.02);
  contribution.cheekLeft *= modulationProfile.cheekWarmthMultiplier;
  contribution.cheekRight *= modulationProfile.cheekWarmthMultiplier;
  contribution.brow = rangeByEnergy(
    JORDAN_SPEAKING_BEHAVIOR_TUNING.browEnergyRange,
    concernedSentiment ? 0.72 : positiveSentiment ? 1.05 : 0.88
  );
  contribution.brow *=
    (modulationProfile as { concernMultiplier?: number }).concernMultiplier ?? 1;

  if (positiveSentiment) {
    contribution.smileLeft =
      rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.smileEnergyRange, 0.92) *
      modulationProfile.smileMultiplier;
    contribution.smileRight =
      rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.smileEnergyRange, 1.02) *
      modulationProfile.smileMultiplier;
  } else if (concernedSentiment) {
    contribution.frownLeft = rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.frownEnergyRange, 0.95);
    contribution.frownRight = rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.frownEnergyRange, 0.9);
    contribution.frownLeft *=
      (modulationProfile as { concernMultiplier?: number }).concernMultiplier ?? 1;
    contribution.frownRight *=
      (modulationProfile as { concernMultiplier?: number }).concernMultiplier ?? 1;
    contribution.sad = THREE.MathUtils.clamp(
      (0.04 + energyCurve * 0.05) *
        ((modulationProfile as { concernMultiplier?: number }).concernMultiplier ?? 1),
      0,
      0.12
    );
  } else {
    contribution.smileLeft =
      rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.smileEnergyRange, 0.35) *
      modulationProfile.smileMultiplier;
    contribution.smileRight =
      rangeByEnergy(JORDAN_SPEAKING_BEHAVIOR_TUNING.smileEnergyRange, 0.42) *
      modulationProfile.smileMultiplier;
  }

  const emphasisEvent = strongestJordanChannelEventOfTypes(
    events,
    ["speaking_emphasis", "emotional_emphasis", "pre_speech_focus"],
    "brow",
    nowMs
  );
  if (emphasisEvent) {
    const ramp = jordanBehaviorEventRamp(emphasisEvent, nowMs, 0, 220);
    contribution.brow = Math.max(
      contribution.brow,
      THREE.MathUtils.clamp(emphasisEvent.intensity, 0.012, 0.06) * ramp
    );
  }

  const emphasisHeadEvent = strongestJordanChannelEvent(events, "speaking_emphasis", "head", nowMs);
  if (emphasisHeadEvent) {
    const ramp = jordanBehaviorEventRamp(emphasisHeadEvent, nowMs, 120, 280);
    contribution.headTilt +=
      THREE.MathUtils.clamp(
        emphasisHeadEvent.intensity * 0.28,
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[0],
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[1]
      ) *
      ramp *
      eventDirection(emphasisHeadEvent, 41);
  }

  const softenEvent = strongestJordanChannelEvent(events, "speaking_soften", "mouth", nowMs);
  if (softenEvent) {
    const ramp = jordanBehaviorEventRamp(softenEvent, nowMs, 120, 320);
    const smile = THREE.MathUtils.clamp(softenEvent.intensity * 0.7, 0.01, 0.045) * ramp;
    contribution.smileLeft = Math.max(contribution.smileLeft, smile * 0.9);
    contribution.smileRight = Math.max(contribution.smileRight, smile);
  }

  const softenCheekEvent = strongestJordanChannelEvent(events, "speaking_soften", "cheek", nowMs);
  if (softenCheekEvent) {
    const ramp = jordanBehaviorEventRamp(softenCheekEvent, nowMs, 160, 340);
    const cheek = THREE.MathUtils.clamp(softenCheekEvent.intensity * 0.58, 0.008, 0.04) * ramp;
    contribution.cheekLeft = Math.max(contribution.cheekLeft, cheek * 0.8);
    contribution.cheekRight = Math.max(contribution.cheekRight, cheek * 0.86);
  }

  const eyeEvent = strongestJordanChannelEventOfTypes(
    events,
    ["eye_refocus", "anticipation_focus", "pre_speech_focus"],
    "eye",
    nowMs
  );
  if (eyeEvent) {
    const eyeAmount =
      THREE.MathUtils.clamp(
        eyeEvent.intensity,
        JORDAN_SPEAKING_BEHAVIOR_TUNING.eyeRefocusRange[0],
        JORDAN_SPEAKING_BEHAVIOR_TUNING.eyeRefocusRange[1]
      ) *
      jordanBehaviorEventRamp(eyeEvent, nowMs, 180, 300) *
      modulationProfile.eyeEngagementMultiplier;
    if (eventDirection(eyeEvent, 43) > 0) {
      contribution.eyeUp = eyeAmount;
    } else {
      contribution.eyeDown = eyeAmount;
    }
    contribution.eyeAsym = eyeAmount * 0.1 * eventDirection(eyeEvent, 47);
  }

  const headEvent = strongestJordanChannelEvent(events, "micro_head_tilt", "head", nowMs);
  if (headEvent) {
    const ramp = jordanBehaviorEventRamp(headEvent, nowMs, 180, 320);
    contribution.headYaw +=
      THREE.MathUtils.clamp(
        headEvent.intensity * 0.34,
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportYawRange[0],
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportYawRange[1]
      ) *
      ramp *
      eventDirection(headEvent, 53);
    contribution.headTilt +=
      THREE.MathUtils.clamp(
        headEvent.intensity * 0.24,
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[0],
        JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[1]
      ) *
      ramp *
      eventDirection(headEvent, 59);
  }

  const pauseEvent = strongestJordanChannelEventOfTypes(
    events,
    ["soft_processing_pause", "processing_pause"],
    "eye",
    nowMs
  );
  const settleEvent = strongestJordanChannelEventOfTypes(
    events,
    ["speaking_settle", "jordan_sentence_end", "turn_taking_settle"],
    "eye",
    nowMs
  );
  const releaseEvent = strongestJordanChannelEventOfTypes(
    releaseEvents,
    ["turn_end_release", "post_speech_release", "jordan_sentence_end"],
    "eye",
    nowMs
  );
  const settlingEvent = releaseEvent ?? settleEvent ?? pauseEvent;
  if (settlingEvent) {
    const settleRamp = jordanBehaviorEventRamp(settlingEvent, nowMs, 0, 420);
    contribution.softProcessingPauseActive =
      settlingEvent.type === "soft_processing_pause" || settlingEvent.type === "speaking_settle";
    contribution.turnEndReleaseActive = settlingEvent.type === "turn_end_release";
    contribution.eyeDown = Math.max(
      contribution.eyeDown,
      0.01 *
        settleRamp *
        (((modulationProfile as { thinkingDownBiasMultiplier?: number })
          .thinkingDownBiasMultiplier ?? 1))
    );
    contribution.brow *= 1 - 0.35 * settleRamp;
    contribution.smileLeft *= 1 - 0.45 * settleRamp;
    contribution.smileRight *= 1 - 0.45 * settleRamp;
    contribution.cheekLeft *= 1 - 0.35 * settleRamp;
    contribution.cheekRight *= 1 - 0.35 * settleRamp;
    contribution.headYaw += 0.002 * settleRamp * eventDirection(settlingEvent, 61);
    contribution.headTilt += 0.002 * settleRamp * eventDirection(settlingEvent, 67);
  }

  contribution.cheekLeft = THREE.MathUtils.clamp(contribution.cheekLeft, 0, 0.07);
  contribution.cheekRight = THREE.MathUtils.clamp(contribution.cheekRight, 0, 0.07);
  contribution.brow = THREE.MathUtils.clamp(contribution.brow, 0, 0.06);
  contribution.smileLeft = THREE.MathUtils.clamp(contribution.smileLeft, 0, 0.055);
  contribution.smileRight = THREE.MathUtils.clamp(contribution.smileRight, 0, 0.055);
  contribution.frownLeft = THREE.MathUtils.clamp(contribution.frownLeft, 0, 0.055);
  contribution.frownRight = THREE.MathUtils.clamp(contribution.frownRight, 0, 0.055);
  contribution.headYaw = THREE.MathUtils.clamp(contribution.headYaw, -0.007, 0.007);
  contribution.headTilt = THREE.MathUtils.clamp(contribution.headTilt, -0.006, 0.006);

  return contribution;
}

const SHOW_ROOM = false;

function ThreeAvatarComponent({
  isSpeaking,
  isListening,
  isThinking,
  /** Per-frame mouth driver (mic or TTS RMS). State props lag behind RAF; ref does not. */
  mouthAudioLevelRef,
  speechTextRef,
  speechCharIndexRef,
  speechPulseRef,
  latestUserTextRef,
  latestJordanTextRef,
  userSpeechStartedAtMsRef,
  userLastSpeechAtMsRef,
  jordanSpeechStartedAtMsRef,
  jordanLastSpeechAtMsRef,
  sentimentCompoundRef,
  rawAvatarLabel,
  activeAvatarId,
  modelUrl,
  viewTuning,
  fixedViewportConfig,
  useRfv2Morphs,
  useSaraRfv2Preview,
  onSaraRfv2Fallback,
  avatarPhonemeTimelineRef,
  avatarAudioCurrentTimeRef,
}: {
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  mouthAudioLevelRef: MutableRefObject<number>;
  speechTextRef: MutableRefObject<string>;
  speechCharIndexRef: MutableRefObject<number>;
  speechPulseRef: MutableRefObject<number>;
  latestUserTextRef: MutableRefObject<string>;
  latestJordanTextRef: MutableRefObject<string>;
  userSpeechStartedAtMsRef: MutableRefObject<number>;
  userLastSpeechAtMsRef: MutableRefObject<number>;
  jordanSpeechStartedAtMsRef: MutableRefObject<number>;
  jordanLastSpeechAtMsRef: MutableRefObject<number>;
  sentimentCompoundRef: MutableRefObject<number | undefined>;
  rawAvatarLabel: string | undefined;
  activeAvatarId: string | null;
  /** Resolved GLB URL for the selected companion (see `resolveCompanionModelUrl`). */
  modelUrl: string;
  /** Framing + mouth strength for this companion’s GLB (see `getCompanionViewTuning`). */
  viewTuning: CompanionViewTuning;
  fixedViewportConfig?: FixedAvatarViewportConfig | null;
  useRfv2Morphs: boolean;
  useSaraRfv2Preview: boolean;
  onSaraRfv2Fallback?: (reason: string) => void;
  avatarPhonemeTimelineRef: MutableRefObject<AvatarPhonemeTimeline | null>;
  avatarAudioCurrentTimeRef: MutableRefObject<number>;
}) {
  const [avatarLoadState, setAvatarLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [avatarLoadProgress, setAvatarLoadProgress] = useState<number | null>(
    null
  );
  const [jordanPhonemeDebug, setJordanPhonemeDebug] =
    useState<JordanPhonemeDebugState>(EMPTY_JORDAN_PHONEME_DEBUG_STATE);

  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const isThinkingRef = useRef(isThinking);
  const lastSpeechPulseSeenRef = useRef(0);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Different morphs respond very differently. On many rigs a generic "mouth"
  // morph balloons the lower lip if overdriven; "jaw/open" is usually safer to boost.
  // Favor jaw/mouth-open targets for visible teeth opening.
  // Keep generic lip-shape targets conservative to avoid deformation.
  const JAW_GAIN = 142;
  const JAW_MAX = 176;
  const MOUTH_GAIN = 5;
  const MOUTH_MAX = 10;
  const OTHER_MOUTH_GAIN = 22;
  const OTHER_MOUTH_MAX = 34;

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRootRef = useRef<THREE.Group | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);

  const baseScaleRef = useRef(1);
  const mouthDriveMultRef = useRef(viewTuning.mouthDriveMultiplier);
  const avatarMode: AvatarRenderMode = useRfv2Morphs ? "rfv2Morph" : "legacyHybrid";
  const saraRfv2PreviewActive =
    import.meta.env.DEV === true &&
    useSaraRfv2Preview &&
    activeAvatarId === "sarah" &&
    !useRfv2Morphs;
  const isSaraAvatar = SARA_HYBRID_AVATAR_IDS.has(activeAvatarId);
    const isSaraV3Avatar = activeAvatarId === "saraV3";
    const saraV3RawAuditMode =
      isSaraV3Avatar && SARA_V3_AVATAR_DEFINITION.saraV3.rawRenderAuditMode;
  const modelMatchesSaraHybrid =
    modelUrl === SARA_V2_AVATAR_DEFINITION.model.url;
  const modelMatchesSaraV3 = modelUrl === SARA_V3_AVATAR_DEFINITION.model.url;
  const isSaraV2Viewport =
    isSaraFixedViewportConfig(fixedViewportConfig) &&
    fixedViewportConfig.camera.mode === "fixed" &&
    !useRfv2Morphs &&
    !saraRfv2PreviewActive &&
    modelMatchesSaraHybrid;
  const isSaraHybrid =
    isSaraAvatar &&
    avatarMode === "legacyHybrid" &&
    isSaraV2Viewport &&
    !saraRfv2PreviewActive;
  const saraHybridPresenceReason = getSaraHybridPresenceDisabledReason({
    isSaraAvatar,
    isLegacyHybrid: avatarMode === "legacyHybrid",
    isSaraHybrid,
    isRfv2Preview: saraRfv2PreviewActive,
    isRfv2MorphMode: useRfv2Morphs,
    modelMatchesSaraHybrid,
  });
  mouthDriveMultRef.current = viewTuning.mouthDriveMultiplier;

  const mouthBindingsRef = useRef<MorphBinding[]>([]);
  const blinkBindingsRef = useRef<MorphBinding[]>([]);
  // const jawBoneRef = useRef<THREE.Bone | null>(null);
  // const jawDefaultRotXRef = useRef<number | null>(null);
  const jordanMorphBindingsRef = useRef<Map<JordanMorphName, MorphBinding[]>>(new Map());
  const jordanMorphValuesRef = useRef<Map<JordanMorphName, number>>(new Map());
  const saraV2PhonemeMorphValuesRef = useRef<Map<string, number>>(new Map());
  const saraV2PresenceBindingsRef = useRef<Map<string, MorphBinding[]>>(new Map());
  const saraV2BlinkTestRef = useRef<SaraV2BlinkTestState>({
    left: null,
    right: null,
    lastCommand: null,
    updatedAtMs: null,
  });
  const saraV2PresenceStateRef = useRef<SaraV2PresenceState>(
    createSaraV2PresenceState()
  );
  const previousSaraV2VisemeRef = useRef<string | null>(null);
  const saraV2ClipHasValidPhonemeTimelineRef = useRef(false);
  const saraV2WasSpeakingRef = useRef(false);
  const saraV2LastSpeechEndMsRef = useRef<number | null>(null);
  const loggedMissingSaraV2PhonemeMorphsRef = useRef<Set<string>>(new Set());
  const saraGreetingFirstVisemeLoggedRef = useRef(false);
  const saraV2RecentActivePhonemesRef = useRef<SaraV2RecentActivePhonemeDiagnostic[]>([]);
  const saraV2LastRecentPhonemeKeyRef = useRef("");
  const saraRfv2BindingsRef = useRef<readonly SaraRfv2FaceMorphBinding[]>([]);
  const saraRfv2ApplierStateRef = useRef<SaraRfv2MorphApplierState>(
    createSaraRfv2MorphApplierState()
  );
  const saraRfv2PhonemeStateRef = useRef<SaraRfv2PhonemeState>(
    createSaraRfv2PhonemeState()
  );
  const saraRfv2SmoothingStateRef = useRef<SaraRfv2SmoothingState>(
    createSaraRfv2SmoothingState()
  );
  const saraRfv2ApplierDiagnosticsRef =
    useRef<SaraRfv2MorphApplierDiagnostics>(
      SARA_RFV2_MORPH_APPLIER_EMPTY_DIAGNOSTICS
    );
  const saraRfv2AssetDiagnosticsRef = useRef<SaraRfv2PreviewAssetDiagnostics>(
    createEmptySaraRfv2PreviewAssetDiagnostics()
  );
  const saraRfv2BindingRetryCountRef = useRef(0);
  const saraRfv2FallbackTriggeredRef = useRef(false);
  const saraV3ControllerRef = useRef<SaraV3ControllerState | null>(null);
  const saraV3VisemeStateRef = useRef<SaraV3VisemeDriverState>(
    createSaraV3VisemeDriverState()
  );
  const saraV3EyeStateRef = useRef<SaraV3EyeRuntimeState>(
    createSaraV3EyeRuntimeState()
  );
  const saraV3ExpressionStateRef = useRef<SaraV3ExpressionState>(
    createSaraV3ExpressionState()
  );
  const saraV3SmileStateRef = useRef<SaraV3SmileRuntimeState>(
    createSaraV3SmileRuntimeState()
  );
  const saraV3PresenceStateRef = useRef<SaraV3PresenceState>(
    createSaraV3PresenceState()
  );
  const eyelidBonesRef = useRef<THREE.Bone[]>([]);
  const eyelidDefaultRotXRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultRotZRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultRotYRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultPosYRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultPosZRef = useRef<Map<string, number>>(new Map());
  const lipBonesUpperRef = useRef<THREE.Bone[]>([]);
  const lipBonesLowerRef = useRef<THREE.Bone[]>([]);
  const lipDefaultRotXRef = useRef<Map<string, number>>(new Map());
  const jawBonesRef = useRef<THREE.Bone[]>([]);
  const chinBonesRef = useRef<THREE.Bone[]>([]);
  const jawlineBonesRef = useRef<THREE.Bone[]>([]);
  const mouthInteriorBonesRef = useRef<THREE.Bone[]>([]);
  const underChinBonesRef = useRef<THREE.Bone[]>([]);
  const cheekBindingsRef = useRef<MorphBinding[]>([]);
  const cheekBonesRef = useRef<THREE.Bone[]>([]);
  const lastMouthFrameTimeRef = useRef(performance.now());
  /** Follows mouth envelope with a short delay (secondary motion for lips vs jaw). */
  const lipDelayedRef = useRef(0);
  const lastJordanDiagnosticLogRef = useRef(0);
  const lastJordanDiagnosticVisemeRef = useRef<string>("");
  const lastJordanActiveVisemeRef = useRef<JordanMorphName | null>(null);
  const lastJordanMorphInfluenceRef = useRef<number>(0);
  const lastSaraV2MouthDiagnosticsLogRef = useRef(0);
  const loggedJordanTimelineKeyRef = useRef<string>("");
  const jordanPresenceStateRef = useRef<JordanPresenceState>("idle");
  const jordanBehaviorTimingStateRef = useRef<JordanBehaviorTimingState>(
    createJordanBehaviorTimingState()
  );
  const jordanBehaviorTimingNextUpdateRef = useRef(0);
  const lastJordanBehaviorTimingLogRef = useRef(0);
  const jordanSpeakingEnergyRef = useRef(0);
  const jordanEyeFocusTargetRef = useRef<JordanEyeFocusState>({
    up: 0,
    down: 0,
    asym: 0,
    yaw: 0,
    holding: true,
    holdMs: 0,
  });
  const jordanEyeNextRefocusRef = useRef(0);
  const lastJordanEyeFocusLogRef = useRef(0);
  const jordanEyeAsymmetryRef = useRef({
    mouthLeft: 0.97,
    mouthRight: 1.03,
    cheekLeft: 0.98,
    cheekRight: 1.02,
    blinkLeft: 1,
    blinkRight: 1,
  });
  const jordanListeningFaceTargetRef = useRef<JordanListeningFaceTarget>({
    ...EMPTY_JORDAN_LISTENING_FACE_TARGET,
  });
  const jordanListeningFaceAppliedRef = useRef<JordanListeningFaceTarget>({
    ...EMPTY_JORDAN_LISTENING_FACE_TARGET,
  });
  const jordanListeningFaceNextTargetRef = useRef(0);
  const jordanListeningFaceWasActiveRef = useRef(false);
  const lastJordanListeningFaceLogRef = useRef(0);
  const jordanIdleBrowTargetRef = useRef(0.01);
  const jordanIdleBrowAppliedRef = useRef(0);
  const jordanIdleBrowNextTargetRef = useRef(0);
  const jordanIdleBrowHoldMsRef = useRef(0);
  const lastJordanIdleBrowLogRef = useRef(0);
  const lastJordanExpressionPresetLogRef = useRef(0);
  const lastJordanMorphTestLogRef = useRef(0);
  const lastJordanPresenceLogRef = useRef(0);
  const lastJordanExpressionAuthorityLogRef = useRef(0);
  const loggedJordanExpressionAuthoritySummaryRef = useRef(false);
  const previousJordanSpeakingRef = useRef(false);
  const loggedNoJordanTimelineRef = useRef(false);
  const loggedDelayedJordanTimelineRef = useRef(false);
  const faceBoneDefaultsRef = useRef<
    Map<string, { x: number; y: number; z: number }>
  >(new Map());
  const jordanIdlePresenceBonesRef = useRef<THREE.Bone[]>([]);
  const jordanHeadPresenceTargetRef = useRef<JordanHeadPresenceTarget>({
    yaw: 0,
    tilt: 0,
  });
  const jordanHeadPresenceAppliedRef = useRef<JordanHeadPresenceTarget>({
    yaw: 0,
    tilt: 0,
  });
  const jordanHeadPresenceNextTargetRef = useRef(0);
  const lastJordanHeadPresenceLogRef = useRef(0);
  const mouthTargetRef = useRef(0);
  const mouthBaseRef = useRef(0);
  const mouthPulseRef = useRef(0);
  const mouthSmoothedRef = useRef(0);
  const lastBoundaryAtRef = useRef(0);

  const blinkRafRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);
  const speechEndBlinkTimeoutRef = useRef<number | null>(null);
  const blinkFnRef = useRef<((duration?: number, onDone?: () => void) => void) | null>(
    null
  );
  const lastJordanBlinkLogRef = useRef(0);
  const previousJordanBlinkPresenceRef = useRef<JordanPresenceState>("idle");
  const jordanPostListeningSoftBlinkRef = useRef(false);
  const jordanBlinkActiveRef = useRef(false);
  const lastJordanBlinkAtRef = useRef(0);
  const lastJordanSpeechEndAtRef = useRef(0);
  const previousJordanBlinkSpeakingRef = useRef(false);
  const speechEndBlinkPendingRef = useRef(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      import.meta.env.DEV !== true ||
      !isSaraHybrid
    ) {
      return;
    }

    const blinkTestControls = {
      forceBlink: (value: unknown) => {
        const blinkValue = clampSaraV2BlinkTestValue(value);
        saraV2BlinkTestRef.current = {
          left: blinkValue,
          right: blinkValue,
          lastCommand: "forceBlink",
          updatedAtMs: performance.now(),
        };
      },
      forceLeftBlink: (value: unknown) => {
        const blinkValue = clampSaraV2BlinkTestValue(value);
        saraV2BlinkTestRef.current = {
          ...saraV2BlinkTestRef.current,
          left: blinkValue,
          lastCommand: "forceLeftBlink",
          updatedAtMs: performance.now(),
        };
      },
      forceRightBlink: (value: unknown) => {
        const blinkValue = clampSaraV2BlinkTestValue(value);
        saraV2BlinkTestRef.current = {
          ...saraV2BlinkTestRef.current,
          right: blinkValue,
          lastCommand: "forceRightBlink",
          updatedAtMs: performance.now(),
        };
      },
      reset: () => {
        saraV2BlinkTestRef.current = {
          left: null,
          right: null,
          lastCommand: "reset",
          updatedAtMs: performance.now(),
        };
      },
      supportedValues: SARA_V2_BLINK_TEST_VALUES,
    };

    (window as any).saraV2BlinkTest = blinkTestControls;
    return () => {
      if ((window as any).saraV2BlinkTest === blinkTestControls) {
        delete (window as any).saraV2BlinkTest;
      }
      saraV2BlinkTestRef.current = {
        left: null,
        right: null,
        lastCommand: null,
        updatedAtMs: null,
      };
    };
  }, [isSaraHybrid]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setAvatarLoadState("loading");
    setAvatarLoadProgress(null);

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (_url, loaded, total) => {
      if (cancelled || total <= 0) return;
      setAvatarLoadProgress(loaded / total);
    };

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /** Softer rolloff in dark tones — reduces stepped “rings” on large curved surfaces. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    rendererRef.current = renderer;

    // Make the canvas fill the container exactly so it never overflows (which
    // would clip the top of the avatar under the parent's overflow-hidden).
    renderer.domElement.style.display = "block";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    container.appendChild(renderer.domElement);
    let saraV3EnvironmentHandle: ReturnType<typeof applySaraV3Environment> | null = null;
    const roomGroup = new THREE.Group();
    roomGroup.name = "AvatarVideoCallRoom";
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8d2c8,
      roughness: 0.82,
      metalness: 0.02,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
      depthWrite: false,
    });

    const backWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc,
      roughness: 0.88,
      metalness: 0.01,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
      depthWrite: false,
    });
    const sideWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xded8cf,
      roughness: 0.9,
      metalness: 0.01,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
      depthWrite: false,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMaterial);
    floor.name = "AvatarRoomFloor";
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -4.5, -6);
    floor.renderOrder = 0;
    roomGroup.add(floor);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), backWallMaterial);
    backWall.name = "AvatarRoomBackWall";
    backWall.position.set(0, 0.5, -10);
    backWall.renderOrder = 0;
    roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), sideWallMaterial);
    leftWall.name = "AvatarRoomLeftWall";
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5.5, 0.5, -6);
    leftWall.renderOrder = 0;
    roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), sideWallMaterial);
    rightWall.name = "AvatarRoomRightWall";
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5.5, 0.5, -6);
    rightWall.renderOrder = 0;
    roomGroup.add(rightWall);

    if (SHOW_ROOM) scene.add(roomGroup);
    // Lights
    scene.add(new THREE.AmbientLight(0xfff8ef, 1.1));
    scene.add(new THREE.HemisphereLight(0x9eb6d4, 0x1e2838, 0.38));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.setScalar(2048);
    keyLight.shadow.bias = -0.00025;
    keyLight.shadow.normalBias = 0.045;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff1df, 0.65);
    fillLight.position.set(-3, 2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x4466aa, 0.35);
    rimLight.position.set(-2, 5, -4);
    scene.add(rimLight);

    const roomWarmth = new THREE.PointLight(0xffc9a8, 0.45, 28);
    roomWarmth.position.set(1.5, 3.5, 2);
    scene.add(roomWarmth);

    /** Cyclorama-style room: curved backdrop (center recesses) + sides nearer the figure. */
    let sessionRoomGroup: THREE.Group | null = null;
    const room = new THREE.Group();
    room.name = "ezriSessionRoom";
    /** Shared grain texture — breaks up 8-bit banding on large smooth surfaces (not from the GLB). */
    let roomGrainTexture: THREE.DataTexture | null = null;

    const wallProps: THREE.MeshStandardMaterialParameters = {
      color: 0x2c3a4e,
      roughness: 0.94,
      metalness: 0.03,
      side: THREE.DoubleSide,
    };
    const curvedWallMat = new THREE.MeshStandardMaterial(wallProps);
    const sideWallMatL = new THREE.MeshStandardMaterial(wallProps);
    const sideWallMatR = new THREE.MeshStandardMaterial(wallProps);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2434,
      roughness: 0.91,
      metalness: 0.06,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x232f3f,
      roughness: 1,
      metalness: 0,
    });

    const arcSpan = Math.PI * 1.26;
    const thetaStart = -Math.PI / 2 - arcSpan / 2;

    /** Deeper outer bend — reads clearly on screen as a curved “bowl” behind the figure. */
    const BACK_CY_R_OUT = 28.5;
    const BACK_CY_Z_OUT = 10.75;
    const wallMatDeep = new THREE.MeshStandardMaterial({
      color: 0x1a2838,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    {
      const grainSize = 196;
      const grainData = new Uint8Array(grainSize * grainSize * 4);
      for (let i = 0; i < grainSize * grainSize; i++) {
        const g = 160 + Math.floor(Math.random() * 95);
        grainData[i * 4] = g;
        grainData[i * 4 + 1] = g;
        grainData[i * 4 + 2] = g;
        grainData[i * 4 + 3] = 255;
      }
      roomGrainTexture = new THREE.DataTexture(
        grainData,
        grainSize,
        grainSize,
        THREE.RGBAFormat
      );
      roomGrainTexture.wrapS = THREE.RepeatWrapping;
      roomGrainTexture.wrapT = THREE.RepeatWrapping;
      roomGrainTexture.repeat.set(12, 12);
      roomGrainTexture.colorSpace = THREE.NoColorSpace;
      roomGrainTexture.needsUpdate = true;
    }
    const roomMatsWithGrain: THREE.MeshStandardMaterial[] = [
      curvedWallMat,
      sideWallMatL,
      sideWallMatR,
      floorMat,
      ceilMat,
      wallMatDeep,
    ];
    for (const mat of roomMatsWithGrain) {
      mat.roughnessMap = roomGrainTexture;
      mat.roughness = 0.88;
      /* Tiny lift in albedo — eases 8-bit banding on navy surfaces. */
      mat.emissive = new THREE.Color(0x0d1522);
      mat.emissiveIntensity = 0.07;
    }

    const curvedBackdropOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BACK_CY_R_OUT,
        BACK_CY_R_OUT,
        38,
        192,
        1,
        true,
        thetaStart,
        arcSpan
      ),
      wallMatDeep
    );
    curvedBackdropOuter.position.set(0, 9, BACK_CY_Z_OUT);
    /* No receive — shadow maps on huge curves read as vertical “stripes” / layers. */
    curvedBackdropOuter.receiveShadow = false;
    room.add(curvedBackdropOuter);

    const BACK_CY_R = 11.75;
    /** Tighter radius + pushed back reads as a stronger “news cyclorama” wrap on camera. */
    const BACK_CY_Z = 4.65;

    const curvedBackdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BACK_CY_R,
        BACK_CY_R,
        36,
        192,
        1,
        true,
        thetaStart,
        arcSpan
      ),
      curvedWallMat
    );
    curvedBackdrop.position.set(0, 9, BACK_CY_Z);
    curvedBackdrop.receiveShadow = false;
    room.add(curvedBackdrop);

    /* Curved floor: stronger infinity-cove sweep (floor → wall) like a broadcast studio. */
    const floorGeo = new THREE.PlaneGeometry(48, 32, 40, 24);
    const floorPos = floorGeo.attributes.position;
    for (let i = 0; i < floorPos.count; i++) {
      const xl = floorPos.getX(i);
      const yl = floorPos.getY(i);
      const worldZ = -yl;
      const t = THREE.MathUtils.clamp((-worldZ - 2) / 18, 0, 1);
      const lift = t * t * 3.05;
      floorPos.setZ(i, lift);
      /* Bowl: bring lateral floor edges a bit closer to the avatar. */
      const side = Math.min(1, Math.abs(xl) / 20);
      floorPos.setY(i, yl - side * side * 0.52 * t);
    }
    floorPos.needsUpdate = true;
    floorGeo.computeVertexNormals();

    const stageFloor = new THREE.Mesh(floorGeo, floorMat);
    stageFloor.rotation.x = -Math.PI / 2;
    stageFloor.position.set(0, -2.35, 2);
    stageFloor.receiveShadow = true;
    room.add(stageFloor);

    /* Side wings: angle farther back so they meet a tighter cyclorama without a flat corner. */
    const sidePanelH = 29;
    const sidePanelW = 14;
    const leftWing = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanelW, sidePanelH),
      sideWallMatL
    );
    leftWing.position.set(-12.85, 9, -3.15);
    leftWing.rotation.set(0, Math.PI * 0.445, 0);
    leftWing.receiveShadow = false;
    room.add(leftWing);

    const rightWing = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanelW, sidePanelH),
      sideWallMatR
    );
    rightWing.position.set(12.85, 9, -3.15);
    rightWing.rotation.set(0, -Math.PI * 0.445, 0);
    rightWing.receiveShadow = false;
    room.add(rightWing);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 21.25, 0);
    room.add(ceiling);

    scene.add(room);
    sessionRoomGroup = room;

    // Reset refs
    mouthBindingsRef.current = [];
    blinkBindingsRef.current = [];
    saraV2PresenceBindingsRef.current = new Map();
    saraV2BlinkTestRef.current = {
      left: null,
      right: null,
      lastCommand: null,
      updatedAtMs: null,
    };
    saraV2RecentActivePhonemesRef.current = [];
    saraV2LastRecentPhonemeKeyRef.current = "";
    saraV2PresenceStateRef.current = createSaraV2PresenceState();
    jordanMorphBindingsRef.current = new Map();
    jordanMorphValuesRef.current = new Map(
      JORDAN_MORPH_NAMES.map((name) => [name, name === "viseme_rest" ? 0.25 : 0])
    );
    // jawBoneRef.current = null;
    // jawDefaultRotXRef.current = null;
    eyelidBonesRef.current = [];
    lipBonesUpperRef.current = [];
    lipBonesLowerRef.current = [];
    lipDefaultRotXRef.current = new Map();
    mouthTargetRef.current = 0;
    mouthSmoothedRef.current = 0;
    lipDelayedRef.current = 0;
    lastJordanActiveVisemeRef.current = null;
    lastJordanMorphInfluenceRef.current = 0;
    loggedJordanTimelineKeyRef.current = "";
    jordanPresenceStateRef.current = "idle";
    jordanBehaviorTimingStateRef.current = createJordanBehaviorTimingState();
    jordanBehaviorTimingNextUpdateRef.current = 0;
    lastJordanBehaviorTimingLogRef.current = 0;
    jordanSpeakingEnergyRef.current = 0;
    jordanEyeFocusTargetRef.current = { up: 0, down: 0, asym: 0, yaw: 0, holding: true, holdMs: 0 };
    jordanEyeNextRefocusRef.current = 0;
    lastJordanEyeFocusLogRef.current = 0;
    jordanEyeAsymmetryRef.current = {
      mouthLeft: 0.97,
      mouthRight: 1.03,
      cheekLeft: 0.98,
      cheekRight: 1.02,
      blinkLeft: 1,
      blinkRight: 1,
    };
    jordanListeningFaceTargetRef.current = { ...EMPTY_JORDAN_LISTENING_FACE_TARGET };
    jordanListeningFaceAppliedRef.current = { ...EMPTY_JORDAN_LISTENING_FACE_TARGET };
    jordanListeningFaceNextTargetRef.current = 0;
    jordanListeningFaceWasActiveRef.current = false;
    lastJordanListeningFaceLogRef.current = 0;
    jordanIdleBrowTargetRef.current = JORDAN_IDLE_BROW_TUNING.baseMin;
    jordanIdleBrowAppliedRef.current = 0;
    jordanIdleBrowNextTargetRef.current = 0;
    jordanIdleBrowHoldMsRef.current = 0;
    lastJordanIdleBrowLogRef.current = 0;
    lastJordanExpressionPresetLogRef.current = 0;
    lastJordanMorphTestLogRef.current = 0;
    lastJordanPresenceLogRef.current = 0;
    lastJordanExpressionAuthorityLogRef.current = 0;
    loggedJordanExpressionAuthoritySummaryRef.current = false;
    jordanHeadPresenceTargetRef.current = { yaw: 0, tilt: 0 };
    jordanHeadPresenceAppliedRef.current = { yaw: 0, tilt: 0 };
    jordanHeadPresenceNextTargetRef.current = 0;
    lastJordanHeadPresenceLogRef.current = 0;
    lastJordanBlinkLogRef.current = 0;
    previousJordanBlinkPresenceRef.current = "idle";
    jordanPostListeningSoftBlinkRef.current = false;
    jordanBlinkActiveRef.current = false;
    lastJordanBlinkAtRef.current = 0;
    lastJordanSpeechEndAtRef.current = 0;
    previousJordanBlinkSpeakingRef.current = false;
    speechEndBlinkPendingRef.current = false;
    previousJordanSpeakingRef.current = false;
    loggedNoJordanTimelineRef.current = false;
    loggedDelayedJordanTimelineRef.current = false;
    jawBonesRef.current = [];
    chinBonesRef.current = [];
    jawlineBonesRef.current = [];
    mouthInteriorBonesRef.current = [];
    underChinBonesRef.current = [];
    cheekBindingsRef.current = [];
    cheekBonesRef.current = [];
    saraRfv2BindingsRef.current = [];
    saraRfv2ApplierStateRef.current = createSaraRfv2MorphApplierState();
    saraRfv2PhonemeStateRef.current = createSaraRfv2PhonemeState();
    saraRfv2SmoothingStateRef.current = createSaraRfv2SmoothingState();
    saraRfv2ApplierDiagnosticsRef.current =
      SARA_RFV2_MORPH_APPLIER_EMPTY_DIAGNOSTICS;
    saraRfv2AssetDiagnosticsRef.current =
      createEmptySaraRfv2PreviewAssetDiagnostics();
    saraRfv2BindingRetryCountRef.current = 0;
    saraRfv2FallbackTriggeredRef.current = false;
    saraV3ControllerRef.current = null;
    saraV3VisemeStateRef.current = createSaraV3VisemeDriverState();
    saraV3EyeStateRef.current = createSaraV3EyeRuntimeState();
    saraV3ExpressionStateRef.current = createSaraV3ExpressionState();
    saraV3SmileStateRef.current = createSaraV3SmileRuntimeState();
    saraV3PresenceStateRef.current = createSaraV3PresenceState();
    faceBoneDefaultsRef.current = new Map();
    jordanIdlePresenceBonesRef.current = [];
    avatarRootRef.current = null;
    const loader = new GLTFLoader(loadingManager);

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        const gltfScene = gltf.scene;
        modelRef.current = gltfScene;
        const fixedCameraConfig = fixedViewportConfig?.camera;
        const fixedGltfTransform = fixedViewportConfig?.gltfTransform;
        const fixedViewportDebugLabel =
          fixedViewportConfig?.debugLabel ?? "fixedViewport";
        const hasFixedViewportConfig =
          !useRfv2Morphs && fixedCameraConfig?.mode === "fixed";
        const isSaraViewport = isSaraFixedViewportConfig(fixedViewportConfig);
        const useSaraLabAlignedViewport = hasFixedViewportConfig && isSaraViewport;
        if (saraV3RawAuditMode) {
          console.info("[SaraV3 raw audit] Loading untouched GLB scene", {
            activeAvatarId,
            modelUrl,
          });
          scene.add(gltfScene);
          gltfScene.updateMatrixWorld(true);
          const fixedCamera = fixedCameraConfig ?? {};
          const cameraPosition = vector3FromConfig(fixedCamera.position, [0, 0.55, 3.0]);
          const cameraLookAt = vector3FromConfig(fixedCamera.lookAt, [0, 0.65, 0]);
          camera.fov = fixedCamera.fov ?? 11;
          camera.near = 0.01;
          camera.far = 100;
          camera.position.copy(cameraPosition);
          camera.lookAt(cameraLookAt);
          camera.userData.fixedLookAt = cameraLookAt.toArray();
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          const saraV3EnvironmentComparison =
            SARA_V3_AVATAR_DEFINITION.saraV3.environmentConfig.captureComparisonDiagnostics
              ? captureSaraV3EnvironmentComparison({
                  root: gltfScene,
                  scene,
                  camera,
                  renderer,
                  applyEnvironment: () => {
                    saraV3EnvironmentHandle = applySaraV3Environment({
                      scene,
                      renderer,
                    });
                    return saraV3EnvironmentHandle;
                  },
                })
              : null;
          if (!saraV3EnvironmentComparison) {
            saraV3EnvironmentHandle = applySaraV3Environment({
              scene,
              renderer,
            });
            renderer.render(scene, camera);
          }
          if (typeof window !== "undefined") {
            (window as any).saraV3EnvironmentDiagnostics = {
              environmentEnabled: SARA_V3_AVATAR_DEFINITION.saraV3.environmentConfig.enabled,
              environmentSource: saraV3EnvironmentHandle?.source ?? null,
              pmremGeneratorUsed: true,
              sceneEnvironmentAssigned: Boolean(scene.environment),
              sceneBackgroundChanged: false,
              beforeAfterComparison: saraV3EnvironmentComparison,
            };
          }
          runSaraV3RawRenderAudit({
            root: gltfScene,
            scene,
            camera,
            renderer,
            modelUrl,
            cameraAppliedInRawAudit: true,
            cameraConfigSource: "fixedCameraConfig",
            cameraLookAt,
          });
          if (!cancelled) {
            setAvatarLoadState("ready");
            setAvatarLoadProgress(1);
          }
          return;
        }
        if (
          isSaraV3Avatar &&
          !saraV3EnvironmentHandle &&
          SARA_V3_AVATAR_DEFINITION.saraV3.environmentConfig.enabled
        ) {
          saraV3EnvironmentHandle = applySaraV3Environment({
            scene,
            renderer,
          });
        }
        console.info("[Avatar Runtime Config]", {
          activeAvatarId,
          fixedConfigAvatarId: fixedViewportConfig?.avatarId ?? null,
          modelUrl,
          useRfv2Morphs,
          hasFixedViewportConfig,
          cameraConfig: fixedViewportConfig?.camera ?? null,
          gltfTransformConfig: fixedViewportConfig?.gltfTransform ?? null,
        });
        if (hasFixedViewportConfig && !isSaraViewport && !isSaraV3Avatar && fixedGltfTransform) {
          applyVector3Config(gltfScene.position, fixedGltfTransform.position, [
            0,
            0,
            0,
          ]);
          applyVector3Config(gltfScene.rotation, fixedGltfTransform.rotation, [
            0,
            0,
            0,
          ]);
          applyScaleConfig(gltfScene, fixedGltfTransform.scale, 1);
        } else if (useSaraLabAlignedViewport) {
          gltfScene.position.set(0, 0, 0);
          gltfScene.rotation.set(0, 0, 0);
          gltfScene.scale.set(1, 1, 1);
        } else if (isSaraV3Avatar) {
          const saraV3Layout = SARA_V3_AVATAR_DEFINITION.saraV3;
          applyVector3Config(gltfScene.position, saraV3Layout.position, [0, 0, 0]);
          applyVector3Config(gltfScene.rotation, saraV3Layout.rotation, [0, 0, 0]);
          applyScaleConfig(gltfScene, saraV3Layout.scale, 1);
        } else if (useRfv2Morphs) {
          gltfScene.position.set(0, -1.65, 0); // move avatar down shaz
          gltfScene.rotation.set(0, 0, 0);
          gltfScene.scale.set(1.35, 1.35, 1.35);
        } else {
          gltfScene.position.set(0, 0, 0);
          gltfScene.rotation.set(0, 0, 0);
          gltfScene.scale.set(1, 1, 1);
        }
        gltfScene.updateMatrixWorld(true);
        if (!isSaraViewport) {
          gltfScene.traverse((child: any) => {
            if (child.isSkinnedMesh && child.skeleton) {
              child.skeleton.pose();
            }
          });
          gltfScene.updateMatrixWorld(true);
        }
        // const model = gltf.scene;
        // modelRef.current = model;

        // 👇 ADD THIS (SAFE - DEBUG ONLY)
        (window as any).avatarGltf = gltf;
        (window as any).avatarModel = gltfScene;
        (window as any).avatarScene = scene;
        const diagnosticMeshes: Array<{ name: string; visible: boolean }> = [];
        const diagnosticBones: Array<{ name: string; world: THREE.Vector3 }> = [];
        const diagnosticVisibleMeshes: string[] = [];
        const diagnosticHiddenMeshes: string[] = [];
        const activeMorphTargets = new Set<string>();
        const transformCorrections: string[] = [];
        if (isSaraV3Avatar) {
          transformCorrections.push("saraV3.gltf.configTransform");
        }
        if (isSaraViewport && !saraRfv2PreviewActive) {
          const saraV2Diagnostics = prepareSaraV2Scene(gltfScene, {
            modelUrl,
            definition: SARA_V2_AVATAR_DEFINITION,
          });
          transformCorrections.push(
            `saraV2.bodyCandidate:${saraV2Diagnostics.bodyCandidateUsed ?? "missing"}`
          );
          if (saraV2Diagnostics.warnings.length > 0) {
            console.warn("[Sara V2 Runtime] diagnostics warnings", saraV2Diagnostics.warnings);
          }
        } else if (saraRfv2PreviewActive) {
          transformCorrections.push("saraRfv2.oldFaceAlignmentSkipped");
        }
        const bodyMeshes: THREE.SkinnedMesh[] = [];
        const saraMeshDiagnostics: Array<Record<string, unknown>> = [];
        let rfv2MorphPrimitiveIndex = 0;
        const rfv2StaticBodyGroup = useRfv2Morphs ? new THREE.Group() : null;
        if (rfv2StaticBodyGroup) {
          rfv2StaticBodyGroup.name = "JordanStaticBodyFallback";
        }
        if (process.env.NODE_ENV === "development") {
          console.group("[Avatar] Morph inventory");
          console.log("[Avatar] loaded model URL:", modelUrl);
          console.log("[Avatar] mode:", avatarModeLabel(avatarMode));
        }

        gltfScene.traverse((child: any) => {
          child.visible = true;
          if (isSaraViewport && DEBUG_SARA_FRAMING) {
            const mesh = child as THREE.Mesh;
            const skinnedMesh = child as THREE.SkinnedMesh;
            const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
            const positionAttr = geometry?.getAttribute?.("position");
            const materials = (mesh.isMesh || skinnedMesh.isSkinnedMesh)
              ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                  .filter(Boolean)
                  .map((material: any) => ({
                    name: material.name || "(unnamed material)",
                    transparent:
                      typeof material.transparent === "boolean" ? material.transparent : null,
                    opacity: typeof material.opacity === "number" ? material.opacity : null,
                    side: typeof material.side === "number" ? material.side : null,
                    depthWrite:
                      typeof material.depthWrite === "boolean" ? material.depthWrite : null,
                    depthTest:
                      typeof material.depthTest === "boolean" ? material.depthTest : null,
                    color: material.color?.getHexString?.() ?? null,
                    map: material.map?.name || material.map?.source?.data?.src || null,
                  }))
              : [];
            const world = new THREE.Vector3();
            const worldScale = new THREE.Vector3();
            child.getWorldPosition(world);
            child.getWorldScale(worldScale);
            saraMeshDiagnostics.push({
              name: child.name || "(unnamed object)",
              type: child.type,
              visible: child.visible,
              parentName: child.parent?.name || "(no parent)",
              isMesh: Boolean(mesh.isMesh),
              isSkinnedMesh: Boolean(skinnedMesh.isSkinnedMesh),
              materials,
              vertexCount:
                typeof positionAttr?.count === "number" ? positionAttr.count : null,
              morphTargetDictionary:
                mesh.morphTargetDictionary
                  ? Object.keys(mesh.morphTargetDictionary)
                  : [],
              worldPosition: world.toArray(),
              worldScale: worldScale.toArray(),
            });
          }
          if (useRfv2Morphs && isRfv2HeadRootName(child.name || "")) {
            child.position.x += JORDAN_HEAD_OFFSET_X;
            child.position.y += JORDAN_HEAD_OFFSET_Y;
            child.updateMatrixWorld(true);
            transformCorrections.push(`jordan.headRootOffsetY:${JORDAN_HEAD_OFFSET_Y}`);
          }
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            bodyMeshes.push(child as THREE.SkinnedMesh);
          }
          if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
            const mesh = child as THREE.Mesh;
            child.castShadow = true;
            child.receiveShadow = true;
            // Skinned meshes have stale bounding spheres after the model is
            // repositioned/scaled, causing Three.js frustum culling to
            // incorrectly discard them (head and other parts disappear).
            // Disabling frustum culling is the standard fix for GLB avatars.
            child.visible = true;
            child.frustumCulled = false;
            child.renderOrder = 10;
            const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
            materials.forEach((material: any) => {
              if (isSaraViewport && DEBUG_SARA_FRAMING) {
                material.opacity = 1;
                material.transparent = false;
                material.side = THREE.DoubleSide;
              }
              material.depthTest = true;
              material.depthWrite = true;
              material.needsUpdate = true;
            });
            if (isSaraViewport && DEBUG_SARA_FRAMING && isSaraOversizedShellMesh(child)) {
              child.visible = false;
              child.frustumCulled = true;
              transformCorrections.push(`sara.hideOversizedShell:${child.name || mesh.geometry?.name || "unnamed"}`);
            }
            if (useRfv2Morphs && isRfv2BodyMeshName(child.name || "")) {
              const staticMaterials = materials.map((material: any) => {
                const clone = material.clone ? material.clone() : material;
                clone.color?.set?.(0xffffff);
                clone.opacity = 1;
                clone.transparent = false;
                clone.alphaTest = 0;
                clone.depthTest = true;
                clone.depthWrite = true;
                clone.side = THREE.DoubleSide;
                clone.needsUpdate = true;
                return clone;
              });
              const fallbackMesh = new THREE.Mesh(
                mesh.geometry,
                Array.isArray(mesh.material) ? staticMaterials : staticMaterials[0]
              );
              fallbackMesh.name = `${child.name || "body"}_StaticFallback`;
              fallbackMesh.castShadow = true;
              fallbackMesh.receiveShadow = true;
              fallbackMesh.frustumCulled = false;
              fallbackMesh.renderOrder = 9;
              rfv2StaticBodyGroup?.add(fallbackMesh);
              child.visible = false;
              child.frustumCulled = true;
              materials.forEach((material: any) => {
                material.color?.set?.(0xffffff);
                material.opacity = 1;
                material.transparent = false;
                material.alphaTest = 0;
                material.depthTest = true;
                material.depthWrite = true;
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              });
              transformCorrections.push(`jordan.staticBodyFallback:${child.name}`);
            }
            if (process.env.NODE_ENV === "development") {
              diagnosticMeshes.push({
                name: child.name || "(unnamed mesh)",
                visible: child.visible,
              });
              console.log(child.name, child.visible);
              if (child.visible) {
                diagnosticVisibleMeshes.push(child.name || "(unnamed mesh)");
              } else {
                diagnosticHiddenMeshes.push(child.name || "(unnamed mesh)");
              }
            }

            const dict = child.morphTargetDictionary as
              | Record<string, number>
              | undefined;
            const influences = child.morphTargetInfluences as
              | number[]
              | undefined;

            if (dict && influences && influences.length > 0) {
              const entries = Object.entries(dict) as [string, number][];
              const primitiveIndex = useRfv2Morphs ? rfv2MorphPrimitiveIndex++ : undefined;
              if (useRfv2Morphs) {
                child.userData.jordanMorphPrimitiveIndex = primitiveIndex;
              }
              entries.forEach(([name]) => activeMorphTargets.add(name));
              if (process.env.NODE_ENV === "development") {
                console.log(`Mesh: "${child.name}" →`, entries.map(([n]) => n));
              }

              if (useRfv2Morphs) {
                entries.forEach(([name, index]) => {
                  if (!JORDAN_MORPH_NAME_SET.has(name)) return;
                  const morphName = name as JordanMorphName;
                  const binding: MorphBinding = {
                    mesh: child as THREE.Mesh,
                    index,
                    name,
                    initialInfluence: influences[index] ?? 0,
                    primitiveIndex,
                  };
                  const current = jordanMorphBindingsRef.current.get(morphName) ?? [];
                  current.push(binding);
                  jordanMorphBindingsRef.current.set(morphName, current);
                  influences[index] = morphName === "viseme_rest" ? 0.25 : 0;
                });
              }

              for (const name of Object.keys(dict)) {
                if (isCheekRelatedMorphKeyForLog(name)) {
                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      "[Avatar] Morph key (cheek/smile/nasolabial/puff/squint):",
                      child.name,
                      name
                    );
                  }
                }
              }

              // Mouth bindings
              const mouthCandidates = entries.filter(([name]) =>
                useRfv2Morphs || isSaraV3Avatar ? false : isMouthName(name)
              );

              mouthCandidates.forEach(([name, index]) => {
                mouthBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                  primitiveIndex,
                });
              });

              // Blink bindings
              const blinkCandidates = entries.filter(([name]) =>
                useRfv2Morphs
                  ? isRfv2BlinkMorphName(name)
                  : isSaraV3Avatar
                    ? false
                    : isBlinkName(name)
              );

              blinkCandidates.forEach(([name, index]) => {
                blinkBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                  primitiveIndex,
                });
              });

              const cheekCandidates = entries.filter(([name]) =>
                useRfv2Morphs
                  ? isRfv2ExpressionMorphName(name)
                  : isSaraV3Avatar
                    ? false
                    : isCheekMorphName(name)
              );
              cheekCandidates.forEach(([name, index]) => {
                cheekBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                  primitiveIndex,
                });
              });

              if (
                isSaraHybrid &&
                isSaraV2PresenceFaceMesh(child)
              ) {
                entries.forEach(([name, index]) => {
                  if (!isSaraV2PresenceMorph(name)) return;
                  const current = saraV2PresenceBindingsRef.current.get(name) ?? [];
                  current.push({
                    mesh: child as THREE.Mesh,
                    index,
                    name,
                    initialInfluence: influences[index] ?? 0,
                    primitiveIndex,
                  });
                  saraV2PresenceBindingsRef.current.set(name, current);
                });
              }
            }
          }

          if ((child as any).isBone) {
            const bone = child as THREE.Bone;
            const boneName = (child.name || "").toLowerCase();
            if (process.env.NODE_ENV === "development" && isDiagnosticBoneName(child.name || "")) {
              const world = new THREE.Vector3();
              bone.getWorldPosition(world);
              diagnosticBones.push({ name: child.name || "(unnamed bone)", world });
            }

            storeFaceBoneDefault(bone, faceBoneDefaultsRef.current);

            if (useRfv2Morphs && isJordanIdlePresenceBoneName(child.name || "")) {
              jordanIdlePresenceBonesRef.current.push(bone);
              jordanIdlePresenceBonesRef.current.sort((a, b) => {
                const rank = (value: string) =>
                  value.trim().replace(/[._\s-]/g, "").toLowerCase() === "neck" ? 0 : 1;
                return rank(a.name || "") - rank(b.name || "");
              });
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Jordan idle presence bone:", child.name);
            }

            if (/eyelid|upperlid|lowerlid|lid/.test(boneName)) {
              eyelidDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              eyelidDefaultRotYRef.current.set(bone.uuid, bone.rotation.y);
              eyelidDefaultRotZRef.current.set(bone.uuid, bone.rotation.z);
              eyelidDefaultPosYRef.current.set(bone.uuid, bone.position.y);
              eyelidDefaultPosZRef.current.set(bone.uuid, bone.position.z);
              eyelidBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Eyelid bone:", child.name);
            }

            if (/(upperlip|upper_lip|lipupper|lip_upper|up_lip|uplip)/.test(boneName)) {
              lipDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              lipBonesUpperRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Upper lip bone:", child.name);
            }

            if (/(lowerlip|lower_lip|liplower|lip_lower|low_lip|lowlip)/.test(boneName)) {
              lipDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              lipBonesLowerRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Lower lip bone:", child.name);
            }

            if (isJawBoneName(boneName)) {
              jawBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Jaw bone:", child.name);
            }

            if (isChinBoneName(boneName)) {
              chinBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Chin bone:", child.name);
            }

            if (isJawlineBoneName(boneName)) {
              jawlineBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Jawline bone:", child.name);
            }

            if (isMouthInteriorBoneName(boneName)) {
              mouthInteriorBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Mouth interior bone:", child.name);
            }

            if (isUnderChinBoneName(boneName)) {
              underChinBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Under chin bone:", child.name);
            }

            if (isCheekBoneName(boneName)) {
              cheekBonesRef.current.push(bone);
              if (process.env.NODE_ENV === "development") console.log("[Avatar] Cheek bone (L/R / zygomatic / nasolabial):", child.name);
            }

          }
        });

        if (rfv2StaticBodyGroup && rfv2StaticBodyGroup.children.length > 0) {
          gltfScene.add(rfv2StaticBodyGroup);
          transformCorrections.push(
            `jordan.staticBodyFallback.count:${rfv2StaticBodyGroup.children.length}`
          );
        }

	        if (process.env.NODE_ENV === "development") console.groupEnd();
	        console.groupEnd();
	        if (isSaraV3Avatar && modelMatchesSaraV3) {
	          saraV3ControllerRef.current = createSaraV3ModelController({
	            root: gltfScene,
	            modelUrl,
	          });
	        }

	        console.log(
          "[Avatar] Summary — mouth bindings:",
          mouthBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
          "| blink bindings:",
          blinkBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
          "| eyelid bones:",
          eyelidBonesRef.current.length
        );
        console.log("[Avatar] jaw bones count:", jawBonesRef.current.length);
        console.log("[Avatar] chin bones count:", chinBonesRef.current.length);
        console.log("[Avatar] jawline bones count:", jawlineBonesRef.current.length);
        console.log("[Avatar] mouth interior bones count:", mouthInteriorBonesRef.current.length);
        console.log("[Avatar] under chin bones count:", underChinBonesRef.current.length);
        console.log(
          "[Avatar] Cheek morph detection — bound targets:",
          cheekBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`)
        );
        console.log(
          "[Avatar] Cheek bone usage — bones:",
          cheekBonesRef.current.map((b) => b.name)
        );
        if (process.env.NODE_ENV === "development" && useRfv2Morphs) {
          console.group("[Jordan RFv14] Morph binding audit");
          JORDAN_RFV2_MORPH_AUDIT_NAMES.forEach((name) => {
            const bindings = jordanMorphBindingsRef.current.get(name) ?? [];
            if (bindings.length === 0) {
              console.warn(`[Jordan RFv14] Missing morph: ${name}`);
              return;
            }
            bindings.forEach(({ mesh, index, primitiveIndex }) => {
              console.log("[Jordan RFv14] Morph binding", {
                name,
                found: true,
                meshName: mesh.name || "(unnamed mesh)",
                primitiveIndex: primitiveIndex ?? mesh.userData.jordanMorphPrimitiveIndex ?? null,
                morphIndex: index,
                currentInfluenceValue: mesh.morphTargetInfluences?.[index] ?? null,
                visuallyLikelyMainFaceMesh: isLikelyJordanMainFaceMesh(mesh),
              });
            });
          });
          console.groupEnd();
        }

        // if (
        //   mouthBindingsRef.current.length === 0 &&
        //   jawBoneRef.current === null
        // ) {
        //   console.warn("[Avatar] No mouth morphs or jaw bone found.");
        // }

        if (
          blinkBindingsRef.current.length === 0 &&
          eyelidBonesRef.current.length === 0
        ) {
          console.warn("[Avatar] No blink morphs or eyelid bones found.");
        }

        const avatarRoot = new THREE.Group();
        avatarRoot.name = useRfv2Morphs ? "AvatarRoot_rfv2Morph" : "AvatarRoot_legacyHybrid";
        avatarRootRef.current = avatarRoot;

        // Apply legacy viewport/export corrections on an outer wrapper. Jordan
        // keeps the imported GLB root at identity and is framed from skinned
        // mesh bounds only.
        if (!useRfv2Morphs && !hasFixedViewportConfig && viewTuning.modelRotationX) {
          avatarRoot.rotation.x = viewTuning.modelRotationX;
          transformCorrections.push("root.rotation.x");
        }
        if (!useRfv2Morphs && !hasFixedViewportConfig && viewTuning.modelRotationY) {
          avatarRoot.rotation.y = viewTuning.modelRotationY;
          transformCorrections.push("root.rotation.y");
        }
        if (!useRfv2Morphs && !hasFixedViewportConfig && viewTuning.modelRotationZ) {
          avatarRoot.rotation.z = viewTuning.modelRotationZ;
          transformCorrections.push("root.rotation.z");
        }
	        avatarRoot.add(gltfScene);
	        scene.add(avatarRoot);
	        gltfScene.updateMatrixWorld(true);
	        avatarRoot.updateMatrixWorld(true);
	        roomGroup.updateMatrixWorld(true);
        if (isSaraV2Viewport) {
          writeSaraTransformAuditToWindow({
            currentHybrid: createSaraTransformHierarchySnapshot({
              mode: "Current Hybrid",
              modelPath: modelUrl,
              avatarRoot,
              gltfScene,
              transformCorrections,
            }),
          });
        }

        if (saraRfv2PreviewActive) {
          const saraRfv2PreviewLightGroup = new THREE.Group();
          saraRfv2PreviewLightGroup.name = "SaraRFv2PreviewHairFillLights";
          const saraRfv2HairFill = new THREE.DirectionalLight(0xfff1df, 0.42);
          saraRfv2HairFill.name = "SaraRFv2PreviewHairFill";
          saraRfv2HairFill.position.set(-2.2, 2.7, 3.2);
          const saraRfv2HairRim = new THREE.DirectionalLight(0xd8e6ff, 0.32);
          saraRfv2HairRim.name = "SaraRFv2PreviewHairRim";
          saraRfv2HairRim.position.set(2.4, 3.4, -2.8);
          saraRfv2PreviewLightGroup.add(saraRfv2HairFill, saraRfv2HairRim);
          scene.add(saraRfv2PreviewLightGroup);
          const transformAuditBeforePrepare = createSaraTransformHierarchySnapshot({
            mode: "Sara RFv2 Preview",
            modelPath: modelUrl,
            avatarRoot,
            gltfScene,
            transformCorrections,
          });
          const assetDiagnostics = prepareSaraRfv2PreviewScene(gltfScene, modelUrl);
          const transformAuditAfterPrepare = createSaraTransformHierarchySnapshot({
            mode: "Sara RFv2 Preview",
            modelPath: modelUrl,
            avatarRoot,
            gltfScene,
            transformCorrections,
          });
          const transformDiff = diffSaraTransformHierarchySnapshots(
            transformAuditBeforePrepare,
            transformAuditAfterPrepare
          );
          const transformAuditSnapshot = {
            ...transformAuditAfterPrepare,
            ...transformDiff,
            notes: [
              "Sara RFv2 Preview prepare path only forces visibility/frustum-culling/material renderability.",
              "MorphApplier is audited as morph-only and must not reparent, move, scale, or rotate nodes.",
            ],
          };
          writeSaraTransformAuditToWindow({
            saraRfv2Preview: transformAuditSnapshot,
            saraRfv2PreviewBeforePrepare: transformAuditBeforePrepare,
            saraRfv2PreviewAfterPrepare: transformAuditSnapshot,
          });
          saraRfv2AssetDiagnosticsRef.current = assetDiagnostics;
          const bindingResult = bindSaraRfv2FaceMorphTargets({ root: gltfScene });
          const rfv2TransformDiagnostics = createSaraRfv2TransformDiagnostics(gltfScene);
          saraRfv2BindingsRef.current = bindingResult.bindings;
          saraRfv2ApplierStateRef.current = {
            ...bindingResult.state,
            enabled: true,
          };
          saraRfv2ApplierDiagnosticsRef.current = bindingResult.diagnostics;
          if (typeof window !== "undefined") {
            (window as any).saraLiveRfv2Diagnostics = {
              mode: "Sara RFv2 Preview",
              modelPath: modelUrl,
              bindingProfileUsed: bindingResult.diagnostics.bindingProfileUsed,
              profileAssetPath: bindingResult.diagnostics.profileAssetPath,
              faceRootCandidates: bindingResult.diagnostics.faceRootCandidates,
              ...rfv2TransformDiagnostics,
              detectedAsset: assetDiagnostics.detectedAsset,
              topLevelRoots: assetDiagnostics.topLevelRoots,
              faceRootFound: assetDiagnostics.faceRootFound,
              faceRootName: assetDiagnostics.faceRootName,
              faceRootPath: assetDiagnostics.faceRootPath,
              faceMeshFound: assetDiagnostics.faceMeshFound,
              faceMeshPath: assetDiagnostics.faceMeshPath,
              faceMorphNames: assetDiagnostics.faceMorphNames,
              requiredMorphsPresent: bindingResult.diagnostics.requiredMorphsPresent,
              missingRequiredMorphs: bindingResult.diagnostics.missingRequiredMorphs,
              allowedMorphsFound: bindingResult.diagnostics.allowedMorphsFound,
              forbiddenMeshesRejected: bindingResult.diagnostics.forbiddenMeshesRejected,
              forbiddenMorphsRejected: bindingResult.diagnostics.forbiddenMorphsRejected,
              faceRootChildren: bindingResult.diagnostics.faceRootChildren,
              faceRootAudit: bindingResult.diagnostics.faceRootAudit,
              faceGroupDetected: bindingResult.diagnostics.faceGroupDetected,
              faceGroupPath: bindingResult.diagnostics.faceGroupPath,
              boundFaceMeshNames: bindingResult.diagnostics.boundFaceMeshNames,
              boundFaceMeshPaths: bindingResult.diagnostics.boundFaceMeshPaths,
              boundFaceMeshCount: bindingResult.diagnostics.boundFaceMeshCount,
              bodyRootFound: assetDiagnostics.bodyRootFound,
              hairRootFound: assetDiagnostics.hairRootFound,
              hairDiagnostics: assetDiagnostics.hairDiagnostics,
              rfv2Enabled: true,
              faceBound: bindingResult.bindings.length > 0,
              boundMeshes: bindingResult.diagnostics.boundMeshNames,
              boundFaceMeshes: bindingResult.diagnostics.boundMeshNames,
              activePhoneme: null,
              activeViseme: "viseme_rest",
              rawTargets: {},
              smoothedTargets: {},
              appliedMorphs: {},
              missingMorphs: bindingResult.diagnostics.missingMorphs,
              blockedMorphs: bindingResult.diagnostics.blockedMorphs,
              bindingRetryCount: saraRfv2BindingRetryCountRef.current,
              fallbackReason: null,
            };
          }
          if (bindingResult.bindings.length === 0) {
            console.warn("[Sara RFv2 Live Preview] Face binding pending retry", {
              reason: bindingResult.diagnostics.applierBindingReason,
              diagnostics: bindingResult.diagnostics,
            });
          } else {
            console.info("[Sara RFv2 Live Preview] bound Face morph meshes", {
              modelUrl,
              boundMeshes: bindingResult.diagnostics.boundMeshNames,
            });
          }
        }

        camera.near = 0.01;
        camera.far = 100;
        camera.updateProjectionMatrix();

	        if (useRfv2Morphs) {
	          baseScaleRef.current = 1;
	          camera.fov = 11; // camera zoom shaz
          camera.near = 0.01;
          camera.far = 100;
          camera.position.set(0, 0.55, 3.0);
          camera.lookAt(0, 0.65, 0);
          transformCorrections.push("jordan.gltf.fixedDemoTransform");
          transformCorrections.push("jordan.camera.fixedDemoView");
	        } else if (hasFixedViewportConfig) {
          baseScaleRef.current = 1;
          const fixedCamera = fixedCameraConfig ?? {};
          if (useSaraLabAlignedViewport) {
            gltfScene.updateMatrixWorld(true);
            avatarRoot.updateMatrixWorld(true);
            const saraCameraPosition = saraRfv2PreviewActive
              ? new THREE.Vector3(...SARA_RFV2_PREVIEW_DEFAULT_CAMERA_FRAME.position)
              : vector3FromConfig(fixedCamera.position, [0, 1.35, 4.2]);
            const saraCameraLookAt = saraRfv2PreviewActive
              ? new THREE.Vector3(...SARA_RFV2_PREVIEW_DEFAULT_CAMERA_FRAME.lookAt)
              : vector3FromConfig(fixedCamera.lookAt, [0, 1.15, 0]);
            const saraFov = fixedCamera.fov ?? 22;
            camera.fov = saraFov;
            camera.near = 0.01;
            camera.far = 100;
            camera.position.copy(saraCameraPosition);
            camera.lookAt(saraCameraLookAt);
            camera.userData.fixedLookAt = saraCameraLookAt.toArray();
            camera.userData.saraRfv2CameraFrame = saraRfv2PreviewActive
              ? createSaraRfv2CameraFrameDiagnostics(camera, gltfScene)
              : null;
            if (typeof window !== "undefined") {
              const existingSaraDiagnostics = (window as any).saraLiveV2Diagnostics ?? {};
              (window as any).saraLiveV2Diagnostics = {
                ...existingSaraDiagnostics,
                cameraConfig: {
                mode: fixedCamera.mode ?? "fixed",
                fov: saraFov,
                position: saraCameraPosition.toArray(),
                lookAt: saraCameraLookAt.toArray(),
                  near: camera.near,
                  far: camera.far,
                },
              };
            }
            transformCorrections.push("sara.labAlignedIdentityTransform");
            transformCorrections.push("sara.configCamera");
            if (saraRfv2PreviewActive && typeof window !== "undefined") {
              const existingRfv2Diagnostics = (window as any).saraLiveRfv2Diagnostics ?? {};
              (window as any).saraLiveRfv2Diagnostics = {
                ...existingRfv2Diagnostics,
                cameraFrame: createSaraRfv2CameraFrameDiagnostics(camera, gltfScene),
              };
            }
          } else {
            const cameraPosition = vector3FromConfig(fixedCamera.position, [0, 0.6, 3.2]);
            const cameraLookAt = vector3FromConfig(fixedCamera.lookAt, [0, 0.7, 0]);
            camera.fov = fixedCamera.fov ?? 14;
            camera.near = 0.01;
            camera.far = 100;
            camera.position.copy(cameraPosition);
            camera.lookAt(cameraLookAt);
	            camera.userData.fixedLookAt = cameraLookAt.toArray();
	            transformCorrections.push(`${fixedViewportDebugLabel}.gltf.fixedTransform`);
	            transformCorrections.push(`${fixedViewportDebugLabel}.camera.fixedView`);
	          }
	          if (isSaraViewport && DEBUG_SARA_FRAMING) {
            gltfScene.updateMatrixWorld(true);
            avatarRoot.updateMatrixWorld(true);
            const saraVisibleBounds = computeSaraVisibleRenderMeshBounds(gltfScene);
            const saraVisualAnchorBounds = computeSaraVisualAnchorBounds(gltfScene);
            const saraTallestRenderMesh = [...saraVisibleBounds.meshBounds].sort(
              (a, b) => b.size[1] - a.size[1]
            )[0] ?? null;
            console.group("[Sara Render Mesh Bounds]");
            console.table(
              saraVisibleBounds.meshBounds.map((entry) => ({
                name: entry.name,
                worldPosition: entry.worldPosition,
                worldScale: entry.worldScale,
                localMin: entry.localBoundingBox?.min ?? null,
                localMax: entry.localBoundingBox?.max ?? null,
                worldBoundingSize: entry.size,
              }))
            );
            console.warn(
              "[Sara Render Mesh Bounds] tallest render mesh:",
              saraTallestRenderMesh
            );
            console.warn(
              "[Sara Render Mesh Bounds] visual anchor bounds:",
              saraVisualAnchorBounds
            );
            console.groupEnd();
            const saraCameraBox = saraVisualAnchorBounds.box.isEmpty()
              ? saraVisibleBounds.box
              : saraVisualAnchorBounds.box;
            const saraCenter = saraCameraBox.getCenter(new THREE.Vector3());
            const saraSize = saraCameraBox.getSize(new THREE.Vector3());
            let saraDebugBox = saraCameraBox;
            let saraDebugCenter = saraCenter;
            const frameDim = Math.max(saraSize.x, saraSize.y, saraSize.z, 0.001);
            const helperDim = Math.max(frameDim, 0.1);
            camera.fov = 35;
            camera.near = 0.0001;
            camera.far = 100;
            camera.position.set(saraCenter.x, saraCenter.y, saraCenter.z + frameDim * 2.2);
            camera.lookAt(saraCenter);
            camera.userData.fixedLookAt = saraCenter.toArray();
            camera.updateProjectionMatrix();
            transformCorrections.push("sara.model19.visualAnchorCamera");

            const visibleBoundsHelper = new THREE.Box3Helper(saraDebugBox, 0x00ff88);
            visibleBoundsHelper.name = "SaraDebugModel19VisualAnchorBounds";
            scene.add(visibleBoundsHelper);
            const axesHelper = new THREE.AxesHelper(helperDim * 0.35);
            axesHelper.name = "SaraDebugRootAxes";
            gltfScene.add(axesHelper);
            const lookAtMarker = new THREE.Mesh(
              new THREE.SphereGeometry(helperDim * 0.025, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0xff3366 })
            );
            lookAtMarker.name = "SaraDebugCameraLookAt";
            lookAtMarker.position.copy(saraDebugCenter);
            scene.add(lookAtMarker);
            const saraHemi = new THREE.HemisphereLight(0xffffff, 0x334455, 1.6);
            saraHemi.name = "SaraDebugHemisphereLight";
            scene.add(saraHemi);
            const saraPoint = new THREE.PointLight(0xffffff, 2.2, helperDim * 8);
            saraPoint.name = "SaraDebugPointLight";
            saraPoint.position.set(
              saraDebugCenter.x,
              saraDebugCenter.y + helperDim * 0.5,
              saraDebugCenter.z + helperDim * 1.5
            );
            scene.add(saraPoint);
          }
        } else {

          // Center and frame model
          const box = new THREE.Box3().setFromObject(gltfScene);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();

          box.getSize(size);
          box.getCenter(center);

          avatarRoot.position.sub(center);

          // When showing a portrait (cameraDistanceMultiplier < 1), scale by the
          // model's HEIGHT only — not the widest dimension. This prevents T-pose
          // arm-spans from shrinking the model and pushing the head out of frame.
          transformCorrections.push("root.position.center");

          const targetFrameHeight = 7.5;
          const scaleDim = size.y; // Always scale by height for portrait framing
          const baseScale = (targetFrameHeight / scaleDim) * viewTuning.scaleMultiplier;
          baseScaleRef.current = baseScale;
          avatarRoot.scale.setScalar(baseScale);
          transformCorrections.push("root.scale.fit");

          avatarRoot.updateMatrixWorld(true);

          box.setFromObject(gltfScene);
          const finalSize = box.getSize(new THREE.Vector3());
          const finalCenter = box.getCenter(new THREE.Vector3());

          const lookAt = new THREE.Vector3(
            finalCenter.x,
            finalCenter.y + finalSize.y * 0.18,
            finalCenter.z
          );

          const distance =
            Math.max(finalSize.y * 0.75, 2.2) *
            viewTuning.cameraDistanceMultiplier;

          camera.position.set(lookAt.x, lookAt.y, lookAt.z + distance);
          camera.lookAt(lookAt);
        }
        if (isSaraV3Avatar && modelMatchesSaraV3) {
          const saraV3Camera = SARA_V3_AVATAR_DEFINITION.camera;
          const saraV3CameraPosition = vector3FromConfig(saraV3Camera.position, [0, 1.25, 3.0]);
          const saraV3CameraLookAt = vector3FromConfig(saraV3Camera.lookAt, [0, 1.25, 0]);
          camera.fov = saraV3Camera.fov ?? 12;
          camera.near = 0.01;
          camera.far = 100;
          camera.position.copy(saraV3CameraPosition);
          camera.lookAt(saraV3CameraLookAt);
          camera.userData.fixedLookAt = saraV3CameraLookAt.toArray();
          transformCorrections.push("saraV3.camera.configView");
        }
        camera.updateProjectionMatrix();
        if (isSaraV3Avatar && modelMatchesSaraV3 && typeof window !== "undefined") {
          const bounds = new THREE.Box3().setFromObject(gltfScene);
          const hasBounds = Number.isFinite(bounds.min.x) && !bounds.isEmpty();
          const boundsCenter = hasBounds
            ? bounds.getCenter(new THREE.Vector3()).toArray()
            : null;
          const boundsSize = hasBounds
            ? bounds.getSize(new THREE.Vector3()).toArray()
            : null;
          let totalMeshCount = 0;
          let visibleMeshCount = 0;
          gltfScene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            const skinnedMesh = child as THREE.SkinnedMesh;
            if (!mesh.isMesh && !skinnedMesh.isSkinnedMesh) return;
            totalMeshCount += 1;
            if (child.visible) {
              visibleMeshCount += 1;
            }
          });
          const fixedLookAt = Array.isArray(camera.userData.fixedLookAt)
            ? camera.userData.fixedLookAt
            : null;
          window.saraV3ViewDiagnostics = {
            avatarRootAddedToScene: scene.children.includes(avatarRoot),
            rootVisible: gltfScene.visible,
            rootPosition: gltfScene.position.toArray(),
            rootScale: gltfScene.scale.toArray(),
            rootRotation: [gltfScene.rotation.x, gltfScene.rotation.y, gltfScene.rotation.z],
            boundingBoxCenter: boundsCenter,
            boundingBoxSize: boundsSize,
            cameraPosition: camera.position.toArray(),
            cameraLookAt: fixedLookAt,
            cameraFov: camera.fov,
            environmentApplied: Boolean(saraV3EnvironmentHandle && scene.environment),
            visibleMeshCount,
            totalMeshCount,
            transformAppliedBy: "SaraV3ModelController",
            possibleIssue:
              visibleMeshCount === 0
                ? "No visible SaraV3 meshes detected after controller setup."
                : hasBounds
                  ? null
                  : "SaraV3 bounding box is empty after controller setup.",
          };
        }

        if (process.env.NODE_ENV === "development") {
          avatarRoot.updateMatrixWorld(true);
          gltfScene.updateMatrixWorld(true);
          roomGroup.updateMatrixWorld(true);
          const describeBox = (object: THREE.Object3D) => {
            const objectBox = new THREE.Box3().setFromObject(object);
            const objectCenter = objectBox.getCenter(new THREE.Vector3());
            const objectSize = objectBox.getSize(new THREE.Vector3());
            return {
              min: objectBox.min.toArray(),
              max: objectBox.max.toArray(),
              center: objectCenter.toArray(),
              size: objectSize.toArray(),
            };
          };
          const finalMeshDiagnostics: Array<{
            name: string;
            type: string;
            visible: boolean;
            world: number[];
            scale: number[];
            materials: Array<{
              name: string;
              opacity: number | null;
              transparent: boolean | null;
              alphaTest: number | null;
              depthWrite: boolean | null;
              colorWrite: boolean | null;
            }>;
          }> = [];
          avatarRoot.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
              const mesh = child as THREE.Mesh;
              const world = new THREE.Vector3();
              const scale = new THREE.Vector3();
              child.getWorldPosition(world);
              child.getWorldScale(scale);
              const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                .filter(Boolean)
                .map((material: any) => ({
                  name: material.name || "(unnamed material)",
                  opacity:
                    typeof material.opacity === "number" ? material.opacity : null,
                  transparent:
                    typeof material.transparent === "boolean" ? material.transparent : null,
                  alphaTest:
                    typeof material.alphaTest === "number" ? material.alphaTest : null,
                  depthWrite:
                    typeof material.depthWrite === "boolean" ? material.depthWrite : null,
                  colorWrite:
                    typeof material.colorWrite === "boolean" ? material.colorWrite : null,
                }));
              const meshDiagnostics = {
                name: child.name || "(unnamed mesh)",
                type: (child as THREE.SkinnedMesh).isSkinnedMesh ? "SkinnedMesh" : "Mesh",
                visible: child.visible,
                world: world.toArray(),
                scale: scale.toArray(),
                materials,
              };
              finalMeshDiagnostics.push(meshDiagnostics);
              console.log(
                "[Avatar] mesh runtime:",
                meshDiagnostics.name,
                meshDiagnostics.visible,
                {
                  type: meshDiagnostics.type,
                  world: meshDiagnostics.world,
                  scale: meshDiagnostics.scale,
                  materials: meshDiagnostics.materials,
                }
              );

            }
          });
          if (isSaraViewport && DEBUG_SARA_FRAMING) {
            const saraMeshBoxes: Array<{
              name: string;
              category: string | null;
              visible: boolean;
              min: number[];
              max: number[];
              center: number[];
              size: number[];
              volume: number;
              nonZero: boolean;
            }> = [];
            const saraMeshNames: string[] = [];
            const saraCategoryCounts: Record<string, number> = {
              face: 0,
              body: 0,
              top: 0,
              bottom: 0,
              footwear: 0,
              hair: 0,
              eyes: 0,
              teeth: 0,
              tongue: 0,
              head: 0,
              skin: 0,
            };
            let saraVisibleMeshCount = 0;
            let saraHiddenMeshCount = 0;
            gltfScene.traverse((child: THREE.Object3D) => {
              const isMesh =
                (child as THREE.Mesh).isMesh ||
                (child as THREE.SkinnedMesh).isSkinnedMesh;
              if (!isMesh) return;
              const name = child.name || "(unnamed mesh)";
              saraMeshNames.push(name);
              if (child.visible) saraVisibleMeshCount += 1;
              else saraHiddenMeshCount += 1;
              const category = meshDiagnosticCategory(name);
              if (category && category in saraCategoryCounts) {
                saraCategoryCounts[category] += 1;
              }
              const meshBox = new THREE.Box3().setFromObject(child);
              const meshCenter = meshBox.getCenter(new THREE.Vector3());
              const meshSize = meshBox.getSize(new THREE.Vector3());
              const volume = meshSize.x * meshSize.y * meshSize.z;
              saraMeshBoxes.push({
                name,
                category,
                visible: child.visible,
                min: meshBox.min.toArray(),
                max: meshBox.max.toArray(),
                center: meshCenter.toArray(),
                size: meshSize.toArray(),
                volume,
                nonZero: meshSize.x > 0 && meshSize.y > 0 && meshSize.z > 0,
              });
            });
            const sortedSaraMeshNames = [...saraMeshNames].sort((a, b) =>
              a.localeCompare(b)
            );
            const topSaraMeshesByBounds = [...saraMeshBoxes]
              .filter((entry) => entry.nonZero)
              .sort((a, b) => b.volume - a.volume)
              .slice(0, 10);
            const saraFullBox = new THREE.Box3().setFromObject(gltfScene);
            const saraVisibleBounds = computeSaraVisibleRenderMeshBounds(gltfScene);
            const saraVisualAnchorBounds = computeSaraVisualAnchorBounds(gltfScene);
            const saraTopObjectBounds = computeSaraTopObjectBounds(gltfScene, 20);
            const saraFullBounds = serializableBox(saraFullBox);
            const saraVisibleBoundsBox = saraVisibleBounds.box.isEmpty()
              ? null
              : serializableBox(saraVisibleBounds.box);
            const saraVisualAnchorBoundsBox = saraVisualAnchorBounds.box.isEmpty()
              ? null
              : serializableBox(saraVisualAnchorBounds.box);
            const saraDiagnostics = {
              route: {
                activeAvatarId,
                fixedConfigAvatarId: fixedViewportConfig?.avatarId ?? null,
                modelUrl,
                useRfv2Morphs,
                hasFixedViewportConfig,
                cameraConfig: fixedViewportConfig?.camera ?? null,
                gltfTransformConfig: fixedViewportConfig?.gltfTransform ?? null,
              },
              hierarchy: saraMeshDiagnostics,
              visibleMeshCount: saraVisibleMeshCount,
              hiddenMeshCount: saraHiddenMeshCount,
              meshNames: sortedSaraMeshNames,
              categoryCounts: saraCategoryCounts,
              nonZeroBoundingMeshes: saraMeshBoxes.filter((entry) => entry.nonZero),
              topMeshesByBounds: topSaraMeshesByBounds,
              topObjectsByBounds: saraTopObjectBounds,
              fullBounds: saraFullBounds,
              visibleRenderMeshBounds: saraVisibleBoundsBox,
              visualAnchorBounds: saraVisualAnchorBoundsBox,
              visualAnchorBoundsSource: {
                meshCount: saraVisualAnchorBounds.meshCount,
                meshNames: saraVisualAnchorBounds.meshNames.sort((a, b) => a.localeCompare(b)),
                meshBounds: saraVisualAnchorBounds.meshBounds,
              },
              visibleRenderMeshBoundsSource: {
                meshCount: saraVisibleBounds.meshCount,
                meshNames: saraVisibleBounds.meshNames.sort((a, b) => a.localeCompare(b)),
                meshBounds: saraVisibleBounds.meshBounds,
              },
            };
            (window as any).saraMeshDiagnostics = saraDiagnostics;
            console.group("[Sara Route]");
            console.log({
              rawAvatar: rawAvatarLabel,
              normalizedAvatarId: activeAvatarId,
              activeAvatarId,
              modelUrl,
              uses3d: true,
              useRfv2Morphs,
              hasFixedViewportConfig,
              cameraConfig: fixedViewportConfig?.camera ?? null,
              gltfTransformConfig: fixedViewportConfig?.gltfTransform ?? null,
            });
            console.groupEnd();
            console.group("[Sara Mesh Diagnostics]");
            console.log("[Sara Mesh Diagnostics] hierarchy:", saraMeshDiagnostics);
            console.log("[Sara Mesh Diagnostics] visible mesh count:", saraVisibleMeshCount);
            console.log("[Sara Mesh Diagnostics] hidden mesh count:", saraHiddenMeshCount);
            console.log("[Sara Mesh Diagnostics] mesh names:", sortedSaraMeshNames);
            console.log("[Sara Mesh Diagnostics] category counts:", saraCategoryCounts);
            console.log(
              "[Sara Mesh Diagnostics] non-zero bounding meshes:",
              saraDiagnostics.nonZeroBoundingMeshes
            );
            console.log(
              "[Sara Mesh Diagnostics] top 10 largest meshes:",
              topSaraMeshesByBounds
            );
            console.log(
              "[Sara Mesh Diagnostics] top 20 largest objects/bones/groups:",
              saraTopObjectBounds
            );
            console.log("[Sara Full Bounds]", saraFullBounds);
            console.log("[Sara Visible Bounds]", saraVisibleBoundsBox);
            console.log("[Sara Visual Anchor Bounds]", saraVisualAnchorBoundsBox);
            console.log(
              "[Sara Visual Anchor Bounds] source render meshes:",
              saraDiagnostics.visualAnchorBoundsSource
            );
            console.log(
              "[Sara Visible Bounds] source render meshes:",
              saraDiagnostics.visibleRenderMeshBoundsSource
            );
            console.log("[Sara Rotation]", {
              rotation: [
                gltfScene.rotation.x,
                gltfScene.rotation.y,
                gltfScene.rotation.z,
              ],
            });
            console.groupEnd();
          }
          (window as any).avatarMeshDiagnostics = finalMeshDiagnostics;
          console.group("[Avatar] Diagnostics");
          console.log("[Avatar] active avatar mode:", avatarModeLabel(avatarMode));
          console.log("[Avatar] loaded GLB scene transform:", {
            position: gltfScene.position.toArray(),
            rotation: [gltfScene.rotation.x, gltfScene.rotation.y, gltfScene.rotation.z],
            scale: gltfScene.scale.toArray(),
          });
          console.log("[Avatar] viewport root transform:", {
            position: avatarRoot.position.toArray(),
            rotation: [avatarRoot.rotation.x, avatarRoot.rotation.y, avatarRoot.rotation.z],
            scale: avatarRoot.scale.toArray(),
          });
          console.log("[Avatar] transform corrections applied:", transformCorrections);
          console.log("[Avatar] SHOW_ROOM:", SHOW_ROOM);
          console.log("[Avatar] gltfScene bounding box:", describeBox(gltfScene));
          console.log("[Avatar] avatarRoot bounding box:", describeBox(avatarRoot));
          console.log("[Avatar] roomGroup bounding box:", describeBox(roomGroup));
          console.log("[Avatar] skinned body mesh count:", bodyMeshes.length);
          console.log("[Avatar] final camera fixed Jordan view:", useRfv2Morphs);
          console.log("[Avatar] final camera position:", camera.position.toArray());
          if (hasFixedViewportConfig) {
            console.group(`[${fixedViewportDebugLabel}] Fixed viewport debug`);
            console.log(`[${fixedViewportDebugLabel}] loaded model URL:`, modelUrl);
            console.log(
              `[${fixedViewportDebugLabel}] gltfScene bounding box:`,
              describeBox(gltfScene)
            );
            console.log(
              `[${fixedViewportDebugLabel}] avatarRoot bounding box:`,
              describeBox(avatarRoot)
            );
            console.log(`[${fixedViewportDebugLabel}] root position:`, gltfScene.position.toArray());
            console.log(`[${fixedViewportDebugLabel}] root rotation:`, [
              gltfScene.rotation.x,
              gltfScene.rotation.y,
              gltfScene.rotation.z,
            ]);
            console.log(`[${fixedViewportDebugLabel}] root scale:`, gltfScene.scale.toArray());
            console.log(`[${fixedViewportDebugLabel}] camera position:`, camera.position.toArray());
            console.log(
              `[${fixedViewportDebugLabel}] camera lookAt:`,
              camera.userData.fixedLookAt ?? null
            );
            console.log(`[${fixedViewportDebugLabel}] camera fov:`, camera.fov);
            console.groupEnd();
          }
          console.log("[Avatar] visible meshes:", diagnosticVisibleMeshes);
          console.log("[Avatar] hidden meshes:", diagnosticHiddenMeshes);
          console.log(
            "[Avatar] Summary — mouth bindings:",
            mouthBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
            "| blink bindings:",
            blinkBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
            "| eyelid bones:",
            eyelidBonesRef.current.length
          );
          console.log("[Avatar] active morph targets found:", [...activeMorphTargets].sort());
          console.log(
            "[Avatar] active Jordan morph map:",
            Object.fromEntries(
              [...jordanMorphBindingsRef.current.entries()].map(([name, bindings]) => [
                name,
                bindings.map((binding) => `${binding.mesh.name}:${binding.index}`),
              ])
            )
          );
          if (useRfv2Morphs) {
            const requiredDriverBindings = Object.fromEntries(
              JORDAN_RFV2_REQUIRED_DRIVER_MORPHS.map((name) => [
                name,
                (jordanMorphBindingsRef.current.get(name)?.length ?? 0) > 0,
              ])
            );
            console.log("[Avatar] Jordan RFv2 mode active:", useRfv2Morphs);
            console.log("[Avatar] Jordan required driver morphs bound:", requiredDriverBindings);
            console.log(
              "[Avatar] Jordan blink system:",
              getJordanBlinkMode(jordanMorphBindingsRef.current)
            );
            console.log("[Avatar] Jordan lookAheadMs:", JORDAN_RFV2_FACE_TUNING.lookAheadSeconds * 1000);
            console.log(
              "[Avatar] Jordan jawOpen support active:",
              (jordanMorphBindingsRef.current.get("jawOpen")?.length ?? 0) > 0
            );
            if (
              process.env.NODE_ENV === "development" &&
              !loggedJordanExpressionAuthoritySummaryRef.current
            ) {
              loggedJordanExpressionAuthoritySummaryRef.current = true;
              console.log("[Jordan Expression Authority] load summary:", {
                modelUrl,
                requiredExpressionMorphs: Object.fromEntries(
                  JORDAN_EXPRESSION_AUTHORITY_MORPHS.map((name) => [
                    name,
                    (jordanMorphBindingsRef.current.get(name)?.length ?? 0) > 0,
                  ])
                ),
                expressionCaps: JORDAN_EXPRESSION_CAPS,
                strongExpressionVerifyMode: DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
              });
            }
            console.log("[Avatar] Jordan old mouth driver skipped:", true);
          }
          console.log(
            "[Avatar] phoneme timeline active:",
            !!avatarPhonemeTimelineRef.current?.phonemes.length,
            avatarPhonemeTimelineRef.current
          );
          console.log("[Avatar] meshes/world positions/scales/materials:", finalMeshDiagnostics);
          console.log("[Avatar] key bones/world positions:", diagnosticBones.map((b) => ({
            name: b.name,
            world: b.world.toArray(),
          })));
          console.log("[Avatar] jaw bones count:", jawBonesRef.current.length);
          console.log("[Avatar] chin bones count:", chinBonesRef.current.length);
          console.log("[Avatar] jawline bones count:", jawlineBonesRef.current.length);
          console.log("[Avatar] mouth interior bones count:", mouthInteriorBonesRef.current.length);
          console.log("[Avatar] under chin bones count:", underChinBonesRef.current.length);
          console.log(
            "[Avatar] Cheek morph detection — bound targets:",
            cheekBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`)
          );
          console.log(
            "[Avatar] Cheek bone usage — bones:",
            cheekBonesRef.current.map((b) => b.name)
          );
          console.log("[Avatar] bone-based speech disabled:", useRfv2Morphs);
          console.groupEnd();
        }

	        if (!cancelled) {
	          setAvatarLoadState("ready");
	          setAvatarLoadProgress(1);
	        }
	        if (!isSaraV3Avatar) {
	          startBlinkLoop();
	        }
	      },
      undefined,
      (error) => {
        console.error("[Avatar] Failed to load GLB:", error);
        if (!cancelled) setAvatarLoadState("error");
      }
    );

        const handleResize = () => {
          const c = containerRef.current;
          const r = rendererRef.current;
          const cam = cameraRef.current;
          if (!c || !r || !cam) return;

          // Use getBoundingClientRect so we always get the CSS-rendered size,
          // not the canvas pixel size (which can differ after CSS 100% scaling).
          const rect = c.getBoundingClientRect();
          const w = rect.width || c.clientWidth || 800;
          const h = rect.height || c.clientHeight || 600;

          cam.aspect = w / h;
          cam.updateProjectionMatrix();
          r.setSize(w, h);
        };

        window.addEventListener("resize", handleResize);

        const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

        const renderLoop = () => {
          frameRef.current = requestAnimationFrame(renderLoop);

          const scene = sceneRef.current;
          const camera = cameraRef.current;
          const renderer = rendererRef.current;
          const model = modelRef.current;
 const avatarRoot = avatarRootRef.current;
          if (!scene || !camera || !renderer) return;

          const now = performance.now();
          const dt = Math.min(
            0.05,
            Math.max(0.001, (now - lastMouthFrameTimeRef.current) / 1000)
          );
          lastMouthFrameTimeRef.current = now;

          const speaking = isSpeakingRef.current;
          const audioLevelNow = mouthAudioLevelRef.current;

          // Word-boundary mouth envelope: fast open + reliable close.
          mouthPulseRef.current *= 0.9;
          mouthBaseRef.current *= 0.92;
          if (mouthPulseRef.current < 0.001) mouthPulseRef.current = 0;
          if (mouthBaseRef.current < 0.001) mouthBaseRef.current = 0;
          let envelope = mouthBaseRef.current + mouthPulseRef.current;
          if (speaking) {
            envelope += (Math.random() - 0.5) * 0.01;
          }
          mouthTargetRef.current = envelope;

          const target = THREE.MathUtils.clamp(mouthTargetRef.current, 0, 1.08);
          const openLambda = 20;
          const closeLambda = 11;
          const lambda =
            target > mouthSmoothedRef.current ? openLambda : closeLambda;
          mouthSmoothedRef.current = THREE.MathUtils.damp(
            mouthSmoothedRef.current,
            target,
            lambda,
            dt
          );

          const mouthViseme = THREE.MathUtils.clamp(mouthSmoothedRef.current, 0, 1.28);
          // Tuned for both mic (~20–120) and boosted TTS RMS (~25–200): same divisor family.
          const audioNorm = speaking
            ? THREE.MathUtils.clamp(audioLevelNow / 360, 0, 1)
            : 0;
          // Viseme timing + live level: audio must lift the jaw when text envelope lags (common in conversation).
          const mouth = Math.max(mouthViseme, speaking ? audioNorm * 0.88 : 0);
          const jawOpen = THREE.MathUtils.clamp(
            mouth * (0.9 + audioNorm * 0.34) + (speaking ? audioNorm * 0.055 : 0),
            0,
            1.22
          );

          lipDelayedRef.current = THREE.MathUtils.damp(
            lipDelayedRef.current,
            Math.max(mouthSmoothedRef.current, speaking ? audioNorm * 0.82 : 0),
            20,
            dt
          );
          const lipFromMic = speaking
            ? THREE.MathUtils.clamp(audioLevelNow / 360, 0, 1)
            : 0;
          const lipFollow = THREE.MathUtils.clamp(
            lipDelayedRef.current * 0.58 + lipFromMic * 0.58,
            0,
            1.22
          );

          const mdm = mouthDriveMultRef.current;
          const mouthAdj = THREE.MathUtils.clamp(mouth * mdm, 0, 1.35);
          const jawOpenAdj = THREE.MathUtils.clamp(jawOpen * mdm, 0, 1.35);
          const lipFollowAdj = THREE.MathUtils.clamp(lipFollow * mdm, 0, 1.35);
          const saraV2VisemeCaps = SARA_V2_AVATAR_DEFINITION.visemes.caps;
          const saraAudioFallbackConfig = saraV2VisemeCaps?.audioDrivenMouthFallback;
          const saraUseAudioDrivenMouth =
            isSaraHybrid &&
            speaking &&
            Boolean(saraAudioFallbackConfig?.enabled);
          const saraAudioNormGain = saraAudioFallbackConfig?.audioNormGain ?? 0.85;
          const saraMouthAdjGain = saraAudioFallbackConfig?.mouthAdjGain ?? 0.25;
          const saraAudioMouthOpen = saraUseAudioDrivenMouth
            ? THREE.MathUtils.clamp(
                audioNorm * saraAudioNormGain + mouthAdj * saraMouthAdjGain,
                0,
                1
              )
            : 0;
          const saraAudioJawOpenTarget =
            saraAudioMouthOpen * (saraAudioFallbackConfig?.jawOpenMax ?? 0.28);
          const saraAudioVisemeAATarget =
            saraAudioMouthOpen * (saraAudioFallbackConfig?.visemeAAMax ?? 0.25);
          const saraV2Timeline = isSaraHybrid ? avatarPhonemeTimelineRef.current : null;
          const saraV2TimelineLength = saraV2Timeline?.phonemes.length ?? 0;
          const saraV2ValidTimeline =
            isSaraHybrid &&
            !!saraV2Timeline &&
            saraV2TimelineLength > 0 &&
            !hasInvalidJordanPhonemeTimestamps(saraV2Timeline);
          const saraV2AudioCurrentTime = isSaraHybrid
            ? avatarAudioCurrentTimeRef.current
            : 0;
          const saraV2LookAheadSeconds = saraV2VisemeCaps?.lookAheadSeconds ?? 0.04;
          const saraAudioSyncOffsetSeconds =
            saraV2VisemeCaps?.saraAudioSyncOffsetSeconds ?? 0;
          const saraV2SpeechTime = Math.max(
            0,
            saraV2AudioCurrentTime +
              saraV2LookAheadSeconds +
              saraAudioSyncOffsetSeconds
          );
          const saraV2ActivePhoneme =
            isSaraHybrid && speaking && saraV2ValidTimeline
              ? findActiveSaraPhoneme(saraV2Timeline, saraV2SpeechTime)
              : null;
          const saraV2ActiveViseme =
            saraV2ActivePhoneme?.viseme ?? (saraV2ValidTimeline ? "viseme_rest" : null);
          const saraV2PhonemeDriverActive =
            isSaraHybrid &&
            speaking &&
            saraV2ValidTimeline &&
            !saraUseAudioDrivenMouth;
          const saraV2PhonemeDriverBypassedForAudioFallback =
            saraUseAudioDrivenMouth && saraV2ValidTimeline;
          if (isSaraHybrid && speaking && saraV2ValidTimeline) {
            saraV2ClipHasValidPhonemeTimelineRef.current = true;
          }
          if (isSaraHybrid && speaking) {
            saraV2WasSpeakingRef.current = true;
            saraV2LastSpeechEndMsRef.current = null;
          } else if (isSaraHybrid && saraV2WasSpeakingRef.current) {
            saraV2WasSpeakingRef.current = false;
            saraV2LastSpeechEndMsRef.current = now;
          }
          const saraV2HasValidPhonemeTimeline =
            isSaraHybrid &&
            (saraV2ValidTimeline || saraV2ClipHasValidPhonemeTimelineRef.current);
          const saraV2PostSpeechElapsedMs =
            isSaraHybrid && !speaking && saraV2LastSpeechEndMsRef.current !== null
              ? now - saraV2LastSpeechEndMsRef.current
              : null;
          const saraV2PostSpeechReleaseActive =
            saraV2HasValidPhonemeTimeline && !speaking;
          const saraV2FallbackMouthDriverActive =
            isSaraHybrid &&
            speaking &&
            !saraV2HasValidPhonemeTimeline &&
            !saraUseAudioDrivenMouth;
          const saraV2VisemeOpennessMultipliers =
            saraV2VisemeCaps?.opennessMultipliers as Readonly<Record<string, number>> | undefined;
          const saraV2JawSupportMap =
            saraV2VisemeCaps?.jawSupport as Readonly<Record<string, number>> | undefined;
          const saraV2CurrentVisemeMultiplier = saraV2ActiveViseme
            ? saraV2VisemeOpennessMultipliers?.[saraV2ActiveViseme] ?? 0
            : 0;
          const saraV2CurrentJawSupport = saraV2ActiveViseme
            ? saraV2JawSupportMap?.[saraV2ActiveViseme] ?? 0
            : 0;
          const saraV2PreviousViseme = previousSaraV2VisemeRef.current;
          const saraV2VisemeChanged =
            saraV2PhonemeDriverActive && saraV2PreviousViseme !== saraV2ActiveViseme;
          const saraV2RecentPhonemeKey =
            saraV2PhonemeDriverActive && saraV2ActivePhoneme
              ? [
                  saraV2ActivePhoneme.phoneme,
                  saraV2ActiveViseme,
                  saraV2ActivePhoneme.start.toFixed(3),
                  (saraV2ActivePhoneme.end ?? -1).toFixed(3),
                ].join(":")
              : "";
          if (
            saraV2RecentPhonemeKey &&
            saraV2RecentPhonemeKey !== saraV2LastRecentPhonemeKeyRef.current
          ) {
            saraV2LastRecentPhonemeKeyRef.current = saraV2RecentPhonemeKey;
            saraV2RecentActivePhonemesRef.current = [
              ...saraV2RecentActivePhonemesRef.current,
              {
                time: now,
                audioCurrentTime: saraV2AudioCurrentTime,
                speechTime: saraV2SpeechTime,
                phoneme: saraV2ActivePhoneme.phoneme,
                viseme: saraV2ActiveViseme,
              },
            ].slice(-20);
          } else if (!saraV2PhonemeDriverActive) {
            saraV2LastRecentPhonemeKeyRef.current = "";
          }
          const saraV2RestFrameDetected =
            saraV2PhonemeDriverActive &&
            (!saraV2ActivePhoneme || saraV2ActiveViseme === "viseme_rest");
          let saraV2AppliedVisemeStrength = 0;
          let saraV2AppliedJawSupport = 0;
          let saraV2ReleaseApplied = false;
          let saraV2JawReleaseApplied = false;
          const saraV2CurrentAllowlistedInfluences: Record<string, number> = {};
          const saraV2GenericMouthMorphsReleased: Record<string, number> = {};
          let saraV2MaxOpenInfluence = 0;
          let saraV2PostSpeechMouthOpenMax = 0;
          let saraV2GenericFallbackSuppressed = false;
          let saraV2HighestNonAllowlistedMouthMorph: {
            morphName: string;
            meshName: string;
            influence: number;
          } | null = null;
          if (!speaking) {
            saraGreetingFirstVisemeLoggedRef.current = false;
            previousSaraV2VisemeRef.current = null;
          } else if (saraV2PhonemeDriverActive) {
            previousSaraV2VisemeRef.current = saraV2ActiveViseme;
          }
          if (
            saraV2PhonemeDriverActive &&
            saraV2ActiveViseme &&
            typeof window !== "undefined"
          ) {
            const diagnostics = (window as any).saraGreetingDiagnostics as
              | {
                  greetingSentence?: string;
                  playbackStart?: number | null;
                  firstViseme?: string | null;
                  firstVisemeTime?: number | null;
                  deltaMs?: number | null;
                  phonemeCount?: number;
                  firstPhoneme?: { start?: number } | null;
                  audioReceived?: number | null;
                  avatarDataReceived?: number | null;
                  timelineAttached?: boolean;
                }
              | undefined;
            if (
              diagnostics?.timelineAttached &&
              diagnostics.playbackStart &&
              !diagnostics.firstViseme &&
              !saraGreetingFirstVisemeLoggedRef.current
            ) {
              const firstVisemeTime = performance.now();
              const deltaMs = firstVisemeTime - diagnostics.playbackStart;
              saraGreetingFirstVisemeLoggedRef.current = true;
              (window as any).saraGreetingDiagnostics = {
                ...diagnostics,
                firstViseme: saraV2ActiveViseme,
                firstVisemeTime,
                deltaMs,
              };
              console.log("[Sara Greeting Sync]", {
                greetingSentence:
                  diagnostics.greetingSentence ?? saraV2Timeline?.sentence ?? "",
                audioReceived: diagnostics.audioReceived ?? null,
                avatarDataReceived: diagnostics.avatarDataReceived ?? null,
                phonemeCount: diagnostics.phonemeCount ?? saraV2TimelineLength,
                firstPhonemeStart:
                  diagnostics.firstPhoneme?.start ?? saraV2Timeline?.phonemes[0]?.start ?? null,
                playbackStart: diagnostics.playbackStart,
                firstVisemeApplied: saraV2ActiveViseme,
                firstVisemeTime,
                deltaMs,
                activePhoneme: saraV2ActivePhoneme?.phoneme ?? null,
                speechTime: saraV2SpeechTime,
              });
	          }
	        }
          if (saraRfv2PreviewActive) {
            if (saraRfv2BindingsRef.current.length === 0 && model) {
              if (saraRfv2BindingRetryCountRef.current < SARA_RFV2_BINDING_RETRY_LIMIT) {
                saraRfv2BindingRetryCountRef.current += 1;
                const assetDiagnostics = prepareSaraRfv2PreviewScene(model, modelUrl);
                saraRfv2AssetDiagnosticsRef.current = assetDiagnostics;
                const bindingResult = bindSaraRfv2FaceMorphTargets({ root: model });
                saraRfv2BindingsRef.current = bindingResult.bindings;
                saraRfv2ApplierStateRef.current = {
                  ...bindingResult.state,
                  enabled: true,
                };
                saraRfv2ApplierDiagnosticsRef.current = bindingResult.diagnostics;
              }
            }

            const timeline = avatarPhonemeTimelineRef.current;
            const timelineItems = timeline?.phonemes ?? [];
            const audioCurrentTime = avatarAudioCurrentTimeRef.current;
            const resolved = resolveSaraRfv2ActivePhoneme({
              timeline: timelineItems.map((item) => ({
                phoneme: item.phoneme,
                start: item.start,
                end: item.end ?? item.start,
              })),
              audioCurrentTime,
            });
            const raw = computeSaraRfv2VisemeTargets({
              activeViseme: resolved.activeViseme,
              speaking,
            });
            const nextPhonemeState: SaraRfv2PhonemeState = {
              ...saraRfv2PhonemeStateRef.current,
              enabled: true,
              activePhoneme: resolved.activePhoneme,
              activeViseme: resolved.activeViseme,
              lastSpeechTime: resolved.speechTime,
              lastUpdatedAtMs: now,
              targets: raw.targets,
            };
            saraRfv2PhonemeStateRef.current = nextPhonemeState;

            let smoothedTargets: Record<string, number> = {};
            let appliedMorphs: Readonly<Record<string, number>> = {};
            let missingMorphs: readonly string[] = [];
            let blockedMorphs: readonly string[] = [];
            let boundMeshNames: readonly string[] =
              saraRfv2ApplierDiagnosticsRef.current.boundMeshNames;

            if (saraRfv2BindingsRef.current.length > 0) {
              const smoothed = smoothSaraRfv2Targets({
                state: saraRfv2SmoothingStateRef.current,
                rawTargets: raw.targets,
                nowMs: now,
                forceEnabled: true,
              });
              saraRfv2SmoothingStateRef.current = smoothed.state;
              smoothedTargets = smoothed.smoothedTargets;
              const applied = applySaraRfv2MorphTargets({
                state: saraRfv2ApplierStateRef.current,
                bindings: saraRfv2BindingsRef.current,
                targets: smoothed.smoothedTargets,
                nowMs: now,
                resetUnspecifiedOwnedMorphs: true,
              });
              saraRfv2ApplierStateRef.current = {
                ...applied.state,
                enabled: true,
              };
              const bindingDiagnostics = saraRfv2ApplierDiagnosticsRef.current;
              saraRfv2ApplierDiagnosticsRef.current = {
                ...bindingDiagnostics,
                appliedMorphs: applied.diagnostics.appliedMorphs,
                missingMorphs: applied.diagnostics.missingMorphs,
                blockedMorphs: applied.diagnostics.blockedMorphs,
                releasedMorphs: applied.diagnostics.releasedMorphs,
                highestAppliedValue: applied.diagnostics.highestAppliedValue,
                postWriteInfluences: applied.diagnostics.postWriteInfluences,
                writeSucceeded: applied.diagnostics.writeSucceeded,
                writtenButNoVisualChangeSuspected:
                  applied.diagnostics.writtenButNoVisualChangeSuspected,
              };
              appliedMorphs = applied.diagnostics.appliedMorphs;
              missingMorphs = applied.diagnostics.missingMorphs;
              blockedMorphs = applied.diagnostics.blockedMorphs;
              boundMeshNames = applied.diagnostics.boundMeshNames;
            }

            const fallbackReason =
              saraRfv2BindingsRef.current.length === 0 &&
              saraRfv2BindingRetryCountRef.current >= SARA_RFV2_BINDING_RETRY_LIMIT
                ? saraRfv2ApplierDiagnosticsRef.current.applierBindingReason
                : null;
            if (fallbackReason && !saraRfv2FallbackTriggeredRef.current) {
              if (typeof window !== "undefined") {
                const assetDiagnostics = saraRfv2AssetDiagnosticsRef.current;
                const existingFailureDiagnostics =
                  (window as any).saraLiveRfv2FailureDiagnostics ?? {};
                (window as any).saraLiveRfv2FailureDiagnostics = {
                  ...existingFailureDiagnostics,
                  attemptedMode: "Sara RFv2 Preview",
                  attemptedModelPath: modelUrl,
                  fallbackReason,
                  topLevelRoots: assetDiagnostics.topLevelRoots,
                  faceRootFound: assetDiagnostics.faceRootFound,
                  faceRootName: assetDiagnostics.faceRootName,
                  faceRootPath: assetDiagnostics.faceRootPath,
                  faceRootChildren:
                    saraRfv2ApplierDiagnosticsRef.current.faceRootChildren,
                  faceRootAudit:
                    saraRfv2ApplierDiagnosticsRef.current.faceRootAudit,
                  allMorphCapableMeshes:
                    saraRfv2ApplierDiagnosticsRef.current.allMorphCapableMeshes,
                  timestamp: new Date().toISOString(),
                };
              }
              saraRfv2FallbackTriggeredRef.current = true;
              onSaraRfv2Fallback?.(fallbackReason);
            }
            if (typeof window !== "undefined") {
              const assetDiagnostics = saraRfv2AssetDiagnosticsRef.current;
              const rfv2TransformDiagnostics = model
                ? createSaraRfv2TransformDiagnostics(model)
                : {
                    rfv2UsesNewSaraTransform: true,
                    oldFaceAlignmentSkipped: true,
                    faceRigWorldTransform: null,
                    characterWorldTransform: null,
                    sketchfabWorldTransform: null,
                    transformMismatchWarnings: ["Sara RFv2 model root is not available."],
                  };
              (window as any).saraLiveRfv2Diagnostics = {
                mode: "Sara RFv2 Preview",
                modelPath: modelUrl,
                bindingProfileUsed: saraRfv2ApplierDiagnosticsRef.current.bindingProfileUsed,
                profileAssetPath: saraRfv2ApplierDiagnosticsRef.current.profileAssetPath,
                faceRootCandidates: saraRfv2ApplierDiagnosticsRef.current.faceRootCandidates,
                ...rfv2TransformDiagnostics,
                cameraFrame: createSaraRfv2CameraFrameDiagnostics(camera, model),
                detectedAsset: assetDiagnostics.detectedAsset,
                topLevelRoots: assetDiagnostics.topLevelRoots,
                faceRootFound: assetDiagnostics.faceRootFound,
                faceRootName: assetDiagnostics.faceRootName,
                faceRootPath: assetDiagnostics.faceRootPath,
                faceMeshFound: assetDiagnostics.faceMeshFound,
                faceMeshPath: assetDiagnostics.faceMeshPath,
                faceMorphNames: assetDiagnostics.faceMorphNames,
                requiredMorphsPresent:
                  saraRfv2ApplierDiagnosticsRef.current.requiredMorphsPresent,
                missingRequiredMorphs:
                  saraRfv2ApplierDiagnosticsRef.current.missingRequiredMorphs,
                allowedMorphsFound:
                  saraRfv2ApplierDiagnosticsRef.current.allowedMorphsFound,
                forbiddenMeshesRejected:
                  saraRfv2ApplierDiagnosticsRef.current.forbiddenMeshesRejected,
                forbiddenMorphsRejected:
                  saraRfv2ApplierDiagnosticsRef.current.forbiddenMorphsRejected,
                faceRootChildren:
                  saraRfv2ApplierDiagnosticsRef.current.faceRootChildren,
                faceRootAudit:
                  saraRfv2ApplierDiagnosticsRef.current.faceRootAudit,
                faceGroupDetected:
                  saraRfv2ApplierDiagnosticsRef.current.faceGroupDetected,
                faceGroupPath:
                  saraRfv2ApplierDiagnosticsRef.current.faceGroupPath,
                boundFaceMeshNames:
                  saraRfv2ApplierDiagnosticsRef.current.boundFaceMeshNames,
                boundFaceMeshPaths:
                  saraRfv2ApplierDiagnosticsRef.current.boundFaceMeshPaths,
                boundFaceMeshCount:
                  saraRfv2ApplierDiagnosticsRef.current.boundFaceMeshCount,
                bodyRootFound: assetDiagnostics.bodyRootFound,
                hairRootFound: assetDiagnostics.hairRootFound,
                hairDiagnostics: assetDiagnostics.hairDiagnostics,
                rfv2Enabled: true,
                faceBound: saraRfv2BindingsRef.current.length > 0,
                boundMeshes: boundMeshNames,
                boundFaceMeshes: boundMeshNames,
                activePhoneme: resolved.activePhoneme,
                activeViseme: resolved.activeViseme,
                rawTargets: raw.targets,
                smoothedTargets,
                appliedMorphs,
                missingMorphs,
                blockedMorphs,
                bindingRetryCount: saraRfv2BindingRetryCountRef.current,
                fallbackReason,
              };
            }
          }

          if (useRfv2Morphs) {
                  const timeline = avatarPhonemeTimelineRef.current;
                  const hasTimeline = !!timeline && timeline.phonemes.length > 0;
                  const timelineHasInvalidTimestamps = hasInvalidJordanPhonemeTimestamps(timeline);
                  const audioCurrentTime = avatarAudioCurrentTimeRef.current;
                  const speechTime = audioCurrentTime + JORDAN_RFV2_FACE_TUNING.lookAheadSeconds;
                  const activePhoneme = hasTimeline
                    ? findActiveJordanPhoneme(timeline, speechTime)
                    : null;
                  let activeViseme = activePhoneme?.viseme ?? null;
                  const presenceState = resolveJordanPresenceState({
                    speaking,
                    listening: isListeningRef.current,
                    thinking: isThinkingRef.current,
                  });
                  jordanPresenceStateRef.current = presenceState;
                  const jordanSpeechJustEnded = previousJordanBlinkSpeakingRef.current && !speaking;
                  const jordanSpeechJustStarted = !previousJordanBlinkSpeakingRef.current && speaking;
                  if (jordanSpeechJustEnded) {
                    lastJordanSpeechEndAtRef.current = performance.now();
                    scheduleSpeechEndBlink();
                  }
                  previousJordanBlinkSpeakingRef.current = speaking;
                  const idlePhase = now * JORDAN_RFV2_IDLE_TUNING.breathingSpeed;
                  const idleBreath = (Math.sin(idlePhase) + 1) * 0.5;
                  const idlePresenceAlpha = presenceState === "speaking"
                    ? 0.22
                    : presenceState === "listening"
                      ? 1
                      : presenceState === "thinking"
                        ? 0.82
                        : 0.86;
                  const idleRestTarget = THREE.MathUtils.lerp(
                    JORDAN_RFV2_IDLE_TUNING.idleRestMin,
                    JORDAN_RFV2_IDLE_TUNING.idleRestMax,
                    idleBreath
                  ) * idlePresenceAlpha;
                  const idleSmileTarget =
                    (presenceState === "listening"
                      ? JORDAN_RFV2_IDLE_TUNING.idleSmileMax * 0.78
                      : presenceState === "thinking"
                        ? JORDAN_RFV2_IDLE_TUNING.idleSmileMax * 0.22
                        : JORDAN_RFV2_IDLE_TUNING.idleSmileMax * (0.78 + idleBreath * 0.22)) *
                    idlePresenceAlpha;
                  const idleBrowTarget =
                    (presenceState === "listening"
                      ? JORDAN_RFV2_IDLE_TUNING.idleBrowMax
                      : presenceState === "thinking"
                        ? JORDAN_RFV2_IDLE_TUNING.idleBrowMax * (0.58 + idleBreath * 0.18)
                        : JORDAN_RFV2_IDLE_TUNING.idleBrowMax * (0.68 + idleBreath * 0.22)) *
                    idlePresenceAlpha;
                  const idleCheekTarget =
                    (presenceState === "listening"
                      ? JORDAN_RFV2_IDLE_TUNING.idleCheekMax * 0.9
                      : presenceState === "thinking"
                        ? JORDAN_RFV2_IDLE_TUNING.idleCheekMax * 0.5
                        : JORDAN_RFV2_IDLE_TUNING.idleCheekMax * (0.66 + idleBreath * 0.24)) *
                    idlePresenceAlpha;
          
                  if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
                    const timelineKey = timeline
                      ? `${timeline.phonemes.length}:${timeline.phonemes[0]?.start ?? "none"}:${timeline.sentence}`
                      : "none";
                    if (speaking && !previousJordanSpeakingRef.current) {
                      loggedNoJordanTimelineRef.current = false;
                      loggedDelayedJordanTimelineRef.current = false;
                      if (timeline) {
                        loggedJordanTimelineKeyRef.current = timelineKey;
                        console.log(
                          "[Jordan] First 10 phonemes",
                          timeline.phonemes.slice(0, 10).map((phoneme) => ({
                            rawPhoneme: phoneme.rawPhoneme ?? phoneme.phoneme,
                            phoneme: phoneme.phoneme,
                            normalizedPhoneme:
                              phoneme.debugNormalizedPhoneme ??
                              normalizePhonemeLabelForDebug(phoneme.rawPhoneme ?? phoneme.phoneme),
                            start: phoneme.start,
                            end: phoneme.end,
                          }))
                        );
                      }
                    }
                    previousJordanSpeakingRef.current = speaking;
          
                    if (speaking && (!hasTimeline || timelineHasInvalidTimestamps) && !loggedNoJordanTimelineRef.current) {
                      loggedNoJordanTimelineRef.current = true;
                      console.warn("[Jordan] No phoneme timeline available", {
                        hasTimeline,
                        timelineLength: timeline?.phonemes.length ?? 0,
                        timelineHasInvalidTimestamps,
                      });
                    }
          
                    if (
                      speaking &&
                      hasTimeline &&
                      audioCurrentTime > 0.25 &&
                      !activePhoneme &&
                      !loggedDelayedJordanTimelineRef.current
                    ) {
                      loggedDelayedJordanTimelineRef.current = true;
                      console.warn("[Jordan] Phoneme timeline appears delayed", {
                        audioCurrentTime,
                        speechTime,
                        lookAheadSeconds: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds,
                        lookAheadMs: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds * 1000,
                        firstPhonemeStart: timeline?.phonemes[0]?.start,
                      });
                    }
          
                    if (speaking && activePhoneme && !activeViseme) {
                      console.warn("[Jordan] Unmapped phoneme", {
                        rawPhoneme: activePhoneme.rawPhoneme ?? activePhoneme.phoneme,
                        normalizedPhoneme:
                          activePhoneme.debugNormalizedPhoneme ??
                          normalizePhonemeLabelForDebug(activePhoneme.rawPhoneme ?? activePhoneme.phoneme),
                        driverPhoneme: activePhoneme.phoneme,
                        speechTime,
                        audioCurrentTime,
                        lookAheadSeconds: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds,
                      });
                    }
                  }
          
                  const targets = new Map<JordanMorphName, number>(
                    JORDAN_MORPH_NAMES.map((name) => [name, 0])
                  );
                  const expressionAuthorityDiagnostics =
                    new Map<JordanMorphName, JordanExpressionAuthorityEntry>();
                  const getJordanExpressionCap = (name: JordanMorphName): number | null =>
                    JORDAN_EXPRESSION_CAPS[name as keyof typeof JORDAN_EXPRESSION_CAPS] ?? null;
                  const setJordanExpressionTarget = (
                    name: JordanMorphName,
                    requestedTargetValue: number
                  ) => {
                    const clampLimit = getJordanExpressionCap(name);
                    const valueAfterClamp =
                      clampLimit === null
                        ? requestedTargetValue
                        : THREE.MathUtils.clamp(requestedTargetValue, 0, clampLimit);
                    const previousEntry = expressionAuthorityDiagnostics.get(name);
                    expressionAuthorityDiagnostics.set(name, {
                      requestedTargetValue,
                      clampLimit,
                      valueAfterClamp,
                      previousSmoothedValue: jordanMorphValuesRef.current.get(name) ?? 0,
                      finalAppliedMorphTargetInfluence:
                        previousEntry?.finalAppliedMorphTargetInfluence ?? null,
                      overwrittenLater:
                        previousEntry?.overwrittenLater ||
                        (previousEntry !== undefined &&
                          Math.abs(previousEntry.valueAfterClamp - valueAfterClamp) > 0.0005),
                    });
                    targets.set(name, valueAfterClamp);
                    return valueAfterClamp;
                  };
                  const finalizeJordanExpressionTarget = (name: JordanMorphName) => {
                    const clampLimit = getJordanExpressionCap(name);
                    if (clampLimit === null) return;
                    const requestedTargetValue = targets.get(name) ?? 0;
                    const valueAfterClamp = THREE.MathUtils.clamp(
                      requestedTargetValue,
                      0,
                      clampLimit
                    );
                    const previousEntry = expressionAuthorityDiagnostics.get(name);
                    expressionAuthorityDiagnostics.set(name, {
                      requestedTargetValue:
                        previousEntry?.requestedTargetValue ?? requestedTargetValue,
                      clampLimit,
                      valueAfterClamp,
                      previousSmoothedValue:
                        previousEntry?.previousSmoothedValue ??
                        jordanMorphValuesRef.current.get(name) ??
                        0,
                      finalAppliedMorphTargetInfluence:
                        previousEntry?.finalAppliedMorphTargetInfluence ?? null,
                      overwrittenLater:
                        previousEntry?.overwrittenLater ||
                        Math.abs(requestedTargetValue - valueAfterClamp) > 0.0005,
                    });
                    targets.set(name, valueAfterClamp);
                  };
                  if (speaking && activeViseme && activeViseme !== "viseme_rest") {
                    targets.set(
                      activeViseme,
                      hasTimeline
                        ? JORDAN_RFV2_FACE_TUNING.visemeMaxStrength
                        : 0
                    );
                    targets.set("viseme_rest", 0);
                  } else {
                    targets.set("viseme_rest", 0.25);
                  }
                  if (!speaking) {
                    targets.set("viseme_rest", idleRestTarget);
                  }
          
                  const sentiment = timeline?.sentiment ?? "";
                  const sentimentLabel = getSentimentLabel(sentiment);
                  const jordanEmotionalModulationMode =
                    normalizeJordanEmotionalModulationMode(
                      sentimentLabel,
                      presenceState
                    );
                  const jordanEmotionalModulationProfile =
                    getJordanEmotionalModulationProfile(jordanEmotionalModulationMode);
                  const speechEnergy = THREE.MathUtils.clamp(
                    (activeViseme && activeViseme !== "viseme_rest" ? 0.5 : 0) +
                      audioNorm * 0.5,
                    0,
                    1
                  );
                  const speechEnergyAlpha =
                    1 - Math.exp(-JORDAN_SPEAKING_BEHAVIOR_TUNING.speechEnergySmoothingSpeed * dt);
                  jordanSpeakingEnergyRef.current = THREE.MathUtils.lerp(
                    jordanSpeakingEnergyRef.current,
                    speaking ? speechEnergy : 0,
                    speechEnergyAlpha
                  );
                  const speakingSupportAlpha = speaking ? speechEnergy : 0;
                  const positiveSentiment = isPositiveSentiment(sentiment);
                  const sadSentiment = isSadSentiment(sentiment);
                  const emotionalState = sadSentiment
                    ? "sad"
                    : positiveSentiment
                      ? "happy"
                      : "neutral";
                  const asymmetryPhase = now * 0.00034;
                  const asymmetryAmount = JORDAN_EYE_INTELLIGENCE_TUNING.asymmetryAmount;
                  const mouthAsym =
                    Math.sin(asymmetryPhase) * asymmetryAmount +
                    Math.sin(asymmetryPhase * 0.41 + 1.7) * asymmetryAmount * 0.45;
                  const cheekAsym =
                    Math.sin(asymmetryPhase * 0.72 + 0.8) * asymmetryAmount * 0.72;
                  jordanEyeAsymmetryRef.current = {
                    mouthLeft: THREE.MathUtils.clamp(1 - mouthAsym, 0.92, 1.08),
                    mouthRight: THREE.MathUtils.clamp(1 + mouthAsym, 0.92, 1.08),
                    cheekLeft: THREE.MathUtils.clamp(1 - cheekAsym, 0.93, 1.07),
                    cheekRight: THREE.MathUtils.clamp(1 + cheekAsym, 0.93, 1.07),
                    blinkLeft: jordanEyeAsymmetryRef.current.blinkLeft,
                    blinkRight: jordanEyeAsymmetryRef.current.blinkRight,
                  };
                  const sadOverlay = sadSentiment
                    ? THREE.MathUtils.clamp(
                        0.04 + speakingSupportAlpha * 0.04,
                        0,
                        JORDAN_EXPRESSION_CAPS.sad
                      )
                    : 0;
                  const smileOverlay = positiveSentiment
                    ? THREE.MathUtils.clamp(
                        0.03 + speakingSupportAlpha * 0.05,
                        0,
                        Math.min(
                          JORDAN_EXPRESSION_CAPS.mouthSmileLeft,
                          JORDAN_EXPRESSION_CAPS.mouthSmileRight
                        )
                      )
                    : 0;
                  const frownOverlay = sadSentiment
                    ? THREE.MathUtils.clamp(
                        0.03 + speakingSupportAlpha * 0.05,
                        0,
                        Math.min(
                          JORDAN_EXPRESSION_CAPS.mouthFrownLeft,
                          JORDAN_EXPRESSION_CAPS.mouthFrownRight
                        )
                      )
                    : 0;
                  const neutralAttention = emotionalState === "neutral" ? 0.012 : 0;
                  const softEyeSupport = sadSentiment ? 0.014 : positiveSentiment ? 0.008 : 0;
                  const cornerSupport = positiveSentiment
                    ? smileOverlay
                    : sadSentiment
                      ? 0
                      : speaking
                        ? neutralAttention
                        : 0;
                  const cheekOverlay = THREE.MathUtils.clamp(
                    (speaking ? 0.03 + speechEnergy * 0.06 : 0) +
                      smileOverlay * 0.22 +
                      softEyeSupport,
                    0,
                    Math.min(
                      JORDAN_EXPRESSION_CAPS.cheekSquintLeft,
                      JORDAN_EXPRESSION_CAPS.cheekSquintRight
                    )
                  );
                  const browOverlay = THREE.MathUtils.clamp(
                    (speaking ? 0.02 + Math.pow(speechEnergy, 1.15) * 0.055 : 0) +
                      sadOverlay * 0.22 +
                      (presenceState === "listening" ? 0.018 : 0),
                    0,
                    JORDAN_EXPRESSION_CAPS.eyebrows
                  );
                  const listeningFaceSuppressed =
                    speaking || presenceState === "thinking" || presenceState !== "listening";
                  const listeningFaceActive =
                    useRfv2Morphs &&
                    presenceState === "listening" &&
                    !speaking;
                  const listeningFaceBecameActive =
                    listeningFaceActive && !jordanListeningFaceWasActiveRef.current;
                  const randomInRange = (range: readonly [number, number]) =>
                    range[0] + Math.random() * (range[1] - range[0]);
                  const jordanIdleSchedulerEligible =
                    useRfv2Morphs &&
                    presenceState === "idle" &&
                    !speaking &&
                    !isListeningRef.current &&
                    !isThinkingRef.current;
                  const jordanListeningSchedulerEligible =
                    useRfv2Morphs &&
                    presenceState === "listening" &&
                    !speaking;
                  const jordanSpeakingSchedulerEligible =
                    useRfv2Morphs &&
                    presenceState === "speaking" &&
                    speaking;
                  let jordanSchedulerDebug:
                    | ReturnType<typeof updateJordanBehaviorTimingScheduler>["debug"]
                    | undefined;
                  if (now >= jordanBehaviorTimingNextUpdateRef.current) {
                    const jordanSchedulerResult = updateJordanBehaviorTimingScheduler({
                      state: jordanBehaviorTimingStateRef.current,
                      nowMs: now,
                      presenceState,
                      sentimentLabel,
                      isSpeaking: speaking,
                      userIsSpeaking: isListeningRef.current,
                      latestUserText: latestUserTextRef.current,
                      latestJordanText: latestJordanTextRef.current || speechTextRef.current,
                      userSpeechStartedAtMs: userSpeechStartedAtMsRef.current || undefined,
                      userLastSpeechAtMs: userLastSpeechAtMsRef.current || undefined,
                      jordanSpeechStartedAtMs:
                        jordanSpeechStartedAtMsRef.current || undefined,
                      jordanLastSpeechAtMs: jordanLastSpeechAtMsRef.current || undefined,
                      speechJustStarted: jordanSpeechJustStarted,
                      speechJustEnded: jordanSpeechJustEnded,
                      userPauseDurationMs: userLastSpeechAtMsRef.current
                        ? now - userLastSpeechAtMsRef.current
                        : undefined,
                      sentimentCompound: sentimentCompoundRef.current,
                    });
                    jordanSchedulerDebug = jordanSchedulerResult.debug;
                    jordanBehaviorTimingNextUpdateRef.current = now + 220;
                  }
                  const jordanSchedulerActiveEvents =
                    jordanBehaviorTimingStateRef.current.activeEvents.filter(
                      (event) =>
                        !event.interrupted &&
                        event.startsAtMs <= now &&
                        event.endsAtMs > now
                    );
                  const jordanIdleSchedulerActiveEvents = jordanSchedulerActiveEvents.filter(
                    (event) => event.state === "idle"
                  );
                  const jordanListeningSchedulerActiveEvents =
                    jordanSchedulerActiveEvents.filter((event) => event.state === "listening");
                  const jordanSpeakingSchedulerActiveEvents =
                    jordanSchedulerActiveEvents.filter((event) => event.state === "speaking");
                  const jordanTurnEndReleaseEvents = jordanSchedulerActiveEvents.filter(
                    (event) => event.type === "turn_end_release"
                  );
                  const jordanIdleConsumedEvents = jordanIdleSchedulerEligible
                    ? jordanIdleSchedulerActiveEvents.filter((event) =>
                        JORDAN_IDLE_SCHEDULER_CONSUMED_EVENT_TYPES.has(
                          event.type
                        )
                      )
                    : [];
                  const jordanIdleIgnoredEvents = jordanIdleSchedulerActiveEvents.filter(
                    (event) =>
                      !JORDAN_IDLE_SCHEDULER_CONSUMED_EVENT_TYPES.has(event.type)
                  );
                  const jordanListeningConsumedEvents = jordanListeningSchedulerEligible
                    ? jordanListeningSchedulerActiveEvents.filter((event) =>
                        JORDAN_LISTENING_SCHEDULER_CONSUMED_EVENT_TYPES.has(event.type)
                      )
                    : [];
                  const jordanListeningIgnoredEvents =
                    jordanListeningSchedulerActiveEvents.filter(
                      (event) =>
                        !JORDAN_LISTENING_SCHEDULER_CONSUMED_EVENT_TYPES.has(event.type)
                    );
                  const jordanSpeakingConsumedEvents = jordanSpeakingSchedulerEligible
                    ? jordanSpeakingSchedulerActiveEvents.filter((event) =>
                        JORDAN_SPEAKING_SCHEDULER_CONSUMED_EVENT_TYPES.has(event.type)
                      )
                    : [];
                  const jordanSpeakingIgnoredEvents = jordanSpeakingSchedulerActiveEvents.filter(
                    (event) =>
                      !JORDAN_SPEAKING_SCHEDULER_CONSUMED_EVENT_TYPES.has(event.type)
                  );
                  const jordanIdleStillnessActive =
                    jordanIdleSchedulerEligible &&
                    jordanIdleConsumedEvents.some((event) => event.type === "idle_stillness");
                  const jordanIdleBehaviorContribution =
                    jordanIdleSchedulerEligible && !jordanIdleStillnessActive
                      ? scaleJordanIdleBehaviorContribution(
                          resolveJordanIdleBehaviorContribution(
                            jordanIdleConsumedEvents,
                            now,
                            jordanEmotionalModulationProfile
                          )
                        )
                      : { ...EMPTY_JORDAN_IDLE_BEHAVIOR_CONTRIBUTION };
                  const jordanListeningStillnessActive =
                    jordanListeningSchedulerEligible &&
                    jordanListeningConsumedEvents.some(
                      (event) => event.type === "soft_processing_pause"
                    );
                  const jordanListeningBehaviorContribution =
                    jordanListeningSchedulerEligible
                      ? scaleJordanListeningBehaviorContribution(
                          resolveJordanListeningBehaviorContribution(
                            jordanListeningConsumedEvents,
                            now,
                            sentimentLabel,
                            jordanEmotionalModulationProfile
                          )
                        )
                      : { ...EMPTY_JORDAN_LISTENING_BEHAVIOR_CONTRIBUTION };
                  const jordanSpeakingBehaviorContribution =
                    jordanSpeakingSchedulerEligible || jordanTurnEndReleaseEvents.length > 0
                      ? scaleJordanSpeakingBehaviorContribution(
                          resolveJordanSpeakingBehaviorContribution({
                            events: jordanSpeakingConsumedEvents,
                            releaseEvents: jordanTurnEndReleaseEvents,
                            nowMs: now,
                            sentimentLabel,
                            speechEnergy: jordanSpeakingEnergyRef.current,
                            modulationProfile: jordanEmotionalModulationProfile,
                          })
                        )
                      : { ...EMPTY_JORDAN_SPEAKING_BEHAVIOR_CONTRIBUTION };
                  const idleBrowSuppressionReason = DEBUG_JORDAN_EXPRESSION_TEST
                    ? "expression-test"
                    : DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY
                      ? "strong-expression-verify"
                      : speaking
                        ? "speaking"
                        : presenceState === "listening"
                          ? "listening"
                          : presenceState === "thinking"
                          ? "thinking"
                          : presenceState !== "idle"
                            ? presenceState
                            : jordanIdleStillnessActive
                              ? "behavior-stillness"
                              : null;
                  const idleBrowActive =
                    useRfv2Morphs &&
                    presenceState === "idle" &&
                    !speaking &&
                    !isListeningRef.current &&
                    !isThinkingRef.current &&
                    !idleBrowSuppressionReason;
                  if (idleBrowActive && now >= jordanIdleBrowNextTargetRef.current) {
                    const holdMs = randomInRange(JORDAN_IDLE_BROW_TUNING.targetHoldMs);
                    const shouldPeak = Math.random() < JORDAN_IDLE_BROW_TUNING.peakProbability;
                    const shouldRestLow = !shouldPeak && Math.random() < 0.28;
                    const nextTarget = shouldRestLow
                      ? JORDAN_IDLE_BROW_TUNING.baseMin +
                        Math.random() * (0.016 - JORDAN_IDLE_BROW_TUNING.baseMin)
                      : shouldPeak
                        ? JORDAN_IDLE_BROW_TUNING.peakMin +
                          Math.random() *
                            (JORDAN_IDLE_BROW_TUNING.peakMax -
                              JORDAN_IDLE_BROW_TUNING.peakMin)
                        : JORDAN_IDLE_BROW_TUNING.baseMin +
                          Math.random() *
                            (JORDAN_IDLE_BROW_TUNING.baseMax -
                              JORDAN_IDLE_BROW_TUNING.baseMin);
                    jordanIdleBrowTargetRef.current = THREE.MathUtils.clamp(
                      nextTarget,
                      JORDAN_IDLE_BROW_TUNING.baseMin,
                      JORDAN_IDLE_BROW_TUNING.maxValue
                    );
                    jordanIdleBrowHoldMsRef.current = holdMs;
                    jordanIdleBrowNextTargetRef.current = now + holdMs;
                  } else if (!idleBrowActive) {
                    jordanIdleBrowTargetRef.current = 0;
                    jordanIdleBrowNextTargetRef.current =
                      now + JORDAN_IDLE_BROW_TUNING.targetHoldMs[0];
                  }
                  jordanIdleBrowAppliedRef.current = THREE.MathUtils.damp(
                    jordanIdleBrowAppliedRef.current,
                    idleBrowActive ? jordanIdleBrowTargetRef.current : 0,
                    JORDAN_IDLE_BROW_TUNING.blendSpeed,
                    dt
                  );
                  if (
                    listeningFaceActive &&
                    !jordanListeningStillnessActive &&
                    (listeningFaceBecameActive || now >= jordanListeningFaceNextTargetRef.current)
                  ) {
                    const holdMs = randomInRange(JORDAN_LISTENING_FACE_TUNING.targetHoldMs);
                    const pause = Math.random() < 0.18;
                    const asymmetry =
                      randomInRange(JORDAN_LISTENING_FACE_TUNING.asymmetryAmount) *
                      (Math.random() < 0.5 ? -1 : 1);
                    const browRange =
                      !pause && Math.random() < 0.18
                        ? JORDAN_LISTENING_FACE_TUNING.browPeak
                        : JORDAN_LISTENING_FACE_TUNING.browBase;
                    const baseSmileLeft = pause
                      ? JORDAN_LISTENING_FACE_TUNING.smileLeft[0] * 0.55
                      : randomInRange(JORDAN_LISTENING_FACE_TUNING.smileLeft);
                    const baseSmileRight = pause
                      ? JORDAN_LISTENING_FACE_TUNING.smileRight[0] * 0.55
                      : randomInRange(JORDAN_LISTENING_FACE_TUNING.smileRight);
                    const concernSmileScale = sadSentiment ? 0.3 : 1;
                    const concernFrownLeft = sadSentiment
                      ? randomInRange(JORDAN_LISTENING_FACE_TUNING.concernFrown)
                      : 0;
                    const concernFrownRight = sadSentiment
                      ? randomInRange(JORDAN_LISTENING_FACE_TUNING.concernFrown)
                      : 0;
                    const cheekBase = pause
                      ? JORDAN_LISTENING_FACE_TUNING.cheek[0] * 0.65
                      : randomInRange(JORDAN_LISTENING_FACE_TUNING.cheek);
                    jordanListeningFaceTargetRef.current = {
                      brow: randomInRange(browRange),
                      smileLeft: THREE.MathUtils.clamp(
                        baseSmileLeft * concernSmileScale * (1 - asymmetry * 0.5),
                        0,
                        JORDAN_EXPRESSION_CAPS.mouthSmileLeft
                      ),
                      smileRight: THREE.MathUtils.clamp(
                        baseSmileRight * concernSmileScale * (1 + asymmetry * 0.5),
                        0,
                        JORDAN_EXPRESSION_CAPS.mouthSmileRight
                      ),
                      frownLeft: THREE.MathUtils.clamp(
                        concernFrownLeft * (1 + asymmetry * 0.35),
                        0,
                        JORDAN_EXPRESSION_CAPS.mouthFrownLeft
                      ),
                      frownRight: THREE.MathUtils.clamp(
                        concernFrownRight * (1 - asymmetry * 0.35),
                        0,
                        JORDAN_EXPRESSION_CAPS.mouthFrownRight
                      ),
                      cheekLeft: THREE.MathUtils.clamp(
                        cheekBase * (1 - asymmetry * 0.45),
                        0,
                        JORDAN_EXPRESSION_CAPS.cheekSquintLeft
                      ),
                      cheekRight: THREE.MathUtils.clamp(
                        cheekBase * (1 + asymmetry * 0.45),
                        0,
                        JORDAN_EXPRESSION_CAPS.cheekSquintRight
                      ),
                      headTilt: pause
                        ? 0
                        : randomInRange(JORDAN_LISTENING_FACE_TUNING.headTiltRadians) *
                          (Math.random() < 0.5 ? -1 : 1),
                      holdMs,
                    };
                    jordanListeningFaceNextTargetRef.current = now + holdMs;
                  } else if (!listeningFaceActive || jordanListeningStillnessActive) {
                    jordanListeningFaceTargetRef.current = {
                      ...EMPTY_JORDAN_LISTENING_FACE_TARGET,
                    };
                    jordanListeningFaceNextTargetRef.current =
                      now + JORDAN_LISTENING_FACE_TUNING.targetHoldMs[0];
                  }
                  jordanListeningFaceWasActiveRef.current = listeningFaceActive;

                  const listeningFaceTarget = jordanListeningFaceTargetRef.current;
                  const listeningFaceApplied = jordanListeningFaceAppliedRef.current;
                  const dampListeningFaceValue = (current: number, target: number) =>
                    THREE.MathUtils.damp(
                      current,
                      target,
                      JORDAN_LISTENING_FACE_TUNING.blendSpeed,
                      dt
                    );
                  const nextListeningFaceApplied: JordanListeningFaceTarget = {
                    brow: dampListeningFaceValue(listeningFaceApplied.brow, listeningFaceTarget.brow),
                    smileLeft: dampListeningFaceValue(
                      listeningFaceApplied.smileLeft,
                      listeningFaceTarget.smileLeft
                    ),
                    smileRight: dampListeningFaceValue(
                      listeningFaceApplied.smileRight,
                      listeningFaceTarget.smileRight
                    ),
                    frownLeft: dampListeningFaceValue(
                      listeningFaceApplied.frownLeft,
                      listeningFaceTarget.frownLeft
                    ),
                    frownRight: dampListeningFaceValue(
                      listeningFaceApplied.frownRight,
                      listeningFaceTarget.frownRight
                    ),
                    cheekLeft: dampListeningFaceValue(
                      listeningFaceApplied.cheekLeft,
                      listeningFaceTarget.cheekLeft
                    ),
                    cheekRight: dampListeningFaceValue(
                      listeningFaceApplied.cheekRight,
                      listeningFaceTarget.cheekRight
                    ),
                    headTilt: dampListeningFaceValue(
                      listeningFaceApplied.headTilt,
                      listeningFaceTarget.headTilt
                    ),
                    holdMs: listeningFaceTarget.holdMs,
                  };
                  jordanListeningFaceAppliedRef.current = nextListeningFaceApplied;
                  const listeningFaceContributes =
                    listeningFaceActive ||
                    Math.max(
                      nextListeningFaceApplied.brow,
                      nextListeningFaceApplied.smileLeft,
                      nextListeningFaceApplied.smileRight,
                      nextListeningFaceApplied.frownLeft,
                      nextListeningFaceApplied.frownRight,
                      nextListeningFaceApplied.cheekLeft,
                      nextListeningFaceApplied.cheekRight
                    ) > 0.001;
          
                  const activeExpressionPreset: JordanExpressionPresetName | null =
                    presenceState === "speaking"
                      ? "warmSpeaking"
                      : presenceState === "listening" && !speaking
                        ? "attentiveListening"
                        : presenceState === "idle"
                          ? "calmIdle"
                          : null;
                  const presetSuppressedByDebug =
                    DEBUG_JORDAN_EXPRESSION_TEST ||
                    (DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY && presenceState === "listening");
                  const presetValuesBeforeCaps: Partial<Record<JordanMorphName, number>> = {};
                  const presetValuesAfterCaps: Partial<Record<JordanMorphName, number>> = {};
                  const presetAsymmetry =
                    JORDAN_EXPRESSION_PRESET_TUNING.asymmetryAmount[0] +
                    ((Math.sin(now * 0.00012 + 0.7) + 1) * 0.5) *
                      (JORDAN_EXPRESSION_PRESET_TUNING.asymmetryAmount[1] -
                        JORDAN_EXPRESSION_PRESET_TUNING.asymmetryAmount[0]);
                  const presetAsymmetryDirection = Math.sin(now * 0.00009 + 1.8) >= 0 ? 1 : -1;
                  const leftPresetScale = 1 - presetAsymmetry * presetAsymmetryDirection * 0.5;
                  const rightPresetScale = 1 + presetAsymmetry * presetAsymmetryDirection * 0.5;
                  const rangeMid = (range: readonly [number, number]) =>
                    THREE.MathUtils.lerp(range[0], range[1], 0.5);
                  const rangeByEnergy = (range: readonly [number, number], energy: number) =>
                    THREE.MathUtils.lerp(range[0], range[1], THREE.MathUtils.clamp(energy, 0, 1));
                  const queuePresetTarget = (name: JordanMorphName, value: number) => {
                    if (presetSuppressedByDebug) return;
                    const contribution = THREE.MathUtils.clamp(
                      value * JORDAN_EXPRESSION_PRESET_TUNING.maxPresetContribution,
                      0,
                      Number.POSITIVE_INFINITY
                    );
                    presetValuesBeforeCaps[name] = contribution;
                    presetValuesAfterCaps[name] = setJordanExpressionTarget(name, contribution);
                  };

                  if (activeExpressionPreset === "calmIdle") {
                    const preset = JORDAN_EXPRESSION_PRESETS.calmIdle;
                    queuePresetTarget(
                      "viseme_rest",
                      Math.max(
                        targets.get("viseme_rest") ?? 0,
                        rangeMid(preset.visemeRest) + jordanIdleBehaviorContribution.visemeRest
                      )
                    );
                    queuePresetTarget("sad", 0);
                    queuePresetTarget("mouthFrownLeft", 0);
                    queuePresetTarget("mouthFrownRight", 0);
                    queuePresetTarget(
                      "mouthSmileLeft",
                      Math.max(
                        rangeMid(preset.mouthSmileLeft) * leftPresetScale,
                        idleSmileTarget * 0.04
                      ) + jordanIdleBehaviorContribution.smileLeft
                    );
                    queuePresetTarget(
                      "mouthSmileRight",
                      Math.max(
                        rangeMid(preset.mouthSmileRight) * rightPresetScale,
                        idleSmileTarget * 0.045
                      ) + jordanIdleBehaviorContribution.smileRight
                    );
                    queuePresetTarget(
                      "cheekSquintLeft",
                      Math.max(
                        rangeMid(preset.cheekSquintLeft) * leftPresetScale,
                        idleCheekTarget * 0.45
                      ) + jordanIdleBehaviorContribution.cheekLeft
                    );
                    queuePresetTarget(
                      "cheekSquintRight",
                      Math.max(
                        rangeMid(preset.cheekSquintRight) * rightPresetScale,
                        idleCheekTarget * 0.45
                      ) + jordanIdleBehaviorContribution.cheekRight
                    );
                    queuePresetTarget(
                      "eyebrows",
                      Math.max(
                        rangeMid(preset.eyebrows),
                        jordanIdleBrowAppliedRef.current + jordanIdleBehaviorContribution.brow
                      )
                    );
                    queuePresetTarget("eyeLookDownLeft", rangeMid(preset.eyeLookDownLeft));
                    queuePresetTarget("eyeLookDownRight", rangeMid(preset.eyeLookDownRight));
                    queuePresetTarget("eyeLookUpLeft", rangeMid(preset.eyeLookUpLeft));
                    queuePresetTarget("eyeLookUpRight", rangeMid(preset.eyeLookUpRight));
                  } else if (activeExpressionPreset === "attentiveListening") {
                    const preset = JORDAN_EXPRESSION_PRESETS.attentiveListening;
                    const smileScale =
                      (sadSentiment
                        ? JORDAN_EXPRESSION_PRESET_TUNING.sadSmileReduction
                        : JORDAN_EXPRESSION_PRESET_TUNING.sentimentSmileMultiplier) *
                      jordanListeningBehaviorContribution.smileMultiplier;
                    queuePresetTarget(
                      "viseme_rest",
                      Math.max(targets.get("viseme_rest") ?? 0, rangeMid(preset.visemeRest))
                    );
                    queuePresetTarget(
                      "mouthSmileLeft",
                      Math.max(
                        rangeMid(preset.mouthSmileLeft) * smileScale * leftPresetScale,
                        nextListeningFaceApplied.smileLeft + jordanListeningBehaviorContribution.smileLeft
                      )
                    );
                    queuePresetTarget(
                      "mouthSmileRight",
                      Math.max(
                        rangeMid(preset.mouthSmileRight) * smileScale * rightPresetScale,
                        nextListeningFaceApplied.smileRight + jordanListeningBehaviorContribution.smileRight
                      )
                    );
                    queuePresetTarget(
                      "cheekSquintLeft",
                      Math.max(
                        rangeMid(preset.cheekSquintLeft) * leftPresetScale,
                        nextListeningFaceApplied.cheekLeft + jordanListeningBehaviorContribution.cheekLeft
                      )
                    );
                    queuePresetTarget(
                      "cheekSquintRight",
                      Math.max(
                        rangeMid(preset.cheekSquintRight) * rightPresetScale,
                        nextListeningFaceApplied.cheekRight + jordanListeningBehaviorContribution.cheekRight
                      )
                    );
                    queuePresetTarget(
                      "eyebrows",
                      sadSentiment
                        ? Math.max(
                            rangeByEnergy([0.06, 0.12], 0.55),
                            jordanListeningBehaviorContribution.brow
                          )
                        : Math.max(
                            rangeMid(preset.eyebrows),
                            nextListeningFaceApplied.brow + jordanListeningBehaviorContribution.brow
                          )
                    );
                    queuePresetTarget(
                      "sad",
                      Math.max(
                        sadSentiment ? rangeByEnergy([0.1, 0.22], 0.45) : 0,
                        jordanListeningBehaviorContribution.sad
                      )
                    );
                    queuePresetTarget(
                      "mouthFrownLeft",
                      Math.max(
                        sadSentiment
                          ? Math.max(rangeByEnergy([0.045, 0.1], 0.45), nextListeningFaceApplied.frownLeft)
                          : 0,
                        jordanListeningBehaviorContribution.frownLeft
                      )
                    );
                    queuePresetTarget(
                      "mouthFrownRight",
                      Math.max(
                        sadSentiment
                          ? Math.max(rangeByEnergy([0.045, 0.1], 0.45), nextListeningFaceApplied.frownRight)
                          : 0,
                        jordanListeningBehaviorContribution.frownRight
                      )
                    );
                    queuePresetTarget("eyeLookDownLeft", rangeMid(preset.eyeLookDownLeft));
                    queuePresetTarget("eyeLookDownRight", rangeMid(preset.eyeLookDownRight));
                    queuePresetTarget("eyeLookUpLeft", rangeMid(preset.eyeLookUpLeft));
                    queuePresetTarget("eyeLookUpRight", rangeMid(preset.eyeLookUpRight));
                  } else if (activeExpressionPreset === "warmSpeaking") {
                    const preset = JORDAN_EXPRESSION_PRESETS.warmSpeaking;
                    const speechSupport =
                      THREE.MathUtils.clamp(speechEnergy, 0, 1) *
                      JORDAN_EXPRESSION_PRESET_TUNING.speechEnergyCheekMultiplier;
                    queuePresetTarget(
                      "cheekSquintLeft",
                      Math.max(
                        rangeByEnergy(preset.cheekSquintLeft, speechSupport) * leftPresetScale,
                        jordanSpeakingBehaviorContribution.cheekLeft
                      )
                    );
                    queuePresetTarget(
                      "cheekSquintRight",
                      Math.max(
                        rangeByEnergy(preset.cheekSquintRight, speechSupport) * rightPresetScale,
                        jordanSpeakingBehaviorContribution.cheekRight
                      )
                    );
                    queuePresetTarget(
                      "eyebrows",
                      Math.max(
                        rangeByEnergy(preset.eyebrows, speechSupport),
                        browOverlay,
                        jordanSpeakingBehaviorContribution.brow
                      )
                    );
                    queuePresetTarget(
                      "mouthSmileLeft",
                      positiveSentiment
                        ? Math.max(
                            rangeByEnergy(preset.mouthSmileLeft, speechSupport) * leftPresetScale,
                            jordanSpeakingBehaviorContribution.smileLeft
                          )
                        : jordanSpeakingBehaviorContribution.smileLeft
                    );
                    queuePresetTarget(
                      "mouthSmileRight",
                      positiveSentiment
                        ? Math.max(
                            rangeByEnergy(preset.mouthSmileRight, speechSupport) * rightPresetScale,
                            jordanSpeakingBehaviorContribution.smileRight
                          )
                        : jordanSpeakingBehaviorContribution.smileRight
                    );
                    queuePresetTarget(
                      "mouthFrownLeft",
                      sadSentiment
                        ? Math.max(
                            rangeByEnergy(preset.mouthFrownLeft, speechSupport) * leftPresetScale,
                            jordanSpeakingBehaviorContribution.frownLeft
                          )
                        : jordanSpeakingBehaviorContribution.frownLeft
                    );
                    queuePresetTarget(
                      "mouthFrownRight",
                      sadSentiment
                        ? Math.max(
                            rangeByEnergy(preset.mouthFrownRight, speechSupport) * rightPresetScale,
                            jordanSpeakingBehaviorContribution.frownRight
                          )
                        : jordanSpeakingBehaviorContribution.frownRight
                    );
                    queuePresetTarget(
                      "sad",
                      Math.max(
                        sadSentiment ? rangeByEnergy(preset.sad, speechSupport) : 0,
                        jordanSpeakingBehaviorContribution.sad
                      )
                    );
                  } else {
                    queuePresetTarget("sad", sadOverlay);
                    queuePresetTarget("mouthSmileLeft", cornerSupport * jordanEyeAsymmetryRef.current.mouthLeft);
                    queuePresetTarget("mouthSmileRight", cornerSupport * jordanEyeAsymmetryRef.current.mouthRight);
                    queuePresetTarget("mouthFrownLeft", frownOverlay * jordanEyeAsymmetryRef.current.mouthLeft);
                    queuePresetTarget("mouthFrownRight", frownOverlay * jordanEyeAsymmetryRef.current.mouthRight);
                    queuePresetTarget("cheekSquintLeft", cheekOverlay * jordanEyeAsymmetryRef.current.cheekLeft);
                    queuePresetTarget("cheekSquintRight", cheekOverlay * jordanEyeAsymmetryRef.current.cheekRight);
                    queuePresetTarget("eyebrows", Math.max(browOverlay, idleBrowTarget));
                  }
                  if (DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY && presenceState === "listening") {
                    setJordanExpressionTarget("mouthSmileLeft", 0.18);
                    setJordanExpressionTarget("mouthSmileRight", 0.18);
                    setJordanExpressionTarget("cheekSquintLeft", 0.14);
                    setJordanExpressionTarget("cheekSquintRight", 0.14);
                    setJordanExpressionTarget("eyebrows", 0.12);
                  }
                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanListeningFaceLogRef.current > 2400
                  ) {
                    lastJordanListeningFaceLogRef.current = now;
                    console.log("[Jordan Listening Face] diagnostics:", {
                      presenceState,
                      listeningFaceActive,
                      brow: nextListeningFaceApplied.brow,
                      smileLeft: nextListeningFaceApplied.smileLeft,
                      smileRight: nextListeningFaceApplied.smileRight,
                      frownLeft: nextListeningFaceApplied.frownLeft,
                      frownRight: nextListeningFaceApplied.frownRight,
                      cheekLeft: nextListeningFaceApplied.cheekLeft,
                      cheekRight: nextListeningFaceApplied.cheekRight,
                      headTiltTarget: listeningFaceTarget.headTilt,
                      headTiltApplied: jordanHeadPresenceAppliedRef.current.tilt,
                      suppressed: listeningFaceSuppressed,
                      sentiment: sentimentLabel,
                    });
                  }
                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanIdleBrowLogRef.current > 2600
                  ) {
                    lastJordanIdleBrowLogRef.current = now;
                    console.log("[Jordan Idle Brow] diagnostics:", {
                      presenceState,
                      idleBrowActive,
                      currentBrowTarget: jordanIdleBrowTargetRef.current,
                      appliedBrowValue: jordanIdleBrowAppliedRef.current,
                      nextTargetHoldDurationMs: Math.round(jordanIdleBrowHoldMsRef.current),
                      suppressed: !idleBrowActive,
                      suppressedReason: idleBrowSuppressionReason,
                    });
                  }
                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanExpressionPresetLogRef.current > 1800
                  ) {
                    lastJordanExpressionPresetLogRef.current = now;
                    console.log("[Jordan Expression Preset] diagnostics:", {
                      activeExpressionPreset,
                      presenceState,
                      sentiment: {
                        label: sentimentLabel,
                        raw: sentiment,
                      },
                      targetsBeforeCaps: presetValuesBeforeCaps,
                      targetsAfterCaps: presetValuesAfterCaps,
                      finalAppliedValues: {
                        sad: jordanMorphValuesRef.current.get("sad") ?? 0,
                        mouthSmileLeft: jordanMorphValuesRef.current.get("mouthSmileLeft") ?? 0,
                        mouthSmileRight: jordanMorphValuesRef.current.get("mouthSmileRight") ?? 0,
                        mouthFrownLeft: jordanMorphValuesRef.current.get("mouthFrownLeft") ?? 0,
                        mouthFrownRight: jordanMorphValuesRef.current.get("mouthFrownRight") ?? 0,
                        cheekSquintLeft: jordanMorphValuesRef.current.get("cheekSquintLeft") ?? 0,
                        cheekSquintRight: jordanMorphValuesRef.current.get("cheekSquintRight") ?? 0,
                        eyebrows: jordanMorphValuesRef.current.get("eyebrows") ?? 0,
                        visemeRest: jordanMorphValuesRef.current.get("viseme_rest") ?? 0,
                      },
                      olderDirectExpressionSystems: "routed-into-preset-layer",
                      eyeFocusPriority: "eye-look morphs are applied after presets",
                      presetSuppressedByDebug,
                    });
                  }
          
                  const safeAmplitudeFallbackJaw =
                    speaking && (!hasTimeline || timelineHasInvalidTimestamps)
                      ? audioNorm * 0.16
                      : 0;
                  const jawSupport = speaking
                    ? Math.max(
                        jordanJawSupportForViseme(activeViseme) *
                          (hasTimeline ? 1 : THREE.MathUtils.clamp(0.65 + audioNorm * 0.35, 0.65, 1)),
                        safeAmplitudeFallbackJaw
                      )
                    : 0;
                  setJordanExpressionTarget("jawOpen", jawSupport);
          
                  if (
                    !jordanIdleStillnessActive &&
                    !jordanListeningStillnessActive &&
                    !jordanSpeakingBehaviorContribution.softProcessingPauseActive &&
                    now >= jordanEyeNextRefocusRef.current
                  ) {
                    const holdRange =
                      presenceState === "listening"
                        ? JORDAN_EYE_FOCUS_TUNING.listeningHoldMs
                        : presenceState === "thinking"
                          ? JORDAN_EYE_FOCUS_TUNING.thinkingHoldMs
                          : presenceState === "speaking"
                            ? JORDAN_EYE_FOCUS_TUNING.speakingHoldMs
                            : JORDAN_EYE_FOCUS_TUNING.idleHoldMs;
                    const eyeMax =
                      presenceState === "listening"
                        ? JORDAN_EYE_FOCUS_TUNING.listeningEyeMax
                        : presenceState === "thinking"
                          ? JORDAN_EYE_FOCUS_TUNING.thinkingDownMax
                          : presenceState === "speaking"
                            ? JORDAN_EYE_FOCUS_TUNING.speakingEyeMax
                            : JORDAN_EYE_FOCUS_TUNING.idleEyeMax;
                    const holdMs =
                      (holdRange[0] + Math.random() * (holdRange[1] - holdRange[0])) *
                      jordanEmotionalModulationProfile.stillnessMultiplier;
                    const holdMostlyStill =
                      presenceState === "listening"
                        ? Math.random() <
                          THREE.MathUtils.clamp(
                            0.76 * jordanEmotionalModulationProfile.stillnessMultiplier,
                            0.48,
                            0.9
                          )
                        : presenceState === "speaking"
                          ? Math.random() <
                            THREE.MathUtils.clamp(
                              0.68 * jordanEmotionalModulationProfile.stillnessMultiplier,
                              0.42,
                              0.88
                            )
                          : Math.random() <
                            THREE.MathUtils.clamp(
                              0.48 * jordanEmotionalModulationProfile.stillnessMultiplier,
                              0.35,
                              0.86
                            );
                    const movementScale =
                      presenceState === "listening"
                        ? 0.42
                        : presenceState === "speaking"
                          ? 0.38
                          : presenceState === "thinking"
                            ? 0.72
                            : 1;
                    const modulatedMovementScale =
                      movementScale *
                      jordanEmotionalModulationProfile.eyeEngagementMultiplier;
                    const downwardBias =
                      presenceState === "thinking"
                        ? JORDAN_EYE_FOCUS_TUNING.thinkingDownBias *
                          ((jordanEmotionalModulationProfile as {
                            thinkingDownBiasMultiplier?: number;
                          }).thinkingDownBiasMultiplier ?? 1)
                        : sadSentiment
                          ? 0.008 * jordanEmotionalModulationProfile.stillnessMultiplier
                          : 0;
                    const drift =
                      (0.006 + Math.random() * eyeMax * 0.55) *
                      modulatedMovementScale;
                    const up = holdMostlyStill
                      ? 0
                      : THREE.MathUtils.clamp(
                          (positiveSentiment && presenceState !== "thinking" ? 0.004 : 0) +
                            Math.random() * drift,
                          0,
                          eyeMax
                        );
                    const down = THREE.MathUtils.clamp(
                      downwardBias * (holdMostlyStill ? 0.78 : 1) +
                        (holdMostlyStill ? 0 : Math.random() * drift),
                      0,
                      eyeMax
                    );
                    const asymmetryRatio =
                      JORDAN_EYE_FOCUS_TUNING.asymmetryAmount[0] +
                      Math.random() *
                        (JORDAN_EYE_FOCUS_TUNING.asymmetryAmount[1] -
                          JORDAN_EYE_FOCUS_TUNING.asymmetryAmount[0]);
                    const asymmetryBase = Math.max(up, down) * asymmetryRatio * 0.5;
                    jordanEyeFocusTargetRef.current = {
                      up,
                      down,
                      asym: holdMostlyStill
                        ? 0
                        : (Math.random() < 0.5 ? -1 : 1) * asymmetryBase,
                      yaw: holdMostlyStill
                        ? 0
                        : THREE.MathUtils.clamp(
                            (Math.random() - 0.5) *
                              2 *
                              JORDAN_EYE_FOCUS_TUNING.horizontalHeadYawMax *
                              modulatedMovementScale,
                            -JORDAN_EYE_FOCUS_TUNING.horizontalHeadYawMax,
                            JORDAN_EYE_FOCUS_TUNING.horizontalHeadYawMax
                          ),
                      holding: holdMostlyStill,
                      holdMs,
                    };
                    jordanEyeNextRefocusRef.current = now + holdMs;
                  }
                  const gazeTarget = jordanEyeFocusTargetRef.current;
                  const gazeBreath = gazeTarget.holding
                    ? 0
                    : Math.sin(idlePhase * 0.62 + 1.2) * 0.0018;
                  const gazeMax =
                    presenceState === "listening"
                      ? JORDAN_EYE_FOCUS_TUNING.listeningEyeMax
                      : presenceState === "thinking"
                        ? JORDAN_EYE_FOCUS_TUNING.thinkingDownMax
                        : presenceState === "speaking"
                          ? JORDAN_EYE_FOCUS_TUNING.speakingEyeMax
                          : JORDAN_EYE_FOCUS_TUNING.idleEyeMax;
                  const gazeUp = THREE.MathUtils.clamp(
                    gazeTarget.up + Math.max(0, gazeBreath),
                    0,
                    gazeMax
                  );
                  const gazeDown = THREE.MathUtils.clamp(
                    gazeTarget.down + Math.max(0, -gazeBreath),
                    0,
                    gazeMax
                  );
                  const gazeAsym = gazeTarget.asym;
                  const schedulerEyeUp =
                    jordanIdleBehaviorContribution.eyeUp +
                    jordanListeningBehaviorContribution.eyeUp +
                    jordanSpeakingBehaviorContribution.eyeUp;
                  const schedulerEyeDown =
                    jordanIdleBehaviorContribution.eyeDown +
                    jordanListeningBehaviorContribution.eyeDown +
                    jordanSpeakingBehaviorContribution.eyeDown;
                  const schedulerEyeAsym =
                    jordanIdleBehaviorContribution.eyeAsym +
                    jordanListeningBehaviorContribution.eyeAsym +
                    jordanSpeakingBehaviorContribution.eyeAsym;
                  setJordanExpressionTarget(
                    "eyeLookUpLeft",
                    THREE.MathUtils.clamp(
                      gazeUp + schedulerEyeUp + gazeAsym + schedulerEyeAsym,
                      0,
                      gazeMax
                    )
                  );
                  setJordanExpressionTarget(
                    "eyeLookUpRight",
                    THREE.MathUtils.clamp(
                      gazeUp + schedulerEyeUp - gazeAsym - schedulerEyeAsym,
                      0,
                      gazeMax
                    )
                  );
                  setJordanExpressionTarget(
                    "eyeLookDownLeft",
                    THREE.MathUtils.clamp(
                      gazeDown + schedulerEyeDown - gazeAsym - schedulerEyeAsym,
                      0,
                      gazeMax
                    )
                  );
                  setJordanExpressionTarget(
                    "eyeLookDownRight",
                    THREE.MathUtils.clamp(
                      gazeDown + schedulerEyeDown + gazeAsym + schedulerEyeAsym,
                      0,
                      gazeMax
                    )
                  );

                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanEyeFocusLogRef.current > 1800
                  ) {
                    lastJordanEyeFocusLogRef.current = now;
                    console.log("[Jordan RFv2 Eye Focus] diagnostics:", {
                      presenceState,
                      currentGazeTarget: gazeTarget,
                      appliedEyeLook: {
                        upLeft: jordanMorphValuesRef.current.get("eyeLookUpLeft") ?? 0,
                        upRight: jordanMorphValuesRef.current.get("eyeLookUpRight") ?? 0,
                        downLeft: jordanMorphValuesRef.current.get("eyeLookDownLeft") ?? 0,
                        downRight: jordanMorphValuesRef.current.get("eyeLookDownRight") ?? 0,
                      },
                      nextHoldDurationMs: Math.round(gazeTarget.holdMs),
                      horizontalSimulationActive:
                        Math.abs(gazeTarget.yaw) > 0.0001 &&
                        jordanIdlePresenceBonesRef.current.length > 0 &&
                        (presenceState === "idle" || presenceState === "listening"),
                      eyeFocusSuppressed: false,
                    });
                  }

                  const listeningMorphTestActive =
                    useRfv2Morphs &&
                    DEBUG_JORDAN_LISTENING_MORPH_TEST &&
                    presenceState === "listening" &&
                    !speaking;
                  const listeningTestMorph = DEBUG_JORDAN_TEST_MORPH as JordanMorphName;
                  if (listeningMorphTestActive) {
                    JORDAN_RFV2_LISTENING_MORPH_TEST_SEQUENCE.forEach((name) =>
                      setJordanExpressionTarget(name, 0)
                    );
                    targets.set("viseme_rest", 0.15);
                    if (JORDAN_RFV2_LISTENING_MORPH_TEST_SEQUENCE.includes(listeningTestMorph)) {
                      setJordanExpressionTarget(listeningTestMorph, DEBUG_JORDAN_TEST_VALUE);
                    }
                    if (
                      process.env.NODE_ENV === "development" &&
                      now - lastJordanMorphTestLogRef.current > 1000
                    ) {
                      lastJordanMorphTestLogRef.current = now;
                      console.log("[Jordan Morph Test] listening test active:", {
                        morph: listeningTestMorph,
                        value: DEBUG_JORDAN_TEST_VALUE,
                      });
                    }
                  }

                  if (DEBUG_JORDAN_EXPRESSION_TEST && !listeningMorphTestActive) {
                    const expressionIndex = Math.floor(now / 1500) % JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE.length;
                    const activeExpressionMorph = JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE[expressionIndex];
                    JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE.forEach((name) =>
                      setJordanExpressionTarget(name, 0)
                    );
                    setJordanExpressionTarget(
                      activeExpressionMorph,
                      activeExpressionMorph === "eyebrows"
                        ? 0.14
                        : activeExpressionMorph === "jawOpen"
                          ? 0.22
                          : activeExpressionMorph.startsWith("eyeBlink")
                            ? 0.8
                            : 0.18
                    );
                    if (process.env.NODE_ENV === "development" && now - lastJordanPresenceLogRef.current > 1400) {
                      console.log("[Jordan Expression] Test morph active", {
                        activeExpressionMorph,
                        found: (jordanMorphBindingsRef.current.get(activeExpressionMorph)?.length ?? 0) > 0,
                      });
                    }
                  }

                  const headPresenceAllowed =
                    useRfv2Morphs &&
                    (presenceState === "idle" ||
                      presenceState === "listening" ||
                      presenceState === "speaking");
                  const headPresenceSuppressedBySpeaking =
                    presenceState === "speaking" && !jordanSpeakingSchedulerEligible;
                  const headPresenceSuppressedByThinking = presenceState === "thinking";
                  if (
                    headPresenceAllowed &&
                    !jordanIdleStillnessActive &&
                    !jordanListeningStillnessActive &&
                    jordanIdlePresenceBonesRef.current.length > 0 &&
                    now >= jordanHeadPresenceNextTargetRef.current
                  ) {
                    const yawMax =
                      presenceState === "listening"
                        ? JORDAN_HEAD_PRESENCE_TUNING.listeningYawMax
                        : presenceState === "speaking"
                          ? JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportYawRange[1]
                        : JORDAN_HEAD_PRESENCE_TUNING.idleYawMax;
                    const tiltMax =
                      presenceState === "listening"
                        ? JORDAN_HEAD_PRESENCE_TUNING.listeningTiltMax
                        : presenceState === "speaking"
                          ? JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[1]
                        : JORDAN_HEAD_PRESENCE_TUNING.idleTiltMax;
                    const attentiveBias = presenceState === "listening" ? 0.0015 : 0;
                    const eyeFocusYaw = THREE.MathUtils.clamp(
                      gazeTarget.yaw,
                      -JORDAN_EYE_FOCUS_TUNING.horizontalHeadYawMax,
                      JORDAN_EYE_FOCUS_TUNING.horizontalHeadYawMax
                    );
                    const listeningFaceHeadTilt = THREE.MathUtils.clamp(
                      nextListeningFaceApplied.headTilt,
                      -JORDAN_LISTENING_FACE_TUNING.headTiltRadians[1],
                      JORDAN_LISTENING_FACE_TUNING.headTiltRadians[1]
                    );
                    const tiltLimit =
                      presenceState === "listening"
                        ? Math.max(tiltMax, JORDAN_LISTENING_FACE_TUNING.headTiltRadians[1])
                        : tiltMax;
                    jordanHeadPresenceTargetRef.current = {
                      yaw: THREE.MathUtils.clamp(
                        (Math.random() - 0.5) * 2 * yawMax + attentiveBias + eyeFocusYaw,
                        -yawMax,
                        yawMax
                      ),
                      tilt: THREE.MathUtils.clamp(
                        (Math.random() - 0.5) * 2 * tiltMax + listeningFaceHeadTilt,
                        -tiltLimit,
                        tiltLimit
                      ),
                    };
                    jordanHeadPresenceNextTargetRef.current =
                      now +
                      JORDAN_HEAD_PRESENCE_TUNING.minTargetHoldMs +
                      Math.random() *
                        (JORDAN_HEAD_PRESENCE_TUNING.maxTargetHoldMs -
                          JORDAN_HEAD_PRESENCE_TUNING.minTargetHoldMs);
                  } else if (!headPresenceAllowed) {
                    jordanHeadPresenceTargetRef.current = { yaw: 0, tilt: 0 };
                    jordanHeadPresenceNextTargetRef.current = now + JORDAN_HEAD_PRESENCE_TUNING.minTargetHoldMs;
                  }

                  const schedulerHeadYawLimit =
                    presenceState === "listening"
                      ? JORDAN_HEAD_PRESENCE_TUNING.listeningYawMax
                      : presenceState === "speaking"
                        ? JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportYawRange[1]
                      : JORDAN_HEAD_PRESENCE_TUNING.idleYawMax;
                  const schedulerHeadTiltLimit =
                    presenceState === "listening"
                      ? JORDAN_HEAD_PRESENCE_TUNING.listeningTiltMax
                      : presenceState === "speaking"
                        ? JORDAN_SPEAKING_BEHAVIOR_TUNING.headSupportTiltRange[1]
                      : JORDAN_HEAD_PRESENCE_TUNING.idleTiltMax;
                  const schedulerHeadYawTarget = THREE.MathUtils.clamp(
                    jordanHeadPresenceTargetRef.current.yaw +
                      jordanIdleBehaviorContribution.headYaw +
                      jordanListeningBehaviorContribution.headYaw +
                      jordanSpeakingBehaviorContribution.headYaw,
                    -schedulerHeadYawLimit,
                    schedulerHeadYawLimit
                  );
                  const schedulerHeadTiltTarget = THREE.MathUtils.clamp(
                    jordanHeadPresenceTargetRef.current.tilt +
                      jordanIdleBehaviorContribution.headTilt +
                      jordanListeningBehaviorContribution.headTilt +
                      jordanSpeakingBehaviorContribution.headTilt,
                    -schedulerHeadTiltLimit,
                    schedulerHeadTiltLimit
                  );
                  const appliedHeadYaw = THREE.MathUtils.damp(
                    jordanHeadPresenceAppliedRef.current.yaw,
                    schedulerHeadYawTarget,
                    JORDAN_HEAD_PRESENCE_TUNING.blendSpeed,
                    dt
                  );
                  const appliedHeadTilt = THREE.MathUtils.damp(
                    jordanHeadPresenceAppliedRef.current.tilt,
                    schedulerHeadTiltTarget,
                    JORDAN_HEAD_PRESENCE_TUNING.blendSpeed,
                    dt
                  );
                  jordanHeadPresenceAppliedRef.current = {
                    yaw: appliedHeadYaw,
                    tilt: appliedHeadTilt,
                  };

                  if (jordanIdlePresenceBonesRef.current.length > 0) {
                    jordanIdlePresenceBonesRef.current.forEach((bone, index) => {
                      const defaults = faceBoneDefaultsRef.current.get(bone.uuid);
                      if (!defaults) return;
                      const normalizedBoneName = (bone.name || "")
                        .trim()
                        .replace(/[._\s-]/g, "")
                        .toLowerCase();
                      const weight = normalizedBoneName === "neck" ? 1 : index === 0 ? 0.72 : 0.52;
                      bone.rotation.x = defaults.x;
                      bone.rotation.y = defaults.y + appliedHeadYaw * weight;
                      bone.rotation.z = defaults.z + appliedHeadTilt * weight;
                    });
                  }

                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanHeadPresenceLogRef.current > 2600
                  ) {
                    lastJordanHeadPresenceLogRef.current = now;
                    console.log("[Jordan Head Presence] diagnostics:", {
                      bones: jordanIdlePresenceBonesRef.current.map((bone) => bone.name),
                      presenceState,
                      targetYaw: jordanHeadPresenceTargetRef.current.yaw,
                      targetTilt: jordanHeadPresenceTargetRef.current.tilt,
                      appliedYaw: jordanHeadPresenceAppliedRef.current.yaw,
                      appliedTilt: jordanHeadPresenceAppliedRef.current.tilt,
                      suppressedBySpeaking: headPresenceSuppressedBySpeaking,
                      suppressedByThinking: headPresenceSuppressedByThinking,
                    });
                  }

                  if (
                    process.env.NODE_ENV === "development" &&
                    DEBUG_JORDAN_BEHAVIOR_TIMING &&
                    now - lastJordanBehaviorTimingLogRef.current > 1800
                  ) {
                    lastJordanBehaviorTimingLogRef.current = now;
                    console.log("[Jordan Behavior Timing] orchestration:", {
                      presenceState,
                      sentimentLabel,
                      rawSentimentLabel: sentiment,
                      emotionalModulation: {
                        mode: jordanEmotionalModulationMode,
                        profile: jordanEmotionalModulationProfile,
                        delayMultiplier:
                          jordanEmotionalModulationProfile.reactionDelayMultiplier,
                        stillnessMultiplier:
                          jordanEmotionalModulationProfile.stillnessMultiplier,
                        expressionMultipliers: {
                          cheekWarmth:
                            jordanEmotionalModulationProfile.cheekWarmthMultiplier,
                          smile: jordanEmotionalModulationProfile.smileMultiplier,
                          concern:
                            (jordanEmotionalModulationProfile as {
                              concernMultiplier?: number;
                            }).concernMultiplier ?? 1,
                        },
                        eyeMultiplier:
                          jordanEmotionalModulationProfile.eyeEngagementMultiplier,
                        blinkMetadata: {
                          delayMultiplier:
                            jordanEmotionalModulationProfile.blinkDelayMultiplier,
                          runtimeBlinkUnchanged: true,
                        },
                        reactionProbabilityChanges:
                          jordanSchedulerDebug?.reactionProbabilityChanges,
                      },
                      activeSchedulerEvents: jordanSchedulerActiveEvents.map((event) => ({
                        id: event.id,
                        state: event.state,
                        type: event.type,
                        startsAtMs: Math.round(event.startsAtMs),
                        endsAtMs: Math.round(event.endsAtMs),
                        holdUntilMs: Math.round(event.holdUntilMs),
                        intensity: event.intensity,
                        weight: event.weight,
                        channels: event.channels?.map((channel) => ({
                          channel: channel.channel,
                          startsAtMs: Math.round(channel.startsAtMs),
                          endsAtMs: Math.round(channel.endsAtMs),
                          intensity: channel.intensity,
                          active:
                            channel.startsAtMs <= now &&
                            channel.endsAtMs >= now &&
                            !(
                              channel.interrupted &&
                              typeof channel.metadata?.interruptedAtMs === "number" &&
                              now >= channel.metadata.interruptedAtMs
                            ),
                          interrupted: channel.interrupted ?? false,
                          offsetMs: channel.metadata?.offsetMs,
                        })),
                      })),
                      motionIndependence: {
                        selectedChannels: jordanSchedulerDebug?.selectedChannels,
                        skippedChannels: jordanSchedulerDebug?.skippedChannels,
                        noReactionDecision: jordanSchedulerDebug?.noReactionDecision,
                        maxChannelsPerEvent: jordanSchedulerDebug?.maxChannelsPerEvent,
                        interruptionVarianceMs:
                          jordanSchedulerDebug?.interruptionVarianceMs,
                        activeChannelStatus: jordanSchedulerActiveEvents.flatMap(
                          (event) =>
                            event.channels?.map((channel) => ({
                              eventType: event.type,
                              channel: channel.channel,
                              active:
                                channel.startsAtMs <= now &&
                                channel.endsAtMs >= now,
                              interrupted: channel.interrupted ?? false,
                            })) ?? []
                        ),
                      },
                      finalHumanization: {
                        targetRatio: {
                          stillness:
                            JORDAN_FINAL_HUMANIZATION_TUNING.targetStillnessRatio,
                          microBehavior:
                            JORDAN_FINAL_HUMANIZATION_TUNING.targetMicroBehaviorRatio,
                          reaction:
                            JORDAN_FINAL_HUMANIZATION_TUNING.targetReactionRatio,
                        },
                        rollingRatio: jordanSchedulerDebug?.humanization.rollingRatio,
                        eventCountInWindow:
                          jordanSchedulerDebug?.humanization.eventCountInWindow,
                        maxEventsPerWindow:
                          jordanSchedulerDebug?.humanization.maxEventsPerWindow,
                        repeatedIntentCount:
                          jordanSchedulerDebug?.humanization.repeatedIntentCount,
                        skippedReason:
                          jordanSchedulerDebug?.humanization.skippedReason,
                        overactivityPreventionActive:
                          jordanSchedulerDebug?.humanization
                            .overactivityPreventionActive,
                        minimumStillnessUntilMs:
                          jordanSchedulerDebug?.humanization.minimumStillnessUntilMs,
                        subtletyMultiplier:
                          JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier[
                            presenceState
                          ],
                      },
                      conversationalAwareness: {
                        beat: jordanSchedulerDebug?.conversationalBeat?.beat,
                        selectedAwarenessEvent:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.selectedAwarenessIntent,
                        skippedReason:
                          jordanSchedulerDebug?.conversationalBeat?.skippedReason,
                        userPauseDurationMs:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.userPauseDurationMs,
                        latestUserTextEndsSentence:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.latestUserTextEndsSentence,
                        latestJordanTextEndsSentence:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.latestJordanTextEndsSentence,
                        speechJustStarted:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.speechJustStarted,
                        speechJustEnded:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.speechJustEnded,
                        sentimentCompound:
                          jordanSchedulerDebug?.conversationalBeat
                            ?.sentimentCompound,
                        missingSignals:
                          jordanSchedulerDebug?.conversationalBeat?.missingSignals,
                      },
                      consumedIdleEvents: jordanIdleConsumedEvents.map((event) => event.type),
                      consumedListeningEvents: jordanListeningConsumedEvents.map((event) => event.type),
                      consumedSpeakingEvents: jordanSpeakingConsumedEvents.map((event) => event.type),
                      ignoredEvents: [
                        ...jordanIdleIgnoredEvents.map((event) => event.type),
                        ...jordanListeningIgnoredEvents.map((event) => event.type),
                        ...jordanSpeakingIgnoredEvents.map((event) => event.type),
                      ],
                      idleStillnessActive: jordanIdleStillnessActive,
                      listeningStillnessActive: jordanListeningStillnessActive,
                      emotionalLatencyApplied:
                        jordanListeningBehaviorContribution.emotionalLatencyScale,
                      idleEyeContribution: {
                        up: jordanIdleBehaviorContribution.eyeUp,
                        down: jordanIdleBehaviorContribution.eyeDown,
                        asym: jordanIdleBehaviorContribution.eyeAsym,
                      },
                      idleBrowContribution: jordanIdleBehaviorContribution.brow,
                      idleMouthRestContribution: {
                        visemeRest: jordanIdleBehaviorContribution.visemeRest,
                        smileLeft: jordanIdleBehaviorContribution.smileLeft,
                        smileRight: jordanIdleBehaviorContribution.smileRight,
                        cheekLeft: jordanIdleBehaviorContribution.cheekLeft,
                        cheekRight: jordanIdleBehaviorContribution.cheekRight,
                      },
                      idleHeadContribution: {
                        yaw: jordanIdleBehaviorContribution.headYaw,
                        tilt: jordanIdleBehaviorContribution.headTilt,
                      },
                      listeningAckContribution: {
                        brow: jordanListeningBehaviorContribution.brow,
                        smileLeft: jordanListeningBehaviorContribution.smileLeft,
                        smileRight: jordanListeningBehaviorContribution.smileRight,
                        cheekLeft: jordanListeningBehaviorContribution.cheekLeft,
                        cheekRight: jordanListeningBehaviorContribution.cheekRight,
                      },
                      listeningConcernContribution: {
                        frownLeft: jordanListeningBehaviorContribution.frownLeft,
                        frownRight: jordanListeningBehaviorContribution.frownRight,
                        sad: jordanListeningBehaviorContribution.sad,
                        smileMultiplier: jordanListeningBehaviorContribution.smileMultiplier,
                      },
                      listeningEyeContribution: {
                        up: jordanListeningBehaviorContribution.eyeUp,
                        down: jordanListeningBehaviorContribution.eyeDown,
                        asym: jordanListeningBehaviorContribution.eyeAsym,
                      },
                      listeningHeadContribution: {
                        yaw: jordanListeningBehaviorContribution.headYaw,
                        tilt: jordanListeningBehaviorContribution.headTilt,
                      },
                      speaking: {
                        speechEnergy: jordanSpeakingEnergyRef.current,
                        cheekContribution: {
                          left: jordanSpeakingBehaviorContribution.cheekLeft,
                          right: jordanSpeakingBehaviorContribution.cheekRight,
                        },
                        browContribution: jordanSpeakingBehaviorContribution.brow,
                        smileFrownContribution: {
                          smileLeft: jordanSpeakingBehaviorContribution.smileLeft,
                          smileRight: jordanSpeakingBehaviorContribution.smileRight,
                          frownLeft: jordanSpeakingBehaviorContribution.frownLeft,
                          frownRight: jordanSpeakingBehaviorContribution.frownRight,
                          sad: jordanSpeakingBehaviorContribution.sad,
                        },
                        eyeContribution: {
                          up: jordanSpeakingBehaviorContribution.eyeUp,
                          down: jordanSpeakingBehaviorContribution.eyeDown,
                          asym: jordanSpeakingBehaviorContribution.eyeAsym,
                        },
                        headContribution: {
                          yaw: jordanSpeakingBehaviorContribution.headYaw,
                          tilt: jordanSpeakingBehaviorContribution.headTilt,
                        },
                        turnEndReleaseTriggered:
                          jordanSpeakingBehaviorContribution.turnEndReleaseActive,
                        softProcessingPauseActive:
                          jordanSpeakingBehaviorContribution.softProcessingPauseActive,
                        timestampedLipSyncUnchanged: true,
                      },
                      lipSyncUnchanged: true,
                      cameraAndSaraUnchanged: true,
                      schedulerWritesMorphsDirectly: false,
                    });
                  }

                  JORDAN_EXPRESSION_AUTHORITY_MORPHS.forEach((name) =>
                    finalizeJordanExpressionTarget(name)
                  );
          
                  const speechAlpha = 1 - Math.exp(-JORDAN_RFV2_FACE_TUNING.speechLerpSpeed * dt);
                  const decayAlpha = 1 - Math.exp(-JORDAN_RFV2_FACE_TUNING.decayLerpSpeed * dt);
                  const jawAlpha = 1 - Math.exp(-JORDAN_RFV2_FACE_TUNING.jawLerpSpeed * dt);
                  const emotionAlpha = 1 - Math.exp(-JORDAN_EYE_INTELLIGENCE_TUNING.emotionalBlendSpeed * dt);
                  const gazeAlpha = 1 - Math.exp(-JORDAN_EYE_FOCUS_TUNING.blendSpeed * dt);
                  const idleAlpha = 1 - Math.exp(-JORDAN_RFV2_IDLE_TUNING.idleBlendSpeed * dt);
                  const presetAlpha = 1 - Math.exp(
                    (activeExpressionPreset === "warmSpeaking"
                      ? -JORDAN_EXPRESSION_PRESET_TUNING.speakingBlendSpeed
                      : -JORDAN_EXPRESSION_PRESET_TUNING.blendSpeed) * dt
                  );
                  JORDAN_MORPH_NAMES.forEach((name) => {
                    const listeningBlinkTestActive =
                      listeningMorphTestActive && isJordanBlinkMorph(name);
                    if (isJordanBlinkMorph(name) && !listeningBlinkTestActive) return;
                    const prev = jordanMorphValuesRef.current.get(name) ?? 0;
                    const rawTarget = targets.get(name) ?? 0;
                    const targetValue = isRfv2VisemeMorphName(name)
                      ? THREE.MathUtils.smootherstep(
                          THREE.MathUtils.clamp(
                            rawTarget / JORDAN_RFV2_FACE_TUNING.visemeMaxStrength,
                            0,
                            1
                          ),
                          0,
                          1
                        ) * JORDAN_RFV2_FACE_TUNING.visemeMaxStrength
                      : rawTarget;
                    const alpha = isRfv2VisemeMorphName(name)
                      ? targetValue > prev
                        ? speechAlpha
                        : decayAlpha
                      : name === "jawOpen"
                        ? jawAlpha
                        : name.startsWith("eyeLook")
                          ? gazeAlpha
                          : activeExpressionPreset &&
                            !presetSuppressedByDebug &&
                            (name === "sad" ||
                              name.startsWith("mouthSmile") ||
                              name.startsWith("mouthFrown") ||
                              name.startsWith("cheekSquint") ||
                              name === "eyebrows")
                            ? presetAlpha
                          : !speaking && (name === "viseme_rest" || name.startsWith("mouthSmile") || name.startsWith("cheekSquint") || name === "eyebrows")
                            ? idleAlpha
                            : emotionAlpha;
                    const next = THREE.MathUtils.lerp(prev, targetValue, alpha);
                    jordanMorphValuesRef.current.set(name, next);
                    const bindings = jordanMorphBindingsRef.current.get(name) ?? [];
                    let appliedInfluenceTotal = 0;
                    let appliedInfluenceCount = 0;
                    bindings.forEach(({ mesh, index }) => {
                      const influences = mesh.morphTargetInfluences;
                      if (!influences || index >= influences.length) return;
                      influences[index] = next;
                      appliedInfluenceTotal += influences[index] ?? 0;
                      appliedInfluenceCount += 1;
                    });
                    if (
                      (JORDAN_EXPRESSION_AUTHORITY_MORPHS as readonly JordanMorphName[]).includes(
                        name
                      )
                    ) {
                      const existing = expressionAuthorityDiagnostics.get(name);
                      expressionAuthorityDiagnostics.set(name, {
                        requestedTargetValue: existing?.requestedTargetValue ?? rawTarget,
                        clampLimit: existing?.clampLimit ?? getJordanExpressionCap(name),
                        valueAfterClamp: existing?.valueAfterClamp ?? targetValue,
                        previousSmoothedValue: prev,
                        finalAppliedMorphTargetInfluence:
                          appliedInfluenceCount > 0
                            ? appliedInfluenceTotal / appliedInfluenceCount
                            : null,
                        overwrittenLater: existing?.overwrittenLater ?? false,
                      });
                    }
                  });

                  if (
                    process.env.NODE_ENV === "development" &&
                    now - lastJordanExpressionAuthorityLogRef.current > 2400
                  ) {
                    lastJordanExpressionAuthorityLogRef.current = now;
                    console.log("[Jordan Expression Authority] diagnostics:", {
                      presenceState,
                      speaking,
                      strongExpressionVerifyMode: DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
                      values: Object.fromEntries(
                        JORDAN_EXPRESSION_AUTHORITY_MORPHS.map((name) => {
                          const entry =
                            expressionAuthorityDiagnostics.get(name) ??
                            ({
                              requestedTargetValue: targets.get(name) ?? 0,
                              clampLimit: getJordanExpressionCap(name),
                              valueAfterClamp: targets.get(name) ?? 0,
                              previousSmoothedValue: jordanMorphValuesRef.current.get(name) ?? 0,
                              finalAppliedMorphTargetInfluence: null,
                              overwrittenLater: false,
                            } satisfies JordanExpressionAuthorityEntry);
                          return [name, entry];
                        })
                      ),
                    });
                  }
          
                  const activeVisemeBindings = activeViseme
                    ? jordanMorphBindingsRef.current.get(activeViseme) ?? []
                    : [];
                  const activeVisemeActualInfluence =
                    activeVisemeBindings.length > 0
                      ? activeVisemeBindings.reduce((sum, binding) => {
                          const influences = binding.mesh.morphTargetInfluences;
                          return sum + (influences?.[binding.index] ?? 0);
                        }, 0) / activeVisemeBindings.length
                      : 0;
                  const activeVisemeTargetValue = activeViseme
                    ? targets.get(activeViseme) ?? 0
                    : 0;
                  const jawOpenValue = jordanMorphValuesRef.current.get("jawOpen") ?? 0;
          
                  if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
                    if (activeViseme !== lastJordanActiveVisemeRef.current) {
                      const morphFound = activeVisemeBindings.length > 0;
                      const influenceChanged =
                        Math.abs(activeVisemeActualInfluence - lastJordanMorphInfluenceRef.current) > 0.001;
                      if (!morphFound) {
                        console.warn("[Jordan] Active viseme morph target missing", {
                          activeViseme,
                          activePhoneme: activePhoneme?.phoneme ?? null,
                        });
                      }
                      if (activeViseme && morphFound && activeVisemeTargetValue > 0 && !influenceChanged) {
                        console.warn("[Jordan] Active viseme morph influence did not change", {
                          activeViseme,
                          targetMorphValue: activeVisemeTargetValue,
                          actualMorphInfluenceValue: activeVisemeActualInfluence,
                          previousMorphInfluenceValue: lastJordanMorphInfluenceRef.current,
                        });
                      }
                      lastJordanActiveVisemeRef.current = activeViseme;
                    }
                    lastJordanMorphInfluenceRef.current = activeVisemeActualInfluence;
                    setJordanPhonemeDebug({
                      audioCurrentTime,
                      lookAheadMs: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds * 1000,
                      phonemeTimelineLength: timeline?.phonemes.length ?? 0,
                      activePhoneme: activePhoneme?.rawPhoneme ?? activePhoneme?.phoneme ?? null,
                      normalizedPhoneme:
                        activePhoneme?.debugNormalizedPhoneme ??
                        (activePhoneme
                          ? normalizePhonemeLabelForDebug(activePhoneme.rawPhoneme ?? activePhoneme.phoneme)
                          : null),
                      activeViseme,
                      activeVisemeTargetValue,
                      jawOpenValue,
                      fallbackModeActive: !hasTimeline || timelineHasInvalidTimestamps,
                      oldMouthDriverSkipped: true,
                    });
                    if (now - lastJordanPresenceLogRef.current > 2500) {
                      lastJordanPresenceLogRef.current = now;
                      console.log("[Jordan] Idle presence diagnostics:", {
                        presenceState,
                        listening: presenceState === "listening",
                        thinking: presenceState === "thinking",
                        eyeSystemSuppressedDuringSpeaking: false,
                        idleLayerSuppressed: presenceState === "speaking",
                        sentimentLabel,
                        emotionalState,
                        speechEnergy,
                        idleMorphTargets: {
                          viseme_rest: targets.get("viseme_rest") ?? 0,
                          mouthSmileLeft: targets.get("mouthSmileLeft") ?? 0,
                          mouthSmileRight: targets.get("mouthSmileRight") ?? 0,
                          eyebrows: targets.get("eyebrows") ?? 0,
                          cheekSquintLeft: targets.get("cheekSquintLeft") ?? 0,
                          cheekSquintRight: targets.get("cheekSquintRight") ?? 0,
                        },
                        speakingExpressionTargets: {
                          sad: targets.get("sad") ?? 0,
                          mouthFrownLeft: targets.get("mouthFrownLeft") ?? 0,
                          mouthFrownRight: targets.get("mouthFrownRight") ?? 0,
                          mouthSmileLeft: targets.get("mouthSmileLeft") ?? 0,
                          mouthSmileRight: targets.get("mouthSmileRight") ?? 0,
                          cheekSquintLeft: targets.get("cheekSquintLeft") ?? 0,
                          cheekSquintRight: targets.get("cheekSquintRight") ?? 0,
                          eyebrows: targets.get("eyebrows") ?? 0,
                        },
                        speakingSupportValues: {
                          speechEnergy,
                          cheekOverlay,
                          browOverlay,
                          cornerSupport,
                          sadOverlay,
                          smileOverlay,
                          frownOverlay,
                        },
                        listeningFace: {
                          listeningFaceActive,
                          applied: nextListeningFaceApplied,
                          target: listeningFaceTarget,
                          sentiment: sentimentLabel,
                          suppressed: listeningFaceSuppressed,
                        },
                        asymmetryValues: jordanEyeAsymmetryRef.current,
                        appliedExpressionMorphValues: Object.fromEntries(
                          JORDAN_RFV2_MORPH_AUDIT_NAMES.map((name) => [
                            name,
                            jordanMorphValuesRef.current.get(name) ?? 0,
                          ])
                        ),
                        gazeTargets: {
                          currentEyeTarget: jordanEyeFocusTargetRef.current,
                          eyeLookUpLeft: targets.get("eyeLookUpLeft") ?? 0,
                          eyeLookUpRight: targets.get("eyeLookUpRight") ?? 0,
                          eyeLookDownLeft: targets.get("eyeLookDownLeft") ?? 0,
                          eyeLookDownRight: targets.get("eyeLookDownRight") ?? 0,
                        },
                        blinkMode: getJordanBlinkMode(jordanMorphBindingsRef.current),
                        safeBreathingBones: jordanIdlePresenceBonesRef.current.map((bone) => bone.name),
                      });
                    }
                  }
          
                  const jordanSpeechDiagnosticKey = `${activeViseme ?? "none"}:${timeline?.sentiment ?? "none"}`;
                  if (
                    process.env.NODE_ENV === "development" &&
                    speaking &&
                    (now - lastJordanDiagnosticLogRef.current > 900 ||
                      jordanSpeechDiagnosticKey !== lastJordanDiagnosticVisemeRef.current)
                  ) {
                    lastJordanDiagnosticLogRef.current = now;
                    lastJordanDiagnosticVisemeRef.current = jordanSpeechDiagnosticKey;
                    let activePhonemeLabel: string | null = null;
                    if (timeline) {
                      for (let i = 0; i < timeline.phonemes.length; i += 1) {
                        const phoneme = timeline.phonemes[i];
                        const nextPhoneme = timeline.phonemes[i + 1];
                        const end = phoneme.end ?? nextPhoneme?.start ?? phoneme.start + 0.14;
                        if (speechTime >= phoneme.start && speechTime < end) {
                          activePhonemeLabel = phoneme.phoneme;
                          break;
                        }
                      }
                    }
                    console.log("[Avatar] Jordan speech diagnostics:", {
                      currentAudioTime: audioCurrentTime,
                      audioCurrentTime,
                      speechTime,
                      phoneme: activePhonemeLabel,
                      normalizedPhoneme:
                        activePhoneme?.debugNormalizedPhoneme ??
                        (activePhoneme
                          ? normalizePhonemeLabelForDebug(activePhoneme.rawPhoneme ?? activePhoneme.phoneme)
                          : null),
                      activeViseme,
                      activeVisemeValue: activeViseme
                        ? jordanMorphValuesRef.current.get(activeViseme) ?? 0
                        : 0,
                      morphValueApplied: activeViseme
                        ? jordanMorphValuesRef.current.get(activeViseme) ?? 0
                        : jawOpenValue,
                      morphTargetFound: activeVisemeBindings.length > 0,
                      targetMorphValue: activeVisemeTargetValue,
                      actualMorphInfluenceValue: activeVisemeActualInfluence,
                      presenceState,
                      speechEnergy,
                      sentimentLabel,
                      emotionalState,
                      lookAheadSeconds: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds,
                      lookAheadMs: JORDAN_RFV2_FACE_TUNING.lookAheadSeconds * 1000,
                      facialTuning: JORDAN_RFV2_FACE_TUNING,
                      eyeIntelligenceTuning: JORDAN_EYE_INTELLIGENCE_TUNING,
                      currentEyeTarget: jordanEyeFocusTargetRef.current,
                      asymmetryValues: jordanEyeAsymmetryRef.current,
                      listening: presenceState === "listening",
                      thinking: presenceState === "thinking",
                      eyeSystemSuppressedDuringSpeaking: false,
                      blinkMode: getJordanBlinkMode(jordanMorphBindingsRef.current),
                      jawOpenSupportActive:
                        (jordanMorphBindingsRef.current.get("jawOpen")?.length ?? 0) > 0,
                      jawOpenValue: jordanMorphValuesRef.current.get("jawOpen") ?? 0,
                      oldMouthDriverSkipped: true,
                      emotion: {
                        sad: jordanMorphValuesRef.current.get("sad") ?? 0,
                        mouthFrownLeft: jordanMorphValuesRef.current.get("mouthFrownLeft") ?? 0,
                        mouthFrownRight: jordanMorphValuesRef.current.get("mouthFrownRight") ?? 0,
                        mouthSmileLeft: jordanMorphValuesRef.current.get("mouthSmileLeft") ?? 0,
                        mouthSmileRight: jordanMorphValuesRef.current.get("mouthSmileRight") ?? 0,
                        cheekSquintLeft: jordanMorphValuesRef.current.get("cheekSquintLeft") ?? 0,
                        cheekSquintRight: jordanMorphValuesRef.current.get("cheekSquintRight") ?? 0,
                        eyebrows: jordanMorphValuesRef.current.get("eyebrows") ?? 0,
                      },
                      speakingSupportValues: {
                        cheekOverlay,
                        browOverlay,
                        cornerSupport,
                        sadOverlay,
                        smileOverlay,
                        frownOverlay,
                      },
                      appliedExpressionMorphValues: Object.fromEntries(
                        JORDAN_RFV2_MORPH_AUDIT_NAMES.map((name) => [
                          name,
                          jordanMorphValuesRef.current.get(name) ?? 0,
                        ])
                      ),
                    });
                  }
                }
	          if (!saraV3RawAuditMode && isSaraV3Avatar && saraV3ControllerRef.current) {
	            updateSaraV3VisemeDriver({
	              state: saraV3VisemeStateRef.current,
	              bindings: saraV3ControllerRef.current.bindings,
	              timeline: avatarPhonemeTimelineRef.current,
	              audioCurrentTime: avatarAudioCurrentTimeRef.current,
	              audioLevel: mouthAudioLevelRef.current,
	              isSpeaking: speaking,
	              dt,
	            });
	            updateSaraV3PresenceRuntime({
	              state: saraV3PresenceStateRef.current,
	              isSpeaking: speaking,
	              isListening: isListeningRef.current,
	              isThinking: isThinkingRef.current,
	            });
	            updateSaraV3EyeRuntime({
	              state: saraV3EyeStateRef.current,
	              bindings: saraV3ControllerRef.current.bindings,
	              activePresenceState: saraV3PresenceStateRef.current.currentMode,
	              nowMs: now,
	            });
	            updateSaraV3SmileRuntime({
	              state: saraV3SmileStateRef.current,
	              activePresenceState: saraV3PresenceStateRef.current.currentMode,
	              eyeState: saraV3EyeStateRef.current,
	              nowMs: now,
	            });
	            updateSaraV3ExpressionRuntime({
	              state: saraV3ExpressionStateRef.current,
	              bindings: saraV3ControllerRef.current.bindings,
	              activePresenceState: saraV3PresenceStateRef.current.currentMode,
	              scheduledSmileTargets: saraV3SmileStateRef.current.smileAdditiveTargets,
	              coordinatedBlinkSupport: saraV3EyeStateRef.current.coordinatedMorphs,
	              dt,
	            });
	          }
	          const saraV2MouthMorphBindings = isSaraV2Viewport
	            ? mouthBindingsRef.current.map(({ mesh, index, name }) => ({
                morphName: name,
                meshName: mesh.name || "(unnamed mesh)",
                index,
                currentInfluence: mesh.morphTargetInfluences?.[index] ?? null,
                sourceClassification: classifySaraV2MouthSource(name),
              }))
            : [];
          const saraV2MouthMorphFrame: Array<{
            morphName: string;
            meshName: string;
            index: number;
            sourceClassification: string;
            beforeInfluence: number;
            rawTarget: number;
            shapedValue: number;
            gain: number;
            max: number;
            preCapValue: number;
            postCapValue: number;
            cap: number;
            capApplied: boolean;
            primaryOpenDriver: string;
            phonemeDriverActive: boolean;
            activeSaraViseme: string | null;
            finalAppliedInfluence: number;
          }> = [];
          const saraV2AppliedVisemeValues: Record<string, number> = {};
          const saraV2MouthOpenDriverKinds = isSaraV2Viewport
            ? mouthBindingsRef.current.map(({ name }) => saraV2OpenDriverKind(name))
            : [];
          const saraV2HasMouthActivity =
            isSaraV2Viewport &&
            speaking &&
            (saraUseAudioDrivenMouth ||
              saraV2PhonemeDriverActive ||
              Math.max(mouthAdj, jawOpenAdj, lipFollowAdj) > 0.001);
          const saraV2PrimaryOpenDriver = !saraV2HasMouthActivity
            ? "none"
            : saraUseAudioDrivenMouth
              ? "audioDrivenPrimary"
            : saraV2PhonemeDriverActive
              ? "saraPhoneme"
            : saraV2MouthOpenDriverKinds.includes("viseme")
              ? "viseme_*"
              : saraV2MouthOpenDriverKinds.includes("jawOpen")
                ? "jawOpen"
                : saraV2MouthOpenDriverKinds.includes("genericOpen")
                  ? "genericOpen"
                  : "none";
          if (saraV2PhonemeDriverActive) {
            const presentMorphs = new Set(
              saraV2MouthMorphBindings.map((entry) => normalizeSaraV2MorphName(entry.morphName))
            );
            const expectedMorphs = new Set<string>([
              ...((SARA_V2_AVATAR_DEFINITION.visemes.names ?? []) as readonly string[]),
              saraV2ActiveViseme ?? "viseme_rest",
            ]);
            expectedMorphs.forEach((morphName) => {
              const normalized = normalizeSaraV2MorphName(morphName);
              if (
                !presentMorphs.has(normalized) &&
                !loggedMissingSaraV2PhonemeMorphsRef.current.has(normalized)
              ) {
                loggedMissingSaraV2PhonemeMorphsRef.current.add(normalized);
                console.warn("[Sara V2 phoneme lip-sync] missing viseme morph", {
                  morphName,
                  activePhoneme: saraV2ActivePhoneme?.phoneme ?? null,
                  activeSaraViseme: saraV2ActiveViseme,
                });
              }
            });
          }

          // Apply mouth morphs — conservative ranges to avoid extreme deformation.
          // Also avoid any targets that look like full head/neck controls.
	          if (
	            !useRfv2Morphs &&
	            !saraRfv2PreviewActive &&
	            !isSaraV3Avatar &&
	            mouthBindingsRef.current.length > 0
	          ) {
            mouthBindingsRef.current.forEach(({ mesh, index, name }) => {
              const influences = mesh.morphTargetInfluences;
              if (!influences || index >= influences.length) return;

              const lower = name.toLowerCase();

              if (lower.includes("head") || lower.includes("neck")) {
                return;
              }

              if (isCheekMorphName(name)) {
                return;
              }

              const isUpperLipMorph =
                (lower.includes("upper") &&
                  (lower.includes("lip") || lower.includes("lips"))) ||
                lower.includes("upperlip") ||
                lower.includes("lip_upper") ||
                lower.includes("uplip");
              const isLowerLipMorph =
                (lower.includes("lower") &&
                  (lower.includes("lip") || lower.includes("lips"))) ||
                lower.includes("lowerlip") ||
                lower.includes("lip_lower") ||
                lower.includes("lowlip");
              const normalizedMorphName = normalizeSaraV2MorphName(name);
              const isAllowedSaraPhonemeMorph = isSaraV2AllowedPhonemeMorph(name);
              const isSaraV2GenericReleaseTarget = isSaraV2GenericMouthReleaseTarget(name);

              let strength = mouthAdj;
              if ((saraV2HasValidPhonemeTimeline || saraUseAudioDrivenMouth) && isSaraHybrid) {
                const activeVisemeNormalized = normalizeSaraV2MorphName(
                  saraV2ActiveViseme ?? "viseme_rest"
                );
                const visemeMaxStrength = saraV2VisemeCaps?.visemeMaxStrength ?? 0.1;
                const jawOpenMax = saraV2VisemeCaps?.jawOpenMax ?? 0.04;
                const attackSpeed = saraUseAudioDrivenMouth
                  ? saraAudioFallbackConfig?.attackSpeed ?? 22
                  : saraV2VisemeCaps?.attackSpeed ?? 18;
                const releaseSpeed = saraUseAudioDrivenMouth
                  ? saraAudioFallbackConfig?.releaseSpeed ?? 18
                  : saraV2VisemeCaps?.releaseSpeed ?? 22;
                const jawReleaseSpeed = saraV2VisemeCaps?.jawReleaseSpeed ?? 26;
                const restReleaseSpeed = saraV2VisemeCaps?.restReleaseSpeed ?? 28;
                const restVisemeNormalized = normalizeSaraV2MorphName("viseme_rest");
                let targetStrength = 0;
                if (saraUseAudioDrivenMouth && isSaraV2JawOpenMorph(name)) {
                  targetStrength = saraAudioJawOpenTarget;
                } else if (saraUseAudioDrivenMouth && isSaraV2VisemeAAMorph(name)) {
                  targetStrength = saraAudioVisemeAATarget;
                } else if (saraUseAudioDrivenMouth && isAllowedSaraPhonemeMorph) {
                  targetStrength = 0;
                } else if (isAllowedSaraPhonemeMorph && isSaraV2VisemeMorph(name)) {
                  const isActiveOpenViseme =
                    saraV2PhonemeDriverActive &&
                    normalizedMorphName === activeVisemeNormalized &&
                    activeVisemeNormalized !== restVisemeNormalized &&
                    !saraV2RestFrameDetected;
                  targetStrength = isActiveOpenViseme
                    ? visemeMaxStrength * saraV2CurrentVisemeMultiplier
                    : 0;
                } else if (isAllowedSaraPhonemeMorph && isSaraV2JawOpenMorph(name)) {
                  targetStrength = !saraV2PhonemeDriverActive || saraV2RestFrameDetected
                    ? 0
                    : Math.min(jawOpenMax, saraV2CurrentJawSupport);
                } else if (isSaraV2GenericReleaseTarget) {
                  targetStrength = 0;
                  saraV2GenericFallbackSuppressed = true;
                }
                const previousStrength =
                  isAllowedSaraPhonemeMorph
                    ? saraV2PhonemeMorphValuesRef.current.get(normalizedMorphName) ?? 0
                    : influences[index] ?? 0;
                const isReleasing = targetStrength <= previousStrength;
                const isPreviousActiveViseme =
                  !!saraV2PreviousViseme &&
                  normalizedMorphName === normalizeSaraV2MorphName(saraV2PreviousViseme);
                const releaseLambda =
                  isSaraV2GenericReleaseTarget || saraV2PostSpeechReleaseActive
                    ? 32
                    : isSaraV2JawOpenMorph(name)
                      ? jawReleaseSpeed
                      : saraV2RestFrameDetected || (saraV2VisemeChanged && isPreviousActiveViseme)
                        ? restReleaseSpeed
                        : releaseSpeed;
                const nextStrength = THREE.MathUtils.damp(
                  previousStrength,
                  targetStrength,
                  isReleasing ? releaseLambda : attackSpeed,
                  dt
                );
                if (isAllowedSaraPhonemeMorph) {
                  saraV2PhonemeMorphValuesRef.current.set(normalizedMorphName, nextStrength);
                }
                strength = nextStrength;
                if (isAllowedSaraPhonemeMorph && isReleasing && previousStrength > nextStrength) {
                  if (isSaraV2JawOpenMorph(name)) {
                    saraV2JawReleaseApplied = true;
                  } else {
                    saraV2ReleaseApplied = true;
                  }
                }
                if (isSaraV2GenericReleaseTarget && isReleasing && previousStrength > nextStrength) {
                  saraV2GenericMouthMorphsReleased[name] = nextStrength;
                }
                if (normalizedMorphName === activeVisemeNormalized && isSaraV2VisemeMorph(name)) {
                  saraV2AppliedVisemeStrength = nextStrength;
                }
                if (saraUseAudioDrivenMouth && isSaraV2VisemeAAMorph(name)) {
                  saraV2AppliedVisemeStrength = nextStrength;
                }
                if (isSaraV2JawOpenMorph(name)) {
                  saraV2AppliedJawSupport = nextStrength;
                }
                if (isAllowedSaraPhonemeMorph) {
                  saraV2AppliedVisemeValues[name] = nextStrength;
                }
              } else if (
                lower.includes("jaw") ||
                lower.includes("open") ||
                lower.includes("mouth") ||
                lower.includes("teeth") ||
                lower.includes("tooth")
              ) {
                if (isUpperLipMorph) {
                  strength = jawOpenAdj * (1 - lipFollowAdj * 0.42);
                } else if (isLowerLipMorph) {
                  strength = lipFollowAdj;
                } else if (
                  lower.includes("teeth") ||
                  lower.includes("tooth") ||
                  lower.includes("jaw") ||
                  lower.includes("open")
                ) {
                  strength = jawOpenAdj;
                } else {
                  strength = jawOpenAdj * 0.9;
                }
              } else if (lower.includes("aa") || lower.includes("ah") || lower.includes("oh")) {
                strength = jawOpenAdj * 0.88;
              } else if (lower.includes("ee") || lower.includes("ih")) {
                strength = jawOpenAdj * 0.65;
              } else if (lower.includes("uh")) {
                strength = jawOpenAdj * 0.75;
              } else {
                strength = mouthAdj * 0.78;
              }

              const saraV2DriverKind = saraV2OpenDriverKind(name);
              if (isSaraV2Viewport && (saraV2HasValidPhonemeTimeline || saraUseAudioDrivenMouth)) {
                if (isSaraV2GenericReleaseTarget) {
                  saraV2GenericFallbackSuppressed = true;
                }
              } else if (isSaraV2Viewport && saraV2HasMouthActivity) {
                if (
                  saraV2PrimaryOpenDriver === "viseme_*" &&
                  (saraV2DriverKind === "jawOpen" || saraV2DriverKind === "genericOpen")
                ) {
                  strength = 0;
                } else if (
                  saraV2PrimaryOpenDriver === "jawOpen" &&
                  saraV2DriverKind === "genericOpen"
                ) {
                  strength *= 0.15;
                } else if (
                  saraV2PrimaryOpenDriver === "genericOpen" &&
                  saraV2DriverKind === "jawOpen"
                ) {
                  strength = 0;
                }
              }

              const shaped = (saraV2HasValidPhonemeTimeline || saraUseAudioDrivenMouth) && isSaraHybrid
                ? THREE.MathUtils.clamp(strength, 0, 1.5)
                : Math.pow(THREE.MathUtils.clamp(strength, 0, 1.5), 0.72);

              const isJawLike =
                lower.includes("jaw") ||
                lower.includes("jawopen") ||
                lower.includes("mouthopen") ||
                lower.includes("open");

              const isGenericMouth = lower.trim() === "mouth";
              const isTeethLike = lower.includes("teeth") || lower.includes("tooth");
              const isRiskyLipShape =
                lower.includes("lip") ||
                lower.includes("smile") ||
                lower.includes("frown") ||
                lower.includes("pucker") ||
                lower.includes("stretch") ||
                lower.includes("press") ||
                lower.includes("roll");

              const isOpenTarget = isJawLike || isTeethLike;
              const saraV2Cap =
                isSaraV2Viewport && saraUseAudioDrivenMouth && isSaraV2JawOpenMorph(name)
                  ? saraAudioFallbackConfig?.jawOpenMax ?? 0.28
                  : isSaraV2Viewport && saraUseAudioDrivenMouth && isSaraV2VisemeAAMorph(name)
                    ? saraAudioFallbackConfig?.visemeAAMax ?? 0.25
                    : isSaraV2Viewport
                      ? saraV2MouthCapFor(name, speaking)
                      : null;
              const gain = isSaraV2Viewport
                ? 1
                : isOpenTarget
                ? isTeethLike
                  ? JAW_GAIN * 1.12
                  : JAW_GAIN
                : isGenericMouth
                  ? MOUTH_GAIN
                  : isRiskyLipShape
                    ? OTHER_MOUTH_GAIN * 0.35
                    : OTHER_MOUTH_GAIN;
              const max = saraV2Cap ?? (isOpenTarget
                ? isTeethLike
                  ? JAW_MAX * 1.42
                  : JAW_MAX
                : isGenericMouth
                  ? MOUTH_MAX
                  : isRiskyLipShape
                    ? OTHER_MOUTH_MAX * 0.45
                    : OTHER_MOUTH_MAX);

              const preCapInfluence = shaped * gain;
              const finalAppliedInfluence = THREE.MathUtils.clamp(preCapInfluence, 0, max);
              if (isSaraV2Viewport) {
                if (isSaraV2AllowedPhonemeMorph(name)) {
                  saraV2CurrentAllowlistedInfluences[name] = finalAppliedInfluence;
                }
                if (
                  !isAllowedSaraPhonemeMorph &&
                  isSaraV2GenericReleaseTarget &&
                  (!saraV2HighestNonAllowlistedMouthMorph ||
                    finalAppliedInfluence > saraV2HighestNonAllowlistedMouthMorph.influence)
                ) {
                  saraV2HighestNonAllowlistedMouthMorph = {
                    morphName: name,
                    meshName: mesh.name || "(unnamed mesh)",
                    influence: finalAppliedInfluence,
                  };
                }
                if (
                  saraV2OpenDriverKind(name) !== "other" ||
                  isSaraV2AllowedPhonemeMorph(name)
                ) {
                  saraV2MaxOpenInfluence = Math.max(
                    saraV2MaxOpenInfluence,
                    finalAppliedInfluence
                  );
                }
                if (!speaking && (saraV2OpenDriverKind(name) !== "other" || isSaraV2GenericReleaseTarget)) {
                  saraV2PostSpeechMouthOpenMax = Math.max(
                    saraV2PostSpeechMouthOpenMax,
                    finalAppliedInfluence
                  );
                }
              }
              if (isSaraV2Viewport) {
                saraV2MouthMorphFrame.push({
                  morphName: name,
                  meshName: mesh.name || "(unnamed mesh)",
                  index,
                  sourceClassification: classifySaraV2MouthSource(name),
                  beforeInfluence: influences[index] ?? 0,
                  rawTarget: strength,
                  shapedValue: shaped,
                  gain,
                  max,
                  preCapValue: preCapInfluence,
                  postCapValue: finalAppliedInfluence,
                  cap: max,
                  capApplied: preCapInfluence !== finalAppliedInfluence,
                  primaryOpenDriver: saraV2PrimaryOpenDriver,
                  phonemeDriverActive: saraV2PhonemeDriverActive,
                  activeSaraViseme: saraV2ActiveViseme,
                  finalAppliedInfluence,
                });
              }
              influences[index] = finalAppliedInfluence;
            });
          }

          if (
            isSaraV2Viewport &&
            saraV2PostSpeechElapsedMs !== null &&
            saraV2PostSpeechElapsedMs >= 500 &&
            saraV2PostSpeechMouthOpenMax <= 0.01
          ) {
            saraV2ClipHasValidPhonemeTimelineRef.current = false;
          }

          const ampNorm = THREE.MathUtils.clamp(audioLevelNow / 420, 0, 1);
          const cheekDriver = THREE.MathUtils.lerp(
            0.1,
            0.55,
            THREE.MathUtils.clamp(
              Math.pow(THREE.MathUtils.clamp(jawOpenAdj, 0, 1), 1.05) * 0.55 +
              ampNorm * 0.45,
              0,
              1
            )
          );

          if (!useRfv2Morphs && !saraRfv2PreviewActive && cheekBindingsRef.current.length > 0) {
            cheekBindingsRef.current.forEach(
              ({ mesh, index, name, initialInfluence }) => {
                const influences = mesh.morphTargetInfluences;
                if (!influences || index >= influences.length) return;
                const lower = name.toLowerCase();
                let k = 0.85;
                if (lower.includes("puff") || lower.includes("cheek")) k = 1;
                if (lower.includes("nasolabial")) k = 0.72;
                if (lower.includes("smile")) k = 0.78;
                const cheekInfluence = THREE.MathUtils.clamp(
                  initialInfluence + cheekDriver * k * 0.95,
                  0,
                  0.42
                );
                influences[index] =
                  isSaraV2Viewport && speaking && isSaraV2SmileFrownMorph(name)
                    ? THREE.MathUtils.clamp(cheekInfluence, 0, 0.04)
                    : cheekInfluence;
              }
            );
          }

if (!useRfv2Morphs && !saraRfv2PreviewActive) {
          // Cheeks: strong enough pitch to read on camera; small lateral Y/Z for puff (kept < ~0.12 rad).
          cheekBonesRef.current.forEach((bone) => {
            if (!isPrimaryCheekBoneName(bone.name)) return;
            const d = faceBoneDefaultsRef.current.get(bone.uuid);
            if (!d) return;
            const c = cheekDriver;
            const bn = (bone.name || "").toLowerCase();
            const pitch = c * 0.26;
            const side =
              /facial_l_|_l_|^l_|left/.test(bn) && !/facial_r_|_r_|right/.test(bn)
                ? 1
                : /facial_r_|_r_|^r_|right/.test(bn)
                  ? -1
                  : 0;
            const yawIn = side !== 0 ? side * c * 0.1 : c * 0.04;
            const roll = side !== 0 ? side * c * 0.07 : 0;
            bone.rotation.x = d.x + pitch;
            bone.rotation.y = d.y + yawIn;
            bone.rotation.z = d.z + roll;
          });
        }

          // Bone-driven mouth (T1.glb: no morphs — bones only)
          const mouthForJaw = Math.pow(
            THREE.MathUtils.clamp(jawOpenAdj, 0, 1),
            1.04
          );
          const mouthForLips = Math.pow(
            THREE.MathUtils.clamp(lipFollowAdj, 0, 1),
            0.93
          );

          const saraV2BoneMovementFrame: Array<{
            boneName: string;
            group: string;
            delta: number;
            beforeRotationX: number;
            afterRotationX: number;
          }> = [];

          const applyFaceBoneX = (bone: THREE.Bone, delta: number, group = "mouth") => {
            const d = faceBoneDefaultsRef.current.get(bone.uuid);
            if (!d) return;
            const beforeRotationX = bone.rotation.x;
            bone.rotation.x = d.x + delta;
            if (isSaraV2Viewport) {
              saraV2BoneMovementFrame.push({
                boneName: bone.name || "(unnamed bone)",
                group,
                delta,
                beforeRotationX,
                afterRotationX: bone.rotation.x,
              });
            }
          };
          const resetFaceBoneX = (bone: THREE.Bone) => {
            const d = faceBoneDefaultsRef.current.get(bone.uuid);
            if (!d) return;
            bone.rotation.x = d.x;
          };

          const saraV2MouthBoneDriverDisabled = isSaraV2Viewport && speaking;

          if (saraV2MouthBoneDriverDisabled) {
            jawBonesRef.current.forEach(resetFaceBoneX);
            lipBonesUpperRef.current.forEach(resetFaceBoneX);
            lipBonesLowerRef.current.forEach(resetFaceBoneX);
            chinBonesRef.current.forEach(resetFaceBoneX);
            jawlineBonesRef.current.forEach(resetFaceBoneX);
            mouthInteriorBonesRef.current.forEach(resetFaceBoneX);
            underChinBonesRef.current.forEach(resetFaceBoneX);
          }

if (!useRfv2Morphs && !saraRfv2PreviewActive && !saraV2MouthBoneDriverDisabled) {
	          jawBonesRef.current.forEach((bone) => {
	            if (!isMainMandibleBoneName(bone.name)) return;
	            applyFaceBoneX(bone, mouthForJaw * 0.26, "jaw");
	          });

          lipBonesUpperRef.current.forEach((bone) => {
	            const center = isCenterLipBoneName(bone.name);
	            const mult = center ? 0.115 : 0.038;
	            applyFaceBoneX(bone, -mouthForLips * mult, "upperLip");
	          });

          lipBonesLowerRef.current.forEach((bone) => {
	            const center = isCenterLipBoneName(bone.name);
	            const mult = center ? 0.145 : 0.046;
	            applyFaceBoneX(bone, mouthForLips * mult, "lowerLip");
	          });

          chinBonesRef.current.forEach((bone) => {
            if (!isPrimaryChinBoneName(bone.name)) return;
	            const n = (bone.name || "").toLowerCase();
	            const main = n === "facial_c_chin" || n === "facial_c_chin1";
	            applyFaceBoneX(bone, mouthForJaw * (main ? 0.06 : 0.032), "chin");
	          });

	          jawlineBonesRef.current.forEach((bone) => {
	            applyFaceBoneX(bone, mouthForJaw * 0.028, "jawline");
	          });

	          mouthInteriorBonesRef.current.forEach((bone) => {
	            applyFaceBoneX(bone, mouthForJaw * 0.022, "mouthInterior");
	          });

	          underChinBonesRef.current.forEach((bone) => {
	            applyFaceBoneX(bone, mouthForJaw * 0.022, "underChin");
	          });
	        }

          if (
            isSaraHybrid &&
            (speaking || saraV2HasValidPhonemeTimeline || saraV2PostSpeechReleaseActive) &&
            typeof window !== "undefined" &&
            now - lastSaraV2MouthDiagnosticsLogRef.current >= 400
          ) {
            lastSaraV2MouthDiagnosticsLogRef.current = now;
            const topMorphInfluences = [...saraV2MouthMorphFrame].sort(
              (a, b) => b.finalAppliedInfluence - a.finalAppliedInfluence
            );
            const cappedMorphs = saraV2MouthMorphFrame
              .filter((entry) => entry.capApplied)
              .map((entry) => ({
                morphName: entry.morphName,
                meshName: entry.meshName,
                sourceClassification: entry.sourceClassification,
                primaryOpenDriver: entry.primaryOpenDriver,
                preCapValue: entry.preCapValue,
                postCapValue: entry.postCapValue,
                cap: entry.cap,
              }));
            const maxFinalInfluence = topMorphInfluences.reduce(
              (max, entry) => Math.max(max, entry.finalAppliedInfluence),
              0
            );
            const dangerousMorphs = topMorphInfluences
              .filter((entry) => entry.finalAppliedInfluence > 1)
              .map((entry) => ({
                ...entry,
                over1: entry.finalAppliedInfluence > 1,
                over5: entry.finalAppliedInfluence > 5,
                over20: entry.finalAppliedInfluence > 20,
              }));
            const stuckGenericMorphs = topMorphInfluences
              .filter(
                (entry) =>
                  isSaraV2GenericMouthReleaseTarget(entry.morphName) &&
                  entry.finalAppliedInfluence > 0.01
              )
              .map((entry) => ({
                morphName: entry.morphName,
                meshName: entry.meshName,
                sourceClassification: entry.sourceClassification,
                influence: entry.finalAppliedInfluence,
                expectedInfluence: 0,
              }));
            const activeMorphNames = new Set(
              topMorphInfluences
                .filter((entry) => entry.finalAppliedInfluence > 0.001)
                .map((entry) => entry.morphName.toLowerCase())
            );
            const hasVisemeAA = [...activeMorphNames].some((name) =>
              name.includes("viseme_aa")
            );
            const hasJawOpen = [...activeMorphNames].some((name) =>
              name.includes("jawopen") || name === "jaw_open"
            );
            const hasMouthOpen = [...activeMorphNames].some(
              (name) => name === "mouth" || name.includes("mouthopen")
            );
            const hasTeethMorph = [...activeMorphNames].some(
              (name) => name.includes("teeth") || name.includes("tooth")
            );
            const hasBoneMovement = saraV2BoneMovementFrame.some(
              (entry) => Math.abs(entry.delta) > 0.0001
            );
            const stackingSignals = [
              hasVisemeAA,
              hasJawOpen,
              hasMouthOpen,
              hasTeethMorph,
              hasBoneMovement,
            ].filter(Boolean).length;
            const maxRotationDelta = saraV2BoneMovementFrame.reduce(
              (max, entry) => Math.max(max, Math.abs(entry.delta)),
              0
            );
            const boneDiagnostics = {
              jawBonesFound: jawBonesRef.current.length,
              lipBonesFound:
                lipBonesUpperRef.current.length + lipBonesLowerRef.current.length,
              chinBonesFound: chinBonesRef.current.length,
              jawlineBonesFound: jawlineBonesRef.current.length,
              mouthInteriorBonesFound: mouthInteriorBonesRef.current.length,
              underChinBonesFound: underChinBonesRef.current.length,
              boneNames: {
                jaw: jawBonesRef.current.map((bone) => bone.name),
                upperLip: lipBonesUpperRef.current.map((bone) => bone.name),
                lowerLip: lipBonesLowerRef.current.map((bone) => bone.name),
                chin: chinBonesRef.current.map((bone) => bone.name),
                jawline: jawlineBonesRef.current.map((bone) => bone.name),
                mouthInterior: mouthInteriorBonesRef.current.map((bone) => bone.name),
                underChin: underChinBonesRef.current.map((bone) => bone.name),
              },
              rotationDeltasApplied: saraV2BoneMovementFrame,
              maxRotationDelta,
            };
            const timelinePhonemes = saraV2Timeline?.phonemes ?? [];
            const firstPhoneme = timelinePhonemes[0] ?? null;
            const lastPhoneme = timelinePhonemes[timelinePhonemes.length - 1] ?? null;
            const playbackDiagnostics =
              typeof window !== "undefined"
                ? (window as any).saraV2MouthDiagnostics ?? {}
                : {};
            const diagnostics = {
              ...playbackDiagnostics,
              runtimeMode: avatarModeLabel(avatarMode),
              useRfv2Morphs,
              isSaraV2Viewport,
              phonemeDriverActive: saraV2PhonemeDriverActive,
              audioDrivenMouthFallbackActive: saraUseAudioDrivenMouth,
              saraMouthDriverMode: saraUseAudioDrivenMouth
                ? "audioDrivenPrimary"
                : saraV2PhonemeDriverActive
                  ? "phonemeTimeline"
                  : saraV2FallbackMouthDriverActive
                    ? "legacyFallback"
                    : "idle",
              saraAudioMouthOpen,
              audioNorm,
              mouthAdj,
              audioNormGain: saraAudioNormGain,
              mouthAdjGain: saraMouthAdjGain,
              jawOpenTarget: saraAudioJawOpenTarget,
              visemeAATarget: saraAudioVisemeAATarget,
              phonemeDriverBypassedForAudioFallback:
                saraV2PhonemeDriverBypassedForAudioFallback,
              saraV2HasValidPhonemeTimeline,
              activePhoneme: saraV2ActivePhoneme?.phoneme ?? null,
              previousSaraViseme: saraV2PreviousViseme,
              activeSaraViseme: saraV2ActiveViseme,
              visemeChanged: saraV2VisemeChanged,
              releaseApplied: saraV2ReleaseApplied,
              jawReleaseApplied: saraV2JawReleaseApplied,
              currentVisemeMultiplier: saraV2CurrentVisemeMultiplier,
              appliedVisemeStrength: saraV2AppliedVisemeStrength,
              appliedJawSupport: saraV2AppliedJawSupport,
              currentAllowlistedInfluences: saraV2CurrentAllowlistedInfluences,
              maxOpenInfluence: saraV2MaxOpenInfluence,
              restFrameDetected: saraV2RestFrameDetected,
              genericFallbackSuppressed: saraV2GenericFallbackSuppressed,
              genericMouthMorphsReleased: saraV2GenericMouthMorphsReleased,
              stuckGenericMorphs,
              highestNonAllowlistedMouthMorph: saraV2HighestNonAllowlistedMouthMorph,
              postSpeechMouthOpenMax: saraV2PostSpeechMouthOpenMax,
              postSpeechElapsedMs: saraV2PostSpeechElapsedMs,
              timelineLength: saraV2TimelineLength,
              speechTime: saraV2SpeechTime,
              audioCurrentTime: saraV2AudioCurrentTime,
              lookAheadSeconds: saraV2LookAheadSeconds,
              saraAudioSyncOffsetSeconds,
              firstPhonemeStart: firstPhoneme?.start ?? null,
              lastPhonemeEnd:
                lastPhoneme?.end ??
                lastPhoneme?.start ??
                null,
              recentActivePhonemes: saraV2RecentActivePhonemesRef.current,
              validTimeline: saraV2ValidTimeline,
              fallbackMouthDriverActive: saraV2FallbackMouthDriverActive,
              appliedVisemeValues: saraV2AppliedVisemeValues,
              saraCapsApplied: true,
              boneDriverDisabledForSara: saraV2MouthBoneDriverDisabled,
              primaryOpenDriver: saraV2PrimaryOpenDriver,
              speaking,
              jawOpenAdj,
              lipFollowAdj,
              morphBindings: saraV2MouthMorphBindings,
              appliedMorphs: topMorphInfluences,
              topMorphInfluences: topMorphInfluences.slice(0, 10),
              cappedMorphs,
              dangerousMorphs,
              maxFinalInfluence,
              stacking: {
                hasVisemeAA,
                hasJawOpen,
                hasMouthOpen,
                hasTeethMorph,
                hasBoneMovement,
              },
              stackingDetected: stackingSignals >= 2,
              bones: boneDiagnostics,
              recommendationHint:
                "Sara is using legacy mouth driver; values above 1 indicate overdrive.",
            };
            (window as any).saraV2MouthDiagnostics = diagnostics;
            if (maxFinalInfluence > 1) {
              console.warn("[Sara V2 Mouth Safety] influence still above 1", {
                maxFinalInfluence,
                dangerousMorphs,
              });
            }
            console.group("[Sara V2 Mouth Diagnostics]");
            console.log("top 10 highest morph influences", diagnostics.topMorphInfluences);
            console.log("primaryOpenDriver", saraV2PrimaryOpenDriver);
            console.log("phonemeDriver", {
              active: saraV2PhonemeDriverActive,
              saraV2HasValidPhonemeTimeline,
              activePhoneme: diagnostics.activePhoneme,
              previousSaraViseme: saraV2PreviousViseme,
              activeSaraViseme: saraV2ActiveViseme,
              visemeChanged: saraV2VisemeChanged,
              releaseApplied: saraV2ReleaseApplied,
              jawReleaseApplied: saraV2JawReleaseApplied,
              currentVisemeMultiplier: saraV2CurrentVisemeMultiplier,
              appliedVisemeStrength: saraV2AppliedVisemeStrength,
              appliedJawSupport: saraV2AppliedJawSupport,
              currentAllowlistedInfluences: saraV2CurrentAllowlistedInfluences,
              maxOpenInfluence: saraV2MaxOpenInfluence,
              restFrameDetected: saraV2RestFrameDetected,
              genericFallbackSuppressed: saraV2GenericFallbackSuppressed,
              genericMouthMorphsReleased: saraV2GenericMouthMorphsReleased,
              stuckGenericMorphs,
              highestNonAllowlistedMouthMorph: saraV2HighestNonAllowlistedMouthMorph,
              postSpeechMouthOpenMax: saraV2PostSpeechMouthOpenMax,
              postSpeechElapsedMs: saraV2PostSpeechElapsedMs,
              timelineLength: saraV2TimelineLength,
              speechTime: saraV2SpeechTime,
              audioCurrentTime: saraV2AudioCurrentTime,
              validTimeline: saraV2ValidTimeline,
              fallbackMouthDriverActive: saraV2FallbackMouthDriverActive,
              appliedVisemeValues: saraV2AppliedVisemeValues,
            });
            console.log("cappedMorphs", cappedMorphs);
            console.log("dangerousMorphs", dangerousMorphs);
            console.log("active bone movement", boneDiagnostics);
            console.log("stackingDetected", diagnostics.stackingDetected, diagnostics.stacking);
            console.log("recommendation hint", diagnostics.recommendationHint);
            console.groupEnd();
          }
	          if (isSaraHybrid) {
	            const saraPresenceMode: SaraV2PresenceMode =
	              saraV2PostSpeechReleaseActive && isListeningRef.current
	                ? "interrupted"
	                : speaking
	                  ? "speaking"
	                  : isThinkingRef.current
	                    ? "thinking"
	                    : isListeningRef.current
	                      ? "listening"
	                      : "idle";
	            const presenceResult = updateSaraV2Presence({
	              state: saraV2PresenceStateRef.current,
	              nowMs: now,
	              deltaSeconds: dt,
	              mode: saraPresenceMode,
	              sentiment: {
	                label: avatarPhonemeTimelineRef.current?.sentiment,
	                compound: sentimentCompoundRef.current,
	              },
	              audioNorm,
	              isSpeaking: speaking,
	              isListening: isListeningRef.current,
	              isThinking: isThinkingRef.current,
	            });
	            saraV2PresenceStateRef.current = presenceResult.state;

	            const blinkTestState = saraV2BlinkTestRef.current;
	            const blinkTestActive =
	              import.meta.env.DEV === true &&
	              (blinkTestState.left !== null || blinkTestState.right !== null);
	            const presenceMorphTargets = blinkTestActive
	              ? Array.from(saraV2PresenceBindingsRef.current.keys()).reduce(
	                  (targets, name) => {
	                    if (name === "eyeBlinkLeft") {
	                      targets[name] = blinkTestState.left ?? 0;
	                    } else if (name === "eyeBlinkRight") {
	                      targets[name] = blinkTestState.right ?? 0;
	                    } else {
	                      targets[name] = 0;
	                    }
	                    return targets;
	                  },
	                  {} as Record<string, number>
	                )
	              : presenceResult.morphTargets;
	            const appliedPresenceTargets: Record<string, number> = {};
	            const actualInfluenceReadback: Record<
	              string,
	              Array<{
	                meshName: string;
	                geometryName: string | null;
	                visible: boolean;
	                index: number;
	                target: number;
	                beforeApply: number;
	                afterApply: number;
	              }>
	            > = {};
	            let overwrittenAfterApply = false;

	            Object.entries(presenceMorphTargets).forEach(([name, target]) => {
	              if (name.startsWith("viseme_") || name === "jawOpen") return;
	              if (
	                blinkTestActive &&
	                !SARA_V2_BLINK_TEST_MORPHS.has(name) &&
	                !SARA_V2_EYE_LOOK_MORPHS.has(name)
	              ) {
	                return;
	              }
	              const bindings = saraV2PresenceBindingsRef.current.get(name) ?? [];
	              if (bindings.length === 0) return;
	              const clampedTarget = THREE.MathUtils.clamp(target, 0, 1);
	              bindings.forEach(({ mesh, index }) => {
	                const influences = mesh.morphTargetInfluences;
	                if (!influences || index >= influences.length) return;
	                const beforeApply = influences[index] ?? 0;
	                influences[index] = clampedTarget;
	                const afterApply = influences[index] ?? 0;
	                if (Math.abs(afterApply - clampedTarget) > 0.0005) {
	                  overwrittenAfterApply = true;
	                }
	                const geometryName = mesh.geometry?.name || null;
	                const readbackEntry = {
	                  meshName: mesh.name || "(unnamed mesh)",
	                  geometryName,
	                  visible: mesh.visible,
	                  index,
	                  target: clampedTarget,
	                  beforeApply,
	                  afterApply,
	                };
	                const current = actualInfluenceReadback[name] ?? [];
	                current.push(readbackEntry);
	                actualInfluenceReadback[name] = current;
	              });
	              appliedPresenceTargets[name] = clampedTarget;
	            });

	            const visibleFaceMeshNames = new Set<string>();
	            saraV2PresenceBindingsRef.current.forEach((bindings) => {
	              bindings.forEach(({ mesh }) => {
	                if (mesh.visible) visibleFaceMeshNames.add(mesh.name || "(unnamed mesh)");
	              });
	            });
	            const requiredFaceMeshes = Array.from(SARA_V2_PRESENCE_FACE_MESH_NAMES);
	            const missingRequiredFaceMeshes = requiredFaceMeshes.filter(
	              (meshName) => !visibleFaceMeshNames.has(meshName)
	            );
	            const blinkReadback = {
	              eyeBlinkLeft: actualInfluenceReadback.eyeBlinkLeft ?? [],
	              eyeBlinkRight: actualInfluenceReadback.eyeBlinkRight ?? [],
	            };
	            const blinkAppliedStrength = Math.max(
	              appliedPresenceTargets.eyeBlinkLeft ?? 0,
	              appliedPresenceTargets.eyeBlinkRight ?? 0
	            );
	            const blinkRawStrength = blinkTestActive
	              ? Math.max(blinkTestState.left ?? 0, blinkTestState.right ?? 0)
	              : presenceResult.diagnostics.blinkRawStrength;
	            const hybridPresenceDiagnostics = {
	              ...presenceResult.diagnostics,
	              enabled: true,
	              presenceCalledThisFrame: true,
	              mode: saraPresenceMode,
	              reason: saraHybridPresenceReason,
	              isSaraHybrid,
	              isRfv2Preview: saraRfv2PreviewActive,
	              isSaraAvatar,
	              avatarMode,
	              rawTargets: presenceResult.diagnostics.rawTargets,
	              appliedTargets: appliedPresenceTargets,
	              readback: actualInfluenceReadback,
	              actualInfluenceReadback,
	              overwrittenAfterApply,
	              blinkMaxUsed: blinkTestActive
	                ? blinkRawStrength
	                : presenceResult.diagnostics.blinkMaxUsed,
	              blinkPhase: blinkTestActive
	                ? "forced-test"
	                : presenceResult.diagnostics.blinkPhase,
	              blinkRawStrength,
	              blinkAppliedStrength,
	              blinkStrength: blinkAppliedStrength,
	              blinkReadback,
	              blinkActive:
	                blinkTestActive || presenceResult.diagnostics.blinkActive,
	              eyeLookSuppressedForBlink:
	                blinkTestActive ||
	                presenceResult.diagnostics.eyeLookSuppressedForBlink,
	              blinkTargets: {
	                eyeBlinkLeft: appliedPresenceTargets.eyeBlinkLeft ?? 0,
	                eyeBlinkRight: appliedPresenceTargets.eyeBlinkRight ?? 0,
	              },
	              eyeLookTargetsBeforeSuppression:
	                presenceResult.diagnostics.eyeLookTargetsBeforeSuppression,
	              eyeLookTargetsAfterSuppression:
	                presenceResult.diagnostics.eyeLookTargetsAfterSuppression,
	              blinkTest: {
	                active: blinkTestActive,
	                left: blinkTestState.left,
	                right: blinkTestState.right,
	                lastCommand: blinkTestState.lastCommand,
	                updatedAtMs: blinkTestState.updatedAtMs,
	                supportedValues: SARA_V2_BLINK_TEST_VALUES,
	              },
	              activePresenceMorphs: Object.entries(appliedPresenceTargets)
	                .filter(([, value]) => value > 0.001)
	                .map(([name]) => name),
	              availablePresenceMorphs: Array.from(
	                saraV2PresenceBindingsRef.current.keys()
	              ),
	              visiblePresenceFaceMeshes: Array.from(visibleFaceMeshNames),
	              requiredPresenceFaceMeshes: requiredFaceMeshes,
	              missingRequiredPresenceFaceMeshes: missingRequiredFaceMeshes,
	            };

	            if (typeof window !== "undefined") {
	              (window as any).saraHybridPresenceDiagnostics =
	                hybridPresenceDiagnostics;
	              (window as any).saraV2PresenceDiagnostics =
	                hybridPresenceDiagnostics;
	            }
	          } else if (typeof window !== "undefined") {
	            const disabledDiagnostics = {
	              enabled: false,
	              mode: "disabled",
	              reason: saraHybridPresenceReason,
	              isSaraHybrid,
	              isRfv2Preview: saraRfv2PreviewActive,
	              isSaraAvatar,
	              avatarMode,
	              appliedTargets: {},
	              readback: {},
	              overwrittenAfterApply: false,
	              blinkActive: false,
	              blinkStrength: 0,
	            };
	            (window as any).saraHybridPresenceDiagnostics = disabledDiagnostics;
	            (window as any).saraV2PresenceDiagnostics = disabledDiagnostics;
	          }

		          if (avatarRoot) {
	        avatarRoot.scale.setScalar(baseScaleRef.current);
	      }

          renderer.render(scene, camera);
        };

        renderLoop();

        function clearBlinkState() {
          blinkBindingsRef.current.forEach(
            ({ mesh, index, initialInfluence }) => {
              const influences = mesh.morphTargetInfluences;
              if (!influences || index >= influences.length) return;
              influences[index] = initialInfluence;
            }
          );

          eyelidBonesRef.current.forEach((bone) => {
            const defaultX = eyelidDefaultRotXRef.current.get(bone.uuid) ?? 0;
            const defaultY = eyelidDefaultRotYRef.current.get(bone.uuid) ?? 0;
            bone.rotation.x = defaultX;
            bone.rotation.y = defaultY;
            const defaultZ = eyelidDefaultRotZRef.current.get(bone.uuid);
            if (typeof defaultZ === "number") bone.rotation.z = defaultZ;
            const defaultPosY = eyelidDefaultPosYRef.current.get(bone.uuid);
            if (typeof defaultPosY === "number") bone.position.y = defaultPosY;
            const defaultPosZ = eyelidDefaultPosZRef.current.get(bone.uuid);
            if (typeof defaultPosZ === "number") bone.position.z = defaultPosZ;
          });
        }

        function animateBlink(
          duration = 320,
          onDone?: () => void,
          blinkType: JordanBlinkAnimationType = "full"
        ) {
          if (jordanBlinkActiveRef.current) {
            logJordanBlinkDiagnostic({
              blinkType,
              skippedActiveBlink: true,
              speechEndTriggered: false,
            });
            onDone?.();
            return;
          }

          const start = performance.now();
          jordanBlinkActiveRef.current = true;
          lastJordanBlinkAtRef.current = start;
          const blinkPresenceState = jordanPresenceStateRef.current;
          const rfv2HasSplitBlink =
            useRfv2Morphs &&
            blinkBindingsRef.current.some((binding) => binding.name === "eyeBlinkLeft") &&
            blinkBindingsRef.current.some((binding) => binding.name === "eyeBlinkRight");
          const rfv2HasFallbackBlink =
            useRfv2Morphs &&
            blinkBindingsRef.current.some((binding) => binding.name === "eye_blink");
          const rfv2BlinkMode: JordanBlinkMode =
            rfv2HasSplitBlink ? "split" : "fallback";
          const maxRange =
            blinkType === "partial"
              ? JORDAN_RFV2_BLINK_TUNING.partialBlinkMax
              : blinkType === "slow"
                ? JORDAN_RFV2_BLINK_TUNING.slowBlinkMax
                : JORDAN_RFV2_BLINK_TUNING.fullBlinkMax;
          const rfv2BaseMax = useRfv2Morphs
            ? randomBetween(maxRange[0], maxRange[1])
            : 0.88;
          const rfv2Asymmetry = useRfv2Morphs
            ? randomBetween(
                JORDAN_RFV2_BLINK_TUNING.asymmetryAmount[0],
                JORDAN_RFV2_BLINK_TUNING.asymmetryAmount[1]
              )
            : Math.random() * 0.08;
          const rfv2AsymmetryDirection = Math.random() < 0.5 ? -1 : 1;
          const rfv2LeftMax = useRfv2Morphs
            ? THREE.MathUtils.clamp(
                rfv2BaseMax * (1 + rfv2AsymmetryDirection * rfv2Asymmetry * 0.5),
                maxRange[0],
                maxRange[1]
              )
            : 0.88;
          const rfv2RightMax = useRfv2Morphs
            ? THREE.MathUtils.clamp(
                rfv2BaseMax * (1 - rfv2AsymmetryDirection * rfv2Asymmetry * 0.5),
                maxRange[0],
                maxRange[1]
              )
            : 0.88;
          jordanEyeAsymmetryRef.current = {
            ...jordanEyeAsymmetryRef.current,
            blinkLeft: rfv2LeftMax,
            blinkRight: rfv2RightMax,
          };
          const rfv2RightLagMs =
            useRfv2Morphs && rfv2HasSplitBlink
              ? randomBetween(
                  JORDAN_RFV2_BLINK_TUNING.asymmetryLagMs[0],
                  JORDAN_RFV2_BLINK_TUNING.asymmetryLagMs[1]
                ) * (Math.random() < 0.5 ? -1 : 1)
              : 0;
          const rfv2RecoveryMs = useRfv2Morphs
            ? randomBetween(
                JORDAN_RFV2_BLINK_TUNING.recoveryMs[0],
                JORDAN_RFV2_BLINK_TUNING.recoveryMs[1]
              )
            : 0;

          logJordanBlinkDiagnostic({
            blinkType,
            blinkDurationMs: duration,
            blinkMaxValue: rfv2BaseMax,
            leftMax: rfv2LeftMax,
            rightMax: rfv2RightMax,
            rightLagMs: rfv2RightLagMs,
            skippedActiveBlink: false,
            speechEndTriggered: speechEndBlinkPendingRef.current,
          });
          speechEndBlinkPendingRef.current = false;
          const closeEnd = useRfv2Morphs ? randomBetween(0.35, 0.45) : 0.5;
          const holdEnd = useRfv2Morphs ? closeEnd + randomBetween(0.05, 0.1) : 0.5;

          const tick = (now: number) => {
            const elapsed = now - start;
            const totalDuration = duration + rfv2RecoveryMs;
            const t = Math.min(elapsed / totalDuration, 1);
            const smoothstep = (x: number) => x * x * (3 - 2 * x);
            const blinkAt = (elapsedMs: number) => {
              if (useRfv2Morphs && elapsedMs > duration) {
                const recoveryT = THREE.MathUtils.clamp(
                  (elapsedMs - duration) / Math.max(rfv2RecoveryMs, 1),
                  0,
                  1
                );
                return 0.035 * (1 - smoothstep(recoveryT));
              }
              const localT = THREE.MathUtils.clamp(elapsedMs / duration, 0, 1);
              if (useRfv2Morphs) {
                if (localT < closeEnd) {
                  return smoothstep(THREE.MathUtils.clamp(localT / closeEnd, 0, 1));
                }
                if (localT < holdEnd) return 1;
                const openT = THREE.MathUtils.clamp((localT - holdEnd) / (1 - holdEnd), 0, 1);
                return 0.035 + (1 - 0.035) * (1 - smoothstep(openT));
              }

              const tri = localT < 0.5 ? localT * 2 : (1 - localT) * 2;
              return smoothstep(tri);
            };
            const blinkValue = blinkAt(elapsed);
            const rfv2LeftBlinkValue = blinkAt(elapsed);
            const rfv2RightBlinkValue = blinkAt(elapsed - rfv2RightLagMs);
           

            // Use BOTH when possible:
            // - If eyelid bones are weighted, they give smooth motion.
            // - If bones are present but not weighted (common), morph blink still works.
            const useBoneBlink = !useRfv2Morphs && eyelidBonesRef.current.length > 0;
            const useMorphBlink = blinkBindingsRef.current.length > 0;

            blinkBindingsRef.current.forEach(
              ({ mesh, index, name, initialInfluence }) => {
                const influences = mesh.morphTargetInfluences;
                if (!influences || index >= influences.length) return;
                const lower = name.toLowerCase();
                 if (useRfv2Morphs) {
            if (rfv2HasSplitBlink && lower === "eye_blink") {
              influences[index] = initialInfluence;
              return;
            }
            if (!rfv2HasSplitBlink && rfv2HasFallbackBlink && lower !== "eye_blink") {
              influences[index] = initialInfluence;
              return;
            }
            const rfv2BlinkValue =
              lower === "eyeblinkright" ? rfv2RightBlinkValue : rfv2LeftBlinkValue;
            const rfv2MaxBlink =
              lower === "eyeblinkright"
                ? rfv2RightMax
                : rfv2BlinkMode === "fallback"
                  ? Math.max(rfv2LeftMax, rfv2RightMax)
                  : rfv2LeftMax;
            influences[index] = initialInfluence + rfv2BlinkValue * rfv2MaxBlink;
            return;
          }
                const isRiskyEyes =
                  lower.includes("eyes") &&
                  !lower.includes("blink") &&
                  !lower.includes("lid") &&
                  !lower.includes("wink") &&
                  !lower.includes("squint");
                const maxBlink =
                  lower === "eyes"
                    ? 0.38
                    : isRiskyEyes
                      ? 0.22
                      : 0.88;
                influences[index] = useMorphBlink
                  ? initialInfluence + blinkValue * maxBlink
                  : initialInfluence;
              }
            );

            eyelidBonesRef.current.forEach((bone) => {
              const defaultX = eyelidDefaultRotXRef.current.get(bone.uuid) ?? 0;
              const defaultY = eyelidDefaultRotYRef.current.get(bone.uuid) ?? 0;
              const defaultZ = eyelidDefaultRotZRef.current.get(bone.uuid) ?? 0;
              const defaultPosY = eyelidDefaultPosYRef.current.get(bone.uuid) ?? bone.position.y;
              const defaultPosZ = eyelidDefaultPosZRef.current.get(bone.uuid) ?? bone.position.z;
              if (!useBoneBlink) {
                bone.rotation.x = defaultX;
                bone.rotation.y = defaultY;
                bone.rotation.z = defaultZ;
                bone.position.y = defaultPosY;
                bone.position.z = defaultPosZ;
                return;
              }

              // Upper eyelid closes by rotating down; lower eyelid closes by rotating up (opposite X).
              const boneScale = useMorphBlink ? 0.55 : 1;
              const magnitude = 0.48 * boneScale * blinkValue;
              const upper = isUpperEyelidBoneName(bone.name);
              const lower = isLowerEyelidBoneName(bone.name);
              let deltaX = 0;
              // Local X sign is rig-dependent; flipped so blink closes instead of opening wider.
              if (upper && !lower) {
                deltaX = +magnitude; // upper lid moves down toward closed
              } else if (lower && !upper) {
                deltaX = -magnitude; // lower lid moves up toward closed
              } else {
                deltaX = +magnitude; // generic "lid" / ambiguous → treat as upper
              }
              bone.rotation.x = defaultX + deltaX;
              bone.rotation.y = defaultY;
              bone.rotation.z = defaultZ;
              bone.position.y = defaultPosY;
              bone.position.z = defaultPosZ;

              bone.updateMatrixWorld(true);
            });

            if (t < 1) {
              blinkRafRef.current = requestAnimationFrame(tick);
            } else {
              jordanBlinkActiveRef.current = false;
              clearBlinkState();
              onDone?.();
            }
          };

          blinkRafRef.current = requestAnimationFrame(tick);
        }

	        blinkFnRef.current = isSaraV2Viewport
	          ? ((_duration?: number, onDone?: () => void) => {
	              onDone?.();
	            })
	          : animateBlink;

        const getJordanBlinkModeForLog = (): JordanBlinkMode => {
          const hasSplit =
            blinkBindingsRef.current.some((binding) => binding.name === "eyeBlinkLeft") &&
            blinkBindingsRef.current.some((binding) => binding.name === "eyeBlinkRight");
          return hasSplit ? "split" : "fallback";
        };

        const getJordanBlinkDelayRange = (presenceState: JordanPresenceState) => {
          if (presenceState === "listening") return JORDAN_RFV2_BLINK_TUNING.listeningDelayMs;
          if (presenceState === "thinking") return JORDAN_RFV2_BLINK_TUNING.thinkingDelayMs;
          if (presenceState === "speaking") return JORDAN_RFV2_BLINK_TUNING.speakingDelayMs;
          return JORDAN_RFV2_BLINK_TUNING.idleDelayMs;
        };

        const getJordanBlinkDurationRange = (blinkType: JordanBlinkAnimationType) => {
          if (blinkType === "partial") return JORDAN_RFV2_BLINK_TUNING.partialBlinkDurationMs;
          if (blinkType === "slow") return JORDAN_RFV2_BLINK_TUNING.slowBlinkDurationMs;
          return JORDAN_RFV2_BLINK_TUNING.fullBlinkDurationMs;
        };

        const chooseJordanRfv2BlinkType = (
          presenceState: JordanPresenceState,
          forceSpeechEndBlink: boolean
        ): JordanBlinkType => {
          if (forceSpeechEndBlink) return Math.random() < 0.55 ? "slow" : "full";
          const statePartialBoost =
            presenceState === "thinking" ? 0.08 : presenceState === "listening" ? 0.03 : 0;
          const stateSlowBoost =
            presenceState === "thinking" ? 0.1 : presenceState === "idle" ? 0.03 : 0;
          const partialChance = JORDAN_RFV2_BLINK_TUNING.partialProbability + statePartialBoost;
          const slowChance = JORDAN_RFV2_BLINK_TUNING.slowBlinkProbability + stateSlowBoost;
          const doubleChance =
            presenceState === "thinking" || presenceState === "speaking"
              ? JORDAN_RFV2_BLINK_TUNING.doubleBlinkProbability * 0.55
              : JORDAN_RFV2_BLINK_TUNING.doubleBlinkProbability;
          if (Math.random() < doubleChance) return "double";
          if (Math.random() < slowChance) return "slow";
          return Math.random() < partialChance ? "partial" : "full";
        };

        function logJordanBlinkDiagnostic({
          presenceState = jordanPresenceStateRef.current,
          nextBlinkDelayMs,
          blinkType,
          blinkDurationMs,
          blinkMaxValue,
          leftMax,
          rightMax,
          rightLagMs,
          speechEndTriggered,
          skippedActiveBlink,
        }: {
          presenceState?: JordanPresenceState;
          nextBlinkDelayMs?: number;
          blinkType?: JordanBlinkType;
          blinkDurationMs?: number;
          blinkMaxValue?: number;
          leftMax?: number;
          rightMax?: number;
          rightLagMs?: number;
          speechEndTriggered: boolean;
          skippedActiveBlink: boolean;
        }) {
          if (
            process.env.NODE_ENV !== "development" ||
            !useRfv2Morphs ||
            performance.now() - lastJordanBlinkLogRef.current <= 1400
          ) {
            return;
          }
          lastJordanBlinkLogRef.current = performance.now();
          console.log("[Jordan RFv2 Blink] diagnostics:", {
            presenceState,
            blinkMode: getJordanBlinkModeForLog(),
            nextBlinkDelayMs: nextBlinkDelayMs ? Math.round(nextBlinkDelayMs) : undefined,
            blinkType,
            blinkDurationMs: blinkDurationMs ? Math.round(blinkDurationMs) : undefined,
            blinkMaxValue,
            leftAsymmetryValue: leftMax,
            rightAsymmetryValue: rightMax,
            rightLagMs,
            speechEndTriggered,
            skippedActiveBlink,
          });
        }

        function scheduleSpeechEndBlink() {
          if (!useRfv2Morphs || speechEndBlinkPendingRef.current) return;
          const nowMs = performance.now();
          if (nowMs - lastJordanBlinkAtRef.current < JORDAN_RFV2_BLINK_TUNING.minTimeBetweenBlinksMs) {
            return;
          }
          if (speechEndBlinkTimeoutRef.current) clearTimeout(speechEndBlinkTimeoutRef.current);
          speechEndBlinkPendingRef.current = true;
          const delay = randomBetween(
            JORDAN_RFV2_BLINK_TUNING.speechEndBlinkDelayMs[0],
            JORDAN_RFV2_BLINK_TUNING.speechEndBlinkDelayMs[1]
          );
          logJordanBlinkDiagnostic({
            nextBlinkDelayMs: delay,
            blinkType: "full",
            speechEndTriggered: true,
            skippedActiveBlink: false,
          });
          speechEndBlinkTimeoutRef.current = window.setTimeout(() => {
            speechEndBlinkTimeoutRef.current = null;
            if (
              !modelRef.current ||
              isSpeakingRef.current ||
              jordanBlinkActiveRef.current ||
              performance.now() - lastJordanBlinkAtRef.current <
                JORDAN_RFV2_BLINK_TUNING.minTimeBetweenBlinksMs
            ) {
              speechEndBlinkPendingRef.current = false;
              return;
            }
            const blinkType = chooseJordanRfv2BlinkType(jordanPresenceStateRef.current, true);
            const durationRange = getJordanBlinkDurationRange(
              blinkType === "double" ? "full" : blinkType
            );
            const duration = randomBetween(durationRange[0], durationRange[1]);
            animateBlink(duration, undefined, blinkType === "double" ? "full" : blinkType);
          }, delay);
        }

        function scheduleNextBlink() {
          if (!modelRef.current) return;

          const presenceState = jordanPresenceStateRef.current;
          previousJordanBlinkPresenceRef.current = presenceState;

          const delay = useRfv2Morphs
            ? randomBetween(
                getJordanBlinkDelayRange(presenceState)[0],
                getJordanBlinkDelayRange(presenceState)[1]
              )
            : 2200 + Math.random() * 3200;
          logJordanBlinkDiagnostic({
            presenceState,
            nextBlinkDelayMs: delay,
            speechEndTriggered: false,
            skippedActiveBlink: false,
          });
          blinkTimeoutRef.current = window.setTimeout(() => {
            const hasBlinkTargets =
              blinkBindingsRef.current.length > 0 || eyelidBonesRef.current.length > 0;

            if (!hasBlinkTargets) {
              scheduleNextBlink();
              return;
            }

            if (jordanBlinkActiveRef.current) {
              logJordanBlinkDiagnostic({
                presenceState: jordanPresenceStateRef.current,
                speechEndTriggered: false,
                skippedActiveBlink: true,
              });
              scheduleNextBlink();
              return;
            }

            const blinkState = jordanPresenceStateRef.current;
            const blinkType = useRfv2Morphs
              ? chooseJordanRfv2BlinkType(blinkState, false)
              : "full";
            const animationBlinkType = blinkType === "double" ? "full" : blinkType;
            const durationRange = getJordanBlinkDurationRange(animationBlinkType);
            const blinkDuration = useRfv2Morphs
              ? randomBetween(durationRange[0], durationRange[1])
              : 300 + Math.random() * 200;
            const finishBlink = () => {
              if (blinkType !== "double") {
                scheduleNextBlink();
                return;
              }
              const doubleGap = randomBetween(
                JORDAN_RFV2_BLINK_TUNING.doubleBlinkGapMs[0],
                JORDAN_RFV2_BLINK_TUNING.doubleBlinkGapMs[1]
              );
              blinkTimeoutRef.current = window.setTimeout(() => {
                if (jordanBlinkActiveRef.current || isSpeakingRef.current) {
                  scheduleNextBlink();
                  return;
                }
                animateBlink(blinkDuration * 0.82, scheduleNextBlink, "partial");
              }, doubleGap);
            };
            animateBlink(blinkDuration, finishBlink, animationBlinkType);
          }, delay);
        }

	        function startBlinkLoop() {
	          if (blinkTimeoutRef.current) {
	            clearTimeout(blinkTimeoutRef.current);
	          }
	          if (isSaraV2Viewport) {
	            return;
	          }
	          if (useRfv2Morphs) {
	            scheduleNextBlink();
	            return;
          }
          // Trigger one legacy blink immediately so we can verify eyelid bones affect the mesh.
          animateBlink(340, scheduleNextBlink);
        }

        return () => {
          cancelled = true;
          window.removeEventListener("resize", handleResize);

          if (frameRef.current) cancelAnimationFrame(frameRef.current);
          if (blinkRafRef.current) cancelAnimationFrame(blinkRafRef.current);
          if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
          if (speechEndBlinkTimeoutRef.current) clearTimeout(speechEndBlinkTimeoutRef.current);
          jordanBlinkActiveRef.current = false;
          speechEndBlinkPendingRef.current = false;

          clearBlinkState();

          if (sessionRoomGroup && sceneRef.current) {
            try {
              sceneRef.current.remove(sessionRoomGroup);
            } catch {
              /* noop */
            }
          }
          sessionRoomGroup = null;

          if (SHOW_ROOM && sceneRef.current) {
            try {
              sceneRef.current.remove(roomGroup);
            } catch {
              /* noop */
            }
          }

          if (saraV3EnvironmentHandle) {
            try {
              saraV3EnvironmentHandle.dispose();
            } catch {
              /* noop */
            }
            saraV3EnvironmentHandle = null;
          }

          if (avatarRootRef.current && sceneRef.current) {
            sceneRef.current.remove(avatarRootRef.current);
          } else if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
          }

          if (modelRef.current) {
            modelRef.current.traverse((child: any) => {
              if (child.isMesh) {
                child.geometry?.dispose();

                if (Array.isArray(child.material)) {
                  child.material.forEach((m: any) => {
                    const std = m as THREE.MeshStandardMaterial;
                    if (
                      std?.isMeshStandardMaterial &&
                      std.roughnessMap === roomGrainTexture
                    ) {
                      std.roughnessMap = null;
                    }
                    m?.dispose?.();
                  });
                } else {
                  const mat = child.material;
                  const std = mat as THREE.MeshStandardMaterial;
                  if (
                    std?.isMeshStandardMaterial &&
                    std.roughnessMap === roomGrainTexture
                  ) {
                    std.roughnessMap = null;
                  }
                  mat?.dispose?.();
                }
              }
            });
          }

          roomGrainTexture?.dispose();
          roomGrainTexture = null;

          if (rendererRef.current) {
            rendererRef.current.dispose();
            if (
              containerRef.current &&
              containerRef.current.contains(rendererRef.current.domElement)
            ) {
              containerRef.current.removeChild(rendererRef.current.domElement);
            }
          }

          blinkFnRef.current = null;
        };
      }, [
        modelUrl,
        viewTuning,
        fixedViewportConfig,
        useRfv2Morphs,
        saraRfv2PreviewActive,
        isSaraV2Viewport,
        isSaraHybrid,
        isSaraAvatar,
        avatarMode,
        saraHybridPresenceReason,
        onSaraRfv2Fallback,
      ]);

    useEffect(() => {
      if (!isSpeaking) {
        mouthTargetRef.current = 0;
        mouthBaseRef.current = 0;
        mouthPulseRef.current = 0;
        lastBoundaryAtRef.current = 0;
        lastSpeechPulseSeenRef.current = speechPulseRef.current;
        return;
      }

      let rafId: number | null = null;
      const start = performance.now();
      lastSpeechPulseSeenRef.current = speechPulseRef.current;

      const tick = () => {
        if (!isSpeakingRef.current) return;

        const pulse = speechPulseRef.current;
        if (pulse !== lastSpeechPulseSeenRef.current) {
          lastSpeechPulseSeenRef.current = pulse;
          const text = speechTextRef.current;
          const charIndex = speechCharIndexRef.current;
          const openness = getSpeechOpennessAt(text, charIndex);
          mouthBaseRef.current = Math.max(
            mouthBaseRef.current,
            openness * 0.095 + 0.028,
          );
          mouthPulseRef.current = Math.max(
            mouthPulseRef.current,
            openness * 0.72 + 0.1,
          );
          lastBoundaryAtRef.current = performance.now();
        }

        const elapsed = (performance.now() - start) / 1000;
        const sinceBoundary = performance.now() - lastBoundaryAtRef.current;
        if (sinceBoundary >= 260) {
          const audioLevelNow = mouthAudioLevelRef.current;
          const fallback =
            Math.max(0, Math.sin(elapsed * 7.2)) * 0.065 +
            Math.max(0, Math.sin(elapsed * 11.9 + 0.5)) * 0.038 +
            THREE.MathUtils.clamp(audioLevelNow / 300, 0, 0.038);
          mouthBaseRef.current = Math.max(mouthBaseRef.current, fallback);
        }

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    }, [isSpeaking, speechCharIndexRef, speechPulseRef, speechTextRef, mouthAudioLevelRef]);
    return (
      <div className="relative w-full h-full">
        {avatarLoadState === "loading" && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-slate-900/95 to-purple-950/90 px-6 text-center"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-10 w-10 shrink-0 animate-spin text-purple-300" />
            <p className="text-sm font-medium text-white">Loading avatar…</p>
            {avatarLoadProgress !== null && avatarLoadProgress < 1 && (
              <p className="text-xs text-white/70">
                {Math.round(avatarLoadProgress * 100)}%
              </p>
            )}
            <p className="max-w-sm text-xs text-white/50">
              The model file is large; first visit may take a while on slower
              networks.
            </p>
          </div>
        )}
        {avatarLoadState === "error" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/90 px-6 text-center">
            <p className="text-sm text-white">Could not load avatar.</p>
            <p className="text-xs text-white/60">
              Refresh the page or try again on a stronger connection.
            </p>
          </div>
        )}
        {/* position: relative so the absolute canvas stays clipped to this box */}
        <div
          ref={containerRef}
          className={`relative h-full w-full ${avatarLoadState !== "ready" ? "opacity-0" : "opacity-100"
            }`}
        />
      </div>
    );
  }

export const ThreeAvatar = memo(ThreeAvatarComponent);
