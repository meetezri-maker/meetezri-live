#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 1 — GLB STRUCTURAL PRESERVATION VERIFIER.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §3 OF THE BRIEF: "A successful GLB load alone is insufficient evidence of
 * preservation. Verify original accessors, image payloads, and structural
 * metadata against the original asset."
 *
 * So this does not load the file into a renderer and declare victory. It opens
 * BOTH files and compares them structurally, byte range by byte range:
 *
 *   every ORIGINAL accessor's bytes, read through its own bufferView, must be
 *   byte-identical in the experimental file — all 214 of them, including the
 *   51 morph POSITION and NORMAL targets and the 14 sparse eyelash accessors
 *
 *   every embedded image's payload must be byte-identical
 *
 *   skins, inverseBindMatrices, node transforms, materials, textures, samplers
 *   and the scene graph must be deep-equal
 *
 *   targetNames must be the original 51 IN ORDER, with exactly one appended
 *
 * A single mismatch is a Stage 1 stop condition (§9) and exits non-zero.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ORIGINAL = process.argv[2] ?? "apps/web/public/avatars/female_2291.glb";
const EXPERIMENTAL = process.argv[3] ?? "apps/web/public/avatars/experimental/female_2291-lowerlip-v1.glb";
const MORPH_NAME = "mouthLowerDownDeep";

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parse(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binHeaderAt = 20 + jsonLength;
  const binLength = buf.readUInt32LE(binHeaderAt);
  const bin = buf.subarray(binHeaderAt + 8, binHeaderAt + 8 + binLength);
  return { buf, json, bin, binLength, sha: createHash("sha256").update(buf).digest("hex") };
}

/** The exact bytes an accessor addresses, including a sparse accessor's parts. */
function accessorBytes(glb, index) {
  const a = glb.json.accessors[index];
  const parts = [];
  const range = (viewIndex, byteOffset, count, type, componentType) => {
    const view = glb.json.bufferViews[viewIndex];
    const comps = TYPE_COMPONENTS[type];
    const size = COMPONENT_BYTES[componentType];
    const stride = view.byteStride || comps * size;
    const start = (view.byteOffset ?? 0) + (byteOffset ?? 0);
    const length = stride * (count - 1) + comps * size;
    return glb.bin.subarray(start, start + length);
  };
  if (a.bufferView !== undefined) {
    parts.push(range(a.bufferView, a.byteOffset, a.count, a.type, a.componentType));
  }
  if (a.sparse) {
    parts.push(range(a.sparse.indices.bufferView, a.sparse.indices.byteOffset, a.sparse.count, "SCALAR", a.sparse.indices.componentType));
    parts.push(range(a.sparse.values.bufferView, a.sparse.values.byteOffset, a.sparse.count, a.type, a.componentType));
  }
  return Buffer.concat(parts);
}

const sha = (b) => createHash("sha256").update(b).digest("hex");
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
  return ok;
};

const o = parse(ORIGINAL);
const x = parse(EXPERIMENTAL);

console.log("=== FILES ===");
console.log(`  original      ${ORIGINAL}`);
console.log(`                ${o.buf.length} bytes  sha256 ${o.sha}`);
console.log(`  experimental  ${EXPERIMENTAL}`);
console.log(`                ${x.buf.length} bytes  sha256 ${x.sha}`);
console.log(`  growth        +${x.buf.length - o.buf.length} bytes (+${(((x.buf.length - o.buf.length) / o.buf.length) * 100).toFixed(2)}%)`);

console.log("\n=== 1. THE ORIGINAL BIN IS A BYTE-FOR-BYTE PREFIX ===");
check(
  x.bin.subarray(0, o.binLength).equals(o.bin),
  "experimental BIN starts with the original BIN, unmodified",
  `${o.binLength} bytes compared`
);

console.log("\n=== 2. EVERY ORIGINAL ACCESSOR, BYTE FOR BYTE ===");
let accOk = 0, accBad = [];
for (let i = 0; i < o.json.accessors.length; i += 1) {
  const a = sha(accessorBytes(o, i));
  const b = sha(accessorBytes(x, i));
  if (a === b) accOk += 1;
  else accBad.push(i);
}
check(accBad.length === 0, `all ${o.json.accessors.length} original accessors identical`, `matched ${accOk}${accBad.length ? `, differ: ${accBad.join(",")}` : ""}`);

console.log("\n=== 3. MORPH TARGETS ===");
const oNames = o.json.meshes[0].extras.targetNames;
const xNames = x.json.meshes[0].extras.targetNames;
check(oNames.length === 51, "original mesh0 has 51 targets", `${oNames.length}`);
check(xNames.length === 52, "experimental mesh0 has 52 targets", `${xNames.length}`);
check(deepEqual(xNames.slice(0, 51), oNames), "the original 51 names are unchanged AND in order");
check(xNames[51] === MORPH_NAME, `the appended name is ${MORPH_NAME}`, xNames[51]);
check(
  deepEqual(x.json.meshes[0].primitives[0].targets.slice(0, 51), o.json.meshes[0].primitives[0].targets.slice(0, 51)),
  "the original 51 target accessor references are unchanged"
);
const newTarget = x.json.meshes[0].primitives[0].targets[51];
check(
  newTarget && newTarget.POSITION !== undefined && newTarget.NORMAL !== undefined,
  "the new target carries BOTH position and normal deltas",
  newTarget ? `POSITION ${newTarget.POSITION}, NORMAL ${newTarget.NORMAL}` : "missing"
);
check(
  x.json.meshes[0].weights.length === 52 && x.json.meshes[0].weights[51] === 0,
  "mesh.weights grew to 52 and the new weight defaults to 0"
);

console.log("\n=== 4. OTHER MESHES AND THEIR MORPHS (incl. eyelashes) ===");
for (let m = 1; m < o.json.meshes.length; m += 1) {
  check(deepEqual(x.json.meshes[m], o.json.meshes[m]), `mesh[${m}] "${o.json.meshes[m].name}" deep-equal`);
}
const lashMesh = o.json.meshes.findIndex((m) => (m.extras?.targetNames ?? []).some((n) => /Lash/i.test(n)));
if (lashMesh >= 0) {
  const names = o.json.meshes[lashMesh].extras.targetNames;
  check(
    deepEqual(x.json.meshes[lashMesh].extras.targetNames, names),
    `eyelash mesh[${lashMesh}] keeps all ${names.length} target names`
  );
  const sparse = o.json.meshes[lashMesh].primitives[0].targets
    .flatMap((t) => Object.values(t))
    .filter((i) => o.json.accessors[i].sparse);
  let sparseOk = true;
  for (const i of sparse) if (sha(accessorBytes(o, i)) !== sha(accessorBytes(x, i))) sparseOk = false;
  check(sparseOk, `all ${sparse.length} SPARSE eyelash accessors byte-identical`);
}

console.log("\n=== 5. SKINNING, NODES, SCENE ===");
check(deepEqual(x.json.skins, o.json.skins), `skins deep-equal (${o.json.skins[0].joints.length} joints)`);
const ibm = o.json.skins[0].inverseBindMatrices;
check(sha(accessorBytes(o, ibm)) === sha(accessorBytes(x, ibm)), "inverseBindMatrices byte-identical");
check(deepEqual(x.json.nodes, o.json.nodes), `nodes deep-equal (${o.json.nodes.length} nodes, transforms included)`);
check(deepEqual(x.json.scenes, o.json.scenes), "scenes deep-equal");
check(x.json.scene === o.json.scene, "default scene index unchanged");

console.log("\n=== 6. MATERIALS, TEXTURES, IMAGE PAYLOADS ===");
check(deepEqual(x.json.materials, o.json.materials), `materials deep-equal (${o.json.materials.length})`);
check(deepEqual(x.json.textures, o.json.textures), `textures deep-equal (${o.json.textures.length})`);
check(deepEqual(x.json.samplers, o.json.samplers), `samplers deep-equal (${(o.json.samplers ?? []).length})`);
let imageBytes = 0, imagesOk = true;
for (let i = 0; i < (o.json.images ?? []).length; i += 1) {
  const oi = o.json.images[i], xi = x.json.images[i];
  if (!deepEqual(xi, oi)) { imagesOk = false; continue; }
  if (oi.bufferView === undefined) continue;
  const ov = o.json.bufferViews[oi.bufferView], xv = x.json.bufferViews[xi.bufferView];
  const ob = o.bin.subarray(ov.byteOffset ?? 0, (ov.byteOffset ?? 0) + ov.byteLength);
  const xb = x.bin.subarray(xv.byteOffset ?? 0, (xv.byteOffset ?? 0) + xv.byteLength);
  imageBytes += ob.length;
  if (!ob.equals(xb)) imagesOk = false;
}
check(imagesOk, `all ${(o.json.images ?? []).length} embedded image payloads byte-identical`, `${(imageBytes / 1e6).toFixed(2)} MB compared`);

console.log("\n=== 7. TOPOLOGY AND ATTRIBUTES ===");
const op = o.json.meshes[0].primitives[0], xp = x.json.meshes[0].primitives[0];
check(deepEqual(xp.attributes, op.attributes), "mesh0 attribute accessor references unchanged");
check(xp.indices === op.indices, "mesh0 index accessor unchanged");
check(sha(accessorBytes(o, op.indices)) === sha(accessorBytes(x, op.indices)), "mesh0 index BYTES unchanged");
check(sha(accessorBytes(o, op.attributes.POSITION)) === sha(accessorBytes(x, op.attributes.POSITION)), "mesh0 POSITION bytes unchanged");
check(sha(accessorBytes(o, op.attributes.NORMAL)) === sha(accessorBytes(x, op.attributes.NORMAL)), "mesh0 authored NORMAL bytes unchanged");
check(sha(accessorBytes(o, op.attributes.TEXCOORD_0)) === sha(accessorBytes(x, op.attributes.TEXCOORD_0)), "mesh0 UV bytes unchanged");
check(o.json.accessors[op.attributes.POSITION].count === x.json.accessors[xp.attributes.POSITION].count, "vertex count unchanged", `${o.json.accessors[op.attributes.POSITION].count}`);

console.log("\n=== 8. GLTF VALIDITY OF WHAT WAS ADDED ===");
check(deepEqual(x.json.extensionsUsed ?? [], o.json.extensionsUsed ?? []), "no extension introduced");
check(deepEqual(x.json.extensionsRequired ?? [], o.json.extensionsRequired ?? []), "no required extension introduced");
check(x.json.accessors.length === o.json.accessors.length + 2, "exactly 2 accessors added", `${o.json.accessors.length} -> ${x.json.accessors.length}`);
check(x.json.bufferViews.length === o.json.bufferViews.length + 2, "exactly 2 bufferViews added", `${o.json.bufferViews.length} -> ${x.json.bufferViews.length}`);
check(x.json.buffers.length === 1 && x.json.buffers[0].byteLength === x.binLength, "single buffer, byteLength matches the BIN chunk");
let viewsInBounds = true;
for (const v of x.json.bufferViews) if ((v.byteOffset ?? 0) + v.byteLength > x.binLength) viewsInBounds = false;
check(viewsInBounds, "every bufferView lies inside the BIN chunk");
const posAcc = x.json.accessors[newTarget.POSITION];
const nrmAcc = x.json.accessors[newTarget.NORMAL];
check(
  posAcc.count === x.json.accessors[xp.attributes.POSITION].count && nrmAcc.count === posAcc.count,
  "the new deltas have one entry per vertex", `${posAcc.count}`
);
check(posAcc.type === "VEC3" && nrmAcc.type === "VEC3" && posAcc.componentType === 5126, "new accessors are float32 VEC3");
check(Array.isArray(posAcc.min) && Array.isArray(posAcc.max), "new POSITION accessor declares min/max");
/**
 * Offset 12 is the JSON chunk's LENGTH; offset 16 is its TYPE. Reading 16 here
 * returns 0x4E4F534A ("JSON", 1313821514), which is not divisible by 4 and
 * fails for a reason that has nothing to do with the asset — which is exactly
 * what the first run of this verifier reported.
 */
check(x.buf.readUInt32LE(16) === 0x4e4f534a, "chunk 0 is declared JSON");
check(x.buf.readUInt32LE(12) % 4 === 0, "JSON chunk length is 4-byte aligned", `${x.buf.readUInt32LE(12)}`);
check(
  x.buf.readUInt32LE(8) === x.buf.length,
  "declared total length matches the file size",
  `${x.buf.readUInt32LE(8)} vs ${x.buf.length}`
);
check(x.binLength % 4 === 0, "BIN chunk length is 4-byte aligned", `${x.binLength}`);

console.log("\n=== 9. THE ORIGINAL FILE IS UNTOUCHED ===");
const EXPECTED_ORIGINAL_SHA = "d65d4e197a4e93a79c222dee7e2b5846d0cb6bd815e83082867525759a83842d";
check(o.sha === EXPECTED_ORIGINAL_SHA, "production asset sha256 matches the recorded baseline", o.sha);

console.log("");
if (failures === 0) console.log("STRUCTURAL PRESERVATION: ALL CHECKS PASSED");
else console.log(`STRUCTURAL PRESERVATION: ${failures} CHECK(S) FAILED — STAGE 1 STOP CONDITION`);
process.exit(failures === 0 ? 0 : 1);
