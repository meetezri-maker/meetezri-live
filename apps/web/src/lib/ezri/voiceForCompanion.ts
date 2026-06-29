import { normalizeCompanionId } from "@/lib/avatar/companionModelUrl";

/** Alex, Jordan — male-presenting companions in the product. */
const MALE_COMPANION_IDS = new Set(["alex", "jordan"]);
/** Maya, Sarah — female-presenting companions. */
const FEMALE_COMPANION_IDS = new Set(["maya", "sarah"]);

export type CompanionVoiceGender = "male" | "female";

function isFemaleVoiceLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  return (
    s.includes("female") || s === "voice 1" || s === "voice 3" || s === "default voice"
  );
}

function isMaleVoiceLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  return s.includes("male") || s === "voice 2" || s === "voice 4";
}

/** Lobby / profile avatar name → voice gender (matches Session Lobby voice filters). */
export function resolveCompanionVoiceGender(
  avatarLabel: string | null | undefined,
): CompanionVoiceGender | null {
  const id = normalizeCompanionId(avatarLabel);
  if (id && MALE_COMPANION_IDS.has(id)) return "male";
  if (id && FEMALE_COMPANION_IDS.has(id)) return "female";

  const n = (avatarLabel ?? "").trim().toLowerCase();
  if (
    n === "maya chen" ||
    n === "maya" ||
    n === "sara mitchell" ||
    n === "sarah mitchell" ||
    n === "sarah" ||
    n === "sara"
  ) {
    return "female";
  }
  if (
    n === "alex" ||
    n === "alex rivera" ||
    n === "jordan" ||
    n === "jordan taylor"
  ) {
    return "male";
  }
  return null;
}

/** Correct lobby voice label when profile voice disagrees with avatar gender. */
export function resolveVoiceLabelForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null,
): string {
  const gender = resolveCompanionVoiceGender(avatarLabel);
  const selected = (selectedVoiceLabel ?? "").trim();

  if (selected && gender) {
    if (gender === "male" && isFemaleVoiceLabel(selected)) return "Voice 2";
    if (gender === "female" && isMaleVoiceLabel(selected)) return "Voice 1";
  }

  if (selected) return selected;
  if (gender === "male") return "Voice 2";
  if (gender === "female") return "Voice 1";
  return "Voice 1";
}

/**
 * Ezri TTS `voice` for WebSocket and REST.
 * Avatar gender wins when the saved voice label does not match (e.g. Alex + Voice 1).
 *
 * - Female labels (Voice 1/3 or contains "female") -> `VITE_EZRI_VOICE_FEMALE` (default `af_sky`)
 * - Male labels (Voice 2/4 or contains "male") -> `VITE_EZRI_VOICE_MALE` (default `am_echo`)
 *
 * Override presets: `VITE_EZRI_VOICE_MALE`, `VITE_EZRI_VOICE_FEMALE`.
 */
export function resolveEzriWsVoiceForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null,
): string {
  const maleVoice =
    (import.meta.env.VITE_EZRI_VOICE_MALE as string | undefined)?.trim() ||
    "am_echo";
  const femaleVoice =
    (import.meta.env.VITE_EZRI_VOICE_FEMALE as string | undefined)?.trim() ||
    "af_sky";
  const fallbackVoice =
    (import.meta.env.VITE_DEFAULT_EZRI_VOICE as string | undefined)?.trim() ||
    "af_sky";

  const gender = resolveCompanionVoiceGender(avatarLabel);
  const alignedLabel = resolveVoiceLabelForCompanion(
    avatarLabel,
    selectedVoiceLabel,
  );
  const label = alignedLabel.trim().toLowerCase();

  if (isFemaleVoiceLabel(label)) return femaleVoice;
  if (isMaleVoiceLabel(label)) return maleVoice;

  if (gender === "male") return maleVoice;
  if (gender === "female") return femaleVoice;
  return fallbackVoice;
}
