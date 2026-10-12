import { describe, expect, it } from "vitest";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import {
  DEADLINE_COMPLETION,
  DEADLINE_TOLERANCE,
  HYPER3D_DEADLINE_MAX_SPEEDS,
  LIP_SHAPE_CHANNELS,
  MOUTH_SETTLE_CHANNELS,
  deadlineConvergenceSpeed,
  getMouthTransitionProfile,
  hyper3dDeadlineProfile,
  isDeadlineEligibleChannel,
  mouthTransitionProfiles,
  withMouthDeadline,
  withoutMouthDeadline,
  type MouthTransitionProfile,
} from "./engine/mappings/avatarBlendshapeConfig";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEADLINE-AWARE TARGET CONVERGENCE — the controlled comparison's regressions.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The brief's §13 list, one `it` each. Two of them are the ones that matter most
 * and are written to fail loudly:
 *
 *   OFF IS BIT-EQUIVALENT. Not "within a tolerance" — the same IEEE doubles,
 *   over a driven sequence, asserted with `toEqual` on the whole pose.
 *
 *   THE TIMELINE IS READ-ONLY. The deadline layer is handed one number and
 *   returns a speed; no test here can make it write a clock, because there is no
 *   path by which it could. What IS asserted is that the three modes produce the
 *   same label occupancy over the same clock, which is the observable form of
 *   "the timeline did not move".
 */

const DT = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;
/**
 * THE PRE-DEADLINE FOLLOWER, which is no longer the shipped profile.
 *
 * `PROFILE` now carries the accepted 34 SOFT deadline as production
 * configuration, so the follower this layer was originally measured against has
 * to be asked for explicitly. Every test below that means "the accepted
 * follower before any deadline existed" uses `PRE`, and the ones that mean
 * "what ships" use `PROFILE`.
 */
const PRE = withoutMouthDeadline(PROFILE)!;
const D34 = withMouthDeadline(PROFILE, HYPER3D_DEADLINE_MAX_SPEEDS.d34)!;
const D44 = withMouthDeadline(PROFILE, HYPER3D_DEADLINE_MAX_SPEEDS.d44)!;

/** One lip-shape channel and one jaw channel is enough to exercise both rules. */
const LIP = "mouthFunnel";

type Frame = { target: Record<string, number>; remaining: number | null };

/**
 * Drive the mixer over a frame series. `settling` is a parameter rather than a
 * default so a settle run cannot become a non-settle run by omission.
 */
function drive(frames: readonly Frame[], mouth: MouthTransitionProfile | undefined, settling = false) {
  const mixer = new FacialPoseMixer();
  const out: Array<Record<string, number>> = [];
  for (const frame of frames) {
    const mixed = mixer.combine([{ channel: "lipsync", pose: frame.target }] as never);
    out.push({ ...mixer.smooth(mixed.pose, DT, undefined, mouth, settling, frame.remaining) });
  }
  return out;
}

/** A label of `ms` milliseconds holding one target, as 60 Hz frames. */
function label(target: Record<string, number>, ms: number): Frame[] {
  const seconds = ms / 1000;
  const frames: Frame[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    frames.push({ target: { ...target }, remaining: Math.max(0, seconds - t) });
  }
  return frames;
}

describe("the deadline formula", () => {
  it("is the exponential residual solved for speed, and nothing else", () => {
    const profile = hyper3dDeadlineProfile(1000);
    /**
     * ln(1/(1-0.9)) / remaining, with the cap deliberately out of the way and
     * every `remaining` below the 96 ms crossover — above it the FLOOR rule
     * correctly returns the baseline instead, which the next test covers.
     */
    for (const remaining of [0.02, 0.05, 0.09]) {
      const speed = deadlineConvergenceSpeed(LIP, 0, 1, 24, remaining, profile);
      expect(speed).toBeCloseTo(Math.log(1 / (1 - DEADLINE_COMPLETION)) / remaining, 10);
      // And it is the speed that actually leaves `1 - completion` outstanding.
      expect(Math.exp(-speed * remaining)).toBeCloseTo(1 - DEADLINE_COMPLETION, 10);
    }
  });

  it("is a FLOOR on the follower and can never slow a transition", () => {
    for (const profile of [hyper3dDeadlineProfile(34), hyper3dDeadlineProfile(44)]) {
      for (const remaining of [0.005, 0.03, 0.08, 0.2, 1, 10]) {
        for (const baseline of [9, 11, 24, 28, 48]) {
          const speed = deadlineConvergenceSpeed(LIP, 0, 1, baseline, remaining, profile);
          expect(speed).toBeGreaterThanOrEqual(baseline);
        }
      }
    }
  });

  it("enforces the cap, and the cap is the only thing that can bind", () => {
    for (const cap of [34, 44]) {
      const profile = hyper3dDeadlineProfile(cap);
      // A 1 ms deadline would demand 2302; the cap is what is returned.
      expect(deadlineConvergenceSpeed(LIP, 0, 1, 24, 0.001, profile)).toBe(cap);
      // Every remaining time, every distance: never above the cap.
      for (let remaining = 0.001; remaining < 0.5; remaining += 0.001) {
        const speed = deadlineConvergenceSpeed(LIP, 0, 1, 24, remaining, profile);
        expect(speed).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("leaves a label that already converges adequately completely alone", () => {
    const profile = hyper3dDeadlineProfile(44);
    // `required` crosses the accepted 24 at ln(10)/24 = 95.9 ms of remaining.
    const crossover = Math.log(1 / (1 - DEADLINE_COMPLETION)) / 24;
    for (const remaining of [crossover + 0.001, 0.12, 0.2, 0.5, 2]) {
      expect(deadlineConvergenceSpeed(LIP, 0, 1, 24, remaining, profile)).toBe(24);
    }
    // And it does engage just below it, so the crossover is real and not a gap.
    expect(deadlineConvergenceSpeed(LIP, 0, 1, 24, crossover - 0.001, profile)).toBeGreaterThan(24);
  });

  it("stands down inside the completion tolerance (arrive, then stop chasing)", () => {
    const profile = hyper3dDeadlineProfile(44);
    /**
     * A 20 ms deadline — the most urgent case there is — and still no urgency,
     * because the remaining error is below the asset's visibility floor.
     *
     * The boundary case is written `0 -> tolerance` rather than
     * `0.5 -> 0.5 + tolerance` on purpose: the latter's difference is
     * 0.020000000000000018 in binary floating point, so it is NOT the boundary
     * and asserting on it would be asserting on a rounding artifact.
     */
    expect(deadlineConvergenceSpeed(LIP, 0, DEADLINE_TOLERANCE, 24, 0.02, profile)).toBe(24);
    expect(deadlineConvergenceSpeed(LIP, 0.5, 0.51, 24, 0.02, profile)).toBe(24);
    expect(deadlineConvergenceSpeed(LIP, 0.5, 0.5, 24, 0.02, profile)).toBe(24);
    // Just past it, it engages.
    expect(deadlineConvergenceSpeed(LIP, 0, DEADLINE_TOLERANCE * 1.5, 24, 0.02, profile)).toBeGreaterThan(24);
    expect(deadlineConvergenceSpeed(LIP, 0.5, 0.53, 24, 0.02, profile)).toBeGreaterThan(24);
  });

  it("never accelerates a decay — approach only", () => {
    const profile = hyper3dDeadlineProfile(44);
    for (const [from, to] of [
      [0.8, 0.1],
      [0.5, 0],
      [0.02, 0.02],
      [1, 0.999],
    ]) {
      expect(deadlineConvergenceSpeed(LIP, from, to, 24, 0.02, profile)).toBe(24);
      expect(deadlineConvergenceSpeed("jawOpen", from, to, 24, 0.02, profile)).toBe(24);
    }
  });

  it("produces no NaN and no Infinity for a degenerate label", () => {
    const profile = hyper3dDeadlineProfile(34);
    for (const remaining of [0, -0, -0.01, NaN, Infinity, -Infinity]) {
      const speed = deadlineConvergenceSpeed(LIP, 0, 1, 24, remaining, profile);
      expect(Number.isFinite(speed)).toBe(true);
      expect(speed).toBeGreaterThanOrEqual(24);
      expect(speed).toBeLessThanOrEqual(34);
    }
    // And the same through the smoother, which is where a NaN would reach a morph.
    const frames: Frame[] = [
      { target: { [LIP]: 0.6 }, remaining: 0 },
      { target: { [LIP]: 0.6 }, remaining: NaN },
      { target: { [LIP]: 0.6 }, remaining: -1 },
      { target: { [LIP]: 0.6 }, remaining: Infinity },
    ];
    for (const pose of drive(frames, D34)) {
      for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("eligibility", () => {
  it("is the lip-shape set plus jawOpen, and nothing else", () => {
    for (const channel of LIP_SHAPE_CHANNELS) expect(isDeadlineEligibleChannel(channel)).toBe(true);
    expect(isDeadlineEligibleChannel("jawOpen")).toBe(true);
    /**
     * THE PROTECTED SET. `mouthClose` and `mouthPress*` are the bilabial seal and
     * its lateral compression; the other jaw channels and `mouthRollUpper` were
     * never in the measured lip-shape set and are not joining it here.
     */
    for (const channel of [
      "mouthClose",
      "mouthPressLeft",
      "mouthPressRight",
      "mouthRollUpper",
      "jawForward",
      "jawLeft",
      "jawRight",
      "browInnerUp",
      "eyeBlinkLeft",
      "cheekPuff",
    ]) {
      expect(isDeadlineEligibleChannel(channel)).toBe(false);
    }
  });

  it("refuses an ineligible channel the floor even under the tightest deadline", () => {
    const profile = hyper3dDeadlineProfile(44);
    for (const channel of ["mouthClose", "mouthPressLeft", "mouthPressRight", "jawForward"]) {
      expect(deadlineConvergenceSpeed(channel, 0, 1, 28, 0.005, profile)).toBe(28);
    }
  });
});

describe("the DEV cap plumbing", () => {
  it("is hyper3d-only, structurally and not by caller discipline", () => {
    // Exactly ONE model has a transition profile, and therefore a deadline.
    expect(Object.keys(mouthTransitionProfiles)).toEqual(["hyper3d-usc"]);
    // And it carries the accepted production convergence, not nothing.
    expect(PROFILE.deadline?.maxSpeed).toBe(34);
    expect(PROFILE.deadline?.landingExponent).toBe(0.5);
    expect(PRE.deadline).toBeUndefined();
    // A model without a transition profile cannot acquire one.
    for (const modelId of ["female", "miniface-male"] as const) {
      expect(withMouthDeadline(getMouthTransitionProfile(modelId), 44)).toBeUndefined();
    }
    expect(withMouthDeadline(undefined, 44)).toBeUndefined();
  });

  it("returns the production profile BY IDENTITY when no cap is asked for", () => {
    expect(withMouthDeadline(PROFILE, null)).toBe(PROFILE);
    expect(withMouthDeadline(PROFILE, undefined)).toBe(PROFILE);
    // A nonsense cap is not a cap.
    expect(withMouthDeadline(PROFILE, 0)).toBe(PROFILE);
    expect(withMouthDeadline(PROFILE, -1)).toBe(PROFILE);
    expect(withMouthDeadline(PROFILE, NaN)).toBe(PROFILE);
  });

  it("caches per cap, so the frame path allocates nothing", () => {
    expect(withMouthDeadline(PROFILE, 34)).toBe(withMouthDeadline(PROFILE, 34));
    expect(withMouthDeadline(PROFILE, 44)).toBe(withMouthDeadline(PROFILE, 44));
    expect(withMouthDeadline(PROFILE, 34)).not.toBe(withMouthDeadline(PROFILE, 44));
  });

  it("changes the cap and nothing else about the accepted profile", () => {
    for (const [cap, built] of [[34, D34], [44, D44]] as const) {
      expect(built.deadline?.maxSpeed).toBe(cap);
      expect(built.openSpeed).toBe(PROFILE.openSpeed);
      expect(built.closeSpeed).toBe(PROFILE.closeSpeed);
      expect(built.sealClosureThreshold).toBe(PROFILE.sealClosureThreshold);
      expect(built.lipShapeSpeed).toBe(PROFILE.lipShapeSpeed);
      // The settle target is held BY REFERENCE, so there is still one neutral face.
      expect(built.settle).toBe(PROFILE.settle);
    }
  });

  it("pins the accepted follower values the comparison is measured against", () => {
    expect(PROFILE.lipShapeSpeed).toBe(24);
    expect(PROFILE.openSpeed).toBe(24);
    expect(PROFILE.closeSpeed).toBe(9);
    expect(PROFILE.sealClosureThreshold).toBe(0.5);
    expect(PROFILE.settle?.speed).toBe(11);
    expect(HYPER3D_DEADLINE_MAX_SPEEDS).toEqual({ d34: 34, d44: 44 });
  });
});

describe("OFF mode", () => {
  /** A connected run with short labels, closures, jaw travel and a settle. */
  const sequence: Frame[] = [
    ...label({ jawOpen: 0.45, mouthFunnel: 0.3, mouthStretchLeft: 0.2 }, 90),
    ...label({ mouthClose: 0.7, mouthPressLeft: 0.4, jawOpen: 0.05 }, 40),
    ...label({ jawOpen: 0.5, mouthSmileLeft: 0.45, mouthStretchRight: 0.5 }, 30),
    ...label({ mouthPucker: 0.6, mouthFunnel: 0.55, jawOpen: 0.2 }, 60),
    ...label({ jawOpen: 0.1, mouthRollLower: 0.3 }, 150),
  ];

  it("is bit-equivalent to the accepted follower, pose for pose", () => {
    /**
     * THE CENTRAL CLAIM OF MODE A. `null` remaining (no cap supplied by the
     * controller) and a cap-free profile both have to reproduce the production
     * path exactly, and "exactly" means `toEqual` on every channel of every
     * frame, not a tolerance.
     */
    const production = drive(
      sequence.map((frame) => ({ ...frame, remaining: null })),
      PROFILE,
    );
    const withDeadlineNumbersButNoCap = drive(sequence, PRE);
    expect(withDeadlineNumbersButNoCap).toEqual(production);
  });

  it("is bit-equivalent when the mixer is called the OLD way, with no sixth argument", () => {
    const mixer = new FacialPoseMixer();
    const legacy: Array<Record<string, number>> = [];
    for (const frame of sequence) {
      const mixed = mixer.combine([{ channel: "lipsync", pose: frame.target }] as never);
      // No `secondsRemainingInLabel`: the signature every existing caller uses.
      legacy.push({ ...mixer.smooth(mixed.pose, DT, undefined, PRE, false) });
    }
    expect(legacy).toEqual(drive(sequence, PRE));
  });

  it("reports itself as unarmed", () => {
    const mixer = new FacialPoseMixer();
    for (const frame of sequence) {
      const mixed = mixer.combine([{ channel: "lipsync", pose: frame.target }] as never);
      mixer.smooth(mixed.pose, DT, undefined, PRE, false, frame.remaining);
      const report = mixer.deadlineFrame();
      expect(report.armed).toBe(false);
      expect(report.acceleratedChannels).toBe(0);
      expect(report.peakSpeed).toBe(0);
    }
  });
});

describe("34 and 44 against CURRENT", () => {
  it("raise convergence on a short label and raise it more at 44", () => {
    const short = label({ mouthFunnel: 0.6 }, 40);
    const current = drive(short, PRE).at(-1)![LIP];
    const at34 = drive(short, D34).at(-1)![LIP];
    const at44 = drive(short, D44).at(-1)![LIP];
    expect(at34).toBeGreaterThan(current);
    expect(at44).toBeGreaterThan(at34);
    // And still short of the target: the cap declines to force 100 %.
    expect(at44).toBeLessThan(0.6);
  });

  it("leave a long label untouched, frame for frame", () => {
    /**
     * A 300 ms label never drops below the 96 ms crossover until its last six
     * frames, and by then the follower is inside tolerance — so the whole label
     * must be identical in all three modes.
     */
    const long = label({ mouthFunnel: 0.6, jawOpen: 0.4 }, 300);
    expect(drive(long, D34)).toEqual(drive(long, PRE));
    expect(drive(long, D44)).toEqual(drive(long, PRE));
  });

  it("never overshoot the target", () => {
    for (const mouth of [D34, D44]) {
      for (const ms of [20, 25, 30, 40, 60, 90]) {
        for (const value of [0.15, 0.4, 0.75, 1]) {
          for (const pose of drive(label({ mouthFunnel: value }, ms), mouth)) {
            expect(pose[LIP] ?? 0).toBeLessThanOrEqual(value + 1e-12);
          }
        }
      }
    }
  });

  it("do not oscillate: a held target is approached monotonically", () => {
    for (const mouth of [D34, D44]) {
      const frames = drive(label({ mouthFunnel: 0.6 }, 90), mouth);
      let previous = 0;
      for (const pose of frames) {
        const value = pose[LIP] ?? 0;
        expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = value;
      }
    }
  });
});

describe("what the deadline must not touch", () => {
  it("leaves mouthClose and mouthPress identical in all three modes", () => {
    /** A 35 ms bilabial — the shortest closure this layer could have reached. */
    const closure = label({ mouthClose: 0.8, mouthPressLeft: 0.5, mouthPressRight: 0.5 }, 35);
    const current = drive(closure, PRE);
    for (const mouth of [D34, D44]) {
      const accelerated = drive(closure, mouth);
      expect(accelerated.map((p) => p.mouthClose)).toEqual(current.map((p) => p.mouthClose));
      expect(accelerated.map((p) => p.mouthPressLeft)).toEqual(current.map((p) => p.mouthPressLeft));
      expect(accelerated.map((p) => p.mouthPressRight)).toEqual(current.map((p) => p.mouthPressRight));
    }
  });

  it("leaves jaw CLOSING identical — Fix G's closeSpeed is untouched", () => {
    /**
     * Open the jaw with NO deadline on the opening frames (`remaining: null`),
     * so all three modes enter the closure from a bit-identical jaw, then demand
     * a return with no closure under the tightest deadline the runner can
     * produce. The returning frames travel at `closeSpeed = 9` and must do so in
     * every mode.
     *
     * The `remaining: null` lead is what makes this test about CLOSING. Letting
     * the opening frames accelerate too would hand each mode a different jaw and
     * the comparison would be measuring the opening it is not about.
     */
    const open: Frame[] = label({ jawOpen: 0.55 }, 120).map((frame) => ({ ...frame, remaining: null }));
    const close: Frame[] = label({ jawOpen: 0.02 }, 40);
    const run = [...open, ...close];
    const current = drive(run, PRE);
    for (const mouth of [D34, D44]) {
      expect(drive(run, mouth).map((p) => p.jawOpen)).toEqual(current.map((p) => p.jawOpen));
    }
  });

  it("leaves a seal frame's jaw identical — the contact event is exempt", () => {
    /**
     * `mouthClose` above `sealClosureThreshold` hands the jaw back to `openSpeed`
     * and the deadline stands down for the whole frame, so the jaw arrives at the
     * closure exactly as Fix G says it should.
     */
    const seal = label({ mouthClose: 0.8, jawOpen: 0.35 }, 35);
    const current = drive(seal, PRE);
    for (const mouth of [D34, D44]) {
      expect(drive(seal, mouth)).toEqual(current);
    }
  });

  it("accelerates jaw OPENING, which is the one jaw case that is eligible", () => {
    const opening = label({ jawOpen: 0.5 }, 40);
    const current = drive(opening, PRE).at(-1)!.jawOpen;
    expect(drive(opening, D34).at(-1)!.jawOpen).toBeGreaterThan(current);
    expect(drive(opening, D44).at(-1)!.jawOpen).toBeGreaterThan(current);
  });

  it("leaves the sentence settle identical — a pause owns no deadline", () => {
    /**
     * The settle runs at speed 11 toward the presence baseline. Driving it with
     * an aggressive remaining time in every mode must change nothing, on every
     * channel the settle may move.
     */
    const pause: Frame[] = Array.from({ length: 60 }, () => ({ target: {}, remaining: 0.01 }));
    const current = drive(pause, PRE, true);
    for (const mouth of [D34, D44]) {
      const accelerated = drive(pause, mouth, true);
      expect(accelerated).toEqual(current);
      for (const channel of MOUTH_SETTLE_CHANNELS) {
        expect(accelerated.map((p) => p[channel])).toEqual(current.map((p) => p[channel]));
      }
    }
  });

  it("leaves every non-mouth region identical", () => {
    const run = label({ browInnerUp: 0.5, eyeBlinkLeft: 0.9, cheekSquintLeft: 0.4 }, 30);
    const current = drive(run, PRE);
    for (const mouth of [D34, D44]) expect(drive(run, mouth)).toEqual(current);
  });
});
