import { readFileSync } from "node:fs";
import { analyzeSpeechAudio, type SpeechAcousticFrame } from "./engine/engine/avatar/upstream/threejs-talking-avatar/audioAnalysis";
import type { AvatarPayload } from "./engine/types/avatarPayload";

/**
 * STATIC COMMAND EQUIVALENCE — shared fixtures.
 *
 * The comparison is against the ACCEPTED MEASURED BASELINE
 * (`BASELINE_GOLDEN` in `hyper3dPerformanceBaseline.ts`), not against a
 * re-transcription of the orchestration. That baseline records what the reviewed
 * render actually measured on `david-natural-speech-paragraph`, so reproducing it
 * from the Solace imperative runtime is evidence the mount did not alter
 * accepted behaviour — which comparing my code to my own notes would not be.
 *
 * Both inputs are the real ones: the golden MFA payload and the same WAV the
 * accepted run analysed. The WAV is parsed directly to PCM rather than decoded
 * through an AudioContext, which is exactly what the live path does with the
 * scheduler's already-decoded buffer.
 */

const AVATAR_TEST = "/home/marqlinux/avatar-test";

export const GOLDEN_PAYLOAD_PATH = `${AVATAR_TEST}/src/data/tuning/generated/david-natural-speech-paragraph.payload.json`;
export const GOLDEN_AUDIO_PATH = `${AVATAR_TEST}/public/audio/tuning/david-natural-speech-paragraph.wav`;

export type PcmAudio = {
  readonly sampleRate: number;
  readonly length: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
};

/**
 * Minimal RIFF/WAVE reader for 16- and 32-bit PCM and 32-bit float.
 *
 * Deliberately not an AudioContext decode: node has none, and the production
 * path never decodes either — it analyses a buffer the scheduler already
 * produced. This keeps the harness on the same footing as the live runtime.
 */
export function readWavAsPcm(path: string): PcmAudio {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`not a RIFF/WAVE file: ${path}`);
  }

  let offset = 12;
  let format = 1;
  let channels = 1;
  let sampleRate = 48000;
  let bits = 16;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      dataLength = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (dataStart < 0) throw new Error(`no data chunk: ${path}`);

  const bytesPerSample = bits / 8;
  const frames = Math.floor(dataLength / (bytesPerSample * channels));
  const channelData: Float32Array[] = Array.from(
    { length: channels },
    () => new Float32Array(frames),
  );

  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const at = dataStart + (frame * channels + channel) * bytesPerSample;
      let value = 0;
      if (format === 3 && bits === 32) value = buf.readFloatLE(at);
      else if (bits === 16) value = buf.readInt16LE(at) / 32768;
      else if (bits === 32) value = buf.readInt32LE(at) / 2147483648;
      else if (bits === 8) value = (buf.readUInt8(at) - 128) / 128;
      channelData[channel][frame] = value;
    }
  }

  return {
    sampleRate,
    length: frames,
    numberOfChannels: channels,
    getChannelData: (channel: number) => channelData[channel] ?? channelData[0],
  };
}

export function loadGoldenPayload(): AvatarPayload {
  return JSON.parse(readFileSync(GOLDEN_PAYLOAD_PATH, "utf8")) as AvatarPayload;
}

export function loadGoldenAcoustics(): SpeechAcousticFrame[] {
  return analyzeSpeechAudio(readWavAsPcm(GOLDEN_AUDIO_PATH));
}

/**
 * Interpolated percentile. Convenient for the head/gaze readouts, which are
 * compared against the baseline only to two decimals.
 *
 * NOT the estimator `BASELINE_GOLDEN` was recorded with — use `baselineQuantile`
 * for anything asserted against it.
 */
export function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(1, Math.max(0, fraction)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * The BASELINE_GOLDEN quantile convention, transcribed from
 * `avatar-test/src/tests/hyper3dPerformanceBaselineContract.test.ts:319`.
 *
 * Indexes `sorted[floor(p * n)]` — no interpolation, and `n` rather than
 * `n - 1`. The baseline's recorded figures were produced with THIS estimator, so
 * anything compared against `BASELINE_GOLDEN` has to use it. Measuring the right
 * quantity with the wrong estimator is how this harness previously reported a
 * head divergence that was not there.
 */
export function baselineQuantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}
