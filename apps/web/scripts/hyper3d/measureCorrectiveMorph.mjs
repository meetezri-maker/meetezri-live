#!/usr/bin/env node
/**
 * STAGE 1 §5 — GEOMETRY MEASUREMENT of the corrective morph.
 *
 * Measures the experimental asset against the original, on the SAME landmarks
 * and in the SAME runtime millimetres as every earlier Hyper3D measurement
 * (1 local unit = 10 mm; axes X lateral, Y anterior, Z vertical with +Z down).
 *
 * The open-vowel poses are the real post-calibration effective values from
 * `hyper3dPhonemeToBlendshape` x `defaultIntensity` x `calibrateHyper3dPose`,
 * transcribed here as literals so this script has no app-code import and can run
 * standalone. The corpus tests cross-check the same numbers through the real
 * imports.
 */

import { readFileSync } from "node:fs";

const ORIGINAL = "apps/web/public/avatars/female_2291.glb";
const EXPERIMENTAL = "apps/web/public/avatars/experimental/female_2291-lowerlip-v1.glb";
const MM = 10;

function load(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const read3 = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    const s = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const o = new Float64Array(a.count * 3);
    for (let k = 0; k < o.length; k += 1) o[k] = buf.readFloatLE(s + k * 4);
    return o;
  };
  const readIdx = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    const s = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const o = new Int32Array(a.count);
    for (let k = 0; k < a.count; k += 1) o[k] = buf.readUInt16LE(s + k * 2);
    return o;
  };
  const prim = json.meshes[0].primitives[0];
  const names = json.meshes[0].extras.targetNames;
  const deltas = {};
  for (const [i, t] of prim.targets.entries()) if (t.POSITION !== undefined) deltas[names[i]] = read3(t.POSITION);
  return {
    base: read3(prim.attributes.POSITION),
    authoredNormals: read3(prim.attributes.NORMAL),
    indices: readIdx(prim.indices),
    deltas,
    names,
    count: json.accessors[prim.attributes.POSITION].count
  };
}

const topVerts = (m, channel, k) => {
  const d = m.deltas[channel];
  const mags = [];
  for (let v = 0; v < m.count; v += 1) {
    mags.push([d[v * 3] ** 2 + d[v * 3 + 1] ** 2 + d[v * 3 + 2] ** 2, v]);
  }
  mags.sort((a, b) => b[0] - a[0]);
  return mags.slice(0, k).map((e) => e[1]);
};

function landmarks(m) {
  const upper = topVerts(m, "mouthRollUpper", 120);
  const lower = topVerts(m, "mouthRollLower", 120);
  const cornerL = topVerts(m, "mouthSmileLeft", 40);
  const cornerR = topVerts(m, "mouthSmileRight", 40);
  const region = [...new Set([...upper, ...lower, ...cornerL, ...cornerR, ...topVerts(m, "mouthPucker", 120)])];
  const nearMid = (v) => Math.abs(m.base[v * 3]) < 1.2;
  // The inner lower-lip band: the mouth boundary loop's lower half.
  const edgeUse = new Map();
  const ek = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) edgeUse.set(ek(p, q), (edgeUse.get(ek(p, q)) ?? 0) + 1);
  }
  const bV = [...new Set([...edgeUse.entries()].filter(([, u]) => u === 1).flatMap(([k]) => k.split("_").map(Number)))];
  const MOUTH = [0, 10.328, 3.349];
  const near = bV.filter((v) => Math.hypot(m.base[v * 3] - MOUTH[0], m.base[v * 3 + 1] - MOUTH[1], m.base[v * 3 + 2] - MOUTH[2]) * MM < 30);
  const zs = near.map((v) => m.base[v * 3 + 2]);
  const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const innerLower = near.filter((v) => m.base[v * 3 + 2] >= midZ);
  const innerUpper = near.filter((v) => m.base[v * 3 + 2] < midZ);
  // The chin: below the lip, by surface position.
  const chin = [];
  for (let v = 0; v < m.count; v += 1) {
    const belowMM = (m.base[v * 3 + 2] - MOUTH[2]) * MM;
    if (belowMM > 16 && belowMM < 40 && Math.abs(m.base[v * 3]) < 2.5 && m.base[v * 3 + 1] > 8) chin.push(v);
  }
  return {
    upper, lower, cornerL, cornerR, region,
    marginUpper: upper.filter(nearMid), marginLower: lower.filter(nearMid),
    innerLower, innerUpper, chin
  };
}

const posAt = (m, pose, v, axis) => {
  let c = m.base[v * 3 + axis];
  for (const ch in pose) {
    const w = pose[ch], d = m.deltas[ch];
    if (w && d) c += w * d[v * 3 + axis];
  }
  return c;
};
const meanAxis = (m, pose, list, axis) => {
  let s = 0;
  for (const v of list) s += posAt(m, pose, v, axis);
  return s / list.length;
};

function measure(m, lm, pose) {
  const neutral = {};
  return {
    apertureMM: (meanAxis(m, pose, lm.marginLower, 2) - meanAxis(m, pose, lm.marginUpper, 2)) * MM,
    widthMM: Math.abs(meanAxis(m, pose, lm.cornerL, 0) - meanAxis(m, pose, lm.cornerR, 0)) * MM,
    protrusionMM: (meanAxis(m, pose, lm.region, 1) - meanAxis(m, neutral, lm.region, 1)) * MM,
    innerLowerDropMM: (meanAxis(m, pose, lm.innerLower, 2) - meanAxis(m, neutral, lm.innerLower, 2)) * MM,
    innerUpperLiftMM: -(meanAxis(m, pose, lm.innerUpper, 2) - meanAxis(m, neutral, lm.innerUpper, 2)) * MM,
    chinDropMM: (meanAxis(m, pose, lm.chin, 2) - meanAxis(m, neutral, lm.chin, 2)) * MM
  };
}

/** RMS vertex displacement from neutral over a list, mm. */
function deformMM(m, lm, pose, list) {
  let sum = 0;
  for (const v of list) {
    let d2 = 0;
    for (let a = 0; a < 3; a += 1) {
      const d = posAt(m, pose, v, a) - m.base[v * 3 + a];
      d2 += d * d;
    }
    sum += d2;
  }
  return Math.sqrt(sum / list.length) * MM;
}

/** Edge-length stretch over the lip region triangles, as a percentage. */
function stretchPct(m, pose, list) {
  const set = new Set(list);
  let base = 0, now = 0, n = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const tri = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    if (!tri.some((v) => set.has(v))) continue;
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const bl = Math.hypot(m.base[a * 3] - m.base[b * 3], m.base[a * 3 + 1] - m.base[b * 3 + 1], m.base[a * 3 + 2] - m.base[b * 3 + 2]);
      const nl = Math.hypot(
        posAt(m, pose, a, 0) - posAt(m, pose, b, 0),
        posAt(m, pose, a, 1) - posAt(m, pose, b, 1),
        posAt(m, pose, a, 2) - posAt(m, pose, b, 2)
      );
      base += bl; now += nl; n += 1;
    }
  }
  return ((now / base) - 1) * 100;
}

/** Worst normal flip over the displaced region: min dot(baseNormal, newNormal). */
function normalConsistency(m, pose, list) {
  const faceNormal = (p, a, b, c) => {
    const e1 = [p(b, 0) - p(a, 0), p(b, 1) - p(a, 1), p(b, 2) - p(a, 2)];
    const e2 = [p(c, 0) - p(a, 0), p(c, 1) - p(a, 1), p(c, 2) - p(a, 2)];
    return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  };
  const set = new Set(list);
  let worst = 1, flipped = 0, considered = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const tri = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    if (!tri.some((v) => set.has(v))) continue;
    const nb = faceNormal((v, a) => m.base[v * 3 + a], ...tri);
    const nn = faceNormal((v, a) => posAt(m, pose, v, a), ...tri);
    const lb = Math.hypot(...nb), ln = Math.hypot(...nn);
    if (lb < 1e-12 || ln < 1e-12) continue;
    considered += 1;
    const dot = (nb[0] * nn[0] + nb[1] * nn[1] + nb[2] * nn[2]) / (lb * ln);
    if (dot < worst) worst = dot;
    if (dot < 0) flipped += 1;
  }
  return { worst, flipped, considered };
}

// Post-calibration effective poses, from the shipped Hyper3D table.
const POSES = {
  neutral: {},
  AA: { jawOpen: 0.353, mouthLowerDownLeft: 0.421, mouthLowerDownRight: 0.46, mouthUpperUpLeft: 0.27, mouthUpperUpRight: 0.27 },
  AH: { jawOpen: 0.164, mouthLowerDownLeft: 0.243, mouthLowerDownRight: 0.266, mouthUpperUpLeft: 0.109, mouthUpperUpRight: 0.109 },
  AE: { jawOpen: 0.286, mouthStretchLeft: 0.364, mouthStretchRight: 0.34, mouthLowerDownLeft: 0.354, mouthLowerDownRight: 0.386, mouthUpperUpLeft: 0.187, mouthUpperUpRight: 0.187 },
  UW: { jawOpen: 0.061, mouthPucker: 0.574, mouthFunnel: 0.174 },
  OW: { jawOpen: 0.146, mouthFunnel: 0.174, mouthPucker: 0.435 },
  IY: { jawOpen: 0.065, mouthStretchLeft: 0.521, mouthStretchRight: 0.487, mouthSmileLeft: 0.151, mouthSmileRight: 0.151, mouthDimpleLeft: 0.202, mouthDimpleRight: 0.218 },
  smile: { mouthSmileLeft: 0.42, mouthSmileRight: 0.42, cheekSquintLeft: 0.25, cheekSquintRight: 0.25 },
  blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
  M: { mouthClose: 0.077, mouthPressLeft: 0.18, mouthPressRight: 0.18 }
};

const original = load(ORIGINAL);
const experimental = load(EXPERIMENTAL);
const lm = landmarks(original);

console.log("landmark sets (from the ORIGINAL asset, reused for both):");
console.log(`  inner lower ${lm.innerLower.length}   inner upper ${lm.innerUpper.length}   chin ${lm.chin.length}   region ${lm.region.length}`);
console.log(`  experimental morph count ${experimental.names.length}, last "${experimental.names.at(-1)}"`);

// How much correction each phoneme gets. Stage 1 runtime mapping, see
// `hyper3dCorrectiveMorph.ts` — open vowels only, scaled by their own aperture.
const CORRECTION = { AA: 0.85, AH: 0.5, AE: 0.7 };

console.log("\n=== §5 OPEN VOWELS: ORIGINAL vs EXPERIMENTAL ===");
console.log("ph   corr   innerLowerDrop     aperture        width         protrusion      chinDrop       jawMM   lipMM   lip%");
for (const ph of ["AA", "AH", "AE"]) {
  const o = measure(original, lm, POSES[ph]);
  const withCorr = { ...POSES[ph], mouthLowerDownDeep: CORRECTION[ph] };
  const x = measure(experimental, lm, withCorr);
  const jawOnly = Object.fromEntries(Object.entries(withCorr).filter(([k]) => k.startsWith("jaw")));
  const lipOnly = Object.fromEntries(Object.entries(withCorr).filter(([k]) => !k.startsWith("jaw")));
  const jawMM = deformMM(experimental, lm, jawOnly, lm.region);
  const lipMM = deformMM(experimental, lm, lipOnly, lm.region);
  const pair = (a, b) => `${a.toFixed(2).padStart(6)}->${b.toFixed(2).padStart(6)}`;
  console.log(
    `${ph.padEnd(4)} ${CORRECTION[ph].toFixed(2)}  ${pair(o.innerLowerDropMM, x.innerLowerDropMM)}  ` +
    `${pair(o.apertureMM, x.apertureMM)}  ${pair(o.widthMM, x.widthMM)}  ` +
    `${pair(o.protrusionMM, x.protrusionMM)}  ${pair(o.chinDropMM, x.chinDropMM)}  ` +
    `${jawMM.toFixed(2).padStart(6)} ${lipMM.toFixed(2).padStart(6)} ${((lipMM / (jawMM + lipMM)) * 100).toFixed(0).padStart(5)}%`
  );
}

console.log("\n=== §5 JAW IS NOT TOUCHED (the correction must not manufacture aperture via the jaw) ===");
for (const ph of ["AA", "AH", "AE"]) {
  console.log(`  ${ph}: jawOpen original ${POSES[ph].jawOpen.toFixed(3)}  experimental ${POSES[ph].jawOpen.toFixed(3)}  (identical by construction)`);
}

console.log("\n=== §5 MESH QUALITY IN THE CORRECTED REGION ===");
const displacedSet = [];
for (let v = 0; v < experimental.count; v += 1) {
  const d = experimental.deltas.mouthLowerDownDeep;
  if (Math.hypot(d[v * 3], d[v * 3 + 1], d[v * 3 + 2]) > 1e-9) displacedSet.push(v);
}
console.log(`  corrected field: ${displacedSet.length} vertices`);
for (const w of [0.5, 0.85, 1.0]) {
  const pose = { mouthLowerDownDeep: w };
  const st = stretchPct(experimental, pose, displacedSet);
  const nc = normalConsistency(experimental, pose, displacedSet);
  console.log(
    `  w=${w.toFixed(2)}: edge stretch ${st >= 0 ? "+" : ""}${st.toFixed(2)}%   ` +
    `worst face-normal dot ${nc.worst.toFixed(4)}   flipped faces ${nc.flipped} of ${nc.considered}`
  );
}

console.log("\n=== §5 UNRELATED REGIONS MUST NOT MOVE (correction at full influence) ===");
const full = { mouthLowerDownDeep: 1 };
const probes = {
  "inner upper lip": lm.innerUpper,
  "mouth corners L": lm.cornerL,
  "mouth corners R": lm.cornerR,
  "chin": lm.chin
};
for (const [label, list] of Object.entries(probes)) {
  console.log(`  ${label.padEnd(18)} RMS displacement ${deformMM(experimental, lm, full, list).toFixed(3)} mm`);
}
// Whole-mesh: where does the field reach at all?
let maxFar = 0, farV = -1;
const MOUTH = [0, 10.328, 3.349];
for (const v of displacedSet) {
  const dist = Math.hypot(experimental.base[v * 3] - MOUTH[0], experimental.base[v * 3 + 1] - MOUTH[1], experimental.base[v * 3 + 2] - MOUTH[2]) * MM;
  if (dist > maxFar) { maxFar = dist; farV = v; }
}
console.log(`  furthest displaced vertex from the mouth centre: ${maxFar.toFixed(1)} mm`);

console.log("\n=== §5 NEUTRAL AND UNRELATED EXPRESSIONS (correction at 0 must be a no-op) ===");
for (const ph of ["neutral", "smile", "blink", "UW", "OW", "IY", "M"]) {
  const o = measure(original, lm, POSES[ph]);
  const x = measure(experimental, lm, { ...POSES[ph], mouthLowerDownDeep: 0 });
  const same =
    Math.abs(o.apertureMM - x.apertureMM) < 1e-9 &&
    Math.abs(o.widthMM - x.widthMM) < 1e-9 &&
    Math.abs(o.innerLowerDropMM - x.innerLowerDropMM) < 1e-9;
  console.log(
    `  ${ph.padEnd(8)} ${same ? "IDENTICAL" : "DIFFERS"}   aperture ${x.apertureMM.toFixed(3)}  width ${x.widthMM.toFixed(3)}  innerLowerDrop ${x.innerLowerDropMM.toFixed(3)}`
  );
}
