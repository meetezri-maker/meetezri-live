/**
 * Display metadata for mood check-in slugs (calendar, history, exports).
 * Keep in sync with MOOD_CHECKIN_CARDS labels/values.
 */

export interface MoodDisplayInfo {
  label: string;
  emoji: string;
  color: string;
  /** Default score when intensity is missing */
  score: number;
}

/** Slug → display (all current check-in moods) */
export const MOOD_DISPLAY_BY_SLUG: Record<string, MoodDisplayInfo> = {
  calm: { label: "Calm", emoji: "😌", color: "#3b82f6", score: 8 },
  overwhelmed: { label: "Overwhelmed", emoji: "😵‍💫", color: "#c2410c", score: 3 },
  hopeful: { label: "Hopeful", emoji: "🌤️", color: "#38bdf8", score: 7 },
  tired: { label: "Tired", emoji: "😴", color: "#6b7280", score: 5 },
  heavy: { label: "Heavy", emoji: "🫤", color: "#6366f1", score: 3 },
  grateful: { label: "Grateful", emoji: "🙏", color: "#eab308", score: 9 },
  excited: { label: "Excited", emoji: "🤩", color: "#a855f7", score: 9 },
  anxious: { label: "Anxious", emoji: "😰", color: "#f97316", score: 4 },
  numb: { label: "Numb", emoji: "😶", color: "#94a3b8", score: 5 },
  happy: { label: "Happy", emoji: "😊", color: "#fbbf24", score: 10 },
  nervous: { label: "Nervous", emoji: "😬", color: "#fb923c", score: 4 },
  sad: { label: "Sad", emoji: "😢", color: "#6366f1", score: 2 },
  energetic: { label: "Energetic", emoji: "⚡", color: "#22c55e", score: 9 },
  angry: { label: "Angry", emoji: "😡", color: "#ef4444", score: 1 },
};

/** Legacy emoji-only moods (journal / older entries) */
const MOOD_DISPLAY_BY_EMOJI: Record<string, MoodDisplayInfo> = {
  "😊": MOOD_DISPLAY_BY_SLUG.happy,
  "😌": MOOD_DISPLAY_BY_SLUG.calm,
  "🤩": MOOD_DISPLAY_BY_SLUG.excited,
  "😰": MOOD_DISPLAY_BY_SLUG.anxious,
  "😢": MOOD_DISPLAY_BY_SLUG.sad,
  "😡": MOOD_DISPLAY_BY_SLUG.angry,
  "😠": MOOD_DISPLAY_BY_SLUG.angry,
  "😴": MOOD_DISPLAY_BY_SLUG.tired,
  "😐": { label: "Neutral", emoji: "😐", color: "#94a3b8", score: 6 },
  "⚡": MOOD_DISPLAY_BY_SLUG.energetic,
  "😬": MOOD_DISPLAY_BY_SLUG.nervous,
};

export const MOOD_CALENDAR_LEGEND = Object.values(MOOD_DISPLAY_BY_SLUG);

export function getMoodDisplayInfo(mood: string): (MoodDisplayInfo & { emoji: string }) | null {
  if (!mood) return null;
  const trimmed = mood.trim();
  const slug = trimmed.toLowerCase();

  if (MOOD_DISPLAY_BY_SLUG[slug]) {
    return { ...MOOD_DISPLAY_BY_SLUG[slug], emoji: MOOD_DISPLAY_BY_SLUG[slug].emoji };
  }
  if (MOOD_DISPLAY_BY_EMOJI[trimmed]) {
    return { ...MOOD_DISPLAY_BY_EMOJI[trimmed], emoji: MOOD_DISPLAY_BY_EMOJI[trimmed].emoji };
  }
  const byLabel = Object.values(MOOD_DISPLAY_BY_SLUG).find(
    (d) => d.label.toLowerCase() === slug,
  );
  if (byLabel) return { ...byLabel, emoji: byLabel.emoji };
  if (/[\u{1F300}-\u{1FAFF}]/u.test(trimmed)) {
    return { label: "Mood", emoji: trimmed, color: "#9ca3af", score: 5 };
  }
  if (slug) {
    const label = slug.charAt(0).toUpperCase() + slug.slice(1);
    return { label, emoji: "😐", color: "#9ca3af", score: 5 };
  }
  return null;
}
