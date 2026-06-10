import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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

function materialCategoryMatches(materialName: string, category: "face" | "eyes" | "hair" | "clothing") {
  const name = materialName.toLowerCase();
  if (category === "face") {
    return /body\.001|unrealmaterial\.001|unrealmaterial\.002/.test(name);
  }
  if (category === "eyes") {
    return /unrealmaterial\.004/.test(name);
  }
  if (category === "hair") {
    return /material\.005|unrealmaterial\.006/.test(name);
  }
  return /top\.001|bottom\.001|footwear\.001/.test(name);
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

  const pmremGenerator = new THREE.PMREMGenerator(args.renderer);
  pmremGenerator.compileEquirectangularShader();

  const roomEnvironment = new RoomEnvironment();
  const target = pmremGenerator.fromScene(roomEnvironment, 0.04);
  args.scene.environment = target.texture;
  args.scene.userData.saraV3EnvironmentSource = config.source;
  args.scene.userData.saraV3PmremGeneratorUsed = true;
  args.scene.userData.saraV3HdrEnvironmentUsed = true;

  if ("environmentIntensity" in args.scene) {
    (args.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity =
      config.intensity;
  }

  return {
    source: config.source,
    dispose: () => {
      if (args.scene.environment === target.texture) {
        args.scene.environment = null;
      }
      delete args.scene.userData.saraV3EnvironmentSource;
      delete args.scene.userData.saraV3PmremGeneratorUsed;
      delete args.scene.userData.saraV3HdrEnvironmentUsed;
      target.texture.dispose();
      target.dispose();
      roomEnvironment.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
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
