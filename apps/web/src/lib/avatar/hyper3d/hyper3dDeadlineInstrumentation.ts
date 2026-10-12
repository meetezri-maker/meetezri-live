import { hyper3dMorphCalibration } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEADLINE COMPARISON INSTRUMENTATION — the numbers §9 of the brief asks for.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MEASUREMENT ONLY. Nothing in this file is read by the follower, the envelope,
 * the engine or the clock; it observes frames that have already been produced
 * and it owns no state the renderer can see. It exists so the reviewer can
 * connect what is on the face to what the follower is actually doing, in the
 * same units for all three modes.
 *
 * WHAT "REACH" MEANS HERE, and this is the whole measurement. For one label and
 * one channel:
 *
 *   reach = peak RENDERED during the label / peak TARGET demanded during the label
 *
 * The FOLLOWER's own domain, before the asset gain and cap — because the
 * question is whether the smoother arrived at the value it was handed, and
 * calibration is a monotone per-channel map that cannot change that answer. A
 * channel whose peak demand never clears `REACH_FLOOR` is not counted: it was
 * never asked for a visible shape, so it has no shape to miss. This is the same
 * quantity the diagnosis quotes 69 % / 71 % / 103 % in, which is why the three
 * modes can be read against it.
 *
 * Reach is reported as a MEDIAN over labels, not a mean: the distribution is
 * skewed by very short labels and a mean would describe neither end of it.
 */

/** Peak demand below which a channel is not asked for a visible shape. */
export const REACH_FLOOR = 0.02;

/**
 * The articulation channels this comparison measures reach and travel over.
 *
 * The lower face and nothing else: every channel the lip-sync engine writes,
 * including the ones the deadline layer may NOT touch, because a measurement
 * that excluded the seal could not show that the seal did not move.
 */
export const HYPER3D_REACH_CHANNELS: readonly string[] = Object.freeze([
  "jawOpen", "jawForward", "jawLeft", "jawRight",
  "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight",
  "mouthFrownLeft", "mouthFrownRight",
  "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthPressLeft", "mouthPressRight",
  "mouthRollUpper", "mouthRollLower",
  "mouthShrugUpper", "mouthShrugLower",
  "mouthDimpleLeft", "mouthDimpleRight",
  "mouthLeft", "mouthRight"
]);

/**
 * The channel groups §9 names. `jawOpen` alone is the jaw; the three lip groups
 * are the mechanisms a reviewer can actually see failing — the lips not opening
 * vertically, not spreading, not rounding.
 */
export const REACH_CHANNEL_GROUPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  jaw: Object.freeze(["jawOpen"]),
  vertical: Object.freeze([
    "mouthUpperUpLeft", "mouthUpperUpRight",
    "mouthLowerDownLeft", "mouthLowerDownRight",
    "mouthShrugUpper", "mouthShrugLower",
    "mouthRollLower"
  ]),
  width: Object.freeze([
    "mouthStretchLeft", "mouthStretchRight",
    "mouthSmileLeft", "mouthSmileRight"
  ]),
  rounding: Object.freeze(["mouthFunnel", "mouthPucker"])
});

/**
 * The phoneme classes §11 asks the reviewer to judge by eye, so the panel can
 * put a number next to each of the three questions: do the open vowels open,
 * does IY spread, does UW/OW round.
 */
export const REACH_PHONEME_CLASSES: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  open: new Set(["AA", "AH", "AE", "AW", "AY", "AO"]),
  front: new Set(["IY", "IH", "EY", "EH"]),
  rounded: new Set(["UW", "UH", "OW", "OY", "W"])
});

/**
 * The channels the deadline layer may reach, as a list for measurement.
 *
 * Mirrors `isDeadlineEligibleChannel` and is asserted against it, so a change to
 * eligibility cannot leave the instrumentation measuring the old set.
 */
export const HYPER3D_DEADLINE_ELIGIBLE: readonly string[] = Object.freeze([
  "mouthFunnel", "mouthPucker",
  "mouthStretchLeft", "mouthStretchRight",
  "mouthSmileLeft", "mouthSmileRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthRollLower", "mouthShrugLower", "mouthShrugUpper",
  "jawOpen"
]);

/** Bilabials, whose closure timing this layer must leave exactly alone. */
export const BILABIAL_PHONEMES: ReadonlySet<string> = new Set(["P", "B", "M"]);

/** Millimetres of travel one unit of this influence is worth on the asset. */
export const travelMM = (name: string, value: number) =>
  (hyper3dMorphCalibration[name]?.travelMM ?? 0) * value;

/** Geometric distance between two poses in the asset's millimetre space. */
export function poseDistanceMM(a: BlendshapePose, b: BlendshapePose, channels: readonly string[]) {
  let sum = 0;
  for (const name of channels) {
    const d = travelMM(name, (a[name] ?? 0) - (b[name] ?? 0));
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Nearest-rank percentile. p90 of a short run must not interpolate into fiction. */
export const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank];
};

export interface ReachReport {
  /** Median reach over every counted (label, channel) pair. */
  overall: number;
  /** Median reach within each channel group, keyed as `REACH_CHANNEL_GROUPS`. */
  byChannelGroup: Record<string, number>;
  /** Median reach within each phoneme class, keyed as `REACH_PHONEME_CLASSES`. */
  byPhonemeClass: Record<string, number>;
  /** Median reach by label duration band, which is the table the diagnosis quotes. */
  byDurationBand: Record<string, number>;
  /** How many (label, channel) pairs were counted. */
  samples: number;
}

export interface MotionReport {
  /** Rendered mouth travel per second of timeline, mm/s. */
  pathRateMMPerSecond: number;
  /** 90th percentile of per-frame rendered mouth speed, mm/s. */
  velocityP90MMPerSecond: number;
  /** Rendered `jawOpen` open-close cycles per second. */
  jawCyclesPerSecond: number;
  /** Share of all travel carried by `jawOpen`. */
  jawShare: number;
}

/** One (label, channel) reach observation. */
export interface ReachSample {
  phoneme: string;
  channel: string;
  labelSeconds: number;
  reach: number;
}

/** The duration bands the diagnosis reports completion against, in ms. */
export const DURATION_BANDS: readonly { id: string; maxMs: number }[] = Object.freeze([
  { id: "<=30ms", maxMs: 30 },
  { id: "31-50ms", maxMs: 50 },
  { id: "51-70ms", maxMs: 70 },
  { id: "71-100ms", maxMs: 100 },
  { id: "101-150ms", maxMs: 150 },
  { id: ">150ms", maxMs: Infinity }
]);

export const durationBandOf = (labelSeconds: number) =>
  DURATION_BANDS.find((band) => labelSeconds * 1000 <= band.maxMs)?.id ?? ">150ms";

/** Collapse raw samples into the report §9 asks for. Pure; no state. */
export function summarizeReach(samples: readonly ReachSample[]): ReachReport {
  const inGroup: Record<string, number[]> = {};
  for (const group of Object.keys(REACH_CHANNEL_GROUPS)) inGroup[group] = [];
  const inClass: Record<string, number[]> = {};
  for (const name of Object.keys(REACH_PHONEME_CLASSES)) inClass[name] = [];
  const inBand: Record<string, number[]> = {};
  for (const band of DURATION_BANDS) inBand[band.id] = [];
  const all: number[] = [];

  for (const sample of samples) {
    all.push(sample.reach);
    for (const [group, channels] of Object.entries(REACH_CHANNEL_GROUPS)) {
      if (channels.includes(sample.channel)) inGroup[group].push(sample.reach);
    }
    for (const [name, phonemes] of Object.entries(REACH_PHONEME_CLASSES)) {
      if (phonemes.has(sample.phoneme)) inClass[name].push(sample.reach);
    }
    inBand[durationBandOf(sample.labelSeconds)].push(sample.reach);
  }

  const toMedians = (buckets: Record<string, number[]>) =>
    Object.fromEntries(Object.entries(buckets).map(([key, values]) => [key, median(values)]));

  return {
    overall: median(all),
    byChannelGroup: toMedians(inGroup),
    byPhonemeClass: toMedians(inClass),
    byDurationBand: toMedians(inBand),
    samples: all.length
  };
}

/**
 * Rendered `jawOpen` open-close cycles, by hysteresis on the channel itself.
 *
 * THE THRESHOLDS ARE ABSOLUTE, in rendered `jawOpen` units, and that is the
 * point: Fix G's accepted baseline is quoted as 3.09 cycles per second against a
 * 2.92 Hz corpus syllable rate, and a threshold that scaled with each run's own
 * amplitude would not be the same measurement. 0.12 and 0.07 sit either side of
 * an ordinary vowel aperture on this asset (`jawOpen` renders 0.331 at AA p90,
 * caps at 0.55, and `usefulMin` is 0.02), so an open counts when the jaw is
 * visibly open and a close counts when it has visibly come back.
 *
 * A cycle is counted on each rise past `HI` that follows a fall below `LO` —
 * the open-close PAIR, not each edge.
 */
export const JAW_CYCLE_OPEN_THRESHOLD = 0.12;
export const JAW_CYCLE_CLOSE_THRESHOLD = 0.07;

export function countJawCycles(
  jawSeries: readonly number[],
  hi = JAW_CYCLE_OPEN_THRESHOLD,
  lo = JAW_CYCLE_CLOSE_THRESHOLD
): number {
  let open = false;
  let cycles = 0;
  for (const value of jawSeries) {
    if (!open && value >= hi) {
      open = true;
      cycles += 1;
    } else if (open && value <= lo) {
      open = false;
    }
  }
  return cycles;
}
