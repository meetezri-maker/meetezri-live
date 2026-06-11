import type { MorphBinding } from "@/lib/avatar/avatarMorphTypes";
import * as THREE from "three";
import type { SaraV3BindingSet } from "./saraV3Types";

export function bindSaraV3MorphTargets(faceMeshes: readonly THREE.SkinnedMesh[]): SaraV3BindingSet {
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

export function applySaraV3MorphValues(
  bindings: SaraV3BindingSet,
  values: Readonly<Record<string, number>>
) {
  Object.entries(values).forEach(([name, value]) => {
    const morphBindings = bindings.get(name) ?? [];
    morphBindings.forEach(({ mesh, index }) => {
      const influences = mesh.morphTargetInfluences;
      if (!influences || index >= influences.length) return;
      influences[index] = value;
    });
  });
}
