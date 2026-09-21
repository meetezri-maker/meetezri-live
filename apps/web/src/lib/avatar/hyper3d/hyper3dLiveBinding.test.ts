import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import * as THREE from "three";
import { createHyper3dEngineFactory } from "./hyper3dEngineFactory";
import {
  hyper3dLiveInputsFromAdapter,
  registerHyper3dLiveEngine,
} from "./hyper3dLiveEngineBinding";
import {
  __resetHyper3dEngineFactoryForTests,
  getHyper3dEngineFactory,
  getHyper3dPlaybackClock,
} from "./hyper3dEngineRegistry";
import { createHyper3dLiveSpeechAdapter } from "./hyper3dLiveSpeechAdapter";
import {
  __resetHyper3dPathForTests,
  getHyper3dPathReport,
} from "./hyper3dPathDiagnostics";
import {
  HYPER3D_GLB_URL,
  HYPER3D_LEGACY_GLB_URL,
} from "./engine/mappings/avatars/hyper3dAssetSelection";

/**
 * LIVE BINDING — the real factory, the real asset, the real adapter.
 *
 * `staticEquivalence.test.ts` proves the COMMANDS are the accepted ones. It
 * deliberately stops short of the GLB, because it does not need it. This test
 * covers the other half — the seam that actually has to work before anything
 * appears on screen:
 *
 *   the live adapter -> `Hyper3dLiveInputs` -> the registered factory
 *   -> `/avatars/female_2291.glb` -> parse -> morph / bone / eye / teeth
 *   validation -> materials -> controller init -> one evaluated frame
 *
 * It runs the production asset through the production factory, so a broken
 * binding fails HERE rather than as a silent fallback to the old avatar in a
 * live session.
 *
 * `fetch` is served from the `public/` directory, which is exactly what the dev
 * server does for these URLs. Nothing else is stubbed on the engine side.
 */

const PUBLIC_DIR = "public";
const ASSETS = [
  HYPER3D_GLB_URL,
  HYPER3D_LEGACY_GLB_URL,
  "/avatars/hyper3d/USCBasicPack/texture_diffuse_evened.png",
  "/avatars/hyper3d/USCBasicPack/texture_diffuse.png",
  "/avatars/hyper3d/USCBasicPack/texture_normal.png",
  "/avatars/hyper3d/USCBasicPack/hair_o_dense.png",
] as const;

const ORIGIN = "http://localhost";
const originalFetch = globalThis.fetch;

/**
 * Serves `/avatars/...` from `public/avatars/...`, as the dev server does.
 *
 * Two pieces, because node is stricter than a browser about relative URLs: the
 * loading manager makes the engine's root-relative URLs absolute (a browser gets
 * that from the document origin for free, and node's `fetch` throws without it),
 * and the fetch stub then reads the file the dev server would have served.
 */
function installPublicDirFetch() {
  /**
   * EXPECTED NOISE, left alone deliberately.
   *
   * jsdom has no `URL.createObjectURL`, so GLTFLoader logs
   * "Couldn't load texture" for each of the GLB's own embedded images and
   * carries on. That is cosmetic here: this test exercises the BINDING gates —
   * meshes, morphs, bones, eyes, teeth, materials — none of which read decoded
   * pixels.
   *
   * Do not "fix" it by stubbing `createObjectURL`: that was tried, and it makes
   * GLTFLoader wait on an `Image` jsdom will never decode, so the test hangs
   * until the timeout instead of finishing in ~300 ms.
   */
  THREE.DefaultLoadingManager.setURLModifier((url) =>
    url.startsWith("/") ? `${ORIGIN}${url}` : url,
  );
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) {
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

describe("hyper3d live binding", () => {
  beforeAll(() => installPublicDirFetch());
  afterAll(() => {
    globalThis.fetch = originalFetch;
    THREE.DefaultLoadingManager.setURLModifier(undefined as never);
  });

  it("serves every asset the engine asks for", () => {
    for (const asset of ASSETS) {
      const onDisk = `${PUBLIC_DIR}${asset}`;
      expect(existsSync(onDisk), `${asset} is missing from ${PUBLIC_DIR}`).toBe(true);
      expect(readFileSync(onDisk).byteLength, `${asset} is empty`).toBeGreaterThan(0);
    }
  });

  /**
   * THE GAP THIS PASS CLOSED. `hyper3dEngineFactory.ts` existed and was correct,
   * but nothing in the application ever called `registerHyper3dEngineFactory`,
   * so `getHyper3dEngineFactory()` returned null, the host reported
   * `engine-missing`, and the seam kept the old avatar — with the flag on and
   * the asset present. A file existing is not a wired seam.
   */
  it("registers the engine factory with the registry", () => {
    __resetHyper3dEngineFactoryForTests();
    expect(getHyper3dEngineFactory()).toBeNull();

    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 0,
      isPipelineActive: () => false,
    });
    registerHyper3dLiveEngine(adapter);

    expect(getHyper3dEngineFactory()).toBeTypeOf("function");
    expect(getHyper3dPathReport().factoryRegistered).toBe(true);
  });

  it("registers the continuous response clock instead of the legacy chunk-local ref", () => {
    let contextTime = 10;
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => true,
    });
    adapter.beginTurn();
    for (const [index, start] of [[0, 10], [1, 11]] as const) {
      adapter.onChunkScheduled({
        audioContextStartTime: start,
        durationMs: 1000,
        leadInSec: 0,
        chunkIndex: index,
        sentence: "One sentence over two chunks.",
        scheduledAtMs: 0,
        timeline: {
          sentence: "One sentence over two chunks.",
          sentiment: null,
          phonemeFormat: "timestamped",
          phonemes: [{ phoneme: index ? "IY" : "AA", start: 0, end: 0.5 }],
        },
      });
    }
    registerHyper3dLiveEngine(adapter);
    contextTime = 11.25;

    expect(getHyper3dPlaybackClock()?.()).toBeCloseTo(1.25, 6);
    // The old ref would be 11.25 - chunk2.start(11) = 0.25.
    expect(getHyper3dPlaybackClock()?.()).not.toBeCloseTo(0.25, 6);
  });

  it("derives a re-plan signal from the live adapter without allocating", () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 0,
      isPipelineActive: () => false,
    });
    const live = hyper3dLiveInputsFromAdapter(adapter);

    const first = live.getRevision();
    // A quiet frame must NOT re-plan: same payload identity, same frame count.
    expect(live.getRevision()).toBe(first);
    expect(live.getRevision()).toBe(first);

    // A new turn rebuilds the payload, so the engine has to re-plan.
    adapter.beginTurn();
    const afterTurn = live.getRevision();
    expect(afterTurn).toBeGreaterThan(first);
    expect(live.getRevision()).toBe(afterTurn);
  });

  it("loads female_2291, passes every binding gate, and evaluates a frame", async () => {
    __resetHyper3dPathForTests();
    let contextTime = 0;

    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => false,
    });
    adapter.beginTurn();
    adapter.onChunkScheduled({
      audioContextStartTime: 1,
      durationMs: 1000,
      leadInSec: 0,
      chunkIndex: 0,
      sentence: "Production planner consumption.",
      scheduledAtMs: 0,
      timeline: {
        sentence: "Production planner consumption.",
        sentiment: null,
        phonemeFormat: "timestamped",
        phonemes: [
          { phoneme: "P", rawPhoneme: "P", start: 0, end: 0.15 },
          { phoneme: "R", rawPhoneme: "R", start: 0.15, end: 0.35 },
          { phoneme: "AH", rawPhoneme: "AH", start: 0.35, end: 0.65 },
        ],
      },
    });
    adapter.onChunkScheduled({
      audioContextStartTime: 2,
      durationMs: 1000,
      leadInSec: 0,
      chunkIndex: 1,
      sentence: "Second scheduled sentence.",
      scheduledAtMs: 0,
      timeline: {
        sentence: "Second scheduled sentence.",
        sentiment: null,
        phonemeFormat: "timestamped",
        phonemes: [
          { phoneme: "IY1", rawPhoneme: "IY1", start: 0.1, end: 0.4 },
        ],
      },
    });
    contextTime = 2.2;

    const factory = createHyper3dEngineFactory(hyper3dLiveInputsFromAdapter(adapter));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    // jsdom has no WebGL, and the binding path never draws — it only reads the
    // renderer's colour-management properties, which are plain fields.
    const renderer = {
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
    } as unknown as THREE.WebGLRenderer;

    const handle = await factory({
      scene,
      camera,
      renderer,
      signal: new AbortController().signal,
    });

    const report = getHyper3dPathReport();
    expect(report.productionAssetAttempted).toBe(true);
    expect(report.productionAssetLoaded, "female_2291 must load — the legacy asset is a fallback, not the target").toBe(true);
    expect(report.legacyAssetAttempted, "the legacy asset must not be reached").toBe(false);
    expect(report.assetUrl).toBe(HYPER3D_GLB_URL);
    expect(report.validationPassed).toBe(true);
    expect(report.failedPhase).toBeNull();

    // One frame through the accepted orchestrator, exactly as the host drives it.
    expect(() =>
      handle.update({
        timeSeconds: 1.2,
        deltaSeconds: 1 / 60,
        elapsedSeconds: 0,
        conversation: { isSpeaking: false, isListening: false, isThinking: false },
        audioLevel: 0,
      }),
    ).not.toThrow();
    // Regression: the host boundary supplies 2.2 - 1.0 = 1.2 from the
    // registered continuous adapter clock, so chunk two remains response-relative.
    expect(adapter.getDiagnostics().sentencePlanning.activeSentenceIndex).toBe(1);
    expect(adapter.getDiagnostics().sentencePlanning.activePlanRevision).toBe(1);
    const review = adapter.getLiveReview();
    expect(review.avatarEvaluationTime).toBeCloseTo(1.2, 6);
    expect(review.audioPlaybackTime).toBeCloseTo(1.2, 6);
    expect(review.clockDriftMs).toBeCloseTo(0, 6);
    expect(review.currentPhoneme).toBe("IY");
    expect(review.chunkIndex).toBe(1);
    expect(review.sentenceLocalTime).toBeCloseTo(0.2, 6);
    expect(review.samples).toHaveLength(1);
    expect(review.samples[0].hostFrameTime).toBeCloseTo(1.2, 6);
    expect(review.samples[0].timelineCursorTime).toBeCloseTo(1.2, 6);
    expect(review.samples[0].finalGlb.faceJawOpen).not.toBeNull();
    expect(review.samples[0].finalGlb.teethJawOpen).not.toBeNull();
    expect(review.samples[0].finalGlb.jawBoneRotation).toBeNull();
    expect(review.sentenceAudit?.startEndUnits).toBe("seconds");
    expect(review.sentenceAudit?.first20RawLabels).toEqual(["IY1"]);
    expect(review.sentenceAudit?.first20NormalizedLabels).toEqual(["IY"]);

    handle.dispose();
    // Disposal must be idempotent: the host calls it on teardown AND after a
    // late-resolving init when the stage has already gone.
    expect(() => handle.dispose()).not.toThrow();
  }, 120_000);
});
