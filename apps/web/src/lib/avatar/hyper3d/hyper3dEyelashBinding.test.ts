import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { avatarModelConfigs, resolveMorphBindings } from "./engine/mappings/avatarModelConfig";
import { MorphTargetController } from "./engine/engine/avatar/MorphTargetController";
import { attachHeadMeshes } from "./engine/engine/avatar/attachHeadMeshes";
import { HYPER3D_GLB_URL } from "./engine/mappings/avatars/hyper3dAssetSelection";
import { EXPECTED_MINIFACE_BLENDSHAPES } from "./engine/mappings/avatarBlendshapeConfig";
import {
  HYPER3D_EYELASH_MESH_NAME,
  HYPER3D_EYELASH_SOURCE_CHANNELS,
  HYPER3D_EYELASH_TARGETS,
  HYPER3D_EYELASH_TARGET_NAMES,
} from "./engine/mappings/avatars/hyper3dEyelashBinding";

/**
 * THE ASSET IS THE FIXTURE.
 *
 * Every expectation below is read from the shipped `female_2291.glb`, not from a
 * stub, because the thing being guarded is a contract with a file a designer
 * re-exports. A mock would agree with this file forever and tell us nothing the
 * day the mesh is renamed, a target is dropped, or the four misspelled names are
 * quietly corrected.
 */
const CONFIG = avatarModelConfigs["hyper3d-usc"];
const PUBLIC_DIR = "public";
const ORIGIN = "http://localhost";
const originalFetch = globalThis.fetch;

function installPublicDirFetch() {
  THREE.DefaultLoadingManager.setURLModifier((url) => (url.startsWith("/") ? `${ORIGIN}${url}` : url));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) return new Response(null, { status: 404, statusText: "Not Found" });
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

let scene: THREE.Group;
let lashes: THREE.Mesh;
let face: THREE.Mesh;

/** World-space X of a bone, used as the ground truth for "which side is Left". */
const worldX = (root: THREE.Object3D, name: string) => {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`missing node ${name}`);
  root.updateWorldMatrix(true, true);
  return new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).x;
};

/**
 * Centroid and mean displacement, in WORLD space, of the vertices a morph
 * actually moves.
 *
 * Only vertices above a quarter of the target's own peak are counted, so a
 * handful of near-zero stragglers cannot drag the centroid to the middle of the
 * face. The mesh matrix is applied WITHOUT translation for the delta — a
 * displacement is a direction, not a point.
 *
 * The linear part is taken STRAIGHT off `matrixWorld` rather than rebuilt from
 * `extractRotation().scale()`. The lash node carries a negative scale on all
 * three axes; `extractRotation` normalises each column by its LENGTH, which is
 * unsigned, so re-multiplying by the signed scale negates every axis a second
 * time and reports every direction inverted.
 */
function morphProfile(mesh: THREE.Mesh, targetName: string) {
  const index = mesh.morphTargetDictionary?.[targetName];
  if (index === undefined) throw new Error(`no morph ${targetName} on ${mesh.name}`);
  const delta = mesh.geometry.morphAttributes.position?.[index];
  const base = mesh.geometry.attributes.position;
  if (!delta) throw new Error(`no morph geometry for ${targetName}`);
  mesh.updateWorldMatrix(true, false);
  const linear = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  let peak = 0;
  for (let i = 0; i < delta.count; i++) {
    peak = Math.max(peak, Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i)));
  }
  const threshold = peak * 0.25;
  const centroid = new THREE.Vector3();
  const motion = new THREE.Vector3();
  const v = new THREE.Vector3();
  let moved = 0;
  for (let i = 0; i < delta.count; i++) {
    v.set(delta.getX(i), delta.getY(i), delta.getZ(i));
    if (v.length() < threshold) continue;
    motion.add(v.clone().applyMatrix3(linear));
    centroid.add(new THREE.Vector3(base.getX(i), base.getY(i), base.getZ(i)).applyMatrix4(mesh.matrixWorld));
    moved++;
  }
  return { peak, moved, centroidX: centroid.x / moved, motion: motion.divideScalar(moved) };
}

beforeAll(async () => {
  installPublicDirFetch();
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    loader.load(HYPER3D_GLB_URL, (loaded) => resolve(loaded as { scene: THREE.Group }), undefined, reject);
  });
  scene = gltf.scene;
  scene.updateWorldMatrix(true, true);
  lashes = scene.getObjectByName(HYPER3D_EYELASH_MESH_NAME) as THREE.Mesh;
  face = scene.getObjectByName(CONFIG.meshNames.face[0]) as THREE.Mesh;
}, 120_000);

afterAll(() => {
  globalThis.fetch = originalFetch;
  THREE.DefaultLoadingManager.setURLModifier(null as unknown as (url: string) => string);
});

describe("hyper3d eyelash asset contract", () => {
  it("resolves the lash mesh under the name THREE gives it, not the name the GLB spells", () => {
    expect(lashes, `${HYPER3D_EYELASH_MESH_NAME} missing from ${HYPER3D_GLB_URL}`).toBeTruthy();
    expect(lashes.isMesh).toBe(true);
    // The glTF spellings must NOT resolve; if one ever does the loader changed.
    expect(scene.getObjectByName("Object_2.002")).toBeUndefined();
    expect(scene.getObjectByName("Object_0.002")).toBeUndefined();
  });

  it("is an unskinned mesh, which is why it needs head attachment", () => {
    expect((lashes as THREE.SkinnedMesh).isSkinnedMesh).toBeFalsy();
    expect(lashes.geometry.attributes.skinIndex).toBeUndefined();
  });

  it("carries all fourteen targets, including the four the asset misspells", () => {
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) {
      expect(lashes.morphTargetDictionary?.[target], `${target} absent`).toBeDefined();
    }
    // Pinned deliberately: these are typos in the GLB ("Lahes"). If a re-export
    // fixes them this fails, which is the point — silent stillness is worse.
    expect(Object.keys(lashes.morphTargetDictionary ?? {})).toEqual(
      expect.arrayContaining([
        "eyeLookDownLahesLeft",
        "eyeLookDownLahesRight",
        "eyeLookInLahesLeft",
        "eyeLookInLahesRight",
      ]),
    );
  });

  it("initialises every lash influence to zero", () => {
    expect(lashes.morphTargetInfluences).toHaveLength(14);
    expect(lashes.morphTargetInfluences?.every((value) => value === 0)).toBe(true);
  });

  it("carries real geometry on every lash target", () => {
    // These ship as SPARSE accessors. A reader that ignores sparse data sees
    // fourteen empty morphs and concludes the asset is broken; three.js expands
    // them, and each one must actually move vertices.
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) {
      const { peak, moved } = morphProfile(lashes, target);
      expect(peak, `${target} carries no geometry`).toBeGreaterThan(1e-4);
      expect(moved, `${target} moves no vertices`).toBeGreaterThan(0);
    }
  });

  it("puts each side's lash morph on that side's eye", () => {
    const leftEyeX = worldX(scene, "FACIAL_L_EyeParallel");
    const rightEyeX = worldX(scene, "FACIAL_R_EyeParallel");
    expect(Math.sign(leftEyeX)).not.toBe(Math.sign(rightEyeX));
    for (const [channel, target] of Object.entries(HYPER3D_EYELASH_TARGETS)) {
      const expected = channel.endsWith("Left") ? leftEyeX : rightEyeX;
      const { centroidX } = morphProfile(lashes, target);
      expect(Math.sign(centroidX), `${target} sits on the wrong side of the face`).toBe(Math.sign(expected));
    }
  });

  it("moves each lash target the same way the eyelid channel it follows moves", () => {
    // Vertical agreement only. Blink and look-down travel down, look-up, squint
    // and wide travel up. Horizontal in/out is checked separately because the
    // asset authors it far weaker than the lid.
    for (const channel of HYPER3D_EYELASH_SOURCE_CHANNELS) {
      if (channel.startsWith("eyeLookIn") || channel.startsWith("eyeLookOut")) continue;
      const lid = morphProfile(face, channel);
      const lash = morphProfile(lashes, HYPER3D_EYELASH_TARGETS[channel]);
      expect(Math.sign(lash.motion.y), `${channel} lash travels opposite its lid`).toBe(Math.sign(lid.motion.y));
    }
  });
});

describe("hyper3d eyelash runtime binding", () => {
  it("gives every eye channel a second binding onto the lash mesh, at weight 1", () => {
    for (const [channel, lashTarget] of Object.entries(HYPER3D_EYELASH_TARGETS)) {
      const bindings = resolveMorphBindings(CONFIG, channel);
      expect(bindings.map((b) => b.target), `${channel} lost its own target`).toContain(channel);
      expect(bindings.map((b) => b.target), `${channel} does not drive ${lashTarget}`).toContain(lashTarget);
      for (const binding of bindings) expect(binding.weight ?? 1).toBe(1);
    }
  });

  it("drives the lash target with the same value the eyelid gets, through the one writer", () => {
    const morph = new MorphTargetController();
    morph.discover(scene, CONFIG);
    morph.write({ eyeBlinkLeft: 1, eyeBlinkRight: 0.17 });
    const read = (name: string) => morph.inspect(name)[0]?.influence;
    // 0.17 is the accepted resting lid closure. The lash inherits it exactly —
    // no second application, no separate neutral.
    expect(read("eyeBlinkLeft")).toBe(1);
    expect(read("eyeBlinkLashesLeft")).toBe(1);
    expect(read("eyeBlinkRight")).toBeCloseTo(0.17, 6);
    expect(read("eyeBlinkLashesRight")).toBeCloseTo(0.17, 6);
  });

  it("routes character-left gaze to out-left and in-right lashes, matching the accepted convention", () => {
    const morph = new MorphTargetController();
    morph.discover(scene, CONFIG);
    // `hyper3dGazePose` writes this pair for a gaze to the character's LEFT.
    morph.write({ eyeLookOutLeft: 0.8, eyeLookInRight: 0.8 });
    const read = (name: string) => morph.inspect(name)[0]?.influence;
    expect(read("eyeLookOutLashesLeft")).toBeCloseTo(0.8, 6);
    expect(read("eyeLookInLahesRight")).toBeCloseTo(0.8, 6);
    // The opposite-direction lashes stay still.
    expect(read("eyeLookInLahesLeft")).toBe(0);
    expect(read("eyeLookOutLashesRight")).toBe(0);
  });

  it("is the sole writer — an unwritten frame returns the lashes to rest", () => {
    const morph = new MorphTargetController();
    morph.discover(scene, CONFIG);
    morph.write({ eyeBlinkLeft: 1 });
    expect(morph.inspect("eyeBlinkLashesLeft")[0]?.influence).toBe(1);
    morph.write({});
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) {
      expect(morph.inspect(target)[0]?.influence, `${target} left hot`).toBe(0);
    }
  });

  it("reports no dead lash targets", () => {
    const morph = new MorphTargetController();
    morph.discover(scene, CONFIG);
    const dead = morph.deadTargetNames();
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) expect(dead).not.toContain(target);
  });
});

describe("hyper3d eyelash head attachment", () => {
  it("lists the lash mesh among the meshes reparented onto the head bone", () => {
    expect(CONFIG.headAttachedMeshes).toContain(HYPER3D_EYELASH_MESH_NAME);
  });

  it("actually reparents it, and leaves the rest pose where it was", () => {
    const fresh = scene.clone(true);
    fresh.updateWorldMatrix(true, true);
    const before = new THREE.Vector3().setFromMatrixPosition(
      (fresh.getObjectByName(HYPER3D_EYELASH_MESH_NAME) as THREE.Mesh).matrixWorld,
    );
    const head = fresh.getObjectByName("head") as THREE.Bone;
    const result = attachHeadMeshes(fresh, head, CONFIG.headAttachedMeshes ?? []);
    expect(result.attached).toContain(HYPER3D_EYELASH_MESH_NAME);
    const lash = fresh.getObjectByName(HYPER3D_EYELASH_MESH_NAME) as THREE.Mesh;
    let ancestor: THREE.Object3D | null = lash.parent;
    let under = false;
    while (ancestor) {
      if (ancestor === head) { under = true; break; }
      ancestor = ancestor.parent;
    }
    expect(under, "lash mesh is not under the head bone").toBe(true);
    fresh.updateWorldMatrix(true, true);
    const after = new THREE.Vector3().setFromMatrixPosition(lash.matrixWorld);
    // `attach()` preserves world transform: the rest pose must not shift.
    expect(after.distanceTo(before)).toBeLessThan(1e-6);
  });

  it("follows the head once attached, which it did not do before", () => {
    const fresh = scene.clone(true);
    const head = fresh.getObjectByName("head") as THREE.Bone;
    const lash = fresh.getObjectByName(HYPER3D_EYELASH_MESH_NAME) as THREE.Mesh;
    const sample = () => {
      fresh.updateWorldMatrix(true, true);
      return new THREE.Vector3().setFromMatrixPosition(lash.matrixWorld);
    };
    const yaw = (radians: number) => { head.rotation.y = radians; };

    const restUnattached = sample();
    yaw(0.14);
    const movedUnattached = sample().distanceTo(restUnattached);
    yaw(0);

    attachHeadMeshes(fresh, head, CONFIG.headAttachedMeshes ?? []);
    const restAttached = sample();
    yaw(0.14);
    const movedAttached = sample().distanceTo(restAttached);

    expect(movedUnattached).toBeLessThan(1e-9);
    expect(movedAttached).toBeGreaterThan(1e-3);
  });
});

describe("hyper3d re-export regression guard", () => {
  it("still carries every canonical face morph the accepted system requires", () => {
    const names = new Set(Object.keys(face.morphTargetDictionary ?? {}));
    const missing = EXPECTED_MINIFACE_BLENDSHAPES.filter((name) => !names.has(name));
    expect(missing).toEqual([]);
  });

  it("still resolves the head, neck, eye and teeth mechanisms", () => {
    for (const name of ["head", "neck_01", "neck_02", "FACIAL_L_EyeParallel", "FACIAL_R_EyeParallel"]) {
      expect(scene.getObjectByName(name), `${name} missing`).toBeTruthy();
    }
    const teeth = scene.getObjectByName(CONFIG.meshNames.teeth[0]) as THREE.Mesh;
    expect(teeth?.morphTargetDictionary?.JawOpen).toBeDefined();
    const eyes = scene.getObjectByName(CONFIG.meshNames.eyes[0]) as THREE.Mesh;
    expect(eyes?.morphTargetDictionary?.Eyeball_Left).toBeDefined();
    expect(eyes?.morphTargetDictionary?.Eyeball_Right).toBeDefined();
  });

  it("does not let the lash targets leak into the required-morph gate", () => {
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) {
      expect(EXPECTED_MINIFACE_BLENDSHAPES).not.toContain(target);
    }
  });
});
