import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SARA_V2_AVATAR_DEFINITION } from '@/lib/avatar/configs/saraV2Config';
import { prepareSaraV2AlignedScene } from '@/lib/avatar/saraV2Alignment';

type AssetOption = {
  label: string;
  url: string;
};

type MaterialMode = 'original' | 'basic' | 'normal';
type SceneIsolationMode = 'full' | 'face' | 'character' | 'faceCharacter';

type MeshInfo = {
  id: number;
  name: string;
  parent: string;
  type: string;
  isMesh: boolean;
  isSkinnedMesh: boolean;
  vertexCount: number;
  materialName: string;
  materialType: string;
  morphTargets: string[];
  boneCount: number;
  localPosition: string;
  localRotation: string;
  localScale: string;
  worldPosition: string;
  worldScale: string;
  worldCenter: string;
  worldSize: string;
  boundsSize: THREE.Vector3;
  distanceFromOrigin: number;
  flags: string[];
};

type BoundsSummary = {
  label: string;
  center: string;
  size: string;
  valid: boolean;
};

type FaceCandidateInfo = {
  uuid: string;
  name: string;
  label: string;
  type: string;
  childrenCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  vertexCount: number;
};

type TransformControls = {
  position: THREE.Vector3Tuple;
  rotation: THREE.Vector3Tuple;
  scale: number;
  faceRootYOffset: number;
  bodyRootYOffset: number;
  faceScale: number;
  bodyScale: number;
};

type RootOverride = {
  position: THREE.Vector3Tuple;
  rotation: THREE.Vector3Tuple;
  scale: number;
};

const ASSETS: AssetOption[] = [
  { label: 'Sara C2- clean test', url: '/avatars/C2-.glb' },
  { label: 'Sara C2-25v4', url: '/avatars/C2-25v4.glb' },
  { label: 'Sara C2-25v2', url: '/avatars/C2-25v2.glb' },
  { label: 'Jordan reference', url: '/avatars/jordanTaylor.glb' },
];

const ROOT_CANDIDATES = [
  'Face Rig',
  'Face',
  'Armature',
  'model_19',
  'model_0',
  'Character',
  'SKM_NewMetaHumanCharacter_FaceMesh',
  'SKM_NewMetaHumanCharacter_FaceMesh.001',
];

const FACE_ROOT_CANDIDATES = [
  'Face_Rig',
  'Face Rig',
  'Face',
  'SKM_NewMetaHumanCharacter_FaceMesh',
  'SKM_NewMetaHumanCharacter_FaceMesh.001',
];

const FACE_CANDIDATE_KEYWORDS = [
  'face',
  'head',
  'skin',
  'eye',
  'mouth',
  'teeth',
  'tongue',
  'skm',
  'character',
];

const HAIR_CANDIDATE_KEYWORDS = [
  'hair',
  'groom',
  'scalp',
  'head',
  'model_19',
  'object_2',
  'cap',
  'eyebrow',
  'eyebrows',
];

const BODY_ROOT_CANDIDATES = [
  'Armature',
  'Character',
];

const FACE_CHARACTER_IGNORED_NAMES = new Set(['Object_2', 'model_19']);

const DEFAULT_TRANSFORM: TransformControls = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  faceRootYOffset: 0,
  bodyRootYOffset: 0,
  faceScale: 1,
  bodyScale: 1,
};

const DEFAULT_ROOT_OVERRIDE: RootOverride = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

function formatVector(vector: THREE.Vector3 | THREE.Euler | THREE.Vector3Tuple): string {
  const values = Array.isArray(vector)
    ? vector
    : 'isEuler' in vector
      ? [vector.x, vector.y, vector.z]
      : [vector.x, vector.y, vector.z];
  return values.map((value) => Number(value).toFixed(4)).join(', ');
}

function getMaterialName(material: THREE.Material | THREE.Material[] | undefined): string {
  if (!material) return 'none';
  if (Array.isArray(material)) return material.map((item) => item.name || 'unnamed').join(', ');
  return material.name || 'unnamed';
}

function getMaterialType(material: THREE.Material | THREE.Material[] | undefined): string {
  if (!material) return 'none';
  if (Array.isArray(material)) return material.map((item) => item.type).join(', ');
  return material.type;
}

function getMorphTargetNames(mesh: THREE.Mesh): string[] {
  const dictionary = mesh.morphTargetDictionary;
  if (!dictionary) return [];
  return Object.keys(dictionary).sort((a, b) => dictionary[a] - dictionary[b]);
}

function isSkinnedMesh(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return (object as THREE.SkinnedMesh).isSkinnedMesh === true;
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

function isDescendantOf(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function safeBoxFromObject(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  try {
    box.setFromObject(object);
  } catch {
    box.makeEmpty();
  }
  return box;
}

function summarizeBox(label: string, box: THREE.Box3): BoundsSummary {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  const valid = !box.isEmpty()
    && Number.isFinite(box.min.x)
    && Number.isFinite(box.min.y)
    && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x)
    && Number.isFinite(box.max.y)
    && Number.isFinite(box.max.z);
  if (valid) {
    box.getCenter(center);
    box.getSize(size);
  }
  return {
    label,
    center: valid ? formatVector(center) : 'invalid',
    size: valid ? formatVector(size) : 'invalid',
    valid,
  };
}

function createFaceCandidateInfo(object: THREE.Object3D, index: number): FaceCandidateInfo {
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let vertexCount = 0;
  object.traverse((child) => {
    if (!isMesh(child)) return;
    meshCount += 1;
    if (isSkinnedMesh(child)) skinnedMeshCount += 1;
    vertexCount += child.geometry?.attributes?.position?.count ?? 0;
  });

  const name = object.name || `(unnamed ${object.type})`;
  return {
    uuid: object.uuid,
    name,
    label: `${name} | ${object.type} | meshes ${meshCount} | #${index + 1}`,
    type: object.type,
    childrenCount: object.children.length,
    meshCount,
    skinnedMeshCount,
    vertexCount,
  };
}

function collectFaceCandidates(root: THREE.Object3D): FaceCandidateInfo[] {
  const candidates: FaceCandidateInfo[] = [];
  root.traverse((object) => {
    const searchable = `${object.name} ${object.type}`.toLowerCase();
    if (!FACE_CANDIDATE_KEYWORDS.some((keyword) => searchable.includes(keyword))) return;
    candidates.push(createFaceCandidateInfo(object, candidates.length));
  });
  return candidates;
}

function collectHairCandidates(root: THREE.Object3D): FaceCandidateInfo[] {
  const candidates: FaceCandidateInfo[] = [];
  root.traverse((object) => {
    const searchable = `${object.name} ${object.type}`.toLowerCase();
    if (!HAIR_CANDIDATE_KEYWORDS.some((keyword) => searchable.includes(keyword))) return;
    candidates.push(createFaceCandidateInfo(object, candidates.length));
  });
  return candidates;
}

function findObjectByUuid(root: THREE.Object3D, uuid: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (found || object.uuid !== uuid) return;
    found = object;
  });
  return found;
}

function findNamedLabObject(root: THREE.Object3D, preferredName: string): THREE.Object3D | null {
  const exact = root.getObjectByName(preferredName);
  if (exact) return exact;
  let found: THREE.Object3D | null = null;
  const target = preferredName.toLowerCase();
  root.traverse((object) => {
    if (found) return;
    if (object.name.toLowerCase().includes(target)) found = object;
  });
  return found;
}

function shouldIgnoreForFaceCharacter(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (FACE_CHARACTER_IGNORED_NAMES.has(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function countMeshesUnder(object: THREE.Object3D | null): { meshCount: number; skinnedMeshCount: number } {
  const counts = { meshCount: 0, skinnedMeshCount: 0 };
  if (!object) return counts;
  object.traverse((child) => {
    if (!isMesh(child) || shouldIgnoreForFaceCharacter(child)) return;
    counts.meshCount += 1;
    if (isSkinnedMesh(child)) counts.skinnedMeshCount += 1;
  });
  return counts;
}

function collectMorphTargetNames(root: THREE.Object3D): string[] {
  const names = new Set<string>();
  root.traverse((object) => {
    if (!isMesh(object)) return;
    getMorphTargetNames(object).forEach((name) => names.add(name));
  });
  return Array.from(names).sort();
}

function unionMeshBounds(objects: Array<THREE.Object3D | null>, ignoreFaceCharacterExtras = false): THREE.Box3 {
  const box = new THREE.Box3();
  objects.forEach((object) => {
    if (!object) return;
    object.traverse((child) => {
      if (!isMesh(child)) return;
      if (ignoreFaceCharacterExtras && shouldIgnoreForFaceCharacter(child)) return;
      const meshBox = safeBoxFromObject(child);
      if (!meshBox.isEmpty()) box.union(meshBox);
    });
  });
  return box;
}

function buildNewFileAudit(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const roots = root.children.map((child) => child.name || child.type);
  const meshes: string[] = [];
  const skinnedMeshes: string[] = [];
  root.traverse((object) => {
    if (!isMesh(object)) return;
    meshes.push(object.name || `(mesh ${object.id})`);
    if (isSkinnedMesh(object)) skinnedMeshes.push(object.name || `(skinned mesh ${object.id})`);
  });

  const face = findNamedLabObject(root, 'Face');
  const character = findNamedLabObject(root, 'Character');
  const faceCounts = countMeshesUnder(face);
  const characterCounts = countMeshesUnder(character);
  const finalBox = unionMeshBounds([face, character], true);

  return {
    rootNames: roots,
    roots,
    faceMeshFound: Boolean(face && faceCounts.meshCount > 0),
    characterMeshFound: Boolean(character && characterCounts.meshCount > 0),
    faceObjectName: face?.name ?? null,
    characterObjectName: character?.name ?? null,
    meshCounts: {
      total: meshes.length,
      face: faceCounts.meshCount,
      character: characterCounts.meshCount,
    },
    skinnedMeshCounts: {
      total: skinnedMeshes.length,
      face: faceCounts.skinnedMeshCount,
      character: characterCounts.skinnedMeshCount,
    },
    meshes,
    skinnedMeshes,
    morphTargetNames: collectMorphTargetNames(root),
    bounds: collectBounds(root),
    faceBounds: face ? summarizeBox('Face bounds', safeBoxFromObject(face)) : null,
    characterBounds: character ? summarizeBox('Character bounds', safeBoxFromObject(character)) : null,
    finalBounds: summarizeBox('Face + Character bounds', finalBox),
    ignoredInFaceCharacterMode: Array.from(FACE_CHARACTER_IGNORED_NAMES),
  };
}

function getValidBoxCenter(object: THREE.Object3D | null): { box: THREE.Box3; center: THREE.Vector3 } | null {
  if (!object) return null;
  const box = safeBoxFromObject(object);
  if (
    box.isEmpty()
    || !Number.isFinite(box.min.x)
    || !Number.isFinite(box.min.y)
    || !Number.isFinite(box.min.z)
    || !Number.isFinite(box.max.x)
    || !Number.isFinite(box.max.y)
    || !Number.isFinite(box.max.z)
  ) {
    return null;
  }
  const center = new THREE.Vector3();
  box.getCenter(center);
  return { box, center };
}

function createCenterMarker(center: THREE.Vector3, color: number, label: string): THREE.Group {
  const markerGroup = new THREE.Group();
  markerGroup.position.copy(center);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  marker.renderOrder = 999;
  markerGroup.add(marker);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(15, 23, 42, 0.82)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.fillStyle = '#f8fafc';
    context.font = '28px sans-serif';
    context.fillText(label, 18, 42);
  }
  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, depthTest: false }));
  labelSprite.position.set(0, 0.12, 0);
  labelSprite.scale.set(0.42, 0.105, 1);
  labelSprite.renderOrder = 1000;
  markerGroup.add(labelSprite);

  return markerGroup;
}

function getSuggestedFaceZOffset(
  faceRoot: THREE.Object3D | null,
  faceCenter: THREE.Vector3 | null,
  bodyCenter: THREE.Vector3 | null,
  currentFaceOffsetZ: number,
): number | null {
  if (!faceRoot || !faceCenter || !bodyCenter) return null;
  const desiredFaceCenter = faceCenter.clone();
  desiredFaceCenter.z = bodyCenter.z;
  const parent = faceRoot.parent;
  const currentLocalCenter = parent ? parent.worldToLocal(faceCenter.clone()) : faceCenter.clone();
  const desiredLocalCenter = parent ? parent.worldToLocal(desiredFaceCenter) : desiredFaceCenter;
  return currentFaceOffsetZ + desiredLocalCenter.z - currentLocalCenter.z;
}

function collectBounds(root: THREE.Object3D | null): BoundsSummary[] {
  if (!root) return [];

  const renderMeshBox = new THREE.Box3();
  const skinnedMeshBox = new THREE.Box3();
  const nonSkinnedMeshBox = new THREE.Box3();

  root.traverse((object) => {
    if (!isMesh(object)) return;
    const box = safeBoxFromObject(object);
    if (box.isEmpty()) return;
    if (object.visible) renderMeshBox.union(box);
    if (isSkinnedMesh(object)) skinnedMeshBox.union(box);
    else nonSkinnedMeshBox.union(box);
  });

  return [
    summarizeBox('Full scene bounds', safeBoxFromObject(root)),
    summarizeBox('Render mesh bounds', renderMeshBox),
    summarizeBox('Skinned mesh bounds', skinnedMeshBox),
    summarizeBox('Non-skinned mesh bounds', nonSkinnedMeshBox),
  ];
}

function createMeshInfo(mesh: THREE.Mesh): MeshInfo {
  const geometry = mesh.geometry;
  const position = geometry?.attributes?.position;
  const vertexCount = position?.count ?? 0;
  const box = safeBoxFromObject(mesh);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const worldScale = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const validBounds = !box.isEmpty()
    && Number.isFinite(box.min.x)
    && Number.isFinite(box.min.y)
    && Number.isFinite(box.min.z)
    && Number.isFinite(box.max.x)
    && Number.isFinite(box.max.y)
    && Number.isFinite(box.max.z);
  if (validBounds) {
    box.getCenter(center);
    box.getSize(size);
  }
  mesh.getWorldPosition(worldPosition);
  mesh.getWorldScale(worldScale);
  mesh.getWorldQuaternion(worldQuaternion);

  const flags: string[] = [];
  const maxSize = Math.max(size.x, size.y, size.z);
  const minSize = Math.min(size.x, size.y, size.z);
  if (!geometry || vertexCount === 0) flags.push('zero/invalid geometry');
  if (!validBounds) flags.push('NaN/Infinity bounds');
  if (validBounds && maxSize > 100) flags.push('huge bounds');
  if (validBounds && minSize > 0 && maxSize < 0.001) flags.push('tiny bounds');
  if (worldScale.x < 0.0001 || worldScale.y < 0.0001 || worldScale.z < 0.0001) flags.push('scale under 0.0001');
  if (worldScale.x > 100 || worldScale.y > 100 || worldScale.z > 100) flags.push('scale over 100');
  if (worldPosition.length() > 100) flags.push('mesh far from origin');

  return {
    id: mesh.id,
    name: mesh.name || `(mesh ${mesh.id})`,
    parent: mesh.parent?.name || mesh.parent?.type || 'none',
    type: mesh.type,
    isMesh: true,
    isSkinnedMesh: isSkinnedMesh(mesh),
    vertexCount,
    materialName: getMaterialName(mesh.material),
    materialType: getMaterialType(mesh.material),
    morphTargets: getMorphTargetNames(mesh),
    boneCount: isSkinnedMesh(mesh) ? mesh.skeleton?.bones?.length ?? 0 : 0,
    localPosition: formatVector(mesh.position),
    localRotation: formatVector(mesh.rotation),
    localScale: formatVector(mesh.scale),
    worldPosition: formatVector(worldPosition),
    worldScale: formatVector(worldScale),
    worldCenter: validBounds ? formatVector(center) : 'invalid',
    worldSize: validBounds ? formatVector(size) : 'invalid',
    boundsSize: size,
    distanceFromOrigin: worldPosition.length(),
    flags,
  };
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
  } else {
    material?.dispose();
  }
}

function disposeObjectResources(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!isMesh(child)) return;
    child.geometry?.dispose();
    disposeMaterial(child.material);
  });
}

function countRenderMeshes(object: THREE.Object3D | null): number {
  let count = 0;
  object?.traverse((child) => {
    if (isMesh(child)) count += 1;
  });
  return count;
}

export function SaraAvatarLab() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const avatarRootRef = useRef<THREE.Group | null>(null);
  const loadedSceneRef = useRef<THREE.Object3D | null>(null);
  const loadedAssetUrlRef = useRef<string | null>(null);
  const loaderRequestIdRef = useRef(0);
  const selectedFaceObjectRef = useRef<THREE.Object3D | null>(null);
  const faceAlignmentGroupRef = useRef<THREE.Group | null>(null);
  const faceAlignmentDebugRef = useRef<Record<string, unknown>>({});
  const selectedHairObjectRef = useRef<THREE.Object3D | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const helperGroupRef = useRef<THREE.Group | null>(null);
  const originalMaterialsRef = useRef(new Map<number, THREE.Material | THREE.Material[]>());
  const originalVisibilityRef = useRef(new Map<number, boolean>());
  const initialRootTransformsRef = useRef(new Map<string, { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>());
  const rootObjectsRef = useRef(new Map<string, THREE.Object3D>());

  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0].url);
  const [loadingState, setLoadingState] = useState('Idle');
  const [toggles, setToggles] = useState({
    forceVisible: true,
    disableFrustumCulling: true,
    wireframe: false,
    showFullBounds: true,
    showMeshBounds: false,
    showAxes: true,
    showSkeleton: false,
    showMeshCenters: false,
    hideSkinned: false,
    hideNonSkinned: false,
    selectedOnly: false,
    showOnlyFaceCandidate: false,
    forceFaceMaterial: false,
    showOnlyHairCandidate: false,
    forceHairMaterial: false,
  });
  const [materialMode, setMaterialMode] = useState<MaterialMode>('original');
  const [transform, setTransform] = useState<TransformControls>(DEFAULT_TRANSFORM);
  const [rootOverrides, setRootOverrides] = useState<Record<string, RootOverride>>({});
  const [meshInfos, setMeshInfos] = useState<MeshInfo[]>([]);
  const [sceneRoots, setSceneRoots] = useState<string[]>([]);
  const [bounds, setBounds] = useState<BoundsSummary[]>([]);
  const [rootNames, setRootNames] = useState<string[]>([]);
  const [faceCandidates, setFaceCandidates] = useState<FaceCandidateInfo[]>([]);
  const [hairCandidates, setHairCandidates] = useState<FaceCandidateInfo[]>([]);
  const [selectedFaceRootName, setSelectedFaceRootName] = useState('');
  const [selectedFaceCandidateUuid, setSelectedFaceCandidateUuid] = useState('');
  const [selectedHairCandidateUuid, setSelectedHairCandidateUuid] = useState('');
  const [faceCandidateScale, setFaceCandidateScale] = useState(1);
  const [hairOffset, setHairOffset] = useState<THREE.Vector3Tuple>([0, 0.45, 0.09]);
  const [hairScale, setHairScale] = useState(1);
  const [attachHairToFace, setAttachHairToFace] = useState(true);
  const [sceneIsolationMode, setSceneIsolationMode] = useState<SceneIsolationMode>('full');
  const [faceOffset, setFaceOffset] = useState<THREE.Vector3Tuple>([0, 0.45, 0.08]);
  const [selectedMeshId, setSelectedMeshId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState('largestY');
  const [configLog, setConfigLog] = useState('');

  const selectedAssetLabel = useMemo(
    () => ASSETS.find((asset) => asset.url === selectedAsset)?.label ?? selectedAsset,
    [selectedAsset],
  );

  const selectedMesh = useMemo(
    () => meshInfos.find((mesh) => mesh.id === selectedMeshId) ?? null,
    [meshInfos, selectedMeshId],
  );

  const selectedFaceCandidateInfo = useMemo(
    () => faceCandidates.find((candidate) => candidate.uuid === selectedFaceCandidateUuid) ?? null,
    [faceCandidates, selectedFaceCandidateUuid],
  );

  const selectedHairCandidateInfo = useMemo(
    () => hairCandidates.find((candidate) => candidate.uuid === selectedHairCandidateUuid) ?? null,
    [hairCandidates, selectedHairCandidateUuid],
  );

  const removeFaceAlignmentGroup = useCallback(() => {
    const group = faceAlignmentGroupRef.current;
    group?.parent?.remove(group);
    faceAlignmentGroupRef.current = null;
  }, []);

  const sortedMeshes = useMemo(() => {
    const sorted = [...meshInfos];
    sorted.sort((a, b) => {
      if (sortMode === 'largestX') return b.boundsSize.x - a.boundsSize.x;
      if (sortMode === 'largestY') return b.boundsSize.y - a.boundsSize.y;
      if (sortMode === 'largestZ') return b.boundsSize.z - a.boundsSize.z;
      if (sortMode === 'distance') return b.distanceFromOrigin - a.distanceFromOrigin;
      if (sortMode === 'scale') {
        const scaleA = a.worldScale.split(', ').map(Number);
        const scaleB = b.worldScale.split(', ').map(Number);
        return Math.max(...scaleB) - Math.max(...scaleA);
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [meshInfos, sortMode]);

  const refreshDiagnostics = useCallback(() => {
    const root = loadedSceneRef.current;
    if (!root) return;
    root.updateMatrixWorld(true);
    const meshes: MeshInfo[] = [];
    const roots: string[] = root.children.map((child) => `${child.name || child.type} (${child.type})`);
    root.traverse((object) => {
      if (isMesh(object)) meshes.push(createMeshInfo(object));
    });
    const foundRoots = ROOT_CANDIDATES.filter((name) => root.getObjectByName(name));
    const foundFaceCandidates = collectFaceCandidates(root);
    const foundHairCandidates = collectHairCandidates(root);
    const newFileAudit = buildNewFileAudit(root);
    (window as any).saraLabNewFileAudit = newFileAudit;
    setSceneRoots(roots);
    setMeshInfos(meshes);
    setBounds(collectBounds(root));
    setRootNames(foundRoots);
    setFaceCandidates(foundFaceCandidates);
    setHairCandidates(foundHairCandidates);
    setSelectedFaceCandidateUuid((current) => {
      if (current && foundFaceCandidates.some((candidate) => candidate.uuid === current)) return current;
      return foundFaceCandidates[0]?.uuid ?? '';
    });
    setSelectedFaceRootName((current) => {
      if (current && foundFaceCandidates.some((candidate) => candidate.name === current)) return current;
      return foundFaceCandidates[0]?.name ?? '';
    });
    setSelectedHairCandidateUuid((current) => {
      if (current && foundHairCandidates.some((candidate) => candidate.uuid === current)) return current;
      return foundHairCandidates[0]?.uuid ?? '';
    });
    rootObjectsRef.current = new Map(foundRoots.map((name) => [name, root.getObjectByName(name)!]));
    foundFaceCandidates.forEach((candidate) => {
      const object = findObjectByUuid(root, candidate.uuid);
      if (object && !initialRootTransformsRef.current.has(object.uuid)) {
        initialRootTransformsRef.current.set(object.uuid, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
        });
      }
    });
    setRootOverrides((current) => {
      const next = { ...current };
      foundRoots.forEach((name) => {
        if (!next[name]) next[name] = { ...DEFAULT_ROOT_OVERRIDE };
      });
      return next;
    });
  }, []);

  const publishFaceAlignmentDiagnostics = useCallback(() => {
    const root = loadedSceneRef.current;
    if (!root) return;

    const faceRoot = selectedFaceObjectRef.current
      ?? (selectedFaceCandidateUuid
        ? findObjectByUuid(root, selectedFaceCandidateUuid)
        : selectedFaceRootName ? root.getObjectByName(selectedFaceRootName) ?? null : null);
    const bodyRoot = BODY_ROOT_CANDIDATES.map((name) => root.getObjectByName(name)).find(Boolean) ?? null;
    const hairRoot = selectedHairObjectRef.current
      ?? (selectedHairCandidateUuid ? findObjectByUuid(root, selectedHairCandidateUuid) : null);
    root.updateMatrixWorld(true);

    const faceWorldPosition = new THREE.Vector3();
    const bodyWorldPosition = new THREE.Vector3();
    faceRoot?.getWorldPosition(faceWorldPosition);
    bodyRoot?.getWorldPosition(bodyWorldPosition);
    const faceCenter = getValidBoxCenter(faceRoot);
    const bodyCenter = getValidBoxCenter(bodyRoot);
    const hairMeshCount = countRenderMeshes(hairRoot);
    const hairBounds = hairRoot ? summarizeBox('Hair bounds', safeBoxFromObject(hairRoot)) : null;
    const renderMeshCount = countRenderMeshes(faceRoot);
    const warning = faceRoot && renderMeshCount === 0
      ? 'Selected face candidate has no render meshes. Choose another candidate.'
      : null;
    if (warning) console.warn(`[SaraAvatarLab] ${warning}`);
    const zDifference = faceCenter && bodyCenter ? faceCenter.center.z - bodyCenter.center.z : null;
    const suggestedZOffset = getSuggestedFaceZOffset(
      faceRoot,
      faceCenter?.center ?? null,
      bodyCenter?.center ?? null,
      faceOffset[2],
    );

    (window as any).saraLabFaceAlignment = {
      detectedFaceRootName: faceRoot?.name ?? null,
      selectedFaceRootName: selectedFaceRootName || null,
      selectedFaceCandidateUuid: selectedFaceCandidateUuid || null,
      selectedFaceCandidateName: faceRoot?.name ?? selectedFaceRootName ?? null,
      faceObjectFound: Boolean(faceRoot),
      faceObjectParentName: faceRoot?.parent?.name || faceRoot?.parent?.type || null,
      appliedOffset: faceOffset,
      faceObjectWorldPositionBefore: faceAlignmentDebugRef.current.faceObjectWorldPositionBefore ?? null,
      faceObjectWorldPositionAfter: faceAlignmentDebugRef.current.faceObjectWorldPositionAfter ?? (faceRoot ? faceWorldPosition.toArray() : null),
      faceBoundsBefore: faceAlignmentDebugRef.current.faceBoundsBefore ?? null,
      faceBoundsAfter: faceRoot ? summarizeBox('Face bounds after', safeBoxFromObject(faceRoot)) : null,
      markerPosition: faceCenter ? faceCenter.center.toArray() : null,
      renderMeshCount,
      warning,
      faceCandidates: collectFaceCandidates(root),
      requestedFaceOffset: faceOffset,
      currentFacePosition: faceRoot ? faceRoot.position.toArray() : null,
      currentFaceWorldPosition: faceRoot ? faceWorldPosition.toArray() : null,
      currentBodyPosition: bodyRoot ? bodyRoot.position.toArray() : null,
      currentBodyWorldPosition: bodyRoot ? bodyWorldPosition.toArray() : null,
      faceBounds: faceRoot ? summarizeBox('Face bounds', safeBoxFromObject(faceRoot)) : null,
      bodyBounds: bodyRoot ? summarizeBox('Body bounds', safeBoxFromObject(bodyRoot)) : null,
      faceCenter: faceCenter ? faceCenter.center.toArray() : null,
      bodyCenter: bodyCenter ? bodyCenter.center.toArray() : null,
      faceCenterZ: faceCenter?.center.z ?? null,
      bodyCenterZ: bodyCenter?.center.z ?? null,
      zDifference,
      suggestedZOffset,
    };

    (window as any).saraLabHairAlignment = {
      selectedHairCandidateName: hairRoot?.name ?? selectedHairCandidateInfo?.name ?? null,
      hairObjectFound: Boolean(hairRoot),
      hairObjectParentName: hairRoot?.parent?.name || hairRoot?.parent?.type || null,
      hairMeshCount,
      hairBounds,
      faceBounds: faceRoot ? summarizeBox('Face bounds', safeBoxFromObject(faceRoot)) : null,
      bodyBounds: bodyRoot ? summarizeBox('Body bounds', safeBoxFromObject(bodyRoot)) : null,
      appliedHairOffset: hairOffset,
      hairScale,
      attachedToFace: Boolean(attachHairToFace && hairRoot?.parent === faceAlignmentGroupRef.current),
    };
  }, [attachHairToFace, faceOffset, hairOffset, hairScale, selectedFaceCandidateUuid, selectedFaceRootName, selectedHairCandidateInfo?.name, selectedHairCandidateUuid]);

  const applyVisibilityAndMaterials = useCallback(() => {
    const root = loadedSceneRef.current;
    if (!root) return;
    const faceCandidate = selectedFaceObjectRef.current
      ?? (selectedFaceCandidateUuid ? findObjectByUuid(root, selectedFaceCandidateUuid) : null);
    const hairCandidate = selectedHairObjectRef.current
      ?? (selectedHairCandidateUuid ? findObjectByUuid(root, selectedHairCandidateUuid) : null);
    const labFace = findNamedLabObject(root, 'Face');
    const labCharacter = findNamedLabObject(root, 'Character');

    root.traverse((object) => {
      if (!originalVisibilityRef.current.has(object.id)) {
        originalVisibilityRef.current.set(object.id, object.visible);
      }
      if (!toggles.showOnlyFaceCandidate || !isMesh(object)) {
        object.visible = toggles.forceVisible ? true : originalVisibilityRef.current.get(object.id) ?? true;
      }

      if (!isMesh(object)) return;

      if (!originalMaterialsRef.current.has(object.id)) {
        originalMaterialsRef.current.set(object.id, object.material);
      }

      if (toggles.showOnlyFaceCandidate) {
        object.visible = faceCandidate ? isDescendantOf(object, faceCandidate) : false;
      }
      if (toggles.showOnlyHairCandidate) {
        object.visible = hairCandidate ? isDescendantOf(object, hairCandidate) : false;
      }
      if (sceneIsolationMode === 'face') {
        object.visible = labFace ? isDescendantOf(object, labFace) : false;
      }
      if (sceneIsolationMode === 'character') {
        object.visible = labCharacter ? isDescendantOf(object, labCharacter) : false;
      }
      if (sceneIsolationMode === 'faceCharacter') {
        object.visible = Boolean(
          !shouldIgnoreForFaceCharacter(object)
          && (
            (labFace && isDescendantOf(object, labFace))
            || (labCharacter && isDescendantOf(object, labCharacter))
          ),
        );
      }
      if (toggles.hideSkinned && isSkinnedMesh(object)) object.visible = false;
      if (toggles.hideNonSkinned && !isSkinnedMesh(object)) object.visible = false;
      if (toggles.selectedOnly && selectedMeshId !== null) object.visible = object.id === selectedMeshId;
      object.frustumCulled = !toggles.disableFrustumCulling;

      const original = originalMaterialsRef.current.get(object.id);
      if (materialMode === 'original') {
        object.material = original ?? object.material;
      } else {
        if (object.material !== original) disposeMaterial(object.material);
        object.material = materialMode === 'basic'
          ? new THREE.MeshBasicMaterial({ color: 0xd9a7ff, wireframe: toggles.wireframe })
          : new THREE.MeshNormalMaterial({ wireframe: toggles.wireframe });
      }

      if (toggles.forceFaceMaterial && faceCandidate && isDescendantOf(object, faceCandidate)) {
        if (object.material !== original) disposeMaterial(object.material);
        object.material = new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          side: THREE.DoubleSide,
          opacity: 1,
          transparent: false,
          wireframe: toggles.wireframe,
        });
        object.visible = true;
        object.frustumCulled = false;
      }

      if (toggles.forceHairMaterial && hairCandidate && isDescendantOf(object, hairCandidate)) {
        if (object.material !== original) disposeMaterial(object.material);
        object.material = new THREE.MeshBasicMaterial({
          color: 0x99ff00,
          side: THREE.DoubleSide,
          opacity: 1,
          transparent: false,
          wireframe: toggles.wireframe,
        });
        object.visible = true;
        object.frustumCulled = false;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        (material as THREE.Material & { wireframe?: boolean }).wireframe = toggles.wireframe;
        const forceCandidateMaterial = (toggles.forceFaceMaterial && faceCandidate && isDescendantOf(object, faceCandidate))
          || (toggles.forceHairMaterial && hairCandidate && isDescendantOf(object, hairCandidate));
        material.side = forceCandidateMaterial
          ? THREE.DoubleSide
          : material.side;
        material.opacity = forceCandidateMaterial
          ? 1
          : material.opacity;
        material.transparent = forceCandidateMaterial
          ? false
          : material.transparent;
        material.needsUpdate = true;
      });
    });

    refreshDiagnostics();
  }, [materialMode, refreshDiagnostics, sceneIsolationMode, selectedFaceCandidateUuid, selectedHairCandidateUuid, selectedMeshId, toggles]);

  const applyTransforms = useCallback(() => {
    const avatarRoot = avatarRootRef.current;
    const loadedScene = loadedSceneRef.current;
    if (!avatarRoot || !loadedScene) return;

    avatarRoot.position.set(...transform.position);
    avatarRoot.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation[0]),
      THREE.MathUtils.degToRad(transform.rotation[1]),
      THREE.MathUtils.degToRad(transform.rotation[2]),
    );
    avatarRoot.scale.setScalar(transform.scale);

    rootObjectsRef.current.forEach((object, name) => {
      if (object === selectedFaceObjectRef.current) return;
      if (object === selectedHairObjectRef.current) return;
      const initial = initialRootTransformsRef.current.get(name);
      const override = rootOverrides[name] ?? DEFAULT_ROOT_OVERRIDE;
      if (!initial) return;

      object.position.copy(initial.position).add(new THREE.Vector3(...override.position));
      object.rotation.set(
        initial.rotation.x + THREE.MathUtils.degToRad(override.rotation[0]),
        initial.rotation.y + THREE.MathUtils.degToRad(override.rotation[1]),
        initial.rotation.z + THREE.MathUtils.degToRad(override.rotation[2]),
      );
      object.scale.copy(initial.scale).multiplyScalar(override.scale);
    });

    const aligned = prepareSaraV2AlignedScene({
      gltfScene: loadedScene,
      config: {
        ...SARA_V2_AVATAR_DEFINITION,
        rootAlignment: {
          ...SARA_V2_AVATAR_DEFINITION.rootAlignment,
          face: {
            ...SARA_V2_AVATAR_DEFINITION.rootAlignment.face,
            offset: faceOffset,
          },
          hair: {
            ...SARA_V2_AVATAR_DEFINITION.rootAlignment.hair,
            offset: hairOffset,
          },
        },
        saraV2Alignment: {
          attachHairToFace,
          faceScale: faceCandidateScale,
          hairScale,
        },
      },
      THREE,
      mode: 'lab',
    });
    faceAlignmentGroupRef.current = (loadedScene.userData.saraV2Alignment?.faceGroup as THREE.Group | undefined) ?? null;
    selectedFaceObjectRef.current = aligned.faceObject;
    selectedHairObjectRef.current = aligned.hairObject;

    loadedScene.updateMatrixWorld(true);
    publishFaceAlignmentDiagnostics();
    (window as any).saraLabFaceAlignment = {
      ...((window as any).saraLabFaceAlignment ?? {}),
      sameHelperUsed: true,
      helperDiagnostics: aligned.diagnostics,
      selectedFace: aligned.diagnostics.selectedFace,
      selectedHair: aligned.diagnostics.selectedHair,
      selectedBody: aligned.diagnostics.selectedBody,
      bodyIsArmature: aligned.diagnostics.bodyIsArmature,
      characterDetached: aligned.diagnostics.characterDetached,
      finalRootTransform: aligned.diagnostics.finalRootTransform,
      finalBounds: aligned.diagnostics.finalBounds,
    };
    refreshDiagnostics();
  }, [attachHairToFace, faceCandidateScale, faceOffset, hairOffset, hairScale, publishFaceAlignmentDiagnostics, refreshDiagnostics, rootOverrides, transform]);

  const rebuildHelpers = useCallback(() => {
    const scene = sceneRef.current;
    const root = loadedSceneRef.current;
    if (!scene || !root) return;

    if (helperGroupRef.current) {
      scene.remove(helperGroupRef.current);
    }
    const helperGroup = new THREE.Group();
    helperGroup.name = 'SaraAvatarLabHelpers';

    if (toggles.showAxes) {
      helperGroup.add(new THREE.AxesHelper(2));
    }

    if (toggles.showFullBounds) {
      const box = safeBoxFromObject(root);
      if (!box.isEmpty()) helperGroup.add(new THREE.Box3Helper(box, 0x22d3ee));
    }

    if (toggles.showMeshBounds || toggles.showMeshCenters) {
      root.traverse((object) => {
        if (!isMesh(object) || !object.visible) return;
        const box = safeBoxFromObject(object);
        if (box.isEmpty()) return;
        if (toggles.showMeshBounds) helperGroup.add(new THREE.Box3Helper(box, 0xfacc15));
        if (toggles.showMeshCenters) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.015, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4d6d }),
          );
          marker.position.copy(center);
          helperGroup.add(marker);
        }
      });
    }

    const faceRoot = selectedFaceObjectRef.current
      ?? (selectedFaceCandidateUuid
        ? findObjectByUuid(root, selectedFaceCandidateUuid)
        : selectedFaceRootName
          ? root.getObjectByName(selectedFaceRootName) ?? null
          : FACE_ROOT_CANDIDATES.map((name) => root.getObjectByName(name)).find(Boolean) ?? null);
    const bodyRoot = BODY_ROOT_CANDIDATES.map((name) => root.getObjectByName(name)).find(Boolean) ?? null;
    const faceCenter = getValidBoxCenter(faceRoot);
    const bodyCenter = getValidBoxCenter(bodyRoot);
    if (faceCenter) helperGroup.add(createCenterMarker(faceCenter.center, 0xff4d6d, 'Face center'));
    if (bodyCenter) helperGroup.add(createCenterMarker(bodyCenter.center, 0x22d3ee, 'Body center'));

    helperGroupRef.current = helperGroup;
    scene.add(helperGroup);

    if (skeletonHelperRef.current) {
      scene.remove(skeletonHelperRef.current);
      skeletonHelperRef.current.dispose();
      skeletonHelperRef.current = null;
    }
    if (toggles.showSkeleton) {
      const helper = new THREE.SkeletonHelper(root);
      helper.visible = true;
      skeletonHelperRef.current = helper;
      scene.add(helper);
    }
  }, [selectedFaceCandidateUuid, selectedFaceRootName, toggles.showAxes, toggles.showFullBounds, toggles.showMeshBounds, toggles.showMeshCenters, toggles.showSkeleton]);

  const frameBox = useCallback((box: THREE.Box3) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z, 0.5);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5));
    camera.position.copy(center).add(new THREE.Vector3(0, radius * 0.35, distance * 1.15));
    camera.near = Math.max(distance / 100, 0.001);
    camera.far = Math.max(distance * 100, 1000);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }, []);

  const frameTarget = useCallback((target: 'full' | 'render' | 'selected' | 'face' | 'body' | 'character' | 'faceCharacter') => {
    const root = loadedSceneRef.current;
    if (!root) return;
    if (target === 'full') frameBox(safeBoxFromObject(root));
    if (target === 'render') {
      const group = new THREE.Group();
      root.traverse((object) => {
        if (isMesh(object) && object.visible) group.attach(object.clone());
      });
      frameBox(safeBoxFromObject(group));
    }
    if (target === 'selected' && selectedMeshId !== null) {
      const selected = root.getObjectById(selectedMeshId);
      if (selected) frameBox(safeBoxFromObject(selected));
    }
    if (target === 'face') {
      const faceRoot = selectedFaceObjectRef.current
        ?? (selectedFaceCandidateUuid
          ? findObjectByUuid(root, selectedFaceCandidateUuid)
          : selectedFaceRootName
            ? root.getObjectByName(selectedFaceRootName)
            : FACE_ROOT_CANDIDATES.map((name) => root.getObjectByName(name)).find(Boolean));
      if (faceRoot) frameBox(safeBoxFromObject(faceRoot));
    }
    if (target === 'body') {
      const bodyRoot = root.getObjectByName('Armature') ?? root.getObjectByName('Character');
      if (bodyRoot) frameBox(safeBoxFromObject(bodyRoot));
    }
    if (target === 'character') {
      const character = findNamedLabObject(root, 'Character');
      if (character) frameBox(safeBoxFromObject(character));
    }
    if (target === 'faceCharacter') {
      const face = findNamedLabObject(root, 'Face');
      const character = findNamedLabObject(root, 'Character');
      frameBox(unionMeshBounds([face, character], true));
    }
  }, [frameBox, selectedFaceCandidateUuid, selectedFaceRootName, selectedMeshId]);

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 1.4, 3.5);
    controls.target.set(0, 1, 0);
    camera.near = 0.01;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

  const setCameraPreset = useCallback((preset: 'front' | 'side' | 'top') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const root = loadedSceneRef.current;
    if (!camera || !controls || !root) return;

    const box = safeBoxFromObject(root);
    const center = new THREE.Vector3(0, 1, 0);
    const size = new THREE.Vector3(1, 1, 1);
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    }
    const distance = Math.max(size.x, size.y, size.z, 1) * 1.8;
    controls.target.copy(center);
    if (preset === 'front') camera.position.set(center.x, center.y, center.z + distance);
    if (preset === 'side') camera.position.set(center.x + distance, center.y, center.z);
    if (preset === 'top') camera.position.set(center.x, center.y + distance, center.z + 0.001);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(0, 1.4, 3.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x99ccff, 1.2);
    fillLight.position.set(-3, 1.5, 2);
    scene.add(fillLight);

    const avatarRoot = new THREE.Group();
    avatarRoot.name = 'SaraAvatarLabAvatarRoot';
    scene.add(avatarRoot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    avatarRootRef.current = avatarRoot;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let animationFrame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const avatarRoot = avatarRootRef.current;
    if (!avatarRoot) return;

    const selectedAssetUrl = selectedAsset;
    const selectedLabel = ASSETS.find((asset) => asset.url === selectedAssetUrl)?.label ?? selectedAssetUrl;
    const requestId = ++loaderRequestIdRef.current;
    console.log('[Sara Lab Loader] load started', {
      selectedAssetUrl,
      requestId,
      ignoredStaleLoad: false,
    });

    setLoadingState(`Loading ${selectedAsset}`);
    setSelectedMeshId(null);
    setConfigLog('');
    originalMaterialsRef.current.clear();
    originalVisibilityRef.current.clear();
    initialRootTransformsRef.current.clear();
    rootObjectsRef.current.clear();
    removeFaceAlignmentGroup();
    selectedFaceObjectRef.current = null;
    selectedHairObjectRef.current = null;
    faceAlignmentDebugRef.current = {};
    setFaceOffset([0, 0.45, 0.08]);
    setHairOffset([0, 0.45, 0.09]);
    setHairScale(1);
    setAttachHairToFace(true);
    setSelectedFaceRootName('');
    setSelectedFaceCandidateUuid('');
    setSelectedHairCandidateUuid('');
    setFaceCandidateScale(1);
    setSceneIsolationMode('full');

    if (helperGroupRef.current) {
      sceneRef.current?.remove(helperGroupRef.current);
      helperGroupRef.current = null;
    }
    if (skeletonHelperRef.current) {
      sceneRef.current?.remove(skeletonHelperRef.current);
      skeletonHelperRef.current.dispose();
      skeletonHelperRef.current = null;
    }

    if (loadedSceneRef.current) {
      avatarRoot.remove(loadedSceneRef.current);
      disposeObjectResources(loadedSceneRef.current);
      loadedSceneRef.current = null;
      loadedAssetUrlRef.current = null;
    }

    const loader = new GLTFLoader();
    let cancelled = false;
    loader.load(
      selectedAssetUrl,
      (gltf) => {
        const ignoredStaleLoad = cancelled || requestId !== loaderRequestIdRef.current;
        console.log('[Sara Lab Loader] load completed', {
          selectedAssetUrl,
          requestId,
          ignoredStaleLoad,
        });
        if (ignoredStaleLoad) {
          disposeObjectResources(gltf.scene);
          return;
        }
        const scene = gltf.scene;
        scene.name = `${selectedLabel} scene`;
        loadedSceneRef.current = scene;
        loadedAssetUrlRef.current = selectedAssetUrl;
        avatarRoot.add(scene);
        scene.traverse((object) => {
          if (ROOT_CANDIDATES.includes(object.name) || FACE_ROOT_CANDIDATES.includes(object.name)) {
            initialRootTransformsRef.current.set(object.name, {
              position: object.position.clone(),
              rotation: object.rotation.clone(),
              scale: object.scale.clone(),
            });
          }
          initialRootTransformsRef.current.set(object.uuid, {
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone(),
          });
        });
        setLoadingState(`Loaded ${selectedLabel}`);
        setTransform(DEFAULT_TRANSFORM);
        setRootOverrides({});
        const meshes: MeshInfo[] = [];
        const roots: string[] = scene.children.map((child) => `${child.name || child.type} (${child.type})`);
        scene.updateMatrixWorld(true);
        scene.traverse((object) => {
          if (isMesh(object)) meshes.push(createMeshInfo(object));
        });
        const foundRoots = ROOT_CANDIDATES.filter((name) => scene.getObjectByName(name));
        const foundFaceCandidates = collectFaceCandidates(scene);
        const foundHairCandidates = collectHairCandidates(scene);
        rootObjectsRef.current = new Map(foundRoots.map((name) => [name, scene.getObjectByName(name)!]));
        setSceneRoots(roots);
        setMeshInfos(meshes);
        setBounds(collectBounds(scene));
        setRootNames(foundRoots);
        setFaceCandidates(foundFaceCandidates);
        setHairCandidates(foundHairCandidates);
        setSelectedFaceCandidateUuid(foundFaceCandidates[0]?.uuid ?? '');
        setSelectedFaceRootName(foundFaceCandidates[0]?.name ?? '');
        setSelectedHairCandidateUuid(foundHairCandidates[0]?.uuid ?? '');
        setRootOverrides((current) => {
          const next = { ...current };
          foundRoots.forEach((name) => {
            if (!next[name]) next[name] = { ...DEFAULT_ROOT_OVERRIDE };
          });
          return next;
        });
        const audit = buildNewFileAudit(scene);
        (window as any).saraLabNewFileAudit = audit;
        console.log('[SaraAvatarLab] New File Hierarchy Diagnostics', audit);
        window.setTimeout(() => {
          if (requestId !== loaderRequestIdRef.current || loadedSceneRef.current !== scene) return;
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (!camera || !controls) return;
          const box = safeBoxFromObject(scene);
          if (box.isEmpty()) return;
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);
          const radius = Math.max(size.x, size.y, size.z, 0.5);
          const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5));
          camera.position.copy(center).add(new THREE.Vector3(0, radius * 0.35, distance * 1.15));
          camera.near = Math.max(distance / 100, 0.001);
          camera.far = Math.max(distance * 100, 1000);
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          controls.target.copy(center);
          controls.update();
        }, 0);
      },
      (event) => {
        if (!event.total) return;
        if (requestId !== loaderRequestIdRef.current) return;
        setLoadingState(`Loading ${selectedLabel}: ${Math.round((event.loaded / event.total) * 100)}%`);
      },
      (error) => {
        const ignoredStaleLoad = cancelled || requestId !== loaderRequestIdRef.current;
        console.log('[Sara Lab Loader] load completed', {
          selectedAssetUrl,
          requestId,
          ignoredStaleLoad,
          error,
        });
        if (ignoredStaleLoad) return;
        setLoadingState(`Failed to load ${selectedAssetUrl}: ${String(error)}`);
      },
    );

    return () => {
      cancelled = true;
      if (loaderRequestIdRef.current === requestId) {
        loaderRequestIdRef.current += 1;
      }
    };
  }, [selectedAsset]);

  useEffect(() => {
    const root = loadedSceneRef.current;
    if (!root) return;
    const faceObject = selectedFaceCandidateUuid ? findObjectByUuid(root, selectedFaceCandidateUuid) : null;
    selectedFaceObjectRef.current = faceObject;
    if (faceObject && countRenderMeshes(faceObject) === 0) {
      console.warn('[SaraAvatarLab] Selected face candidate has no render meshes. Choose another candidate.');
    }
    root.updateMatrixWorld(true);
  }, [selectedFaceCandidateUuid]);

  useEffect(() => {
    const root = loadedSceneRef.current;
    if (!root) return;
    const hairObject = selectedHairCandidateUuid ? findObjectByUuid(root, selectedHairCandidateUuid) : null;
    selectedHairObjectRef.current = hairObject;
    if (hairObject && countRenderMeshes(hairObject) === 0) {
      console.warn('[SaraAvatarLab] Selected hair candidate has no render meshes. Choose another candidate.');
    }
    root.updateMatrixWorld(true);
  }, [selectedHairCandidateUuid]);

  useEffect(() => {
    applyTransforms();
  }, [applyTransforms]);

  useEffect(() => {
    applyVisibilityAndMaterials();
  }, [applyVisibilityAndMaterials]);

  useEffect(() => {
    rebuildHelpers();
  }, [bounds, meshInfos, rebuildHelpers]);

  const updateTransformVector = (key: 'position' | 'rotation', index: number, value: number) => {
    setTransform((current) => {
      const next = [...current[key]] as THREE.Vector3Tuple;
      next[index] = value;
      return { ...current, [key]: next };
    });
  };

  const updateFaceOffset = (index: number, value: number) => {
    setFaceOffset((current) => {
      const next = [...current] as THREE.Vector3Tuple;
      next[index] = value;
      return next;
    });
  };

  const updateHairOffset = (index: number, value: number) => {
    setHairOffset((current) => {
      const next = [...current] as THREE.Vector3Tuple;
      next[index] = value;
      return next;
    });
  };

  const getFaceDepthInfo = useCallback(() => {
    const root = loadedSceneRef.current;
    if (!root) return null;
    const faceRoot = selectedFaceObjectRef.current
      ?? (selectedFaceCandidateUuid
        ? findObjectByUuid(root, selectedFaceCandidateUuid)
        : selectedFaceRootName ? root.getObjectByName(selectedFaceRootName) ?? null : null);
    const bodyRoot = BODY_ROOT_CANDIDATES.map((name) => root.getObjectByName(name)).find(Boolean) ?? null;
    const faceCenter = getValidBoxCenter(faceRoot);
    const bodyCenter = getValidBoxCenter(bodyRoot);
    if (!faceRoot || !faceCenter || !bodyCenter) return null;
    const zDifference = faceCenter.center.z - bodyCenter.center.z;
    return {
      faceRoot,
      bodyRoot,
      faceCenter: faceCenter.center,
      bodyCenter: bodyCenter.center,
      zDifference,
      suggestedZOffset: getSuggestedFaceZOffset(faceRoot, faceCenter.center, bodyCenter.center, faceOffset[2]),
    };
  }, [faceOffset, selectedFaceCandidateUuid, selectedFaceRootName]);

  const adjustFaceZ = (delta: number) => {
    setFaceOffset((current) => [current[0], current[1], current[2] + delta]);
  };

  const resetFaceZ = () => {
    setFaceOffset((current) => [current[0], current[1], 0]);
  };

  const autoAlignFaceDepth = () => {
    const depthInfo = getFaceDepthInfo();
    if (!depthInfo || depthInfo.suggestedZOffset === null) return;
    setFaceOffset((current) => [current[0], current[1], depthInfo.suggestedZOffset ?? current[2]]);
  };

  const printWorkingFaceAlignment = () => {
    const depthInfo = getFaceDepthInfo();
    const payload = {
      facePosition: faceOffset,
      faceCenter: depthInfo ? depthInfo.faceCenter.toArray() : null,
      bodyCenter: depthInfo ? depthInfo.bodyCenter.toArray() : null,
      zDifference: depthInfo ? depthInfo.zDifference : null,
    };
    const serialized = JSON.stringify(payload, null, 2);
    setConfigLog(serialized);
    console.log('[SaraAvatarLab] Working Face Alignment', payload);
  };

  const printFaceCandidateDetails = () => {
    const root = loadedSceneRef.current;
    if (!root || !selectedFaceCandidateUuid) return;
    const candidate = selectedFaceObjectRef.current ?? findObjectByUuid(root, selectedFaceCandidateUuid);
    if (!candidate) return;

    root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    const morphTargetNames = new Set<string>();
    let vertexCount = 0;

    candidate.traverse((object) => {
      if (!isMesh(object)) return;
      meshes.push(object);
      vertexCount += object.geometry?.attributes?.position?.count ?? 0;
      getMorphTargetNames(object).forEach((name) => morphTargetNames.add(name));
      if (isSkinnedMesh(object)) skinnedMeshes.push(object);
    });

    const localPosition = candidate.position.clone();
    const localScale = candidate.scale.clone();
    const worldPosition = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    candidate.getWorldPosition(worldPosition);
    candidate.getWorldScale(worldScale);
    const boundsBox = safeBoxFromObject(candidate);
    const boundsCenter = new THREE.Vector3();
    const boundsSize = new THREE.Vector3();
    const hasValidBounds = !boundsBox.isEmpty();
    if (hasValidBounds) {
      boundsBox.getCenter(boundsCenter);
      boundsBox.getSize(boundsSize);
    }

    const details = {
      name: candidate.name || '(unnamed)',
      type: candidate.type,
      uuid: candidate.uuid,
      childrenCount: candidate.children.length,
      meshCount: meshes.length,
      skinnedMeshCount: skinnedMeshes.length,
      vertexCount,
      morphTargetNames: Array.from(morphTargetNames).sort(),
      localPosition: localPosition.toArray(),
      worldPosition: worldPosition.toArray(),
      localScale: localScale.toArray(),
      worldScale: worldScale.toArray(),
      bounds: {
        center: hasValidBounds ? boundsCenter.toArray() : null,
        size: hasValidBounds ? boundsSize.toArray() : null,
      },
      warning: meshes.length === 0 ? 'Selected candidate is a group/root only, not visible mesh.' : null,
    };

    const serialized = JSON.stringify(details, null, 2);
    setConfigLog(serialized);
    console.log('[SaraAvatarLab] Face Candidate Details', details);
  };

  const updateRootOverride = (name: string, field: 'position' | 'rotation', index: number, value: number) => {
    setRootOverrides((current) => {
      const existing = current[name] ?? DEFAULT_ROOT_OVERRIDE;
      const nextVector = [...existing[field]] as THREE.Vector3Tuple;
      nextVector[index] = value;
      return { ...current, [name]: { ...existing, [field]: nextVector } };
    });
  };

  const setQuickIsolation = (mode: SceneIsolationMode) => {
    setSceneIsolationMode(mode);
    setToggles((current) => ({
      ...current,
      selectedOnly: false,
      showOnlyFaceCandidate: false,
    }));
  };

  const printWorkingSaraConfig = () => {
    const root = loadedSceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const face = root ? findNamedLabObject(root, 'Face') : null;
    const character = root ? findNamedLabObject(root, 'Character') : null;
    const config = {
      asset: selectedAsset,
      facePosition: face ? face.position.toArray() : [0, 0, 0],
      bodyPosition: character ? character.position.toArray() : [0, 0, 0],
      cameraPosition: camera ? camera.position.toArray() : [0, 0, 0],
      lookAt: controls ? controls.target.toArray() : [0, 0, 0],
    };
    const serialized = JSON.stringify(config, null, 2);
    setConfigLog(serialized);
    console.log('[SaraAvatarLab] Working Sara Config', config);
  };

  const printWorkingFullAlignment = () => {
    const faceCandidate = selectedFaceObjectRef.current?.name
      || selectedFaceCandidateInfo?.name
      || selectedFaceRootName
      || null;
    const hairCandidate = selectedHairObjectRef.current?.name
      || selectedHairCandidateInfo?.name
      || null;
    const payload = {
      faceCandidate,
      facePosition: faceOffset,
      faceScale: faceCandidateScale,
      hairCandidate,
      hairPosition: hairOffset,
      hairScale,
      attachHairToFace,
    };
    const serialized = JSON.stringify(payload, null, 2);
    setConfigLog(serialized);
    console.log('[SaraAvatarLab] Working Full Alignment', payload);
  };

  const printConfig = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const hiddenMeshes = meshInfos.filter((mesh) => {
      const object = loadedSceneRef.current?.getObjectById(mesh.id);
      return object ? !object.visible : false;
    }).map((mesh) => mesh.name);
    const config = {
      selectedAsset,
      selectedAssetLabel,
      globalTransform: transform,
      camera: camera && controls ? {
        position: formatVector(camera.position),
        lookAt: formatVector(controls.target),
        fov: camera.fov,
      } : null,
      perRootOffsets: rootOverrides,
      hiddenMeshNames: hiddenMeshes,
      selectedMaterialMode: materialMode,
      recommendedConfigSnippet: {
        modelUrl: selectedAsset,
        rootTransform: transform,
        rootOverrides,
        camera: camera && controls ? {
          position: camera.position.toArray(),
          lookAt: controls.target.toArray(),
          fov: camera.fov,
        } : null,
      },
    };
    const serialized = JSON.stringify(config, null, 2);
    setConfigLog(serialized);
    console.log('[SaraAvatarLab] Current Config', config);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid h-screen grid-cols-[320px_minmax(0,1fr)_460px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-slate-800 bg-slate-900/80 p-4">
          <h1 className="text-lg font-semibold">Sara Avatar Lab</h1>
          <p className="mt-1 text-xs text-slate-400">{loadingState}</p>

          <label className="mt-4 block text-xs font-medium text-slate-300">
            Asset
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
              value={selectedAsset}
              onChange={(event) => setSelectedAsset(event.target.value)}
            >
              {ASSETS.map((asset) => (
                <option key={asset.url} value={asset.url}>{asset.label}</option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-xs font-medium text-slate-300">
            Material mode
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
              value={materialMode}
              onChange={(event) => setMaterialMode(event.target.value as MaterialMode)}
            >
              <option value="original">Original</option>
              <option value="basic">Force basic material</option>
              <option value="normal">Force normal material</option>
            </select>
          </label>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold">New Sara Test Modes</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded px-2 py-1 text-xs font-medium ${sceneIsolationMode === 'face' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}
                onClick={() => setQuickIsolation('face')}
              >
                Use Face mesh only
              </button>
              <button
                className={`rounded px-2 py-1 text-xs font-medium ${sceneIsolationMode === 'character' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}
                onClick={() => setQuickIsolation('character')}
              >
                Use Character mesh only
              </button>
              <button
                className={`rounded px-2 py-1 text-xs font-medium ${sceneIsolationMode === 'faceCharacter' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}
                onClick={() => setQuickIsolation('faceCharacter')}
              >
                Use Face + Character only
              </button>
              <button
                className={`rounded px-2 py-1 text-xs font-medium ${sceneIsolationMode === 'full' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}
                onClick={() => setQuickIsolation('full')}
              >
                Use Full Scene
              </button>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-400">
              Mode: {sceneIsolationMode}
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold">Debug Toggles</h2>
            {Object.entries(toggles).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
                <span>{key}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => setToggles((current) => ({ ...current, [key]: event.target.checked }))}
                />
              </label>
            ))}
          </section>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold">Camera</h2>
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('full')}>Frame full</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('render')}>Frame render</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('selected')}>Frame selected</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('face')}>Frame Face</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('body')}>Frame body</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('character')}>Frame Character</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('faceCharacter')}>Frame Face + Character</button>
              <button className="rounded bg-slate-700 px-2 py-1 text-xs font-medium" onClick={resetCamera}>Reset camera</button>
              <button className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium" onClick={() => setCameraPreset('front')}>Front View</button>
              <button className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium" onClick={() => setCameraPreset('side')}>Side View</button>
              <button className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium" onClick={() => setCameraPreset('top')}>Top View</button>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold">Face Alignment Test</h2>
            <label className="block text-xs font-medium text-slate-300">
              Face candidate
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                value={selectedFaceCandidateUuid}
                onChange={(event) => {
                  const uuid = event.target.value;
                  const candidate = faceCandidates.find((item) => item.uuid === uuid);
                  setSelectedFaceCandidateUuid(uuid);
                  setSelectedFaceRootName(candidate?.name ?? '');
                }}
                disabled={faceCandidates.length === 0}
              >
                {faceCandidates.length === 0 && <option value="">No candidate found</option>}
                {faceCandidates.map((candidate) => (
                  <option key={candidate.uuid} value={candidate.uuid}>{candidate.label}</option>
                ))}
              </select>
            </label>
            {selectedFaceCandidateInfo?.meshCount === 0 && (
              <div className="rounded border border-amber-400/70 bg-amber-950/40 p-2 text-xs font-medium text-amber-200">
                Selected candidate is a group/root only, not visible mesh.
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
              <span>Show Only Face Candidate</span>
              <input
                type="checkbox"
                checked={toggles.showOnlyFaceCandidate}
                onChange={(event) => setToggles((current) => ({ ...current, showOnlyFaceCandidate: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
              <span>Force Face Material</span>
              <input
                type="checkbox"
                checked={toggles.forceFaceMaterial}
                onChange={(event) => setToggles((current) => ({ ...current, forceFaceMaterial: event.target.checked }))}
              />
            </label>
            <SliderNumberField label="Scale Face Candidate" value={faceCandidateScale} min={0.01} max={500} step={0.01} onChange={setFaceCandidateScale} />
            <SliderNumberField label="Face X Offset" value={faceOffset[0]} min={-2} max={2} step={0.01} onChange={(value) => updateFaceOffset(0, value)} />
            <SliderNumberField label="Face Y Offset" value={faceOffset[1]} min={-1} max={3} step={0.01} onChange={(value) => updateFaceOffset(1, value)} />
            <SliderNumberField label="Face Z Offset" value={faceOffset[2]} min={-2} max={2} step={0.01} onChange={(value) => updateFaceOffset(2, value)} />
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded bg-violet-600 px-2 py-1 text-xs font-medium" onClick={() => adjustFaceZ(0.1)}>Face Forward +0.10</button>
              <button className="rounded bg-violet-600 px-2 py-1 text-xs font-medium" onClick={() => adjustFaceZ(0.25)}>Face Forward +0.25</button>
              <button className="rounded bg-slate-700 px-2 py-1 text-xs font-medium" onClick={() => adjustFaceZ(-0.1)}>Face Back -0.10</button>
              <button className="rounded bg-slate-700 px-2 py-1 text-xs font-medium" onClick={() => adjustFaceZ(-0.25)}>Face Back -0.25</button>
              <button className="rounded bg-slate-600 px-2 py-1 text-xs font-medium" onClick={resetFaceZ}>Reset Face Z</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={autoAlignFaceDepth}>Auto Align Face Depth</button>
              <button className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium" onClick={() => frameTarget('face')}>Auto Frame Selected Face</button>
              <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium" onClick={printFaceCandidateDetails}>Print Face Candidate Details</button>
            </div>
            <button className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-medium" onClick={printWorkingFaceAlignment}>
              Print Working Face Alignment
            </button>
            <button className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-medium" onClick={printWorkingSaraConfig}>
              Print Working Sara Config
            </button>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-400">
              Detected: {selectedFaceCandidateInfo ? selectedFaceCandidateInfo.label : 'none'}
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold">Hair Alignment Test</h2>
            <label className="block text-xs font-medium text-slate-300">
              Hair candidate
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                value={selectedHairCandidateUuid}
                onChange={(event) => setSelectedHairCandidateUuid(event.target.value)}
                disabled={hairCandidates.length === 0}
              >
                {hairCandidates.length === 0 && <option value="">No hair candidate found</option>}
                {hairCandidates.map((candidate) => (
                  <option key={candidate.uuid} value={candidate.uuid}>{candidate.label}</option>
                ))}
              </select>
            </label>
            {selectedHairCandidateInfo?.meshCount === 0 && (
              <div className="rounded border border-amber-400/70 bg-amber-950/40 p-2 text-xs font-medium text-amber-200">
                Selected hair candidate has no render meshes. Choose another candidate.
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
              <span>Show Only Hair Candidate</span>
              <input
                type="checkbox"
                checked={toggles.showOnlyHairCandidate}
                onChange={(event) => setToggles((current) => ({ ...current, showOnlyHairCandidate: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
              <span>Force Hair Material</span>
              <input
                type="checkbox"
                checked={toggles.forceHairMaterial}
                onChange={(event) => setToggles((current) => ({ ...current, forceHairMaterial: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-slate-800 px-2 py-1 text-xs">
              <span>Attach Hair To Face Alignment</span>
              <input
                type="checkbox"
                checked={attachHairToFace}
                onChange={(event) => setAttachHairToFace(event.target.checked)}
              />
            </label>
            <SliderNumberField label="Hair X Offset" value={hairOffset[0]} min={-2} max={2} step={0.01} onChange={(value) => updateHairOffset(0, value)} />
            <SliderNumberField label="Hair Y Offset" value={hairOffset[1]} min={-2} max={2} step={0.01} onChange={(value) => updateHairOffset(1, value)} />
            <SliderNumberField label="Hair Z Offset" value={hairOffset[2]} min={-2} max={2} step={0.01} onChange={(value) => updateHairOffset(2, value)} />
            <SliderNumberField label="Hair Scale" value={hairScale} min={0.01} max={500} step={0.01} onChange={setHairScale} />
            <button className="w-full rounded bg-emerald-600 px-2 py-2 text-xs font-medium" onClick={printWorkingFullAlignment}>
              Print Working Full Alignment
            </button>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-400">
              Detected: {selectedHairCandidateInfo ? selectedHairCandidateInfo.label : 'none'}
            </div>
          </section>
        </aside>

        <main className="relative min-h-0">
          <div ref={mountRef} className="h-full w-full" />
          <div className="pointer-events-none absolute left-4 top-4 rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
            <div>{selectedAssetLabel}</div>
            <div>{meshInfos.length} meshes</div>
            {selectedMesh && <div>Selected: {selectedMesh.name}</div>}
          </div>
        </main>

        <aside className="overflow-y-auto border-l border-slate-800 bg-slate-900 p-4">
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Bounds Diagnostics</h2>
              <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium" onClick={printConfig}>Print Current Config</button>
            </div>
            <div className="mt-2 space-y-2">
              {bounds.map((item) => (
                <div key={item.label} className="rounded border border-slate-800 p-2 text-xs">
                  <div className="font-medium text-cyan-200">{item.label}</div>
                  <div>Center: {item.center}</div>
                  <div>Size: {item.size}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-sm font-semibold">Scene Roots</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {sceneRoots.map((root) => <li key={root} className="rounded border border-slate-800 px-2 py-1">{root}</li>)}
            </ul>
          </section>

          <section className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Mesh Hierarchy</h2>
              <select
                className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                <option value="largestX">Largest X size</option>
                <option value="largestY">Largest Y size</option>
                <option value="largestZ">Largest Z size</option>
                <option value="distance">Distance from origin</option>
                <option value="scale">Suspicious scale</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="mt-2 space-y-2">
              {sortedMeshes.map((mesh) => (
                <button
                  key={mesh.id}
                  className={`block w-full rounded border p-2 text-left text-xs ${mesh.id === selectedMeshId ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-800 bg-slate-950/40'}`}
                  onClick={() => setSelectedMeshId(mesh.id)}
                >
                  <div className="font-semibold text-slate-100">{mesh.name}</div>
                  <div className="text-slate-400">Parent: {mesh.parent}</div>
                  <div>Type: {mesh.type} | Mesh: {String(mesh.isMesh)} | Skinned: {String(mesh.isSkinnedMesh)}</div>
                  <div>Vertices: {mesh.vertexCount} | Bones: {mesh.boneCount}</div>
                  <div>Material: {mesh.materialName} ({mesh.materialType})</div>
                  <div>Local pos/rot/scale: {mesh.localPosition} / {mesh.localRotation} / {mesh.localScale}</div>
                  <div>World pos/scale: {mesh.worldPosition} / {mesh.worldScale}</div>
                  <div>Bounds center/size: {mesh.worldCenter} / {mesh.worldSize}</div>
                  <div>Morphs: {mesh.morphTargets.length ? mesh.morphTargets.join(', ') : 'none'}</div>
                  {mesh.flags.length > 0 && <div className="mt-1 font-medium text-amber-300">Flags: {mesh.flags.join(', ')}</div>}
                </button>
              ))}
            </div>
          </section>

          {configLog && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">Current Config Log</h2>
              <pre className="mt-2 max-h-96 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">{configLog}</pre>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[1fr_92px] items-center gap-2 text-xs text-slate-300">
      <span>{label}</span>
      <input
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SliderNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded border border-slate-800 p-2 text-xs text-slate-300">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right"
          type="number"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
