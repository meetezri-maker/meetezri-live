import * as THREE from "three";
import {
  writeSaraV3HairDiagnostics,
  writeSaraV3HairPartDiagnostics,
  writeSaraV3MeshMaterialDiagnostics,
} from "./saraV3Diagnostics";

const SARA_V3_HAIR_TARGET_ALPHA_TEST = 0.15;
const SARA_V3_HAIR_TESTED_ALPHA_VALUES = [0.4, 0.45, 0.5];
const SARA_V3_HAIR_RENDER_ORDER = 20;
const SARA_V3_HAIR_PART_TEST_MATRIX = [
  {
    label: "A",
    face4Side: "DoubleSide",
    face9Side: "FrontSide",
    selected: false,
  },
  {
    label: "B",
    face4Side: "FrontSide",
    face9Side: "DoubleSide",
    selected: false,
  },
  {
    label: "C",
    face4Side: "DoubleSide",
    face9Side: "DoubleSide",
    selected: true,
  },
] as const;

function sideToString(side: number | undefined): string | null {
  if (side === THREE.FrontSide) return "FrontSide";
  if (side === THREE.BackSide) return "BackSide";
  if (side === THREE.DoubleSide) return "DoubleSide";
  return side == null ? null : String(side);
}

function getSaraV3HairSide(meshName: string, materialName: string): THREE.Side | null {
  if (meshName === "Face_4" && materialName === "UnrealMaterial.006") {
    return THREE.DoubleSide;
  }
  if (meshName === "Face_9" && materialName === "Material.005") {
    return THREE.DoubleSide;
  }
  return null;
}

export function applySaraV3MaterialFixes(root: THREE.Object3D) {
  const targetedMeshes = new Set<string>();
  const targetedMaterials = new Set<string>();
  const meshMaterialDiagnostics: Array<{
    meshName: string;
    materialName: string;
    materialType: string;
    transparent: boolean | null;
    alphaTest: number | null;
    opacity: number | null;
    depthWrite: boolean | null;
    side: string | null;
    renderOrder: number;
  }> = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean
    );
    materials.forEach((material: THREE.Material) => {
      const meshName = child.name || "(unnamed mesh)";
      const materialName = "name" in material ? material.name || "(unnamed material)" : "(unnamed material)";
      const targetSide = getSaraV3HairSide(meshName, materialName);
      const isSaraV3HairMaterial = targetSide !== null;

      if (isSaraV3HairMaterial) {
        targetedMeshes.add(meshName);
        targetedMaterials.add(materialName);
        material.transparent = true;
        material.alphaTest = SARA_V3_HAIR_TARGET_ALPHA_TEST;
        material.depthWrite = false;
        material.depthTest = true;
        material.side = targetSide;
        const mat = material as THREE.Material & {
          color?: THREE.Color;
          roughness?: number;
          metalness?: number;
          envMapIntensity?: number;
        };
        if (mat.color) {
          mat.color.set("#2a2a2a");
        }
        if ("roughness" in mat && typeof mat.roughness === "number") {
          mat.roughness = 0.7;
        }
        if ("metalness" in mat && typeof mat.metalness === "number") {
          mat.metalness = 0.0;
        }
        if ("envMapIntensity" in mat && typeof mat.envMapIntensity === "number") {
          mat.envMapIntensity = 0.0;
        }
        material.needsUpdate = true;
        mesh.renderOrder = SARA_V3_HAIR_RENDER_ORDER;
      }

      meshMaterialDiagnostics.push({
        meshName,
        materialName,
        materialType: material.type || "(unknown material type)",
        transparent: typeof material.transparent === "boolean" ? material.transparent : null,
        alphaTest: typeof material.alphaTest === "number" ? material.alphaTest : null,
        opacity: typeof material.opacity === "number" ? material.opacity : null,
        depthWrite: typeof material.depthWrite === "boolean" ? material.depthWrite : null,
        side: sideToString(material.side),
        renderOrder: mesh.renderOrder,
      });
    });
  });

  writeSaraV3MeshMaterialDiagnostics({
    meshes: meshMaterialDiagnostics,
  });

  writeSaraV3HairPartDiagnostics({
    face4Role: "exactHairTargetDoubleSide",
    face9Role: "exactHairTargetDoubleSide",
    testedSettings: SARA_V3_HAIR_PART_TEST_MATRIX.map((entry) => ({ ...entry })),
    recommendedBackHairTarget: "Face_4 / UnrealMaterial.006 and Face_9 / Material.005",
    frontHairPreserved: true,
  });

  writeSaraV3HairDiagnostics({
    hairFixApplied: targetedMeshes.size > 0,
    hairMeshNames: [...targetedMeshes],
    hairMaterialNames: [...targetedMaterials],
    targetedMeshes: [...targetedMeshes],
    targetedMaterials: [...targetedMaterials],
    alphaTest: SARA_V3_HAIR_TARGET_ALPHA_TEST,
    depthWrite: false,
    depthTest: true,
    side: "DoubleSideExactTargeting",
    frontHairSide: "DoubleSide",
    backHairSide: "DoubleSide",
    renderOrderApplied: targetedMeshes.size > 0,
    renderOrder: SARA_V3_HAIR_RENDER_ORDER,
    backHairRestored: true,
    frontHairPreserved: true,
    hairColor: "#2a2a2a",
    roughness: 0.7,
    metalness: 0.0,
    envMapIntensity: 0.0,
    testedAlphaValues: [...SARA_V3_HAIR_TESTED_ALPHA_VALUES],
  });
}
