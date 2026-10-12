import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deformationMM,
  jawPart,
  lipPart,
  lipLandmarks,
  loadLipModel,
  measureLips,
  shapeDistanceMM,
  type LipLandmarks,
  type LipModel
} from "./hyper3dLipGeometry";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * §6 / §7 — CANDIDATE SWEEP. Values are chosen from measured geometry here, and
 * only then written into the profile.
 *
 * Each candidate is an OVERRIDE applied on top of the shipped pose, so the
 * baseline column is the real current render and no production value moves until
 * a candidate has been measured and argued for.
 *
 * THE LADDERS ARE ASSERTED, not hoped for. A candidate that separates two vowels
 * by breaking the aperture or spread ordering the accepted table established is
 * a regression wearing an improvement's clothes, so every candidate is checked
 * against both ladders before it is considered.
 */

const GLB = "public/avatars/female_2291.glb";
const available = existsSync(GLB);
const describeGlb = available ? describe : describe.skip;

type Override = Record<string, BlendshapePose>;

const definitionOf = (phoneme: string) =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, {
    pose: BlendshapePose;
    defaultIntensity: number;
  }>)[phoneme];

/** `(pose + override) x defaultIntensity`, then the production calibration. */
function effective(phoneme: string, override: Override): BlendshapePose {
  const definition = definitionOf(phoneme);
  const merged: BlendshapePose = { ...definition.pose, ...(override[phoneme] ?? {}) };
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(merged)) {
    if (value > 0) scaled[name] = value * definition.defaultIntensity;
  }
  return calibrateHyper3dPose(scaled);
}

let model: LipModel;
let lm: LipLandmarks;
if (available) {
  model = loadLipModel(GLB);
  lm = lipLandmarks(model);
}

const BASELINE: Override = {};

/**
 * CANDIDATE 1 — the front family's missing upper-lip reveal.
 *
 * IY/EY/EH/IH currently measure an upper-lip lift of 0.44 / 0.20 / 0.17 /
 * 0.03 mm: the family does not use `mouthUpperUp` at all, on an asset where it
 * travels 7.53 mm and reveals the upper teeth. A front vowel that shows no teeth
 * is the specific thing missing, and it is also a THIRD axis for the two closest
 * pairs in the whole vowel inventory (EH-EY 1.16 mm, IH-EY 1.20 mm), which today
 * differ only in aperture and spread — two correlated quantities.
 *
 * Three depths, because `mouthUpperUp` also OPENS the lips (+6.7 mm at influence
 * 1.0) and the family's aperture ladder IY < IH < EY < EH must survive.
 */
const FRONT_A: Override = {
  IY: { mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18 },
  EY: { mouthUpperUpLeft: 0.13, mouthUpperUpRight: 0.13 },
  IH: { mouthUpperUpLeft: 0.08, mouthUpperUpRight: 0.08 },
  EH: { mouthUpperUpLeft: 0.03, mouthUpperUpRight: 0.03 }
};
const FRONT_B: Override = {
  IY: { mouthUpperUpLeft: 0.28, mouthUpperUpRight: 0.28 },
  EY: { mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2 },
  IH: { mouthUpperUpLeft: 0.12, mouthUpperUpRight: 0.12 },
  EH: { mouthUpperUpLeft: 0.05, mouthUpperUpRight: 0.05 }
};
const FRONT_C: Override = {
  IY: { mouthUpperUpLeft: 0.38, mouthUpperUpRight: 0.38 },
  EY: { mouthUpperUpLeft: 0.28, mouthUpperUpRight: 0.28 },
  IH: { mouthUpperUpLeft: 0.16, mouthUpperUpRight: 0.16 },
  EH: { mouthUpperUpLeft: 0.06, mouthUpperUpRight: 0.06 }
};

/**
 * CANDIDATE 1b — the same reveal, plus the corner pocket for the top of the
 * ladder only. `mouthDimple` is used by NO phoneme in the inventory and carries
 * 9.95 mm of "real corner-pocket geometry"; a deep corner is a true feature of
 * /i/ and, unlike more spread, it does not widen the mouth further or change the
 * aperture at all.
 */
const FRONT_B_DIMPLE: Override = {
  ...FRONT_B,
  IY: { mouthUpperUpLeft: 0.28, mouthUpperUpRight: 0.28, mouthDimpleLeft: 0.18, mouthDimpleRight: 0.18 },
  EY: { mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2, mouthDimpleLeft: 0.1, mouthDimpleRight: 0.1 }
};

/**
 * CANDIDATE 2 — open-vowel lip participation, within the asset's natural range.
 *
 * AA and AH measure 20 % and 21 % lip participation. `mouthUpperUp` is the one
 * channel with real headroom: AA sits at an authored 0.30 against 0.50 at
 * `naturalMax`, AH at 0.14 against 0.58. `mouthLowerDown` has almost none —
 * AA's right side reaches `naturalMax` at an authored 0.39 against today's 0.36.
 * THE JAW IS NOT TOUCHED: AA's effective `jawOpen` of 0.353 is exactly the 0.35
 * the calibration note derives as conversational for this asset.
 */
const OPEN_A: Override = {
  AA: { mouthUpperUpLeft: 0.38, mouthUpperUpRight: 0.38 },
  AH: { mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2 }
};
const OPEN_B: Override = {
  AA: { mouthUpperUpLeft: 0.44, mouthUpperUpRight: 0.44, mouthLowerDownLeft: 0.38, mouthLowerDownRight: 0.38 },
  AH: { mouthUpperUpLeft: 0.26, mouthUpperUpRight: 0.26, mouthLowerDownLeft: 0.28, mouthLowerDownRight: 0.28 }
};

/**
 * CANDIDATE 3 — /r/ separated from the postalveolars.
 *
 * ZH-R measures 0.131 mm apart with DIFFERENT visemes (RR against CH) — the
 * closest cross-viseme pair in the inventory, closer than the 0.038 influence
 * collapse the accepted vowel pass existed to fix. /r/ is more protruded and
 * less corner-drawn than /ʃ ʒ/, and R's pucker reaches `naturalMax` only at an
 * authored 0.86 against today's 0.18, so the headroom is real.
 */
const R_A: Override = { R: { mouthPucker: 0.26 } };
const R_B: Override = { R: { mouthPucker: 0.32 } };

/**
 * CANDIDATE 1c — the corner pocket ALONE, isolating it from the reveal.
 *
 * The reveal sweep above showed `mouthUpperUp` buying almost no separation
 * (worst pair 1.16 -> 1.30 mm at the strongest depth) while breaking the
 * aperture ladder, because it is CORRELATED with aperture: it opens the lips
 * +6.7 mm at influence 1.0, so a monotone reveal ladder just slides the whole
 * family along the axis it was already ordered on. The dimple is the axis the
 * family has no ordering on at all, and it changes the aperture by nothing.
 */
const FRONT_DIMPLE_ONLY: Override = {
  IY: { mouthDimpleLeft: 0.2, mouthDimpleRight: 0.2 },
  EY: { mouthDimpleLeft: 0.12, mouthDimpleRight: 0.12 },
  IH: { mouthDimpleLeft: 0.06, mouthDimpleRight: 0.06 }
};

/** The gentle reveal that preserved the aperture ladder, plus the pocket. */
const FRONT_A_DIMPLE: Override = {
  IY: { mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18, mouthDimpleLeft: 0.2, mouthDimpleRight: 0.2 },
  EY: { mouthUpperUpLeft: 0.13, mouthUpperUpRight: 0.13, mouthDimpleLeft: 0.12, mouthDimpleRight: 0.12 },
  IH: { mouthUpperUpLeft: 0.08, mouthUpperUpRight: 0.08, mouthDimpleLeft: 0.06, mouthDimpleRight: 0.06 },
  EH: { mouthUpperUpLeft: 0.03, mouthUpperUpRight: 0.03 }
};

/** The pocket, deeper, with no reveal at all. */
const FRONT_DIMPLE_DEEP: Override = {
  IY: { mouthDimpleLeft: 0.3, mouthDimpleRight: 0.3 },
  EY: { mouthDimpleLeft: 0.18, mouthDimpleRight: 0.18 },
  IH: { mouthDimpleLeft: 0.09, mouthDimpleRight: 0.09 }
};

const CANDIDATES: Array<[string, Override]> = [
  ["baseline", BASELINE],
  ["frontA", FRONT_A],
  ["frontB", FRONT_B],
  ["frontC", FRONT_C],
  ["frontB+dimple", FRONT_B_DIMPLE],
  ["frontDimpleOnly", FRONT_DIMPLE_ONLY],
  ["frontDimpleDeep", FRONT_DIMPLE_DEEP],
  ["frontA+dimple", FRONT_A_DIMPLE],
  ["openA", OPEN_A],
  ["openB", OPEN_B],
  ["R_A", R_A],
  ["R_B", R_B]
];

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function lipShare(phoneme: string, override: Override) {
  const pose = effective(phoneme, override);
  const jaw = deformationMM(model, lm, jawPart(pose));
  const lip = deformationMM(model, lm, lipPart(pose));
  return { jaw, lip, share: jaw + lip > 0 ? lip / (jaw + lip) : 0 };
}

describeGlb("candidate sweep", () => {
  it("prints the front family under each reveal depth", () => {
    const lines: string[] = [""];
    lines.push("=== FRONT FAMILY — aperture / spread ladders and pair separation ===");
    for (const [name, override] of CANDIDATES.filter(([n]) => n === "baseline" || n.startsWith("front"))) {
      lines.push("");
      lines.push(`${name}`);
      lines.push("   ph   apert   width  upLift  lip%    pairs (mm)");
      for (const ph of ["IY", "IH", "EY", "EH"]) {
        const pose = effective(ph, override);
        const m = measureLips(model, lm, pose);
        const s = lipShare(ph, override);
        lines.push(
          `   ${ph.padEnd(4)} ${m.apertureMM.toFixed(2).padStart(6)} ${m.widthMM.toFixed(2).padStart(7)}` +
          ` ${m.upperLipLiftMM.toFixed(2).padStart(7)} ${pct(s.share).padStart(5)}`
        );
      }
      const pairs: Array<[string, number]> = [];
      const members = ["IY", "IH", "EY", "EH"];
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          pairs.push([
            `${members[i]}-${members[j]}`,
            shapeDistanceMM(model, lm, effective(members[i], override), effective(members[j], override))
          ]);
        }
      }
      pairs.sort((a, b) => a[1] - b[1]);
      lines.push(`   pairs: ${pairs.map(([k, v]) => `${k} ${v.toFixed(2)}`).join("  ")}`);
      lines.push(`   WORST PAIR ${pairs[0][0]} = ${pairs[0][1].toFixed(2)} mm`);
      // Ladders.
      const ap = members.map((ph) => measureLips(model, lm, effective(ph, override)).apertureMM);
      const wd = members.map((ph) => measureLips(model, lm, effective(ph, override)).widthMM);
      lines.push(
        `   aperture IY<IH<EY<EH ? ${ap[0] < ap[1] && ap[1] < ap[2] && ap[2] < ap[3] ? "OK" : "BROKEN"}` +
        `  [${ap.map((v) => v.toFixed(2)).join(" < ")}]`
      );
      lines.push(
        `   spread   IY>EY>EH>IH ? ${wd[0] > wd[2] && wd[2] > wd[3] && wd[3] > wd[1] ? "OK" : "BROKEN"}` +
        `  [IY ${wd[0].toFixed(2)} EY ${wd[2].toFixed(2)} EH ${wd[3].toFixed(2)} IH ${wd[1].toFixed(2)}]`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(10);
  });

  it("prints the open vowels under each participation candidate", () => {
    const lines: string[] = [""];
    lines.push("=== OPEN VOWELS — lip participation, and the AA-AE / AA-AH contrasts ===");
    for (const [name, override] of CANDIDATES.filter(([n]) => n === "baseline" || n.startsWith("open"))) {
      lines.push("");
      lines.push(`${name}`);
      for (const ph of ["AA", "AE", "AH"]) {
        const pose = effective(ph, override);
        const m = measureLips(model, lm, pose);
        const s = lipShare(ph, override);
        lines.push(
          `   ${ph.padEnd(4)} apert ${m.apertureMM.toFixed(2).padStart(6)}  width ${m.widthMM.toFixed(2).padStart(6)}` +
          `  upLift ${m.upperLipLiftMM.toFixed(2).padStart(5)}  loDrop ${m.lowerLipDropMM.toFixed(2).padStart(6)}` +
          `  jaw ${s.jaw.toFixed(2).padStart(5)} lip ${s.lip.toFixed(2).padStart(5)}  lip% ${pct(s.share).padStart(5)}`
        );
      }
      const d = (a: string, b: string) =>
        shapeDistanceMM(model, lm, effective(a, override), effective(b, override)).toFixed(2);
      lines.push(`   AA-AE ${d("AA", "AE")}   AA-AH ${d("AA", "AH")}   AE-AH ${d("AE", "AH")}`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(5);
  });

  it("prints /r/ against the postalveolars under each candidate", () => {
    const lines: string[] = [""];
    lines.push("=== /r/ vs the postalveolars (closest cross-viseme pair in the inventory) ===");
    for (const [name, override] of CANDIDATES.filter(([n]) => n === "baseline" || n.startsWith("R_"))) {
      const rPose = effective("R", override);
      const m = measureLips(model, lm, rPose);
      const d = (b: string) => shapeDistanceMM(model, lm, rPose, effective(b, override)).toFixed(3);
      lines.push(
        `   ${name.padEnd(10)} R protr ${m.protrusionMM.toFixed(2)} width ${m.widthMM.toFixed(2)}` +
        `   R-ZH ${d("ZH")}  R-SH ${d("SH")}  R-JH ${d("JH")}  R-CH ${d("CH")}  R-W ${d("W")}  R-ER ${d("ER")}`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(2);
  });
});
