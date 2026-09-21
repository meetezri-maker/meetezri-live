import type { AvatarPayload, TimedPause, TimedPhoneme } from "../../types/avatarPayload";

/**
 * Sentence and phrase boundaries, as a thing the behaviour layer can be told about.
 *
 * §9 measured blink and gaze at ratio ~1.00 against every speech landmark and found
 * the reason structurally rather than statistically: `BlinkStateMachine` and
 * `GazeBehaviorController` take no speech input of any kind, so they cannot respond
 * to speech. This is the input they were missing.
 *
 * WHICH EDGE. A boundary is anchored on `start` — the instant speech STOPS — not on
 * `end`, where it resumes. That matches the landmark §9 scores against:
 * `whole-face-coordination-diagnostics.mjs` derives `sentenceEnd` as
 * `words[i - 1].end_time`, the end of the last word before a silence. Anchoring on
 * `end` instead would place every blink one pause-length late (0.9 s on the audit
 * clip), which is the difference between a blink that punctuates a sentence and one
 * that arrives after the next has started.
 *
 * WHERE THE BOUNDARIES COME FROM. Two sources, unioned:
 *
 *  1. `payload.pauses` entries typed `sentence_pause` or `phrase_pause`. This is the
 *     authored channel and it is preferred wherever it exists.
 *  2. Silence in the phoneme track — `SIL` phonemes and inter-phoneme gaps.
 *
 * Source 2 is not a fallback of convenience. **No payload in this repository carries
 * a single `pauses` entry**: `scripts/convert-mfa-alignments.mjs` emits `pauses: []`
 * unconditionally, so all 17 generated payloads have an empty array and the authored
 * channel is, today, always empty. Keying behaviour off source 1 alone would be a
 * change that provably never fires. Source 2 reproduces the diagnostic's landmarks
 * exactly on the audit clip — all 6 MFA sentence ends land on a `SIL` start to the
 * millisecond — and it is the same derivation `SpeakingHeadMotionController`
 * `.buildPhraseEvents()` has always used for phrase-level head motion, so it is a
 * precedent in this engine rather than a new proxy.
 *
 * See §10 of `docs/FEMALE_REALISM_REMEDIATION.md`.
 */
export interface SpeechBoundary {
  /** The instant speech stops. This is the anchor everything downstream biases toward. */
  start: number;
  /** The instant speech resumes. Carried for completeness; nothing keys off it today. */
  end: number;
  kind: "sentence" | "phrase";
  source: "authored" | "derived";
}

/**
 * Per-frame view of the boundary timeline, in seconds RELATIVE to now.
 *
 * Deliberately relative: the behaviour layer runs on its own accumulated clock
 * (`IdleExpressionController.time`), which is not guaranteed to equal payload time
 * once freeze-frame, model switches or resets are involved. Handing it offsets from
 * the current instant means no consumer has to reconcile two clocks.
 */
export interface SpeechBoundaryProximity {
  /** Seconds until speech next stops. `Infinity` when nothing lies ahead. */
  secondsToNextStart: number;
  /** Seconds since speech last stopped. `Infinity` when nothing lies behind. */
  secondsSinceLastStart: number;
  /** Index of the upcoming boundary, so a trigger can fire at most once per boundary. */
  nextIndex: number;
  kind: "sentence" | "phrase" | null;
  /** True while inside the pause itself. */
  insidePause: boolean;
}

/** Below this a gap is ordinary articulation, not a pause anyone would read as one. */
const MINIMUM_PAUSE_SECONDS = 0.12;
/** At or above this a pause reads as the end of a sentence rather than a phrase break. */
const SENTENCE_PAUSE_SECONDS = 0.35;
/** Boundaries closer together than this are the same event seen through both sources. */
const MERGE_TOLERANCE_SECONDS = 0.05;

const kindFor = (durationSeconds: number): "sentence" | "phrase" =>
  durationSeconds >= SENTENCE_PAUSE_SECONDS ? "sentence" : "phrase";

/** Authored boundaries. `breath` and `hesitation` are deliberately not boundaries. */
const fromPauses = (pauses: readonly TimedPause[]): SpeechBoundary[] => {
  const boundaries: SpeechBoundary[] = [];
  for (const pause of pauses) {
    if (pause.type !== "sentence_pause" && pause.type !== "phrase_pause") continue;
    const duration = pause.end_time - pause.start_time;
    if (duration < MINIMUM_PAUSE_SECONDS) continue;
    boundaries.push({
      start: pause.start_time,
      end: pause.end_time,
      // The author's own label wins over the duration heuristic.
      kind: pause.type === "sentence_pause" ? "sentence" : "phrase",
      source: "authored"
    });
  }
  return boundaries;
};

/**
 * Boundaries derived from silence in the phoneme track.
 *
 * A `SIL` phoneme's own span is a pause; so is a gap between two consecutive
 * phonemes. Both are measured from where speech stops, which for a `SIL` is its
 * `start_time` — not its `end_time`, where speech resumes.
 */
const fromPhonemes = (phonemes: readonly TimedPhoneme[]): SpeechBoundary[] => {
  const boundaries: SpeechBoundary[] = [];
  for (let i = 0; i < phonemes.length; i += 1) {
    const phoneme = phonemes[i];
    if (phoneme.phoneme === "SIL") {
      const duration = phoneme.end_time - phoneme.start_time;
      // A leading silence is the clip starting, not a speaker pausing.
      if (duration >= MINIMUM_PAUSE_SECONDS && phoneme.start_time > 0.05) {
        boundaries.push({ start: phoneme.start_time, end: phoneme.end_time, kind: kindFor(duration), source: "derived" });
      }
      continue;
    }
    const next = phonemes[i + 1];
    if (!next) continue;
    const gap = next.start_time - phoneme.end_time;
    if (gap >= MINIMUM_PAUSE_SECONDS && phoneme.end_time > 0.05) {
      boundaries.push({ start: phoneme.end_time, end: next.start_time, kind: kindFor(gap), source: "derived" });
    }
  }
  return boundaries;
};

/**
 * Built once per payload, queried once per frame.
 *
 * The query is a linear scan over a list whose length is the number of pauses in a
 * clip — 12 on the 37 s audit paragraph. This biases probabilistic scheduling; it
 * does not drive exact timing, so it does not need an index.
 */
export class SpeechBoundaryTimeline {
  private readonly boundaries: SpeechBoundary[];

  constructor(payload: Pick<AvatarPayload, "pauses" | "phonemes">) {
    const authored = fromPauses(payload.pauses ?? []);
    const derived = fromPhonemes(payload.phonemes ?? []);
    // Authored first, so a derived duplicate of the same instant is the one dropped.
    const merged: SpeechBoundary[] = [...authored];
    for (const candidate of derived) {
      if (merged.some((existing) => Math.abs(existing.start - candidate.start) < MERGE_TOLERANCE_SECONDS)) continue;
      merged.push(candidate);
    }
    this.boundaries = merged.sort((a, b) => a.start - b.start);
  }

  /** True when this payload carries no boundary information at all. */
  get isEmpty() {
    return this.boundaries.length === 0;
  }

  get all(): readonly SpeechBoundary[] {
    return this.boundaries;
  }

  /**
   * Proximity at `time`, or `undefined` when there is nothing to be near.
   *
   * `undefined` is the signal every consumer checks to fall back to its pre-§10
   * behaviour exactly, so a payload with no boundaries can never take a new code
   * path — see the regression assertions in `speechBoundaryCoordination.test.ts`.
   */
  proximityAt(time: number): SpeechBoundaryProximity | undefined {
    if (!this.boundaries.length) return undefined;
    let nextIndex = -1;
    for (let i = 0; i < this.boundaries.length; i += 1) {
      if (this.boundaries[i].start >= time) {
        nextIndex = i;
        break;
      }
    }
    const next = nextIndex >= 0 ? this.boundaries[nextIndex] : undefined;
    const previous = nextIndex === 0 ? undefined : this.boundaries[(nextIndex < 0 ? this.boundaries.length : nextIndex) - 1];
    return {
      secondsToNextStart: next ? next.start - time : Infinity,
      secondsSinceLastStart: previous ? time - previous.start : Infinity,
      nextIndex: nextIndex >= 0 ? nextIndex : this.boundaries.length,
      kind: next?.kind ?? null,
      insidePause: Boolean(previous && time < previous.end)
    };
  }
}
