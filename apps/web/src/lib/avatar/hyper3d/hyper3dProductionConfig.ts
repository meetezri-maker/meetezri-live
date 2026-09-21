import { p18Review, type P18ReviewConfig } from "./engine/mappings/p17ReviewConfig";
import { conductorTunings } from "./engine/engine/animation/SpeechPerformanceConductor";
import { talkingHeadTunings } from "./engine/engine/animation/TalkingHeadSpeakingAdapter";
import { speakingMotionProfiles } from "./engine/engine/animation/SpeakingGestureDirector";
import { motorTunings } from "./engine/engine/animation/SpeakingMotorController";
import {
  THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE,
  type Hyper3dHeadPerformanceSourceId,
} from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";

/**
 * THE PRODUCTION SPEAKING CONFIGURATION (Phase 2C decision).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * In avatar-test the reviewed Hyper3D speaking configuration is not the default.
 * `useAvatarStore` ships `speakingReview: p18Review.off`, and the accepted
 * preset is selected by a human in `Hyper3dCalibrationControls` /
 * `ExpressionMaxControls` — calibration UI that is deliberately NOT migrated.
 * Solace has no such UI, so the preset has to become ordinary production
 * configuration instead, which is exactly the promotion path
 * `hyper3dPerformanceBaseline.ts` prescribes: "a change becomes production only
 * by being promoted into code."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROMOTED BY REFERENCE, NEVER RETYPED
 * ─────────────────────────────────────────────────────────────────────────────
 * This module selects `p18Review["hyper3d-presence"]` from the ported accepted
 * source and resolves its tuning ids against the accepted tables. Not one value
 * is copied out by hand, so the preset cannot drift from avatar-test by a typo,
 * and a change upstream shows up here as a changed object rather than a stale
 * literal. `hyper3dProductionConfig.test.ts` additionally pins the resolved ids
 * so a silent swap to another preset fails the build.
 *
 * NOT MIXED, NOT VARIED: exactly one preset, used whole. No Solace-specific
 * tuning variant exists and none may be introduced here.
 */

/** The accepted preset id promoted to production. Phase 2C decision. */
export const HYPER3D_PRODUCTION_PRESET_ID = "hyper3d-presence" as const;

/** The accepted preset object itself, by reference. */
export const HYPER3D_PRODUCTION_PRESET: P18ReviewConfig =
  p18Review[HYPER3D_PRODUCTION_PRESET_ID];

/**
 * The preset's ids resolved against the accepted tuning tables — the same
 * resolution `AvatarModel` performs when a reviewer selects the preset, lifted
 * out of the review panel and frozen as production configuration.
 *
 * `null` entries are the preset's own nulls and are meaningful: a null
 * `motorTuning` means the head is EASED toward the conductor's angles rather
 * than integrated from motor drive, and a null `profileId` means the §P18
 * director is not consulted at all because the conductor owns the performance.
 */
export const HYPER3D_PRODUCTION_SPEAKING = {
  presetId: HYPER3D_PRODUCTION_PRESET_ID,
  speakingIdleFloor: HYPER3D_PRODUCTION_PRESET.speakingIdleFloor,
  conductorTuning: HYPER3D_PRODUCTION_PRESET.conductorTuningId
    ? conductorTunings[HYPER3D_PRODUCTION_PRESET.conductorTuningId]
    : null,
  /**
   * ALWAYS NULL ON THIS ASSET — and that is the accepted behaviour, not an
   * oversight in the preset.
   *
   * `hyper3d-presence` stores `talkingHeadTuningId: "thFinal190"`, but the
   * accepted call site refuses to consult it for this model:
   *
   *     talkingHeadTuning: config.id === "hyper3d-usc" ? null : …
   *     // STAGE 2.3. Hardware rejected TALKINGHEAD ONLY, so the carrier is
   *     // disabled as a MOTION GENERATOR for Hyper3D. The 1.90x selection stays
   *     // stored in `speakingReview` — it is simply no longer consulted here.
   *
   * Resolving the id here and handing it to `evaluate` would re-enable a motion
   * generator that hardware review rejected. The gate is model-scoped in the
   * accepted source, so it is reproduced model-scoped here.
   */
  talkingHeadTuning: null,
  /** Kept for diagnostics: what the preset stores, versus what is consulted. */
  talkingHeadTuningIdStoredButNotConsulted:
    HYPER3D_PRODUCTION_PRESET.talkingHeadTuningId,
  motorTuning: HYPER3D_PRODUCTION_PRESET.motorTuningId
    ? motorTunings[HYPER3D_PRODUCTION_PRESET.motorTuningId]
    : null,
  speakingMotionProfile: HYPER3D_PRODUCTION_PRESET.profileId
    ? speakingMotionProfiles[HYPER3D_PRODUCTION_PRESET.profileId]
    : null,
} as const;

/**
 * THE PRODUCTION HEAD-PERFORMANCE SOURCE (Phase 2D decision).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A PROMOTION, NOT A DEFAULT
 * ─────────────────────────────────────────────────────────────────────────────
 * `useAvatarStore` ships `hyper3dHeadPerformanceSource: "accepted"`, and the
 * reviewed configuration — `"threejs-talking-avatar"` — was reachable only from
 * the calibration UI, which is not migrated. Same situation as `speakingReview`,
 * and the same remedy: promote it into ordinary production configuration.
 *
 * The evidence that this is the reviewed configuration, all from
 * `hyper3dPerformanceBaseline.ts`:
 *
 *   HYPER3D_BASELINE_SOURCES.head            -> hyper3dThreejsTalkingAvatarHead
 *   .gaze / .blink / .lid / .affectEnvelope  -> upstream/threejs-talking-avatar
 *   OWNERSHIP_INVARIANTS[0]                  -> "the threejs-talking-avatar
 *                                               adapter REPLACES the head command"
 *   BASELINE_GOLDEN.warmth / .eyeSoftening   -> non-zero, and semantic affect
 *                                               exists ONLY on this path
 *   the store's own accepted motion scale    -> shipped for a path it did not enable
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO CONTROLS, INDEPENDENTLY PROTECTED
 * ─────────────────────────────────────────────────────────────────────────────
 * This selects the head PERFORMANCE SOURCE. It does NOT re-enable the
 * TalkingHead carrier as a motion generator — that is
 * `HYPER3D_PRODUCTION_SPEAKING.talkingHeadTuning`, which stays `null` for
 * `hyper3d-usc` because hardware rejected it. The two are deliberately separate
 * controls and are pinned separately in the contract test.
 */
export const HYPER3D_PRODUCTION_HEAD_SOURCE: Hyper3dHeadPerformanceSourceId =
  "threejs-talking-avatar";

/**
 * The accepted head motion scale, by reference — `BASELINE_HEAD.motionScale`,
 * whose source of truth is `hyper3dThreejsTalkingAvatarHead.ts`. Never retyped.
 */
export const HYPER3D_PRODUCTION_HEAD_MOTION_SCALE =
  THREEJS_TALKING_AVATAR_ACCEPTED_MOTION_SCALE;
