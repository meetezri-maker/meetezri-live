import { describe, expect, it } from "vitest";
import {
  HYPER3D_ARTICULATION_TARGETS,
  HYPER3D_ARTICULATION_TEST_CHANNELS,
  applyHyper3dArticulationTestPose,
  hyper3dArticulationHasGlide,
  hyper3dArticulationReadout,
} from "./hyper3dArticulationTest";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import {
  BILABIAL_SEAL_LEVEL,
  CoarticulationEngine,
} from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import type { BlendshapePose } from "./engine/types/facialAnimation";

type Definition = { pose: BlendshapePose; defaultIntensity: number };
const table = hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>;

describe("hyper3d articulation test harness", () => {
  it("is inert on the production path", () => {
    const pose: BlendshapePose = { jawOpen: 0.3, eyeBlinkLeft: 0.2 };
    // The SAME OBJECT, not a copy: production must allocate nothing.
    expect(applyHyper3dArticulationTestPose(pose, "runtime", "calibrated", "mid", 1)).toBe(pose);
  });

  it("writes only the lower-face channels it declares", () => {
    const owned = new Set(HYPER3D_ARTICULATION_TEST_CHANNELS);
    const incoming: BlendshapePose = {
      eyeBlinkLeft: 0.4,
      browInnerUp: 0.2,
      cheekSquintLeft: 0.1,
      eyeLookOutRight: 0.3,
      jawOpen: 0.9,
    };
    for (const target of HYPER3D_ARTICULATION_TARGETS) {
      if (target.id === "runtime") continue;
      const next = applyHyper3dArticulationTestPose(incoming, target.id, "calibrated", "mid", 1);
      for (const [name, value] of Object.entries(next)) {
        if (owned.has(name)) continue;
        expect(`${target.id}:${name}=${value}`).toBe(`${target.id}:${name}=${incoming[name]}`);
      }
    }
  });

  it("neutral clears every owned channel", () => {
    const next = applyHyper3dArticulationTestPose(
      { jawOpen: 0.5, mouthPucker: 0.4, eyeBlinkLeft: 0.3 },
      "neutral",
      "calibrated",
      "mid",
      1,
    );
    for (const name of HYPER3D_ARTICULATION_TEST_CHANNELS) expect(next[name]).toBe(0);
    expect(next.eyeBlinkLeft).toBe(0.3);
  });

  it("reproduces the production stages exactly, with nothing of its own", () => {
    for (const target of HYPER3D_ARTICULATION_TARGETS) {
      if (!target.phoneme || target.id === "bilabialSeal") continue;
      const definition = table[target.phoneme];
      const authored: BlendshapePose = {};
      for (const [name, value] of Object.entries(definition.pose)) {
        const scaled = value * definition.defaultIntensity;
        if (scaled > 0) authored[name] = Math.min(1, scaled);
      }
      const expected = calibrateHyper3dPose(authored);
      const readout = hyper3dArticulationReadout(target.id, "calibrated", "mid", 1);
      expect(readout.pose).toEqual(expected);
      expect(hyper3dArticulationReadout(target.id, "authored", "mid", 1).pose).toEqual(authored);
    }
  });

  it("the bilabial seal target holds the engine's own seal constant", () => {
    const readout = hyper3dArticulationReadout("bilabialSeal", "authored", "mid", 1);
    expect(readout.authored.mouthClose).toBeGreaterThanOrEqual(BILABIAL_SEAL_LEVEL);
    expect(readout.sealForced).toBe(true);
  });

  it("a diphthong's two ends differ from its midpoint", () => {
    const glided = HYPER3D_ARTICULATION_TARGETS.filter((t) => hyper3dArticulationHasGlide(t.id));
    expect(glided.length).toBeGreaterThan(0);
    for (const target of glided) {
      const onset = hyper3dArticulationReadout(target.id, "calibrated", "onset", 1).pose;
      const mid = hyper3dArticulationReadout(target.id, "calibrated", "mid", 1).pose;
      const offglide = hyper3dArticulationReadout(target.id, "calibrated", "offglide", 1).pose;
      expect(onset).not.toEqual(mid);
      expect(offglide).not.toEqual(mid);
    }
  });

  /**
   * The claim the panel makes in words, asserted as arithmetic: the harness is an
   * UPPER BOUND on what live speech renders. If this ever failed, the harness
   * would be flattering the pipeline rather than measuring it.
   */
  it("bounds live speech from above on every phoneme", () => {
    const FPS = 60;
    const DT = 1 / FPS;
    for (const target of HYPER3D_ARTICULATION_TARGETS) {
      if (!target.phoneme || target.id === "bilabialSeal") continue;
      const ceiling = hyper3dArticulationReadout(target.id, "calibrated", "mid", 1).pose;
      const engine = new CoarticulationEngine();
      const mixer = new FacialPoseMixer();
      const lead = 0.2;
      // A deliberately long label: the most generous case the live path offers.
      const current = { id: "probe", phoneme: target.phoneme, start_time: lead, end_time: lead + 0.6, intensity: 1 };
      const peaks: Record<string, number> = {};
      for (let t = 0; t <= lead + 0.8; t += DT) {
        const lip = engine.blend({ time: t, current, windowSeconds: 0.08, profile: hyper3dPhonemeToBlendshape });
        const mixed = mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
        const calibrated = calibrateHyper3dPose(mixer.smooth(mixed.pose, DT, undefined) as BlendshapePose);
        for (const [name, value] of Object.entries(calibrated)) {
          if (value > (peaks[name] ?? 0)) peaks[name] = value;
        }
      }
      for (const [name, value] of Object.entries(peaks)) {
        // A diphthong's glide legitimately passes through values outside its
        // midpoint pose, so only the non-gliding phonemes are bounded per channel.
        if (hyper3dArticulationHasGlide(target.id)) continue;
        expect(value).toBeLessThanOrEqual((ceiling[name] ?? 0) + 1e-6);
      }
    }
  });
});
