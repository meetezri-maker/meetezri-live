/**
 * Built-in wellness tools shipped in the app (same catalog as `WellnessTools.tsx`).
 * Admin UIs merge these with API/CMS tools so the library is never empty.
 */
import { WELLNESS_CATEGORY_DURATION_MMSS } from "./wellnessCategoryDurations";

export type WellnessBuiltinToolMeta = {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
};

export const WELLNESS_BUILTIN_TOOLS_ADMIN: WellnessBuiltinToolMeta[] = [
  {
    id: "grounding-54321",
    category: "Anxiety Management",
    title: "Grounding 5-4-3-2-1",
    duration: WELLNESS_CATEGORY_DURATION_MMSS["Anxiety Management"],
    description:
      "Name five things you see, four you feel, three you hear, two you smell, one you taste",
  },
  {
    id: "stress-release-waves",
    category: "Stress Management",
    title: "Tension Release Scan",
    duration: WELLNESS_CATEGORY_DURATION_MMSS["Stress Management"],
    description: "Notice and soften stress in the body with slow breathing",
  },
  {
    id: "body-scan",
    category: "Meditation",
    title: "Body Scan Meditation",
    duration: WELLNESS_CATEGORY_DURATION_MMSS.Meditation,
    description: "Progressive relaxation from head to toe",
  },
  {
    id: "sleep-meditation",
    category: "Sleep Health",
    title: "Sleep Meditation",
    duration: WELLNESS_CATEGORY_DURATION_MMSS["Sleep Health"],
    description: "Wind down and prepare for restful sleep",
  },
  {
    id: "gentle-movement",
    category: "Exercise",
    title: "Gentle Movement",
    duration: WELLNESS_CATEGORY_DURATION_MMSS.Exercise,
    description: "Light stretches and mobility to reconnect with your body",
  },
  {
    id: "gratitude",
    category: "Self-Care",
    title: "Gratitude Reflection",
    duration: WELLNESS_CATEGORY_DURATION_MMSS["Self-Care"],
    description: "Focus on three things you're grateful for",
  },
  {
    id: "box-breathing",
    category: "Relaxation",
    title: "Box Breathing",
    duration: WELLNESS_CATEGORY_DURATION_MMSS.Relaxation,
    description: "4-4-4-4 breathing pattern to reduce stress",
  },
  {
    id: "compassion-pause",
    category: "Depression Support",
    title: "Compassion Pause",
    duration: WELLNESS_CATEGORY_DURATION_MMSS["Depression Support"],
    description: "A short pause with kind phrases you can repeat softly",
  },
  {
    id: "mindful-anchor",
    category: "Mindfulness",
    title: "Mindful Anchor Breath",
    duration: WELLNESS_CATEGORY_DURATION_MMSS.Mindfulness,
    description: "Anchor attention on the breath and gentle body awareness",
  },
  {
    id: "rain-sounds",
    category: "Relaxation",
    title: "Rain & Thunder",
    duration: "30:00",
    description: "Calming nature sounds for relaxation",
  },
];

export function isBuiltinWellnessListId(id: string): boolean {
  return id.startsWith("builtin:");
}
