/**
 * Mood Check-In — presentation config only. API `mood` field uses `value` (lowercase slug).
 */

export interface MoodCheckInCard {
  value: string;
  label: string;
  micro: string;
  /** Atmospheric card image */
  image: string;
}

/** Locked 8 moods — cinematic Unsplash backplates */
export const MOOD_CHECKIN_CARDS: MoodCheckInCard[] = [
  {
    value: "calm",
    label: "Calm",
    micro: "Things feel peaceful right now.",
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "overwhelmed",
    label: "Overwhelmed",
    micro: "A lot is happening all at once.",
    image:
      "https://images.unsplash.com/photo-1504608524841-42fe6f032db4?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "hopeful",
    label: "Hopeful",
    micro: "A little light ahead feels possible.",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "tired",
    label: "Tired",
    micro: "Mentally and physically drained.",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "heavy",
    label: "Heavy",
    micro: "Everything feels a bit harder to carry.",
    image:
      "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "grateful",
    label: "Grateful",
    micro: "Appreciative and thankful.",
    image:
      "https://images.unsplash.com/photo-1500530855699-b58689a9947a?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "anxious",
    label: "Anxious",
    micro: "Your mind may feel tight or restless.",
    image:
      "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=82",
  },
  {
    value: "numb",
    label: "Numb",
    micro: "Feelings feel quiet or far away.",
    image:
      "https://images.unsplash.com/photo-1483728642387-6e3a054ada0f?auto=format&fit=crop&w=800&q=82",
  },
];

export interface InfluenceChip {
  value: string;
  label: string;
}

/** Locked influence topics — stored as activities alongside existing API */
export const INFLUENCE_CHIPS: InfluenceChip[] = [
  { value: "sleep", label: "Sleep" },
  { value: "work", label: "Work" },
  { value: "loneliness", label: "Loneliness" },
  { value: "family", label: "Family" },
  { value: "health", label: "Health" },
  { value: "overthinking", label: "Overthinking" },
  { value: "relationships", label: "Relationships" },
  { value: "burnout", label: "Burnout" },
  { value: "social_energy", label: "Social Energy" },
  { value: "gratitude", label: "Gratitude" },
];

/** Intensity tiers map to API 1–10 scale */
export const INTENSITY_BY_TIER: Record<1 | 2 | 3, number> = {
  1: 2,
  2: 6,
  3: 9,
};

export function tierFromIntensity(n: number): 1 | 2 | 3 {
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  return 3;
}

/** Resolve insight label for any stored mood string (legacy + new) */
export function insightLabelForMoodKey(key: string): string {
  const k = key.trim().toLowerCase();
  const card = MOOD_CHECKIN_CARDS.find((c) => c.value === k);
  if (card) return card.label;
  const legacy: Record<string, string> = {
    happy: "Happy",
    sad: "Sad",
    angry: "Angry",
    excited: "Excited",
    neutral: "Neutral",
  };
  if (legacy[k]) return legacy[k];
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : "—";
}
