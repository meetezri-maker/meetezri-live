import * as THREE from "three";
import {
  writeSaraV3Diagnostics,
  writeSaraV3RawAudit,
  writeSaraV3RenderAudit,
} from "./saraV3Diagnostics";
import type { SaraV3MaterialAudit, SaraV3TextureAudit } from "./saraV3Types";

function vectorToTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function eulerToTuple(euler: THREE.Euler): [number, number, number] {
  return [euler.x, euler.y, euler.z];
}

function toneMappingToString(toneMapping: THREE.ToneMapping): string {
  const toneMappingNames: Record<number, string> = {
    [THREE.NoToneMapping]: "NoToneMapping",
    [THREE.LinearToneMapping]: "LinearToneMapping",
    [THREE.ReinhardToneMapping]: "ReinhardToneMapping",
    [THREE.CineonToneMapping]: "CineonToneMapping",
    [THREE.ACESFilmicToneMapping]: "ACESFilmicToneMapping",
    [THREE.NeutralToneMapping]: "NeutralToneMapping",
    [THREE.AgXToneMapping]: "AgXToneMapping",
    [THREE.CustomToneMapping]: "CustomToneMapping",
  };
  return toneMappingNames[toneMapping] ?? String(toneMapping);
}

function sideToString(side: number | undefined): string | null {
  if (side === THREE.FrontSide) return "FrontSide";
  if (side === THREE.BackSide) return "BackSide";
  if (side === THREE.DoubleSide) return "DoubleSide";
  return side == null ? null : String(side);
}

function textureColorSpaceToString(texture: THREE.Texture | null | undefined): string | null {
  if (!texture) return null;
  return texture.colorSpace ?? null;
}

function textureEncodingToString(texture: THREE.Texture | null | undefined): string | null {
  if (!texture) return null;
  return "encoding" in texture && texture.encoding != null ? String(texture.encoding) : null;
}

function collectTextureAudit(material: THREE.Material): SaraV3TextureAudit[] {
  const texturedMaterial = material as THREE.Material & Record<string, THREE.Texture | null | undefined>;
  const textureSlots = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "alphaMap",
    "emissiveMap",
  ];
  return textureSlots
    .map((slot) => {
      const texture = texturedMaterial[slot];
      if (!texture || !(texture as THREE.Texture).isTexture) return null;
      return {
        slot,
        textureName: texture.name || null,
        colorSpace: textureColorSpaceToString(texture),
        encoding: textureEncodingToString(texture),
        flipY: typeof texture.flipY === "boolean" ? texture.flipY : null,
      };
    })
    .filter((entry): entry is SaraV3TextureAudit => entry !== null);
}

function classifyMeshCategory(meshName: string, materialName: string): {
  hair: boolean;
  face: boolean;
  eye: boolean;
  clothing: boolean;
} {
  const searchable = `${meshName} ${materialName}`.toLowerCase();
  return {
    hair:
      /(hair|brow|lash|scalp|strand|groom)/.test(searchable),
    face:
      /(face|head|skin|mouth|teeth|tongue|cheek|nose|ear)/.test(searchable),
    eye:
      /(eye|iris|cornea|pupil|sclera|tear)/.test(searchable),
    clothing:
      /(shirt|cloth|clothes|jacket|coat|dress|hoodie|sweater|button|fabric|pant|skirt)/.test(
        searchable
      ),
  };
}

function collectMaterialAudit(
  meshName: string,
  renderOrder: number,
  material: THREE.Material
): SaraV3MaterialAudit {
  const standardMaterial = material as THREE.MeshStandardMaterial & {
    envMapIntensity?: number;
    reflectivity?: number;
  };
  return {
    meshName,
    materialName: material.name || "(unnamed material)",
    materialType: material.type || "(unknown material type)",
    transparent: typeof material.transparent === "boolean" ? material.transparent : null,
    opacity: typeof material.opacity === "number" ? material.opacity : null,
    alphaTest: typeof material.alphaTest === "number" ? material.alphaTest : null,
    depthWrite: typeof material.depthWrite === "boolean" ? material.depthWrite : null,
    depthTest: typeof material.depthTest === "boolean" ? material.depthTest : null,
    side: sideToString(material.side),
    renderOrder,
    roughness: typeof standardMaterial.roughness === "number" ? standardMaterial.roughness : null,
    metalness: typeof standardMaterial.metalness === "number" ? standardMaterial.metalness : null,
    envMapIntensity:
      typeof standardMaterial.envMapIntensity === "number" ? standardMaterial.envMapIntensity : null,
    reflectivity:
      typeof standardMaterial.reflectivity === "number" ? standardMaterial.reflectivity : null,
    color: standardMaterial.color?.getHexString?.() ?? null,
    textures: collectTextureAudit(material),
  };
}

export function runSaraV3RawRenderAudit(args: {
  root: THREE.Group;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  modelUrl: string;
  cameraAppliedInRawAudit?: boolean;
  cameraConfigSource?: string | null;
  cameraLookAt?: THREE.Vector3 | null;
}) {
  const meshNames: string[] = [];
  const materialNames = new Set<string>();
  const materialTypes = new Set<string>();
  const morphTargetNamesByMesh: Record<string, string[]> = {};
  const materialAudit: SaraV3MaterialAudit[] = [];
  const hairMaterialAudit: SaraV3MaterialAudit[] = [];
  const faceMaterialAudit: SaraV3MaterialAudit[] = [];
  const eyeMaterialAudit: SaraV3MaterialAudit[] = [];
  const clothingMaterialAudit: SaraV3MaterialAudit[] = [];
  const textureAudit: SaraV3TextureAudit[] = [];
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let totalMorphTargetCount = 0;

  console.log("SaraV3 raw scene", args.root);

  args.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const skinnedMesh = child as THREE.SkinnedMesh;
    if (!mesh.isMesh && !skinnedMesh.isSkinnedMesh) return;

    const meshName = child.name || "(unnamed mesh)";
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
    const morphTargetNames = Object.keys(mesh.morphTargetDictionary ?? {});

    meshCount += mesh.isMesh ? 1 : 0;
    skinnedMeshCount += skinnedMesh.isSkinnedMesh ? 1 : 0;
    meshNames.push(meshName);
    morphTargetNamesByMesh[meshName] = morphTargetNames;
    totalMorphTargetCount += morphTargetNames.length;

    materials.forEach((material) => {
      materialNames.add(material.name || "(unnamed material)");
      materialTypes.add(material.type || "(unknown material type)");
      const entry = collectMaterialAudit(meshName, child.renderOrder, material);
      materialAudit.push(entry);
      textureAudit.push(...entry.textures);
      const category = classifyMeshCategory(meshName, entry.materialName);
      if (category.hair) hairMaterialAudit.push(entry);
      if (category.face) faceMaterialAudit.push(entry);
      if (category.eye) eyeMaterialAudit.push(entry);
      if (category.clothing) clothingMaterialAudit.push(entry);
    });

    console.log("[SaraV3 raw mesh]", {
      name: meshName,
      type: child.type,
      visible: child.visible,
      position: vectorToTuple(child.position),
      scale: vectorToTuple(child.scale),
      rotation: eulerToTuple(child.rotation),
      material: materials.map((material) => ({
        name: material.name || "(unnamed material)",
        type: material.type || "(unknown material type)",
      })),
      morphTargetDictionary: mesh.morphTargetDictionary ?? null,
      morphTargetInfluencesLength: mesh.morphTargetInfluences?.length ?? 0,
    });
  });

  const boundingBox = new THREE.Box3().setFromObject(args.root);
  const hasBounds = Number.isFinite(boundingBox.min.x) && !boundingBox.isEmpty();
  const boxSize = hasBounds ? boundingBox.getSize(new THREE.Vector3()) : null;
  const boxCenter = hasBounds ? boundingBox.getCenter(new THREE.Vector3()) : null;

  const lightsSummary: Array<{
    name: string;
    type: string;
    intensity: number | null;
    color: string | null;
    position: [number, number, number] | null;
  }> = [];

  args.scene.traverse((child) => {
    const light = child as THREE.Light;
    if (!light.isLight) return;
    const position =
      "position" in light ? vectorToTuple((light as THREE.Object3D).position) : null;
    lightsSummary.push({
      name: light.name || "(unnamed light)",
      type: light.type,
      intensity: typeof light.intensity === "number" ? light.intensity : null,
      color: light.color?.getHexString?.() ?? null,
      position,
    });
  });

  writeSaraV3Diagnostics({
    saraV3Loaded: true,
    modelUrl: args.modelUrl,
    rootName: args.root.name || null,
    meshCount,
    skinnedMeshCount,
    faceMeshCandidates: [],
    selectedFaceMesh: null,
    hairMeshCandidates: [],
    bodyMeshCandidates: [],
    morphTargetNames: [...new Set(Object.values(morphTargetNamesByMesh).flat())].sort(),
    hasJawOpen: Object.values(morphTargetNamesByMesh).some((names) => names.includes("jawOpen")),
    hasVisemeAA: Object.values(morphTargetNamesByMesh).some((names) => names.includes("viseme_AA")),
    hasEyeBlinkLeft: Object.values(morphTargetNamesByMesh).some((names) =>
      names.includes("eyeBlinkLeft")
    ),
    hasEyeBlinkRight: Object.values(morphTargetNamesByMesh).some((names) =>
      names.includes("eyeBlinkRight")
    ),
    missingRequiredMorphs: [],
  });

  const sceneEnvironment = args.scene.environment;
  const sceneBackground = args.scene.background;
  const physicallyCorrectLights =
    typeof (args.renderer as THREE.WebGLRenderer & { physicallyCorrectLights?: boolean })
      .physicallyCorrectLights === "boolean"
      ? (args.renderer as THREE.WebGLRenderer & { physicallyCorrectLights?: boolean })
          .physicallyCorrectLights ?? null
      : null;

  writeSaraV3RenderAudit({
    rendererSettings: {
      outputColorSpace: args.renderer.outputColorSpace ?? null,
      toneMapping: toneMappingToString(args.renderer.toneMapping),
      toneMappingExposure: args.renderer.toneMappingExposure ?? null,
      physicallyCorrectLights,
    },
    environmentAudit: {
      sceneEnvironmentType: sceneEnvironment?.type ?? null,
      sceneBackgroundType:
        sceneBackground && "type" in sceneBackground ? String(sceneBackground.type) : null,
      environmentAssignedToScene: Boolean(sceneEnvironment),
      backgroundAssignedToScene: Boolean(sceneBackground),
      pmremGeneratorUsed: Boolean(args.scene.userData.saraV3PmremGeneratorUsed),
      hdriUsed: Boolean(args.scene.userData.saraV3HdrEnvironmentUsed),
      environmentIntensity:
        typeof (args.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity ===
        "number"
          ? (args.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity ?? null
          : null,
    },
    materialAudit,
    hairMaterialAudit,
    faceMaterialAudit,
    eyeMaterialAudit,
    clothingMaterialAudit,
    textureAudit,
    exposureSweepPlan: {
      currentExposure: args.renderer.toneMappingExposure ?? null,
      plannedValues: [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5],
      automationAvailable: typeof window !== "undefined",
    },
  });

  writeSaraV3RawAudit({
    rawRenderAuditMode: true,
    cameraAppliedInRawAudit: args.cameraAppliedInRawAudit ?? false,
    cameraConfigSource: args.cameraConfigSource ?? null,
    modelUrl: args.modelUrl,
    sceneObject: args.root.type,
    sceneName: args.root.name || null,
    childCount: args.root.children.length,
    meshCount,
    skinnedMeshCount,
    meshNames,
    materialNames: [...materialNames].sort(),
    materialTypes: [...materialTypes].sort(),
    morphTargetNamesByMesh,
    totalMorphTargetCount,
    boundingBox: hasBounds
      ? {
          min: vectorToTuple(boundingBox.min),
          max: vectorToTuple(boundingBox.max),
        }
      : null,
    boundingBoxSize: boxSize ? vectorToTuple(boxSize) : null,
    boundingBoxCenter: boxCenter ? vectorToTuple(boxCenter) : null,
    rootPosition: vectorToTuple(args.root.position),
    rootRotation: eulerToTuple(args.root.rotation),
    rootScale: vectorToTuple(args.root.scale),
    cameraPosition: vectorToTuple(args.camera.position),
    cameraLookAt: args.cameraLookAt ? vectorToTuple(args.cameraLookAt) : null,
    cameraFov: args.camera.fov ?? null,
    cameraNear: args.camera.near ?? null,
    cameraFar: args.camera.far ?? null,
    cameraRotation: eulerToTuple(args.camera.rotation),
    rendererOutputColorSpace: args.renderer.outputColorSpace ?? null,
    rendererToneMapping: toneMappingToString(args.renderer.toneMapping),
    rendererExposure: args.renderer.toneMappingExposure ?? null,
    environmentExists: Boolean(args.scene.environment),
    lightsSummary,
  });

  if (typeof window !== "undefined") {
    const originalExposure = args.renderer.toneMappingExposure;
    window.saraV3RenderAuditTools = {
      setExposure: (value: number) => {
        args.renderer.toneMappingExposure = value;
        args.renderer.render(args.scene, args.camera);
        writeSaraV3RenderAudit({
          exposureSweepPlan: {
            currentExposure: value,
            plannedValues: [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5],
            automationAvailable: true,
          },
        });
        return {
          exposure: value,
          screenshotDataUrl: args.renderer.domElement.toDataURL("image/png"),
        };
      },
      resetExposure: () => {
        args.renderer.toneMappingExposure = originalExposure;
        args.renderer.render(args.scene, args.camera);
        writeSaraV3RenderAudit({
          exposureSweepPlan: {
            currentExposure: originalExposure,
            plannedValues: [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5],
            automationAvailable: true,
          },
        });
        return { exposure: originalExposure };
      },
      runExposureSweep: () => {
        const values = [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
        const results = values.map((value) => {
          args.renderer.toneMappingExposure = value;
          args.renderer.render(args.scene, args.camera);
          return {
            exposure: value,
            screenshotDataUrl: args.renderer.domElement.toDataURL("image/png"),
          };
        });
        args.renderer.toneMappingExposure = originalExposure;
        args.renderer.render(args.scene, args.camera);
        writeSaraV3RenderAudit({
          exposureSweepPlan: {
            currentExposure: originalExposure,
            plannedValues: values,
            automationAvailable: true,
          },
        });
        return {
          originalExposure,
          results,
        };
      },
    };
  }
}
