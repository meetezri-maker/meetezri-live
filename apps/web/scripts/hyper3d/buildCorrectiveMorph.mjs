#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 1B — WRITE THE EXPERIMENTAL ASSET with the SELECTED corrective morph.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The field itself is built by `correctiveField.buildField` — the SAME function
 * the sweep measured, called with the selected parameters. The sweep and the
 * writer cannot diverge, which they could in Stage 1 when the construction
 * lived here.
 *
 * WHAT THIS FILE OWNS: the GLB patch. A deterministic read-then-append that
 * copies the original BIN chunk through byte for byte as a prefix and appends
 * exactly two accessors after it, so every pre-existing accessor keeps its
 * byteOffset and every pre-existing bufferView still addresses the same bytes.
 * Preservation is a property of the layout rather than of our care, and
 * `verifyCorrectiveMorph.mjs` proves it by comparing the byte ranges directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SELECTED PARAMETERS, and why these
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   amplitude  3.0 mm      falloff 16 mm      gate band 5.0 mm
 *
 * Measured over eight candidates (`sweepCorrectiveMorph`, `sweepGateBand`):
 *
 *   ampl/band   lowerDrop   upper   cornUp   maxEdge   invert@1.0   invert posed
 *   6.0/1.5       5.94      0.000   0.000     310 %        73         61 (AA)
 *   4.0/3.5       3.59      0.000   0.000     127 %         0         31 (AA), 36 (jaw)
 *   3.5/5.0       2.44      0.000   0.000      90 %         0          1 (jaw)
 *   3.0/5.0       2.10      0.000   0.000      77 %         0          0        <- SHIPS
 *   2.5/5.0       1.75      0.000   0.000      63 %         0          0
 *
 * THE POSED COLUMN IS WHAT DECIDES IT. 4.0 mm passes the correction-alone gate
 * and then inverts 31 faces once a real AA pose has already opened the jaw —
 * the same class of mistake Stage 1 made, one level up, and the reason §4 asks
 * for combined poses rather than the morph in isolation. 3.5 mm still costs one
 * face at `jawOpen 0.55`. 3.0 mm is the largest amplitude that is clean
 * everywhere.
 *
 * 2.5 mm is cleaner still but delivers 1.75 mm of drop, which is below the
 * 1.84-2.17 mm the asset's own `mouthLowerDown` already contributes — a
 * correction smaller than the channel it supplements is not a meaningful
 * improvement (§5). 3.0 mm at band 5.0 doubles the lip's own contribution while
 * holding every quality gate.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { MM, loadMesh, buildField } from "./correctiveField.mjs";

const ORIGINAL = "apps/web/public/avatars/female_2291.glb";
const OUTPUT = "apps/web/public/avatars/experimental/female_2291-lowerlip-v2.glb";
const MORPH_NAME = "mouthLowerDownDeep";

/** The selected candidate. See the note above for the measurements. */
export const SELECTED = Object.freeze({
  amplitudeMM: 3.0,
  falloffMM: 16.0,
  gateBandMM: 5.0,
  chinStartMM: 6.0,
  chinEndMM: 13.0,
  maxNormalDelta: 1.0
});

function main() {
  if (!existsSync(ORIGINAL)) throw new Error(`missing ${ORIGINAL}`);
  const originalBuf = readFileSync(ORIGINAL);
  const originalSha = createHash("sha256").update(originalBuf).digest("hex");

  const mesh = loadMesh(ORIGINAL);
  const names = mesh.names;
  if (names.includes(MORPH_NAME)) throw new Error(`${MORPH_NAME} already present in the source`);

  console.log(`original      ${ORIGINAL}`);
  console.log(`  sha256      ${originalSha}`);
  console.log(`  mesh0       ${mesh.vertexCount} verts, ${mesh.indices.length / 3} tris, ${names.length} morphs`);
  console.log(`  mouth loop  ${mesh.mouthLoop.length} verts — lower ${mesh.lowerMargin.length}, upper ${mesh.upperMargin.length}, corners ${mesh.corners.length}`);
  console.log(`  gate anchor zMid ${mesh.zMid.toFixed(4)} local  (the field is 0 at and above this height)`);
  console.log(`  selected    amplitude ${SELECTED.amplitudeMM} mm, falloff ${SELECTED.falloffMM} mm, gate band ${SELECTED.gateBandMM} mm`);

  const { deltaPos, deltaNrm, direction, stats } = buildField(mesh, SELECTED);
  console.log(`  direction   ${direction.map((x) => x.toFixed(4)).join(", ")}  (the asset's own mouthLowerDown)`);
  console.log(`  field       ${stats.touched} verts, ${stats.mirrored} symmetrised, ${stats.unmatched} unmatched, peak ${stats.peakMM.toFixed(2)} mm`);
  console.log(`  normals     peak |delta n| ${stats.peakNormalDelta.toFixed(4)}, clamped ${stats.clamped}`);

  // ── append, preserving every original byte ───────────────────────────────
  const json = JSON.parse(JSON.stringify(mesh.glb.json));
  const align4 = (n) => (n + 3) & ~3;
  const posBytes = Buffer.from(deltaPos.buffer, deltaPos.byteOffset, deltaPos.byteLength);
  const nrmBytes = Buffer.from(deltaNrm.buffer, deltaNrm.byteOffset, deltaNrm.byteLength);

  const originalBinLength = mesh.glb.binLength;
  const posViewOffset = align4(originalBinLength);
  const nrmViewOffset = align4(posViewOffset + posBytes.length);
  const newBinLength = align4(nrmViewOffset + nrmBytes.length);

  const bounds = (arr) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        const x = arr[i + k];
        if (x < min[k]) min[k] = x;
        if (x > max[k]) max[k] = x;
      }
    }
    return { min, max };
  };

  json.buffers[0].byteLength = newBinLength;
  const posViewIndex = json.bufferViews.push({ buffer: 0, byteOffset: posViewOffset, byteLength: posBytes.length }) - 1;
  const nrmViewIndex = json.bufferViews.push({ buffer: 0, byteOffset: nrmViewOffset, byteLength: nrmBytes.length }) - 1;
  const pb = bounds(deltaPos), nb = bounds(deltaNrm);
  const posAccIndex = json.accessors.push({
    bufferView: posViewIndex, componentType: 5126, count: mesh.vertexCount, type: "VEC3", min: pb.min, max: pb.max
  }) - 1;
  const nrmAccIndex = json.accessors.push({
    bufferView: nrmViewIndex, componentType: 5126, count: mesh.vertexCount, type: "VEC3", min: nb.min, max: nb.max
  }) - 1;

  json.meshes[0].primitives[0].targets.push({ POSITION: posAccIndex, NORMAL: nrmAccIndex });
  json.meshes[0].extras.targetNames.push(MORPH_NAME);
  json.meshes[0].weights.push(0);
  // A node pinning its own weights array must grow too, or the renderer sees a
  // length mismatch. This asset's node[0] has none; check rather than assume.
  for (const node of json.nodes) {
    if (node.mesh === 0 && Array.isArray(node.weights)) node.weights.push(0);
  }

  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc(align4(jsonBytes.length) - jsonBytes.length, 0x20)]);
  const binPadded = Buffer.alloc(newBinLength, 0);
  mesh.glb.bin.copy(binPadded, 0, 0, originalBinLength); // THE ORIGINAL BIN, byte for byte
  posBytes.copy(binPadded, posViewOffset);
  nrmBytes.copy(binPadded, nrmViewOffset);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  const out = Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, out);

  console.log("");
  console.log(`experimental  ${OUTPUT}`);
  console.log(`  sha256      ${createHash("sha256").update(out).digest("hex")}`);
  console.log(`  bytes       ${out.length}  (+${out.length - originalBuf.length} vs original)`);
  console.log(`  morphs      ${json.meshes[0].extras.targetNames.length}  (last: ${MORPH_NAME})`);
  console.log("");
  const after = createHash("sha256").update(readFileSync(ORIGINAL)).digest("hex");
  console.log(`ORIGINAL UNTOUCHED: ${after === originalSha ? "YES" : "NO — STOP"}  sha256 ${after}`);
  if (after !== originalSha) process.exit(1);
}

main();
