import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import {
  writeSaraV3HairDiagnostics,
  writeSaraV3MeshMaterialDiagnostics,
} from "./saraV3Diagnostics";
import { materialCategoryMatches, type SaraV3MaterialCategory } from "./saraV3Environment";

/**
 * A2 — per-category SaraV3 material pass. Replaces the global "band-aid"
 * behavior (force depthWrite/doubleSided on everything) with category-specific
 * rules derived from the GLB audit of the current sara-v3.glb.
 *
 * Runs once after GLTF load. Reuses the single shared matcher
 * `materialCategoryMatches()` from saraV3Environment.ts — no parallel regexes.
 *
 * Per-material decisions (documented, matched by exact material name):
 * Material names updated July 2026 for the eyelash re-export (every material
 * was renamed; roles verified by primitive order + authored alphaMode/extensions):
 *
 *   UnrealMaterial.001  face skin   → opaque, FrontSide, depthWrite (textures untouched)
 *   UnrealMaterial.002  teeth       → opaque, FrontSide, depthWrite (textures untouched)
 *   UnrealMaterial.006  eye shell   → transparent overlay, depthWrite:false. NOT body
 *                                     skin: it is the eye occlusion/moisture shell
 *                                     (authored BLEND + KHR_materials_specular; was
 *                                     UnrealMaterial.008 pre-re-export). Forcing it
 *                                     opaque renders solid pale balls over the
 *                                     eyeballs (the "blank white eyes" bug).
 *   UnrealMaterial.004  eyes        → low roughness clamp + envMap boost, metalness→0, opaque
 *   Material.002        hair strands→ ALPHA-CARDED: transparent, depthWrite:false,
 *                                     DoubleSide, high renderOrder, metalness→0.
 *                                     (Pure alpha blend, no alphaTest: the cards are
 *                                     soft-edged photo hair; alphaTest would fringe them.)
 *   Material.001        brow/lash   → OPAQUE hard geometry (no alpha map): opaque,
 *                                     DoubleSide, depthWrite:true, lower renderOrder.
 *                                     DoubleSide is the invisible-lash fix (thin cards
 *                                     were backface-culled). Also covers the standalone
 *                                     eyelash meshes Object_0 / Object_0.001 (new in
 *                                     the re-export, 0 morph targets).
 *   Wolf3D_Outfit_* / Wolf3D_Body clothing → opaque + depth sanity, side left as authored.
 */

type StdLikeMaterial = THREE.Material & {
  color?: THREE.Color;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
};

const HAIR_STRAND_MATERIAL = "material.002";
const HAIR_INNER_MATERIAL = "material.001";

function sideToString(side: number | undefined): string | null {
  if (side === THREE.FrontSide) return "FrontSide";
  if (side === THREE.BackSide) return "BackSide";
  if (side === THREE.DoubleSide) return "DoubleSide";
  return side == null ? null : String(side);
}

function categoryFor(name: string): SaraV3MaterialCategory | null {
  const categories: SaraV3MaterialCategory[] = ["face", "eyes", "hair", "clothing"];
  for (const category of categories) {
    if (materialCategoryMatches(name, category)) return category;
  }
  return null;
}

export function applySaraV3MaterialPass(root: THREE.Object3D) {
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.materialPassConfig;

  const meshDiagnostics: Array<{
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
  const perCategoryCounts: Record<string, number> = {
    face: 0,
    eyes: 0,
    hair: 0,
    clothing: 0,
    unmatched: 0,
  };
  const hairMaterialNames = new Set<string>();
  const hairMeshNames = new Set<string>();
  const decisions: Array<{ material: string; category: string; decision: string }> = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const meshName = child.name || "(unnamed mesh)";
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean
    ) as THREE.Material[];

    materials.forEach((material) => {
      const rawName = material.name || "";
      const name = rawName.toLowerCase();
      const category = categoryFor(rawName);
      const std = material as StdLikeMaterial;

      if (category === "face") {
        if (name === "unrealmaterial.006") {
          // Eye occlusion/moisture shell over the eyeballs (was
          // UnrealMaterial.008 before the July 2026 eyelash re-export) —
          // authored BLEND in the GLB. Must stay a transparent overlay:
          // forcing it opaque paints solid pale balls over the irises
          // (root cause of the blank-white-eyes bug). Side left as authored.
          material.transparent = true;
          material.opacity = 1;
          material.alphaTest = 0;
          material.depthWrite = false;
          material.depthTest = true;
          perCategoryCounts.face += 1;
          decisions.push({
            material: rawName,
            category,
            decision: "transparent eye-shell overlay (BLEND preserved), depthWrite:false",
          });
        } else {
          // Skin / teeth — solid, single-sided, writes depth.
          material.transparent = false;
          material.opacity = 1;
          material.alphaTest = 0;
          material.side = THREE.FrontSide;
          material.depthWrite = true;
          material.depthTest = true;
          perCategoryCounts.face += 1;
          decisions.push({ material: rawName, category, decision: "opaque/FrontSide/depthWrite" });
        }
      } else if (category === "eyes") {
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.side = THREE.FrontSide;
        material.depthWrite = true;
        material.depthTest = true;
        if (typeof std.roughness === "number") {
          std.roughness = Math.min(std.roughness, config.eyes.roughness);
        }
        if (typeof std.metalness === "number" && std.metalness > 0) {
          std.metalness = 0;
        }
        if ("envMapIntensity" in std) {
          std.envMapIntensity = config.eyes.envMapIntensity;
        }
        perCategoryCounts.eyes += 1;
        decisions.push({
          material: rawName,
          category,
          decision: `roughness<=${config.eyes.roughness}, envMapIntensity=${config.eyes.envMapIntensity}, metalness=0`,
        });
      } else if (category === "hair") {
        hairMaterialNames.add(rawName);
        hairMeshNames.add(meshName);
        // Roughness floor: the re-exported hair ships with low roughness,
        // which reads as a white/gray direct-light sheen on the bang cards.
        if (typeof std.roughness === "number") {
          std.roughness = Math.max(std.roughness, config.hair.minRoughness);
        }
        if (name === HAIR_STRAND_MATERIAL) {
          // Alpha-carded strands → transparent, no depth write, both sides,
          // drawn last. This removes the disappearing-patch artifact.
          material.transparent = true;
          material.opacity = 1;
          material.alphaTest = 0;
          material.depthWrite = false;
          material.depthTest = true;
          material.side = THREE.DoubleSide;
          mesh.renderOrder = config.hair.blendRenderOrder;
          if (typeof std.metalness === "number") std.metalness = config.hair.metalness;
          decisions.push({
            material: rawName,
            category,
            decision: `alpha-blend, depthWrite:false, DoubleSide, renderOrder:${config.hair.blendRenderOrder}, metalness:${config.hair.metalness}, roughness>=${config.hair.minRoughness}`,
          });
        } else {
          // Material.001 and any other hair geometry: opaque hard-edged cards
          // (brows / lashes / inner scalp, incl. the standalone eyelash meshes
          // Object_0 / Object_0.001). Solid, double-sided, writes depth.
          material.transparent = false;
          material.opacity = 1;
          material.alphaTest = 0;
          material.depthWrite = true;
          material.depthTest = true;
          material.side = THREE.DoubleSide;
          mesh.renderOrder = config.hair.innerRenderOrder;
          decisions.push({
            material: rawName,
            category,
            decision: `opaque, DoubleSide, depthWrite:true, renderOrder:${config.hair.innerRenderOrder}, roughness>=${config.hair.minRoughness}`,
          });
        }
        perCategoryCounts.hair += 1;
      } else if (category === "clothing") {
        // Leave textures/side as authored; just enforce opaque depth sanity.
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.depthTest = true;
        perCategoryCounts.clothing += 1;
        decisions.push({ material: rawName, category, decision: "opaque/depthWrite (side as authored)" });
      } else {
        perCategoryCounts.unmatched += 1;
        decisions.push({ material: rawName, category: "unmatched", decision: "left untouched" });
      }

      material.needsUpdate = true;

      meshDiagnostics.push({
        meshName,
        materialName: rawName || "(unnamed material)",
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

  writeSaraV3MeshMaterialDiagnostics({ meshes: meshDiagnostics });
  writeSaraV3HairDiagnostics({
    hairFixApplied: hairMaterialNames.size > 0,
    hairMeshNames: [...hairMeshNames],
    hairMaterialNames: [...hairMaterialNames],
    targetedMeshes: [...hairMeshNames],
    targetedMaterials: [...hairMaterialNames],
    alphaTest: 0,
    depthWrite: false,
    depthTest: true,
    side: "perMaterial(materialPass)",
    frontHairSide: "DoubleSide",
    backHairSide: "DoubleSide",
    renderOrderApplied: hairMaterialNames.size > 0,
    renderOrder: config.hair.blendRenderOrder,
    backHairRestored: true,
    frontHairPreserved: true,
  });

  console.info("[SaraV3 material pass] applied", { perCategoryCounts, decisions });

  if (typeof window !== "undefined") {
    (window as unknown as { saraV3MaterialPassResult?: unknown }).saraV3MaterialPassResult = {
      perCategoryCounts,
      decisions,
      meshes: meshDiagnostics,
    };
  }

  return { perCategoryCounts, decisions };
}
