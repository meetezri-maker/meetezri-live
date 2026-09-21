import type { BlendshapePose } from "./engine/types/facialAnimation";

export const HYPER3D_IDLE_EXPRESSION_SHOWCASE_FLAG = "VITE_HYPER3D_IDLE_EXPRESSION_SHOWCASE";
export const HYPER3D_IDLE_EXPRESSION_SHOWCASE_DURATION_SECONDS = 60;
export const HYPER3D_IDLE_EXPRESSION_SHOWCASE_SEGMENT_SECONDS = 5;
export const HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK = 0.8;

export type Hyper3dIdleShowcaseExpressionId =
  | "neutral"
  | "smile"
  | "laugh"
  | "happy"
  | "surprise"
  | "curious"
  | "thinking"
  | "concerned"
  | "sad"
  | "angry"
  | "playful"
  | "return_to_neutral";

export type Hyper3dIdleShowcaseYieldReason =
  | "disabled"
  | "speaking"
  | "listening"
  | "thinking"
  | "processing"
  | "interrupted"
  | "audio_active"
  | "not_idle";

export type Hyper3dIdleShowcasePhase = "entry" | "hold" | "release";

export type Hyper3dIdleShowcaseDominantChannel = {
  name: string;
  target: number;
};

export type Hyper3dIdleShowcaseDefinition = {
  id: Hyper3dIdleShowcaseExpressionId;
  label: string;
  pose: Readonly<BlendshapePose>;
  primary: readonly Hyper3dIdleShowcaseDominantChannel[];
};

export type Hyper3dIdleShowcaseDiagnostics = {
  enabled: boolean;
  eligible: boolean;
  cycleTimeSeconds: number;
  cycleNumber: number;
  currentExpression: Hyper3dIdleShowcaseExpressionId;
  nextExpression: Hyper3dIdleShowcaseExpressionId;
  phase: Hyper3dIdleShowcasePhase;
  phaseProgress: number;
  dominantChannels: readonly Hyper3dIdleShowcaseDominantChannel[];
  dominantPeakTarget: number;
  currentDominantValue: number;
  maxDominantValueObserved: number;
  minimumPeakRequirement: typeof HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK;
  lastYieldReason: Hyper3dIdleShowcaseYieldReason | null;
  loopCount: number;
  expressionPeaks: Record<Hyper3dIdleShowcaseExpressionId, number>;
};

export type Hyper3dIdleShowcaseSample = {
  active: boolean;
  pose: BlendshapePose;
  diagnostics: Hyper3dIdleShowcaseDiagnostics;
};

export type Hyper3dIdleShowcaseRuntime = {
  sample(input: {
    eligible: boolean;
    elapsedSeconds: number;
    yieldReason?: Hyper3dIdleShowcaseYieldReason | null;
  }): Hyper3dIdleShowcaseSample;
  getDiagnostics(): Hyper3dIdleShowcaseDiagnostics;
};

const raw = (pose: BlendshapePose): Readonly<BlendshapePose> => Object.freeze({ ...pose });
const primary = (...channels: Hyper3dIdleShowcaseDominantChannel[]) => Object.freeze(channels.map((channel) => ({ ...channel })));

export const HYPER3D_IDLE_SHOWCASE_DEFINITIONS = Object.freeze([
  {
    id: "neutral",
    label: "Neutral",
    pose: raw({}),
    primary: primary(),
  },
  {
    id: "smile",
    label: "Smile",
    pose: raw({
      mouthSmileLeft: 0.84,
      mouthSmileRight: 0.84,
      cheekSquintLeft: 0.36,
      cheekSquintRight: 0.36,
      eyeSquintLeft: 0.16,
      eyeSquintRight: 0.16,
    }),
    primary: primary(
      { name: "mouthSmileLeft", target: 0.84 },
      { name: "mouthSmileRight", target: 0.84 },
    ),
  },
  {
    id: "laugh",
    label: "Laugh",
    pose: raw({
      mouthSmileLeft: 0.9,
      mouthSmileRight: 0.9,
      jawOpen: 0.68,
      mouthUpperUpLeft: 0.34,
      mouthUpperUpRight: 0.34,
      mouthLowerDownLeft: 0.18,
      mouthLowerDownRight: 0.18,
      mouthStretchLeft: 0.2,
      mouthStretchRight: 0.2,
      cheekSquintLeft: 0.62,
      cheekSquintRight: 0.62,
      eyeSquintLeft: 0.38,
      eyeSquintRight: 0.38,
    }),
    primary: primary(
      { name: "mouthSmileLeft", target: 0.9 },
      { name: "mouthSmileRight", target: 0.9 },
    ),
  },
  {
    id: "happy",
    label: "Happy",
    pose: raw({
      mouthSmileLeft: 0.82,
      mouthSmileRight: 0.82,
      cheekSquintLeft: 0.42,
      cheekSquintRight: 0.42,
      eyeSquintLeft: 0.14,
      eyeSquintRight: 0.14,
      browOuterUpLeft: 0.16,
      browOuterUpRight: 0.16,
    }),
    primary: primary(
      { name: "mouthSmileLeft", target: 0.82 },
      { name: "mouthSmileRight", target: 0.82 },
    ),
  },
  {
    id: "surprise",
    label: "Surprise",
    pose: raw({
      eyeWideLeft: 0.86,
      eyeWideRight: 0.86,
      browOuterUpLeft: 0.72,
      browOuterUpRight: 0.72,
      browInnerUp: 0.54,
      jawOpen: 0.42,
      mouthFunnel: 0.26,
    }),
    primary: primary(
      { name: "eyeWideLeft", target: 0.86 },
      { name: "eyeWideRight", target: 0.86 },
    ),
  },
  {
    id: "curious",
    label: "Curious",
    pose: raw({
      browOuterUpLeft: 0.86,
      browOuterUpRight: 0.32,
      browInnerUp: 0.42,
      eyeWideLeft: 0.28,
      eyeWideRight: 0.12,
      mouthPucker: 0.16,
      mouthPressRight: 0.18,
    }),
    primary: primary({ name: "browOuterUpLeft", target: 0.86 }),
  },
  {
    id: "thinking",
    label: "Thinking",
    pose: raw({
      mouthPressLeft: 0.82,
      mouthPressRight: 0.82,
      browOuterUpLeft: 0.34,
      browInnerUp: 0.18,
      eyeSquintLeft: 0.18,
      eyeSquintRight: 0.18,
      mouthPucker: 0.2,
    }),
    primary: primary(
      { name: "mouthPressLeft", target: 0.82 },
      { name: "mouthPressRight", target: 0.82 },
    ),
  },
  {
    id: "concerned",
    label: "Concerned",
    pose: raw({
      browInnerUp: 0.84,
      mouthFrownLeft: 0.38,
      mouthFrownRight: 0.38,
      mouthPressLeft: 0.22,
      mouthPressRight: 0.22,
      eyeSquintLeft: 0.14,
      eyeSquintRight: 0.14,
    }),
    primary: primary({ name: "browInnerUp", target: 0.84 }),
  },
  {
    id: "sad",
    label: "Sad",
    pose: raw({
      mouthFrownLeft: 0.84,
      mouthFrownRight: 0.84,
      browInnerUp: 0.56,
      eyeSquintLeft: 0.18,
      eyeSquintRight: 0.18,
      mouthShrugLower: 0.2,
    }),
    primary: primary(
      { name: "mouthFrownLeft", target: 0.84 },
      { name: "mouthFrownRight", target: 0.84 },
    ),
  },
  {
    id: "angry",
    label: "Angry",
    pose: raw({
      noseSneerLeft: 0.86,
      noseSneerRight: 0.86,
      mouthPressLeft: 0.72,
      mouthPressRight: 0.72,
      mouthFrownLeft: 0.34,
      mouthFrownRight: 0.34,
      mouthStretchLeft: 0.12,
      mouthStretchRight: 0.12,
      browInnerUp: 0.18,
      eyeSquintLeft: 0.62,
      eyeSquintRight: 0.62,
    }),
    primary: primary(
      { name: "noseSneerLeft", target: 0.86 },
      { name: "noseSneerRight", target: 0.86 },
    ),
  },
  {
    id: "playful",
    label: "Playful",
    pose: raw({
      eyeSquintLeft: 0.86,
      eyeSquintRight: 0.1,
      mouthSmileLeft: 0.78,
      mouthSmileRight: 0.42,
      cheekSquintLeft: 0.62,
      cheekSquintRight: 0.16,
      browOuterUpRight: 0.32,
      mouthPressRight: 0.1,
    }),
    primary: primary({ name: "eyeSquintLeft", target: 0.86 }),
  },
  {
    id: "return_to_neutral",
    label: "Return to Neutral",
    pose: raw({}),
    primary: primary(),
  },
] satisfies readonly Hyper3dIdleShowcaseDefinition[]);

export const HYPER3D_IDLE_SHOWCASE_REQUIRED_EXPRESSIONS = Object.freeze(
  HYPER3D_IDLE_SHOWCASE_DEFINITIONS.filter((definition) => definition.primary.length > 0).map(
    (definition) => definition.id,
  ),
);

export const HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS = Object.freeze(
  Array.from(
    new Set(
      HYPER3D_IDLE_SHOWCASE_DEFINITIONS.flatMap((definition) => Object.keys(definition.pose)),
    ),
  ).sort(),
);

const EMPTY_POSE: BlendshapePose = Object.freeze({});
const EXPRESSION_BY_ID = new Map(HYPER3D_IDLE_SHOWCASE_DEFINITIONS.map((definition) => [definition.id, definition]));

function zeroPeaks(): Record<Hyper3dIdleShowcaseExpressionId, number> {
  return Object.fromEntries(
    HYPER3D_IDLE_SHOWCASE_DEFINITIONS.map((definition) => [definition.id, 0]),
  ) as Record<Hyper3dIdleShowcaseExpressionId, number>;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothStep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function expressionEnvelope(segmentTime: number): { phase: Hyper3dIdleShowcasePhase; phaseProgress: number; value: number } {
  if (segmentTime < 1.25) {
    const phaseProgress = clamp01(segmentTime / 1.25);
    return { phase: "entry", phaseProgress, value: smoothStep(phaseProgress) };
  }
  if (segmentTime <= 3.75) return { phase: "hold", phaseProgress: clamp01((segmentTime - 1.25) / 2.5), value: 1 };
  const phaseProgress = clamp01((segmentTime - 3.75) / 1.25);
  return { phase: "release", phaseProgress, value: 1 - smoothStep(phaseProgress) };
}

function makeDiagnostics(input: {
  enabled: boolean;
  eligible: boolean;
  cycleTimeSeconds: number;
  cycleNumber: number;
  currentExpression: Hyper3dIdleShowcaseExpressionId;
  nextExpression: Hyper3dIdleShowcaseExpressionId;
  phase: Hyper3dIdleShowcasePhase;
  phaseProgress: number;
  dominantChannels: readonly Hyper3dIdleShowcaseDominantChannel[];
  currentDominantValue: number;
  maxDominantValueObserved: number;
  lastYieldReason: Hyper3dIdleShowcaseYieldReason | null;
  loopCount: number;
  expressionPeaks: Record<Hyper3dIdleShowcaseExpressionId, number>;
}): Hyper3dIdleShowcaseDiagnostics {
  const dominantPeakTarget = input.dominantChannels.reduce((max, channel) => Math.max(max, channel.target), 0);
  return {
    enabled: input.enabled,
    eligible: input.eligible,
    cycleTimeSeconds: input.cycleTimeSeconds,
    cycleNumber: input.cycleNumber,
    currentExpression: input.currentExpression,
    nextExpression: input.nextExpression,
    phase: input.phase,
    phaseProgress: input.phaseProgress,
    dominantChannels: input.dominantChannels,
    dominantPeakTarget,
    currentDominantValue: input.currentDominantValue,
    maxDominantValueObserved: input.maxDominantValueObserved,
    minimumPeakRequirement: HYPER3D_IDLE_EXPRESSION_SHOWCASE_MINIMUM_PEAK,
    lastYieldReason: input.lastYieldReason,
    loopCount: input.loopCount,
    expressionPeaks: { ...input.expressionPeaks },
  };
}

const DEFAULT_DIAGNOSTICS = makeDiagnostics({
  enabled: false,
  eligible: false,
  cycleTimeSeconds: 0,
  cycleNumber: 0,
  currentExpression: "neutral",
  nextExpression: "smile",
  phase: "hold",
  phaseProgress: 0,
  dominantChannels: [],
  currentDominantValue: 0,
  maxDominantValueObserved: 0,
  lastYieldReason: null,
  loopCount: 0,
  expressionPeaks: zeroPeaks(),
});

export function hyper3dIdleExpressionShowcaseRawValue(): string | null {
  const rawValue = import.meta.env[HYPER3D_IDLE_EXPRESSION_SHOWCASE_FLAG] as string | undefined;
  return rawValue === undefined ? null : rawValue;
}

export function isHyper3dIdleExpressionShowcaseEnabled(): boolean {
  if (import.meta.env.PROD === true) return false;
  const rawValue = (import.meta.env[HYPER3D_IDLE_EXPRESSION_SHOWCASE_FLAG] as string | undefined)
    ?.trim()
    .toLowerCase();
  return rawValue === "true" || rawValue === "1";
}

export function applyHyper3dIdleShowcasePose(basePose: BlendshapePose, sample: Hyper3dIdleShowcaseSample): BlendshapePose {
  // A yielded (or disabled) showcase owns NOTHING. Its owned set is the union of
  // every recipe's channels and includes jawOpen, mouthFunnel, mouthPucker and
  // mouthUpper/LowerDown, so deleting it while inactive erased speech
  // articulation on every frame the showcase had yielded to.
  if (!sample.active) return basePose;
  const next: BlendshapePose = { ...basePose };
  for (const name of HYPER3D_IDLE_SHOWCASE_OWNED_CHANNELS) delete next[name];
  for (const [name, value] of Object.entries(sample.pose)) {
    const safe = clamp01(value);
    if (safe > 0) next[name] = safe;
  }
  return next;
}

export function publishHyper3dIdleShowcaseDiagnostics(diagnostics: Hyper3dIdleShowcaseDiagnostics): void {
  if (import.meta.env.DEV !== true) return;
  const target = globalThis as typeof globalThis & {
    window?: typeof globalThis & { __solaceHyper3dIdleShowcase?: Hyper3dIdleShowcaseDiagnostics };
    __solaceHyper3dIdleShowcase?: Hyper3dIdleShowcaseDiagnostics;
  };
  if (target.window) target.window.__solaceHyper3dIdleShowcase = diagnostics;
  target.__solaceHyper3dIdleShowcase = diagnostics;
}

export function createHyper3dIdleExpressionShowcaseRuntime(options: { enabled: boolean }): Hyper3dIdleShowcaseRuntime {
  let eligibleStartedAt: number | null = null;
  let wasEligible = false;
  let maxDominantValueObserved = 0;
  let lastYieldReason: Hyper3dIdleShowcaseYieldReason | null = null;
  let diagnostics = makeDiagnostics({ ...DEFAULT_DIAGNOSTICS, enabled: options.enabled, expressionPeaks: zeroPeaks() });
  const expressionPeaks = zeroPeaks();

  const inactive = (
    eligible: boolean,
    elapsedSeconds: number,
    reason: Hyper3dIdleShowcaseYieldReason | null,
  ): Hyper3dIdleShowcaseSample => {
    if (reason) lastYieldReason = reason;
    diagnostics = makeDiagnostics({
      enabled: options.enabled,
      eligible,
      cycleTimeSeconds: 0,
      cycleNumber: 0,
      currentExpression: "neutral",
      nextExpression: "smile",
      phase: "hold",
      phaseProgress: 0,
      dominantChannels: [],
      currentDominantValue: 0,
      maxDominantValueObserved,
      lastYieldReason,
      loopCount: Math.max(0, Math.floor(Math.max(0, elapsedSeconds) / HYPER3D_IDLE_EXPRESSION_SHOWCASE_DURATION_SECONDS)),
      expressionPeaks,
    });
    return { active: false, pose: EMPTY_POSE, diagnostics };
  };

  return {
    sample(input) {
      if (!options.enabled) {
        eligibleStartedAt = null;
        wasEligible = false;
        return inactive(false, input.elapsedSeconds, "disabled");
      }
      if (!input.eligible) {
        eligibleStartedAt = null;
        wasEligible = false;
        return inactive(false, input.elapsedSeconds, input.yieldReason ?? "not_idle");
      }
      if (!wasEligible || eligibleStartedAt === null) {
        eligibleStartedAt = input.elapsedSeconds;
        wasEligible = true;
      }

      const showcaseElapsed = Math.max(0, input.elapsedSeconds - eligibleStartedAt);
      const cycleNumber = Math.floor(showcaseElapsed / HYPER3D_IDLE_EXPRESSION_SHOWCASE_DURATION_SECONDS);
      const cycleTimeSeconds = showcaseElapsed - cycleNumber * HYPER3D_IDLE_EXPRESSION_SHOWCASE_DURATION_SECONDS;
      const segmentIndex = Math.min(
        HYPER3D_IDLE_SHOWCASE_DEFINITIONS.length - 1,
        Math.floor(cycleTimeSeconds / HYPER3D_IDLE_EXPRESSION_SHOWCASE_SEGMENT_SECONDS),
      );
      const current = HYPER3D_IDLE_SHOWCASE_DEFINITIONS[segmentIndex] ?? HYPER3D_IDLE_SHOWCASE_DEFINITIONS[0];
      const next = HYPER3D_IDLE_SHOWCASE_DEFINITIONS[(segmentIndex + 1) % HYPER3D_IDLE_SHOWCASE_DEFINITIONS.length];
      const segmentTime = cycleTimeSeconds - segmentIndex * HYPER3D_IDLE_EXPRESSION_SHOWCASE_SEGMENT_SECONDS;
      const envelope = expressionEnvelope(segmentTime);
      const pose: BlendshapePose = {};
      for (const [name, target] of Object.entries(current.pose)) {
        const value = clamp01(target * envelope.value);
        if (value > 0) pose[name] = value;
      }
      const currentDominantValue = current.primary.reduce(
        (max, channel) => Math.max(max, pose[channel.name] ?? 0),
        0,
      );
      maxDominantValueObserved = Math.max(maxDominantValueObserved, currentDominantValue);
      expressionPeaks[current.id] = Math.max(expressionPeaks[current.id], currentDominantValue);
      diagnostics = makeDiagnostics({
        enabled: options.enabled,
        eligible: true,
        cycleTimeSeconds,
        cycleNumber,
        currentExpression: current.id,
        nextExpression: next.id,
        phase: envelope.phase,
        phaseProgress: envelope.phaseProgress,
        dominantChannels: current.primary,
        currentDominantValue,
        maxDominantValueObserved,
        lastYieldReason,
        loopCount: cycleNumber,
        expressionPeaks,
      });
      return { active: true, pose, diagnostics };
    },
    getDiagnostics() {
      return diagnostics;
    },
  };
}

export function getHyper3dIdleShowcaseDefinition(id: Hyper3dIdleShowcaseExpressionId): Hyper3dIdleShowcaseDefinition {
  const definition = EXPRESSION_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown Hyper3D idle showcase expression: ${id}`);
  return definition;
}

