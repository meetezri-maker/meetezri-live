import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import type { SaraV3DiscoveryResult } from "./saraV3Types";

function includesHint(name: string, hints: readonly string[]) {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint.toLowerCase()));
}

function isSaraV3GroupedFaceMeshName(name: string) {
  return /^face(?:_\d+)?$/i.test(name.trim());
}

function isSaraV3FaceCandidateMesh(child: THREE.SkinnedMesh) {
  const candidateName = child.name || child.geometry?.name || "";
  return (
    isSaraV3GroupedFaceMeshName(candidateName) ||
    includesHint(candidateName, SARA_V3_AVATAR_DEFINITION.saraV3.faceMeshHints)
  );
}

export function discoverSaraV3MorphTargets(root: THREE.Group): SaraV3DiscoveryResult {
  const faceCandidates: THREE.SkinnedMesh[] = [];
  const hairCandidates: THREE.Object3D[] = [];
  const bodyCandidates: THREE.Object3D[] = [];
  let meshCount = 0;
  let skinnedMeshCount = 0;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const skinnedMesh = child as THREE.SkinnedMesh;
    if (mesh.isMesh || skinnedMesh.isSkinnedMesh) {
      meshCount += 1;
    }
    if (skinnedMesh.isSkinnedMesh) {
      skinnedMeshCount += 1;
      const morphNames = Object.keys(skinnedMesh.morphTargetDictionary ?? {});
      if (morphNames.length > 0 && isSaraV3FaceCandidateMesh(skinnedMesh)) {
        faceCandidates.push(skinnedMesh);
      }
    }
    if (includesHint(child.name || "", SARA_V3_AVATAR_DEFINITION.saraV3.hairMeshHints)) {
      hairCandidates.push(child);
    }
    if (includesHint(child.name || "", SARA_V3_AVATAR_DEFINITION.saraV3.bodyMeshHints)) {
      bodyCandidates.push(child);
    }
  });

  const requiredMorphs =
    SARA_V3_AVATAR_DEFINITION.morphs.requiredDriverMorphs ?? [];
  const selectedFaceMesh =
    faceCandidates.find((candidate) =>
      requiredMorphs.every((name) => candidate.morphTargetDictionary?.[name] != null)
    ) ??
    faceCandidates.sort(
      (a, b) =>
        Object.keys(b.morphTargetDictionary ?? {}).length -
        Object.keys(a.morphTargetDictionary ?? {}).length
    )[0] ??
    null;
  const morphTargetNames = Object.keys(selectedFaceMesh?.morphTargetDictionary ?? {});
  const missingRequiredMorphs = requiredMorphs.filter((name) => !morphTargetNames.includes(name));
  const groupedFaceMeshes = faceCandidates.filter((candidate) => {
    const candidateName = candidate.name || candidate.geometry?.name || "";
    return (
      isSaraV3GroupedFaceMeshName(candidateName) &&
      requiredMorphs.every((name) => candidate.morphTargetDictionary?.[name] != null)
    );
  });
  const groupedFaceMeshNames = groupedFaceMeshes.map((mesh) => mesh.name || "(unnamed face mesh)");
  const groupedMissingMorphsByMesh = Object.fromEntries(
    groupedFaceMeshes.map((mesh) => {
      const meshMorphNames = Object.keys(mesh.morphTargetDictionary ?? {});
      const meshMissingMorphs = morphTargetNames.filter((name) => !meshMorphNames.includes(name));
      return [mesh.name || "(unnamed face mesh)", meshMissingMorphs];
    })
  );
  const groupedMorphNameSet =
    groupedFaceMeshes.length > 0
      ? groupedFaceMeshes.reduce<Set<string>>((current, mesh, index) => {
          const meshMorphNames = new Set(Object.keys(mesh.morphTargetDictionary ?? {}));
          if (index === 0) return meshMorphNames;
          return new Set([...current].filter((name) => meshMorphNames.has(name)));
        }, new Set<string>())
      : new Set<string>();
  const groupedMorphNames = [...groupedMorphNameSet].sort();

  return {
    meshCount,
    skinnedMeshCount,
    faceMeshCandidates: faceCandidates.map((mesh) => mesh.name || "(unnamed face mesh)"),
    selectedFaceMesh,
    groupedFaceMeshes,
    groupedFaceMeshNames,
    groupedMorphNames,
    groupedMissingMorphsByMesh,
    hairMeshCandidates: hairCandidates.map((mesh) => mesh.name || "(unnamed hair mesh)"),
    selectedHairMesh: hairCandidates[0] ?? null,
    bodyMeshCandidates: bodyCandidates.map((mesh) => mesh.name || "(unnamed body mesh)"),
    selectedBodyMesh: bodyCandidates[0] ?? null,
    morphTargetNames,
    missingRequiredMorphs,
  };
}
