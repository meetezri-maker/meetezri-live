import { describe, expect, it } from "vitest";
import {
  HYPER3D_PRODUCTION_HEAD_MOTION_SCALE,
  HYPER3D_PRODUCTION_HEAD_SOURCE,
  HYPER3D_PRODUCTION_PRESET,
  HYPER3D_PRODUCTION_PRESET_ID,
  HYPER3D_PRODUCTION_SPEAKING,
} from "./hyper3dProductionConfig";
import { BASELINE_HEAD, HYPER3D_BASELINE_SOURCES } from "./engine/mappings/avatars/hyper3dPerformanceBaseline";
import { p18Review } from "./engine/mappings/p17ReviewConfig";
import { conductorTunings } from "./engine/engine/animation/SpeechPerformanceConductor";
import { talkingHeadTunings } from "./engine/engine/animation/TalkingHeadSpeakingAdapter";

/**
 * Preset promotion contract.
 *
 * The Phase 2C decision was `hyper3d-presence`, promoted whole and unmixed. These
 * pin the identity and the resolved tunings, so swapping presets, mixing in a
 * second one, or inventing a Solace-specific variant fails the build rather than
 * changing the avatar quietly.
 */

describe("promoted production speaking preset", () => {
  it("is hyper3d-presence, by reference to the accepted source", () => {
    expect(HYPER3D_PRODUCTION_PRESET_ID).toBe("hyper3d-presence");
    // Identity, not equality: the promoted object IS the accepted one, so no
    // value can have been retyped or edited on the way through.
    expect(HYPER3D_PRODUCTION_PRESET).toBe(p18Review["hyper3d-presence"]);
  });

  it("carries the accepted preset's exact ids", () => {
    expect(HYPER3D_PRODUCTION_PRESET.conductorTuningId).toBe("hyper3dCoordinated");
    expect(HYPER3D_PRODUCTION_PRESET.talkingHeadTuningId).toBe("thFinal190");
    expect(HYPER3D_PRODUCTION_PRESET.speakingIdleFloor).toBe(0.18);
    // The preset's nulls are meaningful, not absences: a null motorTuning eases
    // the head toward the conductor's angles instead of integrating motor drive,
    // and a null profileId means the §P18 director is never consulted.
    expect(HYPER3D_PRODUCTION_PRESET.motorTuningId).toBeNull();
    expect(HYPER3D_PRODUCTION_PRESET.profileId).toBeNull();
  });

  it("resolves its tunings to the accepted objects", () => {
    expect(HYPER3D_PRODUCTION_SPEAKING.conductorTuning).toBe(
      conductorTunings.hyper3dCoordinated,
    );
    expect(HYPER3D_PRODUCTION_SPEAKING.motorTuning).toBeNull();
    expect(HYPER3D_PRODUCTION_SPEAKING.speakingMotionProfile).toBeNull();
    expect(HYPER3D_PRODUCTION_SPEAKING.speakingIdleFloor).toBe(0.18);
  });

  it("does NOT consult the preset's talkingHeadTuningId on this asset", () => {
    // STAGE 2.3: hardware rejected TALKINGHEAD ONLY as a motion generator for
    // hyper3d-usc, and the accepted call site hard-nulls it for this model even
    // though the preset still stores the 1.90x selection. Resolving it here
    // would re-enable a rejected generator, so this pins the gate.
    expect(HYPER3D_PRODUCTION_PRESET.talkingHeadTuningId).toBe("thFinal190");
    expect(HYPER3D_PRODUCTION_SPEAKING.talkingHeadTuning).toBeNull();
    expect(
      HYPER3D_PRODUCTION_SPEAKING.talkingHeadTuningIdStoredButNotConsulted,
    ).toBe("thFinal190");
    // The table still exists and still holds the accepted values — untouched.
    expect(talkingHeadTunings.thFinal190.cadence).toBe(1.9);
  });

  it("selects the threejs-talking-avatar head performance source", () => {
    // Promotion, not a default: the store ships "accepted". This is the source
    // every baseline artefact attributes the reviewed head/gaze/blink/affect to.
    expect(HYPER3D_PRODUCTION_HEAD_SOURCE).toBe("threejs-talking-avatar");
    expect(HYPER3D_BASELINE_SOURCES.head).toContain("hyper3dThreejsTalkingAvatarHead");
    expect(HYPER3D_BASELINE_SOURCES.gaze).toContain("threejs-talking-avatar");
    expect(HYPER3D_BASELINE_SOURCES.blink).toContain("threejs-talking-avatar");
    expect(HYPER3D_BASELINE_SOURCES.affectEnvelope).toContain("threejs-talking-avatar");
  });

  it("carries the accepted head motion scale by reference", () => {
    // BASELINE_HEAD is the canonical record; the live constant is the source of
    // truth. Asserting they agree is what stops either drifting alone.
    expect(HYPER3D_PRODUCTION_HEAD_MOTION_SCALE).toBe(BASELINE_HEAD.motionScale);
    expect(HYPER3D_PRODUCTION_HEAD_MOTION_SCALE).toBe(3);
  });

  it("keeps head source and talking-head carrier as INDEPENDENT controls", () => {
    // The whole point of the 2D decision: selecting the threejs head performance
    // source must NOT re-enable the rejected TalkingHead motion generator.
    expect(HYPER3D_PRODUCTION_HEAD_SOURCE).toBe("threejs-talking-avatar");
    expect(HYPER3D_PRODUCTION_SPEAKING.talkingHeadTuning).toBeNull();
  });

  it("is not p18Review.off — the avatar-test default is not production here", () => {
    // The whole reason this promotion exists: the accepted runtime ships `off`,
    // which engages neither the conductor nor the talking-head adapter.
    expect(HYPER3D_PRODUCTION_PRESET).not.toBe(p18Review.off);
    expect(HYPER3D_PRODUCTION_SPEAKING.conductorTuning).not.toBeNull();
    expect(HYPER3D_PRODUCTION_SPEAKING.speakingIdleFloor).toBe(0.18);
  });
});
