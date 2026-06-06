import type { EzriAvatarData } from "@/lib/ezri/realtimeClient";
import type { AvatarPhoneme, AvatarPhonemeTimeline } from "./avatarMorphTypes";
import {
  DEBUG_JORDAN_PHONEMES,
  PHONEME_TO_JORDAN_VISEME,
  type JordanMorphName,
} from "./jordanRfv2Config";
import {
  type SaraMorphName,
} from "./configs/saraConfig";
import { SARA_V2_PHONEME_TO_VISEME } from "./configs/saraV2Config";

export function normalizeMorphName(name: string): string {
  return name.toLowerCase().replace(/[\s-]+/g, "_").trim();
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function normalizePhonemeLabel(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw.trim()) return "PAUSE";
  let label = raw.trim().toUpperCase();
  label = label.replace(/^VISEME[_\s-]*/i, "");
  label = label.replace(/\d+$/g, "");
  label = label.replace(/\s+/g, "");
  label = label.replace(/[^A-Z]/g, "");
  return label || "PAUSE";
}

export function normalizePhonemeLabelForDebug(value: unknown): string {
  return normalizePhonemeLabel(value);
}

export function normalizeAvatarPhonemeTimeline(
  data: EzriAvatarData | null | undefined,
  durationSeconds?: number
): AvatarPhonemeTimeline | null {
  if (!data) return null;
  const raw = data.phonemes;
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const phonemes: AvatarPhoneme[] = [];
  const isTimestampedFormat = source.some((item) => {
    if (!item || typeof item !== "object") return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.phoneme === "string" &&
      asNumber(obj.start) !== null &&
      asNumber(obj.end) !== null
    );
  });
  const isStringFallbackFormat = !isTimestampedFormat && source.every((item) => typeof item === "string");
  const phonemeFormat: AvatarPhonemeTimeline["phonemeFormat"] = isTimestampedFormat
    ? "timestamped"
    : "string-fallback";
  if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
    console.log("[Jordan] Received phoneme format", {
      phonemeFormat,
      count: source.length,
    });
  }
  if (!isTimestampedFormat && !isStringFallbackFormat) {
    return {
      sentence: data.sentence || "",
      sentiment: data.sentiment,
      phonemeFormat,
      phonemes,
    };
  }

  source.forEach((item, index) => {
    if (typeof item === "string") {
      if (isTimestampedFormat) return;
      const rawLabel = item;
      const label = normalizePhonemeLabel(item);
      const debugNormalizedLabel = normalizePhonemeLabelForDebug(item);
      if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
        console.log("[Jordan] Phoneme normalization", {
          rawPhoneme: rawLabel,
          normalizedPhoneme: debugNormalizedLabel,
          driverPhoneme: label,
        });
      }
      if (!label) return;
      const step =
        durationSeconds && source.length > 0
          ? durationSeconds / source.length
          : 0.12;
      const generatedStart = index * step;
      const generatedEnd = (index + 1) * step;
      const mappedViseme = PHONEME_TO_JORDAN_VISEME[label] ?? null;
      if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
        console.log("[Jordan] Generated phoneme timing", {
          phonemeFormat,
          rawPhoneme: rawLabel,
          normalizedPhoneme: label,
          mappedViseme,
          start: generatedStart,
          end: generatedEnd,
        });
      }
      phonemes.push({
        rawPhoneme: rawLabel,
        phoneme: label,
        debugNormalizedPhoneme: debugNormalizedLabel,
        start: generatedStart,
        end: generatedEnd,
      });
      return;
    }

    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const rawLabel = isTimestampedFormat
      ? obj.phoneme
      : obj.phoneme ?? obj.phone ?? obj.label ?? obj.name ?? obj.value;
    const label = normalizePhonemeLabel(rawLabel);
    const debugNormalizedLabel = normalizePhonemeLabelForDebug(rawLabel);
    if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
      console.log("[Jordan] Phoneme normalization", {
        rawPhoneme: rawLabel,
        normalizedPhoneme: debugNormalizedLabel,
        driverPhoneme: label,
      });
    }
    if (!label) return;
    const start = isTimestampedFormat
      ? asNumber(obj.start)
      : asNumber(obj.start) ??
        asNumber(obj.startTime) ??
        asNumber(obj.time) ??
        asNumber(obj.timestamp) ??
        asNumber(obj.t);
    const end = isTimestampedFormat
      ? asNumber(obj.end)
      : asNumber(obj.end) ??
        asNumber(obj.endTime) ??
        asNumber(obj.stop) ??
        asNumber(obj.offset);
    if (isTimestampedFormat && (start === null || end === null || end < start)) {
      return;
    }
    const duration = isTimestampedFormat ? null : asNumber(obj.duration) ?? asNumber(obj.dur);
    const fallbackStart =
      durationSeconds && source.length > 0
        ? (index * durationSeconds) / source.length
        : index * 0.12;
    const fallbackEnd =
      durationSeconds && source.length > 0
        ? ((index + 1) * durationSeconds) / source.length
        : fallbackStart + 0.12;
    const normalizedStart = start ?? fallbackStart;
    const normalizedEnd = end ?? (duration != null ? normalizedStart + duration : fallbackEnd);
    const mappedViseme = PHONEME_TO_JORDAN_VISEME[label] ?? null;
    if (process.env.NODE_ENV === "development" && DEBUG_JORDAN_PHONEMES) {
      console.log("[Jordan] Phoneme timing", {
        phonemeFormat,
        rawPhoneme: rawLabel,
        normalizedPhoneme: label,
        mappedViseme,
        start: normalizedStart,
        end: normalizedEnd,
      });
    }
    phonemes.push({
      rawPhoneme: String(rawLabel ?? ""),
      phoneme: label,
      debugNormalizedPhoneme: debugNormalizedLabel,
      start: normalizedStart,
      end: normalizedEnd,
    });
  });

  phonemes.sort((a, b) => a.start - b.start);
  if (!isTimestampedFormat && durationSeconds && phonemes.some((p) => p.start > durationSeconds * 2)) {
    phonemes.forEach((p) => {
      p.start /= 1000;
      if (p.end != null) p.end /= 1000;
    });
  }
  return {
    sentence: data.sentence || "",
    sentiment: data.sentiment,
    phonemeFormat,
    phonemes,
  };
}

export function findActiveJordanViseme(
  timeline: AvatarPhonemeTimeline | null,
  speechTime: number
): JordanMorphName | null {
  return findActiveJordanPhoneme(timeline, speechTime)?.viseme ?? null;
}

export function findActiveJordanPhoneme(
  timeline: AvatarPhonemeTimeline | null,
  speechTime: number
): (AvatarPhoneme & { viseme: JordanMorphName | null }) | null {
  if (!timeline || timeline.phonemes.length === 0) return null;
  for (let i = 0; i < timeline.phonemes.length; i += 1) {
    const current = timeline.phonemes[i];
    const next = timeline.phonemes[i + 1];
    const end = current.end ?? next?.start ?? current.start + 0.14;
    if (speechTime >= current.start && speechTime < end) {
      return {
        ...current,
        viseme: PHONEME_TO_JORDAN_VISEME[current.phoneme] ?? null,
      };
    }
  }
  return null;
}

export function findActiveSaraPhoneme(
  timeline: AvatarPhonemeTimeline | null,
  speechTime: number
): (AvatarPhoneme & { viseme: SaraMorphName | null }) | null {
  if (!timeline || timeline.phonemes.length === 0) return null;
  for (let i = 0; i < timeline.phonemes.length; i += 1) {
    const current = timeline.phonemes[i];
    const next = timeline.phonemes[i + 1];
    const end = current.end ?? next?.start ?? current.start + 0.14;
    if (speechTime >= current.start && speechTime < end) {
      return {
        ...current,
        viseme: SARA_V2_PHONEME_TO_VISEME[current.phoneme] ?? "viseme_rest",
      };
    }
  }
  return null;
}

export function hasInvalidJordanPhonemeTimestamps(
  timeline: AvatarPhonemeTimeline | null
): boolean {
  if (!timeline || timeline.phonemes.length === 0) return true;
  return timeline.phonemes.some((phoneme) => {
    const startValid = Number.isFinite(phoneme.start) && phoneme.start >= 0;
    const endValid =
      phoneme.end == null ||
      (Number.isFinite(phoneme.end) && phoneme.end >= phoneme.start);
    return !startValid || !endValid;
  });
}
