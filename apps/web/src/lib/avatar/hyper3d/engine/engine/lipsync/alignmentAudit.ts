import type { SpeechAcousticFrame } from "../avatar/upstream/threejs-talking-avatar/audioAnalysis";
import type { TimedPhoneme } from "../../types/avatarPayload";

/**
 * MFA ALIGNMENT AUDIT — "is the mouth still because the speaker is, or because
 * the alignment lost a word?"
 *
 * Written for the `"blue backpack"` hardware report. The lips looked frozen for
 * about half a second mid-phrase, and the trace showed every mouth channel at an
 * exact zero — not a stuck closure, a DEAD STOP. The cause was upstream of the
 * animation entirely: the payload aligns that span as `SIL` while the recording
 * is plainly speaking.
 *
 * This finds that class of defect by comparing the phoneme labels against the
 * decoded PCM the performance layer already extracts. A silence label sitting on
 * top of voiced, energetic audio is an alignment failure; the renderer is doing
 * exactly the right thing with the data it was handed.
 *
 * It changes no pose and no timing. It is a diagnostic.
 */

const SILENCE_LABELS = new Set(["SIL", "SP", "PAU", "sil", "sp", "pau"]);

export interface AlignmentGap {
  /** Seconds. */
  readonly startTime: number;
  readonly endTime: number;
  readonly durationSeconds: number;
  /** Mean normalised energy across the window, 0-1. */
  readonly meanEnergy: number;
  readonly peakEnergy: number;
  /** Mean voicing confidence across the window, 0-1. */
  readonly meanVoicing: number;
  /** The phonemes on either side, for locating it in the transcript. */
  readonly precedingPhonemes: string;
  readonly followingPhonemes: string;
}

export interface AlignmentAudit {
  /** Silence windows that carry speech. Each is a word the aligner dropped. */
  readonly gaps: readonly AlignmentGap[];
  /** Silence windows that really are silent — normal sentence pauses. */
  readonly genuineSilences: number;
  readonly analysed: boolean;
}

export interface AlignmentAuditOptions {
  /** Ignore silences shorter than this; a 60 ms stop closure is not a word. */
  readonly minimumSeconds?: number;
  /** Mean energy above which a "silence" is considered to contain speech. */
  readonly energyThreshold?: number;
  /** Mean voicing above which the same applies. */
  readonly voicingThreshold?: number;
}

/**
 * Audits one payload against its own decoded audio.
 *
 * Returns `analysed: false` when there is no PCM analysis to compare against,
 * rather than guessing — an un-analysed payload is not a clean payload.
 */
export const auditPhonemeAlignment = (
  phonemes: readonly TimedPhoneme[],
  acousticFrames: readonly SpeechAcousticFrame[],
  options: AlignmentAuditOptions = {}
): AlignmentAudit => {
  if (!acousticFrames.length || !phonemes.length) {
    return { gaps: [], genuineSilences: 0, analysed: false };
  }
  const minimumSeconds = options.minimumSeconds ?? 0.25;
  // Measured reference on the production clip: a real sentence pause reads
  // meanEnergy 0.000 and peakEnergy 0.003, while the dropped word reads
  // meanEnergy 0.332 and peakEnergy 1.000. Anything in between is unambiguous.
  const energyThreshold = options.energyThreshold ?? 0.08;
  const voicingThreshold = options.voicingThreshold ?? 0.35;

  const gaps: AlignmentGap[] = [];
  let genuineSilences = 0;

  for (let index = 0; index < phonemes.length; index += 1) {
    const phoneme = phonemes[index];
    if (!SILENCE_LABELS.has(phoneme.phoneme)) continue;
    const durationSeconds = phoneme.end_time - phoneme.start_time;
    if (durationSeconds < minimumSeconds) continue;

    const window = acousticFrames.filter(
      (frame) => frame.time >= phoneme.start_time && frame.time <= phoneme.end_time
    );
    if (!window.length) continue;
    const meanEnergy = window.reduce((sum, frame) => sum + frame.energy, 0) / window.length;
    const peakEnergy = window.reduce((best, frame) => Math.max(best, frame.energy), 0);
    const meanVoicing = window.reduce((sum, frame) => sum + frame.voicing, 0) / window.length;

    if (meanEnergy < energyThreshold || meanVoicing < voicingThreshold) {
      genuineSilences += 1;
      continue;
    }
    gaps.push({
      startTime: phoneme.start_time,
      endTime: phoneme.end_time,
      durationSeconds,
      meanEnergy,
      peakEnergy,
      meanVoicing,
      precedingPhonemes: phonemes
        .slice(Math.max(0, index - 4), index)
        .map((item) => item.phoneme)
        .join(" "),
      followingPhonemes: phonemes
        .slice(index + 1, index + 5)
        .map((item) => item.phoneme)
        .join(" ")
    });
  }

  return { gaps, genuineSilences, analysed: true };
};
