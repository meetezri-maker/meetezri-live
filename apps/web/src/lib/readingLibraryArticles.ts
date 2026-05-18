/**
 * Same reading library backing `/app/settings/resources` — built‑ins plus published wellness/CMS tools from the API.
 */
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { WELLNESS_BUILTIN_TOOLS_ADMIN } from "@/lib/wellnessBuiltinToolsMetadata";
import {
  WELLNESS_CATEGORY_GRADIENT,
  isWellnessToolCategory,
} from "@/lib/wellnessToolCategories";
import { WELLNESS_CATEGORY_ICONS } from "@/lib/wellnessCategoryIcons";

export interface ReadingLibraryArticle {
  id: string;
  source: "api" | "builtin";
  title: string;
  description: string;
  category: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  rating: number;
  views: number;
  isFavorite: boolean;
  tags: string[];
  contentUrl?: string | null;
}

export function categoryVisualsForReading(category: string): { gradient: string; Icon: LucideIcon } {
  if (isWellnessToolCategory(category)) {
    return {
      gradient: WELLNESS_CATEGORY_GRADIENT[category],
      Icon: WELLNESS_CATEGORY_ICONS[category],
    };
  }
  return { gradient: "from-slate-500 to-slate-700", Icon: Sparkles };
}

export async function fetchReadingLibraryArticles(): Promise<ReadingLibraryArticle[]> {
  const toolsRes = await api.wellness.getAll();
  const toolList = Array.isArray(toolsRes) ? toolsRes : [];
  const publishedTools = toolList.filter((t: { status?: string }) => !t.status || t.status === "published");

  const builtins: ReadingLibraryArticle[] = WELLNESS_BUILTIN_TOOLS_ADMIN.map((t) => ({
    id: `builtin:${t.id}`,
    source: "builtin",
    title: t.title,
    description: t.description,
    category: t.category,
    duration: t.duration,
    difficulty: "beginner",
    rating: 0,
    views: 0,
    isFavorite: false,
    tags: [t.category],
    contentUrl: null,
  }));

  const apiItems: ReadingLibraryArticle[] = publishedTools.map(
    (t: {
      id: string;
      title?: string;
      description?: string;
      category?: string;
      duration_seconds?: number;
      duration_minutes?: number;
      difficulty?: string;
      rating?: number;
      usage_count?: number;
      is_favorite?: boolean;
      content_url?: string | null;
    }) => ({
      id: t.id,
      source: "api" as const,
      title: t.title || "Untitled",
      description: t.description || "Wellness content",
      category: t.category || "General",
      duration:
        typeof t.duration_seconds === "number" && t.duration_seconds > 0
          ? `${Math.max(1, Math.round(t.duration_seconds / 60))} min read`
          : t.duration_minutes
            ? `${t.duration_minutes} min read`
            : "—",
      difficulty:
        String(t.difficulty || "Beginner").toLowerCase() === "advanced"
          ? "advanced"
          : String(t.difficulty || "Beginner").toLowerCase() === "intermediate"
            ? "intermediate"
            : "beginner",
      rating: Number(t.rating) || 0,
      views: Number(t.usage_count) || 0,
      isFavorite: Boolean(t.is_favorite),
      tags: [t.category].filter(Boolean) as string[],
      contentUrl: t.content_url || null,
    })
  );

  return [...builtins, ...apiItems];
}
