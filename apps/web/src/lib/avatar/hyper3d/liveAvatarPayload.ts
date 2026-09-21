/**
 * Hyper3D payload contract, as consumed by the accepted avatar-test runtime.
 *
 * These types mirror `avatar-test/src/types/avatarPayload.ts` exactly. They are
 * duplicated rather than imported because avatar-test is a separate repository;
 * when the runtime itself is migrated (Phase 2+) this file is replaced by the
 * real module and nothing here needs reinterpreting.
 *
 * PHASE 1 SCOPE: the only deliberate deviation from the accepted contract is
 * `audio_url`, and it is a deviation by SUBTRACTION, never by invention — see
 * {@link LiveAvatarPayload}.
 */

/** `avatar-test/src/mappings/phonemeAliases.ts` — the accepted label set. */
export const SUPPORTED_PHONEMES = [
  "AA", "AE", "AH", "AO", "AW", "AY", "B", "CH", "D", "DH", "EH", "ER", "EY",
  "F", "G", "HH", "IH", "IY", "JH", "K", "L", "M", "N", "NG", "OW", "OY", "P",
  "R", "S", "SH", "T", "TH", "UH", "UW", "V", "W", "Y", "Z", "ZH",
  "SIL", "SP", "PAUSE",
] as const;

export type SupportedPhoneme = (typeof SUPPORTED_PHONEMES)[number];

export type TimedPhoneme = {
  id: string;
  phoneme: string;
  start_time: number;
  end_time: number;
  intensity: number;
};

export type TimedWord = { word: string; start: number; end: number };

export type BehaviourFlags = {
  automatic_blinking: boolean;
  automatic_eye_movement: boolean;
  automatic_head_movement: boolean;
  automatic_breathing: boolean;
  speech_brow_movement: boolean;
  speech_cheek_movement: boolean;
  coarticulation: boolean;
};

export type BehaviourSettings = {
  blink_frequency_min: number;
  blink_frequency_max: number;
  blink_duration: number;
  eye_movement_intensity: number;
  head_movement_intensity: number;
  breathing_intensity: number;
  speech_brow_intensity: number;
  speech_cheek_intensity: number;
  coarticulation_window: number;
};

/**
 * A live utterance payload.
 *
 * `audio_url` is ABSENT, not faked. Since Phase 1.1 the accepted schema makes it
 * optional for exactly this case, gated on `audio_owned_by: "live-stream"` — a
 * payload with neither field is still rejected, and every static payload is
 * validated as before. Minting a placeholder URL would be fabricated data, and
 * pointing the runtime at a real URL would make it fetch and decode the audio a
 * second time; both remain forbidden. During live playback the runtime is
 * clock-driven and never reads `audio_url`.
 */
export type LiveAvatarPayload = {
  version: "1.0";
  id: string;
  text: string;
  language: string;
  /** Declares why `audio_url` is absent. Matches the accepted schema's literal. */
  audio_owned_by: "live-stream";
  /**
   * The stable live-turn identity, created once per turn and used as the
   * deterministic performance seed. `HeadMotionController` hashes this instead
   * of composing `id:audio_url:audio_duration`, whose duration term grows with
   * every appended chunk.
   */
  performance_seed: string;
  /** Grows as chunks are scheduled; always the end of the last scheduled chunk. */
  audio_duration: number;
  phoneme_set: "arpabet";
  time_unit: "seconds";
  playback: { start_offset: number; playback_rate: number; volume: number };
  phonemes: TimedPhoneme[];
  /** Solace sends no word tier. Always undefined in Phase 1 — see the report. */
  words?: TimedWord[];
  emotions: never[];
  facial_cues: never[];
  pauses: never[];
  behaviour: BehaviourFlags;
  behaviour_settings: BehaviourSettings;
  markers: never[];
  metadata: {
    avatar_id: string;
    created_at: string;
    source: string;
    description: string;
  };
};

/**
 * Accepted defaults, copied verbatim from an aligner-produced avatar-test
 * payload (`avatar-test/src/data/tuning/generated/14-natural-mixed.payload.json`)
 * rather than chosen here. That file is the closest accepted analogue of a live
 * utterance: machine-aligned phonemes, uniform intensity, and no hand-authored
 * emotion / cue / pause / marker tracks.
 *
 * DO NOT RETUNE. These are avatar-test's accepted values.
 */
export const ACCEPTED_LIVE_BEHAVIOUR: BehaviourFlags = {
  automatic_blinking: true,
  automatic_eye_movement: true,
  automatic_head_movement: true,
  automatic_breathing: true,
  speech_brow_movement: true,
  speech_cheek_movement: true,
  coarticulation: true,
};

export const ACCEPTED_LIVE_BEHAVIOUR_SETTINGS: BehaviourSettings = {
  blink_frequency_min: 2.5,
  blink_frequency_max: 6,
  blink_duration: 0.12,
  eye_movement_intensity: 0.35,
  head_movement_intensity: 0.25,
  breathing_intensity: 0.2,
  speech_brow_intensity: 0.15,
  speech_cheek_intensity: 0.12,
  coarticulation_window: 0.08,
};

/**
 * Every phoneme in an aligner-produced payload carries `intensity: 1`; the
 * per-phoneme variation in the hand-authored `testPayloads` fixtures is authored
 * expression, not alignment output. Solace sends no intensity, so the aligner
 * convention is the accepted value to use — not an invented one.
 */
export const ACCEPTED_LIVE_PHONEME_INTENSITY = 1;

export const ACCEPTED_LIVE_PLAYBACK = {
  start_offset: 0,
  playback_rate: 1,
  volume: 1,
} as const;

/** Matches `AvatarPayload.language`'s accepted value on every avatar-test payload. */
export const ACCEPTED_LIVE_LANGUAGE = "en-US";
