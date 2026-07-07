import type { AvatarGltfTransformConfig } from "@/lib/avatar/avatarConfigTypes";
import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { writeSaraV3Diagnostics } from "./saraV3Diagnostics";
import {
  bindSaraV3MorphTargets,
  findSaraV3MorphBindingsOnDeformingMeshes,
} from "./saraV3MorphBinding";
import { discoverSaraV3MorphTargets } from "./saraV3MorphDiscovery";
import { applySaraV3MaterialFixes } from "./saraV3MaterialFixes";
import { applySaraV3MaterialPass } from "./saraV3MaterialPass";
import type { SaraV3ControllerState } from "./saraV3Types";

function applyVector3Like(
  target: THREE.Vector3 | THREE.Euler,
  value: AvatarGltfTransformConfig["position"] | AvatarGltfTransformConfig["rotation"]
) {
  if (!value) return;
  if (Array.isArray(value)) {
    target.set(value[0], value[1], value[2]);
    return;
  }
  target.set(value.x, value.y, value.z);
}

function applyScale(target: THREE.Object3D, value: AvatarGltfTransformConfig["scale"]) {
  if (!value) return;
  if (typeof value === "number") {
    target.scale.setScalar(value);
    return;
  }
  if (Array.isArray(value)) {
    target.scale.set(value[0], value[1], value[2]);
    return;
  }
  target.scale.set(value.x, value.y, value.z);
}

export function createSaraV3ModelController(args: {
  root: THREE.Group;
  modelUrl: string;
}): SaraV3ControllerState {
  applyVector3Like(args.root.position, SARA_V3_AVATAR_DEFINITION.saraV3.position);
  applyVector3Like(args.root.rotation, SARA_V3_AVATAR_DEFINITION.saraV3.rotation);
  applyScale(args.root, SARA_V3_AVATAR_DEFINITION.saraV3.scale);
  args.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    child.visible = true;
    child.frustumCulled = false;
  });
  // A2: per-category material pass replaces the legacy global fixes. Rollback
  // is a one-line config change (materialPassConfig.enabled: false), which
  // restores the pre-existing applySaraV3MaterialFixes behavior unchanged.
  if (SARA_V3_AVATAR_DEFINITION.saraV3.materialPassConfig.enabled) {
    applySaraV3MaterialPass(args.root);
  } else {
    applySaraV3MaterialFixes(args.root);
  }
  const discovery = discoverSaraV3MorphTargets(args.root);
  const groupedFaceMeshBindingActive = discovery.groupedFaceMeshes.length > 0;
  const boundFaceMeshes = groupedFaceMeshBindingActive
    ? discovery.groupedFaceMeshes
    : discovery.selectedFaceMesh
      ? [discovery.selectedFaceMesh]
      : [];
  const bindings = new Map(bindSaraV3MorphTargets(boundFaceMeshes));
  // Additionally bind the eyeball-gaze morphs on whichever mesh actually
  // deforms the eyeballs (a separate primitive from the bound face skin), so
  // idle eyeball movement reaches the real eye geometry. Existing bindings for
  // visemes/blink/expression are left untouched.
  const eyeballMorphNames = [
    SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.leftEyeball,
    SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.rightEyeball,
  ];
  findSaraV3MorphBindingsOnDeformingMeshes(args.root, eyeballMorphNames).forEach(
    (eyeballBindings, name) => {
      const existing = bindings.get(name) ?? [];
      const combined = existing.slice();
      eyeballBindings.forEach((binding) => {
        if (!combined.some((entry) => entry.mesh === binding.mesh && entry.index === binding.index)) {
          combined.push(binding);
        }
      });
      bindings.set(name, combined);
    }
  );
  console.log("[SaraV3 Discovery Result]", {
    faceMeshCandidates: discovery.faceMeshCandidates,
    selectedFaceMesh: discovery.selectedFaceMesh?.name ?? null,
    groupedFaceMeshNames: discovery.groupedFaceMeshNames,
    groupedFaceMeshCount: discovery.groupedFaceMeshes.length,
    groupedMorphNames: discovery.groupedMorphNames,
  });
  writeSaraV3Diagnostics({
    saraV3Loaded: true,
    modelUrl: args.modelUrl,
    rootName: args.root.name || null,
    meshCount: discovery.meshCount,
    skinnedMeshCount: discovery.skinnedMeshCount,
    faceMeshCandidates: [...discovery.faceMeshCandidates],
    selectedFaceMesh: discovery.selectedFaceMesh?.name ?? null,
    groupedFaceMeshBindingActive,
    groupedFaceMeshNames: [...discovery.groupedFaceMeshNames],
    groupedFaceMeshCount: discovery.groupedFaceMeshes.length,
    groupedMorphNames: [...discovery.groupedMorphNames],
    groupedMissingMorphsByMesh: Object.fromEntries(
      Object.entries(discovery.groupedMissingMorphsByMesh).map(([meshName, missingMorphs]) => [
        meshName,
        [...missingMorphs],
      ])
    ),
    morphWriteMode: groupedFaceMeshBindingActive
      ? "groupedFaceMeshes"
      : "selectedFaceMeshFallback",
    hairMeshCandidates: [...discovery.hairMeshCandidates],
    bodyMeshCandidates: [...discovery.bodyMeshCandidates],
    morphTargetNames: [...discovery.morphTargetNames],
    hasJawOpen: discovery.morphTargetNames.includes(
      SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.jawOpen
    ),
    hasVisemeAA: discovery.morphTargetNames.includes(
      SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeAA
    ),
    hasEyeBlinkLeft: discovery.morphTargetNames.includes(
      SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkLeft
    ),
    hasEyeBlinkRight: discovery.morphTargetNames.includes(
      SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkRight
    ),
    missingRequiredMorphs: [...discovery.missingRequiredMorphs],
  });
  return {
    root: args.root,
    faceMesh: discovery.selectedFaceMesh,
    bodyMesh: discovery.selectedBodyMesh,
    hairMesh: discovery.selectedHairMesh,
    bindings,
    morphNames: discovery.morphTargetNames,
  };
}
