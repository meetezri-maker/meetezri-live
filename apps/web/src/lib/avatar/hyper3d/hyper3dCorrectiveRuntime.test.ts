import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CoarticulationEngine } from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { TimelineCursor } from "./engine/engine/timeline/TimelineCursor";
import { SpeechBoundaryTimeline } from "./engine/engine/timeline/SpeechBoundaryTimeline";
import { normalizePhoneme } from "./engine/engine/lipsync/PhonemeNormalizer";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  getMouthTransitionProfile,
  resolveMouthDeadline
} from "./engine/mappings/avatarBlendshapeConfig";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import {
  BILABIAL_PHONEMES,
  CORRECTIVE_BILABIAL_LEAD_SECONDS,
  CORRECTIVE_MORPH,
  CORRECTIVE_TARGETS,
  gateCorrectiveOutput,
  applyCorrectiveTargetGate,
  correctiveBilabialSuppression,
  hyper3dCorrectiveProfile
} from "./hyper3dCorrectiveMorph";
import {
  HYPER3D_ASSET_URLS,
  HYPER3D_EXPERIMENTAL_ASSET_ID,
  HYPER3D_EXPERIMENTAL_GLB_URL,
  HYPER3D_GLB_URL,
  HYPER3D_PRODUCTION_ASSET_ID
} from "./engine/mappings/avatars/hyper3dAssetSelection";
import { CORPUS_PAYLOADS, loadPayload } from "./hyper3dDeadlineCorpus";
import { median, percentile, poseDistanceMM, HYPER3D_REACH_CHANNELS, countJawCycles } from "./hyper3dDeadlineInstrumentation";
import type { AvatarPayload, TimedPhoneme } from "./engine/types/avatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2 — CORRECTIVE MORPH RUNTIME, and the bilabial gate.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Drives the PRODUCTION chain twice over the same aligned timeline — once with
 * the shipped profile, once with the corrective profile and the suppression —
 * and compares. Same payload object, same clock, same frame deltas, same
 * `CoarticulationEngine`, same `FacialPoseMixer`, same accepted 34 SOFT
 * profile, same calibration. The ONLY difference is the speech profile and the
 * one suppression multiplier.
 *
 * The suppression is reproduced here exactly as `AvatarController` applies it:
 * after the coarticulation blend, before the mixer, through the same
 * `cursor.nextMatchingStart` lookahead and the same
 * `correctiveBilabialSuppression`. A test that re-implemented it would be
 * testing itself.
 */

const FRAME = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;

type Frame = {
  clock: number;
  phoneme: string | null;
  smoothed: Record<string, number>;
  rendered: BlendshapePose;
  correctionTarget: number;
  correctionRequested: number;
  correctionRendered: number;
  suppression: number;
  /** The runtime's own sentence-pause signal, not a guess from a null phoneme. */
  settling: boolean;
};

/** One run of the real chain over a payload. `corrective` picks the profile. */
function run(payload: AvatarPayload, corrective: boolean): Frame[] {
  const cursor = new TimelineCursor(payload);
  const engine = new CoarticulationEngine();
  const mixer = new FacialPoseMixer();
  const boundaries = new SpeechBoundaryTimeline(payload);
  // Production 34 SOFT for BOTH paths: no override.
  const mouth = resolveMouthDeadline(PROFILE, null);
  const profile = corrective ? hyper3dCorrectiveProfile : hyper3dPhonemeToBlendshape;
  const window = payload.behaviour_settings?.coarticulation_window ?? 0.08;
  const out: Frame[] = [];

  for (let frame = 0; ; frame += 1) {
    const t = frame * FRAME;
    if (t > payload.audio_duration) break;
    const clock = cursor.seek(t);
    const current = cursor.activePhoneme(clock);
    const lip = engine.blend({
      time: clock,
      current,
      previous: cursor.previousPhoneme(clock),
      next: cursor.nextPhoneme(clock),
      windowSeconds: window,
      profile
    });

    /**
     * THE GATE, both halves, through the same two functions the controller
     * calls — not a re-implementation. The lookahead is evaluated on EVERY
     * frame, not only the ones whose pose carries correction, because the
     * frames that leaked were exactly the ones whose pose does not: a bilabial's
     * own pose has no correction channel for the target half to scale.
     */
    let suppression = 1;
    const requested = lip.pose[CORRECTIVE_MORPH] ?? 0;
    if (corrective) {
      const nextBilabial = cursor.nextMatchingStart(
        clock,
        (p: TimedPhoneme) => BILABIAL_PHONEMES.has(normalizePhoneme(p.phoneme) ?? p.phoneme),
        CORRECTIVE_BILABIAL_LEAD_SECONDS
      );
      suppression = correctiveBilabialSuppression(clock, nextBilabial);
      applyCorrectiveTargetGate(lip.pose, suppression);
    }

    const mixed = mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
    const settling = boundaries.proximityAt(clock)?.insidePauseKind === "sentence";
    const followed = mixer.smooth(
      mixed.pose, FRAME, undefined, mouth, settling, current ? current.end_time - clock : null
    );
    const smoothed = corrective ? gateCorrectiveOutput(followed, suppression) : followed;
    out.push({
      clock,
      phoneme: current?.phoneme ?? null,
      smoothed: { ...smoothed },
      rendered: calibrateHyper3dPose(smoothed as BlendshapePose),
      // POST-suppression: what the follower was actually asked for this frame.
      correctionTarget: lip.pose[CORRECTIVE_MORPH] ?? 0,
      correctionRequested: requested,
      correctionRendered: smoothed[CORRECTIVE_MORPH] ?? 0,
      suppression,
      settling
    });
  }
  return out;
}

/** A synthetic aligned payload, for the §6 transition sequences. */
function payloadOf(labels: Array<[string, number]>): AvatarPayload {
  const phonemes: TimedPhoneme[] = [];
  let cursor = 0.25;
  labels.forEach(([phoneme, ms], i) => {
    phonemes.push({
      id: `syn-${i}`, phoneme, start_time: cursor, end_time: cursor + ms / 1000, intensity: 1
    } as TimedPhoneme);
    cursor += ms / 1000;
  });
  return {
    phonemes, pauses: [], audio_duration: cursor + 0.25,
    behaviour: { coarticulation: true },
    behaviour_settings: { coarticulation_window: 0.08 }
  } as unknown as AvatarPayload;
}

describe("the corrective morph is inert unless asked for", () => {
  it("adds the channel to exactly three vowels and nothing else", () => {
    expect(Object.keys(CORRECTIVE_TARGETS).sort()).toEqual(["AA", "AE", "AH"]);
    const base = hyper3dPhonemeToBlendshape as unknown as Record<string, { pose: BlendshapePose }>;
    const corr = hyper3dCorrectiveProfile as unknown as Record<string, { pose: BlendshapePose }>;
    for (const phoneme of Object.keys(base)) {
      const expected = CORRECTIVE_TARGETS[phoneme];
      expect(corr[phoneme].pose[CORRECTIVE_MORPH]).toBe(expected);
      // And NOTHING else about any pose moved.
      for (const [name, value] of Object.entries(base[phoneme].pose)) {
        expect(corr[phoneme].pose[name]).toBe(value);
      }
    }
    // The shipped table itself is untouched.
    for (const phoneme of Object.keys(base)) {
      expect(base[phoneme].pose[CORRECTIVE_MORPH]).toBeUndefined();
    }
  });

  it("never writes the channel when the shipped profile is used", () => {
    const frames = run(payloadOf([["AA", 120], ["M", 80], ["AA", 120]]), false);
    for (const f of frames) {
      expect(f.correctionTarget).toBe(0);
      expect(f.correctionRendered).toBe(0);
      expect(f.rendered[CORRECTIVE_MORPH] ?? 0).toBe(0);
    }
  });

  it("leaves every other channel bit-identical when the correction is active", () => {
    /**
     * THE CENTRAL ISOLATION CLAIM. Adding the correction must not perturb a
     * single other channel — not the jaw, not `mouthClose`, not `mouthPress`.
     * Compared frame for frame with `toEqual` over a sequence that contains a
     * bilabial, an open vowel and a front vowel.
     */
    const payload = payloadOf([["AA", 120], ["M", 80], ["IY", 90], ["B", 70], ["AH", 110]]);
    const before = run(payload, false);
    const after = run(payload, true);
    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i += 1) {
      const names = new Set([...Object.keys(before[i].smoothed), ...Object.keys(after[i].smoothed)]);
      for (const name of names) {
        if (name === CORRECTIVE_MORPH) continue;
        expect(after[i].smoothed[name] ?? 0).toBe(before[i].smoothed[name] ?? 0);
      }
    }
  });
});

describe("the suppression curve", () => {
  it("is 1 with no bilabial ahead, 0 at the closure, and continuous between", () => {
    expect(correctiveBilabialSuppression(0, null)).toBe(1);
    expect(correctiveBilabialSuppression(1.0, 1.0)).toBe(0);
    expect(correctiveBilabialSuppression(1.0, 0.9)).toBe(0);
    expect(correctiveBilabialSuppression(1.0, 1.0 + CORRECTIVE_BILABIAL_LEAD_SECONDS)).toBe(1);
    let previous = 0;
    for (let lead = 0; lead <= CORRECTIVE_BILABIAL_LEAD_SECONDS; lead += 0.001) {
      const s = correctiveBilabialSuppression(0, lead);
      expect(s).toBeGreaterThanOrEqual(previous - 1e-12);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      previous = s;
    }
  });

  it("is safe for non-finite and degenerate input", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const s = correctiveBilabialSuppression(0, bad);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(Number.isFinite(correctiveBilabialSuppression(NaN, 1))).toBe(true);
  });
});

describe("§6 BILABIAL SAFETY — the primary acceptance gate", () => {
  const SEQUENCES: Record<string, Array<[string, number]>> = {
    "AA -> M": [["AA", 150], ["M", 90]],
    "M -> AA": [["M", 90], ["AA", 150]],
    "B -> IY -> B": [["B", 80], ["IY", 120], ["B", 80]],
    "AA -> P": [["AA", 150], ["P", 80]],
    "AH -> B": [["AH", 130], ["B", 80]],
    "repeated P/B/M": [
      ["AA", 110], ["P", 70], ["AH", 90], ["B", 70], ["AE", 100], ["M", 85], ["AA", 110], ["P", 70]
    ]
  };

  /** The frames whose active label is a bilabial. */
  const closureFrames = (frames: Frame[]) =>
    frames.filter((f) => f.phoneme && BILABIAL_PHONEMES.has(f.phoneme));

  it("does not weaken mouthClose or mouthPress on any sequence", () => {
    for (const [label, labels] of Object.entries(SEQUENCES)) {
      const payload = payloadOf(labels);
      const before = run(payload, false);
      const after = run(payload, true);
      /**
       * The seal channels must be IDENTICAL, not merely similar: the correction
       * touches neither, and the suppression can only remove correction.
       */
      expect(after.map((f) => f.rendered.mouthClose ?? 0), label)
        .toEqual(before.map((f) => f.rendered.mouthClose ?? 0));
      expect(after.map((f) => f.rendered.mouthPressLeft ?? 0), label)
        .toEqual(before.map((f) => f.rendered.mouthPressLeft ?? 0));
      expect(after.map((f) => f.rendered.jawOpen ?? 0), label)
        .toEqual(before.map((f) => f.rendered.jawOpen ?? 0));
    }
  });

  it("carries no residual correction into any closure interval", () => {
    for (const [label, labels] of Object.entries(SEQUENCES)) {
      const after = run(payloadOf(labels), true);
      const closures = closureFrames(after);
      expect(closures.length, label).toBeGreaterThan(0);
      for (const f of closures) {
        expect(f.correctionTarget, `${label} target @${f.clock.toFixed(3)}`).toBe(0);
        expect(f.correctionRendered, `${label} rendered @${f.clock.toFixed(3)}`).toBeLessThan(0.01);
      }
    }
  });

  it("holds the timeline exactly on every sequence", () => {
    for (const [label, labels] of Object.entries(SEQUENCES)) {
      const payload = payloadOf(labels);
      const before = run(payload, false);
      const after = run(payload, true);
      expect(after.map((f) => `${f.clock.toFixed(6)}|${f.phoneme}`), label)
        .toEqual(before.map((f) => `${f.clock.toFixed(6)}|${f.phoneme}`));
    }
  });

  it("prints the closure comparison", () => {
    const lines: string[] = [""];
    lines.push("=== §6 BILABIAL CLOSURE: production profile vs corrective profile ===");
    lines.push("sequence".padEnd(18) + "peakClose".padStart(11) + "minGapProxy".padStart(13) +
      "closureFrames".padStart(15) + "maxResidual".padStart(13) + "suppressAt".padStart(12));
    for (const [label, labels] of Object.entries(SEQUENCES)) {
      const payload = payloadOf(labels);
      const before = run(payload, false);
      const after = run(payload, true);
      const peak = (fs: Frame[]) => Math.max(...fs.map((f) => f.rendered.mouthClose ?? 0));
      const closures = closureFrames(after);
      const maxResidual = Math.max(...closures.map((f) => f.correctionRendered));
      // The first frame at which suppression began, as ms before the closure.
      const firstSupp = after.find((f) => f.suppression < 1);
      const closureStart = after.find((f) => f.phoneme && BILABIAL_PHONEMES.has(f.phoneme))?.clock ?? 0;
      lines.push(
        label.padEnd(18) +
        `${peak(before).toFixed(4)}=${peak(after).toFixed(4)}`.padStart(11) +
        "identical".padStart(13) +
        String(closures.length).padStart(15) +
        maxResidual.toFixed(6).padStart(13) +
        (firstSupp ? `${((closureStart - firstSupp.clock) * 1000).toFixed(0)}ms` : "n/a").padStart(12)
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(3);
  });
});

describe("§3 open-vowel activation", () => {
  it("reaches a real correction on AA, AH and AE away from any bilabial", () => {
    for (const [phoneme, target] of Object.entries(CORRECTIVE_TARGETS)) {
      const frames = run(payloadOf([[phoneme, 200], ["IY", 200]]), true);
      const own = frames.filter((f) => f.phoneme === phoneme);
      const peak = Math.max(...own.map((f) => f.correctionRendered));
      // The envelope and follower never deliver 100 %, but it must be substantial.
      expect(peak, phoneme).toBeGreaterThan(target * 0.5);
      expect(peak, phoneme).toBeLessThanOrEqual(target + 1e-9);
      expect(own.every((f) => f.suppression === 1), `${phoneme} unsuppressed`).toBe(true);
    }
  });

  it("gives every other phoneme exactly zero", () => {
    const frames = run(payloadOf([["IY", 150], ["T", 60], ["UW", 150], ["S", 80], ["OW", 150]]), true);
    for (const f of frames) expect(f.correctionTarget).toBe(0);
  });
});

describe("§2 / §8 asset selection and production isolation", () => {
  it("maps the experimental asset to its own path and leaves production alone", () => {
    expect(HYPER3D_ASSET_URLS[HYPER3D_PRODUCTION_ASSET_ID]).toBe("/avatars/female_2291.glb");
    expect(HYPER3D_ASSET_URLS[HYPER3D_EXPERIMENTAL_ASSET_ID]).toBe(HYPER3D_EXPERIMENTAL_GLB_URL);
    expect(HYPER3D_EXPERIMENTAL_GLB_URL).toBe("/avatars/experimental/female_2291-lowerlip-v2.glb");
    expect(HYPER3D_GLB_URL).not.toBe(HYPER3D_EXPERIMENTAL_GLB_URL);
  });

  it("ships the experimental GLB beside the production one, not instead of it", () => {
    expect(existsSync("public/avatars/female_2291.glb")).toBe(true);
    expect(existsSync("public/avatars/experimental/female_2291-lowerlip-v2.glb")).toBe(true);
  });
});

/** §7 — the real aligned corpus, both paths, production 34 SOFT. */
const corpus = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = corpus.length > 0 ? describe : describe.skip;

describeCorpus("§7 connected speech, production vs corrective", () => {
  const motion = (frames: Frame[]) => {
    const velocities: number[] = [];
    const jaw: number[] = [];
    let path = 0;
    let previous: BlendshapePose = {};
    for (const f of frames) {
      const travelled = poseDistanceMM(f.rendered, previous, HYPER3D_REACH_CHANNELS);
      path += travelled;
      velocities.push(travelled / FRAME);
      jaw.push(f.rendered.jawOpen ?? 0);
      previous = f.rendered;
    }
    const seconds = frames.length * FRAME;
    return {
      pathRate: path / seconds,
      velP90: percentile(velocities, 0.9),
      velP95: percentile(velocities, 0.95),
      jawCycles: countJawCycles(jaw) / seconds
    };
  };

  it("does not make connected speech faster or busier", () => {
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const before = motion(run(payload, false));
      const after = motion(run(payload, true));
      /**
       * §7's condition as a number. The correction adds lip travel by design, so
       * some rise is expected; what is not acceptable is the band the lower-face
       * strength pass was rejected at (+6 % path, +5 % peak velocity).
       */
      expect(after.pathRate, entry.id).toBeLessThan(before.pathRate * 1.05);
      expect(after.velP90, entry.id).toBeLessThan(before.velP90 * 1.05);
      // Jaw closing is untouched, so the open-close rhythm cannot change.
      expect(after.jawCycles, entry.id).toBeCloseTo(before.jawCycles, 6);
    }
  });

  it("holds the timeline and the seal across the whole corpus", () => {
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const before = run(payload, false);
      const after = run(payload, true);
      expect(after.length, entry.id).toBe(before.length);
      expect(after.map((f) => `${f.clock.toFixed(6)}|${f.phoneme}`), entry.id)
        .toEqual(before.map((f) => `${f.clock.toFixed(6)}|${f.phoneme}`));
      expect(after.map((f) => f.rendered.mouthClose ?? 0), entry.id)
        .toEqual(before.map((f) => f.rendered.mouthClose ?? 0));
      expect(after.map((f) => f.rendered.mouthPressLeft ?? 0), entry.id)
        .toEqual(before.map((f) => f.rendered.mouthPressLeft ?? 0));
    }
  });

  it("carries no residual correction into any real bilabial", () => {
    for (const entry of corpus) {
      const after = run(loadPayload(entry.path), true);
      const closures = after.filter((f) => f.phoneme && BILABIAL_PHONEMES.has(f.phoneme));
      if (!closures.length) continue;
      const worst = Math.max(...closures.map((f) => f.correctionRendered));
      expect(worst, `${entry.id} residual`).toBe(0);
    }
  });

  /**
   * ───────────────────────────────────────────────────────────────────────────
   * §4 — IS THERE A VISIBLE SNAP FROM THE POST-FOLLOWER GATE?
   * ───────────────────────────────────────────────────────────────────────────
   *
   * The gate multiplies the RENDERED correction, so unlike every other change
   * in this project it is not smoothed by the follower afterwards. That makes a
   * step the follower would never produce at least possible, and "the ramp is
   * smootherstep" is an argument, not a measurement.
   *
   * THE BOUND IS THE FACE'S OWN MOTION. A step is visible when it is large
   * relative to what the rest of the mouth is already doing in the same frame.
   * So the comparison is the correction's worst per-frame change in millimetres
   * of lip displacement against the worst per-frame change of the lip channels
   * that were already accepted. If the correction's step is within that
   * envelope, it cannot read as a snap distinct from ordinary articulation.
   */
  const correctionStepsMM = (frames: Frame[]) => {
    /**
     * In millimetres, not in weight. The morph's peak is 2.973 mm at full
     * influence (see `hyper3dCorrectiveBinding.test.ts`), so a weight step
     * converts directly.
     */
    const PEAK_MM = 2.973;
    const steps: number[] = [];
    let previous = 0;
    for (const f of frames) {
      steps.push(Math.abs(f.correctionRendered - previous) * PEAK_MM);
      previous = f.correctionRendered;
    }
    return steps;
  };

  /** Worst per-frame travel of the accepted lip channels, in mm. */
  const lipStepsMM = (frames: Frame[]) => {
    const steps: number[] = [];
    let previous: BlendshapePose = {};
    for (const f of frames) {
      steps.push(poseDistanceMM(f.rendered, previous, HYPER3D_REACH_CHANNELS));
      previous = f.rendered;
    }
    return steps;
  };

  it("produces no step the rest of the mouth is not already making", () => {
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const after = run(payload, true);
      const correction = correctionStepsMM(after);
      const lips = lipStepsMM(after);
      const worstCorrection = Math.max(...correction);
      const worstLips = Math.max(...lips);
      /**
       * The correction's sharpest frame must sit inside the envelope of what
       * the accepted lip channels already do. This is a strictly stronger claim
       * than "below some threshold in mm", because it scales with the payload.
       */
      expect(worstCorrection, `${entry.id} correction step vs lip step`).toBeLessThan(worstLips);
      // And no frame may move the correction by more than its own full travel.
      expect(worstCorrection, entry.id).toBeLessThan(2.973);
    }
  });

  it("keeps the sentence-pause settle untouched", () => {
    /**
     * ───────────────────────────────────────────────────────────────────────
     * SENTENCE-PAUSE BEHAVIOUR.
     * ───────────────────────────────────────────────────────────────────────
     *
     * The accepted settle takes the mouth to the presence baseline at speed 11
     * during a sentence pause, with the deadline layer excluded. §7 asks whether
     * the experiment disturbs it.
     *
     * WHICH FRAMES THOSE ARE comes from the runtime's own signal. These fixtures
     * are MFA-aligned and gap-free — silence is a SIL label, not a hole — so
     * `phoneme === null` never occurs and a test keyed on it would check
     * nothing. `SpeechBoundaryTimeline` is what arms the settle, so it is what
     * this reads.
     *
     * WHAT A PAUSE ACTUALLY LOOKS LIKE, measured on the paragraph's pause at
     * 23.9-24.6 s:
     *
     *   23.917 - 24.567   SIL, correction exactly 0.0000, 40 frames
     *   24.583            0.0409 target, 0.0152 rendered
     *   24.600            0.1988 target, 0.0837 rendered
     *   24.617            AE begins
     *
     * so a pause has THREE phases, and two of them are legitimately non-zero:
     *
     *   DRAIN      entering the pause out of a vowel, the follower is still
     *              shedding it. Measured 0.0035 — 0.010 mm — on the first
     *              settling frame at 14.167 s.
     *   ZERO       the body of the pause, exactly 0.
     *   RAMP       the accepted coarticulation look-ahead blending the next
     *              phoneme in before its onset, which every channel does and
     *              which is what stops speech starting with a jolt.
     *
     * TESTING THE SHAPE RATHER THAN A WINDOW. Picking frame counts for the
     * drain and the ramp would be two magic numbers that a different payload
     * would invalidate. The leak condition is sharper than that and needs no
     * constants: a leak is the correction RISING in the middle of a pause. So
     * the assertion is that it never rises before the final look-ahead window —
     * drain down, hold, and only then ramp — plus that it does reach exact zero
     * somewhere, which is what says the drain completes rather than merely
     * being small.
     */
    const window = 0.08; // the shipped coarticulation_window
    const tailFrames = Math.ceil(window / FRAME) + 1;
    let pauseFrames = 0;
    let runsSeen = 0;
    let runsReachingZero = 0;
    let longestRun = 0;
    let worstBeforeTail = 0;

    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const before = run(payload, false);
      const after = run(payload, true);

      // Group settling frames into runs, so "the end of a pause" is defined.
      const runs: number[][] = [];
      let active: number[] = [];
      for (let i = 0; i < after.length; i += 1) {
        if (after[i].settling) active.push(i);
        else if (active.length) {
          runs.push(active);
          active = [];
        }
      }
      if (active.length) runs.push(active);

      for (const indices of runs) {
        runsSeen += 1;
        longestRun = Math.max(longestRun, indices.length);
        let previous = Number.POSITIVE_INFINITY;
        let reachedZero = false;

        for (const [position, i] of indices.entries()) {
          pauseFrames += 1;

          // Every channel the settle already owned: bit-identical.
          const names = new Set([
            ...Object.keys(before[i].rendered),
            ...Object.keys(after[i].rendered)
          ]);
          names.delete(CORRECTIVE_MORPH);
          for (const name of names) {
            expect(after[i].rendered[name] ?? 0, `${entry.id} @${after[i].clock.toFixed(3)} ${name}`)
              .toBe(before[i].rendered[name] ?? 0);
          }

          const correction = after[i].rendered[CORRECTIVE_MORPH] ?? 0;
          if (correction === 0) reachedZero = true;

          // Before the look-ahead window, the correction may only fall.
          if (position < indices.length - tailFrames) {
            worstBeforeTail = Math.max(worstBeforeTail, correction);
            expect(
              correction,
              `${entry.id} @${after[i].clock.toFixed(3)} correction rose inside a pause`
            ).toBeLessThanOrEqual(previous + 1e-12);
            previous = correction;
          }
        }
        if (reachedZero) runsReachingZero += 1;
      }
    }

    expect(pauseFrames).toBeGreaterThan(20);
    expect(runsSeen).toBeGreaterThan(0);
    expect(longestRun).toBeGreaterThan(tailFrames + 5);
    // Every pause fully drains the correction, rather than merely damping it.
    expect(runsReachingZero).toBe(runsSeen);
    /**
     * And what survives at the very start of a pause is small: 0.05 of weight
     * is 0.15 mm of lower lip against the channel's 2.973 mm full travel.
     */
    expect(worstBeforeTail).toBeLessThan(0.05);
  });

  it("holds the audio timeline exactly, so drift is zero by construction", () => {
    /**
     * TIMING DRIFT. The correction is a pose channel and a multiplier; it reads
     * the clock and the timeline and writes neither. The assertion is therefore
     * not "drift is small" but that every frame's clock and active phoneme are
     * bit-identical between the two runs — which is what makes drift zero
     * rather than measured.
     */
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const before = run(payload, false);
      const after = run(payload, true);
      let worstDrift = 0;
      for (let i = 0; i < after.length; i += 1) {
        worstDrift = Math.max(worstDrift, Math.abs(after[i].clock - before[i].clock));
        expect(after[i].phoneme, `${entry.id} frame ${i}`).toBe(before[i].phoneme);
      }
      expect(worstDrift, `${entry.id} drift`).toBe(0);
    }
  });

  it("prints the connected-speech comparison", () => {
    /**
     * Every §7 quantity in one place, production profile against corrective,
     * both at production Deadline 34 SOFT, on the identical aligned fixtures.
     * `a->b` is production -> corrective.
     */
    const PEAK_MM = 2.973;
    const lines: string[] = [""];
    lines.push("=== §7 CONNECTED SPEECH: production profile vs corrective (34 SOFT both) ===");
    lines.push("Identical aligned fixtures, identical frame clock, 60 Hz.");
    lines.push("");
    lines.push(
      "payload".padEnd(32) + "pathRate".padStart(16) + "velP90".padStart(16) +
      "velP95".padStart(16) + "jawCyc/s".padStart(14)
    );
    const rows: Array<{
      id: string; reach: number; resid: number; lipMM: number; corrMM: number;
      stepMM: number; lipStepMM: number; drift: number; pauseBody: number;
    }> = [];
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const b = run(payload, false);
      const a = run(payload, true);
      const mb = motion(b), ma = motion(a);

      const active = a.filter((f) => f.correctionTarget > 0);
      const reach = active.length
        ? median(active.map((f) => f.correctionRendered / f.correctionTarget))
        : 0;
      const closures = a.filter((f) => f.phoneme && BILABIAL_PHONEMES.has(f.phoneme));
      const resid = closures.length ? Math.max(...closures.map((f) => f.correctionRendered)) : 0;

      // Lip displacement added by the correction, in mm, at its peak frame.
      const corrMM = Math.max(...a.map((f) => f.correctionRendered)) * PEAK_MM;
      // Total accepted lip travel per second, for scale.
      const lipMM = ma.pathRate;
      const stepMM = Math.max(...correctionStepsMM(a));
      const lipStepMM = Math.max(...lipStepsMM(a));

      let drift = 0;
      /**
       * The pause column reports the worst correction surviving into a
       * sentence pause OUTSIDE its drain-in and look-ahead windows — the
       * body of the silence. Bit-identity against the production run would
       * be the wrong column: the corrective channel exists in only one of
       * the two runs, so it differs by construction while the follower
       * sheds the preceding vowel.
       */
      let pauseBody = 0;
      const tail = Math.ceil(0.08 / FRAME) + 1;
      let settlingRun = 0;
      for (let i = 0; i < a.length; i += 1) {
        drift = Math.max(drift, Math.abs(a[i].clock - b[i].clock));
        if (!a[i].settling) { settlingRun = 0; continue; }
        settlingRun += 1;
        // Look ahead to see whether this frame is inside the trailing ramp.
        let remaining = 0;
        while (i + remaining + 1 < a.length && a[i + remaining + 1].settling) remaining += 1;
        if (remaining >= tail) pauseBody = Math.max(pauseBody, a[i].correctionRendered);
      }
      rows.push({ id: entry.id, reach, resid, lipMM, corrMM, stepMM, lipStepMM, drift, pauseBody });

      const pair = (x: number, y: number) => `${x.toFixed(2)}->${y.toFixed(2)}`;
      lines.push(
        entry.id.padEnd(32) +
        pair(mb.pathRate, ma.pathRate).padStart(16) +
        pair(mb.velP90, ma.velP90).padStart(16) +
        pair(mb.velP95, ma.velP95).padStart(16) +
        pair(mb.jawCycles, ma.jawCycles).padStart(14)
      );
    }

    lines.push("");
    lines.push(
      "payload".padEnd(32) + "corrReach".padStart(11) + "maxResid".padStart(10) +
      "corrLipMM".padStart(11) + "corrStepMM".padStart(12) + "lipStepMM".padStart(11) +
      "driftMS".padStart(9) + "pause".padStart(11)
    );
    for (const r of rows) {
      lines.push(
        r.id.padEnd(32) +
        `${(r.reach * 100).toFixed(1)}%`.padStart(11) +
        r.resid.toFixed(5).padStart(10) +
        r.corrMM.toFixed(2).padStart(11) +
        r.stepMM.toFixed(3).padStart(12) +
        r.lipStepMM.toFixed(3).padStart(11) +
        (r.drift * 1000).toFixed(3).padStart(9) +
        r.pauseBody.toFixed(5).padStart(11)
      );
    }
    lines.push("");
    lines.push("corrReach   median rendered/target on frames the correction is asked for");
    lines.push("maxResid    worst rendered correction inside any P/B/M closure");
    lines.push("corrLipMM   peak lower-lip displacement the correction adds, mm");
    lines.push("corrStepMM  worst single-frame change in that displacement, mm");
    lines.push("lipStepMM   worst single-frame travel of the ACCEPTED lip channels, mm");
    lines.push("driftMS     worst frame-clock difference between the two runs");
    lines.push("pauseBody   worst correction in the BODY of a sentence pause (drain and");
    lines.push("            look-ahead windows excluded; those are accepted follower work)");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(rows.length).toBe(corpus.length);
  }, 120_000);
});
