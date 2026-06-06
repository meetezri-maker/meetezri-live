import type * as ThreeNamespace from "three";
import type {
  AvatarDefinition,
  AvatarRootAlignmentConfig,
  Vector3Config,
  Vector3Object,
} from "./avatarConfigTypes";
import { SARA_V2_AVATAR_DEFINITION } from "./configs/saraV2Config";

type ThreeModule = typeof ThreeNamespace;
type Object3D = ThreeNamespace.Object3D;
type Group = ThreeNamespace.Group;
type Box3 = ThreeNamespace.Box3;
type Vector3 = ThreeNamespace.Vector3;

export type SaraV2AlignmentMode = "lab" | "live";

export type SaraV2AlignmentConfig = AvatarDefinition & {
  readonly saraV2Alignment?: {
    readonly attachHairToFace?: boolean;
    readonly faceScale?: number;
    readonly hairScale?: number;
  };
};

export type SaraV2AlignmentDiagnostics = {
  helper: "prepareSaraV2AlignedScene";
  mode: SaraV2AlignmentMode;
  selectedFace: string | null;
  selectedHair: string | null;
  selectedBody: string | null;
  bodyIsArmature: boolean;
  characterDetached: boolean;
  hairParentedUnderFace: boolean;
  finalRootTransform: {
    position: number[];
    rotation: number[];
    scale: number[];
  };
  finalBounds: ReturnType<typeof serializableBox> | null;
  warnings: string[];
};

export type SaraV2AlignedSceneResult = {
  root: Object3D;
  faceObject: Object3D | null;
  hairObject: Object3D | null;
  bodyObject: Object3D | null;
  diagnostics: SaraV2AlignmentDiagnostics;
};

type StoredTransform = {
  position: Vector3;
  quaternion: ThreeNamespace.Quaternion;
  scale: Vector3;
};

type SaraV2AlignmentUserData = {
  faceGroup?: Group;
  faceObjectUuid?: string;
  faceOriginalParent?: Object3D | null;
  faceGroupInitial?: StoredTransform;
  hairObjectUuid?: string;
  hairOriginalParent?: Object3D | null;
  hairInitial?: StoredTransform;
  characterWasUnderArmature?: boolean;
};

function isVector3Object(value: Vector3Config): value is Vector3Object {
  return !Array.isArray(value) && "x" in value && "y" in value && "z" in value;
}

function vector3FromConfig(THREE: ThreeModule, value: Vector3Config): Vector3 {
  if (isVector3Object(value)) {
    return new THREE.Vector3(value.x, value.y, value.z);
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function getStore(root: Object3D): SaraV2AlignmentUserData {
  root.userData.saraV2Alignment ??= {};
  return root.userData.saraV2Alignment as SaraV2AlignmentUserData;
}

function captureTransform(object: Object3D): StoredTransform {
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  };
}

function restoreTransform(object: Object3D, transform: StoredTransform) {
  object.position.copy(transform.position);
  object.quaternion.copy(transform.quaternion);
  object.scale.copy(transform.scale);
}

function findFirstByName(root: Object3D, names: readonly string[]): Object3D | null {
  for (const name of names) {
    const exact = root.getObjectByName(name);
    if (exact) return exact;
  }

  const normalizedNames = new Set(
    names.map((name) => name.trim().replace(/[\s_-]/g, "").toLowerCase())
  );
  let fuzzy: Object3D | null = null;
  root.traverse((child) => {
    if (fuzzy) return;
    const normalized = (child.name || "")
      .trim()
      .replace(/[\s_-]/g, "")
      .toLowerCase();
    if (normalizedNames.has(normalized)) fuzzy = child;
  });
  return fuzzy;
}

function isDescendantOf(object: Object3D | null | undefined, ancestor: Object3D | null) {
  if (!object || !ancestor) return false;
  let current: Object3D | null = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function findSkeletonSafeBody(root: Object3D, names: readonly string[]): Object3D | null {
  const armature = root.getObjectByName("Armature");
  if (armature) return armature;
  return findFirstByName(root, names);
}

function safeBoxFromObject(THREE: ThreeModule, object: Object3D): Box3 | null {
  const box = new THREE.Box3();
  try {
    box.setFromObject(object);
  } catch {
    box.makeEmpty();
  }
  if (box.isEmpty()) return null;
  return box;
}

function serializableBox(THREE: ThreeModule, box: Box3) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    min: box.min.toArray(),
    max: box.max.toArray(),
    center: center.toArray(),
    size: size.toArray(),
  };
}

function serializeRootTransform(root: Object3D) {
  return {
    position: root.position.toArray(),
    rotation: [root.rotation.x, root.rotation.y, root.rotation.z],
    scale: root.scale.toArray(),
  };
}

function detachPreviousFaceGroup(store: SaraV2AlignmentUserData, nextFace: Object3D | null) {
  const group = store.faceGroup;
  if (!group) return;
  const currentFace = store.faceObjectUuid
    ? group.getObjectByProperty("uuid", store.faceObjectUuid)
    : null;
  if (currentFace && currentFace !== nextFace && store.faceOriginalParent) {
    store.faceOriginalParent.attach(currentFace);
    group.parent?.remove(group);
    store.faceGroup = undefined;
    store.faceGroupInitial = undefined;
    store.faceOriginalParent = undefined;
    store.faceObjectUuid = undefined;
  }
}

function ensureFaceAlignmentGroup(
  THREE: ThreeModule,
  root: Object3D,
  faceObject: Object3D | null
): Group | null {
  const store = getStore(root);
  detachPreviousFaceGroup(store, faceObject);
  if (!faceObject || !faceObject.parent) return null;

  if (store.faceGroup && store.faceObjectUuid === faceObject.uuid) {
    return store.faceGroup;
  }

  const originalParent = faceObject.parent;
  const group = new THREE.Group();
  group.name = "FaceAlignmentGroup";
  group.position.copy(faceObject.position);
  group.quaternion.copy(faceObject.quaternion);
  group.scale.copy(faceObject.scale);
  originalParent.add(group);
  group.attach(faceObject);

  store.faceGroup = group;
  store.faceObjectUuid = faceObject.uuid;
  store.faceOriginalParent = originalParent;
  store.faceGroupInitial = captureTransform(group);
  return group;
}

function syncHairAttachment(
  root: Object3D,
  hairObject: Object3D | null,
  faceGroup: Group | null,
  attachHairToFace: boolean
) {
  const store = getStore(root);

  if (store.hairObjectUuid && hairObject?.uuid !== store.hairObjectUuid) {
    const previousHair = root.getObjectByProperty("uuid", store.hairObjectUuid);
    if (previousHair && store.hairOriginalParent && previousHair.parent === store.faceGroup) {
      store.hairOriginalParent.attach(previousHair);
    }
    store.hairOriginalParent = undefined;
    store.hairInitial = undefined;
    store.hairObjectUuid = undefined;
  }

  if (!hairObject) return;
  if (!store.hairInitial || store.hairObjectUuid !== hairObject.uuid) {
    store.hairInitial = captureTransform(hairObject);
    store.hairObjectUuid = hairObject.uuid;
  }

  if (!attachHairToFace || !faceGroup) {
    if (store.hairOriginalParent && hairObject.parent === store.faceGroup) {
      store.hairOriginalParent.attach(hairObject);
      store.hairInitial = captureTransform(hairObject);
    }
    store.hairOriginalParent = undefined;
    return;
  }

  if (hairObject.parent !== faceGroup) {
    store.hairOriginalParent = hairObject.parent;
    faceGroup.attach(hairObject);
    store.hairInitial = captureTransform(hairObject);
  }
}

export function prepareSaraV2AlignedScene({
  gltfScene,
  config,
  THREE,
  mode,
}: {
  gltfScene: Object3D;
  config?: SaraV2AlignmentConfig;
  THREE: ThreeModule;
  mode: SaraV2AlignmentMode;
}): SaraV2AlignedSceneResult {
  const resolvedConfig = config ?? SARA_V2_AVATAR_DEFINITION;
  const rootAlignment = resolvedConfig.rootAlignment as AvatarRootAlignmentConfig;
  const alignmentOptions = resolvedConfig.saraV2Alignment;
  const warnings: string[] = [];
  const store = getStore(gltfScene);

  const faceObject = findFirstByName(gltfScene, rootAlignment.face.names);
  const hairObject = findFirstByName(gltfScene, rootAlignment.hair.names);
  const bodyObject = findSkeletonSafeBody(gltfScene, rootAlignment.body.names);
  const armature = gltfScene.getObjectByName("Armature");
  const character = gltfScene.getObjectByName("Character");
  store.characterWasUnderArmature ??=
    character && armature ? isDescendantOf(character, armature) : false;

  const faceGroup = ensureFaceAlignmentGroup(THREE, gltfScene, faceObject);
  const attachHairToFace = alignmentOptions?.attachHairToFace ?? true;
  syncHairAttachment(gltfScene, hairObject, faceGroup, attachHairToFace);

  if (faceGroup && store.faceGroupInitial) {
    restoreTransform(faceGroup, store.faceGroupInitial);
    faceGroup.position.add(vector3FromConfig(THREE, rootAlignment.face.offset));
    faceGroup.scale.multiplyScalar(alignmentOptions?.faceScale ?? 1);
  } else if (!faceObject) {
    warnings.push("Sara V2 face candidate was not found.");
  }

  if (hairObject && store.hairInitial) {
    restoreTransform(hairObject, store.hairInitial);
    hairObject.position.add(vector3FromConfig(THREE, rootAlignment.hair.offset));
    hairObject.scale.multiplyScalar(alignmentOptions?.hairScale ?? 1);
  } else if (!hairObject) {
    warnings.push("Sara V2 hair candidate was not found.");
  }

  if (!bodyObject) {
    warnings.push("Sara V2 body candidate was not found.");
  }
  if (bodyObject?.name !== "Armature") {
    warnings.push("Sara V2 body candidate is not Armature.");
  }

  gltfScene.updateMatrixWorld(true);
  const finalBounds = safeBoxFromObject(THREE, gltfScene);
  const characterDetached = Boolean(store.characterWasUnderArmature && character && armature) &&
    !isDescendantOf(character ?? null, armature ?? null);
  const hairParentedUnderFace = Boolean(hairObject && faceGroup && isDescendantOf(hairObject, faceGroup));

  const diagnostics: SaraV2AlignmentDiagnostics = {
    helper: "prepareSaraV2AlignedScene",
    mode,
    selectedFace: faceObject?.name || null,
    selectedHair: hairObject?.name || null,
    selectedBody: bodyObject?.name || null,
    bodyIsArmature: bodyObject?.name === "Armature",
    characterDetached,
    hairParentedUnderFace,
    finalRootTransform: serializeRootTransform(gltfScene),
    finalBounds: finalBounds ? serializableBox(THREE, finalBounds) : null,
    warnings,
  };

  return {
    root: gltfScene,
    faceObject,
    hairObject,
    bodyObject,
    diagnostics,
  };
}
