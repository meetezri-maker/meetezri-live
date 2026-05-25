/** Target sample rate for Ezri backend VAD + Whisper (16 kHz mono PCM). */
export const EZRI_PCM_SAMPLE_RATE = 16_000;

/**
 * Linear downsample float32 audio to 16 kHz when the capture context runs at
 * 44.1/48 kHz (common when the browser ignores AudioContext sampleRate hints).
 */
export function downsampleFloat32To16k(
  input: Float32Array,
  sourceSampleRate: number,
): Float32Array {
  if (sourceSampleRate <= EZRI_PCM_SAMPLE_RATE) return input;
  const ratio = sourceSampleRate / EZRI_PCM_SAMPLE_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const s0 = input[idx] ?? 0;
    const s1 = input[Math.min(idx + 1, input.length - 1)] ?? s0;
    out[i] = s0 + frac * (s1 - s0);
  }
  return out;
}

export function float32ToInt16Pcm(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  }
  return pcm;
}

/** Create a capture AudioContext; prefer 16 kHz but fall back to the device default. */
export async function createPcmCaptureAudioContext(): Promise<AudioContext> {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  let ctx: AudioContext;
  try {
    ctx = new AudioCtx({ sampleRate: EZRI_PCM_SAMPLE_RATE });
  } catch {
    ctx = new AudioCtx();
  }

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return ctx;
}

/** Int16 PCM payload for WebSocket binary frames. */
export function int16PcmToArrayBuffer(pcm: Int16Array): ArrayBuffer {
  return pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
}
