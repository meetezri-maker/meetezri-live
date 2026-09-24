import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import { createLiveSentencePlanner } from "./liveSentencePlanner";
import type { LiveAvatarPayload } from "./liveAvatarPayload";
import type { BlendshapePose } from "./engine/types/facialAnimation";
import type {
  Hyper3dFrameReview,
  Hyper3dMouthTrace,
  Hyper3dViewportFacts,
} from "./hyper3dFrameOrchestrator";
import {
  countHyper3dAppendAttempt,
  countHyper3dAppendSkip,
  countHyper3dAppendSuccess,
  countHyper3dRecorderCall,
  getHyper3dPathReport,
  recordHyper3dWelcomeStartup,
} from "./hyper3dPathDiagnostics";
import {
  createLiveSpeechTimeline,
  type LiveChunkAppendResult,
  type LiveSpeechTimeline,
  type LiveTimelineStats,
} from "./liveSpeechTimeline";
import {
  createSolaceAudioClock,
  type SolaceAudioClock,
} from "./solaceAudioClock";
import {
  createLiveAcousticTrack,
  type LiveAcousticChunk,
  type LiveAcousticTrack,
} from "./liveAcousticTrack";

/**
 * SOLACE → HYPER3D LIVE SPEECH ADAPTER (Phase 1 seam).
 *
 * One object that owns the live timeline, the audio clock and the diagnostics,
 * and exposes the handful of call sites `ActiveSession` needs. It is
 * deliberately a plain object rather than a hook or a context: it must be
 * callable from inside the scheduler's synchronous `onChunkScheduled` path,
 * where a React state update would be both wrong and expensive.
 *
 * NOTHING HERE TOUCHES AUDIO. The adapter has no reference to the scheduler that
 * would let it schedule, stop, or reorder anything; it is handed read-only
 * accessors. Every public method is safe to call in any order and at any time,
 * including before the first chunk and after teardown.
 *
 * PHASE 1 DOES NOT MOUNT THE RUNTIME. The payload and clock this produces are
 * not yet handed to `useAvatarStore`; that is Phase 2. What Phase 1 proves is
 * that the conversion is correct, incremental, deduplicated, cancellable, cheap,
 * and adds no latency to playback.
 */

export type Hyper3dPlaybackStatus =
  | "idle"
  | "ready"
  | "playing"
  | "paused"
  | "completed"
  | "error";

export type Hyper3dLiveAdapterDeps = {
  /** Reads the scheduler's AudioContext time. Null when no context is bound. */
  getContextTime: () => number | null;
  /** `EzriWsAudioScheduler.isPipelineActive()`. */
  isPipelineActive: () => boolean;
  /** Defaults to `performance.now`; injectable for tests. */
  now?: () => number;
};

export type Hyper3dScheduledChunk = {
  audioContextStartTime: number;
  durationMs: number;
  leadInSec: number;
  timeline: AvatarPhonemeTimeline | null;
  chunkIndex: number | null;
  sentence: string;
  /** `performance.now()` captured by the caller when the scheduler handed over. */
  scheduledAtMs: number;
  /**
   * The scheduler's already-decoded buffer, read-only and borrowed.
   *
   * Used once, asynchronously, to produce the acoustic frames the accepted head
   * performance requires. Never played, mutated, disposed or retained — the
   * reference is dropped as soon as analysis returns.
   */
  audioBuffer?: LiveAcousticChunk["audioBuffer"] | null;
  /** The session greeting: permission-gated or not. Diagnostics classification only. */
  isWelcome?: boolean;
  /** Diagnostics: the queued audio carried `avatar_data` at all. */
  rawAvatarDataPresent?: boolean;
  /** Diagnostics: format of the raw phonemes before any Hyper3D filtering. */
  rawPhonemeFormat?: Hyper3dRawPhonemeFormat | null;
  /** Diagnostics: phonemes withheld from Hyper3D because the backend sent no timing. */
  untimedPhonemeCount?: number;
  /** Diagnostics: how the client associated metadata with this audio. */
  associationMethod?: string | null;
  /** Diagnostics: the backend bundled this chunk's audio inside `avatar_data`. */
  audioB64Present?: boolean;
};

/**
 * One ownership stage's speech-owned channels. Five numbers, so carrying three
 * of these per frame costs about what one of the existing channel-map spreads
 * already costs.
 */
export type Hyper3dMouthStageSample = {
  jawOpen: number;
  mouthClose: number;
  mouthFunnel: number;
  mouthPucker: number;
  mouthMax: number;
};

/** One evaluated, audible render frame. DEV full-frame capture. */
export type Hyper3dFullFrameRecord = {
  frame: number;
  nowMs: number;
  contextTime: number | null;
  /** The host's delta, clamped at 0.1 s by the host. Use `nowMs` for true gaps. */
  deltaSeconds: number;
  instantFps: number | null;
  responseClock: number;
  chunkLocalClock: number | null;
  audioActive: boolean;
  transport: Hyper3dPlaybackStatus;
  timelineIndex: number | null;
  phoneme: string | null;
  phonemeStart: number | null;
  phonemeEnd: number | null;
  phonemePosition: number | null;
  speechActive: boolean;
  controller: Record<string, number>;
  final: Record<string, number>;
  glb: Record<string, number>;
  teethJawOpen: number;
  controllerMaxChannel: string | null;
  controllerMaxValue: number;
  presenceOwns: boolean;
  showcaseActive: boolean;
  showcaseYieldReason: string | null;
  /** Phase 2G.1C (B3): the conversation flag this frame rendered under. */
  isSpeaking: boolean;
  /** Phase 2G.1C (B3): the showcase actually changed the lower face here. */
  showcaseOwnsLowerFace: boolean;
  /**
   * The intermediate ownership stages between `controller` and `final`, so a
   * divergence names the layer that caused it. `controller` is the pose BEFORE
   * any ownership layer; `seam` is after the threejs face-ownership seam,
   * `affect` after semantic affect, `presence` after Active Presence, and
   * `final` (above) is after the idle showcase.
   */
  stages: {
    seam: Hyper3dMouthStageSample;
    affect: Hyper3dMouthStageSample;
    presence: Hyper3dMouthStageSample;
  };
};

export type Hyper3dCapturedPhoneme = {
  index: number;
  phoneme: string;
  rawPhoneme: string | null;
  start: number;
  end: number | null;
  duration: number | null;
};

export type Hyper3dFullFrameCapture = {
  kind: "welcome" | "normal";
  turnId: number;
  finalized: boolean;
  truncatedFrames: number;
  chunks: Array<{
    chunkIndex: number | null;
    sentence: string;
    rawPhonemeFormat: Hyper3dRawPhonemeFormat | null;
    timestampsExplicit: boolean;
    audioB64Present: boolean | null;
    associationMethod: string | null;
    audioContextStartTime: number;
    durationMs: number;
    leadInSec: number;
    /** `performance.now()` when the scheduler handed this chunk over. */
    scheduledAtMs: number;
    expectedAudibleEndContextTime: number;
    responseOffsetSeconds: number | null;
    decodedDurationSeconds: number | null;
    decodedSampleRate: number | null;
    decodedChannels: number | null;
    appendResult: string;
    appendedPhonemes: number;
    backendPhonemes: Hyper3dCapturedPhoneme[];
    backendFirstStart: number | null;
    backendLastEnd: number | null;
    backendPhonemeCount: number;
  }>;
  /** Response-relative phonemes the Hyper3D timeline actually holds. */
  timelinePhonemes: Hyper3dCapturedPhoneme[];
  responseOriginContextTime: number | null;
  frames: Hyper3dFullFrameRecord[];
  /** The EXISTING acoustic analysis, response-relative (trimmed domain). */
  acousticFrames: Array<{ time: number; energy: number; voicing: number }>;
  viewport: Hyper3dViewportFacts | null;
};

export type Hyper3dRawPhonemeFormat = "timestamped" | "string-fallback" | "empty";

/** What the Hyper3D timeline actually received for a chunk. */
export type Hyper3dTimingHandoff =
  | "timed"
  | "untimed-withheld"
  | "empty-phonemes"
  | "no-metadata";

/**
 * The first boundary at which expected speech articulation disappeared.
 * `null` means every stage carried it for that frame.
 */
export type Hyper3dLipSyncStage =
  | "raw-avatar-data"
  | "raw-phonemes-untimed"
  | "timeline"
  | "controller"
  | "ownership:threejs-seam"
  | "ownership:affect"
  | "ownership:active-presence"
  | "ownership:idle-showcase"
  | "morph-write";

/**
 * One assistant turn's lip-sync trace, from backend metadata to the physical
 * face-mesh influence. Every value is copied from the live runtime; nothing is
 * synthesized to fill a field.
 */
export type Hyper3dLipSyncTurnTrace = {
  isWelcome: boolean;
  // backend / queue
  rawAvatarDataPresent: boolean;
  rawPhonemeFormat: Hyper3dRawPhonemeFormat | null;
  /** Untimed phonemes the backend sent that Hyper3D did not consume. */
  untimedPhonemeCount: number;
  associationMethod: string | null;
  hyper3dTimingHandoff: Hyper3dTimingHandoff | null;
  rawPhonemeCount: number;
  rawFirstPhoneme: string | null;
  rawLastPhoneme: string | null;
  rawFirstStart: number | null;
  rawLastEnd: number | null;
  chunkIndex: number | null;
  sentence: string;
  // scheduling
  chunkScheduled: boolean;
  appendResult: string | null;
  audioContextStartTime: number | null;
  durationMs: number | null;
  leadInSec: number | null;
  responseOffsetSeconds: number | null;
  // turn identity
  adapterTurnId: number | null;
  timelineTurnId: number | null;
  plannerTurnId: number | null;
  payloadRevision: number | null;
  turnChangedDuringPlayback: boolean;
  // timeline
  timelinePhonemeCount: number;
  timelineFirstStart: number | null;
  timelineLastEnd: number | null;
  // real playback clock
  audioActive: boolean;
  transport: Hyper3dPlaybackStatus;
  audioContextCurrentTime: number | null;
  responseOriginContextTime: number | null;
  responseClockSeconds: number;
  /** (AudioContext.currentTime − origin) − responseClock, ms. ~0 unless clamped. */
  clockDomainDeltaMs: number | null;
  chunkLocalClockSeconds: number | null;
  // lookup
  activePhoneme: string | null;
  activePhonemeStart: number | null;
  activePhonemeEnd: number | null;
  clockInsidePhoneme: boolean;
  // controller
  controllerEvaluated: boolean;
  controllerSpeechActive: boolean;
  controllerPhoneme: string | null;
  // mouth BEFORE ownership layers
  preOwnershipJawOpen: number;
  preOwnershipMouthMax: number;
  preOwnershipMouthChannels: Record<string, number>;
  // intermediate ownership stages (mouth max only)
  afterThreejsSeamMouthMax: number;
  afterAffectMouthMax: number;
  afterActivePresenceMouthMax: number;
  // final pose
  finalJawOpen: number;
  finalMouthMax: number;
  finalMouthChannels: Record<string, number>;
  // showcase / presence
  idleShowcaseEligible: boolean;
  idleShowcaseActive: boolean;
  idleShowcaseYieldReason: string | null;
  activePresenceOwns: boolean;
  // actual GLB
  glbFaceMeshResolved: boolean;
  glbTeethMeshResolved: boolean;
  finalWrittenMorphCount: number;
  actualJawOpenInfluence: number;
  actualTeethJawOpenInfluence: number;
  actualMouthMaxInfluence: number;
  actualMouthMaxMorphName: string | null;
  // health
  framesDuringWelcome: number;
  framesWithActivePhoneme: number;
  framesWithControllerMouthMotion: number;
  framesWithFinalPoseMouthMotion: number;
  framesWithActualGlbMouthMotion: number;
  framesShowcaseActiveWhileAudible: number;
  firstDivergence: string | null;
  failedStage: Hyper3dLipSyncStage | null;
};

export type Hyper3dLipSyncSample = {
  responseClockSeconds: number;
  activePhoneme: string | null;
  preOwnershipMouthMax: number;
  finalMouthMax: number;
  actualMouthMaxInfluence: number;
  failedStage: Hyper3dLipSyncStage | null;
};

/**
 * `window.__solaceHyper3dWelcomeLipSync` — the single DEV surface.
 *
 * The top level is the welcome turn. `normalSpeech` is the latest non-welcome
 * turn with the SAME fields, so the first divergence between the two can be read
 * side by side. `samples` is a bounded ring buffer.
 */
export type Hyper3dWelcomeLipSyncDiagnostics = Hyper3dLipSyncTurnTrace & {
  /** Quick answers for a manual review. */
  summary: {
    audioActive: boolean;
    phonemesExist: boolean;
    clockInsidePhoneme: boolean;
    controllerMouthMoving: boolean;
    finalPoseMouthMoving: boolean;
    glbMouthMoving: boolean;
    showcaseYielded: boolean;
    fallbackOccurred: boolean;
    fallbackReason: string | null;
  };
  normalSpeech: Hyper3dLipSyncTurnTrace;
  samples: Hyper3dLipSyncSample[];
  /** Every audible evaluated frame of the latest welcome and normal turn. */
  fullFrame: {
    welcome: Hyper3dFullFrameCapture | null;
    normal: Hyper3dFullFrameCapture | null;
  };
};

/**
 * DEV-only diagnostics. ONE preallocated object, mutated in place — the sampler
 * runs on an existing RAF and must not allocate per frame.
 */
export type SentencePlanningDiagnostics = {
  turnId: number;
  planCount: number;
  frozenCount: number;
  latePlanCount: number;
  replanCount: number;
  duplicateChunks: number;
  staleChunks: number;
  leadTimeSummary: LookAheadStats | null;
  activeSentenceIndex: number | null;
  activePlanRevision: number | null;
};

export type Hyper3dLiveDiagnostics = {
  // AUDIO
  contextCurrentTime: number | null;
  activeChunkOffset: number | null;
  activeChunkStartContextTime: number | null;
  playbackStatus: Hyper3dPlaybackStatus;
  pipelineActive: boolean;
  // TIMELINE
  responseOriginContextTime: number | null;
  hyper3dTime: number;
  audioDuration: number;
  phonemeCount: number;
  chunkCount: number;
  latestChunk: {
    chunkKey: string;
    offsetSeconds: number;
    appendedPhonemes: number;
    lookAheadSeconds: number;
  } | null;
  currentPhoneme: { phoneme: string; start: number; end: number } | null;
  nextPhoneme: { phoneme: string; start: number; end: number } | null;
  // SYNC
  expectedPhonemeTime: number | null;
  actualPlaybackTime: number;
  timingDeltaMs: number | null;
  // BUFFER
  lookAheadSeconds: number;
  lookAheadStats: LookAheadStats | null;
  // LATENCY
  appendLatency: AppendLatencyStats | null;
  // ACOUSTICS — the accepted head performance's required input
  acousticFrameCount: number;
  acousticStats: ReturnType<LiveAcousticTrack["getStats"]> | null;
  // SENTENCE PLANNING — values from the live production planner/consumer.
  sentencePlanning: SentencePlanningDiagnostics;
  // AUDIT
  timelineStats: LiveTimelineStats | null;
  blockers: string[];
};

export type Hyper3dLiveReviewSample = {
  sampledAtMs: number;
  chunkIndex: number | null;
  sentenceId: string | null;
  audioContextCurrentTime: number | null;
  scheduledAudioContextStartTime: number | null;
  audioPlaybackTime: number;
  avatarEvaluationTime: number;
  hostFrameTime: number;
  clockDriftMs: number;
  chunkOffsetSeconds: number | null;
  phonemeLocalStart: number | null;
  phonemeLocalEnd: number | null;
  phonemeResponseStart: number | null;
  phonemeResponseEnd: number | null;
  sentenceStartResponseTime: number | null;
  sentenceLocalTime: number | null;
  sentenceAudibleStart: number | null;
  sentenceAudibleEnd: number | null;
  timelineCursorTime: number;
  currentPhoneme: string | null;
  previousPhoneme: string | null;
  nextPhoneme: string | null;
  articulation: BlendshapePose;
  afterFaceOwnership: BlendshapePose;
  afterAffect: BlendshapePose;
  afterOwnershipResolution: BlendshapePose;
  finalGlb: BlendshapePose & {
    faceJawOpen: number | null;
    teethJawOpen: number | null;
    jawBoneRotation: number | null;
  };
  dominantChannels: Array<{ name: string; value: number }>;
  expression: Hyper3dFrameReview["expression"];
};

export type Hyper3dLiveSentenceAudit = {
  sentenceId: string;
  rawPhonemeCount: number;
  normalizedPhonemeCount: number;
  first20RawLabels: string[];
  first20NormalizedLabels: string[];
  unknownOrRejectedLabels: string[];
  duplicateLabelCount: number;
  startEndUnits: "seconds" | "milliseconds-suspected" | "unknown";
  firstTimestamp: number | null;
  finalTimestamp: number | null;
  firstResponseTimestamp: number | null;
  finalResponseTimestamp: number | null;
  sentenceAudibleDuration: number;
  phonemeTimelineDuration: number;
  durationDifference: number;
};

export type Hyper3dLiveReviewSurface = {
  version: 1;
  clockSource: "AudioContext.currentTime - responseOriginContextTime";
  performanceClockSource: "responsePlaybackTime - sentenceStartResponseTime";
  clockDriftMs: number | null;
  currentPhoneme: string | null;
  currentPhonemeStart: number | null;
  currentPhonemeEnd: number | null;
  audioPlaybackTime: number;
  avatarEvaluationTime: number;
  sentenceId: string | null;
  sentenceLocalTime: number | null;
  chunkIndex: number | null;
  chunkBoundaryCount: number;
  sentenceBoundaryCount: number;
  timelineResetCount: number;
  controllerResetCount: number;
  unknownPhonemeCount: number;
  duplicateChunkCount: number;
  jawOpen: number;
  mouthClose: number;
  mouthFunnel: number;
  mouthPucker: number;
  smileL: number;
  smileR: number;
  affectScale: number;
  speechFade: number;
  latePlanCount: number;
  sentenceAudit: Hyper3dLiveSentenceAudit | null;
  ownershipOrder: readonly string[];
  oldSolaceVisemeWriterMounted: false;
  samples: Hyper3dLiveReviewSample[];
};

export type Hyper3dEngineReviewFrame = {
  avatarEvaluationTime: number;
  hostFrameTime: number;
  frame: Hyper3dFrameReview;
  finalBindings: BlendshapePose & {
    faceJawOpen: number | null;
    teethJawOpen: number | null;
    jawBoneRotation: number | null;
  };
};

export type LookAheadStats = {
  samples: number;
  minMs: number;
  medianMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

export type AppendLatencyStats = {
  samples: number;
  /** timelineAppendTime − chunkScheduledTime, in ms. */
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  /** Pure cost of the conversion itself, in ms. */
  medianConvertMs: number;
  maxConvertMs: number;
};

const DEV = import.meta.env.DEV === true;
const MAX_SAMPLES = 500;
const MAX_REVIEW_SAMPLES = 120;
const REVIEW_SAMPLE_INTERVAL_MS = 100;
const MAX_SCHEDULED_CHUNKS = 64;
/** Reads one ownership stage's speech channels off the existing mouth trace. */
function stageSample(stage: {
  jawOpen: number;
  mouthMax: number;
  channels: Record<string, number>;
}): Hyper3dMouthStageSample {
  return {
    jawOpen: stage.jawOpen,
    mouthClose: stage.channels.mouthClose ?? 0,
    mouthFunnel: stage.channels.mouthFunnel ?? 0,
    mouthPucker: stage.channels.mouthPucker ?? 0,
    mouthMax: stage.mouthMax,
  };
}

const LIP_SYNC_MOTION_EPSILON = 0.01;
const LIP_SYNC_MAX_SAMPLES = 32;
const LIP_SYNC_SAMPLE_EVERY_FRAMES = 6;
/** One capture holds ~15 s of audible speech at 60 fps. */
const FULL_FRAME_MAX_FRAMES = 900;
const FULL_FRAME_MAX_ACOUSTIC_FRAMES = 3000;
const FULL_FRAME_MAX_PHONEMES = 600;

function createLipSyncTurnTrace(isWelcome: boolean): Hyper3dLipSyncTurnTrace {
  return {
    isWelcome,
    rawAvatarDataPresent: false,
    rawPhonemeFormat: null,
    untimedPhonemeCount: 0,
    associationMethod: null,
    hyper3dTimingHandoff: null,
    rawPhonemeCount: 0,
    rawFirstPhoneme: null,
    rawLastPhoneme: null,
    rawFirstStart: null,
    rawLastEnd: null,
    chunkIndex: null,
    sentence: "",
    chunkScheduled: false,
    appendResult: null,
    audioContextStartTime: null,
    durationMs: null,
    leadInSec: null,
    responseOffsetSeconds: null,
    adapterTurnId: null,
    timelineTurnId: null,
    plannerTurnId: null,
    payloadRevision: null,
    turnChangedDuringPlayback: false,
    timelinePhonemeCount: 0,
    timelineFirstStart: null,
    timelineLastEnd: null,
    audioActive: false,
    transport: "idle",
    audioContextCurrentTime: null,
    responseOriginContextTime: null,
    responseClockSeconds: 0,
    clockDomainDeltaMs: null,
    chunkLocalClockSeconds: null,
    activePhoneme: null,
    activePhonemeStart: null,
    activePhonemeEnd: null,
    clockInsidePhoneme: false,
    controllerEvaluated: false,
    controllerSpeechActive: false,
    controllerPhoneme: null,
    preOwnershipJawOpen: 0,
    preOwnershipMouthMax: 0,
    preOwnershipMouthChannels: {},
    afterThreejsSeamMouthMax: 0,
    afterAffectMouthMax: 0,
    afterActivePresenceMouthMax: 0,
    finalJawOpen: 0,
    finalMouthMax: 0,
    finalMouthChannels: {},
    idleShowcaseEligible: false,
    idleShowcaseActive: false,
    idleShowcaseYieldReason: null,
    activePresenceOwns: false,
    glbFaceMeshResolved: false,
    glbTeethMeshResolved: false,
    finalWrittenMorphCount: 0,
    actualJawOpenInfluence: 0,
    actualTeethJawOpenInfluence: 0,
    actualMouthMaxInfluence: 0,
    actualMouthMaxMorphName: null,
    framesDuringWelcome: 0,
    framesWithActivePhoneme: 0,
    framesWithControllerMouthMotion: 0,
    framesWithFinalPoseMouthMotion: 0,
    framesWithActualGlbMouthMotion: 0,
    framesShowcaseActiveWhileAudible: 0,
    firstDivergence: null,
    failedStage: null,
  };
}

/**
 * Run work off the scheduler's synchronous path.
 *
 * `setTimeout(0)` rather than a microtask: a microtask would still run before
 * the promise chain in `scheduleInner` continues, which is exactly the position
 * we are trying to vacate. Falls back to calling through where no timer exists.
 */
const defer =
  typeof setTimeout === "function"
    ? (fn: () => void) => {
        setTimeout(fn, 0);
      }
    : (fn: () => void) => {
        fn();
      };

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  );
  return sorted[index];
}

function summarize(samplesMs: number[]): LookAheadStats | null {
  if (samplesMs.length === 0) return null;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    minMs: sorted[0],
    medianMs: percentile(sorted, 0.5),
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
  };
}

export type Hyper3dLiveSpeechAdapter = ReturnType<
  typeof createHyper3dLiveSpeechAdapter
>;

export function createHyper3dLiveSpeechAdapter(deps: Hyper3dLiveAdapterDeps) {
  const now = deps.now ?? (() => performance.now());
  const timeline: LiveSpeechTimeline = createLiveSpeechTimeline();
  const acoustics: LiveAcousticTrack = createLiveAcousticTrack({ now });
  const sentencePlanner = createLiveSentencePlanner({ now });

  const clock: SolaceAudioClock = createSolaceAudioClock({
    getContextTime: deps.getContextTime,
    getOriginContextTime: () => timeline.getOrigin(),
    getAudioDuration: () => timeline.getAudioDuration(),
    isPipelineActive: deps.isPipelineActive,
  });

  let status: Hyper3dPlaybackStatus = "idle";
  let activeChunkStartContextTime: number | null = null;
  const scheduledChunks: Array<{
    chunkIndex: number | null;
    sentenceId: string;
    startContextTime: number;
    offsetSeconds: number;
    durationSeconds: number;
    isWelcome: boolean;
  }> = [];
  let lastScheduledSentence = "";
  /** Phase 2G.1C: the welcome's first handoff and first audible frame, once each. */
  let welcomeFirstChunkSeen = false;
  let welcomeFirstAudibleFrameSeen = false;
  let lastReviewSampleAt = Number.NEGATIVE_INFINITY;
  let lastEvaluationTime: number | null = null;
  let controllerCreateCount = 0;

  const liveReview: Hyper3dLiveReviewSurface = {
    version: 1,
    clockSource: "AudioContext.currentTime - responseOriginContextTime",
    performanceClockSource: "responsePlaybackTime - sentenceStartResponseTime",
    clockDriftMs: null,
    currentPhoneme: null,
    currentPhonemeStart: null,
    currentPhonemeEnd: null,
    audioPlaybackTime: 0,
    avatarEvaluationTime: 0,
    sentenceId: null,
    sentenceLocalTime: null,
    chunkIndex: null,
    chunkBoundaryCount: 0,
    sentenceBoundaryCount: 0,
    timelineResetCount: 0,
    controllerResetCount: 0,
    unknownPhonemeCount: 0,
    duplicateChunkCount: 0,
    jawOpen: 0,
    mouthClose: 0,
    mouthFunnel: 0,
    mouthPucker: 0,
    smileL: 0,
    smileR: 0,
    affectScale: 0,
    speechFade: 0,
    latePlanCount: 0,
    sentenceAudit: null,
    ownershipOrder: [
      "AvatarController articulation",
      "threejs gaze/blink/brow ownership",
      "semantic affect MAX merge",
      "Active Presence ownership",
      "MorphTargetController.write",
      "Teeth.JawOpen binding",
    ],
    oldSolaceVisemeWriterMounted: false,
    samples: [],
  };

  const appendDelayMs: number[] = [];
  const convertCostMs: number[] = [];
  const blockers: string[] = [];
  const welcomeDiagnostics: Hyper3dWelcomeLipSyncDiagnostics = {
    ...createLipSyncTurnTrace(true),
    summary: {
      audioActive: false,
      phonemesExist: false,
      clockInsidePhoneme: false,
      controllerMouthMoving: false,
      finalPoseMouthMoving: false,
      glbMouthMoving: false,
      showcaseYielded: true,
      fallbackOccurred: false,
      fallbackReason: null,
    },
    normalSpeech: createLipSyncTurnTrace(false),
    samples: [],
    fullFrame: { welcome: null, normal: null },
  };
  let fullFrameCounter = 0;
  let activeCapture: Hyper3dFullFrameCapture | null = null;

  /** Copies the existing acoustic analysis into the capture. Idempotent; no state. */
  function copyAcousticsIntoCapture() {
    if (!activeCapture) return;
    const frames = acoustics.getFrames();
    const limit = Math.min(frames.length, FULL_FRAME_MAX_ACOUSTIC_FRAMES);
    activeCapture.acousticFrames = [];
    for (let index = 0; index < limit; index += 1) {
      const frame = frames[index];
      activeCapture.acousticFrames.push({ time: frame.time, energy: frame.energy, voicing: frame.voicing });
    }
  }

  /** Copies the existing acoustic analysis into the capture before a turn resets it. */
  function finalizeFullFrameCapture() {
    if (!DEV || !activeCapture || activeCapture.finalized) return;
    copyAcousticsIntoCapture();
    activeCapture.finalized = true;
    publish();
  }

  function captureScheduledChunk(
    chunk: Hyper3dScheduledChunk,
    result: LiveChunkAppendResult,
    acceptedPhonemes: ReturnType<LiveSpeechTimeline["getPayload"]>["phonemes"],
  ) {
    if (!DEV) return;
    const kind = chunk.isWelcome === true ? "welcome" : "normal";
    let capture = welcomeDiagnostics.fullFrame[kind];
    if (!capture || capture.turnId !== timeline.getTurnId()) {
      if (activeCapture && activeCapture !== capture) finalizeFullFrameCapture();
      capture = {
        kind,
        turnId: timeline.getTurnId(),
        finalized: false,
        truncatedFrames: 0,
        chunks: [],
        timelinePhonemes: [],
        responseOriginContextTime: null,
        frames: [],
        acousticFrames: [],
        viewport: null,
      };
      welcomeDiagnostics.fullFrame[kind] = capture;
    }
    activeCapture = capture;
    capture.responseOriginContextTime = timeline.getOrigin();
    const raw = chunk.timeline?.phonemes ?? [];
    const backendPhonemes: Hyper3dCapturedPhoneme[] = raw.slice(0, FULL_FRAME_MAX_PHONEMES).map((item, index) => ({
      index,
      phoneme: String(item.phoneme),
      rawPhoneme: item.rawPhoneme != null ? String(item.rawPhoneme) : null,
      start: item.start,
      end: item.end ?? null,
      duration: item.end != null ? item.end - item.start : null,
    }));
    const buffer = chunk.audioBuffer ?? null;
    capture.chunks.push({
      chunkIndex: chunk.chunkIndex,
      sentence: chunk.timeline?.sentence || chunk.sentence,
      rawPhonemeFormat: chunk.rawPhonemeFormat ?? null,
      timestampsExplicit: chunk.rawPhonemeFormat === "timestamped",
      audioB64Present: chunk.audioB64Present ?? null,
      associationMethod: chunk.associationMethod ?? null,
      audioContextStartTime: chunk.audioContextStartTime,
      durationMs: chunk.durationMs,
      leadInSec: chunk.leadInSec,
      scheduledAtMs: Math.round(chunk.scheduledAtMs),
      expectedAudibleEndContextTime: chunk.audioContextStartTime + chunk.durationMs / 1000,
      responseOffsetSeconds: result.accepted ? result.chunkOffsetSeconds : null,
      decodedDurationSeconds: buffer && buffer.sampleRate ? buffer.length / buffer.sampleRate : null,
      decodedSampleRate: buffer?.sampleRate ?? null,
      decodedChannels: buffer?.numberOfChannels ?? null,
      appendResult: result.accepted ? "accepted" : result.reason,
      appendedPhonemes: result.accepted ? result.appendedPhonemes : 0,
      backendPhonemes,
      backendFirstStart: raw.length ? raw[0].start : null,
      backendLastEnd: raw.length ? raw[raw.length - 1].end ?? null : null,
      backendPhonemeCount: raw.length,
    });
    const base = capture.timelinePhonemes.length;
    for (let index = 0; index < acceptedPhonemes.length && capture.timelinePhonemes.length < FULL_FRAME_MAX_PHONEMES; index += 1) {
      const phoneme = acceptedPhonemes[index];
      capture.timelinePhonemes.push({
        index: base + index,
        phoneme: phoneme.phoneme,
        rawPhoneme: null,
        start: phoneme.start_time,
        end: phoneme.end_time,
        duration: phoneme.end_time - phoneme.start_time,
      });
    }
  }
  let lipSyncTraceCursor = 0;
  let lipSyncFrameCounter = 0;
  let lipSyncSampleWrite = 0;

  /**
   * Monotonic lookup cursor. The accepted runtime's own `TimelineCursor` scans
   * the phoneme array from the start on every frame; that is its behaviour and
   * Phase 1 does not change it. This cursor exists ONLY for the DEV sampler
   * below, so diagnostics cost O(1) amortized and never allocate.
   */
  let sampleCursor = 0;

  const diagnostics: Hyper3dLiveDiagnostics & { lastCancelReason?: string } = {
    contextCurrentTime: null,
    activeChunkOffset: null,
    activeChunkStartContextTime: null,
    playbackStatus: "idle",
    pipelineActive: false,
    responseOriginContextTime: null,
    hyper3dTime: 0,
    audioDuration: 0,
    phonemeCount: 0,
    chunkCount: 0,
    latestChunk: null,
    currentPhoneme: null,
    nextPhoneme: null,
    expectedPhonemeTime: null,
    actualPlaybackTime: 0,
    timingDeltaMs: null,
    lookAheadSeconds: 0,
    lookAheadStats: null,
    appendLatency: null,
    acousticFrameCount: 0,
    acousticStats: null,
    sentencePlanning: {
      turnId: 0,
      planCount: 0,
      frozenCount: 0,
      latePlanCount: 0,
      replanCount: 0,
      duplicateChunks: 0,
      staleChunks: 0,
      leadTimeSummary: null,
      activeSentenceIndex: null,
      activePlanRevision: null,
    },
    timelineStats: null,
    blockers,
  };

  function pushSample(target: number[], value: number) {
    target.push(value);
    if (target.length > MAX_SAMPLES) target.shift();
  }

  function recordBlocker(message: string) {
    if (!blockers.includes(message)) blockers.push(message);
  }

  function refreshSentencePlanningDiagnostics() {
    if (!DEV) return;
    const planning = sentencePlanner.getStats();
    const timelineStats = timeline.getStats();
    const acousticStats = acoustics.getStats();
    diagnostics.sentencePlanning.turnId = planning.turnId;
    diagnostics.sentencePlanning.planCount = planning.sentenceCount;
    diagnostics.sentencePlanning.frozenCount = planning.frozenCount;
    diagnostics.sentencePlanning.latePlanCount = planning.lateplans;
    diagnostics.sentencePlanning.replanCount = planning.replanCount;
    diagnostics.sentencePlanning.duplicateChunks =
      planning.duplicateChunks + timelineStats.duplicateChunks;
    diagnostics.sentencePlanning.staleChunks = acousticStats.staleResults;
    diagnostics.sentencePlanning.leadTimeSummary = summarize(planning.leadTimesMs);
  }

  function publish() {
    if (!DEV || typeof window === "undefined") return;
    const target = window as unknown as Record<string, unknown>;
    target.__solaceHyper3dLiveTiming = diagnostics;
    target.__solaceHyper3dLiveReview = liveReview;
    target.__solaceHyper3dWelcomeLipSync = welcomeDiagnostics;
  }

  /** Starts a fresh trace when a chunk belongs to a turn the trace has not seen. */
  function lipSyncTraceFor(isWelcome: boolean, startsTurn: boolean): Hyper3dLipSyncTurnTrace {
    const target: Hyper3dLipSyncTurnTrace = isWelcome ? welcomeDiagnostics : welcomeDiagnostics.normalSpeech;
    if (startsTurn && target.adapterTurnId !== timeline.getTurnId()) {
      Object.assign(target, createLipSyncTurnTrace(isWelcome));
      target.adapterTurnId = timeline.getTurnId();
      if (isWelcome) {
        welcomeDiagnostics.samples.length = 0;
        lipSyncSampleWrite = 0;
      }
    }
    return target;
  }

  function recordScheduledChunkTrace(
    chunk: Hyper3dScheduledChunk,
    result: LiveChunkAppendResult,
    acceptedPhonemes: ReturnType<LiveSpeechTimeline["getPayload"]>["phonemes"],
  ) {
    if (!DEV) return;
    const target = lipSyncTraceFor(chunk.isWelcome === true, true);
    const raw = chunk.timeline?.phonemes ?? [];
    target.rawAvatarDataPresent =
      target.rawAvatarDataPresent || chunk.rawAvatarDataPresent === true || chunk.timeline !== null;
    target.rawPhonemeFormat = chunk.rawPhonemeFormat ?? target.rawPhonemeFormat;
    target.untimedPhonemeCount += chunk.untimedPhonemeCount ?? 0;
    target.associationMethod = chunk.associationMethod ?? null;
    target.hyper3dTimingHandoff = chunk.timeline?.phonemes.length
      ? "timed"
      : (chunk.untimedPhonemeCount ?? 0) > 0
        ? "untimed-withheld"
        : chunk.rawPhonemeFormat === "empty"
          ? "empty-phonemes"
          : "no-metadata";
    target.rawPhonemeCount += raw.length;
    if (raw.length) {
      if (target.rawFirstPhoneme === null) {
        target.rawFirstPhoneme = String(raw[0].rawPhoneme ?? raw[0].phoneme);
        target.rawFirstStart = raw[0].start;
      }
      const last = raw[raw.length - 1];
      target.rawLastPhoneme = String(last.rawPhoneme ?? last.phoneme);
      target.rawLastEnd = last.end ?? null;
    }
    target.chunkIndex = chunk.chunkIndex;
    target.sentence = chunk.timeline?.sentence || chunk.sentence;
    target.chunkScheduled = true;
    target.appendResult = result.accepted ? "accepted" : result.reason;
    target.audioContextStartTime = chunk.audioContextStartTime;
    target.durationMs = chunk.durationMs;
    target.leadInSec = chunk.leadInSec;
    target.responseOffsetSeconds = result.accepted ? result.chunkOffsetSeconds : null;
    target.timelineTurnId = timeline.getTurnId();
    target.plannerTurnId = sentencePlanner.getStats().turnId;
    target.timelinePhonemeCount += acceptedPhonemes.length;
    if (acceptedPhonemes.length) {
      if (target.timelineFirstStart === null) target.timelineFirstStart = acceptedPhonemes[0].start_time;
      target.timelineLastEnd = acceptedPhonemes[acceptedPhonemes.length - 1].end_time;
    }
    publish();
  }

  function currentChunkAt(responseTime: number) {
    for (let index = scheduledChunks.length - 1; index >= 0; index -= 1) {
      const chunk = scheduledChunks[index];
      if (
        responseTime >= chunk.offsetSeconds &&
        responseTime < chunk.offsetSeconds + chunk.durationSeconds
      ) {
        return chunk;
      }
    }
    return null;
  }

  function dominantChannels(pose: BlendshapePose) {
    return Object.entries(pose)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, value]) => ({ name, value }));
  }

  function updateSentenceAudit(
    chunk: Hyper3dScheduledChunk,
    result: Extract<LiveChunkAppendResult, { accepted: true }>,
    acceptedPhonemes: ReturnType<LiveSpeechTimeline["getPayload"]>["phonemes"],
  ) {
    if (!DEV) return;
    const sentenceId = chunk.timeline?.sentence || chunk.sentence || `chunk-${chunk.chunkIndex ?? "unknown"}`;
    const rawItems = chunk.timeline?.phonemes ?? [];
    const rawLabels = rawItems.map((item) => String(item.rawPhoneme ?? item.phoneme ?? ""));
    const normalizedLabels = acceptedPhonemes.map((item) => item.phoneme);
    const firstStart = rawItems.length ? rawItems[0].start : null;
    const finalEnd = rawItems.length ? rawItems[rawItems.length - 1].end ?? null : null;
    const durationSeconds = chunk.durationMs / 1000;
    const unitGuess =
      firstStart === null || finalEnd === null
        ? "unknown"
        : finalEnd > Math.max(durationSeconds * 10, 20)
          ? "milliseconds-suspected"
          : "seconds";

    let audit = liveReview.sentenceAudit;
    if (!audit || audit.sentenceId !== sentenceId) {
      audit = {
        sentenceId,
        rawPhonemeCount: 0,
        normalizedPhonemeCount: 0,
        first20RawLabels: [],
        first20NormalizedLabels: [],
        unknownOrRejectedLabels: [],
        duplicateLabelCount: 0,
        startEndUnits: unitGuess,
        firstTimestamp: firstStart,
        finalTimestamp: finalEnd,
        firstResponseTimestamp: null,
        finalResponseTimestamp: null,
        sentenceAudibleDuration: 0,
        phonemeTimelineDuration: 0,
        durationDifference: 0,
      };
      liveReview.sentenceAudit = audit;
    }
    audit.rawPhonemeCount += rawItems.length;
    audit.normalizedPhonemeCount += acceptedPhonemes.length;
    audit.first20RawLabels.push(...rawLabels.slice(0, 20 - audit.first20RawLabels.length));
    audit.first20NormalizedLabels.push(
      ...normalizedLabels.slice(0, 20 - audit.first20NormalizedLabels.length),
    );
    for (let index = 1; index < rawLabels.length; index += 1) {
      if (rawLabels[index] === rawLabels[index - 1]) audit.duplicateLabelCount += 1;
    }
    const timelineStats = timeline.getStats();
    audit.unknownOrRejectedLabels = Object.keys(timelineStats.unknownLabels);
    audit.startEndUnits =
      audit.startEndUnits === "milliseconds-suspected" || unitGuess === "milliseconds-suspected"
        ? "milliseconds-suspected"
        : unitGuess;
    audit.firstTimestamp =
      audit.firstTimestamp === null || firstStart === null
        ? audit.firstTimestamp ?? firstStart
        : Math.min(audit.firstTimestamp, firstStart);
    audit.finalTimestamp =
      audit.finalTimestamp === null || finalEnd === null
        ? audit.finalTimestamp ?? finalEnd
        : Math.max(audit.finalTimestamp, finalEnd);
    audit.sentenceAudibleDuration += durationSeconds;
    if (acceptedPhonemes.length) {
      const start = acceptedPhonemes[0].start_time;
      const end = acceptedPhonemes[acceptedPhonemes.length - 1].end_time;
      audit.firstResponseTimestamp =
        audit.firstResponseTimestamp === null
          ? start
          : Math.min(audit.firstResponseTimestamp, start);
      audit.finalResponseTimestamp =
        audit.finalResponseTimestamp === null
          ? end
          : Math.max(audit.finalResponseTimestamp, end);
      audit.phonemeTimelineDuration =
        audit.finalResponseTimestamp - audit.firstResponseTimestamp;
    }
    audit.durationDifference = audit.phonemeTimelineDuration - audit.sentenceAudibleDuration;
  }

  return {
    clock,
    /** Authoritative continuous response clock consumed by AvatarController. */
    getPlaybackTime: () => clock.getCurrentTime(),
    /**
     * DEV read-back support: refresh the capture's acoustic frames WITHOUT
     * finalizing it, so a reply can be exported while its turn is still the
     * current one. `finalized` is untouched, so the real finalize on the next
     * `beginTurn` still happens exactly once.
     */
    refreshDiagnosticsAcoustics(): void {
      if (!DEV) return;
      copyAcousticsIntoCapture();
      publish();
    },
    /**
     * Phase 2G.1C — a read-only window onto both clocks for the DEV render-loop
     * capture. Pure reads of values this adapter already maintains; it takes no
     * decision, caches nothing and has no side effect. `responseClock` is null
     * until a response has an origin, so a gap before any audio is not reported
     * as sitting at response time 0.
     */
    getAudioClocks: (): { contextTime: number | null; responseClock: number | null } => ({
      contextTime: deps.getContextTime(),
      responseClock: timeline.getOrigin() === null ? null : clock.getCurrentTime(),
    }),
    getLiveReview: () => liveReview,
    shouldCaptureReviewFrame: () => {
      if (!DEV) return false;
      if (now() - lastReviewSampleAt >= REVIEW_SAMPLE_INTERVAL_MS) return true;
      const t = clock.getCurrentTime();
      return scheduledChunks.some(
        (chunk) =>
          chunk.offsetSeconds > 0 &&
          Math.abs(t - chunk.offsetSeconds) <= 1 / 30,
      );
    },

    noteControllerCreated(): void {
      if (!DEV) return;
      controllerCreateCount += 1;
      if (controllerCreateCount > 1) liveReview.controllerResetCount += 1;
      publish();
    },

    recordEngineFrame(input: Hyper3dEngineReviewFrame): void {
      if (!DEV) return;
      const audioPlaybackTime = clock.getCurrentTime();
      const avatarEvaluationTime = input.avatarEvaluationTime;
      const driftMs = (avatarEvaluationTime - audioPlaybackTime) * 1000;
      if (
        lastEvaluationTime !== null &&
        avatarEvaluationTime + 0.001 < lastEvaluationTime
      ) {
        liveReview.timelineResetCount += 1;
      }
      lastEvaluationTime = avatarEvaluationTime;

      const active = sentencePlanner.resolveAt(avatarEvaluationTime);
      const chunk = currentChunkAt(avatarEvaluationTime);
      const payload = timeline.getPayload();
      const activePhoneme = payload.phonemes.find(
        (phoneme) =>
          avatarEvaluationTime >= phoneme.start_time &&
          avatarEvaluationTime < phoneme.end_time,
      );
      const sentenceStart = active?.placed.offsetSeconds ?? null;
      const sentenceLocalTime = active?.localTime ?? null;
      const final = input.finalBindings;

      liveReview.clockDriftMs = driftMs;
      liveReview.currentPhoneme = input.frame.currentPhoneme;
      liveReview.currentPhonemeStart = activePhoneme?.start_time ?? null;
      liveReview.currentPhonemeEnd = activePhoneme?.end_time ?? null;
      liveReview.audioPlaybackTime = audioPlaybackTime;
      liveReview.avatarEvaluationTime = avatarEvaluationTime;
      liveReview.sentenceId = active?.placed.text ?? chunk?.sentenceId ?? null;
      liveReview.sentenceLocalTime = sentenceLocalTime;
      liveReview.chunkIndex = chunk?.chunkIndex ?? null;
      liveReview.jawOpen = final.jawOpen ?? 0;
      liveReview.mouthClose = final.mouthClose ?? 0;
      liveReview.mouthFunnel = final.mouthFunnel ?? 0;
      liveReview.mouthPucker = final.mouthPucker ?? 0;
      liveReview.smileL = final.mouthSmileLeft ?? 0;
      liveReview.smileR = final.mouthSmileRight ?? 0;
      liveReview.affectScale = input.frame.expression.affectScale;
      liveReview.speechFade = input.frame.expression.speechFade;
      liveReview.latePlanCount = sentencePlanner.getStats().lateplans;

      const sampledAtMs = now();
      lastReviewSampleAt = sampledAtMs;
      const chunkOffset = chunk?.offsetSeconds ?? null;
      const sample: Hyper3dLiveReviewSample = {
        sampledAtMs,
        chunkIndex: chunk?.chunkIndex ?? null,
        sentenceId: liveReview.sentenceId,
        audioContextCurrentTime: deps.getContextTime(),
        scheduledAudioContextStartTime: chunk?.startContextTime ?? null,
        audioPlaybackTime,
        avatarEvaluationTime,
        hostFrameTime: input.hostFrameTime,
        clockDriftMs: driftMs,
        chunkOffsetSeconds: chunkOffset,
        phonemeLocalStart:
          activePhoneme && chunkOffset !== null
            ? activePhoneme.start_time - chunkOffset
            : null,
        phonemeLocalEnd:
          activePhoneme && chunkOffset !== null
            ? activePhoneme.end_time - chunkOffset
            : null,
        phonemeResponseStart: activePhoneme?.start_time ?? null,
        phonemeResponseEnd: activePhoneme?.end_time ?? null,
        sentenceStartResponseTime: sentenceStart,
        sentenceLocalTime,
        sentenceAudibleStart: active?.placed.offsetSeconds ?? null,
        sentenceAudibleEnd: active?.placed.endSeconds ?? null,
        timelineCursorTime: avatarEvaluationTime,
        currentPhoneme: input.frame.currentPhoneme,
        previousPhoneme: input.frame.previousPhoneme,
        nextPhoneme: input.frame.nextPhoneme,
        articulation: input.frame.articulation,
        afterFaceOwnership: input.frame.afterFaceOwnership,
        afterAffect: input.frame.afterAffect,
        afterOwnershipResolution: input.frame.afterPresence,
        finalGlb: final,
        dominantChannels: dominantChannels(input.frame.articulation),
        expression: input.frame.expression,
      };
      liveReview.samples.push(sample);
      if (liveReview.samples.length > MAX_REVIEW_SAMPLES) liveReview.samples.shift();
      publish();
    },

    /**
     * DEV-only, once per engine frame, AFTER `MorphTargetController.write`.
     *
     * Classifies the frame against the turn that owns the audible chunk and
     * records the first boundary where articulation the controller produced
     * stopped reaching the physical mesh. Allocation-free on the steady path:
     * the ring buffer reuses its slots once full.
     */
    recordLipSyncFrame(trace: Hyper3dMouthTrace): void {
      if (!DEV) return;
      countHyper3dRecorderCall();
      const rawResponse = clock.getRawResponseTime();
      const t = trace.timeSeconds;
      const chunk = currentChunkAt(t);
      const audioActive =
        chunk !== null &&
        rawResponse !== null &&
        rawResponse >= chunk.offsetSeconds &&
        rawResponse < chunk.offsetSeconds + chunk.durationSeconds &&
        deps.isPipelineActive();
      const summary = welcomeDiagnostics.summary;
      // No origin means the turn was cancelled or has not scheduled audio yet;
      // `scheduledChunks` is only cleared by `beginTurn`, so a chunk found here
      // would be stale and must not be attributed.
      if (!chunk || timeline.getOrigin() === null) {
        countHyper3dAppendSkip(!chunk ? "noChunk" : "noOrigin");
        summary.audioActive = false;
        return;
      }
      const target = lipSyncTraceFor(chunk.isWelcome, false);

      const phonemes = timeline.getPayload().phonemes;
      if (lipSyncTraceCursor > phonemes.length) lipSyncTraceCursor = 0;
      while (lipSyncTraceCursor < phonemes.length && phonemes[lipSyncTraceCursor].end_time <= t) {
        lipSyncTraceCursor += 1;
      }
      while (lipSyncTraceCursor > 0 && phonemes[lipSyncTraceCursor - 1].end_time > t) {
        lipSyncTraceCursor -= 1;
      }
      const candidate = phonemes[lipSyncTraceCursor];
      const active = candidate && t >= candidate.start_time && t < candidate.end_time ? candidate : undefined;

      const contextNow = deps.getContextTime();
      const origin = timeline.getOrigin();
      if (target.timelineTurnId !== null && target.timelineTurnId !== timeline.getTurnId()) {
        target.turnChangedDuringPlayback = true;
      }
      target.audioActive = audioActive;
      target.transport = status;
      target.audioContextCurrentTime = contextNow;
      target.responseOriginContextTime = origin;
      target.responseClockSeconds = t;
      target.clockDomainDeltaMs =
        contextNow !== null && origin !== null ? (contextNow - origin - t) * 1000 : null;
      target.chunkLocalClockSeconds = t - chunk.offsetSeconds;
      target.activePhoneme = active?.phoneme ?? null;
      target.activePhonemeStart = active?.start_time ?? null;
      target.activePhonemeEnd = active?.end_time ?? null;
      target.clockInsidePhoneme = Boolean(active);
      target.controllerEvaluated = trace.controllerEvaluated;
      target.controllerSpeechActive = trace.controllerSpeechActive;
      target.controllerPhoneme = trace.currentPhoneme;
      target.preOwnershipJawOpen = trace.preOwnership.jawOpen;
      target.preOwnershipMouthMax = trace.preOwnership.mouthMax;
      Object.assign(target.preOwnershipMouthChannels, trace.preOwnership.channels);
      target.afterThreejsSeamMouthMax = trace.afterFaceOwnership.mouthMax;
      target.afterAffectMouthMax = trace.afterAffect.mouthMax;
      target.afterActivePresenceMouthMax = trace.afterPresence.mouthMax;
      target.finalJawOpen = trace.final.jawOpen;
      target.finalMouthMax = trace.final.mouthMax;
      Object.assign(target.finalMouthChannels, trace.final.channels);
      target.idleShowcaseEligible = trace.showcaseEligible;
      target.idleShowcaseActive = trace.showcaseActive;
      target.idleShowcaseYieldReason = trace.showcaseYieldReason;
      target.activePresenceOwns = trace.presenceOwned;
      target.glbFaceMeshResolved = trace.glb.faceMeshResolved;
      target.glbTeethMeshResolved = trace.glb.teethMeshResolved;
      target.finalWrittenMorphCount = trace.glb.writtenMorphCount;
      target.actualJawOpenInfluence = trace.glb.jawOpenInfluence;
      target.actualTeethJawOpenInfluence = trace.glb.teethJawOpenInfluence;
      target.actualMouthMaxInfluence = trace.glb.mouthMaxInfluence;
      target.actualMouthMaxMorphName = trace.glb.mouthMaxMorphName;

      let failed: Hyper3dLipSyncStage | null = null;
      if (audioActive) {
        target.framesDuringWelcome += 1;
        if (active) target.framesWithActivePhoneme += 1;
        if (trace.preOwnership.mouthMax > LIP_SYNC_MOTION_EPSILON) target.framesWithControllerMouthMotion += 1;
        if (trace.final.mouthMax > LIP_SYNC_MOTION_EPSILON) target.framesWithFinalPoseMouthMotion += 1;
        if (trace.glb.mouthMaxInfluence > LIP_SYNC_MOTION_EPSILON) target.framesWithActualGlbMouthMotion += 1;
        if (trace.showcaseActive) target.framesShowcaseActiveWhileAudible += 1;
        if (target.rawPhonemeCount === 0 && target.untimedPhonemeCount > 0) failed = "raw-phonemes-untimed";
        else if (!target.rawAvatarDataPresent || target.rawPhonemeCount === 0) failed = "raw-avatar-data";
        else if (target.timelinePhonemeCount === 0 || phonemes.length === 0) failed = "timeline";
        else if (active) {
          const stages: Array<[number, Hyper3dLipSyncStage]> = [
            [trace.afterFaceOwnership.mouthMax, "ownership:threejs-seam"],
            [trace.afterAffect.mouthMax, "ownership:affect"],
            [trace.afterPresence.mouthMax, "ownership:active-presence"],
            [trace.final.mouthMax, "ownership:idle-showcase"],
            [trace.glb.mouthMaxInfluence, "morph-write"],
          ];
          if (!trace.controllerEvaluated || !trace.controllerSpeechActive) failed = "controller";
          else {
            let previous = trace.preOwnership.mouthMax;
            for (const [value, stage] of stages) {
              // A stage "drops" articulation when it keeps less than half of a
              // demand that was visible upstream.
              if (previous > LIP_SYNC_MOTION_EPSILON && value < previous * 0.5) {
                failed = stage;
                break;
              }
              previous = value;
            }
          }
        }
        target.failedStage = failed;
        if (failed && target.firstDivergence === null) {
          target.firstDivergence =
            `${failed} @ response ${t.toFixed(3)}s phoneme=${active?.phoneme ?? "none"} ` +
            `controller=${trace.preOwnership.mouthMax.toFixed(3)} seam=${trace.afterFaceOwnership.mouthMax.toFixed(3)} ` +
            `affect=${trace.afterAffect.mouthMax.toFixed(3)} presence=${trace.afterPresence.mouthMax.toFixed(3)} ` +
            `final=${trace.final.mouthMax.toFixed(3)} glb=${trace.glb.mouthMaxInfluence.toFixed(3)}`;
        }
      }

      const fullCapture = welcomeDiagnostics.fullFrame[chunk.isWelcome ? "welcome" : "normal"];
      // Skip classification mirrors the real branches, one count per frame.
      if (!audioActive) countHyper3dAppendSkip("notAudioActive");
      else if (!fullCapture) countHyper3dAppendSkip("other");
      else if (fullCapture.turnId !== timeline.getTurnId()) countHyper3dAppendSkip("turnMismatch");
      if (audioActive && fullCapture && fullCapture.turnId === timeline.getTurnId()) {
        countHyper3dAppendAttempt();
        if (!fullCapture.viewport && trace.viewport) fullCapture.viewport = trace.viewport;
        if (fullCapture.frames.length >= FULL_FRAME_MAX_FRAMES) {
          fullCapture.truncatedFrames += 1;
          countHyper3dAppendSkip("bufferFull");
        } else {
          countHyper3dAppendSuccess();
          let maxChannel: string | null = null;
          let maxValue = 0;
          for (const [name, value] of Object.entries(trace.preOwnership.channels)) {
            if (value > maxValue) {
              maxValue = value;
              maxChannel = name;
            }
          }
          fullFrameCounter += 1;
          fullCapture.frames.push({
            frame: fullFrameCounter,
            nowMs: now(),
            contextTime: contextNow,
            deltaSeconds: trace.deltaSeconds,
            instantFps: trace.deltaSeconds > 0 ? 1 / trace.deltaSeconds : null,
            responseClock: t,
            chunkLocalClock: t - chunk.offsetSeconds,
            audioActive,
            transport: status,
            timelineIndex: active ? lipSyncTraceCursor : null,
            phoneme: active?.phoneme ?? null,
            phonemeStart: active?.start_time ?? null,
            phonemeEnd: active?.end_time ?? null,
            phonemePosition: active
              ? (t - active.start_time) / Math.max(1e-6, active.end_time - active.start_time)
              : null,
            speechActive: trace.controllerSpeechActive,
            controller: { ...trace.preOwnership.channels },
            final: { ...trace.final.channels },
            glb: { ...trace.glb.channels },
            teethJawOpen: trace.glb.teethJawOpenInfluence,
            controllerMaxChannel: maxChannel,
            controllerMaxValue: maxValue,
            presenceOwns: trace.presenceOwned,
            showcaseActive: trace.showcaseActive,
            showcaseYieldReason: trace.showcaseYieldReason,
            isSpeaking: trace.isSpeaking,
            showcaseOwnsLowerFace: trace.showcaseOwnsLowerFace,
            stages: {
              seam: stageSample(trace.afterFaceOwnership),
              affect: stageSample(trace.afterAffect),
              presence: stageSample(trace.afterPresence),
            },
          });
        }
      }

      if (chunk.isWelcome) {
        // Phase 2G.1C: the first frame that rendered while welcome audio was
        // genuinely audible — the far end of the startup window.
        if (audioActive && !welcomeFirstAudibleFrameSeen) {
          welcomeFirstAudibleFrameSeen = true;
          recordHyper3dWelcomeStartup({
            firstAudibleFrameAtMs: Math.round(now()),
            firstAudibleResponseClock: t,
            responseOriginContextTime: origin,
          });
        }
        summary.audioActive = audioActive;
        summary.phonemesExist = phonemes.length > 0;
        summary.clockInsidePhoneme = Boolean(active);
        summary.controllerMouthMoving = trace.preOwnership.mouthMax > LIP_SYNC_MOTION_EPSILON;
        summary.finalPoseMouthMoving = trace.final.mouthMax > LIP_SYNC_MOTION_EPSILON;
        summary.glbMouthMoving = trace.glb.mouthMaxInfluence > LIP_SYNC_MOTION_EPSILON;
        summary.showcaseYielded = !trace.showcaseActive;
        const path = getHyper3dPathReport();
        summary.fallbackOccurred = path.fellBackToSolaceAvatar;
        summary.fallbackReason = path.fallbackReason;

        lipSyncFrameCounter += 1;
        if (audioActive && lipSyncFrameCounter % LIP_SYNC_SAMPLE_EVERY_FRAMES === 0) {
          const planned = sentencePlanner.resolveAt(t);
          target.payloadRevision = planned?.placed.revision ?? null;
          target.plannerTurnId = sentencePlanner.getStats().turnId;
          const samples = welcomeDiagnostics.samples;
          let slot = samples[lipSyncSampleWrite];
          if (!slot) {
            slot = {
              responseClockSeconds: 0,
              activePhoneme: null,
              preOwnershipMouthMax: 0,
              finalMouthMax: 0,
              actualMouthMaxInfluence: 0,
              failedStage: null,
            };
            samples[lipSyncSampleWrite] = slot;
          }
          slot.responseClockSeconds = t;
          slot.activePhoneme = active?.phoneme ?? null;
          slot.preOwnershipMouthMax = trace.preOwnership.mouthMax;
          slot.finalMouthMax = trace.final.mouthMax;
          slot.actualMouthMaxInfluence = trace.glb.mouthMaxInfluence;
          slot.failedStage = failed;
          lipSyncSampleWrite = (lipSyncSampleWrite + 1) % LIP_SYNC_MAX_SAMPLES;
        }
        publish();
      }
    },

    /** The live payload. Identity changes only when the timeline changes. */
    getPayload(): LiveAvatarPayload {
      return timeline.getPayload();
    },

    getStatus: () => status,
    /** The accepted analyzer's frames, response-relative, for the head planner. */
    getAcousticFrames: () => acoustics.getFrames(),
    getAcousticStats: () => acoustics.getStats(),
    getTimelineStats: () => timeline.getStats(),
    getDiagnostics: () => diagnostics,
    getBlockers: () => [...blockers],
    getSentencePlans: () => sentencePlanner.getPlans(),
    getSentencePlannerStats: () => sentencePlanner.getStats(),
    resolveSentencePlanAt: (responseTime: number) => sentencePlanner.resolveAt(responseTime),
    freezeSentencePlans(): void {
      const contextTime = deps.getContextTime();
      if (contextTime === null) return;
      if (sentencePlanner.freezeRenderedBefore(contextTime) > 0) {
        refreshSentencePlanningDiagnostics();
        publish();
      }
    },
    noteSentencePlanConsumed(sentenceIndex: number, revision: number): void {
      if (!DEV) return;
      diagnostics.sentencePlanning.activeSentenceIndex = sentenceIndex;
      diagnostics.sentencePlanning.activePlanRevision = revision;
      refreshSentencePlanningDiagnostics();
      publish();
    },

    /**
     * New assistant turn. Mirrors `resetWsAudioReorderBuffer()`, which already
     * invalidates the scheduled-entry list for exactly the same reason: a new
     * turn is a new AudioContext timeline domain.
     */
    beginTurn(): void {
      finalizeFullFrameCapture();
      timeline.beginTurn();
      acoustics.beginTurn(timeline.getTurnId());
      sentencePlanner.beginTurn(timeline.getTurnId());
      sampleCursor = 0;
      activeChunkStartContextTime = null;
      scheduledChunks.length = 0;
      lastScheduledSentence = "";
      lastReviewSampleAt = Number.NEGATIVE_INFINITY;
      lastEvaluationTime = null;
      controllerCreateCount = 0;
      liveReview.clockDriftMs = null;
      liveReview.currentPhoneme = null;
      liveReview.currentPhonemeStart = null;
      liveReview.currentPhonemeEnd = null;
      liveReview.audioPlaybackTime = 0;
      liveReview.avatarEvaluationTime = 0;
      liveReview.sentenceId = null;
      liveReview.sentenceLocalTime = null;
      liveReview.chunkIndex = null;
      liveReview.chunkBoundaryCount = 0;
      liveReview.sentenceBoundaryCount = 0;
      liveReview.timelineResetCount = 0;
      liveReview.controllerResetCount = 0;
      liveReview.unknownPhonemeCount = 0;
      liveReview.duplicateChunkCount = 0;
      liveReview.sentenceAudit = null;
      liveReview.samples.length = 0;
      status = "ready";
      diagnostics.latestChunk = null;
      diagnostics.currentPhoneme = null;
      diagnostics.nextPhoneme = null;
      diagnostics.sentencePlanning.activeSentenceIndex = null;
      diagnostics.sentencePlanning.activePlanRevision = null;
      refreshSentencePlanningDiagnostics();
      publish();
    },

    /**
     * Barge-in, interrupt, sound-off, teardown, context swap.
     *
     * Mirrors the existing `stopPlaybackAndCooldown` / `stopAudioAndSpeechDriver`
     * behaviour, which clears `wsTimelineScheduleRef` and nulls
     * `avatarPhonemeTimelineRef`. After this the clock reports not-playing and
     * time 0, so nothing from the cancelled turn can keep animating.
     *
     * Status goes to `idle`. A normal end-of-turn sets `completed` just before
     * the teardown reaches here, and the two are equivalent downstream — the
     * accepted `conversationStateForPlayback` maps `completed`, `idle`, `ready`,
     * `paused` and `error` all to the runtime's IDLE state.
     */
    cancel(reason: string): void {
      finalizeFullFrameCapture();
      timeline.cancel();
      sentencePlanner.cancel();
      sentencePlanner.beginTurn(timeline.getTurnId());
      // Same turn identity the timeline just bumped, so a late analysis result
      // from the cancelled turn is rejected by identity rather than by a second
      // cancellation mechanism.
      acoustics.cancel(timeline.getTurnId());
      sampleCursor = 0;
      activeChunkStartContextTime = null;
      status = "idle";
      diagnostics.latestChunk = null;
      diagnostics.currentPhoneme = null;
      diagnostics.nextPhoneme = null;
      diagnostics.hyper3dTime = 0;
      diagnostics.timingDeltaMs = null;
      diagnostics.sentencePlanning.activeSentenceIndex = null;
      diagnostics.sentencePlanning.activePlanRevision = null;
      refreshSentencePlanningDiagnostics();
      if (DEV) diagnostics.lastCancelReason = reason;
      publish();
    },

    setStatus(next: Hyper3dPlaybackStatus): void {
      status = next;
      diagnostics.playbackStatus = next;
      publish();
    },

    /**
     * THE HOT PATH — called synchronously from `onChunkScheduled`, i.e. AFTER
     * `source.start()` has already committed this chunk's audio. It cannot move
     * `audioScheduledStart`, because that value is an input here, not an output.
     *
     * Cost is O(k) in this chunk's own phonemes and is measured
     * (`convertCostMs`) so the acceptance gate can be checked against real data
     * rather than asserted.
     */
    onChunkScheduled(chunk: Hyper3dScheduledChunk): LiveChunkAppendResult {
      const startedAt = now();
      const contextTimeAtAppend = deps.getContextTime() ?? chunk.audioContextStartTime;

      const phonemeCountBefore = timeline.getPhonemeCount();
      const result = timeline.appendScheduledChunk({
        audioContextStartTime: chunk.audioContextStartTime,
        durationSeconds: chunk.durationMs / 1000,
        leadInSeconds: chunk.leadInSec,
        timeline: chunk.timeline,
        chunkIndex: chunk.chunkIndex,
        sentence: chunk.sentence,
        contextTimeAtAppend,
      });

      const finishedAt = now();
      pushSample(convertCostMs, finishedAt - startedAt);
      pushSample(appendDelayMs, finishedAt - chunk.scheduledAtMs);

      /**
       * Phase 2G.1C (audit risks B1 and B2) — the WELCOME's first handoff, as
       * Hyper3D actually received it. `rawAvatarDataPresent` is the queue item's
       * state at the instant `onChunkScheduled` ran, which is precisely the
       * question B1 asks; a later repair cannot rewrite it. Observation only:
       * nothing below this is read by the timeline, planner or scheduler.
       */
      if (DEV && chunk.isWelcome === true && !welcomeFirstChunkSeen) {
        welcomeFirstChunkSeen = true;
        const contextAtSchedule = deps.getContextTime();
        recordHyper3dWelcomeStartup({
          firstChunkScheduledAtMs: Math.round(startedAt),
          firstChunkHandoffAtMs: Math.round(chunk.scheduledAtMs),
          firstChunkHadAvatarData: chunk.rawAvatarDataPresent ?? null,
          firstChunkRawPhonemeFormat: chunk.rawPhonemeFormat ?? null,
          firstChunkTimedPhonemeCount: chunk.timeline?.phonemes.length ?? 0,
          firstChunkAppendResult: result.accepted ? "accepted" : result.reason,
          firstChunkAudioContextStartTime: chunk.audioContextStartTime,
          audioContextTimeAtFirstSchedule: contextAtSchedule,
          firstChunkLeadMs:
            contextAtSchedule === null
              ? null
              : Math.round((chunk.audioContextStartTime - contextAtSchedule) * 1000),
          responseOriginContextTime: timeline.getOrigin(),
        });
      }

      if (result.accepted) {
        const acceptedPhonemes = timeline.getPayload().phonemes.slice(phonemeCountBefore);
        if (scheduledChunks.length > 0) liveReview.chunkBoundaryCount += 1;
        const sentenceId =
          chunk.timeline?.sentence || chunk.sentence || `chunk-${chunk.chunkIndex ?? "unknown"}`;
        if (lastScheduledSentence && sentenceId !== lastScheduledSentence) {
          liveReview.sentenceBoundaryCount += 1;
        }
        lastScheduledSentence = sentenceId;
        scheduledChunks.push({
          chunkIndex: chunk.chunkIndex,
          sentenceId,
          startContextTime: chunk.audioContextStartTime,
          offsetSeconds: result.chunkOffsetSeconds,
          durationSeconds: chunk.durationMs / 1000,
          isWelcome: chunk.isWelcome === true,
        });
        if (scheduledChunks.length > MAX_SCHEDULED_CHUNKS) scheduledChunks.shift();
        updateSentenceAudit(chunk, result, acceptedPhonemes);
        sentencePlanner.addScheduledChunk({
          sentence: chunk.timeline?.sentence || chunk.sentence,
          chunkIndex: chunk.chunkIndex,
          offsetSeconds: result.chunkOffsetSeconds,
          durationSeconds: chunk.durationMs / 1000,
          phonemes: acceptedPhonemes,
          scheduledAtMs: chunk.scheduledAtMs,
          audibleStartContextTime: chunk.audioContextStartTime,
          contextTimeAtPlan: deps.getContextTime() ?? contextTimeAtAppend,
        });
        activeChunkStartContextTime = chunk.audioContextStartTime;
        diagnostics.latestChunk = {
          chunkKey: result.chunkKey,
          offsetSeconds: result.chunkOffsetSeconds,
          appendedPhonemes: result.appendedPhonemes,
          lookAheadSeconds: result.lookAheadSeconds,
        };
        recordScheduledChunkTrace(chunk, result, acceptedPhonemes);
        captureScheduledChunk(chunk, result, acceptedPhonemes);
        if (result.lookAheadSeconds < 0) {
          recordBlocker(
            "A chunk's phoneme timeline was appended after its audio had already started (negative look-ahead).",
          );
        }
      } else {
        recordScheduledChunkTrace(chunk, result, []);
        captureScheduledChunk(chunk, result, []);
        /**
         * DEV-ONLY OBSERVATION WINDOW for audio the timeline refused.
         *
         * `no-phonemes` audio still plays (the timeline advances `audio_duration`
         * for it), but nothing was registered for the diagnostics to look at, so
         * the recorder was blind to those turns. `scheduledChunks` is read ONLY by
         * the DEV recorder, the DEV review sampler and `beginTurn`; it feeds no
         * timeline, planner, controller or scheduler decision. Nothing is
         * synthesized: no phonemes, no timing — just the span the audio occupies.
         */
        if (DEV && result.reason === "no-phonemes") {
          const origin = timeline.getOrigin();
          if (origin !== null) {
            scheduledChunks.push({
              chunkIndex: chunk.chunkIndex,
              sentenceId: chunk.timeline?.sentence || chunk.sentence || `chunk-${chunk.chunkIndex ?? "unknown"}`,
              startContextTime: chunk.audioContextStartTime,
              offsetSeconds: chunk.audioContextStartTime - origin,
              durationSeconds: chunk.durationMs / 1000,
              isWelcome: chunk.isWelcome === true,
            });
            if (scheduledChunks.length > MAX_SCHEDULED_CHUNKS) scheduledChunks.shift();
          }
        }
      }

      if (!result.accepted && result.reason === "non-monotonic") {
        recordBlocker(
          "Scheduled chunk offsets regressed; the schedule was rebuilt underneath the timeline.",
        );
      } else if (!result.accepted && result.reason === "no-phonemes") {
        recordBlocker(
          "A scheduled chunk carried audio but no phoneme timeline; that span will have no lip-sync.",
        );
      }

      /**
       * ACOUSTIC ANALYSIS — deferred on purpose.
       *
       * The audio for this chunk is already committed (`source.start()` ran
       * before this callback), so analysis cannot move its start time. But
       * `scheduleInner` is serialized through the scheduler's promise chain, so
       * doing ~2 s of DSP inline would sit between this chunk and the NEXT one's
       * decode. Deferring keeps the scheduler's path clear while the offsets
       * captured here stay the authoritative ones.
       *
       * The buffer reference lives only until the callback runs.
       */
      if (result.accepted && chunk.audioBuffer) {
        const buffer = chunk.audioBuffer;
        const chunkKey = result.chunkKey;
        const chunkOffsetSeconds = result.chunkOffsetSeconds;
        const turnAtSchedule = timeline.getTurnId();
        const audibleAtContextTime = chunk.audioContextStartTime;
        defer(() => {
          const appended = acoustics.appendChunk({
            audioBuffer: buffer,
            chunkOffsetSeconds,
            leadInSeconds: chunk.leadInSec,
            chunkKey,
            turnId: turnAtSchedule,
          });
          if (!appended.accepted) {
            refreshSentencePlanningDiagnostics();
            publish();
            return;
          }
          // Positive lead time means the frames existed before the audio was
          // heard. Measured, never enforced — playback is authoritative.
          const contextNow = deps.getContextTime();
          if (contextNow !== null) {
            acoustics.noteLeadTime((audibleAtContextTime - contextNow) * 1000);
          }
          diagnostics.acousticFrameCount = acoustics.getFrameCount();
          diagnostics.acousticStats = acoustics.getStats();
          refreshSentencePlanningDiagnostics();
          publish();
        });
      }

      const stats = timeline.getStats();
      diagnostics.phonemeCount = stats.phonemeCount;
      diagnostics.chunkCount = stats.chunkCount;
      diagnostics.audioDuration = stats.audioDuration;
      diagnostics.responseOriginContextTime = stats.originContextTime;
      diagnostics.timelineStats = stats;
      liveReview.unknownPhonemeCount = Object.values(stats.unknownLabels).reduce(
        (sum, count) => sum + count,
        0,
      );
      liveReview.duplicateChunkCount = stats.duplicateChunks;
      diagnostics.lookAheadStats = summarize(
        stats.lookAheadSamples.map((s) => s * 1000),
      );
      diagnostics.appendLatency = buildLatencyStats(appendDelayMs, convertCostMs);
      refreshSentencePlanningDiagnostics();
      if (Object.keys(stats.unknownLabels).length > 0) {
        recordBlocker(
          `Unknown phoneme labels observed: ${Object.keys(stats.unknownLabels).join(", ")}`,
        );
      }
      publish();
      return result;
    },

    /**
     * DEV-only per-frame sampler. Mounted on the RAF that already runs in
     * `ActiveSession` (`tickClock`); it starts no loop of its own, allocates
     * nothing, and sets no React state.
     */
    sampleClock(): void {
      if (!DEV) return;
      const payload = timeline.getPayload();
      const phonemes = payload.phonemes;
      const contextTime = deps.getContextTime();
      const t = clock.getCurrentTime();

      diagnostics.contextCurrentTime = contextTime;
      diagnostics.hyper3dTime = t;
      diagnostics.actualPlaybackTime = t;
      diagnostics.audioDuration = payload.audio_duration;
      diagnostics.phonemeCount = phonemes.length;
      diagnostics.pipelineActive = deps.isPipelineActive();
      diagnostics.playbackStatus = status;
      diagnostics.responseOriginContextTime = timeline.getOrigin();
      diagnostics.activeChunkStartContextTime = activeChunkStartContextTime;
      diagnostics.activeChunkOffset =
        activeChunkStartContextTime !== null
          ? timeline.toResponseTime(activeChunkStartContextTime)
          : null;

      if (sampleCursor > phonemes.length) sampleCursor = 0;
      while (
        sampleCursor < phonemes.length &&
        phonemes[sampleCursor].end_time <= t
      ) {
        sampleCursor += 1;
      }
      // Rewind only when the clock genuinely moved backwards (a reset), which
      // keeps this O(1) amortized during normal forward playback.
      while (sampleCursor > 0 && phonemes[sampleCursor - 1].end_time > t) {
        sampleCursor -= 1;
      }

      const candidate = phonemes[sampleCursor];
      const active =
        candidate && t >= candidate.start_time && t < candidate.end_time
          ? candidate
          : undefined;
      const upcoming = active ? phonemes[sampleCursor + 1] : candidate;

      diagnostics.currentPhoneme = active
        ? { phoneme: active.phoneme, start: active.start_time, end: active.end_time }
        : null;
      // Kept current even when the engine is not running, so a fallback to the
      // existing avatar is visible from the same object.
      const path = getHyper3dPathReport();
      welcomeDiagnostics.summary.fallbackOccurred = path.fellBackToSolaceAvatar;
      welcomeDiagnostics.summary.fallbackReason = path.fallbackReason;
      diagnostics.nextPhoneme = upcoming
        ? {
            phoneme: upcoming.phoneme,
            start: upcoming.start_time,
            end: upcoming.end_time,
          }
        : null;

      diagnostics.expectedPhonemeTime = active ? active.start_time : null;
      diagnostics.timingDeltaMs = active ? (t - active.start_time) * 1000 : null;

      const lastEnd =
        phonemes.length > 0 ? phonemes[phonemes.length - 1].end_time : 0;
      diagnostics.lookAheadSeconds = Math.max(0, lastEnd - t);

      publish();
    },
  };
}

function buildLatencyStats(
  delayMs: number[],
  convertMs: number[],
): AppendLatencyStats | null {
  if (delayMs.length === 0) return null;
  const sortedDelay = [...delayMs].sort((a, b) => a - b);
  const sortedConvert = [...convertMs].sort((a, b) => a - b);
  return {
    samples: sortedDelay.length,
    medianMs: percentile(sortedDelay, 0.5),
    p95Ms: percentile(sortedDelay, 0.95),
    maxMs: sortedDelay[sortedDelay.length - 1],
    medianConvertMs: percentile(sortedConvert, 0.5),
    maxConvertMs: sortedConvert[sortedConvert.length - 1] ?? 0,
  };
}
