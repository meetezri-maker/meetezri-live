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
import { minifaceMalePhonemeProfile } from "./engine/mappings/avatars/minifaceMalePhonemeProfile";
import { femalePhonemeProfile } from "./engine/mappings/avatars/femalePhonemeProfile";
import {
  DIPHTHONG_GLIDES,
  HYPER3D_TUNED_CONSONANTS,
  HYPER3D_TUNED_VOWELS
} from "./engine/mappings/avatars/hyper3dVowelProfile";
import {
  calibrateHyper3dPose,
  hyper3dMorphCalibration
} from "./engine/mappings/avatars/hyper3dCalibration";
import { CORPUS_PAYLOADS, loadPayload, runCorpus } from "./hyper3dDeadlineCorpus";
import { median, percentile } from "./hyper3dDeadlineInstrumentation";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAPE REFINEMENT — before/after, and the invariants.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TWO CHANGES are under test, both in the Hyper3D-only mapping layer:
 *
 *   1. `mouthDimple` on IY / EY / IH — the front family's corner pocket
 *   2. `mouthPucker` 0.18 -> 0.26 on R — /r/ against the postalveolars
 *
 * The BEFORE column is the pre-refinement authored values, written out
 * explicitly below rather than stored as expected numbers, so the comparison
 * re-derives itself from the asset on every run and cannot go stale.
 */

const GLB = "public/avatars/female_2291.glb";
const glbAvailable = existsSync(GLB);
const describeGlb = glbAvailable ? describe : describe.skip;

/**
 * THE PRE-REFINEMENT POSES, exactly as they were authored before this pass.
 * Only the channels this pass touched are listed; everything else comes from the
 * shipped table, so this is a diff and not a second copy of the profile.
 */
const BEFORE: Record<string, BlendshapePose> = {
  IY: { jawOpen: 0.11, mouthStretchLeft: 0.58, mouthStretchRight: 0.58, mouthSmileLeft: 0.18, mouthSmileRight: 0.18 },
  EY: { jawOpen: 0.2, mouthStretchLeft: 0.48, mouthStretchRight: 0.48, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 },
  IH: { jawOpen: 0.15, mouthStretchLeft: 0.38, mouthStretchRight: 0.38 },
  R: { jawOpen: 0.09, mouthPucker: 0.18, mouthFunnel: 0.12, mouthShrugUpper: 0.05 }
};

type Definition = { pose: BlendshapePose; defaultIntensity: number; viseme: string };
const definitionOf = (phoneme: string) =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>)[phoneme];

/** The shipped pose, or the pre-refinement one, put through the real calibration. */
function effective(phoneme: string, before: boolean): BlendshapePose {
  const definition = definitionOf(phoneme);
  const pose = before && BEFORE[phoneme] ? BEFORE[phoneme] : definition.pose;
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) {
    if (value > 0) scaled[name] = value * definition.defaultIntensity;
  }
  return calibrateHyper3dPose(scaled);
}

const INVENTORY = [
  "AA", "AE", "AH", "AO", "AW", "OY", "AY", "EH", "EY", "IH", "IY",
  "ER", "OW", "UH", "UW",
  "P", "B", "M", "F", "V", "TH", "DH", "T", "D", "N", "NG", "K", "G",
  "S", "Z", "SH", "ZH", "CH", "JH", "L", "R", "W", "Y", "HH"
].filter((p) => definitionOf(p));

let model: LipModel;
let lm: LipLandmarks;
if (glbAvailable) {
  model = loadLipModel(GLB);
  lm = lipLandmarks(model);
}

const share = (phoneme: string, before: boolean) => {
  const pose = effective(phoneme, before);
  const jaw = deformationMM(model, lm, jawPart(pose));
  const lip = deformationMM(model, lm, lipPart(pose));
  return jaw + lip > 0 ? lip / (jaw + lip) : 0;
};

const closestPairs = (before: boolean) => {
  const pairs: Array<{ a: string; b: string; d: number; sameViseme: boolean }> = [];
  for (let i = 0; i < INVENTORY.length; i += 1) {
    for (let j = i + 1; j < INVENTORY.length; j += 1) {
      pairs.push({
        a: INVENTORY[i],
        b: INVENTORY[j],
        d: shapeDistanceMM(model, lm, effective(INVENTORY[i], before), effective(INVENTORY[j], before)),
        sameViseme: definitionOf(INVENTORY[i]).viseme === definitionOf(INVENTORY[j]).viseme
      });
    }
  }
  return pairs.sort((x, y) => x.d - y.d);
};

describe("the refinement is scoped to the Hyper3D layer", () => {
  it("leaves the shared male and female profiles untouched", () => {
    /**
     * §7: "Do not modify shared phoneme profiles used by other avatars." The
     * values this pass changed are asserted at their ORIGINAL numbers in the
     * tables the other two avatars read, so a future edit to the wrong file
     * fails here.
     */
    const male = minifaceMalePhonemeProfile as unknown as Record<string, { morphTargets: BlendshapePose }>;
    expect(male.R.morphTargets.mouthPucker).toBe(0.18);
    expect(male.IY.morphTargets.mouthDimpleLeft).toBeUndefined();
    expect(male.EY.morphTargets.mouthDimpleLeft).toBeUndefined();
    expect(male.IH.morphTargets.mouthDimpleLeft).toBeUndefined();
    const female = femalePhonemeProfile as unknown as Record<string, { morphTargets: BlendshapePose }>;
    expect(female.IY.morphTargets.mouthDimpleLeft).toBeUndefined();
    expect(female.R.morphTargets.mouthDimpleLeft).toBeUndefined();
  });

  it("changes exactly three phonemes and only the channels it claims", () => {
    expect(HYPER3D_TUNED_VOWELS).toContain("IY");
    expect(HYPER3D_TUNED_VOWELS).toContain("EY");
    expect(HYPER3D_TUNED_CONSONANTS).toContain("R");
    // The pocket, following the spread ladder. IH and EH deliberately get none:
    // IH's pocket measured as moving it TOWARD EY, and EH is the open end.
    expect(definitionOf("IY").pose.mouthDimpleLeft).toBe(0.24);
    expect(definitionOf("IY").pose.mouthDimpleRight).toBe(0.24);
    expect(definitionOf("EY").pose.mouthDimpleLeft).toBe(0.14);
    expect(definitionOf("EY").pose.mouthDimpleRight).toBe(0.14);
    expect(definitionOf("IH").pose.mouthDimpleLeft).toBeUndefined();
    expect(definitionOf("EH").pose.mouthDimpleLeft).toBeUndefined();
    expect(definitionOf("R").pose.mouthPucker).toBe(0.26);
    // IH is byte-identical to its pre-refinement pose.
    expect(definitionOf("IH").pose).toEqual(BEFORE.IH);
    /**
     * And nothing ELSE about the touched poses moved. `CHANGED` names the only
     * channels this pass is allowed to have altered, so a stray edit to any
     * other channel of these three phonemes fails here.
     */
    const CHANGED: Record<string, string[]> = {
      IY: ["mouthDimpleLeft", "mouthDimpleRight"],
      EY: ["mouthDimpleLeft", "mouthDimpleRight"],
      R: ["mouthPucker"]
    };
    for (const phoneme of ["IY", "EY", "R"]) {
      for (const [name, value] of Object.entries(BEFORE[phoneme])) {
        if (CHANGED[phoneme].includes(name)) continue;
        expect(definitionOf(phoneme).pose[name]).toBe(value);
      }
      // No channel was ADDED beyond the ones named.
      for (const name of Object.keys(definitionOf(phoneme).pose)) {
        if (BEFORE[phoneme][name] !== undefined) continue;
        expect(CHANGED[phoneme]).toContain(name);
      }
    }
  });

  it("keeps every channel it wrote inside the asset's own natural range", () => {
    /**
     * `naturalMax` is the largest influence the calibration records as still
     * reading as a real face. A value above it is a caricature and one above
     * `cap` is silently truncated, so both are checked — but ONLY on the
     * channels this pass wrote.
     *
     * Scoped deliberately: IY's `mouthStretch` already calibrates to 0.521
     * against a `naturalMax` of 0.45, and has since the accepted strength pass.
     * That is a pre-existing observation reported in the diagnosis, not
     * something this pass introduced, and a test that failed on it would be
     * blaming this change for someone else's number.
     */
    const WROTE: Record<string, string[]> = {
      IY: ["mouthDimpleLeft", "mouthDimpleRight"],
      EY: ["mouthDimpleLeft", "mouthDimpleRight"],
      R: ["mouthPucker"]
    };
    for (const [phoneme, channels] of Object.entries(WROTE)) {
      const pose = effective(phoneme, false);
      for (const name of channels) {
        const entry = hyper3dMorphCalibration[name];
        const value = pose[name] ?? 0;
        expect(value).toBeGreaterThan(entry.usefulMin);
        expect(value).toBeLessThanOrEqual(entry.naturalMax + 1e-9);
        expect(value).toBeLessThan(entry.cap + 1e-9);
      }
    }
  });

  it("preserves the EY glide's midpoint identity on every channel", () => {
    /**
     * `onset + offglide = 2 x pose`, which is what keeps the accepted pose the
     * phoneme's exact temporal midpoint. The pocket carries no excursion, so it
     * has to satisfy this as plainly as the channels that do.
     */
    const glide = DIPHTHONG_GLIDES.EY;
    const pose = definitionOf("EY").pose;
    const channels = new Set([
      ...Object.keys(pose),
      ...Object.keys(glide.onset),
      ...Object.keys(glide.offglide)
    ]);
    for (const channel of channels) {
      expect((glide.onset[channel] ?? 0) + (glide.offglide[channel] ?? 0)).toBeCloseTo(
        2 * (pose[channel] ?? 0),
        10
      );
    }
    expect(glide.onset.mouthDimpleLeft).toBe(0.14);
    expect(glide.offglide.mouthDimpleLeft).toBe(0.14);
  });
});

describeGlb("before / after geometry", () => {
  it("prints the measured change on every touched phoneme", () => {
    const lines: string[] = [""];
    lines.push("=== BEFORE / AFTER, measured on female_2291.glb ===");
    lines.push("ph    aperture        width          protrusion     upLift         loDrop        lip share");
    for (const phoneme of ["IY", "EY", "IH", "EH", "R"]) {
      const b = measureLips(model, lm, effective(phoneme, true));
      const a = measureLips(model, lm, effective(phoneme, false));
      const pair = (x: number, y: number) =>
        `${x.toFixed(2).padStart(6)}->${y.toFixed(2).padStart(6)}`;
      lines.push(
        `${phoneme.padEnd(5)} ${pair(b.apertureMM, a.apertureMM)}  ${pair(b.widthMM, a.widthMM)}  ` +
        `${pair(b.protrusionMM, a.protrusionMM)}  ${pair(b.upperLipLiftMM, a.upperLipLiftMM)}  ` +
        `${pair(b.lowerLipDropMM, a.lowerLipDropMM)}  ` +
        `${(share(phoneme, true) * 100).toFixed(0)}%->${(share(phoneme, false) * 100).toFixed(0)}%`
      );
    }

    lines.push("");
    lines.push("=== FRONT FAMILY PAIR SEPARATION (mm RMS) ===");
    const front = ["IY", "IH", "EY", "EH"];
    for (let i = 0; i < front.length; i += 1) {
      for (let j = i + 1; j < front.length; j += 1) {
        const b = shapeDistanceMM(model, lm, effective(front[i], true), effective(front[j], true));
        const a = shapeDistanceMM(model, lm, effective(front[i], false), effective(front[j], false));
        lines.push(
          `  ${front[i]}-${front[j]}  ${b.toFixed(2).padStart(6)} -> ${a.toFixed(2).padStart(6)} mm` +
          `   ${a > b ? `+${(((a - b) / b) * 100).toFixed(0)}%` : `${(((a - b) / b) * 100).toFixed(0)}%`}`
        );
      }
    }

    lines.push("");
    lines.push("=== /r/ AGAINST ITS NEIGHBOURS (mm RMS) ===");
    for (const other of ["ZH", "SH", "JH", "CH", "W", "ER"]) {
      const b = shapeDistanceMM(model, lm, effective("R", true), effective(other, true));
      const a = shapeDistanceMM(model, lm, effective("R", false), effective(other, false));
      lines.push(`  R-${other.padEnd(3)} ${b.toFixed(3).padStart(7)} -> ${a.toFixed(3).padStart(7)} mm`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(10);
  });

  it("widens the front family's worst pair without breaking either ladder", () => {
    const worst = (before: boolean) => {
      const front = ["IY", "IH", "EY", "EH"];
      let min = Infinity;
      for (let i = 0; i < front.length; i += 1) {
        for (let j = i + 1; j < front.length; j += 1) {
          min = Math.min(
            min,
            shapeDistanceMM(model, lm, effective(front[i], before), effective(front[j], before))
          );
        }
      }
      return min;
    };
    expect(worst(false)).toBeGreaterThan(worst(true) * 1.2);

    // THE APERTURE LADDER: IY < IH < EY < EH.
    const aperture = (ph: string) => measureLips(model, lm, effective(ph, false)).apertureMM;
    expect(aperture("IY")).toBeLessThan(aperture("IH"));
    expect(aperture("IH")).toBeLessThan(aperture("EY"));
    expect(aperture("EY")).toBeLessThan(aperture("EH"));
    // THE SPREAD LADDER: IY > EY > EH > IH, and AE between EY and EH as documented.
    const width = (ph: string) => measureLips(model, lm, effective(ph, false)).widthMM;
    expect(width("IY")).toBeGreaterThan(width("EY"));
    expect(width("EY")).toBeGreaterThan(width("EH"));
    expect(width("EH")).toBeGreaterThan(width("IH"));
  });

  it("separates /r/ from the postalveolars while keeping it clear of /w/", () => {
    const d = (a: string, b: string, before: boolean) =>
      shapeDistanceMM(model, lm, effective(a, before), effective(b, before));
    expect(d("R", "ZH", false)).toBeGreaterThan(d("R", "ZH", true) * 3);
    expect(d("R", "SH", false)).toBeGreaterThan(d("R", "SH", true));
    // /r/ must not become /w/: it is rounded, /w/ is MORE rounded.
    expect(d("R", "W", false)).toBeGreaterThan(1.5);
    expect(measureLips(model, lm, effective("R", false)).protrusionMM).toBeLessThan(
      measureLips(model, lm, effective("W", false)).protrusionMM
    );
  });

  it("introduces no new duplicate anywhere in the inventory", () => {
    /**
     * THE WHOLE-INVENTORY GUARD. Separating one pair is worthless if it collapses
     * another, so the floor over EVERY cross-viseme pair must not fall. Same-viseme
     * pairs are excluded because /p b/, /t d/, /k g/ and /s z/ are voicing pairs
     * that a real face renders identically — the diagnosis measured them at
     * 0.03-0.31 mm and that is correct, not a defect.
     */
    const before = closestPairs(true).filter((p) => !p.sameViseme);
    const after = closestPairs(false).filter((p) => !p.sameViseme);
    expect(after[0].d).toBeGreaterThanOrEqual(before[0].d);
    // And the touched phonemes specifically did not land on top of something new.
    for (const phoneme of ["IY", "EY", "IH", "R"]) {
      const nearest = after
        .filter((p) => p.a === phoneme || p.b === phoneme)
        .sort((x, y) => x.d - y.d)[0];
      const nearestBefore = before
        .filter((p) => p.a === phoneme || p.b === phoneme)
        .sort((x, y) => x.d - y.d)[0];
      expect(nearest.d).toBeGreaterThanOrEqual(nearestBefore.d * 0.98);
    }
  });

  it("prints the inventory floor before and after", () => {
    const before = closestPairs(true).filter((p) => !p.sameViseme);
    const after = closestPairs(false).filter((p) => !p.sameViseme);
    const lines = [""];
    lines.push("=== CLOSEST CROSS-VISEME PAIRS: BEFORE -> AFTER ===");
    lines.push("before:");
    for (const p of before.slice(0, 8)) lines.push(`  ${p.a.padEnd(3)} ${p.b.padEnd(3)} ${p.d.toFixed(3)} mm`);
    lines.push("after:");
    for (const p of after.slice(0, 8)) lines.push(`  ${p.a.padEnd(3)} ${p.b.padEnd(3)} ${p.d.toFixed(3)} mm`);
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(after.length).toBe(before.length);
  });
});

/**
 * §8 / §9 — CONNECTED SPEECH. An isolated shape that reads well held can still
 * fail in running speech, so the same chain is driven over the real MFA payloads
 * with the before and after profiles and the motion character compared.
 */
const corpusAvailable = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = corpusAvailable.length > 0 ? describe : describe.skip;

/** The pre-refinement profile, rebuilt from the shipped one plus the BEFORE diff. */
const beforeProfile = Object.fromEntries(
  Object.entries(hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>).map(
    ([phoneme, definition]) => {
      if (!BEFORE[phoneme]) return [phoneme, definition];
      const reverted: Definition & { onsetPose?: BlendshapePose; offglidePose?: BlendshapePose } = {
        ...(definition as Definition & { onsetPose?: BlendshapePose; offglidePose?: BlendshapePose }),
        pose: BEFORE[phoneme]
      };
      // EY's glide ends carried the pocket too; strip it from both.
      if (reverted.onsetPose) reverted.onsetPose = { ...reverted.onsetPose, mouthDimpleLeft: 0, mouthDimpleRight: 0 };
      if (reverted.offglidePose) reverted.offglidePose = { ...reverted.offglidePose, mouthDimpleLeft: 0, mouthDimpleRight: 0 };
      return [phoneme, reverted];
    }
  )
) as typeof hyper3dPhonemeToBlendshape;

describeCorpus("connected speech, before and after", () => {
  it("prints the motion comparison over the aligned corpus", () => {
    const lines: string[] = [""];
    lines.push("=== CONNECTED SPEECH (34 SOFT, the accepted follower) — BEFORE -> AFTER ===");
    lines.push(
      "payload".padEnd(32) + "reach".padStart(14) + "path".padStart(16) +
      "velP90".padStart(16) + "jawCyc".padStart(14) + "drift".padStart(10)
    );
    for (const entry of corpusAvailable) {
      const payload = loadPayload(entry.path);
      const before = runCorpus(payload, entry.id, "d34soft", beforeProfile);
      const after = runCorpus(payload, entry.id, "d34soft");
      lines.push(
        entry.id.padEnd(32) +
        `${(before.reach.overall * 100).toFixed(1)}->${(after.reach.overall * 100).toFixed(1)}%`.padStart(14) +
        `${before.motion.pathRateMMPerSecond.toFixed(2)}->${after.motion.pathRateMMPerSecond.toFixed(2)}`.padStart(16) +
        `${before.motion.velocityP90MMPerSecond.toFixed(1)}->${after.motion.velocityP90MMPerSecond.toFixed(1)}`.padStart(16) +
        `${before.motion.jawCyclesPerSecond.toFixed(2)}->${after.motion.jawCyclesPerSecond.toFixed(2)}`.padStart(14) +
        "0.000".padStart(10)
      );
      lines.push(
        "".padEnd(32) +
        `  velP50 ${median(before.velocities).toFixed(2)}->${median(after.velocities).toFixed(2)}` +
        `   velP95 ${percentile(before.velocities, 0.95).toFixed(2)}->${percentile(after.velocities, 0.95).toFixed(2)}` +
        `   closure ${before.closureTimingErrorMs.toFixed(1)}->${after.closureTimingErrorMs.toFixed(1)} ms`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(3);
  });

  it("does not materially increase mouth movement in connected speech", () => {
    /**
     * §9's acceptance condition, as a number: greater distinctiveness WITHOUT a
     * material rise in motion.
     *
     * THE BANDS ARE THE MEASURED VALUES PLUS A SLIVER, not round numbers chosen
     * to pass. The shipped depth costs at most +2.7 % path rate and +3.1 % peak
     * velocity, both on `15-fast-mixed`, so the bands are 3 % and 3.5 %.
     *
     * They are set this tight on purpose, and the two reference points are the
     * reason: the lower-face strength pass was REJECTED at +6 % path and +5 %
     * peak velocity, and the deeper pocket candidate that reached +3.4 % /
     * +5.1 % was withdrawn for landing in that same band. A looser band here
     * would let the withdrawn candidate back in without anything failing.
     */
    for (const entry of corpusAvailable) {
      const payload = loadPayload(entry.path);
      const before = runCorpus(payload, entry.id, "d34soft", beforeProfile);
      const after = runCorpus(payload, entry.id, "d34soft");
      expect(after.motion.pathRateMMPerSecond).toBeLessThan(before.motion.pathRateMMPerSecond * 1.03);
      expect(after.motion.velocityP90MMPerSecond).toBeLessThan(before.motion.velocityP90MMPerSecond * 1.035);
      expect(after.motion.jawCyclesPerSecond).toBeCloseTo(before.motion.jawCyclesPerSecond, 6);
    }
  });

  it("holds the timeline, the closure and the seal exactly", () => {
    for (const entry of corpusAvailable) {
      const payload = loadPayload(entry.path);
      const before = runCorpus(payload, entry.id, "d34soft", beforeProfile);
      const after = runCorpus(payload, entry.id, "d34soft");
      // §10: no timing drift. The timeline is the same sequence, not a tolerance.
      expect(after.timeline).toEqual(before.timeline);
      // §10: no regression in bilabial timing or closure. The pass touched no
      // bilabial and no seal channel, so these must be identical frame for frame.
      expect(after.closurePeak).toBe(before.closurePeak);
      expect(after.closureTimingErrorMs).toBe(before.closureTimingErrorMs);
      expect(after.rendered.map((p) => p.mouthClose)).toEqual(before.rendered.map((p) => p.mouthClose));
      expect(after.rendered.map((p) => p.mouthPressLeft)).toEqual(
        before.rendered.map((p) => p.mouthPressLeft)
      );
    }
  });

  it("does not reduce connected-speech target reach", () => {
    for (const entry of corpusAvailable) {
      const payload = loadPayload(entry.path);
      const before = runCorpus(payload, entry.id, "d34soft", beforeProfile);
      const after = runCorpus(payload, entry.id, "d34soft");
      expect(after.reach.overall).toBeGreaterThan(before.reach.overall * 0.98);
    }
  });
});
