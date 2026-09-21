import type { AvatarBehaviorState, BehaviorRange } from "../types/behaviorNaturalism";
import type { IdleExpressionEventId } from "./idleExpressionProfiles";

/**
 * Coordinated micro-expression library.
 *
 * Every event is authored as a small set of channels that each carry their own
 * time offset, so no two channels of an expression peak on the same frame. The
 * player interpolates each channel with a smoothstep entry, a short hold and a
 * slower release. Individual morphs are never randomised on their own.
 */
export type BehaviorEventSideMode = "both" | "primary" | "secondary";

export interface BehaviorEventChannel {
  /** Canonical morph name, or a `${name}Left`/`${name}Right` pair when `side` is used. */
  morph: string;
  /** Peak value before model intensity scaling. */
  peak: number;
  /** Seconds after the event start before this channel begins moving. */
  offset: number;
  /** How this channel relates to the chosen asymmetry side. */
  side?: BehaviorEventSideMode;
  /** Multiplies the release duration so some channels linger. */
  releaseScale?: number;
}

export interface BehaviorEventGazeChannel {
  yawDegrees: number;
  pitchDegrees: number;
  offset: number;
  /** Gaze returns before the rest of the face when true. */
  returnsFirst: boolean;
}

export interface BehaviorEventHeadChannel {
  pitchDegrees: number;
  yawDegrees: number;
  rollDegrees: number;
  offset: number;
  /** Head returns after the rest of the face when true. */
  returnsLast: boolean;
}

export interface BehaviorEventDefinition {
  id: IdleExpressionEventId;
  label: string;
  enterDuration: BehaviorRange;
  holdDuration: BehaviorRange;
  exitDuration: BehaviorRange;
  /** Minimum seconds before this specific event may run again. */
  cooldown: number;
  /** Events sharing a conflict group may not overlap. */
  conflictGroups: string[];
  allowedBehaviorStates: AvatarBehaviorState[];
  /** Whether the event applies left/right asymmetry at all. */
  asymmetric: boolean;
  channels: BehaviorEventChannel[];
  gaze?: BehaviorEventGazeChannel;
  head?: BehaviorEventHeadChannel;
}

const listeningOnly: AvatarBehaviorState[] = ["silent-listening"];
const listeningAndReturn: AvatarBehaviorState[] = ["silent-listening", "returning-to-listening"];

/**
 * Female peaks are authored before the model intensity preset and before the
 * idle safety scale, so they stay inside the ranges required for a resting face
 * that is hard to notice in a still frame.
 */
export const behaviorEventLibrary: Record<IdleExpressionEventId, BehaviorEventDefinition> = {
  "soft-warmth": {
    id: "soft-warmth",
    label: "Soft warmth",
    enterDuration: { min: 0.34, max: 0.52 },
    holdDuration: { min: 0.28, max: 0.62 },
    exitDuration: { min: 0.62, max: 0.98 },
    cooldown: 14,
    conflictGroups: ["mouth", "cheeks", "eyes"],
    allowedBehaviorStates: listeningAndReturn,
    asymmetric: true,
    channels: [
      // Eyes relax first, then one smile corner leads, cheeks follow, slow release.
      { morph: "eyeSquint", peak: 0.009, offset: 0, side: "both" },
      { morph: "mouthSmile", peak: 0.052, offset: 0.06, side: "primary", releaseScale: 1.15 },
      { morph: "mouthSmile", peak: 0.044, offset: 0.14, side: "secondary", releaseScale: 1.15 },
      { morph: "cheekSquint", peak: 0.024, offset: 0.26, side: "primary" },
      { morph: "cheekSquint", peak: 0.02, offset: 0.34, side: "secondary" }
    ],
    head: { pitchDegrees: 0, yawDegrees: -0.1, rollDegrees: -0.06, offset: 0.12, returnsLast: true }
  },
  "gentle-acknowledgment": {
    id: "gentle-acknowledgment",
    label: "Attentive acknowledgment",
    enterDuration: { min: 0.26, max: 0.4 },
    holdDuration: { min: 0.2, max: 0.46 },
    exitDuration: { min: 0.55, max: 0.86 },
    cooldown: 15,
    conflictGroups: ["brow", "head", "mouth"],
    allowedBehaviorStates: listeningAndReturn,
    asymmetric: true,
    channels: [
      // Brow begins, head starts ~120 ms later, cheek follows, smile appears last.
      { morph: "browOuterUp", peak: 0.036, offset: 0, side: "primary" },
      { morph: "browOuterUp", peak: 0.03, offset: 0.09, side: "secondary" },
      { morph: "cheekSquint", peak: 0.014, offset: 0.24, side: "primary" },
      { morph: "cheekSquint", peak: 0.012, offset: 0.31, side: "secondary" },
      { morph: "mouthSmile", peak: 0.022, offset: 0.38, side: "both", releaseScale: 1.15 }
    ],
    head: { pitchDegrees: 0.26, yawDegrees: 0, rollDegrees: 0.04, offset: 0.12, returnsLast: true }
  },
  "brief-curiosity": {
    id: "brief-curiosity",
    label: "Curious attention",
    enterDuration: { min: 0.28, max: 0.44 },
    holdDuration: { min: 0.22, max: 0.5 },
    exitDuration: { min: 0.5, max: 0.82 },
    cooldown: 17,
    conflictGroups: ["brow", "gaze", "head"],
    allowedBehaviorStates: listeningOnly,
    asymmetric: true,
    channels: [
      // Eyes move first (gaze channel), one brow rises, head tilts last.
      { morph: "browOuterUp", peak: 0.042, offset: 0.17, side: "primary" },
      { morph: "browInnerUp", peak: 0.014, offset: 0.23, side: "both" },
      { morph: "eyeWide", peak: 0.008, offset: 0.2, side: "primary" }
    ],
    gaze: { yawDegrees: -1.9, pitchDegrees: 0.4, offset: 0, returnsFirst: true },
    head: { pitchDegrees: -0.06, yawDegrees: -0.22, rollDegrees: -0.26, offset: 0.21, returnsLast: true }
  },
  "thoughtful-attention": {
    id: "thoughtful-attention",
    label: "Thoughtful listening",
    enterDuration: { min: 0.32, max: 0.5 },
    holdDuration: { min: 0.3, max: 0.66 },
    exitDuration: { min: 0.62, max: 0.95 },
    cooldown: 16,
    conflictGroups: ["brow", "gaze", "eyes"],
    allowedBehaviorStates: listeningOnly,
    asymmetric: true,
    channels: [
      { morph: "browInnerUp", peak: 0.03, offset: 0.16, side: "both" },
      { morph: "eyeSquint", peak: 0.013, offset: 0.26, side: "primary" },
      { morph: "eyeSquint", peak: 0.011, offset: 0.33, side: "secondary" }
    ],
    gaze: { yawDegrees: 1.6, pitchDegrees: -0.55, offset: 0, returnsFirst: true },
    head: { pitchDegrees: -0.12, yawDegrees: 0.16, rollDegrees: 0.08, offset: 0.2, returnsLast: true }
  },
  "neutral-reset": {
    id: "neutral-reset",
    label: "Neutral reset",
    enterDuration: { min: 0.3, max: 0.42 },
    holdDuration: { min: 0.14, max: 0.3 },
    exitDuration: { min: 0.55, max: 0.8 },
    cooldown: 8,
    conflictGroups: [],
    allowedBehaviorStates: ["silent-listening", "returning-to-listening"],
    asymmetric: false,
    channels: [{ morph: "browInnerUp", peak: 0.006, offset: 0, side: "both" }],
    gaze: { yawDegrees: 0, pitchDegrees: 0, offset: 0, returnsFirst: true },
    head: { pitchDegrees: 0, yawDegrees: 0, rollDegrees: 0, offset: 0.1, returnsLast: false }
  }
};

export const behaviorEventIds = Object.keys(behaviorEventLibrary) as IdleExpressionEventId[];

/** Peak amplitude of the loudest channel of an event, used by bounds tests. */
export const behaviorEventPeak = (id: IdleExpressionEventId) =>
  behaviorEventLibrary[id].channels.reduce((max, channel) => Math.max(max, channel.peak), 0);

/** Distinct channel offsets, used to prove channels do not peak on the same frame. */
export const behaviorEventOffsets = (id: IdleExpressionEventId) => {
  const definition = behaviorEventLibrary[id];
  const offsets = definition.channels.map((channel) => channel.offset);
  if (definition.gaze) offsets.push(definition.gaze.offset);
  if (definition.head) offsets.push(definition.head.offset);
  return offsets;
};
