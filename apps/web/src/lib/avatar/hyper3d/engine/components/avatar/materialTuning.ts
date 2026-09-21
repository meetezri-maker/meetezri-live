import { Color, MeshPhysicalMaterial, MeshStandardMaterial, type Mesh, type Object3D } from "three";
import type { RenderMaterialTuning } from "../../mappings/femaleRenderPresets";

/** Authored values captured before any tuning, so tuning can always be reverted. */
export interface AuthoredMaterialSnapshot {
  envMapIntensity: number;
  metalness: number;
  color: number;
}

/** Per-eye-mesh pair of the GLB's own material and its corneal variant. */
export interface EyeMaterialPair {
  authored: MeshStandardMaterial;
  corneal: MeshPhysicalMaterial;
}

/**
 * Builds the corneal (clearcoat) variant of the eye material.
 *
 * `MeshPhysicalMaterial.copy(source)` cannot be used here: it unconditionally runs
 * `this.clearcoatNormalScale.copy(source.clearcoatNormalScale)`, and
 * `clearcoatNormalScale` does not exist on `MeshStandardMaterial`. That reads `.x`
 * of `undefined` and throws, taking the whole Canvas down.
 *
 * Running the MeshStandardMaterial copy chain against the physical instance copies
 * every standard field (maps, normalScale, vertexColors, side, transparency) while
 * leaving the physical-only fields at their constructor defaults. That copy also
 * overwrites `defines` with `{ STANDARD: "" }`, so the physical defines are restored
 * afterwards or the shader would compile without clearcoat support.
 */
export const createCornealMaterial = (source: MeshStandardMaterial): MeshPhysicalMaterial => {
  const corneal = new MeshPhysicalMaterial();
  const physicalDefines = { ...(corneal.defines ?? {}) };
  MeshStandardMaterial.prototype.copy.call(corneal, source);
  corneal.defines = physicalDefines;
  corneal.name = `${source.name} (corneal)`;
  return corneal;
};

/** Applies female render-preset material tuning. Throws only on genuine bugs. */
export const applyMaterialTuning = (
  scene: Object3D,
  materialTuning: RenderMaterialTuning | undefined,
  snapshot: Map<string, AuthoredMaterialSnapshot>,
  eyeMaterials: Map<string, EyeMaterialPair>
) => {
  const eyeTuning = materialTuning?.eye;
  /**
   * Every spelling of the eyeball material on this asset. See
   * `RenderMaterialTuning.eyeMaterialNames` for why a set is needed at all.
   */
  const eyeNames = new Set(materialTuning?.eyeMaterialNames ?? (eyeTuning ? [eyeTuning.materialName] : []));

  // Swap the eye material first so everything below operates on the active one.
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const current = mesh.material as MeshStandardMaterial;
    const pair = eyeMaterials.get(mesh.uuid);
    const isEye = pair ? true : Boolean(current?.name && eyeNames.has(current.name));
    if (!isEye || !eyeTuning) return;

    let entry = pair;
    if (!entry) {
      const corneal = createCornealMaterial(current);
      entry = { authored: current, corneal };
      eyeMaterials.set(mesh.uuid, entry);
    }

    if (eyeTuning.enabled && materialTuning?.enabled) {
      entry.corneal.roughness = eyeTuning.roughness;
      entry.corneal.clearcoat = eyeTuning.clearcoat;
      entry.corneal.clearcoatRoughness = eyeTuning.clearcoatRoughness;
      entry.corneal.ior = eyeTuning.ior;
      entry.corneal.color.set(new Color(eyeTuning.color));
      entry.corneal.needsUpdate = true;
      mesh.material = entry.corneal;
    } else {
      mesh.material = entry.authored;
    }
  });

  const materials: MeshStandardMaterial[] = [];
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    if (!material || materials.includes(material)) return;
    materials.push(material);
    if (!snapshot.has(material.uuid)) {
      snapshot.set(material.uuid, {
        envMapIntensity: material.envMapIntensity ?? 1,
        metalness: material.metalness ?? 0,
        color: material.color?.getHex() ?? 0xffffff
      });
    }
  });

  for (const material of materials) {
    const authored = snapshot.get(material.uuid);
    if (!authored) continue;
    if (!materialTuning?.enabled) {
      material.envMapIntensity = authored.envMapIntensity;
      material.metalness = authored.metalness;
      material.color?.setHex(authored.color);
      material.needsUpdate = true;
      continue;
    }
    // The corneal variant is named "<original> (corneal)", so match on the prefix.
    const lookup = material.name.replace(/ \(corneal\)$/, "");
    const intensity = materialTuning.envMapIntensityByMaterial[lookup];
    material.envMapIntensity = intensity ?? authored.envMapIntensity;
    if (eyeNames.has(material.name) || eyeNames.has(lookup)) {
      // Colour is owned by the eye block above; do not overwrite it here.
      material.metalness = authored.metalness;
    } else if (material.name === materialTuning.hairMaterialName) {
      material.metalness = materialTuning.hairMetalness;
      material.color?.set(new Color(materialTuning.hairColor));
      // Absent leaves the authored roughness, which is Female.228's behaviour.
      if (materialTuning.hairRoughness !== undefined) material.roughness = materialTuning.hairRoughness;
    } else {
      material.metalness = authored.metalness;
      material.color?.setHex(authored.color);
    }
    material.needsUpdate = true;
  }
};
