import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lipLandmarks, loadLipModel, measureLips, type LipLandmarks, type LipModel } from "./hyper3dLipGeometry";
import { LIP_BASELINE_ASSETS, type LipBaselineAssetId } from "./hyper3dLipBaseline";
import { HYPER3D_LIP_BASELINE } from "./hyper3dLipBaseline.fixture";
import { createHyper3dPerformance, resolveHyper3dFrame } from "./hyper3dFrameOrchestrator";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { ActivePresenceDirector } from "./engine/engine/avatar/hyper3dActivePresence";
import { Hyper3dWarmthYieldFollower } from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { buildThreejsTalkingAvatarHeadPlan } from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import { avatarModelConfigs, type AvatarModelId } from "./engine/mappings/avatarModelConfig";
import {
  getMouthTransitionProfile,
  mouthTransitionProfiles,
  resolveMouthDeadline,
  type MouthTransitionProfile
} from "./engine/mappings/avatarBlendshapeConfig";
import { exponentialSmoothingAlpha } from "./engine/utils/lerp";
import {
  ACCEPTED_LIVE_BEHAVIOUR,
  ACCEPTED_LIVE_BEHAVIOUR_SETTINGS,
  ACCEPTED_LIVE_PLAYBACK
} from "./liveAvatarPayload";
import { CORPUS_PAYLOADS, loadPayload } from "./hyper3dDeadlineCorpus";
import { withoutSealSpeed } from "./hyper3dSealSpeed.testSupport";
import type { AvatarPayload } from "./engine/types/avatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2, STEP 3b — THE JAW-SEAL FOLLOWER (40/s, CLOSING SEAL FRAMES ONLY).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * After an open vowel the jaw was still at a median 0.058 when a P/B/M began,
 * and on a sealing frame it closed at `openSpeed` (24/s). `hyper3d-usc` now
 * closes at its profile's `sealSpeed` on those frames only.
 *
 * "BEFORE" here is never a stored number: it is the same build with the
 * profile's `sealSpeed` removed for one render — which is the previous code path
 * exactly — so every comparison re-derives itself.
 */

const CONFIG = avatarModelConfigs["hyper3d-usc"];
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;
const JAW_MM = 35.19;
const PP = new Set(["P", "B", "M"]);
const OPEN = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "OW", "OY", "ER", "EY", "IH", "IY", "UH", "UW"]);
const norm = (p?: string) => (p ?? "").replace(/[0-2]$/, "").toUpperCase();

afterEach(() => vi.restoreAllMocks());

// ─── the follower itself ───────────────────────────────────────────────────────

function drive(
  targets: Array<Record<string, number>>,
  mouth: MouthTransitionProfile | undefined,
  dt: number
) {
  const mixer = new FacialPoseMixer();
  return targets.map((target) => {
    const mixed = mixer.combine([{ channel: "lipsync", pose: target }] as never);
    return { ...mixer.smooth(mixed.pose, dt, undefined, mouth) };
  });
}
const hold = (pose: Record<string, number>, frames: number) => Array.from({ length: frames }, () => ({ ...pose }));
const noSeal: MouthTransitionProfile = { ...PROFILE, sealSpeed: undefined };

describe("activation: hyper3d-usc only", () => {
  it("only the hyper3d-usc transition profile carries a sealSpeed, and it is 40", () => {
    for (const [model, profile] of Object.entries(mouthTransitionProfiles)) {
      expect(profile?.sealSpeed, model).toBe(model === "hyper3d-usc" ? 40 : undefined);
    }
    expect(getMouthTransitionProfile("female")).toBeUndefined();
    expect(getMouthTransitionProfile("miniface-male")).toBeUndefined();
  });

  it("every DEV deadline mode keeps the same sealSpeed, so the comparison stays like-for-like", () => {
    expect(resolveMouthDeadline(PROFILE, null)?.sealSpeed).toBe(40);
    expect(resolveMouthDeadline(PROFILE, "off")?.sealSpeed).toBe(40);
    expect(resolveMouthDeadline(PROFILE, { maxSpeed: 44, landingExponent: null })?.sealSpeed).toBe(40);
  });

  it("non-Hyper3D controllers render byte-identically with sealSpeed removed", () => {
    const labels = [
      { phoneme: "SIL", start_time: 0, end_time: 0.2, intensity: 1 },
      { phoneme: "AA", start_time: 0.2, end_time: 0.35, intensity: 1 },
      { phoneme: "P", start_time: 0.35, end_time: 0.43, intensity: 1 },
      { phoneme: "AE", start_time: 0.43, end_time: 0.6, intensity: 1 },
      { phoneme: "SIL", start_time: 0.6, end_time: 0.8, intensity: 1 }
    ];
    for (const modelId of ["female", "miniface-male"] as AvatarModelId[]) {
      const run = () => {
        const controller = new AvatarController(payloadFor(labels, 0.8, `ne-${modelId}`));
        const out: BlendshapePose[] = [];
        for (let i = 0; i <= 48; i += 1) out.push({ ...controller.evaluate(i / 60, 1 / 60, { modelId }).outputPose });
        return out;
      };
      expect(run()).toEqual(withoutSealSpeed(run));
    }
  });
});

describe("the follower: closing seal frames only", () => {
  it("a jaw closing WITHOUT a seal demand keeps closeSpeed exactly", () => {
    const targets = [...hold({ jawOpen: 0.5 }, 20), ...hold({ jawOpen: 0.02, mouthClose: 0.2 }, 20)];
    expect(drive(targets, PROFILE, 1 / 60)).toEqual(drive(targets, noSeal, 1 / 60));
  });

  it("an OPENING jaw is untouched, sealing or not", () => {
    const targets = [
      ...hold({ jawOpen: 0.02, mouthClose: 0.6 }, 10),
      ...hold({ jawOpen: 0.4, mouthClose: 0.6 }, 15),
      ...hold({ jawOpen: 0.5 }, 15)
    ];
    expect(drive(targets, PROFILE, 1 / 60)).toEqual(drive(targets, noSeal, 1 / 60));
  });

  it("frames that are not sealing are byte-identical, whatever the jaw does", () => {
    const targets: Array<Record<string, number>> = [];
    for (let i = 0; i < 120; i += 1) targets.push({ jawOpen: 0.3 + 0.25 * Math.sin(i / 7), mouthClose: 0.4 * Math.abs(Math.cos(i / 11)) });
    expect(drive(targets, PROFILE, 1 / 60)).toEqual(drive(targets, noSeal, 1 / 60));
  });

  it("is frame-rate stable: the same closing curve at 30 and 60 fps, monotone, and never past its target", () => {
    const close = (fps: number) =>
      drive([...hold({ jawOpen: 0.5 }, fps), ...hold({ jawOpen: 0.02, mouthClose: 0.8 }, fps / 2)], PROFILE, 1 / fps);
    const at60 = close(60);
    const at30 = close(30);
    // Compare at the shared 1/30 s instants of the closing half.
    for (let k = 1; k <= 15; k += 1) {
      const t30 = at30[30 + k - 1].jawOpen;
      const t60 = at60[60 + 2 * k - 1].jawOpen;
      expect(Math.abs(t30 - t60)).toBeLessThan(0.002);
    }
    for (const run of [at60, at30]) {
      const closing = run.slice(run.length / 3 * 2);
      closing.slice(1).forEach((p, i) => {
        expect(p.jawOpen).toBeLessThanOrEqual(closing[i].jawOpen + 1e-12);
        expect(p.jawOpen).toBeGreaterThanOrEqual(0.02 - 1e-12);
      });
    }
    // And the 60 fps curve is the exact exponential at 40/s.
    const alpha = exponentialSmoothingAlpha(40, 1 / 60);
    let expected = at60[59].jawOpen;
    for (let i = 60; i < 90; i += 1) {
      expected += (0.02 - expected) * alpha;
      expect(at60[i].jawOpen).toBeCloseTo(expected, 12);
    }
  });
});

// ─── the production frame ──────────────────────────────────────────────────────

type Label = { phoneme: string; start_time: number; end_time: number; intensity: number };
function payloadFor(labels: Label[], total: number, id: string): AvatarPayload {
  return {
    version: "1.0", id, text: id, language: "en-US", audio_duration: total, phoneme_set: "arpabet", time_unit: "seconds",
    playback: { ...ACCEPTED_LIVE_PLAYBACK }, phonemes: labels, emotions: [], facial_cues: [], pauses: [],
    behaviour: ACCEPTED_LIVE_BEHAVIOUR, behaviour_settings: ACCEPTED_LIVE_BEHAVIOUR_SETTINGS, markers: [],
    metadata: { avatar_id: "hyper3d-usc", created_at: new Date(0).toISOString(), source: "test", description: id },
    performance_seed: id
  } as unknown as AvatarPayload;
}
function render(payload: AvatarPayload, step: number) {
  const controller = new AvatarController(payload);
  const performance = createHyper3dPerformance();
  const activePresence = new ActivePresenceDirector(payload.performance_seed ?? payload.id);
  const warmthYield = new Hyper3dWarmthYieldFollower();
  const plan = buildThreejsTalkingAvatarHeadPlan({
    text: payload.text, phonemes: payload.phonemes, acousticFrames: [], durationSeconds: payload.audio_duration, segmentIntent: true
  });
  const frames: { t: number; pose: BlendshapePose }[] = [];
  for (let i = 0; i <= Math.floor(payload.audio_duration / step); i += 1) {
    const t = i * step;
    const resolved = resolveHyper3dFrame(
      { config: CONFIG, controller, performance, activePresence, warmthYield, headSupported: true },
      { timeSeconds: t, deltaSeconds: step, isSpeaking: true, plan, acousticFrames: [] }
    );
    frames.push({ t, pose: { ...resolved.pose } });
  }
  return frames;
}
function sequence(phonemes: string[], seconds: number) {
  const labels: Label[] = [];
  let t = 0;
  const push = (phoneme: string, span: number) => {
    labels.push({ phoneme, start_time: +t.toFixed(5), end_time: +(t + span).toFixed(5), intensity: 1 });
    t += span;
  };
  push("SIL", 0.25);
  for (const phoneme of phonemes) push(phoneme, OPEN.has(phoneme) ? Math.max(seconds, 0.12) : seconds);
  push("SIL", 0.3);
  return { labels, total: t };
}
/** Peak jaw closing speed (mm/s) and largest per-frame jaw displacement (mm). */
const jawMotion = (frames: { pose: BlendshapePose }[], step: number) => {
  let closing = 0;
  let displacement = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const d = ((frames[i].pose.jawOpen ?? 0) - (frames[i - 1].pose.jawOpen ?? 0)) * JAW_MM;
    displacement = Math.max(displacement, Math.abs(d));
    closing = Math.max(closing, -d / step);
  }
  return { closing, displacement };
};

type Face = { id: LipBaselineAssetId; model: LipModel; lm: LipLandmarks; seal: number; mApex: number };
const FACE_IDS = Object.keys(LIP_BASELINE_ASSETS) as LipBaselineAssetId[];
const facesAvailable = FACE_IDS.every((id) => existsSync(LIP_BASELINE_ASSETS[id]));
const corpusAvailable = facesAvailable && CORPUS_PAYLOADS.every((entry) => existsSync(entry.path));
const loadFaces = (): Face[] =>
  FACE_IDS.map((id) => {
    const model = loadLipModel(LIP_BASELINE_ASSETS[id]);
    const lm = lipLandmarks(model);
    return { id, model, lm, seal: measureLips(model, lm, { mouthClose: 0.1 }).apertureMM, mApex: HYPER3D_LIP_BASELINE[id].phonemes.M[0] };
  });

(corpusAvailable ? describe : describe.skip)("real speech — the four aligned recordings, every face", () => {
  const faces = corpusAvailable ? loadFaces() : [];
  type Stats = { closed: Record<string, number>; total: Record<string, number>; deepest: number; vowelBefore: number[]; vowelAfter: number[] };
  const collect = (mode: "3c" | "3b") => {
    const perFace = new Map<LipBaselineAssetId, Stats>();
    let peakClosing = 0;
    const framesById = new Map<string, { t: number; pose: BlendshapePose }[]>();
    for (const entry of CORPUS_PAYLOADS) {
      const payload = loadPayload(entry.path);
      const frames = mode === "3b" ? render(payload, 1 / 60) : withoutSealSpeed(() => render(payload, 1 / 60));
      framesById.set(entry.id, frames);
      peakClosing = Math.max(peakClosing, jawMotion(frames, 1 / 60).closing);
      const labels = payload.phonemes as Label[];
      for (const face of faces) {
        const stats = perFace.get(face.id) ?? { closed: {}, total: {}, deepest: Infinity, vowelBefore: [], vowelAfter: [] };
        perFace.set(face.id, stats);
        const ap = (pose: BlendshapePose) => measureLips(face.model, face.lm, pose).apertureMM;
        const vowelPeak = (label?: Label) => {
          if (!label || !OPEN.has(norm(label.phoneme))) return null;
          // A vowel shorter than one frame has no rendered frame of its own: skip it.
          const inVowel = frames.filter((f) => f.t >= label.start_time && f.t < label.end_time);
          return inVowel.length ? Math.max(...inVowel.map((f) => ap(f.pose))) : null;
        };
        labels.forEach((label, i) => {
          const ph = norm(label.phoneme);
          if (!PP.has(ph)) return;
          const inside = frames.filter((f) => f.t >= label.start_time && f.t < label.end_time);
          if (!inside.length) return;
          const apertures = inside.map((f) => ap(f.pose));
          stats.total[ph] = (stats.total[ph] ?? 0) + 1;
          if (apertures.some((a) => a - face.seal <= 0.5)) stats.closed[ph] = (stats.closed[ph] ?? 0) + 1;
          stats.deepest = Math.min(stats.deepest, ...apertures);
          const before = vowelPeak(labels[i - 1]);
          const after = vowelPeak(labels[i + 1]);
          if (before !== null) stats.vowelBefore.push(before);
          if (after !== null) stats.vowelAfter.push(after);
        });
      }
    }
    return { perFace, peakClosing, framesById };
  };
  const before = corpusAvailable ? collect("3c") : null;
  const after = corpusAvailable ? collect("3b") : null;
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const totalClosed = (s: Stats) => Object.values(s.closed).reduce((a, b) => a + b, 0);

  it("prints P/B/M closure before and after on every face", () => {
    for (const face of faces) {
      const b = before!.perFace.get(face.id)!;
      const a = after!.perFace.get(face.id)!;
      console.info(
        `[jaw seal] ${face.id.replace("hyper3d_", "")}: closed ${totalClosed(b)} -> ${totalClosed(a)} of 50;`,
        ["P", "B", "M"].map((ph) => `${ph} ${b.closed[ph] ?? 0}->${a.closed[ph] ?? 0}/${a.total[ph]}`).join(", ")
      );
    }
    console.info(`[jaw seal] peak real-speech jaw closing ${before!.peakClosing.toFixed(0)} -> ${after!.peakClosing.toFixed(0)} mm/s`);
    expect(Object.values(after!.perFace.get("hyper3d_arfv2")!.total).reduce((a, b) => a + b, 0)).toBe(50);
  });

  it("closes at least 27 of 50 on every face, and never fewer of P, B or M than before", () => {
    for (const face of faces) {
      const b = before!.perFace.get(face.id)!;
      const a = after!.perFace.get(face.id)!;
      expect(totalClosed(a), face.id).toBeGreaterThanOrEqual(27);
      for (const ph of ["P", "B", "M"]) expect(a.closed[ph] ?? 0, `${face.id} ${ph}`).toBeGreaterThanOrEqual(b.closed[ph] ?? 0);
    }
    const romy = after!.perFace.get("hyper3d_arfv2")!;
    expect(romy.closed.P).toBeGreaterThanOrEqual(13);
    expect(romy.closed.B ?? 0).toBeGreaterThanOrEqual(2);
    expect(romy.closed.M).toBeGreaterThanOrEqual(12);
  });

  it("keeps the fastest real-speech jaw close within 250 mm/s", () => {
    expect(after!.peakClosing).toBeLessThanOrEqual(250);
  });

  it("never compresses the lips past each face's own static M apex", () => {
    for (const face of faces) expect(after!.perFace.get(face.id)!.deepest, face.id).toBeGreaterThanOrEqual(face.mApex);
  });

  it("leaves the vowel before and after a bilabial within 0.1 mm of its previous opening", () => {
    for (const face of faces) {
      const b = before!.perFace.get(face.id)!;
      const a = after!.perFace.get(face.id)!;
      expect(Math.abs(mean(a.vowelBefore) - mean(b.vowelBefore)), face.id).toBeLessThanOrEqual(0.1);
      expect(Math.abs(mean(a.vowelAfter) - mean(b.vowelAfter)), face.id).toBeLessThanOrEqual(0.1);
    }
  });

  it("frames far from any bilabial move by no more than 0.02 mm", () => {
    const romy = faces.find((f) => f.id === "hyper3d_arfv2")!;
    const ap = (pose: BlendshapePose) => measureLips(romy.model, romy.lm, pose).apertureMM;
    for (const entry of CORPUS_PAYLOADS) {
      const labels = (loadPayload(entry.path).phonemes as Label[]).filter((l) => PP.has(norm(l.phoneme)));
      const a = after!.framesById.get(entry.id)!;
      const b = before!.framesById.get(entry.id)!;
      a.forEach((frame, i) => {
        if (labels.some((l) => frame.t >= l.start_time - 0.1 && frame.t < l.end_time + 0.25)) return;
        expect(Math.abs(ap(frame.pose) - ap(b[i].pose))).toBeLessThanOrEqual(0.02);
      });
    }
  });
});

const SYNTHETIC = ["AA·P", "AA·B", "AA·M", "AE·B", "AA·P·M·AE", "AH·P·AA", "AH·B·AE", "AH·M·AA"];
const phonemesOf = (name: string) => name.split("·");

(facesAvailable ? describe : describe.skip)("synthetic open-vowel transitions — speed, displacement and closure", () => {
  const faces = facesAvailable ? loadFaces() : [];
  for (const fps of [60, 30]) {
    const step = 1 / fps;
    it(`${fps} fps: jaw closing speed and per-frame displacement stay bounded against the previous path`, () => {
      for (const name of SYNTHETIC) {
        for (const ms of [50, 70, 90, 150]) {
          const { labels, total } = sequence(phonemesOf(name), ms / 1000);
          const a = jawMotion(render(payloadFor(labels, total, `${name}${ms}`), step), step);
          const b = jawMotion(withoutSealSpeed(() => render(payloadFor(labels, total, `${name}${ms}`), step)), step);
          // The follower ratio (40/24) bounds the speed-up; the measured worst is x1.48.
          expect(a.closing, `${name} ${ms}`).toBeLessThanOrEqual(b.closing * (40 / 24) + 1e-6);
          expect(a.closing, `${name} ${ms}`).toBeLessThanOrEqual(fps === 60 ? 300 : 250);
          expect(a.displacement, `${name} ${ms}`).toBeLessThanOrEqual(fps === 60 ? 5 : 8);
        }
      }
    });

    it(`${fps} fps: the first bilabial after the vowel never closes less than before, on any face`, () => {
      for (const name of SYNTHETIC) {
        for (const ms of [50, 70, 90, 150]) {
          const { labels, total } = sequence(phonemesOf(name), ms / 1000);
          const a = render(payloadFor(labels, total, `${name}${ms}`), step);
          const b = withoutSealSpeed(() => render(payloadFor(labels, total, `${name}${ms}`), step));
          const label = labels.find((l) => PP.has(l.phoneme))!;
          for (const face of faces) {
            const deepest = (frames: typeof a) =>
              Math.min(...frames.filter((f) => f.t >= label.start_time && f.t < label.end_time).map((f) => measureLips(face.model, face.lm, f.pose).apertureMM));
            expect(deepest(a), `${name} ${ms} ${face.id}`).toBeLessThanOrEqual(deepest(b) + 0.01);
            expect(deepest(a), `${name} ${ms} ${face.id}`).toBeGreaterThanOrEqual(face.mApex);
          }
        }
      }
    });
  }
});

(facesAvailable ? describe : describe.skip)("Step 3c continuity is preserved — P·B·M·P, every face", () => {
  const faces = facesAvailable ? loadFaces() : [];
  for (const fps of [60, 30]) {
    for (const ms of [50, 70, 90, 150]) {
      it(`${fps} fps, ${ms} ms: the internal-boundary lip gap is no larger than before${ms === 150 ? ", and the lips stay sealed" : ""}`, () => {
        const step = 1 / fps;
        const { labels, total } = sequence(["AH", "P", "B", "M", "P", "AH"], ms / 1000);
        const first = labels[2].start_time;
        const span = [first + ms / 1000 - 0.035, first + (3 * ms) / 1000 + 0.035];
        const a = render(payloadFor(labels, total, `pbmp${ms}`), step);
        const b = withoutSealSpeed(() => render(payloadFor(labels, total, `pbmp${ms}`), step));
        for (const face of faces) {
          const gap = (frames: typeof a) =>
            Math.max(...frames.filter((f) => f.t >= span[0] && f.t <= span[1]).map((f) => measureLips(face.model, face.lm, f.pose).apertureMM - face.seal));
          expect(gap(a), face.id).toBeLessThanOrEqual(gap(b) + 0.01);
          if (ms === 150) expect(gap(a), face.id).toBeLessThanOrEqual(0.1);
        }
      });
    }
  }
});
