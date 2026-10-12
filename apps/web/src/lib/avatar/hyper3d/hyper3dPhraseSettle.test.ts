import { describe, expect, it } from "vitest";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { SpeechBoundaryTimeline } from "./engine/engine/timeline/SpeechBoundaryTimeline";
import {
  LIP_SHAPE_CHANNELS,
  MOUTH_SETTLE_CHANNELS,
  getMouthTransitionProfile,
  isLipShapeChannel,
  mouthTransitionProfiles,
  smoothingSpeedByRegion,
  type MouthTransitionProfile,
} from "./engine/mappings/avatarBlendshapeConfig";
import { hyper3dPresenceBaseline, hyper3dMorphCalibration } from "./engine/mappings/avatars/hyper3dCalibration";
import type { AvatarPayload } from "./engine/types/avatarPayload";

/**
 * FIX 2B — the sentence-pause soft settle and the lip-shape damper.
 *
 * Every case drives the SHIPPED mixer. `settling` is the boolean the controller
 * resolves from `SpeechBoundaryProximity.insidePauseKind`, so passing `false`
 * reproduces the pre-settle path exactly and is the negative control throughout.
 */

const DT = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;

function drive(
  targets: Array<Record<string, number>>,
  options: { mouth: MouthTransitionProfile | undefined; settling: boolean | Array<boolean> },
) {
  const mixer = new FacialPoseMixer();
  const out: Array<Record<string, number>> = [];
  targets.forEach((target, i) => {
    const mixed = mixer.combine([{ channel: "lipsync", pose: target }] as never);
    const settling = Array.isArray(options.settling) ? options.settling[i] : options.settling;
    out.push({ ...mixer.smooth(mixed.pose, DT, undefined, options.mouth, settling) });
  });
  return out;
}
const hold = (pose: Record<string, number>, frames: number) =>
  Array.from({ length: frames }, () => ({ ...pose }));

/** Travel above each channel's own usefulMin — "is anything visible at all". */
function visibleMM(pose: Record<string, number>) {
  let v = 0;
  for (const [n, val] of Object.entries(pose)) {
    const e = hyper3dMorphCalibration[n];
    if (e && val >= e.usefulMin) v += e.travelMM * val;
  }
  return v;
}

/** A payload whose only internal silence is `pauseMs` long. */
const payloadWithPause = (pauseMs: number): AvatarPayload => {
  const pause = pauseMs / 1000;
  return {
    phonemes: [
      { id: "1", phoneme: "AA", start_time: 0, end_time: 0.2, intensity: 1 },
      { id: "2", phoneme: "SIL", start_time: 0.2, end_time: 0.2 + pause, intensity: 1 },
      { id: "3", phoneme: "IY", start_time: 0.2 + pause, end_time: 0.4 + pause, intensity: 1 },
    ],
    pauses: [],
    audio_duration: 0.4 + pause,
  } as unknown as AvatarPayload;
};

describe("sentence-pause settle — the trigger", () => {
  it("a sentence pause reports its own kind, and a short gap does not", () => {
    // 850 ms: the measured median of a real sentence pause.
    const sentence = new SpeechBoundaryTimeline(payloadWithPause(850));
    expect(sentence.proximityAt(0.5)?.insidePause).toBe(true);
    expect(sentence.proximityAt(0.5)?.insidePauseKind).toBe("sentence");
    // 200 ms: a within-phrase gap. A boundary exists but it is not a sentence.
    const phrase = new SpeechBoundaryTimeline(payloadWithPause(200));
    expect(phrase.proximityAt(0.3)?.insidePauseKind).toBe("phrase");
    // 60 ms: below MINIMUM_PAUSE_SECONDS, so not a boundary at all.
    const tiny = new SpeechBoundaryTimeline(payloadWithPause(60));
    expect(tiny.proximityAt(0.23)?.insidePauseKind ?? null).toBeNull();
    // Outside any pause there is nothing to be inside of.
    expect(sentence.proximityAt(0.1)?.insidePauseKind).toBeNull();
  });

  it("`insidePauseKind` describes the pause BEHIND, not the boundary ahead", () => {
    // Two pauses of different kinds: a 200 ms phrase gap then an 850 ms sentence.
    const payload = {
      phonemes: [
        { id: "1", phoneme: "AA", start_time: 0, end_time: 0.2, intensity: 1 },
        { id: "2", phoneme: "SIL", start_time: 0.2, end_time: 0.4, intensity: 1 },
        { id: "3", phoneme: "IY", start_time: 0.4, end_time: 0.6, intensity: 1 },
        { id: "4", phoneme: "SIL", start_time: 0.6, end_time: 1.45, intensity: 1 },
        { id: "5", phoneme: "M", start_time: 1.45, end_time: 1.65, intensity: 1 },
      ],
      pauses: [],
      audio_duration: 1.65,
    } as unknown as AvatarPayload;
    const t = new SpeechBoundaryTimeline(payload);
    const inPhrase = t.proximityAt(0.3)!;
    // Inside the PHRASE gap while a SENTENCE boundary lies ahead. Gating on
    // `kind` here would settle during a 200 ms gap — the exact defect.
    expect(inPhrase.insidePauseKind).toBe("phrase");
    expect(inPhrase.kind).toBe("sentence");
    expect(t.proximityAt(1.0)!.insidePauseKind).toBe("sentence");
  });
});

describe("sentence-pause settle — the behaviour", () => {
  const speaking = hold({ jawOpen: 0.5, mouthStretchLeft: 0.4, mouthLowerDownLeft: 0.3 }, 20);
  const silent = hold({}, 60);

  it("does NOT settle to dead zero — it holds the presence posture", () => {
    const settled = drive([...speaking, ...silent], {
      mouth: PROFILE,
      settling: [...speaking.map(() => false), ...silent.map(() => true)],
    });
    const final = settled[settled.length - 1];
    // The accepted resting posture, reached rather than zero.
    expect(final.mouthSmileLeft).toBeCloseTo(hyper3dPresenceBaseline.mouthSmileLeft!, 2);
    expect(final.mouthSmileRight).toBeCloseTo(hyper3dPresenceBaseline.mouthSmileRight!, 2);
    expect(visibleMM(final)).toBeGreaterThan(0.35);
    // And the articulation itself IS released.
    expect(final.jawOpen ?? 0).toBeLessThan(0.01);
    expect(final.mouthStretchLeft ?? 0).toBeLessThan(0.01);
  });

  it("without the settle the mouth collapses to literally nothing", () => {
    const collapsed = drive([...speaking, ...silent], { mouth: PROFILE, settling: false });
    const final = collapsed[collapsed.length - 1];
    expect(visibleMM(final)).toBe(0);
    expect(final.mouthSmileLeft ?? 0).toBe(0);
  });

  it("reaches the settle smoothly over ~200-250 ms, with no snap", () => {
    const frames = [...speaking, ...silent];
    const settled = drive(frames, {
      mouth: PROFILE,
      settling: [...speaking.map(() => false), ...silent.map(() => true)],
    });
    // Monotonic approach on the posture channel: no overshoot, no snap.
    for (let i = speaking.length + 1; i < frames.length; i += 1) {
      const a = settled[i - 1].mouthSmileLeft ?? 0;
      const b = settled[i].mouthSmileLeft ?? 0;
      expect(b).toBeGreaterThanOrEqual(a - 1e-9);
      expect(b).toBeLessThanOrEqual(hyper3dPresenceBaseline.mouthSmileLeft! + 1e-9);
    }
    // 90 % of the way in the requested window rather than in one frame.
    const targetValue = hyper3dPresenceBaseline.mouthSmileLeft!;
    let reached = -1;
    for (let i = speaking.length; i < frames.length; i += 1) {
      if ((settled[i].mouthSmileLeft ?? 0) >= targetValue * 0.9) {
        reached = (i - speaking.length) * DT * 1000;
        break;
      }
    }
    expect(reached).toBeGreaterThan(150);
    expect(reached).toBeLessThan(300);
  });

  it("re-entry does not snap — the first speaking frame moves no further than an ordinary one", () => {
    const frames = [...speaking, ...hold({}, 40), ...speaking];
    const settling = [...speaking.map(() => false), ...hold({}, 40).map(() => true), ...speaking.map(() => false)];
    const out = drive(frames, { mouth: PROFILE, settling });
    const reentry = speaking.length + 40;
    const firstStep = Math.abs((out[reentry].jawOpen ?? 0) - (out[reentry - 1].jawOpen ?? 0));
    // An ordinary opening step from rest, for comparison.
    const plain = drive(speaking, { mouth: PROFILE, settling: false });
    const plainStep = Math.abs((plain[0].jawOpen ?? 0) - 0);
    expect(firstStep).toBeLessThanOrEqual(plainStep + 1e-9);
  });

  it("touches only articulation channels — brows, cheeks, gaze and blink are untouched", () => {
    const upper = { browInnerUp: 0.3, cheekSquintLeft: 0.2, eyeBlinkLeft: 0.4, eyeLookOutRight: 0.25 };
    const a = drive(hold(upper, 30), { mouth: PROFILE, settling: true });
    const b = drive(hold(upper, 30), { mouth: PROFILE, settling: false });
    for (let i = 0; i < 30; i += 1) {
      for (const channel of Object.keys(upper)) {
        expect(a[i][channel]).toBeCloseTo(b[i][channel], 12);
      }
    }
    // And every channel the settle may move is an articulation channel.
    for (const channel of MOUTH_SETTLE_CHANNELS) {
      expect(channel.startsWith("jaw") || channel.startsWith("mouth")).toBe(true);
    }
  });

  it("a model with no profile is unaffected by the settle flag", () => {
    const frames = [...speaking, ...silent];
    const withFlag = drive(frames, { mouth: undefined, settling: true });
    const without = drive(frames, { mouth: undefined, settling: false });
    expect(withFlag).toEqual(without);
    expect(getMouthTransitionProfile("female")).toBeUndefined();
    expect(getMouthTransitionProfile("miniface-male")).toBeUndefined();
    expect(Object.keys(mouthTransitionProfiles)).toEqual(["hyper3d-usc"]);
  });

  it("an undefined boundary cannot settle — `insidePauseKind` is null with no boundaries", () => {
    const noBoundaries = {
      phonemes: [{ id: "1", phoneme: "AA", start_time: 0, end_time: 0.3, intensity: 1 }],
      pauses: [],
      audio_duration: 0.3,
    } as unknown as AvatarPayload;
    expect(new SpeechBoundaryTimeline(noBoundaries).proximityAt(0.1)).toBeUndefined();
  });
});

describe("lip-shape damper", () => {
  it("is 24, and applies to exactly the measured channel set", () => {
    // 26 was implemented first and measured 33.5 / 77.0 against the accepted
    // G+I motion baseline of 32.1 / 74.2; 24 returns it to 32.7 / 74.7 for
    // under 2 % of the new geometry. See the sweep in `avatarBlendshapeConfig`.
    expect(PROFILE.lipShapeSpeed).toBe(24);
    expect(LIP_SHAPE_CHANNELS).toHaveLength(13);
    // The exclusions are the point: the seal and the jaw keep their speeds.
    for (const excluded of ["mouthClose", "mouthPressLeft", "mouthPressRight", "jawOpen", "jawForward"]) {
      expect(isLipShapeChannel(excluded)).toBe(false);
    }
    for (const included of ["mouthStretchLeft", "mouthPucker", "mouthUpperUpLeft", "mouthLowerDownRight"]) {
      expect(isLipShapeChannel(included)).toBe(true);
    }
  });

  it("slows lip shapes and leaves mouthClose and the jaw exactly as they were", () => {
    const targets = hold({ mouthStretchLeft: 0.5, mouthClose: 0.7, mouthPressLeft: 0.4, jawOpen: 0.4 }, 12);
    const damped = drive(targets, { mouth: PROFILE, settling: false });
    // A profile with no lip speed is the pre-2B path for the lip channels.
    const undamped = drive(targets, { mouth: { ...PROFILE, lipShapeSpeed: undefined }, settling: false });
    expect(damped[3].mouthStretchLeft).toBeLessThan(undamped[3].mouthStretchLeft!);
    for (const unchanged of ["mouthClose", "mouthPressLeft", "jawOpen"]) {
      for (let i = 0; i < targets.length; i += 1) {
        expect(damped[i][unchanged]).toBeCloseTo(undamped[i][unchanged], 12);
      }
    }
    // 24 against the accepted mouth speed of 28 — a damper, not a brake.
    expect(PROFILE.lipShapeSpeed).toBeLessThan(smoothingSpeedByRegion.mouth);
    expect(PROFILE.lipShapeSpeed).toBeGreaterThan(smoothingSpeedByRegion.mouth * 0.8);
  });
});

describe("G remains locked", () => {
  it("the asymmetric jaw is untouched by Fix 2B", () => {
    expect(PROFILE.openSpeed).toBe(24);
    expect(PROFILE.closeSpeed).toBe(9);
    expect(PROFILE.sealClosureThreshold).toBe(0.5);
    expect(PROFILE.openSpeed).toBe(smoothingSpeedByRegion.jaw);
  });

  it("jaw opening is still byte-identical to the symmetric path", () => {
    const targets = hold({ jawOpen: 0.5 }, 20);
    const asym = drive(targets, { mouth: PROFILE, settling: false });
    const sym = drive(targets, { mouth: undefined, settling: false });
    for (let i = 0; i < targets.length; i += 1) {
      expect(asym[i].jawOpen).toBeCloseTo(sym[i].jawOpen, 12);
    }
  });
});
