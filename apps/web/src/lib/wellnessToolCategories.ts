/**
 * Canonical wellness categories (tools, content CMS, and user-facing UI).
 * Keep in sync with `apps/api/src/modules/wellness/wellness.schema.ts` → WELLNESS_TOOL_CATEGORIES.
 */
export const WELLNESS_TOOL_CATEGORIES = [
  "Anxiety Management",
  "Stress Management",
  "Meditation",
  "Sleep Health",
  "Exercise",
  "Self-Care",
  "Relaxation",
  "Depression Support",
  "Mindfulness",
] as const;

export type WellnessToolCategory = (typeof WELLNESS_TOOL_CATEGORIES)[number];

export const WELLNESS_CATEGORY_GRADIENT: Record<WellnessToolCategory, string> = {
  "Anxiety Management": "from-rose-400 to-red-500",
  "Stress Management": "from-orange-400 to-amber-500",
  Meditation: "from-purple-400 to-pink-500",
  "Sleep Health": "from-indigo-400 to-violet-500",
  Exercise: "from-green-400 to-emerald-500",
  "Self-Care": "from-amber-400 to-orange-500",
  Relaxation: "from-cyan-400 to-blue-500",
  "Depression Support": "from-sky-500 to-blue-600",
  Mindfulness: "from-teal-400 to-cyan-500",
};

export function isWellnessToolCategory(value: string): value is WellnessToolCategory {
  return (WELLNESS_TOOL_CATEGORIES as readonly string[]).includes(value);
}
