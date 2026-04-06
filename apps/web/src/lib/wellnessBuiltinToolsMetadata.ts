/**
 * Built-in wellness tools shipped in the app (same catalog as `WellnessTools.tsx`).
 * Admin UIs merge these with API/CMS tools so the library is never empty.
 */
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
    duration: "5 min",
    description:
      "Name five things you see, four you feel, three you hear, two you smell, one you taste",
  },
  {
    id: "stress-release-waves",
    category: "Stress Management",
    title: "Tension Release Scan",
    duration: "8 min",
    description: "Notice and soften stress in the body with slow breathing",
  },
  {
    id: "body-scan",
    category: "Meditation",
    title: "Body Scan Meditation",
    duration: "10 min",
    description: "Progressive relaxation from head to toe",
  },
  {
    id: "sleep-meditation",
    category: "Sleep Health",
    title: "Sleep Meditation",
    duration: "20 min",
    description: "Wind down and prepare for restful sleep",
  },
  {
    id: "gentle-movement",
    category: "Exercise",
    title: "Gentle Movement",
    duration: "10 min",
    description: "Light stretches and mobility to reconnect with your body",
  },
  {
    id: "gratitude",
    category: "Self-Care",
    title: "Gratitude Reflection",
    duration: "5 min",
    description: "Focus on three things you're grateful for",
  },
  {
    id: "box-breathing",
    category: "Relaxation",
    title: "Box Breathing",
    duration: "5 min",
    description: "4-4-4-4 breathing pattern to reduce stress",
  },
  {
    id: "compassion-pause",
    category: "Depression Support",
    title: "Compassion Pause",
    duration: "6 min",
    description: "A short pause with kind phrases you can repeat softly",
  },
  {
    id: "mindful-anchor",
    category: "Mindfulness",
    title: "Mindful Anchor Breath",
    duration: "12 min",
    description: "Anchor attention on the breath and gentle body awareness",
  },
  {
    id: "rain-sounds",
    category: "Relaxation",
    title: "Rain & Thunder",
    duration: "∞",
    description: "Calming nature sounds for relaxation",
  },
];

export function isBuiltinWellnessListId(id: string): boolean {
  return id.startsWith("builtin:");
}
