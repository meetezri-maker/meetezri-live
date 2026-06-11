import type * as ThreeNamespace from "three";
import {
  SARA_RFV2_EXPRESSION_CAPS,
  SARA_RFV2_FACE_TUNING,
} from "./saraRfv2Config";
import { SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";
import { SARA_RFV2_BINDING_PROFILE } from "./saraRfv2BindingProfile";
import {
  SARA_RFV2_FORBIDDEN_MORPHS,
  getSaraRfv2MappedTarget,
  validateSaraRfv2TargetMap,
} from "./saraRfv2TargetMap";
import { classifySaraRfv2Target } from "./saraRfv2SmoothingLayer";

/**
 * Sara RFv2 Morph Applier.
 *
 * Foundation/runtime-safe module only. This module is not wired into
 * ActiveSession, production ThreeAvatar, or live Sara. It can bind an already
 * rendered/aligned Sara GLB root and write RFv2-owned values to audited Face
 * mesh morphTargetInfluences only. Do not activate in production until a later
 * explicit phase.
 */

type Object3D = ThreeNamespace.Object3D;
type Mesh = ThreeNamespace.Mesh;

export type SaraRfv2MorphApplierState = {
  readonly enabled: boolean;
  readonly bound: boolean;
  readonly faceMeshCount: number;
  readonly boundMeshUuids: readonly string[];
  readonly ownedMorphs: readonly string[];
  readonly lastAppliedAtMs: number;
  readonly lastAppliedMorphs: Readonly<Record<string, number>>;
  readonly missingMorphs: readonly string[];
  readonly blockedMorphs: readonly string[];
  readonly releasedMorphs: readonly string[];
};

export type SaraRfv2MorphCapableMeshAudit = {
  readonly uuid: string;
  readonly name: string;
  readonly type: string;
  readonly visible: boolean;
  readonly parentPath: string;
  readonly worldPosition: readonly number[];
  readonly worldScale: readonly number[];
  readonly isSkinnedMesh: boolean;
  readonly morphTargetDictionaryKeys: readonly string[];
  readonly morphTargetInfluencesLength: number;
  readonly sceneMembership: boolean;
  readonly underCurrentRenderedRoot: boolean;
  readonly containsVisemeAA: boolean;
  readonly containsEyeBlinkLeft: boolean;
  readonly containsMouthSmileLeft: boolean;
};

export type SaraRfv2RejectedMorphMesh = {
  readonly uuid: string;
  readonly name: string;
  readonly reason: string;
};

export type SaraRfv2PostWriteInfluence = {
  readonly meshUuid: string;
  readonly meshName: string;
  readonly morphName: string;
  readonly index: number;
  readonly valueWritten: number;
  readonly actualInfluence: number;
};

export type SaraRfv2FaceRootChildAudit = {
  readonly name: string;
  readonly type: string;
  readonly visible: boolean;
  readonly isMesh: boolean;
  readonly isSkinnedMesh: boolean;
  readonly morphTargetDictionaryExists: boolean;
  readonly morphTargetInfluencesExists: boolean;
  readonly morphCount: number;
  readonly parentPath: string;
};

export type SaraRfv2FaceRootMorphAudit = {
  readonly meshName: string;
  readonly path: string;
  readonly first20MorphNames: readonly string[];
};

export type SaraRfv2FaceMorphBinding = {
  readonly meshName: string;
  readonly meshUuid: string;
  readonly mesh: Mesh;
  readonly morphTargetDictionary: Record<string, number>;
  readonly morphTargetInfluences: number[];
  readonly ownedMorphIndices: Readonly<Record<string, number>>;
};

export type SaraRfv2MorphApplierDiagnostics = {
  readonly boundMeshNames: readonly string[];
  readonly boundMeshUuids: readonly string[];
  readonly appliedMorphs: Readonly<Record<string, number>>;
  readonly missingMorphs: readonly string[];
  readonly blockedMorphs: readonly string[];
  readonly releasedMorphs: readonly string[];
  readonly highestAppliedValue: number;
  readonly faceOnly: boolean;
  readonly usedForbiddenMorph: boolean;
  readonly allMorphCapableMeshes: readonly SaraRfv2MorphCapableMeshAudit[];
  readonly rejectedMorphMeshes: readonly SaraRfv2RejectedMorphMesh[];
  readonly currentRenderedRootName: string | null;
  readonly currentRenderedRootUuid: string | null;
  readonly postWriteInfluences: readonly SaraRfv2PostWriteInfluence[];
  readonly writeSucceeded: boolean;
  readonly writtenButNoVisualChangeSuspected: boolean;
  readonly applierBound: boolean;
  readonly applierBindingReason: string;
  readonly bindingProfileUsed: boolean;
  readonly profileAssetPath: string;
  readonly faceRootCandidates: readonly string[];
  readonly faceRootFound: boolean;
  readonly faceMeshPath: string | null;
  readonly requiredMorphsPresent: boolean;
  readonly missingRequiredMorphs: readonly string[];
  readonly allowedMorphsFound: readonly string[];
  readonly forbiddenMeshesRejected: readonly string[];
  readonly forbiddenMorphsRejected: readonly string[];
  readonly faceRootChildren: readonly SaraRfv2FaceRootChildAudit[];
  readonly faceRootAudit: readonly SaraRfv2FaceRootMorphAudit[];
  readonly faceGroupDetected: boolean;
  readonly faceGroupPath: string | null;
  readonly boundFaceMeshNames: readonly string[];
  readonly boundFaceMeshPaths: readonly string[];
  readonly boundFaceMeshCount: number;
};

export type BindSaraRfv2FaceMorphTargetsResult = {
  readonly state: SaraRfv2MorphApplierState;
  readonly bindings: readonly SaraRfv2FaceMorphBinding[];
  readonly diagnostics: SaraRfv2MorphApplierDiagnostics;
};

const EMPTY_DIAGNOSTICS: SaraRfv2MorphApplierDiagnostics = {
  boundMeshNames: [],
  boundMeshUuids: [],
  appliedMorphs: {},
  missingMorphs: [],
  blockedMorphs: [],
  releasedMorphs: [],
  highestAppliedValue: 0,
  faceOnly: true,
  usedForbiddenMorph: false,
  allMorphCapableMeshes: [],
  rejectedMorphMeshes: [],
  currentRenderedRootName: null,
  currentRenderedRootUuid: null,
  postWriteInfluences: [],
  writeSucceeded: false,
  writtenButNoVisualChangeSuspected: false,
  applierBound: false,
  applierBindingReason: "Sara RFv2 Morph Applier has not bound a rendered Face mesh.",
  bindingProfileUsed: true,
  profileAssetPath: SARA_RFV2_BINDING_PROFILE.assetPath,
  faceRootCandidates: SARA_RFV2_BINDING_PROFILE.face.rootCandidates,
  faceRootFound: false,
  faceMeshPath: null,
  requiredMorphsPresent: false,
  missingRequiredMorphs: SARA_RFV2_BINDING_PROFILE.face.requiredMorphs,
  allowedMorphsFound: [],
  forbiddenMeshesRejected: [],
  forbiddenMorphsRejected: [],
  faceRootChildren: [],
  faceRootAudit: [],
  faceGroupDetected: false,
  faceGroupPath: null,
  boundFaceMeshNames: [],
  boundFaceMeshPaths: [],
  boundFaceMeshCount: 0,
};

export function createSaraRfv2MorphApplierState(): SaraRfv2MorphApplierState {
  return {
    enabled: false,
    bound: false,
    faceMeshCount: 0,
    boundMeshUuids: [],
    ownedMorphs: [],
    lastAppliedAtMs: 0,
    lastAppliedMorphs: {},
    missingMorphs: [],
    blockedMorphs: [],
    releasedMorphs: [],
  };
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isForbiddenMorph(meshName: string, morphName: string): boolean {
  return SARA_RFV2_FORBIDDEN_MORPHS.some(
    (forbidden) =>
      forbidden.meshName === meshName || forbidden.morphName === morphName,
  );
}

function normalizeProfileName(name: string): string {
  return name.trim().replace(/[._\s-]/g, "").toLowerCase();
}

function profileNameMatches(name: string, candidates: readonly string[]): boolean {
  const normalized = normalizeProfileName(name);
  return candidates.some((candidate) => normalizeProfileName(candidate) === normalized);
}

function getObjectPath(object: Object3D): string {
  const parts: string[] = [];
  let current: Object3D | null = object;
  while (current) {
    parts.unshift(current.name || current.type);
    current = current.parent;
  }
  return parts.join(" > ");
}

function isDescendantOf(object: Object3D, root: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

function isEffectivelyVisible(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function getMorphKeys(mesh: Mesh): string[] {
  const dictionary = mesh.morphTargetDictionary;
  if (!dictionary) return [];
  return Object.keys(dictionary).sort((a, b) => dictionary[a] - dictionary[b]);
}

function auditMorphCapableMesh(mesh: Mesh, root: Object3D): SaraRfv2MorphCapableMeshAudit {
  const dictionary = mesh.morphTargetDictionary as Record<string, number>;
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.elements;
  const scaleX = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const scaleY = Math.hypot(matrix[4], matrix[5], matrix[6]);
  const scaleZ = Math.hypot(matrix[8], matrix[9], matrix[10]);
  return {
    uuid: mesh.uuid,
    name: mesh.name || `(mesh ${mesh.id})`,
    type: mesh.type,
    visible: isEffectivelyVisible(mesh),
    parentPath: getObjectPath(mesh),
    worldPosition: [matrix[12], matrix[13], matrix[14]],
    worldScale: [scaleX, scaleY, scaleZ],
    isSkinnedMesh: (mesh as ThreeNamespace.SkinnedMesh).isSkinnedMesh === true,
    morphTargetDictionaryKeys: getMorphKeys(mesh),
    morphTargetInfluencesLength: mesh.morphTargetInfluences?.length ?? 0,
    sceneMembership: Boolean(mesh.parent),
    underCurrentRenderedRoot: isDescendantOf(mesh, root),
    containsVisemeAA: "viseme_AA" in dictionary,
    containsEyeBlinkLeft: "eyeBlinkLeft" in dictionary,
    containsMouthSmileLeft: "mouthSmileLeft" in dictionary,
  };
}

function isProfileFaceRoot(object: Object3D): boolean {
  return profileNameMatches(object.name || "", SARA_RFV2_BINDING_PROFILE.face.rootCandidates);
}

function isProfileFaceMesh(object: Object3D): object is Mesh {
  return (
    isMesh(object) &&
    normalizeProfileName(object.name || "") ===
      normalizeProfileName(SARA_RFV2_BINDING_PROFILE.face.meshName)
  );
}

function isProfileFaceTargetObject(object: Object3D): boolean {
  return (
    normalizeProfileName(object.name || "") ===
      normalizeProfileName(SARA_RFV2_BINDING_PROFILE.face.groupName) ||
    normalizeProfileName(object.name || "") ===
      normalizeProfileName(SARA_RFV2_BINDING_PROFILE.face.meshName)
  );
}

function isProfileFaceDescendantMesh(object: Object3D): object is Mesh {
  return (
    isMesh(object) &&
    (object as ThreeNamespace.SkinnedMesh).isSkinnedMesh === true &&
    (object.name || "").startsWith(SARA_RFV2_BINDING_PROFILE.face.descendantMeshNamePrefix)
  );
}

function isProfileForbiddenMesh(object: Object3D): boolean {
  return profileNameMatches(
    object.name || "",
    SARA_RFV2_BINDING_PROFILE.body.forbiddenMeshNames,
  );
}

function getRequiredMorphsMissing(dictionary: Record<string, number> | undefined): string[] {
  if (!dictionary) return [...SARA_RFV2_BINDING_PROFILE.face.requiredMorphs];
  return SARA_RFV2_BINDING_PROFILE.face.requiredMorphs.filter(
    (morphName) => !(morphName in dictionary),
  );
}

function getAllowedMorphsFound(dictionary: Record<string, number> | undefined): string[] {
  if (!dictionary) return [];
  return SARA_RFV2_BINDING_PROFILE.face.allowedMorphs
    .filter((morphName) => morphName in dictionary)
    .filter(
      (morphName) =>
        !SARA_RFV2_BINDING_PROFILE.body.forbiddenMorphs.some(
          (forbidden) => forbidden === morphName,
        ),
    );
}

function auditFaceRootChildren(faceRoot: Object3D | null): {
  faceRootChildren: SaraRfv2FaceRootChildAudit[];
  faceRootAudit: SaraRfv2FaceRootMorphAudit[];
} {
  if (!faceRoot) {
    return {
      faceRootChildren: [],
      faceRootAudit: [],
    };
  }

  const faceRootChildren: SaraRfv2FaceRootChildAudit[] = [];
  const faceRootAudit: SaraRfv2FaceRootMorphAudit[] = [];

  faceRoot.traverse((object) => {
    if (object === faceRoot) return;
    const mesh = object as Mesh;
    const isObjectMesh = Boolean(mesh.isMesh);
    const isSkinnedMesh = Boolean((object as ThreeNamespace.SkinnedMesh).isSkinnedMesh);
    const dictionary = mesh.morphTargetDictionary as Record<string, number> | undefined;
    const influences = mesh.morphTargetInfluences as number[] | undefined;
    const morphNames = dictionary ? getMorphKeys(mesh) : [];

    faceRootChildren.push({
      name: object.name || "(unnamed object)",
      type: object.type,
      visible: isEffectivelyVisible(object),
      isMesh: isObjectMesh,
      isSkinnedMesh,
      morphTargetDictionaryExists: Boolean(dictionary),
      morphTargetInfluencesExists: Boolean(influences),
      morphCount: morphNames.length,
      parentPath: getObjectPath(object),
    });

    if (dictionary && influences) {
      faceRootAudit.push({
        meshName: object.name || `(mesh ${object.id})`,
        path: getObjectPath(object),
        first20MorphNames: morphNames.slice(0, 20),
      });
    }
  });

  return {
    faceRootChildren,
    faceRootAudit,
  };
}

function collectForbiddenRejections(root: Object3D): {
  allMorphCapableMeshes: SaraRfv2MorphCapableMeshAudit[];
  rejectedMorphMeshes: SaraRfv2RejectedMorphMesh[];
  forbiddenMeshesRejected: string[];
  forbiddenMorphsRejected: string[];
} {
  const allMorphCapableMeshes: SaraRfv2MorphCapableMeshAudit[] = [];
  const rejectedMorphMeshes: SaraRfv2RejectedMorphMesh[] = [];
  const forbiddenMeshesRejected = new Set<string>();
  const forbiddenMorphsRejected = new Set<string>();

  root.traverse((object) => {
    if (!isMesh(object)) return;
    const dictionary = object.morphTargetDictionary as Record<string, number> | undefined;
    if (dictionary && object.morphTargetInfluences) {
      allMorphCapableMeshes.push(auditMorphCapableMesh(object, root));
    }

    const forbiddenMesh = isProfileForbiddenMesh(object);
    const forbiddenMorphs = SARA_RFV2_BINDING_PROFILE.body.forbiddenMorphs.filter(
      (morphName) => dictionary && morphName in dictionary,
    );
    const onlyGenericBodyMorphs =
      forbiddenMorphs.length > 0 &&
      Object.keys(dictionary ?? {}).every((morphName) =>
        (SARA_RFV2_BINDING_PROFILE.body.forbiddenMorphs as readonly string[]).includes(morphName),
      );

    if (!forbiddenMesh && forbiddenMorphs.length === 0) return;

    const meshName = object.name || `(mesh ${object.id})`;
    if (forbiddenMesh) forbiddenMeshesRejected.add(meshName);
    forbiddenMorphs.forEach((morphName) => {
      forbiddenMorphsRejected.add(`${meshName}:${morphName}`);
    });
    rejectedMorphMeshes.push({
      uuid: object.uuid,
      name: meshName,
      reason: forbiddenMesh
        ? "mesh is forbidden by Sara RFv2 binding profile"
        : onlyGenericBodyMorphs
          ? "mesh contains only forbidden generic body morphs"
          : "mesh contains forbidden generic body morphs",
    });
  });

  return {
    allMorphCapableMeshes,
    rejectedMorphMeshes,
    forbiddenMeshesRejected: Array.from(forbiddenMeshesRejected).sort(),
    forbiddenMorphsRejected: Array.from(forbiddenMorphsRejected).sort(),
  };
}

function createBinding(mesh: Mesh, ownedMorphs: readonly string[]): SaraRfv2FaceMorphBinding {
  const dictionary = mesh.morphTargetDictionary as Record<string, number>;
  const ownedMorphIndices: Record<string, number> = {};
  ownedMorphs.forEach((morphName) => {
    const index = dictionary[morphName];
    if (typeof index === "number") {
      ownedMorphIndices[morphName] = index;
    }
  });

  return {
    meshName: mesh.name || "Face",
    meshUuid: mesh.uuid,
    mesh,
    morphTargetDictionary: dictionary,
    morphTargetInfluences: mesh.morphTargetInfluences as number[],
    ownedMorphIndices,
  };
}

function createDiagnostics(args: {
  bindings: readonly SaraRfv2FaceMorphBinding[];
  appliedMorphs?: Readonly<Record<string, number>>;
  missingMorphs?: readonly string[];
  blockedMorphs?: readonly string[];
  releasedMorphs?: readonly string[];
  root?: Object3D;
  allMorphCapableMeshes?: readonly SaraRfv2MorphCapableMeshAudit[];
  rejectedMorphMeshes?: readonly SaraRfv2RejectedMorphMesh[];
  postWriteInfluences?: readonly SaraRfv2PostWriteInfluence[];
  bindingProfile?: {
    faceRootFound?: boolean;
    faceMeshPath?: string | null;
    missingRequiredMorphs?: readonly string[];
    allowedMorphsFound?: readonly string[];
    forbiddenMeshesRejected?: readonly string[];
    forbiddenMorphsRejected?: readonly string[];
    faceRootChildren?: readonly SaraRfv2FaceRootChildAudit[];
    faceRootAudit?: readonly SaraRfv2FaceRootMorphAudit[];
    faceGroupDetected?: boolean;
    faceGroupPath?: string | null;
    boundFaceMeshNames?: readonly string[];
    boundFaceMeshPaths?: readonly string[];
    applierBindingReason?: string;
  };
}): SaraRfv2MorphApplierDiagnostics {
  const appliedMorphs = args.appliedMorphs ?? {};
  const blockedMorphs = args.blockedMorphs ?? [];
  const postWriteInfluences = args.postWriteInfluences ?? [];
  const highestAppliedValue = Object.values(appliedMorphs).reduce(
    (highest, value) => Math.max(highest, value),
    0,
  );
  const writeSucceeded = postWriteInfluences.some(
    (influence) => Math.abs(influence.actualInfluence - influence.valueWritten) <= 0.0001,
  );
  const missingRequiredMorphs =
    args.bindingProfile?.missingRequiredMorphs ??
    (args.bindings.length > 0 ? [] : SARA_RFV2_BINDING_PROFILE.face.requiredMorphs);
  const applierBindingReason =
    args.bindingProfile?.applierBindingReason ??
    (args.bindings.length > 0
      ? `Bound profiled Sara RFv2 Face mesh: ${args.bindings[0]?.meshName ?? "Face"}.`
      : "Profiled Sara RFv2 Face mesh was not found.");
  return {
    boundMeshNames: args.bindings.map((binding) => binding.meshName),
    boundMeshUuids: args.bindings.map((binding) => binding.meshUuid),
    appliedMorphs,
    missingMorphs: args.missingMorphs ?? [],
    blockedMorphs,
    releasedMorphs: args.releasedMorphs ?? [],
    highestAppliedValue,
    faceOnly: args.bindings.every((binding) => binding.meshName !== "Character" && binding.meshName !== "Character.002"),
    usedForbiddenMorph: blockedMorphs.length > 0,
    allMorphCapableMeshes: args.allMorphCapableMeshes ?? [],
    rejectedMorphMeshes: args.rejectedMorphMeshes ?? [],
    currentRenderedRootName: args.root?.name ?? null,
    currentRenderedRootUuid: args.root?.uuid ?? null,
    postWriteInfluences,
    writeSucceeded,
    writtenButNoVisualChangeSuspected: postWriteInfluences.length > 0 && !writeSucceeded,
    applierBound: args.bindings.length > 0,
    applierBindingReason,
    bindingProfileUsed: true,
    profileAssetPath: SARA_RFV2_BINDING_PROFILE.assetPath,
    faceRootCandidates: SARA_RFV2_BINDING_PROFILE.face.rootCandidates,
    faceRootFound: args.bindingProfile?.faceRootFound ?? false,
    faceMeshPath: args.bindingProfile?.faceMeshPath ?? null,
    requiredMorphsPresent: missingRequiredMorphs.length === 0,
    missingRequiredMorphs,
    allowedMorphsFound: args.bindingProfile?.allowedMorphsFound ?? [],
    forbiddenMeshesRejected: args.bindingProfile?.forbiddenMeshesRejected ?? [],
    forbiddenMorphsRejected: args.bindingProfile?.forbiddenMorphsRejected ?? [],
    faceRootChildren: args.bindingProfile?.faceRootChildren ?? [],
    faceRootAudit: args.bindingProfile?.faceRootAudit ?? [],
    faceGroupDetected: args.bindingProfile?.faceGroupDetected ?? false,
    faceGroupPath: args.bindingProfile?.faceGroupPath ?? null,
    boundFaceMeshNames:
      args.bindingProfile?.boundFaceMeshNames ??
      args.bindings.map((binding) => binding.meshName),
    boundFaceMeshPaths: args.bindingProfile?.boundFaceMeshPaths ?? [],
    boundFaceMeshCount:
      args.bindingProfile?.boundFaceMeshNames?.length ?? args.bindings.length,
  };
}

function getTargetCap(morphName: string): number {
  const classification = classifySaraRfv2Target(morphName);
  if (classification === "viseme") return SARA_RFV2_FACE_TUNING.visemeMaxStrength;
  if (classification === "jaw") return SARA_RFV2_FACE_TUNING.jawOpenMax;
  if (classification === "blink") return SARA_RFV2_EXPRESSION_CAPS.blink;
  if (classification === "eyeLook") return SARA_RFV2_EXPRESSION_CAPS.eyeLook;
  if (classification === "cheek") return SARA_RFV2_EXPRESSION_CAPS.cheekSquint;
  if (morphName.includes("Smile") || morphName === "smile") {
    return SARA_RFV2_EXPRESSION_CAPS.mouthSmile;
  }
  if (morphName.includes("Frown")) return SARA_RFV2_EXPRESSION_CAPS.mouthFrown;
  if (morphName === "sad") return SARA_RFV2_EXPRESSION_CAPS.sad;
  return 1;
}

function resolveTargetMorphName(targetName: string): {
  morphName: string | null;
  blocked: boolean;
} {
  if (isForbiddenMorph("Character.002", targetName)) {
    return { morphName: null, blocked: true };
  }

  const mapped = getSaraRfv2MappedTarget(targetName);
  if (!mapped.missing) {
    if (mapped.meshName !== "Face" || isForbiddenMorph(mapped.meshName, mapped.morphName)) {
      return { morphName: null, blocked: true };
    }
    return { morphName: mapped.morphName, blocked: false };
  }

  const ownedMorphs = SARA_RFV2_BINDING_PROFILE.face.allowedMorphs;
  if ((ownedMorphs as readonly string[]).includes(targetName)) {
    return { morphName: targetName, blocked: false };
  }

  return { morphName: null, blocked: false };
}

export function bindSaraRfv2FaceMorphTargets(args: {
  root: Object3D;
}): BindSaraRfv2FaceMorphTargetsResult {
  const rejections = collectForbiddenRejections(args.root);
  let faceRoot: Object3D | null = null;
  let faceTarget: Object3D | null = null;

  args.root.traverse((object) => {
    if (!faceRoot && isProfileFaceRoot(object)) {
      faceRoot = object;
    }
  });

  if (faceRoot) {
    faceRoot.traverse((object) => {
      if (!faceTarget && isProfileFaceTargetObject(object)) {
        faceTarget = object;
      }
    });
  }

  const faceRootAudit = auditFaceRootChildren(faceRoot);
  const faceGroupDetected = Boolean(faceTarget && !isMesh(faceTarget));
  const faceGroupPath = faceGroupDetected && faceTarget ? getObjectPath(faceTarget) : null;
  const faceMeshPath = faceTarget ? getObjectPath(faceTarget) : null;
  let applierBindingReason = "Profiled Sara RFv2 Face mesh is ready.";

  const bindings: SaraRfv2FaceMorphBinding[] = [];
  const boundFaceMeshPaths: string[] = [];
  const missingRequiredMorphsByMesh = new Map<string, string[]>();
  const allowedMorphUnion = new Set<string>();

  if (!faceRoot) {
    applierBindingReason = `Face root not found. Expected one of: ${SARA_RFV2_BINDING_PROFILE.face.rootCandidates.join(", ")}.`;
  } else if (!faceTarget) {
    applierBindingReason = `Face group/mesh "${SARA_RFV2_BINDING_PROFILE.face.groupName}" not found under profiled Face root.`;
  } else {
    const candidateMeshes: Mesh[] = [];
    if (isProfileFaceMesh(faceTarget)) {
      candidateMeshes.push(faceTarget);
    } else {
      faceTarget.traverse((object) => {
        if (isProfileFaceDescendantMesh(object)) {
          candidateMeshes.push(object);
        }
      });
    }

    candidateMeshes.forEach((mesh) => {
      const dictionary = mesh.morphTargetDictionary as Record<string, number> | undefined;
      const missingRequiredMorphs = getRequiredMorphsMissing(dictionary);
      if (!isEffectivelyVisible(mesh)) {
        missingRequiredMorphsByMesh.set(getObjectPath(mesh), ["mesh is not visible"]);
        return;
      }
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
        missingRequiredMorphsByMesh.set(getObjectPath(mesh), [
          "mesh has no morph target dictionary/influences",
        ]);
        return;
      }
      if (missingRequiredMorphs.length > 0) {
        missingRequiredMorphsByMesh.set(getObjectPath(mesh), missingRequiredMorphs);
        return;
      }
      const meshAllowedMorphsFound = getAllowedMorphsFound(dictionary);
      meshAllowedMorphsFound.forEach((morphName) => allowedMorphUnion.add(morphName));
      bindings.push(createBinding(mesh, meshAllowedMorphsFound));
      boundFaceMeshPaths.push(getObjectPath(mesh));
    });

    if (candidateMeshes.length === 0) {
      applierBindingReason = faceGroupDetected
        ? `Face group found, but no profiled "${SARA_RFV2_BINDING_PROFILE.face.descendantMeshNamePrefix}*" skinned meshes were found below it.`
        : `Profiled Face object is not a bindable skinned mesh: ${faceMeshPath ?? "unknown path"}.`;
    } else if (bindings.length === 0) {
      applierBindingReason = `Profiled Face descendants found, but none contained all required morphs: ${SARA_RFV2_BINDING_PROFILE.face.requiredMorphs.join(", ")}.`;
    } else {
      applierBindingReason = `Bound ${bindings.length} profiled Sara RFv2 Face skinned mesh${bindings.length === 1 ? "" : "es"}.`;
    }
  }

  const allowedMorphsFound = Array.from(allowedMorphUnion).sort();
  const missingRequiredMorphs = bindings.length > 0
    ? []
    : Array.from(
        new Set(
          Array.from(missingRequiredMorphsByMesh.values()).flat().length > 0
            ? Array.from(missingRequiredMorphsByMesh.values()).flat()
            : SARA_RFV2_BINDING_PROFILE.face.requiredMorphs,
        ),
      ).sort();
  const boundFaceMeshNames = bindings.map((binding) => binding.meshName);

  const state: SaraRfv2MorphApplierState = {
    ...createSaraRfv2MorphApplierState(),
    enabled: SARA_RFV2_FLAGS.runtime,
    bound: bindings.length > 0,
    faceMeshCount: bindings.length,
    boundMeshUuids: bindings.map((binding) => binding.meshUuid),
    ownedMorphs: allowedMorphsFound,
  };

  return {
    state,
    bindings,
    diagnostics: createDiagnostics({
      bindings,
      root: args.root,
      allMorphCapableMeshes: rejections.allMorphCapableMeshes,
      rejectedMorphMeshes: rejections.rejectedMorphMeshes,
      bindingProfile: {
        faceRootFound: Boolean(faceRoot),
        faceMeshPath,
        missingRequiredMorphs,
        allowedMorphsFound,
        forbiddenMeshesRejected: rejections.forbiddenMeshesRejected,
        forbiddenMorphsRejected: rejections.forbiddenMorphsRejected,
        faceRootChildren: faceRootAudit.faceRootChildren,
        faceRootAudit: faceRootAudit.faceRootAudit,
        faceGroupDetected,
        faceGroupPath,
        boundFaceMeshNames,
        boundFaceMeshPaths,
        applierBindingReason,
      },
    }),
  };
}

export function applySaraRfv2MorphTargets(args: {
  state: SaraRfv2MorphApplierState;
  bindings: readonly SaraRfv2FaceMorphBinding[];
  targets: Record<string, number>;
  nowMs: number;
  resetUnspecifiedOwnedMorphs?: boolean;
}): {
  state: SaraRfv2MorphApplierState;
  diagnostics: SaraRfv2MorphApplierDiagnostics;
} {
  const appliedMorphs: Record<string, number> = {};
  const missingMorphs = new Set<string>();
  const blockedMorphs = new Set<string>();
  const presentMorphs = new Set<string>();
  const releasedMorphs: string[] = [];
  const postWriteInfluences: SaraRfv2PostWriteInfluence[] = [];

  Object.entries({ ...args.targets }).forEach(([targetName, rawValue]) => {
    const resolved = resolveTargetMorphName(targetName);
    if (resolved.blocked) {
      blockedMorphs.add(targetName);
      return;
    }
    if (!resolved.morphName) {
      missingMorphs.add(targetName);
      return;
    }

    presentMorphs.add(resolved.morphName);
    const value = clamp(rawValue, 0, getTargetCap(resolved.morphName));
    let applied = false;
    args.bindings.forEach((binding) => {
      const index = binding.ownedMorphIndices[resolved.morphName!];
      if (typeof index !== "number") return;
      binding.morphTargetInfluences[index] = value;
      postWriteInfluences.push({
        meshUuid: binding.meshUuid,
        meshName: binding.meshName,
        morphName: resolved.morphName!,
        index,
        valueWritten: value,
        actualInfluence: binding.morphTargetInfluences[index] ?? 0,
      });
      applied = true;
    });

    if (applied) {
      appliedMorphs[resolved.morphName] = Math.max(appliedMorphs[resolved.morphName] ?? 0, value);
    } else {
      missingMorphs.add(resolved.morphName);
    }
  });

  if (args.resetUnspecifiedOwnedMorphs) {
    args.state.ownedMorphs.forEach((morphName) => {
      if (presentMorphs.has(morphName)) return;
      args.bindings.forEach((binding) => {
        const index = binding.ownedMorphIndices[morphName];
        if (typeof index !== "number") return;
        if (binding.morphTargetInfluences[index] !== 0) releasedMorphs.push(morphName);
        binding.morphTargetInfluences[index] = 0;
      });
    });
  }

  const diagnostics = createDiagnostics({
    bindings: args.bindings,
    appliedMorphs,
    missingMorphs: Array.from(missingMorphs).sort(),
    blockedMorphs: Array.from(blockedMorphs).sort(),
    releasedMorphs: Array.from(new Set(releasedMorphs)).sort(),
    postWriteInfluences,
  });
  return {
    state: {
      ...args.state,
      bound: args.bindings.length > 0,
      faceMeshCount: args.bindings.length,
      boundMeshUuids: args.bindings.map((binding) => binding.meshUuid),
      lastAppliedAtMs: args.nowMs,
      lastAppliedMorphs: appliedMorphs,
      missingMorphs: diagnostics.missingMorphs,
      blockedMorphs: diagnostics.blockedMorphs,
      releasedMorphs: diagnostics.releasedMorphs,
    },
    diagnostics,
  };
}

export function resetSaraRfv2OwnedMorphs(args: {
  bindings: readonly SaraRfv2FaceMorphBinding[];
  immediate?: boolean;
}): SaraRfv2MorphApplierDiagnostics {
  const releasedMorphs = new Set<string>();
  args.bindings.forEach((binding) => {
    Object.entries(binding.ownedMorphIndices).forEach(([morphName, index]) => {
      if (binding.morphTargetInfluences[index] !== 0) releasedMorphs.add(morphName);
      if (args.immediate ?? true) {
        binding.morphTargetInfluences[index] = 0;
      }
    });
  });

  return createDiagnostics({
    bindings: args.bindings,
    releasedMorphs: Array.from(releasedMorphs).sort(),
  });
}

export function releaseSaraRfv2Morphs(args: {
  state: SaraRfv2MorphApplierState;
  bindings: readonly SaraRfv2FaceMorphBinding[];
  deltaSeconds: number;
  releaseSpeed?: number;
}): {
  state: SaraRfv2MorphApplierState;
  diagnostics: SaraRfv2MorphApplierDiagnostics;
} {
  const releaseSpeed = Math.max(0.1, args.releaseSpeed ?? SARA_RFV2_FACE_TUNING.releaseSpeed);
  const blend = 1 - Math.exp(-releaseSpeed * Math.max(0, args.deltaSeconds));
  const releasedMorphs = new Set<string>();

  args.bindings.forEach((binding) => {
    Object.entries(binding.ownedMorphIndices).forEach(([morphName, index]) => {
      const current = binding.morphTargetInfluences[index] ?? 0;
      if (current <= 0.0001) {
        binding.morphTargetInfluences[index] = 0;
        return;
      }
      const next = current + (0 - current) * blend;
      binding.morphTargetInfluences[index] = next <= 0.0001 ? 0 : next;
      releasedMorphs.add(morphName);
    });
  });

  const diagnostics = createDiagnostics({
    bindings: args.bindings,
    releasedMorphs: Array.from(releasedMorphs).sort(),
  });

  return {
    state: {
      ...args.state,
      releasedMorphs: diagnostics.releasedMorphs,
    },
    diagnostics,
  };
}

export function validateSaraRfv2MorphApplier(): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const targetMapValidation = validateSaraRfv2TargetMap();
  if (!targetMapValidation.valid) warnings.push(...targetMapValidation.warnings);

  if ((SARA_RFV2_FORBIDDEN_MORPHS as readonly unknown[]).length === 0) {
    warnings.push("Sara RFv2 forbidden morph list must not be empty.");
  }

  const ownedMorphs = SARA_RFV2_BINDING_PROFILE.face.allowedMorphs as readonly string[];
  if (ownedMorphs.includes("Mouth")) {
    warnings.push("Character.002 / Mouth must not be owned by Sara RFv2 applier.");
  }
  if (ownedMorphs.includes("Eyes")) {
    warnings.push("Character.002 / Eyes must not be owned by Sara RFv2 applier.");
  }

  SARA_RFV2_BINDING_PROFILE.face.requiredMorphs.forEach((morphName) => {
    if (!ownedMorphs.includes(morphName)) {
      warnings.push(`Required Face morph is not owned by applier: ${morphName}.`);
    }
  });

  const caps = [
    SARA_RFV2_FACE_TUNING.visemeMaxStrength,
    SARA_RFV2_FACE_TUNING.jawOpenMax,
    SARA_RFV2_EXPRESSION_CAPS.blink,
    SARA_RFV2_EXPRESSION_CAPS.mouthSmile,
    SARA_RFV2_EXPRESSION_CAPS.mouthFrown,
    SARA_RFV2_EXPRESSION_CAPS.cheekSquint,
    SARA_RFV2_EXPRESSION_CAPS.eyeLook,
    SARA_RFV2_EXPRESSION_CAPS.sad,
  ];
  if (caps.some((cap) => cap < 0 || cap > 1)) {
    warnings.push("Sara RFv2 morph applier caps must be within 0..1.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export const SARA_RFV2_MORPH_APPLIER_EMPTY_DIAGNOSTICS = EMPTY_DIAGNOSTICS;
