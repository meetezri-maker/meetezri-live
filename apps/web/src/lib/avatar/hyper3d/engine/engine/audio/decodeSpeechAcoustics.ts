import {
  analyzeSpeechAudio,
  type SpeechAcousticFrame
} from "../avatar/upstream/threejs-talking-avatar/audioAnalysis";

/**
 * THREEJS-TALKING-AVATAR EXPERIMENT — the one input we cannot get from the
 * existing payload.
 *
 * Upstream's head-beat detector scores acoustic frames on energy, normalised
 * pitch height, voicing and transient onset. Every one of those comes from the
 * waveform. Our MFA payload carries phoneme boundaries but no energy track, no
 * F0 and — on the production clips — a constant `intensity` of 1, so there is no
 * loudness or pitch signal in it at all.
 *
 * So we decode the SAME audio file the payload already plays and run upstream's
 * own `analyzeSpeechAudio` over it. That is the smallest browser-side analysis
 * portion of their stack, it is Apache-2.0 original source, and it pulls in
 * nothing else: no TTS, no STT, no LLM, no WebGPU runtime, no model weights.
 *
 * This does NOT touch playback. It fetches the file a second time and decodes it
 * off to one side; the `HTMLAudioElement` that drives the clock and the existing
 * MFA lip sync are both untouched.
 */

/** Cached per audio URL: the analysis is deterministic and the clips are fixed. */
const cache = new Map<string, Promise<SpeechAcousticFrame[]>>();

type AudioContextConstructor = new () => AudioContext;

const resolveAudioContext = (): AudioContextConstructor | null => {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
};

const decode = async (url: string): Promise<SpeechAcousticFrame[]> => {
  const Constructor = resolveAudioContext();
  if (!Constructor) return [];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`audio fetch failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const context = new Constructor();
  try {
    const buffer = await context.decodeAudioData(bytes);
    return analyzeSpeechAudio(buffer);
  } finally {
    // The context exists only to decode; releasing it keeps the experiment from
    // holding an extra hardware audio device open behind playback.
    void context.close?.();
  }
};

/**
 * Decoded prosody for one audio URL. Resolves to an empty track — never to
 * invented frames — when the browser cannot decode it.
 */
export const loadSpeechAcoustics = (url: string): Promise<SpeechAcousticFrame[]> => {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = decode(url).catch(() => [] as SpeechAcousticFrame[]);
  cache.set(url, pending);
  return pending;
};

/** Test seam. */
export const clearSpeechAcousticsCache = (): void => cache.clear();
