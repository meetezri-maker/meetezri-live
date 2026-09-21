import type { Object3D, SkinnedMesh, Mesh } from "three";
import { clampAvatarMorph } from "../../mappings/avatarBlendshapeConfig";
import { resolveMorphBindings, type AvatarModelConfig } from "../../mappings/avatarModelConfig";
import { warnOnce } from "../../utils/logger";

export interface MorphTargetMeshInfo { meshName: string; morphTargets: string[]; count: number; }

export interface MorphTargetBindingInfo {
  meshName: string;
  morphIndex: number;
  influence: number;
  /** Largest vertex displacement this target produces, in model units. */
  maxDelta: number;
}

/** Largest displacement below which a morph target cannot produce visible movement. */
const DEAD_TARGET_EPSILON = 1e-4;

const maxMorphDelta = (mesh: Mesh | SkinnedMesh, index: number) => {
  const attribute = mesh.geometry?.morphAttributes?.position?.[index];
  if (!attribute) return 0;
  const array = attribute.array as ArrayLike<number>;
  let max = 0;
  for (let i = 0; i < array.length; i += 3) {
    const magnitude = Math.abs(array[i]) + Math.abs(array[i + 1]) + Math.abs(array[i + 2]);
    if (magnitude > max) max = magnitude;
  }
  return max;
};

export interface MorphRuntimeSupport {
  discoveredMorphCount: number;
  meshCount: number;
  faceMeshFound: boolean;
  missingMappings: string[];
  unsupportedMappings: string[];
  blinkSupport: "Supported" | "Partial" | "Missing";
  lipSyncSupport: "Supported" | "Partial" | "Missing";
  bilabialSupport: "Supported" | "Partial" | "Missing";
}

const requiredLipSyncMorphs = ["jawOpen", "mouthClose", "mouthFunnel", "mouthPucker"];
const requiredBlinkMorphs = ["eyeBlinkLeft", "eyeBlinkRight"];
const hasFiniteValue = (value: number) => Number.isFinite(value) && value > 0;

export class MorphTargetController {
  private targets = new Map<string, Array<{ influences: number[]; index: number; meshName: string; maxDelta: number }>>();
  private config?: AvatarModelConfig;
  private signedTargets = new Set<string>();
  private liveDeltas = new Map<string, number>();
  private support: MorphRuntimeSupport = {
    discoveredMorphCount: 0,
    meshCount: 0,
    faceMeshFound: false,
    missingMappings: [],
    unsupportedMappings: [],
    blinkSupport: "Missing",
    lipSyncSupport: "Missing",
    bilabialSupport: "Missing"
  };

  discover(root: Object3D, config?: AvatarModelConfig): MorphTargetMeshInfo[] {
    this.config = config;
    this.signedTargets = new Set(config?.signedMorphTargets ?? []);
    this.targets.clear();
    const meshes: MorphTargetMeshInfo[] = [];
    this.liveDeltas.clear();
    root.traverse((object) => {
      const mesh = object as Mesh | SkinnedMesh;
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      const names = Object.keys(mesh.morphTargetDictionary);
      const meshName = mesh.name || "unnamed";
      meshes.push({ meshName, morphTargets: names, count: names.length });
      for (const name in mesh.morphTargetDictionary) {
        const index = mesh.morphTargetDictionary[name];
        const bucket = this.targets.get(name) ?? [];
        // Measure the target's real geometry travel once at load. A target that is
        // declared but empty can never render, however large a value we write.
        const maxDelta = maxMorphDelta(mesh, index);
        bucket.push({ influences: mesh.morphTargetInfluences as number[], index, meshName, maxDelta });
        this.targets.set(name, bucket);
        this.liveDeltas.set(name, Math.max(this.liveDeltas.get(name) ?? 0, maxDelta));
      }
    });
    for (const [name, delta] of this.liveDeltas) {
      if (delta <= DEAD_TARGET_EPSILON) {
        warnOnce(`dead-morph:${name}`, `Morph target ${name} carries no geometry on any mesh and cannot render`);
      }
    }
    this.support = this.createSupport(meshes);
    return meshes;
  }

  names() { return [...this.targets.keys()].sort(); }

  /** Targets that carry real geometry and can therefore render. */
  liveTargetNames() {
    return [...this.liveDeltas.entries()].filter(([, delta]) => delta > DEAD_TARGET_EPSILON).map(([name]) => name).sort();
  }

  /** Targets declared by the asset that carry no geometry on any mesh. */
  deadTargetNames() {
    return [...this.liveDeltas.entries()].filter(([, delta]) => delta <= DEAD_TARGET_EPSILON).map(([name]) => name).sort();
  }

  /** Resolved mesh, index and current influence for a target, for final-value diagnostics. */
  inspect(targetName: string): MorphTargetBindingInfo[] {
    const entries = this.targets.get(targetName);
    if (!entries) return [];
    return entries.map((entry) => ({
      meshName: entry.meshName,
      morphIndex: entry.index,
      influence: entry.influences[entry.index],
      maxDelta: entry.maxDelta
    }));
  }

  getSupport() {
    return {
      ...this.support,
      missingMappings: [...this.support.missingMappings],
      unsupportedMappings: [...this.support.unsupportedMappings]
    };
  }

  write(pose: Record<string, number>) {
    const resolved = new Map<string, number>();
    const config = this.config;
    const signed = this.signedTargets;
    for (const name in pose) {
      const inputValue = pose[name];
      if (!Number.isFinite(inputValue)) {
        warnOnce(`invalid-morph-value:${name}`, `Ignoring invalid morph target value for ${name}`);
        continue;
      }
      const bindings = config ? resolveMorphBindings(config, name) : [{ target: name }];
      if (!bindings.length) continue;
      for (const binding of bindings) {
        if (signed.has(binding.target)) {
          // Signed targets carry direction in the sign, so contributions are summed
          // rather than max-combined and negative influence is preserved.
          const raw = inputValue * (binding.weight ?? 1);
          if (!Number.isFinite(raw) || raw === 0) continue;
          resolved.set(binding.target, (resolved.get(binding.target) ?? 0) + raw);
          continue;
        }
        const value = clampAvatarMorph(name, inputValue * (binding.weight ?? 1));
        if (!hasFiniteValue(value)) continue;
        resolved.set(binding.target, Math.max(resolved.get(binding.target) ?? 0, value));
      }
    }

    for (const [targetName, entries] of this.targets) {
      const raw = resolved.get(targetName) ?? 0;
      const finalValue = signed.has(targetName)
        ? Math.min(Math.max(raw, -1), 1)
        : Math.min(Math.max(raw, 0), 1);
      for (const entry of entries) entry.influences[entry.index] = finalValue;
    }

    for (const targetName of resolved.keys()) {
      if (!this.targets.has(targetName)) warnOnce(`missing-morph:${targetName}`, `Missing morph target ${targetName}`);
    }
  }

  reset() { for (const entries of this.targets.values()) for (const entry of entries) entry.influences[entry.index] = 0; }

  private createSupport(meshes: MorphTargetMeshInfo[]): MorphRuntimeSupport {
    const config = this.config;
    const missingMappings: string[] = [];
    const unsupportedMappings: string[] = [];
    if (config) {
      for (const [canonicalName, bindings] of Object.entries(config.morphMapping)) {
        if (!bindings.length) {
          unsupportedMappings.push(canonicalName);
          continue;
        }
        const missingTargets = bindings.filter((binding) => !this.targets.has(binding.target)).map((binding) => binding.target);
        if (missingTargets.length) missingMappings.push(`${canonicalName}->${missingTargets.join("+")}`);
      }
    }
    const faceMeshNames = new Set(config?.meshNames.face ?? []);
    const faceMeshFound = meshes.some((mesh) => faceMeshNames.has(mesh.meshName));
    const hasBinding = (canonicalName: string) => {
      const bindings = config ? resolveMorphBindings(config, canonicalName) : [{ target: canonicalName }];
      return bindings.length > 0 && bindings.some((binding) => this.targets.has(binding.target));
    };
    const blinkCount = requiredBlinkMorphs.filter(hasBinding).length;
    const lipCount = requiredLipSyncMorphs.filter(hasBinding).length;
    return {
      discoveredMorphCount: this.targets.size,
      meshCount: meshes.length,
      faceMeshFound: config ? faceMeshFound : meshes.length > 0,
      missingMappings,
      unsupportedMappings,
      blinkSupport: blinkCount === requiredBlinkMorphs.length ? "Supported" : blinkCount > 0 ? "Partial" : "Missing",
      lipSyncSupport: lipCount === requiredLipSyncMorphs.length ? "Supported" : lipCount > 0 ? "Partial" : "Missing",
      bilabialSupport: config?.bilabial.status === "Supported" ? "Supported" : config?.bilabial.status === "Partial" ? "Partial" : "Missing"
    };
  }
}