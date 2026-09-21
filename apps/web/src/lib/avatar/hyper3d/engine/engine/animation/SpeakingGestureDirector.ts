import type { BehaviorRandom } from "../behaviour/naturalism/BehaviorRandom";

/**
 * §P18. Conversational speaking motion, built from EVENTS rather than oscillators.
 *
 * The shipped speaking head was a drift layer: three sine terms on fixed
 * frequencies (yaw 0.19 Hz, pitch 0.31 Hz, roll 0.13 Hz) scaled by an energy
 * term. Measured over the audit clip that produced 415 yaw direction reversals
 * per minute with a 0.955 alternation rate — a metronome — with yaw at 2.86 deg
 * against pitch at 0.99, so she swayed side to side roughly three times as much
 * as she nodded. The median quiet window was 0.63 s: the head never held still.
 *
 * This replaces that with a small vocabulary of bounded gestures triggered by
 * prosodic OPPORTUNITY. Speech structure decides WHETHER a gesture may fire and
 * WHICH one; it never scales the amplitude directly, because
 * `pitch = energy * k` is what makes a head look like a puppet.
 *
 * Like the director in P17 this writes nothing. It publishes intent, and
 * `SpeakingHeadMotionController` — the existing owner of the speaking head
 * pose — executes it.
 */

export type SpeakingGestureKind =
  | "none"
  | "micro-nod"
  | "affirm-nod"
  | "phrase-settle"
  | "yaw-adjust"
  | "tilt"
  | "thought";

export interface SpeakingMotionProfile {
  id: string;
  label: string;
  /** Per-gesture amplitude ceilings, in degrees. */
  microNodPitch: [number, number];
  affirmNodPitch: [number, number];
  settlePitch: [number, number];
  yawAdjust: [number, number];
  tiltRoll: [number, number];
  /** How far the migrating speaking rest orientation may wander, in degrees. */
  restYawSpan: number;
  restPitchSpan: number;
  restRollSpan: number;
  /** Chance an eligible opportunity is actually taken. */
  gestureProbability: number;
  /** Relative weights over the gesture vocabulary. */
  weights: Record<Exclude<SpeakingGestureKind, "none">, number>;
  /** Seconds of enforced stillness after a gesture settles. */
  quietSeconds: [number, number];
  /** Natural frequency of the critically damped follower, in Hz. */
  followerHz: number;
  /** Share of a gesture carried by the neck. */
  neckShare: number;
  /** Chance the eyes lead the head into a gesture, and by how long. */
  gazeLeadProbability: number;
  gazeLeadSeconds: [number, number];
  /** Hard engagement bound on yaw, in degrees. Gestures are clamped inside it. */
  yawEngagementLimit: number;
  /**
   * §P18.2. How far BEFORE the acoustic emphasis the head trajectory peaks, in
   * seconds. Human head motion leads the acoustic maximum slightly; scheduling
   * the peak on the emphasis makes it read as a reaction to the word rather
   * than part of delivering it.
   */
  anticipationSeconds: number;
  /**
   * Amplitude of the continuous in-phrase envelope, in degrees. This is what
   * stops a long voiced run going still — P18.1 left a 3.85 s spoken stretch
   * with no head evolution at all.
   */
  phraseEnvelopeDegrees: number;
  /**
   * §P18.2. `false` restores P18.1's boundary-driven scheduling, which fired
   * around silence. Kept as a real runtime path so the A/B is against what
   * actually shipped rather than a description of it.
   */
  inPhraseScheduling: boolean;
}

const G = (n: number) => n;

/** Conservative: barely-there motion, for the low end of the review. */
export const speakingProfileConservative: SpeakingMotionProfile = {
  id: "conservative", label: "P18 conservative",
  microNodPitch: [G(0.6), G(1.2)], affirmNodPitch: [G(1.4), G(2.2)], settlePitch: [G(0.4), G(0.9)],
  yawAdjust: [G(0.5), G(1.2)], tiltRoll: [G(0.4), G(0.9)],
  restYawSpan: 1, restPitchSpan: 0.6, restRollSpan: 0.5,
  gestureProbability: 0.3,
  weights: { "micro-nod": 5, "affirm-nod": 1, "phrase-settle": 3, "yaw-adjust": 2, tilt: 1.5, thought: 0.3 },
  quietSeconds: [1.6, 3.4], followerHz: 1.5, neckShare: 0.25,
  gazeLeadProbability: 0.3, gazeLeadSeconds: [0.05, 0.12], yawEngagementLimit: 3,
  anticipationSeconds: 0.06, phraseEnvelopeDegrees: 0.18, inPhraseScheduling: true
};

/** Natural: the recommended conversational envelope. */
export const speakingProfileNatural: SpeakingMotionProfile = {
  id: "natural", label: "P18 natural",
  microNodPitch: [G(1.1), G(2.4)], affirmNodPitch: [G(2.6), G(4.2)], settlePitch: [G(0.8), G(1.7)],
  yawAdjust: [G(0.9), G(2.2)], tiltRoll: [G(0.8), G(1.8)],
  restYawSpan: 1.6, restPitchSpan: 1, restRollSpan: 0.9,
  gestureProbability: 0.42,
  weights: { "micro-nod": 5, "affirm-nod": 1.2, "phrase-settle": 3, "yaw-adjust": 2, tilt: 2, thought: 0.4 },
  quietSeconds: [1.2, 2.8], followerHz: 1.9, neckShare: 0.28,
  gazeLeadProbability: 0.4, gazeLeadSeconds: [0.05, 0.15], yawEngagementLimit: 4,
  anticipationSeconds: 0.1, phraseEnvelopeDegrees: 0.3, inPhraseScheduling: true
};

/** Expressive: the strongest that still reads as talking TO the viewer. */
export const speakingProfileExpressive: SpeakingMotionProfile = {
  id: "expressive", label: "P18 expressive",
  microNodPitch: [G(1.6), G(3.2)], affirmNodPitch: [G(3.4), G(5.6)], settlePitch: [G(1.1), G(2.2)],
  // Yaw pulled back from [1.3, 3.0]: at that range EXPRESSIVE became
  // yaw-dominant (2.71 deg against 1.61 of pitch), which is the inversion this
  // pass exists to remove. Lateral character comes from tilt instead.
  yawAdjust: [G(0.9), G(1.8)], tiltRoll: [G(1.2), G(2.6)],
  // Rest yaw span 2.2 -> 1.3: the migrating rest was the remaining source of
  // yaw dominance in EXPRESSIVE once the gesture range was cut.
  restYawSpan: 1.3, restPitchSpan: 1.4, restRollSpan: 1.3,
  gestureProbability: 0.55,
  weights: { "micro-nod": 5, "affirm-nod": 1.6, "phrase-settle": 3, "yaw-adjust": 2.2, tilt: 2.4, thought: 0.6 },
  quietSeconds: [0.9, 2.2], followerHz: 2.2, neckShare: 0.3,
  gazeLeadProbability: 0.45, gazeLeadSeconds: [0.05, 0.16], yawEngagementLimit: 5,
  anticipationSeconds: 0.15, phraseEnvelopeDegrees: 0.45, inPhraseScheduling: true
};

/** P18.1's behaviour, preserved so the review A/B is against the real thing. */
export const speakingProfileP181Baseline: SpeakingMotionProfile = {
  ...speakingProfileNatural,
  id: "p181-baseline", label: "P18.1 baseline (pause driven)",
  inPhraseScheduling: false, phraseEnvelopeDegrees: 0, anticipationSeconds: 0
};

export const speakingMotionProfiles = {
  "p181-baseline": speakingProfileP181Baseline,
  conservative: speakingProfileConservative,
  natural: speakingProfileNatural,
  expressive: speakingProfileExpressive
} satisfies Record<string, SpeakingMotionProfile>;

export type SpeakingMotionProfileId = keyof typeof speakingMotionProfiles;

export interface SpeakingGestureIntent {
  profile: string;
  gesture: SpeakingGestureKind;
  gestureAge: number;
  quiet: boolean;
  /** Target orientation in DEGREES, already inside the engagement bound. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Neck share of the same target. */
  neckYaw: number;
  neckPitch: number;
  neckRoll: number;
  /** Gaze bias in degrees, non-zero only while the eyes are leading. */
  gazeYaw: number;
  restYaw: number;
  restPitch: number;
  restRoll: number;
  /** Position within the current voiced phrase, 0-1, or -1 outside one. */
  phraseProgress: number;
  /** Why the current gesture fired, for the panel. */
  reason: string;
  engaged: boolean;
  /**
   * §P18.1 emphasis level, 0-3, shared with the face and gaze so all three
   * express the SAME moment rather than being scheduled independently.
   *
   * 0 connective speech, 1 minor, 2 clear emphasis, 3 major point. It rises
   * with the gesture and decays with it, so the face evolves around the phrase
   * rather than pulsing on every nod.
   */
  emphasis: number;
  /** Which part of the trajectory is running, for the panel. */
  phase: "quiet" | "continue" | "prep" | "commit" | "peak" | "recover" | "settle";
}

export const neutralSpeakingGestureIntent: SpeakingGestureIntent = {
  profile: "off", gesture: "none", gestureAge: 0, quiet: true,
  yaw: 0, pitch: 0, roll: 0, neckYaw: 0, neckPitch: 0, neckRoll: 0, gazeYaw: 0,
  restYaw: 0, restPitch: 0, restRoll: 0, phraseProgress: -1, reason: "disabled", engaged: true,
  emphasis: 0, phase: "quiet"
};

/**
 * A phrase boundary derived from the REAL payload.
 *
 * The production payload carries no pause table — `pauses` is empty — so a
 * director that waits for pause metadata never fires, which is exactly what the
 * first wiring did. What the payload does carry is 16 SIL phoneme segments of
 * 0.03-0.94 s, and those are the phrase structure. Everything here is derived
 * from signals the live pipeline actually produces.
 */
export interface SpeechBoundary {
  /** Where the silence starts: the end of a spoken phrase. */
  endsAt: number;
  /** Where speech resumes: a phrase onset. */
  resumesAt: number;
  seconds: number;
}

/** Minimum silence that counts as a phrase boundary rather than a stop consonant. */
const BOUNDARY_SECONDS = 0.14;

/**
 * §P18.2. A voiced phrase and the emphasis moments INSIDE it.
 *
 * P18.1 scheduled from silence: opportunities fired at `endsAt - 0.18` and
 * `resumesAt + 0.22`, both hugging SIL. Measured on the real clip that put the
 * head 2.3x more active during silence (0.2415) than during speech (0.1043),
 * with 41.8% of moving frames in SIL and pitch peaks missing the nearest
 * in-phrase emphasis by a median of 466 ms. The body was gesturing in the gaps
 * and going still through the words.
 *
 * Emphasis candidates are now local maxima of the smoothed energy contour
 * strictly INSIDE a voiced run, excluding its outer 15% so a candidate can
 * never land on a boundary.
 */
export interface VoicedPhrase {
  startsAt: number;
  endsAt: number;
  seconds: number;
  /** Emphasis moments inside this phrase, strongest first. */
  emphases: { at: number; strength: number }[];
}

export const buildVoicedPhrases = (
  phonemes: { phoneme: string; start_time: number; end_time: number }[],
  fps = 60
): VoicedPhrase[] => {
  if (!phonemes.length) return [];
  const duration = phonemes[phonemes.length - 1].end_time;
  const frames = Math.ceil(duration * fps);
  const voiced: boolean[] = new Array(frames + 1).fill(false);
  for (let i = 0; i <= frames; i += 1) {
    const t = i / fps;
    const ph = phonemes.find((p) => t >= p.start_time && t < p.end_time);
    voiced[i] = Boolean(ph && ph.phoneme !== "SIL");
  }
  // Smoothed contour, so "a rise" means a swell rather than a phoneme edge.
  const smooth: number[] = new Array(frames + 1).fill(0);
  for (let i = 0; i <= frames; i += 1) {
    const lo = Math.max(0, i - 9), hi = Math.min(frames, i + 9);
    let sum = 0;
    for (let k = lo; k <= hi; k += 1) sum += voiced[k] ? 1 : 0;
    smooth[i] = sum / (hi - lo + 1);
  }
  const out: VoicedPhrase[] = [];
  let runStart = -1;
  for (let i = 0; i <= frames + 1; i += 1) {
    const isVoiced = i <= frames && voiced[i];
    if (isVoiced && runStart < 0) runStart = i;
    if (!isVoiced && runStart >= 0) {
      const runEnd = i - 1;
      const len = runEnd - runStart;
      if (len > Math.round(0.35 * fps)) {
        const lo = runStart + Math.floor(len * 0.15);
        const hi = runEnd - Math.floor(len * 0.15);
        const emphases: { at: number; strength: number }[] = [];
        for (let k = lo + 6; k <= hi; k += 1) {
          const slope = smooth[k] - smooth[k - 6];
          const isLocalMax = slope > 0 && smooth[k] >= smooth[k - 1] && smooth[k] >= smooth[Math.min(frames, k + 1)];
          if (isLocalMax || (k === lo + 6 && emphases.length === 0)) {
            emphases.push({ at: k / fps, strength: Math.max(0.15, slope) });
          }
        }
        // Longer phrases legitimately carry more than one emphasis.
        const wanted = Math.max(1, Math.min(3, Math.round(len / fps / 1.6)));
        emphases.sort((a, b) => b.strength - a.strength);
        const chosen = emphases.slice(0, wanted).sort((a, b) => a.at - b.at);
        // Fall back to the phrase's own middle if the contour is flat.
        out.push({
          startsAt: runStart / fps, endsAt: runEnd / fps, seconds: len / fps,
          emphases: chosen.length ? chosen : [{ at: (runStart + len * 0.4) / fps, strength: 0.2 }]
        });
      }
      runStart = -1;
    }
  }
  return out;
};

export const buildSpeechBoundaries = (
  phonemes: { phoneme: string; start_time: number; end_time: number }[]
): SpeechBoundary[] =>
  phonemes
    .filter((p) => p.phoneme === "SIL" && p.end_time - p.start_time >= BOUNDARY_SECONDS)
    .map((p) => ({ endsAt: p.start_time, resumesAt: p.end_time, seconds: p.end_time - p.start_time }));

export interface SpeakingProsody {
  /** Retained for callers; opportunities are now derived internally. */
  phraseOnset?: boolean;
  phraseEnd?: boolean;
  emphasis?: boolean;
  /** Continuous speech activity, used ONLY as a gate, never as an amplitude. */
  speaking: boolean;
  /** Audio clock, for boundary lookup. */
  audioTime: number;
  /** Live speech energy. Feeds the emphasis DETECTOR, never an angle. */
  energy: number;
}

const clampAbs = (v: number, limit: number) => (v > limit ? limit : v < -limit ? -limit : v);

/**
 * Minimum-jerk interpolant (Flash-Hogan). Zero velocity AND zero acceleration
 * at both ends, which is what makes a gesture C2-continuous with whatever comes
 * before and after it.
 *
 * P18 stepped the follower's target instead. Position and velocity stayed
 * continuous, but `w^2 * (target - current)` jumped from 0 to 622 deg/s^2 in a
 * single frame at every gesture onset — a 37,338 deg/s^3 spike. That is the
 * jerk hardware review saw, and no amount of follower tuning removes it,
 * because the discontinuity is in the input, not the filter.
 */
export const minimumJerkShape = (t: number) => {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * x * (10 - 15 * x + 6 * x * x);
};

export class SpeakingGestureDirector {
  private time = 0;
  private gesture: SpeakingGestureKind = "none";
  private gestureStart = -999;
  private gestureDuration = 0;
  private quietUntil = 0;
  private rest = { yaw: 0, pitch: 0, roll: 0 };
  private target = { yaw: 0, pitch: 0, roll: 0 };
  /** Where the gesture began and where it peaks, so the path can be SHAPED. */
  private gestureFrom = { yaw: 0, pitch: 0, roll: 0 };
  private gesturePeak = { yaw: 0, pitch: 0, roll: 0 };
  private outwardSeconds = 0;
  /** Slowly converging conversational rest. The continuous-presence source. */
  private restTarget = { yaw: 0, pitch: 0, roll: 0 };
  private current = { yaw: 0, pitch: 0, roll: 0 };
  private velocity = { yaw: 0, pitch: 0, roll: 0 };
  private gazeLeadUntil = -999;
  private gazeLeadYaw = 0;
  private reason = "idle";
  private lastYawSign: 1 | -1 = 1;
  /** 0-3, set when a gesture fires. See `PerformanceIntent.emphasis`. */
  private emphasisLevel = 0;
  /** Position within the current voiced phrase, or -1 outside one. */
  private phraseProgress = -1;
  private envelopePitch = 0;
  /** Typical outward duration, used to fire early enough to peak on the emphasis. */
  private readonly outwardPreview = 0.26;
  private boundaries: SpeechBoundary[] = [];
  private phrases: VoicedPhrase[] = [];
  private consumedEmphasis = new Set<string>();
  private consumedBoundary = -1;
  private energyHistory: number[] = [];
  private lastEmphasisAt = -999;
  private lastOpportunityAt = -999;
  private nextFallbackAt = -999;

  /** Phrase structure derived from the phoneme timeline. */
  setTimeline(phonemes: { phoneme: string; start_time: number; end_time: number }[]) {
    this.boundaries = buildSpeechBoundaries(phonemes);
    this.phrases = buildVoicedPhrases(phonemes);
    this.consumedBoundary = -1;
    this.consumedEmphasis = new Set();
  }

  phraseCount() {
    return this.phrases.length;
  }

  boundaryCount() {
    return this.boundaries.length;
  }

  /**
   * Turns the live stream into opportunities.
   *
   * Three real sources plus one fallback. The fallback exists because a speaker
   * may run for a long time with no boundary and flat energy, and a frozen head
   * is not acceptable — but it must not become the thing it replaced, so its
   * next eligible time is redrawn from a wide range every time rather than
   * ticking on a fixed period.
   */
  constructor(private random: BehaviorRandom) {}

  reset(time = 0) {
    this.time = time;
    this.gesture = "none";
    this.gestureStart = -999;
    this.gestureDuration = 0;
    this.quietUntil = time + 0.8;
    this.rest = { yaw: 0, pitch: 0, roll: 0 };
    this.target = { yaw: 0, pitch: 0, roll: 0 };
    this.gestureFrom = { yaw: 0, pitch: 0, roll: 0 };
    this.gesturePeak = { yaw: 0, pitch: 0, roll: 0 };
    this.outwardSeconds = 0;
    this.restTarget = { yaw: 0, pitch: 0, roll: 0 };
    this.current = { yaw: 0, pitch: 0, roll: 0 };
    this.velocity = { yaw: 0, pitch: 0, roll: 0 };
    this.gazeLeadUntil = -999;
    this.gazeLeadYaw = 0;
    this.reason = "idle";
    this.consumedBoundary = -1;
    this.consumedEmphasis = new Set();
    this.energyHistory = [];
    this.lastEmphasisAt = -999;
    this.lastOpportunityAt = -999;
    this.nextFallbackAt = time + 2;
    this.emphasisLevel = 0;
    this.phraseProgress = -1;
    this.envelopePitch = 0;
  }

  private range(stream: string, [lo, hi]: [number, number]) {
    return lo + this.random.next(stream) * (hi - lo);
  }

  private choose(p: SpeakingMotionProfile): Exclude<SpeakingGestureKind, "none"> {
    const entries = Object.entries(p.weights) as [Exclude<SpeakingGestureKind, "none">, number][];
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.random.next("p18-kind") * total;
    for (const [kind, w] of entries) { roll -= w; if (roll <= 0) return kind; }
    return "micro-nod";
  }

  /**
   * Picks the yaw direction with a bias AGAINST alternating.
   *
   * The shipped oscillator alternated 95.5% of the time, which is what read as
   * mechanical. Repeating the previous side more often than not produces runs,
   * which is what real conversational movement looks like.
   */
  private yawSign(): 1 | -1 {
    const repeat = this.random.chance("p18-yaw-side", 0.62);
    const sign = repeat ? this.lastYawSign : (this.lastYawSign === 1 ? -1 : 1);
    this.lastYawSign = sign;
    return sign;
  }

  /**
   * §P18.2 opportunities come from INSIDE the phrase.
   *
   * Each phrase's emphasis moments are precomputed, so the head can start
   * moving BEFORE the acoustic peak and arrive on it — which is what makes the
   * motion read as part of delivering the word rather than a reaction to it.
   * Silence is no longer a gesture trigger; it is only a settle opportunity.
   */
  private opportunity(audioTime: number, profile: SpeakingMotionProfile): { fires: boolean; reason: string; strength: number; peakAt: number | null } {
    if (!profile.inPhraseScheduling) {
      /**
       * P18.1's scheduling, kept for the A/B. It fires at silence boundaries,
       * which is precisely the defect: measured on the real clip it put 41.8%
       * of moving frames in SIL and made the head 2.3x more active during
       * silence than during speech.
       */
      for (let i = 0; i < this.boundaries.length; i += 1) {
        const b = this.boundaries[i];
        const nearEnd = audioTime >= b.endsAt - 0.18 && audioTime <= b.endsAt;
        const nearResume = audioTime >= b.resumesAt && audioTime <= b.resumesAt + 0.22;
        if ((nearEnd || nearResume) && this.consumedBoundary !== i) {
          this.consumedBoundary = i;
          return { fires: true, reason: nearEnd ? "phrase end" : "phrase onset", strength: 0.3, peakAt: null };
        }
      }
      if (this.time >= this.nextFallbackAt && this.time - this.lastOpportunityAt > 2.2) {
        this.nextFallbackAt = this.time + 1.5 + this.random.next("p18-fallback") * 4.5;
        return { fires: true, reason: "cadence", strength: 0.2, peakAt: null };
      }
      return { fires: false, reason: "", strength: 0, peakAt: null };
    }
    for (let pi = 0; pi < this.phrases.length; pi += 1) {
      const phrase = this.phrases[pi];
      if (audioTime < phrase.startsAt - 0.35 || audioTime > phrase.endsAt) continue;
      for (let ei = 0; ei < phrase.emphases.length; ei += 1) {
        const em = phrase.emphases[ei];
        const key = `${pi}:${ei}`;
        if (this.consumedEmphasis.has(key)) continue;
        // Fire early enough that the trajectory PEAKS on the emphasis.
        const fireAt = em.at - profile.anticipationSeconds - this.outwardPreview;
        /**
         * A candidate EXPIRES rather than waiting.
         *
         * The scheduler is only consulted outside a gesture and outside the
         * quiet window, so a candidate that came due during either used to sit
         * pending and fire whenever the director next became free — seconds
         * late, against an emphasis that had already passed. That produced a
         * p90 offset of 2.1 s. A moment you have missed is missed.
         */
        if (audioTime > em.at + 0.12) { this.consumedEmphasis.add(key); continue; }
        if (audioTime >= fireAt) {
          this.consumedEmphasis.add(key);
          return { fires: true, reason: ei === 0 ? "phrase emphasis" : "secondary emphasis", strength: em.strength, peakAt: em.at - profile.anticipationSeconds };
        }
      }
    }
    /**
     * Fallback for a long phrase whose contour never produced a candidate.
     * Bounded, redrawn each time, and gated on actually being inside a voiced
     * phrase so it can never become a pause gesture.
     */
    const insidePhrase = this.phrases.some((p) => audioTime >= p.startsAt && audioTime <= p.endsAt);
    if (insidePhrase && this.time >= this.nextFallbackAt && this.time - this.lastOpportunityAt > 2.4) {
      this.nextFallbackAt = this.time + 1.8 + this.random.next("p18-fallback") * 4.2;
      return { fires: true, reason: "cadence", strength: 0.2, peakAt: null };
    }
    return { fires: false, reason: "", strength: 0, peakAt: null };
  }

  update(deltaSeconds: number, profile: SpeakingMotionProfile | null, prosody: SpeakingProsody): SpeakingGestureIntent {
    this.time += deltaSeconds;
    if (!profile || !prosody.speaking) {
      // Decay toward the speaking rest rather than snapping to centre, so
      // leaving speech is a settle and not a cut.
      const decay = 1 - Math.exp(-2.2 * deltaSeconds);
      for (const axis of ["yaw", "pitch", "roll"] as const) {
        this.current[axis] += (0 - this.current[axis]) * decay;
        this.velocity[axis] *= 1 - decay;
      }
      this.gesture = "none";
      return {
        ...neutralSpeakingGestureIntent,
        profile: profile?.id ?? "off",
        yaw: this.current.yaw, pitch: this.current.pitch, roll: this.current.roll,
        reason: profile ? "not speaking" : "disabled"
      };
    }

    const inGesture = this.time - this.gestureStart < this.gestureDuration;
    const quiet = !inGesture && this.time < this.quietUntil;

    /**
     * Opportunity, not amplitude.
     *
     * Prosody decides only whether a gesture MAY fire and which kind is
     * eligible. Nothing here multiplies an angle by speech energy.
     */
    if (!inGesture && !quiet) {
      const opp = this.opportunity(prosody.audioTime, profile);
      if (opp.fires) this.lastOpportunityAt = this.time;
      if (opp.fires && this.random.chance("p18-fire", profile.gestureProbability)) {
        let kind = this.choose(profile);
        // Bias the kind toward what the prosody actually offered.
        // Bias the kind toward what the prosody actually offered.
        if (opp.reason === "emphasis" && this.random.chance("p18-emphasis-bias", 0.7)) {
          kind = this.random.chance("p18-affirm", 0.25) ? "affirm-nod" : "micro-nod";
        } else if (opp.reason === "phrase end" && this.random.chance("p18-settle-bias", 0.65)) {
          kind = "phrase-settle";
        } else if (opp.reason === "unused-phrase-onset") {
          // A new thought is where a speaker repositions, so this is the one
          // opportunity biased TOWARD yaw. Without it the weighted draw was
          // crowded out by nods and settles and `yaw-adjust` never fired at
          // all, leaving lateral motion to rest migration alone.
          kind = this.random.chance("p18-onset-yaw", 0.55) ? "yaw-adjust" : "tilt";
        } else if (opp.reason === "cadence" && this.random.chance("p18-cadence-yaw", 0.4)) {
          kind = this.random.chance("p18-cadence-tilt", 0.5) ? "tilt" : "yaw-adjust";
        }
        this.reason = opp.reason;
        /**
         * Emphasis hierarchy. Derived from WHAT the opportunity was and which
         * gesture it produced, never from audio level alone — energy is
         * evidence that a moment matters, not a multiplier on how far the head
         * travels.
         */
        this.emphasisLevel =
          kind === "affirm-nod" ? 3
            : kind === "micro-nod" ? (opp.reason === "emphasis" ? 2 : 1)
            : kind === "thought" ? 2
            : kind === "phrase-settle" ? 1
            : 1;
        this.gesture = kind;
        this.gestureStart = this.time;

        // Migrate the speaking rest a little; never force it back to centre.
        // The rest TARGET migrates; `rest` itself converges toward it slowly,
        // which is what keeps the head alive between gestures.
        this.restTarget = {
          yaw: clampAbs(this.rest.yaw + (this.random.next("p18-rest-yaw") - 0.5) * profile.restYawSpan * 0.6, profile.restYawSpan),
          pitch: clampAbs(this.rest.pitch + (this.random.next("p18-rest-pitch") - 0.5) * profile.restPitchSpan * 0.6, profile.restPitchSpan),
          roll: clampAbs(this.rest.roll + (this.random.next("p18-rest-roll") - 0.5) * profile.restRollSpan * 0.6, profile.restRollSpan)
        };

        let dPitch = 0, dYaw = 0, dRoll = 0, duration = 0.6;
        switch (kind) {
          case "micro-nod":
            dPitch = this.range("p18-a", profile.microNodPitch); duration = 0.42; break;
          case "affirm-nod":
            dPitch = this.range("p18-b", profile.affirmNodPitch); duration = 0.72; break;
          case "phrase-settle":
            dPitch = -this.range("p18-c", profile.settlePitch) * 0.6; duration = 0.85; break;
          case "yaw-adjust":
            dYaw = this.yawSign() * this.range("p18-d", profile.yawAdjust); duration = 0.75; break;
          case "tilt":
            dRoll = this.yawSign() * this.range("p18-e", profile.tiltRoll); duration = 0.9; break;
          case "thought":
            dYaw = this.yawSign() * this.range("p18-f", profile.yawAdjust) * 1.3;
            dPitch = -this.range("p18-g", profile.settlePitch);
            duration = 1.2; break;
        }
        this.gestureDuration = duration;
        /**
         * The outward phase is stretched or compressed so the trajectory PEAKS
         * on the emphasis, instead of using a fixed 55% split against a
         * fixed-guess lead time. That guess left a 300 ms median misalignment;
         * solving for the actual arrival removes it by construction.
         */
        const wantOutward = opp.peakAt !== null ? opp.peakAt - prosody.audioTime : duration * 0.55;
        /**
         * The 0.20 s floor is a smoothness bound, not a round number: below it
         * the shaped path becomes steep enough to push peak jerk back over the
         * P18.1 gate, and the alignment gained is under 60 ms.
         */
        this.outwardSeconds = Math.min(duration * 0.8, Math.max(0.2, wantOutward));
        this.quietUntil = this.time + duration + this.range("p18-quiet", profile.quietSeconds);
        /**
         * The gesture is a PATH, not a destination.
         *
         * It starts from wherever the head physically is — including any
         * residual velocity from the previous gesture — and is shaped by a
         * minimum-jerk shuttle out to the peak and back to the evolving rest.
         * Nothing is reconstructed from neutral and nothing is zeroed at the
         * end, so consecutive gestures form one continuous trajectory.
         */
        /**
         * The path starts from the previous TARGET, not from the current
         * position.
         *
         * At k = 0 the shaped path evaluates to `gestureFrom`, so seeding it
         * with `current` stepped the target by (current - previousTarget) on
         * the firing frame — small, but a step in the follower's input is a
         * step in acceleration, which is the whole defect P18.1 fixed. Seeding
         * with the previous target makes the input continuous; the follower
         * still carries the real position and velocity underneath.
         */
        this.gestureFrom = { ...this.target };
        this.gesturePeak = {
          // Positive pitch is DOWN in this rig's convention for a nod.
          yaw: clampAbs(this.rest.yaw + dYaw, profile.yawEngagementLimit),
          pitch: this.rest.pitch + dPitch,
          roll: this.rest.roll + dRoll
        };
        if (this.random.chance("p18-gaze-lead", profile.gazeLeadProbability) && (dYaw !== 0 || kind === "thought")) {
          this.gazeLeadUntil = this.time + this.range("p18-gaze-lead-s", profile.gazeLeadSeconds);
          this.gazeLeadYaw = Math.sign(dYaw || 1) * 1.4;
        }
      } else if (!inGesture) {
        this.gesture = "none";
      }
    }

    /**
     * CONTINUOUS PRESENCE.
     *
     * `restTarget` is re-drawn only at opportunities; `rest` converges toward it
     * every frame at a very low rate. Between gestures the head is therefore
     * always moving a little, and always toward somewhere the speech chose —
     * which is the difference between quiet and frozen. P18 left 944 of 2400
     * frames at exactly zero velocity.
     *
     * Deliberately NOT an oscillator, a random walk or injected noise: it is
     * convergence toward a phrase-derived orientation, so it decays rather than
     * cycling, and it stops when it arrives.
     */
    const restRate = 1 - Math.exp(-0.55 * deltaSeconds);
    this.rest.yaw += (this.restTarget.yaw - this.rest.yaw) * restRate;
    this.rest.pitch += (this.restTarget.pitch - this.rest.pitch) * restRate;
    this.rest.roll += (this.restTarget.roll - this.rest.roll) * restRate;

    /**
     * §P18.2 IN-PHRASE ENVELOPE.
     *
     * A slow arc tied to position WITHIN the current voiced phrase: the head
     * eases down a little through the phrase and recovers toward its end. It is
     * a function of phrase progress, not of time, so it cannot oscillate — a
     * long phrase produces one slow arc and a short phrase produces a small
     * one, and outside a phrase it is exactly zero.
     *
     * This is what keeps a 3.85 s spoken stretch alive without injecting noise.
     */
    const phrase = this.phrases.find((p) => prosody.audioTime >= p.startsAt && prosody.audioTime <= p.endsAt);
    this.phraseProgress = phrase ? (prosody.audioTime - phrase.startsAt) / Math.max(0.001, phrase.seconds) : -1;
    this.envelopePitch = phrase
      ? Math.sin(Math.PI * Math.min(1, Math.max(0, this.phraseProgress))) * profile.phraseEnvelopeDegrees
      : this.envelopePitch * (1 - restRate);

    /**
     * Re-evaluated AFTER the scheduler, not before it.
     *
     * `inGesture` above is computed at the top of the frame, so on the frame a
     * gesture fires it is still false — and clearing `this.gesture` on that
     * basis wiped the label the instant it was set. Every gesture ran with its
     * pose but reported itself as "none", which is why the gesture counters
     * read zero while the head was visibly moving.
     */
    const active = this.time - this.gestureStart < this.gestureDuration;
    /**
     * The outward phase runs to 55% of the gesture, not 45%.
     *
     * A critically damped follower needs time to arrive. At the original
     * frequency and split, a 0.42 s micro-nod peaked at 0.8 deg against a
     * requested 1.1-2.4 — the head was recalled to rest before it got there,
     * which is the same failure P13 found in the jaw. The follower frequencies
     * were raised alongside this so the gesture LANDS rather than being
     * enlarged to compensate for never arriving.
     */
    /**
     * The recovery endpoint INCLUDES the in-phrase envelope.
     *
     * Without it the gesture landed on bare rest while the continuing-presence
     * branch immediately targeted rest + envelope — a step of the envelope
     * amplitude at the exact hand-back frame, which moved the worst jerk to
     * `termination`. Both branches must aim at the same place.
     */
    const restNow = {
      yaw: clampAbs(this.rest.yaw, profile.yawEngagementLimit),
      pitch: this.rest.pitch + this.envelopePitch,
      roll: this.rest.roll
    };
    if (active) {
      /**
       * The gesture is a SHAPED PATH, not a destination.
       *
       * Out on minimum-jerk from wherever the head physically was when the
       * gesture fired, then back on minimum-jerk to the evolving rest. Both
       * halves begin and end with zero acceleration, so the onset, the peak
       * reversal and the hand-back into continuing presence are all continuous.
       *
       * P18 stepped the target instead, which is where the 37,338 deg/s^3 spike
       * came from: `w^2 * (target - current)` jumped from 0 to 622 deg/s^2 in
       * one frame. The follower was never the problem.
       */
      const elapsed = this.time - this.gestureStart;
      if (elapsed <= this.outwardSeconds) {
        const k = minimumJerkShape(elapsed / Math.max(1e-4, this.outwardSeconds));
        for (const axis of ["yaw", "pitch", "roll"] as const) {
          this.target[axis] = this.gestureFrom[axis] + (this.gesturePeak[axis] - this.gestureFrom[axis]) * k;
        }
      } else {
        const k = minimumJerkShape((elapsed - this.outwardSeconds) / Math.max(1e-4, this.gestureDuration - this.outwardSeconds));
        for (const axis of ["yaw", "pitch", "roll"] as const) {
          this.target[axis] = this.gesturePeak[axis] + (restNow[axis] - this.gesturePeak[axis]) * k;
        }
      }
    } else {
      this.gesture = "none";
      /**
       * Continuing presence: the evolving rest PLUS the in-phrase envelope. The
       * head therefore keeps developing through the words rather than parking
       * at rest until the next gesture.
       */
      this.target = { ...restNow };
    }

    /**
     * Critically damped follower, integrated from the CURRENT velocity, so a
     * new gesture arriving mid-move redirects rather than restarting. Same
     * construction P16 uses for the idle head.
     */
    const w = profile.followerHz * 2 * Math.PI;
    for (const axis of ["yaw", "pitch", "roll"] as const) {
      const accel = w * w * (this.target[axis] - this.current[axis]) - 2 * w * this.velocity[axis];
      this.velocity[axis] += accel * deltaSeconds;
      this.current[axis] += this.velocity[axis] * deltaSeconds;
    }
    this.current.yaw = clampAbs(this.current.yaw, profile.yawEngagementLimit);

    const leading = this.time < this.gazeLeadUntil;
    return {
      profile: profile.id,
      gesture: this.gesture,
      gestureAge: active ? this.time - this.gestureStart : 0,
      quiet,
      yaw: this.current.yaw, pitch: this.current.pitch, roll: this.current.roll,
      neckYaw: this.current.yaw * profile.neckShare,
      neckPitch: this.current.pitch * profile.neckShare * 0.6,
      neckRoll: this.current.roll * profile.neckShare * 0.4,
      gazeYaw: leading ? this.gazeLeadYaw : 0,
      restYaw: this.rest.yaw, restPitch: this.rest.pitch, restRoll: this.rest.roll,
      phraseProgress: this.phraseProgress,
      reason: this.reason,
      engaged: Math.abs(this.current.yaw) <= profile.yawEngagementLimit,
      /**
       * Emphasis follows the gesture's own shape, so the face swells and settles
       * WITH the head instead of stepping on and off. Outside a gesture it
       * decays rather than snapping to zero.
       */
      emphasis: active
        ? this.emphasisLevel * (this.time - this.gestureStart <= this.outwardSeconds
          ? minimumJerkShape((this.time - this.gestureStart) / Math.max(1e-4, this.outwardSeconds))
          : 1 - 0.55 * minimumJerkShape((this.time - this.gestureStart - this.outwardSeconds) / Math.max(1e-4, this.gestureDuration - this.outwardSeconds)))
        : this.emphasisLevel * Math.max(0, 1 - (this.time - this.gestureStart - this.gestureDuration) / 1.2),
      phase: !active
        ? (quiet ? "quiet" : "continue")
        : this.time - this.gestureStart < this.outwardSeconds * 0.25 ? "prep"
        : this.time - this.gestureStart < this.outwardSeconds * 0.75 ? "commit"
        : this.time - this.gestureStart < this.outwardSeconds * 1.1 ? "peak"
        : this.time - this.gestureStart < this.gestureDuration * 0.92 ? "recover"
        : "settle"
    };
  }
}
