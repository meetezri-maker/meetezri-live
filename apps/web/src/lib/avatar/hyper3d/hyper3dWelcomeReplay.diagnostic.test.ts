import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { createHyper3dEngineFactory } from "./hyper3dEngineFactory";
import { hyper3dLiveInputsFromAdapter } from "./hyper3dLiveEngineBinding";
import {
  createHyper3dLiveSpeechAdapter,
  type Hyper3dFullFrameCapture,
  type Hyper3dWelcomeLipSyncDiagnostics,
} from "./hyper3dLiveSpeechAdapter";
import {
  analyzeFullFrameCapture,
  comparePhonemePeaks,
  parseAcceptedVowelJawPeaks,
} from "./hyper3dFrameCaptureAnalysis";

/**
 * PHASE 2G.1 — DETERMINISTIC 60 FPS REPLAY OF A LIVE CAPTURE. DIAGNOSTIC TOOL.
 *
 * Skipped unless `HYPER3D_WELCOME_CAPTURE` points at the JSON copied from
 * DevTools. For each captured turn (welcome / normal) it replays the EXACT
 * captured payload — same backend phonemes, same scheduler start, duration and
 * leadInSec, no retiming, no calibration change — through the real adapter,
 * the real engine factory, the real frame orchestrator and female_2291.glb, at
 * exactly 1/60 s per frame. Both captures are then analysed by the same module.
 *
 * Known replay difference, reported not hidden: no decoded AudioBuffer exists
 * offline, so the acoustic track (head-plan input) is empty. Jaw articulation is
 * driven by the phoneme timeline, not by acoustics.
 *
 * Output: `/tmp/hyper3d-welcome-replay-report.json` (override with
 * `HYPER3D_WELCOME_REPORT`).
 */

const CAPTURE_PATH = process.env.HYPER3D_WELCOME_CAPTURE;
const REPORT_PATH = process.env.HYPER3D_WELCOME_REPORT ?? "/tmp/hyper3d-welcome-replay-report.json";
const ACCEPTED_DOC = "/home/marqlinux/avatar-test/docs/hyper3d-target-face-vowel-convergence.md";
const PUBLIC_DIR = "public";
const ORIGIN = "http://localhost";
const FRAME = 1 / 60;

function installPublicDirFetch() {
  THREE.DefaultLoadingManager.setURLModifier((url) => (url.startsWith("/") ? `${ORIGIN}${url}` : url));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) return new Response(null, { status: 404 });
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

/** Accepts the DevTools wrapper `{ welcome|lipsync, trace }` or the bare diagnostics object. */
function loadCaptures(path: string): Hyper3dWelcomeLipSyncDiagnostics["fullFrame"] {
  const json = JSON.parse(readFileSync(path, "utf8"));
  const diagnostics = json.lipsync ?? json.welcome ?? json;
  if (!diagnostics?.fullFrame) throw new Error("capture has no fullFrame section — was it taken with the Phase 2G.1 build?");
  return diagnostics.fullFrame;
}

async function replay(live: Hyper3dFullFrameCapture): Promise<Hyper3dFullFrameCapture> {
  let contextTime: number | null = null;
  const adapter = createHyper3dLiveSpeechAdapter({
    getContextTime: () => contextTime,
    isPipelineActive: () => true,
  });
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
  });

  const first = live.chunks[0];
  const last = live.chunks[live.chunks.length - 1];
  let elapsed = 0;
  const frame = (speaking: boolean) => {
    elapsed += FRAME;
    handle.update({
      timeSeconds: adapter.getPlaybackTime(),
      deltaSeconds: FRAME,
      elapsedSeconds: elapsed,
      conversation: { isSpeaking: speaking, isListening: false, isThinking: false },
      audioLevel: 0,
    });
  };

  contextTime = first.audioContextStartTime - 1;
  for (let i = 0; i < 30; i += 1) {
    contextTime += FRAME;
    frame(false);
  }
  adapter.beginTurn();
  adapter.setStatus("ready");
  for (const chunk of live.chunks) {
    adapter.onChunkScheduled({
      audioContextStartTime: chunk.audioContextStartTime,
      durationMs: chunk.durationMs,
      leadInSec: chunk.leadInSec,
      timeline: chunk.backendPhonemes.length
        ? {
            sentence: chunk.sentence,
            sentiment: null,
            phonemeFormat: "timestamped",
            phonemes: chunk.backendPhonemes.map((p) => ({
              phoneme: p.phoneme,
              rawPhoneme: p.rawPhoneme ?? p.phoneme,
              start: p.start,
              ...(p.end !== null ? { end: p.end } : {}),
            })),
          }
        : null,
      rawAvatarDataPresent: chunk.backendPhonemeCount > 0,
      rawPhonemeFormat: chunk.rawPhonemeFormat,
      untimedPhonemeCount: 0,
      chunkIndex: chunk.chunkIndex,
      sentence: chunk.sentence,
      scheduledAtMs: 0,
      audioBuffer: null,
      isWelcome: live.kind === "welcome",
      associationMethod: chunk.associationMethod,
      audioB64Present: chunk.audioB64Present ?? false,
    });
  }
  adapter.setStatus("playing");
  // Deterministic clock: exactly one 1/60 s step per frame, start to end.
  contextTime = first.audioContextStartTime - FRAME;
  const end = last.expectedAudibleEndContextTime + 0.1;
  while (contextTime < end) {
    contextTime += FRAME;
    frame(contextTime >= first.audioContextStartTime);
  }
  const captured = (window as unknown as { __solaceHyper3dWelcomeLipSync: Hyper3dWelcomeLipSyncDiagnostics })
    .__solaceHyper3dWelcomeLipSync.fullFrame[live.kind];
  adapter.cancel("replay_complete");
  handle.dispose();
  if (!captured) throw new Error("replay produced no capture");
  return JSON.parse(JSON.stringify(captured));
}

describe.skipIf(!CAPTURE_PATH)("Phase 2G.1 live vs 60 fps replay (diagnostic)", () => {
  const originalFetch = globalThis.fetch;
  beforeAll(() => installPublicDirFetch());
  afterAll(() => {
    globalThis.fetch = originalFetch;
    THREE.DefaultLoadingManager.setURLModifier(undefined as never);
  });

  it("replays each captured turn at 1/60 s and writes the comparison report", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const captures = loadCaptures(CAPTURE_PATH!);
    const accepted = existsSync(ACCEPTED_DOC) ? parseAcceptedVowelJawPeaks(readFileSync(ACCEPTED_DOC, "utf8")) : null;
    const report: Record<string, unknown> = {
      capturePath: CAPTURE_PATH,
      acceptedSource: accepted ? ACCEPTED_DOC : "unavailable",
      acceptedVowelJawPeaks: accepted,
      replayNote: "offline replay has no decoded AudioBuffer: acoustic track empty (head-plan input only)",
    };
    for (const kind of ["welcome", "normal"] as const) {
      const live = captures[kind];
      if (!live || !live.chunks.length) {
        report[kind] = "not captured";
        continue;
      }
      const offline = await replay(live);
      const liveAnalysis = analyzeFullFrameCapture(live);
      const replayAnalysis = analyzeFullFrameCapture(offline);
      const perPhoneme = comparePhonemePeaks(liveAnalysis, replayAnalysis);
      const vowels = accepted
        ? Object.entries(accepted).map(([vowel, acceptedPeak]) => {
            const rows = perPhoneme.filter((row) => row.phoneme === vowel);
            return {
              vowel,
              acceptedPeak,
              occurrences: rows.length,
              liveGlbJawPeaks: rows.map((row) => row.liveGlbJaw),
              replayGlbJawPeaks: rows.map((row) => row.replayGlbJaw),
            };
          }).filter((row) => row.occurrences > 0)
        : [];
      report[kind] = {
        viewport: live.viewport,
        live: liveAnalysis,
        replay60fps: replayAnalysis,
        perPhoneme,
        acceptedVowelComparison: vowels,
      };
      expect(replayAnalysis.frames.count).toBeGreaterThan(0);
    }
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`[2G.1] replay report written to ${REPORT_PATH}`);
  }, 600_000);
});
