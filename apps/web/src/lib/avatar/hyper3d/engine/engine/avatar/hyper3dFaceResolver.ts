import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * HYPER3D STAGE 2 — region-aware speech/expression resolver.
 *
 * The problem this exists to solve: adding an expression pose on top of a speech
 * pose makes two layers fight. A smile writing `mouthSmile` while a bilabial
 * writes `mouthClose` does not read as a smiling person saying "M" — it reads as
 * a smile layer and a lip-sync layer disagreeing about the same lips.
 *
 * So ownership is decided per FACIAL REGION rather than per morph, and speech
 * wins only where articulation actually needs it:
 *
 *   region         speech      expression
 *   brows          none        full          — never touched by articulation
 *   upperEye       none        full
 *   cheeks         minimal     high          — warmth survives every consonant
 *   mouthCorners   conditional retained      — yields to a seal or a round, not to everything
 *   centralLips    high        conditional
 *   jaw            full        trace only
 *
 * Nothing here retunes speech. The speech pose arrives already calibrated by the
 * accepted HC2 adapter and is never scaled — the resolver only decides how much
 * EXPRESSION survives alongside it, and adds expression where speech is silent.
 * Lip-sync channels the expression does not touch pass through untouched.
 */

export type FaceRegion = "brows" | "upperEye" | "cheeks" | "mouthCorners" | "centralLips" | "jaw" | "other";

/** Semantic region of every channel an expression or speech can write. */
export const HYPER3D_FACE_REGIONS: Record<string, FaceRegion> = {
  browInnerUp: "brows", browOuterUpLeft: "brows", browOuterUpRight: "brows",
  browDownLeft: "brows", browDownRight: "brows",

  eyeWideLeft: "upperEye", eyeWideRight: "upperEye",
  eyeSquintLeft: "upperEye", eyeSquintRight: "upperEye",
  eyeBlinkLeft: "upperEye", eyeBlinkRight: "upperEye",

  cheekSquintLeft: "cheeks", cheekSquintRight: "cheeks",
  cheekPuff: "cheeks", noseSneerLeft: "cheeks", noseSneerRight: "cheeks",

  mouthSmileLeft: "mouthCorners", mouthSmileRight: "mouthCorners",
  mouthDimpleLeft: "mouthCorners", mouthDimpleRight: "mouthCorners",
  mouthFrownLeft: "mouthCorners", mouthFrownRight: "mouthCorners",
  mouthStretchLeft: "mouthCorners", mouthStretchRight: "mouthCorners",

  mouthClose: "centralLips", mouthPucker: "centralLips", mouthFunnel: "centralLips",
  mouthPressLeft: "centralLips", mouthPressRight: "centralLips",
  mouthRollUpper: "centralLips", mouthRollLower: "centralLips",
  mouthShrugUpper: "centralLips", mouthShrugLower: "centralLips",
  mouthUpperUpLeft: "centralLips", mouthUpperUpRight: "centralLips",
  mouthLowerDownLeft: "centralLips", mouthLowerDownRight: "centralLips",

  jawOpen: "jaw", jawForward: "jaw", jawLeft: "jaw", jawRight: "jaw"
};

export const regionOf = (channel: string): FaceRegion => HYPER3D_FACE_REGIONS[channel] ?? "other";

/**
 * Normalisers for the articulation signals, taken from the ACCEPTED lip-sync
 * calibration rather than invented. These are the values the calibrated speech
 * pose actually reaches at full articulation:
 *
 *   mouthClose  0.101376 on M    (P 0.0815, B 0.0813)
 *   mouthPucker 0.4872 on UW
 *   mouthFunnel 0.1650 on UW     (OW 0.1530)
 *   jawOpen     0.3150 on AA
 *
 * Dividing by these turns the live speech pose into 0..1 signals without any
 * knowledge of which phoneme is playing — the resolver reads the SHAPE, so it
 * needs no phoneme table of its own and cannot drift from the speech system.
 */
export const ARTICULATION_REFERENCE = {
  seal: 0.101376,
  pucker: 0.4872,
  funnel: 0.165,
  aperture: 0.315
} as const;

export interface ArticulationSignals {
  /** Bilabial closure demand, 0..1. */
  seal: number;
  /** Lip rounding demand, 0..1. */
  round: number;
  /** Jaw aperture demand, 0..1. */
  open: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Reads the articulation demand out of the already-calibrated speech pose. */
export const readArticulation = (speech: BlendshapePose): ArticulationSignals => ({
  seal: clamp01((speech.mouthClose ?? 0) / ARTICULATION_REFERENCE.seal),
  round: clamp01(Math.max(
    (speech.mouthPucker ?? 0) / ARTICULATION_REFERENCE.pucker,
    (speech.mouthFunnel ?? 0) / ARTICULATION_REFERENCE.funnel
  )),
  open: clamp01((speech.jawOpen ?? 0) / ARTICULATION_REFERENCE.aperture)
});

/**
 * How much of the expression each region gives up, given the articulation.
 *
 * The weights encode the anatomy the brief describes:
 *
 * - A bilabial seal must not be fought, so the CORNERS yield most of the way
 *   (0.88) — but not all of it, because a smiling person saying "M" still has
 *   lifted corners. CENTRAL LIPS yield completely.
 * - Rounding (O/U) has to win over corner pull or the vowel stops reading, so
 *   corners yield 0.80.
 * - A large open vowel barely conflicts with corner lift at all: 0.35.
 * - CHEEKS give up almost nothing (0.12 at a full seal). This is the single most
 *   important line in the file — it is what keeps warmth continuous while speech
 *   temporarily owns the lips.
 * - BROWS and UPPER EYE give up nothing, ever. Articulation has no claim there.
 */
export const REGION_YIELD = {
  brows: { seal: 0, round: 0, open: 0 },
  upperEye: { seal: 0, round: 0, open: 0 },
  cheeks: { seal: 0.12, round: 0.1, open: 0.08 },
  mouthCorners: { seal: 0.88, round: 0.8, open: 0.35 },
  centralLips: { seal: 1, round: 1, open: 0.7 },
  jaw: { seal: 1, round: 1, open: 1 },
  other: { seal: 0.5, round: 0.5, open: 0.5 }
} as const;

/** Suppression applied to a region's expression contribution, 0..1. */
export const regionSuppression = (region: FaceRegion, a: ArticulationSignals): number => {
  const y = REGION_YIELD[region];
  return clamp01(Math.max(a.seal * y.seal, a.round * y.round, a.open * y.open));
};

/**
 * Recovery profiles.
 *
 * Suppression ATTACKS fast in every profile — speech has to win the instant it
 * needs the lips, or the seal is compromised. Only the RELEASE differs, which is
 * what "expression recovery" means: how quickly the smile comes back once the
 * consonant lets go. Hardware picks.
 */
export const RECOVERY_PROFILES = {
  fast: { attackSeconds: 0.035, releaseSeconds: 0.09 },
  medium: { attackSeconds: 0.035, releaseSeconds: 0.16 },
  slow: { attackSeconds: 0.035, releaseSeconds: 0.26 }
} as const;

export type RecoveryProfileId = keyof typeof RECOVERY_PROFILES;

export interface ConflictRow {
  channel: string;
  region: FaceRegion;
  /** What the expression asked for, after its phrase envelope. */
  requested: number;
  /** What speech contributed on the same channel. */
  speech: number;
  /** Suppression applied to the expression, 0..1, after smoothing. */
  suppression: number;
  /** What was written. */
  final: number;
}

export interface FaceResolution {
  pose: BlendshapePose;
  articulation: ArticulationSignals;
  /** Smoothed suppression actually applied, per region. */
  applied: Record<FaceRegion, number>;
  conflicts: ConflictRow[];
}

/** Channels the conflict diagnostic always reports, per the brief. */
export const DIAGNOSTIC_CHANNELS = [
  "mouthSmileLeft", "mouthSmileRight", "mouthPressLeft", "mouthPressRight",
  "mouthClose", "mouthFunnel", "mouthPucker", "jawOpen",
  "cheekSquintLeft", "cheekSquintRight",
  "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "browDownLeft", "browDownRight"
];

/**
 * STAGE 2.2 — coarticulated conflict envelope.
 *
 * Stage 2 derived `seal`/`round`/`open` from the LIVE speech pose, so the
 * expression conflict tracked every phoneme transition: `M -> AE -> S` a few
 * frames apart made the corners chase each change even after output smoothing.
 *
 * This reads the SAME MFA timeline the speech system already uses and takes the
 * strongest conflicting articulation inside a look-ahead/look-behind window, so
 * the envelope anticipates an approaching bilabial and releases toward the next
 * context instead of stepping per phone. It introduces no second timing source
 * and no phoneme table of its own — the conflict value for a phoneme still comes
 * from that phoneme's accepted calibrated pose.
 */
export interface ConflictWindow {
  /** Seconds of look-ahead: how early the face begins yielding to what is coming. */
  aheadSeconds: number;
  /** Seconds of look-behind: how long a conflict keeps influencing the envelope. */
  behindSeconds: number;
}

export const DEFAULT_CONFLICT_WINDOW: ConflictWindow = { aheadSeconds: 0.12, behindSeconds: 0.08 };

export interface TimedArticulation {
  start: number;
  end: number;
  signals: ArticulationSignals;
}

/**
 * The conflict envelope at a clock, from a pre-resolved timeline.
 *
 * Each entry contributes its signals weighted by a triangular kernel across the
 * window, so the envelope rises before a bilabial and falls after it rather than
 * switching on its boundary.
 */
export const coarticulatedArticulation = (
  clock: number,
  timeline: TimedArticulation[],
  window: ConflictWindow = DEFAULT_CONFLICT_WINDOW
): ArticulationSignals => {
  let seal = 0, round = 0, open = 0;
  for (const entry of timeline) {
    if (entry.end < clock - window.behindSeconds || entry.start > clock + window.aheadSeconds) continue;
    // Distance from the clock to the entry, zero while inside it.
    const distance = clock < entry.start ? entry.start - clock : clock > entry.end ? clock - entry.end : 0;
    const span = clock < entry.start ? window.aheadSeconds : window.behindSeconds;
    const weight = span <= 0 ? (distance === 0 ? 1 : 0) : Math.max(0, 1 - distance / span);
    if (weight <= 0) continue;
    seal = Math.max(seal, entry.signals.seal * weight);
    round = Math.max(round, entry.signals.round * weight);
    open = Math.max(open, entry.signals.open * weight);
  }
  return { seal, round, open };
};

/**
 * Per-region suppression state, smoothed asymmetrically so speech engages
 * immediately and expression recovers on the chosen profile.
 */
export class Hyper3dSuppressionState {
  private applied: Record<FaceRegion, number> = {
    brows: 0, upperEye: 0, cheeks: 0, mouthCorners: 0, centralLips: 0, jaw: 0, other: 0
  };

  reset() {
    for (const key of Object.keys(this.applied) as FaceRegion[]) this.applied[key] = 0;
  }

  /**
   * Advances toward the demanded suppression and returns the smoothed values.
   *
   * Takes the constants directly rather than a profile id so a coordination
   * profile can supply its own without mutating the shared profile table.
   */
  step(
    demand: Record<FaceRegion, number>,
    deltaSeconds: number,
    timing: RecoveryProfileId | { attackSeconds: number; releaseSeconds: number }
  ) {
    const { attackSeconds, releaseSeconds } = typeof timing === "string" ? RECOVERY_PROFILES[timing] : timing;
    const dt = Math.max(0, deltaSeconds);
    for (const key of Object.keys(this.applied) as FaceRegion[]) {
      const target = demand[key] ?? 0;
      const rising = target > this.applied[key];
      const tau = rising ? attackSeconds : releaseSeconds;
      const alpha = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
      const next = this.applied[key] + (target - this.applied[key]) * alpha;
      this.applied[key] = Math.abs(target - next) <= 1e-4 ? target : next;
    }
    return { ...this.applied };
  }

  current() {
    return { ...this.applied };
  }
}

/**
 * Per-channel output smoothing, by region.
 *
 * STAGE 2.1. The suppression ramp alone still let the mouth corners move at
 * articulation speed — measured 0.0917 of influence in a single 16 ms frame.
 * This filters the RESOLVED EXPRESSION CONTRIBUTION, never the speech pose, and
 * only for regions with a configured constant. `centralLips` and `jaw` are
 * deliberately never smoothed here, so the central mouth stays fully responsive
 * and lip sync is untouched.
 */
export class Hyper3dFaceSmoother {
  private values = new Map<string, number>();

  reset() {
    this.values.clear();
  }

  /** Smooths one channel toward `value` using its region's time constant. */
  smooth(channel: string, value: number, deltaSeconds: number, constants: Partial<Record<FaceRegion, number>>) {
    const tau = constants[regionOf(channel)];
    if (!tau || tau <= 0) {
      this.values.set(channel, value);
      return value;
    }
    const previous = this.values.get(channel) ?? value;
    const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) / tau);
    const next = previous + (value - previous) * alpha;
    const settled = Math.abs(value - next) <= 1e-5 ? value : next;
    this.values.set(channel, settled);
    return settled;
  }
}

/**
 * Resolves one frame.
 *
 * `speech` is the already-calibrated pose from the accepted pipeline — speech,
 * idle and emotion — and is NEVER scaled here. `expression` is the Stage-1
 * vocabulary pose after its phrase envelope. The result keeps every speech
 * channel intact and adds whatever expression survives its region's suppression.
 */
export const resolveHyper3dFace = (
  speech: BlendshapePose,
  expression: BlendshapePose,
  applied: Record<FaceRegion, number>,
  articulation: ArticulationSignals,
  smoothing?: { smoother: Hyper3dFaceSmoother; constants: Partial<Record<FaceRegion, number>>; deltaSeconds: number }
): FaceResolution => {
  const pose: BlendshapePose = { ...speech };
  const conflicts: ConflictRow[] = [];
  const survived: Record<string, number> = {};

  for (const [channel, requested] of Object.entries(expression)) {
    if (!(requested > 0)) continue;
    const region = regionOf(channel);
    const suppression = applied[region] ?? 0;
    const raw = requested * (1 - suppression);
    // Smoothed AFTER suppression, so the ramp and the filter compose into one
    // continuous curve rather than two stacked lerps.
    const value = smoothing ? smoothing.smoother.smooth(channel, raw, smoothing.deltaSeconds, smoothing.constants) : raw;
    survived[channel] = value;
    const speechValue = speech[channel] ?? 0;
    /**
     * Combined by MAX, not by sum. Summing would push a channel past the
     * calibrated ceiling whenever both layers want it — a smile plus an
     * articulated `mouthUpperUp` would overshoot the accepted cap. Max means
     * whichever layer needs the channel more owns it, and the accepted speech
     * value is never reduced.
     */
    if (value > speechValue) pose[channel] = value;
  }

  for (const channel of DIAGNOSTIC_CHANNELS) {
    const region = regionOf(channel);
    conflicts.push({
      channel,
      region,
      requested: expression[channel] ?? 0,
      speech: speech[channel] ?? 0,
      suppression: applied[region] ?? 0,
      final: pose[channel] ?? 0
    });
  }

  return { pose, articulation, applied, conflicts };
};
