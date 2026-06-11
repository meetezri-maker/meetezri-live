import type {
  AvatarDefinition,
  AvatarId,
  AvatarPersonalityTimingConfig,
} from "./avatarConfigTypes";
import { SARA_V3_AVATAR_DEFINITION } from "@/avatar/saraV3";
import { JORDAN_AVATAR_DEFINITION } from "./configs/jordanConfig";
import { SARA_V2_AVATAR_DEFINITION } from "./configs/saraV2Config";

/**
 * Preparation-only avatar registry for future multi-avatar support.
 *
 * Nothing in the live ActiveSession runtime reads this registry yet; current
 * Jordan behavior remains owned by the existing runtime/config files.
 */
export const AVATAR_REGISTRY = {
  jordan: JORDAN_AVATAR_DEFINITION,
  sara: SARA_V2_AVATAR_DEFINITION,
  saraV3: SARA_V3_AVATAR_DEFINITION,
} as const satisfies Record<AvatarId, AvatarDefinition>;

export function getAvatarDefinition(id: AvatarId): AvatarDefinition {
  return AVATAR_REGISTRY[id];
}

export function hasAvatarDefinition(id: string): id is AvatarId {
  return id in AVATAR_REGISTRY;
}

const NEUTRAL_PERSONALITY_TIMING: AvatarPersonalityTimingConfig = {
  reactionSpeed: 1,
  reactionDelayMultiplier: 1,
  stillnessPreference: 1,
  blinkCadenceMultiplier: 1,
  eyeEngagement: 1,
  headMovementAmount: 1,
  smileWarmth: 1,
  emotionalLatency: 1,
  empathySoftness: 1,
  expressiveness: 1,
  nervousSystemVariance: 1,
  listeningWarmth: 1,
  speakingEnergy: 1,
  thinkingStillness: 1,
  interruptionSensitivity: 1,
};

function normalizeAvatarPersonalityId(id: string): AvatarId | null {
  const normalized = id.trim().toLowerCase();

  if (normalized === "jordan" || normalized.includes("jordan")) {
    return "jordan";
  }

  if (
    normalized === "sarav3" ||
    normalized === "sara v3" ||
    normalized === "sara-v3"
  ) {
    return "saraV3";
  }

  if (
    normalized === "sara" ||
    normalized === "sarah" ||
    normalized.includes("sara") ||
    normalized.includes("sarah")
  ) {
    return "sara";
  }

  return null;
}

export function getAvatarPersonalityTiming(
  id: string,
): AvatarPersonalityTimingConfig {
  const avatarId = normalizeAvatarPersonalityId(id);

  if (!avatarId) {
    return AVATAR_REGISTRY.jordan.personalityTiming ?? NEUTRAL_PERSONALITY_TIMING;
  }

  return (
    AVATAR_REGISTRY[avatarId].personalityTiming ??
    AVATAR_REGISTRY.jordan.personalityTiming ??
    NEUTRAL_PERSONALITY_TIMING
  );
}
