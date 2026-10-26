import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";

/**
 * LIVE MULTI-CHUNK LIP-SYNC — the whole reply, not one phoneme.
 *
 * Real engine factory, real companion GLB, real live adapter, real
 * orchestrator. A five-sentence reply is appended PROGRESSIVELY while the
 * clock plays — the way `onChunkScheduled` fires in a session — and every frame
 * reads the influences physically on the face mesh.
 *
 * THE REGRESSION. A Talk It Out reply articulated for a moment and then held a
 * nearly closed mouth while the audio carried on. The controller kept
 * articulating; the frame was lost at the DEV idle showcase, which is enabled in
 * `.env.development` and gated only on the React `isSpeaking` flag. Whenever
 * that flag read false over audible speech, the showcase took the face and its
 * owned set deletes `jawOpen` and every mouth channel — measured here as
 * 563 of 652 phoneme-active frames writing a GLB mouth below 0.02.
 */

const PUBLIC_DIR = "public";
const ORIGIN = "http://localhost";
const originalFetch = globalThis.fetch;
const FRAME = 1 / 60;
const AUDIO_ORIGIN = 5;
const ASSET_ID = "hyper3d_arfv2";

function installPublicDirFetch() {
  THREE.DefaultLoadingManager.setURLModifier((url) => (url.startsWith("/") ? `${ORIGIN}${url}` : url));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) return new Response(null, { status: 404, statusText: "Not Found" });
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

/** Five sentences of connected speech, ARPAbet, 85 ms per label. */
const SENTENCES = [
  "HH AY1 AY1 HH IH1 R Y UW1 AH0 N D IH1 T S AW1 N D Z L AY1 K AH0 L AA1 T",
  "T UW1 K EH1 R IY0 R AY1 T N AW1 W AH1 T F EH1 L T M OW1 S T HH EH1 V IY0",
  "W EH1 N Y UW1 W OY1 K AH1 P DH IH1 S M AO1 R N IH0 NG B AH1 T P AA1 M AH0 N",
  "IH1 T S OW1 K EY1 T UW1 T EY1 K IH1 T S L OW1 L IY0 AA1 N D B R IY1 DH",
  "W IY1 K AE1 N W AA1 K TH R UW1 IH1 T T AH0 G EH1 DH ER0 W EH1 N EH1 V ER0",
].map((text) => text.split(" "));

const STEP = 0.085;
const CHUNKS = (() => {
  let start = AUDIO_ORIGIN;
  return SENTENCES.map((labels, index) => {
    const duration = labels.length * STEP;
    const chunk = {
      index,
      start,
      duration,
      phonemes: labels.map((label, i) => ({
        phoneme: label.replace(/\d/g, ""),
        rawPhoneme: label,
        start: i * STEP,
        end: (i + 1) * STEP,
      })),
    };
    start += duration;
    return chunk;
  });
})();
const REPLY_END = CHUNKS[CHUNKS.length - 1].start + CHUNKS[CHUNKS.length - 1].duration;

const MOUTH = [
  "jawOpen",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthFunnel",
  "mouthPucker",
] as const;

type Frame = {
  audio: number;
  phoneme: string | null;
  glb: Record<string, number>;
  glbMax: number;
  /** `mouthLowerDownDeep` on the mesh, or null when the asset has no such morph. */
  deep: number | null;
  /** What the controller was told this frame. */
  correctiveProfile: boolean;
};

/** Facts about the last loaded asset, read off the real mesh and path report. */
let lastRun: { assetUrl: string | null; faceMorphs: string[] } = { assetUrl: null, faceMorphs: [] };

async function playReply(options: {
  /** The asset id the seam hands the engine. Defaults to Sara Mitchell's. */
  assetId?: string;
  /** DEV `?hyper3dLowerLipV2=1`: switches the controller to the corrective profile. */
  correctiveFlag: boolean;
  /** `.env.development`'s VITE_HYPER3D_IDLE_EXPRESSION_SHOWCASE. */
  showcase: boolean;
  /** Response time from which the conversation flag reads false while audio plays. */
  speakingFalseFrom?: number;
}): Promise<Frame[]> {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (options.showcase) vi.stubEnv("VITE_HYPER3D_IDLE_EXPRESSION_SHOWCASE", "true");
  if (options.correctiveFlag) window.localStorage.setItem("hyper3dLowerLipV2", "1");
  else window.localStorage.removeItem("hyper3dLowerLipV2");

  const { createHyper3dEngineFactory } = await import("./hyper3dEngineFactory");
  const { hyper3dLiveInputsFromAdapter } = await import("./hyper3dLiveEngineBinding");
  const { createHyper3dLiveSpeechAdapter } = await import("./hyper3dLiveSpeechAdapter");
  const { AvatarController } = await import("./engine/engine/avatar/AvatarController");
  const { getHyper3dPathReport } = await import("./hyper3dPathDiagnostics");
  let correctiveProfile = false;
  const realEvaluate = AvatarController.prototype.evaluate;
  vi.spyOn(AvatarController.prototype, "evaluate").mockImplementation(function (
    this: InstanceType<typeof AvatarController>,
    ...args: Parameters<typeof realEvaluate>
  ) {
    correctiveProfile = args[2]?.correctiveLowerLip === true;
    return realEvaluate.apply(this, args);
  });

  let contextTime = AUDIO_ORIGIN - 0.2;
  const adapter = createHyper3dLiveSpeechAdapter({
    getContextTime: () => contextTime,
    isPipelineActive: () => contextTime < REPLY_END + 0.05,
  });
  adapter.beginTurn();
  const appended = new Set<number>();
  const appendDue = () => {
    for (const chunk of CHUNKS) {
      // Committed while the previous chunk is still playing, as the scheduler does.
      if (appended.has(chunk.index) || contextTime < chunk.start - 0.6) continue;
      appended.add(chunk.index);
      adapter.onChunkScheduled({
        audioContextStartTime: chunk.start,
        durationMs: chunk.duration * 1000,
        leadInSec: 0,
        chunkIndex: chunk.index,
        sentence: `sentence ${chunk.index}`,
        scheduledAtMs: 0,
        associationMethod: "bundled",
        timeline: {
          sentence: `sentence ${chunk.index}`,
          sentiment: null,
          phonemeFormat: "timestamped",
          phonemes: chunk.phonemes,
        },
      });
    }
  };
  appendDue();

  const scene = new THREE.Scene();
  const handle = await createHyper3dEngineFactory(hyper3dLiveInputsFromAdapter(adapter))({
    scene,
    camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100),
    renderer: {
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
    } as unknown as THREE.WebGLRenderer,
    signal: new AbortController().signal,
    assetId: (options.assetId ?? ASSET_ID) as never,
  });

  let face: THREE.Mesh | null = null;
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!face && mesh.morphTargetDictionary?.jawOpen !== undefined) face = mesh;
  });
  const faceMesh = face as THREE.Mesh | null;
  expect(faceMesh, "face mesh with jawOpen").not.toBeNull();
  const dictionary = faceMesh!.morphTargetDictionary!;
  const influences = faceMesh!.morphTargetInfluences!;
  const deepIndex = dictionary.mouthLowerDownDeep;
  lastRun = { assetUrl: getHyper3dPathReport().assetUrl ?? null, faceMorphs: Object.keys(dictionary) };

  const frames: Frame[] = [];
  let frame = 0;
  while (contextTime < REPLY_END) {
    appendDue();
    const audio = adapter.getPlaybackTime();
    const audible = contextTime >= AUDIO_ORIGIN;
    const isSpeaking = audible && !(options.speakingFalseFrom !== undefined && audio >= options.speakingFalseFrom);
    handle.update({
      timeSeconds: audio,
      deltaSeconds: FRAME,
      elapsedSeconds: frame * FRAME,
      conversation: { isSpeaking, isListening: false, isThinking: false },
      audioLevel: 0,
    });
    if (audible) {
      const glb: Record<string, number> = {};
      let glbMax = 0;
      for (const name of MOUTH) {
        glb[name] = influences[dictionary[name]] ?? 0;
        glbMax = Math.max(glbMax, glb[name]);
      }
      const active = adapter.getPayload().phonemes.find((p) => audio >= p.start_time && audio < p.end_time);
      frames.push({
        audio,
        phoneme: active?.phoneme ?? null,
        glb,
        glbMax,
        deep: deepIndex === undefined ? null : influences[deepIndex],
        correctiveProfile,
      });
    }
    contextTime += FRAME;
    frame += 1;
  }
  handle.dispose();
  return frames;
}

/** Audible 250 ms windows whose GLB mouth never opened while phonemes were active. */
const closedWindows = (frames: Frame[]) => {
  const closed: number[] = [];
  for (let from = 0; from < REPLY_END - AUDIO_ORIGIN; from += 0.25) {
    const inWindow = frames.filter((f) => f.phoneme && f.audio >= from && f.audio < from + 0.25);
    if (inWindow.length > 0 && Math.max(...inWindow.map((f) => f.glbMax)) < 0.05) closed.push(+from.toFixed(2));
  }
  return closed;
};

describe("hyper3d live multi-chunk lip-sync", () => {
  beforeAll(() => installPublicDirFetch());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.localStorage.removeItem("hyper3dLowerLipV2");
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
    THREE.DefaultLoadingManager.setURLModifier(undefined as never);
  });

  it("articulates through every chunk of a progressively appended reply", async () => {
    const frames = await playReply({ correctiveFlag: false, showcase: false });
    expect(closedWindows(frames)).toEqual([]);
    // Every chunk, not just the first, reaches the mesh.
    for (const chunk of CHUNKS) {
      const local = frames.filter((f) => f.audio >= chunk.start - AUDIO_ORIGIN && f.audio < chunk.start - AUDIO_ORIGIN + chunk.duration);
      expect(Math.max(...local.map((f) => f.glb.jawOpen)), `chunk ${chunk.index} jaw`).toBeGreaterThan(0.1);
    }
  }, 120_000);

  /**
   * The corrective flag is NOT the cause. With a companion asset loaded — which
   * is what Talk It Out always loads — the corrective channel has no morph to
   * reach, and every speech weight on the mesh is identical with the flag on.
   */
  it("the lower-lip V2 flag leaves every written speech weight unchanged", async () => {
    const off = await playReply({ correctiveFlag: false, showcase: false });
    const on = await playReply({ correctiveFlag: true, showcase: false });
    expect(on.length).toBe(off.length);
    let maxDiff = 0;
    for (let i = 0; i < off.length; i += 1) {
      for (const name of MOUTH) maxDiff = Math.max(maxDiff, Math.abs(on[i].glb[name] - off[i].glb[name]));
    }
    expect(maxDiff).toBe(0);
  }, 240_000);

  /**
   * ASSET AND PROFILE TOGETHER. The experimental id loads its own file — not
   * female_2291 — with 52 face morphs, and only then does the controller run
   * the corrective profile; the 51 original morphs keep articulating through
   * the whole reply, and the corrective morph moves on the open vowels.
   */
  it("the experimental asset loads its own GLB and drives mouthLowerDownDeep", async () => {
    const frames = await playReply({ assetId: "female_2291_lowerlip_v2", correctiveFlag: true, showcase: false });
    expect(lastRun.assetUrl).toBe("/avatars/experimental/female_2291-lowerlip-v2.glb");
    expect(lastRun.faceMorphs).toHaveLength(52);
    expect(lastRun.faceMorphs).toContain("mouthLowerDownDeep");
    expect(frames.every((f) => f.correctiveProfile)).toBe(true);
    expect(closedWindows(frames)).toEqual([]);
    for (const vowel of ["AA", "AH", "AE"]) {
      const peak = Math.max(...frames.filter((f) => f.phoneme === vowel).map((f) => f.deep ?? 0));
      expect(peak, `${vowel} corrective weight`).toBeGreaterThan(0.05);
    }
    // Bilabial safety: no correction rendered inside a closure.
    const inClosure = frames.filter((f) => f.phoneme === "P" || f.phoneme === "B" || f.phoneme === "M");
    expect(inClosure.length).toBeGreaterThan(0);
    expect(Math.max(...inClosure.map((f) => f.deep ?? 0))).toBe(0);
  }, 120_000);

  it("a companion GLB never runs the corrective profile, even with the flag set", async () => {
    const frames = await playReply({ correctiveFlag: true, showcase: false });
    expect(lastRun.assetUrl).toBe("/avatars/hyper3d/arfv2.glb");
    expect(lastRun.faceMorphs).not.toContain("mouthLowerDownDeep");
    expect(frames.some((f) => f.correctiveProfile)).toBe(false);
  }, 120_000);

  /**
   * THE REGRESSION. The DEV idle showcase must yield while the controller is
   * articulating, even when the React speaking flag has gone false over audible
   * speech. Before the fix every window from 1.5 s on wrote a closed mouth.
   */
  it("the idle showcase cannot close the mouth over audible speech", async () => {
    const frames = await playReply({ correctiveFlag: false, showcase: true, speakingFalseFrom: 1.5 });
    expect(closedWindows(frames)).toEqual([]);
    const afterDrop = frames.filter((f) => f.phoneme && f.audio >= 1.5);
    const stillMoving = afterDrop.filter((f) => f.glbMax >= 0.02).length;
    expect(stillMoving / afterDrop.length).toBeGreaterThan(0.95);
  }, 120_000);
});
