import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lipLandmarks, loadLipModel, measureLips, type LipLandmarks, type LipModel } from "./hyper3dLipGeometry";
import { LIP_BASELINE_ASSETS, type LipBaselineAssetId } from "./hyper3dLipBaseline";
import { HYPER3D_LIP_BASELINE } from "./hyper3dLipBaseline.fixture";
import { createHyper3dPerformance, resolveHyper3dFrame } from "./hyper3dFrameOrchestrator";
import {
  applyHyper3dArticulationTestPose,
  hyper3dArticulationTarget,
  setHyper3dArticulationTestState
} from "./hyper3dArticulationTest";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import {
  BILABIAL_BRIDGE_GAP_SECONDS,
  CoarticulationEngine,
  bilabialBridgeWeight,
  type CoarticulationInput
} from "./engine/engine/lipsync/CoarticulationEngine";
import { ActivePresenceDirector } from "./engine/engine/avatar/hyper3dActivePresence";
import { Hyper3dWarmthYieldFollower } from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { buildThreejsTalkingAvatarHeadPlan } from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import { avatarModelConfigs, type AvatarModelId } from "./engine/mappings/avatarModelConfig";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  ACCEPTED_LIVE_BEHAVIOUR,
  ACCEPTED_LIVE_BEHAVIOUR_SETTINGS,
  ACCEPTED_LIVE_PLAYBACK
} from "./liveAvatarPayload";
import { CORPUS_PAYLOADS, loadPayload } from "./hyper3dDeadlineCorpus";
import type { AvatarPayload, TimedPhoneme } from "./engine/types/avatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2, STEP 3c — BILABIAL CLOSURE CONTINUITY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Touching bilabials (P·B, B·M, M·P) are one lip closure. Before 3c the seal
 * released and re-applied at every shared boundary, and at 150 ms per label the
 * lips visibly PUMPED (Romy, P·B·M·P: 0.72 / 0.86 / 1.73 mm at P→B / B→M / M→P).
 * The bridge (`bilabialBridgeWeight`, opt-in, `hyper3d-usc` only) holds each
 * label's own closure demand across the shared boundary.
 *
 * "BEFORE" in this file is not a stored number: it is the same build with the
 * bridge forced off for one render, so every comparison re-derives itself.
 */

const CONFIG = avatarModelConfigs["hyper3d-usc"];
const STEP = 1 / 60;
const LEAD = 0.25;
const SEQUENCE = ["AH", "P", "B", "M", "P", "AH"] as const;
const PP = new Set(["P", "B", "M"]);
const norm = (p?: string) => (p ?? "").replace(/[0-2]$/, "").toUpperCase();

/** Bridge forced off for the duration of `fn`, by overriding the one input flag. */
function withoutBridge<T>(fn: () => T): T {
  const original = CoarticulationEngine.prototype.blend;
  const spy = vi
    .spyOn(CoarticulationEngine.prototype, "blend")
    .mockImplementation(function (this: CoarticulationEngine, input: CoarticulationInput) {
      return original.call(this, { ...input, bilabialBridge: false });
    });
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

type Label = TimedPhoneme & { intensity: number };
function sequenceLabels(seconds: number) {
  const labels: Label[] = [];
  let t = 0;
  const push = (phoneme: string, span: number) => {
    labels.push({ phoneme, start_time: +t.toFixed(5), end_time: +(t + span).toFixed(5), intensity: 1 } as Label);
    t += span;
  };
  push("SIL", LEAD);
  for (const phoneme of SEQUENCE) push(phoneme, seconds);
  push("SIL", LEAD);
  return { labels, total: t };
}

function payloadFor(labels: Label[], total: number, id: string): AvatarPayload {
  return {
    version: "1.0", id, text: id, language: "en-US", audio_duration: total, phoneme_set: "arpabet", time_unit: "seconds",
    playback: { ...ACCEPTED_LIVE_PLAYBACK }, phonemes: labels, emotions: [], facial_cues: [], pauses: [],
    behaviour: ACCEPTED_LIVE_BEHAVIOUR, behaviour_settings: ACCEPTED_LIVE_BEHAVIOUR_SETTINGS, markers: [],
    metadata: { avatar_id: "hyper3d-usc", created_at: new Date(0).toISOString(), source: "test", description: id },
    performance_seed: id
  } as unknown as AvatarPayload;
}

/** The production frame, at 60 Hz, with a live-like plan. */
function render(payload: AvatarPayload) {
  const controller = new AvatarController(payload);
  const performance = createHyper3dPerformance();
  const activePresence = new ActivePresenceDirector(payload.performance_seed ?? payload.id);
  const warmthYield = new Hyper3dWarmthYieldFollower();
  const plan = buildThreejsTalkingAvatarHeadPlan({
    text: payload.text, phonemes: payload.phonemes, acousticFrames: [], durationSeconds: payload.audio_duration, segmentIntent: true
  });
  const frames: { t: number; pose: BlendshapePose }[] = [];
  for (let i = 0; i <= Math.floor(payload.audio_duration / STEP); i += 1) {
    const t = i * STEP;
    const resolved = resolveHyper3dFrame(
      { config: CONFIG, controller, performance, activePresence, warmthYield, headSupported: true },
      { timeSeconds: t, deltaSeconds: STEP, isSpeaking: true, plan, acousticFrames: [] }
    );
    frames.push({ t, pose: { ...resolved.pose } });
  }
  return frames;
}

// ─── engine level: no GLB needed ───────────────────────────────────────────────

describe("the bridge weight", () => {
  const P1: TimedPhoneme = { phoneme: "P", start_time: 0.1, end_time: 0.25 } as TimedPhoneme;
  const B2: TimedPhoneme = { phoneme: "B", start_time: 0.25, end_time: 0.4 } as TimedPhoneme;
  const AH: TimedPhoneme = { phoneme: "AH", start_time: 0.25, end_time: 0.4 } as TimedPhoneme;
  const profile = hyper3dPhonemeToBlendshape;

  it("is 1 at a boundary shared with another bilabial, from both sides", () => {
    expect(bilabialBridgeWeight(0.25, P1, undefined, B2, profile)).toBeCloseTo(1, 9);
    expect(bilabialBridgeWeight(0.25, B2, P1, undefined, profile)).toBeCloseTo(1, 9);
  });

  it("is 0 on a side that faces a vowel, so the release into it is untouched", () => {
    for (const t of [0.1, 0.15, 0.2, 0.25]) expect(bilabialBridgeWeight(t, P1, undefined, AH, profile)).toBe(0);
  });

  it("is 0 when the current label is not a bilabial", () => {
    expect(bilabialBridgeWeight(0.25, AH, P1, undefined, profile)).toBe(0);
  });

  it("needs the labels to touch: a gap beyond the tolerance turns it off", () => {
    const late = { ...B2, start_time: 0.25 + BILABIAL_BRIDGE_GAP_SECONDS + 0.005 } as TimedPhoneme;
    expect(bilabialBridgeWeight(0.249, P1, undefined, late, profile)).toBe(0);
  });
});

describe("the engine: opt-in, and never stronger than the label's own demand", () => {
  const { labels } = sequenceLabels(0.15);
  const lookup = (t: number) => {
    const index = labels.findIndex((l) => t >= l.start_time && t < l.end_time);
    const nonSil = (l?: Label) => (l && l.phoneme !== "SIL" ? l : undefined);
    return { current: nonSil(labels[index]), previous: nonSil(labels[index - 1]), next: nonSil(labels[index + 1]) };
  };
  const times = Array.from({ length: 140 }, (_, i) => i * 0.01);

  it("absent and false are byte-identical", () => {
    for (const t of times) {
      const a = new CoarticulationEngine().blend({ time: t, ...lookup(t), profile: hyper3dPhonemeToBlendshape });
      const b = new CoarticulationEngine().blend({ time: t, ...lookup(t), profile: hyper3dPhonemeToBlendshape, bilabialBridge: false });
      expect(b).toEqual(a);
    }
  });

  it("changes only mouthClose, and only up to the current bilabial's own apex demand", () => {
    for (const t of times) {
      const slots = lookup(t);
      const off = new CoarticulationEngine().blend({ time: t, ...slots, profile: hyper3dPhonemeToBlendshape }).pose;
      const on = new CoarticulationEngine().blend({ time: t, ...slots, profile: hyper3dPhonemeToBlendshape, bilabialBridge: true }).pose;
      const { mouthClose: closeOff, ...restOff } = off;
      const { mouthClose: closeOn, ...restOn } = on;
      expect(restOn).toEqual(restOff);
      expect(closeOn ?? 0).toBeGreaterThanOrEqual((closeOff ?? 0) - 1e-12);
      const def = slots.current ? hyper3dPhonemeToBlendshape[norm(slots.current.phoneme) as keyof typeof hyper3dPhonemeToBlendshape] : undefined;
      const demand = def ? (def.pose.mouthClose ?? 0) * def.defaultIntensity : 0;
      if ((closeOn ?? 0) > (closeOff ?? 0) + 1e-12) expect(closeOn ?? 0).toBeLessThanOrEqual(demand + 1e-12);
    }
  });

  it("does nothing to a lone bilabial between vowels", () => {
    const lone: Label[] = [
      { phoneme: "AH", start_time: 0, end_time: 0.15, intensity: 1 } as Label,
      { phoneme: "P", start_time: 0.15, end_time: 0.3, intensity: 1 } as Label,
      { phoneme: "AH", start_time: 0.3, end_time: 0.45, intensity: 1 } as Label
    ];
    for (let t = 0; t < 0.45; t += 0.005) {
      const i = lone.findIndex((l) => t >= l.start_time && t < l.end_time);
      const slots = { current: lone[i], previous: lone[i - 1], next: lone[i + 1] };
      const off = new CoarticulationEngine().blend({ time: t, ...slots, profile: hyper3dPhonemeToBlendshape });
      const on = new CoarticulationEngine().blend({ time: t, ...slots, profile: hyper3dPhonemeToBlendshape, bilabialBridge: true });
      expect(on).toEqual(off);
    }
  });
});

describe("activation: hyper3d-usc only", () => {
  const flagsFor = (modelId: AvatarModelId, calibrationEnabled = true) => {
    const { labels, total } = sequenceLabels(0.15);
    const controller = new AvatarController(payloadFor(labels, total, `act-${modelId}`));
    const spy = vi.spyOn(CoarticulationEngine.prototype, "blend");
    for (let t = 0; t < total; t += 0.05) controller.evaluate(t, 0.05, { modelId, calibrationEnabled });
    const flags = new Set(spy.mock.calls.map(([input]) => input.bilabialBridge === true));
    spy.mockRestore();
    return flags;
  };

  it("hyper3d-usc asks for the bridge", () => {
    expect([...flagsFor("hyper3d-usc")]).toEqual([true]);
  });

  it("female and miniface-male never do, so their path is the previous one exactly", () => {
    expect([...flagsFor("female")]).toEqual([false]);
    expect([...flagsFor("miniface-male")]).toEqual([false]);
  });

  it("hyper3d-usc with calibration off (the neutral A/B reference) does not either", () => {
    expect([...flagsFor("hyper3d-usc", false)]).toEqual([false]);
  });

  it("a non-Hyper3D controller renders byte-identically with the bridge forced off", () => {
    const { labels, total } = sequenceLabels(0.15);
    const run = () => {
      const controller = new AvatarController(payloadFor(labels, total, "male-identity"));
      const out: BlendshapePose[] = [];
      for (let i = 0; i <= Math.floor(total / STEP); i += 1) out.push({ ...controller.evaluate(i * STEP, STEP, { modelId: "miniface-male" }).outputPose });
      return out;
    };
    expect(run()).toEqual(withoutBridge(run));
  });
});

// ─── the production frame, on every face ───────────────────────────────────────

type Face = { id: LipBaselineAssetId; model: LipModel; lm: LipLandmarks; seal: number; mApex: number };
const FACE_IDS = (Object.keys(LIP_BASELINE_ASSETS) as LipBaselineAssetId[]).filter((id) => existsSync(LIP_BASELINE_ASSETS[id]));
const facesAvailable = FACE_IDS.length === Object.keys(LIP_BASELINE_ASSETS).length;

/** Worst pulse allowed across all eight faces, per duration, at P→B / B→M / M→P (mm). */
const PULSE_LIMITS: Record<number, readonly [number, number, number]> = {
  70: [0.05, 0.1, 0.25],
  90: [0.05, 0.4, 0.65],
  150: [0.2, 0.45, 1.15]
};

(facesAvailable ? describe : describe.skip)("P·B·M·P through the production frame — every face", () => {
  const faces: Face[] = facesAvailable
    ? FACE_IDS.map((id) => {
        const model = loadLipModel(LIP_BASELINE_ASSETS[id]);
        const lm = lipLandmarks(model);
        return { id, model, lm, seal: measureLips(model, lm, { mouthClose: 0.1 }).apertureMM, mApex: HYPER3D_LIP_BASELINE[id].phonemes.M[0] };
      })
    : [];
  const vsSeal = (face: Face, pose: BlendshapePose) => measureLips(face.model, face.lm, pose).apertureMM - face.seal;

  for (const ms of [50, 70, 90, 150]) {
    describe(`${ms} ms per label`, () => {
      const d = ms / 1000;
      const { labels, total } = sequenceLabels(d);
      const boundaries = [LEAD + 2 * d, LEAD + 3 * d, LEAD + 4 * d];
      const firstP = LEAD + d;
      const lastEnd = LEAD + 5 * d;
      const after = facesAvailable ? render(payloadFor(labels, total, `c${ms}`)) : [];
      const before = facesAvailable ? withoutBridge(() => render(payloadFor(labels, total, `c${ms}`))) : [];

      const pulses = (frames: typeof after, face: Face) =>
        boundaries.map((b) => {
          const held = frames.filter((f) => f.t >= b - d + 0.02 && f.t < b - 0.02).map((f) => vsSeal(face, f.pose));
          const around = frames.filter((f) => f.t >= b - 0.035 && f.t <= b + 0.035).map((f) => vsSeal(face, f.pose));
          return held.length ? Math.max(...around) - Math.min(...held) : 0;
        });

      it("prints the boundary pulses before and after on every face", () => {
        for (const face of faces) {
          console.info(
            `[bilabial continuity] ${ms}ms ${face.id.replace("hyper3d_", "")}: pulse P>B,B>M,M>P before`,
            pulses(before, face).map((v) => v.toFixed(2)).join("/"),
            "after",
            pulses(after, face).map((v) => v.toFixed(2)).join("/")
          );
        }
        expect(after.length).toBe(before.length);
      });

      if (PULSE_LIMITS[ms]) {
        it("cuts the pulse at every internal boundary, on every face, and never adds one", () => {
          for (const face of faces) {
            const a = pulses(after, face);
            const b = pulses(before, face);
            a.forEach((value, i) => {
              expect(value).toBeLessThanOrEqual(PULSE_LIMITS[ms][i]);
              expect(value).toBeLessThanOrEqual(b[i] + 0.01);
            });
          }
        });
      }

      if (ms === 150) {
        it("keeps the lips sealed across every internal boundary (continuous closure)", () => {
          for (const face of faces) {
            const across = after.filter((f) => f.t >= boundaries[0] - 0.035 && f.t <= boundaries[2] + 0.035);
            expect(Math.max(...across.map((f) => vsSeal(face, f.pose)))).toBeLessThanOrEqual(0.1);
          }
        });
      }

      it("never compresses the lips past the face's own static M apex", () => {
        for (const face of faces) {
          const span = after.filter((f) => f.t >= firstP && f.t < lastEnd);
          const deepest = Math.min(...span.map((f) => measureLips(face.model, face.lm, f.pose).apertureMM));
          expect(deepest).toBeGreaterThanOrEqual(face.mApex);
        }
      });

      it("keeps mouthClose inside the calibration's sealing band", () => {
        expect(Math.max(...after.map((f) => f.pose.mouthClose ?? 0))).toBeLessThanOrEqual(0.12);
      });

      it("adds no frame-to-frame jump", () => {
        for (const face of faces) {
          const jump = (frames: typeof after) => {
            const aps = frames.filter((f) => f.t >= firstP && f.t < lastEnd).map((f) => vsSeal(face, f.pose));
            return Math.max(...aps.slice(1).map((v, i) => Math.abs(v - aps[i])));
          };
          expect(jump(after)).toBeLessThanOrEqual(jump(before) + 0.05);
        }
      });

      it("leaves the release into the vowel after the last P as it was", () => {
        for (const face of faces) {
          const release = (frames: typeof after) =>
            frames.filter((f) => f.t >= lastEnd && f.t < lastEnd + d).map((f) => vsSeal(face, f.pose));
          const a = release(after);
          const b = release(before);
          a.forEach((value, i) => expect(Math.abs(value - b[i])).toBeLessThanOrEqual(0.15));
        }
      });
    });
  }
});

// ─── DEV runner versus production ──────────────────────────────────────────────

(facesAvailable && hyper3dArticulationTarget("seqBilabialPbmp") ? describe : describe.skip)(
  "the DEV articulation runner shows the same bridge production renders",
  () => {
    const romy = facesAvailable ? loadLipModel(LIP_BASELINE_ASSETS.hyper3d_arfv2) : (null as unknown as LipModel);
    const lm = facesAvailable ? lipLandmarks(romy) : (null as unknown as LipLandmarks);
    const seal = facesAvailable ? measureLips(romy, lm, { mouthClose: 0.1 }).apertureMM : 0;
    const vsSeal = (pose: BlendshapePose) => measureLips(romy, lm, pose).apertureMM - seal;

    it("at 150 ms the DEV loop matches the production frame within 0.3 mm (median under 0.02 mm)", () => {
      const d = 0.15;
      const { labels, total } = sequenceLabels(d);
      setHyper3dArticulationTestState("runtime");
      setHyper3dArticulationTestState("seqBilabialPbmp");
      const dev: { t: number; pose: BlendshapePose }[] = [];
      for (let i = 0; i < Math.round((2 * total) / STEP); i += 1) {
        const pose = applyHyper3dArticulationTestPose({}, "seqBilabialPbmp", "calibrated", "mid", 1, "d150", STEP);
        const abs = (i + 1) * STEP;
        if (abs > total) dev.push({ t: abs - total, pose });
      }
      setHyper3dArticulationTestState("runtime");
      const prod = render(payloadFor(labels, total, "equivalence150"));
      const diffs: number[] = [];
      for (const frame of dev) {
        if (frame.t < LEAD + d || frame.t >= LEAD + 5 * d) continue;
        const match = prod[Math.round(frame.t / STEP)];
        if (match && Math.abs(match.t - frame.t) < STEP / 2) diffs.push(Math.abs(vsSeal(frame.pose) - vsSeal(match.pose)));
      }
      diffs.sort((a, b) => a - b);
      console.info(`[bilabial continuity] DEV vs production 150ms: ${diffs.length} frames, median ${diffs[Math.floor(diffs.length / 2)].toFixed(3)} mm, max ${diffs[diffs.length - 1].toFixed(3)} mm`);
      expect(diffs.length).toBeGreaterThan(30);
      expect(diffs[Math.floor(diffs.length / 2)]).toBeLessThanOrEqual(0.02);
      expect(diffs[diffs.length - 1]).toBeLessThanOrEqual(0.3);
    });
  }
);

// ─── real speech ───────────────────────────────────────────────────────────────

const corpusAvailable = facesAvailable && CORPUS_PAYLOADS.every((entry) => existsSync(entry.path));

(corpusAvailable ? describe : describe.skip)("the aligned corpus: only touching bilabials change", () => {
  it("every frame more than 0.3 s from a touching bilabial pair is unchanged", () => {
    const romy = loadLipModel(LIP_BASELINE_ASSETS.hyper3d_arfv2);
    const lm = lipLandmarks(romy);
    const aperture = (pose: BlendshapePose) => measureLips(romy, lm, pose).apertureMM;
    let touchingPairs = 0;
    for (const entry of CORPUS_PAYLOADS) {
      const payload = loadPayload(entry.path);
      const labels = payload.phonemes as TimedPhoneme[];
      const shared = labels
        .filter((label, i) => {
          const next = labels[i + 1];
          return next && PP.has(norm(label.phoneme)) && PP.has(norm(next.phoneme)) && Math.abs(next.start_time - label.end_time) <= BILABIAL_BRIDGE_GAP_SECONDS;
        })
        .map((label) => label.end_time);
      touchingPairs += shared.length;
      const on = render(payload);
      const off = withoutBridge(() => render(payload));
      on.forEach((frame, i) => {
        if (shared.some((t) => Math.abs(frame.t - t) <= 0.3)) return;
        expect(Math.abs(aperture(frame.pose) - aperture(off[i].pose))).toBeLessThanOrEqual(1e-3);
      });
    }
    expect(touchingPairs).toBeGreaterThan(0);
  });
});
