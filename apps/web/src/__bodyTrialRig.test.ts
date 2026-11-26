/**
 * Focused tests for the TEMPORARY body-trial helpers (`__bodyTrialRig.ts`).
 * Delete together with the trial page.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  TRIAL_BODY_JOINTS,
  analyseRig,
  collectOwned,
  disposeOwned,
  overrideRole,
  validateGlbBytes,
} from "./__bodyTrialRig";

// ── GLB byte builders ────────────────────────────────────────────────────────
const pad4 = (n: number) => (4 - (n % 4)) % 4;
function glb(json: unknown, bin?: Uint8Array, opts: { magic?: number; version?: number; truncateTo?: number } = {}) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = jsonBytes.length + pad4(jsonBytes.length);
  const binLen = bin ? bin.length + pad4(bin.length) : 0;
  const total = 12 + 8 + jsonLen + (bin ? 8 + binLen : 0);
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  v.setUint32(0, opts.magic ?? 0x46546c67, true);
  v.setUint32(4, opts.version ?? 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, jsonLen, true);
  v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20, jsonBytes.length).set(jsonBytes);
  for (let i = jsonBytes.length; i < jsonLen; i++) v.setUint8(20 + i, 0x20);
  if (bin) {
    v.setUint32(20 + jsonLen, binLen, true);
    v.setUint32(24 + jsonLen, 0x004e4942, true);
    new Uint8Array(buf, 28 + jsonLen, bin.length).set(bin);
  }
  return opts.truncateTo ? buf.slice(0, opts.truncateTo) : buf;
}
const asset = { version: "2.0", generator: "test" };

describe("validateGlbBytes", () => {
  it("accepts a self-contained GLB", () => {
    const r = validateGlbBytes(glb({ asset, buffers: [{ byteLength: 4 }], images: [{ bufferView: 0 }] }, new Uint8Array(4)));
    expect(r.ok).toBe(true);
  });
  it("accepts data: URIs", () => {
    expect(validateGlbBytes(glb({ asset, buffers: [{ uri: "data:application/octet-stream;base64,AAAA", byteLength: 3 }] })).ok).toBe(true);
  });
  it.each([
    ["too small", new ArrayBuffer(8), /too small/],
    ["bad magic", glb({ asset }, undefined, { magic: 0x12345678 }), /magic/],
    ["glTF 1 container", glb({ asset }, undefined, { version: 1 }), /version 1/],
    ["truncated", glb({ asset, buffers: [{ byteLength: 64 }] }, new Uint8Array(64), { truncateTo: 60 }), /truncated|corrupt/],
  ])("rejects %s", (_n, bytes, msg) => {
    const r = validateGlbBytes(bytes as ArrayBuffer);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg as RegExp);
  });
  it("rejects invalid JSON", () => {
    const buf = glb({ asset });
    new Uint8Array(buf, 20, 1)[0] = 0x7d; // break the first byte
    const r = validateGlbBytes(buf);
    expect(r.ok).toBe(false);
  });
  it("rejects external buffers and images without fetching them", () => {
    const r = validateGlbBytes(glb({ asset, buffers: [{ uri: "scene.bin", byteLength: 4 }], images: [{ uri: "https://example.invalid/t.png", name: "albedo" }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('"scene.bin"');
      expect(r.error).toContain("albedo");
      expect(r.error).toMatch(/not embedded/);
    }
  });
  it("rejects files that need an external decoder", () => {
    const r = validateGlbBytes(glb({ asset, extensionsRequired: ["KHR_draco_mesh_compression"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/draco/i);
  });
  it("rejects an embedded buffer with no BIN chunk", () => {
    const r = validateGlbBytes(glb({ asset, buffers: [{ byteLength: 4 }] }));
    expect(r.ok).toBe(false);
  });
});

// ── Rig builders ─────────────────────────────────────────────────────────────
function boneTree(spec: Array<[name: string, parent: string | null, rot?: THREE.Quaternion]>) {
  const bones = new Map<string, THREE.Bone>();
  const roots: THREE.Bone[] = [];
  for (const [name, parent, rot] of spec) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(0, 0.1, 0);
    if (rot) b.quaternion.copy(rot);
    bones.set(name, b);
    if (parent) bones.get(parent)!.add(b);
    else roots.push(b);
  }
  return { bones, roots };
}
/** A skinned mesh with one vertex fully weighted to each listed bone. */
function skinnedTo(name: string, skeletonBones: THREE.Bone[], weighted: string[]) {
  const g = new THREE.BufferGeometry();
  const n = Math.max(1, weighted.length);
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), 3));
  const idx: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = weighted[i] ? skeletonBones.findIndex((b) => b.name === weighted[i]) : 0;
    idx.push(j, 0, 0, 0);
    w.push(weighted[i] ? 1 : 0, 0, 0, 0);
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial());
  m.name = name;
  m.bind(new THREE.Skeleton(skeletonBones));
  return m;
}
const trialSpec = (): Array<[string, string | null]> => {
  const spec: Array<[string, string | null]> = [["Hips", null], ["Spine", "Hips"], ["Chest", "Spine"], ["UpperChest", "Chest"], ["Neck", "UpperChest"], ["Head", "Neck"]];
  for (const s of ["Left", "Right"]) {
    spec.push([`${s}Shoulder`, "UpperChest"], [`${s}UpperArm`, `${s}Shoulder`], [`${s}LowerArm`, `${s}UpperArm`], [`${s}Hand`, `${s}LowerArm`]);
    spec.push([`${s}UpperLeg`, "Hips"], [`${s}LowerLeg`, `${s}UpperLeg`], [`${s}Foot`, `${s}LowerLeg`], [`${s}Toes`, `${s}Foot`]);
    for (const f of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
      spec.push([`${s}${f}Proximal`, `${s}Hand`], [`${s}${f}Intermediate`, `${s}${f}Proximal`], [`${s}${f}Distal`, `${s}${f}Intermediate`]);
    }
  }
  return spec;
};

function trialLikeScene(opts: { facialHeadWeighted?: boolean; rotateArm?: boolean } = {}) {
  const spec = trialSpec().map(([n, p]) => [n, p, opts.rotateArm && n === "LeftUpperArm" ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5) : undefined] as [string, string | null, THREE.Quaternion?]);
  const body = boneTree(spec);
  const facial = boneTree([["root", null], ["neck_02", "root"], ["head", "neck_02"], ["FACIAL_L_Eye", "head"]]);
  body.bones.get("Head")!.add(facial.roots[0]);
  const scene = new THREE.Group();
  scene.add(body.roots[0]);
  const bodyBones = [...body.bones.values()];
  scene.add(skinnedTo("Face", bodyBones, ["Head", "Neck", "UpperChest", ...bodyBones.map((b) => b.name)]));
  const facialBones = [...facial.bones.values()];
  scene.add(skinnedTo("Eyes", facialBones, opts.facialHeadWeighted ? ["head", "FACIAL_L_Eye"] : ["FACIAL_L_Eye"]));
  scene.updateMatrixWorld(true);
  return scene;
}

describe("analyseRig", () => {
  it("maps Head to the body Head, not the facial lowercase head, when only Head carries skin", () => {
    const a = analyseRig(trialLikeScene());
    const head = a.roles.get("Head")!;
    expect(head.status).toBe("mapped");
    expect(head.bone).toBe("Head");
    expect(head.candidates.map((c) => c.name).sort()).toEqual(["Head", "head"]);
  });

  it("requires an explicit choice when both Head and head carry skin", () => {
    const a = analyseRig(trialLikeScene({ facialHeadWeighted: true }));
    const head = a.roles.get("Head")!;
    expect(head.status).toBe("ambiguous");
    expect(head.bone).toBeNull();
    expect(a.compatible).toBe(false);
  });

  it("treats a trial-shaped rig with identity rest as compatible, and a rotated rest as not", () => {
    expect(analyseRig(trialLikeScene()).compatible).toBe(true);
    const rotated = analyseRig(trialLikeScene({ rotateArm: true }));
    expect(rotated.compatible).toBe(false);
    expect(rotated.compatibilityReasons.join(" ")).toMatch(/LeftUpperArm/);
    expect(analyseRig(trialLikeScene(), { ignoreTrialConventions: true }).compatible).toBe(false);
  });

  it("flags GLTFLoader de-duplicated names (Head / Head_1) as ambiguous", () => {
    const t = boneTree([["Hips", null], ["Head", "Hips"], ["Head_1", "Hips"]]);
    const scene = new THREE.Group();
    scene.add(t.roots[0]);
    scene.add(skinnedTo("Body", [...t.bones.values()], ["Head", "Head_1"]));
    const head = analyseRig(scene).roles.get("Head")!;
    expect(head.status).toBe("ambiguous");
    expect(head.candidates.map((c) => c.name)).toEqual(["Head", "Head_1"]);
  });

  it("uses a lone facial head with a clear note, and reports missing roles", () => {
    const t = boneTree([["root", null], ["head", "root"], ["FACIAL_L_Eye", "head"]]);
    const scene = new THREE.Group();
    scene.add(t.roots[0]);
    scene.add(skinnedTo("Eyes", [...t.bones.values()], ["FACIAL_L_Eye"]));
    const a = analyseRig(scene);
    expect(a.roles.get("Head")!.bone).toBe("head");
    expect(a.roles.get("Head")!.reason).toMatch(/no body Head/);
    expect(a.roles.get("LeftHand")!.status).toBe("missing");
    expect(a.compatible).toBe(false);
  });

  it("maps Mixamo names exactly (sanitised prefix)", () => {
    const t = boneTree([["mixamorigHips", null], ["mixamorigSpine", "mixamorigHips"], ["mixamorigLeftArm", "mixamorigSpine"], ["mixamorigLeftForeArm", "mixamorigLeftArm"], ["mixamorigLeftHandIndex1", "mixamorigLeftForeArm"]]);
    const scene = new THREE.Group();
    scene.add(t.roots[0]);
    scene.add(skinnedTo("Body", [...t.bones.values()], [...t.bones.keys()]));
    const a = analyseRig(scene);
    expect(a.roles.get("LeftUpperArm")!.bone).toBe("mixamorigLeftArm");
    expect(a.roles.get("LeftLowerArm")!.bone).toBe("mixamorigLeftForeArm");
    expect(a.roles.get("LeftIndexProximal")!.bone).toBe("mixamorigLeftHandIndex1");
    expect(a.roles.get("RightUpperArm")!.status).toBe("missing");
  });

  it("applies and validates explicit overrides", () => {
    const a = analyseRig(trialLikeScene({ facialHeadWeighted: true }));
    expect(overrideRole(a, "Head", "Head").status).toBe("mapped");
    expect(a.roles.get("Head")!.bone).toBe("Head");
    expect(() => overrideRole(a, "Head", "NoSuchBone")).toThrow(/No bone/);
    expect(overrideRole(a, "Head", null).bone).toBeNull();
  });
});

describe("disposeOwned", () => {
  it("frees what the GLB owned and leaves shared textures alone", () => {
    const own = new THREE.Texture();
    const shared = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map: own });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const root = new THREE.Group();
    root.add(mesh);
    const parent = new THREE.Scene();
    parent.add(root);
    const owned = collectOwned(root);
    // A trial material pass swaps in a new material that uses a shared (cached) texture.
    const passMat = new THREE.MeshStandardMaterial({ map: shared });
    mesh.material = passMat;
    const spies = [vi.spyOn(own, "dispose"), vi.spyOn(shared, "dispose"), vi.spyOn(mat, "dispose"), vi.spyOn(passMat, "dispose"), vi.spyOn(mesh.geometry, "dispose")];
    disposeOwned(root, owned);
    expect(spies[0]).toHaveBeenCalled(); // owned texture
    expect(spies[1]).not.toHaveBeenCalled(); // shared cached texture
    expect(spies[2]).toHaveBeenCalled(); // original material
    expect(spies[3]).toHaveBeenCalled(); // pass material now on the mesh
    expect(spies[4]).toHaveBeenCalled();
    expect(root.parent).toBeNull();
  });
});

describe("TRIAL_BODY_JOINTS", () => {
  it("lists the 52 joints of straight_16_11.glb", () => {
    expect(TRIAL_BODY_JOINTS).toHaveLength(52);
    expect(new Set(TRIAL_BODY_JOINTS).size).toBe(52);
  });
});
