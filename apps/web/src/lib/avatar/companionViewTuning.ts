import {
  type CompanionCanonicalId,
  normalizeCompanionId,
} from "./companionModelUrl";

/**
 * Per-companion framing and lip-sync strength for ThreeAvatar (live session, GLB only — Sarah).
 *
 * Edit `TUNING_PATCHES` for `sarah` (and legacy `alex` if used with a GLB elsewhere).
 * Each key overrides {@link DEFAULT_COMPANION_VIEW_TUNING} for that companion only.
 * Typical tweaks:
 * - `scaleMultiplier` — model too big/small after auto-fit
 * - `offsetY` — slide the model up/down in the frame
 * - `cameraDistanceMultiplier` — zoom out (above 1) / in (below 1)
 * - `mouthDriveMultiplier` — stronger/weaker lip and jaw motion during TTS
 */
export type CompanionViewTuning = {
  /** Applied after auto bounding-box fit (`4.5 / maxDim`). */
  scaleMultiplier: number;
  /** Vertical nudge in scene units after framing (positive = up). */
  offsetY: number;
  /** Multiplier on auto camera distance from the head. */
  cameraDistanceMultiplier: number;
  /** Portion of model height added to look-at Y (was hardcoded 0.12). */
  lookAtYOffsetFraction: number;
  /** Scales viseme + jaw/lip drive (morphs and bones). */
  mouthDriveMultiplier: number;
};

export const DEFAULT_COMPANION_VIEW_TUNING: CompanionViewTuning = {
  scaleMultiplier: 1,
  offsetY: 0,
  cameraDistanceMultiplier: 1,
  lookAtYOffsetFraction: 0.12,
  mouthDriveMultiplier: 1,
};

/** Per-avatar patches; merge over defaults. Add entries when a GLB needs different framing or mouth strength. */
const TUNING_PATCHES: Partial<
  Record<CompanionCanonicalId, Partial<CompanionViewTuning>>
> = {
  alex: {
    lookAtYOffsetFraction: 0.11,
    mouthDriveMultiplier: 0.92,
  },
  /** `Sara Mitchell.glb` — adjust framing/mouth vs defaults. */
  sarah: {
    scaleMultiplier: 1,
    offsetY: 0,
    cameraDistanceMultiplier: 1,
    mouthDriveMultiplier: 1,
  },
};

export function getCompanionViewTuning(
  avatarLabel: string | null | undefined
): CompanionViewTuning {
  const id = normalizeCompanionId(avatarLabel);
  if (!id) return DEFAULT_COMPANION_VIEW_TUNING;
  return {
    ...DEFAULT_COMPANION_VIEW_TUNING,
    ...(TUNING_PATCHES[id] ?? {}),
  };
}
