import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";

/** Atmospheric backgrounds for influence factor cards (reuses mood-check-in art). */
export const INFLUENCE_CHECKIN_IMAGES = {
  sleep: MOOD_CHECKIN_IMAGES.tired,
  work: MOOD_CHECKIN_IMAGES.overwhelmed,
  family: MOOD_CHECKIN_IMAGES.hopeful,
  health: MOOD_CHECKIN_IMAGES.calm,
  relationships: MOOD_CHECKIN_IMAGES.happy,
  social_energy: MOOD_CHECKIN_IMAGES.energetic,
  gratitude: MOOD_CHECKIN_IMAGES.grateful,
} as const;
