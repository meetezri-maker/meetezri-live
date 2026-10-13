#!/usr/bin/env node
/**
 * STAGE 1B §1/§4 — THE GATE BAND, and what the max-edge-stretch number means.
 *
 * The amplitude sweep closed the upper-lip leak completely (0.000 mm) and
 * removed every inverted face, but reported a MAX EDGE STRETCH of 119-200 %.
 * That needs explaining before it is accepted or rejected, because a percentage
 * on a sub-millimetre edge is not the same kind of fact as a percentage on a
 * visible one.
 *
 * THE MECHANISM. The gate is 0 at the mouth midline and 1 on the lower lip, so
 * across the margin band two adjacent vertices can receive very different
 * displacements. Where the mesh edge between them is short, the RATIO changes a
 * lot even though the absolute change is small. Widening `gateBandMM` spreads
 * that gradient over more rows of vertices.
 *
 * Widening CANNOT reintroduce upper-lip contamination: the gate is
 * `smootherstep((z - zMid) / band)` and is exactly 0 for every vertex at or
 * above `zMid` whatever the band is. A wider band only makes the field weaker
 * NEAR the midline and leaves it unchanged lower down.
 *
 * So this sweep reports, for each band:
 *   max edge stretch as a PERCENTAGE and in MILLIMETRES
 *   upper-lip and chin contamination (must stay 0)
 *   the corner split, above and below the midline, which is what §1 is about
 */

import {
  MM, loadMesh, buildField, allDeltas, meshQuality, rmsDisplacementMM
} from "./correctiveField.mjs";

const mesh = loadMesh("apps/web/public/avatars/female_2291.glb");
const deltas = allDeltas(mesh);

const expand = (list) => {
  const out = new Set();
  for (const v of list) for (const c of mesh.byPosition.get(mesh.posKey(v))) out.add(c);
  return [...out];
};
const LOWER = expand(mesh.lowerMargin);
const UPPER = expand(mesh.upperMargin);
const CORNERS = expand(mesh.corners);
/**
 * THE CORNER SPLIT. The commissure spans the midline: its LOWER half belongs to
 * the lower lip and should move with it, while its UPPER half must not move at
 * all. Reporting one number for the whole corner band conflates a correct
 * movement with a defect, which is why the amplitude sweep's single "corner"
 * figure of 0.66-1.56 mm could not be read.
 */
const CORNER_UPPER = CORNERS.filter((v) => mesh.positions[v * 3 + 2] < mesh.zMid);
const CORNER_LOWER = CORNERS.filter((v) => mesh.positions[v * 3 + 2] >= mesh.zMid);
const CHIN = [];
for (let v = 0; v < mesh.vertexCount; v += 1) {
  const belowMM = (mesh.positions[v * 3 + 2] - mesh.loopCentroid[2]) * MM;
  if (belowMM > 16 && belowMM < 40 && Math.abs(mesh.positions[v * 3]) < 2.5 && mesh.positions[v * 3 + 1] > 8) CHIN.push(v);
}
console.log(`corner band ${CORNERS.length} verts: ${CORNER_UPPER.length} above the midline, ${CORNER_LOWER.length} below`);

/** Max edge-length change in BOTH units, over triangles touching the field. */
function edgeStretch(deltaPos, weight) {
  const touched = new Set();
  for (let v = 0; v < mesh.vertexCount; v += 1) {
    if (Math.abs(deltaPos[v * 3]) + Math.abs(deltaPos[v * 3 + 1]) + Math.abs(deltaPos[v * 3 + 2]) > 0) touched.add(v);
  }
  let maxPct = 0, maxMM = 0, maxPctEdgeLenMM = 0, n = 0, sumPct = 0;
  const seen = new Set();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    if (!tri.some((v) => touched.has(v))) continue;
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bl = Math.hypot(
        mesh.positions[a * 3] - mesh.positions[b * 3],
        mesh.positions[a * 3 + 1] - mesh.positions[b * 3 + 1],
        mesh.positions[a * 3 + 2] - mesh.positions[b * 3 + 2]
      );
      if (bl < 1e-9) continue;
      const nl = Math.hypot(
        (mesh.positions[a * 3] + weight * deltaPos[a * 3]) - (mesh.positions[b * 3] + weight * deltaPos[b * 3]),
        (mesh.positions[a * 3 + 1] + weight * deltaPos[a * 3 + 1]) - (mesh.positions[b * 3 + 1] + weight * deltaPos[b * 3 + 1]),
        (mesh.positions[a * 3 + 2] + weight * deltaPos[a * 3 + 2]) - (mesh.positions[b * 3 + 2] + weight * deltaPos[b * 3 + 2])
      );
      const pct = Math.abs(nl / bl - 1) * 100;
      const mm = Math.abs(nl - bl) * MM;
      sumPct += pct; n += 1;
      if (pct > maxPct) { maxPct = pct; maxPctEdgeLenMM = bl * MM; }
      if (mm > maxMM) maxMM = mm;
    }
  }
  return { maxPct, maxMM, maxPctEdgeLenMM, meanPct: n ? sumPct / n : 0, edges: n };
}

console.log("\n=== GATE-BAND SWEEP at amplitude 2.5 mm / falloff 16 mm ===");
console.log(
  "band".padStart(6) + "verts".padStart(7) + "lowerDrop".padStart(11) +
  "upper".padStart(8) + "cornUp".padStart(8) + "cornLo".padStart(8) + "chin".padStart(7) +
  "maxEdge%".padStart(10) + "maxEdgeMM".padStart(11) + "atEdgeLen".padStart(11) +
  "meanEdge%".padStart(11) + "inv@1.0".padStart(9)
);
const rows = [];
for (const gateBandMM of [1.5, 2.5, 3.5, 5.0, 7.0]) {
  const field = buildField(mesh, { amplitudeMM: 2.5, falloffMM: 16.0, gateBandMM });
  const q = meshQuality(mesh, field.deltaPos, 1.0);
  const es = edgeStretch(field.deltaPos, 1.0);
  const lowerDrop = (() => {
    let a = 0, b = 0;
    for (const v of LOWER) { a += mesh.positions[v * 3 + 2]; b += mesh.positions[v * 3 + 2] + field.deltaPos[v * 3 + 2]; }
    return ((b - a) / LOWER.length) * MM;
  })();
  const r = {
    gateBandMM, field, q, es, lowerDrop,
    upper: rmsDisplacementMM(mesh, field.deltaPos, 1, UPPER),
    cornUp: rmsDisplacementMM(mesh, field.deltaPos, 1, CORNER_UPPER),
    cornLo: rmsDisplacementMM(mesh, field.deltaPos, 1, CORNER_LOWER),
    chin: rmsDisplacementMM(mesh, field.deltaPos, 1, CHIN)
  };
  rows.push(r);
  console.log(
    gateBandMM.toFixed(1).padStart(6) + String(field.stats.touched).padStart(7) +
    lowerDrop.toFixed(2).padStart(11) +
    r.upper.toFixed(3).padStart(8) + r.cornUp.toFixed(3).padStart(8) + r.cornLo.toFixed(3).padStart(8) + r.chin.toFixed(3).padStart(7) +
    `${es.maxPct.toFixed(1)}%`.padStart(10) + es.maxMM.toFixed(3).padStart(11) +
    `${es.maxPctEdgeLenMM.toFixed(3)}mm`.padStart(11) +
    `${es.meanPct.toFixed(2)}%`.padStart(11) +
    String(q.inverted).padStart(9)
  );
}

console.log("\n=== THE SAME, at the amplitudes that passed §2 ===");
console.log("ampl".padStart(6) + "band".padStart(6) + "lowerDrop".padStart(11) + "upper".padStart(8) + "cornUp".padStart(8) + "maxEdge%".padStart(10) + "maxEdgeMM".padStart(11) + "inv@1.0".padStart(9));
const FINAL = [];
for (const amplitudeMM of [2.5, 3.0, 3.5, 4.0]) {
  for (const gateBandMM of [3.5, 5.0]) {
    const field = buildField(mesh, { amplitudeMM, falloffMM: 16.0, gateBandMM });
    const q = meshQuality(mesh, field.deltaPos, 1.0);
    const es = edgeStretch(field.deltaPos, 1.0);
    let a = 0, b = 0;
    for (const v of LOWER) { a += mesh.positions[v * 3 + 2]; b += mesh.positions[v * 3 + 2] + field.deltaPos[v * 3 + 2]; }
    const lowerDrop = ((b - a) / LOWER.length) * MM;
    const upper = rmsDisplacementMM(mesh, field.deltaPos, 1, UPPER);
    const cornUp = rmsDisplacementMM(mesh, field.deltaPos, 1, CORNER_UPPER);
    FINAL.push({ amplitudeMM, gateBandMM, lowerDrop, upper, cornUp, es, q, field });
    console.log(
      amplitudeMM.toFixed(1).padStart(6) + gateBandMM.toFixed(1).padStart(6) +
      lowerDrop.toFixed(2).padStart(11) + upper.toFixed(3).padStart(8) + cornUp.toFixed(3).padStart(8) +
      `${es.maxPct.toFixed(1)}%`.padStart(10) + es.maxMM.toFixed(3).padStart(11) + String(q.inverted).padStart(9)
    );
  }
}

console.log("\n=== POSED INVERSION for the shortlist (correction at full influence over a real pose) ===");
const POSES = {
  AA: { jawOpen: 0.353, mouthLowerDownLeft: 0.421, mouthLowerDownRight: 0.46, mouthUpperUpLeft: 0.27, mouthUpperUpRight: 0.27 },
  "jawOpen 0.55": { jawOpen: 0.55 },
  "mouthClose 0.18": { mouthClose: 0.18 },
  "pucker 0.6": { mouthPucker: 0.6 },
  "funnel 0.45": { mouthFunnel: 0.45 },
  "smile 0.42": { mouthSmileLeft: 0.42, mouthSmileRight: 0.42 }
};
console.log("ampl/band".padEnd(12) + Object.keys(POSES).map((k) => k.padStart(17)).join(""));
for (const f of FINAL) {
  const cells = Object.values(POSES).map((pose) => String(meshQuality(mesh, f.field.deltaPos, 1.0, pose, deltas).inverted).padStart(17));
  console.log(`${f.amplitudeMM}/${f.gateBandMM}`.padEnd(12) + cells.join(""));
}
