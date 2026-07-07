import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";

type SaraV3EnvironmentHandle = {
  source: string;
  dispose: () => void;
};

type CategoryMetrics = {
  pixelCount: number;
  averageLuma: number | null;
  lumaStdDev: number | null;
  lumaP95: number | null;
};

function captureCanvasImageData(renderer: THREE.WebGLRenderer): ImageData | null {
  if (typeof document === "undefined") return null;
  const source = renderer.domElement;
  if (source.width <= 0 || source.height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function captureCanvasDataUrl(renderer: THREE.WebGLRenderer): string | null {
  try {
    return renderer.domElement.toDataURL("image/png");
  } catch {
    return null;
  }
}

export type SaraV3MaterialCategory = "face" | "eyes" | "hair" | "clothing";

/**
 * Single source of truth for SaraV3 material→category matching. Matched against
 * the material's exact (lowercased) name from the current sara-v3.glb.
 *
 * Anchored (`^...$`) so "material.002" (hair) does NOT collide with the
 * substring inside "unrealmaterial.002" (teeth).
 *
 *   face  : UnrealMaterial.001 (face skin), UnrealMaterial.002 (teeth),
 *           UnrealMaterial.006 (eye occlusion/moisture shell)
 *   eyes  : UnrealMaterial.004
 *   hair  : Material.002 (alpha-carded strands, BLEND),
 *           Material.001 (brow/lash geometry, incl. the standalone eyelash
 *           meshes Object_0 / Object_0.001 added in the July 2026 re-export)
 *   cloth : Wolf3D_Outfit_Bottom, Wolf3D_Outfit_Top, Wolf3D_Outfit_Footwear,
 *           Wolf3D_Body
 *
 * NOTE (July 2026): the designer's eyelash re-export renamed EVERY material
 * (old: UnrealMaterial.003/005/007/008, Material.005/006, Bottom/Body/
 * Footwear/Top.002). Role mapping was verified by primitive order + authored
 * alphaMode/extensions in the GLB audit. Update here if the GLB is re-exported
 * again — still the single shared matcher, no parallel system.
 */
export function materialCategoryMatches(
  materialName: string,
  category: SaraV3MaterialCategory
) {
  const name = (materialName || "").toLowerCase();
  if (category === "face") {
    return /^unrealmaterial\.(001|002|006)$/.test(name);
  }
  if (category === "eyes") {
    return /^unrealmaterial\.004$/.test(name);
  }
  if (category === "hair") {
    return /^material\.(001|002)$/.test(name);
  }
  return /^(wolf3d_outfit_(bottom|top|footwear)|wolf3d_body)$/.test(name);
}

function computeCategoryMask(args: {
  root: THREE.Object3D;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  category: "face" | "eyes" | "hair" | "clothing";
}): Uint8ClampedArray | null {
  const originalBackground = args.scene.background;
  const originalEnvironment = args.scene.environment;
  const replacements = new Map<
    THREE.Object3D,
    {
      original: THREE.Material | THREE.Material[];
      temporary: THREE.Material | THREE.Material[];
    }
  >();

  args.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const originalMaterial = mesh.material;
    const originalMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
    const temporaryMaterials = originalMaterials.map((material) => {
      const active = materialCategoryMatches(material.name || "", args.category);
      return new THREE.MeshBasicMaterial({
        color: active ? 0xffffff : 0x000000,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    });
    replacements.set(child, {
      original: originalMaterial,
      temporary: Array.isArray(originalMaterial) ? temporaryMaterials : temporaryMaterials[0],
    });
    mesh.material = replacements.get(child)!.temporary;
  });

  args.scene.background = new THREE.Color(0x000000);
  args.scene.environment = null;
  args.renderer.render(args.scene, args.camera);
  const imageData = captureCanvasImageData(args.renderer);

  replacements.forEach((value, object) => {
    const mesh = object as THREE.Mesh;
    const temporaryMaterials = Array.isArray(value.temporary) ? value.temporary : [value.temporary];
    temporaryMaterials.forEach((material) => material.dispose());
    mesh.material = value.original;
  });

  args.scene.background = originalBackground;
  args.scene.environment = originalEnvironment;

  return imageData?.data ?? null;
}

function computeMetricsFromMask(imageData: ImageData | null, mask: Uint8ClampedArray | null): CategoryMetrics {
  if (!imageData || !mask) {
    return {
      pixelCount: 0,
      averageLuma: null,
      lumaStdDev: null,
      lumaP95: null,
    };
  }

  const luminances: number[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    if (mask[index] < 200) continue;
    const r = imageData.data[index] ?? 0;
    const g = imageData.data[index + 1] ?? 0;
    const b = imageData.data[index + 2] ?? 0;
    luminances.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }

  if (luminances.length === 0) {
    return {
      pixelCount: 0,
      averageLuma: null,
      lumaStdDev: null,
      lumaP95: null,
    };
  }

  const average = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance =
    luminances.reduce((sum, value) => sum + (value - average) * (value - average), 0) /
    luminances.length;
  const sorted = [...luminances].sort((left, right) => left - right);
  const percentileIndex = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * 0.95))
  );

  return {
    pixelCount: luminances.length,
    averageLuma: average,
    lumaStdDev: Math.sqrt(variance),
    lumaP95: sorted[percentileIndex] ?? null,
  };
}

export function applySaraV3Environment(args: {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
}): SaraV3EnvironmentHandle | null {
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.environmentConfig;
  if (!config.enabled) return null;

  const scene = args.scene;
  const pmremGenerator = new THREE.PMREMGenerator(args.renderer);
  pmremGenerator.compileEquirectangularShader();

  let disposed = false;
  let roomDisposed = false;
  let hdrTarget: THREE.WebGLRenderTarget | null = null;

  const setEnvironmentIntensity = (value: number) => {
    if ("environmentIntensity" in scene) {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = value;
    }
  };

  // Build the RoomEnvironment PMREM first. It is always the initial environment
  // (so the model is never unlit) and remains the fallback if the HDRI fails.
  const roomEnvironment = new RoomEnvironment();
  const roomTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
  const roomIntensity = config.roomEnvironmentIntensity ?? config.intensity;

  const disposeRoom = () => {
    if (roomDisposed) return;
    roomDisposed = true;
    roomTarget.texture.dispose();
    roomTarget.dispose();
    roomEnvironment.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material?.dispose());
      }
    });
  };

  scene.environment = roomTarget.texture;
  scene.userData.saraV3PmremGeneratorUsed = true;
  scene.userData.saraV3HdrEnvironmentUsed = false;
  scene.userData.saraV3EnvironmentSource = "roomEnvironmentPmrem";
  setEnvironmentIntensity(roomIntensity);

  const useHdri =
    config.source === "hdri" && typeof config.url === "string" && config.url.length > 0;

  if (useHdri) {
    new RGBELoader().load(
      config.url as string,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const target = pmremGenerator.fromEquirectangular(texture);
        texture.dispose();
        hdrTarget = target;
        // Swap to the HDRI and retire the RoomEnvironment fallback.
        scene.environment = target.texture;
        scene.userData.saraV3HdrEnvironmentUsed = true;
        scene.userData.saraV3EnvironmentSource = "hdri";
        setEnvironmentIntensity(config.intensity);
        disposeRoom();
      },
      undefined,
      (error) => {
        // HDRI failed — keep the RoomEnvironment fallback already in place.
        console.warn(
          "[SaraV3 environment] HDRI load failed; using RoomEnvironment fallback",
          { url: config.url, error }
        );
        if (!disposed) {
          scene.userData.saraV3EnvironmentSource = "roomEnvironmentPmrem-fallback";
        }
      }
    );
  }

  return {
    // Reflects the configured source; the resolved runtime source is mirrored
    // on scene.userData.saraV3EnvironmentSource ("hdri" once loaded, or
    // "roomEnvironmentPmrem" / "roomEnvironmentPmrem-fallback").
    source: config.source,
    dispose: () => {
      disposed = true;
      if (
        scene.environment === roomTarget.texture ||
        (hdrTarget && scene.environment === hdrTarget.texture)
      ) {
        scene.environment = null;
      }
      delete scene.userData.saraV3EnvironmentSource;
      delete scene.userData.saraV3PmremGeneratorUsed;
      delete scene.userData.saraV3HdrEnvironmentUsed;
      if (hdrTarget) {
        hdrTarget.texture.dispose();
        hdrTarget.dispose();
        hdrTarget = null;
      }
      disposeRoom();
      pmremGenerator.dispose();
    },
  };
}

export function captureSaraV3EnvironmentComparison(args: {
  root: THREE.Object3D;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  applyEnvironment: () => SaraV3EnvironmentHandle | null;
}) {
  const beforeImage = captureCanvasImageData(args.renderer);
  const beforeScreenshotDataUrl = captureCanvasDataUrl(args.renderer);

  const masks = {
    face: computeCategoryMask({ ...args, category: "face" }),
    eyes: computeCategoryMask({ ...args, category: "eyes" }),
    hair: computeCategoryMask({ ...args, category: "hair" }),
    clothing: computeCategoryMask({ ...args, category: "clothing" }),
  };

  const environmentHandle = args.applyEnvironment();
  args.renderer.render(args.scene, args.camera);
  const afterImage = captureCanvasImageData(args.renderer);
  const afterScreenshotDataUrl = captureCanvasDataUrl(args.renderer);

  return {
    beforeScreenshotDataUrl,
    afterScreenshotDataUrl,
    environmentHandle,
    environmentSource: environmentHandle?.source ?? null,
    categories: {
      face: {
        before: computeMetricsFromMask(beforeImage, masks.face),
        after: computeMetricsFromMask(afterImage, masks.face),
      },
      eyes: {
        before: computeMetricsFromMask(beforeImage, masks.eyes),
        after: computeMetricsFromMask(afterImage, masks.eyes),
      },
      hair: {
        before: computeMetricsFromMask(beforeImage, masks.hair),
        after: computeMetricsFromMask(afterImage, masks.hair),
      },
      clothing: {
        before: computeMetricsFromMask(beforeImage, masks.clothing),
        after: computeMetricsFromMask(afterImage, masks.clothing),
      },
    },
  };
}
