import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { applyAcceptedHyper3dAppearance } from "./hyper3dAppearance";
import { HYPER3D_F228_APPEARANCE } from "./engine/mappings/avatars/hyper3dAppearanceProfile";

const meshWith = (name: string) => {
  const material = new THREE.MeshStandardMaterial();
  material.name = name;
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
};

describe("accepted Hyper3D appearance migration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mounts the accepted renderer, environment, light rig, and material tuning", () => {
    const avatar = new THREE.Group();
    const face = meshWith("M_Face.002");
    const hair = meshWith("Material.005");
    const eye = meshWith("UnrealMaterial.023");
    avatar.add(face, hair, eye);

    const hostScene = new THREE.Scene();
    const previousBackground = new THREE.Color("#123456");
    hostScene.background = previousBackground;
    const renderer = {
      autoClear: false,
      outputColorSpace: THREE.NoColorSpace,
      isWebGLRenderer: true,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
    } as unknown as THREE.WebGLRenderer;
    const cubeUpdate = vi.spyOn(THREE.CubeCamera.prototype, "update").mockImplementation(() => undefined);

    const handle = applyAcceptedHyper3dAppearance(avatar, hostScene, renderer);
    expect(cubeUpdate).toHaveBeenCalledOnce();
    expect(handle.environmentTarget?.width).toBe(256);
    expect(handle.environmentTarget?.texture.type).toBe(THREE.HalfFloatType);
    expect(handle.environmentTarget?.texture.mapping).toBe(THREE.CubeReflectionMapping);
    expect(hostScene.environment).toBe(handle.environmentTarget?.texture);
    expect(hostScene.environmentIntensity).toBe(1.15);
    expect(hostScene.background).toBeNull();
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.12);

    const [ambient, key, fill, rim, bounce] = handle.lights;
    expect(ambient.intensity).toBe(0.15);
    expect(key.intensity).toBe(3.15);
    expect(key.color.getHexString()).toBe("fff1e0");
    expect(key.position.toArray()).toEqual([2.5, 2.35, 1.35]);
    expect(fill.intensity).toBe(0.8);
    expect(fill.color.getHexString()).toBe("dce8ff");
    expect(rim.intensity).toBe(1.75);
    expect((bounce as THREE.PointLight).intensity).toBe(0.06);
    expect(bounce.position.y).toBeCloseTo(0.7416, 10);
    expect(bounce.position.z).toBeCloseTo(0.1539, 10);

    expect((face.material as THREE.MeshStandardMaterial).envMapIntensity).toBe(0.42);
    expect((hair.material as THREE.MeshStandardMaterial).metalness).toBe(0);
    expect((hair.material as THREE.MeshStandardMaterial).roughness).toBe(0.55);
    expect((hair.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("241a14");
    expect(eye.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((eye.material as THREE.MeshPhysicalMaterial).roughness).toBe(0.42);
    expect((eye.material as THREE.MeshPhysicalMaterial).clearcoat).toBe(1);

    handle.dispose();
    expect(hostScene.environment).toBeNull();
    expect(hostScene.background).toBe(previousBackground);
    expect(handle.lights.every((light) => light.parent === null)).toBe(true);
  });

  it("uses the accepted profile without changing its values", () => {
    expect(HYPER3D_F228_APPEARANCE.environment).toEqual({
      enabled: true,
      resolution: 256,
      environmentIntensity: 1.15,
    });
    expect(HYPER3D_F228_APPEARANCE.toneMappingExposure).toBe(1.12);
    expect(HYPER3D_F228_APPEARANCE.materials.hairColor).toBe("#241a14");
    expect(HYPER3D_F228_APPEARANCE.materials.hairRoughness).toBe(0.55);
  });
});
