import type { TimedPhonemeLike } from "./SpeechPerformancePlan";
import type { ProsodyFrame } from "./SpeechProsody";
import type { PerformanceIntentFrame } from "./SpeechPerformanceConductor";
import { modulationLimits, type CarrierModulation } from "./TalkingHeadSpeakingAdapter";

/**
 * HYBRID — the sentence, reduced to something that can only SHAPE motion.
 *
 * The TalkingHead carrier is what moves the head, and it stays that way. This
 * module's entire job is to turn the speech performance plan and the prosody
 * track into three bounded scalars the carrier can apply to whatever it is
 * already doing.
 *
 * WHAT CHANGED FROM THE PREVIOUS PASSES. `SpeechPerformancePlan`,
 * `SpeechPerformanceConductor` and `ProsodyTrack` are all reused unchanged, but
 * their ROLE is inverted. They used to produce head angles; here nothing they
 * produce reaches a bone. Only `emphasis` — one number, 0 to 1 — survives, plus
 * a pause state derived from the phoneme timeline. Every head target, every
 * clause arc, every anchor pitch and roll from the conductor is discarded.
 *
 * WHY IT CANNOT START A NOD. This module never expresses a direction. It says
 * "the speaker is committing hard right now"; the carrier decides what that
 * means given the stroke it is already in. The sign lives in the carrier, which
 * is the only place that knows which way the head is travelling.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * How a gap in the phoneme track is treated.
 *
 * The hardware verdict on the plain carrier was that gaps are much better than
 * the previous controllers but still slightly noticeable — so gaps are damped by
 * KIND, not uniformly. A micro gap between words is not a pause a speaker's body
 * responds to; a clause boundary is.
 */
export const pauseBands = {
  /** Below this a gap is inside a word or between two words. No response. */
  microSeconds: 0.12,
  /** Up to here it is a phrase gap: the body eases slightly. */
  phraseSeconds: 0.35,
  /** A phrase gap damps to this; a clause pause ramps on to 1. */
  phraseDamping: 0.4,
  /** How long the damping takes to arrive and to let go, in seconds. */
  attackSeconds: 0.18,
  releaseSeconds: 0.12
};

const SAMPLE_HZ = 100;

/**
 * Pause damping, precomputed and sampled by the audio clock.
 *
 * Precomputed for the same reason the plan and the prosody track are: it keeps
 * every read a pure function of the clock, so a seek lands on the right state
 * and the carrier — which is legitimately stateful — stays the only place that
 * accumulates anything.
 */
export class PauseDampingTrack {
  private samples: number[] = [];
  private duration = 0;

  constructor(phonemes: TimedPhonemeLike[] = [], durationSeconds = 0) {
    if (phonemes.length && durationSeconds > 0) this.build(phonemes, durationSeconds);
  }

  private build(phonemes: TimedPhonemeLike[], durationSeconds: number) {
    this.duration = durationSeconds;
    const count = Math.ceil(durationSeconds * SAMPLE_HZ) + 1;
    const raw = new Array<number>(count).fill(0);

    for (const p of phonemes) {
      if (p.phoneme !== "SIL") continue;
      const length = p.end_time - p.start_time;
      if (length < pauseBands.microSeconds) continue;
      /**
       * A phrase gap gets a partial response; anything past `phraseSeconds`
       * ramps toward full over the same span again, so a long clause pause
       * damps more than a short breath without a step between the two.
       */
      const target = length <= pauseBands.phraseSeconds
        ? pauseBands.phraseDamping * ((length - pauseBands.microSeconds) / Math.max(1e-4, pauseBands.phraseSeconds - pauseBands.microSeconds))
        : pauseBands.phraseDamping + (1 - pauseBands.phraseDamping) *
          clamp01((length - pauseBands.phraseSeconds) / pauseBands.phraseSeconds);
      const from = Math.max(0, Math.floor(p.start_time * SAMPLE_HZ));
      const to = Math.min(count - 1, Math.ceil(p.end_time * SAMPLE_HZ));
      for (let i = from; i <= to; i += 1) raw[i] = Math.max(raw[i], target);
    }

    /**
     * Asymmetric smoothing: damping arrives more slowly than it leaves.
     *
     * A speaker's head settles into a pause gradually and picks up again
     * promptly when the next word starts, and a symmetric filter would make
     * speech resume out of a still head.
     */
    const smoothed = new Array<number>(count).fill(0);
    let v = 0;
    for (let i = 0; i < count; i += 1) {
      const rate = raw[i] > v ? pauseBands.attackSeconds : pauseBands.releaseSeconds;
      const a = 1 - Math.exp(-(1 / SAMPLE_HZ) / Math.max(1e-4, rate));
      v += (raw[i] - v) * a;
      smoothed[i] = v;
    }
    this.samples = smoothed;
  }

  at(clock: number): number {
    if (!this.samples.length) return 0;
    if (clock <= 0) return this.samples[0];
    if (clock >= this.duration) return this.samples[this.samples.length - 1];
    const x = clock * SAMPLE_HZ;
    const i = Math.floor(x);
    const j = Math.min(this.samples.length - 1, i + 1);
    return this.samples[i] + (this.samples[j] - this.samples[i]) * (x - i);
  }

  get sampleCount() {
    return this.samples.length;
  }
}

export interface ModulatorTuning {
  /** How much of the plan's emphasis reaches the carrier. */
  emphasisWeight: number;
  /** How much acoustic prominence adds on top. */
  prominenceWeight: number;
  /** Extra eye-contact strength at full emphasis. */
  gazeCommitmentRange: number;
}

export const defaultModulatorTuning: ModulatorTuning = {
  emphasisWeight: 0.85,
  prominenceWeight: 0.3,
  gazeCommitmentRange: 0.15
};

/**
 * Reduces a resolved performance frame and a prosody frame to carrier modulation.
 *
 * Takes the already-resolved intent rather than the plan, so the hybrid shares
 * ONE resolve with the face and gaze consumers — the same shared-intention
 * property the previous pass built, now feeding a different carrier. Everything
 * except `emphasis` is dropped on the floor here, deliberately.
 */
export const modulationFrom = (
  intent: PerformanceIntentFrame | null,
  prosody: ProsodyFrame,
  damping: number,
  tuning: ModulatorTuning = defaultModulatorTuning
): CarrierModulation => {
  const planned = intent ? clamp01(intent.emphasis) : 0;
  const emphasis = clamp01(planned * tuning.emphasisWeight + prosody.prominence * tuning.prominenceWeight);
  return {
    emphasis,
    damping: clamp01(damping),
    // Committing to a point is also committing to the listener.
    gazeCommitment: 1 + tuning.gazeCommitmentRange * planned
  };
};

/** The most a fully-committed emphasis can change, for tests and the panel. */
export const modulationCeiling = {
  gainAtFullEmphasis: 1 + modulationLimits.gain,
  pitchBiasDegrees: modulationLimits.pitchBiasDegrees,
  yawBiasDegrees: modulationLimits.yawBiasDegrees
};
