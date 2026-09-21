import type { Hyper3dFullFrameCapture, Hyper3dFullFrameRecord } from "./hyper3dLiveSpeechAdapter";

/**
 * DIAGNOSTIC ANALYSIS of a full-frame lip-sync capture. Pure functions; nothing
 * here is imported by production code, and nothing is applied to the runtime.
 * Timing "fits" below are measurements of how the backend phoneme windows line
 * up with the existing acoustic analysis — they are never used to retime.
 */

const VOWELS = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"]);

export type PhonemeFrameStats = {
  index: number;
  phoneme: string;
  start: number;
  end: number | null;
  duration: number | null;
  frames: number;
  zeroFrames: boolean;
  oneFrame: boolean;
  peakControllerJawOpen: number;
  peakFinalJawOpen: number;
  peakGlbJawOpen: number;
  peakGlbMouthValue: number;
  peakGlbMouthChannel: string | null;
};

export type CaptureAnalysis = {
  kind: string;
  frames: {
    count: number;
    firstResponseClock: number | null;
    lastResponseClock: number | null;
    wallSpanMs: number;
    averageFps: number | null;
    /** Frames per second of AUDIO clock advanced. Use this for offline replays. */
    averageFpsByResponseClock: number | null;
    wallDeltaMs: { p50: number; p90: number; p95: number; p99: number; max: number } | null;
    over20ms: number;
    over33ms: number;
    over50ms: number;
    over66ms: number;
    over100ms: number;
    truncatedFrames: number;
  };
  identity: {
    controllerEqualsFinal: boolean;
    finalEqualsGlb: boolean;
    maxControllerFinalDelta: number;
    maxFinalGlbDelta: number;
    presenceOwnedFrames: number;
    showcaseActiveFrames: number;
  };
  phonemes: PhonemeFrameStats[];
  timing: {
    leadInSec: number | null;
    decodedDurationSeconds: number | null;
    audibleDurationSeconds: number | null;
    backendFirstStart: number | null;
    backendLastEnd: number | null;
    backendTimelineDuration: number | null;
    backendPhonemeCount: number;
    timelinePhonemeCount: number;
    droppedPhonemes: number;
    backendPhonemesStartingBeyondAudible: number;
    backendPhonemesEndingBeyondAudible: number;
    backendEndMinusAudible: number | null;
    backendEndMinusDecoded: number | null;
    decodedMinusAudible: number | null;
    acoustic: AcousticFit | null;
  };
};

export type AcousticFit = {
  acousticFrames: number;
  /** Pearson r between a vowel-window indicator and acoustic energy, on the audible clock. */
  correlationAsDelivered: number;
  /** Same, if backend time 0 were the raw WAV start (response = backendTime − leadIn). */
  correlationRawWavOrigin: number | null;
  bestShiftSeconds: number;
  correlationAtBestShift: number;
  bestScale: number;
  bestScaleOffsetSeconds: number;
  correlationAtBestScale: number;
  note: string;
};

function quantile(sorted: number[], fraction: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))];
}

function maxMouth(record: Hyper3dFullFrameRecord["glb"]): { value: number; channel: string | null } {
  let value = 0;
  let channel: string | null = null;
  for (const [name, v] of Object.entries(record)) {
    if (v > value) {
      value = v;
      channel = name;
    }
  }
  return { value, channel };
}

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

/**
 * Samples a vowel indicator built from backend phoneme windows mapped by
 * `responseTime = scale × backendTime + offset`, against acoustic energy
 * interpolated on a 10 ms response-time grid over the audible duration.
 */
function vowelEnergyCorrelation(
  phonemes: Array<{ phoneme: string; start: number; end: number | null }>,
  acoustic: Array<{ time: number; energy: number }>,
  audibleDuration: number,
  scale: number,
  offset: number,
): number {
  const step = 0.01;
  const indicator: number[] = [];
  const energy: number[] = [];
  let a = 0;
  for (let t = 0; t < audibleDuration; t += step) {
    while (a + 1 < acoustic.length && acoustic[a + 1].time <= t) a += 1;
    energy.push(acoustic[a]?.energy ?? 0);
    let value = 0;
    for (const p of phonemes) {
      if (p.end === null) continue;
      const start = scale * p.start + offset;
      const end = scale * p.end + offset;
      if (t >= start && t < end) {
        value = VOWELS.has(p.phoneme.replace(/\d+$/, "").toUpperCase()) ? 1 : 0.25;
        break;
      }
    }
    indicator.push(value);
  }
  return pearson(indicator, energy);
}

function fitAcoustic(capture: Hyper3dFullFrameCapture, leadInSec: number | null, audible: number | null): AcousticFit | null {
  const first = capture.chunks[0];
  if (!first || !capture.acousticFrames.length || !audible || capture.chunks.length !== 1) return null;
  const phonemes = first.backendPhonemes;
  const acoustic = capture.acousticFrames;
  const asDelivered = vowelEnergyCorrelation(phonemes, acoustic, audible, 1, 0);
  const rawOrigin = leadInSec !== null ? vowelEnergyCorrelation(phonemes, acoustic, audible, 1, -leadInSec) : null;
  let bestShift = 0;
  let bestShiftR = -Infinity;
  for (let shift = -0.8; shift <= 0.8001; shift += 0.01) {
    const r = vowelEnergyCorrelation(phonemes, acoustic, audible, 1, shift);
    if (r > bestShiftR) {
      bestShiftR = r;
      bestShift = shift;
    }
  }
  let bestScale = 1;
  let bestOffset = 0;
  let bestScaleR = -Infinity;
  for (let scale = 0.8; scale <= 1.2001; scale += 0.01) {
    for (let offset = -0.8; offset <= 0.8001; offset += 0.02) {
      const r = vowelEnergyCorrelation(phonemes, acoustic, audible, scale, offset);
      if (r > bestScaleR) {
        bestScaleR = r;
        bestScale = scale;
        bestOffset = offset;
      }
    }
  }
  return {
    acousticFrames: acoustic.length,
    correlationAsDelivered: asDelivered,
    correlationRawWavOrigin: rawOrigin,
    bestShiftSeconds: Math.round(bestShift * 100) / 100,
    correlationAtBestShift: bestShiftR,
    bestScale: Math.round(bestScale * 100) / 100,
    bestScaleOffsetSeconds: Math.round(bestOffset * 100) / 100,
    correlationAtBestScale: bestScaleR,
    note:
      "Energy from the existing analyzer, response-relative (trimmed domain). Fits are measurements, never applied. " +
      "Vowels weighted 1, consonants 0.25, gaps 0.",
  };
}

export function analyzeFullFrameCapture(capture: Hyper3dFullFrameCapture): CaptureAnalysis {
  const frames = capture.frames;
  const wallDeltas: number[] = [];
  for (let i = 1; i < frames.length; i += 1) wallDeltas.push(frames[i].nowMs - frames[i - 1].nowMs);
  const sorted = [...wallDeltas].sort((x, y) => x - y);
  const wallSpanMs = frames.length > 1 ? frames[frames.length - 1].nowMs - frames[0].nowMs : 0;

  let maxControllerFinalDelta = 0;
  let maxFinalGlbDelta = 0;
  for (const f of frames) {
    for (const name of Object.keys(f.controller)) {
      maxControllerFinalDelta = Math.max(maxControllerFinalDelta, Math.abs((f.controller[name] ?? 0) - (f.final[name] ?? 0)));
      maxFinalGlbDelta = Math.max(maxFinalGlbDelta, Math.abs((f.final[name] ?? 0) - (f.glb[name] ?? 0)));
    }
  }

  const phonemes: PhonemeFrameStats[] = capture.timelinePhonemes.map((p) => {
    const inside = frames.filter((f) => p.end !== null && f.responseClock >= p.start && f.responseClock < p.end);
    let peakGlbMouthValue = 0;
    let peakGlbMouthChannel: string | null = null;
    for (const f of inside) {
      const m = maxMouth(f.glb);
      if (m.value > peakGlbMouthValue) {
        peakGlbMouthValue = m.value;
        peakGlbMouthChannel = m.channel;
      }
    }
    return {
      index: p.index,
      phoneme: p.phoneme,
      start: p.start,
      end: p.end,
      duration: p.duration,
      frames: inside.length,
      zeroFrames: inside.length === 0,
      oneFrame: inside.length === 1,
      peakControllerJawOpen: Math.max(0, ...inside.map((f) => f.controller.jawOpen ?? 0)),
      peakFinalJawOpen: Math.max(0, ...inside.map((f) => f.final.jawOpen ?? 0)),
      peakGlbJawOpen: Math.max(0, ...inside.map((f) => f.glb.jawOpen ?? 0)),
      peakGlbMouthValue,
      peakGlbMouthChannel,
    };
  });

  const chunk = capture.chunks[0] ?? null;
  const single = capture.chunks.length === 1;
  const leadInSec = single && chunk ? chunk.leadInSec : null;
  const audible = single && chunk ? chunk.durationMs / 1000 : null;
  const decoded = single && chunk ? chunk.decodedDurationSeconds : null;
  const backend = single && chunk ? chunk.backendPhonemes : [];
  const backendLastEnd = single && chunk ? chunk.backendLastEnd : null;
  const backendFirstStart = single && chunk ? chunk.backendFirstStart : null;

  return {
    kind: capture.kind,
    frames: {
      count: frames.length,
      firstResponseClock: frames[0]?.responseClock ?? null,
      lastResponseClock: frames[frames.length - 1]?.responseClock ?? null,
      wallSpanMs,
      averageFps: wallSpanMs > 0 ? ((frames.length - 1) * 1000) / wallSpanMs : null,
      averageFpsByResponseClock:
        frames.length > 1 && frames[frames.length - 1].responseClock > frames[0].responseClock
          ? (frames.length - 1) / (frames[frames.length - 1].responseClock - frames[0].responseClock)
          : null,
      wallDeltaMs: sorted.length
        ? {
            p50: quantile(sorted, 0.5),
            p90: quantile(sorted, 0.9),
            p95: quantile(sorted, 0.95),
            p99: quantile(sorted, 0.99),
            max: sorted[sorted.length - 1],
          }
        : null,
      over20ms: wallDeltas.filter((d) => d > 20).length,
      over33ms: wallDeltas.filter((d) => d > 33).length,
      over50ms: wallDeltas.filter((d) => d > 50).length,
      over66ms: wallDeltas.filter((d) => d > 66).length,
      over100ms: wallDeltas.filter((d) => d > 100).length,
      truncatedFrames: capture.truncatedFrames,
    },
    identity: {
      controllerEqualsFinal: maxControllerFinalDelta < 1e-9,
      finalEqualsGlb: maxFinalGlbDelta < 1e-9,
      maxControllerFinalDelta,
      maxFinalGlbDelta,
      presenceOwnedFrames: frames.filter((f) => f.presenceOwns).length,
      showcaseActiveFrames: frames.filter((f) => f.showcaseActive).length,
    },
    phonemes,
    timing: {
      leadInSec,
      decodedDurationSeconds: decoded,
      audibleDurationSeconds: audible,
      backendFirstStart,
      backendLastEnd,
      backendTimelineDuration:
        backendFirstStart !== null && backendLastEnd !== null ? backendLastEnd - backendFirstStart : null,
      backendPhonemeCount: backend.length,
      timelinePhonemeCount: capture.timelinePhonemes.length,
      droppedPhonemes: backend.length - capture.timelinePhonemes.length,
      backendPhonemesStartingBeyondAudible: audible !== null ? backend.filter((p) => p.start >= audible).length : 0,
      backendPhonemesEndingBeyondAudible:
        audible !== null ? backend.filter((p) => p.end !== null && p.end > audible).length : 0,
      backendEndMinusAudible: backendLastEnd !== null && audible !== null ? backendLastEnd - audible : null,
      backendEndMinusDecoded: backendLastEnd !== null && decoded !== null ? backendLastEnd - decoded : null,
      decodedMinusAudible: decoded !== null && audible !== null ? decoded - audible : null,
      acoustic: fitAcoustic(capture, leadInSec, audible),
    },
  };
}

/** Per-phoneme live vs replay comparison, matched by timeline index. */
export function comparePhonemePeaks(live: CaptureAnalysis, replay: CaptureAnalysis) {
  return live.phonemes.map((p) => {
    const r = replay.phonemes.find((q) => q.index === p.index);
    return {
      index: p.index,
      phoneme: p.phoneme,
      liveFrames: p.frames,
      replayFrames: r?.frames ?? 0,
      liveControllerJaw: p.peakControllerJawOpen,
      replayControllerJaw: r?.peakControllerJawOpen ?? 0,
      liveGlbJaw: p.peakGlbJawOpen,
      replayGlbJaw: r?.peakGlbJawOpen ?? 0,
      liveOverReplayGlbJaw:
        r && r.peakGlbJawOpen > 1e-6 ? p.peakGlbJawOpen / r.peakGlbJawOpen : null,
    };
  });
}

/**
 * Accepted vowel jaw peaks, parsed from the avatar-test measurement document
 * rather than retyped: the "after" column's first figure (jaw) of the §3 table.
 */
export function parseAcceptedVowelJawPeaks(markdown: string): Record<string, number> {
  const peaks: Record<string, number> = {};
  for (const line of markdown.split("\n")) {
    const match = /^\|\s*([A-Z]{2})\s*\|\s*[\d.]+\s*·[^|]*\|\s*\*{0,2}([\d.]+)/.exec(line);
    if (match && VOWELS.has(match[1])) peaks[match[1]] = Number(match[2]);
  }
  return peaks;
}
