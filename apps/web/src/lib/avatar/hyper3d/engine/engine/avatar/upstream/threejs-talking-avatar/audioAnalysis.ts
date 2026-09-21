/**
 * ADAPTED FROM THIRD-PARTY SOURCE — DO NOT TREAT AS OURS.
 *
 *   upstream repo   https://github.com/majidmanzarpour/threejs-talking-avatar
 *   upstream commit 61ab8e3b1a14946b245926ac1b12e4f387b656ab
 *   upstream file   demo/src/speech/AudioAnalysis.ts
 *   licence         Apache License 2.0
 *
 * Copied verbatim: `SpeechAcousticFrame`, `PcmAudioLike`,
 * `AcousticAnalysisOptions`, `clamp01`, `percentile`, `normalizeRange`,
 * `downmix`, `normalizedAutocorrelation`, `analyzeSpeechAudio`.
 *
 * Deliberately NOT copied:
 *   - `refinePhonemeTimelineWithAudio` and `phoneContrastScore`. They move
 *     phoneme boundaries. This experiment must not touch our MFA lip sync.
 *   - `sampleSpeechAcoustics`. The head planner consumes the whole track up
 *     front and never samples it per frame.
 *
 * This is the ONLY thing we take from the upstream audio stack. Their TTS,
 * STT, LLM and WebGPU runtimes are not installed — see PROVENANCE.md.
 */

/**
 * Deterministic short-time acoustic measurements extracted from decoded PCM.
 * These are deliberately small DSP features, not learned embeddings or model
 * inference. Values are normalized to 0..1 except pitchHz.
 */
export interface SpeechAcousticFrame {
  time: number;
  energy: number;
  voicing: number;
  pitchHz: number;
  transient: number;
  highFrequency: number;
}

export interface PcmAudioLike {
  readonly sampleRate: number;
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

export interface AcousticAnalysisOptions {
  frameSeconds?: number;
  hopSeconds?: number;
  minimumPitchHz?: number;
  maximumPitchHz?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((first, second) => first - second);
  const position = clamp01(fraction) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const mix = position - lower;
  return sorted[lower] * (1 - mix) + sorted[upper] * mix;
}

function normalizeRange(value: number, floor: number, ceiling: number): number {
  if (ceiling <= floor + 1e-9) return value > floor ? 1 : 0;
  return clamp01((value - floor) / (ceiling - floor));
}

function downmix(audio: PcmAudioLike): Float32Array {
  const mono = new Float32Array(audio.length);
  const channels = Math.max(1, audio.numberOfChannels);
  for (let channel = 0; channel < channels; channel += 1) {
    const source = audio.getChannelData(channel);
    const count = Math.min(source.length, mono.length);
    for (let index = 0; index < count; index += 1) {
      mono[index] += source[index] / channels;
    }
  }
  return mono;
}

function normalizedAutocorrelation(
  samples: Float32Array,
  start: number,
  count: number,
  lag: number
): number {
  let correlation = 0;
  let firstEnergy = 0;
  let secondEnergy = 0;
  // A stride of two retains more than enough resolution for a prosody cue and
  // keeps analysis inexpensive for longer generated phrases.
  for (let offset = 0; offset + lag < count; offset += 2) {
    const first = samples[start + offset] ?? 0;
    const second = samples[start + offset + lag] ?? 0;
    correlation += first * second;
    firstEnergy += first * first;
    secondEnergy += second * second;
  }
  const denominator = Math.sqrt(firstEnergy * secondEnergy);
  return denominator > 1e-10 ? correlation / denominator : 0;
}

/** Extracts a compact acoustic track at a default 100 Hz update rate. */
export function analyzeSpeechAudio(
  audio: PcmAudioLike,
  options: AcousticAnalysisOptions = {}
): SpeechAcousticFrame[] {
  if (!Number.isFinite(audio.sampleRate) || audio.sampleRate <= 0) {
    throw new TypeError("Audio sampleRate must be a positive finite number.");
  }
  if (!Number.isInteger(audio.length) || audio.length < 0) {
    throw new TypeError("Audio length must be a non-negative integer.");
  }
  if (audio.length === 0) return [];

  const frameSize = Math.max(32, Math.round(audio.sampleRate * (options.frameSeconds ?? 0.025)));
  const hopSize = Math.max(1, Math.round(audio.sampleRate * (options.hopSeconds ?? 0.01)));
  const minimumPitchHz = Math.max(45, options.minimumPitchHz ?? 70);
  const maximumPitchHz = Math.max(minimumPitchHz + 1, options.maximumPitchHz ?? 360);
  const minimumLag = Math.max(2, Math.floor(audio.sampleRate / maximumPitchHz));
  const maximumLag = Math.min(frameSize - 2, Math.ceil(audio.sampleRate / minimumPitchHz));
  const mono = downmix(audio);
  const raw: Array<SpeechAcousticFrame & { rawEnergy: number; rawTransient: number }> = [];
  let previousEnergy = 0;

  for (let start = 0; start < mono.length; start += hopSize) {
    const count = Math.min(frameSize, mono.length - start);
    if (count < 16) break;
    let squareSum = 0;
    let differenceSquareSum = 0;
    let zeroCrossings = 0;
    let previous = mono[start] ?? 0;
    for (let offset = 0; offset < count; offset += 1) {
      const sample = mono[start + offset] ?? 0;
      squareSum += sample * sample;
      if (offset > 0) {
        const difference = sample - previous;
        differenceSquareSum += difference * difference;
        if ((sample >= 0) !== (previous >= 0)) zeroCrossings += 1;
      }
      previous = sample;
    }

    const rms = Math.sqrt(squareSum / count);
    const differenceRms = Math.sqrt(differenceSquareSum / Math.max(1, count - 1));
    const zeroCrossingRate = zeroCrossings / Math.max(1, count - 1);
    const highFrequency = clamp01(
      (differenceRms / Math.max(0.0001, rms * 1.7)) * 0.72 + zeroCrossingRate * 0.9
    );

    let bestCorrelation = 0;
    let bestLag = 0;
    if (rms > 1e-5 && maximumLag >= minimumLag) {
      for (let lag = minimumLag; lag <= maximumLag; lag += 2) {
        const correlation = normalizedAutocorrelation(mono, start, count, lag);
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
    }
    const voicing = clamp01((bestCorrelation - 0.18) / 0.68);
    const rawTransient =
      Math.max(0, rms - previousEnergy) + Math.abs(rms - previousEnergy) * highFrequency * 0.35;
    previousEnergy = rms;
    raw.push({
      time: (start + count * 0.5) / audio.sampleRate,
      energy: 0,
      voicing,
      pitchHz: voicing > 0.12 && bestLag > 0 ? audio.sampleRate / bestLag : 0,
      transient: 0,
      highFrequency,
      rawEnergy: rms,
      rawTransient
    });
  }

  const noiseFloor = percentile(raw.map((frame) => frame.rawEnergy), 0.12);
  const speechCeiling = percentile(raw.map((frame) => frame.rawEnergy), 0.94);
  const transientCeiling = percentile(raw.map((frame) => frame.rawTransient), 0.95);
  return raw.map(({ rawEnergy, rawTransient, ...frame }) => ({
    ...frame,
    energy: normalizeRange(rawEnergy, noiseFloor, speechCeiling),
    transient: normalizeRange(rawTransient, 0, transientCeiling)
  }));
}
