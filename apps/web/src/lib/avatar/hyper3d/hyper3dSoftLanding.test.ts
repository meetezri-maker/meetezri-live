import { describe, expect, it } from "vitest";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import {
  DEADLINE_TOLERANCE,
  HYPER3D_DEADLINE_MAX_SPEEDS,
  HYPER3D_LANDING_EXPONENTS,
  MOUTH_SETTLE_CHANNELS,
  deadlineConvergenceSpeed,
  getMouthTransitionProfile,
  hyper3dDeadlineProfile,
  withMouthDeadline,
  withoutMouthDeadline,
  type MouthTransitionProfile,
} from "./engine/mappings/avatarBlendshapeConfig";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SOFT LANDING — §17's regression list, one `it` each.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The two that carry the most weight:
 *
 *   34 BASELINE IS UNCHANGED. Not "within a tolerance" — the same IEEE doubles
 *   over a driven sequence, because the landing arithmetic is not executed when
 *   no exponent is present.
 *
 *   THE CURVE IS CONTINUOUS. Asserted by scanning completion across the whole
 *   interval and bounding the step between adjacent samples, so a piecewise
 *   curve or a threshold could not pass.
 */

const DT = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;
/**
 * THE PRE-DEADLINE FOLLOWER. `PROFILE` now ships the accepted 34 SOFT deadline,
 * so the follower that predates the whole layer has to be asked for.
 */
const PRE = withoutMouthDeadline(PROFILE)!;
const CAP = HYPER3D_DEADLINE_MAX_SPEEDS.d34;
const BASE34 = withMouthDeadline(PROFILE, CAP)!;
const SOFT = withMouthDeadline(PROFILE, CAP, HYPER3D_LANDING_EXPONENTS.a)!;
const SOFT_B = withMouthDeadline(PROFILE, CAP, HYPER3D_LANDING_EXPONENTS.b)!;
const SOFT_C = withMouthDeadline(PROFILE, CAP, HYPER3D_LANDING_EXPONENTS.c)!;
const ALL_SOFT = [SOFT, SOFT_B, SOFT_C];

const LIP = "mouthFunnel";
/** A deadline tight enough that the cap binds, so assistance is always 10. */
const TIGHT = 0.03;

type Frame = { target: Record<string, number>; remaining: number | null };

function drive(frames: readonly Frame[], mouth: MouthTransitionProfile | undefined, settling = false) {
  const mixer = new FacialPoseMixer();
  const out: Array<Record<string, number>> = [];
  for (const frame of frames) {
    const mixed = mixer.combine([{ channel: "lipsync", pose: frame.target }] as never);
    out.push({ ...mixer.smooth(mixed.pose, DT, undefined, mouth, settling, frame.remaining) });
  }
  return out;
}

function label(target: Record<string, number>, ms: number): Frame[] {
  const seconds = ms / 1000;
  const frames: Frame[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    frames.push({ target: { ...target }, remaining: Math.max(0, seconds - t) });
  }
  return frames;
}

/** The landing weight the formula implies, recovered from the speed it returns. */
const weightAt = (completion: number, profile = SOFT.deadline!) => {
  const to = 0.8;
  const from = completion * to;
  const speed = deadlineConvergenceSpeed(LIP, from, to, 24, TIGHT, profile);
  return (speed - 24) / (CAP - 24);
};

describe("34 BASELINE is untouched", () => {
  const sequence: Frame[] = [
    ...label({ jawOpen: 0.45, mouthFunnel: 0.3, mouthStretchLeft: 0.2 }, 90),
    ...label({ mouthClose: 0.7, mouthPressLeft: 0.4, jawOpen: 0.05 }, 40),
    ...label({ jawOpen: 0.5, mouthSmileLeft: 0.45, mouthStretchRight: 0.5 }, 30),
    ...label({ mouthPucker: 0.6, mouthFunnel: 0.55, jawOpen: 0.2 }, 60),
    ...label({ jawOpen: 0.1, mouthRollLower: 0.3 }, 150),
  ];

  it("carries no landing exponent, so the landing arithmetic never runs", () => {
    expect(BASE34.deadline?.landingExponent).toBeUndefined();
    expect(PRE.deadline).toBeUndefined();
    /**
     * AND THE SHIPPED PROFILE IS NOT THE BASELINE ANY MORE. 34 SOFT was promoted
     * to production, so `PROFILE` carries cap 34 WITH the 0.5 landing — which is
     * what makes `BASE34` a departure from production rather than its default.
     */
    expect(PROFILE.deadline?.maxSpeed).toBe(34);
    expect(PROFILE.deadline?.landingExponent).toBe(0.5);
  });

  it("renders bit-identically with the landing parameter absent or null", () => {
    expect(drive(sequence, withMouthDeadline(PROFILE, CAP, null))).toEqual(drive(sequence, BASE34));
    expect(drive(sequence, withMouthDeadline(PROFILE, CAP, undefined))).toEqual(drive(sequence, BASE34));
  });

  it("treats a nonsense exponent as absent rather than honouring it", () => {
    /**
     * An exponent of 0 would make the weight identically 1 — a landing that is
     * not a landing — so it is refused at construction rather than applied.
     */
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
      const built = withMouthDeadline(PROFILE, CAP, bad)!;
      expect(built.deadline?.landingExponent).toBeUndefined();
      expect(drive(sequence, built)).toEqual(drive(sequence, BASE34));
    }
    expect(hyper3dDeadlineProfile(CAP, 0).landingExponent).toBeUndefined();
  });

  it("is a different cached object from every soft profile", () => {
    for (const soft of ALL_SOFT) expect(soft).not.toBe(BASE34);
    expect(withMouthDeadline(PROFILE, CAP, HYPER3D_LANDING_EXPONENTS.a)).toBe(SOFT);
    expect(withMouthDeadline(PROFILE, CAP, HYPER3D_LANDING_EXPONENTS.b)).toBe(SOFT_B);
  });
});

describe("the landing curve", () => {
  it("is 1 at zero completion and 0 at the target", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      expect(weightAt(0, profile)).toBeCloseTo(1, 10);
      expect(weightAt(1, profile)).toBeCloseTo(0, 10);
    }
  });

  it("decreases monotonically with completion — never rises", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      let previous = Infinity;
      for (let completion = 0; completion <= 1.0001; completion += 0.005) {
        const weight = weightAt(Math.min(1, completion), profile);
        expect(weight).toBeLessThanOrEqual(previous + 1e-12);
        previous = weight;
      }
    }
  });

  it("introduces no discontinuity of its own", () => {
    /**
     * A threshold or a piecewise knee would show up as a step between adjacent
     * samples. Scanned up to the TOLERANCE GATE — see the next test — because
     * that gate is the pre-existing §6 "arrive, then stop chasing" rule and not
     * part of this curve. Below it the steepest candidate is A, whose derivative
     * is -0.5/(1-c)^0.5 and so is bounded by 3.5 at the gate; sampling at 0.001
     * bounds every step under 0.005.
     */
    const to = 0.8;
    const gate = (to - DEADLINE_TOLERANCE) / to;
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      let previous = weightAt(0, profile);
      for (let completion = 0.001; completion < gate - 0.001; completion += 0.001) {
        const weight = weightAt(completion, profile);
        expect(Math.abs(weight - previous)).toBeLessThan(0.005);
        previous = weight;
      }
    }
  });

  it("SHRINKS the one discontinuity the system already had", () => {
    /**
     * THE TOLERANCE GATE, and it is worth stating plainly because the first
     * version of this test mistook it for a landing threshold.
     *
     * Deadline 34 already stops assisting the instant the remaining error falls
     * below the asset's visibility floor (`to - from > tolerance`). At that point
     * the baseline drops the full 10 units of assistance at once — a 34 -> 24 step
     * — which is the only discontinuity anywhere in the mechanism.
     *
     * The landing curve has already withdrawn most of the assistance by the time
     * that gate is reached, so the step it leaves is far smaller: measured at
     * 1.61 speed units for candidate A against the baseline's 10.0, an 84 %
     * reduction. The landing adds no threshold AND softens the inherited one.
     */
    /**
     * Measured as the LARGEST step over a scan rather than at a computed
     * boundary: `(to - tolerance) / to` is not exactly representable, so
     * sampling the boundary itself lands on whichever side the rounding chose
     * and would be asserting on a floating-point accident.
     */
    const maxStep = (profile: Parameters<typeof weightAt>[1]) => {
      let previous = weightAt(0, profile);
      let largest = 0;
      for (let completion = 0.0005; completion <= 1; completion += 0.0005) {
        const weight = weightAt(completion, profile);
        largest = Math.max(largest, Math.abs(weight - previous));
        previous = weight;
      }
      return largest;
    };

    // The baseline drops the whole of its assistance in one frame at the gate.
    const baselineStep = maxStep(BASE34.deadline!);
    expect(baselineStep).toBeCloseTo(1, 6);
    for (const soft of ALL_SOFT) expect(maxStep(soft.deadline!)).toBeLessThan(baselineStep);
    // Candidate A, the recommendation: under 2 of the 10 available speed units.
    expect(maxStep(SOFT.deadline!) * (CAP - 24)).toBeLessThan(2);
    // And the stronger curves leave less still, which is the ordering's point.
    expect(maxStep(SOFT_C.deadline!)).toBeLessThan(maxStep(SOFT.deadline!));
  });

  it("orders the three candidates as late, medium, early at every completion", () => {
    for (let completion = 0.05; completion < 1; completion += 0.05) {
      const a = weightAt(completion, SOFT.deadline!);
      const b = weightAt(completion, SOFT_B.deadline!);
      const c = weightAt(completion, SOFT_C.deadline!);
      expect(a).toBeGreaterThan(b);
      expect(b).toBeGreaterThan(c);
    }
  });

  it("matches the documented assistance at the measured completions", () => {
    // A = (1-c)^0.5, B = (1-c)^1, C = (1-c)^2 — the table in the config note.
    expect(weightAt(0.5, SOFT.deadline!)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(weightAt(0.5, SOFT_B.deadline!)).toBeCloseTo(0.5, 6);
    expect(weightAt(0.5, SOFT_C.deadline!)).toBeCloseTo(0.25, 6);
    expect(weightAt(0.85, SOFT.deadline!)).toBeCloseTo(Math.sqrt(0.15), 6);
    expect(weightAt(0.85, SOFT_B.deadline!)).toBeCloseTo(0.15, 6);
    expect(weightAt(0.85, SOFT_C.deadline!)).toBeCloseTo(0.0225, 6);
  });
});

describe("the soft landing only ever removes assistance", () => {
  it("never reduces the baseline follower speed", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      for (const baseline of [9, 11, 24, 28, 48]) {
        for (const remaining of [0.004, 0.01, 0.03, 0.08, 0.2, 1]) {
          for (let completion = 0; completion <= 0.999; completion += 0.05) {
            const to = 0.8;
            const speed = deadlineConvergenceSpeed(LIP, completion * to, to, baseline, remaining, profile);
            expect(speed).toBeGreaterThanOrEqual(baseline);
          }
        }
      }
    }
  });

  it("never exceeds 34, and never exceeds the unlanded speed", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      for (const remaining of [0.002, 0.01, 0.03, 0.06, 0.09, 0.2]) {
        for (let completion = 0; completion <= 0.999; completion += 0.02) {
          const to = 0.8;
          const from = completion * to;
          const landed = deadlineConvergenceSpeed(LIP, from, to, 24, remaining, profile);
          const unlanded = deadlineConvergenceSpeed(LIP, from, to, 24, remaining, BASE34.deadline!);
          expect(landed).toBeLessThanOrEqual(CAP + 1e-12);
          expect(landed).toBeLessThanOrEqual(unlanded + 1e-12);
        }
      }
    }
  });

  it("leaves a long label that needs no acceleration exactly as it was", () => {
    /**
     * Above the 96 ms crossover the unlanded speed is already the baseline, so
     * there is no assistance for a landing curve to withdraw and every mode must
     * render identically — including the pre-deadline follower.
     */
    const long = label({ mouthFunnel: 0.6, jawOpen: 0.4 }, 300);
    const reference = drive(long, PRE);
    expect(drive(long, BASE34)).toEqual(reference);
    for (const soft of ALL_SOFT) expect(drive(long, soft)).toEqual(reference);
  });
});

describe("§6 — the landing must not give back the completion 34 bought", () => {
  it("still converges further than the pre-deadline follower on a short label", () => {
    const short = label({ mouthFunnel: 0.6 }, 40);
    const pre = drive(short, PRE).at(-1)![LIP];
    const base = drive(short, BASE34).at(-1)![LIP];
    for (const soft of ALL_SOFT) {
      const landed = drive(short, soft).at(-1)![LIP];
      expect(landed).toBeGreaterThan(pre);
      expect(landed).toBeLessThan(base);
    }
  });

  it("keeps full assistance at the start of a fresh excursion", () => {
    /**
     * This is what preserves the short-phone gain: a channel starting from rest
     * is at completion 0, so the landing weight is 1 and the first frames are the
     * baseline's own. The landing only acts later, which is the whole design.
     */
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      expect(deadlineConvergenceSpeed(LIP, 0, 0.6, 24, TIGHT, profile)).toBe(CAP);
      expect(deadlineConvergenceSpeed("jawOpen", 0, 0.5, 24, TIGHT, profile)).toBe(CAP);
    }
  });
});

describe("safety", () => {
  it("is safe for a tiny requested excursion", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      // Just past the tolerance gate: the smallest excursion that can accelerate.
      const to = DEADLINE_TOLERANCE * 2;
      for (const from of [0, DEADLINE_TOLERANCE * 0.5, DEADLINE_TOLERANCE * 0.9]) {
        const speed = deadlineConvergenceSpeed(LIP, from, to, 24, TIGHT, profile);
        expect(Number.isFinite(speed)).toBe(true);
        expect(speed).toBeGreaterThanOrEqual(24);
        expect(speed).toBeLessThanOrEqual(CAP);
      }
      // And below the gate there is no acceleration to land at all.
      expect(deadlineConvergenceSpeed(LIP, 0, DEADLINE_TOLERANCE, 24, TIGHT, profile)).toBe(24);
    }
  });

  it("is safe for zero, negative and non-finite remaining time", () => {
    for (const profile of ALL_SOFT.map((p) => p.deadline!)) {
      for (const remaining of [0, -0, -0.01, NaN, Infinity, -Infinity]) {
        const speed = deadlineConvergenceSpeed(LIP, 0.2, 0.6, 24, remaining, profile);
        expect(Number.isFinite(speed)).toBe(true);
        expect(speed).toBeGreaterThanOrEqual(24);
        expect(speed).toBeLessThanOrEqual(CAP);
      }
    }
    for (const soft of ALL_SOFT) {
      const frames: Frame[] = [
        { target: { [LIP]: 0.6 }, remaining: 0 },
        { target: { [LIP]: 0.6 }, remaining: NaN },
        { target: { [LIP]: 0.6 }, remaining: -1 },
        { target: { [LIP]: 0.6 }, remaining: Infinity },
      ];
      for (const pose of drive(frames, soft)) {
        for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("never overshoots the target", () => {
    for (const soft of ALL_SOFT) {
      for (const ms of [20, 25, 30, 40, 60, 90, 150]) {
        for (const value of [0.05, 0.15, 0.4, 0.75, 1]) {
          for (const pose of drive(label({ mouthFunnel: value }, ms), soft)) {
            expect(pose[LIP] ?? 0).toBeLessThanOrEqual(value + 1e-12);
          }
        }
      }
    }
  });

  it("does not oscillate — a held target is approached monotonically", () => {
    for (const soft of ALL_SOFT) {
      for (const ms of [30, 60, 90, 200]) {
        let previous = 0;
        for (const pose of drive(label({ mouthFunnel: 0.6 }, ms), soft)) {
          const value = pose[LIP] ?? 0;
          expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
          previous = value;
        }
      }
    }
  });

  it("creates no frozen or stair-step pose — every frame still advances", () => {
    /**
     * §15 criterion 10. The landing withdraws assistance, it never withdraws the
     * baseline follower, so a channel short of its target must still close a
     * fixed share of the remaining distance on every frame. A frozen value would
     * show up here as a zero step while error remained.
     */
    for (const soft of ALL_SOFT) {
      const frames = drive(label({ mouthFunnel: 0.6 }, 200), soft);
      const alpha24 = 1 - Math.exp(-24 * DT);
      let previous = 0;
      for (const pose of frames) {
        const value = pose[LIP] ?? 0;
        const error = 0.6 - previous;
        if (error > 1e-6) expect(value - previous).toBeGreaterThanOrEqual(error * alpha24 - 1e-9);
        previous = value;
      }
    }
  });
});

describe("what the landing must not touch", () => {
  it("leaves mouthClose and mouthPress identical", () => {
    const closure = label({ mouthClose: 0.8, mouthPressLeft: 0.5, mouthPressRight: 0.5 }, 35);
    const reference = drive(closure, BASE34);
    for (const soft of ALL_SOFT) {
      const run = drive(closure, soft);
      for (const channel of ["mouthClose", "mouthPressLeft", "mouthPressRight"]) {
        expect(run.map((p) => p[channel])).toEqual(reference.map((p) => p[channel]));
      }
    }
  });

  it("leaves jaw CLOSING identical", () => {
    const open: Frame[] = label({ jawOpen: 0.55 }, 120).map((frame) => ({ ...frame, remaining: null }));
    const run = [...open, ...label({ jawOpen: 0.02 }, 40)];
    const reference = drive(run, BASE34);
    for (const soft of ALL_SOFT) {
      expect(drive(run, soft).map((p) => p.jawOpen)).toEqual(reference.map((p) => p.jawOpen));
    }
  });

  it("leaves a seal frame identical — the exemption is unchanged", () => {
    const seal = label({ mouthClose: 0.8, jawOpen: 0.35 }, 35);
    const reference = drive(seal, BASE34);
    for (const soft of ALL_SOFT) expect(drive(seal, soft)).toEqual(reference);
  });

  it("leaves the sentence settle identical", () => {
    const pause: Frame[] = Array.from({ length: 60 }, () => ({ target: {}, remaining: 0.01 }));
    const reference = drive(pause, BASE34, true);
    for (const soft of ALL_SOFT) {
      const run = drive(pause, soft, true);
      expect(run).toEqual(reference);
      for (const channel of MOUTH_SETTLE_CHANNELS) {
        expect(run.map((p) => p[channel])).toEqual(reference.map((p) => p[channel]));
      }
    }
  });

  it("leaves every non-mouth region identical", () => {
    const run = label({ browInnerUp: 0.5, eyeBlinkLeft: 0.9, cheekSquintLeft: 0.4 }, 30);
    const reference = drive(run, BASE34);
    for (const soft of ALL_SOFT) expect(drive(run, soft)).toEqual(reference);
  });

  it("leaves the accepted follower constants alone", () => {
    expect(PROFILE.lipShapeSpeed).toBe(24);
    expect(PROFILE.openSpeed).toBe(24);
    expect(PROFILE.closeSpeed).toBe(9);
    expect(PROFILE.sealClosureThreshold).toBe(0.5);
    expect(PROFILE.settle?.speed).toBe(11);
    expect(HYPER3D_DEADLINE_MAX_SPEEDS.d34).toBe(34);
    expect(HYPER3D_LANDING_EXPONENTS).toEqual({ a: 0.5, b: 1, c: 2 });
    // The cap is 34 in every soft mode: a landing curve cannot raise a ceiling.
    for (const soft of ALL_SOFT) expect(soft.deadline?.maxSpeed).toBe(34);
  });
});
