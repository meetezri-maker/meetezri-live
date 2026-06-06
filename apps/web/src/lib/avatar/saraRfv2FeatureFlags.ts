/**
 * Sara RFv2 runtime feature flags.
 *
 * Infrastructure only: these flags are not wired into the live runtime.
 * Sara still uses the current Sara V2 / legacyHybrid path. Do not activate
 * any Sara RFv2 runtime system until a later explicit phase.
 */

export const ENABLE_SARA_RFV2_RUNTIME = false;

export const SARA_RFV2_FLAGS = {
  runtime: false,
  phonemeDriver: false,
  behaviorScheduler: false,
  blinkSystem: false,
  listeningExpressions: false,
  speakingExpressions: false,
  emotionLayer: false,
  cameraSystem: false,
} as const;
