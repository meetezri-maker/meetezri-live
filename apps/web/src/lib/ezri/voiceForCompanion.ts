import { normalizeCompanionId } from "@/lib/avatar/companionModelUrl";

/** Alex, Jordan — male-presenting companions in the product. */
const MALE_COMPANION_IDS = new Set(["alex", "jordan"]);
/** Maya, Sarah — female-presenting companions. */
const FEMALE_COMPANION_IDS = new Set(["maya", "sarah"]);

/**
 * Ezri TTS `voice` for WebSocket and REST.
 * Primary source: selected voice label from Session Lobby ("Voice 1"..."Voice 4").
 * - Female labels (Voice 1/3 or contains "female") -> `VITE_EZRI_VOICE_FEMALE` (default `af_sky`)
 * - Male labels (Voice 2/4 or contains "male") -> `VITE_EZRI_VOICE_MALE` (default `am_echo`)
 *
 * Fallback source: avatar if voice label is missing.
 * - Female avatars (Maya, Sarah) -> female voice
 * - Male avatars (Alex, Jordan) -> male voice
 *
 * Final fallback: `VITE_DEFAULT_EZRI_VOICE` (default `af_sky`)
 *
 * Override presets: `VITE_EZRI_VOICE_MALE`, `VITE_EZRI_VOICE_FEMALE`.
 */
export function resolveEzriWsVoiceForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null
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

  const selected = (selectedVoiceLabel ?? "").trim().toLowerCase();
  if (selected) {
    if (
      selected.includes("female") ||
      selected === "voice 1" ||
      selected === "voice 3"
    ) {
      return femaleVoice;
    }
    if (
      selected.includes("male") ||
      selected === "voice 2" ||
      selected === "voice 4"
    ) {
      return maleVoice;
    }
  }

  const id = normalizeCompanionId(avatarLabel);
  if (id && MALE_COMPANION_IDS.has(id)) return maleVoice;
  if (id && FEMALE_COMPANION_IDS.has(id)) return femaleVoice;
  return fallbackVoice;
}
