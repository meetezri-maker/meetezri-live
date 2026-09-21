import { degreesToRadians } from "./avatarBlendshapeConfig";
import type { AvatarModelId } from "./avatarModelConfig";
import { hyper3dPresenceBaseline } from "./avatars/hyper3dCalibration";
import type { BlendshapePose, HeadRotationTarget } from "../types/facialAnimation";

export type IdleExpressionEventId = "gentle-acknowledgment" | "thoughtful-attention" | "soft-warmth" | "neutral-reset" | "brief-curiosity";

export interface IdleRange { min: number; max: number; }
export interface IdleBlinkProfile {
  interval: IdleRange;
  longInterval: IdleRange;
  longIntervalProbability: number;
  doubleBlinkProbability: number;
  close: IdleRange;
  hold: IdleRange;
  open: IdleRange;
  strength: number;
  asymmetrySeconds: number;
}
export interface IdleGazeProfile {
  interval: IdleRange;
  yawDegrees: IdleRange;
  pitchDegrees: IdleRange;
  rareYawDegrees: IdleRange;
  rareProbability: number;
  centerProbability: number;
  smoothingSpeed: number;
  microSaccade: number;
  morphPerDegree: number;
  yawSign: 1 | -1;
  pitchSign: 1 | -1;
}
export interface IdleMicroExpressionProfile {
  interval: IdleRange;
  settlingDelay: IdleRange;
  duration: IdleRange;
  weights: Record<IdleExpressionEventId, number>;
}
export interface IdleHeadProfile {
  enabled: boolean;
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  neckContribution: number;
  driftCycleSeconds: IdleRange;
  eventScale: number;
}
export interface IdleBreathingProfile {
  cycleSeconds: IdleRange;
  cheekAmplitude: number;
  eyelidAmplitude: number;
  headPitchDegrees: number;
}
export interface IdleTransitionProfile {
  idleToSpeakingSeconds: number;
  speakingToIdleSeconds: number;
  speechReducedExpressionWeight: number;
  speechReducedGazeWeight: number;
}
export interface IdleExpressionEventDefinition {
  id: IdleExpressionEventId;
  label: string;
  pose: BlendshapePose;
  gaze?: { yawDegrees: number; pitchDegrees: number };
  head?: HeadRotationTarget;
}
/**
 * Per-model gain applied to behaviour-layer expression output.
 *
 * Morph targets are not normalised across assets: on the female GLB a brow target
 * travels only 21-41% as far as a full blink at influence 1.0, so an influence
 * that reads as a clear expression on one model is invisible on another. These
 * gains convert the shared, normalised event library into per-asset travel.
 * The resting baseline deliberately does not receive them.
 */
export interface IdleExpressionChannelGain {
  brow: number;
  cheek: number;
  smile: number;
  eye: number;
}
export interface IdleNaturalismProfile {
  /** Opt-in to the coordinated human behaviour layer. */
  enabled: boolean;
  /** Gain for listening micro-expression channels. */
  expressionGain: IdleExpressionChannelGain;
  /** Gain for speaking upper-face emphasis, authored at larger peaks than events. */
  speechGain: IdleExpressionChannelGain;
  notes: string;
}
export interface IdleExpressionProfile {
  modelId: AvatarModelId;
  label: string;
  enabled: boolean;
  naturalism: IdleNaturalismProfile;
  baseline: BlendshapePose;
  blink: IdleBlinkProfile;
  gaze: IdleGazeProfile;
  microExpressions: IdleMicroExpressionProfile;
  headMotion: IdleHeadProfile;
  breathing: IdleBreathingProfile;
  transitions: IdleTransitionProfile;
  events: Record<IdleExpressionEventId, IdleExpressionEventDefinition>;
  disabledChannels: string[];
}

const headEvent = (pitchDeg = 0, yawDeg = 0, rollDeg = 0): HeadRotationTarget => ({
  pitch: degreesToRadians(pitchDeg),
  yaw: degreesToRadians(yawDeg),
  roll: degreesToRadians(rollDeg)
});

const currentEvents: Record<IdleExpressionEventId, IdleExpressionEventDefinition> = {
  "gentle-acknowledgment": {
    id: "gentle-acknowledgment",
    label: "Gentle acknowledgment",
    pose: { browOuterUpLeft: 0.018, browOuterUpRight: 0.018, cheekSquintLeft: 0.012, cheekSquintRight: 0.012, mouthSmileLeft: 0.018, mouthSmileRight: 0.018 },
    head: headEvent(0.32, 0, 0),
    gaze: { yawDegrees: 0, pitchDegrees: -0.4 }
  },
  "thoughtful-attention": {
    id: "thoughtful-attention",
    label: "Thoughtful attention",
    pose: { browInnerUp: 0.018, eyeSquintLeft: 0.012, eyeSquintRight: 0.012 },
    head: headEvent(-0.2, 0.25, 0.12),
    gaze: { yawDegrees: 1.2, pitchDegrees: 0.2 }
  },
  "soft-warmth": {
    id: "soft-warmth",
    label: "Soft warmth",
    pose: { mouthSmileLeft: 0.024, mouthSmileRight: 0.024, cheekSquintLeft: 0.015, cheekSquintRight: 0.015, eyeSquintLeft: 0.008, eyeSquintRight: 0.008 },
    head: headEvent(0, -0.15, -0.08)
  },
  "neutral-reset": {
    id: "neutral-reset",
    label: "Neutral reset",
    pose: { browInnerUp: 0.004, browOuterUpLeft: 0.004, browOuterUpRight: 0.004 },
    gaze: { yawDegrees: 0, pitchDegrees: 0 }
  },
  "brief-curiosity": {
    id: "brief-curiosity",
    label: "Brief curiosity",
    pose: { browOuterUpLeft: 0.022, browInnerUp: 0.01, eyeWideLeft: 0.006, eyeWideRight: 0.004 },
    head: headEvent(-0.08, -0.25, -0.32),
    gaze: { yawDegrees: -1.4, pitchDegrees: 0.35 }
  }
};

const femaleEvents: Record<IdleExpressionEventId, IdleExpressionEventDefinition> = {
  "gentle-acknowledgment": {
    ...currentEvents["gentle-acknowledgment"],
    pose: { browOuterUpLeft: 0.022, browOuterUpRight: 0.022, cheekSquintLeft: 0.014, cheekSquintRight: 0.014, mouthSmileLeft: 0.02, mouthSmileRight: 0.02 },
    head: headEvent(0.26, 0, 0)
  },
  "thoughtful-attention": {
    ...currentEvents["thoughtful-attention"],
    pose: { browInnerUp: 0.022, eyeSquintLeft: 0.01, eyeSquintRight: 0.01 },
    head: headEvent(-0.16, 0.22, 0.1)
  },
  "soft-warmth": {
    ...currentEvents["soft-warmth"],
    pose: { mouthSmileLeft: 0.028, mouthSmileRight: 0.028, cheekSquintLeft: 0.017, cheekSquintRight: 0.017, eyeSquintLeft: 0.008, eyeSquintRight: 0.008 },
    head: headEvent(0, -0.12, -0.06)
  },
  "neutral-reset": currentEvents["neutral-reset"],
  "brief-curiosity": {
    ...currentEvents["brief-curiosity"],
    pose: { browOuterUpLeft: 0.024, browInnerUp: 0.012, eyeWideLeft: 0.005, eyeWideRight: 0.004 },
    head: headEvent(-0.06, -0.2, -0.24)
  }
};

const tunedIdleProfiles = {
  "miniface-male": {
    modelId: "miniface-male",
    label: "Current avatar calm attentive",
    enabled: true,
    naturalism: {
      enabled: false,
      expressionGain: { brow: 1, cheek: 1, smile: 1, eye: 1 },
      speechGain: { brow: 1, cheek: 1, smile: 1, eye: 1 },
      notes: "Current avatar keeps the accepted shipped idle path unchanged; the naturalism refinement targets the female avatar."
    },
    baseline: { mouthSmileLeft: 0.016, mouthSmileRight: 0.016, cheekSquintLeft: 0.008, cheekSquintRight: 0.008, browInnerUp: 0.008, browOuterUpLeft: 0.01, browOuterUpRight: 0.01, eyeSquintLeft: 0.006, eyeSquintRight: 0.006 },
    blink: { interval: { min: 2.8, max: 6.4 }, longInterval: { min: 6.5, max: 8.8 }, longIntervalProbability: 0.16, doubleBlinkProbability: 0.07, close: { min: 0.075, max: 0.12 }, hold: { min: 0.025, max: 0.06 }, open: { min: 0.11, max: 0.18 }, strength: 1, asymmetrySeconds: 0.012 },
    gaze: { interval: { min: 3.2, max: 7.6 }, yawDegrees: { min: -4.5, max: 4.5 }, pitchDegrees: { min: -2.2, max: 2.6 }, rareYawDegrees: { min: -6.2, max: 6.2 }, rareProbability: 0.12, centerProbability: 0.32, smoothingSpeed: 2.1, microSaccade: 0.08, morphPerDegree: 0.024, yawSign: 1, pitchSign: 1 },
    microExpressions: { interval: { min: 5.8, max: 12 }, settlingDelay: { min: 1.8, max: 3.8 }, duration: { min: 0.85, max: 2 }, weights: { "gentle-acknowledgment": 0.24, "thoughtful-attention": 0.24, "soft-warmth": 0.2, "neutral-reset": 0.18, "brief-curiosity": 0.14 } },
    headMotion: { enabled: true, yawDegrees: 0.72, pitchDegrees: 0.48, rollDegrees: 0.32, neckContribution: 0.24, driftCycleSeconds: { min: 4.2, max: 5.7 }, eventScale: 0.72 },
    breathing: { cycleSeconds: { min: 4.1, max: 5.4 }, cheekAmplitude: 0.0025, eyelidAmplitude: 0.002, headPitchDegrees: 0.12 },
    transitions: { idleToSpeakingSeconds: 0.22, speakingToIdleSeconds: 0.62, speechReducedExpressionWeight: 0.2, speechReducedGazeWeight: 0.35 },
    events: currentEvents,
    disabledChannels: []
  },
  female: {
    modelId: "female",
    label: "Female calm attentive",
    enabled: true,
    naturalism: {
      enabled: true,
      // Calibrated so a listening event lands near 10-15% of full blink travel,
      // which is the point at which the movement reads without looking staged.
      // Derived from the measured travel of each target on this GLB.
      // Cheek is pushed close to saturation because this asset's cheekSquint
      // travels only ~0.39 local units at influence 1.0 and lands on smooth,
      // low-contrast skin. Even at the ceiling it renders about 1.9 px at the
      // shipped camera framing, against 7.4 px for a blink.
      expressionGain: { brow: 7.3, cheek: 26, smile: 6.3, eye: 4 },
      // Speaking emphasis is authored at larger peaks than listening events, so it
      // needs a correspondingly smaller gain to land in the same visible band.
      speechGain: { brow: 2.2, cheek: 8.5, smile: 3.4, eye: 2 },
      notes: "Female avatar runs the coordinated human behaviour layer: one state machine, one scheduler, one seeded random source."
    },
    // Neutral-positive rest. Deliberately hard to notice in a still frame; its
    // job is to prevent facial deadness, not to read as an expression.
    baseline: { mouthSmileLeft: 0.014, mouthSmileRight: 0.014, cheekSquintLeft: 0.009, cheekSquintRight: 0.009, browInnerUp: 0.01, browOuterUpLeft: 0.009, browOuterUpRight: 0.009, eyeSquintLeft: 0.004, eyeSquintRight: 0.004 },
    blink: { interval: { min: 2.7, max: 6.2 }, longInterval: { min: 6.7, max: 9 }, longIntervalProbability: 0.14, doubleBlinkProbability: 0.06, close: { min: 0.078, max: 0.125 }, hold: { min: 0.025, max: 0.065 }, open: { min: 0.115, max: 0.185 }, strength: 0.96, asymmetrySeconds: 0.01 },
    gaze: { interval: { min: 3.4, max: 8 }, yawDegrees: { min: -4.2, max: 4.2 }, pitchDegrees: { min: -2, max: 2.4 }, rareYawDegrees: { min: -5.8, max: 5.8 }, rareProbability: 0.1, centerProbability: 0.36, smoothingSpeed: 2, microSaccade: 0.07, morphPerDegree: 0.022, yawSign: 1, pitchSign: 1 },
    microExpressions: { interval: { min: 6.2, max: 12.5 }, settlingDelay: { min: 2, max: 4 }, duration: { min: 0.9, max: 2.1 }, weights: { "gentle-acknowledgment": 0.24, "thoughtful-attention": 0.24, "soft-warmth": 0.22, "neutral-reset": 0.17, "brief-curiosity": 0.13 } },
    headMotion: { enabled: true, yawDegrees: 0.62, pitchDegrees: 0.42, rollDegrees: 0.26, neckContribution: 0.2, driftCycleSeconds: { min: 4.4, max: 5.9 }, eventScale: 0.62 },
    breathing: { cycleSeconds: { min: 4.3, max: 5.7 }, cheekAmplitude: 0.002, eyelidAmplitude: 0.0018, headPitchDegrees: 0.1 },
    transitions: { idleToSpeakingSeconds: 0.24, speakingToIdleSeconds: 0.72, speechReducedExpressionWeight: 0.18, speechReducedGazeWeight: 0.32 },
    events: femaleEvents,
    disabledChannels: ["viseme_*"]
  }
} satisfies Partial<Record<AvatarModelId, IdleExpressionProfile>>;

export const idleExpressionProfiles: Record<AvatarModelId, IdleExpressionProfile> = {
  ...tunedIdleProfiles,
  /**
   * Hyper3D. Disabled through PHASE H1 (a rendering-only integration), enabled in
   * the HC calibration pass because that brief asks for blink timing, expression
   * state logic, gaze intent and the approved head/neck output to run on this
   * asset. With `enabled: false` the controller takes its hard-blocked path and
   * emits nothing at all — which also holds `HeadMotionPose.active` low, so the
   * head and neck bones never move. That was correct for H1 and is exactly what
   * HC4 needs to measure, so it is on here.
   *
   * The VALUES are the current avatar's, deliberately unmodified: the calibration
   * pass tunes the asset through `hyper3dCalibration`, not by editing approved
   * idle behaviour. Blink, gaze cadence and micro-expression scheduling are
   * therefore byte-identical to the accepted profile.
   */
  "hyper3d-usc": {
    ...tunedIdleProfiles["miniface-male"],
    modelId: "hyper3d-usc",
    label: "Hyper3D USC (approved idle timing, asset-calibrated amplitudes)",
    enabled: true,
    /**
     * PRESENCE PASS. This was inherited as `enabled: false` from the current
     * avatar, and that single flag was why Hyper3D had no expression
     * coordination at all: `HumanBehaviorController` is the layer that consumes
     * the conductor's `speechPerformance` intent and turns it into coordinated
     * brow / cheek / mouth warmth, and it only runs when this is on. Measured
     * live, `idleExpression.humanBehavior` was undefined on every frame and
     * `conducted.active` never became true, no matter which conductor tuning was
     * selected. Turning it on is what connects speech intent to the face.
     *
     * The gains are DERIVED, not copied. Female.228 needs 7.3 / 26 / 6.3 / 4
     * because its geometry is weak — its cheekSquint renders about 1.9 px at the
     * shipped framing. Hyper3D's cheekSquint travels 5.79 mm and its smile
     * 16.19 mm, so reusing those numbers would saturate the face.
     *
     * Instead each gain puts the LARGEST authored event for that group at ~35% of
     * the channel's measured `naturalMax`, with the median comfortably above its
     * `usefulMin`:
     *
     *   group   authored median / peak   x gain   ->  rendered median
     *   brow      0.0180 / 0.0220          7.2        0.129   (band 0.05-0.45)
     *   cheek     0.0150 / 0.0150         10.5        0.158   (band 0.06-0.45)
     *   smile     0.0240 / 0.0240          6.6        0.158   (band 0.03-0.45)
     *   eye       0.0080 / 0.0120         10.2        0.082   (band 0.08-0.35)
     *
     * `speechGain` keeps the same ~0.33 ratio to `expressionGain` that the
     * approved female profile uses, because speaking emphasis is authored at
     * larger peaks than listening events. The HC1 caps still apply after this, so
     * no gain here can drive a channel past its production ceiling.
     */
    naturalism: {
      enabled: true,
      expressionGain: { brow: 7.2, cheek: 10.5, smile: 6.6, eye: 10.2 },
      speechGain: { brow: 2.4, cheek: 3.5, smile: 2.2, eye: 3.4 },
      notes: "Hyper3D runs the coordinated human behaviour layer. Gains derived from this asset's measured travel, not ported from Female.228."
    },
    /**
     * PRESENCE PASS. The only field that differs from the inherited profile.
     * TIMING is untouched — blink intervals, gaze cadence, micro-expression
     * scheduling and head-motion rates are all still the approved values. This
     * is an amplitude calibration for one asset, of the same kind as the HC1
     * morph table, and it exists because the inherited amplitudes measure below
     * this geometry's visibility threshold. See `hyper3dPresenceBaseline`.
     */
    baseline: hyper3dPresenceBaseline
  }
};

export const idleExpressionEventIds = Object.keys(currentEvents) as IdleExpressionEventId[];