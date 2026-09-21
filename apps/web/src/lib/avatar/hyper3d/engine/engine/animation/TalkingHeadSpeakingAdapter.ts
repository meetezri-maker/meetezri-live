/**
 * TALKINGHEAD SPEAKING BEHAVIOUR — adapted from met4citizen/TalkingHead.
 *
 * Upstream: https://github.com/met4citizen/TalkingHead
 * Commit:   eed58d198076a7e1e825f804802921c4d3804d46 (2026-06-02)
 * File:     modules/talkinghead.mjs
 * Licence:  MIT — Copyright (c) 2023-2024 Mika Suominen
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * ---------------------------------------------------------------------------
 *
 * WHAT THIS IS. A faithful reproduction of the parts of `talkinghead.mjs` that
 * produce SPEAKING HEAD, NECK AND EYE motion, so the two architectures can be
 * compared on hardware with everything else held identical. It is deliberately
 * not an improvement, not a merge with our controllers, and not inspired-by.
 *
 * THE HEADLINE FINDING, and the reason this is worth testing: upstream's
 * speaking head movement **is not driven by speech content at all**. There is no
 * word timing, no phoneme timing, no prosody and no emphasis anywhere in the
 * head path. It is a template-driven random scheduler:
 *
 *   `animMoods[mood].anims[{name:'head'}].speaking`
 *     dt: [[0,1000,0]]                      -> a new target every 1000 ms
 *     bodyRotateX: [[-0.05,0.15,1,2]]       -> gaussian random target
 *     bodyRotateY: [[-0.1,0.1]]
 *     bodyRotateZ: [[-0.1,0.1]]
 *
 * Everything that makes it read as connected to speech comes from two places:
 * the SIGMOID interpolation between those random targets, and the EYE CONTACT
 * mechanism, which derives eye direction from the live head quaternion so the
 * eyes counter-rotate to hold the camera. Head and gaze are one system because
 * the gaze is computed FROM the head, not scheduled alongside it.
 *
 * Reproduced here, section by section, with the upstream location noted:
 *
 *   `gaussianRandom`        L2371   exact
 *   `sigmoidFactory`        L2384   exact
 *   `animFactory`           L2227   the head/eyes/headmove subset
 *   animate() anim loop     L2487   index advance + sigmoid value blend
 *   speaking amplitude 1/4  L2557   `k = isSpeaking && head|eyes ? 4 : 1`
 *   eyeContact / headMove   L2639   including the head-quaternion eye solve
 *   `updateMorphTargets`    L1727   exponential smoother with acc / maxv
 *   bone mapping            L1778   bodyRotate -> Head + Spine1/Spine/Hips
 *
 * DELIBERATE DEVIATIONS, all documented again in the report:
 *
 *   SEEDED RNG. Upstream calls `Math.random()`. A reproducible A/B and any test
 *   at all need determinism, so the same distributions are drawn from a seeded
 *   stream. Same shapes, same rates, different sequence.
 *
 *   TWO BONES. Upstream spreads `bodyRotate*` over Head, Spine1, Spine, Hips and
 *   both legs. Our asset has usable Head and Neck only — P17 measured the
 *   clavicle and upper-arm chain as carrying no usable skin weight — so the
 *   Spine1 share maps to our Neck and the rest is dropped. Nothing is faked.
 *
 *   NO LISTENING ANALYSER. `volumeHeadCurrent` (L2700) is driven by a live
 *   microphone FFT. We play back a rendered audio file, so upstream's own guard
 *   (`vol` is only assigned inside `if (this.isListening)`) leaves it at zero.
 *   Reproducing it would mean inventing an input upstream does not have here.
 */

/** Upstream L2371, verbatim. Note `skew: 0` makes this return `end` exactly. */
export const gaussianRandom = (
  random: () => number,
  start: number,
  end: number,
  skew = 1,
  samples = 5
): number => {
  let r = 0;
  for (let i = 0; i < samples; i += 1) r += random();
  return start + Math.pow(r / samples, skew) * (end - start);
};

/** Upstream L2384, verbatim. `sigmoidFactory(5)` is the default morph easing. */
export const sigmoidFactory = (k: number) => {
  const base = (t: number) => 1 / (1 + Math.exp(-k * t)) - 0.5;
  const corr = 0.5 / base(1);
  return (t: number) => corr * base(2 * Math.max(Math.min(t, 1), 0) - 1) + 0.5;
};

/**
 * Deterministic stand-in for `Math.random()`. See DELIBERATE DEVIATIONS.
 * mulberry32 — small, well-distributed, and self-contained.
 */
const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A value slot in a template: a constant, a `[start,end,skew?,samples?]` draw, or null. */
type TemplateValue = number | number[] | null;

interface AnimTemplate {
  name: string;
  delay?: number | number[];
  dt?: TemplateValue[];
  vs: Record<string, TemplateValue[]>;
}

interface ActiveAnim {
  name: string;
  ts: number[];
  vs: Record<string, (number | null)[]>;
  ndx: number;
  loop: boolean;
  /** The state this instance was built for, so a loop rebuilds under the current one. */
  builtFor: "idle" | "speaking";
}

/**
 * Upstream `animMoods.neutral.anims[{name:'head'}]`, L432-433, verbatim.
 *
 * The `neutral` mood is used because our §P17 director owns emotional
 * character; borrowing upstream's mood table as well would confound the
 * experiment with a second expression system.
 */
const HEAD_TEMPLATE = {
  idle: {
    name: "head",
    delay: [0, 1000],
    dt: [[200, 5000]],
    vs: { bodyRotateX: [[-0.04, 0.10]], bodyRotateY: [[-0.3, 0.3]], bodyRotateZ: [[-0.08, 0.08]] }
  } satisfies AnimTemplate,
  speaking: {
    name: "head",
    dt: [[0, 1000, 0]],
    vs: { bodyRotateX: [[-0.05, 0.15, 1, 2]], bodyRotateY: [[-0.1, 0.1]], bodyRotateZ: [[-0.1, 0.1]] }
  } satisfies AnimTemplate
};

/** Upstream `animTemplateEyes`, L377-411, verbatim. */
interface EyesAlt { p: number | undefined; template: AnimTemplate }
const EYES_TEMPLATE: { idle: EyesAlt[]; speaking: EyesAlt[] } = {
  idle: [
    {
      p: 0.2, // opt.avatarIdleEyeContact
      template: {
        name: "eyes",
        delay: [200, 5000],
        dt: [200, [2000, 5000], [3000, 10000, 1, 2]],
        vs: {
          headMove: [0.5], // opt.avatarIdleHeadMove
          eyesRotateY: [[-0.6, 0.6]], eyesRotateX: [[-0.2, 0.6]],
          eyeContact: [null, 1]
        }
      }
    },
    {
      p: undefined,
      template: {
        name: "eyes",
        delay: [200, 5000],
        dt: [200, [2000, 5000, 1, 2]],
        vs: {
          headMove: [0.5],
          eyesRotateY: [[-0.6, 0.6]], eyesRotateX: [[-0.2, 0.6]]
        }
      }
    }
  ],
  speaking: [
    {
      p: 0.5, // opt.avatarSpeakingEyeContact
      template: {
        name: "eyes",
        delay: [200, 5000],
        dt: [0, [3000, 10000, 1, 2], [2000, 5000]],
        vs: {
          eyeContact: [1, null],
          headMove: [null, 0.5, null], // opt.avatarSpeakingHeadMove
          eyesRotateY: [null, [-0.6, 0.6]], eyesRotateX: [null, [-0.2, 0.6]]
        }
      }
    },
    {
      p: undefined,
      template: {
        name: "eyes",
        delay: [200, 5000],
        dt: [200, [2000, 5000, 1, 2]],
        vs: {
          headMove: [0.5, null],
          eyesRotateY: [[-0.6, 0.6]], eyesRotateX: [[-0.2, 0.6]]
        }
      }
    }
  ]
};

/** The morph-target slots this adapter tracks. Upstream L693-722 for the limits. */
const TRACKED = [
  "bodyRotateX", "bodyRotateY", "bodyRotateZ",
  "headRotateX", "headRotateY", "headRotateZ",
  "eyesLookDown", "eyesLookUp",
  "eyeLookInLeft", "eyeLookOutLeft", "eyeLookInRight", "eyeLookOutRight"
] as const;
type TrackedName = (typeof TRACKED)[number];

const MIN: Partial<Record<TrackedName, number>> = {
  bodyRotateX: -1, bodyRotateY: -1, bodyRotateZ: -1,
  headRotateX: -1, headRotateY: -1, headRotateZ: -1
};
const MAX_V: Partial<Record<TrackedName, number>> = {
  bodyRotateX: 1, bodyRotateY: 1, bodyRotateZ: 1
};
const ACC_EXCEPTIONS: Partial<Record<TrackedName, number>> = {
  eyeLookOutLeft: 0.1, eyeLookInLeft: 0.1, eyeLookOutRight: 0.1, eyeLookInRight: 0.1
};
const ACC_DEFAULT = 0.01;     // upstream mtAccDefault, rad/s^2
const MAX_V_DEFAULT = 5;      // upstream mtMaxVDefault, rad/s

interface Slot {
  value: number;
  newvalue: number | null;
  v: number;
  min: number;
  max: number;
  acc: number;
  maxv: number;
}

export interface TalkingHeadTuning {
  id: string;
  label: string;
  /**
   * Multiplier on the FINAL bone rotation only.
   *
   * Applied after the whole upstream pipeline, so timing, distribution, easing
   * and the eye solve are untouched — `MAX` shows the same motion larger, which
   * is the only thing amplitude scaling is allowed to do in this experiment.
   */
  amplitude: number;
  /** Frames per second upstream assumes, for its dt clamp. Upstream default 30. */
  modelFps: number;
  /**
   * HYBRID. Multiplier on how fast the trajectory EVOLVES. 1 is upstream.
   *
   * Applied by dividing every drawn `dt` — the speaking head template's fixed
   * 1000 ms cadence becomes 1000/cadence. Shapes, distributions, easing and
   * amplitude are all untouched, so this is the same motion played through
   * sooner, not a different motion.
   *
   * Note honestly: a shorter cadence means more segments per minute, so the
   * direction-reversal RATE rises roughly in proportion. That is arithmetic, not
   * a defect, and it is measured rather than hidden.
   */
  cadence: number;
  /**
   * HYBRID. When true the carrier accepts speech modulation; when false it runs
   * as the pure upstream reproduction, which stays available as the A/B base.
   */
  hybrid: boolean;
  /**
   * CENTRE FIX. How much of the evolving speaking rest is applied, 0 = upstream.
   *
   * Upstream draws `bodyRotate*` from ranges CENTRED ON ZERO and applies them as
   * ABSOLUTE angles — the yaw range is exactly symmetric — so the carrier's own
   * time-average is pinned at global centre and every stroke is a departure from
   * and a return toward the same point. Measured on the locked 1.30x clip: 5
   * approaches into the centre band, 8.1 per minute. Nothing dwells there, which
   * is why it reads as "completes an animation and comes home" rather than as a
   * freeze.
   *
   * The rest is a slow low-pass of the carrier itself, so the head's home moves
   * with where it has actually been. Deterministic, bounded by construction (an
   * average of a bounded signal) and clamped again, evolving over seconds, and
   * never reset by a cadence sample.
   */
  restStrength: number;
  restTimeConstantSeconds: number;
  restLimitDegrees: number;
  /**
   * GAZE FIX. Probability that a speaking eyes cycle uses the eye-contact
   * branch. Upstream's `avatarSpeakingEyeContact`, default 0.5.
   *
   * Measured: head/gaze correlation is -0.985 while eye contact is active and
   * -0.227 while it is not, and it is active only 48 % of the time. So half the
   * clip has near-perfect head-derived gaze and half has none — which is exactly
   * "head and gaze do not fully read as one physical performance", and it is a
   * probability rather than an architecture.
   */
  eyeContactProbability: number;
  /**
   * MULTIPLIER on upstream's headmove probability. 1 is upstream.
   *
   * It has to move with `eyeContactProbability`: the headmove roll lives inside
   * the eye-contact branch, so raising eye contact also raises how often a
   * headmove — a large deliberate gesture — fires.
   *
   * A MULTIPLIER, not a replacement, and that distinction is load-bearing.
   * Upstream's `scaleValue` multiplies every `vs` entry, `headMove` included, so
   * the quarter restraint applied to head and eyes while speaking ALSO quarters
   * the headmove probability: the effective value is 0.5 x 0.25 = 0.125, not
   * 0.5. Replacing it with a literal 0.5 quadrupled the headmove rate and moved
   * the locked carrier's max jerk from 378 to 992 and its pitch range from 2.34
   * to 4.44 deg — a change to the one configuration that must not change.
   */
  headMoveRateScale: number;
  /**
   * Amplitude scale on the pushed `headmove` gesture. 1 is upstream.
   *
   * MUST default to 1: the locked 1.30x carrier is the hardware-approved
   * baseline and has to stay bit-identical to it. Applying the quarter restraint
   * everywhere moved locked's max jerk from 374 to 421 and its reversal rate from
   * 16.1 to 21 — a small change, but a change to the one configuration that is
   * not allowed to change.
   */
  headMoveScale: number;
  /**
   * Multiplier on the eye-contact solve. 1 is upstream.
   *
   * Perfect counter-rotation reads as mechanical, so the target is the brief's
   * 70-90 % band measured in RENDERED eye degrees — the value the eyeball
   * actually turns, after `eyeGeometry.gazeScale`.
   */
  gazeCompensationScale: number;
  /** First-order lag on the eyes, in seconds. Eyes settle after the head. */
  gazeLagSeconds: number;
}

export const talkingHeadTunings = {
  native: { id: "native", label: "TalkingHead", amplitude: 1, modelFps: 30, cadence: 1, hybrid: false, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },
  faster: { id: "faster", label: "TalkingHead 1.15x", amplitude: 1, modelFps: 30, cadence: 1.15, hybrid: false, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },
  fastest: { id: "fastest", label: "TalkingHead 1.30x", amplitude: 1, modelFps: 30, cadence: 1.3, hybrid: false, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },
  max: { id: "max", label: "TalkingHead MAX", amplitude: 2.6, modelFps: 30, cadence: 1, hybrid: false, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },
  /**
   * The hybrid ships at 1.15x.
   *
   * The middle of the three tested cadences: the hardware note was "slightly too
   * slow", and 1.30x raises the reversal rate by about a third purely as
   * arithmetic. 1.15x is the smaller step, and the A/B buttons for all three
   * remain so the choice can be revisited on hardware rather than argued here.
   */
  hybrid: { id: "hybrid", label: "TalkingHead hybrid", amplitude: 1, modelFps: 30, cadence: 1.15, hybrid: true, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },

  /**
   * THE LOCKED CARRIER. 1.30x, exactly as hardware approved it.
   *
   * Identical to `fastest`; a separate id so the approved configuration has a
   * name of its own and the two fixes below can be compared against it without
   * anyone having to remember which cadence was blessed.
   */
  locked: { id: "locked", label: "TalkingHead 1.30x locked", amplitude: 1, modelFps: 30, cadence: 1.3, hybrid: false, restStrength: 0, restTimeConstantSeconds: 6, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },

  /** The locked carrier plus the evolving speaking rest. Nothing else changes. */
  centerFix: { id: "centerFix", label: "TalkingHead centre fix", amplitude: 1, modelFps: 30, cadence: 1.3, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.5, headMoveRateScale: 1, headMoveScale: 1, gazeCompensationScale: 1, gazeLagSeconds: 0 },

  /** Both fixes: the evolving rest, and head-derived gaze made dominant. */
  centerGazeFix: { id: "centerGazeFix", label: "TalkingHead centre + gaze fix", amplitude: 1, modelFps: 30, cadence: 1.3, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },

  /**
   * THE FINAL CADENCE SWEEP.
   *
   * Hardware accepted CENTER + GAZE and asked for one thing: more speed. These
   * four are BYTE-IDENTICAL to `centerGazeFix` apart from `cadence`, which is
   * why they are written out in full rather than spread from it — a reader can
   * diff them and see that only one number moves.
   *
   * `thFinal13` is `centerGazeFix` under its review name, so the approved
   * configuration is the baseline of its own sweep.
   *
   * Cadence divides the drawn `dt` AFTER the draw, so the target sequence is
   * bit-identical at every speed and only the time spent travelling to each
   * target changes. No rotation and no velocity is multiplied anywhere.
   */
  thFinal13: { id: "thFinal13", label: "TH FINAL 1.30x", amplitude: 1, modelFps: 30, cadence: 1.3, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal14: { id: "thFinal14", label: "TH FINAL 1.40x", amplitude: 1, modelFps: 30, cadence: 1.4, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal15: { id: "thFinal15", label: "TH FINAL 1.50x", amplitude: 1, modelFps: 30, cadence: 1.5, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal16: { id: "thFinal16", label: "TH FINAL 1.60x LOCKED", amplitude: 1, modelFps: 30, cadence: 1.6, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },

  /**
   * MICRO SPEED TUNING on the locked 1.60x.
   *
   * Hardware called 1.60x near perfect and asked only for slightly faster head
   * movement. These three are the same performance played sooner: every field
   * below is copied from `thFinal16` and only `cadence` moves. They are written
   * out in full rather than spread from it so the difference is visible in a
   * diff, and `p27FinalMicroSpeed.test.ts` compares every field programmatically
   * so a future edit cannot quietly widen the gap.
   */
  thFinal165: { id: "thFinal165", label: "TH FINAL 1.65x", amplitude: 1, modelFps: 30, cadence: 1.65, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal170: { id: "thFinal170", label: "TH FINAL 1.70x", amplitude: 1, modelFps: 30, cadence: 1.7, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal175: { id: "thFinal175", label: "TH FINAL 1.75x", amplitude: 1, modelFps: 30, cadence: 1.75, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  /**
   * PRESENCE PASS cadence ladder for Hyper3D.
   *
   * Hardware review found the movement QUALITY good at 1.75x, but judged the
   * speed slightly slow on this asset. These three are byte-identical to
   * `thFinal175` in every field except one — same amplitude, same rest and time
   * constant, same eye-contact probability, same headMoveRateScale, same gaze
   * compensation and lag, same interpolation. Nothing about the movement design,
   * the centre behaviour or the yaw/pitch/roll distribution differs, so an A/B
   * between them isolates speed and nothing else.
   */
  /** LOCKED — the accepted Hyper3D carrier. See hyper3dAcceptedBaseline.test.ts. */
  thFinal190: { id: "thFinal190", label: "TH FINAL 1.90x", amplitude: 1, modelFps: 30, cadence: 1.9, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal200: { id: "thFinal200", label: "TH FINAL 2.00x", amplitude: 1, modelFps: 30, cadence: 2, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 },
  thFinal210: { id: "thFinal210", label: "TH FINAL 2.10x", amplitude: 1, modelFps: 30, cadence: 2.1, hybrid: false, restStrength: 0.85, restTimeConstantSeconds: 2, restLimitDegrees: 0.8, eyeContactProbability: 0.85, headMoveRateScale: 0.59, headMoveScale: 1, gazeCompensationScale: 1.05, gazeLagSeconds: 0.09 }
} satisfies Record<string, TalkingHeadTuning>;

/**
 * HYBRID — how strongly the sentence is being delivered right now.
 *
 * Deliberately scalar. The modulator says HOW MUCH; only the carrier knows which
 * way its head is already travelling, so the carrier resolves direction itself.
 * That factoring is what makes it structurally impossible for an emphasis to
 * start a nod: a bias that is always sign-aligned with the motion already
 * underway can lengthen or deepen a stroke, and can never reverse one.
 */
export interface CarrierModulation {
  /** 0-1 shared intention strength, from the speech performance plan. */
  emphasis: number;
  /** 0-1 pause damping. Slows the trajectory's evolution; never freezes it. */
  damping: number;
  /** Multiplier on eye-contact strength. */
  gazeCommitment: number;
}

export const neutralModulation: CarrierModulation = { emphasis: 0, damping: 0, gazeCommitment: 1 };

/**
 * Bounds on what the semantic layer may do to the carrier.
 *
 * The brief's starting limits. They exist to keep modulation subordinate: the
 * head is already moving because the carrier is moving, and speech is only
 * allowed to shape that.
 */
export const modulationLimits = {
  /** Fractional amplitude change at full emphasis. */
  gain: 0.12,
  /** Degrees of pitch bias at full emphasis, applied ALONG the current stroke. */
  pitchBiasDegrees: 0.4,
  yawBiasDegrees: 0.25,
  /** How much of the clock advance a full pause removes. Never all of it. */
  pauseSlowdown: 0.55,
  /** Amplitude reduction at full pause damping. */
  pauseGain: 0.25,
  /** Velocity scale for the stroke-direction `tanh`. Saturates above this. */
  directionDeadZone: 0.0006,
  /** How fast the stroke direction may change, in seconds. Bounds the bias slew. */
  directionTimeConstant: 0.3,
  /** Slew limit on the applied bias, in seconds. */
  biasTimeConstant: 0.35,
  /** How fast the gain-modulated pose leaks back toward the raw carrier. */
  gainLeakSeconds: 2.5
};

export type TalkingHeadTuningId = keyof typeof talkingHeadTunings;

export interface TalkingHeadOutput {
  /** Head rotation in RADIANS: pitch (x), yaw (y), roll (z). */
  head: { pitch: number; yaw: number; roll: number };
  /** Neck rotation in RADIANS. Upstream's Spine1 share; see DELIBERATE DEVIATIONS. */
  neck: { pitch: number; yaw: number; roll: number };
  /**
   * Eye direction, normalised to [-1,1] the way upstream's morphs are. The
   * owner scales these to its own gaze envelope in degrees.
   */
  gaze: { yaw: number; pitch: number };
  debug: {
    clockMs: number;
    state: "idle" | "speaking";
    eyeContact: boolean;
    headMoveQueued: boolean;
    activeAnims: string[];
    bodyRotateX: number;
    bodyRotateY: number;
    headRotateX: number;
    headRotateY: number;
    /** HYBRID readout. */
    cadence: number;
    emphasis: number;
    gain: number;
    pitchBiasDegrees: number;
    yawBiasDegrees: number;
    damping: number;
    strokePitchSign: number;
    strokeYawSign: number;
    /** CENTRE / GAZE FIX readout. */
    restPitchDegrees: number;
    restYawDegrees: number;
    eyeContactProbability: number;
    drawnTargetX: number;
    drawnTargetY: number;
  };
}

const EPS = 1e-6;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampUnit = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);
const DEG_TO_RAD = Math.PI / 180;

/**
 * The adapter.
 *
 * One instance owns the upstream animation queue, the morph-target slots and
 * the animation clock. It writes no bone and no morph itself — like the rest of
 * our speaking controllers it returns a pose for the existing owners to compose.
 */
export class TalkingHeadSpeakingAdapter {
  private random: () => number;
  private easing = sigmoidFactory(5);            // upstream mtEasingDefault
  private animClock = 0;                          // upstream animClock, ms
  private queue: ActiveAnim[] = [];
  private slots = new Map<TrackedName, Slot>();
  private state: "idle" | "speaking" = "idle";
  private eyeContact = false;
  private headMoveQueued = false;
  private seed: number;
  private releasing = false;
  /** HYBRID. Set from the tuning each frame, read by `animFactory`. */
  private cadence = 1;
  private modulation: CarrierModulation = { ...neutralModulation };
  /** Previous frame's composed head, for the carrier's own direction. */
  private previousHead = { pitch: 0, yaw: 0, roll: 0 };
  /** The gain-integrated pose, and the carrier delta it integrates. */
  private modulatedPose = { pitch: 0, yaw: 0, roll: 0 };
  private previousCarrier = { pitch: 0, yaw: 0, roll: 0 };
  private modulatedInit = false;
  private appliedBias = { pitch: 0, yaw: 0 };
  /** The head segment's drawn destination, for the cadence amplitude proof. */
  private drawnTarget = { x: 0, y: 0 };
  /** CENTRE FIX. The slowly evolving speaking rest, in radians. */
  private rest = { pitch: 0, yaw: 0, roll: 0 };
  private restFast = { pitch: 0, yaw: 0, roll: 0 };
  private restBaseline = { pitch: 0, yaw: 0, roll: 0 };
  /** GAZE FIX. The lagged eye output. */
  private laggedGaze = { yaw: 0, pitch: 0 };
  private tuning: TalkingHeadTuning | null = null;
  /**
   * Stroke direction per axis, CONTINUOUS in [-1,1].
   *
   * A hard sign was the first version and it was badly wrong: the bias is
   * `sign * emphasis * 0.4 deg`, so every time the carrier's velocity crossed
   * zero the bias stepped by up to 0.8 deg in one frame. Measured on the
   * composed bone that took max jerk from the carrier's 319 to 13,506 deg/s^3 —
   * the modulation was producing exactly the mechanical snap this whole
   * direction of work exists to avoid.
   *
   * `tanh` of the normalised velocity saturates to +/-1 for any real stroke but
   * passes smoothly through zero, and a time constant on top means the bias can
   * never slew faster than the stroke itself. The lag also gives the brief's
   * `directionPersistence` for free: for a moment after the carrier turns, the
   * bias still favours the old direction, so strokes are gently encouraged to
   * continue rather than to flip.
   */
  private strokeDir = { pitch: 0, yaw: 0 };
  private lastModulationDebug = { gain: 1, pitchBias: 0, yawBias: 0, damping: 0 };

  constructor(seed: string | number = "talkinghead") {
    this.seed = typeof seed === "number" ? seed : hashSeed(seed);
    this.random = makeRandom(this.seed);
    this.resetSlots();
  }

  private resetSlots() {
    this.slots.clear();
    for (const name of TRACKED) {
      this.slots.set(name, {
        value: 0, newvalue: null, v: 0,
        min: MIN[name] ?? 0,
        max: 1,
        acc: ACC_EXCEPTIONS[name] ?? ACC_DEFAULT,
        maxv: MAX_V[name] ?? MAX_V_DEFAULT
      });
    }
  }

  /**
   * Full reset. Called on mode switch and on seek so no bone state, queue entry
   * or clock offset can survive into the next run.
   */
  reset(seed: string | number = this.seed) {
    this.seed = typeof seed === "number" ? seed : hashSeed(seed);
    this.random = makeRandom(this.seed);
    this.animClock = 0;
    this.queue = [];
    this.state = "idle";
    this.eyeContact = false;
    this.headMoveQueued = false;
    this.releasing = false;
    this.previousHead = { pitch: 0, yaw: 0, roll: 0 };
    this.strokeDir = { pitch: 0, yaw: 0 };
    this.modulatedPose = { pitch: 0, yaw: 0, roll: 0 };
    this.previousCarrier = { pitch: 0, yaw: 0, roll: 0 };
    this.modulatedInit = false;
    this.appliedBias = { pitch: 0, yaw: 0 };
    this.drawnTarget = { x: 0, y: 0 };
    this.rest = { pitch: 0, yaw: 0, roll: 0 };
    this.restFast = { pitch: 0, yaw: 0, roll: 0 };
    this.restBaseline = { pitch: 0, yaw: 0, roll: 0 };
    this.laggedGaze = { yaw: 0, pitch: 0 };
    this.modulation = { ...neutralModulation };
    this.resetSlots();
  }

  private slot(name: TrackedName) {
    return this.slots.get(name)!;
  }

  /**
   * Upstream `animFactory`, L2227, reduced to the paths these templates use.
   *
   * Retained exactly: the `delay` draw, the cumulative `dt` timeline, the
   * `[null, ...vals]` prefix, the padding loop, the `eyesRotateX/Y` expansion
   * into the four look morphs, and `scaleValue` multiplying every drawn value.
   * Dropped: mood/pose/view/body template descent (we always use `neutral`), the
   * `gesture` and string branches, and `noClockOffset` (unused by these).
   */
  private animFactory(t: AnimTemplate, loop: boolean, scaleValue = 1): ActiveAnim {
    const ts: number[] = [0];
    let delay = t.delay ?? 0;
    if (Array.isArray(delay)) delay = gaussianRandom(this.random, ...(delay as [number, number, number?, number?]));

    /**
     * HYBRID cadence. Divides the drawn durations, so the SAME draw plays
     * through sooner. Applied after the draw, never to it, so the distribution
     * of targets is bit-identical to upstream at any cadence.
     */
    const cadence = Math.max(0.25, this.cadence);
    delay = (delay as number) / cadence;

    if (t.dt) {
      t.dt.forEach((x, i) => {
        const val = Array.isArray(x) ? gaussianRandom(this.random, ...(x as [number, number, number?, number?])) : (x as number);
        ts[i + 1] = ts[i] + val / cadence;
      });
    } else {
      const l = Object.values(t.vs).reduce((acc, val) => (val.length > acc ? val.length : acc), 0);
      ts.length = 0;
      for (let i = 0; i <= l; i += 1) ts.push(0);
    }
    const shifted = ts.map((x) => this.animClock + (delay as number) + x);

    const vs: Record<string, (number | null)[]> = {};
    for (const [mt, raw] of Object.entries(t.vs)) {
      const vals = raw.map((x) => {
        if (x === null) return null;
        if (Array.isArray(x)) return scaleValue * gaussianRandom(this.random, ...(x as [number, number, number?, number?]));
        return scaleValue * (x as number);
      });
      if (mt === "eyesRotateY") {
        vs.eyeLookOutLeft = [null, ...vals.map((x) => (x === null ? null : x > 0 ? x : 0))];
        vs.eyeLookInLeft = [null, ...vals.map((x) => (x === null ? null : x > 0 ? 0 : -x))];
        vs.eyeLookOutRight = [null, ...vals.map((x) => (x === null ? null : x > 0 ? 0 : -x))];
        vs.eyeLookInRight = [null, ...vals.map((x) => (x === null ? null : x > 0 ? x : 0))];
      } else if (mt === "eyesRotateX") {
        vs.eyesLookDown = [null, ...vals.map((x) => (x === null ? null : x > 0 ? x : 0))];
        vs.eyesLookUp = [null, ...vals.map((x) => (x === null ? null : x > 0 ? 0 : -x))];
      } else {
        vs[mt] = [null, ...vals];
      }
    }
    for (const mt of Object.keys(vs)) {
      while (vs[mt].length <= shifted.length) vs[mt].push(vs[mt][vs[mt].length - 1]);
    }

    return { name: t.name, ts: shifted, vs, ndx: 0, loop, builtFor: this.state };
  }

  /** Picks an `alt` branch by probability. Upstream L2243-2262. */
  private pickAlt(alts: { p: number | undefined; template: AnimTemplate }[]) {
    let chosen = alts[0];
    if (alts.length > 1) {
      const coin = this.random();
      let p = 0;
      for (let i = 0; i < alts.length; i += 1) {
        /**
         * GAZE FIX. `alts[0]` of the speaking eyes template IS the eye-contact
         * branch, and its probability is upstream's `avatarSpeakingEyeContact`
         * option — raising it is configuration, not a redesign. The non-contact
         * branch is deliberately left available so the eyes are not pinned.
         */
        const val = i === 0 && this.state === "speaking" && this.tuning
          ? this.tuning.eyeContactProbability
          : alts[i].p;
        p += val === undefined ? (1 - p) / (alts.length - 1 - i) : val;
        if (coin < p) { chosen = alts[i]; break; }
      }
    }
    return chosen.template;
  }

  /** Rebuilds the two looping animations for the current state. Upstream L2100-2107. */
  private installStateAnims(scaleValue: number) {
    for (const name of ["head", "eyes"]) {
      const i = this.queue.findIndex((y) => y.name === name);
      if (i !== -1) this.queue.splice(i, 1);
    }
    this.queue.push(this.animFactory(HEAD_TEMPLATE[this.state], true, scaleValue));
    this.queue.push(this.animFactory(this.pickAlt(EYES_TEMPLATE[this.state]), true, scaleValue));
  }

  /**
   * One frame.
   *
   * @param deltaSeconds frame delta. Converted to ms because every upstream
   *   constant in this file is in milliseconds.
   * @param speaking whether speech is active. Upstream's `stateName`.
   */
  update(
    deltaSeconds: number,
    speaking: boolean,
    tuning: TalkingHeadTuning,
    modulation: CarrierModulation = neutralModulation
  ): TalkingHeadOutput {
    this.cadence = tuning.cadence;
    this.tuning = tuning;
    this.modulation = modulation;
    const frameDurMs = 1000 / tuning.modelFps;
    let dtMs = deltaSeconds * 1000;
    // Upstream L2680: "Make sure we do not overshoot".
    if (dtMs > 2 * frameDurMs) dtMs = 2 * frameDurMs;
    /**
     * HYBRID pause damping, applied to the CLOCK.
     *
     * Slowing the clock slows how fast the sigmoid walks toward the current
     * target, so velocity decays smoothly while orientation keeps drifting the
     * way it was already going. That is "damp, not stop": nothing is zeroed,
     * nothing snaps to centre, and when speech resumes the clock simply speeds
     * back up from wherever the trajectory had reached. A cap below 1 guarantees
     * the head can never actually freeze.
     */
    this.animClock += dtMs * (1 - modulationLimits.pauseSlowdown * clamp01(modulation.damping));

    this.releasing = false;
    const nextState = speaking ? "speaking" : "idle";
    if (nextState !== this.state || !this.queue.length) {
      this.state = nextState;
      /**
       * Upstream restrains head and eye amplitude to a QUARTER while speaking
       * (L2557: `k = isSpeaking && (head|eyes) ? 4 : 1`, then `scaleValue=1/k`).
       * It applies on loop re-creation, so the first speaking cycle after a
       * transition already carries it.
       */
      this.installStateAnims(this.state === "speaking" ? 1 / 4 : 1);
    }

    // ---- animation loop, upstream L2487-2570 --------------------------------
    const { isEyeContact, isHeadMove } = this.runQueue();

    // ---- eye contact / head move, upstream L2639-2677 -----------------------
    this.eyeContact = Boolean(isEyeContact);
    this.headMoveQueued = false;
    if (isEyeContact || isHeadMove) {
      /**
       * The mechanism that makes head and gaze one system: the eye direction is
       * SOLVED FROM the live head orientation so the eyes hold the camera while
       * the head moves. Upstream reads `poseAvatar.props['Head.quaternion']` and
       * takes its Euler; we compose the identical Euler from the same two
       * contributions, which is the same quantity before it reaches a bone.
       */
      const headX = this.slot("bodyRotateX").value + this.slot("headRotateX").value;
      const headY = this.slot("bodyRotateY").value + this.slot("headRotateY").value;
      const ex = Math.max(-0.9, Math.min(0.9, 2 * headX - 0.5));
      const ey = Math.max(-0.9, Math.min(0.9, -2.5 * headY));

      if (isEyeContact) {
        this.slot("eyesLookDown").newvalue = ex < 0 ? -ex : 0;
        this.slot("eyesLookUp").newvalue = ex < 0 ? 0 : ex;
        this.slot("eyeLookInLeft").newvalue = ey < 0 ? -ey : 0;
        this.slot("eyeLookOutLeft").newvalue = ey < 0 ? 0 : ey;
        this.slot("eyeLookInRight").newvalue = ey < 0 ? 0 : ey;
        this.slot("eyeLookOutRight").newvalue = ey < 0 ? -ey : 0;

        if (isHeadMove) {
          const iy = -this.slot("bodyRotateY").value;
          const jx = gaussianRandom(this.random, -0.2, 0.2);
          /**
           * The pushed `headmove` gets the speaking restraint too.
           *
           * Upstream creates it with `scaleValue = 1`, so its `headRotateX` draw
           * of +/-0.2 rad is +/-11.5 deg — fine against upstream's own +/-1 rad
           * limits, but our speaking head limit is 3 deg. Measured: with eye
           * contact raised the headmove fires often enough that the composed
           * pitch sat at exactly 3.000 deg, the clamp, and max jerk went from
           * 374 to 5,162 deg/s^3. The head was slamming into its envelope.
           *
           * The quarter is the same factor and the same rationale upstream
           * already applies to the head and eyes templates while speaking
           * (L2557); the pushed headmove escaping it looks like an upstream
           * oversight, and against our tighter skeleton it is a clamp generator.
           */
          const restrain = this.state === "speaking" ? (this.tuning?.headMoveScale ?? 1) : 1;
          this.queue.push(this.animFactory({
            name: "headmove",
            dt: [[1000, 2000], [1000, 2000, 1, 2], [1000, 2000], [1000, 2000, 1, 2]],
            vs: { headRotateY: [iy, iy, 0], headRotateX: [jx, jx, 0], headRotateZ: [-iy / 4, -iy / 4, 0] }
          }, false, restrain));
          this.headMoveQueued = true;
        }
      } else {
        // No eye contact: the head turns to follow where the eyes already are.
        const iy = this.slot("eyeLookInLeft").value - this.slot("eyeLookOutLeft").value;
        const jx = gaussianRandom(this.random, -0.2, 0.2);
        // Same restraint, same reason. See the eye-contact branch above.
        const restrainNoContact = this.state === "speaking" ? (this.tuning?.headMoveScale ?? 1) : 1;
        this.queue.push(this.animFactory({
          name: "headmove",
          dt: [[1000, 2000], [1000, 2000, 1, 2], [1000, 2000], [1000, 2000, 1, 2]],
          vs: {
            headRotateY: [null, iy, iy, 0], headRotateX: [null, jx, jx, 0], headRotateZ: [null, -iy / 4, -iy / 4, 0],
            eyeLookInLeft: [null, 0], eyeLookOutLeft: [null, 0], eyeLookInRight: [null, 0], eyeLookOutRight: [null, 0]
          }
        }, false, restrainNoContact));
        this.headMoveQueued = true;
      }
    }

    return this.integrate(deltaSeconds, tuning);
  }

  /** Upstream's morph smoother plus the bone mapping. Shared by update/release. */
  private integrate(deltaSeconds: number, tuning: TalkingHeadTuning): TalkingHeadOutput {
    const frameDurMs = 1000 / tuning.modelFps;
    let dtMs = deltaSeconds * 1000;
    if (dtMs > 2 * frameDurMs) dtMs = 2 * frameDurMs;

    // ---- morph smoothing, upstream `updateMorphTargets` L1727-1753 ----------
    for (const name of TRACKED) {
      const o = this.slot(name);
      const target = o.newvalue;
      if (target === null) continue;
      const diff = target - o.value;
      let newvalue: number;
      if (diff >= 0) {
        if (diff < 0.005) { newvalue = target; o.v = 0; }
        else {
          if (o.v < o.maxv) o.v += o.acc * dtMs;
          newvalue = o.v >= 0
            ? o.value + diff * (1 - Math.exp(-o.v * dtMs))
            : o.value + o.v * dtMs * (1 - Math.exp(o.v * dtMs));
        }
      } else {
        if (diff > -0.005) { newvalue = target; o.v = 0; }
        else {
          if (o.v > -o.maxv) o.v -= o.acc * dtMs;
          newvalue = o.v >= 0
            ? o.value + o.v * dtMs * (1 - Math.exp(-o.v * dtMs))
            : o.value + diff * (1 - Math.exp(o.v * dtMs));
        }
      }
      o.value = Math.max(o.min, Math.min(o.max, newvalue));
    }

    // ---- bone mapping, upstream L1778-1812 ----------------------------------
    const bx = this.slot("bodyRotateX").value;
    const by = this.slot("bodyRotateY").value;
    const bz = this.slot("bodyRotateZ").value;
    const hx = this.slot("headRotateX").value;
    const hy = this.slot("headRotateY").value;
    const hz = this.slot("headRotateZ").value;
    const a = tuning.amplitude;

    const carrier = { pitch: (bx + hx) * a, yaw: (by + hy) * a, roll: (bz + hz) * a };

    /**
     * HYBRID modulation — shaping motion that is already happening.
     *
     * The stroke direction comes from the CARRIER'S OWN velocity, measured on
     * its composed output, with a dead zone so a near-stationary axis has no
     * defined direction and therefore receives no bias. Because the bias is
     * always sign-aligned with that direction, an emphasis can lengthen or
     * deepen the stroke underway and is structurally incapable of reversing it
     * or starting one. That is the brief's core rule expressed as arithmetic
     * rather than as a guard someone has to remember.
     */
    const dz = modulationLimits.directionDeadZone;
    const dirAlpha = 1 - Math.exp(-(deltaSeconds) / modulationLimits.directionTimeConstant);
    for (const axis of ["pitch", "yaw"] as const) {
      const v = carrier[axis] - this.previousHead[axis];
      const target = Math.tanh(v / dz);
      this.strokeDir[axis] += (target - this.strokeDir[axis]) * dirAlpha;
    }
    this.previousHead = { ...carrier };

    const emphasis = clamp01(this.modulation.emphasis);
    const damping = clamp01(this.modulation.damping);
    const gain = (1 + emphasis * modulationLimits.gain) * (1 - damping * modulationLimits.pauseGain);

    /**
     * Gain is applied to the carrier's DELTA, not to its position.
     *
     * Scaling the absolute pose was the first version and it is the wrong shape
     * of operation: the rendered value is `gain x pose`, so its derivative
     * carries a `gain' x pose` term — a changing gain teleports the head in
     * proportion to how far from centre it happens to be. At a 2.7 deg
     * excursion and emphasis rising over ~0.2 s that injected around 1.6 deg/s,
     * twice the carrier's own median velocity, and it took max jerk from 319 to
     * 1,345 deg/s^3 with the conductor's fuller emphasis pushing it to 3,804.
     *
     * Integrating `gain x carrierDelta` instead means gain changes how far the
     * NEXT bit of movement travels and can never move the head on its own. A
     * slow leak back toward the carrier keeps the two from drifting apart over
     * a long utterance without reintroducing a position term with any authority.
     */
    if (!this.modulatedInit) {
      this.modulatedPose = { ...carrier };
      this.modulatedInit = true;
    }
    const leak = 1 - Math.exp(-(deltaSeconds) / modulationLimits.gainLeakSeconds);
    for (const axis of ["pitch", "yaw", "roll"] as const) {
      const delta = carrier[axis] - this.previousCarrier[axis];
      this.modulatedPose[axis] += delta * gain;
      this.modulatedPose[axis] += (carrier[axis] - this.modulatedPose[axis]) * leak;
    }
    this.previousCarrier = { ...carrier };

    /**
     * The bias is slew-limited for the same reason: it is additive on position,
     * so an emphasis envelope rising in 0.2 s would swing 0.4 deg in 0.2 s all
     * by itself. Smoothing it makes the bias arrive as part of the stroke rather
     * than as a nudge on top of it.
     */
    const biasAlpha = 1 - Math.exp(-(deltaSeconds) / modulationLimits.biasTimeConstant);
    const wantPitchBias = this.strokeDir.pitch * emphasis * modulationLimits.pitchBiasDegrees * DEG_TO_RAD;
    const wantYawBias = this.strokeDir.yaw * emphasis * modulationLimits.yawBiasDegrees * DEG_TO_RAD;
    this.appliedBias.pitch += (wantPitchBias - this.appliedBias.pitch) * biasAlpha;
    this.appliedBias.yaw += (wantYawBias - this.appliedBias.yaw) * biasAlpha;
    const pitchBias = this.appliedBias.pitch;
    const yawBias = this.appliedBias.yaw;
    this.lastModulationDebug = { gain, pitchBias, yawBias, damping };

    /**
     * CENTRE FIX — the evolving speaking rest.
     *
     * A slow low-pass of the carrier's own value, so the head's home is where it
     * has recently been rather than global zero. Because it is an average of a
     * bounded signal it is bounded by construction; the clamp is a second belt.
     * No RNG, no oscillator, no per-cadence reset — it simply carries.
     *
     * Applied ADDITIVELY to the carrier rather than by offsetting the drawn
     * targets, which keeps every upstream slot value bit-identical and means the
     * fix can be switched off by setting `restStrength` to 0.
     */
    const restTau = Math.max(0.25, tuning.restTimeConstantSeconds);
    const restAlpha = 1 - Math.exp(-(deltaSeconds) / restTau);
    // The long average is the carrier's own DC, which must NOT be re-added.
    const baselineAlpha = 1 - Math.exp(-(deltaSeconds) / (restTau * 4));
    const restLimit = tuning.restLimitDegrees * DEG_TO_RAD;
    for (const axis of ["pitch", "yaw", "roll"] as const) {
      this.restFast[axis] += (carrier[axis] - this.restFast[axis]) * restAlpha;
      this.restBaseline[axis] += (carrier[axis] - this.restBaseline[axis]) * baselineAlpha;
      /**
       * A BAND-PASS, not a low-pass.
       *
       * A plain low-pass of the carrier contains its DC term, and the pitch
       * template is not symmetric — `bodyRotateX` draws from [-0.05, 0.15], mean
       * +0.05 — so adding it back pushed the head further down the more it was
       * applied: mean pitch went 0.75 deg to 1.136 deg and the peak from 2.05 to
       * 2.54. That is the "drifts excessively to one side" failure condition,
       * arrived at while trying to fix centring.
       *
       * Subtracting a slower average of the same signal leaves only the slow
       * WANDER, which is what the head's home should do. Zero-mean by
       * construction, so it can decentre without biasing.
       */
      const band = this.restFast[axis] - this.restBaseline[axis];
      this.rest[axis] = band > restLimit ? restLimit : band < -restLimit ? -restLimit : band;
    }
    const restGain = tuning.restStrength;

    const head = {
      pitch: this.modulatedPose.pitch + pitchBias + this.rest.pitch * restGain,
      yaw: this.modulatedPose.yaw + yawBias + this.rest.yaw * restGain,
      roll: this.modulatedPose.roll + this.rest.roll * restGain
    };
    /**
     * Upstream's Spine1 share: X and Y at /2, Z at /12. Taken from the MODULATED
     * head so the chain stays consistent — the neck must not describe a
     * different trajectory from the head sitting on it.
     */
    const neck = { pitch: head.pitch / 2, yaw: head.yaw / 2, roll: head.roll / 12 };

    /**
     * Gaze commitment scales how strongly the eyes hold what the eye-contact
     * solve already asked for. It does NOT introduce a second gaze timeline —
     * the direction still comes entirely from the head orientation.
     */
    const commit = Math.max(0, Math.min(1.4, this.modulation.gazeCommitment));
    /**
     * GAZE FIX — under-compensation and lag.
     *
     * Perfect counter-rotation reads as mechanical, and the measured coupling
     * during eye contact was -0.985: almost exactly perfect. The brief asks for
     * 70-90 % compensation in RENDERED eye degrees and 60-120 ms of lag, so the
     * eyes stabilise contact slightly behind the head and settle with the new
     * posture instead of appearing glued to the camera.
     *
     * `gazeCompensationScale` scales the solve; the first-order lag is on the
     * output, so it delays without inventing any motion of its own.
     *
     * The two interact and the scale accounts for it: a 90 ms first-order lag
     * attenuates content at the carrier's ~770 ms stroke period by roughly 0.82,
     * so a scale of 0.92 landed the effective compensation at ~0.75 — the very
     * bottom of the band. 1.05 puts it mid-band once the lag has taken its cut.
     */
    const scale = tuning.gazeCompensationScale;
    const wanted = {
      yaw: clampUnit((this.slot("eyeLookOutLeft").value - this.slot("eyeLookInLeft").value) * commit * scale),
      pitch: clampUnit((this.slot("eyesLookUp").value - this.slot("eyesLookDown").value) * commit * scale)
    };
    if (tuning.gazeLagSeconds > 0) {
      const gazeAlpha = 1 - Math.exp(-(deltaSeconds) / tuning.gazeLagSeconds);
      this.laggedGaze.yaw += (wanted.yaw - this.laggedGaze.yaw) * gazeAlpha;
      this.laggedGaze.pitch += (wanted.pitch - this.laggedGaze.pitch) * gazeAlpha;
    } else {
      this.laggedGaze = { ...wanted };
    }
    const gaze = { ...this.laggedGaze };

    return {
      head, neck, gaze,
      debug: {
        clockMs: this.animClock,
        state: this.state,
        eyeContact: this.eyeContact,
        headMoveQueued: this.headMoveQueued,
        activeAnims: this.queue.map((q) => q.name),
        bodyRotateX: bx, bodyRotateY: by, headRotateX: hx, headRotateY: hy,
        cadence: this.cadence,
        emphasis,
        gain,
        pitchBiasDegrees: pitchBias / DEG_TO_RAD,
        yawBiasDegrees: yawBias / DEG_TO_RAD,
        damping,
        strokePitchSign: this.strokeDir.pitch,
        strokeYawSign: this.strokeDir.yaw,
        restPitchDegrees: (this.rest.pitch * restGain) / DEG_TO_RAD,
        restYawDegrees: (this.rest.yaw * restGain) / DEG_TO_RAD,
        eyeContactProbability: tuning.eyeContactProbability,
        drawnTargetX: this.drawnTarget.x,
        drawnTargetY: this.drawnTarget.y
      }
    };
  }

  /**
   * The upstream animation loop, L2487-2570.
   *
   * Extracted so the speech-end release can drive the same machinery — the
   * release is an ordinary animation in the queue, which is what keeps its
   * motion character identical to everything else the adapter does.
   */
  private runQueue(): { isEyeContact: boolean | null; isHeadMove: boolean | null } {
    let isEyeContact: boolean | null = null;
    let isHeadMove: boolean | null = null;

    for (let i = 0; i < this.queue.length; i += 1) {
      const x = this.queue[i];
      if (this.animClock < x.ts[0]) continue;

      let j = x.ndx || 0;
      const k = x.ts.length;
      for (; j < k; j += 1) {
        if (this.animClock < x.ts[j]) break;

        for (const [mt, vs] of Object.entries(x.vs)) {
          const tracked = this.slots.get(mt as TrackedName);
          if (tracked) {
            if (vs[j + 1] === null) continue;      // last or unknown target, skip
            if (vs[j] === null) vs[j] = tracked.value;   // fill-in start value
            if (j === k - 1) {
              tracked.newvalue = vs[j];
            } else {
              let target = vs[j + 1]!;
              /**
               * The DRAWN destination of the segment in flight, recorded before
               * any interpolation. Cadence must never change this — it is the
               * direct evidence that a faster mode travels the same stroke
               * sooner rather than travelling a different one.
               */
              if (x.name === "head") {
                if (mt === "bodyRotateX") this.drawnTarget.x = vs[j + 1]!;
                else if (mt === "bodyRotateY") this.drawnTarget.y = vs[j + 1]!;
              }
              const tdiff = x.ts[j + 1] - x.ts[j];
              let alpha = 1;
              if (tdiff > 0.0001) alpha = (this.animClock - x.ts[j]) / tdiff;
              if (alpha < 1) {
                alpha = this.easing(alpha);
                target = (1 - alpha) * vs[j]! + alpha * target;
              }
              tracked.newvalue = target;
            }
          } else if (mt === "eyeContact" && vs[j] !== null && isEyeContact !== false) {
            isEyeContact = Boolean(vs[j]);
          } else if (mt === "headMove" && vs[j] !== null && isHeadMove !== false) {
            if (vs[j] === 0) {
              isHeadMove = false;
            } else {
              // Upstream's `avatarSpeakingHeadMove`; see `headMoveProbability`.
              // Scaled, never replaced. See `headMoveRateScale`.
              const p = (vs[j] as number) * (this.tuning?.headMoveRateScale ?? 1);
              if (this.random() < p) isHeadMove = true;
              vs[j] = null;
            }
          }
        }
      }

      if (j === k) {
        if (x.loop) {
          // Upstream L2556-2558: rebuild, restraining head/eyes while speaking.
          const restrain = this.state === "speaking" && (x.name === "head" || x.name === "eyes") ? 4 : 1;
          const template = x.name === "head" ? HEAD_TEMPLATE[this.state] : this.pickAlt(EYES_TEMPLATE[this.state]);
          this.queue[i] = this.animFactory(template, true, 1 / restrain);
        } else {
          this.queue.splice(i, 1);
          i -= 1;
        }
      } else {
        x.ndx = j - 1;
      }
    }
    return { isEyeContact, isHeadMove };
  }

  /**
   * Hands the head back to our idle system at speech end.
   *
   * Upstream never needs this: it owns idle as well, so at speech end it simply
   * swaps its `speaking` templates for its `idle` ones and keeps animating. In
   * our runtime §P16 owns idle, so the adapter has to reach zero and let go —
   * and the `disabled` early-return that used to do it dropped the whole
   * contribution in ONE FRAME, measured on the composed bone at 24,607 deg/s^3,
   * by far the largest discontinuity in the clip.
   *
   * This is a boundary handoff, not a change to the speaking motion: it retires
   * the animation queue and drives every slot to zero through upstream's OWN
   * `updateMorphTargets` smoother, so the decay has the same character as every
   * other value change the adapter makes.
   */
  release(deltaSeconds: number, tuning: TalkingHeadTuning): TalkingHeadOutput {
    // The clock keeps running: the release is an ordinary queued animation and
    // needs the same time base to interpolate against.
    const frameDurMs = 1000 / tuning.modelFps;
    this.animClock += Math.min(deltaSeconds * 1000, 2 * frameDurMs);
    if (!this.releasing) {
      /**
       * A ramp ANIMATION, not a target assignment.
       *
       * Setting `newvalue = 0` directly was the first attempt and it barely
       * helped (24,607 -> 21,752 deg/s^3), because upstream's morph smoother is
       * effectively instantaneous once its velocity term has ramped: at
       * `v = maxv` and a 16.7 ms frame, `1 - exp(-v*dt)` is 1 and it lands on
       * the target in a single frame. The smoother is a step REMOVER, not a
       * shaper — upstream's actual shaping is the sequence interpolation.
       *
       * So the release uses upstream's own idiom: a one-segment animation from
       * wherever each slot is to zero, blended with the same sigmoid. It is
       * exactly how upstream returns `headRotate*` to rest at the end of a
       * `headmove` (`headRotateY: [i,i,0]`).
       */
      this.queue = [{
        name: "release",
        ts: [this.animClock, this.animClock + 400],
        vs: Object.fromEntries(TRACKED.map((n) => [n, [null, 0] as (number | null)[]])),
        ndx: 0,
        loop: false,
        builtFor: this.state
      }];
      this.releasing = true;
    }
    this.runQueue();
    return this.integrate(deltaSeconds, tuning);
  }

  /** True once every tracked slot is back at rest. */
  settled() {
    for (const name of TRACKED) if (Math.abs(this.slot(name).value) > 0.001) return false;
    return true;
  }

  /** True once any tracked slot has moved off zero. For the mode-switch tests. */
  hasState() {
    for (const name of TRACKED) if (Math.abs(this.slot(name).value) > EPS) return true;
    return this.queue.length > 0 || this.animClock > 0;
  }
}

const hashSeed = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
