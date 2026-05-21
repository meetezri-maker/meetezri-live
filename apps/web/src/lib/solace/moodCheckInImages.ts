/** Static assets under `public/mood-check-in/` for Mood Check-In. */
export const MOOD_CHECKIN_IMAGES = {
  /** Hero banner — lotus on the lake at dusk */
  heroBanner: "/mood-check-in/1.png",
  calm: "/mood-check-in/2.png",
  overwhelmed: "/mood-check-in/3.png",
  hopeful: "/mood-check-in/5.png",
  tired: "/mood-check-in/7.png",
  heavy: "/mood-check-in/heavy.png",
  grateful: "/mood-check-in/6.png",
  anxious: "/mood-check-in/anxious.png",
  /** Misty lake */
  numb: "/mood-check-in/4.png",
  excited: "/mood-check-in/excited.png",
  energetic: "/mood-check-in/energetic.png",
  happy: "/mood-check-in/happy.png",
  nervous: "/mood-check-in/nervous.png",
} as const;

const MOOD_IMAGE_BY_VALUE: Record<string, string> = {
  calm: MOOD_CHECKIN_IMAGES.calm,
  overwhelmed: MOOD_CHECKIN_IMAGES.overwhelmed,
  hopeful: MOOD_CHECKIN_IMAGES.hopeful,
  tired: MOOD_CHECKIN_IMAGES.tired,
  heavy: MOOD_CHECKIN_IMAGES.heavy,
  grateful: MOOD_CHECKIN_IMAGES.grateful,
  anxious: MOOD_CHECKIN_IMAGES.anxious,
  numb: MOOD_CHECKIN_IMAGES.numb,
  excited: MOOD_CHECKIN_IMAGES.excited,
  energetic: MOOD_CHECKIN_IMAGES.energetic,
  happy: MOOD_CHECKIN_IMAGES.happy,
  nervous: MOOD_CHECKIN_IMAGES.nervous,
};

export function moodCheckInImageForValue(value: string): string {
  return MOOD_IMAGE_BY_VALUE[value.trim().toLowerCase()] ?? MOOD_CHECKIN_IMAGES.calm;
}
