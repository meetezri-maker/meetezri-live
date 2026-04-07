/**
 * Category music from `/public/music` (looped HTMLAudioElement) plus procedural wind.
 * Rain uses `/music/rain.mp3` (e.g. 30 min rain/thunder). Call start after a user gesture.
 */

export type WellnessAmbientKind =
  | "rain"
  | "wind"
  | "mindfulness_music"
  | "meditation_music"
  | "relaxation_music"
  | "selfcare_music"
  | "sleephealth_music"
  | "stress_management_music"
  | "anxiety_management_music"
  | "depression_support_music";

let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let lfoNode: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let activeKind: WellnessAmbientKind | null = null;
let mediaAudioEl: HTMLAudioElement | null = null;
let ambientSessionToken = 0;

const MINDFULNESS_MUSIC_PATHS = [
  "/music/mindfullness.mp3",
  "/music/Breathing Anchor Meditation to Steady the Mind   15 Minutes.mp3",
];
const MEDITATION_MUSIC_PATHS = ["/music/Meditation.mp3", "/music/Medication.mp3"];
const RELAXATION_MUSIC_PATHS = ["/music/relaxation.mp3"];
const SELFCARE_MUSIC_PATHS = ["/music/selfcare.mp3"];
const SLEEPHEALTH_MUSIC_PATHS = ["/music/sleephealth.mp3"];
const STRESS_MANAGEMENT_MUSIC_PATHS = ["/music/stress management.mp3"];
const ANXIETY_MANAGEMENT_MUSIC_PATHS = ["/music/Anxietymanagement.mp3"];
const DEPRESSION_SUPPORT_MUSIC_PATHS = ["/music/depression-support.mp3"];
const RAIN_MUSIC_PATHS = ["/music/rain.mp3"];

function getOrCreateContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

function createWhiteNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Approximate pink noise by filtering white noise (Paul Kellet-style one-pole). */
function whiteToPinkBuffer(ctx: AudioContext, white: AudioBuffer): AudioBuffer {
  const length = white.length;
  const out = ctx.createBuffer(1, length, ctx.sampleRate);
  const inCh = white.getChannelData(0);
  const outCh = out.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < length; i++) {
    const whiteSample = inCh[i];
    b0 = 0.99886 * b0 + whiteSample * 0.0555179;
    b1 = 0.99332 * b1 + whiteSample * 0.0750759;
    b2 = 0.969 * b2 + whiteSample * 0.153852;
    b3 = 0.8665 * b3 + whiteSample * 0.3104856;
    b4 = 0.55 * b4 + whiteSample * 0.5329522;
    b5 = -0.7616 * b5 - whiteSample * 0.016898;
    outCh[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteSample * 0.5362;
    b6 = whiteSample * 0.115926;
  }
  return out;
}

function disconnectGraph() {
  try {
    sourceNode?.stop();
  } catch {
    /* already stopped */
  }
  sourceNode?.disconnect();
  lfoNode?.stop();
  lfoNode?.disconnect();
  lfoGain?.disconnect();
  gainNode?.disconnect();
  sourceNode = null;
  gainNode = null;
  lfoNode = null;
  lfoGain = null;
  activeKind = null;
}

function stopMediaAudio() {
  if (!mediaAudioEl) return;
  try {
    mediaAudioEl.pause();
    mediaAudioEl.currentTime = 0;
  } catch {
    /* no-op */
  }
  mediaAudioEl = null;
}

async function startMediaLoop(urls: string[], volume: number): Promise<void> {
  stopMediaAudio();
  const token = ++ambientSessionToken;
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = true;
  audio.volume = volume;
  let idx = 0;

  const tryPlay = async (): Promise<void> => {
    if (idx >= urls.length) {
      throw new Error("No playable ambient music source found.");
    }
    audio.src = encodeURI(urls[idx]);
    idx += 1;
    try {
      await audio.play();
    } catch {
      await tryPlay();
    }
  };

  await tryPlay();
  // If stop was called while play() was resolving, cancel this stale audio.
  if (token !== ambientSessionToken) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* no-op */
    }
    return;
  }
  mediaAudioEl = audio;
}

/**
 * Start looping ambient. Stops any previous ambient first.
 */
export async function startWellnessAmbient(kind: WellnessAmbientKind): Promise<void> {
  const token = ++ambientSessionToken;
  disconnectGraph();
  stopMediaAudio();

  if (kind === "mindfulness_music") {
    await startMediaLoop(MINDFULNESS_MUSIC_PATHS, 0.5);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "meditation_music") {
    await startMediaLoop(MEDITATION_MUSIC_PATHS, 0.45);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "relaxation_music") {
    await startMediaLoop(RELAXATION_MUSIC_PATHS, 0.42);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "selfcare_music") {
    await startMediaLoop(SELFCARE_MUSIC_PATHS, 0.45);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "sleephealth_music") {
    await startMediaLoop(SLEEPHEALTH_MUSIC_PATHS, 0.4);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "stress_management_music") {
    await startMediaLoop(STRESS_MANAGEMENT_MUSIC_PATHS, 0.45);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "anxiety_management_music") {
    await startMediaLoop(ANXIETY_MANAGEMENT_MUSIC_PATHS, 0.45);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "depression_support_music") {
    await startMediaLoop(DEPRESSION_SUPPORT_MUSIC_PATHS, 0.44);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  if (kind === "rain") {
    await startMediaLoop(RAIN_MUSIC_PATHS, 0.42);
    if (token !== ambientSessionToken) return;
    activeKind = kind;
    return;
  }

  const ctx = getOrCreateContext();
  await ctx.resume();

  const white = createWhiteNoiseBuffer(ctx, 2);
  let buffer: AudioBuffer;

  // wind — pink-ish noise + gentle amplitude wobble
  buffer = whiteToPinkBuffer(ctx, white);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 520;
  band.Q.value = 0.55;

  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 2000;
  shelf.gain.value = -6;

  const g = ctx.createGain();
  g.gain.value = 0.18;

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.12;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.06;
  lfo.connect(lfoG);
  lfoG.connect(g.gain);

  src.connect(band);
  band.connect(shelf);
  shelf.connect(g);
  g.connect(ctx.destination);

  lfo.start(0);
  src.start(0);

  sourceNode = src;
  gainNode = g;
  lfoNode = lfo;
  lfoGain = lfoG;
  activeKind = kind;
}

export function stopWellnessAmbient(): void {
  // Invalidate any in-flight async start call immediately.
  ambientSessionToken++;
  disconnectGraph();
  stopMediaAudio();
}

export function getActiveAmbientKind(): WellnessAmbientKind | null {
  return activeKind;
}

/** Built-in tools that use ambient loops (by id). */
export function ambientKindForExerciseId(exerciseId: string): WellnessAmbientKind | null {
  if (exerciseId === "rain-sounds") return "rain";
  if (exerciseId === "box-breathing") return "relaxation_music";
  if (exerciseId === "stress-release-waves") return "stress_management_music";
  if (exerciseId === "grounding-54321") return "anxiety_management_music";
  if (exerciseId === "compassion-pause") return "depression_support_music";
  if (exerciseId === "mindful-anchor") return "mindfulness_music";
  if (exerciseId === "body-scan") return "meditation_music";
  if (exerciseId === "sleep-meditation") return "sleephealth_music";
  if (exerciseId === "gratitude") return "selfcare_music";
  return null;
}
