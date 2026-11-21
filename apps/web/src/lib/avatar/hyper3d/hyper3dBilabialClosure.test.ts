import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lipLandmarks, loadLipModel, measureLips, type LipLandmarks, type LipModel } from "./hyper3dLipGeometry";
import { LIP_BASELINE_ASSETS, type LipBaselineAssetId } from "./hyper3dLipBaseline";
import { createHyper3dPerformance, resolveHyper3dFrame } from "./hyper3dFrameOrchestrator";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { ActivePresenceDirector } from "./engine/engine/avatar/hyper3dActivePresence";
import { Hyper3dWarmthYieldFollower } from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { buildThreejsTalkingAvatarHeadPlan } from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import { avatarModelConfigs } from "./engine/mappings/avatarModelConfig";
import {
  ACCEPTED_LIVE_BEHAVIOUR,
  ACCEPTED_LIVE_BEHAVIOUR_SETTINGS,
  ACCEPTED_LIVE_PLAYBACK
} from "./liveAvatarPayload";
import { CORPUS_PAYLOADS, loadPayload } from "./hyper3dDeadlineCorpus";
import type { AvatarPayload } from "./engine/types/avatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2, STEP 3a — BILABIAL CLOSURE IN CONNECTED SPEECH.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The static baseline (`hyper3dLipBaseline`) proves each P/B/M apex closes. This
 * file asks the question the audit found was failing: does the lip CLOSE during
 * a real P/B/M label, through the full production frame — coarticulation, the
 * bilabial seal, the mixer and its follower, the facial-liveliness warmth and
 * Active Presence — exactly as `resolveHyper3dFrame` produces it at 60 Hz?
 *
 * CLOSED means any frame inside the label comes within 0.5 mm of the face's own
 * seal reference (`mouthClose` 0.10 alone, the calibration's measured optimum).
 *
 * The "before" figures are the measurements taken in the Step 3 audit with the
 * pre-3a poses; this file pins the improvement and the costs it may not exceed.
 */

const CONFIG = avatarModelConfigs["hyper3d-usc"];
const STEP = 1 / 60;
const CLOSED_MM = 0.5;
const BILABIAL = new Set(["P", "B", "M"]);
const VOWEL = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"]);
const norm = (p: string) => p.replace(/[0-2]$/, "").toUpperCase();

/** Step 3 audit, pre-3a, original Romy, the four aligned corpus payloads. */
const BEFORE_ROMY = { closed: 12, total: 50, vowelBeforeBilabialMeanMM: 9.574 } as const;

type Face = { id: LipBaselineAssetId; model: LipModel; lm: LipLandmarks; seal: number };
const faceFor = (id: LipBaselineAssetId): Face => {
  const model = loadLipModel(LIP_BASELINE_ASSETS[id]);
  const lm = lipLandmarks(model);
  return { id, model, lm, seal: measureLips(model, lm, { mouthClose: 0.1 }).apertureMM };
};
const apertureVsSeal = (face: Face, pose: BlendshapePose) => measureLips(face.model, face.lm, pose).apertureMM - face.seal;

/** The production frame, frame by frame, with a live-like (no affect request) plan. */
function render(payload: AvatarPayload) {
  const controller = new AvatarController(payload);
  const performance = createHyper3dPerformance();
  const activePresence = new ActivePresenceDirector(payload.performance_seed ?? payload.id);
  const warmthYield = new Hyper3dWarmthYieldFollower();
  const plan = buildThreejsTalkingAvatarHeadPlan({
    text: payload.text,
    phonemes: payload.phonemes,
    acousticFrames: [],
    durationSeconds: payload.audio_duration,
    segmentIntent: true
  });
  const frames: { t: number; pose: BlendshapePose }[] = [];
  const count = Math.floor(payload.audio_duration / STEP);
  for (let i = 0; i <= count; i += 1) {
    const t = i * STEP;
    const resolved = resolveHyper3dFrame(
      { config: CONFIG, controller, performance, activePresence, warmthYield, headSupported: true },
      { timeSeconds: t, deltaSeconds: STEP, isSpeaking: true, plan, acousticFrames: [] }
    );
    frames.push({ t, pose: { ...resolved.pose } });
  }
  return frames;
}

type Label = { phoneme: string; start_time: number; end_time: number };
const framesIn = (frames: ReturnType<typeof render>, label: Label) =>
  frames.filter((frame) => frame.t >= label.start_time && frame.t < label.end_time);

function synthetic(id: string, sequence: [string, number][]): AvatarPayload {
  const phonemes: (Label & { intensity: number })[] = [];
  let t = 0;
  const push = (phoneme: string, seconds: number) => {
    phonemes.push({ phoneme, start_time: +t.toFixed(4), end_time: +(t + seconds).toFixed(4), intensity: 1 });
    t += seconds;
  };
  push("SIL", 0.3);
  for (const [phoneme, seconds] of sequence) push(phoneme, seconds);
  push("SIL", 0.4);
  return {
    version: "1.0", id, text: id, language: "en-US", audio_duration: t, phoneme_set: "arpabet", time_unit: "seconds",
    playback: { ...ACCEPTED_LIVE_PLAYBACK }, phonemes, emotions: [], facial_cues: [], pauses: [],
    behaviour: ACCEPTED_LIVE_BEHAVIOUR, behaviour_settings: ACCEPTED_LIVE_BEHAVIOUR_SETTINGS, markers: [],
    metadata: { avatar_id: "hyper3d-usc", created_at: new Date(0).toISOString(), source: "test", description: id },
    performance_seed: id
  } as unknown as AvatarPayload;
}

const corpusAvailable = CORPUS_PAYLOADS.every((entry) => existsSync(entry.path));
const romyAvailable = existsSync(LIP_BASELINE_ASSETS.hyper3d_arfv2);

(corpusAvailable && romyAvailable ? describe : describe.skip)("connected speech — the aligned corpus, original Romy", () => {
  const romy = romyAvailable ? faceFor("hyper3d_arfv2") : (null as unknown as Face);
  const stats = { closed: 0, total: 0, byPhoneme: {} as Record<string, { closed: number; total: number }>, deepest: Infinity, vowelBefore: [] as number[] };
  if (corpusAvailable && romyAvailable) {
    for (const entry of CORPUS_PAYLOADS) {
      const payload = loadPayload(entry.path);
      const frames = render(payload);
      const labels = payload.phonemes as Label[];
      labels.forEach((label, index) => {
        const name = norm(label.phoneme);
        const inside = framesIn(frames, label);
        if (!inside.length) return;
        const apertures = inside.map((frame) => apertureVsSeal(romy, frame.pose));
        if (BILABIAL.has(name)) {
          const closed = apertures.some((value) => value <= CLOSED_MM);
          stats.total += 1;
          if (closed) stats.closed += 1;
          const bucket = (stats.byPhoneme[name] ??= { closed: 0, total: 0 });
          bucket.total += 1;
          if (closed) bucket.closed += 1;
          stats.deepest = Math.min(stats.deepest, ...apertures);
        } else if (VOWEL.has(name)) {
          const next = labels[index + 1];
          if (next && BILABIAL.has(norm(next.phoneme))) stats.vowelBefore.push(Math.max(...apertures));
        }
      });
    }
  }
  const vowelBeforeMean = stats.vowelBefore.reduce((a, b) => a + b, 0) / Math.max(1, stats.vowelBefore.length);

  it("prints the closure summary", () => {
    console.info(
      `[bilabial closure] Romy closed ${stats.closed}/${stats.total} (before ${BEFORE_ROMY.closed}/${BEFORE_ROMY.total});`,
      Object.entries(stats.byPhoneme).map(([p, b]) => `${p} ${b.closed}/${b.total}`).join(", "),
      `| deepest ${stats.deepest.toFixed(2)} mm | vowel-before-bilabial mean ${vowelBeforeMean.toFixed(3)} mm (before ${BEFORE_ROMY.vowelBeforeBilabialMeanMM})`
    );
    expect(stats.total).toBe(BEFORE_ROMY.total);
  });

  it("closes far more P/B/M labels than before Step 3a (12 -> 21 of 50)", () => {
    expect(stats.closed).toBeGreaterThanOrEqual(21);
    // Recorded with 3a: P 1 -> 9 of 20, B 0 -> 1 of 14, M 11 of 16 unchanged
    // (M's pose is not touched). B stays low: most B labels follow a vowel
    // whose jaw the follower has not cleared — the Step 3b question.
    expect(stats.byPhoneme.P?.closed).toBeGreaterThanOrEqual(9);
    expect(stats.byPhoneme.B?.closed).toBeGreaterThanOrEqual(1);
    expect(stats.byPhoneme.M?.closed).toBe(11);
  });

  it("never drives the lips more than 1.5 mm past the seal (no pass-through)", () => {
    expect(stats.deepest).toBeGreaterThanOrEqual(-1.5);
  });

  it("costs the vowel before a bilabial no more than 0.1 mm of opening", () => {
    expect(vowelBeforeMean).toBeGreaterThanOrEqual(BEFORE_ROMY.vowelBeforeBilabialMeanMM - 0.1);
  });
});

/**
 * The transitions the audit traced, on every face. Each row is the deepest
 * aperture (mm vs seal) inside the named label on original Romy: `beforeRomy`
 * with the pre-3a poses (Step 3 audit), `afterRomy` as recorded with 3a.
 *
 * READ THE OPEN-VOWEL ROWS HONESTLY. P/B straight after AA / AE improve by
 * 0.3-0.85 mm but still do not close (1.6-2.1 mm): the jaw the follower is still
 * carrying from the vowel is the limit there, which is Step 3b's question, not
 * a pose question. These rows pin that remaining gap so a later step shows up
 * here as a measured change.
 */
/*
 * STEP 3c moved the two rows whose bilabial TOUCHES another bilabial: the bridge
 * holds the first one's closure toward its neighbour, so it closes further.
 * "top man" P 2.12 -> 1.92 mm and "rib pin" B 0.50 -> 0.40 mm on Romy, the same
 * direction on every face. Rows with no touching bilabial are unchanged.
 */
const SEQUENCES: { id: string; sequence: [string, number][]; label: number; beforeRomy: number; afterRomy: number }[] = [
  { id: "P after AA — top man", sequence: [["AA", 0.12], ["P", 0.08], ["M", 0.09], ["AE", 0.12]], label: 1, beforeRomy: 2.97, afterRomy: 1.92 },
  { id: "B after AE — ab", sequence: [["AE", 0.14], ["B", 0.09]], label: 1, beforeRomy: 1.94, afterRomy: 1.64 },
  { id: "P mid-word — happy", sequence: [["HH", 0.06], ["AE", 0.1], ["P", 0.07], ["IY", 0.12]], label: 2, beforeRomy: 2.49, afterRomy: 2.04 },
  { id: "B after IH — rib pin", sequence: [["IH", 0.1], ["B", 0.07], ["P", 0.08], ["IH", 0.1]], label: 1, beforeRomy: 0.81, afterRomy: 0.4 },
  { id: "M after AH — some big", sequence: [["AH", 0.12], ["M", 0.08], ["B", 0.07], ["IH", 0.1]], label: 1, beforeRomy: -0.11, afterRomy: -0.12 }
];

(romyAvailable ? describe : describe.skip)("connected speech — traced transitions, every face", () => {
  const faces = (Object.keys(LIP_BASELINE_ASSETS) as LipBaselineAssetId[])
    .filter((id) => existsSync(LIP_BASELINE_ASSETS[id]))
    .map(faceFor);

  for (const entry of SEQUENCES) {
    it(`${entry.id}: Romy ${entry.beforeRomy} -> ${entry.afterRomy} mm, and no face passes the seal by > 1.5 mm`, () => {
      const payload = synthetic(entry.id, entry.sequence);
      const frames = render(payload);
      const label = (payload.phonemes as Label[])[entry.label + 1]; // +1 for the leading SIL
      const inside = framesIn(frames, label);
      const deepest = Object.fromEntries(
        faces.map((face) => [face.id, Math.min(...inside.map((frame) => apertureVsSeal(face, frame.pose)))])
      );
      console.info(`[bilabial closure] ${entry.id}:`, Object.entries(deepest).map(([id, v]) => `${id.replace("hyper3d_", "")} ${v.toFixed(2)}`).join("  "));
      const romy = deepest.hyper3d_arfv2;
      expect(Math.abs(romy - entry.afterRomy)).toBeLessThanOrEqual(0.01);
      expect(romy).toBeLessThanOrEqual(entry.beforeRomy + 0.01); // never worse than before
      for (const value of Object.values(deepest)) expect(value).toBeGreaterThanOrEqual(-1.5);
    });
  }
});
