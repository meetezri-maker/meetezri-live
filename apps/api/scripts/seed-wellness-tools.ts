/**
 * Upserts the same catalog as the app built-ins (`wellnessBuiltinToolsMetadata` / WellnessTools.tsx)
 * into `public.wellness_tools` so every exercise exists in the database.
 *
 * Stable key: `content_url` = `builtin:<id>` (e.g. `builtin:rain-sounds`).
 *
 * Run (from apps/api, DATABASE_URL must reach Postgres):
 *   pnpm run db:seed-wellness
 *
 * View rows: Supabase → Table Editor → public.wellness_tools, or Admin → Wellness Tools.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Lucide icon names — aligned with `mergeAdminWellnessTools` CATEGORY_ICON_NAME */
const CATEGORY_ICON: Record<string, string> = {
  Anxiousness: "Heart",
  "Stress Management": "Wind",
  Meditation: "Brain",
  "Sleep Health": "Moon",
  Exercise: "Activity",
  "Self-Care": "Sparkles",
  Relaxation: "Music",
  "Low morale support": "HeartPulse",
  Mindfulness: "Leaf",
};

function mmssToSeconds(mmss: string): number {
  const parts = mmss.trim().split(":");
  if (parts.length !== 2) return 0;
  const mm = Number(parts[0]);
  const ss = Number(parts[1]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss >= 60) return 0;
  return mm * 60 + ss;
}

function resolveDuration(mmss: string): { duration_minutes: number; duration_seconds: number } {
  const duration_seconds = mmssToSeconds(mmss);
  return {
    duration_seconds,
    duration_minutes: Math.max(1, Math.round(duration_seconds / 60)),
  };
}

/** Matches `WELLNESS_BUILTIN_TOOLS_ADMIN` + durations in `wellnessCategoryDurations` */
const BUILTIN_TOOLS: Array<{
  key: string;
  title: string;
  category: string;
  mmss: string;
  description: string;
  difficulty: string;
}> = [
  {
    key: "grounding-54321",
    title: "Grounding 5-4-3-2-1",
    category: "Anxiousness",
    mmss: "2:00",
    description:
      "Name five things you see, four you feel, three you hear, two you smell, one you taste",
    difficulty: "Beginner",
  },
  {
    key: "stress-release-waves",
    title: "Tension Release Scan",
    category: "Stress Management",
    mmss: "5:12",
    description: "Notice and soften stress in the body with slow breathing",
    difficulty: "Beginner",
  },
  {
    key: "body-scan",
    title: "Body Scan Meditation",
    category: "Meditation",
    mmss: "14:32",
    description: "Progressive relaxation from head to toe",
    difficulty: "Beginner",
  },
  {
    key: "sleep-meditation",
    title: "Sleep Meditation",
    category: "Sleep Health",
    mmss: "20:03",
    description: "Wind down and prepare for restful sleep",
    difficulty: "Beginner",
  },
  {
    key: "gentle-movement",
    title: "Gentle Movement",
    category: "Exercise",
    mmss: "10:00",
    description: "Light stretches and mobility to reconnect with your body",
    difficulty: "Beginner",
  },
  {
    key: "gratitude",
    title: "Gratitude Reflection",
    category: "Self-Care",
    mmss: "12:32",
    description: "Focus on three things you're grateful for",
    difficulty: "Beginner",
  },
  {
    key: "box-breathing",
    title: "Box Breathing",
    category: "Relaxation",
    mmss: "11:07",
    description: "4-4-4-4 breathing pattern to reduce stress",
    difficulty: "Beginner",
  },
  {
    key: "compassion-pause",
    title: "Compassion Pause",
    category: "Low morale support",
    mmss: "5:05",
    description: "A short pause with kind phrases you can repeat softly",
    difficulty: "Beginner",
  },
  {
    key: "mindful-anchor",
    title: "Mindful Anchor Breath",
    category: "Mindfulness",
    mmss: "15:29",
    description: "Anchor attention on the breath and gentle body awareness",
    difficulty: "Intermediate",
  },
  {
    key: "rain-sounds",
    title: "Rain & Thunder",
    category: "Relaxation",
    mmss: "30:00",
    description: "Calming nature sounds for relaxation",
    difficulty: "Any",
  },
];

async function main() {
  console.log("Seeding built-in wellness_tools rows...");
  for (const tool of BUILTIN_TOOLS) {
    const content_url = `builtin:${tool.key}`;
    const { duration_minutes, duration_seconds } = resolveDuration(tool.mmss);

    let existing = await prisma.wellness_tools.findFirst({
      where: { content_url },
    });
    if (!existing) {
      existing = await prisma.wellness_tools.findFirst({
        where: { title: tool.title },
      });
    }

    const data = {
      title: tool.title,
      category: tool.category,
      description: tool.description,
      content_url,
      duration_minutes,
      duration_seconds,
      difficulty: tool.difficulty,
      icon: CATEGORY_ICON[tool.category] ?? "Sparkles",
      status: "published",
      is_premium: false,
    };

    if (!existing) {
      console.log(`Creating ${tool.title} (${content_url})...`);
      await prisma.wellness_tools.create({ data });
    } else {
      console.log(`Updating ${tool.title} (${existing.id})...`);
      await prisma.wellness_tools.update({
        where: { id: existing.id },
        data,
      });
    }
  }
  console.log(`Done. ${BUILTIN_TOOLS.length} tools upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
