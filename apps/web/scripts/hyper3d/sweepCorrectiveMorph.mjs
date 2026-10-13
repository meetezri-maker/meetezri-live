#!/usr/bin/env node
/**
 * STAGE 1B §2 — CANDIDATE SWEEP.
 *
 * Builds each candidate field IN MEMORY through the shared `buildField` and
 * measures it. Nothing is written: the writer calls the same function with the
 * selected parameters, so what ships is what was measured.
 *
 * ACCEPTANCE, from §2: zero inverted faces at FULL influence. A candidate that
 * is clean at 0.5 and inverts at 1.0 is rejected — that was the Stage 1 failure
 * and the brief names it explicitly.
 */

import {
  MM, loadMesh, buildField, allDeltas, meshQuality, rmsDisplacementMM
} from "./correctiveField.mjs";

const ORIGINAL = "apps/web/public/avatars/female_2291.glb";

const mesh = loadMesh(ORIGINAL);
const deltas = allDeltas(mesh);

console.log("=== MESH REGIONS, from the closed boundary loop ===");
console.log(`  mouth loop        ${mesh.mouthLoop.length} welded verts`);
console.log(`  lower margin      ${mesh.lowerMargin.length}   upper margin ${mesh.upperMargin.length}   corners ${mesh.corners.length}`);
console.log(`  loop vertical     zMin ${mesh.zMin.toFixed(4)}  zMid ${mesh.zMid.toFixed(4)}  zMax ${mesh.zMax.toFixed(4)}  (span ${((mesh.zMax - mesh.zMin) * MM).toFixed(2)} mm)`);

/** Regions the correction must leave alone, expanded to every split copy. */
const expand = (list) => {
  const out = new Set();
  for (const v of list) for (const c of mesh.byPosition.get(mesh.posKey(v))) out.add(c);
  return [...out];
};
const UPPER = expand(mesh.upperMargin);
const CORNERS = expand(mesh.corners);
const LOWER = expand(mesh.lowerMargin);
/** The chin: well below the lip, near the midline, on the front of the face. */
const CHIN = [];
for (let v = 0; v < mesh.vertexCount; v += 1) {
  const belowMM = (mesh.positions[v * 3 + 2] - mesh.loopCentroid[2]) * MM;
  if (belowMM > 16 && belowMM < 40 && Math.abs(mesh.positions[v * 3]) < 2.5 && mesh.positions[v * 3 + 1] > 8) CHIN.push(v);
}
console.log(`  probe sets        lower ${LOWER.length}  upper ${UPPER.length}  corners ${CORNERS.length}  chin ${CHIN.length}`);

/** Post-calibration effective open-vowel poses, from the shipped table. */
const POSES = {
  AA: { jawOpen: 0.353, mouthLowerDownLeft: 0.421, mouthLowerDownRight: 0.46, mouthUpperUpLeft: 0.27, mouthUpperUpRight: 0.27 },
  AH: { jawOpen: 0.164, mouthLowerDownLeft: 0.243, mouthLowerDownRight: 0.266, mouthUpperUpLeft: 0.109, mouthUpperUpRight: 0.109 },
  AE: { jawOpen: 0.286, mouthStretchLeft: 0.364, mouthStretchRight: 0.34, mouthLowerDownLeft: 0.354, mouthLowerDownRight: 0.386, mouthUpperUpLeft: 0.187, mouthUpperUpRight: 0.187 }
};
/** Stage 1 runtime intent: open vowels only, scaled by their own aperture. */
const CORRECTION = { AA: 0.85, AH: 0.5, AE: 0.7 };

const marginZ = (deltaPos, weight, list) => {
  let s = 0;
  for (const v of list) s += mesh.positions[v * 3 + 2] + weight * deltaPos[v * 3 + 2];
  return s / list.length;
};

/** Aperture under a phoneme pose plus the correction, mm. */
function apertureMM(deltaPos, pose, corrWeight) {
  const z = (list) => {
    let s = 0;
    for (const v of list) {
      let c = mesh.positions[v * 3 + 2];
      for (const [name, w] of Object.entries(pose)) {
        const d = deltas[name];
        if (d && w) c += w * d[v * 3 + 2];
      }
      c += corrWeight * deltaPos[v * 3 + 2];
      s += c;
    }
    return s / list.length;
  };
  return (z(LOWER) - z(UPPER)) * MM;
}

const CANDIDATES = [
  { id: "S1-repro", amplitudeMM: 6.0, falloffMM: 14.0, note: "Stage 1 amplitude, now gated" },
  { id: "A", amplitudeMM: 4.0, falloffMM: 14.0, note: "" },
  { id: "B", amplitudeMM: 3.0, falloffMM: 14.0, note: "the Stage 1 suggestion" },
  { id: "C", amplitudeMM: 3.0, falloffMM: 18.0, note: "same drop, gentler gradient" },
  { id: "D", amplitudeMM: 3.5, falloffMM: 18.0, note: "" },
  { id: "E", amplitudeMM: 2.5, falloffMM: 16.0, note: "most conservative" }
];

console.log("\n=== §2 CANDIDATE SWEEP — acceptance is ZERO inverted faces at w = 1.0 ===");
console.log(
  "id".padEnd(9) + "ampl".padStart(6) + "fall".padStart(6) + "verts".padStart(7) +
  "lowerDrop".padStart(11) + "upper".padStart(8) + "corner".padStart(8) + "chin".padStart(7) +
  "maxEdge".padStart(9) + "minDot".padStart(9) + "inv@1.0".padStart(9) + "clamp".padStart(7)
);
const results = [];
for (const c of CANDIDATES) {
  const field = buildField(mesh, { amplitudeMM: c.amplitudeMM, falloffMM: c.falloffMM });
  const q1 = meshQuality(mesh, field.deltaPos, 1.0);
  const lowerDrop = (marginZ(field.deltaPos, 1, LOWER) - marginZ(field.deltaPos, 0, LOWER)) * MM;
  const r = {
    ...c, field, q1, lowerDrop,
    upper: rmsDisplacementMM(mesh, field.deltaPos, 1, UPPER),
    corner: rmsDisplacementMM(mesh, field.deltaPos, 1, CORNERS),
    chin: rmsDisplacementMM(mesh, field.deltaPos, 1, CHIN)
  };
  results.push(r);
  console.log(
    c.id.padEnd(9) +
    c.amplitudeMM.toFixed(1).padStart(6) + c.falloffMM.toFixed(0).padStart(6) +
    String(field.stats.touched).padStart(7) +
    lowerDrop.toFixed(2).padStart(11) +
    r.upper.toFixed(3).padStart(8) + r.corner.toFixed(3).padStart(8) + r.chin.toFixed(3).padStart(7) +
    `${q1.maxEdgeStretchPct.toFixed(2)}%`.padStart(9) +
    q1.worstDot.toFixed(4).padStart(9) +
    String(q1.inverted).padStart(9) +
    String(field.stats.clamped).padStart(7)
  );
}

console.log("\n=== INVERSION ACROSS THE WEIGHT LADDER (§4) ===");
console.log("id".padEnd(9) + [0, 0.25, 0.5, 0.75, 1.0].map((w) => `w=${w}`.padStart(10)).join(""));
for (const r of results) {
  const row = [0, 0.25, 0.5, 0.75, 1.0].map((w) => {
    const q = meshQuality(mesh, r.field.deltaPos, w);
    return `${q.inverted}`.padStart(10);
  });
  console.log(r.id.padEnd(9) + row.join(""));
}

console.log("\n=== OPEN-VOWEL APERTURE, original vs corrected (mm) ===");
console.log("id".padEnd(9) + ["AA", "AH", "AE"].map((p) => p.padStart(18)).join(""));
for (const r of results) {
  const cells = ["AA", "AH", "AE"].map((p) => {
    const before = apertureMM(r.field.deltaPos, POSES[p], 0);
    const after = apertureMM(r.field.deltaPos, POSES[p], CORRECTION[p]);
    return `${before.toFixed(2)}->${after.toFixed(2)}`.padStart(18);
  });
  console.log(r.id.padEnd(9) + cells.join(""));
}

console.log("\n=== INVERSION ON TOP OF A REAL PHONEME POSE (§4) ===");
console.log("id".padEnd(9) + "AA+corr".padStart(10) + "AH+corr".padStart(10) + "AE+corr".padStart(10) + "jawOpen.55".padStart(12) + "mouthClose".padStart(12) + "smile".padStart(9) + "pucker".padStart(9) + "funnel".padStart(9));
const POSED = {
  AA: [POSES.AA, CORRECTION.AA],
  AH: [POSES.AH, CORRECTION.AH],
  AE: [POSES.AE, CORRECTION.AE],
  jaw: [{ jawOpen: 0.55 }, 1.0],
  close: [{ mouthClose: 0.18 }, 1.0],
  smile: [{ mouthSmileLeft: 0.42, mouthSmileRight: 0.42 }, 1.0],
  pucker: [{ mouthPucker: 0.6 }, 1.0],
  funnel: [{ mouthFunnel: 0.45 }, 1.0]
};
for (const r of results) {
  const cells = Object.values(POSED).map(([pose, w]) => {
    const q = meshQuality(mesh, r.field.deltaPos, w, pose, deltas);
    return `${q.inverted}`.padStart(q === null ? 10 : 10);
  });
  console.log(r.id.padEnd(9) + cells.map((c, i) => c.padStart([10,10,10,12,12,9,9,9][i])).join(""));
}

console.log("\n=== VERDICT ===");
const passing = results.filter((r) => r.q1.inverted === 0 && r.upper < 0.05 && r.chin < 0.05);
if (!passing.length) {
  console.log("  NO CANDIDATE PASSES the zero-inversion gate.");
} else {
  // Most conservative that still delivers meaningful movement: smallest
  // amplitude among those passing, provided the lower-lip drop is useful.
  const useful = passing.filter((r) => r.lowerDrop >= 2.0);
  const chosen = (useful.length ? useful : passing).sort((a, b) => a.amplitudeMM - b.amplitudeMM)[0];
  for (const r of passing) {
    console.log(`  PASS  ${r.id}  ampl ${r.amplitudeMM} mm  falloff ${r.falloffMM} mm  lowerDrop ${r.lowerDrop.toFixed(2)} mm${r === chosen ? "   <- most conservative with meaningful movement" : ""}`);
  }
  console.log(`\n  SELECT: ${chosen.id} — amplitude ${chosen.amplitudeMM} mm, falloff ${chosen.falloffMM} mm`);
}
