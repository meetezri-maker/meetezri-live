import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { avatarModelConfigs, resolveMorphBindings } from "./engine/mappings/avatarModelConfig";
import { MorphTargetController } from "./engine/engine/avatar/MorphTargetController";
import { HYPER3D_GLB_URL } from "./engine/mappings/avatars/hyper3dAssetSelection";
import {
  HYPER3D_IDLE_EXPRESSION_SHOWCASE_FLAG,
  HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK,
  HYPER3D_IDLE_SHOWCASE_DEFINITIONS,
  HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS,
  HYPER3D_IDLE_SHOWCASE_REQUIRED_EXPRESSIONS,
  applyHyper3dIdleShowcasePose,
  createHyper3dIdleExpressionShowcaseRuntime,
  getHyper3dIdleShowcaseDefinition,
  isHyper3dIdleExpressionShowcaseEnabled,
  publishHyper3dIdleShowcaseDiagnostics,
  type Hyper3dIdleShowcaseExpressionId,
} from "./hyper3dIdleExpressionShowcase";
import type { BlendshapePose } from "./engine/types/facialAnimation";

const CONFIG = avatarModelConfigs["hyper3d-usc"];
const PUBLIC_DIR = "public";
const ORIGIN = "http://localhost";
const originalFetch = globalThis.fetch;

function installPublicDirFetch() {
  THREE.DefaultLoadingManager.setURLModifier((url) =>
    url.startsWith("/") ? `${ORIGIN}${url}` : url,
  );
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const onDisk = `${PUBLIC_DIR}${decodeURIComponent(path)}`;
    if (!existsSync(onDisk)) return new Response(null, { status: 404, statusText: "Not Found" });
    return new Response(readFileSync(onDisk), { status: 200 });
  }) as typeof fetch;
}

async function loadProductionScene(): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return await new Promise((resolve, reject) => {
    loader.load(HYPER3D_GLB_URL, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function sampleAt(seconds: number) {
  const runtime = createHyper3dIdleExpressionShowcaseRuntime({ enabled: true });
  runtime.sample({ eligible: true, elapsedSeconds: 0 });
  return runtime.sample({ eligible: true, elapsedSeconds: seconds });
}

function maxAbsDelta(left: BlendshapePose, right: BlendshapePose) {
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  let max = 0;
  for (const name of names) max = Math.max(max, Math.abs((left[name] ?? 0) - (right[name] ?? 0)));
  return max;
}
function poseDistance(left: BlendshapePose, right: BlendshapePose) {
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  let total = 0;
  for (const name of names) total += Math.abs((left[name] ?? 0) - (right[name] ?? 0));
  return total;
}

const FROZEN_EXPRESSION_BASELINE: Record<string, { pose: BlendshapePose; primary: Array<{ name: string; target: number }> }> = {
  neutral: { pose: {}, primary: [] },
  smile: {
    pose: {
      mouthSmileLeft: 0.84,
      mouthSmileRight: 0.84,
      cheekSquintLeft: 0.36,
      cheekSquintRight: 0.36,
      eyeSquintLeft: 0.16,
      eyeSquintRight: 0.16,
    },
    primary: [
      { name: "mouthSmileLeft", target: 0.84 },
      { name: "mouthSmileRight", target: 0.84 },
    ],
  },
  happy: {
    pose: {
      mouthSmileLeft: 0.82,
      mouthSmileRight: 0.82,
      cheekSquintLeft: 0.42,
      cheekSquintRight: 0.42,
      eyeSquintLeft: 0.14,
      eyeSquintRight: 0.14,
      browOuterUpLeft: 0.16,
      browOuterUpRight: 0.16,
    },
    primary: [
      { name: "mouthSmileLeft", target: 0.82 },
      { name: "mouthSmileRight", target: 0.82 },
    ],
  },
  surprise: {
    pose: {
      eyeWideLeft: 0.86,
      eyeWideRight: 0.86,
      browOuterUpLeft: 0.72,
      browOuterUpRight: 0.72,
      browInnerUp: 0.54,
      jawOpen: 0.42,
      mouthFunnel: 0.26,
    },
    primary: [
      { name: "eyeWideLeft", target: 0.86 },
      { name: "eyeWideRight", target: 0.86 },
    ],
  },
  curious: {
    pose: {
      browOuterUpLeft: 0.86,
      browOuterUpRight: 0.32,
      browInnerUp: 0.42,
      eyeWideLeft: 0.28,
      eyeWideRight: 0.12,
      mouthPucker: 0.16,
      mouthPressRight: 0.18,
    },
    primary: [{ name: "browOuterUpLeft", target: 0.86 }],
  },
  thinking: {
    pose: {
      mouthPressLeft: 0.82,
      mouthPressRight: 0.82,
      browOuterUpLeft: 0.34,
      browInnerUp: 0.18,
      eyeSquintLeft: 0.18,
      eyeSquintRight: 0.18,
      mouthPucker: 0.2,
    },
    primary: [
      { name: "mouthPressLeft", target: 0.82 },
      { name: "mouthPressRight", target: 0.82 },
    ],
  },
  concerned: {
    pose: {
      browInnerUp: 0.84,
      mouthFrownLeft: 0.38,
      mouthFrownRight: 0.38,
      mouthPressLeft: 0.22,
      mouthPressRight: 0.22,
      eyeSquintLeft: 0.14,
      eyeSquintRight: 0.14,
    },
    primary: [{ name: "browInnerUp", target: 0.84 }],
  },
  sad: {
    pose: {
      mouthFrownLeft: 0.84,
      mouthFrownRight: 0.84,
      browInnerUp: 0.56,
      eyeSquintLeft: 0.18,
      eyeSquintRight: 0.18,
      mouthShrugLower: 0.2,
    },
    primary: [
      { name: "mouthFrownLeft", target: 0.84 },
      { name: "mouthFrownRight", target: 0.84 },
    ],
  },
  return_to_neutral: { pose: {}, primary: [] },
};

describe("Hyper3D idle expression showcase", () => {
  it("keeps the temporary showcase flag default-off and production-safe", () => {
    expect(HYPER3D_IDLE_EXPRESSION_SHOWCASE_FLAG).toBe("VITE_HYPER3D_IDLE_EXPRESSION_SHOWCASE");
    expect(isHyper3dIdleExpressionShowcaseEnabled()).toBe(false);
  });

  it("does not run while disabled", () => {
    const runtime = createHyper3dIdleExpressionShowcaseRuntime({ enabled: false });
    const sample = runtime.sample({ eligible: true, elapsedSeconds: 7.5 });

    expect(sample.active).toBe(false);
    expect(sample.pose).toEqual({});
    expect(sample.diagnostics.enabled).toBe(false);
    expect(sample.diagnostics.lastYieldReason).toBe("disabled");
  });

  it("uses the exact 60-second expression order and five-second windows", () => {
    const expected: Hyper3dIdleShowcaseExpressionId[] = [
      "neutral",
      "smile",
      "laugh",
      "happy",
      "surprise",
      "curious",
      "thinking",
      "concerned",
      "sad",
      "angry",
      "playful",
      "return_to_neutral",
    ];
    expect(HYPER3D_IDLE_SHOWCASE_DEFINITIONS.map((definition) => definition.id)).toEqual(expected);

    for (let index = 0; index < expected.length; index += 1) {
      const sample = sampleAt(index * 5 + 2.5);
      expect(sample.diagnostics.currentExpression).toBe(expected[index]);
      expect(sample.diagnostics.cycleTimeSeconds).toBeCloseTo(index * 5 + 2.5, 6);
      expect(sample.diagnostics.phase).toBe("hold");
    }
  });

  it("is deterministic over loops without drift", () => {
    const first = sampleAt(7.5);
    const looped = sampleAt(67.5);

    expect(looped.diagnostics.currentExpression).toBe("smile");
    expect(looped.diagnostics.cycleNumber).toBe(1);
    expect(looped.pose).toEqual(first.pose);
    expect(looped.diagnostics.cycleTimeSeconds).toBeCloseTo(first.diagnostics.cycleTimeSeconds, 6);
  });
  it("keeps every approved frozen expression recipe value unchanged", () => {
    for (const [id, expected] of Object.entries(FROZEN_EXPRESSION_BASELINE)) {
      const definition = getHyper3dIdleShowcaseDefinition(id as Hyper3dIdleShowcaseExpressionId);
      expect(definition.pose, `${id} pose`).toEqual(expected.pose);
      expect(definition.primary, `${id} primary`).toEqual(expected.primary);
    }
  });

  it("smoothly enters, holds, and releases each five-second section", () => {
    const earlySmile = sampleAt(5.25);
    const peakSmile = sampleAt(7.5);
    const lateSmile = sampleAt(9.75);
    const nextBoundary = sampleAt(10);

    expect(earlySmile.diagnostics.phase).toBe("entry");
    expect(peakSmile.diagnostics.phase).toBe("hold");
    expect(lateSmile.diagnostics.phase).toBe("release");
    expect(earlySmile.pose.mouthSmileLeft ?? 0).toBeGreaterThan(0);
    expect(earlySmile.pose.mouthSmileLeft ?? 0).toBeLessThan(peakSmile.pose.mouthSmileLeft ?? 0);
    expect(lateSmile.pose.mouthSmileLeft ?? 0).toBeLessThan(peakSmile.pose.mouthSmileLeft ?? 0);
    expect(maxAbsDelta(sampleAt(9.99).pose, nextBoundary.pose)).toBeLessThan(0.01);
  });

  it("reaches at least 0.80 on every expression's defining shape keys", () => {
    for (const id of HYPER3D_IDLE_SHOWCASE_REQUIRED_EXPRESSIONS) {
      const index = HYPER3D_IDLE_SHOWCASE_DEFINITIONS.findIndex((definition) => definition.id === id);
      const sample = sampleAt(index * 5 + 2.5);
      const definition = getHyper3dIdleShowcaseDefinition(id);

      for (const channel of definition.primary) {
        expect(sample.pose[channel.name], `${id}.${channel.name}`).toBeGreaterThanOrEqual(
          HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK,
        );
      }
      expect(sample.diagnostics.currentDominantValue, id).toBeGreaterThanOrEqual(
        HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK,
      );
      expect(sample.diagnostics.expressionPeaks[id], id).toBeGreaterThanOrEqual(
        HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK,
      );
    }
  });

  it("keeps values finite, normalized, and neutral sections zero", () => {
    for (let time = 0; time < 60; time += 0.25) {
      const sample = sampleAt(time);
      for (const [name, value] of Object.entries(sample.pose)) {
        expect(Number.isFinite(value), `${time}:${name}`).toBe(true);
        expect(value, `${time}:${name}`).toBeGreaterThanOrEqual(0);
        expect(value, `${time}:${name}`).toBeLessThanOrEqual(1);
      }
    }
    expect(sampleAt(2.5).pose).toEqual({});
    expect(sampleAt(57.5).pose).toEqual({});
  });
  it("calibrates LAUGH as a distinct open-mouth happy laugh", () => {
    const laugh = getHyper3dIdleShowcaseDefinition("laugh");
    const smile = getHyper3dIdleShowcaseDefinition("smile");
    const happy = getHyper3dIdleShowcaseDefinition("happy");
    const peak = sampleAt(12.5);

    expect(peak.diagnostics.currentExpression).toBe("laugh");
    expect(peak.diagnostics.currentDominantValue).toBeGreaterThanOrEqual(0.8);
    expect(peak.pose.jawOpen).toBeGreaterThan(0.6);
    expect(peak.pose.mouthSmileLeft).toBeGreaterThan(0.8);
    expect(peak.pose.mouthSmileRight).toBeGreaterThan(0.8);
    expect(peak.pose.cheekSquintLeft).toBeGreaterThan(0.5);
    expect(peak.pose.cheekSquintRight).toBeGreaterThan(0.5);
    expect(peak.pose.eyeSquintLeft).toBeGreaterThan(0.3);
    expect(peak.pose.eyeSquintRight).toBeGreaterThan(0.3);
    expect(poseDistance(laugh.pose, smile.pose)).toBeGreaterThan(0.8);
    expect(poseDistance(laugh.pose, happy.pose)).toBeGreaterThan(0.8);
  });

  it("calibrates ANGRY as controlled tension distinct from concerned and sad", () => {
    const angry = getHyper3dIdleShowcaseDefinition("angry");
    const concerned = getHyper3dIdleShowcaseDefinition("concerned");
    const sad = getHyper3dIdleShowcaseDefinition("sad");
    const peak = sampleAt(47.5);

    expect(peak.diagnostics.currentExpression).toBe("angry");
    expect(peak.diagnostics.currentDominantValue).toBeGreaterThanOrEqual(0.8);
    expect(peak.pose.noseSneerLeft).toBeGreaterThanOrEqual(0.8);
    expect(peak.pose.noseSneerRight).toBeGreaterThanOrEqual(0.8);
    expect(peak.pose.eyeSquintLeft).toBeGreaterThan(0.5);
    expect(peak.pose.eyeSquintRight).toBeGreaterThan(0.5);
    expect(peak.pose.mouthPressLeft).toBeGreaterThan(0.6);
    expect(peak.pose.mouthPressRight).toBeGreaterThan(0.6);
    expect(peak.pose.browInnerUp).toBeGreaterThan(0);
    expect(poseDistance(angry.pose, concerned.pose)).toBeGreaterThan(1.5);
    expect(poseDistance(angry.pose, sad.pose)).toBeGreaterThan(1.5);
  });

  it("calibrates PLAYFUL as a unilateral wink-read with asymmetric friendly smile support", () => {
    const playful = getHyper3dIdleShowcaseDefinition("playful");
    const smile = getHyper3dIdleShowcaseDefinition("smile");
    const peak = sampleAt(52.5);

    expect(peak.diagnostics.currentExpression).toBe("playful");
    expect(peak.pose.eyeSquintLeft).toBeGreaterThanOrEqual(0.8);
    expect(peak.pose.eyeSquintRight ?? 0).toBeLessThan(0.2);
    expect((peak.pose.eyeSquintLeft ?? 0) - (peak.pose.eyeSquintRight ?? 0)).toBeGreaterThan(0.7);
    expect(peak.pose.mouthSmileLeft).toBeGreaterThan(0.7);
    expect(peak.pose.mouthSmileRight).toBeGreaterThan(0.3);
    expect((peak.pose.mouthSmileLeft ?? 0) - (peak.pose.mouthSmileRight ?? 0)).toBeGreaterThan(0.25);
    expect((peak.pose.cheekSquintLeft ?? 0) - (peak.pose.cheekSquintRight ?? 0)).toBeGreaterThan(0.4);
    expect(poseDistance(playful.pose, smile.pose)).toBeGreaterThan(0.8);
  });

  it("yields immediately outside genuine idle and restarts from neutral on re-entry", () => {
    const runtime = createHyper3dIdleExpressionShowcaseRuntime({ enabled: true });
    runtime.sample({ eligible: true, elapsedSeconds: 0 });
    expect(runtime.sample({ eligible: true, elapsedSeconds: 47.5 }).diagnostics.currentExpression).toBe("angry");

    const speaking = runtime.sample({ eligible: false, elapsedSeconds: 48, yieldReason: "speaking" });
    expect(speaking.active).toBe(false);
    expect(speaking.pose).toEqual({});
    expect(speaking.diagnostics.lastYieldReason).toBe("speaking");

    const listening = runtime.sample({ eligible: false, elapsedSeconds: 48.25, yieldReason: "listening" });
    expect(listening.diagnostics.lastYieldReason).toBe("listening");

    const thinking = runtime.sample({ eligible: false, elapsedSeconds: 48.5, yieldReason: "thinking" });
    expect(thinking.diagnostics.lastYieldReason).toBe("thinking");

    const reentered = runtime.sample({ eligible: true, elapsedSeconds: 100 });
    expect(reentered.active).toBe(true);
    expect(reentered.diagnostics.currentExpression).toBe("neutral");
    expect(reentered.diagnostics.cycleTimeSeconds).toBe(0);
    expect(reentered.pose).toEqual({});
  });

  it("applies delete-owned-channels then write-replacement without touching gaze/blink/head ownership", () => {
    const sample = sampleAt(7.5);
    const base: BlendshapePose = {
      mouthSmileLeft: 0.12,
      mouthSmileRight: 0.13,
      eyeLookUpLeft: 0.4,
      eyeBlinkLeft: 0.5,
      browDownLeft: 0.6,
      jawOpen: 0.2,
    };
    const applied = applyHyper3dIdleShowcasePose(base, sample);

    expect(applied.mouthSmileLeft).toBe(sample.pose.mouthSmileLeft);
    expect(applied.mouthSmileRight).toBe(sample.pose.mouthSmileRight);
    expect(applied.eyeLookUpLeft).toBe(0.4);
    expect(applied.eyeBlinkLeft).toBe(0.5);
    expect(applied.browDownLeft).toBe(0.6);
    expect(applied.jawOpen).toBeUndefined();
    expect(HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS).not.toContain("eyeLookUpLeft");
    expect(HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS).not.toContain("eyeBlinkLeft");
    expect(HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS).not.toContain("browDownLeft");
  });

  it("publishes the requested DEV diagnostics shape", () => {
    const sample = sampleAt(22.5);
    publishHyper3dIdleShowcaseDiagnostics(sample.diagnostics);
    const diagnostic = (globalThis as typeof globalThis & {
      __solaceHyper3dIdleShowcase?: typeof sample.diagnostics;
    }).__solaceHyper3dIdleShowcase;

    expect(diagnostic).toMatchObject({
      enabled: true,
      eligible: true,
      currentExpression: "surprise",
      minimumPeakRequirement: 0.8,
    });
    expect(diagnostic?.dominantChannels.length).toBeGreaterThan(0);
    expect(diagnostic?.dominantPeakTarget).toBeGreaterThanOrEqual(0.8);
    expect(diagnostic?.currentDominantValue).toBeGreaterThanOrEqual(0.8);
    expect(diagnostic?.expressionPeaks.surprise).toBeGreaterThanOrEqual(0.8);
  });
});

describe("Hyper3D idle expression showcase real female_2291 bindings", () => {
  beforeAll(() => installPublicDirFetch());
  afterAll(() => {
    globalThis.fetch = originalFetch;
    THREE.DefaultLoadingManager.setURLModifier(undefined as never);
  });

  it("loads the production GLB fixture used by the binding path", () => {
    const onDisk = `${PUBLIC_DIR}${HYPER3D_GLB_URL}`;
    expect(existsSync(onDisk), `${HYPER3D_GLB_URL} is missing from ${PUBLIC_DIR}`).toBe(true);
    expect(readFileSync(onDisk).byteLength).toBeGreaterThan(0);
  });

  it("resolves required dominant showcase channels to live non-dead morphs on female_2291", async () => {
    const scene = await loadProductionScene();
    const morph = new MorphTargetController();
    morph.discover(scene, CONFIG);

    const expressionsToProbe: Hyper3dIdleShowcaseExpressionId[] = [
      "smile",
      "laugh",
      "surprise",
      "sad",
      "angry",
      "playful",
    ];

    for (const id of expressionsToProbe) {
      const definition = getHyper3dIdleShowcaseDefinition(id);
      const index = HYPER3D_IDLE_SHOWCASE_DEFINITIONS.findIndex((candidate) => candidate.id === id);
      const sample = sampleAt(index * 5 + 2.5);
      morph.write(sample.pose);

      for (const [channelName, requested] of Object.entries(definition.pose)) {
        const bindings = resolveMorphBindings(CONFIG, channelName);
        expect(bindings.length, `${id}.${channelName} bindings`).toBeGreaterThan(0);
        let resolved = false;
        let live = false;
        let influence = 0;
        for (const binding of bindings) {
          for (const entry of morph.inspect(binding.target)) {
            resolved = true;
            live ||= entry.maxDelta > 1e-4;
            influence = Math.max(influence, entry.influence);
            expect(Number.isFinite(entry.influence), `${binding.target} influence`).toBe(true);
            expect(entry.influence, `${binding.target} influence`).toBeGreaterThanOrEqual(0);
            expect(entry.influence, `${binding.target} influence`).toBeLessThanOrEqual(1);
          }
        }
        expect(resolved, `${id}.${channelName} resolved`).toBe(true);
        expect(live, `${id}.${channelName} live morph`).toBe(true);
        expect(influence, `${id}.${channelName} nonzero influence`).toBeGreaterThan(0);
        expect(influence, `${id}.${channelName} requested ${requested}`).toBeCloseTo(requested, 6);
      }

      for (const channel of definition.primary) {
        expect(sample.pose[channel.name], `${id}.${channel.name} requested`).toBeGreaterThanOrEqual(0.8);
      }
    }
  });
});


