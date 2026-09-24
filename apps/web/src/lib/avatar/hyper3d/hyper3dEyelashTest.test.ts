import { describe, expect, it } from "vitest";
import {
  HYPER3D_EYELASH_TEST_CHANNELS,
  HYPER3D_EYELASH_TEST_DEFINITIONS,
  applyHyper3dEyelashTestPose,
  hyper3dEyelashTestChannels,
  type Hyper3dEyelashTestState,
} from "./hyper3dEyelashTest";
import { RESTING_LID_CLOSURE } from "./engine/engine/avatar/upstream/threejs-talking-avatar/performance";
import {
  HYPER3D_EYELASH_TARGETS,
  HYPER3D_EYELASH_TARGET_NAMES,
} from "./engine/mappings/avatars/hyper3dEyelashBinding";

const STATES = HYPER3D_EYELASH_TEST_DEFINITIONS.map((entry) => entry.id);

describe("hyper3d eyelash test harness", () => {
  it("offers exactly the controls the review asks for", () => {
    expect(STATES).toEqual([
      "runtime", "neutral", "blink",
      "lookLeft", "lookRight", "lookUp", "lookDown",
      "squint", "wide",
    ]);
  });

  it("never names a lash target — it drives semantic channels only", () => {
    // The whole point of the harness: if it could name a lash target it would
    // be testing itself rather than the production mapping.
    for (const state of STATES) {
      const written = Object.keys(hyper3dEyelashTestChannels(state as Hyper3dEyelashTestState, 1));
      for (const name of written) {
        expect(HYPER3D_EYELASH_TARGET_NAMES, `${state} writes lash target ${name}`).not.toContain(name);
        expect(HYPER3D_EYELASH_TEST_CHANNELS, `${state} writes non-eye channel ${name}`).toContain(name);
      }
    }
  });

  it("leaves the pose object untouched in runtime", () => {
    const pose = { eyeBlinkLeft: 0.4, jawOpen: 0.3 };
    expect(applyHyper3dEyelashTestPose(pose, "runtime", 1)).toBe(pose);
  });

  it("holds the accepted resting lid in neutral, and does not close it twice", () => {
    const channels = hyper3dEyelashTestChannels("neutral", 1);
    expect(channels.eyeBlinkLeft).toBe(RESTING_LID_CLOSURE);
    expect(channels.eyeBlinkRight).toBe(RESTING_LID_CLOSURE);
    expect(Object.keys(channels)).toHaveLength(2);
  });

  it("gives the lid to the slider in blink, across 0.0 / 0.5 / 1.0", () => {
    for (const value of [0, 0.5, 1]) {
      const channels = hyper3dEyelashTestChannels("blink", value);
      expect(channels.eyeBlinkLeft).toBe(value);
      expect(channels.eyeBlinkRight).toBe(value);
    }
  });

  it("uses the accepted gaze convention for left and right", () => {
    // `hyper3dGazePose` writes out-left + in-right for a gaze to the
    // character's LEFT. The harness must not invent its own pairing.
    const left = hyper3dEyelashTestChannels("lookLeft", 1);
    expect(left.eyeLookOutLeft).toBe(1);
    expect(left.eyeLookInRight).toBe(1);
    expect(left.eyeLookInLeft).toBeUndefined();
    expect(left.eyeLookOutRight).toBeUndefined();

    const right = hyper3dEyelashTestChannels("lookRight", 1);
    expect(right.eyeLookInLeft).toBe(1);
    expect(right.eyeLookOutRight).toBe(1);
    expect(right.eyeLookOutLeft).toBeUndefined();
    expect(right.eyeLookInRight).toBeUndefined();
  });

  it("clears every eye channel before pinning, so states cannot bleed", () => {
    const dirty: Record<string, number> = {};
    for (const channel of HYPER3D_EYELASH_TEST_CHANNELS) dirty[channel] = 0.9;
    const pinned = applyHyper3dEyelashTestPose(dirty, "lookUp", 1);
    expect(pinned.eyeLookUpLeft).toBe(1);
    expect(pinned.eyeLookUpRight).toBe(1);
    expect(pinned.eyeLookDownLeft).toBe(0);
    expect(pinned.eyeSquintLeft).toBe(0);
    expect(pinned.eyeWideRight).toBe(0);
  });

  it("touches nothing outside the eye channels", () => {
    // Head, jaw and warmth must keep running underneath, or the head-follow
    // check cannot be performed while an eye state is held still.
    const pose = { jawOpen: 0.42, mouthSmileLeft: 0.3, browInnerUp: 0.2 };
    const pinned = applyHyper3dEyelashTestPose(pose, "blink", 1);
    expect(pinned.jawOpen).toBe(0.42);
    expect(pinned.mouthSmileLeft).toBe(0.3);
    expect(pinned.browInnerUp).toBe(0.2);
  });

  it("covers every lash channel across the state set", () => {
    // Each of the 14 bound canonical channels must be reachable from some
    // button, or a lash target would go unreviewed.
    const reachable = new Set<string>();
    for (const state of STATES) {
      for (const [name, value] of Object.entries(hyper3dEyelashTestChannels(state as Hyper3dEyelashTestState, 1))) {
        if (value > 0) reachable.add(name);
      }
    }
    for (const channel of Object.keys(HYPER3D_EYELASH_TARGETS)) {
      expect(reachable, `${channel} is not reachable from any test control`).toContain(channel);
    }
  });

  it("clamps intensity to 0..1", () => {
    expect(hyper3dEyelashTestChannels("blink", 5).eyeBlinkLeft).toBe(1);
    expect(hyper3dEyelashTestChannels("blink", -3).eyeBlinkLeft).toBe(0);
  });
});
