import { describe, expect, it } from "vitest";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import {
  getMouthTransitionProfile,
  mouthTransitionProfiles,
  smoothingSpeedByRegion,
  type MouthTransitionProfile,
} from "./engine/mappings/avatarBlendshapeConfig";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { minifaceMalePhonemeProfile } from "./engine/mappings/avatars/minifaceMalePhonemeProfile";
import { DIPHTHONG_GLIDES } from "./engine/mappings/avatars/hyper3dVowelProfile";
import { calibrateHyper3dPose, hyper3dMorphCalibration } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * FIX 2 — G (asymmetric jaw) and I (family shapes).
 *
 * They ship together and are pinned together: I on its own was measured to
 * raise the rendered path rate 6 % and peak velocity 5 %, which is the "lips
 * move faster than the voice" report made worse.
 */

const DT = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;
const table = hyper3dPhonemeToBlendshape as unknown as Record<
  string,
  { pose: BlendshapePose; defaultIntensity: number; onsetPose?: BlendshapePose; offglidePose?: BlendshapePose }
>;

/**
 * Drive the mixer over a target series, with or without the jaw profile.
 *
 * `jaw` has NO default on purpose: an explicit `undefined` triggers a default
 * parameter, so a symmetric run would silently become an asymmetric one.
 */
function drive(targets: Array<Record<string, number>>, jaw: MouthTransitionProfile | undefined) {
  const mixer = new FacialPoseMixer();
  const out: Array<Record<string, number>> = [];
  for (const target of targets) {
    const mixed = mixer.combine([{ channel: "lipsync", pose: target }] as never);
    out.push({ ...mixer.smooth(mixed.pose, DT, undefined, jaw) });
  }
  return out;
}

const hold = (pose: Record<string, number>, frames: number) =>
  Array.from({ length: frames }, () => ({ ...pose }));

/** `pose x defaultIntensity x gain`, capped — what the channel renders. */
const rendered = (phoneme: string) => {
  const d = table[phoneme];
  const scaled: BlendshapePose = {};
  for (const [n, v] of Object.entries(d.pose)) scaled[n] = v * d.defaultIntensity;
  return calibrateHyper3dPose(scaled);
};
const visibleChannels = (phoneme: string) =>
  Object.entries(rendered(phoneme)).filter(([n, v]) => {
    const e = hyper3dMorphCalibration[n];
    return e && v >= e.usefulMin;
  });

describe("G — asymmetric jaw", () => {
  it("is scoped to hyper3d-usc and leaves every other model symmetric", () => {
    /**
     * EXPECTATION UPDATED BY FIX 2B, intentionally: the profile now also carries
     * `lipShapeSpeed` and `settle`. The three JAW fields are asserted
     * individually so G stays pinned exactly while the object grows.
     */
    expect(PROFILE.openSpeed).toBe(24);
    expect(PROFILE.closeSpeed).toBe(9);
    expect(PROFILE.sealClosureThreshold).toBe(0.5);
    expect(PROFILE.openSpeed).toBe(smoothingSpeedByRegion.jaw);
    expect(getMouthTransitionProfile("female")).toBeUndefined();
    expect(getMouthTransitionProfile("miniface-male")).toBeUndefined();
    expect(getMouthTransitionProfile(undefined)).toBeUndefined();
    expect(Object.keys(mouthTransitionProfiles)).toEqual(["hyper3d-usc"]);
  });

  it("a model without a profile renders byte-identically to before", () => {
    const targets = [...hold({ jawOpen: 0.5 }, 12), ...hold({ jawOpen: 0.05 }, 12)];
    expect(drive(targets, undefined)).toEqual(drive(targets, undefined));
    // And the symmetric path is what a profile-less model takes.
    const symmetric = drive(targets, undefined);
    const asymmetric = drive(targets, PROFILE);
    // Opening frames agree; closing frames do not. That IS the change.
    expect(symmetric[5].jawOpen).toBeCloseTo(asymmetric[5].jawOpen, 12);
    expect(symmetric[18].jawOpen).not.toBeCloseTo(asymmetric[18].jawOpen, 6);
  });

  it("OPENING is unchanged — the responsive gesture keeps its speed", () => {
    const targets = hold({ jawOpen: 0.5 }, 20);
    const symmetric = drive(targets, undefined);
    const asymmetric = drive(targets, PROFILE);
    for (let i = 0; i < targets.length; i += 1) {
      expect(asymmetric[i].jawOpen).toBeCloseTo(symmetric[i].jawOpen, 12);
    }
  });

  it("ORDINARY CLOSING is calmer", () => {
    const targets = [...hold({ jawOpen: 0.5 }, 20), ...hold({ jawOpen: 0.02 }, 20)];
    const symmetric = drive(targets, undefined);
    const asymmetric = drive(targets, PROFILE);
    // Same starting point, then the asymmetric jaw stays higher for longer.
    expect(asymmetric[19].jawOpen).toBeCloseTo(symmetric[19].jawOpen, 12);
    for (let i = 21; i < targets.length; i += 1) {
      expect(asymmetric[i].jawOpen).toBeGreaterThan(symmetric[i].jawOpen);
    }
    /**
     * The PEAK closing step is what reads as a snap, and it is much smaller.
     * Deliberately not asserted frame by frame: an exponential follower's step
     * is proportional to its remaining distance, so once the fast jaw has
     * arrived its steps go to zero while the slow one is still travelling.
     * Late frames where the slow jaw steps further are the mechanism working,
     * not a defect.
     */
    const peakStep = (series: Array<Record<string, number>>) => {
      let peak = 0;
      // From the FIRST closing frame: that is where the largest step lives.
      for (let i = 20; i < targets.length; i += 1) {
        peak = Math.max(peak, series[i - 1].jawOpen - series[i].jawOpen);
      }
      return peak;
    };
    expect(peakStep(asymmetric)).toBeLessThan(peakStep(symmetric) * 0.5);
  });

  it("A REAL CLOSURE bypasses the slow path entirely", () => {
    // Identical jaw trajectory, but with a bilabial closure demanded.
    const open = hold({ jawOpen: 0.5 }, 20);
    const shutWithSeal = hold({ jawOpen: 0.02, mouthClose: PROFILE.sealClosureThreshold }, 20);
    const shutWithout = hold({ jawOpen: 0.02, mouthClose: 0.1 }, 20);
    const sealed = drive([...open, ...shutWithSeal], PROFILE);
    const ordinary = drive([...open, ...shutWithout], PROFILE);
    const symmetric = drive([...open, ...shutWithout], undefined);
    for (let i = 21; i < 40; i += 1) {
      // A sealing frame closes exactly as fast as the shipped symmetric jaw.
      expect(sealed[i].jawOpen).toBeCloseTo(symmetric[i].jawOpen, 12);
      // And strictly faster than the ordinary return.
      expect(sealed[i].jawOpen).toBeLessThan(ordinary[i].jawOpen);
    }
  });

  it("mouthClose itself is never slowed, and no non-jaw channel is touched", () => {
    const targets = [
      ...hold({ mouthClose: 0.7, mouthPucker: 0.5, mouthStretchLeft: 0.4, mouthSmileLeft: 0.3 }, 10),
      ...hold({ mouthClose: 0.0, mouthPucker: 0.0, mouthStretchLeft: 0.0, mouthSmileLeft: 0.0 }, 10),
    ];
    const symmetric = drive(targets, undefined);
    const asymmetric = drive(targets, PROFILE);
    /**
     * EXPECTATION SPLIT BY FIX 2B, intentionally. `mouthClose` and
     * `mouthPress*` — the seal and its lateral compression — must still be
     * byte-identical: that is the contract the whole bilabial architecture
     * rests on. The lip-SHAPE channels are now deliberately slower, because
     * the 26 damper is what pays for the stronger shapes.
     */
    for (let i = 0; i < targets.length; i += 1) {
      for (const channel of ["mouthClose", "mouthPressLeft", "mouthPressRight"]) {
        expect(asymmetric[i][channel] ?? 0).toBeCloseTo(symmetric[i][channel] ?? 0, 12);
      }
    }
    // And the lip-shape channels ARE damped, which is the Fix 2B change.
    expect(asymmetric[3].mouthPucker).toBeLessThan(symmetric[3].mouthPucker!);
    expect(asymmetric[3].mouthStretchLeft).toBeLessThan(symmetric[3].mouthStretchLeft!);
  });
});

describe("I — family shapes", () => {
  it("open vowels gained visible lip participation, with NO jaw change", () => {
    for (const phoneme of ["AA", "AE", "AH", "AW", "AY"]) {
      // The jaw is the value the accepted vowel pass set. Not one is touched.
      expect(table[phoneme].pose.jawOpen).toBe(
        { AA: 0.56, AE: 0.48, AH: 0.3, AW: 0.42, AY: 0.46 }[phoneme],
      );
      const lips = visibleChannels(phoneme).filter(([n]) => !n.startsWith("jaw"));
      expect(lips.length).toBeGreaterThanOrEqual(2);
    }
    // AH rendered exactly ONE visible channel before this pass.
    const ah = visibleChannels("AH").map(([n]) => n);
    expect(ah).toContain("jawOpen");
    expect(ah).toContain("mouthLowerDownLeft");
    expect(ah).toContain("mouthUpperUpLeft");
  });

  it("front vowels gained lateral shaping, and smile was not used as a multiplier", () => {
    const stretch = (p: string) => table[p].pose.mouthStretchLeft ?? 0;
    expect(stretch("IY")).toBe(0.58);   // Fix 2B: deliberately UNCHANGED — already past naturalMax.
    expect(stretch("EY")).toBe(0.48);
    expect(stretch("AE")).toBe(0.4);
    expect(stretch("EH")).toBe(0.4);
    expect(stretch("IH")).toBe(0.38);
    // The accepted spread ladder IY > EY > AE > EH > IH survives.
    expect(stretch("IY")).toBeGreaterThan(stretch("EY"));
    expect(stretch("EY")).toBeGreaterThan(stretch("AE"));
    // AE and EH are now EQUAL at 0.40 by the approved values, so the ladder is
    // asserted as non-increasing from here rather than strictly decreasing.
    expect(stretch("AE")).toBeGreaterThanOrEqual(stretch("EH"));
    
    expect(stretch("EH")).toBeGreaterThan(stretch("IH"));
    // IY is the ONLY pose whose smile rose; EY and V keep the male value.
    expect(table.IY.pose.mouthSmileLeft).toBe(0.18);
    expect(table.EY.pose.mouthSmileLeft).toBe(0.05);
    expect(table.V.pose.mouthSmileLeft).toBe(minifaceMalePhonemeProfile.V.morphTargets.mouthSmileLeft);
  });

  it("the rounded family is untouched", () => {
    for (const phoneme of ["UW", "OW", "AO", "OY", "UH", "ER"]) {
      expect(table[phoneme].pose).toEqual(
        {
          UW: { jawOpen: 0.1, mouthPucker: 0.66, mouthFunnel: 0.4 },
          OW: { jawOpen: 0.24, mouthFunnel: 0.4, mouthPucker: 0.5 },
          AO: { jawOpen: 0.44, mouthFunnel: 0.34, mouthPucker: 0.34, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
          OY: { jawOpen: 0.3, mouthFunnel: 0.3, mouthPucker: 0.38 },
          UH: { jawOpen: 0.18, mouthPucker: 0.34, mouthFunnel: 0.22 },
          ER: { jawOpen: 0.2, mouthPucker: 0.22, mouthFunnel: 0.16, mouthShrugUpper: 0.06 },
        }[phoneme],
      );
    }
    // OW's offglide pucker stays below UW's, so the rounding ladder holds.
    expect(DIPHTHONG_GLIDES.OW.offglide.mouthPucker!).toBeLessThan(table.UW.pose.mouthPucker!);
  });

  it("the collapsed stops each gained a second VISIBLE channel", () => {
    for (const phoneme of ["T", "D", "N", "K", "G", "NG"]) {
      const male = minifaceMalePhonemeProfile[phoneme].morphTargets;
      // Aperture and closure demand are untouched; the cue is elsewhere.
      expect(table[phoneme].pose.jawOpen).toBe(male.jawOpen);
      expect(table[phoneme].pose.mouthClose).toBe(male.mouthClose);
      const visible = visibleChannels(phoneme).map(([n]) => n);
      const nonJaw = visible.filter((n) => !n.startsWith("jaw"));
      // Before this pass every one of these rendered jawOpen and nothing else,
      // and NG rendered nothing at all.
      expect(nonJaw.length).toBeGreaterThanOrEqual(1);
      expect(visible.length).toBeGreaterThanOrEqual(2);
      // `mouthClose` is NOT how the distinction is made — its 0.11 gain makes
      // it invisible here, which is the whole reason the stops collapsed.
      expect(nonJaw).not.toContain("mouthClose");
    }
    // The front/back split is on OPPOSITE channels, not a difference of degree.
    expect(table.T.pose.mouthStretchLeft).toBeGreaterThan(table.K.pose.mouthStretchLeft!);
    expect(table.K.pose.mouthLowerDownLeft).toBeGreaterThan(table.T.pose.mouthLowerDownLeft ?? 0);
  });

  it("every diphthong pose is still exactly the midpoint of its glide", () => {
    for (const [phoneme, glide] of Object.entries(DIPHTHONG_GLIDES)) {
      const pose = table[phoneme].pose;
      const channels = new Set([...Object.keys(glide.onset), ...Object.keys(glide.offglide), ...Object.keys(pose)]);
      for (const channel of channels) {
        const midpoint = ((glide.onset[channel] ?? 0) + (glide.offglide[channel] ?? 0)) / 2;
        expect(midpoint).toBeCloseTo(pose[channel] ?? 0, 10);
      }
    }
  });

  it("AA keeps the top of the lower-lip ladder", () => {
    const lower = (p: BlendshapePose) => p.mouthLowerDownLeft ?? 0;
    expect(lower(table.AA.pose)).toBe(0.36);
    expect(lower(DIPHTHONG_GLIDES.AY.onset)).toBeLessThan(lower(table.AA.pose));
    expect(lower(DIPHTHONG_GLIDES.AW.onset)).toBeLessThan(lower(table.AA.pose));
    for (const phoneme of ["AE", "AH", "AY", "AW", "EH", "K", "G"]) {
      expect(lower(table[phoneme].pose)).toBeLessThanOrEqual(lower(table.AA.pose));
    }
  });

  it("no calibrated channel is driven past its natural maximum", () => {
    for (const phoneme of Object.keys(table)) {
      for (const [name, value] of Object.entries(rendered(phoneme))) {
        const entry = hyper3dMorphCalibration[name];
        if (!entry) continue;
        expect(value).toBeLessThanOrEqual(entry.cap + 1e-9);
        expect(value).toBeLessThanOrEqual(entry.exaggeratedMax + 1e-9);
      }
    }
  });
});
