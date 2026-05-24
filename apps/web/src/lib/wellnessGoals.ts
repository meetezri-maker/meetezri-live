/**
 * Canonical wellness focus areas — keep in sync across onboarding and profile.
 */
export const WELLNESS_GOALS = [
  {
    value: "feel-calm-in-control",
    title: "Mind & Emotions",
    description: "Feel calm & in control",
    emoji: "🧠",
  },
  {
    value: "boost-mood-daily-energy",
    title: "Energy & Vitality",
    description: "Boost mood & daily energy",
    emoji: "⚡",
  },
  {
    value: "sleep-recovery",
    title: "Sleep & Recovery",
    description: "Improve rest & recharge",
    emoji: "😴",
  },
  {
    value: "build-confidence-self-trust",
    title: "Confidence & Self Esteem",
    description: "Build confidence & self trust",
    emoji: "💪",
  },
  {
    value: "strengthen-relationships",
    title: "Relationships",
    description: "Strengthen connections & boundaries",
    emoji: "❤️",
  },
  {
    value: "navigate-life-changes",
    title: "Life Transitions",
    description: "Navigate changes with clarity",
    emoji: "🧭",
  },
  {
    value: "work-life-balance",
    title: "Work & Purpose",
    description: "Find balance & meaning",
    emoji: "💼",
  },
  {
    value: "personal-goal-life-direction",
    title: "Growth & Learning",
    description: "Grow skills & inner potential",
    emoji: "🌱",
  },
  {
    value: "time-management-productivity",
    title: "Productivity",
    description: "Manage time & stay focused",
    emoji: "⏱️",
  },
  {
    value: "financial-wellness",
    title: "Financial Wellness",
    description: "Reduce stress & build financial confidence",
    emoji: "💰",
  },
  {
    value: "health-fitness-body-goals",
    title: "Health & Body",
    description: "Build healthy habits & feel your best",
    emoji: "🏃",
  },
  {
    value: "faith-purpose-inner-grounding",
    title: "Spiritual Growth",
    description: "Find purpose & inner grounding",
    emoji: "🙏",
  },
] as const;

export type WellnessGoalValue = (typeof WELLNESS_GOALS)[number]["value"];

export const WELLNESS_GOAL_VALUES = WELLNESS_GOALS.map((goal) => goal.value);

export const wellnessGoalProfileOptions = WELLNESS_GOALS.map(({ value, title, emoji }) => ({
  value,
  label: title,
  emoji,
}));

/** Labels for goals saved before the 12-category sync (display-only fallback). */
export const LEGACY_WELLNESS_GOAL_LABELS: Record<string, string> = {
  "career-growth-advancement": "Career Growth & Advancement",
  "business-entrepreneurship": "Business & Entrepreneurship",
  "daily-habits-discipline": "Daily Habits & Discipline",
  "mindfulness-presence": "Mindfulness & Presence",
};

export function getWellnessGoalLabel(value: string): string {
  const goal = WELLNESS_GOALS.find((item) => item.value === value);
  if (goal) return goal.title;
  if (LEGACY_WELLNESS_GOAL_LABELS[value]) return LEGACY_WELLNESS_GOAL_LABELS[value];
  return value.replace(/-/g, " ");
}
