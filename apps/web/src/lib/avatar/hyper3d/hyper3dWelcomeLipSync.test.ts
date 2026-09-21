import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import type { EzriAvatarData } from "@/lib/ezri/realtimeClient";
import type { EzriAudioSource } from "@/lib/ezri/audio";
import { EzriWsAudioScheduler } from "@/lib/ezri/wsAudioScheduler";
import { normalizeAvatarPhonemeTimeline } from "../phonemeToViseme";
import {
  attachLateWelcomeAvatarData,
  releasePrePermissionWelcome,
} from "@/app/pages/app/active-session/utils/welcomePlayback";
import { createHyper3dEngineFactory } from "./hyper3dEngineFactory";
import type { Hyper3dEngineHandle } from "./hyper3dEngineRegistry";
import { hyper3dLiveInputsFromAdapter } from "./hyper3dLiveEngineBinding";
import {
  createHyper3dLiveSpeechAdapter,
  type Hyper3dLiveSpeechAdapter,
  type Hyper3dWelcomeLipSyncDiagnostics,
} from "./hyper3dLiveSpeechAdapter";
import {
  applyHyper3dIdleShowcasePose,
  createHyper3dIdleExpressionShowcaseRuntime,
  HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS,
} from "./hyper3dIdleExpressionShowcase";

/**
 * PHASE 2F — WELCOME LIP-SYNC REGRESSION.
 *
 * THE DEFECT. `applyHyper3dIdleShowcasePose` deleted every channel any showcase
 * recipe uses BEFORE checking whether the showcase was active, and the frame
 * orchestrator calls it on every frame (a yielded runtime still returns a
 * sample). That set includes jawOpen, mouthFunnel, mouthPucker and
 * mouthUpper/LowerDown, so while the showcase was yielded to speech the
 * controller's articulation was erased one step before `MorphTargetController.
 * write`. Only mouthClose survived, which is why the mouth read as still.
 *
 * Earlier welcome tests evaluated `AvatarController` directly and so never
 * crossed the showcase layer. These tests drive the path the browser runs:
 *
 *   welcome avatar_data (late) → pre-permission queue → release
 *   → EzriWsAudioScheduler (lead-in trim, final start time)
 *   → onChunkScheduled → live adapter → response clock → active phoneme
 *   → AvatarController → frame orchestrator (incl. showcase) → morph write
 *   → female_2291 `blendshapes.morphTargetInfluences[]`
 */

const PUBLIC_DIR = "public";
const ORIGIN = "http://localhost";
const originalFetch = globalThis.fetch;
const FRAME = 1 / 60;

function installPublicDirFetch() {
  THREE.DefaultLoadingManager.setURLModifier((url) =>
    url.startsWith("/") ? `${ORIGIN}${url}` : url,
  );
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) return new Response(null, { status: 404 });
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

/** Backend-shaped avatar_data: timestamped, speech-relative seconds. */
const backendAvatarData = (sentence: string): EzriAvatarData =>
  ({
    sentence,
    chunk_index: 0,
    sentiment: null,
    phonemes: [
      { phoneme: "HH", start: 0.0, end: 0.1 },
      { phoneme: "AY1", start: 0.1, end: 0.35 },
      { phoneme: "M", start: 0.35, end: 0.45 },
      { phoneme: "S", start: 0.45, end: 0.58 },
      { phoneme: "AA1", start: 0.58, end: 0.85 },
      { phoneme: "L", start: 0.85, end: 0.95 },
      { phoneme: "AH0", start: 0.95, end: 1.1 },
      { phoneme: "S", start: 1.1, end: 1.25 },
    ],
  }) as unknown as EzriAvatarData;

/** Buffer with 0.3 s of digital silence at the head, so lead-in trimming runs. */
class FakeAudioBuffer {
  private readonly data: Float32Array;
  constructor(readonly duration: number, readonly sampleRate = 24000) {
    this.data = new Float32Array(Math.round(duration * sampleRate));
    this.data.fill(0.4, Math.round(0.3 * sampleRate));
  }
  get length() {
    return this.data.length;
  }
  get numberOfChannels() {
    return 1;
  }
  getChannelData() {
    return this.data;
  }
}

type FakeSource = {
  buffer: FakeAudioBuffer | null;
  onended: (() => void) | null;
  startedAt: number;
  offset: number;
  ended: boolean;
  connect(): void;
  start(when: number, offset?: number): void;
  stop(): void;
};

class FakeAudioContext {
  currentTime = 40;
  state: AudioContextState = "running";
  destination = {} as AudioNode;
  sampleRate = 24000;
  readonly sources: FakeSource[] = [];
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
  }
  createAnalyser() {
    return { fftSize: 1024, smoothingTimeConstant: 0, connect() {}, getByteTimeDomainData() {} };
  }
  createBufferSource() {
    const source: FakeSource = {
      buffer: null,
      onended: null,
      startedAt: Number.POSITIVE_INFINITY,
      offset: 0,
      ended: false,
      connect() {},
      start(when: number, offset = 0) {
        source.startedAt = when;
        source.offset = offset;
      },
      stop() {},
    };
    this.sources.push(source);
    return source;
  }
  createBuffer(_channels: number, length: number, rate: number) {
    return new FakeAudioBuffer(length / rate, rate);
  }
  async decodeAudioData(bytes: ArrayBuffer) {
    return new FakeAudioBuffer(new DataView(bytes).getFloat64(32, true)) as unknown as AudioBuffer;
  }
  async resume() {}
  /** Fires `onended` the way a real context would once a source has played out. */
  advance(seconds: number) {
    this.currentTime += seconds;
    for (const source of this.sources) {
      if (source.ended || !source.buffer) continue;
      if (this.currentTime >= source.startedAt + source.buffer.duration - source.offset) {
        source.ended = true;
        source.onended?.();
      }
    }
  }
}

/** A RIFF-headed blob carrying its decoded duration, so the WAV path is taken. */
const wavSource = (durationSeconds: number): EzriAudioSource => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  new DataView(bytes.buffer).setFloat64(32, durationSeconds, true);
  return {
    kind: "blob",
    blob: { type: "audio/wav", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(0) } as unknown as Blob,
  };
};

type QueueItem = {
  subtitle: string;
  audio: EzriAudioSource;
  avatarData: EzriAvatarData | null;
  avatarDataReceived: number | null;
  prePermissionWelcome?: boolean;
};

type Snapshot = {
  responseClock: number;
  faceJawOpen: number;
  teethJawOpen: number;
  faceMouthMax: number;
  diagnostics: Hyper3dWelcomeLipSyncDiagnostics;
};

const MOUTH_MORPHS = [
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
];

/**
 * ActiveSession's wiring, reduced to the lines that touch the avatar: the same
 * scheduler callbacks, the same chunk map, the same adapter calls in the same
 * order. Speaking state follows `onChunkStart` / `onPipelineIdle` as React
 * state does.
 */
async function mountLiveSession() {
  const ctx = new FakeAudioContext();
  const chunkMap = new Map<string, QueueItem>();
  let speaking = false;
  let chunkSeq = 0;
  let adapter!: Hyper3dLiveSpeechAdapter;

  const scheduler = new EzriWsAudioScheduler({
    onChunkScheduled: (meta, timing) => {
      const item = meta.chunkId ? chunkMap.get(meta.chunkId) : undefined;
      if (!item) return;
      adapter.onChunkScheduled({
        audioContextStartTime: timing.audioContextStartTime,
        durationMs: timing.durationMs,
        leadInSec: timing.leadInSec ?? 0,
        timeline: normalizeAvatarPhonemeTimeline(item.avatarData ?? null, timing.durationMs / 1000),
        chunkIndex: typeof item.avatarData?.chunk_index === "number" ? item.avatarData.chunk_index : null,
        sentence: item.avatarData?.sentence?.trim() || item.subtitle.trim(),
        scheduledAtMs: 0,
        audioBuffer: timing.audioBuffer ?? null,
        isWelcome: item.prePermissionWelcome === true,
      });
    },
    onChunkStart: (meta) => {
      if (meta.chunkId) chunkMap.delete(meta.chunkId);
      speaking = true;
      adapter.setStatus("playing");
    },
    onPipelineIdle: () => {
      adapter.setStatus("completed");
      speaking = false;
      adapter.cancel("audio_and_speech_driver_stopped");
    },
  });
  scheduler.bindAudioContext(ctx as unknown as AudioContext);

  adapter = createHyper3dLiveSpeechAdapter({
    getContextTime: () => scheduler.getAudioContext()?.currentTime ?? null,
    isPipelineActive: () => scheduler.isPipelineActive(),
  });

  const scene = new THREE.Scene();
  const handle: Hyper3dEngineHandle = await createHyper3dEngineFactory(hyper3dLiveInputsFromAdapter(adapter))({
    scene,
    camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100),
    renderer: {
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
    } as unknown as THREE.WebGLRenderer,
    signal: new AbortController().signal,
  });

  const find = (name: string) => {
    let found: THREE.Mesh | null = null;
    scene.traverse((object) => {
      if (!found && (object as THREE.Mesh).isMesh && object.name === name) found = object as THREE.Mesh;
    });
    return found as unknown as THREE.Mesh;
  };
  const face = find("blendshapes");
  const teeth = find("Teeth");
  const influence = (mesh: THREE.Mesh, name: string) => {
    const index = mesh.morphTargetDictionary?.[name];
    return index === undefined ? 0 : mesh.morphTargetInfluences![index];
  };

  let elapsed = 0;
  const frame = (): Snapshot => {
    elapsed += FRAME;
    ctx.advance(FRAME);
    vi.advanceTimersByTime(FRAME * 1000);
    handle.update({
      timeSeconds: adapter.getPlaybackTime(),
      deltaSeconds: FRAME,
      elapsedSeconds: elapsed,
      conversation: { isSpeaking: speaking, isListening: false, isThinking: false },
      audioLevel: 0,
    });
    // The DEV surface is one object mutated in place; each snapshot copies it.
    const live = (window as unknown as { __solaceHyper3dWelcomeLipSync: Hyper3dWelcomeLipSyncDiagnostics })
      .__solaceHyper3dWelcomeLipSync;
    return {
      responseClock: adapter.getPlaybackTime(),
      faceJawOpen: influence(face, "jawOpen"),
      teethJawOpen: influence(teeth, "JawOpen"),
      faceMouthMax: Math.max(...MOUTH_MORPHS.map((name) => influence(face, name))),
      diagnostics: {
        ...live,
        summary: { ...live.summary },
        normalSpeech: { ...live.normalSpeech },
      },
    };
  };

  const schedule = (item: QueueItem) => {
    const chunkId = `chunk-${chunkSeq++}`;
    chunkMap.set(chunkId, item);
    return scheduler.schedule(item.audio, { subtitle: item.subtitle, chunkId });
  };

  return { adapter, scheduler, handle, frame, schedule, isSpeaking: () => speaking };
}

/** Frames while audio is audible, keyed to the response clock. */
function playOut(session: Awaited<ReturnType<typeof mountLiveSession>>, maxFrames = 180) {
  const audible: Snapshot[] = [];
  for (let i = 0; i < maxFrames; i += 1) {
    const snapshot = session.frame();
    if (snapshot.diagnostics.summary.audioActive || session.isSpeaking()) audible.push(snapshot);
    if (!session.scheduler.isPipelineActive() && audible.length > 0) break;
  }
  return audible;
}

describe("Phase 2F welcome lip sync — live path to the real female_2291 mesh", () => {
  beforeAll(() => {
    installPublicDirFetch();
    // The local review build runs with the showcase ON; that is the
    // configuration the defect was observed in.
    vi.stubEnv("VITE_HYPER3D_IDLE_EXPRESSION_SHOWCASE", "true");
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
    THREE.DefaultLoadingManager.setURLModifier(undefined as never);
  });

  it("welcome audio released after permission moves the real GLB mouth on audible vowels", async () => {
    const session = await mountLiveSession();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    // Pre-permission: the avatar is mounted and idle; the showcase owns the face.
    for (let i = 0; i < 90; i += 1) session.frame();
    const idleShowcase = (globalThis as { __solaceHyper3dIdleShowcase?: { eligible: boolean } })
      .__solaceHyper3dIdleShowcase;
    expect(idleShowcase?.eligible, "showcase must be running before the welcome").toBe(true);

    // step:speaking + audio_start, both before permission.
    session.adapter.beginTurn();
    session.adapter.beginTurn();

    // Welcome audio queued without metadata; avatar_data arrives late.
    const queue: QueueItem[] = [
      { subtitle: "…", audio: wavSource(1.6), avatarData: null, avatarDataReceived: null, prePermissionWelcome: true },
    ];
    expect(attachLateWelcomeAvatarData(queue, backendAvatarData("Hi, I'm Solace."), 1)).toBe(queue[0]);

    // Permission gesture.
    let released: Promise<void> | undefined;
    releasePrePermissionWelcome({
      queue,
      prepareScheduledTurn: () => {
        session.adapter.beginTurn();
        session.adapter.setStatus("ready");
      },
      enqueueAll: (items) => {
        for (const item of items) released = session.schedule(item);
      },
      ttsDoneReceived: true,
      markSchedulerTtsDone: () => session.scheduler.setTtsDoneReceived(),
    });
    await released;

    const scheduled = session.frame().diagnostics;
    expect(scheduled.isWelcome).toBe(true);
    expect(scheduled.appendResult).toBe("accepted");
    expect(scheduled.rawPhonemeCount).toBe(8);
    expect(scheduled.leadInSec).toBeCloseTo(0.25, 2);
    expect(scheduled.responseOffsetSeconds).toBe(0);

    const audible = playOut(session);
    const welcome = audible[audible.length - 1].diagnostics;

    // Timeline survived, clock domain is the scheduler's, no turn churn.
    expect(welcome.timelinePhonemeCount).toBe(8);
    expect(welcome.turnChangedDuringPlayback).toBe(false);
    expect(welcome.clockDomainDeltaMs).toBeCloseTo(0, 6);

    // The frame that failed before the fix: an audible AA vowel.
    const vowel = audible.find(
      (s) => s.diagnostics.activePhoneme === "AA" && s.responseClock > 0.65 && s.responseClock < 0.8,
    );
    expect(vowel, "an audible frame inside AA").toBeDefined();
    const at = vowel!.diagnostics;
    expect(at.clockInsidePhoneme).toBe(true);
    expect(at.controllerSpeechActive).toBe(true);
    expect(at.preOwnershipJawOpen).toBeGreaterThan(0.1);
    expect(at.idleShowcaseActive).toBe(false);
    expect(at.finalJawOpen).toBeCloseTo(at.preOwnershipJawOpen, 6);
    expect(at.actualJawOpenInfluence).toBeCloseTo(at.finalJawOpen, 6);
    expect(vowel!.faceJawOpen).toBeGreaterThan(0.1);
    expect(vowel!.teethJawOpen).toBeGreaterThan(0.1);

    // Whole-welcome health, read from the single DEV surface.
    expect(welcome.firstDivergence).toBeNull();
    expect(welcome.framesShowcaseActiveWhileAudible).toBe(0);
    expect(welcome.framesWithActivePhoneme).toBeGreaterThan(40);
    expect(welcome.framesWithActualGlbMouthMotion).toBeGreaterThanOrEqual(welcome.framesWithActivePhoneme);
    expect(Math.max(...audible.map((s) => s.faceJawOpen))).toBeGreaterThan(0.2);

    session.handle.dispose();
  }, 120_000);

  it("normal assistant speech after the welcome articulates identically", async () => {
    const session = await mountLiveSession();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    for (let i = 0; i < 30; i += 1) session.frame();

    const run = async (item: QueueItem) => {
      session.adapter.beginTurn();
      session.scheduler.resetForNewTurn();
      const done = session.schedule(item);
      session.scheduler.setTtsDoneReceived();
      await done;
      const audible = playOut(session);
      for (let i = 0; i < 60; i += 1) session.frame();
      return audible;
    };

    const welcome = await run({
      subtitle: "Hi, I'm Solace.",
      audio: wavSource(1.6),
      avatarData: backendAvatarData("Hi, I'm Solace."),
      avatarDataReceived: 0,
      prePermissionWelcome: true,
    });
    const welcomeTrace = { ...welcome[welcome.length - 1].diagnostics };

    const normal = await run({
      subtitle: "Hi, I'm Solace.",
      audio: wavSource(1.6),
      avatarData: backendAvatarData("Hi, I'm Solace."),
      avatarDataReceived: 0,
    });
    const normalTrace = normal[normal.length - 1].diagnostics.normalSpeech;

    // The welcome record is untouched by the later normal turn.
    expect(normal[normal.length - 1].diagnostics.firstDivergence).toBeNull();
    expect(normalTrace.isWelcome).toBe(false);
    expect(normalTrace.firstDivergence).toBeNull();
    expect(normalTrace.timelinePhonemeCount).toBe(welcomeTrace.timelinePhonemeCount);
    expect(normalTrace.framesWithActualGlbMouthMotion).toBeGreaterThan(40);

    const jawAt = (frames: Snapshot[], from: number, to: number) =>
      Math.max(...frames.filter((s) => s.responseClock > from && s.responseClock < to).map((s) => s.faceJawOpen));
    const welcomeVowel = jawAt(welcome, 0.65, 0.8);
    const normalVowel = jawAt(normal, 0.65, 0.8);
    expect(welcomeVowel).toBeGreaterThan(0.1);
    expect(normalVowel).toBeGreaterThan(0.1);
    // Same phonemes on the same clock: the two turns articulate the same vowel.
    expect(Math.abs(welcomeVowel - normalVowel)).toBeLessThan(0.05);

    session.handle.dispose();
  }, 120_000);
});

describe("idle showcase yield boundary", () => {
  it("a yielded or disabled showcase leaves speech mouth channels untouched", () => {
    const speech = { jawOpen: 0.31, mouthFunnel: 0.08, mouthPucker: 0.05, mouthLowerDownLeft: 0.2, mouthClose: 0.01 };
    expect(HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS).toContain("jawOpen");

    const enabled = createHyper3dIdleExpressionShowcaseRuntime({ enabled: true });
    enabled.sample({ eligible: true, elapsedSeconds: 0 });
    const yielded = enabled.sample({ eligible: false, elapsedSeconds: 7.5, yieldReason: "speaking" });
    expect(yielded.active).toBe(false);
    expect(applyHyper3dIdleShowcasePose(speech, yielded)).toEqual(speech);

    const disabled = createHyper3dIdleExpressionShowcaseRuntime({ enabled: false }).sample({
      eligible: true,
      elapsedSeconds: 7.5,
    });
    expect(applyHyper3dIdleShowcasePose(speech, disabled)).toEqual(speech);
  });

  it("an active showcase still owns its channels (recipes unchanged)", () => {
    const runtime = createHyper3dIdleExpressionShowcaseRuntime({ enabled: true });
    runtime.sample({ eligible: true, elapsedSeconds: 0 });
    const active = runtime.sample({ eligible: true, elapsedSeconds: 7.5 });
    expect(active.active).toBe(true);
    const applied = applyHyper3dIdleShowcasePose({ jawOpen: 0.31 }, active);
    expect(applied.jawOpen).toBe(active.pose.jawOpen);
  });
});
