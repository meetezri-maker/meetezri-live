import * as THREE from "three";
import type { AvatarDefinition, Vector3Config, Vector3Object } from "./avatarConfigTypes";

type SaraRuntimeFixArgs = {
  gltfScene: THREE.Object3D;
  avatarRoot: THREE.Group;
  camera: THREE.PerspectiveCamera;
  scene?: THREE.Scene;
  config: AvatarDefinition;
  modelUrl: string;
  debug?: boolean;
};

type RenderMeshEntry = {
  object: THREE.Mesh | THREE.SkinnedMesh;
  name: string;
  isSkinnedMesh: boolean;
  validGeometry: boolean;
};

function isVector3Object(value: Vector3Config): value is Vector3Object {
  return !Array.isArray(value) && "x" in value && "y" in value && "z" in value;
}

function vector3FromConfig(
  value: Vector3Config | undefined,
  fallback: readonly [number, number, number]
): THREE.Vector3 {
  if (value && isVector3Object(value)) return new THREE.Vector3(value.x, value.y, value.z);
  if (value) return new THREE.Vector3(value[0], value[1], value[2]);
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

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

function hasInvalidPositionAttribute(positionAttribute: THREE.BufferAttribute): boolean {
  const array = positionAttribute.array;
  for (let i = 0; i < array.length; i += 1) {
    const value = Number(array[i]);
    if (!Number.isFinite(value) || Number.isNaN(value)) return true;
  }
  return false;
}

function isRuntimeHelper(object: THREE.Object3D): boolean {
  const name = object.name || "";
  return name.startsWith("SaraRuntimeFix") || name.startsWith("SaraMeshCenterMarker_");
}

function collectRenderMeshes(root: THREE.Object3D): {
  renderMeshes: RenderMeshEntry[];
  invalidGeometryMeshes: string[];
  skinnedMeshCount: number;
} {
  const renderMeshes: RenderMeshEntry[] = [];
  const invalidGeometryMeshes: string[] = [];
  let skinnedMeshCount = 0;

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (isRuntimeHelper(child)) return;
    const isMesh = Boolean((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh);
    if (!isMesh) return;

    const mesh = child as THREE.Mesh | THREE.SkinnedMesh;
    const name = child.name || "(unnamed mesh)";
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const positionAttribute = geometry?.getAttribute?.("position") as THREE.BufferAttribute | undefined;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount += 1;

    let validGeometry = Boolean(geometry && positionAttribute && positionAttribute.count > 0);
    if (validGeometry && geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
      validGeometry =
        size.length() >= 0.0001 &&
        Math.max(size.x, size.y, size.z) >= 0.0001 &&
        Boolean(positionAttribute) &&
        !hasInvalidPositionAttribute(positionAttribute as THREE.BufferAttribute);
    }

    if (!validGeometry) invalidGeometryMeshes.push(name);
    renderMeshes.push({
      object: mesh,
      name,
      isSkinnedMesh: Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh),
      validGeometry,
    });
  });

  return { renderMeshes, invalidGeometryMeshes, skinnedMeshCount };
}

function computeBoundsForMeshes(meshes: RenderMeshEntry[]): THREE.Box3 {
  const bounds = new THREE.Box3();
  let hasBounds = false;

  meshes.forEach((entry) => {
    if (!entry.validGeometry) return;
    entry.object.updateWorldMatrix(true, false);
    const meshBox = new THREE.Box3().setFromObject(entry.object);
    if (meshBox.isEmpty()) return;
    if (!hasBounds) {
      bounds.copy(meshBox);
      hasBounds = true;
    } else {
      bounds.union(meshBox);
    }
  });

  return bounds;
}

function chooseVisibleBounds(
  meshes: RenderMeshEntry[],
  preferredMeshNames: readonly string[]
): { bounds: THREE.Box3; preferredAnchorUsed: boolean } {
  const preferred = preferredMeshNames.length
    ? meshes.filter((entry) => preferredMeshNames.includes(entry.name))
    : [];
  const preferredBounds = computeBoundsForMeshes(preferred);
  if (!preferredBounds.isEmpty()) return { bounds: preferredBounds, preferredAnchorUsed: true };
  return { bounds: computeBoundsForMeshes(meshes), preferredAnchorUsed: false };
}

function forceMeshVisibility(
  entry: RenderMeshEntry,
  forceBasicMaterial: boolean,
  wireframe: boolean
) {
  const mesh = entry.object;
  mesh.visible = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
  materials.forEach((material: any) => {
    material.visible = true;
    material.opacity = 1;
    material.transparent = false;
    material.depthTest = true;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  });

  if (forceBasicMaterial) {
    if (!mesh.userData.saraOriginalMaterial) mesh.userData.saraOriginalMaterial = mesh.material;
    mesh.material = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      side: THREE.DoubleSide,
      transparent: false,
      wireframe,
      depthTest: true,
      depthWrite: true,
    });
  }
}

function addDebugHelpers(
  visualRoot: THREE.Group,
  gltfScene: THREE.Object3D,
  visibleBounds: THREE.Box3,
  meshes: RenderMeshEntry[]
) {
  const rootMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, depthWrite: false })
  );
  rootMarker.name = "SaraRuntimeFixRootOrigin";
  rootMarker.renderOrder = 1000;
  visualRoot.add(rootMarker);

  if (!visibleBounds.isEmpty()) {
    const boundsHelper = new THREE.Box3Helper(visibleBounds, 0xff00ff);
    boundsHelper.name = "SaraRuntimeFixVisibleBounds";
    visualRoot.add(boundsHelper);
  }

  const axes = new THREE.AxesHelper(0.35);
  axes.name = "SaraRuntimeFixAxes";
  visualRoot.add(axes);

  meshes.forEach((entry, index) => {
    if (!entry.validGeometry || !entry.object.visible) return;
    const meshBox = new THREE.Box3().setFromObject(entry.object);
    if (meshBox.isEmpty()) return;
    const center = meshBox.getCenter(new THREE.Vector3());
    const localCenter = gltfScene.worldToLocal(center.clone());
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 12),
      new THREE.MeshBasicMaterial({
        color: [0xff00ff, 0x00ffff, 0xffff00, 0x00ff66][index % 4],
        depthTest: false,
        depthWrite: false,
      })
    );
    marker.name = `SaraMeshCenterMarker_${entry.name}`;
    marker.position.copy(localCenter);
    marker.renderOrder = 1001 + index;
    gltfScene.add(marker);
  });
}

export function applySaraRuntimeFix({
  gltfScene,
  avatarRoot,
  camera,
  scene,
  config,
  modelUrl,
  debug,
}: SaraRuntimeFixArgs) {
  const runtimeFix = config.runtimeFix;
  const enabled = runtimeFix?.enabled ?? false;
  let visualRoot = avatarRoot.children.find((child) => child.name === "SaraVisualRoot") as
    | THREE.Group
    | undefined;

  if (!visualRoot) {
    visualRoot = new THREE.Group();
    visualRoot.name = "SaraVisualRoot";
    avatarRoot.add(visualRoot);
  }

  if (gltfScene.parent !== visualRoot) {
    visualRoot.add(gltfScene);
  }

  const { renderMeshes, invalidGeometryMeshes, skinnedMeshCount } = collectRenderMeshes(gltfScene);

  if (enabled && runtimeFix?.forceVisible) {
    renderMeshes.forEach((entry) =>
      forceMeshVisibility(entry, Boolean(runtimeFix.forceBasicMaterial), Boolean(runtimeFix.wireframe))
    );
  }

  gltfScene.updateMatrixWorld(true);
  visualRoot.updateMatrixWorld(true);
  avatarRoot.updateMatrixWorld(true);

  const preferredMeshNames =
    runtimeFix?.preferredMeshNames ?? config.visualAnchor?.preferredMeshNames ?? [];
  const { bounds: visibleBounds, preferredAnchorUsed } = chooseVisibleBounds(
    renderMeshes,
    preferredMeshNames
  );
  const fullSceneBox = new THREE.Box3().setFromObject(gltfScene);

  let appliedNormalization: Record<string, unknown> | null = null;
  if (enabled && runtimeFix?.normalizeVisibleMeshes && !visibleBounds.isEmpty()) {
    const center = visibleBounds.getCenter(new THREE.Vector3());
    const size = visibleBounds.getSize(new THREE.Vector3());
    const targetHeight = runtimeFix.targetHeight ?? 1.8;
    const normalizeScale = size.y > 0 ? targetHeight / size.y : 1;
    const configPosition = vector3FromConfig(config.gltfTransform.position, [0, 0, 0]);
    const configRotation = vector3FromConfig(config.gltfTransform.rotation, [0, 0, 0]);
    const configScale =
      typeof config.gltfTransform.scale === "number"
        ? new THREE.Vector3(
            config.gltfTransform.scale,
            config.gltfTransform.scale,
            config.gltfTransform.scale
          )
        : vector3FromConfig(config.gltfTransform.scale, [1, 1, 1]);

    visualRoot.rotation.set(configRotation.x, configRotation.y, configRotation.z);
    visualRoot.scale.set(
      configScale.x * normalizeScale,
      configScale.y * normalizeScale,
      configScale.z * normalizeScale
    );
    visualRoot.position.copy(configPosition).sub(
      center.clone().multiply(configScale).multiplyScalar(normalizeScale)
    );
    visualRoot.updateMatrixWorld(true);
    gltfScene.updateMatrixWorld(true);

    appliedNormalization = {
      center: center.toArray(),
      size: size.toArray(),
      targetHeight,
      normalizeScale,
      visualRootPosition: visualRoot.position.toArray(),
      visualRootScale: visualRoot.scale.toArray(),
      visualRootRotation: [visualRoot.rotation.x, visualRoot.rotation.y, visualRoot.rotation.z],
    };
  }

  if (debug && enabled) {
    addDebugHelpers(visualRoot, gltfScene, visibleBounds, renderMeshes);
  }

  if (debug && runtimeFix?.debugAutoFrameCamera && !visibleBounds.isEmpty()) {
    const center = visibleBounds.getCenter(new THREE.Vector3());
    const size = visibleBounds.getSize(new THREE.Vector3());
    const fovRadians = THREE.MathUtils.degToRad(camera.fov);
    const distance = (Math.max(size.y, 0.001) * 0.5) / Math.tan(fovRadians * 0.5) * 1.35;
    camera.position.set(center.x, center.y, center.z + Math.max(distance, 1.5));
    camera.lookAt(center);
    camera.userData.fixedLookAt = center.toArray();
    camera.updateProjectionMatrix();
  }

  const visibleBoundsData = visibleBounds.isEmpty() ? null : serializableBox(visibleBounds);
  const fullSceneBoundsData = fullSceneBox.isEmpty() ? null : serializableBox(fullSceneBox);
  const size = visibleBounds.getSize(new THREE.Vector3());
  const fullCenter = fullSceneBox.isEmpty() ? null : fullSceneBox.getCenter(new THREE.Vector3());
  const visibleCenter = visibleBounds.isEmpty() ? null : visibleBounds.getCenter(new THREE.Vector3());
  const likelyCause: string[] = [];
  if (renderMeshes.length === 0) likelyCause.push("no render meshes found");
  if (visibleBounds.isEmpty()) likelyCause.push("invalid geometry/bounds");
  if (runtimeFix?.forceBasicMaterial) likelyCause.push("if magenta appears, original material/lighting is the cause");
  if (appliedNormalization && Number((appliedNormalization.normalizeScale as number) ?? 1) > 20) {
    likelyCause.push("microscopic export/root scale issue");
  }
  if (
    preferredAnchorUsed &&
    fullCenter &&
    visibleCenter &&
    fullCenter.distanceTo(visibleCenter) > Math.max(size.length(), 1)
  ) {
    likelyCause.push("fragmented GLB/root coordinate spaces");
  }

  const diagnostics = {
    modelUrl,
    renderMeshCount: renderMeshes.length,
    skinnedMeshCount,
    meshNames: renderMeshes.map((entry) => entry.name),
    invalidGeometryMeshes,
    tinyScaleMeshes: renderMeshes
      .filter((entry) => {
        const scale = entry.object.getWorldScale(new THREE.Vector3());
        return Math.min(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) < 0.0001;
      })
      .map((entry) => entry.name),
    materialFallbackApplied: Boolean(runtimeFix?.forceBasicMaterial),
    forcedVisibilityApplied: Boolean(runtimeFix?.forceVisible),
    wireframeApplied: Boolean(runtimeFix?.wireframe),
    preferredAnchorUsed,
    visibleBounds: visibleBoundsData,
    fullSceneBounds: fullSceneBoundsData,
    visualRootTransform: {
      position: visualRoot.position.toArray(),
      rotation: [visualRoot.rotation.x, visualRoot.rotation.y, visualRoot.rotation.z],
      scale: visualRoot.scale.toArray(),
    },
    camera: {
      position: camera.position.toArray(),
      lookAt: camera.userData.fixedLookAt ?? null,
      fov: camera.fov,
    },
    likelyCause: likelyCause.length ? likelyCause : ["no obvious Sara runtime fix cause"],
  };

  if (debug || runtimeFix?.debug) {
    (window as any).saraRuntimeFixDiagnostics = diagnostics;
    console.group("[Sara Runtime Fix]");
    console.log(diagnostics);
    console.groupEnd();
  }

  return {
    visualRoot,
    diagnostics,
    visibleBounds,
    renderMeshCount: renderMeshes.length,
    skinnedMeshCount,
    appliedNormalization,
    appliedMaterialFallback: Boolean(runtimeFix?.forceBasicMaterial),
    appliedVisibilityFix: Boolean(runtimeFix?.forceVisible),
    preferredAnchorUsed,
  };
}
