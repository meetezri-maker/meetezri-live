/**
 * NORMAL AI REPLY — LIP-SYNC READ-BACK. DEV ONLY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS AND IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The capture it reads ALREADY EXISTS: `__solaceHyper3dWelcomeLipSync` has held
 * `fullFrame.normal` — every audible evaluated frame of the latest NON-welcome
 * assistant turn, plus that turn's chunks, backend phonemes, appended timeline
 * and response origin — since the Phase 2F work. `analyzeFullFrameCapture` has
 * held the frame statistics, the controller/final/GLB identity check and the
 * per-phoneme peaks. Neither was reachable from the console, and the analyzer's
 * timing section is gated on `chunks.length === 1`, which a normal reply almost
 * never is.
 *
 * So this file adds the four things that were genuinely missing and nothing
 * else: multi-chunk timing and boundary inspection, phoneme landmarks with a
 * temporal window, an offset-versus-drift measurement, and one console entry
 * point. It records nothing, mutates nothing and is not imported by production
 * code — `import.meta.env.DEV` is statically replaced, so a production build
 * never emits this module.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE MEASUREMENT THAT MATTERS
 * ─────────────────────────────────────────────────────────────────────────────
 * "Is the mouth in sync?" cannot be answered by comparing the pose to the
 * phoneme timeline: the pose is DRIVEN by that timeline, so they agree by
 * construction and always will. It needs a reference independent of the
 * timestamps, and the capture already carries one — `acousticFrames`, the
 * existing analyzer's energy/voicing read off the decoded audio itself,
 * response-relative.
 *
 * Two lags are therefore measured against that same reference:
 *
 *   phonemeTimelineLeadMs   the backend's phoneme windows vs the real audio
 *   visualLeadMs            the GLB mouth vs the real audio
 *
 * and the pair separates the causes. Both equal and non-zero means the
 * timestamps themselves are misaligned and the front end faithfully rendered
 * them. The timeline aligned but the visual not means the error is downstream of
 * the timeline. Both near zero means sync is correct and any complaint is about
 * articulation quality, not timing.
 *
 * Each lag is then measured again over the first, middle and final third, which
 * is what separates a CONSTANT OFFSET from ACCUMULATING DRIFT. The word "drift"
 * is only used by the caller when those thirds actually differ.
 */

import { analyzeFullFrameCapture, type CaptureAnalysis } from "./hyper3dFrameCaptureAnalysis";
import type {
  Hyper3dFullFrameCapture,
  Hyper3dFullFrameRecord,
  Hyper3dWelcomeLipSyncDiagnostics,
} from "./hyper3dLiveSpeechAdapter";

const DEV = Boolean(import.meta.env?.DEV);

/** Correlation grid and search bounds for both lag measurements. */
const GRID_SECONDS = 0.01;
const MAX_LAG_SECONDS = 0.4;
const LAG_STEP_SECONDS = 0.005;
/** Below this many grid points a correlation is noise, not a measurement. */
const MIN_CORRELATION_POINTS = 40;
/** A lag is only reported when the best fit is at least this correlated. */
const MIN_USEFUL_CORRELATION = 0.25;
/**
 * Correlation within this of the peak counts as a tie, and the SMALLEST shift
 * wins it. A repetitive passage correlates almost as well one syllable out as it
 * does in place, and without this the search can lock onto that false peak and
 * report a confident offset that is really one period of the speech rhythm. A
 * genuine offset produces a distinctly higher peak, so this cannot hide one.
 */
const TIE_EPSILON = 0.01;
/** Thirds whose lags differ by more than this are drifting, not offset. */
const DRIFT_THRESHOLD_MS = 40;
/** Speech-owned channels this report reasons about. Expression is excluded. */
const SPEECH_CHANNELS = ["jawOpen", "mouthClose", "mouthFunnel", "mouthPucker"] as const;

const OPEN_VOWELS = new Set(["AA", "AE", "AH", "AO", "AW", "AY"]);
const ROUNDED_VOWELS = new Set(["UW", "OW", "UH", "OY", "AO"]);
const ALL_VOWELS = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW",
]);
const BILABIALS = new Set(["P", "B", "M"]);

const bare = (phoneme: string): string => phoneme.replace(/\d+$/, "").toUpperCase();
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export type Hyper3dLagFit = {
  /**
   * Positive = the signal LEADS the audio (happens early) by this many ms.
   * Negative = it trails. Null when nothing correlated well enough to report.
   */
  leadMs: number | null;
  correlation: number;
  points: number;
  reason: string | null;
};

export type Hyper3dLagByThird = {
  overall: Hyper3dLagFit;
  firstThird: Hyper3dLagFit;
  middleThird: Hyper3dLagFit;
  finalThird: Hyper3dLagFit;
  /** "constant" / "changing" / "indeterminate", from the three thirds. */
  stability: "constant" | "changing" | "indeterminate";
  spreadMs: number | null;
};

export type Hyper3dLandmark = {
  kind: "bilabial" | "open-vowel" | "rounded-vowel" | "consonant-to-vowel";
  phoneme: string;
  index: number;
  start: number;
  end: number | null;
  /** The phoneme before it, for a transition landmark. */
  previousPhoneme: string | null;
  /** Frames in a window around the phoneme, so no verdict rests on one frame. */
  window: Array<{
    responseClock: number;
    relativeToStartMs: number;
    activePhoneme: string | null;
    controllerJawOpen: number;
    controllerMouthClose: number;
    finalJawOpen: number;
    finalMouthClose: number;
    glbJawOpen: number;
    glbMouthClose: number;
    glbMouthFunnel: number;
    glbMouthPucker: number;
  }>;
  /** Peaks inside the phoneme's own span. */
  peak: {
    controllerJawOpen: number;
    finalJawOpen: number;
    glbJawOpen: number;
    glbMouthClose: number;
    glbMouthFunnel: number;
    glbMouthPucker: number;
  };
  /**
   * For a bilabial: when `mouthClose` actually crossed half its peak, relative
   * to the phoneme's own start. Negative = the seal began early.
   */
  closureOnsetRelativeMs: number | null;
};

export type Hyper3dChunkBoundary = {
  fromChunkIndex: number | null;
  toChunkIndex: number | null;
  /** `next.audioContextStartTime − previous.expectedAudibleEndContextTime`, ms. */
  audioSeamMs: number;
  /** `next.responseOffsetSeconds − previous.responseOffset − previous.duration`, ms. */
  timelineSeamMs: number | null;
  /** The next chunk's first appended phoneme, relative to its own offset, ms. */
  nextFirstPhonemeRelativeMs: number | null;
  note: string;
};

export type Hyper3dOwnershipDivergence = {
  /** Largest absolute change a stage made to a speech channel, over all frames. */
  controllerToSeam: number;
  seamToAffect: number;
  affectToPresence: number;
  presenceToFinal: number;
  finalToGlb: number;
  /** The first stage that moved a speech channel by more than 1e-6. */
  firstDivergingStage: string | null;
  framesPresenceOwned: number;
  framesShowcaseOwnedLowerFace: number;
  framesNotSpeakingFlag: number;
};

export type Hyper3dReplyReport = {
  capturedAtMs: number;
  available: boolean;
  unavailableReason: string | null;
  turnId: number | null;
  finalized: boolean;
  sentence: string;
  chunkCount: number;
  chunks: Array<{
    chunkIndex: number | null;
    sentence: string;
    associationMethod: string | null;
    rawPhonemeFormat: string | null;
    timestampsExplicit: boolean;
    audioB64Present: boolean | null;
    appendResult: string;
    scheduledAtMs: number;
    audioContextStartTime: number;
    expectedAudibleEndContextTime: number;
    durationSeconds: number;
    decodedDurationSeconds: number | null;
    leadInSec: number;
    responseOffsetSeconds: number | null;
    backendPhonemeCount: number;
    appendedPhonemes: number;
    backendFirstStart: number | null;
    backendLastEnd: number | null;
  }>;
  boundaries: Hyper3dChunkBoundary[];
  audio: {
    firstScheduledStart: number | null;
    lastExpectedEnd: number | null;
    totalAudibleSeconds: number;
    responseOriginContextTime: number | null;
  };
  phonemes: {
    backendTotal: number;
    appendedTotal: number;
    timelineFirstStart: number | null;
    timelineLastEnd: number | null;
    /** Timeline span not covered by any phoneme window, seconds. */
    uncoveredSeconds: number | null;
    phonemesWithNoFrame: number;
    phonemesWithOneFrame: number;
  };
  clock: {
    /** `responseClock − (contextTime − origin)`, ms, over every audible frame. */
    maxAbsDeltaMs: number | null;
    medianAbsDeltaMs: number | null;
    framesOver20ms: number;
    monotonic: boolean;
    note: string;
  };
  articulation: Hyper3dOwnershipDivergence & {
    controllerEqualsFinal: boolean;
    finalEqualsGlb: boolean;
  };
  sync: {
    phonemeTimelineVsAudio: Hyper3dLagByThird;
    visualVsAudio: Hyper3dLagByThird;
    acousticFrames: number;
    note: string;
  };
  landmarks: Hyper3dLandmark[];
  /** The existing analyzer's output, unchanged, for the frame statistics. */
  frameAnalysis: CaptureAnalysis | null;
  limitations: string[];
};

// ── correlation machinery ───────────────────────────────────────────────────

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Nearest-sample lookup on a time-sorted series. */
function sampleAt(
  series: Array<{ time: number; value: number }>,
  time: number,
): number | null {
  if (series.length === 0) return null;
  if (time < series[0].time || time > series[series.length - 1].time) return null;
  let low = 0;
  let high = series.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (series[mid].time <= time) low = mid;
    else high = mid;
  }
  return Math.abs(series[low].time - time) <= Math.abs(series[high].time - time)
    ? series[low].value
    : series[high].value;
}

/**
 * Finds the shift that best aligns `signal` with `energy`.
 *
 * A candidate lead L compares `signal(t)` with `energy(t + L)`, so a POSITIVE
 * result means the signal happens EARLY — it shows at t what the audio does at
 * t + L.
 */
function fitLag(
  signal: Array<{ time: number; value: number }>,
  energy: Array<{ time: number; value: number }>,
  fromSeconds: number,
  toSeconds: number,
): Hyper3dLagFit {
  const empty = (reason: string): Hyper3dLagFit => ({
    leadMs: null,
    correlation: 0,
    points: 0,
    reason,
  });
  if (signal.length < 3) return empty("no rendered frames in this span");
  if (energy.length < 3) return empty("no acoustic frames — the capture was read before any audio was analysed");
  if (!(toSeconds > fromSeconds)) return empty("empty span");

  const candidates: Array<{ lead: number; r: number; points: number }> = [];
  for (let lead = -MAX_LAG_SECONDS; lead <= MAX_LAG_SECONDS + 1e-9; lead += LAG_STEP_SECONDS) {
    const left: number[] = [];
    const right: number[] = [];
    for (let t = fromSeconds; t <= toSeconds; t += GRID_SECONDS) {
      const s = sampleAt(signal, t);
      const e = sampleAt(energy, t + lead);
      if (s === null || e === null) continue;
      left.push(s);
      right.push(e);
    }
    if (left.length < MIN_CORRELATION_POINTS) continue;
    candidates.push({ lead, r: pearson(left, right), points: left.length });
  }
  if (candidates.length === 0) {
    return empty(`fewer than ${MIN_CORRELATION_POINTS} overlapping grid points at every candidate lag`);
  }
  const peak = candidates.reduce((best, item) => (item.r > best.r ? item : best));
  // Among ties, the smallest shift wins — see TIE_EPSILON.
  const chosen = candidates
    .filter((item) => item.r >= peak.r - TIE_EPSILON)
    .reduce((best, item) => (Math.abs(item.lead) < Math.abs(best.lead) ? item : best));
  const bestLead = chosen.lead;
  const bestR = chosen.r;
  const bestPoints = chosen.points;
  if (bestR < MIN_USEFUL_CORRELATION) {
    return {
      leadMs: null,
      correlation: round3(bestR),
      points: bestPoints,
      reason: `best correlation ${round3(bestR)} is below ${MIN_USEFUL_CORRELATION}; the fit is not strong enough to name a lag`,
    };
  }
  return {
    leadMs: round1(bestLead * 1000),
    correlation: round3(bestR),
    points: bestPoints,
    reason: null,
  };
}

function fitByThirds(
  signal: Array<{ time: number; value: number }>,
  energy: Array<{ time: number; value: number }>,
  fromSeconds: number,
  toSeconds: number,
): Hyper3dLagByThird {
  const span = toSeconds - fromSeconds;
  const a = fromSeconds + span / 3;
  const b = fromSeconds + (2 * span) / 3;
  const overall = fitLag(signal, energy, fromSeconds, toSeconds);
  const firstThird = fitLag(signal, energy, fromSeconds, a);
  const middleThird = fitLag(signal, energy, a, b);
  const finalThird = fitLag(signal, energy, b, toSeconds);

  const leads = [firstThird.leadMs, middleThird.leadMs, finalThird.leadMs].filter(
    (value): value is number => value !== null,
  );
  let stability: Hyper3dLagByThird["stability"] = "indeterminate";
  let spreadMs: number | null = null;
  if (leads.length === 3) {
    spreadMs = round1(Math.max(...leads) - Math.min(...leads));
    stability = spreadMs > DRIFT_THRESHOLD_MS ? "changing" : "constant";
  }
  return { overall, firstThird, middleThird, finalThird, stability, spreadMs };
}

// ── report sections ─────────────────────────────────────────────────────────

function buildBoundaries(capture: Hyper3dFullFrameCapture): Hyper3dChunkBoundary[] {
  const boundaries: Hyper3dChunkBoundary[] = [];
  for (let index = 1; index < capture.chunks.length; index += 1) {
    const previous = capture.chunks[index - 1];
    const next = capture.chunks[index];
    const audioSeamMs = (next.audioContextStartTime - previous.expectedAudibleEndContextTime) * 1000;
    const previousOffset = previous.responseOffsetSeconds;
    const nextOffset = next.responseOffsetSeconds;
    const timelineSeamMs =
      previousOffset === null || nextOffset === null
        ? null
        : (nextOffset - (previousOffset + previous.durationMs / 1000)) * 1000;
    const firstAppended = next.backendPhonemes[0] ?? null;
    const nextFirstPhonemeRelativeMs = firstAppended ? firstAppended.start * 1000 : null;
    const notes: string[] = [];
    if (Math.abs(audioSeamMs) > 5) {
      notes.push(
        audioSeamMs > 0
          ? `${round1(audioSeamMs)} ms of silence between chunks`
          : `chunks overlap by ${round1(-audioSeamMs)} ms`,
      );
    }
    if (timelineSeamMs !== null && Math.abs(timelineSeamMs - audioSeamMs) > 5) {
      notes.push(
        `the timeline seam (${round1(timelineSeamMs)} ms) does not match the audio seam (${round1(audioSeamMs)} ms) — the phoneme timeline and the audio schedule disagree about where this chunk begins`,
      );
    }
    boundaries.push({
      fromChunkIndex: previous.chunkIndex,
      toChunkIndex: next.chunkIndex,
      audioSeamMs: round1(audioSeamMs),
      timelineSeamMs: timelineSeamMs === null ? null : round1(timelineSeamMs),
      nextFirstPhonemeRelativeMs:
        nextFirstPhonemeRelativeMs === null ? null : round1(nextFirstPhonemeRelativeMs),
      note: notes.length > 0 ? notes.join("; ") : "audio and timeline seams agree",
    });
  }
  return boundaries;
}

function buildClock(capture: Hyper3dFullFrameCapture): Hyper3dReplyReport["clock"] {
  const origin = capture.responseOriginContextTime;
  const note =
    "responseClock is defined as AudioContext.currentTime − responseOriginContextTime, so this compares the clock the avatar used against that definition recomputed from the same frame's own contextTime. A non-zero delta means the clock was clamped or the origin moved, not that audio drifted.";
  if (origin === null) {
    return {
      maxAbsDeltaMs: null,
      medianAbsDeltaMs: null,
      framesOver20ms: 0,
      monotonic: true,
      note: `${note} No response origin was recorded, so no comparison is possible.`,
    };
  }
  const deltas: number[] = [];
  let monotonic = true;
  let previousClock = -Infinity;
  for (const frame of capture.frames) {
    if (frame.contextTime === null) continue;
    deltas.push(Math.abs((frame.responseClock - (frame.contextTime - origin)) * 1000));
    if (frame.responseClock < previousClock - 1e-6) monotonic = false;
    previousClock = frame.responseClock;
  }
  if (deltas.length === 0) {
    return {
      maxAbsDeltaMs: null,
      medianAbsDeltaMs: null,
      framesOver20ms: 0,
      monotonic,
      note: `${note} No frame carried an AudioContext time.`,
    };
  }
  const sorted = [...deltas].sort((x, y) => x - y);
  return {
    maxAbsDeltaMs: round1(sorted[sorted.length - 1]),
    medianAbsDeltaMs: round1(sorted[Math.floor(sorted.length / 2)]),
    framesOver20ms: deltas.filter((value) => value > 20).length,
    monotonic,
    note,
  };
}

function stageMax(
  frames: Hyper3dFullFrameRecord[],
  read: (frame: Hyper3dFullFrameRecord) => Record<string, number>,
  next: (frame: Hyper3dFullFrameRecord) => Record<string, number>,
): number {
  let max = 0;
  for (const frame of frames) {
    const a = read(frame);
    const b = next(frame);
    for (const channel of SPEECH_CHANNELS) {
      max = Math.max(max, Math.abs((a[channel] ?? 0) - (b[channel] ?? 0)));
    }
  }
  return max;
}

function buildArticulation(
  capture: Hyper3dFullFrameCapture,
): Hyper3dReplyReport["articulation"] {
  const frames = capture.frames;
  const asRecord = (sample: {
    jawOpen: number;
    mouthClose: number;
    mouthFunnel: number;
    mouthPucker: number;
  }): Record<string, number> => sample as unknown as Record<string, number>;

  const controllerToSeam = stageMax(frames, (f) => f.controller, (f) => asRecord(f.stages.seam));
  const seamToAffect = stageMax(frames, (f) => asRecord(f.stages.seam), (f) => asRecord(f.stages.affect));
  const affectToPresence = stageMax(frames, (f) => asRecord(f.stages.affect), (f) => asRecord(f.stages.presence));
  const presenceToFinal = stageMax(frames, (f) => asRecord(f.stages.presence), (f) => f.final);
  const finalToGlb = stageMax(frames, (f) => f.final, (f) => f.glb);

  const ordered: Array<[string, number]> = [
    ["controller → threejs seam", controllerToSeam],
    ["threejs seam → affect", seamToAffect],
    ["affect → Active Presence", affectToPresence],
    ["Active Presence → final (idle showcase)", presenceToFinal],
    ["final → GLB morph write", finalToGlb],
  ];
  const first = ordered.find(([, value]) => value > 1e-6);

  return {
    controllerToSeam: round3(controllerToSeam),
    seamToAffect: round3(seamToAffect),
    affectToPresence: round3(affectToPresence),
    presenceToFinal: round3(presenceToFinal),
    finalToGlb: round3(finalToGlb),
    firstDivergingStage: first ? first[0] : null,
    framesPresenceOwned: frames.filter((frame) => frame.presenceOwns).length,
    framesShowcaseOwnedLowerFace: frames.filter((frame) => frame.showcaseOwnsLowerFace).length,
    framesNotSpeakingFlag: frames.filter((frame) => frame.isSpeaking === false).length,
    controllerEqualsFinal: stageMax(frames, (f) => f.controller, (f) => f.final) < 1e-9,
    finalEqualsGlb: finalToGlb < 1e-9,
  };
}

function buildLandmarks(capture: Hyper3dFullFrameCapture): Hyper3dLandmark[] {
  const frames = capture.frames;
  const phonemes = capture.timelinePhonemes;
  if (frames.length === 0 || phonemes.length === 0) return [];

  const windowMs = 150;
  const picked: Hyper3dLandmark[] = [];
  const used = new Set<number>();

  const take = (kind: Hyper3dLandmark["kind"], limit: number, match: (index: number) => boolean) => {
    let taken = 0;
    for (let index = 0; index < phonemes.length && taken < limit; index += 1) {
      if (used.has(index) || !match(index)) continue;
      const phoneme = phonemes[index];
      if (phoneme.end === null) continue;
      used.add(index);
      taken += 1;
      const from = phoneme.start - windowMs / 1000;
      const to = phoneme.end + windowMs / 1000;
      const inWindow = frames.filter((f) => f.responseClock >= from && f.responseClock <= to);
      const inside = frames.filter(
        (f) => phoneme.end !== null && f.responseClock >= phoneme.start && f.responseClock < phoneme.end,
      );
      const peakOf = (read: (frame: Hyper3dFullFrameRecord) => number): number =>
        inside.length === 0 ? 0 : round3(Math.max(...inside.map(read)));

      // For a bilabial, when mouthClose crossed half its own peak in the window.
      let closureOnsetRelativeMs: number | null = null;
      if (kind === "bilabial" && inWindow.length > 0) {
        const peak = Math.max(...inWindow.map((f) => f.glb.mouthClose ?? 0));
        if (peak > 0.02) {
          const crossing = inWindow.find((f) => (f.glb.mouthClose ?? 0) >= peak / 2);
          if (crossing) {
            closureOnsetRelativeMs = round1((crossing.responseClock - phoneme.start) * 1000);
          }
        }
      }

      picked.push({
        kind,
        phoneme: phoneme.phoneme,
        index: phoneme.index,
        start: round3(phoneme.start),
        end: phoneme.end === null ? null : round3(phoneme.end),
        previousPhoneme: index > 0 ? phonemes[index - 1].phoneme : null,
        window: inWindow.map((f) => ({
          responseClock: round3(f.responseClock),
          relativeToStartMs: round1((f.responseClock - phoneme.start) * 1000),
          activePhoneme: f.phoneme,
          controllerJawOpen: round3(f.controller.jawOpen ?? 0),
          controllerMouthClose: round3(f.controller.mouthClose ?? 0),
          finalJawOpen: round3(f.final.jawOpen ?? 0),
          finalMouthClose: round3(f.final.mouthClose ?? 0),
          glbJawOpen: round3(f.glb.jawOpen ?? 0),
          glbMouthClose: round3(f.glb.mouthClose ?? 0),
          glbMouthFunnel: round3(f.glb.mouthFunnel ?? 0),
          glbMouthPucker: round3(f.glb.mouthPucker ?? 0),
        })),
        peak: {
          controllerJawOpen: peakOf((f) => f.controller.jawOpen ?? 0),
          finalJawOpen: peakOf((f) => f.final.jawOpen ?? 0),
          glbJawOpen: peakOf((f) => f.glb.jawOpen ?? 0),
          glbMouthClose: peakOf((f) => f.glb.mouthClose ?? 0),
          glbMouthFunnel: peakOf((f) => f.glb.mouthFunnel ?? 0),
          glbMouthPucker: peakOf((f) => f.glb.mouthPucker ?? 0),
        },
        closureOnsetRelativeMs,
      });
    }
  };

  take("bilabial", 3, (index) => BILABIALS.has(bare(phonemes[index].phoneme)));
  take("open-vowel", 3, (index) => OPEN_VOWELS.has(bare(phonemes[index].phoneme)));
  take("rounded-vowel", 3, (index) => ROUNDED_VOWELS.has(bare(phonemes[index].phoneme)));
  take(
    "consonant-to-vowel",
    3,
    (index) =>
      index > 0 &&
      ALL_VOWELS.has(bare(phonemes[index].phoneme)) &&
      !ALL_VOWELS.has(bare(phonemes[index - 1].phoneme)),
  );

  return picked.sort((a, b) => a.start - b.start);
}

function buildSync(capture: Hyper3dFullFrameCapture): Hyper3dReplyReport["sync"] {
  const energy = capture.acousticFrames.map((frame) => ({ time: frame.time, value: frame.energy }));
  const frames = capture.frames;
  const note =
    "Both lags are measured against the SAME independent reference: the existing analyzer's acoustic energy, read off the decoded audio and expressed on the response clock. Positive = early (leads the audio). Energy is an imperfect proxy for mouth opening — a voiceless fricative carries energy with little jaw travel — so a few tens of ms of residual is expected even on a perfectly synchronised response.";

  // The phoneme timeline as a vowel/consonant indicator on the response clock.
  const indicator: Array<{ time: number; value: number }> = [];
  if (capture.timelinePhonemes.length > 0 && energy.length > 0) {
    const first = capture.timelinePhonemes[0].start;
    const last = capture.timelinePhonemes[capture.timelinePhonemes.length - 1].end;
    if (last !== null) {
      let cursor = 0;
      for (let t = first; t <= last; t += GRID_SECONDS) {
        while (
          cursor + 1 < capture.timelinePhonemes.length &&
          (capture.timelinePhonemes[cursor].end ?? 0) <= t
        ) {
          cursor += 1;
        }
        const phoneme = capture.timelinePhonemes[cursor];
        const inside = phoneme.end !== null && t >= phoneme.start && t < phoneme.end;
        indicator.push({
          time: t,
          value: inside ? (ALL_VOWELS.has(bare(phoneme.phoneme)) ? 1 : 0.25) : 0,
        });
      }
    }
  }

  // The visual signal: what the GLB mouth actually did.
  const visual = frames.map((frame) => ({
    time: frame.responseClock,
    value: Math.max(frame.glb.jawOpen ?? 0, frame.glb.mouthFunnel ?? 0, frame.glb.mouthPucker ?? 0),
  }));

  const from = frames.length > 0 ? frames[0].responseClock : 0;
  const to = frames.length > 0 ? frames[frames.length - 1].responseClock : 0;

  return {
    phonemeTimelineVsAudio: fitByThirds(indicator, energy, from, to),
    visualVsAudio: fitByThirds(visual, energy, from, to),
    acousticFrames: energy.length,
    note,
  };
}

function unavailable(reason: string): Hyper3dReplyReport {
  const emptyFit: Hyper3dLagFit = { leadMs: null, correlation: 0, points: 0, reason };
  const emptyThirds: Hyper3dLagByThird = {
    overall: emptyFit,
    firstThird: emptyFit,
    middleThird: emptyFit,
    finalThird: emptyFit,
    stability: "indeterminate",
    spreadMs: null,
  };
  return {
    capturedAtMs: Math.round(performance.now()),
    available: false,
    unavailableReason: reason,
    turnId: null,
    finalized: false,
    sentence: "",
    chunkCount: 0,
    chunks: [],
    boundaries: [],
    audio: {
      firstScheduledStart: null,
      lastExpectedEnd: null,
      totalAudibleSeconds: 0,
      responseOriginContextTime: null,
    },
    phonemes: {
      backendTotal: 0,
      appendedTotal: 0,
      timelineFirstStart: null,
      timelineLastEnd: null,
      uncoveredSeconds: null,
      phonemesWithNoFrame: 0,
      phonemesWithOneFrame: 0,
    },
    clock: {
      maxAbsDeltaMs: null,
      medianAbsDeltaMs: null,
      framesOver20ms: 0,
      monotonic: true,
      note: reason,
    },
    articulation: {
      controllerToSeam: 0,
      seamToAffect: 0,
      affectToPresence: 0,
      presenceToFinal: 0,
      finalToGlb: 0,
      firstDivergingStage: null,
      framesPresenceOwned: 0,
      framesShowcaseOwnedLowerFace: 0,
      framesNotSpeakingFlag: 0,
      controllerEqualsFinal: true,
      finalEqualsGlb: true,
    },
    sync: {
      phonemeTimelineVsAudio: emptyThirds,
      visualVsAudio: emptyThirds,
      acousticFrames: 0,
      note: reason,
    },
    landmarks: [],
    frameAnalysis: null,
    limitations: [reason],
  };
}

/**
 * Refreshes the capture's acoustic frames, then joins the capture into the
 * report. Set by the live-engine binding, which owns the adapter.
 */
let refreshAcoustics: (() => void) | null = null;

export function buildHyper3dReplyReport(): Hyper3dReplyReport {
  try {
    refreshAcoustics?.();
  } catch {
    /* a diagnostics read must never break a session */
  }
  const surface =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as Record<string, Hyper3dWelcomeLipSyncDiagnostics | undefined>)
          .__solaceHyper3dWelcomeLipSync;
  const capture = surface?.fullFrame.normal ?? null;
  if (!capture) {
    return unavailable(
      "No NORMAL (non-welcome) assistant turn has been captured. Send a message, let the reply finish, then export again. If the welcome is all that ever appears, the reply's chunks are arriving flagged as the session greeting.",
    );
  }
  if (capture.frames.length === 0) {
    return unavailable(
      `A normal turn was captured (turnId ${capture.turnId}, ${capture.chunks.length} chunk(s)) but NO audible frame was recorded. The avatar rendered nothing while that audio was playing.`,
    );
  }

  const chunks = capture.chunks.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    sentence: chunk.sentence,
    associationMethod: chunk.associationMethod,
    rawPhonemeFormat: chunk.rawPhonemeFormat,
    timestampsExplicit: chunk.timestampsExplicit,
    audioB64Present: chunk.audioB64Present,
    appendResult: chunk.appendResult,
    scheduledAtMs: chunk.scheduledAtMs,
    audioContextStartTime: round3(chunk.audioContextStartTime),
    expectedAudibleEndContextTime: round3(chunk.expectedAudibleEndContextTime),
    durationSeconds: round3(chunk.durationMs / 1000),
    decodedDurationSeconds:
      chunk.decodedDurationSeconds === null ? null : round3(chunk.decodedDurationSeconds),
    leadInSec: chunk.leadInSec,
    responseOffsetSeconds:
      chunk.responseOffsetSeconds === null ? null : round3(chunk.responseOffsetSeconds),
    backendPhonemeCount: chunk.backendPhonemeCount,
    appendedPhonemes: chunk.appendedPhonemes,
    backendFirstStart: chunk.backendFirstStart,
    backendLastEnd: chunk.backendLastEnd,
  }));

  const timeline = capture.timelinePhonemes;
  const covered = timeline.reduce(
    (total, phoneme) => total + (phoneme.duration ?? 0),
    0,
  );
  const timelineFirstStart = timeline.length > 0 ? timeline[0].start : null;
  const timelineLastEnd = timeline.length > 0 ? timeline[timeline.length - 1].end : null;
  const analysis = analyzeFullFrameCapture(capture);

  const limitations = [
    "Frames are only recorded while the audio is AUDIBLE, so silence between chunks is absent from the frame list by design — do not read a frame gap there as a render stall.",
    `The frame ring holds at most 900 frames; ${capture.truncatedFrames} frame(s) were dropped in this capture.`,
    "Acoustic energy is a proxy for mouth opening, not a measurement of it. Treat a residual of a few tens of ms as within the method's own resolution.",
    "The phoneme timeline and the rendered pose cannot disagree about timing by construction — the pose is driven by that timeline. Only the acoustic reference can show a timing error, which is why both lags are measured against it.",
  ];
  if (!capture.finalized) {
    limitations.push(
      "The capture is not finalized: this turn is still the current one. Its acoustic frames were refreshed at export time.",
    );
  }
  if (capture.acousticFrames.length === 0) {
    limitations.push(
      "NO acoustic frames were available, so neither lag could be measured. Without them this capture cannot establish synchronisation at all.",
    );
  }

  return {
    capturedAtMs: Math.round(performance.now()),
    available: true,
    unavailableReason: null,
    turnId: capture.turnId,
    finalized: capture.finalized,
    sentence: capture.chunks.map((chunk) => chunk.sentence).join(" ").trim(),
    chunkCount: capture.chunks.length,
    chunks,
    boundaries: buildBoundaries(capture),
    audio: {
      firstScheduledStart: chunks.length > 0 ? chunks[0].audioContextStartTime : null,
      lastExpectedEnd:
        chunks.length > 0 ? chunks[chunks.length - 1].expectedAudibleEndContextTime : null,
      totalAudibleSeconds: round3(
        capture.chunks.reduce((total, chunk) => total + chunk.durationMs / 1000, 0),
      ),
      responseOriginContextTime: capture.responseOriginContextTime,
    },
    phonemes: {
      backendTotal: capture.chunks.reduce((total, chunk) => total + chunk.backendPhonemeCount, 0),
      appendedTotal: capture.chunks.reduce((total, chunk) => total + chunk.appendedPhonemes, 0),
      timelineFirstStart,
      timelineLastEnd,
      uncoveredSeconds:
        timelineFirstStart !== null && timelineLastEnd !== null
          ? round3(timelineLastEnd - timelineFirstStart - covered)
          : null,
      phonemesWithNoFrame: analysis.phonemes.filter((phoneme) => phoneme.zeroFrames).length,
      phonemesWithOneFrame: analysis.phonemes.filter((phoneme) => phoneme.oneFrame).length,
    },
    clock: buildClock(capture),
    articulation: buildArticulation(capture),
    sync: buildSync(capture),
    landmarks: buildLandmarks(capture),
    frameAnalysis: analysis,
    limitations,
  };
}

const cell = (value: unknown): string =>
  value === null || value === undefined ? "—" : String(value);

const fitCell = (fit: Hyper3dLagFit): string =>
  fit.leadMs === null ? `— (r=${fit.correlation})` : `${fit.leadMs} ms (r=${fit.correlation})`;

/** The report as markdown, for pasting straight into the phase write-up. */
export function formatHyper3dReplyReport(report = buildHyper3dReplyReport()): string {
  const lines: string[] = [];
  lines.push(`# Hyper3D normal-reply lip-sync capture (t=${report.capturedAtMs} ms)`);
  if (!report.available) {
    lines.push("", `**No capture available.** ${report.unavailableReason}`);
    return lines.join("\n");
  }

  lines.push(
    "",
    "## A. RESPONSE",
    "",
    `turn ${report.turnId}, ${report.chunkCount} chunk(s), finalized=${report.finalized}`,
    "",
    `> ${report.sentence || "(no sentence text on any chunk)"}`,
  );

  lines.push(
    "",
    "## B. AUDIO",
    "",
    `origin (AudioContext): ${cell(report.audio.responseOriginContextTime)} · first start ${cell(report.audio.firstScheduledStart)} · last expected end ${cell(report.audio.lastExpectedEnd)} · total audible ${report.audio.totalAudibleSeconds}s`,
    "",
    "| # | idx | start | end | dur | decoded | leadIn | respOffset | assoc | fmt | timed | b64 | append | backend φ | appended φ |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---:|---:|",
  );
  report.chunks.forEach((chunk, index) => {
    lines.push(
      `| ${index} | ${cell(chunk.chunkIndex)} | ${chunk.audioContextStartTime} | ${chunk.expectedAudibleEndContextTime} | ${chunk.durationSeconds} | ` +
        `${cell(chunk.decodedDurationSeconds)} | ${chunk.leadInSec} | ${cell(chunk.responseOffsetSeconds)} | ${cell(chunk.associationMethod)} | ` +
        `${cell(chunk.rawPhonemeFormat)} | ${chunk.timestampsExplicit} | ${cell(chunk.audioB64Present)} | ${chunk.appendResult} | ${chunk.backendPhonemeCount} | ${chunk.appendedPhonemes} |`,
    );
  });

  const phonemes = report.phonemes;
  lines.push(
    "",
    "## C. PHONEMES",
    "",
    `backend ${phonemes.backendTotal} → appended ${phonemes.appendedTotal} (dropped ${phonemes.backendTotal - phonemes.appendedTotal})`,
    `timeline span ${cell(phonemes.timelineFirstStart)}s → ${cell(phonemes.timelineLastEnd)}s · uncovered ${cell(phonemes.uncoveredSeconds)}s`,
    `phonemes that got no frame: ${phonemes.phonemesWithNoFrame} · exactly one frame: ${phonemes.phonemesWithOneFrame}`,
  );

  lines.push(
    "",
    "## D. CLOCK",
    "",
    `median |responseClock − (contextTime − origin)| = ${cell(report.clock.medianAbsDeltaMs)} ms · max ${cell(report.clock.maxAbsDeltaMs)} ms · frames over 20 ms: ${report.clock.framesOver20ms} · monotonic: ${report.clock.monotonic}`,
    "",
    report.clock.note,
  );

  const art = report.articulation;
  lines.push(
    "",
    "## E. ARTICULATION",
    "",
    `controller == final: ${art.controllerEqualsFinal} · final == GLB: ${art.finalEqualsGlb}`,
    `first stage to move a speech channel: ${cell(art.firstDivergingStage)}`,
    "",
    "| stage | max Δ on speech channels |",
    "|---|---:|",
    `| controller → threejs seam | ${art.controllerToSeam} |`,
    `| threejs seam → affect | ${art.seamToAffect} |`,
    `| affect → Active Presence | ${art.affectToPresence} |`,
    `| Active Presence → final | ${art.presenceToFinal} |`,
    `| final → GLB | ${art.finalToGlb} |`,
    "",
    `frames Active Presence owned: ${art.framesPresenceOwned} · frames the showcase took the lower face: ${art.framesShowcaseOwnedLowerFace} · frames with isSpeaking=false: ${art.framesNotSpeakingFlag}`,
  );

  lines.push(
    "",
    "## F. LANDMARKS",
    "",
    "| kind | φ | prev | start | ctrl jaw | final jaw | GLB jaw | GLB close | GLB funnel | GLB pucker | seal onset |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const landmark of report.landmarks) {
    lines.push(
      `| ${landmark.kind} | ${landmark.phoneme} | ${cell(landmark.previousPhoneme)} | ${landmark.start} | ` +
        `${landmark.peak.controllerJawOpen} | ${landmark.peak.finalJawOpen} | ${landmark.peak.glbJawOpen} | ` +
        `${landmark.peak.glbMouthClose} | ${landmark.peak.glbMouthFunnel} | ${landmark.peak.glbMouthPucker} | ` +
        `${cell(landmark.closureOnsetRelativeMs)} |`,
    );
  }
  lines.push(
    "",
    "`seal onset` is when GLB `mouthClose` crossed half its window peak, relative to the phoneme's own start: negative = the seal began before the phoneme.",
  );

  lines.push(
    "",
    "## G. CHUNK BOUNDARIES",
    "",
    report.boundaries.length === 0
      ? "Single chunk — no boundary to inspect."
      : "| from | to | audio seam ms | timeline seam ms | next first φ ms | note |",
  );
  if (report.boundaries.length > 0) {
    lines.push("|---:|---:|---:|---:|---:|---|");
    for (const boundary of report.boundaries) {
      lines.push(
        `| ${cell(boundary.fromChunkIndex)} | ${cell(boundary.toChunkIndex)} | ${boundary.audioSeamMs} | ` +
          `${cell(boundary.timelineSeamMs)} | ${cell(boundary.nextFirstPhonemeRelativeMs)} | ${boundary.note} |`,
      );
    }
  }

  const sync = report.sync;
  lines.push(
    "",
    "## H/I. SYNC MEASUREMENT",
    "",
    `acoustic reference frames: ${sync.acousticFrames}`,
    "",
    "| signal vs audio | overall | 1st third | middle | final third | spread | stability |",
    "|---|---|---|---|---|---:|---|",
    `| phoneme timeline | ${fitCell(sync.phonemeTimelineVsAudio.overall)} | ${fitCell(sync.phonemeTimelineVsAudio.firstThird)} | ${fitCell(sync.phonemeTimelineVsAudio.middleThird)} | ${fitCell(sync.phonemeTimelineVsAudio.finalThird)} | ${cell(sync.phonemeTimelineVsAudio.spreadMs)} | ${sync.phonemeTimelineVsAudio.stability} |`,
    `| GLB mouth (visual) | ${fitCell(sync.visualVsAudio.overall)} | ${fitCell(sync.visualVsAudio.firstThird)} | ${fitCell(sync.visualVsAudio.middleThird)} | ${fitCell(sync.visualVsAudio.finalThird)} | ${cell(sync.visualVsAudio.spreadMs)} | ${sync.visualVsAudio.stability} |`,
    "",
    "Positive = EARLY (leads the audio). " + sync.note,
  );

  const frames = report.frameAnalysis?.frames;
  if (frames) {
    lines.push(
      "",
      "## FRAME HEALTH (existing analyzer)",
      "",
      `${frames.count} frames over ${Math.round(frames.wallSpanMs)} ms · ${frames.averageFps === null ? "—" : round1(frames.averageFps)} fps · ` +
        `p50 ${cell(frames.wallDeltaMs?.p50)} ms, p95 ${cell(frames.wallDeltaMs?.p95)} ms, max ${cell(frames.wallDeltaMs?.max)} ms · ` +
        `over 33 ms: ${frames.over33ms}, over 100 ms: ${frames.over100ms} · truncated ${frames.truncatedFrames}`,
    );
  }

  lines.push("", "## LIMITATIONS", "");
  for (const item of report.limitations) lines.push(`- ${item}`);

  return lines.join("\n");
}

/**
 * Publishes the console entry points. Called once per session by the live-engine
 * binding, which supplies the acoustic refresh because it owns the adapter.
 *
 *     __solaceHyper3dReply()      the joined object
 *     __solaceHyper3dReplyText()  the same thing as markdown
 */
export function installHyper3dReplyReport(refresh: () => void): void {
  if (!DEV || typeof window === "undefined") return;
  refreshAcoustics = refresh;
  const target = window as unknown as Record<string, unknown>;
  target.__solaceHyper3dReply = buildHyper3dReplyReport;
  target.__solaceHyper3dReplyText = () => formatHyper3dReplyReport();
}
