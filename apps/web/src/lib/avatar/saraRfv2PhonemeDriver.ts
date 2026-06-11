import {
  SARA_RFV2_FACE_TUNING,
  SARA_RFV2_MORPH_NAMES,
  SARA_RFV2_PHONEME_TO_VISEME,
} from "./saraRfv2Config";
import { SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";

/**
 * Sara RFv2 phoneme driver foundation only.
 *
 * This module calculates audio time to active phoneme to Sara RFv2 viseme
 * targets. It is not wired into ThreeAvatar, ActiveSession, Sara V2 live
 * rendering, or any production execution path. Sara still uses the current
 * Sara V2 / legacyHybrid path until a later explicit activation phase.
 */

export interface SaraRfv2PhonemeTimelineItem {
  readonly phoneme: string;
  readonly start: number;
  readonly end: number;
}

export interface SaraRfv2PhonemeState {
  readonly enabled: boolean;
  readonly activePhoneme: string | null;
  readonly activeViseme: string;
  readonly lastSpeechTime: number;
  readonly lastUpdatedAtMs: number;
  readonly targets: Readonly<Record<string, number>>;
}

export interface ResolveSaraRfv2ActivePhonemeArgs {
  readonly timeline: readonly SaraRfv2PhonemeTimelineItem[];
  readonly audioCurrentTime: number;
  readonly lookAheadSeconds?: number;
}

export interface ResolveSaraRfv2ActivePhonemeResult {
  readonly activePhoneme: string | null;
  readonly activeViseme: string;
  readonly speechTime: number;
  readonly timelineLength: number;
  readonly validTimeline: boolean;
}

export interface ComputeSaraRfv2VisemeTargetsArgs {
  readonly activeViseme: string;
  readonly intensity?: number;
  readonly speaking?: boolean;
}

export interface ComputeSaraRfv2VisemeTargetsResult {
  readonly targets: Record<string, number>;
  readonly primaryViseme: string;
  readonly jawOpenTarget: number;
  readonly restTarget: number;
}

export interface UpdateSaraRfv2PhonemeDriverArgs {
  readonly state: SaraRfv2PhonemeState;
  readonly timeline: readonly SaraRfv2PhonemeTimelineItem[];
  readonly audioCurrentTime: number;
  readonly speaking: boolean;
  readonly nowMs: number;
}

export interface UpdateSaraRfv2PhonemeDriverResult {
  readonly state: SaraRfv2PhonemeState;
  readonly activePhoneme: string | null;
  readonly activeViseme: string;
  readonly targets: Readonly<Record<string, number>>;
  readonly debug: {
    readonly enabled: boolean;
    readonly reason: string;
    readonly validTimeline: boolean;
    readonly timelineLength: number;
    readonly speechTime: number;
  };
}

export interface SaraRfv2PhonemeDriverValidationResult {
  readonly valid: boolean;
  readonly warnings: string[];
}

const REST_VISEME = SARA_RFV2_MORPH_NAMES.visemes.rest;
const JAW_OPEN_MORPH = SARA_RFV2_MORPH_NAMES.mouth.jawOpen;

const SARA_RFV2_ALLOWED_VISEMES = new Set<string>([
  SARA_RFV2_MORPH_NAMES.visemes.rest,
  SARA_RFV2_MORPH_NAMES.visemes.aa,
  SARA_RFV2_MORPH_NAMES.visemes.ih,
  SARA_RFV2_MORPH_NAMES.visemes.e,
  SARA_RFV2_MORPH_NAMES.visemes.o,
  SARA_RFV2_MORPH_NAMES.visemes.pp,
  SARA_RFV2_MORPH_NAMES.visemes.ch,
  SARA_RFV2_MORPH_NAMES.visemes.sFallbackOptional,
]);

const JAW_OPEN_BY_VISEME: Readonly<Record<string, number>> = {
  [SARA_RFV2_MORPH_NAMES.visemes.aa]: SARA_RFV2_FACE_TUNING.jawOpenMax,
  [SARA_RFV2_MORPH_NAMES.visemes.ih]: SARA_RFV2_FACE_TUNING.jawOpenMax * 0.35,
  [SARA_RFV2_MORPH_NAMES.visemes.e]: SARA_RFV2_FACE_TUNING.jawOpenMax * 0.3,
  [SARA_RFV2_MORPH_NAMES.visemes.o]: SARA_RFV2_FACE_TUNING.jawOpenMax * 0.6,
  [SARA_RFV2_MORPH_NAMES.visemes.pp]: SARA_RFV2_FACE_TUNING.jawOpenMax * 0.08,
  [SARA_RFV2_MORPH_NAMES.visemes.ch]: SARA_RFV2_FACE_TUNING.jawOpenMax * 0.2,
  [SARA_RFV2_MORPH_NAMES.visemes.sFallbackOptional]:
    SARA_RFV2_FACE_TUNING.jawOpenMax * 0.15,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeSaraRfv2Phoneme(value: string): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^VISEME[_\s-]*/i, "")
    .replace(/\d+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z]/g, "");
}

function resolveSaraRfv2VisemeForPhoneme(phoneme: string): string {
  const normalized = normalizeSaraRfv2Phoneme(phoneme);
  const mapped =
    SARA_RFV2_PHONEME_TO_VISEME[
      normalized as keyof typeof SARA_RFV2_PHONEME_TO_VISEME
    ] ?? SARA_RFV2_PHONEME_TO_VISEME.default;
  return SARA_RFV2_ALLOWED_VISEMES.has(mapped) ? mapped : REST_VISEME;
}

function createRestTargets(): Record<string, number> {
  return {
    [REST_VISEME]: SARA_RFV2_FACE_TUNING.restStrength,
  };
}

export function createSaraRfv2PhonemeState(): SaraRfv2PhonemeState {
  return {
    enabled: false,
    activePhoneme: null,
    activeViseme: REST_VISEME,
    lastSpeechTime: 0,
    lastUpdatedAtMs: 0,
    targets: {},
  };
}

export function resolveSaraRfv2ActivePhoneme(
  args: ResolveSaraRfv2ActivePhonemeArgs,
): ResolveSaraRfv2ActivePhonemeResult {
  const lookAheadSeconds =
    args.lookAheadSeconds ?? SARA_RFV2_FACE_TUNING.lookAheadSeconds;
  const speechTime = Math.max(
    0,
    (Number.isFinite(args.audioCurrentTime) ? args.audioCurrentTime : 0) +
      Math.max(0, lookAheadSeconds),
  );
  const validTimeline =
    Array.isArray(args.timeline) &&
    args.timeline.some(
      (item) =>
        Boolean(item.phoneme) &&
        Number.isFinite(item.start) &&
        Number.isFinite(item.end) &&
        item.end >= item.start,
    );

  if (!validTimeline) {
    return {
      activePhoneme: null,
      activeViseme: REST_VISEME,
      speechTime,
      timelineLength: args.timeline.length,
      validTimeline: false,
    };
  }

  const active = args.timeline.find(
    (item) =>
      Number.isFinite(item.start) &&
      Number.isFinite(item.end) &&
      item.end >= item.start &&
      speechTime >= item.start &&
      speechTime < item.end,
  );

  if (!active) {
    return {
      activePhoneme: null,
      activeViseme: REST_VISEME,
      speechTime,
      timelineLength: args.timeline.length,
      validTimeline: true,
    };
  }

  return {
    activePhoneme: normalizeSaraRfv2Phoneme(active.phoneme) || null,
    activeViseme: resolveSaraRfv2VisemeForPhoneme(active.phoneme),
    speechTime,
    timelineLength: args.timeline.length,
    validTimeline: true,
  };
}

export function computeSaraRfv2VisemeTargets(
  args: ComputeSaraRfv2VisemeTargetsArgs,
): ComputeSaraRfv2VisemeTargetsResult {
  const restTarget = SARA_RFV2_FACE_TUNING.restStrength;
  const safeViseme = SARA_RFV2_ALLOWED_VISEMES.has(args.activeViseme)
    ? args.activeViseme
    : REST_VISEME;

  if (!args.speaking || safeViseme === REST_VISEME) {
    return {
      targets: createRestTargets(),
      primaryViseme: REST_VISEME,
      jawOpenTarget: 0,
      restTarget,
    };
  }

  const visemeStrength = clamp(
    args.intensity ?? SARA_RFV2_FACE_TUNING.visemeMaxStrength,
    0,
    SARA_RFV2_FACE_TUNING.visemeMaxStrength,
  );
  const jawOpenTarget = clamp(
    JAW_OPEN_BY_VISEME[safeViseme] ?? 0,
    0,
    SARA_RFV2_FACE_TUNING.jawOpenMax,
  );

  return {
    targets: {
      [REST_VISEME]: restTarget,
      [safeViseme]: visemeStrength,
      [JAW_OPEN_MORPH]: jawOpenTarget,
    },
    primaryViseme: safeViseme,
    jawOpenTarget,
    restTarget,
  };
}

export function updateSaraRfv2PhonemeDriver(
  args: UpdateSaraRfv2PhonemeDriverArgs,
): UpdateSaraRfv2PhonemeDriverResult {
  const resolved = resolveSaraRfv2ActivePhoneme({
    timeline: args.timeline,
    audioCurrentTime: args.audioCurrentTime,
  });

  if (!SARA_RFV2_FLAGS.phonemeDriver) {
    const targets = createRestTargets();
    const state: SaraRfv2PhonemeState = {
      ...args.state,
      enabled: false,
      activePhoneme: null,
      activeViseme: REST_VISEME,
      lastSpeechTime: resolved.speechTime,
      lastUpdatedAtMs: args.nowMs,
      targets,
    };

    return {
      state,
      activePhoneme: null,
      activeViseme: REST_VISEME,
      targets,
      debug: {
        enabled: false,
        reason: "Sara RFv2 phoneme driver disabled by feature flag.",
        validTimeline: resolved.validTimeline,
        timelineLength: resolved.timelineLength,
        speechTime: resolved.speechTime,
      },
    };
  }

  const computed = computeSaraRfv2VisemeTargets({
    activeViseme: resolved.activeViseme,
    speaking: args.speaking,
  });
  const state: SaraRfv2PhonemeState = {
    ...args.state,
    enabled: false,
    activePhoneme: resolved.activePhoneme,
    activeViseme: resolved.activeViseme,
    lastSpeechTime: resolved.speechTime,
    lastUpdatedAtMs: args.nowMs,
    targets: computed.targets,
  };

  return {
    state,
    activePhoneme: resolved.activePhoneme,
    activeViseme: resolved.activeViseme,
    targets: computed.targets,
    debug: {
      enabled: false,
      reason: "Sara RFv2 phoneme driver scaffold only; not wired.",
      validTimeline: resolved.validTimeline,
      timelineLength: resolved.timelineLength,
      speechTime: resolved.speechTime,
    },
  };
}

export function validateSaraRfv2PhonemeDriverConfig():
  SaraRfv2PhonemeDriverValidationResult {
  const warnings: string[] = [];
  const emptyTimeline = resolveSaraRfv2ActivePhoneme({
    timeline: [],
    audioCurrentTime: 0,
  });
  const aaTimeline = resolveSaraRfv2ActivePhoneme({
    timeline: [{ phoneme: "AA", start: 0, end: 1 }],
    audioCurrentTime: 0,
    lookAheadSeconds: 0,
  });
  const pTimeline = resolveSaraRfv2ActivePhoneme({
    timeline: [{ phoneme: "P", start: 0, end: 1 }],
    audioCurrentTime: 0,
    lookAheadSeconds: 0,
  });
  const sTimeline = resolveSaraRfv2ActivePhoneme({
    timeline: [{ phoneme: "S", start: 0, end: 1 }],
    audioCurrentTime: 0,
    lookAheadSeconds: 0,
  });
  const cappedTargets = computeSaraRfv2VisemeTargets({
    activeViseme: SARA_RFV2_MORPH_NAMES.visemes.aa,
    intensity: 999,
    speaking: true,
  });

  if (emptyTimeline.activeViseme !== REST_VISEME) {
    warnings.push("Empty timeline should resolve to viseme_rest.");
  }
  if (aaTimeline.activeViseme !== SARA_RFV2_MORPH_NAMES.visemes.aa) {
    warnings.push("AA should resolve to viseme_AA.");
  }
  if (pTimeline.activeViseme !== SARA_RFV2_MORPH_NAMES.visemes.pp) {
    warnings.push("P should resolve to viseme_PP.");
  }
  if (sTimeline.activeViseme !== SARA_RFV2_PHONEME_TO_VISEME.S) {
    warnings.push("S should resolve to the configured Sara RFv2 fallback.");
  }
  if (
    (cappedTargets.targets[SARA_RFV2_MORPH_NAMES.visemes.aa] ?? 0) >
    SARA_RFV2_FACE_TUNING.visemeMaxStrength
  ) {
    warnings.push("Viseme target exceeded Sara RFv2 max strength.");
  }
  if (cappedTargets.jawOpenTarget > SARA_RFV2_FACE_TUNING.jawOpenMax) {
    warnings.push("jawOpen target exceeded Sara RFv2 jaw cap.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
