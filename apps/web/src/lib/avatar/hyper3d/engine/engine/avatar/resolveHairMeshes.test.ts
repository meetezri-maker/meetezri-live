import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { resolveHyper3dHairMeshes } from "./resolveHairMeshes";
import { attachHeadMeshes } from "./attachHeadMeshes";

/**
 * The shapes these tests build are the ones the real exports produce, read off
 * the shipped GLBs with the real `GLTFLoader`:
 *
 *   female_2291 / female_229 / sara.glb / arfv2.glb(19 Oct)
 *                     node `Hair` -> `Character002`, `Character002_1`
 *   arfv2.glb (16 Oct) node `Hair` -> `Character001`, `Character001_1`
 *   perm.glb           no `Hair` node; the hair is the single mesh `Object_7`
 *   jordan.glb         no hair at all
 */
const hairGroupScene = (meshNames: string[], nodeName = "Hair") => {
  const scene = new THREE.Group();
  scene.name = "Scene";

  const face = new THREE.Mesh(new THREE.BufferGeometry());
  face.name = "blendshapes";
  scene.add(face);

  const hair = new THREE.Group();
  hair.name = nodeName;
  for (const name of meshNames) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry());
    mesh.name = name;
    hair.add(mesh);
  }
  scene.add(hair);
  return scene;
};

describe("structural hair resolution", () => {
  it("finds Character002* under the Hair node", () => {
    const scene = hairGroupScene(["Character002", "Character002_1"]);
    const result = resolveHyper3dHairMeshes(scene, ["Character002", "Character002_1"]);

    expect(result.source).toBe("hair-node");
    expect(result.hairNodeName).toBe("Hair");
    expect(result.meshNames).toEqual(["Character002", "Character002_1"]);
    expect(result.configuredMissing).toEqual([]);
  });

  it("finds Character001* under the Hair node even when the config still says Character002*", () => {
    const scene = hairGroupScene(["Character001", "Character001_1"]);
    const result = resolveHyper3dHairMeshes(scene, ["Character002", "Character002_1"]);

    expect(result.source).toBe("hair-node");
    expect(result.meshNames).toEqual(["Character001", "Character001_1"]);
    // The stale spellings are reported so the caller can drop them from the
    // head-attachment list instead of leaving phantom "missing" entries.
    expect(result.configuredMissing).toEqual(["Character002", "Character002_1"]);
  });

  it("finds Character002* even when the config says Character001* — the rename works both ways", () => {
    const scene = hairGroupScene(["Character002", "Character002_1"]);
    const result = resolveHyper3dHairMeshes(scene, ["Character001", "Character001_1"]);

    expect(result.meshNames).toEqual(["Character002", "Character002_1"]);
    expect(result.configuredMissing).toEqual(["Character001", "Character001_1"]);
  });

  it("falls back to configured names when there is no Hair node (perm.glb)", () => {
    const scene = new THREE.Group();
    const hair = new THREE.Mesh(new THREE.BufferGeometry());
    hair.name = "Object_7";
    scene.add(hair);

    const result = resolveHyper3dHairMeshes(scene, ["Object_7"]);
    expect(result.source).toBe("configured-names");
    expect(result.hairNodeName).toBeNull();
    expect(result.meshNames).toEqual(["Object_7"]);
  });

  it("resolves a single-primitive hair mesh that IS the Hair node", () => {
    const scene = new THREE.Group();
    const hair = new THREE.Mesh(new THREE.BufferGeometry());
    hair.name = "Hair";
    scene.add(hair);

    const result = resolveHyper3dHairMeshes(scene, ["Character002"]);
    expect(result.source).toBe("hair-node");
    expect(result.meshNames).toEqual(["Hair"]);
  });

  it("returns nothing when the asset really has no hair, so the gate still fails", () => {
    const scene = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BufferGeometry());
    face.name = "blendshapes";
    scene.add(face);

    const result = resolveHyper3dHairMeshes(scene, ["Character002", "Character002_1"]);
    expect(result.source).toBe("none");
    expect(result.meshNames).toEqual([]);
    expect(result.configuredMissing).toEqual(["Character002", "Character002_1"]);
  });

  it("keeps a configured hair mesh that lives outside the Hair node", () => {
    const scene = hairGroupScene(["Character002"]);
    const stray = new THREE.Mesh(new THREE.BufferGeometry());
    stray.name = "Object_7";
    scene.add(stray);

    const result = resolveHyper3dHairMeshes(scene, ["Object_7"]);
    expect(result.meshNames).toEqual(["Character002", "Object_7"]);
  });

  it("matches a differently-cased hair node", () => {
    const result = resolveHyper3dHairMeshes(hairGroupScene(["Character002"], "hair"), []);
    expect(result.source).toBe("hair-node");
    expect(result.meshNames).toEqual(["Character002"]);
  });
});

describe("resolved hair drives head attachment without double-transforming", () => {
  const sceneWithHeadBone = (hairNames: string[]) => {
    const scene = hairGroupScene(hairNames);
    const head = new THREE.Bone();
    head.name = "head";
    head.position.set(0, 1.4, 0);
    scene.add(head);
    scene.updateMatrixWorld(true);
    return { scene, head };
  };

  it("attaches the resolved hair to the head bone and keeps its world transform", () => {
    const { scene, head } = sceneWithHeadBone(["Character001", "Character001_1"]);
    const hair = scene.getObjectByName("Character001") as THREE.Mesh;
    hair.position.set(0.05, 1.5, 0.02);
    scene.updateMatrixWorld(true);
    const before = hair.getWorldPosition(new THREE.Vector3()).clone();

    const resolved = resolveHyper3dHairMeshes(scene, ["Character002", "Character002_1"]);
    const attachment = attachHeadMeshes(scene, head, resolved.meshNames);

    expect(attachment.attached).toEqual(["Character001", "Character001_1"]);
    expect(hair.parent).toBe(head);
    scene.updateMatrixWorld(true);
    expect(hair.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6);
  });

  it("is idempotent — a second pass attaches nothing again", () => {
    const { scene, head } = sceneWithHeadBone(["Character002", "Character002_1"]);
    const resolved = resolveHyper3dHairMeshes(scene, ["Character002", "Character002_1"]);

    attachHeadMeshes(scene, head, resolved.meshNames);
    const second = attachHeadMeshes(scene, head, resolved.meshNames);

    expect(second.attached).toEqual([]);
    expect(second.alreadyAttached).toEqual(["Character002", "Character002_1"]);
  });

  it("refuses to reparent skinned hair, so skinning is never applied twice", () => {
    const scene = hairGroupScene([]);
    const head = new THREE.Bone();
    head.name = "head";
    scene.add(head);
    const skinned = new THREE.SkinnedMesh(new THREE.BufferGeometry());
    skinned.name = "Character002";
    (scene.getObjectByName("Hair") as THREE.Group).add(skinned);
    scene.updateMatrixWorld(true);

    const resolved = resolveHyper3dHairMeshes(scene, ["Character002"]);
    expect(resolved.meshNames).toEqual(["Character002"]);

    const attachment = attachHeadMeshes(scene, head, resolved.meshNames);
    expect(attachment.skippedSkinned).toEqual(["Character002"]);
    expect(skinned.parent?.name).toBe("Hair");
  });
});
