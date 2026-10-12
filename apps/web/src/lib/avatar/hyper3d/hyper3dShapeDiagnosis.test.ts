import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HYPER3D_GLB_PATH,
  deformationMM,
  jawPart,
  lipPart,
  lipLandmarks,
  loadLipModel,
  measureLips,
  shapeDistanceMM,
  topVerts,
  type LipLandmarks,
  type LipModel
} from "./hyper3dLipGeometry";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  calibrateHyper3dPose,
  hyper3dMorphCalibration
} from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * §3-§6 — PHONEME SHAPE DIAGNOSIS, from the real asset.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The brief asks for the EFFECTIVE values after calibration rather than the
 * authored ones, and for visual distinctiveness to be judged from geometry
 * rather than from blendshape numbers. So every pose here goes
 *
 *   authored pose  ->  x defaultIntensity  ->  calibrateHyper3dPose  ->  GLB vertices
 *
 * using the SAME `hyper3dPhonemeToBlendshape` the controller reads and the SAME
 * `calibrateHyper3dPose` the frame path applies. Nothing is transcribed.
 *
 * It asserts the instrument and prints the diagnosis; the shaping decisions it
 * informs are reviewed before anything is changed.
 */

const GLB = `public/avatars/female_2291.glb`;
const available = existsSync(GLB);
const describeGlb = available ? describe : describe.skip;

type Row = {
  phoneme: string;
  viseme: string;
  pose: BlendshapePose;
  measurement: ReturnType<typeof measureLips>;
  deform: number;
  jawMM: number;
  lipMM: number;
  lipShare: number;
};

/** `pose x defaultIntensity`, then the production calibration. */
function effectivePose(phoneme: string): BlendshapePose {
  const definition = (hyper3dPhonemeToBlendshape as unknown as Record<string, {
    pose: BlendshapePose;
    defaultIntensity: number;
    viseme: string;
  }>)[phoneme];
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(definition.pose)) {
    scaled[name] = value * definition.defaultIntensity;
  }
  return calibrateHyper3dPose(scaled);
}

const visemeOf = (phoneme: string) =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, { viseme: string }>)[phoneme]?.viseme ?? "-";

const ORDER = [
  "AA", "AE", "AH",
  "AO", "AW", "OY",
  "AY", "EH", "EY", "IH", "IY",
  "ER", "OW", "UH", "UW",
  "P", "B", "M", "F", "V", "TH", "DH", "T", "D", "N", "NG", "K", "G",
  "S", "Z", "SH", "ZH", "CH", "JH", "L", "R", "W", "Y", "HH"
];

let model: LipModel;
let lm: LipLandmarks;
const rows: Row[] = [];

if (available) {
  model = loadLipModel(GLB);
  lm = lipLandmarks(model);
  for (const phoneme of ORDER) {
    if (!(hyper3dPhonemeToBlendshape as Record<string, unknown>)[phoneme]) continue;
    const pose = effectivePose(phoneme);
    const jawMM = deformationMM(model, lm, jawPart(pose));
    const lipMM = deformationMM(model, lm, lipPart(pose));
    rows.push({
      phoneme,
      viseme: visemeOf(phoneme),
      pose,
      measurement: measureLips(model, lm, pose),
      deform: deformationMM(model, lm, pose),
      jawMM,
      lipMM,
      lipShare: jawMM + lipMM > 0 ? lipMM / (jawMM + lipMM) : 0
    });
  }
}

const poseOf = (phoneme: string) => rows.find((r) => r.phoneme === phoneme)!.pose;
const rowOf = (phoneme: string) => rows.find((r) => r.phoneme === phoneme)!;

describeGlb("the geometry instrument", () => {
  it("reads the asset and finds the lip landmarks", () => {
    expect(model.vertCount).toBe(13631);
    expect(Object.keys(model.deltas).length).toBe(51);
    expect(lm.region.length).toBeGreaterThan(300);
    expect(lm.marginUpper.length).toBeGreaterThan(50);
    expect(lm.marginLower.length).toBeGreaterThan(50);
  });

  it("agrees with the calibration table's own measured travel, to 2 decimals", () => {
    /**
     * THE UNIT PROOF. Every channel with a documented `travelMM` must have a peak
     * GLB displacement of exactly that, in units of 10 mm. If this fails the
     * instrument is measuring a different asset or a different scale, and every
     * number the diagnosis prints is meaningless.
     */
    for (const channel of [
      "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
      "mouthFunnel", "mouthPucker", "mouthClose", "mouthUpperUpLeft", "mouthLowerDownLeft",
      "mouthRollLower", "mouthShrugLower", "mouthShrugUpper", "mouthPressLeft"
    ]) {
      const [peakVert] = topVerts(model, channel, 1);
      const d = model.deltas[channel];
      const x = d[peakVert * 3];
      const y = d[peakVert * 3 + 1];
      const z = d[peakVert * 3 + 2];
      const peakMM = Math.sqrt(x * x + y * y + z * z) * 10;
      expect(peakMM).toBeCloseTo(hyper3dMorphCalibration[channel].travelMM, 2);
    }
  });

  it("reproduces the asset's own documented aperture and protrusion behaviour", () => {
    const apertureOf = (pose: BlendshapePose) => measureLips(model, lm, pose).apertureMM;
    // jawOpen is a monotone opener across the documented ladder.
    const ladder = [0.1, 0.25, 0.35, 0.5, 1].map((w) => apertureOf({ jawOpen: w }));
    for (let i = 1; i < ladder.length; i += 1) expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    // 0.5 -> documented 23.0 mm.
    expect(apertureOf({ jawOpen: 0.5 })).toBeGreaterThan(21);
    expect(apertureOf({ jawOpen: 0.5 })).toBeLessThan(26);
    // THE DECISIVE CHECK: pucker protrudes ~11 mm while barely changing the gap.
    const pucker = measureLips(model, lm, { mouthPucker: 1 });
    expect(pucker.protrusionMM).toBeGreaterThan(8);
    expect(Math.abs(pucker.apertureMM - apertureOf({}))).toBeLessThan(1.5);
    // And funnel OPENS the lips on this asset, which is why its gain is halved.
    expect(apertureOf({ mouthFunnel: 1 })).toBeGreaterThan(apertureOf({}) + 12);
    // mouthClose past ~0.2 drives the lower lip through the upper one.
    expect(apertureOf({ mouthClose: 0.3 })).toBeLessThan(0);
  });
});

describeGlb("phoneme shape diagnosis", () => {
  it("prints the effective geometry of every phoneme", () => {
    const lines: string[] = [""];
    lines.push("=== EFFECTIVE GEOMETRY PER PHONEME (post-calibration, measured on female_2291.glb) ===");
    lines.push(
      "ph".padEnd(5) + "vis".padEnd(6) + "apert".padStart(8) + "width".padStart(8) +
      "protr".padStart(8) + "upLift".padStart(8) + "loDrop".padStart(8) +
      "spread".padStart(8) + "deform".padStart(8) + "jawMM".padStart(8) +
      "lipMM".padStart(8) + "lip%".padStart(6)
    );
    for (const r of rows) {
      const m = r.measurement;
      lines.push(
        r.phoneme.padEnd(5) + r.viseme.padEnd(6) +
        m.apertureMM.toFixed(2).padStart(8) + m.widthMM.toFixed(2).padStart(8) +
        m.protrusionMM.toFixed(2).padStart(8) + m.upperLipLiftMM.toFixed(2).padStart(8) +
        m.lowerLipDropMM.toFixed(2).padStart(8) + m.cornerSpreadMM.toFixed(2).padStart(8) +
        r.deform.toFixed(2).padStart(8) + r.jawMM.toFixed(2).padStart(8) +
        r.lipMM.toFixed(2).padStart(8) + (r.lipShare * 100).toFixed(0).padStart(6)
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(rows.length).toBeGreaterThan(30);
  });

  it("prints the closest pairs by real geometry", () => {
    const pairs: Array<{ a: string; b: string; d: number; same: boolean }> = [];
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        pairs.push({
          a: rows[i].phoneme,
          b: rows[j].phoneme,
          d: shapeDistanceMM(model, lm, rows[i].pose, rows[j].pose),
          same: rows[i].viseme === rows[j].viseme
        });
      }
    }
    pairs.sort((x, y) => x.d - y.d);
    const lines: string[] = [""];
    lines.push("=== CLOSEST PAIRS BY GEOMETRY (mm RMS over the lip region) ===");
    lines.push("closest 24 overall:");
    for (const p of pairs.slice(0, 24)) {
      lines.push(`  ${p.a.padEnd(3)} ${p.b.padEnd(3)} ${p.d.toFixed(3).padStart(7)} mm${p.same ? "   (same viseme)" : ""}`);
    }
    lines.push("closest 16 with DIFFERENT visemes:");
    for (const p of pairs.filter((q) => !q.same).slice(0, 16)) {
      lines.push(`  ${p.a.padEnd(3)} ${p.b.padEnd(3)} ${p.d.toFixed(3).padStart(7)} mm`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(pairs.length).toBeGreaterThan(100);
  });

  it("prints within-family separation and lip participation", () => {
    const families: Record<string, string[]> = {
      "open AA/AE/AH": ["AA", "AE", "AH"],
      "front IY/IH/EH/EY": ["IY", "IH", "EH", "EY"],
      "rounded UW/OW/AO/UH": ["UW", "OW", "AO", "UH"],
      "diphthong AW/AY/OY/EY": ["AW", "AY", "OY", "EY"],
      "alveolar T/D/N": ["T", "D", "N"],
      "velar K/G/NG": ["K", "G", "NG"],
      "sibilant S/Z/SH/ZH": ["S", "Z", "SH", "ZH"],
      "labiodental F/V/TH/DH": ["F", "V", "TH", "DH"],
      "bilabial P/B/M": ["P", "B", "M"]
    };
    const lines: string[] = [""];
    lines.push("=== WITHIN-FAMILY SEPARATION (mm) ===");
    for (const [label, members] of Object.entries(families)) {
      const ds: Array<[string, number]> = [];
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          ds.push([
            `${members[i]}-${members[j]}`,
            shapeDistanceMM(model, lm, poseOf(members[i]), poseOf(members[j]))
          ]);
        }
      }
      ds.sort((a, b) => a[1] - b[1]);
      lines.push(`  ${label.padEnd(23)} worst ${ds[0][1].toFixed(2)} mm (${ds[0][0]})`);
      lines.push(`  ${"".padEnd(23)} ${ds.map(([k, v]) => `${k} ${v.toFixed(2)}`).join("  ")}`);
    }

    lines.push("");
    lines.push("=== LIP PARTICIPATION, worst first ===");
    lines.push("  ph    lip%     jawMM    lipMM   deform   aperture");
    for (const r of [...rows].sort((a, b) => a.lipShare - b.lipShare).slice(0, 20)) {
      lines.push(
        `  ${r.phoneme.padEnd(4)} ${(r.lipShare * 100).toFixed(0).padStart(4)}%  ` +
        `${r.jawMM.toFixed(2).padStart(8)} ${r.lipMM.toFixed(2).padStart(8)} ` +
        `${r.deform.toFixed(2).padStart(8)} ${r.measurement.apertureMM.toFixed(2).padStart(10)}`
      );
    }

    lines.push("");
    lines.push("=== CHANNELS THAT RENDER BELOW THEIR OWN usefulMin ===");
    for (const r of rows) {
      const dead: string[] = [];
      for (const [name, value] of Object.entries(r.pose)) {
        const entry = hyper3dMorphCalibration[name];
        if (entry && value < entry.usefulMin) dead.push(`${name} ${value.toFixed(3)}<${entry.usefulMin}`);
      }
      if (dead.length) lines.push(`  ${r.phoneme.padEnd(4)} ${dead.join("   ")}`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(rowOf("AA").measurement.apertureMM).toBeGreaterThan(0);
  });
});

describe("diagnosis availability", () => {
  it("reports whether the GLB was found", () => {
    // eslint-disable-next-line no-console
    console.log(`hyper3d GLB: ${available ? "found" : "NOT FOUND — diagnosis skipped"} (${GLB})`);
    expect(typeof available).toBe("boolean");
  });
});
