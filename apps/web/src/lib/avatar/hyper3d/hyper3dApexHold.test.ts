import { describe, expect, it } from "vitest";
import {
  AFFRICATE_SUSTAIN_FRACTION,
  AFFRICATE_SUSTAIN_PHONEMES,
  CoarticulationEngine,
  ENVELOPE_APEX_HOLD_SECONDS,
  ENVELOPE_ATTACK_SHARE_MAX,
  ENVELOPE_SUSTAIN_MAX,
  apexSustainFor,
} from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * DURATION-AWARE APEX HOLD — the short-label delivery fix.
 *
 * Every case drives the SHIPPED path against the pre-fix path, which is reachable
 * exactly by `{ envelopeApexHoldSeconds: 0, envelopeAttackPreserving: false }`.
 * That negative control is what makes these regressions evidence that the two
 * mechanisms named are the ones that moved, rather than assertions of numbers.
 */

const DT = 1 / 60;
const LEGACY = { envelopeApexHoldSeconds: 0, envelopeAttackPreserving: false } as const;

type Definition = { pose: BlendshapePose; defaultIntensity: number };
const table = hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>;

/** `pose x defaultIntensity x gain`, capped — what an unhurried label reaches. */
function ceilingFor(phoneme: string): BlendshapePose {
  const definition = table[phoneme];
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(definition.pose)) scaled[name] = value * definition.defaultIntensity;
  return calibrateHyper3dPose(scaled);
}

/** The channel that identifies the phoneme: its largest non-jaw demand. */
function leadChannel(phoneme: string) {
  const entries = Object.entries(ceilingFor(phoneme)).filter(([name]) => name !== "jawOpen");
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? "jawOpen";
}

/** One isolated label between silences, through coarticulation, mixer and calibration. */
function deliver(phoneme: string, duration: number, overrides: object = {}) {
  const engine = new CoarticulationEngine();
  const mixer = new FacialPoseMixer();
  const lead = 0.25;
  const current = { id: "c", phoneme, start_time: lead, end_time: lead + duration, intensity: 1 };
  const previous = { id: "p", phoneme: "SIL", start_time: 0, end_time: lead, intensity: 1 };
  const next = { id: "n", phoneme: "SIL", start_time: lead + duration, end_time: lead + duration + 0.3, intensity: 1 };
  const peaks: Record<string, number> = {};
  let worstRiseMM = 0;
  let previousFrame: Record<string, number> = {};
  for (let t = 0; t <= lead + duration + 0.3; t += DT) {
    const lip = engine.blend({
      time: t, current, previous, next, windowSeconds: 0.08,
      profile: hyper3dPhonemeToBlendshape, ...overrides,
    });
    const mixed = mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
    const rendered = calibrateHyper3dPose(mixer.smooth(mixed.pose, DT, undefined) as BlendshapePose);
    // jawOpen travels 35.19 mm at influence 1.0 on female_2291.glb.
    const rise = ((rendered.jawOpen ?? 0) - (previousFrame.jawOpen ?? 0)) * 35.19;
    if (rise > worstRiseMM) worstRiseMM = rise;
    previousFrame = rendered;
    if (t >= current.start_time && t <= current.end_time) {
      for (const [name, value] of Object.entries(rendered)) {
        if (value > (peaks[name] ?? 0)) peaks[name] = value;
      }
    }
  }
  return { peaks, worstRiseMM };
}

const ratio = (phoneme: string, duration: number, overrides: object = {}) => {
  const channel = leadChannel(phoneme);
  const ceiling = ceilingFor(phoneme)[channel] ?? 0;
  return ceiling > 0 ? (deliver(phoneme, duration, overrides).peaks[channel] ?? 0) / ceiling : 0;
};

const ORDINARY_VOWELS = ["AA", "AH", "AE", "IH", "UW"];

describe("duration-aware apex hold", () => {
  it("holds the apex for two frames, and only where the label is too short for its ramps", () => {
    // The hold is a constant number of seconds, so the FRACTION falls with length.
    expect(apexSustainFor(0.02)).toBeCloseTo(ENVELOPE_SUSTAIN_MAX, 6);
    expect(apexSustainFor(0.09)).toBeCloseTo(ENVELOPE_APEX_HOLD_SECONDS / 0.09, 6);
    expect(apexSustainFor(0.3)).toBeCloseTo(ENVELOPE_APEX_HOLD_SECONDS / 0.3, 6);
    // Never above the cap, and the hold in seconds never exceeds the request.
    for (const duration of [0.01, 0.02, 0.05, 0.07, 0.15, 0.4, 1.2]) {
      const sustain = apexSustainFor(duration);
      expect(sustain).toBeLessThanOrEqual(ENVELOPE_SUSTAIN_MAX);
      expect(duration * sustain).toBeLessThanOrEqual(ENVELOPE_APEX_HOLD_SECONDS + 1e-9);
    }
    // A zero hold is the pre-fix value exactly.
    expect(apexSustainFor(0.07, 0)).toBe(0);
    expect(apexSustainFor(0)).toBe(0);
  });

  it("meets the short-label delivery targets on ordinary vowels", () => {
    for (const phoneme of ORDINARY_VOWELS) {
      expect(ratio(phoneme, 0.07)).toBeGreaterThanOrEqual(0.7);
      expect(ratio(phoneme, 0.09)).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("improves every short label and never reduces one", () => {
    const phonemes = [...ORDINARY_VOWELS, "P", "B", "M", "T", "K", "S", "SH"];
    for (const phoneme of phonemes) {
      for (const duration of [0.02, 0.035, 0.05, 0.07, 0.09]) {
        const before = ratio(phoneme, duration, LEGACY);
        const after = ratio(phoneme, duration);
        expect(after).toBeGreaterThanOrEqual(before - 1e-9);
      }
    }
  });

  /**
   * CONVERGENCE IS A PROPERTY, NOT A SWEEP. Both mechanisms live inside
   * `compressedEnvelope`'s existing `total > rampBudget` branch, so a label whose
   * ramp budget already contains its authored attack and release cannot be
   * touched. The threshold is therefore derived from the phoneme's own timing
   * rather than asserted as a number — which is what makes this hold for the
   * affricates too, whose pinned 0.5 sustain keeps them compressed far longer.
   */
  it("converges: any label that contains its own ramps is byte-identical", () => {
    const phonemes = [...ORDINARY_VOWELS, "P", "B", "M", "T", "K", "S", "SH", "CH", "JH", "F", "V", "L", "N"];
    let convergedCases = 0;
    for (const phoneme of phonemes) {
      const definition = hyper3dPhonemeToBlendshape[phoneme as keyof typeof hyper3dPhonemeToBlendshape];
      const ramps = definition.attack + definition.release;
      for (const duration of [0.05, 0.07, 0.09, 0.12, 0.15, 0.18, 0.2, 0.35, 0.6]) {
        const sustain = AFFRICATE_SUSTAIN_PHONEMES.has(phoneme)
          ? Math.max(apexSustainFor(duration), AFFRICATE_SUSTAIN_FRACTION)
          : apexSustainFor(duration);
        if (duration * (1 - sustain) < ramps) continue;
        convergedCases += 1;
        expect(deliver(phoneme, duration).peaks).toEqual(deliver(phoneme, duration, LEGACY).peaks);
      }
    }
    expect(convergedCases).toBeGreaterThan(40);
    // And the headline case the review asks about: every phoneme at 200 ms.
    for (const phoneme of phonemes) {
      expect(deliver(phoneme, 0.2).peaks).toEqual(deliver(phoneme, 0.2, LEGACY).peaks);
    }
  });

  /**
   * The affricate contract is not "unchanged values" — their pinned 0.5 sustain
   * keeps their ramps compressed to ~180 ms, so the allocation reaches them. It
   * is the 1.2 mm protrusion floor the affricate pass established from the
   * already-accepted "chose". Measured over all nine CH/JH occurrences in the
   * aligned corpus: seven rise, two fall, the worst by 0.074 mm, and the minimum
   * after the change is 1.215 mm. None crosses the floor.
   */
  it("does not materially reduce affricate protrusion", () => {
    // mouthPucker travels 13.11 mm at influence 1.0 on female_2291.glb.
    const protrusion = (phoneme: string, duration: number, overrides: object = {}) =>
      (deliver(phoneme, duration, overrides).peaks.mouthPucker ?? 0) * 13.11;
    for (const phoneme of ["CH", "JH"]) {
      for (const duration of [0.05, 0.07, 0.09, 0.12, 0.15, 0.2]) {
        const before = protrusion(phoneme, duration, LEGACY);
        const after = protrusion(phoneme, duration);
        // The bound is the worst change measured over the corpus, not a guess.
        expect(after).toBeGreaterThan(before - 0.08);
      }
    }
  });

  it("does not steepen the rising edge — the cost that sank the earlier sustain experiments", () => {
    for (const phoneme of ORDINARY_VOWELS) {
      for (const duration of [0.05, 0.07, 0.09, 0.12]) {
        const before = deliver(phoneme, duration, LEGACY).worstRiseMM;
        const after = deliver(phoneme, duration).worstRiseMM;
        // The authored attack is preserved, so the worst rise cannot grow.
        expect(after).toBeLessThanOrEqual(before + 1e-6);
      }
    }
  });

  it("preserves the affricate sustain by arithmetic rather than by a branch", () => {
    // The cap IS the affricate sustain, so `Math.max` can only ever resolve to it.
    expect(ENVELOPE_SUSTAIN_MAX).toBe(AFFRICATE_SUSTAIN_FRACTION);
    for (const phoneme of AFFRICATE_SUSTAIN_PHONEMES) {
      for (const duration of [0.02, 0.05, 0.07, 0.09, 0.13, 0.2]) {
        const composed = Math.max(apexSustainFor(duration), AFFRICATE_SUSTAIN_FRACTION);
        expect(composed).toBe(AFFRICATE_SUSTAIN_FRACTION);
      }
      expect(typeof phoneme).toBe("string");
    }
  });

  it("leaves the attack share a real release", () => {
    expect(ENVELOPE_ATTACK_SHARE_MAX).toBeLessThan(1);
    expect(ENVELOPE_ATTACK_SHARE_MAX).toBeGreaterThan(0.5);
  });

  it("changes nothing when a phoneme is absent", () => {
    const engine = new CoarticulationEngine();
    const blended = engine.blend({ time: 1, windowSeconds: 0.08, profile: hyper3dPhonemeToBlendshape });
    expect(blended.pose).toEqual({});
    expect(blended.weights.current).toBe(0);
  });
});
