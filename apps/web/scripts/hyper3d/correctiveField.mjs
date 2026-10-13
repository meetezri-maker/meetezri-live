/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 1B — THE CORRECTIVE FIELD, as one shared construction.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS MODULE EXISTS. Stage 1 built the field inside the writer, so the
 * swept candidates and the written asset were two transcriptions of the same
 * idea. They must be ONE: a sweep that measures something the writer then does
 * not produce is worse than no sweep. `sweepCorrectiveMorph` and
 * `buildCorrectiveMorph` both call `buildField` here, and the selected candidate
 * is written from the same bytes that were measured.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE STAGE 1 DEFECTS AND THEIR REPAIR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DEFECT 1 — THE FIELD CROSSED THE MOUTH OPENING. Measured: 3.426 mm RMS on the
 * inner UPPER lip and 1.9-2.7 mm on the corners, at full influence.
 *
 * ROOT CAUSE, confirmed rather than assumed. The mouth opening is ONE CLOSED
 * boundary loop of 74 vertices, so its lower and upper margins are joined around
 * the two corners. Minimum separation between a lower-margin and an upper-margin
 * vertex is 0.7301 mm, and ZERO pairs are closer than 0.1 mm — so this is not a
 * UV-weld artefact, which was the first hypothesis and was wrong. A 14 mm
 * geodesic simply walks the short way round the corner and arrives on the upper
 * lip.
 *
 * THE REPAIR is a VERTICAL GATE, not a smaller radius. A smaller radius would
 * shrink the correction everywhere to avoid one leak path. Instead the field is
 * gated on the vertex's own height against the loop's own mid-height:
 *
 *   zMid        = midpoint of the boundary loop's vertical extent
 *   lipGate(z)  = smootherstep((z - zMid) / GATE_BAND)      (+Z is DOWN)
 *
 * so the gate is 0 at and above the mouth midline, rises smoothly over
 * `GATE_BAND`, and is 1 on the lower lip body. It closes the corner route by
 * construction, because any surface path from the lower margin to the upper
 * margin must pass THROUGH the midline band where the gate is 0 — and the
 * Dijkstra refuses to expand out of a gated-off vertex, so the path does not
 * merely arrive weakened, it does not exist.
 *
 * IT ALSO SOLVES THE CORNERS FOR FREE. The loop's corners sit at the lateral
 * extremes near the midline, so the same gate takes them to ~0. "No unintended
 * corner pulling" needs no second mechanism.
 *
 * DEFECT 2 — FACE INVERSION. Measured: 73 inverted faces at w = 1.0 and 44 at
 * w = 0.85, with 0 at w = 0.5. 6 mm of displacement across a 14 mm falloff is a
 * surface gradient near 0.43, and the mesh cannot absorb that where the lower
 * lip already folds. Amplitude and falloff are therefore swept and chosen from
 * the inversion count, with zero at FULL influence as the gate.
 */

import { readFileSync } from "node:fs";

/** 1 local unit = 10 mm at runtime. */
export const MM = 10;

/** The measured lip-centre, in local units. Used only to pick the right loop. */
const MOUTH_CENTRE = [0, 10.328, 3.349];

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${path}`);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binHeaderAt = 20 + jsonLength;
  const binLength = buf.readUInt32LE(binHeaderAt);
  const bin = buf.subarray(binHeaderAt + 8, binHeaderAt + 8 + binLength);
  return { buf, json, bin, binLength };
}

export function readAccessor(glb, index) {
  const a = glb.json.accessors[index];
  if (a.sparse) throw new Error(`accessor ${index} is sparse`);
  const view = glb.json.bufferViews[a.bufferView];
  const comps = TYPE_COMPONENTS[a.type];
  const size = COMPONENT_BYTES[a.componentType];
  const stride = view.byteStride || comps * size;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * comps);
  for (let i = 0; i < a.count; i += 1) {
    for (let c = 0; c < comps; c += 1) {
      const at = start + i * stride + c * size;
      out[i * comps + c] =
        a.componentType === 5126 ? glb.bin.readFloatLE(at)
        : a.componentType === 5125 ? glb.bin.readUInt32LE(at)
        : a.componentType === 5123 ? glb.bin.readUInt16LE(at)
        : glb.bin.readUInt8(at);
    }
  }
  return out;
}

export const smootherstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Area-weighted vertex normals — the convention the authored normals follow. */
export function vertexNormals(positions, indices, vertexCount) {
  const n = new Float64Array(vertexCount * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const e1 = [positions[b * 3] - ax, positions[b * 3 + 1] - ay, positions[b * 3 + 2] - az];
    const e2 = [positions[c * 3] - ax, positions[c * 3 + 1] - ay, positions[c * 3 + 2] - az];
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0]
    ];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k += 1) n[v * 3 + k] += cr[k];
  }
  for (let v = 0; v < vertexCount; v += 1) {
    const len = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
    if (len > 1e-12) for (let k = 0; k < 3; k += 1) n[v * 3 + k] /= len;
  }
  return n;
}

/**
 * Everything about the mesh the field needs, derived once from the index buffer
 * and the position attribute. No heuristics beyond picking which boundary loop
 * is the mouth, which is done by proximity to the measured lip centre.
 */
export function loadMesh(path) {
  const glb = parseGlb(path);
  const mesh = glb.json.meshes[0];
  const prim = mesh.primitives[0];
  const names = mesh.extras.targetNames;
  const positions = readAccessor(glb, prim.attributes.POSITION);
  const indices = readAccessor(glb, prim.indices);
  const authoredNormals = readAccessor(glb, prim.attributes.NORMAL);
  const vertexCount = positions.length / 3;

  // ── boundary loops ──────────────────────────────────────────────────────
  const edgeUse = new Map();
  const ek = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = ek(p, q);
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
    }
  }
  const boundaryEdges = [...edgeUse.entries()].filter(([, u]) => u === 1).map(([k]) => k.split("_").map(Number));

  const posKey = (v) =>
    `${positions[v * 3].toFixed(5)},${positions[v * 3 + 1].toFixed(5)},${positions[v * 3 + 2].toFixed(5)}`;
  const byPosition = new Map();
  for (let v = 0; v < vertexCount; v += 1) {
    const k = posKey(v);
    if (!byPosition.has(k)) byPosition.set(k, []);
    byPosition.get(k).push(v);
  }
  const weld = new Map();
  for (const group of byPosition.values()) for (const v of group) weld.set(v, group[0]);

  const loopAdj = new Map();
  for (const [a, b] of boundaryEdges) {
    const wa = weld.get(a), wb = weld.get(b);
    if (!loopAdj.has(wa)) loopAdj.set(wa, new Set());
    if (!loopAdj.has(wb)) loopAdj.set(wb, new Set());
    loopAdj.get(wa).add(wb);
    loopAdj.get(wb).add(wa);
  }
  const seen = new Set();
  const loops = [];
  for (const start of loopAdj.keys()) {
    if (seen.has(start)) continue;
    const stack = [start], comp = [];
    seen.add(start);
    while (stack.length) {
      const v = stack.pop();
      comp.push(v);
      for (const nb of loopAdj.get(v) ?? []) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    loops.push(comp);
  }
  const centroidOf = (list) => {
    const c = [0, 0, 0];
    for (const v of list) for (let k = 0; k < 3; k += 1) c[k] += positions[v * 3 + k];
    return c.map((x) => x / list.length);
  };
  let mouthLoop = null, best = Infinity;
  for (const loop of loops) {
    if (loop.length < 20 || loop.length > 200) continue;
    const c = centroidOf(loop);
    const d = Math.hypot(c[0] - MOUTH_CENTRE[0], c[1] - MOUTH_CENTRE[1], c[2] - MOUTH_CENTRE[2]);
    if (d < best) { best = d; mouthLoop = loop; }
  }
  if (!mouthLoop) throw new Error("mouth boundary loop not found");

  // ── the loop's own vertical geometry: this is what the gate is anchored to ─
  const loopZ = mouthLoop.map((v) => positions[v * 3 + 2]);
  const zMin = Math.min(...loopZ), zMax = Math.max(...loopZ);
  const zMid = (zMin + zMax) / 2;
  const loopCentroid = centroidOf(mouthLoop);

  /**
   * LOWER, UPPER AND CORNERS, from the loop's own coordinates (§1 of Stage 1B).
   * Lower and upper split at `zMid`; corners are the lateral extremes, taken as
   * the outermost 12 % of the loop's X span on each side.
   */
  const loopX = mouthLoop.map((v) => positions[v * 3]);
  const xMin = Math.min(...loopX), xMax = Math.max(...loopX);
  const cornerBand = (xMax - xMin) * 0.12;
  const isCorner = (v) => positions[v * 3] <= xMin + cornerBand || positions[v * 3] >= xMax - cornerBand;
  const lowerMargin = mouthLoop.filter((v) => positions[v * 3 + 2] >= zMid && !isCorner(v));
  const upperMargin = mouthLoop.filter((v) => positions[v * 3 + 2] < zMid && !isCorner(v));
  const corners = mouthLoop.filter(isCorner);

  // ── surface adjacency, with split copies joined ─────────────────────────
  const adjacency = new Map();
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) { link(p, q); link(q, p); }
  }
  for (const group of byPosition.values()) {
    if (group.length < 2) continue;
    for (const a of group) for (const b of group) if (a !== b) link(a, b);
  }

  return {
    glb, prim, names, positions, indices, authoredNormals, vertexCount,
    byPosition, posKey, adjacency,
    mouthLoop, lowerMargin, upperMargin, corners,
    zMin, zMax, zMid, loopCentroid
  };
}

/**
 * Build the corrective field.
 *
 * `amplitudeMM`  additional inner-lower-lip drop at influence 1.0
 * `falloffMM`    geodesic radius of the field
 * `gateBandMM`   vertical band over which the lower-lip gate rises 0 -> 1
 * `chinStartMM`  depth below the lip centre at which chin suppression begins
 * `chinEndMM`    depth at which it reaches zero
 * `maxNormalDelta` bound on the normal-delta magnitude; see Stage 1
 */
export function buildField(mesh, {
  amplitudeMM,
  falloffMM,
  gateBandMM = 1.5,
  chinStartMM = 6.0,
  chinEndMM = 13.0,
  maxNormalDelta = 1.0
}) {
  const { positions, indices, vertexCount, adjacency, byPosition, posKey, lowerMargin, zMid, loopCentroid } = mesh;

  /**
   * THE LOWER-LIP GATE. 0 at and above the mouth midline, 1 on the lower lip.
   * `+Z` is DOWN, so a LARGER z is LOWER on the face.
   */
  const gateBand = gateBandMM / MM;
  const lipGate = (v) => smootherstep((positions[v * 3 + 2] - zMid) / gateBand);

  /** Chin suppression, on depth below the lip centre. */
  const chinGate = (v) => {
    const belowMM = (positions[v * 3 + 2] - loopCentroid[2]) * MM;
    if (belowMM <= chinStartMM) return 1;
    if (belowMM >= chinEndMM) return 0;
    return 1 - smootherstep((belowMM - chinStartMM) / (chinEndMM - chinStartMM));
  };

  // ── seed: the lower margin, with every split copy, gated ────────────────
  const seed = new Set();
  for (const v of lowerMargin) for (const copy of byPosition.get(posKey(v))) seed.add(copy);

  // ── geodesic, BLOCKED at the gate ───────────────────────────────────────
  /**
   * The gate is applied to PROPAGATION, not only to the final weight. A vertex
   * whose gate is effectively zero is a wall: the search neither assigns it a
   * distance nor expands out of it. That is what makes the corner route
   * non-existent rather than merely attenuated — the whole Stage 1 defect.
   */
  const GATE_FLOOR = 1e-3;
  const distance = new Float64Array(vertexCount).fill(Infinity);
  const limit = falloffMM / MM;
  const frontier = [];
  for (const v of seed) {
    if (lipGate(v) <= GATE_FLOOR) continue;
    distance[v] = 0;
    frontier.push(v);
  }
  while (frontier.length) {
    let bestIndex = 0;
    for (let i = 1; i < frontier.length; i += 1) {
      if (distance[frontier[i]] < distance[frontier[bestIndex]]) bestIndex = i;
    }
    const v = frontier.splice(bestIndex, 1)[0];
    const dv = distance[v];
    if (dv >= limit) continue;
    for (const nb of adjacency.get(v) ?? []) {
      if (lipGate(nb) <= GATE_FLOOR) continue; // the wall
      const step = Math.hypot(
        positions[nb * 3] - positions[v * 3],
        positions[nb * 3 + 1] - positions[v * 3 + 1],
        positions[nb * 3 + 2] - positions[v * 3 + 2]
      );
      const nd = dv + step;
      if (nd < distance[nb] && nd < limit) { distance[nb] = nd; frontier.push(nb); }
    }
  }

  // ── direction: the asset's own authored lower-lip direction ─────────────
  const nameIndex = new Map(mesh.names.map((n, i) => [n, i]));
  const target = (name) => readAccessor(mesh.glb, mesh.prim.targets[nameIndex.get(name)].POSITION);
  const lowerL = target("mouthLowerDownLeft");
  const lowerR = target("mouthLowerDownRight");
  let dir = [0, 0, 0];
  for (const v of seed) for (let k = 0; k < 3; k += 1) dir[k] += lowerL[v * 3 + k] + lowerR[v * 3 + k];
  const dirLen = Math.hypot(...dir);
  if (dirLen < 1e-9) throw new Error("authored lower-lip direction is degenerate");
  dir = dir.map((x) => x / dirLen);

  // ── weights ─────────────────────────────────────────────────────────────
  const weights = new Float64Array(vertexCount);
  for (let v = 0; v < vertexCount; v += 1) {
    if (!Number.isFinite(distance[v])) continue;
    const falloff = 1 - smootherstep(distance[v] / limit);
    if (falloff <= 0) continue;
    const w = falloff * lipGate(v) * chinGate(v);
    if (w > 0) weights[v] = w;
  }

  // ── symmetry, over a 0.2 mm tolerance grid ──────────────────────────────
  const CELL = 0.02, MIRROR_TOL = 0.02;
  const cellKey = (x, y, z) => `${Math.round(x / CELL)},${Math.round(y / CELL)},${Math.round(z / CELL)}`;
  const grid = new Map();
  for (let v = 0; v < vertexCount; v += 1) {
    const k = cellKey(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(v);
  }
  const nearestTo = (x, y, z) => {
    let bestV = -1, bestD = Infinity;
    const cx = Math.round(x / CELL), cy = Math.round(y / CELL), cz = Math.round(z / CELL);
    for (let i = -1; i <= 1; i += 1) for (let j = -1; j <= 1; j += 1) for (let k = -1; k <= 1; k += 1) {
      for (const v of grid.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
        const d = Math.hypot(positions[v * 3] - x, positions[v * 3 + 1] - y, positions[v * 3 + 2] - z);
        if (d < bestD) { bestD = d; bestV = v; }
      }
    }
    return bestD <= MIRROR_TOL ? bestV : -1;
  };
  let mirrored = 0, unmatched = 0;
  const sym = Float64Array.from(weights);
  for (let v = 0; v < vertexCount; v += 1) {
    if (weights[v] <= 0) continue;
    const partner = nearestTo(-positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    if (partner < 0) { unmatched += 1; continue; }
    sym[v] = (weights[v] + weights[partner]) / 2;
    mirrored += 1;
  }

  // ── displacement ────────────────────────────────────────────────────────
  const amplitude = amplitudeMM / MM;
  const deltaPos = new Float32Array(vertexCount * 3);
  let touched = 0, peakMM = 0;
  for (let v = 0; v < vertexCount; v += 1) {
    if (sym[v] <= 0) continue;
    touched += 1;
    for (let k = 0; k < 3; k += 1) deltaPos[v * 3 + k] = amplitude * sym[v] * dir[k];
    const mag = amplitude * sym[v] * MM;
    if (mag > peakMM) peakMM = mag;
  }

  // ── normal deltas, bounded ──────────────────────────────────────────────
  const baseNormals = vertexNormals(positions, indices, vertexCount);
  const displaced = Float64Array.from(positions);
  for (let i = 0; i < deltaPos.length; i += 1) displaced[i] += deltaPos[i];
  const newNormals = vertexNormals(displaced, indices, vertexCount);
  const deltaNrm = new Float32Array(vertexCount * 3);
  let peakNormalDelta = 0, clamped = 0;
  for (let i = 0; i < deltaNrm.length; i += 3) {
    const d = [0, 0, 0];
    for (let k = 0; k < 3; k += 1) d[k] = newNormals[i + k] - baseNormals[i + k];
    const m = Math.hypot(d[0], d[1], d[2]);
    if (m > maxNormalDelta) {
      const s = maxNormalDelta / m;
      for (let k = 0; k < 3; k += 1) d[k] *= s;
      clamped += 1;
    }
    for (let k = 0; k < 3; k += 1) deltaNrm[i + k] = d[k];
    const after = Math.hypot(d[0], d[1], d[2]);
    if (after > peakNormalDelta) peakNormalDelta = after;
  }

  return {
    deltaPos, deltaNrm, weights: sym, direction: dir,
    stats: { touched, peakMM, mirrored, unmatched, clamped, peakNormalDelta, seedSize: seed.size }
  };
}

// ── measurement helpers, shared by the sweep and the final report ─────────

export const posWith = (mesh, deltaPos, weight, v, axis) =>
  mesh.positions[v * 3 + axis] + weight * deltaPos[v * 3 + axis];

/** RMS displacement of a vertex list under the correction alone, mm. */
export function rmsDisplacementMM(mesh, deltaPos, weight, list) {
  let sum = 0;
  for (const v of list) {
    let d2 = 0;
    for (let a = 0; a < 3; a += 1) {
      const d = weight * deltaPos[v * 3 + a];
      d2 += d * d;
    }
    sum += d2;
  }
  return Math.sqrt(sum / Math.max(1, list.length)) * MM;
}

/**
 * Face-level inversion and stretch over every triangle touching the field.
 *
 * `basePose` lets the check run on top of a real phoneme pose, which is what §4
 * asks for: a face that survives the correction alone can still invert when the
 * jaw has already opened.
 */
export function meshQuality(mesh, deltaPos, weight, basePose = {}, deltasByName = null) {
  const { positions, indices, vertexCount } = mesh;
  const posed = Float64Array.from(positions);
  if (deltasByName) {
    for (const [name, w] of Object.entries(basePose)) {
      const d = deltasByName[name];
      if (!d || !w) continue;
      for (let i = 0; i < posed.length; i += 1) posed[i] += w * d[i];
    }
  }
  const after = Float64Array.from(posed);
  for (let i = 0; i < after.length; i += 1) after[i] += weight * deltaPos[i];

  const touched = new Set();
  for (let v = 0; v < vertexCount; v += 1) {
    if (Math.abs(deltaPos[v * 3]) + Math.abs(deltaPos[v * 3 + 1]) + Math.abs(deltaPos[v * 3 + 2]) > 0) touched.add(v);
  }
  const faceNormal = (arr, a, b, c) => {
    const e1 = [arr[b * 3] - arr[a * 3], arr[b * 3 + 1] - arr[a * 3 + 1], arr[b * 3 + 2] - arr[a * 3 + 2]];
    const e2 = [arr[c * 3] - arr[a * 3], arr[c * 3 + 1] - arr[a * 3 + 1], arr[c * 3 + 2] - arr[a * 3 + 2]];
    return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  };
  let worstDot = 1, inverted = 0, considered = 0;
  let baseLen = 0, nowLen = 0, maxEdgeStretch = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    if (!tri.some((v) => touched.has(v))) continue;
    const nb = faceNormal(posed, ...tri);
    const na = faceNormal(after, ...tri);
    const lb = Math.hypot(...nb), la = Math.hypot(...na);
    if (lb > 1e-12 && la > 1e-12) {
      considered += 1;
      const dot = (nb[0] * na[0] + nb[1] * na[1] + nb[2] * na[2]) / (lb * la);
      if (dot < worstDot) worstDot = dot;
      if (dot < 0) inverted += 1;
    }
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const bl = Math.hypot(posed[a * 3] - posed[b * 3], posed[a * 3 + 1] - posed[b * 3 + 1], posed[a * 3 + 2] - posed[b * 3 + 2]);
      const nl = Math.hypot(after[a * 3] - after[b * 3], after[a * 3 + 1] - after[b * 3 + 1], after[a * 3 + 2] - after[b * 3 + 2]);
      baseLen += bl; nowLen += nl;
      if (bl > 1e-9) {
        const s = Math.abs(nl / bl - 1) * 100;
        if (s > maxEdgeStretch) maxEdgeStretch = s;
      }
    }
  }
  return {
    worstDot, inverted, considered,
    meanStretchPct: baseLen > 0 ? (nowLen / baseLen - 1) * 100 : 0,
    maxEdgeStretchPct: maxEdgeStretch
  };
}

/** Every morph delta by name, for posed checks. */
export function allDeltas(mesh) {
  const out = {};
  for (const [i, t] of mesh.prim.targets.entries()) {
    if (t.POSITION !== undefined) out[mesh.names[i]] = readAccessor(mesh.glb, t.POSITION);
  }
  return out;
}
