#!/usr/bin/env node
/**
 * STAGE 1B §4 — COMBINED-POSE GEOMETRY VALIDATION of the WRITTEN asset.
 *
 * Reads the experimental GLB back off disk and validates the morph as the
 * renderer will see it, rather than validating the in-memory field that
 * produced it. Everything here is measured on `female_2291-lowerlip-v2.glb`.
 */

import { MM, loadMesh, allDeltas, meshQuality, rmsDisplacementMM } from "./correctiveField.mjs";

const ORIGINAL = "apps/web/public/avatars/female_2291.glb";
const EXPERIMENTAL = "apps/web/public/avatars/experimental/female_2291-lowerlip-v2.glb";
const CORR = "mouthLowerDownDeep";

const original = loadMesh(ORIGINAL);
const mesh = loadMesh(EXPERIMENTAL);
const deltas = allDeltas(mesh);
const corrective = deltas[CORR];
if (!corrective) throw new Error(`${CORR} not found in ${EXPERIMENTAL}`);

/** Landmarks come from the loop geometry, identical in both assets. */
const expand = (list) => {
  const out = new Set();
  for (const v of list) for (const c of mesh.byPosition.get(mesh.posKey(v))) out.add(c);
  return [...out];
};
const LOWER = expand(mesh.lowerMargin);
const UPPER = expand(mesh.upperMargin);
const CORNERS = expand(mesh.corners);
const CORNER_UPPER = CORNERS.filter((v) => mesh.positions[v * 3 + 2] < mesh.zMid);
const CORNER_LOWER = CORNERS.filter((v) => mesh.positions[v * 3 + 2] >= mesh.zMid);
const CHIN = [];
for (let v = 0; v < mesh.vertexCount; v += 1) {
  const belowMM = (mesh.positions[v * 3 + 2] - mesh.loopCentroid[2]) * MM;
  if (belowMM > 16 && belowMM < 40 && Math.abs(mesh.positions[v * 3]) < 2.5 && mesh.positions[v * 3 + 1] > 8) CHIN.push(v);
}

console.log("=== THE WRITTEN ASSET ===");
console.log(`  ${EXPERIMENTAL}`);
console.log(`  morphs ${mesh.names.length}, last "${mesh.names.at(-1)}"`);
let touched = 0, peak = 0;
for (let v = 0; v < mesh.vertexCount; v += 1) {
  const m = Math.hypot(corrective[v * 3], corrective[v * 3 + 1], corrective[v * 3 + 2]);
  if (m > 1e-9) touched += 1;
  if (m > peak) peak = m;
}
console.log(`  corrective field ${touched} verts, peak ${(peak * MM).toFixed(3)} mm`);
console.log(`  probe sets: lower ${LOWER.length}  upper ${UPPER.length}  cornerUpper ${CORNER_UPPER.length}  cornerLower ${CORNER_LOWER.length}  chin ${CHIN.length}`);

/** Position under a pose, optionally plus the correction. */
const posed = (pose, corrWeight) => {
  const out = Float64Array.from(mesh.positions);
  for (const [name, w] of Object.entries(pose)) {
    const d = deltas[name];
    if (!d || !w) continue;
    for (let i = 0; i < out.length; i += 1) out[i] += w * d[i];
  }
  if (corrWeight) for (let i = 0; i < out.length; i += 1) out[i] += corrWeight * corrective[i];
  return out;
};
const meanZ = (arr, list) => {
  let s = 0;
  for (const v of list) s += arr[v * 3 + 2];
  return s / list.length;
};
const meanX = (arr, list) => {
  let s = 0;
  for (const v of list) s += arr[v * 3];
  return s / list.length;
};
const meanY = (arr, list) => {
  let s = 0;
  for (const v of list) s += arr[v * 3 + 1];
  return s / list.length;
};
const cornerL = CORNERS.filter((v) => mesh.positions[v * 3] > 0);
const cornerR = CORNERS.filter((v) => mesh.positions[v * 3] <= 0);

const POSES = {
  AA: { jawOpen: 0.353, mouthLowerDownLeft: 0.421, mouthLowerDownRight: 0.46, mouthUpperUpLeft: 0.27, mouthUpperUpRight: 0.27 },
  AH: { jawOpen: 0.164, mouthLowerDownLeft: 0.243, mouthLowerDownRight: 0.266, mouthUpperUpLeft: 0.109, mouthUpperUpRight: 0.109 },
  AE: { jawOpen: 0.286, mouthStretchLeft: 0.364, mouthStretchRight: 0.34, mouthLowerDownLeft: 0.354, mouthLowerDownRight: 0.386, mouthUpperUpLeft: 0.187, mouthUpperUpRight: 0.187 }
};
/** Stage 1 runtime intent. Runtime integration is NOT part of Stage 1B. */
const CORRECTION = { AA: 0.85, AH: 0.5, AE: 0.7 };

console.log("\n=== §4 OPEN VOWELS: ORIGINAL vs EXPERIMENTAL (mm) ===");
console.log("ph   corr  innerLowerDrop      aperture         width        protrusion       chinDrop");
for (const ph of ["AA", "AH", "AE"]) {
  const a = posed(POSES[ph], 0);
  const b = posed(POSES[ph], CORRECTION[ph]);
  const neutral = mesh.positions;
  const drop = (arr) => (meanZ(arr, LOWER) - meanZ(neutral, LOWER)) * MM;
  const ap = (arr) => (meanZ(arr, LOWER) - meanZ(arr, UPPER)) * MM;
  const wd = (arr) => Math.abs(meanX(arr, cornerL) - meanX(arr, cornerR)) * MM;
  const pr = (arr) => (meanY(arr, LOWER) - meanY(neutral, LOWER)) * MM;
  const ch = (arr) => (meanZ(arr, CHIN) - meanZ(neutral, CHIN)) * MM;
  const pair = (x, y) => `${x.toFixed(2).padStart(6)}->${y.toFixed(2).padStart(6)}`;
  console.log(
    `${ph.padEnd(4)} ${CORRECTION[ph].toFixed(2)}  ${pair(drop(a), drop(b))}  ${pair(ap(a), ap(b))}  ` +
    `${pair(wd(a), wd(b))}  ${pair(pr(a), pr(b))}  ${pair(ch(a), ch(b))}`
  );
}
console.log("  jawOpen is byte-identical in both columns — the aperture gain is lip, not jaw.");

console.log("\n=== §1 ISOLATION, correction alone at FULL influence ===");
for (const [label, list] of Object.entries({
  "inner LOWER lip (target)": LOWER,
  "inner UPPER lip": UPPER,
  "corner, ABOVE midline": CORNER_UPPER,
  "corner, BELOW midline": CORNER_LOWER,
  "chin": CHIN
})) {
  console.log(`  ${label.padEnd(26)} RMS ${rmsDisplacementMM(mesh, corrective, 1, list).toFixed(4)} mm`);
}
let maxFar = 0;
for (let v = 0; v < mesh.vertexCount; v += 1) {
  const m = Math.hypot(corrective[v * 3], corrective[v * 3 + 1], corrective[v * 3 + 2]);
  if (m <= 1e-9) continue;
  const d = Math.hypot(
    mesh.positions[v * 3] - mesh.loopCentroid[0],
    mesh.positions[v * 3 + 1] - mesh.loopCentroid[1],
    mesh.positions[v * 3 + 2] - mesh.loopCentroid[2]
  ) * MM;
  if (d > maxFar) maxFar = d;
}
console.log(`  furthest displaced vertex from the lip centre: ${maxFar.toFixed(1)} mm`);

/** Continuity: the largest jump in displacement between adjacent vertices. */
let maxJump = 0, jumpEdge = null;
for (let t = 0; t < mesh.indices.length; t += 3) {
  const tri = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
  for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
    const ma = Math.hypot(corrective[a * 3], corrective[a * 3 + 1], corrective[a * 3 + 2]);
    const mb = Math.hypot(corrective[b * 3], corrective[b * 3 + 1], corrective[b * 3 + 2]);
    const j = Math.abs(ma - mb) * MM;
    if (j > maxJump) { maxJump = j; jumpEdge = [a, b]; }
  }
}
console.log(`  largest displacement step across one edge: ${maxJump.toFixed(3)} mm (verts ${jumpEdge})`);
console.log(`  — against a peak displacement of ${(peak * MM).toFixed(3)} mm, i.e. ${((maxJump / (peak * MM)) * 100).toFixed(0)}% in one edge`);

console.log("\n=== §4 WEIGHT LADDER x COMBINED POSES: inverted faces ===");
const CHECKS = {
  neutral: {},
  AA: POSES.AA,
  AH: POSES.AH,
  AE: POSES.AE,
  "jawOpen 0.55": { jawOpen: 0.55 },
  "mouthClose 0.18": { mouthClose: 0.18 },
  "smile 0.42": { mouthSmileLeft: 0.42, mouthSmileRight: 0.42 },
  "pucker 0.60": { mouthPucker: 0.6 },
  "funnel 0.45": { mouthFunnel: 0.45 }
};
const WEIGHTS = [0, 0.25, 0.5, 0.75, 1.0];
console.log("pose".padEnd(18) + WEIGHTS.map((w) => `w=${w}`.padStart(9)).join("") + "   worstDot@1.0   maxEdge@1.0");
let anyInverted = 0;
for (const [label, pose] of Object.entries(CHECKS)) {
  const cells = WEIGHTS.map((w) => {
    const q = meshQuality(mesh, corrective, w, pose, deltas);
    anyInverted += q.inverted;
    return String(q.inverted).padStart(9);
  });
  const q1 = meshQuality(mesh, corrective, 1.0, pose, deltas);
  console.log(
    label.padEnd(18) + cells.join("") +
    `   ${q1.worstDot.toFixed(4).padStart(11)}   ${`${q1.maxEdgeStretchPct.toFixed(1)}%`.padStart(10)}`
  );
}
console.log(`\n  TOTAL inverted faces across every pose and weight: ${anyInverted}`);

console.log("\n=== §4 LIP INTERSECTION: the inner-lip gap must never go negative ===");
console.log("pose".padEnd(18) + WEIGHTS.map((w) => `w=${w}`.padStart(9)).join(""));
for (const [label, pose] of Object.entries(CHECKS)) {
  const cells = WEIGHTS.map((w) => {
    const arr = posed(pose, w);
    return ((meanZ(arr, LOWER) - meanZ(arr, UPPER)) * MM).toFixed(2).padStart(9);
  });
  console.log(label.padEnd(18) + cells.join(""));
}

console.log("\n=== §4 NEUTRAL BEHAVIOUR: w = 0 must be identical to the original ===");
const origDeltas = allDeltas(original);
let maxDiff = 0;
for (const [label, pose] of Object.entries(CHECKS)) {
  const a = (() => {
    const out = Float64Array.from(original.positions);
    for (const [name, w] of Object.entries(pose)) {
      const d = origDeltas[name];
      if (!d || !w) continue;
      for (let i = 0; i < out.length; i += 1) out[i] += w * d[i];
    }
    return out;
  })();
  const b = posed(pose, 0);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff = Math.max(diff, Math.abs(a[i] - b[i]));
  maxDiff = Math.max(maxDiff, diff);
  console.log(`  ${label.padEnd(18)} max vertex difference ${(diff * MM).toExponential(2)} mm`);
}
console.log(`\n  worst across every pose: ${(maxDiff * MM).toExponential(2)} mm ${maxDiff === 0 ? "(exactly zero)" : ""}`);

console.log("\n=== §4 NORMAL CONSISTENCY of the corrective target ===");
const nrmAccIndex = mesh.prim.targets[mesh.names.indexOf(CORR)].NORMAL;
console.log(`  the corrective target declares a NORMAL delta accessor: ${nrmAccIndex !== undefined ? `yes (${nrmAccIndex})` : "NO — invalid"}`);
