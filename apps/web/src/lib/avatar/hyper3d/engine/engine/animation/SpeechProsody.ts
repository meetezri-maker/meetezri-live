import type { TimedPhonemeLike } from "./SpeechPerformancePlan";

/**
 * FINAL MOTOR SPEECH — how the sentence was actually delivered.
 *
 * `SpeechPerformancePlan` says WHERE the speaker intends emphasis, from the
 * text. It cannot say how hard or how fast that intention was physically
 * delivered, because it never looks at the audio. This does.
 *
 * WHAT IS AND IS NOT AVAILABLE. The payload carries no audio-energy track and
 * every phoneme's `intensity` is 1 on the production clip, so there is no
 * loudness signal to read. What there IS, and what this uses, is the MFA
 * alignment itself: vowel durations, syllable rate, voiced-run structure and
 * real pause placement. Those are properties of the actual delivery, not of the
 * text — the same sentence read faster or with a different stress pattern
 * produces a different track. The live articulation envelope
 * (`SpeechEnvelope.speechActivity`, derived from the jaw and lip pose) is folded
 * in at runtime as a bounded modulator.
 *
 * FORBIDDEN, explicitly: nothing here may become an angle. `pitch = energy * k`
 * is the energy-puppet failure P18 was built to remove, and it is why every
 * feature below is normalised to 0-1 and consumed only as a MODULATOR of motor
 * drive — it changes how strongly and how quickly an intention is delivered,
 * never whether one exists or where the head ends up.
 */

/** ARPAbet vowels. Syllable nuclei, and where duration-based stress lives. */
const VOWELS = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY",
  "IH", "IY", "OW", "OY", "UH", "UW"
]);

const stripStress = (p: string) => p.replace(/\d+$/, "").toUpperCase();

export interface ProsodyFrame {
  /** 0-1. How prominent the syllable being spoken is, from vowel duration. */
  prominence: number;
  /** 0-1. Local speaking rate against the utterance median. 0.5 is typical. */
  rate: number;
  /** -1..1. Whether delivery is accelerating or slowing right now. */
  rateChange: number;
  /** 0-1. Position through the current voiced run. */
  contour: number;
  /** 0-1, rising as a real pause approaches. */
  pauseApproach: number;
  /** 0-1. 1 mid-phrase, falling into a phrase end. */
  continuation: number;
  /** 0-1. Articulation activity, from the phoneme track. */
  activity: number;
  /** -1..1. Rise and fall of that activity. */
  activityChange: number;
  /** True while a phoneme other than SIL is being spoken. */
  voiced: boolean;
}

export const neutralProsody: ProsodyFrame = {
  prominence: 0, rate: 0.5, rateChange: 0, contour: 0, pauseApproach: 0,
  continuation: 0, activity: 0, activityChange: 0, voiced: false
};

const SAMPLE_HZ = 100;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp11 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);
const PAUSE_SECONDS = 0.14;

/**
 * A precomputed prosody track, sampled by audio clock.
 *
 * Precomputed rather than streamed for the same reason the plan is: it makes
 * every read a PURE FUNCTION OF THE CLOCK. A seek lands on the prosody that time
 * owns, shifting the audio shifts the whole track with it, and the motor
 * controller — which is legitimately stateful — cannot be the place where a
 * hidden second clock creeps in.
 */
export class ProsodyTrack {
  private frames: ProsodyFrame[] = [];
  private duration = 0;

  constructor(phonemes: TimedPhonemeLike[] = [], durationSeconds = 0) {
    if (phonemes.length && durationSeconds > 0) this.build(phonemes, durationSeconds);
  }

  private build(phonemes: TimedPhonemeLike[], durationSeconds: number) {
    this.duration = durationSeconds;
    const count = Math.ceil(durationSeconds * SAMPLE_HZ) + 1;

    /**
     * Vowel prominence.
     *
     * A stressed syllable is held longer than an unstressed one by the same
     * speaker, so a vowel's duration against the LOCAL median is a usable stress
     * estimate without any pitch tracking. Local rather than global because a
     * speaker slows down and speeds up across a paragraph, and a globally long
     * vowel inside a slow passage is not prominent.
     */
    const vowels = phonemes
      .filter((p) => VOWELS.has(stripStress(p.phoneme)))
      .map((p) => ({ at: (p.start_time + p.end_time) / 2, start: p.start_time, end: p.end_time, dur: p.end_time - p.start_time }));
    const localMedian = (at: number) => {
      const near = vowels.filter((v) => Math.abs(v.at - at) < 2.5).map((v) => v.dur).sort((a, b) => a - b);
      if (!near.length) return 0.09;
      return near[Math.floor(near.length / 2)];
    };

    // Real pauses, i.e. the ones the planner also treats as phrase boundaries.
    const pauses = phonemes
      .filter((p) => p.phoneme === "SIL" && p.end_time - p.start_time >= PAUSE_SECONDS)
      .map((p) => ({ start: p.start_time, end: p.end_time }));

    // Voiced runs between those pauses.
    const runs: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const p of pauses) {
      if (p.start - cursor > 0.12) runs.push({ start: cursor, end: p.start });
      cursor = p.end;
    }
    if (durationSeconds - cursor > 0.12) runs.push({ start: cursor, end: durationSeconds });

    const rawActivity = new Array<number>(count).fill(0);
    const rawProminence = new Array<number>(count).fill(0);
    const rawRate = new Array<number>(count).fill(0);

    for (let i = 0; i < count; i += 1) {
      const t = i / SAMPLE_HZ;
      const ph = phonemes.find((p) => t >= p.start_time && t < p.end_time);
      const voiced = Boolean(ph && ph.phoneme !== "SIL");
      /**
       * Articulation activity. Vowels open the tract and carry most visible
       * movement, so they read higher than consonants; SIL is zero. This is a
       * shape estimate from the alignment, not a measured amplitude, and it is
       * only ever used as a bounded modulator.
       */
      rawActivity[i] = !voiced ? 0 : VOWELS.has(stripStress(ph!.phoneme)) ? 1 : 0.55;

      const vowel = vowels.find((v) => t >= v.start && t < v.end);
      rawProminence[i] = vowel ? clamp01((vowel.dur / Math.max(0.02, localMedian(t)) - 0.75) / 1.1) : 0;

      // Phonemes per second over a one-second window, normalised around 12/s.
      const from = t - 0.5, to = t + 0.5;
      const n = phonemes.filter((p) => p.phoneme !== "SIL" && p.end_time > from && p.start_time < to).length;
      rawRate[i] = clamp01(n / 18);
    }

    /** Two smoothing passes, forward then backward, so nothing is phase-shifted. */
    const smooth = (src: number[], seconds: number) => {
      const k = Math.max(1, Math.round(seconds * SAMPLE_HZ));
      const a = 2 / (k + 1);
      const fwd = new Array<number>(src.length).fill(0);
      let acc = src[0];
      for (let i = 0; i < src.length; i += 1) { acc += (src[i] - acc) * a; fwd[i] = acc; }
      const out = new Array<number>(src.length).fill(0);
      acc = fwd[fwd.length - 1];
      for (let i = src.length - 1; i >= 0; i -= 1) { acc += (fwd[i] - acc) * a; out[i] = acc; }
      return out;
    };
    const activity = smooth(rawActivity, 0.09);
    const prominence = smooth(rawProminence, 0.12);
    const rate = smooth(rawRate, 0.6);

    const derivative = (src: number[], scale: number) =>
      src.map((_, i) => {
        const a = src[Math.max(0, i - 3)], b = src[Math.min(src.length - 1, i + 3)];
        return clamp11(((b - a) / (6 / SAMPLE_HZ)) * scale);
      });
    const activityChange = derivative(activity, 0.35);
    const rateChange = derivative(rate, 1.6);

    this.frames = new Array(count);
    for (let i = 0; i < count; i += 1) {
      const t = i / SAMPLE_HZ;
      const run = runs.find((r) => t >= r.start && t <= r.end);
      const ph = phonemes.find((p) => t >= p.start_time && t < p.end_time);
      const nextPause = pauses.find((p) => p.start >= t);
      const toPause = nextPause ? nextPause.start - t : Infinity;
      this.frames[i] = {
        prominence: clamp01(prominence[i]),
        rate: clamp01(rate[i]),
        rateChange: rateChange[i],
        contour: run ? clamp01((t - run.start) / Math.max(0.001, run.end - run.start)) : 0,
        // Rises over the last 0.6 s before a real pause: the body knows it is coming.
        pauseApproach: Number.isFinite(toPause) ? clamp01(1 - toPause / 0.6) : 0,
        continuation: run ? clamp01(1 - Math.max(0, (t - (run.end - 0.5)) / 0.5)) : 0,
        activity: clamp01(activity[i]),
        activityChange: activityChange[i],
        voiced: Boolean(ph && ph.phoneme !== "SIL")
      };
    }
  }

  /** Pure function of the audio clock. Linear between the 100 Hz samples. */
  at(clock: number): ProsodyFrame {
    if (!this.frames.length) return neutralProsody;
    if (clock <= 0) return this.frames[0];
    if (clock >= this.duration) return this.frames[this.frames.length - 1];
    const x = clock * SAMPLE_HZ;
    const i = Math.floor(x);
    const j = Math.min(this.frames.length - 1, i + 1);
    const f = x - i;
    const a = this.frames[i], b = this.frames[j];
    const mix = (p: number, q: number) => p + (q - p) * f;
    return {
      prominence: mix(a.prominence, b.prominence),
      rate: mix(a.rate, b.rate),
      rateChange: mix(a.rateChange, b.rateChange),
      contour: mix(a.contour, b.contour),
      pauseApproach: mix(a.pauseApproach, b.pauseApproach),
      continuation: mix(a.continuation, b.continuation),
      activity: mix(a.activity, b.activity),
      activityChange: mix(a.activityChange, b.activityChange),
      voiced: f < 0.5 ? a.voiced : b.voiced
    };
  }

  get sampleCount() {
    return this.frames.length;
  }
}
