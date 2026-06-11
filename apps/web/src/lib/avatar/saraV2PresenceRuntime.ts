export type SaraV2PresenceMode =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted";

export interface SaraV2PresenceSentiment {
  readonly label?: string;
  readonly compound?: number;
  readonly scores?: Record<string, number>;
}

export interface SaraV2PresenceState {
  blinkStartedAtMs: number;
  blinkActiveUntilMs: number;
  blinkOpenUntilMs: number;
  nextBlinkAtMs: number;
  smileStartedAtMs: number;
  smileActiveUntilMs: number;
  smileOpenUntilMs: number;
  nextSmileAtMs: number;
  microEyeTarget: {
    up: number;
    down: number;
    asym: number;
  };
  nextEyeDriftAtMs: number;
  idleMotionPhase: number;
  expressionValues: Record<SaraV2PresenceMorphName, number>;
  previousMode: SaraV2PresenceMode;
  modeChangedAtMs: number;
  interruptedReleaseUntilMs: number;
}

export interface UpdateSaraV2PresenceArgs {
  readonly state: SaraV2PresenceState;
  readonly nowMs: number;
  readonly deltaSeconds: number;
  readonly mode: SaraV2PresenceMode;
  readonly sentiment?: SaraV2PresenceSentiment;
  readonly audioNorm?: number;
  readonly isSpeaking?: boolean;
  readonly isListening?: boolean;
  readonly isThinking?: boolean;
}

export interface SaraV2PresenceDiagnostics {
  readonly mode: SaraV2PresenceMode;
  readonly activePresenceMorphs: string[];
  readonly rawTargets: Record<string, number>;
  readonly blinkState: {
    readonly active: boolean;
    readonly nextBlinkAtMs: number;
    readonly activeUntilMs: number;
    readonly openUntilMs: number;
  };
  readonly blinkActive: boolean;
  readonly eyeLookSuppressedForBlink: boolean;
  readonly blinkMaxUsed: number;
  readonly blinkPhase: "idle" | "closing" | "hold" | "opening";
  readonly blinkRawStrength: number;
  readonly blinkAppliedStrength: number;
  readonly blinkReadback?: Record<string, unknown>;
  readonly blinkTargets: Record<string, number>;
  readonly smileState: {
    readonly active: boolean;
    readonly nextSmileAtMs: number;
    readonly activeUntilMs: number;
    readonly openUntilMs: number;
    readonly blockedByBlink: boolean;
  };
  readonly smilePulse: number;
  readonly smileTargets: Record<string, number>;
  readonly eyeLookTargetsBeforeSuppression: Record<string, number>;
  readonly eyeLookTargetsAfterSuppression: Record<string, number>;
  readonly eyeDrift: SaraV2PresenceState["microEyeTarget"];
  readonly sentimentUsed: {
    readonly label: string | null;
    readonly compound: number;
    readonly polarity: "positive" | "negative" | "neutral";
  };
  readonly speakingEnergy: number;
  readonly interruptedReleaseActive: boolean;
  readonly appliedTargets: Record<string, number>;
}

export interface UpdateSaraV2PresenceResult {
  readonly state: SaraV2PresenceState;
  readonly morphTargets: Record<string, number>;
  readonly boneTargets?: Record<string, unknown>;
  readonly diagnostics: SaraV2PresenceDiagnostics;
}

export const SARA_V2_PRESENCE_MORPHS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyebrows",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "sad",
  "eyeBlinkLeft",
  "eyeBlinkRight",
] as const;

export type SaraV2PresenceMorphName = (typeof SARA_V2_PRESENCE_MORPHS)[number];

const PRESENCE_MORPH_SET = new Set<string>(SARA_V2_PRESENCE_MORPHS);
const BLINK_CLOSE_MS = 92;
const BLINK_HOLD_MS = 28;
const BLINK_OPEN_MS = 140;
const BLINK_MAX = 0.65;
const BLINK_MOUTH_SUPPRESS = true;

const SMILE_MIN_INTERVAL_MS = 2800;
const SMILE_MAX_INTERVAL_MS = 6500;
const SMILE_RISE_MS = 260;
const SMILE_HOLD_MS = 650;
const SMILE_RELEASE_MS = 420;
const SMILE_MAX = 0.18;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  const alpha = 1 - Math.exp(-lambda * clamp(deltaSeconds, 0.001, 0.08));
  return current + (target - current) * alpha;
}

function range(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function nextBlinkDelayMs(mode: SaraV2PresenceMode): number {
  if (mode === "thinking") return range(4200, 7200);
  if (mode === "listening") return range(3200, 5600);
  if (mode === "speaking") return range(3000, 5200);
  if (mode === "interrupted") return range(900, 1800);
  return range(3600, 6400);
}

function nextSmileDelayMs(mode: SaraV2PresenceMode): number {
  if (mode === "speaking") return range(3600, 7200);
  if (mode === "thinking") return range(5200, 9000);
  if (mode === "interrupted") return range(2200, 4200);
  return range(SMILE_MIN_INTERVAL_MS, SMILE_MAX_INTERVAL_MS);
}

function createExpressionValues(): Record<SaraV2PresenceMorphName, number> {
  return SARA_V2_PRESENCE_MORPHS.reduce(
    (values, morphName) => {
      values[morphName] = 0;
      return values;
    },
    {} as Record<SaraV2PresenceMorphName, number>
  );
}

export function resetSaraV2PresenceTargets(): Record<SaraV2PresenceMorphName, number> {
  return createExpressionValues();
}

export function createSaraV2PresenceState(): SaraV2PresenceState {
  const nowMs = typeof performance !== "undefined" ? performance.now() : 0;
  return {
    blinkStartedAtMs: 0,
    blinkActiveUntilMs: 0,
    blinkOpenUntilMs: 0,
    nextBlinkAtMs: nowMs + range(900, 2400),
    smileStartedAtMs: 0,
    smileActiveUntilMs: 0,
    smileOpenUntilMs: 0,
    nextSmileAtMs: nowMs + range(1200, 3400),
    microEyeTarget: {
      up: 0,
      down: 0,
      asym: 0,
    },
    nextEyeDriftAtMs: nowMs + range(800, 1800),
    idleMotionPhase: Math.random() * Math.PI * 2,
    expressionValues: createExpressionValues(),
    previousMode: "idle",
    modeChangedAtMs: nowMs,
    interruptedReleaseUntilMs: 0,
  };
}

function sentimentPolarity(sentiment?: SaraV2PresenceSentiment): {
  label: string | null;
  compound: number;
  polarity: "positive" | "negative" | "neutral";
} {
  const label = sentiment?.label?.toLowerCase() ?? "";
  const compound = clamp(sentiment?.compound ?? 0, -1, 1);
  const positive =
    compound > 0.18 ||
    label.includes("positive") ||
    label.includes("happy") ||
    label.includes("warm") ||
    label.includes("hopeful");
  const negative =
    compound < -0.18 ||
    label.includes("negative") ||
    label.includes("sad") ||
    label.includes("anxious") ||
    label.includes("stress") ||
    label.includes("worried");

  return {
    label: sentiment?.label ?? null,
    compound,
    polarity: positive ? "positive" : negative ? "negative" : "neutral",
  };
}

function scheduleEyeDrift(state: SaraV2PresenceState, mode: SaraV2PresenceMode, nowMs: number) {
  if (nowMs < state.nextEyeDriftAtMs) return;

  const eyeMax =
    mode === "thinking" ? 0.036 :
    mode === "listening" ? 0.018 :
    mode === "speaking" ? 0.024 :
    0.028;
  const downBias = mode === "thinking" ? range(0.018, 0.052) : range(0, eyeMax * 0.45);
  const upBias = mode === "thinking" ? range(0, 0.006) : range(0, eyeMax);
  const mostlyStill = mode === "listening" ? Math.random() < 0.72 : Math.random() < 0.42;

  state.microEyeTarget = {
    up: mostlyStill ? 0 : clamp(upBias, 0, eyeMax),
    down: clamp(downBias, 0, mode === "thinking" ? 0.06 : eyeMax),
    asym: mostlyStill ? 0 : range(-0.006, 0.006),
  };
  state.nextEyeDriftAtMs =
    nowMs +
    (mode === "listening" ? range(1600, 3600) :
      mode === "thinking" ? range(1300, 2800) :
      range(900, 2600));
}

function baseTargetsForMode(
  mode: SaraV2PresenceMode,
  energy: number,
  phase: number,
  sentiment: ReturnType<typeof sentimentPolarity>,
): Record<SaraV2PresenceMorphName, number> {
  const breath = (Math.sin(phase) + 1) * 0.5;
  const smileBias = sentiment.polarity === "positive" ? 1.18 : sentiment.polarity === "negative" ? 0.42 : 1;
  const concernBias = sentiment.polarity === "negative" ? 1 : 0;
  const targets = createExpressionValues();

  if (mode === "listening" || mode === "interrupted") {
    targets.mouthSmileLeft = clamp((0.074 + breath * 0.026) * smileBias, 0, 0.12);
    targets.mouthSmileRight = clamp((0.078 + breath * 0.026) * smileBias, 0, 0.12);
    targets.cheekSquintLeft = clamp(0.027 + breath * 0.014, 0, 0.05);
    targets.cheekSquintRight = clamp(0.029 + breath * 0.014, 0, 0.05);
    targets.eyebrows = clamp(0.018 + breath * 0.014 + concernBias * 0.012, 0, 0.04);
    targets.mouthFrownLeft = clamp(concernBias * 0.014, 0, 0.025);
    targets.mouthFrownRight = clamp(concernBias * 0.014, 0, 0.025);
    targets.sad = clamp(concernBias * 0.018, 0, 0.04);
    return targets;
  }

  if (mode === "thinking") {
    targets.eyebrows = clamp(0.052 + breath * 0.028, 0, 0.09);
    targets.eyeLookDownLeft = clamp(0.028 + breath * 0.018, 0, 0.06);
    targets.eyeLookDownRight = clamp(0.03 + breath * 0.018, 0, 0.06);
    targets.mouthFrownLeft = clamp(0.012 + concernBias * 0.008, 0, 0.025);
    targets.mouthFrownRight = clamp(0.011 + concernBias * 0.008, 0, 0.025);
    targets.cheekSquintLeft = clamp(0.012 + breath * 0.006, 0, 0.025);
    targets.cheekSquintRight = clamp(0.013 + breath * 0.006, 0, 0.025);
    targets.mouthSmileLeft = clamp(0.012 * smileBias, 0, 0.025);
    targets.mouthSmileRight = clamp(0.013 * smileBias, 0, 0.025);
    return targets;
  }

  // if (mode === "speaking") {
  //   targets.cheekSquintLeft = clamp(0.032 + energy * 0.04 + breath * 0.008, 0, 0.08);
  //   targets.cheekSquintRight = clamp(0.034 + energy * 0.04 + breath * 0.008, 0, 0.08);
  //   targets.eyebrows = clamp(0.022 + Math.pow(energy, 0.85) * 0.04, 0, 0.07);
  //   if (sentiment.polarity === "negative") {
  //     targets.mouthFrownLeft = clamp(0.012 + energy * 0.018, 0, 0.045);
  //     targets.mouthFrownRight = clamp(0.012 + energy * 0.018, 0, 0.045);
  //     targets.sad = clamp(0.012 + energy * 0.026, 0, 0.055);
  //   } else {
  //     targets.mouthSmileLeft = clamp((0.018 + energy * 0.022) * smileBias, 0, 0.06);
  //     targets.mouthSmileRight = clamp((0.019 + energy * 0.022) * smileBias, 0, 0.06);
  //   }
  //   return targets;
  // }

  targets.mouthSmileLeft = clamp((0.042 + breath * 0.018) * smileBias, 0.03, 0.07);
  targets.mouthSmileRight = clamp((0.044 + breath * 0.018) * smileBias, 0.03, 0.07);
  targets.cheekSquintLeft = clamp(0.011 + breath * 0.009, 0.01, 0.025);
  targets.cheekSquintRight = clamp(0.012 + breath * 0.009, 0.01, 0.025);
  targets.eyebrows = clamp(0.011 + breath * 0.01 + concernBias * 0.006, 0.01, 0.025);
  targets.mouthFrownLeft = clamp(concernBias * 0.01, 0, 0.018);
  targets.mouthFrownRight = clamp(concernBias * 0.01, 0, 0.018);
  targets.sad = clamp(concernBias * 0.012, 0, 0.026);
  return targets;
}

export function isSaraV2PresenceMorph(name: string): name is SaraV2PresenceMorphName {
  return PRESENCE_MORPH_SET.has(name);
}

export function updateSaraV2Presence(args: UpdateSaraV2PresenceArgs): UpdateSaraV2PresenceResult {
  const state = args.state;
  const nowMs = args.nowMs;
  const deltaSeconds = clamp(args.deltaSeconds, 0.001, 0.08);
  const audioNorm = clamp(args.audioNorm ?? 0, 0, 1);
  const mode = args.mode;

  if (state.previousMode !== mode) {
    if (state.previousMode === "speaking" || mode === "interrupted") {
      state.interruptedReleaseUntilMs = nowMs + 520;
    }
    state.previousMode = mode;
    state.modeChangedAtMs = nowMs;
  }

  if (nowMs >= state.nextBlinkAtMs) {
    state.blinkStartedAtMs = nowMs;
    state.blinkActiveUntilMs = nowMs + BLINK_CLOSE_MS + BLINK_HOLD_MS;
    state.blinkOpenUntilMs = state.blinkActiveUntilMs + BLINK_OPEN_MS;
    state.nextBlinkAtMs = nowMs + nextBlinkDelayMs(mode);
  }

  scheduleEyeDrift(state, mode, nowMs);
  state.idleMotionPhase += deltaSeconds * (mode === "thinking" ? 0.72 : mode === "speaking" ? 1.35 : 0.92);

  const sentiment = sentimentPolarity(args.sentiment);
  const speakingEnergy = clamp(
    (args.isSpeaking || mode === "speaking" ? 0.18 : 0) + audioNorm * 0.82,
    0,
    1
  );
  const rawTargets = baseTargetsForMode(mode, speakingEnergy, state.idleMotionPhase, sentiment);
  const interruptedReleaseActive = nowMs < state.interruptedReleaseUntilMs || mode === "interrupted";
  const releaseScale = interruptedReleaseActive ? clamp((state.interruptedReleaseUntilMs - nowMs) / 520, 0, 1) : 0;

  rawTargets.eyeLookUpLeft = clamp(rawTargets.eyeLookUpLeft + state.microEyeTarget.up, 0, 0.035);
  rawTargets.eyeLookUpRight = clamp(rawTargets.eyeLookUpRight + state.microEyeTarget.up + state.microEyeTarget.asym, 0, 0.035);
  rawTargets.eyeLookDownLeft = clamp(rawTargets.eyeLookDownLeft + state.microEyeTarget.down, 0, 0.06);
  rawTargets.eyeLookDownRight = clamp(rawTargets.eyeLookDownRight + state.microEyeTarget.down - state.microEyeTarget.asym, 0, 0.06);
  if (interruptedReleaseActive) {
    rawTargets.mouthSmileLeft *= 1 - releaseScale * 0.42;
    rawTargets.mouthSmileRight *= 1 - releaseScale * 0.42;
    rawTargets.mouthFrownLeft *= 1 - releaseScale * 0.7;
    rawTargets.mouthFrownRight *= 1 - releaseScale * 0.7;
    rawTargets.sad *= 1 - releaseScale * 0.65;
  }

  const blinkClosingOrHeld = nowMs < state.blinkActiveUntilMs;
  const blinkOpening = !blinkClosingOrHeld && nowMs < state.blinkOpenUntilMs;
  const blinkActive = blinkClosingOrHeld || blinkOpening;
  const blinkElapsedMs = Math.max(0, nowMs - state.blinkStartedAtMs);
  const blinkClosing = blinkClosingOrHeld && blinkElapsedMs < BLINK_CLOSE_MS;
  const blinkHeld = blinkClosingOrHeld && !blinkClosing;
  const blinkOpenProgress = clamp(
    (nowMs - state.blinkActiveUntilMs) / BLINK_OPEN_MS,
    0,
    1
  );
  const blinkTarget = blinkClosingOrHeld
    ? BLINK_MAX * smoothstep(blinkElapsedMs / BLINK_CLOSE_MS)
    : blinkOpening
      ? BLINK_MAX * (1 - smoothstep(blinkOpenProgress))
      : 0;
  const blinkPhase =
    blinkClosing ? "closing" :
    blinkHeld ? "hold" :
    blinkOpening ? "opening" :
    "idle";
  const peakBlinkActive = blinkTarget >= BLINK_MAX * 0.72;

  const smileActiveBeforeSchedule = nowMs < state.smileActiveUntilMs;
  const smileBlockedByBlink =
    blinkActive ||
    nowMs < state.blinkOpenUntilMs ||
    nowMs + SMILE_RISE_MS >= state.nextBlinkAtMs - 120;

  if (!smileActiveBeforeSchedule && nowMs >= state.nextSmileAtMs) {
    if (smileBlockedByBlink) {
      state.nextSmileAtMs = Math.max(
        state.blinkOpenUntilMs + range(220, 520),
        nowMs + range(320, 720)
      );
    } else {
      state.smileStartedAtMs = nowMs;
      state.smileActiveUntilMs = nowMs + SMILE_RISE_MS + SMILE_HOLD_MS + SMILE_RELEASE_MS;
      state.smileOpenUntilMs = nowMs + SMILE_RISE_MS + SMILE_HOLD_MS;
      state.nextSmileAtMs = state.smileActiveUntilMs + nextSmileDelayMs(mode);
    }
  }

  const smileActive = nowMs < state.smileActiveUntilMs;
  let smilePulse = 0;

  if (smileActive) {
    const smileElapsedMs = Math.max(0, nowMs - state.smileStartedAtMs);
    if (smileElapsedMs < SMILE_RISE_MS) {
      smilePulse = smoothstep(smileElapsedMs / SMILE_RISE_MS);
    } else if (nowMs < state.smileOpenUntilMs) {
      smilePulse = 1;
    } else {
      const releaseProgress = clamp((nowMs - state.smileOpenUntilMs) / SMILE_RELEASE_MS, 0, 1);
      smilePulse = 1 - smoothstep(releaseProgress);
    }
  }

  if (blinkActive || nowMs < state.blinkOpenUntilMs) {
    smilePulse = 0;
  }

  if (smilePulse > 0) {
    rawTargets.mouthSmileLeft = clamp(rawTargets.mouthSmileLeft + smilePulse * SMILE_MAX, 0, 0.42);
    rawTargets.mouthSmileRight = clamp(rawTargets.mouthSmileRight + smilePulse * SMILE_MAX, 0, 0.42);
  }

  const eyeLookSuppressionScale = blinkActive ? 0 : 1;
  const eyeLookTargetsBeforeSuppression = {
    eyeLookUpLeft: rawTargets.eyeLookUpLeft,
    eyeLookUpRight: rawTargets.eyeLookUpRight,
    eyeLookDownLeft: rawTargets.eyeLookDownLeft,
    eyeLookDownRight: rawTargets.eyeLookDownRight,
  };
  rawTargets.eyeLookUpLeft *= eyeLookSuppressionScale;
  rawTargets.eyeLookUpRight *= eyeLookSuppressionScale;
  rawTargets.eyeLookDownLeft *= eyeLookSuppressionScale;
  rawTargets.eyeLookDownRight *= eyeLookSuppressionScale;

  if (blinkActive && BLINK_MOUTH_SUPPRESS) {
    rawTargets.mouthSmileLeft = 0.82;
    rawTargets.mouthSmileRight = 0.82;
    rawTargets.mouthFrownLeft = 0;
    rawTargets.mouthFrownRight = 0;
    rawTargets.sad = 0;

    rawTargets.cheekSquintLeft = 0;
    rawTargets.cheekSquintRight = 0;
    rawTargets.eyebrows = 0.5;
  }

  if (peakBlinkActive) {
    rawTargets.mouthSmileLeft = 0;
    rawTargets.mouthSmileRight = 0;
    rawTargets.mouthFrownLeft = 0;
    rawTargets.mouthFrownRight = 0;
    rawTargets.sad = 0;
    rawTargets.cheekSquintLeft = 0;
    rawTargets.cheekSquintRight = 0;
    rawTargets.eyebrows *= 0.6;
  }
  const eyeLookTargetsAfterSuppression = {
    eyeLookUpLeft: rawTargets.eyeLookUpLeft,
    eyeLookUpRight: rawTargets.eyeLookUpRight,
    eyeLookDownLeft: rawTargets.eyeLookDownLeft,
    eyeLookDownRight: rawTargets.eyeLookDownRight,
  };
  rawTargets.eyeBlinkLeft = blinkTarget;
  rawTargets.eyeBlinkRight = blinkTarget;

  const appliedTargets = createExpressionValues();
  SARA_V2_PRESENCE_MORPHS.forEach((morphName) => {
    const isEyeLookMorph = morphName.startsWith("eyeLook");
    const lambda = morphName.startsWith("eyeBlink")
      ? (blinkOpening ? 18 : 42)
      : eyeLookSuppressionScale < 1 && isEyeLookMorph
        ? 34
        : interruptedReleaseActive
          ? 12
          : 7.5;
    const nextValue = damp(
      state.expressionValues[morphName] ?? 0,
      rawTargets[morphName] ?? 0,
      lambda,
      deltaSeconds
    );
    const cleanValue = nextValue < 0.0005 ? 0 : nextValue;
    state.expressionValues[morphName] = cleanValue;
    appliedTargets[morphName] = cleanValue;
  });

  return {
    state,
    morphTargets: appliedTargets,
    diagnostics: {
      mode,
      activePresenceMorphs: Object.entries(appliedTargets)
        .filter(([, value]) => value > 0.001)
        .map(([name]) => name),
      rawTargets,
      blinkState: {
        active: blinkActive,
        nextBlinkAtMs: state.nextBlinkAtMs,
        activeUntilMs: state.blinkActiveUntilMs,
        openUntilMs: state.blinkOpenUntilMs,
      },
      blinkActive,
      eyeLookSuppressedForBlink: eyeLookSuppressionScale < 1,
      blinkMaxUsed: BLINK_MAX,
      blinkPhase,
      blinkRawStrength: blinkTarget,
      blinkAppliedStrength: Math.max(
        appliedTargets.eyeBlinkLeft,
        appliedTargets.eyeBlinkRight
      ),
      blinkTargets: {
        eyeBlinkLeft: appliedTargets.eyeBlinkLeft,
        eyeBlinkRight: appliedTargets.eyeBlinkRight,
      },
      smileState: {
        active: smileActive,
        nextSmileAtMs: state.nextSmileAtMs,
        activeUntilMs: state.smileActiveUntilMs,
        openUntilMs: state.smileOpenUntilMs,
        blockedByBlink: smileBlockedByBlink,
      },
      smilePulse,
      smileTargets: {
        mouthSmileLeft: appliedTargets.mouthSmileLeft,
        mouthSmileRight: appliedTargets.mouthSmileRight,
      },
      eyeLookTargetsBeforeSuppression,
      eyeLookTargetsAfterSuppression,
      eyeDrift: state.microEyeTarget,
      sentimentUsed: sentiment,
      speakingEnergy,
      interruptedReleaseActive,
      appliedTargets,
    },
  };
}
