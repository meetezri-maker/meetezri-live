import { normalizePhoneme } from "../lipsync/PhonemeNormalizer";
import {
  HYPER3D_MOTION_PROFILE,
  HYPER3D_PROMINENCE,
  HYPER3D_SEGMENTATION,
  expressionCharacter,
  type Hyper3dProminenceLevel
} from "../../mappings/avatars/hyper3dPerformanceProfile";
import type { HeadPose } from "./hyper3dTrajectory";

/**
 * HYPER3D FINAL SPEAKING PERFORMANCE — the performance planner.
 *
 *   AUDIO + MFA -> PERFORMANCE PLANNER -> one head/neck motion owner
 *
 * This module answers "what is the speaker DOING", in phrases and emphasis. It
 * does not answer "where is the head right now" — that is the state machine and
 * the solver in `hyper3dHeadPerformer.ts`, which consume what this produces.
 * Keeping them apart is what makes the planner testable as pure timing analysis
 * and keeps motion behaviour out of the linguistics.
 *
 * DETERMINISM. There is no `Math.random` in this file and nothing reads a clock.
 * The same phonemes, pauses and expression always yield a byte-identical plan,
 * which is the property the whole review depends on: the reviewer and the test
 * suite are looking at the same performance.
 *
 * The small deterministic hash below is not randomness. It is a fixed function
 * of the phrase index, used so consecutive phrase poses differ from one another
 * without a table of hand-authored values. Given the same input it returns the
 * same number forever.
 *
 * WHAT IS NOT AVAILABLE HERE, and what that costs:
 *
 * The project has no F0 extraction and no decoded-audio RMS on the planning
 * path — the payload carries MFA phoneme timings plus a per-phoneme `intensity`
 * and nothing else. Prominence is therefore derived from timing and that
 * intensity, and pitch movement is not consulted at all. That is a real
 * limitation and it is reported rather than papered over: `ProminenceFeatures`
 * carries `f0Available: false` so the panel and the tests can see exactly which
 * evidence a decision was made on. Adding a pitch tracker is a Stage-3-sized
 * dependency and the brief explicitly defers it.
 */

// ---------------------------------------------------------------------------
// inputs
// ---------------------------------------------------------------------------

export interface PlannerPhoneme {
  phoneme: string;
  start_time: number;
  end_time: number;
  /** Payload energy proxy in 0..1. The only acoustic evidence available. */
  intensity?: number;
}

export interface PlannerPause {
  start_time: number;
  end_time: number;
  type?: string;
}

/** Optional word timings. Consumed when present, never required. */
export interface PlannerWord {
  word: string;
  start_time: number;
  end_time: number;
}

export interface PerformancePlanInput {
  phonemes: PlannerPhoneme[];
  pauses?: PlannerPause[];
  words?: PlannerWord[];
  /** The active Stage-1/Stage-2 semantic expression, or null. */
  expression?: string | null;
}

// ---------------------------------------------------------------------------
// segmentation
// ---------------------------------------------------------------------------

export type PauseKind = "short" | "long";

export interface PauseSegment {
  start: number;
  end: number;
  duration: number;
  kind: PauseKind;
  /** Where the silence came from: the payload's own pause list, or an MFA gap. */
  source: "payload" | "mfa-gap";
}

export interface PhraseSegment {
  id: number;
  start: number;
  end: number;
  duration: number;
  /** Phonemes wholly inside this phrase, in order. */
  phonemes: PlannerPhoneme[];
  /** Short pauses the phrase holds through. */
  internalPauses: PauseSegment[];
  /** The pause that ended this phrase, or null for the last one. */
  closingPause: PauseSegment | null;
  /** Deterministic held pose for this phrase, in degrees. */
  targetPose: HeadPose;
  /** Why this phrase got that pose. Instrumentation, not decoration. */
  poseReason: string;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * Collects every silence in the utterance, from both available sources.
 *
 * The payload's own `pauses` are authoritative where they exist — they carry a
 * semantic type — but MFA also leaves gaps between phones that no pause covers,
 * and a phrase boundary is a phrase boundary regardless of which source noticed
 * it. Gaps already covered by a payload pause are dropped so a boundary is not
 * counted twice.
 */
export const collectPauses = (input: PerformancePlanInput): PauseSegment[] => {
  const { minSilenceSeconds, phraseBreakSeconds } = HYPER3D_SEGMENTATION;
  const kindOf = (duration: number): PauseKind => (duration >= phraseBreakSeconds ? "long" : "short");
  const out: PauseSegment[] = [];

  for (const pause of input.pauses ?? []) {
    const duration = pause.end_time - pause.start_time;
    if (duration < minSilenceSeconds) continue;
    out.push({ start: pause.start_time, end: pause.end_time, duration, kind: kindOf(duration), source: "payload" });
  }

  const phonemes = [...input.phonemes].sort((a, b) => a.start_time - b.start_time);
  for (let i = 1; i < phonemes.length; i++) {
    const start = phonemes[i - 1].end_time;
    const end = phonemes[i].start_time;
    const duration = end - start;
    if (duration < minSilenceSeconds) continue;
    if (out.some((p) => overlaps(p.start, p.end, start, end))) continue;
    out.push({ start, end, duration, kind: kindOf(duration), source: "mfa-gap" });
  }

  return out.sort((a, b) => a.start - b.start);
};

const isVowelPhone = (phoneme: string) => {
  const normalized = normalizePhoneme(phoneme);
  if (!normalized) return false;
  // ARPABET nuclei. The glides W and Y are deliberately excluded: they are
  // syllable ONSETS, and counting them as nuclei doubles the candidate count on
  // exactly the words ("your", "way") where it would misplace an emphasis.
  return /^(AA|AE|AH|AO|AW|AX|AXR|AY|EH|ER|EY|IH|IX|IY|OW|OY|UH|UW|UX)$/.test(normalized);
};

/**
 * Deterministic integer hash. Same index always yields the same number.
 * Not randomness — a fixed, repeatable function used in place of a lookup table.
 */
const hash = (n: number, salt: number) => {
  let x = Math.imul(n + salt * 0x9e37, 0x85eb) ^ 0xc2b2;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff;
};

/**
 * Splits the utterance into phrases at LONG pauses only.
 *
 * A short pause is structure the head holds through — a breath, a comma — and
 * breaking on it is what produces a new pose every couple of words. Only a real
 * boundary earns a move. Fragments shorter than `minPhraseSeconds` are merged
 * back into the previous phrase rather than posed on their own.
 */
export const segmentPhrases = (input: PerformancePlanInput): { phrases: PhraseSegment[]; pauses: PauseSegment[] } => {
  const phonemes = [...input.phonemes].sort((a, b) => a.start_time - b.start_time);
  const pauses = collectPauses(input);
  if (!phonemes.length) return { phrases: [], pauses };

  const spanStart = phonemes[0].start_time;
  const spanEnd = phonemes[phonemes.length - 1].end_time;
  const breaks = pauses.filter((p) => p.kind === "long" && p.start > spanStart && p.end < spanEnd);

  interface Bounds {
    start: number;
    end: number;
    closingPause: PauseSegment | null;
  }
  const bounds: Bounds[] = [];
  let cursor = spanStart;
  for (const brk of breaks) {
    if (brk.start > cursor) bounds.push({ start: cursor, end: brk.start, closingPause: brk });
    cursor = Math.max(cursor, brk.end);
  }
  if (spanEnd > cursor) bounds.push({ start: cursor, end: spanEnd, closingPause: null });
  if (!bounds.length) bounds.push({ start: spanStart, end: spanEnd, closingPause: null });

  // Merge fragments too short to be worth a pose of their own.
  const merged: Bounds[] = [];
  for (const b of bounds) {
    const previous = merged[merged.length - 1];
    if (previous && b.end - b.start < HYPER3D_SEGMENTATION.minPhraseSeconds) {
      previous.end = b.end;
      previous.closingPause = b.closingPause;
      continue;
    }
    merged.push({ ...b });
  }

  const character = expressionCharacter(input.expression);
  const longest = merged.reduce((max, b) => Math.max(max, b.end - b.start), 0) || 1;

  const phrases: PhraseSegment[] = merged.map((b, id) => {
    const duration = b.end - b.start;
    const inside = phonemes.filter((p) => p.start_time >= b.start - 1e-9 && p.end_time <= b.end + 1e-9);
    const internalPauses = pauses.filter((p) => p.kind === "short" && p.start >= b.start && p.end <= b.end);
    const isLast = id === merged.length - 1;

    /**
     * The phrase pose.
     *
     * Yaw alternates side so the head explores both ways and comes back rather
     * than drifting one direction across an utterance, and its magnitude scales
     * with how much of the utterance this phrase carries — a long phrase earns a
     * bigger turn than a fragment. Pitch leans very slightly down through the
     * body of the utterance and lifts on the last phrase, which is what a
     * speaker does when they finish a thought. Roll is the smallest term and
     * exists only so the pose is not a pure two-axis turn.
     *
     * Everything is generated INSIDE the normal band, never at the hard cap; the
     * cap is headroom for a gesture stacked on top, not a target.
     */
    const share = duration / longest;
    const yawSide = id % 2 === 0 ? 1 : -1;
    const yawMagnitude = HYPER3D_MOTION_PROFILE.normalYawMax * (0.45 + 0.55 * (0.4 * hash(id, 1) + 0.6 * share));
    const pitchMagnitude = HYPER3D_MOTION_PROFILE.normalPitchMax * (0.3 + 0.5 * hash(id, 2));
    const rollMagnitude = HYPER3D_MOTION_PROFILE.normalRollMax * (hash(id, 3) * 2 - 1) * 0.8;

    const targetPose: HeadPose = {
      yaw: yawSide * yawMagnitude * character.poseAmplitude,
      pitch: (isLast ? -pitchMagnitude * 0.6 : pitchMagnitude) * character.poseAmplitude,
      roll: rollMagnitude * character.poseAmplitude
    };

    return {
      id,
      start: b.start,
      end: b.end,
      duration,
      phonemes: inside,
      internalPauses,
      closingPause: b.closingPause,
      targetPose: clampToNormalBand(targetPose),
      poseReason: `phrase ${id}: ${duration.toFixed(2)}s (${(share * 100).toFixed(0)}% of the longest), yaw side ${yawSide > 0 ? "left" : "right"}${isLast ? ", final phrase lifts" : ""}`
    };
  });

  return { phrases, pauses };
};

/** Keeps a planned pose inside the normal band. The hard caps are enforced later. */
export const clampToNormalBand = (pose: HeadPose): HeadPose => {
  const p = HYPER3D_MOTION_PROFILE;
  const bound = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  return {
    yaw: bound(pose.yaw, p.normalYawMax),
    pitch: bound(pose.pitch, p.normalPitchMax),
    roll: bound(pose.roll, p.normalRollMax)
  };
};

// ---------------------------------------------------------------------------
// prominence
// ---------------------------------------------------------------------------

/**
 * One syllable-sized candidate: a vowel nucleus and whatever surrounds it up to
 * the neighbouring nuclei. Prominence is a property of a syllable, not of a
 * phone, so scoring phones directly would mark long consonants.
 */
export interface ProminenceUnit {
  phraseId: number;
  index: number;
  /** The nucleus itself. */
  phoneme: string;
  start: number;
  end: number;
  /** Where a gesture would land: the nucleus midpoint. */
  apexTime: number;
  /** The word this nucleus falls in, when word timings were supplied. */
  word: string | null;
}

/**
 * Which distribution a candidate's z-scores were taken against.
 *
 * `phrase-local` is preferred and is what the architecture describes.
 * `clip-local` is the deterministic fallback for a phrase too small to carry a
 * distribution. `none` means neither basis had enough samples, and the candidate
 * is NONE because nothing could be claimed — not because it scored low.
 */
export type NormalizationBasis = "phrase-local" | "clip-local" | "none";

export interface ProminenceFeatures {
  /** Raw payload intensity of the nucleus. */
  energy: number;
  /** Raw nucleus duration, in seconds. */
  duration: number;
  /** Position inside the phrase, 0 at phrase start, 1 at phrase end. */
  phrasePosition: number;
  /** Normalized (z-score) evidence, against `normalizationBasis`. */
  energyZ: number;
  durationZ: number;
  /** Positional evidence: nuclear stress sits late in a phrase. Always phrase-local. */
  positionScore: number;
  /** Weighted combination of the three normalized terms. */
  score: number;
  /** Which distribution the z-scores were taken against. */
  normalizationBasis: NormalizationBasis;
  /** How many candidates that distribution was built from. */
  sampleCount: number;
  /**
   * The highest score this basis could produce for ANY candidate. Reported so a
   * classification can be read against what was reachable rather than against
   * the thresholds alone — see `maxAttainableScore`.
   */
  maxAttainableScore: number;
  /** False on this project: no pitch tracker exists on the planning path. */
  f0Available: false;
}

export interface ProminenceEvent {
  id: string;
  phraseId: number;
  unitIndex: number;
  apexTime: number;
  /** The nucleus this candidate is, and the word it fell in when known. */
  phoneme: string;
  word: string | null;
  level: Hyper3dProminenceLevel;
  features: ProminenceFeatures;
  /** Why this unit was classified the way it was. Logged for review. */
  reason: string;
}

const meanOf = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const stdOf = (values: number[], mean: number) => {
  if (values.length < 2) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
};

/** Vowel nuclei of one phrase, in order, tagged with their word when known. */
export const prominenceUnits = (phrase: PhraseSegment, words?: PlannerWord[]): ProminenceUnit[] => {
  const units: ProminenceUnit[] = [];
  for (const p of phrase.phonemes) {
    if (!isVowelPhone(p.phoneme)) continue;
    const word = words?.find((w) => p.start_time >= w.start_time - 1e-9 && p.end_time <= w.end_time + 1e-9)?.word ?? null;
    units.push({
      phraseId: phrase.id,
      index: units.length,
      phoneme: p.phoneme,
      start: p.start_time,
      end: p.end_time,
      apexTime: (p.start_time + p.end_time) / 2,
      word
    });
  }
  return units;
};

/**
 * NORMALIZATION SUFFICIENCY — how many candidates a distribution needs.
 *
 * This is the answer to "is a phrase-local z-score statistically useful here",
 * and it is derived rather than guessed. For a population of n samples the
 * largest achievable |z| is bounded:
 *
 *   max |z| = (n - 1) / sqrt(n)
 *
 * because the most extreme case is one sample against n-1 identical others. So
 * with the current PROVISIONAL weights the best score any candidate could ever
 * reach on a basis of n samples is
 *
 *   maxScore(n) = maxZ(n) * (wEnergy + wDuration) + wPosition
 *
 * and if that is below the STRONG threshold, the basis literally cannot express
 * the full classification range. Reporting a level from it would be pretending.
 *
 * Worked, for the shipped weights (0.45/0.35/0.20) and thresholds (0.85/1.15/1.55):
 *
 *   n = 2  maxZ 0.707  maxScore 0.77   <- cannot even reach WEAK
 *   n = 3  maxZ 1.155  maxScore 1.12   <- cannot reach MEDIUM
 *   n = 4  maxZ 1.500  maxScore 1.40   <- cannot reach STRONG
 *   n = 5  maxZ 1.789  maxScore 1.63   <- full range reachable
 *
 * So five candidates is the honest minimum for a phrase-local basis, and a
 * phrase with fewer falls back to the clip-local distribution. This is all
 * ISOLATED INSIDE THE DETECTOR: the planner, the state machine, the trajectory
 * solver, the ownership seam, the caps and the rig distribution are untouched by
 * it, and they see the same `ProminenceEvent[]` they saw before.
 */
export const maxAttainableZ = (sampleCount: number) =>
  sampleCount <= 1 ? 0 : (sampleCount - 1) / Math.sqrt(sampleCount);

export const maxAttainableScore = (sampleCount: number) => {
  const { weights } = HYPER3D_PROMINENCE;
  return maxAttainableZ(sampleCount) * (weights.energy + weights.duration) + weights.position;
};

/** A basis is usable only when the FULL classification range is reachable from it. */
export const normalizationIsSufficient = (sampleCount: number) =>
  sampleCount >= HYPER3D_PROMINENCE.absoluteMinSamples &&
  maxAttainableScore(sampleCount) >= HYPER3D_PROMINENCE.thresholds.strong;

/** The raw evidence a normalization basis is built from. */
export interface NormalizationSamples {
  energies: number[];
  durations: number[];
}

interface NormalizationStats {
  basis: NormalizationBasis;
  sampleCount: number;
  energyMean: number;
  energyStd: number;
  durationMean: number;
  durationStd: number;
  maxScore: number;
}

const statsFor = (basis: NormalizationBasis, samples: NormalizationSamples): NormalizationStats => {
  const energyMean = meanOf(samples.energies);
  const durationMean = meanOf(samples.durations);
  return {
    basis,
    sampleCount: samples.energies.length,
    energyMean,
    energyStd: stdOf(samples.energies, energyMean),
    durationMean,
    durationStd: stdOf(samples.durations, durationMean),
    maxScore: maxAttainableScore(samples.energies.length)
  };
};

const energyOf = (phrase: PhraseSegment, unit: ProminenceUnit) =>
  phrase.phonemes.find((p) => p.start_time === unit.start && p.end_time === unit.end)?.intensity ?? 0;

/** Every nucleus in the clip, which is the fallback distribution. */
export const collectClipSamples = (phrases: PhraseSegment[], words?: PlannerWord[]): NormalizationSamples => {
  const energies: number[] = [];
  const durations: number[] = [];
  for (const phrase of phrases) {
    for (const unit of prominenceUnits(phrase, words)) {
      energies.push(energyOf(phrase, unit));
      durations.push(unit.end - unit.start);
    }
  }
  return { energies, durations };
};

export interface ProminenceContext {
  words?: PlannerWord[];
  /** The clip-wide distribution, used when a phrase is too small for its own. */
  clipSamples?: NormalizationSamples;
}

/**
 * Classifies every nucleus in a phrase.
 *
 * Evidence is normalized against the SMALLEST basis that is statistically usable:
 *
 *   1. the phrase's own nuclei, when there are enough of them
 *   2. otherwise the whole clip's nuclei, which is deterministic and is still
 *      local to this utterance
 *   3. otherwise nothing is claimed and every candidate is NONE, with the reason
 *      recorded as insufficient evidence rather than as a low score
 *
 * Normalizing locally at all is the point: a quiet phrase still has a
 * most-prominent syllable and a loud one must not mark all of them. That is what
 * the old fixed weighted formula could not do — it compared absolute values
 * against constants, so a loud clip emphasised everything and a quiet clip
 * emphasised nothing. What is new here is only refusing to normalize against a
 * distribution too small to mean anything.
 *
 * The POSITION term is always phrase-local, because "late in the phrase" is a
 * fact about the phrase regardless of which basis the acoustics came from.
 */
export const detectProminence = (phrase: PhraseSegment, context: ProminenceContext = {}): ProminenceEvent[] => {
  const units = prominenceUnits(phrase, context.words);
  const energies = units.map((unit) => energyOf(phrase, unit));
  const durations = units.map((unit) => unit.end - unit.start);

  const phraseStats = statsFor("phrase-local", { energies, durations });
  const clipStats = context.clipSamples ? statsFor("clip-local", context.clipSamples) : null;

  const stats: NormalizationStats = normalizationIsSufficient(phraseStats.sampleCount)
    ? phraseStats
    : clipStats && normalizationIsSufficient(clipStats.sampleCount)
      ? clipStats
      : { ...phraseStats, basis: "none" };

  const { weights, thresholds } = HYPER3D_PROMINENCE;
  const classify = (score: number): Hyper3dProminenceLevel =>
    score >= thresholds.strong ? "STRONG" : score >= thresholds.medium ? "MEDIUM" : score >= thresholds.weak ? "WEAK" : "NONE";

  return units.map((unit, i) => {
    const energy = energies[i];
    const duration = durations[i];
    const phrasePosition = phrase.duration > 0 ? (unit.apexTime - phrase.start) / phrase.duration : 0;
    /**
     * Nuclear stress falls late in an English phrase, so the back half gets
     * positional credit and the front half none. Expressed on the same scale as
     * the z-scores so the weights mean what they look like.
     */
    const positionScore = phrasePosition < 0.5 ? 0 : (phrasePosition - 0.5) * 2;

    const usable = stats.basis !== "none";
    const energyZ = usable && stats.energyStd > 1e-6 ? (energy - stats.energyMean) / stats.energyStd : 0;
    const durationZ = usable && stats.durationStd > 1e-6 ? (duration - stats.durationMean) / stats.durationStd : 0;
    const score = usable ? weights.energy * energyZ + weights.duration * durationZ + weights.position * positionScore : 0;
    const level = usable ? classify(score) : "NONE";

    const missed =
      level !== "NONE"
        ? ""
        : usable
          ? ` — ${score.toFixed(2)} is below the WEAK threshold ${thresholds.weak}`
          : ` — no usable normalization basis: the phrase has ${phraseStats.sampleCount} nuclei and the clip ` +
            `${clipStats?.sampleCount ?? 0}, and the full range needs a basis whose maxAttainableScore reaches ` +
            `${thresholds.strong}. Nothing is claimed.`;

    const reason =
      `${unit.phoneme}${unit.word ? ` in "${unit.word}"` : ""} @${unit.apexTime.toFixed(2)}s: ` +
      `energy ${energy.toFixed(2)} (z ${energyZ.toFixed(2)}) x${weights.energy}, ` +
      `duration ${duration.toFixed(3)}s (z ${durationZ.toFixed(2)}) x${weights.duration}, ` +
      `phrase position ${phrasePosition.toFixed(2)} (score ${positionScore.toFixed(2)}) x${weights.position} ` +
      `-> ${score.toFixed(2)} = ${level}${missed} ` +
      `[basis ${stats.basis}, n=${stats.sampleCount}, max reachable ${stats.maxScore.toFixed(2)}] ` +
      `(PROVISIONAL weights; no F0 evidence: this project has no pitch tracker on the planning path)`;

    return {
      id: `prom-${phrase.id}-${unit.index}`,
      phraseId: phrase.id,
      unitIndex: unit.index,
      apexTime: unit.apexTime,
      phoneme: unit.phoneme,
      word: unit.word,
      level,
      features: {
        energy,
        duration,
        phrasePosition,
        energyZ,
        durationZ,
        positionScore,
        score,
        normalizationBasis: stats.basis,
        sampleCount: stats.sampleCount,
        maxAttainableScore: stats.maxScore,
        f0Available: false
      },
      reason
    };
  });
};

// ---------------------------------------------------------------------------
// the candidate table
// ---------------------------------------------------------------------------

/**
 * One row of the prominence candidate table — every number behind a decision.
 *
 * This exists because "the clip barely generates a gesture" is not something you
 * can act on without seeing the arithmetic. It is pure derived data, so it can be
 * printed for review, asserted in tests, or rendered in the panel without any of
 * them recomputing the detector.
 */
export interface ProminenceTableRow {
  time: number;
  nucleus: string;
  word: string | null;
  phraseId: number;
  intensity: number;
  normalizedIntensity: number;
  duration: number;
  normalizedDuration: number;
  phrasePositionTerm: number;
  score: number;
  classification: Hyper3dProminenceLevel;
  normalizationBasis: NormalizationBasis;
  sampleCount: number;
  maxAttainableScore: number;
  /** Empty when the candidate was classified; otherwise why it was not. */
  rejectionReason: string;
}

const rejectionFor = (event: ProminenceEvent): string => {
  if (event.level !== "NONE") return "";
  const { thresholds } = HYPER3D_PROMINENCE;
  if (event.features.normalizationBasis === "none") {
    return `no usable normalization basis (n=${event.features.sampleCount}, max reachable ${event.features.maxAttainableScore.toFixed(2)})`;
  }
  const shortfall = thresholds.weak - event.features.score;
  return `score ${event.features.score.toFixed(3)} < WEAK ${thresholds.weak} (short by ${shortfall.toFixed(3)})`;
};

export const prominenceTable = (plan: PerformancePlan): ProminenceTableRow[] => {
  return plan.prominence.map((event) => ({
    time: event.apexTime,
    nucleus: event.phoneme,
    word: event.word,
    phraseId: event.phraseId,
    intensity: event.features.energy,
    normalizedIntensity: event.features.energyZ,
    duration: event.features.duration,
    normalizedDuration: event.features.durationZ,
    phrasePositionTerm: event.features.positionScore,
    score: event.features.score,
    classification: event.level,
    normalizationBasis: event.features.normalizationBasis,
    sampleCount: event.features.sampleCount,
    maxAttainableScore: event.features.maxAttainableScore,
    rejectionReason: rejectionFor(event)
  }));
};

/** The same table as fixed-width text, for the review log and the debug output. */
export const formatProminenceTable = (plan: PerformancePlan): string => {
  const rows = prominenceTable(plan);
  const header = [
    "time".padStart(6),
    "nucl".padEnd(4),
    "word".padEnd(6),
    "ph".padStart(2),
    "intens".padStart(6),
    "normI".padStart(7),
    "dur".padStart(6),
    "normD".padStart(7),
    "posTrm".padStart(6),
    "score".padStart(7),
    "class".padEnd(6),
    "basis".padEnd(18),
    "rejection reason"
  ].join(" | ");
  const body = rows.map((r) =>
    [
      r.time.toFixed(3).padStart(6),
      r.nucleus.padEnd(4),
      (r.word ?? "-").padEnd(6),
      String(r.phraseId).padStart(2),
      r.intensity.toFixed(3).padStart(6),
      r.normalizedIntensity.toFixed(3).padStart(7),
      r.duration.toFixed(3).padStart(6),
      r.normalizedDuration.toFixed(3).padStart(7),
      r.phrasePositionTerm.toFixed(3).padStart(6),
      r.score.toFixed(3).padStart(7),
      r.classification.padEnd(6),
      `${r.normalizationBasis} n=${r.sampleCount}`.padEnd(18),
      r.rejectionReason
    ].join(" | ")
  );
  const perPhrase = plan.phrases
    .map((phrase) => {
      const events = plan.prominence.filter((e) => e.phraseId === phrase.id);
      const basis = events[0]?.features.normalizationBasis ?? "none";
      return `  phrase ${phrase.id}: ${events.length} candidates, basis ${basis}, max reachable ${maxAttainableScore(events.length).toFixed(2)} from its own ${events.length}`;
    })
    .join("\n");

  const { weights, thresholds } = HYPER3D_PROMINENCE;
  return [
    `PROMINENCE CANDIDATES — PROVISIONAL weights energy ${weights.energy} / duration ${weights.duration} / position ${weights.position}`,
    `thresholds WEAK ${thresholds.weak}  MEDIUM ${thresholds.medium}  STRONG ${thresholds.strong}`,
    `F0 available: ${plan.evidence.f0Available}   energy source: ${plan.evidence.energySource}`,
    "candidates per phrase:",
    perPhrase,
    "",
    header,
    "-".repeat(header.length),
    ...body
  ].join("\n");
};

// ---------------------------------------------------------------------------
// the shared event stream
// ---------------------------------------------------------------------------

/**
 * §13 — the shared event structure.
 *
 * One event stream, several consumers:
 *
 *   event
 *   ├── face response      (Stage 2, already shipping — unchanged)
 *   ├── head response      (this stage)
 *   ├── future gaze response
 *   └── future blink opportunity
 *
 * The head consumer is implemented in `hyper3dHeadPerformer.ts`. `gaze` and
 * `blink` are declared and left null ON PURPOSE: Stage 3 is out of scope, and a
 * consumer that has to be invented later is a consumer the event shape was never
 * designed for. Nothing here schedules a gaze shift or a blink.
 */
export type PerformanceEventType = "phrase-start" | "phrase-end" | "short-pause" | "long-pause" | "prominence";

export interface PerformanceEvent {
  id: string;
  type: PerformanceEventType;
  time: number;
  phraseId: number;
  /** Present on prominence events only. */
  prominence?: ProminenceEvent;
  reason: string;
  /**
   * Which responses this event is available to. `head` is consumed now; the
   * other three are reserved and deliberately unimplemented.
   */
  responses: {
    face: boolean;
    head: boolean;
    gaze: null;
    blink: null;
  };
}

export interface PerformancePlan {
  phrases: PhraseSegment[];
  pauses: PauseSegment[];
  prominence: ProminenceEvent[];
  events: PerformanceEvent[];
  spanStart: number;
  spanEnd: number;
  expression: string | null;
  /** What evidence the plan was actually built from. Reported, not assumed. */
  evidence: {
    phonemeCount: number;
    wordTimingsAvailable: boolean;
    f0Available: false;
    energySource: "payload-phoneme-intensity";
  };
}

/**
 * Builds the whole plan. Pure: same input, same output, every time.
 */
export const buildPerformancePlan = (input: PerformancePlanInput): PerformancePlan => {
  const { phrases, pauses } = segmentPhrases(input);
  /**
   * Built once and handed to every phrase, so the fallback basis is the same
   * distribution for all of them and the plan stays deterministic.
   */
  const clipSamples = collectClipSamples(phrases, input.words);
  const prominence = phrases.flatMap((phrase) => detectProminence(phrase, { words: input.words, clipSamples }));

  const events: PerformanceEvent[] = [];
  const responses = () => ({ face: true, head: true, gaze: null, blink: null });

  for (const phrase of phrases) {
    events.push({
      id: `phrase-${phrase.id}-start`,
      type: "phrase-start",
      time: phrase.start,
      phraseId: phrase.id,
      reason: phrase.poseReason,
      responses: responses()
    });
    for (const pause of phrase.internalPauses) {
      events.push({
        id: `pause-${phrase.id}-${pause.start.toFixed(3)}`,
        type: "short-pause",
        time: pause.start,
        phraseId: phrase.id,
        reason: `short pause ${pause.duration.toFixed(2)}s (${pause.source}) — under the ${HYPER3D_SEGMENTATION.phraseBreakSeconds}s break threshold, the head holds through it`,
        responses: responses()
      });
    }
    events.push({
      id: `phrase-${phrase.id}-end`,
      type: "phrase-end",
      time: phrase.end,
      phraseId: phrase.id,
      reason: phrase.closingPause
        ? `phrase ${phrase.id} ends on a ${phrase.closingPause.duration.toFixed(2)}s ${phrase.closingPause.source} pause`
        : `phrase ${phrase.id} ends the utterance`,
      responses: responses()
    });
    if (phrase.closingPause) {
      events.push({
        id: `pause-long-${phrase.id}`,
        type: "long-pause",
        time: phrase.closingPause.start,
        phraseId: phrase.id,
        reason: `long pause ${phrase.closingPause.duration.toFixed(2)}s (${phrase.closingPause.source}) — a phrase boundary`,
        responses: responses()
      });
    }
  }

  for (const event of prominence) {
    events.push({
      id: event.id,
      type: "prominence",
      time: event.apexTime,
      phraseId: event.phraseId,
      prominence: event,
      reason: event.reason,
      responses: responses()
    });
  }

  events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));

  const phonemes = [...input.phonemes].sort((a, b) => a.start_time - b.start_time);

  return {
    phrases,
    pauses,
    prominence,
    events,
    spanStart: phonemes.length ? phonemes[0].start_time : 0,
    spanEnd: phonemes.length ? phonemes[phonemes.length - 1].end_time : 0,
    expression: input.expression ?? null,
    evidence: {
      phonemeCount: phonemes.length,
      wordTimingsAvailable: Boolean(input.words?.length),
      f0Available: false,
      energySource: "payload-phoneme-intensity"
    }
  };
};
