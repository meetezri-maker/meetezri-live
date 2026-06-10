import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";

export function applySaraV3MaterialFixes(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean
    );
    materials.forEach((material: any) => {
      material.side = SARA_V3_AVATAR_DEFINITION.saraV3.materialFixConfig.doubleSided
        ? THREE.DoubleSide
        : material.side;
      material.depthWrite = SARA_V3_AVATAR_DEFINITION.saraV3.materialFixConfig.forceDepthWrite;
      material.depthTest = SARA_V3_AVATAR_DEFINITION.saraV3.materialFixConfig.forceDepthTest;
      material.needsUpdate = true;
    });
  });
}
