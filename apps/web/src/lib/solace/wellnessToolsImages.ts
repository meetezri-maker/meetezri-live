/** Static assets under `public/wellness-tools/` for the Wellness Tools page. */
export const WELLNESS_TOOLS_IMAGES = {
  /** Hero — deck, lanterns, lake at dusk */
  hero: "/wellness-tools/wellness-tools.jpg",
  /** Right-rail inspirational quote card */
  quote: "/wellness-tools/14.png",
  explore: {
    mind: "/wellness-tools/3.png",
    body: "/wellness-tools/4.png",
    emotions: "/wellness-tools/5.png",
    relax: "/wellness-tools/6.png",
    sleep: "/wellness-tools/7.png",
  },
  /** “How can we support you today?” quick-action pills */
  support: {
    calmAnxiety: "/wellness-tools/8.png",
    sleepBetter: "/wellness-tools/12.png",
    boostFocus: "/wellness-tools/3.png",
    manageStress: "/wellness-tools/10.png",
    liftMood: "/wellness-tools/13.png",
    buildConfidence: "/wellness-tools/5.png",
  },
  exercise: {
    "grounding-54321": "/wellness-tools/8.png",
    "stress-release-waves": "/wellness-tools/10.png",
    "body-scan": "/wellness-tools/11.png",
    "sleep-meditation": "/wellness-tools/12.png",
    "gentle-movement": "/wellness-tools/13.png",
    gratitude: "/wellness-tools/14.png",
    "box-breathing": "/wellness-tools/6.png",
    "compassion-pause": "/wellness-tools/4.png",
    "mindful-anchor": "/wellness-tools/3.png",
    "rain-sounds": "/wellness-tools/7.png",
  },
} as const;

const EXERCISE_IMAGE_BY_ID: Record<string, string> = WELLNESS_TOOLS_IMAGES.exercise;

const CATEGORY_FALLBACK: Partial<Record<string, string>> = {
  Anxiousness: WELLNESS_TOOLS_IMAGES.exercise["grounding-54321"],
  "Stress Management": WELLNESS_TOOLS_IMAGES.exercise["stress-release-waves"],
  Meditation: WELLNESS_TOOLS_IMAGES.exercise["body-scan"],
  "Sleep Health": WELLNESS_TOOLS_IMAGES.exercise["sleep-meditation"],
  Exercise: WELLNESS_TOOLS_IMAGES.exercise["gentle-movement"],
  "Self-Care": WELLNESS_TOOLS_IMAGES.exercise.gratitude,
  Relaxation: WELLNESS_TOOLS_IMAGES.exercise["rain-sounds"],
  "Low morale support": WELLNESS_TOOLS_IMAGES.exercise["compassion-pause"],
  Mindfulness: WELLNESS_TOOLS_IMAGES.exercise["mindful-anchor"],
};

export function wellnessToolsExerciseImage(id: string): string | undefined {
  return EXERCISE_IMAGE_BY_ID[id];
}

export function wellnessToolsCategoryFallbackImage(category: string): string | undefined {
  return CATEGORY_FALLBACK[category];
}

export const WELLNESS_TOOLS_IMAGE_POOL: readonly string[] = Object.values(
  WELLNESS_TOOLS_IMAGES.exercise
);
