export type EmotionName = "neutral" | "happy" | "sad" | "concerned" | "surprised" | "angry" | "calm" | "empathetic";
export type FacialCueType = "brow_raise" | "brow_lower" | "small_smile" | "full_smile" | "frown" | "eye_squint" | "eye_widen" | "cheek_raise" | "lip_press" | "head_nod" | "head_tilt_left" | "head_tilt_right" | "look_left" | "look_right" | "look_up" | "look_down";
export type PauseType = "sentence_pause" | "phrase_pause" | "breath" | "hesitation";

export interface TimedPhoneme { id: string; phoneme: string; start_time: number; end_time: number; intensity: number; }
/**
 * One MFA WORD interval, in the same audio-clock seconds as `TimedPhoneme`.
 *
 * The Montreal Forced Aligner emits a `words` tier alongside the `phones` tier
 * and `convert-mfa-alignments.mjs` has always parsed both — it resolves a
 * `word_index` onto every phoneme's metadata. The runtime payload then dropped
 * it at serialization (a five-field pick over `runtimePhones`), so the frontend
 * contract, not the aligner, is what lost word timing. `attach-word-tier.mjs`
 * restores it.
 *
 * Optional because payloads generated before that step exist and must keep
 * validating; consumers fall back explicitly rather than assuming it is present.
 */
export interface TimedWord { word: string; start: number; end: number; }
export interface TimedEmotion { id: string; emotion: EmotionName; start_time: number; end_time: number; intensity: number; transition_in: number; transition_out: number; }
export interface TimedFacialCue { id: string; type: FacialCueType; start_time: number; end_time: number; intensity: number; }
export interface TimedPause { id: string; start_time: number; end_time: number; type: PauseType; }
export interface TimelineMarker { id: string; name: string; time: number; }

export interface BehaviourFlags {
  automatic_blinking: boolean;
  automatic_eye_movement: boolean;
  automatic_head_movement: boolean;
  automatic_breathing: boolean;
  speech_brow_movement: boolean;
  speech_cheek_movement: boolean;
  coarticulation: boolean;
}

export interface BehaviourSettings {
  blink_frequency_min: number;
  blink_frequency_max: number;
  blink_duration: number;
  eye_movement_intensity: number;
  head_movement_intensity: number;
  breathing_intensity: number;
  speech_brow_intensity: number;
  speech_cheek_intensity: number;
  coarticulation_window: number;
}

export interface AvatarPayload {
  version: "1.0";
  id: string;
  text: string;
  language: string;
  /**
   * Where the audio lives, for payloads the runtime is responsible for loading.
   *
   * OPTIONAL, and optional in exactly one case: a live streaming payload, which
   * must also set {@link AvatarPayload.audio_owned_by}. In a live Solace session
   * the audio is already decoded and scheduled on the app's own AudioContext by
   * `EzriWsAudioScheduler` before the runtime ever sees the timing, so there is
   * no URL to give and nothing for the runtime to fetch — handing it one would
   * mean downloading and decoding the same audio twice.
   *
   * Every static payload still carries it and is still validated exactly as
   * before; the schema rejects a payload that has neither field.
   */
  audio_url?: string;
  /**
   * Declares that something other than this runtime owns audio playback, which
   * is what makes {@link AvatarPayload.audio_url} optional. Never inferred —
   * a payload without a URL must say so.
   */
  audio_owned_by?: "live-stream";
  /**
   * Stable identity for the deterministic performance seed.
   *
   * `HeadMotionController` seeds from `id:audio_url:audio_duration`, all three
   * of which are fixed for a static payload. A LIVE payload's `audio_duration`
   * grows as each audio chunk is scheduled, so that composition would hand the
   * head-motion generators a different seed mid-response. When this field is
   * present it IS the seed, unchanged for the life of one live turn.
   *
   * Absent on static payloads, which keep the original composed seed byte for
   * byte. This changes no amplitude, timing, distribution or probability — only
   * which string is hashed, and only when a live producer supplies one.
   */
  performance_seed?: string;
  audio_duration: number;
  phoneme_set: "arpabet";
  time_unit: "seconds";
  playback: { start_offset: number; playback_rate: number; volume: number };
  phonemes: TimedPhoneme[];
  /** MFA word tier. Absent on payloads generated before `tuning:attach-words`. */
  words?: TimedWord[];
  emotions: TimedEmotion[];
  facial_cues: TimedFacialCue[];
  pauses: TimedPause[];
  behaviour: BehaviourFlags;
  behaviour_settings: BehaviourSettings;
  markers: TimelineMarker[];
  metadata: { avatar_id: string; created_at: string; source: string; description: string };
}
