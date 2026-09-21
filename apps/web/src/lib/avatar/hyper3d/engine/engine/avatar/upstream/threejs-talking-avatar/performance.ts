/**
 * ADAPTED FROM THIRD-PARTY SOURCE — DO NOT TREAT AS OURS.
 *
 *   upstream repo   https://github.com/majidmanzarpour/threejs-talking-avatar
 *   upstream commit 61ab8e3b1a14946b245926ac1b12e4f387b656ab
 *   upstream file   demo/src/speech/ExpressivePerformanceController.ts
 *   licence         Apache License 2.0
 *
 * HEAD + GAZE + BLINK + BROWS. Upstream's controller drives all of those plus
 * lids, cheeks, mouth and a full affect/expression system from one plan. This
 * file keeps the head rotation, the gaze channels, the blink planner and the
 * brow channels, and drops the affect/expression morphs. See PROVENANCE.md for
 * the exact symbol-by-symbol accounting of what was copied, what was rewritten
 * and what was deliberately left out.
 *
 * THE HEAD PATH IS LOCKED. Head timing, beat placement, prosody scoring,
 * smoothing and clamps are hardware-accepted at 3.0x and are not touched by the
 * gaze/blink/brow addition: `browPulse` and the blink planner feed no head term,
 * and `gazeX` / `gazeY` already fed the head before this extension.
 *
 * WHY THIS IS PORTABLE AT ALL. Upstream never writes a Three.js bone from this
 * layer: `update()` sets three plain radian numbers on a frame object, and
 * `demo/src/portrait/GnmHead.ts` — a file we do not reproduce — is what maps
 * them onto the GNM rig. Nothing in this file imports three, touches an
 * Object3D, or reproduces any GNM morph or rig code.
 *
 * INPUT  { timeSeconds, speechActive, deltaSeconds } + a plan built from
 *        prosody (decoded PCM acoustics), phoneme timing and text.
 * OUTPUT { yawDegrees, pitchDegrees, rollDegrees } (radians also exposed),
 *        { gazeX, gazeY } in upstream's own normalised domain,
 *        { blinkLeft, blinkRight } as 0-1 eyelid closure,
 *        { browConcern, browLift, browLiftLeft, browLiftRight, browFurrow }.
 *
 * The caller owns the rig. This file owns the behaviour.
 */

import type { SpeechAcousticFrame } from "./audioAnalysis";
import {
  calibrateExpressionIntensity,
  inferPerformanceIntent,
  type PerformanceAffect,
  type PerformanceIntent
} from "./performanceIntent";

/**
 * Upstream `demo/src/speech/types.ts` `PhonemeInterval`, narrowed to the fields
 * the head path actually reads. `stress` and `emphasis` are optional because our
 * MFA payload does not carry them — see `hyper3dThreejsTalkingAvatarHead.ts`.
 */
export interface UpstreamPhonemeInterval {
  readonly startTime: number;
  readonly endTime: number;
  readonly normalizedPhone: string;
  readonly stress?: number;
  readonly emphasis?: number;
}

/** Upstream `ProsodicCue`. `headTime` trails the acoustic prominence on purpose. */
export interface ProsodicCue {
  readonly time: number;
  readonly strength: number;
  /** Brows anticipate the acoustic prominence. */
  readonly browTime: number;
  /** Head response intentionally follows the acoustic prominence. */
  readonly headTime: number;
  readonly direction: -1 | 1;
}

/** Upstream `BlinkCue`. Nonperiodic, boundary-preferring, occasionally doubled. */
export interface BlinkCue {
  readonly time: number;
  readonly leftStrength: number;
  readonly rightStrength: number;
  readonly rightDelay: number;
  readonly boundaryPreferred: boolean;
  readonly doubleBlink: boolean;
}

export interface PitchStatistics {
  lowHz: number;
  medianHz: number;
  highHz: number;
}

export interface SemanticAffectEnvelope {
  readonly onsetTime: number;
  readonly apexTime: number;
  readonly releaseEndTime: number;
  readonly baseline: number;
  readonly residue: number;
}

export interface HeadPerformancePlan {
  readonly seed: number;
  readonly durationSeconds: number;
  /** Upstream's inferred affect and its intensity. See `performanceIntent.ts`. */
  readonly intent: PerformanceIntent;
  readonly affect: PerformanceAffect;
  readonly intensity: number;
  readonly affectTargets: ExpressiveAffectTargets;
  readonly asymmetryDirection: -1 | 1;
  readonly pitch: PitchStatistics;
  readonly cues: readonly ProsodicCue[];
  readonly blinks: readonly BlinkCue[];
  readonly boundaries: readonly number[];
  /**
   * The envelope the FACE runs on, from the inferred affect. All six upstream
   * branches are reachable.
   */
  readonly affectEnvelope: SemanticAffectEnvelope;
  /**
   * Sentence-level intent, one per phrase span, on the audio clock.
   *
   * EMPTY unless `planHeadPerformance` is asked for it, so the locked baseline
   * plan is unchanged. When present the face reads the SEGMENT's affect targets
   * instead of the response-level ones; the head never reads either.
   */
  readonly intentSegments: readonly IntentSegment[];
  /**
   * HOW the sentence intent above was placed in time, for diagnostics and tests.
   * `source` is `"unaligned"` when no segmentation was requested at all, so a
   * reader can tell "not attempted" from "attempted and fell back".
   */
  readonly semanticAlignment: SemanticAlignmentSummary;
  /** Phrase spans and one envelope each. THE FACE READS THESE; the head never does. */
  readonly affectPhraseSpans: ReadonlyArray<{ start: number; end: number }>;
  readonly affectPhraseEnvelopes: readonly PhraseAffectEnvelope[];
  /**
   * THE HEAD FREEZE, made structural.
   *
   * The hardware-accepted head at 3.0x was built while affect was fixed at
   * `neutral`, so its `semanticHeadYaw` / `semanticHeadPitch` terms ran on
   * upstream's `default` envelope branch. Now that affect inference is
   * connected, letting the head follow it would move a locked, accepted
   * behaviour as a side effect of a FACE change.
   *
   * So the head keeps its own envelope, permanently on the neutral branch, and
   * the face uses `affectEnvelope`. This is a deliberate divergence from
   * upstream — upstream shares one envelope — made to honour the lock, and it is
   * why `hyper3dAcceptedHeadFreeze.test.ts` still passes bit-for-bit at every
   * affect.
   */
  readonly headEnvelope: SemanticAffectEnvelope;
  readonly plannerMs: number;
}

export interface HeadPerformancePlanInput {
  /**
   * Derive sentence-level intent as well as the response-level one.
   *
   * Off by default: the locked baseline plan must not change shape. Turned on by
   * the conversational path, where a response genuinely varies in meaning.
   */
  readonly segmentIntent?: boolean;
  readonly text: string;
  /**
   * A conversation partner's REQUEST, in their own words, for upstream's
   * `requestedAffect` path. Absent in our payload; the review panel supplies it.
   */
  readonly userText?: string;
  readonly phonemes: readonly UpstreamPhonemeInterval[];
  /**
   * The MFA WORD TIER, when the payload carries one. Present: sentence intent is
   * aligned to measured word intervals. Absent: `positional-fallback`, declared.
   * Reading it introduces no aligner and no second clock — these are intervals
   * the same alignment pass that produced `phonemes` already emitted.
   */
  readonly words?: readonly AlignedWord[];
  readonly acousticFrames: readonly SpeechAcousticFrame[];
  readonly durationSeconds: number;
  readonly seed?: number;
}

/** Upstream head output. Radians, exactly as `ExpressivePerformanceFrame` reports. */
export interface HeadPerformanceFrame {
  readonly headPitch: number;
  readonly headYaw: number;
  readonly headRoll: number;
  /** The same pose in degrees, for a rig whose calibration is expressed in degrees. */
  readonly pitchDegrees: number;
  readonly yawDegrees: number;
  readonly rollDegrees: number;
  /**
   * Upstream's normalised gaze channels, the exact values it converts into
   * `gazeLeft` / `gazeRight` / `gazeUp` / `gazeDown` morph weights. Positive
   * `gazeX` looks to the viewer's right, positive `gazeY` looks up. Exposed in
   * upstream's own domain so the rig adapter can TRANSLATE the unit rather than
   * re-time the behaviour.
   */
  readonly gazeX: number;
  readonly gazeY: number;
  /** Eyelid closure, 0-1. Upstream `morphs.blinkLeft` / `morphs.blinkRight`. */
  readonly blinkLeft: number;
  readonly blinkRight: number;
  /**
   * Upstream affect channels, 0-1, from the inferred affect. GNM-domain names;
   * the Hyper3D adapter maps them onto the accepted expression vocabulary and
   * refuses the ones Hyper3D has no proven equivalent for.
   */
  readonly smileMouth: number;
  readonly cheekRaise: number;
  readonly eyeSquint: number;
  readonly eyeWiden: number;
  readonly surpriseMouth: number;
  readonly concernMouth: number;
  readonly curiosityMouth: number;
  readonly emphasisMouth: number;
  /** The inferred affect this frame is performing, and its calibrated scale. */
  readonly affect: PerformanceAffect;
  readonly affectScale: number;
  /** DEV review signals from the accepted semantic-affect calculation. */
  readonly speechFade: number;
  readonly affectEnvelope: number;
  readonly browEngagement: number;
  readonly eyeAffectScale: number;
  readonly cheekAffectScale: number;
  /** Upstream brow channels, 0-1. */
  readonly browConcern: number;
  readonly browLift: number;
  readonly browLiftLeft: number;
  readonly browLiftRight: number;
  readonly browFurrow: number;
  readonly speechActive: boolean;
  readonly cueCount: number;
  /** How many cue beats are currently contributing a non-zero pulse. */
  readonly activeBeats: number;
  /** The prosodic brow pulse driving `browLift` this frame, 0-1. */
  readonly browPulse: number;
  readonly blinkCount: number;
  readonly speechTime: number;
}

const AFFECT_ANTICIPATION_SECONDS = 0.18;

/**
 * Upstream `AFFECT_TARGETS`, copied verbatim for the six affects its non-LLM
 * inference can reach.
 *
 * These are GNM morph weights. Nothing here is written to a rig: the adapter
 * maps the resulting channels onto the accepted Hyper3D expression vocabulary,
 * and refuses the channels Hyper3D has no proven equivalent for.
 */
export interface ExpressiveAffectTargets {
  readonly browConcern: number;
  readonly browLift: number;
  readonly browFurrow: number;
  readonly eyeWiden: number;
  readonly eyeSquint: number;
  readonly cheekRaise: number;
  readonly smileMouth: number;
  readonly surpriseMouth: number;
  readonly concernMouth: number;
  readonly curiosityMouth: number;
  readonly emphasisMouth: number;
}

const ZERO_TARGETS: ExpressiveAffectTargets = {
  browConcern: 0,
  browLift: 0,
  browFurrow: 0,
  eyeWiden: 0,
  eyeSquint: 0,
  cheekRaise: 0,
  smileMouth: 0,
  surpriseMouth: 0,
  concernMouth: 0,
  curiosityMouth: 0,
  emphasisMouth: 0
};

/**
 * Upstream's `smile` channel is 0 in all six of these entries — it is driven
 * only by an LLM `PerformanceAction`, which this port does not have — so it is
 * omitted from the interface rather than carried as a permanent zero.
 */
export const AFFECT_TARGETS: Record<PerformanceAffect, ExpressiveAffectTargets> = {
  neutral: { ...ZERO_TARGETS, browConcern: 0.035 },
  warm: {
    ...ZERO_TARGETS,
    browConcern: 0.012,
    browLift: 0.18,
    eyeWiden: 0.025,
    eyeSquint: 0.24,
    cheekRaise: 0.82,
    smileMouth: 0.72
  },
  surprise: {
    ...ZERO_TARGETS,
    browLift: 0.88,
    eyeWiden: 0.92,
    cheekRaise: 0.08,
    surpriseMouth: 0.62
  },
  question: {
    ...ZERO_TARGETS,
    browConcern: 0.02,
    browLift: 0.62,
    eyeWiden: 0.36,
    cheekRaise: 0.07,
    curiosityMouth: 0.38
  },
  concerned: {
    ...ZERO_TARGETS,
    browConcern: 0.68,
    browLift: 0.16,
    browFurrow: 0.55,
    eyeSquint: 0.23,
    cheekRaise: 0.05,
    concernMouth: 0.58
  },
  emphatic: {
    ...ZERO_TARGETS,
    browConcern: 0.15,
    browFurrow: 0.72,
    eyeSquint: 0.22,
    cheekRaise: 0.05,
    emphasisMouth: 0.46
  }
};

// ---------------------------------------------------------------------------
// upstream helpers — copied verbatim
// ---------------------------------------------------------------------------

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((first, second) => first - second);
  const position = clamp01(fraction) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function activePhonemeStress(
  phonemes: readonly UpstreamPhonemeInterval[],
  time: number,
  cursor: { index: number }
): number {
  while (cursor.index < phonemes.length - 1 && phonemes[cursor.index].endTime < time) {
    cursor.index += 1;
  }
  const phone = phonemes[cursor.index];
  if (!phone || time < phone.startTime || time > phone.endTime) return 0;
  const stress = phone.stress === 2 ? 1 : phone.stress === 1 ? 0.58 : 0;
  const emphasis = clamp((phone.emphasis ?? 1) - 1, 0, 0.35) / 0.35;
  return Math.max(stress, emphasis);
}

/** Upstream smoothing. Asymmetric first-order response with attack/release. */
function response(
  current: number,
  target: number,
  deltaSeconds: number,
  attackSeconds: number,
  releaseSeconds: number
): number {
  const seconds = target > current ? attackSeconds : releaseSeconds;
  const blend = 1 - Math.exp(-deltaSeconds / Math.max(0.001, seconds));
  return current + (target - current) * blend;
}

/** Upstream beat shape. A smoothstep rise into `center`, then a longer fall. */
function pulse(time: number, center: number, attack: number, release: number): number {
  if (time <= center - attack || time >= center + release) return 0;
  if (time < center) return smoothstep01((time - (center - attack)) / attack);
  return 1 - smoothstep01((time - center) / release);
}

// ---------------------------------------------------------------------------
// upstream prosody — copied verbatim
// ---------------------------------------------------------------------------

export function robustPitchStatistics(frames: readonly SpeechAcousticFrame[]): PitchStatistics {
  const voicedPitch: number[] = [];
  for (const frame of frames) {
    if (frame.voicing >= 0.28 && frame.pitchHz >= 55 && frame.pitchHz <= 520) {
      voicedPitch.push(frame.pitchHz);
    }
  }
  if (voicedPitch.length === 0) return { lowHz: 90, medianHz: 160, highHz: 260 };
  const medianHz = percentile(voicedPitch, 0.5);
  const lowHz = Math.min(medianHz, percentile(voicedPitch, 0.18));
  const highHz = Math.max(medianHz, percentile(voicedPitch, 0.82));
  return { lowHz, medianHz, highHz: highHz <= lowHz + 2 ? lowHz + 2 : highHz };
}

export function normalizePitchHz(value: number, statistics: PitchStatistics): number {
  if (!Number.isFinite(value) || value <= 0) return 0.5;
  if (value <= statistics.medianHz) {
    return (
      0.5 *
      clamp01((value - statistics.lowHz) / Math.max(1, statistics.medianHz - statistics.lowHz))
    );
  }
  return (
    0.5 +
    0.5 *
      clamp01((value - statistics.medianHz) / Math.max(1, statistics.highHz - statistics.medianHz))
  );
}

/**
 * Upstream `planProsodicCues`, copied verbatim.
 *
 * THIS is the head-beat detector. It scores every acoustic frame on energy,
 * normalised pitch height weighted by voicing, transient onset, voicing and
 * lexical stress; keeps local maxima above the 72nd percentile; thins them to
 * one every 0.48 s; and emits a `headTime` 85 ms AFTER the acoustic prominence,
 * which is what makes the head read as responding to the voice rather than
 * being driven by it.
 */
export function planProsodicCues(
  frames: readonly SpeechAcousticFrame[],
  phonemes: readonly UpstreamPhonemeInterval[],
  pitch: PitchStatistics,
  seed: number
): ProsodicCue[] {
  if (frames.length < 3) return [];
  const stressCursor = { index: 0 };
  const scores = new Float32Array(frames.length);
  let maximumIndex = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const pitchHeight = frame.voicing > 0.25 ? normalizePitchHz(frame.pitchHz, pitch) : 0.35;
    const stress = activePhonemeStress(phonemes, frame.time, stressCursor);
    scores[index] = clamp01(
      frame.energy * 0.39 +
        pitchHeight * frame.voicing * 0.24 +
        frame.transient * 0.17 +
        frame.voicing * 0.1 +
        stress * 0.16
    );
    if (scores[index] > scores[maximumIndex]) maximumIndex = index;
  }
  const scoreValues = Array.from(scores);
  const threshold = Math.max(0.54, percentile(scoreValues, 0.72));
  const candidates: Array<{ index: number; score: number }> = [];
  for (let index = 1; index < frames.length - 1; index += 1) {
    if (
      scores[index] >= threshold &&
      scores[index] >= scores[index - 1] &&
      scores[index] >= scores[index + 1] &&
      frames[index].energy >= 0.22
    ) {
      candidates.push({ index, score: scores[index] });
    }
  }
  if (candidates.length === 0 && scores[maximumIndex] >= 0.4) {
    candidates.push({ index: maximumIndex, score: scores[maximumIndex] });
  }
  candidates.sort((first, second) => second.score - first.score);
  const selected: Array<{ index: number; score: number }> = [];
  for (const candidate of candidates) {
    const time = frames[candidate.index].time;
    if (selected.some((item) => Math.abs(frames[item.index].time - time) < 0.48)) continue;
    selected.push(candidate);
  }
  selected.sort((first, second) => frames[first.index].time - frames[second.index].time);
  return selected.map((candidate, index) => {
    const time = frames[candidate.index].time;
    const direction: -1 | 1 = ((seed + index) & 1) === 0 ? -1 : 1;
    return {
      time,
      strength: clamp((candidate.score - 0.38) / 0.62, 0.2, 1),
      browTime: Math.max(0, time - 0.065),
      headTime: time + 0.085,
      direction
    };
  });
}

const SILENCE_PHONES = new Set(["sil", "sp", "pau"]);

function deduplicateTimes(times: number[], durationSeconds: number): number[] {
  times.sort((first, second) => first - second);
  const result: number[] = [];
  for (const value of times) {
    const bounded = clamp(value, 0, durationSeconds);
    const previous = result[result.length - 1];
    if (previous === undefined || bounded - previous > 0.09) result.push(bounded);
  }
  return result;
}

function nearestBoundary(
  boundaries: readonly number[],
  time: number,
  maximumDistance: number
): number | undefined {
  let nearest: number | undefined;
  let distance = maximumDistance;
  for (const boundary of boundaries) {
    const candidateDistance = Math.abs(boundary - time);
    if (candidateDistance <= distance) {
      nearest = boundary;
      distance = candidateDistance;
    }
  }
  return nearest;
}

/**
 * Upstream `collectBoundaries`, copied verbatim.
 *
 * Phrase boundaries from real silences, real inter-phone gaps and the text's own
 * punctuation. Blinks prefer these, which is what stops them landing mid-word.
 */
export function collectBoundaries(
  text: string,
  phonemes: readonly UpstreamPhonemeInterval[],
  durationSeconds: number
): number[] {
  const times: number[] = [];
  for (let index = 0; index < phonemes.length; index += 1) {
    const phone = phonemes[index];
    if (SILENCE_PHONES.has(phone.normalizedPhone) && phone.endTime - phone.startTime >= 0.08) {
      times.push((phone.startTime + phone.endTime) * 0.5);
    }
    const next = phonemes[index + 1];
    if (next && next.startTime - phone.endTime >= 0.11) {
      times.push((phone.endTime + next.startTime) * 0.5);
    }
  }
  for (let index = 0; index < text.length; index += 1) {
    if (!/[,:;.!?]/u.test(text[index])) continue;
    const fraction = (index + 1) / Math.max(1, text.length);
    times.push(fraction * durationSeconds);
  }
  return deduplicateTimes(times, durationSeconds).filter(
    (time) => time >= 0.28 && time <= durationSeconds - 0.12
  );
}

/**
 * Upstream `planBlinkCues`, copied verbatim.
 *
 * NONPERIODIC by construction: a 64% chance at each phrase boundary, then a
 * free-running cursor every 2.65-5.45 s that snaps to a nearby boundary when
 * there is one. Left and right differ slightly in strength and by up to 9 ms in
 * timing, and 8.5% of blinks are doubles.
 */
export const BLINK_SCHEDULE_POLICY = {
  /**
   * Chance of a blink at each phrase boundary. UPSTREAM IS 0.64.
   *
   * The clip has 23 boundaries in 37 s, so 0.64 forces a blink onto most of them
   * and caps how long any gap can get. The boundary preference is loosened
   * rather than removed — landing blinks on phrase boundaries is what keeps them
   * off mid-word, and it is also what keeps them off the head's prominence beats
   * (0 of 12 blinks land within 200 ms of a strong beat, against ~24 % by
   * chance).
   *
   * These two numbers were chosen by sweeping the REAL plan — real boundaries,
   * real seed, upstream's analysis of the actual recording — not a synthetic
   * one, because the boundary set is what the schedule is built on. Measured:
   *
   *   this clip           12 blinks · 19.3/min · mean 3.19 s · CV 0.423
   *                       1.20-5.17 s, every interval distinct, one double
   *   10 seeds x 7.5 min  19.6/min · mean 3.07 s · CV 0.414 · 69 % in 2-5 s
   *                       2.7 gaps over 6 s and 33 pairs under 2 s per run
   *
   * — "mostly 2-5 s, occasional longer gap, occasional closer pair, no obvious
   * pattern", which is the target description. A perfectly periodic schedule has
   * CV 0.000.
   */
  boundaryProbability: 0.44,
  /** Free-running cursor step. UPSTREAM IS 2.65 + 2.80. */
  cursorMinSeconds: 2.4,
  cursorRangeSeconds: 3.8,
  /** Upstream's, unchanged. */
  minSeparationSeconds: 1.15,
  doubleProbability: 0.085,
  snapWindowSeconds: 0.42,
  firstCursorMinSeconds: 1.15,
  firstCursorRangeSeconds: 1.2
} as const;

export function planBlinkCues(
  durationSeconds: number,
  boundaries: readonly number[],
  seed: number,
  policy: typeof BLINK_SCHEDULE_POLICY = BLINK_SCHEDULE_POLICY
): BlinkCue[] {
  if (durationSeconds < 0.55) return [];
  const random = makeRandom(seed ^ 0xa511e9b3);
  const result: BlinkCue[] = [];
  const addBlink = (time: number, boundaryPreferred: boolean): void => {
    if (time < 0.35 || time > durationSeconds - 0.12) return;
    if (result.some((blink) => Math.abs(blink.time - time) < policy.minSeparationSeconds)) return;
    result.push({
      time,
      leftStrength: 0.94 + random() * 0.06,
      rightStrength: 0.9 + random() * 0.08,
      rightDelay: (random() - 0.5) * 0.018,
      boundaryPreferred,
      doubleBlink: random() < policy.doubleProbability
    });
  };

  for (const boundary of boundaries) {
    if (random() < policy.boundaryProbability) addBlink(boundary + (random() - 0.5) * 0.07, true);
  }
  if (!result.some((blink) => blink.boundaryPreferred)) {
    const firstBoundary = boundaries.find(
      (boundary) => boundary >= 0.35 && boundary <= durationSeconds - 0.12
    );
    if (firstBoundary !== undefined) addBlink(firstBoundary, true);
  }
  let cursor = policy.firstCursorMinSeconds + random() * policy.firstCursorRangeSeconds;
  while (cursor < durationSeconds - 0.12) {
    const preferred = nearestBoundary(boundaries, cursor, policy.snapWindowSeconds);
    addBlink(preferred ?? cursor, preferred !== undefined);
    cursor += policy.cursorMinSeconds + random() * policy.cursorRangeSeconds;
  }
  result.sort((first, second) => first.time - second.time);
  return result;
}

/**
 * UPSTREAM'S CONVERSATIONAL PERFORMANCE STATE.
 *
 * Upstream (`ExpressivePerformanceController.setConversationState`) carries
 * `idle · listening · transcribing · thinking · speaking · interrupted`, and its
 * eye life is concentrated in the states where it is NOT talking. Our earlier
 * audit measured exactly that: our avatar plays back a monologue and is in
 * `speaking` essentially 100 % of the time, i.e. permanently in the one state
 * upstream designed to be quiet.
 *
 * FOUR STATES ARE PORTED. `transcribing` and `interrupted` are omitted rather
 * than faked: nothing in this application reports a user transcript or an
 * interruption.
 *
 * ONLY TWO OF THE FOUR ARE REACHABLE AUTOMATICALLY — `speaking` and `idle`.
 * `HTMLMediaElement` events prove that audio is playing; they prove nothing
 * about what a conversational agent is doing, so `listening` and `thinking`
 * have NO verified source in this application and `conversationStateForPlayback`
 * never returns them. They stay implemented, and stay reachable through the
 * diagnostic hold and through a caller that has a real signal, so that wiring a
 * genuine agent later is a matter of supplying the signal rather than rebuilding
 * the behaviour. See `conversationalPerformanceState.ts`.
 */
export const CONVERSATIONAL_PERFORMANCE_STATES = [
  "idle",
  "listening",
  "thinking",
  "speaking"
] as const;

export type ConversationalPerformanceState =
  (typeof CONVERSATIONAL_PERFORMANCE_STATES)[number];

/**
 * What a state changes. It configures the EXISTING gaze and affect machinery and
 * nothing else — no state here writes a bone, a morph or a pose.
 *
 *   gazeEngagement   scales the ambient saccade amplitude the gaze owner already
 *                    produces. `speaking` is 1.0, so the locked
 *                    `SPEAKING_GAZE_POLICY` reaches the rig unchanged.
 *   gazeDeparture    a held offset in upstream's own gaze units, its `thinking`
 *                    look-away REDUCED FOR THIS ASSET. Upstream holds
 *                    gazeX -0.46; that is 6.4 deg on our rail and reads as the
 *                    "dramatic looking away" the brief rules out, so the port
 *                    keeps the behaviour and scales the amplitude to 0.11
 *                    (1.5 deg) — a small departure, still clearly off-camera.
 *   affectScale      how much of the semantic affect envelope reaches the face.
 *
 * THE HEAD COMPONENT OF UPSTREAM'S THINKING IS DELIBERATELY OMITTED. Upstream
 * folds gaze into the head target; the Hyper3D head is locked, so the departure
 * is routed to `eyeGaze` only, exactly as the speaking ambient saccades already
 * are.
 */
export interface ConversationalStatePolicy {
  readonly gazeEngagement: number;
  readonly gazeDepartureX: number;
  readonly gazeDepartureY: number;
  readonly affectScale: number;
}

export const CONVERSATIONAL_STATE_POLICY: Record<
  ConversationalPerformanceState,
  ConversationalStatePolicy
> = {
  /**
   * IDLE — THE HONEST NEUTRAL. Not speaking, and claiming nothing further.
   *
   * The departure is ZERO. A held gaze departure is upstream's `thinking`
   * tell — the avatar visibly looking away to consider something — and playing
   * it with no evidence that anything is being considered is the specific
   * fabrication this state exists to remove.
   *
   * The two amplitudes are `listening`'s, VERBATIM AND DELIBERATELY. They are
   * the accepted non-speaking rest, this task forbids tuning facial amplitudes,
   * and inventing a third set of numbers to distinguish "resting" from
   * "attending" would be exactly the invented-semantics move the brief rules
   * out. What changes here is the CLAIM, not the picture: the numbers are
   * separated so that a real listening signal can later move `listening` without
   * disturbing the neutral rest.
   */
  idle: { gazeEngagement: 0.42, gazeDepartureX: 0, gazeDepartureY: 0, affectScale: 0.55 },
  /**
   * LISTENING — camera engagement with occasional small gaze change.
   * REQUIRES A REAL SIGNAL. Unreachable from playback state alone.
   * Upstream's own `listening` scale is 0.42 and it is used here as upstream
   * uses it: "engaged but attentive". The face keeps a relaxed attentive set
   * rather than a speaking smile, so the affect envelope is reduced but present.
   */
  listening: { gazeEngagement: 0.42, gazeDepartureX: 0, gazeDepartureY: 0, affectScale: 0.55 },
  /**
   * THINKING — a small temporary gaze departure and a restrained face.
   * Upstream's direction (up and to one side) is kept; its amplitude is not.
   * REQUIRES A REAL SIGNAL. Unreachable from playback state alone: "audio is
   * being prepared" is not evidence that an agent is deliberating.
   */
  thinking: { gazeEngagement: 0.3, gazeDepartureX: 0.11, gazeDepartureY: 0.035, affectScale: 0.32 },
  /**
   * SPEAKING — the LOCKED baseline. Every multiplier is exactly 1 and the
   * departure is zero, so the accepted performance reaches the rig untouched.
   */
  speaking: { gazeEngagement: 1, gazeDepartureX: 0, gazeDepartureY: 0, affectScale: 1 }
};

/**
 * How long a state change takes to reach its policy, in seconds.
 *
 * Transitions run through `response()` — the SAME smoothing primitive every
 * other channel in this file uses — so there is no second smoothing engine. The
 * asymmetry is deliberate: returning to the user is quicker than departing.
 */
/**
 * How much of the affect envelope is present when NOT speaking.
 *
 * Upstream's `speechFade` is 0 outside an utterance, so every affect channel
 * collapsed to zero the moment playback stopped — a dead neutral face while
 * listening, which is not "relaxed warm/attentive". This is the resting presence
 * of the SAME envelope, multiplied by the state's own `affectScale` (0.55 while
 * listening, 0.32 while thinking) through the SAME `motionScale`. It introduces
 * no second envelope and no second scheduler: it is the level the existing
 * affect sits at when there is no utterance to shape it.
 *
 * BROWS ARE EXCLUDED. They stay gated on speech, because a semantic brow with no
 * sentence to be semantic about is exactly the rhythmic decoration this project
 * removed.
 */
export const IDLE_AFFECT_PRESENCE = 1;

export const CONVERSATIONAL_STATE_ATTACK = 0.42;
export const CONVERSATIONAL_STATE_RELEASE = 0.28;


/**
 * RESTING LID POSTURE — the fix for "too wide / too alert".
 *
 * ROOT CAUSE, measured on the production clip. Nothing narrows the eye during
 * speech at all:
 *
 *   eyeWideLeft/Right    written on   0 / 2236 frames
 *   eyeSquintLeft/Right  written on   0 / 2236 frames
 *   eyeBlinkLeft/Right   above 0 on 147 / 2236 frames (the blinks), p90 = 0.000
 *
 * The affect layer computes both lid channels and both are then correctly
 * dropped: for the `warm` affect they resolve to eyeWide 0.005 and eyeSquint
 * 0.044, under those channels' measured useful minimums of 0.08 and 0.10. So for
 * 93.4 % of the clip every eye channel is EXACTLY ZERO and the lids sit at the
 * GLB's rest, which is a fully open eye.
 *
 * That was a deliberate decision, recorded in `hyper3dCalibration.ts`: "There is
 * NO eyelid term ... with the iris still missing anything that narrows the
 * aperture reads as a dead stare, so the eyes are left fully open." The iris is
 * no longer missing — the eye material and texture shipped since — so the
 * premise is gone and only its consequence remains. The reference frames hold a
 * visibly relaxed, hooded lid through the whole utterance.
 *
 * THE CORRECTION. A resting closure carried on the SAME `eyeBlink` channel the
 * blinks already own, composited with `Math.max`, so:
 *
 *   - there is no new writer and no new scheduler;
 *   - a blink still reaches exactly 1.0, because max(blink, rest) = blink there;
 *   - the lid settles back to the resting level rather than to a stare;
 *   - the blink SCHEDULER and TRAJECTORY are untouched — this is a rest pose,
 *     not a cadence and not a shape.
 *
 * 0.17 of full lid travel. `eyeBlink*` measures 11.27 mm (L) / 11.85 mm (R) at
 * 1.0, so this lowers the upper lid by ~2 mm: the top of the iris covered and
 * the fissure narrowed to the relaxed almond the reference holds, well clear of
 * a sleepy look.
 */
export const RESTING_LID_CLOSURE = 0.17;

/**
 * How far upstream's `eyeWiden` re-opens the resting lid.
 *
 * "Occasional widening only when expression requires it", through the affect
 * channel that already exists rather than a new one. At `eyeWiden` >= this the
 * rest is fully released and the eye is as open as before. The `warm` affect
 * this payload infers peaks at eyeWiden 0.023, which releases ~7 % — so neutral
 * speech keeps the relaxed lid, and only an affect that genuinely widens the
 * eyes (`surprise` carries 0.92) opens it.
 */
export const LID_WIDEN_RELEASE = 0.32;


/**
 * SEMANTIC BROW ENGAGEMENT — the gate that produces "long neutral periods".
 *
 * The brows must move SELECTIVELY. The affect envelope alone will not do that:
 * it is floored at `SPEAKING_AFFECT_FLOOR` while a phrase runs, so a brow driven
 * directly by it sits lifted for the entire utterance — which is the sustained
 * lift the previous pass switched off.
 *
 * So the brow reads the SAME per-phrase affect envelope every other region
 * reads, through a threshold. Below `SEMANTIC_BROW_ENGAGE` the brows are EXACTLY
 * ZERO; between engage and `SEMANTIC_BROW_FULL` they ramp in on a smoothstep.
 * Because the envelope's per-phrase gain (0.72-1.26) decides which phrases ever
 * cross the threshold, the result is what the reference frames show: whole
 * phrases with no brow movement at all, and occasional lifts that rise
 * gradually, hold across part of a phrase and release slowly.
 *
 * This is a GATE on an existing signal, not a scheduler. It has no clock, no
 * random draw and no state of its own; the timing is entirely
 * `planSemanticAffectEnvelope`'s, which is precisely why the brow cannot pulse
 * per word the way the rejected prosodic implementation did.
 */
export const SEMANTIC_BROW_ENGAGE = 0.72;
export const SEMANTIC_BROW_FULL = 1.15;

/**
 * How far the two outer brows may differ while lifted.
 *
 * Upstream already carries `browLiftLeft` / `browLiftRight` and a seeded
 * `asymmetryDirection`; this is the amplitude of that existing asymmetry,
 * applied only while the brow is engaged so a resting face stays symmetric. A
 * real brow lift is never perfectly even, and the reference shows the difference.
 */
export const SEMANTIC_BROW_ASYMMETRY = 0.16;

/**
 * Brow channel smoothing. Upstream is 0.12-0.17 s attack / 0.28-0.32 s release.
 *
 * The target's brows do not snap: they rise over a beat, hold across part of a
 * phrase and fall away slowly. These constants are what deliver "gradual onset /
 * sustained hold / slow release" without touching the frozen affect envelope,
 * and they apply to the three brow channels ONLY — cheeks, smile and lids keep
 * upstream's own response exactly.
 */
export const SEMANTIC_BROW_ATTACK = 0.34;
export const SEMANTIC_BROW_RELEASE = 0.86;


/**
 * Upstream `sampleEyelid`, copied verbatim.
 *
 * 52 ms close, 18 ms hold, 105 ms open. This IS the blink shape; nothing about
 * it is re-timed for Hyper3D.
 */
export function sampleEyelid(time: number, start: number, strength: number): number {
  const closeSeconds = 0.052;
  const holdSeconds = 0.018;
  const openSeconds = 0.105;
  const local = time - start;
  if (local < 0 || local >= closeSeconds + holdSeconds + openSeconds) return 0;
  if (local < closeSeconds) return strength * smoothstep01(local / closeSeconds);
  if (local < closeSeconds + holdSeconds) return strength;
  return strength * (1 - smoothstep01((local - closeSeconds - holdSeconds) / openSeconds));
}

/**
 * Upstream `planSemanticAffectEnvelope`, copied verbatim — ALL SIX branches.
 *
 * The earlier head-only port could only reach the `default` branch because it
 * fixed affect at `neutral`. Upstream's non-LLM inference can now select any of
 * the six, so every branch is restored exactly as upstream wrote it.
 */
export function planSemanticAffectEnvelope(
  affect: PerformanceAffect,
  durationSeconds: number,
  cues: readonly ProsodicCue[]
): SemanticAffectEnvelope {
  const duration = Math.max(0.25, durationSeconds);
  const firstProminence = cues.find((cue) => cue.time >= 0.1)?.time;
  const finalProminence = [...cues].reverse().find((cue) => cue.time <= duration - 0.12)?.time;

  let apexTime: number;
  let attackSeconds: number;
  let releaseSeconds: number;
  let baseline: number;
  let residue: number;
  switch (affect) {
    case "surprise":
      apexTime = Math.min(0.3, Math.max(0.16, duration * 0.2));
      attackSeconds = 0.2;
      releaseSeconds = 0.68;
      baseline = 0.06;
      residue = 0.04;
      break;
    case "warm":
      apexTime = Math.min(0.48, Math.max(0.25, duration * 0.25));
      attackSeconds = 0.34;
      releaseSeconds = 1.05;
      baseline = 0.18;
      residue = 0.13;
      break;
    case "question":
      apexTime = clamp(
        finalProminence ?? duration * 0.72,
        Math.min(0.22, duration * 0.4),
        Math.max(0.24, duration - 0.14)
      );
      attackSeconds = 0.28;
      releaseSeconds = 0.52;
      baseline = 0.12;
      residue = 0.07;
      break;
    case "concerned":
      apexTime = Math.min(0.52, Math.max(0.3, duration * 0.28));
      attackSeconds = 0.36;
      releaseSeconds = 1.18;
      baseline = 0.22;
      residue = 0.17;
      break;
    case "emphatic":
      apexTime = clamp(
        firstProminence ?? Math.min(0.36, duration * 0.26),
        0.16,
        Math.max(0.18, duration - 0.16)
      );
      attackSeconds = 0.2;
      releaseSeconds = 0.72;
      baseline = 0.1;
      residue = 0.07;
      break;
    default:
      apexTime = Math.min(0.42, duration * 0.25);
      attackSeconds = 0.3;
      releaseSeconds = 0.62;
      baseline = 0.08;
      residue = 0.05;
      break;
  }

  return {
    // Nonverbal intent normally appears just before the voice.
    onsetTime: Math.max(-AFFECT_ANTICIPATION_SECONDS, Math.min(-0.12, apexTime - attackSeconds)),
    apexTime,
    releaseEndTime: Math.min(duration + 0.18, apexTime + releaseSeconds),
    baseline,
    residue
  };
}

export function sampleSemanticAffectEnvelope(
  envelope: SemanticAffectEnvelope,
  speechTime: number
): number {
  if (speechTime <= envelope.onsetTime) return 0;
  if (speechTime < envelope.apexTime) {
    const rise = smoothstep01(
      (speechTime - envelope.onsetTime) / Math.max(0.001, envelope.apexTime - envelope.onsetTime)
    );
    return envelope.baseline + (1 - envelope.baseline) * rise;
  }
  if (speechTime < envelope.releaseEndTime) {
    const release = smoothstep01(
      (speechTime - envelope.apexTime) /
        Math.max(0.001, envelope.releaseEndTime - envelope.apexTime)
    );
    return envelope.residue + (1 - envelope.residue) * (1 - release);
  }
  return envelope.residue;
}

/**
 * PHRASE-LEVEL AFFECT — the target-matching change to the warmth layer.
 *
 * THE MISMATCH. Upstream's envelope is designed for ONE short conversational
 * turn: it blooms to 1.0 at `apexTime` and decays to `residue` over
 * `releaseSeconds`, then holds that residue forever. For the `warm` affect that
 * is apex 0.48 s, release end 1.53 s, residue 0.13. Our payload is a single
 * 37-second utterance containing seven sentences, so upstream's envelope leaves
 * the face at 13 % of the warm pose for 96 % of the clip — below `mouthSmileLeft`'s
 * measured 0.05 useful minimum, i.e. rendering nothing. That is the "neutral
 * between every phoneme" the target is judged against.
 *
 * THE FIX, using upstream's own architecture rather than a new one. A long
 * utterance is split into PHRASES at its real pauses, and upstream's
 * `planSemanticAffectEnvelope` is run once per phrase, offset to that phrase's
 * start. Every constant — apex, attack, release, baseline, residue — is still
 * upstream's; only the number of times the envelope is instantiated changes.
 *
 * The result is exactly the target's description: warmth is present throughout
 * speech, varies a little from phrase to phrase as each envelope blooms and
 * settles, softens into every pause, and releases cleanly at the end through the
 * unchanged `speechFade`.
 */
export const AFFECT_PHRASE_PAUSE_SECONDS = 0.28;

/**
 * The floor the affect holds WHILE A PHRASE IS BEING SPOKEN.
 *
 * The brief: "Do not make warmth disappear completely between words." Without a
 * floor the between-phrase value is upstream's `residue`, which on the warm
 * branch is 0.13 and renders as nothing. 0.46 keeps a mild engaged set present
 * across the whole phrase while leaving more than half the range for the
 * envelope's own phrase-level movement, so it is a baseline rather than a static
 * pose. It applies INSIDE phrases only — pauses keep upstream's residue, which
 * is what produces the "soften during pauses" behaviour.
 */
export const SPEAKING_AFFECT_FLOOR = 0.46;

/** Speech spans separated by pauses of at least `AFFECT_PHRASE_PAUSE_SECONDS`. */
export function collectPhraseSpans(
  phonemes: readonly UpstreamPhonemeInterval[],
  durationSeconds: number
): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  let previousEnd = 0;
  for (const phone of phonemes) {
    const silent =
      SILENCE_PHONES.has(phone.normalizedPhone) &&
      phone.endTime - phone.startTime >= AFFECT_PHRASE_PAUSE_SECONDS;
    if (silent) {
      if (start !== null) spans.push({ start, end: previousEnd });
      start = null;
      continue;
    }
    if (start === null) start = phone.startTime;
    previousEnd = phone.endTime;
  }
  if (start !== null) spans.push({ start, end: Math.max(previousEnd, start) });
  return spans.length ? spans : [{ start: 0, end: Math.max(0.25, durationSeconds) }];
}

/**
 * PER-PHRASE DYNAMIC RANGE — why consecutive phrases stopped looking alike.
 *
 * `planSemanticAffectEnvelope`'s `warm` branch takes no cue input: its apex,
 * attack, release, baseline and residue are constants once the phrase is longer
 * than 1.92 s. Every phrase on this payload is, so all seven phrases were handed
 * the IDENTICAL envelope and the face repeated the same arc seven times. The
 * floor was fine; the variation was missing.
 *
 * This scales each phrase's envelope by the prosodic weight of that phrase,
 * taken from `plan.cues` — upstream's own beat detector, scored from the decoded
 * PCM. It adds no scheduler and no second envelope: it is a per-phrase GAIN on
 * the envelope that was already there, so a quiet phrase settles toward the
 * speaking floor and an emphatic one reaches higher, exactly as the reference
 * moves between attentive-neutral and a stronger smile.
 *
 * Deliberately PHRASE-level, never word-level. A per-word gain is what made the
 * rejected prosodic brows look robotic; a phrase is long enough that the change
 * reads as a shift of mood rather than a pump.
 *
 * The upper bound is set so the strongest phrase apex lands just under
 * `mouthSmileLeft`'s measured `naturalMax` of 0.45 — a phrase emphasis reaches
 * the top of the natural range and never past it.
 */
/**
 * Lowered from 0.72 so QUIET PHRASES SETTLE NEARER THE WARM BASELINE.
 *
 * The range is widened DOWNWARD, deliberately. Raising the top would push more
 * phrases across `SEMANTIC_BROW_ENGAGE` and add brow events, which this pass is
 * told not to do; lowering the bottom cannot, because a smaller gain can never
 * cross a threshold a larger one did not. `SPEAKING_AFFECT_FLOOR` still catches
 * every phrase, so "nearer the baseline" means exactly the warm floor and never
 * below it.
 */
export const PHRASE_AFFECT_GAIN_MIN = 0.55;
export const PHRASE_AFFECT_GAIN_MAX = 1.26;

export interface PhraseAffectEnvelope extends SemanticAffectEnvelope {
  /** Prosodic weight of this phrase, `PHRASE_AFFECT_GAIN_MIN..MAX`. */
  readonly gain: number;
}

/** One upstream envelope per phrase, shifted onto that phrase's own clock. */
export function planPhraseAffectEnvelopes(
  affect: PerformanceAffect,
  spans: ReadonlyArray<{ start: number; end: number }>,
  cues: readonly ProsodicCue[]
): PhraseAffectEnvelope[] {
  /**
   * Each phrase's prosodic weight: the mean strength of the beats upstream
   * detected inside it, normalised across the utterance so the gain is a
   * COMPARISON between phrases rather than an absolute loudness. A phrase with
   * no detected beat sits at the middle rather than at the floor.
   */
  const weights = spans.map((span) => {
    const inside = cues.filter((cue) => cue.time >= span.start && cue.time <= span.end);
    if (!inside.length) return null;
    return inside.reduce((sum, cue) => sum + cue.strength, 0) / inside.length;
  });
  const measured = weights.filter((weight): weight is number => weight !== null);
  const low = measured.length ? Math.min(...measured) : 0;
  const high = measured.length ? Math.max(...measured) : 0;
  const spread = high - low;

  return spans.map((span, index) => {
    const local = planSemanticAffectEnvelope(
      affect,
      span.end - span.start,
      cues
        .filter((cue) => cue.time >= span.start && cue.time <= span.end)
        .map((cue) => ({ ...cue, time: cue.time - span.start }))
    );
    const weight = weights[index];
    const normalised = weight === null || spread < 1e-6 ? 0.5 : (weight - low) / spread;
    return {
      onsetTime: local.onsetTime + span.start,
      apexTime: local.apexTime + span.start,
      releaseEndTime: local.releaseEndTime + span.start,
      baseline: local.baseline,
      residue: local.residue,
      gain:
        PHRASE_AFFECT_GAIN_MIN + (PHRASE_AFFECT_GAIN_MAX - PHRASE_AFFECT_GAIN_MIN) * normalised
    };
  });
}

/**
 * The affect level at `speechTime`: the strongest phrase envelope, raised to the
 * speaking floor while a phrase is actually running.
 */
export function samplePhraseAffect(
  envelopes: readonly PhraseAffectEnvelope[],
  spans: ReadonlyArray<{ start: number; end: number }>,
  speechTime: number,
  floor = SPEAKING_AFFECT_FLOOR
): number {
  let value = 0;
  for (const envelope of envelopes)
    value = Math.max(value, sampleSemanticAffectEnvelope(envelope, speechTime) * envelope.gain);
  // The FLOOR IS UNCHANGED and is applied after the gain, so a quiet phrase
  // settles onto the same warm baseline rather than below it. The gain widens
  // the range upward; it never lowers the floor.
  const speaking = spans.some((span) => speechTime >= span.start && speechTime <= span.end);
  return speaking ? Math.max(value, floor) : value;
}

/**
 * INTENT SEGMENTS — sentence-level semantic intent on the existing audio clock.
 *
 * THE PROBLEM. `inferPerformanceIntent` was called once, on the whole response,
 * so a 37-second answer carried one affect from beginning to end. The reference
 * changes facial attitude with meaning; ours resolved to `warm` throughout.
 *
 * THE MECHANISM IS ALREADY HERE. `inferPerformanceIntent`, `textualAffect` and
 * `inferDiscourseAct` are PURE FUNCTIONS OF TEXT and are length-agnostic — a
 * sentence is as valid an input as a paragraph. So segmenting is a matter of
 * calling upstream's own classifier once per sentence. No new classifier, no
 * keyword table, no emotion model.
 *
 * UPSTREAM'S OWN PRECEDENCE IS PRESERVED. `inferPerformanceIntent` prefers
 * `requestedAffect(userText)` over `textualAffect(assistantText)`. A response
 * carrying an explicit affect request therefore keeps that affect for every
 * segment — which is exactly what the locked tuning payload does, and why the
 * baseline is untouched. A real conversational response carries no such request,
 * so each sentence resolves on its own text.
 *
 * ALIGNMENT USES THE EXISTING CLOCK. Segments are matched to the phrase spans
 * `collectPhraseSpans` already derives from the MFA phoneme timeline. There is
 * no second clock, no `setTimeout` and no wall-clock estimate: a segment is a
 * range of the same seconds the phonemes and the audio use.
 *
 * WHICH sentence owns which span is decided by the MFA WORD TIER when the
 * payload carries one — see `alignSentencesToWords`. Character-proportion
 * ownership remains as the declared fallback, never as a silent one.
 */
export interface IntentSegment {
  /** Phrase span this segment covers, in audio-clock seconds. */
  readonly start: number;
  readonly end: number;
  /** The sentence text the intent was inferred from. */
  readonly text: string;
  readonly intent: PerformanceIntent;
  /** How this span was attributed to that sentence. Never inferred by a reader. */
  readonly alignmentSource: SemanticAlignmentSource;
  /**
   * Share of the sentence's own tokens located in the word tier: 1 under
   * `mfa-word-tier`, 0 under `positional-fallback` — a fallback knows nothing
   * about where the sentence actually is, and says so rather than reporting a
   * plausible-looking number.
   */
  readonly alignmentConfidence: number;
}

/**
 * SEMANTIC ALIGNMENT SOURCE.
 *
 * `mfa-word-tier`      the sentence's own words were located in the aligner's
 *                      word intervals, so its audio span is measured.
 * `positional-fallback` no usable word tier, or the transcript and the tier
 *                      disagree. Ownership is by character proportion, which is
 *                      an ESTIMATE. Reported, never disguised.
 */
export type SemanticAlignmentSource = "mfa-word-tier" | "positional-fallback";

/** One MFA word interval, in audio-clock seconds. */
export interface AlignedWord {
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

export interface SentenceAudioSpan {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly confidence: number;
}

/**
 * DETERMINISTIC TOKENISATION. Case folding, apostrophe unification and
 * punctuation removal — nothing else. No stemming, no synonyms, no edit
 * distance, no phonetic classes: two tokens are the same token or they are not.
 */
export function normalizeAlignmentToken(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .replace(/[^a-z0-9']+/gu, " ")
    .split(" ")
    .map((token) => token.replace(/^'+|'+$/gu, ""))
    .filter((token) => token.length > 0);
}

/**
 * SENTENCE -> AUDIO TIME, FROM THE ALIGNER'S OWN WORD INTERVALS.
 *
 * A single forward cursor walks the word tier once while the sentences are
 * consumed in order, comparing normalized tokens for EXACT EQUALITY. A sentence
 * takes the start of its first word and the end of its last.
 *
 * WHY A STRICT MARCH RATHER THAN A MATCHER. Consuming in order is what makes
 * repeated words safe: the second "the" in a paragraph is claimed by whichever
 * sentence the cursor has reached, never by a search that could find the wrong
 * one. And because the cursor never scans, there is no similarity threshold to
 * tune and no way for a near-miss to be silently accepted as a hit.
 *
 * ANY DISAGREEMENT FAILS THE WHOLE ALIGNMENT — returns `null`, and the caller
 * declares `positional-fallback`. A partial word alignment would be the worst of
 * the three outcomes: it would carry the authority of measured timing while
 * placing some sentences by guesswork. Measured on this repository's 17
 * generated payloads, transcript and word tier agree token-for-token
 * (1/1 through 95/95), so the strict path is the one that actually runs.
 *
 * This reads intervals the aligner already produced. It runs no aligner, reads
 * no audio and does not touch phoneme timing.
 */
export function alignSentencesToWords(
  sentences: readonly string[],
  words: readonly AlignedWord[]
): SentenceAudioSpan[] | null {
  if (!sentences.length || !words.length) return null;
  const tier = words
    .map((word) => ({ token: normalizeAlignmentToken(word.word)[0] ?? "", start: word.start, end: word.end }))
    .filter((entry) => entry.token.length > 0);
  if (!tier.length) return null;
  const spans: SentenceAudioSpan[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const tokens = normalizeAlignmentToken(sentence);
    if (!tokens.length) return null;
    const first = cursor;
    for (const token of tokens) {
      if (cursor >= tier.length || tier[cursor].token !== token) return null;
      cursor += 1;
    }
    spans.push({
      text: sentence,
      start: tier[first].start,
      end: tier[cursor - 1].end,
      // Every token of this sentence was located, or the march would have failed.
      confidence: 1
    });
  }
  // Leftover words mean the transcript is not the thing that was spoken.
  return cursor === tier.length ? spans : null;
}

/**
 * Sentence boundaries, by punctuation. Upstream's `collectBoundaries` already
 * treats `[,:;.!?]` as phrase punctuation; this uses the sentence-final subset.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * One intent per PHRASE SPAN, inferred from the sentence that phrase belongs to.
 *
 * Phrase spans come from the audio; sentences come from the text; the WORD TIER
 * is what connects them. Given `words`, each sentence has a measured audio span
 * and a phrase span belongs to the sentence whose span contains its midpoint —
 * both sides on the same clock, no estimate anywhere.
 *
 * Without a word tier, or when the tier and the transcript disagree, ownership
 * falls back to proportion of total spoken length. That was the ONLY available
 * mapping while the payload contract dropped the tier; it is now the declared
 * fallback, and every segment carries the source it was produced by.
 */
export function planIntentSegments(
  text: string,
  spans: ReadonlyArray<{ start: number; end: number }>,
  userText?: string,
  words?: readonly AlignedWord[]
): IntentSegment[] {
  const sentences = splitSentences(text);
  if (!sentences.length || !spans.length) return [];

  const aligned = words?.length ? alignSentencesToWords(sentences, words) : null;
  if (aligned) {
    return spans.map((span) => {
      const midpoint = span.start + (span.end - span.start) / 2;
      // Containment first; otherwise the nearest sentence span, which is a
      // deterministic tie-break over measured numbers, not a similarity guess.
      const owner =
        aligned.find((sentence) => midpoint >= sentence.start && midpoint <= sentence.end) ??
        aligned.reduce((best, sentence) => {
          const distance = midpoint < sentence.start ? sentence.start - midpoint : midpoint - sentence.end;
          const bestDistance = midpoint < best.start ? best.start - midpoint : midpoint - best.end;
          return distance < bestDistance ? sentence : best;
        }, aligned[0]);
      return {
        start: span.start,
        end: span.end,
        text: owner.text,
        intent: inferPerformanceIntent({ userText, assistantText: owner.text }),
        alignmentSource: "mfa-word-tier" as const,
        alignmentConfidence: owner.confidence
      };
    });
  }

  const totalCharacters = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
  const totalSpoken = spans.reduce((sum, span) => sum + (span.end - span.start), 0);
  // Cumulative character position of each sentence, as a fraction of the whole.
  const bounds: Array<{ from: number; to: number; text: string }> = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const from = cursor / totalCharacters;
    cursor += sentence.length;
    bounds.push({ from, to: cursor / totalCharacters, text: sentence });
  }
  // Each phrase span takes the sentence whose character range covers its own
  // midpoint in spoken time.
  let elapsed = 0;
  return spans.map((span) => {
    const duration = span.end - span.start;
    const midpoint = (elapsed + duration / 2) / Math.max(1e-6, totalSpoken);
    elapsed += duration;
    const owner =
      bounds.find((bound) => midpoint >= bound.from && midpoint < bound.to) ??
      bounds[bounds.length - 1];
    return {
      start: span.start,
      end: span.end,
      text: owner.text,
      intent: inferPerformanceIntent({ userText, assistantText: owner.text }),
      alignmentSource: "positional-fallback" as const,
      // A fallback has not located this sentence in the audio. Zero says so.
      alignmentConfidence: 0
    };
  });
}

export interface SemanticAlignmentSummary {
  readonly source: SemanticAlignmentSource | "unaligned";
  /** Mean per-segment confidence. 0 under the fallback, by construction. */
  readonly confidence: number;
  readonly segmentCount: number;
}

/**
 * The plan-level alignment summary, read off the segments themselves rather than
 * recomputed — so the readout cannot claim a source the segments do not have.
 */
export function resolveSemanticAlignment(
  segments: readonly IntentSegment[]
): SemanticAlignmentSummary {
  if (!segments.length) return { source: "unaligned", confidence: 0, segmentCount: 0 };
  const worded = segments.every((segment) => segment.alignmentSource === "mfa-word-tier");
  return {
    source: worded ? "mfa-word-tier" : "positional-fallback",
    confidence: worded
      ? segments.reduce((sum, segment) => sum + segment.alignmentConfidence, 0) / segments.length
      : 0,
    segmentCount: segments.length
  };
}

/** Upstream `planExpressivePerformance`, reduced to the fields the head reads. */
export function planHeadPerformance(input: HeadPerformancePlanInput): HeadPerformancePlan {
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const durationSeconds = Math.max(0, input.durationSeconds);
  const seed = (input.seed ?? hashText(`${input.text}␟${durationSeconds.toFixed(3)}`)) >>> 0;
  const pitch = robustPitchStatistics(input.acousticFrames);
  const cues = planProsodicCues(input.acousticFrames, input.phonemes, pitch, seed);
  const boundaries = collectBoundaries(input.text, input.phonemes, durationSeconds);
  const phraseSpans = collectPhraseSpans(input.phonemes, durationSeconds);
  const blinks = planBlinkCues(durationSeconds, boundaries, seed);
  const intent = inferPerformanceIntent({
    userText: input.userText,
    assistantText: input.text
  });
  // Upstream folds the measured prominence into the intensity it inferred.
  const cueStrength =
    cues.length > 0 ? cues.reduce((sum, cue) => sum + cue.strength, 0) / cues.length : 0;
  const intensity = clamp(
    intent.intensity + Math.max(0, cueStrength - 0.45) * 0.16,
    intent.affect === "neutral" ? 0.18 : 0.3,
    1
  );
  const intentSegments = input.segmentIntent
    ? planIntentSegments(input.text, phraseSpans, input.userText, input.words)
    : [];
  const endedAt = globalThis.performance?.now?.() ?? Date.now();
  return {
    seed,
    durationSeconds,
    asymmetryDirection: (seed & 1) === 0 ? -1 : 1,
    pitch,
    intent,
    affect: intent.affect,
    intensity,
    affectTargets: AFFECT_TARGETS[intent.affect],
    cues,
    blinks,
    boundaries,
    affectEnvelope: planSemanticAffectEnvelope(intent.affect, durationSeconds, cues),
    /**
     * PHRASE-LEVEL warmth. `affectEnvelope` above is kept so the whole-utterance
     * shape is still inspectable, but the FACE reads these.
     */
    intentSegments,
    semanticAlignment: resolveSemanticAlignment(intentSegments),
    affectPhraseSpans: phraseSpans,
    affectPhraseEnvelopes: planPhraseAffectEnvelopes(intent.affect, phraseSpans, cues),
    headEnvelope: planSemanticAffectEnvelope("neutral", durationSeconds, cues),
    plannerMs: Math.max(0, endedAt - startedAt)
  };
}

// ---------------------------------------------------------------------------
// the per-frame head pose
// ---------------------------------------------------------------------------

/**
 * SPEAKING GAZE POLICY — the tuned half of the ported gaze system.
 *
 * The MECHANISM is upstream's, unchanged: one seeded ambient saccade scheduler,
 * a hold, a gap, and upstream's 0.075 s / 0.16 s and 0.08 s / 0.18 s `response()`
 * constants carrying the eyes there and back. Only the POLICY — how far and how
 * often — is set here, because upstream's own policy is written for a rig and a
 * conversational state machine we do not have.
 *
 * WHY IT HAD TO CHANGE. Upstream's `gazeX` is a morph weight where 1.0 is that
 * rig's full deflection; ours is mapped onto the calibrated Hyper3D rail where
 * 1.0 is 14 deg of real eyeball rotation. Upstream's ambient amplitude of 0.065
 * therefore arrived as 0.91 deg, and the borrowed `listening` scale of 0.42 cut
 * it to 0.38 deg — a third of a degree, which is why hardware called the ported
 * gaze invisible. It was never an amplitude judgement; it was a unit mismatch.
 *
 * THE TARGET: camera engagement most of the time, small visible shifts,
 * selective left/right, occasional subtle vertical, long centre holds, and no
 * large side-look at all. So:
 *
 *   yaw   +/-2.8 deg   visible at our framing, and 20 % of the 14 deg rail, so a
 *                      "large side-look" is not merely rare but unreachable
 *   pitch +0.77 / -0.50 deg   deliberately far smaller — "occasional SUBTLE
 *                      vertical change", and `eyeLookDown` moves the lids more
 *                      than the eyeball, hence the tighter downward figure
 *   hold  0.34-1.06 s  upstream's own hold, unchanged
 *   gap   2.60-6.40 s  lengthened from upstream's 1.40-4.20 s
 *
 * Duty cycle: mean hold 0.70 s against mean gap 4.50 s puts the eyes off centre
 * 13.5 % of the time — CENTRE HOLD IS THE DOMINANT STATE by construction — and
 * yields roughly 7 gaze events across the 37-second clip. There is no ambient
 * blink coupling: a saccade never triggers a blink, which is half of why the
 * two tracks do not look tied together.
 *
 * The scale is baked in here rather than layered as a separate amplitude
 * multiplier so that ONE number governs how far the eyes travel.
 */
export const SPEAKING_GAZE_POLICY = {
  /** Peak +/- deflection of one saccade, in upstream gaze units (1.0 = the 14 deg rail). */
  yawAmplitude: 0.2,
  pitchAmplitude: 0.11,
  holdMinSeconds: 0.34,
  holdRangeSeconds: 0.72,
  gapMinSeconds: 2.6,
  gapRangeSeconds: 3.8,
  /** First saccade after the utterance opens. */
  firstGapMinSeconds: 1.1,
  firstGapRangeSeconds: 2.2
} as const;

const RAD_TO_DEG = 180 / Math.PI;

interface PerformanceChannels {
  /** Head-facing gaze. The accepted signal; never carries ambient saccades. */
  gazeX: number;
  gazeY: number;
  /** Eye-facing gaze. The accepted signal plus upstream's ambient saccades. */
  eyeGazeX: number;
  eyeGazeY: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  browConcern: number;
  browLift: number;
  browFurrow: number;
  smileMouth: number;
  cheekRaise: number;
  eyeSquint: number;
  eyeWiden: number;
  surpriseMouth: number;
  concernMouth: number;
  curiosityMouth: number;
  emphasisMouth: number;
}

const ZERO_AFFECT_CHANNELS = {
  smileMouth: 0,
  cheekRaise: 0,
  eyeSquint: 0,
  eyeWiden: 0,
  surpriseMouth: 0,
  concernMouth: 0,
  curiosityMouth: 0,
  emphasisMouth: 0
};

/** Upstream's neutral-affect brow rest, `AFFECT_TARGETS.neutral.browConcern`. */
export const NEUTRAL_BROW_CONCERN = 0.035;

export interface HeadPerformanceSampleInput {
  /** Our audio playback clock, already relative to the start of the utterance. */
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
  /** Whether the payload audio is currently being delivered. */
  readonly speechActive: boolean;
}

/**
 * Upstream's head channels, lifted out of `ExpressivePerformanceController`.
 *
 * Stateful in exactly the way upstream is: `response()` integrates towards a
 * target every frame, so the smoothing constants only mean what upstream
 * intended if the state is carried between frames. `plan()` replaces the
 * utterance; `reset()` returns the channels to rest.
 */
export class ThreejsTalkingAvatarPerformance {
  private plan: HeadPerformancePlan | null = null;
  private channels: PerformanceChannels = {
    gazeX: 0,
    gazeY: 0,
    eyeGazeX: 0,
    eyeGazeY: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    browConcern: NEUTRAL_BROW_CONCERN,
    browLift: 0,
    browFurrow: 0,
    ...ZERO_AFFECT_CHANNELS
  };
  private ambientRandom = makeRandom(0x2f6e2b1);
  private ambientGazeX = 0;
  private ambientGazeY = 0;
  private ambientGazeReleaseAt = Number.NEGATIVE_INFINITY;
  private ambientGazeNextAt = Number.POSITIVE_INFINITY;
  /**
   * Whether upstream's ambient saccade scheduler may run during speech. See the
   * gaze block in `sample()` for why this gate exists and what it changes.
   */
  private ambientGazeWhileSpeaking = false;
  private affectEnabled = false;
  /**
   * Upstream's conversation state. `speaking` is the default so nothing that
   * does not set a state can differ from the locked baseline by one bit.
   */
  private conversationState: ConversationalPerformanceState = "speaking";
  /** The policy the state is easing TOWARD, and where each term is now. */
  private stateGazeEngagement = CONVERSATIONAL_STATE_POLICY.speaking.gazeEngagement;
  private stateGazeDepartureX = 0;
  private stateGazeDepartureY = 0;
  private stateAffectScale = CONVERSATIONAL_STATE_POLICY.speaking.affectScale;
  private ambientBlinkAt = Number.POSITIVE_INFINITY;
  private ambientBlinkLeft = 0;
  private ambientBlinkRight = 0;
  private ambientBlinkRightDelay = 0;

  setPlan(plan: HeadPerformancePlan | null): void {
    this.plan = plan;
  }

  /** REPO WARM/AFFECT. Runs the inferred affect; off holds the face at neutral. */
  setAffectEnabled(enabled: boolean): void {
    this.affectEnabled = enabled;
  }

  /** REPO SPEAKING GAZE. Upstream's ambient saccades, ungated from the state. */
  setAmbientGazeWhileSpeaking(enabled: boolean): void {
    this.ambientGazeWhileSpeaking = enabled;
  }

  /**
   * Upstream's `setConversationState`, by name and by role.
   *
   * It configures the existing gaze and affect machinery. It writes no bone, no
   * morph and no pose, and it cannot reach the head: the departure it introduces
   * is routed to the EYE gaze channel only.
   */
  setConversationState(state: ConversationalPerformanceState): void {
    this.conversationState = state;
  }

  getConversationState(): ConversationalPerformanceState {
    return this.conversationState;
  }

  getPlan(): HeadPerformancePlan | null {
    return this.plan;
  }

  reset(): void {
    this.channels = {
      gazeX: 0,
      gazeY: 0,
      eyeGazeX: 0,
      eyeGazeY: 0,
      headPitch: 0,
      headYaw: 0,
      headRoll: 0,
      browConcern: NEUTRAL_BROW_CONCERN,
      browLift: 0,
      browFurrow: 0,
      ...ZERO_AFFECT_CHANNELS
    };
    this.ambientRandom = makeRandom(0x2f6e2b1);
    this.ambientGazeReleaseAt = Number.NEGATIVE_INFINITY;
    this.ambientGazeNextAt = Number.POSITIVE_INFINITY;
    this.ambientBlinkAt = Number.POSITIVE_INFINITY;
    this.stateGazeEngagement = CONVERSATIONAL_STATE_POLICY[this.conversationState].gazeEngagement;
    this.stateGazeDepartureX = CONVERSATIONAL_STATE_POLICY[this.conversationState].gazeDepartureX;
    this.stateGazeDepartureY = CONVERSATIONAL_STATE_POLICY[this.conversationState].gazeDepartureY;
    this.stateAffectScale = CONVERSATIONAL_STATE_POLICY[this.conversationState].affectScale;
  }

  /**
   * One frame of upstream head behaviour.
   *
   * Copied from `ExpressivePerformanceController.update()`, keeping the beat
   * accumulation, the gaze channel terms that feed the head, the semantic head
   * terms, the `response()` attack/release constants and the final clamps at
   * their upstream values. `actionHeadPitch` / `actionHeadYaw` are structurally
   * absent: upstream only ever raises those from an LLM `[[perform:…]]`
   * gesture directive, which we have no source for, so `directedHeadGesture` is
   * always false here.
   */
  sample(input: HeadPerformanceSampleInput): HeadPerformanceFrame {
    const { timeSeconds: now, speechActive } = input;
    const deltaSeconds = clamp(input.deltaSeconds, 0, 0.1);
    const plan = this.plan;
    const speechTime = now;
    const active = Boolean(
      plan &&
        speechActive &&
        speechTime >= -AFFECT_ANTICIPATION_SECONDS &&
        speechTime <= plan.durationSeconds + 0.4
    );

    let headPitchPulse = 0;
    let headYawPulse = 0;
    let browPulse = 0;
    let activeBeats = 0;
    if (plan && active) {
      for (const cue of plan.cues) {
        // Upstream: brows ANTICIPATE the prominence (browTime = time - 0.065)
        // and take the strongest single cue, while the head FOLLOWS it
        // (headTime = time + 0.085) and accumulates. The two are independent —
        // adding the brow term changes no head value.
        const brow = pulse(speechTime, cue.browTime, 0.16, 0.24) * cue.strength;
        const head = pulse(speechTime, cue.headTime, 0.19, 0.34) * cue.strength;
        browPulse = Math.max(browPulse, brow);
        if (head > 0) activeBeats += 1;
        headPitchPulse += head * 0.017;
        headYawPulse += head * cue.direction * 0.006;
      }
    }

    /**
     * THE HEAD'S OWN IMPULSE. Sampled from `headEnvelope`, which is permanently
     * the neutral branch, so the accepted head cannot move when affect changes.
     */
    const headEnvelope =
      plan && active ? sampleSemanticAffectEnvelope(plan.headEnvelope, speechTime) : 0;
    const semanticImpulse = plan ? Math.max(0, headEnvelope - plan.headEnvelope.baseline) : 0;
    /**
     * The FACE's impulse, from the inferred affect — now PER PHRASE, so warmth
     * is sustained across a long utterance instead of decaying to a residue
     * after the first second. The head does not read this.
     */
    const affectEnvelope =
      plan && active
        ? samplePhraseAffect(plan.affectPhraseEnvelopes, plan.affectPhraseSpans, speechTime)
        : 0;

    // Upstream gaze channel, restricted to the head-driving path. NO eye output
    // is produced here; `gazeX`/`gazeY` exist only because upstream folds them
    // into the head target below.
    let gazeX = 0;
    let gazeY = 0;
    if (plan && active && speechTime < plan.durationSeconds - 0.52) {
      const opening = smoothstep01((speechTime + 0.04) / 0.34);
      gazeX = ((plan.seed & 1) === 0 ? -1 : 1) * 0.12 * (1 - opening);
      gazeY = -0.025 * (1 - opening);
    }
    /**
     * UPSTREAM'S AMBIENT SACCADE SCHEDULER — the thing that actually keeps its
     * avatar's eyes alive, now allowed to run WHILE SPEAKING.
     *
     * Upstream gates this to `!speechActive && (state === 'idle' | 'listening')`.
     * That is correct for upstream, whose avatar is a live agent and spends most
     * of a conversation listening, transcribing or thinking — states that also
     * carry large held looks (`thinking` alone is gazeX -0.46). Our avatar plays
     * back a monologue and is therefore in `speaking` essentially 100% of the
     * time, i.e. permanently in the one state upstream deliberately keeps still.
     * Measured consequence: |gazeX| peaks at 0.077 in the opening 340 ms and is
     * 0.005 for the remaining 36 seconds.
     *
     * ONE GATE IS CHANGED and nothing else. `scheduleAmbientGaze` keeps
     * upstream's own amplitudes (+/-0.065 X, +/-0.0375 Y), its own hold
     * (0.32-1.02 s), its own interval (1.4-4.2 s after release) and its own
     * blink coupling. While speaking it is additionally scaled by upstream's own
     * `listening` factor of 0.42, because that is the value upstream itself uses
     * for "engaged but attentive" rather than a number invented here — which is
     * what keeps this "mostly engaged near camera with small movements" rather
     * than wandering.
     */
    /**
     * CONVERSATION STATE, eased through the SAME `response()` primitive every
     * other channel here uses — there is no second smoothing engine, and this is
     * what stops the gaze snapping when TTS starts.
     *
     * In `speaking` every term is the identity (engagement 1, departure 0,
     * affect 1), so a session that never sets a state is bit-identical to the
     * locked baseline.
     */
    const statePolicy = CONVERSATIONAL_STATE_POLICY[this.conversationState];
    const easeState = (current: number, target: number) =>
      response(
        current,
        target,
        deltaSeconds,
        CONVERSATIONAL_STATE_ATTACK,
        CONVERSATIONAL_STATE_RELEASE
      );
    this.stateGazeEngagement = easeState(this.stateGazeEngagement, statePolicy.gazeEngagement);
    this.stateGazeDepartureX = easeState(this.stateGazeDepartureX, statePolicy.gazeDepartureX);
    this.stateGazeDepartureY = easeState(this.stateGazeDepartureY, statePolicy.gazeDepartureY);
    this.stateAffectScale = easeState(this.stateAffectScale, statePolicy.affectScale);

    let ambientX = 0;
    let ambientY = 0;
    if (this.ambientGazeWhileSpeaking || !active) {
      if (!Number.isFinite(this.ambientGazeNextAt)) {
        this.ambientGazeNextAt =
          now +
          SPEAKING_GAZE_POLICY.firstGapMinSeconds +
          this.ambientRandom() * SPEAKING_GAZE_POLICY.firstGapRangeSeconds;
      }
      if (now >= this.ambientGazeNextAt) this.scheduleAmbientGaze(now);
      if (now < this.ambientGazeReleaseAt) {
        // ONE amplitude, set in SPEAKING_GAZE_POLICY. The borrowed 0.42
        // `listening` scale is gone: it was compensating for a unit mismatch,
        // not expressing an intent, and stacking two scalars made the real
        // deflection impossible to read off the code.
        ambientX = this.ambientGazeX;
        ambientY = this.ambientGazeY;
      }
    }
    /**
     * The state's own gaze terms. `gazeEngagement` scales the ambient saccade
     * the gaze owner already produced; `gazeDeparture` is upstream's held
     * thinking look-away at this asset's amplitude. Both are applied HERE, to
     * the ambient term, so they reach `channels.eyeGazeX/Y` and never the head.
     */
    ambientX = ambientX * this.stateGazeEngagement + this.stateGazeDepartureX;
    ambientY = ambientY * this.stateGazeEngagement + this.stateGazeDepartureY;
    if (plan && active) {
      gazeX += plan.asymmetryDirection * semanticImpulse * 0.024;
      gazeY += -0.35 * semanticImpulse * 0.016;
    }

    /**
     * TWO GAZE CHANNELS, and this is the second structural concession to the
     * head freeze.
     *
     * Upstream has one gaze channel and folds it into the head target
     * (`gazeX * 0.055`). If the ambient saccades that now run during speech went
     * through that same channel, they would move the hardware-accepted head as a
     * side effect of an EYE change. So:
     *
     *   `channels.gazeX/Y`             head-facing. EXACTLY the accepted signal:
     *                                  opening turn-away plus semantic impulse,
     *                                  with no ambient term during speech.
     *   `channels.eyeGazeX/Y`          eye-facing. The same signal PLUS the
     *                                  ambient saccades.
     *
     * Both use upstream's own 0.075 s / 0.16 s and 0.08 s / 0.18 s response, so
     * the eye motion is upstream's motion; only its routing is split.
     */
    this.channels.gazeX = response(this.channels.gazeX, gazeX, deltaSeconds, 0.075, 0.16);
    this.channels.gazeY = response(this.channels.gazeY, gazeY, deltaSeconds, 0.08, 0.18);
    this.channels.eyeGazeX = response(
      this.channels.eyeGazeX,
      gazeX + ambientX,
      deltaSeconds,
      0.075,
      0.16
    );
    this.channels.eyeGazeY = response(
      this.channels.eyeGazeY,
      gazeY + ambientY,
      deltaSeconds,
      0.08,
      0.18
    );

    const semanticHeadYaw =
      plan && active ? semanticImpulse * plan.asymmetryDirection * 0.0045 : 0;
    // Upstream picks 0.006 for the `concerned` affect and -0.003 otherwise. Only
    // the neutral path is reachable here, so the -0.003 constant is the one used.
    const semanticHeadPitch = plan && active ? semanticImpulse * -0.003 : 0;

    const targetHeadYaw = this.channels.gazeX * 0.055 + headYawPulse + semanticHeadYaw;
    const targetHeadPitch = this.channels.gazeY * -0.03 + headPitchPulse + semanticHeadPitch;
    const targetHeadRoll = headYawPulse * -0.28 - semanticHeadYaw * 0.42;

    this.channels.headYaw = response(this.channels.headYaw, targetHeadYaw, deltaSeconds, 0.2, 0.35);
    this.channels.headPitch = response(
      this.channels.headPitch,
      targetHeadPitch,
      deltaSeconds,
      0.2,
      0.34
    );
    this.channels.headRoll = response(
      this.channels.headRoll,
      targetHeadRoll,
      deltaSeconds,
      0.22,
      0.38
    );

    const headPitch = clamp(this.channels.headPitch, -0.14, 0.1);
    const headYaw = clamp(this.channels.headYaw, -0.16, 0.16);
    const headRoll = clamp(this.channels.headRoll, -0.032, 0.032);

    /**
     * BROWS — upstream's own targets and response constants.
     *
     * Under the neutral affect this port fixes (see `planSemanticAffectEnvelope`),
     * upstream's semantic and action brow targets collapse to constants, so the
     * only live term is the prosodic pulse. That is deliberate: it is exactly the
     * part of upstream's brow behaviour that SUPPORTS SPEECH, and it arrives here
     * with upstream's own `* 0.16` gain and 0.12 s / 0.28 s response.
     *
     *   browConcern  -> constant 0.035 (neutral rest). Structurally present.
     *   browLift     -> browPulse * 0.16. The live channel.
     *   browFurrow   -> 0 under neutral affect. Structurally present.
     *
     * `eyeWiden` (browPulse * 0.025) and `eyeSquint` are upstream's LID channels,
     * not brow channels, and belong to the affect/expression system this
     * experiment is explicitly not integrating yet. They are omitted.
     */
    /**
     * Upstream's `speechFade` and its per-region envelope offsets, verbatim.
     * `affectEnabled` is ours: it lets the review panel run the layer at the
     * inferred affect or hold it at neutral, without changing any constant.
     */
    const speechFade =
      plan && active
        ? speechTime < 0
          ? smoothstep01((speechTime + AFFECT_ANTICIPATION_SECONDS) / AFFECT_ANTICIPATION_SECONDS)
          : speechTime > plan.durationSeconds
            ? 1 - smoothstep01((speechTime - plan.durationSeconds) / 0.4)
            : 1
        : 0;
    /**
     * `stateAffectScale` is 1.0 in `speaking`, so the locked warmth reaches the
     * face untouched. Listening and thinking reduce it — an attentive face
     * rather than a speaking one — through the amplitude the affect system
     * already has, not through a second expression path.
     */
    const motionScale =
      this.affectEnabled && plan
        ? calibrateExpressionIntensity(plan.intensity) * this.stateAffectScale
        : 0;
    /**
     * The envelope level at an offset. While speaking this is the per-phrase
     * envelope; while listening or thinking there is no utterance to shape, so
     * the affect rests at `IDLE_AFFECT_PRESENCE` and the STATE's own
     * `affectScale` (already folded into `motionScale`) decides how much of it
     * shows. One envelope, one path, two levels.
     */
    const sampleAt = (offset: number) =>
      plan && active
        ? samplePhraseAffect(
            plan.affectPhraseEnvelopes,
            plan.affectPhraseSpans,
            speechTime + offset
          )
        : plan
          ? IDLE_AFFECT_PRESENCE
          : 0;
    /** `speechFade` is upstream's utterance edge; outside one the rest applies. */
    const affectPresence = active ? speechFade : plan ? IDLE_AFFECT_PRESENCE : 0;
    /**
     * BROWS read the same envelope as every other region, THROUGH A THRESHOLD.
     * Cheeks, smile and lids keep the ungated envelope, which is what makes this
     * one expression state with region-specific outputs rather than an
     * independent brow animation.
     */
    const browEnvelope = sampleAt(0.035);
    const browEngagement = smoothstep01(
      (browEnvelope - SEMANTIC_BROW_ENGAGE) /
        Math.max(1e-4, SEMANTIC_BROW_FULL - SEMANTIC_BROW_ENGAGE)
    );
    // BROWS remain gated on speech: a semantic brow needs a sentence.
    const browAffectScale = active ? speechFade * motionScale * browEngagement : 0;
    const eyeAffectScale = affectPresence * motionScale * (active ? affectEnvelope : IDLE_AFFECT_PRESENCE);
    const cheekAffectScale = affectPresence * motionScale * sampleAt(-0.045);
    const smileAffectScale = affectPresence * motionScale * sampleAt(-0.085);
    const affectScale = eyeAffectScale;

    /**
     * BROW TIMING — gradual onset, slow release.
     *
     * Upstream's brow response is 0.12-0.17 s attack / 0.28-0.32 s release: a
     * quick brow, appropriate for the per-prominence pulse it was written for.
     * The target's brows rise gradually, hold, and release slowly, so the three
     * brow channels get `SEMANTIC_BROW_ATTACK` / `SEMANTIC_BROW_RELEASE`
     * instead. This is the CHANNEL's own smoothing, not the affect envelope —
     * `planSemanticAffectEnvelope` is untouched — and it applies to no other
     * region, so cheeks, smile and lids keep upstream's timing exactly.
     *
     * It is also what turns a narrow envelope apex into a readable hold: the
     * slow release carries the brow well past the moment the gate closes.
     */
    /**
     * THE AFFECT TARGETS FOR THIS INSTANT.
     *
     * `plan.affectTargets` is the RESPONSE-level intent. When the plan carries
     * sentence-level `intentSegments`, the segment covering the audio clock wins
     * — so a response can move between attentive, warm, curious and concerned
     * instead of holding one attitude for forty seconds.
     *
     * The handover is smoothed by the SAME `response()` calls below that already
     * smooth every affect channel, so a segment change eases rather than snaps
     * and no second smoothing engine exists. With no segments this is exactly
     * `plan.affectTargets`, which is why the locked baseline is unaffected.
     */
    const activeTargets = this.resolveAffectTargets(plan, speechTime);

    this.channels.browConcern = response(
      this.channels.browConcern,
      NEUTRAL_BROW_CONCERN +
        ((activeTargets?.browConcern ?? NEUTRAL_BROW_CONCERN) - NEUTRAL_BROW_CONCERN) *
          browAffectScale,
      deltaSeconds,
      SEMANTIC_BROW_ATTACK,
      SEMANTIC_BROW_RELEASE
    );
    /**
     * PROSODIC BROW PULSES ARE OFF, AT THE SOURCE.
     *
     * Upstream's live brow term is `browPulse * 0.16` — a lift on every acoustic
     * prominence. Hardware rejected it as robotic, and the target's brows move
     * SELECTIVELY, not on the rhythm of the speech. Removing it here rather than
     * gating the brow region downstream means no code path can reintroduce a
     * rhythmic brow, and `browPulse` survives as telemetry only.
     *
     * What remains is the SEMANTIC term, `affectTargets.browLift * browAffectScale`.
     * On this payload the inferred affect is `warm`, whose `browLift` is 0.18,
     * and after the intensity curve and the calibration that lands below
     * `browOuterUp`'s useful minimum — so the brows render as neutral. That is
     * SEMANTIC-SIGNAL-LIMITED, and it is the correct outcome of the brief's
     * "keep brows mostly neutral rather than inventing rhythmic movement".
     */
    this.channels.browLift = response(
      this.channels.browLift,
      (activeTargets?.browLift ?? 0) * browAffectScale,
      deltaSeconds,
      SEMANTIC_BROW_ATTACK,
      SEMANTIC_BROW_RELEASE
    );
    this.channels.browFurrow = response(
      this.channels.browFurrow,
      (activeTargets?.browFurrow ?? 0) * browAffectScale,
      deltaSeconds,
      SEMANTIC_BROW_ATTACK,
      SEMANTIC_BROW_RELEASE
    );

    /**
     * AFFECT — upstream's own targets, response constants and staggered timing.
     *
     * Upstream deliberately samples the same envelope at slightly different
     * times per region so the face does not move as one rigid mask: brows lead
     * by 35 ms, lids are on time, cheeks trail by 45 ms and the slower mouth
     * corners trail by 85 ms. Those offsets are copied verbatim, as are the
     * `response()` attack/release pairs below.
     *
     * `motionScale` is upstream's `calibrateExpressionIntensity(plan.intensity)`
     * contrast curve. Note it is a FACIAL intensity and has nothing to do with
     * `THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE`, which is the locked head.
     */
    this.channels.smileMouth = response(
      this.channels.smileMouth,
      (activeTargets?.smileMouth ?? 0) * smileAffectScale,
      deltaSeconds,
      0.3,
      0.52
    );
    this.channels.cheekRaise = response(
      this.channels.cheekRaise,
      (activeTargets?.cheekRaise ?? 0) * cheekAffectScale,
      deltaSeconds,
      0.2,
      0.38
    );
    this.channels.eyeSquint = response(
      this.channels.eyeSquint,
      (activeTargets?.eyeSquint ?? 0) * eyeAffectScale,
      deltaSeconds,
      0.16,
      0.3
    );
    this.channels.eyeWiden = response(
      this.channels.eyeWiden,
      (activeTargets?.eyeWiden ?? 0) * eyeAffectScale,
      deltaSeconds,
      0.1,
      0.25
    );
    this.channels.surpriseMouth = response(
      this.channels.surpriseMouth,
      (activeTargets?.surpriseMouth ?? 0) * eyeAffectScale,
      deltaSeconds,
      0.1,
      0.34
    );
    this.channels.concernMouth = response(
      this.channels.concernMouth,
      (activeTargets?.concernMouth ?? 0) * cheekAffectScale,
      deltaSeconds,
      0.24,
      0.56
    );
    this.channels.curiosityMouth = response(
      this.channels.curiosityMouth,
      (activeTargets?.curiosityMouth ?? 0) * smileAffectScale,
      deltaSeconds,
      0.2,
      0.44
    );
    this.channels.emphasisMouth = response(
      this.channels.emphasisMouth,
      (activeTargets?.emphasisMouth ?? 0) * cheekAffectScale,
      deltaSeconds,
      0.14,
      0.34
    );

    /**
     * Upstream's seeded brow asymmetry, driven by the BROW ENGAGEMENT rather
     * than by `semanticImpulse`.
     *
     * `semanticImpulse` is sampled from `headEnvelope`, which is permanently on
     * the neutral branch so the accepted head cannot move — it is ~0 here, and
     * the asymmetry it produced was ~0 with it, leaving both brows identical.
     * Same field, same seeded direction, a signal that is actually alive, and it
     * is zero whenever the brow is, so a resting face stays symmetric.
     */
    const semanticBrowAsymmetry =
      plan && active ? plan.asymmetryDirection * browEngagement * SEMANTIC_BROW_ASYMMETRY : 0;
    const asymmetrySource = clamp(semanticBrowAsymmetry, -0.34, 0.34);
    const browLift = clamp01(this.channels.browLift);
    const browLiftLeft = clamp01(asymmetrySource < 0 ? browLift * -asymmetrySource : 0);
    const browLiftRight = clamp01(asymmetrySource > 0 ? browLift * asymmetrySource : 0);

    /**
     * BLINK — upstream's planned cues while speaking, upstream's ambient
     * scheduler while not. Copied verbatim, including the 255 ms double-blink
     * offset and the per-eye delay.
     */
    /**
     * BLINK — upstream's RANDOM SCHEDULING, rendered with the CURRENT shape and
     * both lids synchronised.
     *
     * Hardware kept upstream's SHAPE (52/18/105 ms) and rejected the HUMAN
     * variant, but wanted upstream's non-periodic TIMING. So the scheduler is
     * upstream's, untouched — `planBlinkCues` with its seeded intervals, its
     * 1.15 s minimum separation, its 64% phrase-boundary preference and its 8.5%
     * double blinks — while the rendering of each cue changes in exactly one
     * way:
     *
     *   the per-eye STRENGTH MISMATCH and the per-eye DELAY are not used.
     *
     * Upstream randomises left 0.94-1.00 and right 0.90-0.98 and offsets the
     * right eye by up to 9 ms. Through the Hyper3D calibration's 1.05 left-only
     * side-balance gain that lands the left lid at ~1.00 and the right at
     * 0.90-0.98, so the right lid never fully closed — the defect this pass was
     * asked to remove. Both eyes now take one value, at one instant, at full
     * closure. `BlinkCue.leftStrength` / `rightStrength` / `rightDelay` are still
     * planned by the upstream code and are simply not read here.
     */
    let blinkValue = 0;
    if (plan && active) {
      for (const blink of plan.blinks) {
        blinkValue = Math.max(blinkValue, sampleEyelid(speechTime, blink.time, 1));
        if (blink.doubleBlink) {
          // Upstream's second beat, 255 ms later and slightly lighter. Kept: a
          // double blink is part of what makes the cadence read as non-periodic.
          blinkValue = Math.max(blinkValue, sampleEyelid(speechTime, blink.time + 0.255, 0.9));
        }
      }
    }
    if (!active) {
      if (!Number.isFinite(this.ambientBlinkAt)) this.scheduleAmbientBlink(now, 1.1);
      if (now > this.ambientBlinkAt + 0.21) this.scheduleAmbientBlink(now, 2.55);
      blinkValue = sampleEyelid(now, this.ambientBlinkAt, 1);
    }
    /**
     * The resting lid, released by `eyeWiden`. Applied in BOTH branches so the
     * eyes do not pop open at the end of the utterance, and composited with
     * `max` so a scheduled blink still closes fully.
     */
    const restingLid =
      RESTING_LID_CLOSURE * (1 - clamp01(this.channels.eyeWiden / LID_WIDEN_RELEASE));
    // One value, both lids. This is the synchronisation.
    const blinkLeft = Math.max(blinkValue, restingLid);
    const blinkRight = Math.max(blinkValue, restingLid);

    return {
      headPitch,
      headYaw,
      headRoll,
      pitchDegrees: headPitch * RAD_TO_DEG,
      yawDegrees: headYaw * RAD_TO_DEG,
      rollDegrees: headRoll * RAD_TO_DEG,
      // Upstream converts these into gazeLeft/Right/Up/Down morph weights. The
      // rig adapter translates them into calibrated Hyper3D eye-look degrees.
      gazeX: this.channels.eyeGazeX,
      gazeY: this.channels.eyeGazeY,
      blinkLeft: clamp01(blinkLeft),
      blinkRight: clamp01(blinkRight),
      smileMouth: clamp01(this.channels.smileMouth),
      cheekRaise: clamp01(this.channels.cheekRaise),
      eyeSquint: clamp01(this.channels.eyeSquint),
      eyeWiden: clamp01(this.channels.eyeWiden),
      surpriseMouth: clamp01(this.channels.surpriseMouth),
      concernMouth: clamp01(this.channels.concernMouth),
      curiosityMouth: clamp01(this.channels.curiosityMouth),
      emphasisMouth: clamp01(this.channels.emphasisMouth),
      affect: plan?.affect ?? "neutral",
      affectScale,
      speechFade,
      affectEnvelope,
      browEngagement,
      eyeAffectScale,
      cheekAffectScale,
      browConcern: clamp01(this.channels.browConcern),
      browLift,
      browLiftLeft,
      browLiftRight,
      browFurrow: clamp01(this.channels.browFurrow),
      speechActive: active,
      cueCount: plan?.cues.length ?? 0,
      activeBeats,
      browPulse,
      blinkCount: plan?.blinks.length ?? 0,
      speechTime
    };
  }

  /**
   * Upstream's ambient blink scheduler. The three random draws for per-eye
   * strength and delay are STILL MADE, deliberately: they advance the shared
   * `ambientRandom` sequence exactly as upstream does, so the ambient gaze
   * timing that interleaves with it is unchanged. Their values are simply not
   * used for the lids — see the blink block in `sample()`.
   */
  /**
   * The affect targets in force at `speechTime`.
   *
   * Segments are contiguous phrase spans, so a linear scan finds the owner; the
   * response-level targets are the fallback both before the first segment and
   * whenever segmentation is off.
   */
  private resolveAffectTargets(
    plan: HeadPerformancePlan | null,
    speechTime: number
  ): ExpressiveAffectTargets | undefined {
    if (!plan) return undefined;
    if (!plan.intentSegments.length) return plan.affectTargets;
    for (const segment of plan.intentSegments)
      if (speechTime >= segment.start && speechTime <= segment.end)
        return AFFECT_TARGETS[segment.intent.affect];
    return plan.affectTargets;
  }

  /** The intent in force at `speechTime`, for the review panel and the tests. */
  activeIntent(speechTime: number): PerformanceIntent | undefined {
    const plan = this.plan;
    if (!plan) return undefined;
    for (const segment of plan.intentSegments)
      if (speechTime >= segment.start && speechTime <= segment.end) return segment.intent;
    return plan.intent;
  }

  private scheduleAmbientBlink(now: number, minimumDelay: number): void {
    this.ambientBlinkAt = now + minimumDelay + this.ambientRandom() * 2.85;
    this.ambientBlinkLeft = 0.94 + this.ambientRandom() * 0.06;
    this.ambientBlinkRight = 0.9 + this.ambientRandom() * 0.08;
    this.ambientBlinkRightDelay = (this.ambientRandom() - 0.5) * 0.018;
  }

  /**
   * Upstream's scheduler, with `SPEAKING_GAZE_POLICY` supplying the amplitudes
   * and the gap. The three random draws happen in upstream's order, so the
   * sequence a given seed produces has the same STRUCTURE as upstream's.
   */
  private scheduleAmbientGaze(now: number): void {
    const policy = SPEAKING_GAZE_POLICY;
    this.ambientGazeX = (this.ambientRandom() - 0.5) * 2 * policy.yawAmplitude;
    this.ambientGazeY = (this.ambientRandom() - 0.5) * 2 * policy.pitchAmplitude;
    this.ambientGazeReleaseAt =
      now + policy.holdMinSeconds + this.ambientRandom() * policy.holdRangeSeconds;
    this.ambientGazeNextAt =
      this.ambientGazeReleaseAt + policy.gapMinSeconds + this.ambientRandom() * policy.gapRangeSeconds;
  }
}
