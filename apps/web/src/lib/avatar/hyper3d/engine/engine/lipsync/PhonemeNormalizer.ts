import { phonemeAliases, supportedPhonemeSet, type SupportedPhoneme } from "../../mappings/phonemeAliases";
import { warnOnce } from "../../utils/logger";

export function normalizePhoneme(value: string, warn = true): SupportedPhoneme | undefined {
  const trimmed = value.trim();
  const strippedStress = trimmed.replace(/[0-2]$/, "");
  const direct = phonemeAliases[trimmed] ?? phonemeAliases[strippedStress] ?? phonemeAliases[strippedStress.toLowerCase()];
  if (direct) return direct;
  const upper = strippedStress.toUpperCase();
  if (supportedPhonemeSet.has(upper as SupportedPhoneme)) return upper as SupportedPhoneme;
  if (warn) warnOnce(`phoneme:${value}`, `Unknown phoneme ${value}; falling back to rest pose.`);
  return undefined;
}
