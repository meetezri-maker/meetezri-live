/**

 * Mood Check-In — presentation config only. API `mood` field uses `value` (lowercase slug).

 */



import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";



export interface MoodCheckInCard {

  value: string;

  label: string;

  micro: string;

  /** Atmospheric card image */

  image: string;

}



export const MOOD_CHECKIN_CARDS: MoodCheckInCard[] = [

  {

    value: "calm",

    label: "Calm",

    micro: "Things feel peaceful right now.",

    image: MOOD_CHECKIN_IMAGES.calm,

  },

  {

    value: "overwhelmed",

    label: "Overwhelmed",

    micro: "A lot is happening all at once.",

    image: MOOD_CHECKIN_IMAGES.overwhelmed,

  },

  {

    value: "hopeful",

    label: "Hopeful",

    micro: "A little light ahead feels possible.",

    image: MOOD_CHECKIN_IMAGES.hopeful,

  },

  {

    value: "tired",

    label: "Tired",

    micro: "Mentally and physically drained.",

    image: MOOD_CHECKIN_IMAGES.tired,

  },

  {

    value: "heavy",

    label: "Heavy",

    micro: "Everything feels a bit harder to carry.",

    image: MOOD_CHECKIN_IMAGES.heavy,

  },

  {

    value: "sad",

    label: "Sad",

    micro: "Something feels heavy or tender inside.",

    image: MOOD_CHECKIN_IMAGES.sad,

  },

  {

    value: "angry",

    label: "Angry",

    micro: "Frustration or heat is rising in you.",

    image: MOOD_CHECKIN_IMAGES.angry,

  },

  {

    value: "grateful",

    label: "Grateful",

    micro: "Appreciative and thankful.",

    image: MOOD_CHECKIN_IMAGES.grateful,

  },

  {

    value: "anxious",

    label: "Anxious",

    micro: "Your mind may feel tight or restless.",

    image: MOOD_CHECKIN_IMAGES.anxious,

  },

  {

    value: "numb",

    label: "Numb",

    micro: "Feelings feel quiet or far away.",

    image: MOOD_CHECKIN_IMAGES.numb,

  },

  {

    value: "excited",

    label: "Excited",

    micro: "Energy and anticipation are building.",

    image: MOOD_CHECKIN_IMAGES.excited,

  },

  {

    value: "energetic",

    label: "Energetic",

    micro: "You feel awake, charged, and ready to go.",

    image: MOOD_CHECKIN_IMAGES.energetic,

  },

  {

    value: "happy",

    label: "Happy",

    micro: "A warm, bright feeling is with you today.",

    image: MOOD_CHECKIN_IMAGES.happy,

  },

  {

    value: "nervous",

    label: "Nervous",

    micro: "Something ahead has your attention on edge.",

    image: MOOD_CHECKIN_IMAGES.nervous,

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

  { value: "health", label: "Health" },

  { value: "relationships", label: "Relationships" },

  { value: "social_energy", label: "Social" },

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

    neutral: "Neutral",

  };

  if (legacy[k]) return legacy[k];

  return k ? k.charAt(0).toUpperCase() + k.slice(1) : "—";

}


