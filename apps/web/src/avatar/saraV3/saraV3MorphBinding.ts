import type { MorphBinding } from "@/lib/avatar/avatarMorphTypes";
import * as THREE from "three";
import type { SaraV3BindingSet } from "./saraV3Types";

export function bindSaraV3MorphTargets(
  faceMeshes: readonly THREE.Mesh[]
): SaraV3BindingSet {
  const bindings = new Map<string, MorphBinding[]>();

  faceMeshes.forEach((faceMesh) => {
    if (!faceMesh?.morphTargetDictionary || !faceMesh.morphTargetInfluences) {
      return;
    }

    Object.entries(faceMesh.morphTargetDictionary).forEach(([name, index]) => {
      const current = bindings.get(name) ?? [];

      current.push({
        mesh: faceMesh,
        index,
        name,
        initialInfluence: faceMesh.morphTargetInfluences?.[index] ?? 0,
      });

      bindings.set(name, current);
    });
  });

  return bindings;
}

// The eyeball geometry lives in a separate primitive/mesh from the face skin
// that the main discovery binds. This finds the mesh(es) whose given morphs
// actually deform geometry (large position deltas), so eyeball-gaze morphs are
// bound to the eye mesh rather than silently written to the skin mesh where
// their deltas are ~0. Meshes without real deltas are skipped.
export function findSaraV3MorphBindingsOnDeformingMeshes(
  root: THREE.Group,
  morphNames: readonly string[],
  minDelta = 0.05
): Map<string, MorphBinding[]> {
  const result = new Map<string, MorphBinding[]>();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
      return;
    }

    morphNames.forEach((name) => {
      const index = mesh.morphTargetDictionary?.[name];
      if (index == null) return;

      const attribute = (mesh.geometry as THREE.BufferGeometry | undefined)?.morphAttributes
        ?.position?.[index];
      if (!attribute) return;

      const array = attribute.array as ArrayLike<number>;
      let maxAbs = 0;
      for (let i = 0; i < array.length; i += 1) {
        const value = Math.abs(array[i]);
        if (value > maxAbs) maxAbs = value;
        if (maxAbs > minDelta) break;
      }
      if (maxAbs <= minDelta) return;

      const list = result.get(name) ?? [];
      list.push({
        mesh,
        index,
        name,
        initialInfluence: mesh.morphTargetInfluences?.[index] ?? 0,
      });
      result.set(name, list);
    });
  });

  return result;
}

export function applySaraV3MorphValues(
  bindings: SaraV3BindingSet,
  values: Readonly<Record<string, number>>
) {
  Object.entries(values).forEach(([name, value]) => {
    const morphBindings = bindings.get(name) ?? [];

    morphBindings.forEach(({ mesh, index }) => {
      const influences = mesh.morphTargetInfluences;

      if (!influences || index >= influences.length) {
        return;
      }

      influences[index] = value;
    });
  });
}