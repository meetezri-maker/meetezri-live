import {
  DEBUG_JORDAN_BEHAVIOR_TIMING,
  DEBUG_JORDAN_PERSONALITY_TIMING,
  ENABLE_JORDAN_PERSONALITY_TIMING,
  JORDAN_BEHAVIOR_TIMING_CONFIG,
  JORDAN_CONVERSATIONAL_AWARENESS_TUNING,
  JORDAN_EMOTIONAL_MODULATION_TUNING,
  JORDAN_FINAL_HUMANIZATION_TUNING,
  JORDAN_MOTION_INDEPENDENCE_TUNING,
} from "./jordanRfv2Config";
import type { AvatarPersonalityTimingConfig } from "./avatarConfigTypes";

export type JordanBehaviorPresenceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export type JordanBehaviorMotionChannel =
  | "blink"
  | "eye"
  | "brow"
  | "mouth"
  | "cheek"
  | "head";

export type JordanBehaviorTimingIntent =
  | "idle_stillness"
  | "idle_micro_adjust"
  | "listening_ack"
  | "listening_soft_smile"
  | "empathy_soften"
  | "thinking_absorb"
  | "eye_refocus"
  | "micro_focus_shift"
  | "brow_soft_lift"
  | "brow_concern"
  | "micro_head_tilt"
  | "micro_head_shake"
  | "turn_end_release"
  | "soft_processing_pause"
  | "speaking_emphasis"
  | "speaking_soften"
  | "speaking_settle"
  | "user_sentence_end"
  | "jordan_sentence_end"
  | "user_pause_ack"
  | "long_pause_stillness"
  | "processing_pause"
  | "anticipation_focus"
  | "emotional_emphasis"
  | "turn_taking_settle"
  | "pre_speech_focus"
  | "post_speech_release";

export interface JordanBehaviorTimingEvent {
  id: string;
  type: JordanBehaviorTimingIntent;
  state: JordanBehaviorPresenceState;
  scheduledAtMs: number;
  startsAtMs: number;
  endsAtMs: number;
  holdUntilMs: number;
  intensity: number;
  weight: number;
  interrupted: boolean;
  channels?: JordanBehaviorTimingChannel[];
  metadata?: Record<string, unknown>;
}

export interface JordanBehaviorTimingChannel {
  channel: JordanBehaviorMotionChannel;
  startsAtMs: number;
  endsAtMs: number;
  intensity: number;
  interrupted?: boolean;
  metadata?: Record<string, unknown>;
}

export interface JordanBehaviorDensityRecord {
  type: JordanBehaviorTimingIntent;
  state: JordanBehaviorPresenceState;
  channel?: JordanBehaviorMotionChannel;
  timestampMs: number;
  intensity: number;
  durationMs: number;
}

export interface JordanBehaviorTimingState {
  lastEventAtByType: Partial<Record<JordanBehaviorTimingIntent, number>>;
  lastChannelAt: Partial<Record<JordanBehaviorMotionChannel, number>>;
  recentEvents: JordanBehaviorDensityRecord[];
  activeEvents: JordanBehaviorTimingEvent[];
  queuedEvents: JordanBehaviorTimingEvent[];
  currentStillnessUntilMs: number;
  lastPresenceState: JordanBehaviorPresenceState | null;
  lastSentimentLabel: string | null;
  lastSpeakingValue: boolean | null;
  lastUserSpeakingValue: boolean | null;
  lastAwarenessAtByType: Partial<Record<JordanBehaviorTimingIntent, number>>;
  awarenessTurnStartedAtMs: number;
  awarenessEventsThisTurn: number;
  lastUserText: string | null;
  lastJordanText: string | null;
  randomSource: () => number;
}

export interface JordanBehaviorTimingUpdateArgs {
  state: JordanBehaviorTimingState;
  nowMs: number;
  presenceState: JordanBehaviorPresenceState;
  sentimentLabel?: string;
  isSpeaking?: boolean;
  userIsSpeaking?: boolean;
  latestUserText?: string;
  latestJordanText?: string;
  userSpeechStartedAtMs?: number;
  userLastSpeechAtMs?: number;
  jordanSpeechStartedAtMs?: number;
  jordanLastSpeechAtMs?: number;
  speechJustStarted?: boolean;
  speechJustEnded?: boolean;
  userPauseDurationMs?: number;
  sentimentCompound?: number;
  personalityTiming?: AvatarPersonalityTimingConfig;
  avatarId?: string;
  config?: typeof JORDAN_BEHAVIOR_TIMING_CONFIG;
}

export interface JordanBehaviorTimingUpdateResult {
  state: JordanBehaviorTimingState;
  activeEvents: JordanBehaviorTimingEvent[];
  queuedEvents: JordanBehaviorTimingEvent[];
  newEvents: JordanBehaviorTimingEvent[];
  debug?: JordanBehaviorTimingDebugInfo;
}

export interface JordanBehaviorIntentPickArgs {
  state: JordanBehaviorTimingState;
  nowMs: number;
  presenceState: JordanBehaviorPresenceState;
  sentimentLabel?: string;
  speechJustEnded?: boolean;
  config?: typeof JORDAN_BEHAVIOR_TIMING_CONFIG;
}

export interface JordanBehaviorIntentPickResult {
  intent: JordanBehaviorTimingIntent | null;
  category: "stillness" | "microBehavior" | "reaction" | null;
  skippedReason?: string;
  cooldownHit?: JordanBehaviorTimingCooldownHit;
  stillnessActive: boolean;
  noReactionDecision?: boolean;
}

export interface JordanBehaviorTimingDebugInfo {
  presenceState: JordanBehaviorPresenceState;
  selectedIntent: JordanBehaviorTimingIntent | null;
  skippedReason?: string;
  cooldownHit?: JordanBehaviorTimingCooldownHit;
  stillnessActive: boolean;
  newEvents: JordanBehaviorTimingEvent[];
  activeEvents: JordanBehaviorTimingEvent[];
  interruptedEvents: JordanBehaviorTimingEvent[];
  emotionalMode: JordanEmotionalModulationMode;
  modulationProfile: JordanEmotionalModulationProfile;
  reactionDelayMultiplier: number;
  stillnessMultiplier: number;
  reactionProbabilityChanges: Partial<Record<JordanBehaviorTimingIntent, number>>;
  blinkDelayMultiplier: number;
  selectedChannels: JordanBehaviorTimingChannel[];
  skippedChannels: Array<{
    channel: JordanBehaviorMotionChannel;
    reason: string;
    cooldownUntilMs?: number;
  }>;
  noReactionDecision: boolean;
  maxChannelsPerEvent: number;
  interruptionVarianceMs: number;
  conversationalBeat?: JordanConversationalBeatDebug;
  personalityTiming?: {
    avatarId?: string;
    profile?: AvatarPersonalityTimingConfig;
    enabled: boolean;
    fallbackProfileUsed: boolean;
    appliedMultipliers: Record<string, number>;
    before: Record<string, number>;
    after: Record<string, number>;
  };
  humanization: JordanBehaviorHumanizationDebug;
}

interface JordanBehaviorHumanizationDebug {
  rollingRatio: {
    stillness: number;
    microBehavior: number;
    reaction: number;
  };
  eventCountInWindow: number;
  maxEventsPerWindow: number;
  repeatedIntentCount: number;
  skippedReason?: string;
  overactivityPreventionActive: boolean;
  minimumStillnessUntilMs: number;
}

interface JordanConversationalBeatDebug {
  beat: string | null;
  selectedAwarenessIntent: JordanBehaviorTimingIntent | null;
  skippedReason?: string;
  userPauseDurationMs?: number;
  latestUserTextEndsSentence: boolean;
  latestJordanTextEndsSentence: boolean;
  speechJustStarted: boolean;
  speechJustEnded: boolean;
  sentimentCompound?: number;
  missingSignals: string[];
}

interface JordanBehaviorTimingCooldownHit {
  intent: JordanBehaviorTimingIntent;
  cooldownKey: keyof typeof JORDAN_BEHAVIOR_TIMING_CONFIG.reactionCooldowns;
  lastEventAtMs: number;
  cooldownUntilMs: number;
}

type JordanBehaviorTimingConfig = typeof JORDAN_BEHAVIOR_TIMING_CONFIG;
type JordanSentimentKey = keyof JordanBehaviorTimingConfig["emotionalLatencyBySentiment"];
type JordanEmotionalModulationMode = keyof typeof JORDAN_EMOTIONAL_MODULATION_TUNING;
type JordanEmotionalModulationProfile =
  (typeof JORDAN_EMOTIONAL_MODULATION_TUNING)[JordanEmotionalModulationMode];
type JordanMotionIndependenceConfig = typeof JORDAN_MOTION_INDEPENDENCE_TUNING;
type JordanConversationalAwarenessConfig =
  typeof JORDAN_CONVERSATIONAL_AWARENESS_TUNING;
type NumberRange = readonly [number, number];

const DEFAULT_EVENT_DURATION_MS: NumberRange = [700, 1800];
const STILLNESS_INTENTS = new Set<JordanBehaviorTimingIntent>([
  "idle_stillness",
  "soft_processing_pause",
]);

const STATE_INTERRUPTS: Record<
  JordanBehaviorPresenceState,
  JordanBehaviorTimingIntent[]
> = {
  idle: [
    "listening_ack",
    "listening_soft_smile",
    "empathy_soften",
    "brow_concern",
    "thinking_absorb",
    "soft_processing_pause",
  ],
  listening: ["idle_stillness", "idle_micro_adjust"],
  thinking: [
    "idle_micro_adjust",
    "listening_ack",
    "listening_soft_smile",
    "empathy_soften",
    "brow_concern",
  ],
  speaking: [
    "idle_stillness",
    "idle_micro_adjust",
    "listening_ack",
    "listening_soft_smile",
    "empathy_soften",
    "thinking_absorb",
    "brow_concern",
    "micro_head_shake",
  ],
};

const INTENT_COOLDOWN_KEYS: Partial<
  Record<
    JordanBehaviorTimingIntent,
    keyof JordanBehaviorTimingConfig["reactionCooldowns"]
  >
> = {
  listening_ack: "brow",
  listening_soft_smile: "smileTwitch",
  empathy_soften: "smileTwitch",
  idle_micro_adjust: "smileTwitch",
  thinking_absorb: "brow",
  speaking_emphasis: "brow",
  speaking_soften: "smileTwitch",
  speaking_settle: "smileTwitch",
  eye_refocus: "eyeRefocus",
  micro_focus_shift: "eyeRefocus",
  brow_soft_lift: "brow",
  brow_concern: "brow",
  micro_head_tilt: "headTilt",
  micro_head_shake: "headTilt",
  turn_end_release: "blinkCluster",
  user_sentence_end: "brow",
  jordan_sentence_end: "blinkCluster",
  user_pause_ack: "brow",
  long_pause_stillness: "eyeRefocus",
  processing_pause: "eyeRefocus",
  anticipation_focus: "eyeRefocus",
  emotional_emphasis: "brow",
  turn_taking_settle: "blinkCluster",
  pre_speech_focus: "eyeRefocus",
  post_speech_release: "blinkCluster",
};

const INTENT_PROBABILITY_KEYS: Partial<
  Record<
    JordanBehaviorTimingIntent,
    keyof JordanBehaviorTimingConfig["reactionProbabilities"]
  >
> = {
  idle_stillness: "stillness",
  listening_ack: "listeningAck",
  empathy_soften: "empathySoften",
  listening_soft_smile: "microSmile",
  brow_soft_lift: "browLift",
  brow_concern: "browKnit",
  speaking_emphasis: "browLift",
  speaking_soften: "microSmile",
  speaking_settle: "stillness",
  micro_head_tilt: "headTilt",
  micro_head_shake: "microHeadShake",
  eye_refocus: "eyeRefocus",
  micro_focus_shift: "eyeRefocus",
  soft_processing_pause: "stillness",
  user_sentence_end: "listeningAck",
  jordan_sentence_end: "stillness",
  user_pause_ack: "listeningAck",
  long_pause_stillness: "stillness",
  processing_pause: "stillness",
  anticipation_focus: "eyeRefocus",
  emotional_emphasis: "empathySoften",
  turn_taking_settle: "stillness",
  pre_speech_focus: "eyeRefocus",
  post_speech_release: "stillness",
};

export function createJordanBehaviorTimingState(): JordanBehaviorTimingState {
  return {
    lastEventAtByType: {},
    lastChannelAt: {},
    recentEvents: [],
    activeEvents: [],
    queuedEvents: [],
    currentStillnessUntilMs: 0,
    lastPresenceState: null,
    lastSentimentLabel: null,
    lastSpeakingValue: null,
    lastUserSpeakingValue: null,
    lastAwarenessAtByType: {},
    awarenessTurnStartedAtMs: 0,
    awarenessEventsThisTurn: 0,
    lastUserText: null,
    lastJordanText: null,
    randomSource: Math.random,
  };
}

export function updateJordanBehaviorTimingScheduler(
  args: JordanBehaviorTimingUpdateArgs,
): JordanBehaviorTimingUpdateResult {
  const config = args.config ?? JORDAN_BEHAVIOR_TIMING_CONFIG;
  const personalityProfile = ENABLE_JORDAN_PERSONALITY_TIMING
    ? args.personalityTiming
    : undefined;
  const state = clearExpiredJordanBehaviorEvents(args.state, args.nowMs);
  pruneJordanBehaviorDensityRecords(state, args.nowMs);
  const interruptedEvents: JordanBehaviorTimingEvent[] = [];
  const emotionalMode = normalizeEmotionalMode(
    args.sentimentLabel,
    args.presenceState,
  );
  const modulationProfile = getEmotionalModulationProfile(emotionalMode);

  if (
    state.lastPresenceState !== null &&
    state.lastPresenceState !== args.presenceState
  ) {
    interruptedEvents.push(
      ...interruptIncompatibleEvents(state, args.presenceState, args.nowMs),
    );
    state.awarenessTurnStartedAtMs = args.nowMs;
    state.awarenessEventsThisTurn = 0;
  }

  state.lastPresenceState = args.presenceState;
  state.lastSentimentLabel = args.sentimentLabel ?? null;
  state.lastSpeakingValue = args.isSpeaking ?? null;
  state.lastUserSpeakingValue = args.userIsSpeaking ?? null;
  const previousUserText = state.lastUserText;
  const previousJordanText = state.lastJordanText;
  state.lastUserText = args.latestUserText ?? state.lastUserText;
  state.lastJordanText = args.latestJordanText ?? state.lastJordanText;

  const humanizationBeforePick = getJordanBehaviorHumanizationStatus(
    state,
    args.presenceState,
    args.nowMs,
  );
  if (humanizationBeforePick.overactivityPreventionActive) {
    state.currentStillnessUntilMs = Math.max(
      state.currentStillnessUntilMs,
      args.nowMs +
        randomRange(
          JORDAN_FINAL_HUMANIZATION_TUNING.minimumStillnessAfterReactionMs,
          state.randomSource,
        ),
    );
  }

  const awarenessPick = humanizationBeforePick.overactivityPreventionActive
    ? {
        intent: null,
        beat: null,
        skippedReason: "humanization_overactivity_window",
      }
    : pickJordanConversationalAwarenessIntent({
    state,
    nowMs: args.nowMs,
    presenceState: args.presenceState,
    sentimentLabel: args.sentimentLabel,
    latestUserText: args.latestUserText,
    latestJordanText: args.latestJordanText,
    previousUserText,
    previousJordanText,
    userPauseDurationMs: args.userPauseDurationMs,
    speechJustStarted: args.speechJustStarted,
    speechJustEnded: args.speechJustEnded,
    sentimentCompound: args.sentimentCompound,
    randomSource: state.randomSource,
  });

  const pick =
    humanizationBeforePick.overactivityPreventionActive
      ? {
          intent: null,
          category: null,
          skippedReason: "humanization_overactivity_window",
          stillnessActive: state.currentStillnessUntilMs > args.nowMs,
        }
      : awarenessPick.intent !== null
      ? {
          intent: awarenessPick.intent,
          category: "reaction" as const,
          stillnessActive: false,
        }
      : pickJordanBehaviorIntent({
          state,
          nowMs: args.nowMs,
          presenceState: args.presenceState,
          sentimentLabel: args.sentimentLabel,
          speechJustEnded: args.speechJustEnded,
          config,
        });

  const newEvents: JordanBehaviorTimingEvent[] = [];

  if (pick.intent !== null) {
    const event = createJordanBehaviorEvent({
      intent: pick.intent,
      state: args.presenceState,
      schedulerState: state,
      nowMs: args.nowMs,
      sentimentLabel: args.sentimentLabel,
      config,
      emotionalMode,
      modulationProfile,
      randomSource: state.randomSource,
      personalityTiming: personalityProfile,
      category: pick.category ?? getJordanBehaviorCategoryForIntent(
        pick.intent,
        args.presenceState,
      ),
    });

    scheduleJordanBehaviorEvent(state, event);
    if (awarenessPick.intent !== null) {
      state.lastAwarenessAtByType[awarenessPick.intent] = args.nowMs;
      state.awarenessEventsThisTurn += 1;
    }
    newEvents.push(event);
  }

  const debug = DEBUG_JORDAN_BEHAVIOR_TIMING
    ? {
        presenceState: args.presenceState,
        selectedIntent: pick.intent,
        skippedReason: pick.skippedReason,
        cooldownHit: pick.cooldownHit,
        stillnessActive: pick.stillnessActive,
        newEvents,
        activeEvents: state.activeEvents,
        interruptedEvents,
        emotionalMode,
        modulationProfile,
        reactionDelayMultiplier: modulationProfile.reactionDelayMultiplier,
        stillnessMultiplier: modulationProfile.stillnessMultiplier,
        reactionProbabilityChanges: getReactionProbabilityChanges(emotionalMode),
        blinkDelayMultiplier: modulationProfile.blinkDelayMultiplier,
        selectedChannels: newEvents.flatMap((event) => event.channels ?? []),
        skippedChannels: newEvents.flatMap((event) =>
          Array.isArray(event.metadata?.skippedChannels)
            ? (event.metadata.skippedChannels as Array<{
                channel: JordanBehaviorMotionChannel;
                reason: string;
                cooldownUntilMs?: number;
              }>)
            : [],
        ),
        noReactionDecision: pick.noReactionDecision ?? false,
        maxChannelsPerEvent:
          JORDAN_MOTION_INDEPENDENCE_TUNING.maxChannelsPerEvent[
            args.presenceState
          ],
        interruptionVarianceMs: interruptedEvents.reduce(
          (maxVariance, event) =>
            Math.max(
              maxVariance,
              typeof event.metadata?.interruptionVarianceMs === "number"
                ? event.metadata.interruptionVarianceMs
                : 0,
            ),
          0,
        ),
        conversationalBeat: {
          beat: awarenessPick.beat,
          selectedAwarenessIntent: awarenessPick.intent,
          skippedReason: awarenessPick.skippedReason,
          userPauseDurationMs: args.userPauseDurationMs,
          latestUserTextEndsSentence: endsWithSentencePunctuation(
            args.latestUserText,
          ),
          latestJordanTextEndsSentence: endsWithSentencePunctuation(
            args.latestJordanText,
          ),
          speechJustStarted: args.speechJustStarted ?? false,
          speechJustEnded: args.speechJustEnded ?? false,
          sentimentCompound: args.sentimentCompound,
          missingSignals: getMissingConversationalSignals(args),
        },
        personalityTiming:
          DEBUG_JORDAN_PERSONALITY_TIMING && args.personalityTiming
            ? {
                avatarId: args.avatarId,
                profile: args.personalityTiming,
                enabled: ENABLE_JORDAN_PERSONALITY_TIMING,
                fallbackProfileUsed: !args.avatarId,
                appliedMultipliers: getPersonalityAppliedMultipliers(
                  personalityProfile,
                ),
                before: {
                  reactionDelayMultiplier:
                    modulationProfile.reactionDelayMultiplier,
                  stillnessMultiplier: modulationProfile.stillnessMultiplier,
                  reactionSpeedMultiplier:
                    modulationProfile.reactionSpeedMultiplier,
                  nervousSystemVariance: 1,
                },
                after: {
                  reactionDelayMultiplier:
                    modulationProfile.reactionDelayMultiplier *
                    (personalityProfile?.reactionDelayMultiplier ?? 1),
                  stillnessMultiplier:
                    modulationProfile.stillnessMultiplier *
                    (personalityProfile?.stillnessPreference ?? 1),
                  reactionSpeedMultiplier:
                    modulationProfile.reactionSpeedMultiplier *
                    (personalityProfile?.reactionSpeed ?? 1),
                  nervousSystemVariance:
                    personalityProfile?.nervousSystemVariance ?? 1,
                },
              }
            : undefined,
        humanization: {
          ...getJordanBehaviorHumanizationStatus(
            state,
            args.presenceState,
            args.nowMs,
          ),
          skippedReason:
            pick.skippedReason ??
            awarenessPick.skippedReason ??
            humanizationBeforePick.skippedReason,
        },
      }
    : undefined;

  return {
    state,
    activeEvents: state.activeEvents,
    queuedEvents: state.queuedEvents,
    newEvents,
    debug,
  };
}

export function clearExpiredJordanBehaviorEvents(
  state: JordanBehaviorTimingState,
  nowMs: number,
): JordanBehaviorTimingState {
  const queuedEvents: JordanBehaviorTimingEvent[] = [];

  for (const event of state.queuedEvents) {
    if (event.interrupted) {
      continue;
    }

    if (event.startsAtMs <= nowMs) {
      state.activeEvents.push(event);
      continue;
    }

    queuedEvents.push(event);
  }

  state.queuedEvents = queuedEvents;
  state.activeEvents = state.activeEvents.filter(
    (event) => !event.interrupted && event.endsAtMs > nowMs,
  );

  if (state.currentStillnessUntilMs <= nowMs) {
    state.currentStillnessUntilMs = 0;
  }

  return state;
}

export function interruptJordanBehaviorEvents(
  state: JordanBehaviorTimingState,
  reason: string,
): JordanBehaviorTimingState {
  state.activeEvents = state.activeEvents.map((event) =>
    markInterrupted(event, reason),
  );
  state.queuedEvents = state.queuedEvents.map((event) =>
    markInterrupted(event, reason),
  );
  state.currentStillnessUntilMs = 0;

  return state;
}

export function scheduleJordanBehaviorEvent(
  state: JordanBehaviorTimingState,
  event: JordanBehaviorTimingEvent,
): JordanBehaviorTimingState {
  state.lastEventAtByType[event.type] = event.scheduledAtMs;
  for (const channel of event.channels ?? []) {
    state.lastChannelAt[channel.channel] = channel.startsAtMs;
  }

  if (STILLNESS_INTENTS.has(event.type)) {
    state.currentStillnessUntilMs = Math.max(
      state.currentStillnessUntilMs,
      event.holdUntilMs,
    );
  }

  if (event.metadata?.behaviorCategory === "reaction") {
    state.currentStillnessUntilMs = Math.max(
      state.currentStillnessUntilMs,
      event.holdUntilMs +
        randomRange(
          JORDAN_FINAL_HUMANIZATION_TUNING.minimumStillnessAfterReactionMs,
          state.randomSource,
        ),
    );
  }

  recordJordanBehaviorDensity(state, event);

  if (event.startsAtMs <= event.scheduledAtMs) {
    state.activeEvents.push(event);
    return state;
  }

  state.queuedEvents.push(event);
  return state;
}

export function pickJordanBehaviorIntent(
  args: JordanBehaviorIntentPickArgs,
): JordanBehaviorIntentPickResult {
  const config = args.config ?? JORDAN_BEHAVIOR_TIMING_CONFIG;
  const randomSource = args.state.randomSource;

  if (args.state.currentStillnessUntilMs > args.nowMs) {
    return {
      intent: null,
      category: null,
      skippedReason: "stillness_active",
      stillnessActive: true,
    };
  }

  if (args.speechJustEnded) {
    return pickAllowedIntent(
      ["turn_end_release"],
      "reaction",
      args,
      config,
    );
  }

  if (
    randomSource() <=
    clamp(
      JORDAN_MOTION_INDEPENDENCE_TUNING.allowNoReactionProbability +
        JORDAN_FINAL_HUMANIZATION_TUNING.noReactionProbabilityBoost[
          args.presenceState
        ],
      0,
      0.95,
    )
  ) {
    return {
      intent: null,
      category: null,
      skippedReason: "motion_independence_no_reaction",
      stillnessActive: false,
      noReactionDecision: true,
    };
  }

  const category = weightedChoice(
    modulateBehaviorCategoryWeights(
      args.presenceState,
      normalizeEmotionalMode(args.sentimentLabel, args.presenceState),
      config.behaviorWeightsByState[args.presenceState],
    ),
    randomSource,
  );

  const intents = getCandidateIntents(
    args.presenceState,
    category,
    normalizeSentiment(args.sentimentLabel),
  );

  return pickAllowedIntent(intents, category, args, config);
}

function modulateBehaviorCategoryWeights(
  presenceState: JordanBehaviorPresenceState,
  emotionalMode: JordanEmotionalModulationMode,
  weights: JordanBehaviorTimingConfig["behaviorWeightsByState"][JordanBehaviorPresenceState],
): Array<{ value: "stillness" | "microBehavior" | "reaction"; weight: number }> {
  const modulation = getEmotionalModulationProfile(emotionalMode);
  const stillnessWeight = weights.stillness * modulation.stillnessMultiplier;
  const reactionWeight =
    weights.reaction *
    modulation.reactionSpeedMultiplier *
    (emotionalMode === "sad" || emotionalMode === "anxious" ? 0.82 : 1);
  const microWeight =
    weights.microBehavior *
    (emotionalMode === "thinking" ? 0.82 : emotionalMode === "happy" ? 1.08 : 1);

  return [
    {
      value: "stillness" as const,
      weight: stillnessWeight,
    },
    {
      value: "microBehavior" as const,
      weight: microWeight,
    },
    {
      value: "reaction" as const,
      weight: presenceState === "thinking" ? reactionWeight * 0.85 : reactionWeight,
    },
  ];
}

function pickAllowedIntent(
  intents: JordanBehaviorTimingIntent[],
  category: "stillness" | "microBehavior" | "reaction",
  args: JordanBehaviorIntentPickArgs,
  config: JordanBehaviorTimingConfig,
): JordanBehaviorIntentPickResult {
  const shuffledIntents = shuffle(intents, args.state.randomSource);
  let lastCooldownHit: JordanBehaviorTimingCooldownHit | undefined;

  for (const intent of shuffledIntents) {
    if (hasPendingJordanBehaviorIntent(args.state, intent, args.nowMs)) {
      continue;
    }

    const repeatedIntent = getRecentIntentCount(args.state, intent, args.nowMs);
    if (
      repeatedIntent >= JORDAN_FINAL_HUMANIZATION_TUNING.maxRepeatedIntentCount
    ) {
      const repeatCooldownMs = randomRange(
        JORDAN_FINAL_HUMANIZATION_TUNING.repeatedIntentCooldownMs,
        args.state.randomSource,
      );
      const lastEventAtMs = args.state.lastEventAtByType[intent];
      if (lastEventAtMs === undefined || args.nowMs < lastEventAtMs + repeatCooldownMs) {
        continue;
      }
    }

    if (
      !passesIntentProbability(
        args.state,
        intent,
        config,
        args.state.randomSource,
        normalizeEmotionalMode(args.sentimentLabel, args.presenceState),
        args.nowMs,
      )
    ) {
      continue;
    }

    const cooldownHit = getCooldownHit(
      intent,
      args.state,
      args.nowMs,
      config,
    );

    if (cooldownHit) {
      lastCooldownHit = cooldownHit;
      continue;
    }

    return {
      intent,
      category,
      stillnessActive: false,
    };
  }

  return {
    intent: null,
    category,
    skippedReason: lastCooldownHit ? "cooldown_active" : "probability_skip",
    cooldownHit: lastCooldownHit,
    stillnessActive: false,
  };
}

function pickJordanConversationalAwarenessIntent(args: {
  state: JordanBehaviorTimingState;
  nowMs: number;
  presenceState: JordanBehaviorPresenceState;
  sentimentLabel?: string;
  latestUserText?: string;
  latestJordanText?: string;
  previousUserText: string | null;
  previousJordanText: string | null;
  userPauseDurationMs?: number;
  speechJustStarted?: boolean;
  speechJustEnded?: boolean;
  sentimentCompound?: number;
  randomSource: () => number;
}): {
  intent: JordanBehaviorTimingIntent | null;
  beat: string | null;
  skippedReason?: string;
} {
  const tuning = JORDAN_CONVERSATIONAL_AWARENESS_TUNING;

  if (args.state.awarenessEventsThisTurn >= tuning.maxAwarenessEventsPerTurn) {
    return {
      intent: null,
      beat: null,
      skippedReason: "max_awareness_events_per_turn",
    };
  }

  const latestUserEndsSentence = endsWithSentencePunctuation(args.latestUserText);
  const userTextChanged =
    Boolean(args.latestUserText?.trim()) &&
    args.latestUserText?.trim() !== args.previousUserText?.trim();
  const latestJordanEndsSentence = endsWithSentencePunctuation(
    args.latestJordanText,
  );
  const jordanTextChanged =
    Boolean(args.latestJordanText?.trim()) &&
    args.latestJordanText?.trim() !== args.previousJordanText?.trim();

  const candidates: Array<{
    intent: JordanBehaviorTimingIntent;
    beat: string;
    probability: number;
    cooldownRange: NumberRange;
    condition: boolean;
  }> = [
    {
      intent: "post_speech_release",
      beat: "jordan_speech_ended",
      probability: tuning.sentenceEndEventProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition: args.speechJustEnded === true,
    },
    {
      intent: "pre_speech_focus",
      beat: "speech_just_started",
      probability: tuning.anticipationFocusProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition: args.speechJustStarted === true,
    },
    {
      intent: "user_sentence_end",
      beat: "user_sentence_end",
      probability: tuning.sentenceEndEventProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.presenceState === "listening" &&
        userTextChanged &&
        latestUserEndsSentence,
    },
    {
      intent: "jordan_sentence_end",
      beat: "jordan_sentence_end",
      probability: tuning.sentenceEndEventProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.presenceState !== "listening" &&
        jordanTextChanged &&
        latestJordanEndsSentence,
    },
    {
      intent: "long_pause_stillness",
      beat: "long_user_pause",
      probability: tuning.longPauseStillnessProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.presenceState === "listening" &&
        pauseExceeds(args.userPauseDurationMs, tuning.longPauseThresholdMs),
    },
    {
      intent: "user_pause_ack",
      beat: "user_pause",
      probability: tuning.userPauseAckProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.presenceState === "listening" &&
        pauseExceeds(args.userPauseDurationMs, tuning.userPauseThresholdMs),
    },
    {
      intent: "processing_pause",
      beat: "processing_pause",
      probability: tuning.longPauseStillnessProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition: args.presenceState === "thinking",
    },
    {
      intent: "anticipation_focus",
      beat: "anticipation_focus",
      probability: tuning.anticipationFocusProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.presenceState === "speaking" && args.speechJustStarted === true,
    },
    {
      intent: "turn_taking_settle",
      beat: "turn_taking_settle",
      probability: tuning.sentenceEndEventProbability,
      cooldownRange: tuning.turnTakingCooldownMs,
      condition:
        args.speechJustEnded === true && args.presenceState !== "speaking",
    },
    {
      intent: "emotional_emphasis",
      beat: "emotional_emphasis",
      probability: tuning.emotionalEmphasisProbability,
      cooldownRange: tuning.emotionalEmphasisCooldownMs,
      condition: hasEmotionalEmphasis(args.sentimentLabel, args.sentimentCompound),
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.condition) {
      continue;
    }

    if (args.randomSource() > candidate.probability) {
      return {
        intent: null,
        beat: candidate.beat,
        skippedReason: "awareness_probability_skip",
      };
    }

    const lastAt = args.state.lastAwarenessAtByType[candidate.intent];
    const cooldownMs = randomRange(candidate.cooldownRange, args.randomSource);
    if (lastAt !== undefined && args.nowMs < lastAt + cooldownMs) {
      return {
        intent: null,
        beat: candidate.beat,
        skippedReason: "awareness_cooldown",
      };
    }

    return {
      intent: candidate.intent,
      beat: candidate.beat,
    };
  }

  return {
    intent: null,
    beat: null,
  };
}

function createJordanBehaviorEvent(args: {
  intent: JordanBehaviorTimingIntent;
  state: JordanBehaviorPresenceState;
  schedulerState: JordanBehaviorTimingState;
  nowMs: number;
  sentimentLabel?: string;
  config: JordanBehaviorTimingConfig;
  emotionalMode: JordanEmotionalModulationMode;
  modulationProfile: JordanEmotionalModulationProfile;
  randomSource: () => number;
  personalityTiming?: AvatarPersonalityTimingConfig;
  category: "stillness" | "microBehavior" | "reaction";
}): JordanBehaviorTimingEvent {
  const sentiment = normalizeSentiment(args.sentimentLabel);
  const latency = args.config.emotionalLatencyBySentiment[sentiment];
  const delayRange = getDelayRangeForIntent(args.intent, args.config);
  const delayMultiplier = args.modulationProfile.reactionDelayMultiplier;
  const personalityDelayMultiplier =
    args.personalityTiming?.reactionDelayMultiplier ?? 1;
  const humanizationJitter = JORDAN_FINAL_HUMANIZATION_TUNING.randomnessJitterMultiplier;
  const delayMs =
    randomRange(delayRange, args.randomSource) *
      delayMultiplier *
      personalityDelayMultiplier +
    randomRange([latency.minDelayMs, latency.maxDelayMs], args.randomSource) *
      0.35 *
      delayMultiplier *
      personalityDelayMultiplier *
      (args.personalityTiming?.emotionalLatency ?? 1) +
    randomRange([-180, 220], args.randomSource) * humanizationJitter;
  const durationMs = getDurationForIntent(
    args.intent,
    args.state,
    args.config,
    args.modulationProfile,
    args.personalityTiming,
    args.randomSource,
  );
  const startsAtMs = Math.round(args.nowMs + delayMs);
  const endsAtMs = Math.round(
    startsAtMs +
      Math.max(
        180,
        durationMs + randomRange([-160, 260], args.randomSource) * humanizationJitter,
      ),
  );
  const intensity = getIntensityForIntent(
    args.intent,
    args.config,
    args.randomSource,
  );
  const scaledIntensity = clamp(
    intensity *
      latency.reactionScale *
      JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier[args.state],
    0,
    1,
  );
  const weight = getWeightForIntent(args.intent, args.state, args.config);
  const coordinationScale = randomRange(
    scaleRange(
      JORDAN_MOTION_INDEPENDENCE_TUNING.imperfectCoordinationAmount,
      args.personalityTiming?.nervousSystemVariance ?? 1,
    ),
    args.randomSource,
  );
  const motionChannels = createJordanBehaviorMotionChannels({
    intent: args.intent,
    presenceState: args.state,
    state: args.schedulerState,
    startsAtMs,
    endsAtMs,
    intensity: scaledIntensity,
    coordinationScale,
    config: JORDAN_MOTION_INDEPENDENCE_TUNING,
    randomSource: args.randomSource,
  });
  const eventEndsAtMs = Math.max(
    endsAtMs,
    ...motionChannels.channels.map((channel) => channel.endsAtMs),
  );

  return {
    id: `${args.intent}-${args.nowMs}-${Math.floor(
      args.randomSource() * 1_000_000,
    )}`,
    type: args.intent,
    state: args.state,
    scheduledAtMs: args.nowMs,
    startsAtMs,
    endsAtMs: eventEndsAtMs,
    holdUntilMs: Math.max(
      eventEndsAtMs,
      Math.round(startsAtMs + durationMs * 0.8 * coordinationScale),
    ),
    intensity: clamp(scaledIntensity * coordinationScale, 0, 1),
    weight: clamp(weight * latency.reactionScale, 0, 1),
    interrupted: false,
    channels: motionChannels.channels,
    metadata: {
      schedulerPhase: 2,
      sentiment,
      emotionalMode: args.emotionalMode,
      modulationProfile: args.modulationProfile,
      motionIndependence: true,
      finalHumanization: true,
      behaviorCategory: args.category,
      subtletyMultiplier:
        JORDAN_FINAL_HUMANIZATION_TUNING.subtletyMultiplier[args.state],
      coordinationScale,
      skippedChannels: motionChannels.skippedChannels,
      channelCooldownHits: motionChannels.cooldownHits,
      blinkDelayMultiplier: args.modulationProfile.blinkDelayMultiplier,
      producesAnimationValues: false,
    },
  };
}

function createJordanBehaviorMotionChannels(args: {
  intent: JordanBehaviorTimingIntent;
  presenceState: JordanBehaviorPresenceState;
  state: JordanBehaviorTimingState;
  startsAtMs: number;
  endsAtMs: number;
  intensity: number;
  coordinationScale: number;
  config: JordanMotionIndependenceConfig;
  randomSource: () => number;
}): {
  channels: JordanBehaviorTimingChannel[];
  skippedChannels: Array<{
    channel: JordanBehaviorMotionChannel;
    reason: string;
    cooldownUntilMs?: number;
  }>;
  cooldownHits: Array<{
    channel: JordanBehaviorMotionChannel;
    cooldownUntilMs: number;
  }>;
} {
  const selectedChannels: JordanBehaviorTimingChannel[] = [];
  const skippedChannels: Array<{
    channel: JordanBehaviorMotionChannel;
    reason: string;
    cooldownUntilMs?: number;
  }> = [];
  const cooldownHits: Array<{
    channel: JordanBehaviorMotionChannel;
    cooldownUntilMs: number;
  }> = [];
  const maxChannels = args.config.maxChannelsPerEvent[args.presenceState];
  const candidates = shuffle(
    getCandidateChannelsForIntent(args.intent),
    args.randomSource,
  );
  let lastStartAtMs = Number.NEGATIVE_INFINITY;

  for (const channel of candidates) {
    if (selectedChannels.length >= maxChannels) {
      skippedChannels.push({ channel, reason: "max_channels_per_event" });
      continue;
    }

    const probability = args.config.probabilityByChannel[channel];
    if (args.randomSource() > probability) {
      skippedChannels.push({ channel, reason: "channel_probability_skip" });
      continue;
    }

    const cooldownRange = args.config.channelCooldownMs[channel];
    const cooldownMs =
      randomRange(cooldownRange, args.randomSource) *
      randomRange(
        scaleRange(
          [0.86, 1.18],
          JORDAN_FINAL_HUMANIZATION_TUNING.randomnessJitterMultiplier,
        ),
        args.randomSource,
      );
    const lastChannelAt = args.state.lastChannelAt[channel];
    if (
      lastChannelAt !== undefined &&
      args.startsAtMs < lastChannelAt + cooldownMs
    ) {
      const cooldownUntilMs = Math.round(lastChannelAt + cooldownMs);
      skippedChannels.push({
        channel,
        reason: "channel_cooldown",
        cooldownUntilMs,
      });
      cooldownHits.push({ channel, cooldownUntilMs });
      continue;
    }

    const offsetMs =
      randomRange(args.config.channelOffsetsMs[channel], args.randomSource) *
      JORDAN_FINAL_HUMANIZATION_TUNING.randomnessJitterMultiplier;
    const jitterMs =
      randomRange(args.config.channelJitterMs[args.presenceState], args.randomSource) *
      JORDAN_FINAL_HUMANIZATION_TUNING.randomnessJitterMultiplier;
    const minSeparationMs = randomRange([80, 140], args.randomSource);
    const startsAtMs = Math.round(
      Math.max(
        args.startsAtMs + offsetMs + jitterMs,
        lastStartAtMs + minSeparationMs,
      ),
    );
    const channelDurationMs = Math.max(
      180,
      (args.endsAtMs - args.startsAtMs) *
        randomRange([0.58, 1.05], args.randomSource) *
        args.coordinationScale,
    );

    selectedChannels.push({
      channel,
      startsAtMs,
      endsAtMs: Math.round(
        Math.min(args.endsAtMs + jitterMs * 0.45, startsAtMs + channelDurationMs),
      ),
      intensity: clamp(
        args.intensity *
          args.coordinationScale *
          randomRange([0.72, 1.08], args.randomSource),
        0,
        1,
      ),
      metadata: {
        offsetMs: Math.round(startsAtMs - args.startsAtMs),
        cooldownMs: Math.round(cooldownMs),
        humanizationJitterMs: Math.round(jitterMs),
        producesAnimationValues: false,
      },
    });
    lastStartAtMs = startsAtMs;
  }

  return {
    channels: selectedChannels,
    skippedChannels,
    cooldownHits,
  };
}

function getCandidateChannelsForIntent(
  intent: JordanBehaviorTimingIntent,
): JordanBehaviorMotionChannel[] {
  switch (intent) {
    case "idle_stillness":
    case "speaking_settle":
      return ["eye", "blink"];
    case "idle_micro_adjust":
      return ["mouth", "cheek", "eye"];
    case "listening_ack":
      return ["eye", "brow", "mouth", "cheek", "head", "blink"];
    case "listening_soft_smile":
    case "speaking_soften":
      return ["mouth", "cheek", "eye"];
    case "empathy_soften":
      return ["eye", "brow", "mouth", "cheek", "blink"];
    case "thinking_absorb":
    case "soft_processing_pause":
      return ["eye", "brow", "blink"];
    case "brow_soft_lift":
    case "brow_concern":
    case "speaking_emphasis":
      return ["brow", "eye", "head"];
    case "eye_refocus":
    case "micro_focus_shift":
      return ["eye", "blink"];
    case "micro_head_tilt":
    case "micro_head_shake":
      return ["head", "eye"];
    case "turn_end_release":
    case "jordan_sentence_end":
    case "turn_taking_settle":
    case "post_speech_release":
      return ["blink", "eye", "mouth", "cheek", "head"];
    case "user_sentence_end":
    case "user_pause_ack":
      return ["eye", "brow", "mouth", "cheek", "blink"];
    case "long_pause_stillness":
    case "processing_pause":
      return ["eye", "brow", "blink"];
    case "anticipation_focus":
    case "pre_speech_focus":
      return ["eye", "brow"];
    case "emotional_emphasis":
      return ["brow", "eye", "mouth", "cheek"];
    default:
      return ["eye"];
  }
}

function getCandidateIntents(
  state: JordanBehaviorPresenceState,
  category: "stillness" | "microBehavior" | "reaction",
  sentiment: JordanSentimentKey,
): JordanBehaviorTimingIntent[] {
  if (category === "stillness") {
    if (state === "thinking") {
      return ["soft_processing_pause", "thinking_absorb"];
    }

    if (state === "listening") {
      return ["soft_processing_pause"];
    }

    if (state === "speaking") {
      return ["speaking_settle", "soft_processing_pause"];
    }

    return ["idle_stillness"];
  }

  if (category === "microBehavior") {
    if (state === "idle") {
      return ["idle_micro_adjust", "eye_refocus", "micro_head_tilt"];
    }

    if (state === "thinking") {
      return ["eye_refocus", "brow_concern", "micro_head_tilt"];
    }

    if (state === "speaking") {
      return ["speaking_soften", "eye_refocus", "micro_head_tilt", "brow_soft_lift"];
    }

    return [
      "eye_refocus",
      "listening_soft_smile",
      "brow_soft_lift",
      "micro_head_tilt",
    ];
  }

  if (state === "thinking") {
    return sentiment === "sad" || sentiment === "anxious"
      ? ["thinking_absorb", "empathy_soften", "soft_processing_pause"]
      : ["thinking_absorb", "eye_refocus"];
  }

  if (state === "listening") {
    if (sentiment === "sad" || sentiment === "anxious") {
      return ["empathy_soften", "brow_concern", "soft_processing_pause", "listening_ack"];
    }

    return sentiment === "happy"
      ? ["listening_ack", "listening_soft_smile", "brow_soft_lift"]
      : ["listening_ack", "brow_soft_lift", "eye_refocus"];
  }

  if (state === "speaking") {
    return ["speaking_emphasis", "eye_refocus", "micro_head_tilt"];
  }

  return ["brow_soft_lift", "idle_micro_adjust", "eye_refocus"];
}

function hasPendingJordanBehaviorIntent(
  state: JordanBehaviorTimingState,
  intent: JordanBehaviorTimingIntent,
  nowMs: number,
): boolean {
  return [...state.activeEvents, ...state.queuedEvents].some(
    (event) =>
      !event.interrupted &&
      event.type === intent &&
      event.holdUntilMs > nowMs,
  );
}

function interruptIncompatibleEvents(
  state: JordanBehaviorTimingState,
  presenceState: JordanBehaviorPresenceState,
  nowMs: number,
): JordanBehaviorTimingEvent[] {
  const incompatible = new Set(STATE_INTERRUPTS[presenceState]);
  const interruptedEvents: JordanBehaviorTimingEvent[] = [];

  state.queuedEvents = state.queuedEvents.map((event) => {
    if (!incompatible.has(event.type)) {
      return event;
    }

    const interrupted = markInterrupted(
      event,
      `presence_changed_to_${presenceState}`,
    );
    const staggered = markChannelsInterrupted(
      interrupted,
      `presence_changed_to_${presenceState}`,
      nowMs,
      state.randomSource,
    );
    interruptedEvents.push(staggered);
    return staggered;
  });

  state.activeEvents = state.activeEvents.map((event) => {
    if (!incompatible.has(event.type) || event.endsAtMs - nowMs <= 600) {
      return event;
    }

    const interrupted = markInterrupted(
      event,
      `presence_changed_to_${presenceState}`,
    );
    const staggered = markChannelsInterrupted(
      interrupted,
      `presence_changed_to_${presenceState}`,
      nowMs,
      state.randomSource,
    );
    interruptedEvents.push(staggered);
    return staggered;
  });

  if (presenceState !== "idle") {
    state.currentStillnessUntilMs = 0;
  }

  return interruptedEvents;
}

function getDelayRangeForIntent(
  intent: JordanBehaviorTimingIntent,
  config: JordanBehaviorTimingConfig,
): NumberRange {
  if (intent === "user_sentence_end" || intent === "user_pause_ack") {
    return JORDAN_CONVERSATIONAL_AWARENESS_TUNING.acknowledgmentDelayMs;
  }

  if (intent === "jordan_sentence_end") {
    return JORDAN_CONVERSATIONAL_AWARENESS_TUNING.sentenceEndBlinkDelayMs;
  }

  if (intent === "post_speech_release" || intent === "turn_taking_settle") {
    return config.reactionDelay.turnEndRelease;
  }

  if (intent === "processing_pause" || intent === "long_pause_stillness") {
    return JORDAN_CONVERSATIONAL_AWARENESS_TUNING.processingPauseDelayMs;
  }

  if (intent === "anticipation_focus" || intent === "pre_speech_focus") {
    return JORDAN_CONVERSATIONAL_AWARENESS_TUNING.anticipationPauseMs;
  }

  if (intent === "emotional_emphasis") {
    return JORDAN_CONVERSATIONAL_AWARENESS_TUNING.emotionalEmphasisDelayMs;
  }

  if (intent === "listening_ack" || intent === "listening_soft_smile") {
    return config.reactionDelay.listeningAck;
  }

  if (intent === "empathy_soften" || intent === "brow_concern") {
    return config.reactionDelay.empathySoften;
  }

  if (
    intent === "thinking_absorb" ||
    intent === "soft_processing_pause" ||
    intent === "speaking_settle"
  ) {
    return config.reactionDelay.thinkingAbsorb;
  }

  if (intent === "turn_end_release") {
    return config.reactionDelay.turnEndRelease;
  }

  if (intent === "speaking_emphasis" || intent === "speaking_soften") {
    return [350, 900];
  }

  return [250, 900];
}

function getDurationForIntent(
  intent: JordanBehaviorTimingIntent,
  state: JordanBehaviorPresenceState,
  config: JordanBehaviorTimingConfig,
  modulationProfile: JordanEmotionalModulationProfile,
  personalityTiming: AvatarPersonalityTimingConfig | undefined,
  randomSource: () => number,
): number {
  const reactionSpeed = personalityTiming?.reactionSpeed ?? 1;
  const stillnessPreference =
    state === "thinking"
      ? personalityTiming?.thinkingStillness ?? personalityTiming?.stillnessPreference ?? 1
      : personalityTiming?.stillnessPreference ?? 1;

  if (STILLNESS_INTENTS.has(intent)) {
    return (
      randomRange(config.stillnessWindows[state], randomSource) *
      modulationProfile.stillnessMultiplier *
      stillnessPreference
    );
  }

  if (
    intent === "jordan_sentence_end" ||
    intent === "post_speech_release" ||
    intent === "turn_taking_settle"
  ) {
    return randomRange(
      JORDAN_CONVERSATIONAL_AWARENESS_TUNING.sentenceEndSettleMs,
      randomSource,
    );
  }

  if (intent === "processing_pause" || intent === "long_pause_stillness") {
    return randomRange([1200, 2800], randomSource);
  }

  if (intent === "anticipation_focus" || intent === "pre_speech_focus") {
    return randomRange([450, 1100], randomSource);
  }

  if (
    intent === "user_sentence_end" ||
    intent === "user_pause_ack" ||
    intent === "emotional_emphasis"
  ) {
    return randomRange([900, 2200], randomSource);
  }

  if (intent === "thinking_absorb" || intent === "empathy_soften") {
    return (
      randomRange([1300, 2600], randomSource) /
      (modulationProfile.reactionSpeedMultiplier * reactionSpeed)
    );
  }

  if (intent === "turn_end_release") {
    return (
      randomRange([450, 1100], randomSource) /
      (modulationProfile.reactionSpeedMultiplier * reactionSpeed)
    );
  }

  if (intent === "speaking_emphasis" || intent === "speaking_soften") {
    return (
      randomRange([900, 1800], randomSource) /
      (modulationProfile.reactionSpeedMultiplier * reactionSpeed)
    );
  }

  if (intent === "speaking_settle") {
    return (
      randomRange([600, 1400], randomSource) /
      (modulationProfile.reactionSpeedMultiplier * reactionSpeed)
    );
  }

  return (
    randomRange(DEFAULT_EVENT_DURATION_MS, randomSource) /
    (modulationProfile.reactionSpeedMultiplier * reactionSpeed)
  );
}

function getIntensityForIntent(
  intent: JordanBehaviorTimingIntent,
  config: JordanBehaviorTimingConfig,
  randomSource: () => number,
): number {
  if (intent === "brow_soft_lift" || intent === "speaking_emphasis") {
    return randomRange(config.behaviorIntensityRanges.browLift, randomSource);
  }

  if (
    intent === "user_sentence_end" ||
    intent === "user_pause_ack" ||
    intent === "emotional_emphasis"
  ) {
    return randomRange(config.behaviorIntensityRanges.browLift, randomSource);
  }

  if (
    intent === "processing_pause" ||
    intent === "long_pause_stillness" ||
    intent === "anticipation_focus" ||
    intent === "pre_speech_focus" ||
    intent === "jordan_sentence_end" ||
    intent === "turn_taking_settle" ||
    intent === "post_speech_release"
  ) {
    return randomRange(config.behaviorIntensityRanges.eyeRefocus, randomSource);
  }

  if (intent === "brow_concern" || intent === "empathy_soften") {
    return randomRange(config.behaviorIntensityRanges.browKnit, randomSource);
  }

  if (intent === "listening_soft_smile" || intent === "speaking_soften") {
    return randomRange(config.behaviorIntensityRanges.microSmile, randomSource);
  }

  if (intent === "micro_head_tilt") {
    return randomRange(
      config.behaviorIntensityRanges.headTiltRadians,
      randomSource,
    );
  }

  if (intent === "micro_head_shake") {
    return randomRange(
      config.behaviorIntensityRanges.headYawRadians,
      randomSource,
    );
  }

  if (intent === "eye_refocus" || intent === "micro_focus_shift") {
    return randomRange(config.behaviorIntensityRanges.eyeRefocus, randomSource);
  }

  if (intent === "thinking_absorb") {
    return randomRange(
      config.behaviorIntensityRanges.concernFrown,
      randomSource,
    );
  }

  if (
    intent === "idle_stillness" ||
    intent === "soft_processing_pause" ||
    intent === "speaking_settle"
  ) {
    return 0;
  }

  return randomRange([0.02, 0.08], randomSource);
}

function getWeightForIntent(
  intent: JordanBehaviorTimingIntent,
  state: JordanBehaviorPresenceState,
  config: JordanBehaviorTimingConfig,
): number {
  const weights = config.behaviorWeightsByState[state];

  if (STILLNESS_INTENTS.has(intent)) {
    return weights.stillness;
  }

  if (
    intent === "listening_ack" ||
    intent === "user_sentence_end" ||
    intent === "user_pause_ack" ||
    intent === "emotional_emphasis" ||
    intent === "empathy_soften" ||
    intent === "thinking_absorb" ||
    intent === "turn_end_release" ||
    intent === "jordan_sentence_end" ||
    intent === "turn_taking_settle" ||
    intent === "post_speech_release" ||
    intent === "pre_speech_focus" ||
    intent === "speaking_emphasis"
  ) {
    return weights.reaction;
  }

  return weights.microBehavior;
}

function passesIntentProbability(
  state: JordanBehaviorTimingState,
  intent: JordanBehaviorTimingIntent,
  config: JordanBehaviorTimingConfig,
  randomSource: () => number,
  emotionalMode: JordanEmotionalModulationMode,
  nowMs: number,
): boolean {
  const probabilityKey = INTENT_PROBABILITY_KEYS[intent];

  if (!probabilityKey) {
    return true;
  }

  const changes = getReactionProbabilityChanges(emotionalMode);
  const repeatPenalty =
    getRecentIntentCount(state, intent, nowMs) > 0
      ? JORDAN_FINAL_HUMANIZATION_TUNING.sameIntentRepeatPenalty
      : 1;
  const repeatedChannels = getCandidateChannelsForIntent(intent).filter(
    (channel) => getRecentChannelCount(state, channel, nowMs) > 0,
  ).length;
  const channelPenalty =
    repeatedChannels > 0
      ? Math.pow(
          JORDAN_FINAL_HUMANIZATION_TUNING.sameChannelRepeatPenalty,
          repeatedChannels,
        )
      : 1;

  return randomSource() <= clamp(
    config.reactionProbabilities[probabilityKey] *
      (changes[intent] ?? 1) *
      repeatPenalty *
      channelPenalty,
    0,
    0.95,
  );
}

function getReactionProbabilityChanges(
  emotionalMode: JordanEmotionalModulationMode,
): Partial<Record<JordanBehaviorTimingIntent, number>> {
  if (emotionalMode === "happy") {
    return {
      listening_ack: 1.14,
      listening_soft_smile: 1.18,
      speaking_soften: 1.12,
      eye_refocus: 1.12,
      idle_stillness: 0.9,
      soft_processing_pause: 0.9,
    };
  }

  if (emotionalMode === "sad") {
    return {
      listening_soft_smile: 0.45,
      speaking_soften: 0.5,
      empathy_soften: 1.22,
      brow_concern: 1.2,
      soft_processing_pause: 1.25,
      idle_stillness: 1.18,
      micro_head_tilt: 0.72,
      micro_head_shake: 0.65,
    };
  }

  if (emotionalMode === "anxious") {
    return {
      listening_soft_smile: 0.55,
      speaking_soften: 0.55,
      empathy_soften: 1.15,
      brow_concern: 1.2,
      soft_processing_pause: 1.18,
      idle_stillness: 1.12,
      micro_head_tilt: 0.78,
      micro_head_shake: 0.7,
    };
  }

  if (emotionalMode === "thinking") {
    return {
      thinking_absorb: 1.25,
      soft_processing_pause: 1.3,
      listening_soft_smile: 0.45,
      speaking_soften: 0.45,
      eye_refocus: 0.8,
      idle_stillness: 1.25,
      micro_head_tilt: 0.7,
      micro_head_shake: 0.6,
    };
  }

  return {};
}

function getCooldownHit(
  intent: JordanBehaviorTimingIntent,
  state: JordanBehaviorTimingState,
  nowMs: number,
  config: JordanBehaviorTimingConfig,
): JordanBehaviorTimingCooldownHit | undefined {
  const cooldownKey = INTENT_COOLDOWN_KEYS[intent];

  if (!cooldownKey) {
    return undefined;
  }

  const lastEventAtMs = state.lastEventAtByType[intent];

  if (lastEventAtMs === undefined) {
    return undefined;
  }

  const cooldownUntilMs = lastEventAtMs + config.reactionCooldowns[cooldownKey][1];

  if (nowMs >= cooldownUntilMs) {
    return undefined;
  }

  return {
    intent,
    cooldownKey,
    lastEventAtMs,
    cooldownUntilMs,
  };
}

function normalizeSentiment(sentimentLabel?: string): JordanSentimentKey {
  const sentiment = sentimentLabel?.toLowerCase() ?? "neutral";

  if (
    sentiment.includes("happy") ||
    sentiment.includes("joy") ||
    sentiment.includes("positive") ||
    sentiment.includes("warm") ||
    sentiment.includes("supportive") ||
    sentiment.includes("hopeful")
  ) {
    return "happy";
  }

  if (
    sentiment.includes("sad") ||
    sentiment.includes("negative") ||
    sentiment.includes("serious") ||
    sentiment.includes("down") ||
    sentiment.includes("crisis")
  ) {
    return "sad";
  }

  if (
    sentiment.includes("anxious") ||
    sentiment.includes("stress") ||
    sentiment.includes("stressed") ||
    sentiment.includes("worried")
  ) {
    return "anxious";
  }

  return "neutral";
}

function normalizeEmotionalMode(
  sentimentLabel: string | undefined,
  presenceState: JordanBehaviorPresenceState,
): JordanEmotionalModulationMode {
  if (presenceState === "thinking") {
    return "thinking";
  }

  return normalizeSentiment(sentimentLabel);
}

function getEmotionalModulationProfile(
  emotionalMode: JordanEmotionalModulationMode,
): JordanEmotionalModulationProfile {
  return JORDAN_EMOTIONAL_MODULATION_TUNING[emotionalMode];
}

function endsWithSentencePunctuation(text?: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text?.trim() ?? "");
}

function pauseExceeds(
  pauseDurationMs: number | undefined,
  thresholdRange: NumberRange,
): boolean {
  return typeof pauseDurationMs === "number" && pauseDurationMs >= thresholdRange[0];
}

function hasEmotionalEmphasis(
  sentimentLabel?: string,
  sentimentCompound?: number,
): boolean {
  if (typeof sentimentCompound === "number" && Math.abs(sentimentCompound) >= 0.55) {
    return true;
  }

  const sentiment = sentimentLabel?.toLowerCase() ?? "";
  return (
    sentiment.includes("happy") ||
    sentiment.includes("positive") ||
    sentiment.includes("hopeful") ||
    sentiment.includes("sad") ||
    sentiment.includes("negative") ||
    sentiment.includes("anxious") ||
    sentiment.includes("crisis") ||
    sentiment.includes("worried") ||
    sentiment.includes("stressed")
  );
}

function getMissingConversationalSignals(
  args: JordanBehaviorTimingUpdateArgs,
): string[] {
  const missingSignals: string[] = [];

  if (!args.latestUserText) {
    missingSignals.push("latestUserText");
  }

  if (!args.latestJordanText) {
    missingSignals.push("latestJordanText");
  }

  if (args.userPauseDurationMs === undefined) {
    missingSignals.push("userPauseDurationMs");
  }

  if (args.sentimentCompound === undefined) {
    missingSignals.push("sentimentCompound");
  }

  return missingSignals;
}

function markInterrupted(
  event: JordanBehaviorTimingEvent,
  reason: string,
): JordanBehaviorTimingEvent {
  return {
    ...event,
    interrupted: true,
    channels: event.channels?.map((channel) => ({
      ...channel,
      interrupted: true,
      metadata: {
        ...channel.metadata,
        interruptedReason: reason,
      },
    })),
    metadata: {
      ...event.metadata,
      interruptedReason: reason,
    },
  };
}

function markChannelsInterrupted(
  event: JordanBehaviorTimingEvent,
  reason: string,
  nowMs: number,
  randomSource: () => number,
): JordanBehaviorTimingEvent {
  let maxVarianceMs = 0;
  const channels = event.channels?.map((channel) => {
    const varianceMs = Math.round(
      randomRange(
        JORDAN_MOTION_INDEPENDENCE_TUNING.interruptionVarianceMs,
        randomSource,
      ),
    );
    maxVarianceMs = Math.max(maxVarianceMs, varianceMs);
    const interruptedAtMs = nowMs + varianceMs;

    return {
      ...channel,
      interrupted: true,
      metadata: {
        ...channel.metadata,
        interruptedReason: reason,
        interruptedAtMs,
        interruptionVarianceMs: varianceMs,
      },
    };
  });

  return {
    ...event,
    channels,
    metadata: {
      ...event.metadata,
      interruptedReason: reason,
      interruptionVarianceMs: maxVarianceMs,
    },
  };
}

function pruneJordanBehaviorDensityRecords(
  state: JordanBehaviorTimingState,
  nowMs: number,
): void {
  const cutoffMs = nowMs - JORDAN_FINAL_HUMANIZATION_TUNING.overactivityWindowMs;
  state.recentEvents = state.recentEvents.filter(
    (event) => event.timestampMs >= cutoffMs,
  );
}

function recordJordanBehaviorDensity(
  state: JordanBehaviorTimingState,
  event: JordanBehaviorTimingEvent,
): void {
  state.recentEvents.push({
    type: event.type,
    state: event.state,
    timestampMs: event.scheduledAtMs,
    intensity: event.intensity,
    durationMs: Math.max(0, event.endsAtMs - event.startsAtMs),
  });

  for (const channel of event.channels ?? []) {
    state.recentEvents.push({
      type: event.type,
      state: event.state,
      channel: channel.channel,
      timestampMs: channel.startsAtMs,
      intensity: channel.intensity,
      durationMs: Math.max(0, channel.endsAtMs - channel.startsAtMs),
    });
  }
}

function getJordanBehaviorHumanizationStatus(
  state: JordanBehaviorTimingState,
  presenceState: JordanBehaviorPresenceState,
  nowMs: number,
): JordanBehaviorHumanizationDebug {
  const cutoffMs = nowMs - JORDAN_FINAL_HUMANIZATION_TUNING.overactivityWindowMs;
  const recentEvents = state.recentEvents.filter(
    (event) => event.timestampMs >= cutoffMs && event.state === presenceState,
  );
  const rootEvents = recentEvents.filter((event) => event.channel === undefined);
  const counts = rootEvents.reduce(
    (totals, event) => {
      totals[getJordanBehaviorCategoryForIntent(event.type, event.state)] += 1;
      return totals;
    },
    {
      stillness: 0,
      microBehavior: 0,
      reaction: 0,
    },
  );
  const total = Math.max(1, rootEvents.length);
  const repeatedIntentCount = Math.max(
    0,
    ...Object.values(
      rootEvents.reduce<Record<string, number>>((totals, event) => {
        totals[event.type] = (totals[event.type] ?? 0) + 1;
        return totals;
      }, {}),
    ),
  );
  const maxEventsPerWindow =
    JORDAN_FINAL_HUMANIZATION_TUNING.maxEventsPerWindow[presenceState];
  const overactivityPreventionActive = rootEvents.length >= maxEventsPerWindow;

  return {
    rollingRatio: {
      stillness: counts.stillness / total,
      microBehavior: counts.microBehavior / total,
      reaction: counts.reaction / total,
    },
    eventCountInWindow: rootEvents.length,
    maxEventsPerWindow,
    repeatedIntentCount,
    skippedReason: overactivityPreventionActive
      ? "humanization_overactivity_window"
      : repeatedIntentCount >
          JORDAN_FINAL_HUMANIZATION_TUNING.maxRepeatedIntentCount
        ? "humanization_repeated_intent"
        : undefined,
    overactivityPreventionActive,
    minimumStillnessUntilMs: state.currentStillnessUntilMs,
  };
}

function getRecentIntentCount(
  state: JordanBehaviorTimingState,
  intent: JordanBehaviorTimingIntent,
  nowMs: number,
): number {
  const cutoffMs = nowMs - JORDAN_FINAL_HUMANIZATION_TUNING.overactivityWindowMs;
  return state.recentEvents.filter(
    (event) =>
      event.channel === undefined &&
      event.type === intent &&
      event.timestampMs >= cutoffMs,
  ).length;
}

function getRecentChannelCount(
  state: JordanBehaviorTimingState,
  channel: JordanBehaviorMotionChannel,
  nowMs: number,
): number {
  const cutoffMs = nowMs - JORDAN_FINAL_HUMANIZATION_TUNING.overactivityWindowMs;
  return state.recentEvents.filter(
    (event) => event.channel === channel && event.timestampMs >= cutoffMs,
  ).length;
}

function getJordanBehaviorCategoryForIntent(
  intent: JordanBehaviorTimingIntent,
  state: JordanBehaviorPresenceState,
): "stillness" | "microBehavior" | "reaction" {
  if (
    STILLNESS_INTENTS.has(intent) ||
    intent === "long_pause_stillness" ||
    intent === "processing_pause" ||
    intent === "speaking_settle"
  ) {
    return "stillness";
  }

  if (
    intent === "listening_ack" ||
    intent === "empathy_soften" ||
    intent === "thinking_absorb" ||
    intent === "turn_end_release" ||
    intent === "speaking_emphasis" ||
    intent === "user_sentence_end" ||
    intent === "jordan_sentence_end" ||
    intent === "user_pause_ack" ||
    intent === "emotional_emphasis" ||
    intent === "turn_taking_settle" ||
    intent === "pre_speech_focus" ||
    intent === "post_speech_release"
  ) {
    return "reaction";
  }

  void state;
  return "microBehavior";
}

function randomRange(range: NumberRange, randomSource: () => number): number {
  const [min, max] = range;
  return min + (max - min) * randomSource();
}

function scaleRange(range: NumberRange, multiplier: number): NumberRange {
  return [range[0] * multiplier, range[1] * multiplier];
}

function getPersonalityAppliedMultipliers(
  personalityTiming: AvatarPersonalityTimingConfig | undefined,
): Record<string, number> {
  return {
    reactionSpeed: personalityTiming?.reactionSpeed ?? 1,
    reactionDelayMultiplier: personalityTiming?.reactionDelayMultiplier ?? 1,
    stillnessPreference: personalityTiming?.stillnessPreference ?? 1,
    emotionalLatency: personalityTiming?.emotionalLatency ?? 1,
    nervousSystemVariance: personalityTiming?.nervousSystemVariance ?? 1,
  };
}

function weightedChoice<T>(
  options: Array<{ value: T; weight: number }>,
  randomSource: () => number,
): T {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = randomSource() * totalWeight;

  for (const option of options) {
    cursor -= option.weight;

    if (cursor <= 0) {
      return option.value;
    }
  }

  return options[options.length - 1].value;
}

function shuffle<T>(items: T[], randomSource: () => number): T[] {
  return [...items].sort(() => randomSource() - 0.5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
