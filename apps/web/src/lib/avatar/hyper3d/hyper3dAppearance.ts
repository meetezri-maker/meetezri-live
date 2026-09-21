import * as THREE from "three";
import {
  applyMaterialTuning,
  type AuthoredMaterialSnapshot,
  type EyeMaterialPair,
} from "./engine/components/avatar/materialTuning";
import {
  FEMALE_229_HAIR_MATERIAL_NAMES,
  HYPER3D_F228_APPEARANCE,
} from "./engine/mappings/avatars/hyper3dAppearanceProfile";
import {
  applyHairAlpha,
  applyHairMap,
  hairAlphaMode,
  normaliseTextureColorSpaces,
} from "./engine/render/pipeline/colorPipeline";

export type Hyper3dAppearanceHandle = {
  lights: THREE.Light[];
  environmentTarget: THREE.WebGLCubeRenderTarget | null;
  dispose(): void;
};

const addRectLightformer = (
  scene: THREE.Scene,
  color: THREE.ColorRepresentation,
  intensity: number,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
) => {
  // drei 10.7.7 Lightformer("rect"), kept literal for the accepted probe.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  scene.add(mesh);
};

const createAcceptedEnvironment = (
  renderer: THREE.WebGLRenderer,
): { target: THREE.WebGLCubeRenderTarget; texture: THREE.CubeTexture } => {
  const config = HYPER3D_F228_APPEARANCE.environment;
  const virtualScene = new THREE.Scene();
  addRectLightformer(virtualScene, "#fff4e6", 3.2, [1.6, 2.2, 2.4], [0, -0.6, 0], [3, 4, 1]);
  addRectLightformer(virtualScene, "#d8e6ff", 1.1, [-2.4, 1.2, 1.8], [0, 0.9, 0], [4, 4, 1]);
  addRectLightformer(virtualScene, "#ffffff", 1.4, [0, 3.2, 0.6], [Math.PI / 2, 0, 0], [5, 2, 1]);
  addRectLightformer(virtualScene, "#e8f1ff", 2.2, [-1.2, 1.9, -2.6], [0, Math.PI - 0.5, 0], [3, 3, 1]);
  addRectLightformer(virtualScene, "#f4efe8", 0.5, [0, -1.6, 1.2], [-Math.PI / 2, 0, 0], [5, 4, 1]);

  const target = new THREE.WebGLCubeRenderTarget(config.resolution);
  target.texture.type = THREE.HalfFloatType;
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, target);
  virtualScene.add(cubeCamera);
  if ((renderer as THREE.WebGLRenderer & { isWebGLRenderer?: boolean }).isWebGLRenderer) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = true;
    try {
      cubeCamera.update(renderer, virtualScene);
    } finally {
      renderer.autoClear = autoClear;
    }
  }

  virtualScene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  });
  return { target, texture: target.texture };
};

export const applyAcceptedHyper3dAppearance = (
  scene: THREE.Object3D,
  hostScene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): Hyper3dAppearanceHandle => {
  const profile = HYPER3D_F228_APPEARANCE;
  const previousBackground = hostScene.background;
  const authored = new Map<string, AuthoredMaterialSnapshot>();
  const eyes = new Map<string, EyeMaterialPair>();
  applyMaterialTuning(scene, profile.materials, authored, eyes);
  normaliseTextureColorSpaces(scene);
  applyHairAlpha(scene, FEMALE_229_HAIR_MATERIAL_NAMES, hairAlphaMode("corrected"));
  applyHairMap(scene, FEMALE_229_HAIR_MATERIAL_NAMES, "dense");

  const lighting = profile.lighting;
  const ambient = new THREE.AmbientLight("#ffffff", lighting.ambientIntensity);
  const key = new THREE.DirectionalLight(lighting.keyColor, lighting.keyIntensity);
  key.position.set(...lighting.keyPosition);
  const fill = new THREE.DirectionalLight(lighting.fillColor, lighting.fillIntensity);
  fill.position.set(...lighting.fillPosition);
  const rim = new THREE.DirectionalLight(lighting.rimColor, lighting.rimIntensity);
  rim.position.set(...lighting.rimPosition);
  const bounce = new THREE.PointLight(
    lighting.bounceColor,
    lighting.bounceIntensity,
    lighting.bounceDistance,
    lighting.bounceDecay,
  );
  bounce.position.set(...lighting.bouncePosition);
  const lights = [ambient, key, fill, rim, bounce];
  hostScene.add(...lights);

  let environmentTarget: THREE.WebGLCubeRenderTarget | null = null;
  if (profile.environment.enabled) {
    const environment = createAcceptedEnvironment(renderer);
    environmentTarget = environment.target;
    hostScene.environment = environment.texture;
    hostScene.environmentIntensity = profile.environment.environmentIntensity;
  }
  // Keep the WebGL canvas transparent so the established Solace teal/blue
  // session stage remains visible behind the avatar.
  hostScene.background = null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = profile.toneMappingExposure;

  return {
    lights,
    environmentTarget,
    dispose() {
      for (const light of lights) {
        light.parent?.remove(light);
        light.dispose();
      }
      if (hostScene.environment === environmentTarget?.texture) hostScene.environment = null;
      if (hostScene.background === null) hostScene.background = previousBackground;
      environmentTarget?.dispose();
      applyHairMap(scene, FEMALE_229_HAIR_MATERIAL_NAMES, "authored");
      applyHairAlpha(scene, FEMALE_229_HAIR_MATERIAL_NAMES, hairAlphaMode("current"));
      for (const [meshUuid, pair] of eyes) {
        const eyeMesh = scene.getObjectByProperty("uuid", meshUuid) as THREE.Mesh | undefined;
        if (eyeMesh) eyeMesh.material = pair.authored;
        pair.corneal.dispose();
      }
    },
  };
};
