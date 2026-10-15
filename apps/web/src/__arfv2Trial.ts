/**
 * TEMPORARY LOCAL TRIAL HARNESS — arfv2.glb as Sara/Romy's Hyper3D model.
 *
 * Not imported by the app. Loaded on demand by `public/__arfv2-trial.html`
 * through the dev server, so it exercises the REAL GLTFLoader and the REAL
 * production material/appearance passes rather than a reimplementation.
 *
 * DELETE THIS FILE AND `public/__arfv2-trial.html` WHEN THE TRIAL IS OVER.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { applyHyper3dGlbMaterials } from "@/lib/avatar/hyper3d/engine/components/avatar/hyper3dMaterials";
import { applyAcceptedHyper3dAppearance } from "@/lib/avatar/hyper3d/hyper3dAppearance";
import {
  avatarModelConfigs,
  hyper3dConfigForAsset,
  hyper3dUsesSharedFaceMaps,
} from "@/lib/avatar/hyper3d/engine/mappings/avatarModelConfig";
import type { Hyper3dAssetId } from "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection";

const BASE = avatarModelConfigs["hyper3d-usc"];

export { THREE };

type MaterialSnapshot = {
  material: THREE.MeshStandardMaterial;
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  color: THREE.Color;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  transparent: boolean;
  depthWrite: boolean;
  alphaTest: number;
  side: THREE.Side;
  normalScale: THREE.Vector2;
};

function standardMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      if (standard?.isMeshStandardMaterial) out.push(standard);
    }
  });
  return out;
}

function snapshot(root: THREE.Object3D): MaterialSnapshot[] {
  return standardMaterials(root).map((material) => ({
    material,
    map: material.map,
    normalMap: material.normalMap,
    color: material.color.clone(),
    metalness: material.metalness,
    roughness: material.roughness,
    envMapIntensity: material.envMapIntensity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    alphaTest: material.alphaTest,
    side: material.side,
    normalScale: material.normalScale.clone(),
  }));
}

function restore(snapshots: MaterialSnapshot[]): void {
  for (const s of snapshots) {
    s.material.map = s.map;
    s.material.normalMap = s.normalMap;
    s.material.color.copy(s.color);
    s.material.metalness = s.metalness;
    s.material.roughness = s.roughness;
    s.material.envMapIntensity = s.envMapIntensity;
    s.material.transparent = s.transparent;
    s.material.depthWrite = s.depthWrite;
    s.material.alphaTest = s.alphaTest;
    s.material.side = s.side;
    s.material.normalScale.copy(s.normalScale);
    s.material.needsUpdate = true;
  }
}

const loadScene = (url: string): Promise<THREE.Group> =>
  new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });

/** What the REAL loader names things — the values the adapter tables must match. */
export async function inspect(url: string) {
  const scene = await loadScene(url);
  const meshes: Array<{
    name: string;
    parent: string | null;
    type: string;
    material: string[];
    morphs: string[];
    vertices: number | null;
    skinned: boolean;
  }> = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes.push({
      name: mesh.name,
      parent: mesh.parent?.name ?? null,
      type: mesh.type,
      material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(
        (m) => (m as THREE.Material)?.name ?? "(unnamed)",
      ),
      morphs: Object.keys(mesh.morphTargetDictionary ?? {}),
      vertices: mesh.geometry?.attributes?.position?.count ?? null,
      skinned: (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh === true,
    });
  });

  const groups: string[] = [];
  scene.traverse((o) => {
    if (o.type === "Group" || o.type === "Object3D") groups.push(`${o.type}:${o.name}`);
  });

  const bones: string[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o.name);
  });

  const required = ["head", "neck_01", "neck_02", "FACIAL_C_Jaw", "FACIAL_L_Eye", "FACIAL_R_Eye"];
  return {
    url,
    sceneChildren: scene.children.map((c) => `${c.type}:${c.name}`),
    groups,
    meshes,
    boneCount: bones.length,
    requiredBones: Object.fromEntries(required.map((b) => [b, bones.includes(b)])),
  };
}

export type RenderMode = "authored" | "production";

/**
 * Renders `url` into `canvas` under the SAME camera and the SAME accepted
 * lighting in both modes. The only difference between the two is whether the
 * production material/appearance texture and material overrides are left in
 * place (`production`) or rolled back to what the loader delivered
 * (`authored`), which is exactly the question being asked.
 */
export async function render(
  canvas: HTMLCanvasElement,
  url: string,
  mode: RenderMode,
  assetIdForConfig: Hyper3dAssetId = "hyper3d_afr",
  cameraOverride?: { position: [number, number, number]; target: [number, number, number]; fov?: number },
) {
  const CONFIG = hyper3dConfigForAsset(BASE, assetIdForConfig);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    cameraOverride?.fov ?? CONFIG.camera.fov,
    canvas.width / canvas.height,
    CONFIG.camera.near,
    CONFIG.camera.far,
  );

  const model = await loadScene(url);
  model.scale.set(...CONFIG.scale);
  model.position.set(...CONFIG.position);
  scene.add(model);

  camera.position.set(...(cameraOverride?.position ?? CONFIG.camera.position));
  camera.lookAt(new THREE.Vector3(...(cameraOverride?.target ?? CONFIG.camera.target)));
  camera.updateProjectionMatrix();

  const authored = snapshot(model);

  // Production passes, in the production order and with the production arguments
  // (`hyper3dEngineFactory` step 5): "f228-profile", no normalScale override,
  // "evened" albedo, and this asset's own faceMaps decision.
  const materialReport = applyHyper3dGlbMaterials(
    model,
    CONFIG.hyper3dMaterials!.textureBaseUrl,
    "f228-profile",
    undefined,
    "evened",
    hyper3dUsesSharedFaceMaps(CONFIG),
  );
  const appearance = applyAcceptedHyper3dAppearance(model, scene, renderer);

  // The external texture fetches inside the material pass resolve on their own
  // ticks; wait before deciding what is bound.
  await new Promise((r) => setTimeout(r, 2500));

  if (mode === "authored") restore(authored);

  renderer.render(scene, camera);

  const faceMaterials = standardMaterials(model)
    .filter((m) => m.name.replace(/\.\d+$/, "") === "M_Face")
    .map((m) => ({ name: m.name, map: (m.map as THREE.Texture | null)?.name ?? null, mapUuid: m.map?.uuid ?? null }));

  return {
    mode,
    url,
    configUrl: CONFIG.url,
    usesSharedFaceMaps: hyper3dUsesSharedFaceMaps(CONFIG),
    camera: {
      position: camera.position.toArray(),
      fov: camera.fov,
      target: cameraOverride?.target ?? CONFIG.camera.target,
    },
    modelScale: CONFIG.scale,
    materialReport,
    faceMaterials,
    lights: appearance.lights.length,
    materials: standardMaterials(model).map((m) => ({
      name: m.name,
      metalness: +m.metalness.toFixed(4),
      roughness: +m.roughness.toFixed(4),
      envMapIntensity: +m.envMapIntensity.toFixed(4),
      transparent: m.transparent,
      hasMap: Boolean(m.map),
      colorHex: `#${m.color.getHexString()}`,
    })),
  };
}

/** Stub live inputs — the engine reads these per frame, not during init. */
const stubLive = {
  shouldCaptureReviewFrame: () => false,
  noteControllerCreated: () => {},
  recordReviewFrame: () => {},
  getPayload: () => ({}) as never,
  getAcousticFrames: () => [],
  getRevision: () => 0,
  getSentencePlans: () => [],
  resolveSentencePlanAt: () => null,
  freezeSentencePlans: () => {},
  getSentencePlannerStats: () => ({ turnId: 0 }) as never,
  noteSentencePlanConsumed: () => {},
};

/**
 * Runs the REAL production engine against one asset id, on a real WebGL canvas,
 * and reports whether binding succeeded — i.e. whether the session would render
 * Hyper3D or silently fall back to the legacy avatar.
 */
export async function engineTrial(
  assetId: Hyper3dAssetId,
  canvas?: HTMLCanvasElement,
  frames = 90,
) {
  const { createHyper3dEngineFactory } = await import(
    "@/lib/avatar/hyper3d/hyper3dEngineFactory"
  );
  const target = canvas ?? Object.assign(document.createElement("canvas"), { width: 520, height: 640 });
  const renderer = new THREE.WebGLRenderer({ canvas: target, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(target.width, target.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, target.width / target.height, 0.1, 100);
  const factory = createHyper3dEngineFactory(stubLive as never);
  const requested: string[] = [];
  const originalFetch = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    requested.push(typeof input === "string" ? input : String((input as Request).url ?? input));
    return originalFetch(input as never, init);
  }) as typeof window.fetch;
  try {
    const handle = await factory({
      scene,
      camera,
      renderer,
      signal: new AbortController().signal,
      assetId,
    });
    const conversation = { isSpeaking: false, isListening: true, isThinking: false };
    for (let i = 0; i < frames; i += 1) {
      handle.update({
        timeSeconds: i / 60,
        deltaSeconds: 1 / 60,
        elapsedSeconds: i / 60,
        conversation,
        audioLevel: 0,
      });
      renderer.render(scene, camera);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    (window as unknown as Record<string, unknown>).__arfv2Engine = { handle, scene, camera, renderer };
    return { assetId, bound: true, glbRequests: requested.filter((u) => u.endsWith(".glb")) };
  } catch (error) {
    const e = error as { name?: string; message?: string; report?: unknown };
    return {
      assetId,
      bound: false,
      error: { name: e.name, message: e.message, report: e.report },
      glbRequests: requested.filter((u) => u.endsWith(".glb")),
    };
  } finally {
    window.fetch = originalFetch;
  }
}
