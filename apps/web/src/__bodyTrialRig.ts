/**
 * TEMPORARY LOCAL TRIAL HELPERS for `__body-trial.html` — pure, testable logic.
 *
 * Not imported by the app. Used only by `src/__straightBodyTrial.ts`.
 *
 *   - `validateGlbBytes`  : checks a selected file is a self-contained GLB 2.0
 *                           BEFORE it reaches GLTFLoader, so nothing referenced
 *                           by the file is ever fetched.
 *   - `analyseRig`        : maps humanoid roles to bones by EXACT name, measured
 *                           skin influence and explicit ambiguity — never by
 *                           guessing from a similar-looking name.
 *   - `disposeOwned`      : frees only resources a loaded GLB owned.
 *
 * DELETE WITH `src/__straightBodyTrial.ts` AND `__body-trial.html`.
 */
import type * as THREE from "three";

// ── GLB validation ───────────────────────────────────────────────────────────

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Extensions that need an external decoder (wasm/js fetched at runtime). The trial page configures none. */
export const DECODER_EXTENSIONS = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"] as const;

export type GlbValidation =
  | {
      ok: true;
      json: Record<string, unknown>;
      summary: { nodes: number; meshes: number; skins: number; images: number; animations: number; generator: string | null };
    }
  | { ok: false; error: string };

const isEmbeddedUri = (uri: unknown) => typeof uri !== "string" || uri.startsWith("data:");

export function validateGlbBytes(buffer: ArrayBuffer): GlbValidation {
  if (buffer.byteLength < 20) return { ok: false, error: `File is too small to be a GLB (${buffer.byteLength} bytes).` };
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return { ok: false, error: "Not a binary glTF (.glb): the file does not start with the 'glTF' magic bytes." };
  const version = view.getUint32(4, true);
  if (version !== 2) return { ok: false, error: `Unsupported GLB container version ${version}; only glTF 2.0 is supported.` };
  const declared = view.getUint32(8, true);
  if (declared > buffer.byteLength) return { ok: false, error: `File is truncated: header declares ${declared} bytes, file has ${buffer.byteLength}.` };
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON) return { ok: false, error: "First GLB chunk is not JSON." };
  if (20 + jsonLength > declared) return { ok: false, error: "JSON chunk runs past the end of the file (truncated or corrupt)." };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, error: `JSON chunk is not valid JSON: ${(e as Error).message}` };
  }
  const asset = json.asset as { version?: string; generator?: string } | undefined;
  if (!asset?.version?.startsWith("2")) return { ok: false, error: `glTF asset.version is "${asset?.version ?? "missing"}"; only 2.x is supported.` };

  // BIN chunk (needed when buffer 0 has no uri)
  let hasBin = false;
  const binOffset = 20 + jsonLength + ((4 - (jsonLength % 4)) % 4);
  if (binOffset + 8 <= declared) hasBin = view.getUint32(binOffset + 4, true) === CHUNK_BIN;

  const buffers = (json.buffers as Array<{ uri?: string; byteLength?: number }> | undefined) ?? [];
  const images = (json.images as Array<{ uri?: string; bufferView?: number; name?: string }> | undefined) ?? [];
  const external: string[] = [];
  buffers.forEach((b, i) => {
    if (!isEmbeddedUri(b.uri)) external.push(`buffer ${i}: "${b.uri}"`);
  });
  images.forEach((im, i) => {
    if (!isEmbeddedUri(im.uri)) external.push(`image ${i}${im.name ? ` (${im.name})` : ""}: "${im.uri}"`);
  });
  if (external.length) {
    return {
      ok: false,
      error: `This GLB references ${external.length} external resource(s) that are not embedded, and the trial page does not fetch them: ${external.slice(0, 6).join("; ")}${external.length > 6 ? "; …" : ""}. Re-export with everything embedded (Blender: Format "glTF Binary (.glb)").`,
    };
  }
  if (buffers.some((b) => b.uri === undefined) && !hasBin) return { ok: false, error: "GLB declares an embedded buffer but has no BIN chunk (corrupt or truncated)." };
  const required = (json.extensionsRequired as string[] | undefined) ?? [];
  const needsDecoder = required.filter((e) => (DECODER_EXTENSIONS as readonly string[]).includes(e));
  if (needsDecoder.length) {
    return { ok: false, error: `This GLB requires ${needsDecoder.join(", ")}, which needs an external decoder the trial page does not load. Re-export without mesh/texture compression.` };
  }
  const len = (k: string) => ((json[k] as unknown[] | undefined) ?? []).length;
  return {
    ok: true,
    json,
    summary: { nodes: len("nodes"), meshes: len("meshes"), skins: len("skins"), images: images.length, animations: len("animations"), generator: asset.generator ?? null },
  };
}

// ── Rig analysis ─────────────────────────────────────────────────────────────

export const SIDES = ["Left", "Right"] as const;
export const ARM_JOINTS = ["Shoulder", "UpperArm", "LowerArm", "Hand"] as const;
export const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
export const PHALANGES = ["Proximal", "Intermediate", "Distal"] as const;
export const TORSO_ROLES = ["Spine", "Chest", "UpperChest"] as const;
export type Side = (typeof SIDES)[number];

export const ALL_ROLES: string[] = [
  ...TORSO_ROLES,
  "Neck",
  "Head",
  ...SIDES.flatMap((s) => ARM_JOINTS.map((j) => `${s}${j}`)),
  ...SIDES.flatMap((s) => FINGERS.flatMap((f) => PHALANGES.map((p) => `${s}${f}${p}`))),
];

/** The 52 body joints of `straight_16_11.glb`, the rig the trial conventions were measured on. */
export const TRIAL_BODY_JOINTS: readonly string[] = [
  "Hips", "Spine", "Chest", "UpperChest", "Neck", "Head",
  ...SIDES.flatMap((s) => [`${s}Shoulder`, `${s}UpperArm`, `${s}LowerArm`, `${s}Hand`]),
  ...SIDES.flatMap((s) => [`${s}UpperLeg`, `${s}LowerLeg`, `${s}Foot`, `${s}Toes`]),
  ...SIDES.flatMap((s) => FINGERS.flatMap((f) => PHALANGES.map((p) => `${s}${f}${p}`))),
];

const MIXAMO_ARM: Record<(typeof ARM_JOINTS)[number], string> = { Shoulder: "Shoulder", UpperArm: "Arm", LowerArm: "ForeArm", Hand: "Hand" };
const MIXAMO_FINGER: Record<(typeof FINGERS)[number], string> = { Thumb: "Thumb", Index: "Index", Middle: "Middle", Ring: "Ring", Little: "Pinky" };
const UNREAL_FINGER: Record<(typeof FINGERS)[number], string> = { Thumb: "thumb", Index: "index", Middle: "middle", Ring: "ring", Little: "pinky" };
const UNREAL_ARM: Record<(typeof ARM_JOINTS)[number], string> = { Shoulder: "clavicle", UpperArm: "upperarm", LowerArm: "lowerarm", Hand: "hand" };

/** Exact candidate names per role, by naming convention. No fuzzy matching. */
export function candidateNames(role: string): Array<{ name: string; convention: string }> {
  const out: Array<{ name: string; convention: string }> = [{ name: role, convention: "humanoid" }];
  const mix = (n: string) => {
    out.push({ name: `mixamorig${n}`, convention: "mixamo" });
    if (n !== role) out.push({ name: n, convention: "mixamo (unprefixed)" });
  };
  const arm = role.match(/^(Left|Right)(Shoulder|UpperArm|LowerArm|Hand)$/);
  const fin = role.match(/^(Left|Right)(Thumb|Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$/);
  if (role === "Spine") mix("Spine");
  if (role === "Chest") mix("Spine1");
  if (role === "UpperChest") mix("Spine2");
  if (role === "Neck") { mix("Neck"); out.push({ name: "neck_01", convention: "unreal" }); }
  if (role === "Head") { mix("Head"); out.push({ name: "head", convention: "unreal / facial skeleton" }); }
  if (arm) {
    const [, s, j] = arm as unknown as [string, Side, (typeof ARM_JOINTS)[number]];
    mix(`${s}${MIXAMO_ARM[j]}`);
    out.push({ name: `${UNREAL_ARM[j]}_${s === "Left" ? "l" : "r"}`, convention: "unreal" });
  }
  if (fin) {
    const [, s, f, p] = fin as unknown as [string, Side, (typeof FINGERS)[number], (typeof PHALANGES)[number]];
    const n = PHALANGES.indexOf(p) + 1;
    mix(`${s}Hand${MIXAMO_FINGER[f]}${n}`);
    out.push({ name: `${UNREAL_FINGER[f]}_0${n}_${s === "Left" ? "l" : "r"}`, convention: "unreal" });
  }
  // de-duplicate identical names (humanoid "Head" == mixamo unprefixed "Head")
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}

export interface BoneInfo {
  name: string;
  bone: THREE.Bone;
  /** Vertices whose skin weight on THIS bone is > 0, across all skinned meshes. */
  directSkinVerts: number;
  /** Meshes that carry those weights. */
  directSkinMeshes: string[];
}

export interface RoleCandidate {
  name: string;
  convention: string;
  directSkinVerts: number;
  directSkinMeshes: string[];
}

export interface RoleResolution {
  role: string;
  status: "mapped" | "missing" | "ambiguous";
  bone: string | null;
  candidates: RoleCandidate[];
  reason: string;
}

export interface RigAnalysis {
  bones: Map<string, BoneInfo>;
  roles: Map<string, RoleResolution>;
  /** Trial-measured conventions (anatomical labels, curl sign, BoneController head, Sasha gaze/morph calibration) apply. */
  compatible: boolean;
  compatibilityReasons: string[];
  skeletons: Array<{ joints: number; root: string; meshes: string[] }>;
}

export function measureSkinInfluence(root: THREE.Object3D): Map<THREE.Bone, { verts: number; meshes: Set<string> }> {
  const out = new Map<THREE.Bone, { verts: number; meshes: Set<string> }>();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.skeleton) return;
    const si = m.geometry.getAttribute("skinIndex");
    const sw = m.geometry.getAttribute("skinWeight");
    if (!si || !sw) return;
    const counted = new Map<number, number>();
    for (let i = 0; i < si.count; i++) {
      for (let k = 0; k < si.itemSize; k++) {
        if (sw.getComponent(i, k) > 0) {
          const j = si.getComponent(i, k);
          counted.set(j, (counted.get(j) ?? 0) + 1);
        }
      }
    }
    for (const [j, n] of counted) {
      const bone = m.skeleton.bones[j];
      if (!bone) continue;
      const e = out.get(bone) ?? { verts: 0, meshes: new Set<string>() };
      e.verts += n;
      e.meshes.add(m.name || "(unnamed mesh)");
      out.set(bone, e);
    }
  });
  return out;
}

export function analyseRig(root: THREE.Object3D, opts: { ignoreTrialConventions?: boolean } = {}): RigAnalysis {
  const influence = measureSkinInfluence(root);
  const bones = new Map<string, BoneInfo>();
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    const inf = influence.get(b);
    bones.set(b.name, { name: b.name, bone: b, directSkinVerts: inf?.verts ?? 0, directSkinMeshes: inf ? [...inf.meshes] : [] });
  });

  const roles = new Map<string, RoleResolution>();
  for (const role of ALL_ROLES) {
    const cands: RoleCandidate[] = [];
    for (const c of candidateNames(role)) {
      // exact name, plus GLTFLoader's de-duplicated copies ("Head_1", "Head_2") of the same name
      const dupes = [...bones.keys()].filter((n) => n === c.name || (bones.has(c.name) && new RegExp(`^${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_\\d+$`).test(n)));
      for (const n of dupes) {
        const info = bones.get(n)!;
        cands.push({ name: n, convention: n === c.name ? c.convention : `${c.convention} (duplicate name)`, directSkinVerts: info.directSkinVerts, directSkinMeshes: info.directSkinMeshes });
      }
    }
    let res: RoleResolution;
    if (!cands.length) {
      res = { role, status: "missing", bone: null, candidates: [], reason: `No bone named ${candidateNames(role).map((c) => `"${c.name}"`).join(" / ")}.` };
    } else {
      const weighted = cands.filter((c) => c.directSkinVerts > 0);
      if (weighted.length === 1) {
        const c = weighted[0];
        res = { role, status: "mapped", bone: c.name, candidates: cands, reason: `"${c.name}" (${c.convention}) directly skins ${c.directSkinVerts} vertices on ${c.directSkinMeshes.join(", ")}${cands.length > 1 ? `; other candidates carry no direct skin weight: ${cands.filter((x) => x !== c).map((x) => `"${x.name}"`).join(", ")}` : ""}.` };
      } else if (weighted.length > 1) {
        res = { role, status: "ambiguous", bone: null, candidates: cands, reason: `Several candidates directly skin vertices (${weighted.map((c) => `"${c.name}": ${c.directSkinVerts} on ${c.directSkinMeshes.join("/")}`).join("; ")}). Select one explicitly.` };
      } else if (cands.length === 1) {
        const c = cands[0];
        res = { role, status: "mapped", bone: c.name, candidates: cands, reason: `"${c.name}" (${c.convention}); it carries no direct skin weight, so it moves only its children${c.name === "head" ? " (facial-skeleton lowercase head — this file has no body Head)" : ""}.` };
      } else {
        res = { role, status: "ambiguous", bone: null, candidates: cands, reason: `Several candidates and none carries direct skin weight (${cands.map((c) => `"${c.name}"`).join(", ")}). Select one explicitly.` };
      }
    }
    roles.set(role, res);
  }

  // Skeletons
  const skeletons = new Map<THREE.Skeleton, string[]>();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && m.skeleton) skeletons.set(m.skeleton, [...(skeletons.get(m.skeleton) ?? []), m.name]);
  });

  // Compatibility with the trial-measured conventions
  const reasons: string[] = [];
  let compatible = !opts.ignoreTrialConventions;
  if (opts.ignoreTrialConventions) reasons.push("Trial conventions disabled by the user.");
  const body = [...skeletons.keys()].find((s) => s.bones.some((b) => b.name === "Hips"));
  if (!body) {
    compatible = false;
    reasons.push("No skinned skeleton with a \"Hips\" joint.");
  } else {
    const names = new Set(body.bones.map((b) => b.name));
    const missing = TRIAL_BODY_JOINTS.filter((n) => !names.has(n));
    const extra = [...names].filter((n) => !TRIAL_BODY_JOINTS.includes(n));
    if (missing.length || extra.length) {
      compatible = false;
      reasons.push(`Body skeleton differs from the trial's 52 joints (missing: ${missing.slice(0, 5).join(", ") || "none"}${missing.length > 5 ? "…" : ""}; extra: ${extra.slice(0, 5).join(", ") || "none"}${extra.length > 5 ? "…" : ""}).`);
    }
    const rotated = body.bones.filter((b) => Math.abs(b.quaternion.w) < 0.99999).map((b) => b.name);
    if (rotated.length) {
      compatible = false;
      reasons.push(`Body joints with non-identity authored rotation (${rotated.slice(0, 5).join(", ")}${rotated.length > 5 ? "…" : ""}), so the trial's measured axis meanings do not transfer.`);
    }
  }
  const unresolved = ["Head", "Neck", "LeftUpperArm", "RightUpperArm"].filter((r) => roles.get(r)?.status !== "mapped" || roles.get(r)?.bone !== r);
  if (unresolved.length) {
    compatible = false;
    reasons.push(`Core roles not mapped to the humanoid names: ${unresolved.join(", ")}.`);
  }
  if (compatible) reasons.push("Same 52 body joints as straight_16_11.glb, all with identity authored rotation, and Head/Neck/arms map to the body joints.");

  return {
    bones,
    roles,
    compatible,
    compatibilityReasons: reasons,
    skeletons: [...skeletons].map(([s, meshes]) => ({ joints: s.bones.length, root: s.bones[0]?.name ?? "?", meshes })),
  };
}

/** Explicit user override of one role. `null` unmaps it. Throws on an unknown bone. */
export function overrideRole(analysis: RigAnalysis, role: string, boneName: string | null): RoleResolution {
  const prev = analysis.roles.get(role);
  if (!prev) throw new Error(`Unknown role ${role}`);
  if (boneName !== null && !analysis.bones.has(boneName)) throw new Error(`No bone named "${boneName}"`);
  const next: RoleResolution = boneName === null
    ? { ...prev, status: prev.candidates.length > 1 ? "ambiguous" : "missing", bone: null, reason: "Unmapped by the user." }
    : { ...prev, status: "mapped", bone: boneName, reason: `Selected explicitly by the user ("${boneName}", ${analysis.bones.get(boneName)!.directSkinVerts} directly skinned vertices).` };
  analysis.roles.set(role, next);
  return next;
}

// ── Disposal ─────────────────────────────────────────────────────────────────

export interface OwnedResources {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  skeletons: Set<THREE.Skeleton>;
}

const texturesOf = (material: THREE.Material): THREE.Texture[] => {
  const out: THREE.Texture[] = [];
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === "object" && (value as THREE.Texture).isTexture) out.push(value as THREE.Texture);
  }
  return out;
};

/** Snapshot of everything a freshly parsed GLB owns. Take it BEFORE any material pass runs. */
export function collectOwned(root: THREE.Object3D): OwnedResources {
  const owned: OwnedResources = { geometries: new Set(), materials: new Set(), textures: new Set(), skeletons: new Set() };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    owned.geometries.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat) continue;
      owned.materials.add(mat);
      for (const t of texturesOf(mat)) owned.textures.add(t);
    }
    const s = (o as THREE.SkinnedMesh).skeleton;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && s) owned.skeletons.add(s);
  });
  return owned;
}

/**
 * Frees what the GLB owned plus any material currently on its meshes (a trial
 * material pass may have swapped some in). Textures NOT in `owned.textures` are
 * left alone: the production material pass keeps module-level texture caches
 * shared with other loads, and disposing those would break the next one.
 */
export function disposeOwned(root: THREE.Object3D, owned: OwnedResources): { geometries: number; materials: number; textures: number; skeletons: number } {
  const materials = new Set(owned.materials);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    owned.geometries.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) materials.add(mat);
  });
  root.removeFromParent();
  for (const g of owned.geometries) g.dispose();
  for (const mat of materials) mat.dispose();
  for (const t of owned.textures) t.dispose();
  for (const s of owned.skeletons) s.dispose();
  return { geometries: owned.geometries.size, materials: materials.size, textures: owned.textures.size, skeletons: owned.skeletons.size };
}

export const formatBytes = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
