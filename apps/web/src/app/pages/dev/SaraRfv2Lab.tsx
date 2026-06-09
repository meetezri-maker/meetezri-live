import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  SARA_RFV2_MODEL,
  SARA_RFV2_PHONEME_TO_VISEME,
} from '../../../lib/avatar/saraRfv2Config';
import { SARA_RFV2_FLAGS } from '../../../lib/avatar/saraRfv2FeatureFlags';
import {
  computeSaraRfv2VisemeTargets,
  createSaraRfv2PhonemeState,
  resolveSaraRfv2ActivePhoneme,
  type SaraRfv2PhonemeTimelineItem,
} from '../../../lib/avatar/saraRfv2PhonemeDriver';
import { createSaraRfv2BlinkState } from '../../../lib/avatar/saraRfv2BlinkSystem';
import { createSaraRfv2ExpressionState } from '../../../lib/avatar/saraRfv2ExpressionLayer';
import { createSaraRfv2RuntimeState, validateSaraRfv2RuntimeAdapter } from '../../../lib/avatar/saraRfv2RuntimeAdapter';
import {
  collectSaraRfv2Diagnostics,
  computeSaraRfv2Readiness,
} from '../../../lib/avatar/saraRfv2Diagnostics';
import {
  SARA_RFV2_FORBIDDEN_MORPHS,
  SARA_RFV2_TARGET_MAP,
  getSaraRfv2MappedTarget,
  validateSaraRfv2TargetMap,
} from '../../../lib/avatar/saraRfv2TargetMap';
import {
  createSaraRfv2SmoothingState,
  smoothSaraRfv2Targets,
  validateSaraRfv2SmoothingLayer,
} from '../../../lib/avatar/saraRfv2SmoothingLayer';
import { SARA_V2_AVATAR_DEFINITION } from '../../../lib/avatar/configs/saraV2Config';
import { prepareSaraV2AlignedScene } from '../../../lib/avatar/saraV2Alignment';
import {
  applySaraRfv2MorphTargets,
  bindSaraRfv2FaceMorphTargets,
  createSaraRfv2MorphApplierState,
  resetSaraRfv2OwnedMorphs,
  type SaraRfv2FaceMorphBinding,
  type SaraRfv2MorphCapableMeshAudit,
  type SaraRfv2MorphApplierState,
  type SaraRfv2PostWriteInfluence,
  type SaraRfv2RejectedMorphMesh,
} from '../../../lib/avatar/saraRfv2MorphApplier';

type ExpressionPreset =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'sad'
  | 'neutral';

type SampleTimeline = {
  id: string;
  label: string;
  duration: number;
  timeline: SaraRfv2PhonemeTimelineItem[];
};

type MeshSummary = {
  name: string;
  type: string;
  parent: string;
  morphTargets: string[];
  isSkinnedMesh: boolean;
};

type FrameMode = 'face' | 'upper-body' | 'free';

type BoundsSummary = {
  center: number[];
  size: number[];
  valid: boolean;
};

type AlignmentLabDiagnostics = {
  faceCandidateUsed: string | null;
  hairCandidateUsed: string | null;
  bodyCandidateUsed: string | null;
  faceAligned: boolean;
  hairAligned: boolean;
  bodySkeletonPreserved: boolean;
  currentFrameMode: FrameMode;
  cameraPosition: number[];
  cameraLookAt: number[];
  faceBounds: BoundsSummary | null;
  bodyBounds: BoundsSummary | null;
  hairBounds: BoundsSummary | null;
  alignmentWarnings: string[];
};

type MorphPreviewDiagnostics = {
  buttonClickedCount: number;
  forceAaStatusMessage: string;
  faceMeshFound: boolean;
  faceMeshName: string | null;
  faceMeshParentPath: string | null;
  faceMorphCount: number;
  faceMorphNames: readonly string[];
  lastAppliedMorphs: Readonly<Record<string, number>>;
  lastApplyReason: string;
  previewApplyCount: number;
  missingMappedMorphs: readonly string[];
  forbiddenMorphBlockedCount: number;
  allMorphCapableMeshes: readonly SaraRfv2MorphCapableMeshAudit[];
  boundFaceMeshes: readonly { name: string; uuid: string }[];
  rejectedMorphMeshes: readonly SaraRfv2RejectedMorphMesh[];
  currentRenderedRootName: string | null;
  currentRenderedRootUuid: string | null;
  lastRawWrite: Readonly<Record<string, number>>;
  lastWrittenMorph: string | null;
  lastWrittenValue: number | null;
  postWriteReadbackValue: number | null;
  postWriteInfluences: readonly SaraRfv2PostWriteInfluence[];
  writeSucceeded: boolean;
  writtenButNoVisualChangeSuspected: boolean;
  resetAfterApplyDetected: boolean;
  applierBound: boolean;
  applierBindingReason: string;
};

declare global {
  interface Window {
    saraRfv2LabDiagnostics?: Record<string, unknown>;
  }
}

const labFlags = {
  runtime: true,
  phonemeDriver: true,
  blinkSystem: true,
  listeningExpressions: true,
  speakingExpressions: true,
  emotionLayer: true,
} as const;

const SAMPLE_TIMELINES: SampleTimeline[] = [
  {
    id: 'warm-greeting',
    label: 'Warm greeting',
    duration: 1.8,
    timeline: [
      { phoneme: 'HH', start: 0, end: 0.12 },
      { phoneme: 'EH', start: 0.12, end: 0.28 },
      { phoneme: 'L', start: 0.28, end: 0.4 },
      { phoneme: 'OW', start: 0.4, end: 0.68 },
      { phoneme: 'S', start: 0.88, end: 1.02 },
      { phoneme: 'AA', start: 1.02, end: 1.28 },
      { phoneme: 'R', start: 1.28, end: 1.42 },
      { phoneme: 'AH', start: 1.42, end: 1.72 },
    ],
  },
  {
    id: 'viseme-sweep',
    label: 'Viseme sweep',
    duration: 2.4,
    timeline: [
      { phoneme: 'AA', start: 0, end: 0.28 },
      { phoneme: 'IH', start: 0.34, end: 0.62 },
      { phoneme: 'EH', start: 0.68, end: 0.96 },
      { phoneme: 'OW', start: 1.02, end: 1.3 },
      { phoneme: 'P', start: 1.36, end: 1.64 },
      { phoneme: 'CH', start: 1.7, end: 1.98 },
      { phoneme: 'S', start: 2.04, end: 2.32 },
    ],
  },
  {
    id: 'soft-response',
    label: 'Soft response',
    duration: 2.1,
    timeline: [
      { phoneme: 'M', start: 0.05, end: 0.22 },
      { phoneme: 'AE', start: 0.22, end: 0.48 },
      { phoneme: 'B', start: 0.48, end: 0.62 },
      { phoneme: 'IY', start: 0.62, end: 0.9 },
      { phoneme: 'SH', start: 1.08, end: 1.32 },
      { phoneme: 'UW', start: 1.32, end: 1.66 },
      { phoneme: 'AH', start: 1.66, end: 1.98 },
    ],
  },
];

const panelStyle: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: 8,
  background: 'rgba(15, 23, 42, 0.78)',
  padding: 16,
};

const FACE_FRAME = {
  fov: 16,
  position: [0, 1.75, 3.8] as const,
  lookAt: [0, 1.55, 0] as const,
};

const UPPER_BODY_FRAME = {
  fov: 20,
  position: [0, 1.55, 5.0] as const,
  lookAt: [0, 1.25, 0] as const,
};

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

function isSkinnedMesh(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return (object as THREE.SkinnedMesh).isSkinnedMesh === true;
}

function getMorphTargetNames(mesh: THREE.Mesh): string[] {
  const dictionary = mesh.morphTargetDictionary;
  if (!dictionary) return [];
  return Object.keys(dictionary).sort((a, b) => dictionary[a] - dictionary[b]);
}

function collectMeshSummaries(root: THREE.Object3D): MeshSummary[] {
  const summaries: MeshSummary[] = [];
  root.traverse((object) => {
    if (!isMesh(object)) return;
    summaries.push({
      name: object.name || `(mesh ${object.id})`,
      type: object.type,
      parent: object.parent?.name || object.parent?.type || 'none',
      morphTargets: getMorphTargetNames(object),
      isSkinnedMesh: isSkinnedMesh(object),
    });
  });
  return summaries;
}

function safeBoxFromObject(object: THREE.Object3D | null): THREE.Box3 | null {
  if (!object) return null;
  const box = new THREE.Box3();
  try {
    box.setFromObject(object);
  } catch {
    box.makeEmpty();
  }
  if (box.isEmpty()) return null;
  return box;
}

function summarizeBounds(object: THREE.Object3D | null): BoundsSummary | null {
  const box = safeBoxFromObject(object);
  if (!box) return null;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    center: center.toArray(),
    size: size.toArray(),
    valid: true,
  };
}

function findNamedObject(root: THREE.Object3D, names: readonly string[]): THREE.Object3D | null {
  for (const name of names) {
    const found = root.getObjectByName(name);
    if (found) return found;
  }
  return null;
}

function isDescendantOf(object: THREE.Object3D | null, ancestor: THREE.Object3D | null): boolean {
  let current = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function applyFrame(
  camera: THREE.PerspectiveCamera | null,
  controls: OrbitControls | null,
  frame: typeof FACE_FRAME | typeof UPPER_BODY_FRAME,
): void {
  if (!camera || !controls) return;
  camera.fov = frame.fov;
  camera.position.set(frame.position[0], frame.position[1], frame.position[2]);
  controls.target.set(frame.lookAt[0], frame.lookAt[1], frame.lookAt[2]);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}

function createBoxHelper(name: string, color: number): THREE.Box3Helper {
  const helper = new THREE.Box3Helper(new THREE.Box3(), color);
  helper.name = name;
  helper.visible = false;
  return helper;
}

function findFaceMesh(root: THREE.Object3D): THREE.Mesh | null {
  let faceMesh: THREE.Mesh | null = null;
  root.traverse((object) => {
    if (faceMesh || !isMesh(object)) return;
    if (object.name === 'Face') faceMesh = object;
  });
  return faceMesh;
}

function resetFaceMorphs(faceMesh: THREE.Mesh | null): void {
  if (!faceMesh?.morphTargetInfluences) return;
  faceMesh.morphTargetInfluences.fill(0);
}

function getObjectPath(object: THREE.Object3D | null): string | null {
  if (!object) return null;
  const parts: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    parts.unshift(current.name || current.type);
    current = current.parent;
  }
  return parts.join(' > ');
}

function createAllowedFaceMorphSet(): Set<string> {
  const allowed = new Set<string>();
  Object.values(SARA_RFV2_TARGET_MAP).forEach((group) => {
    Object.values(group).forEach((target) => {
      if (target.meshName === 'Face') allowed.add(target.morphName);
    });
  });
  SARA_RFV2_FORBIDDEN_MORPHS.forEach(({ morphName }) => allowed.delete(morphName));
  return allowed;
}

function addMappedTarget(
  targets: Record<string, number>,
  semanticTarget: string,
  value: number,
): void {
  const mapped = getSaraRfv2MappedTarget(semanticTarget);
  if (mapped.missing || mapped.meshName !== 'Face') return;
  targets[mapped.morphName] = Math.max(targets[mapped.morphName] ?? 0, value);
}

function summarizeBoundFaceMeshes(
  bindings: readonly SaraRfv2FaceMorphBinding[],
): { name: string; uuid: string }[] {
  return bindings.map((binding) => ({
    name: binding.meshName,
    uuid: binding.meshUuid,
  }));
}

function writeRawAaToRoots(args: {
  roots: readonly { root: THREE.Object3D | null; source: string }[];
  visibleOnly: boolean;
}): {
  rawWrite: Record<string, number>;
  postWriteInfluences: SaraRfv2PostWriteInfluence[];
  missingMorphs: string[];
  touchedMeshNames: string[];
} {
  const rawWrite = {
    viseme_AA: 1,
    jawOpen: 0.12,
  };
  const postWriteInfluences: SaraRfv2PostWriteInfluence[] = [];
  const touchedMeshNames = new Set<string>();
  const seen = new Set<string>();

  args.roots.forEach(({ root, source }) => {
    if (!root) return;
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!isMesh(object)) return;
      if (args.visibleOnly && !object.visible) return;
      const dictionary = object.morphTargetDictionary;
      const influences = object.morphTargetInfluences;
      if (!dictionary || !influences) return;
      const aaIndex = dictionary.viseme_AA;
      if (typeof aaIndex !== 'number') return;
      const meshLabel = `${source}:${object.name || object.type}:${object.uuid}`;
      if (seen.has(meshLabel)) return;
      seen.add(meshLabel);
      influences[aaIndex] = rawWrite.viseme_AA;
      postWriteInfluences.push({
        meshUuid: object.uuid,
        meshName: `${source}:${object.name || object.type}`,
        morphName: 'viseme_AA',
        index: aaIndex,
        valueWritten: rawWrite.viseme_AA,
        actualInfluence: influences[aaIndex] ?? 0,
      });
      touchedMeshNames.add(object.name || object.type);

      const jawIndex = dictionary.jawOpen;
      if (typeof jawIndex === 'number') {
        influences[jawIndex] = rawWrite.jawOpen;
        postWriteInfluences.push({
          meshUuid: object.uuid,
          meshName: `${source}:${object.name || object.type}`,
          morphName: 'jawOpen',
          index: jawIndex,
          valueWritten: rawWrite.jawOpen,
          actualInfluence: influences[jawIndex] ?? 0,
        });
      }
    });
  });

  return {
    rawWrite,
    postWriteInfluences,
    missingMorphs: postWriteInfluences.some((influence) => influence.morphName === 'viseme_AA')
      ? []
      : ['viseme_AA'],
    touchedMeshNames: Array.from(touchedMeshNames).sort(),
  };
}

function resetRawAaOnRoots(roots: readonly (THREE.Object3D | null)[]): void {
  roots.forEach((root) => {
    if (!root) return;
    root.traverse((object) => {
      if (!isMesh(object)) return;
      const dictionary = object.morphTargetDictionary;
      const influences = object.morphTargetInfluences;
      if (!dictionary || !influences) return;
      ['viseme_AA', 'jawOpen'].forEach((morphName) => {
        const index = dictionary[morphName];
        if (typeof index === 'number') influences[index] = 0;
      });
    });
  });
}

function createDirectTestTargets(kind: 'aa' | 'o' | 'pp' | 'blink' | 'smile' | 'sad'): Record<string, number> {
  const targets: Record<string, number> = {};
  if (kind === 'aa') {
    addMappedTarget(targets, 'visemes.aa', 0.6);
    addMappedTarget(targets, 'mouth.jawOpen', 0.08);
  } else if (kind === 'o') {
    addMappedTarget(targets, 'visemes.o', 0.5);
    addMappedTarget(targets, 'mouth.jawOpen', 0.05);
  } else if (kind === 'pp') {
    addMappedTarget(targets, 'visemes.pp', 0.7);
    addMappedTarget(targets, 'mouth.jawOpen', 0);
  } else if (kind === 'blink') {
    addMappedTarget(targets, 'eyes.blinkLeft', 1);
    addMappedTarget(targets, 'eyes.blinkRight', 1);
  } else if (kind === 'smile') {
    addMappedTarget(targets, 'expressions.smileLeft', 0.35);
    addMappedTarget(targets, 'expressions.smileRight', 0.35);
    addMappedTarget(targets, 'expressions.smile', 0.25);
  } else if (kind === 'sad') {
    addMappedTarget(targets, 'expressions.sad', 0.25);
    addMappedTarget(targets, 'expressions.frownLeft', 0.18);
    addMappedTarget(targets, 'expressions.frownRight', 0.18);
  }
  return targets;
}

function getExpressionTargets(preset: ExpressionPreset): Record<string, number> {
  const targets: Record<string, number> = {};

  if (preset === 'neutral') return targets;
  if (preset === 'idle') {
    addMappedTarget(targets, 'expressions.smile', 0.02);
    addMappedTarget(targets, 'expressions.cheekSquintLeft', 0.01);
    addMappedTarget(targets, 'expressions.cheekSquintRight', 0.01);
    return targets;
  }
  if (preset === 'listening') {
    addMappedTarget(targets, 'expressions.smile', 0.05);
    addMappedTarget(targets, 'expressions.cheekSquintLeft', 0.025);
    addMappedTarget(targets, 'expressions.cheekSquintRight', 0.025);
    addMappedTarget(targets, 'expressions.brows', 0.025);
    return targets;
  }
  if (preset === 'thinking') {
    addMappedTarget(targets, 'expressions.smile', 0.012);
    addMappedTarget(targets, 'expressions.brows', 0.035);
    addMappedTarget(targets, 'eyes.lookDownLeft', 0.025);
    addMappedTarget(targets, 'eyes.lookDownRight', 0.025);
    return targets;
  }
  if (preset === 'speaking') {
    addMappedTarget(targets, 'expressions.smile', 0.03);
    addMappedTarget(targets, 'expressions.cheekSquintLeft', 0.015);
    addMappedTarget(targets, 'expressions.cheekSquintRight', 0.015);
    return targets;
  }
  if (preset === 'happy') {
    addMappedTarget(targets, 'expressions.smile', 0.075);
    addMappedTarget(targets, 'expressions.smileLeft', 0.06);
    addMappedTarget(targets, 'expressions.smileRight', 0.06);
    addMappedTarget(targets, 'expressions.cheekSquintLeft', 0.045);
    addMappedTarget(targets, 'expressions.cheekSquintRight', 0.045);
    return targets;
  }
  if (preset === 'sad') {
    addMappedTarget(targets, 'expressions.sad', 0.07);
    addMappedTarget(targets, 'expressions.frownLeft', 0.04);
    addMappedTarget(targets, 'expressions.frownRight', 0.04);
  }

  return targets;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function SaraRfv2Lab() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const avatarRootRef = useRef<THREE.Group | null>(null);
  const loadedSceneRef = useRef<THREE.Object3D | null>(null);
  const faceMeshRef = useRef<THREE.Mesh | null>(null);
  const faceObjectRef = useRef<THREE.Object3D | null>(null);
  const hairObjectRef = useRef<THREE.Object3D | null>(null);
  const bodyObjectRef = useRef<THREE.Object3D | null>(null);
  const morphBindingsRef = useRef<readonly SaraRfv2FaceMorphBinding[]>([]);
  const morphApplierStateRef = useRef<SaraRfv2MorphApplierState>(createSaraRfv2MorphApplierState());
  const faceBoundsHelperRef = useRef<THREE.Box3Helper | null>(null);
  const bodyBoundsHelperRef = useRef<THREE.Box3Helper | null>(null);
  const hairBoundsHelperRef = useRef<THREE.Box3Helper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const frameRef = useRef<number | null>(null);

  const [loadingState, setLoadingState] = useState('Idle');
  const [meshSummaries, setMeshSummaries] = useState<MeshSummary[]>([]);
  const [alignmentDiagnostics, setAlignmentDiagnostics] = useState<AlignmentLabDiagnostics>({
    faceCandidateUsed: null,
    hairCandidateUsed: null,
    bodyCandidateUsed: null,
    faceAligned: false,
    hairAligned: false,
    bodySkeletonPreserved: false,
    currentFrameMode: 'face',
    cameraPosition: FACE_FRAME.position.slice(),
    cameraLookAt: FACE_FRAME.lookAt.slice(),
    faceBounds: null,
    bodyBounds: null,
    hairBounds: null,
    alignmentWarnings: [],
  });
  const [debugToggles, setDebugToggles] = useState({
    showFaceBounds: false,
    showBodyBounds: false,
    showHairBounds: false,
    showAxes: false,
  });
  const [morphPreviewDiagnostics, setMorphPreviewDiagnostics] = useState<MorphPreviewDiagnostics>({
    buttonClickedCount: 0,
    forceAaStatusMessage: 'Force AA has not been clicked.',
    faceMeshFound: false,
    faceMeshName: null,
    faceMeshParentPath: null,
    faceMorphCount: 0,
    faceMorphNames: [],
    lastAppliedMorphs: {},
    lastApplyReason: 'No morph preview applied yet.',
    previewApplyCount: 0,
    missingMappedMorphs: [],
    forbiddenMorphBlockedCount: 0,
    allMorphCapableMeshes: [],
    boundFaceMeshes: [],
    rejectedMorphMeshes: [],
    currentRenderedRootName: null,
    currentRenderedRootUuid: null,
    lastRawWrite: {},
    lastWrittenMorph: null,
    lastWrittenValue: null,
    postWriteReadbackValue: null,
    postWriteInfluences: [],
    writeSucceeded: false,
    writtenButNoVisualChangeSuspected: false,
    resetAfterApplyDetected: false,
    applierBound: false,
    applierBindingReason: 'Sara RFv2 Morph Applier has not bound a rendered Face mesh.',
  });
  const [manualPreviewTargets, setManualPreviewTargets] = useState<Record<string, number>>({});
  const [speaking, setSpeaking] = useState(false);
  const [sampleTimelineId, setSampleTimelineId] = useState(SAMPLE_TIMELINES[0].id);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [expressionPreset, setExpressionPreset] = useState<ExpressionPreset>('idle');
  const [blinkPulse, setBlinkPulse] = useState(0);
  const [visualPreviewEnabled, setVisualPreviewEnabled] = useState(false);
  const [smoothingState, setSmoothingState] = useState(createSaraRfv2SmoothingState);

  const updateFrameDiagnostics = useCallback((mode: FrameMode) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    setAlignmentDiagnostics((current) => ({
      ...current,
      currentFrameMode: mode,
      cameraPosition: camera ? camera.position.toArray() : current.cameraPosition,
      cameraLookAt: controls ? controls.target.toArray() : current.cameraLookAt,
    }));
  }, []);

  const frameFace = useCallback(() => {
    applyFrame(cameraRef.current, controlsRef.current, FACE_FRAME);
    updateFrameDiagnostics('face');
  }, [updateFrameDiagnostics]);

  const frameUpperBody = useCallback(() => {
    applyFrame(cameraRef.current, controlsRef.current, UPPER_BODY_FRAME);
    updateFrameDiagnostics('upper-body');
  }, [updateFrameDiagnostics]);

  const selectedSample = useMemo(
    () => SAMPLE_TIMELINES.find((sample) => sample.id === sampleTimelineId) ?? SAMPLE_TIMELINES[0],
    [sampleTimelineId],
  );
  const readiness = useMemo(() => computeSaraRfv2Readiness(), []);
  const targetMapValidation = useMemo(() => validateSaraRfv2TargetMap(), []);
  const smoothingValidation = useMemo(() => validateSaraRfv2SmoothingLayer(), []);
  const runtimeValidation = useMemo(() => validateSaraRfv2RuntimeAdapter(), []);

  const activePhoneme = useMemo(
    () =>
      resolveSaraRfv2ActivePhoneme({
        timeline: selectedSample.timeline,
        audioCurrentTime,
      }),
    [audioCurrentTime, selectedSample],
  );

  const rawTargets = useMemo(() => {
    const phonemeTargets = computeSaraRfv2VisemeTargets({
      activeViseme: activePhoneme.activeViseme,
      speaking,
      intensity: 1,
    }).targets;
    const targets: Record<string, number> = {
      ...getExpressionTargets(expressionPreset),
      ...phonemeTargets,
    };

    if (blinkPulse > 0) {
      addMappedTarget(targets, 'eyes.blinkLeft', blinkPulse);
      addMappedTarget(targets, 'eyes.blinkRight', blinkPulse);
    }

    return targets;
  }, [activePhoneme.activeViseme, blinkPulse, expressionPreset, speaking]);

  const smoothingPreview = useMemo(
    () =>
      smoothSaraRfv2Targets({
        state: smoothingState,
        rawTargets,
        nowMs: Date.now(),
      }),
    [rawTargets, smoothingState],
  );

  const mappedTargets = useMemo(
    () =>
      Object.entries(rawTargets).map(([morphName, value]) => ({
        meshName: 'Face',
        morphName,
        value,
        visualPreviewAllowed: createAllowedFaceMorphSet().has(morphName),
      })),
    [rawTargets],
  );

  const diagnostics = useMemo(() => {
    const report = collectSaraRfv2Diagnostics({
      runtimeState: createSaraRfv2RuntimeState(),
      phonemeState: createSaraRfv2PhonemeState(),
      blinkState: createSaraRfv2BlinkState(),
      expressionState: createSaraRfv2ExpressionState(),
      smoothingState,
    });

    return {
      readiness,
      flags: SARA_RFV2_FLAGS,
      labFlags,
      productionFlagsModified: false,
      currentSimulatedInput: {
        speaking,
        audioCurrentTime,
        sampleTimelineId,
        expressionPreset,
        visualPreviewEnabled,
      },
      faceCandidateUsed: alignmentDiagnostics.faceCandidateUsed,
      hairCandidateUsed: alignmentDiagnostics.hairCandidateUsed,
      bodyCandidateUsed: alignmentDiagnostics.bodyCandidateUsed,
      faceAligned: alignmentDiagnostics.faceAligned,
      hairAligned: alignmentDiagnostics.hairAligned,
      bodySkeletonPreserved: alignmentDiagnostics.bodySkeletonPreserved,
      currentFrameMode: alignmentDiagnostics.currentFrameMode,
      cameraPosition: alignmentDiagnostics.cameraPosition,
      cameraLookAt: alignmentDiagnostics.cameraLookAt,
      faceBounds: alignmentDiagnostics.faceBounds,
      bodyBounds: alignmentDiagnostics.bodyBounds,
      hairBounds: alignmentDiagnostics.hairBounds,
      buttonClickedCount: morphPreviewDiagnostics.buttonClickedCount,
      forceAaStatusMessage: morphPreviewDiagnostics.forceAaStatusMessage,
      visualPreviewEnabled,
      faceMeshFound: morphPreviewDiagnostics.faceMeshFound,
      faceMeshName: morphPreviewDiagnostics.faceMeshName,
      faceMorphCount: morphPreviewDiagnostics.faceMorphCount,
      faceMorphNames: morphPreviewDiagnostics.faceMorphNames,
      lastAppliedMorphs: morphPreviewDiagnostics.lastAppliedMorphs,
      lastApplyReason: morphPreviewDiagnostics.lastApplyReason,
      previewApplyCount: morphPreviewDiagnostics.previewApplyCount,
      missingMappedMorphs: morphPreviewDiagnostics.missingMappedMorphs,
      forbiddenMorphBlockedCount: morphPreviewDiagnostics.forbiddenMorphBlockedCount,
      allMorphCapableMeshes: morphPreviewDiagnostics.allMorphCapableMeshes,
      boundFaceMeshes: morphPreviewDiagnostics.boundFaceMeshes,
      rejectedMorphMeshes: morphPreviewDiagnostics.rejectedMorphMeshes,
      currentRenderedRootName: morphPreviewDiagnostics.currentRenderedRootName,
      currentRenderedRootUuid: morphPreviewDiagnostics.currentRenderedRootUuid,
      lastRawWrite: morphPreviewDiagnostics.lastRawWrite,
      lastWrittenMorph: morphPreviewDiagnostics.lastWrittenMorph,
      lastWrittenValue: morphPreviewDiagnostics.lastWrittenValue,
      postWriteReadbackValue: morphPreviewDiagnostics.postWriteReadbackValue,
      postWriteInfluences: morphPreviewDiagnostics.postWriteInfluences,
      resetAfterApplyDetected: morphPreviewDiagnostics.resetAfterApplyDetected,
      applierBound: morphPreviewDiagnostics.applierBound,
      applierBindingReason: morphPreviewDiagnostics.applierBindingReason,
      activePhoneme: activePhoneme.activePhoneme,
      activeViseme: activePhoneme.activeViseme,
      phonemeFallback: SARA_RFV2_PHONEME_TO_VISEME.S,
      rawTargets,
      smoothedTargets: smoothingPreview.smoothedTargets,
      mappedTargets,
      warnings: [
        ...alignmentDiagnostics.alignmentWarnings,
        ...report.warnings,
        ...targetMapValidation.warnings,
        ...smoothingValidation.warnings,
        ...runtimeValidation.warnings,
      ],
      report,
    };
  }, [
    activePhoneme.activePhoneme,
    activePhoneme.activeViseme,
    alignmentDiagnostics,
    audioCurrentTime,
    expressionPreset,
    mappedTargets,
    morphPreviewDiagnostics,
    rawTargets,
    readiness,
    runtimeValidation.warnings,
    sampleTimelineId,
    smoothingPreview.smoothedTargets,
    smoothingState,
    smoothingValidation.warnings,
    speaking,
    targetMapValidation.warnings,
    visualPreviewEnabled,
  ]);

  const scheduleResetAfterApplyCheck = useCallback((postWriteInfluences: readonly SaraRfv2PostWriteInfluence[]) => {
    const nonZeroWrites = postWriteInfluences.filter((influence) => influence.valueWritten > 0.0001);
    if (nonZeroWrites.length === 0) return;

    window.requestAnimationFrame(() => {
      const resetDetected = nonZeroWrites.some((influence) => {
        const binding = morphBindingsRef.current.find((candidate) => candidate.meshUuid === influence.meshUuid);
        const actualInfluence = binding?.morphTargetInfluences[influence.index] ?? 0;
        return actualInfluence <= 0.0001;
      });
      if (!resetDetected) return;
      setMorphPreviewDiagnostics((current) => ({
        ...current,
        resetAfterApplyDetected: true,
        forceAaStatusMessage: 'Write overwritten/reset after apply',
        postWriteReadbackValue: 0,
        lastApplyReason: `${current.lastApplyReason} One-frame reset after apply was detected.`,
      }));
    });
  }, []);

  const applyVisualPreview = useCallback(() => {
    const bindings = morphBindingsRef.current;
    const resetDiagnostics = resetSaraRfv2OwnedMorphs({
      bindings,
      immediate: true,
    });
    if (!visualPreviewEnabled || bindings.length === 0) {
      setMorphPreviewDiagnostics((current) => ({
        ...current,
        lastAppliedMorphs: {},
        lastApplyReason: visualPreviewEnabled
        ? 'Preview enabled, but no RFv2 Face morph bindings are available.'
          : 'Visual morph preview is disabled.',
        missingMappedMorphs: resetDiagnostics.missingMorphs,
        forbiddenMorphBlockedCount: resetDiagnostics.blockedMorphs.length,
        postWriteInfluences: resetDiagnostics.postWriteInfluences,
        writeSucceeded: resetDiagnostics.writeSucceeded,
        writtenButNoVisualChangeSuspected: resetDiagnostics.writtenButNoVisualChangeSuspected,
      }));
      return;
    }

    const applyResult = applySaraRfv2MorphTargets({
      state: morphApplierStateRef.current,
      bindings,
      targets: { ...rawTargets, ...manualPreviewTargets },
      nowMs: Date.now(),
      resetUnspecifiedOwnedMorphs: true,
    });
    morphApplierStateRef.current = applyResult.state;
    setMorphPreviewDiagnostics((current) => ({
      ...current,
      lastAppliedMorphs: applyResult.diagnostics.appliedMorphs,
      lastApplyReason: manualPreviewTargets && Object.keys(manualPreviewTargets).length > 0
        ? 'Applied direct manual test morphs through Sara RFv2 Morph Applier.'
        : 'Applied timeline/expression preview morphs through Sara RFv2 Morph Applier.',
      previewApplyCount: current.previewApplyCount + 1,
      missingMappedMorphs: applyResult.diagnostics.missingMorphs,
      forbiddenMorphBlockedCount: applyResult.diagnostics.blockedMorphs.length,
      postWriteInfluences: applyResult.diagnostics.postWriteInfluences,
      writeSucceeded: applyResult.diagnostics.writeSucceeded,
      writtenButNoVisualChangeSuspected: applyResult.diagnostics.writtenButNoVisualChangeSuspected,
      resetAfterApplyDetected: false,
    }));
    scheduleResetAfterApplyCheck(applyResult.diagnostics.postWriteInfluences);
  }, [manualPreviewTargets, rawTargets, scheduleResetAfterApplyCheck, visualPreviewEnabled]);

  const resetAllMorphs = useCallback(() => {
    const diagnostics = resetSaraRfv2OwnedMorphs({
      bindings: morphBindingsRef.current,
      immediate: true,
    });
    resetRawAaOnRoots([avatarRootRef.current, loadedSceneRef.current]);
    setBlinkPulse(0);
    setManualPreviewTargets({});
    setSmoothingState(createSaraRfv2SmoothingState());
    setMorphPreviewDiagnostics((current) => ({
      ...current,
      lastAppliedMorphs: {},
      lastApplyReason: 'Reset All Morphs set every Face morph influence to 0.',
      forceAaStatusMessage: 'Reset All Morphs cleared raw AA debug writes.',
      previewApplyCount: current.previewApplyCount + 1,
      missingMappedMorphs: diagnostics.missingMorphs,
      forbiddenMorphBlockedCount: diagnostics.blockedMorphs.length,
      lastRawWrite: {},
      lastWrittenMorph: null,
      lastWrittenValue: null,
      postWriteReadbackValue: null,
      postWriteInfluences: diagnostics.postWriteInfluences,
      writeSucceeded: diagnostics.writeSucceeded,
      writtenButNoVisualChangeSuspected: diagnostics.writtenButNoVisualChangeSuspected,
      resetAfterApplyDetected: false,
    }));
  }, []);

  const forceRawFaceAA = useCallback(() => {
    const result = writeRawAaToRoots({
      roots: [{ root: avatarRootRef.current, source: 'rendered-root' }],
      visibleOnly: true,
    });
    const aaWrite = result.postWriteInfluences.find((influence) => influence.morphName === 'viseme_AA');
    const writeSucceeded = result.postWriteInfluences.some(
      (influence) => Math.abs(influence.actualInfluence - influence.valueWritten) <= 0.0001,
    );
    const statusMessage = result.postWriteInfluences.length === 0
      ? 'No visible mesh with viseme_AA found'
      : aaWrite && aaWrite.actualInfluence <= 0.0001
        ? 'Write overwritten/reset after apply'
        : 'Force AA clicked';

    setBlinkPulse(0);
    setManualPreviewTargets({});
    setMorphPreviewDiagnostics((current) => ({
      ...current,
      lastAppliedMorphs: result.rawWrite,
      forceAaStatusMessage: statusMessage,
      lastApplyReason: result.postWriteInfluences.length > 0
        ? 'Force Raw Face AA wrote directly to visible rendered-root meshes with viseme_AA.'
        : 'Force Raw Face AA found no visible rendered-root mesh with viseme_AA.',
      buttonClickedCount: current.buttonClickedCount + 1,
      previewApplyCount: current.previewApplyCount + 1,
      missingMappedMorphs: result.missingMorphs,
      forbiddenMorphBlockedCount: 0,
      lastRawWrite: result.rawWrite,
      lastWrittenMorph: aaWrite?.morphName ?? null,
      lastWrittenValue: aaWrite?.valueWritten ?? null,
      postWriteReadbackValue: aaWrite?.actualInfluence ?? null,
      postWriteInfluences: result.postWriteInfluences,
      writeSucceeded,
      writtenButNoVisualChangeSuspected: result.postWriteInfluences.length > 0 && !writeSucceeded,
      resetAfterApplyDetected: false,
    }));
    scheduleResetAfterApplyCheck(result.postWriteInfluences);
  }, [scheduleResetAfterApplyCheck]);

  const bruteForceAllAA = useCallback(() => {
    const result = writeRawAaToRoots({
      roots: [
        { root: avatarRootRef.current, source: 'rendered-root' },
        { root: loadedSceneRef.current, source: 'original-gltf-scene' },
      ],
      visibleOnly: false,
    });
    const aaWrite = result.postWriteInfluences.find((influence) => influence.morphName === 'viseme_AA');
    const writeSucceeded = result.postWriteInfluences.some(
      (influence) => Math.abs(influence.actualInfluence - influence.valueWritten) <= 0.0001,
    );
    const statusMessage = result.postWriteInfluences.length === 0
      ? 'No visible mesh with viseme_AA found'
      : aaWrite && aaWrite.actualInfluence <= 0.0001
        ? 'Write overwritten/reset after apply'
        : 'Brute Force All AA clicked';

    setBlinkPulse(0);
    setManualPreviewTargets({});
    setMorphPreviewDiagnostics((current) => ({
      ...current,
      lastAppliedMorphs: result.rawWrite,
      forceAaStatusMessage: statusMessage,
      lastApplyReason: result.postWriteInfluences.length > 0
        ? `Brute Force All AA wrote to ${result.touchedMeshNames.length} mesh name(s): ${result.touchedMeshNames.join(', ')}. If the face still does not move: Written to non-visible or non-effective mesh.`
        : 'Brute Force All AA found no mesh with viseme_AA in rendered or original GLTF roots.',
      buttonClickedCount: current.buttonClickedCount + 1,
      previewApplyCount: current.previewApplyCount + 1,
      missingMappedMorphs: result.missingMorphs,
      forbiddenMorphBlockedCount: 0,
      lastRawWrite: result.rawWrite,
      lastWrittenMorph: aaWrite?.morphName ?? null,
      lastWrittenValue: aaWrite?.valueWritten ?? null,
      postWriteReadbackValue: aaWrite?.actualInfluence ?? null,
      postWriteInfluences: result.postWriteInfluences,
      writeSucceeded,
      writtenButNoVisualChangeSuspected: result.postWriteInfluences.length > 0 && !writeSucceeded,
      resetAfterApplyDetected: false,
    }));
    scheduleResetAfterApplyCheck(result.postWriteInfluences);
  }, [scheduleResetAfterApplyCheck]);

  useEffect(() => {
    applyVisualPreview();
  }, [applyVisualPreview]);

  useEffect(() => {
    window.saraRfv2LabDiagnostics = diagnostics;
    return () => {
      delete window.saraRfv2LabDiagnostics;
    };
  }, [diagnostics]);

  useEffect(() => {
    if (faceBoundsHelperRef.current) {
      faceBoundsHelperRef.current.visible = debugToggles.showFaceBounds;
    }
    if (bodyBoundsHelperRef.current) {
      bodyBoundsHelperRef.current.visible = debugToggles.showBodyBounds;
    }
    if (hairBoundsHelperRef.current) {
      hairBoundsHelperRef.current.visible = debugToggles.showHairBounds;
    }
    if (axesHelperRef.current) {
      axesHelperRef.current.visible = debugToggles.showAxes;
    }
  }, [debugToggles]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(FACE_FRAME.fov, 1, 0.01, 100);
    camera.position.set(...FACE_FRAME.position);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(...FACE_FRAME.lookAt);
    controls.addEventListener('start', () => updateFrameDiagnostics('free'));
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x334155, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(2.8, 4.2, 3.2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9cc3ff, 1.2);
    fillLight.position.set(-3, 2.1, -2);
    scene.add(fillLight);

    const avatarRoot = new THREE.Group();
    avatarRoot.name = 'SaraRFv2LabRoot';
    avatarRootRef.current = avatarRoot;
    scene.add(avatarRoot);

    const grid = new THREE.GridHelper(4, 16, 0x64748b, 0x334155);
    grid.position.y = -0.02;
    scene.add(grid);

    const faceBoundsHelper = createBoxHelper('SaraRFv2FaceBounds', 0x38bdf8);
    const bodyBoundsHelper = createBoxHelper('SaraRFv2BodyBounds', 0x22c55e);
    const hairBoundsHelper = createBoxHelper('SaraRFv2HairBounds', 0xf59e0b);
    const axesHelper = new THREE.AxesHelper(1);
    axesHelper.name = 'SaraRFv2Axes';
    axesHelper.visible = false;
    faceBoundsHelperRef.current = faceBoundsHelper;
    bodyBoundsHelperRef.current = bodyBoundsHelper;
    hairBoundsHelperRef.current = hairBoundsHelper;
    axesHelperRef.current = axesHelper;
    scene.add(faceBoundsHelper, bodyBoundsHelper, hairBoundsHelper, axesHelper);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const loader = new GLTFLoader();
    setLoadingState(`Loading ${SARA_RFV2_MODEL.url}`);
    loader.load(
      SARA_RFV2_MODEL.url,
      (gltf) => {
        avatarRoot.clear();
        const loadedScene = gltf.scene;
        loadedScene.name = loadedScene.name || 'Sara RFv2 GLB Scene';
        loadedScene.updateMatrixWorld(true);
        loadedScene.position.set(0, 0, 0);
        loadedScene.rotation.set(0, 0, 0);
        loadedScene.scale.set(1, 1, 1);

        const aligned = prepareSaraV2AlignedScene({
          gltfScene: loadedScene,
          config: SARA_V2_AVATAR_DEFINITION,
          THREE,
          mode: 'lab',
        });

        avatarRoot.add(loadedScene);
        avatarRoot.position.set(0, 0, 0);
        avatarRoot.rotation.set(0, 0, 0);
        avatarRoot.scale.set(1, 1, 1);

        loadedScene.traverse((object) => {
          if (!isMesh(object)) return;
          object.frustumCulled = false;
        });

        avatarRoot.updateMatrixWorld(true);
        loadedScene.updateMatrixWorld(true);
        const faceBounds = safeBoxFromObject(aligned.faceObject);
        const bodyBounds = safeBoxFromObject(aligned.bodyObject);
        const hairBounds = safeBoxFromObject(aligned.hairObject);
        if (faceBounds) faceBoundsHelper.box.copy(faceBounds);
        if (bodyBounds) bodyBoundsHelper.box.copy(bodyBounds);
        if (hairBounds) hairBoundsHelper.box.copy(hairBounds);

        const armature = findNamedObject(loadedScene, ['Armature']);
        const character = findNamedObject(loadedScene, ['Character']);
        loadedSceneRef.current = loadedScene;
        faceObjectRef.current = aligned.faceObject;
        hairObjectRef.current = aligned.hairObject;
        bodyObjectRef.current = aligned.bodyObject;
        const bound = bindSaraRfv2FaceMorphTargets({ root: avatarRoot });
        morphBindingsRef.current = bound.bindings;
        morphApplierStateRef.current = bound.state;
        faceMeshRef.current = bound.bindings[0]?.mesh ?? findFaceMesh(loadedScene);
        const faceMesh = faceMeshRef.current;
        const faceMorphNames = faceMesh ? getMorphTargetNames(faceMesh) : [];
        const requiredPreviewMorphs = [
          'viseme_AA',
          'viseme_PP',
          'viseme_O',
          'eyeBlinkLeft',
          'eyeBlinkRight',
          'mouthSmileLeft',
          'mouthSmileRight',
          'sad',
        ];
        const missingPreviewMorphs = requiredPreviewMorphs.filter(
          (morphName) => !faceMorphNames.includes(morphName),
        );
        setMorphPreviewDiagnostics((current) => ({
          ...current,
          faceMeshFound: Boolean(faceMesh),
          faceMeshName: faceMesh?.name ?? null,
          faceMeshParentPath: getObjectPath(faceMesh),
          faceMorphCount: faceMorphNames.length,
          faceMorphNames,
          lastApplyReason: faceMesh
            ? 'Face mesh bound through Sara RFv2 Morph Applier.'
            : 'Face mesh was not found; visual morph preview cannot apply.',
          missingMappedMorphs: [
            ...missingPreviewMorphs,
            ...bound.diagnostics.missingMorphs,
          ],
          forbiddenMorphBlockedCount: bound.diagnostics.blockedMorphs.length,
          allMorphCapableMeshes: bound.diagnostics.allMorphCapableMeshes,
          boundFaceMeshes: summarizeBoundFaceMeshes(bound.bindings),
          rejectedMorphMeshes: bound.diagnostics.rejectedMorphMeshes,
          currentRenderedRootName: bound.diagnostics.currentRenderedRootName,
          currentRenderedRootUuid: bound.diagnostics.currentRenderedRootUuid,
          lastRawWrite: {},
          postWriteInfluences: bound.diagnostics.postWriteInfluences,
          writeSucceeded: bound.diagnostics.writeSucceeded,
          writtenButNoVisualChangeSuspected: bound.diagnostics.writtenButNoVisualChangeSuspected,
          resetAfterApplyDetected: false,
          applierBound: bound.diagnostics.applierBound,
          applierBindingReason: bound.diagnostics.applierBindingReason,
        }));
        setMeshSummaries(collectMeshSummaries(avatarRoot));
        setAlignmentDiagnostics({
          faceCandidateUsed: aligned.diagnostics.selectedFace,
          hairCandidateUsed: aligned.diagnostics.selectedHair,
          bodyCandidateUsed: aligned.diagnostics.selectedBody,
          faceAligned: Boolean(aligned.faceObject && loadedScene.getObjectByName('FaceAlignmentGroup')),
          hairAligned: aligned.diagnostics.hairParentedUnderFace,
          bodySkeletonPreserved: Boolean(armature && character && isDescendantOf(character, armature) && !aligned.diagnostics.characterDetached),
          currentFrameMode: 'face',
          cameraPosition: FACE_FRAME.position.slice(),
          cameraLookAt: FACE_FRAME.lookAt.slice(),
          faceBounds: summarizeBounds(aligned.faceObject),
          bodyBounds: summarizeBounds(aligned.bodyObject),
          hairBounds: summarizeBounds(aligned.hairObject),
          alignmentWarnings: aligned.diagnostics.warnings,
        });
        applyFrame(camera, controls, FACE_FRAME);
        setLoadingState(`Loaded ${SARA_RFV2_MODEL.url}`);
      },
      undefined,
      (error) => {
        setLoadingState(`Failed to load ${SARA_RFV2_MODEL.url}: ${error instanceof Error ? error.message : String(error)}`);
      },
    );

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    resize();
    window.addEventListener('resize', resize);
    animate();

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      resetFaceMorphs(faceMeshRef.current);
      controls.dispose();
      renderer.dispose();
      avatarRoot.traverse((object) => {
        if (!isMesh(object)) return;
        object.geometry?.dispose();
      });
      mount.removeChild(renderer.domElement);
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      avatarRootRef.current = null;
      loadedSceneRef.current = null;
      morphBindingsRef.current = [];
      morphApplierStateRef.current = createSaraRfv2MorphApplierState();
      faceMeshRef.current = null;
      faceObjectRef.current = null;
      hairObjectRef.current = null;
      bodyObjectRef.current = null;
      faceBoundsHelperRef.current = null;
      bodyBoundsHelperRef.current = null;
      hairBoundsHelperRef.current = null;
      axesHelperRef.current = null;
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: 24 }}>
      <section style={{ display: 'grid', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
        <div style={{ ...panelStyle, background: 'rgba(30, 41, 59, 0.92)' }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.25 }}>
            Sara RFv2 Lab — private test route. Production Sara is unchanged.
          </h1>
          <p style={{ margin: '8px 0 0', color: '#cbd5e1' }}>
            Direct GLB load only. No ThreeAvatar, no ActiveSession, no public navigation link, and no production RFv2 flags are changed.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(360px, 0.8fr)', gap: 16 }}>
          <section style={panelStyle}>
            <div
              ref={mountRef}
              style={{
                width: '100%',
                height: 'min(68vh, 720px)',
                minHeight: 520,
                overflow: 'hidden',
                borderRadius: 8,
                border: '1px solid rgba(148, 163, 184, 0.22)',
              }}
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, color: '#cbd5e1', fontSize: 13 }}>
              <span>{loadingState}</span>
              <span>Asset: {SARA_RFV2_MODEL.url}</span>
              <span>Face mesh: {faceMeshRef.current ? 'found' : 'pending'}</span>
            </div>
          </section>

          <aside style={{ display: 'grid', gap: 16 }}>
            <section style={panelStyle}>
              <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Manual Simulation</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={speaking}
                  onChange={(event) => {
                    setSpeaking(event.target.checked);
                    setManualPreviewTargets({});
                  }}
                />
                Speaking
              </label>

              <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <span>Sample timeline</span>
                <select
                  value={sampleTimelineId}
                  onChange={(event) => {
                    setSampleTimelineId(event.target.value);
                    setAudioCurrentTime(0);
                    setManualPreviewTargets({});
                  }}
                  style={{ padding: 8, borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569' }}
                >
                  {SAMPLE_TIMELINES.map((sample) => (
                    <option key={sample.id} value={sample.id}>{sample.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <span>Audio current time: {audioCurrentTime.toFixed(2)}s</span>
                <input
                  type="range"
                  min={0}
                  max={selectedSample.duration}
                  step={0.01}
                  value={audioCurrentTime}
                  onChange={(event) => {
                    setAudioCurrentTime(Number(event.target.value));
                    setManualPreviewTargets({});
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <span>Expression preset</span>
                <select
                  value={expressionPreset}
                  onChange={(event) => {
                    setExpressionPreset(event.target.value as ExpressionPreset);
                    setManualPreviewTargets({});
                  }}
                  style={{ padding: 8, borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #475569' }}
                >
                  {(['idle', 'listening', 'thinking', 'speaking', 'happy', 'sad', 'neutral'] as ExpressionPreset[]).map((preset) => (
                    <option key={preset} value={preset}>{preset}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  ['aa', 'Test AA'],
                  ['o', 'Test O'],
                  ['pp', 'Test PP'],
                  ['blink', 'Test Blink'],
                  ['smile', 'Test Smile'],
                  ['sad', 'Test Sad'],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setVisualPreviewEnabled(true);
                      setManualPreviewTargets(createDirectTestTargets(kind as 'aa' | 'o' | 'pp' | 'blink' | 'smile' | 'sad'));
                    }}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #facc15', background: '#422006', color: '#fef9c3' }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={forceRawFaceAA}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #f97316', background: '#431407', color: '#ffedd5' }}
                >
                  Force Raw Face AA
                </button>
                <button
                  type="button"
                  onClick={bruteForceAllAA}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #fb923c', background: '#7c2d12', color: '#ffedd5' }}
                >
                  Brute Force All AA
                </button>
                <button
                  type="button"
                  onClick={frameFace}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #a78bfa', background: '#2e1065', color: '#ede9fe' }}
                >
                  Frame Face
                </button>
                <button
                  type="button"
                  onClick={frameUpperBody}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #60a5fa', background: '#172554', color: '#dbeafe' }}
                >
                  Frame Upper Body
                </button>
                <button
                  type="button"
                  onClick={() => setBlinkPulse((value) => (value > 0 ? 0 : 1))}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #38bdf8', background: '#082f49', color: '#e0f2fe' }}
                >
                  Blink test
                </button>
                <button
                  type="button"
                  onClick={resetAllMorphs}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #fb7185', background: '#4c0519', color: '#ffe4e6' }}
                >
                  Reset All Morphs
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={visualPreviewEnabled}
                  onChange={(event) => {
                    setVisualPreviewEnabled(event.target.checked);
                    if (!event.target.checked) setManualPreviewTargets({});
                  }}
                />
                Enable visual morph preview
              </label>
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 12 }}>
                Default off. When enabled, only audited Face mesh morphs from the RFv2 target map are applied locally.
              </p>
            </section>

            <section style={panelStyle}>
              <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Visual Debug</h2>
              <div
                style={{
                  border: '1px solid rgba(251, 146, 60, 0.55)',
                  borderRadius: 6,
                  background: 'rgba(67, 20, 7, 0.72)',
                  color: '#ffedd5',
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {morphPreviewDiagnostics.forceAaStatusMessage}
              </div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', margin: '0 0 12px', fontSize: 13 }}>
                <dt>Button clicked count</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.buttonClickedCount}</dd>
                <dt>Applier bound</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.applierBound ? 'true' : 'false'}</dd>
                <dt>Bound mesh count</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.boundFaceMeshes.length}</dd>
                <dt>Bound mesh names</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.boundFaceMeshes.map((mesh) => mesh.name).join(', ') || 'none'}</dd>
                <dt>Last written morph</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.lastWrittenMorph ?? 'none'}</dd>
                <dt>Last written value</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.lastWrittenValue ?? 'none'}</dd>
                <dt>Post-write readback</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.postWriteReadbackValue ?? 'none'}</dd>
                <dt>Reset detected</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.resetAfterApplyDetected ? 'true' : 'false'}</dd>
                <dt>Face mesh found</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.faceMeshFound ? 'yes' : 'no'}</dd>
                <dt>Face mesh</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.faceMeshName ?? 'none'}</dd>
                <dt>Morph count</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.faceMorphCount}</dd>
                <dt>Morph-capable meshes</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.allMorphCapableMeshes.length}</dd>
                <dt>Bound Face meshes</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.boundFaceMeshes.length}</dd>
                <dt>Write succeeded</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.writeSucceeded ? 'yes' : 'no'}</dd>
                <dt>Preview apply count</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.previewApplyCount}</dd>
                <dt>Last reason</dt><dd style={{ margin: 0 }}>{morphPreviewDiagnostics.lastApplyReason}</dd>
              </dl>
              {[
                ['showFaceBounds', 'Show Face Bounds'],
                ['showBodyBounds', 'Show Body Bounds'],
                ['showHairBounds', 'Show Hair Bounds'],
                ['showAxes', 'Show Axes'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={debugToggles[key as keyof typeof debugToggles]}
                    onChange={(event) =>
                      setDebugToggles((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
              <details style={{ marginTop: 12 }}>
                <summary>Bound Face meshes</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 160, fontSize: 12 }}>
                  {formatJson(morphPreviewDiagnostics.boundFaceMeshes)}
                </pre>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary>Last written morph values</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 180, fontSize: 12 }}>
                  {formatJson({
                    lastRawWrite: morphPreviewDiagnostics.lastRawWrite,
                    postWriteInfluences: morphPreviewDiagnostics.postWriteInfluences,
                  })}
                </pre>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary>Rejected morph meshes</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 180, fontSize: 12 }}>
                  {formatJson(morphPreviewDiagnostics.rejectedMorphMeshes)}
                </pre>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary>All morph-capable meshes</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 220, fontSize: 12 }}>
                  {formatJson(morphPreviewDiagnostics.allMorphCapableMeshes)}
                </pre>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary>Last applied morphs</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 160, fontSize: 12 }}>
                  {formatJson(morphPreviewDiagnostics.lastAppliedMorphs)}
                </pre>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary>Missing mapped morphs</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 160, fontSize: 12 }}>
                  {formatJson(morphPreviewDiagnostics.missingMappedMorphs)}
                </pre>
              </details>
            </section>

            <section style={panelStyle}>
              <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Active Preview</h2>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', margin: 0 }}>
                <dt>Phoneme</dt><dd style={{ margin: 0 }}>{activePhoneme.activePhoneme ?? 'none'}</dd>
                <dt>Viseme</dt><dd style={{ margin: 0 }}>{activePhoneme.activeViseme}</dd>
                <dt>Readiness</dt><dd style={{ margin: 0 }}>{readiness.score} / {readiness.category}</dd>
                <dt>Frame</dt><dd style={{ margin: 0 }}>{alignmentDiagnostics.currentFrameMode}</dd>
                <dt>Face aligned</dt><dd style={{ margin: 0 }}>{alignmentDiagnostics.faceAligned ? 'yes' : 'no'}</dd>
                <dt>Hair aligned</dt><dd style={{ margin: 0 }}>{alignmentDiagnostics.hairAligned ? 'yes' : 'no'}</dd>
                <dt>Body skeleton</dt><dd style={{ margin: 0 }}>{alignmentDiagnostics.bodySkeletonPreserved ? 'preserved' : 'pending'}</dd>
                <dt>Visual preview</dt><dd style={{ margin: 0 }}>{visualPreviewEnabled ? 'enabled locally' : 'off'}</dd>
              </dl>
            </section>
          </aside>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <section style={panelStyle}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>RFv2 Diagnostics</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 360, margin: 0, fontSize: 12 }}>
              {formatJson({
                readiness,
                flags: SARA_RFV2_FLAGS,
                labFlags,
                targetMapValidation,
                smoothingValidation,
                runtimeValidation,
                alignmentDiagnostics,
              })}
            </pre>
          </section>

          <section style={panelStyle}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Targets</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 360, margin: 0, fontSize: 12 }}>
              {formatJson({
                rawTargets,
                smoothedTargets: smoothingPreview.smoothedTargets,
                mappedTargets,
              })}
            </pre>
          </section>

          <section style={panelStyle}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Scene Inventory</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 360, margin: 0, fontSize: 12 }}>
              {formatJson({
                meshCount: meshSummaries.length,
                faceMorphs: meshSummaries.find((mesh) => mesh.name === 'Face')?.morphTargets ?? [],
                meshes: meshSummaries.map((mesh) => ({
                  name: mesh.name,
                  type: mesh.type,
                  parent: mesh.parent,
                  isSkinnedMesh: mesh.isSkinnedMesh,
                  morphTargetCount: mesh.morphTargets.length,
                })),
              })}
            </pre>
          </section>
        </div>
      </section>
    </main>
  );
}
