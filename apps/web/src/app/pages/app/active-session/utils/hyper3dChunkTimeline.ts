import type { EzriAvatarData } from "@/lib/ezri/realtimeClient";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import { normalizeAvatarPhonemeTimeline } from "@/lib/avatar/phonemeToViseme";

export type Hyper3dRawPhonemeFormat = AvatarPhonemeTimeline["phonemeFormat"] | "empty";

/**
 * What a scheduled chunk hands the Hyper3D live adapter.
 *
 * Hyper3D consumes BACKEND timing only. The shared normalizer turns a flat
 * string phoneme list (the backend's comfort-phrase shape) into evenly spread
 * client-side timing; that estimate is never handed to Hyper3D. The untimed
 * data itself stays on the queued item (`avatarData`) untouched, and the
 * withheld count is reported so the condition is observable.
 */
export function hyper3dTimelineForScheduledChunk(
  avatarData: EzriAvatarData | null | undefined,
  durationSeconds: number,
): {
  timeline: AvatarPhonemeTimeline | null;
  rawAvatarDataPresent: boolean;
  rawPhonemeFormat: Hyper3dRawPhonemeFormat | null;
  untimedPhonemeCount: number;
} {
  const normalized = normalizeAvatarPhonemeTimeline(avatarData ?? null, durationSeconds);
  const timed = normalized?.phonemeFormat === "timestamped";
  const empty = normalized !== null && normalized.phonemes.length === 0;
  return {
    timeline: timed ? normalized : null,
    rawAvatarDataPresent: Boolean(avatarData),
    rawPhonemeFormat: normalized ? (empty ? "empty" : normalized.phonemeFormat) : null,
    untimedPhonemeCount: normalized && !timed ? normalized.phonemes.length : 0,
  };
}
