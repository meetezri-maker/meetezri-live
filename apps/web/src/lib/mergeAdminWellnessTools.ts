import {
  WELLNESS_TOOL_CATEGORIES,
  type WellnessToolCategory,
} from "./wellnessToolCategories";

/** IDs generated for categories with no API tool yet — not persisted. */
export const WELLNESS_PLACEHOLDER_ID_PREFIX = "wellness-placeholder:";

export function isWellnessPlaceholderId(id: string): boolean {
  return id.startsWith(WELLNESS_PLACEHOLDER_ID_PREFIX);
}

/** Tailwind gradient token → approximate icon tint for CMS cards */
export const CATEGORY_ICON_HEX: Record<WellnessToolCategory, string> = {
  "Anxiety Management": "#e11d48",
  "Stress Management": "#ea580c",
  Meditation: "#a855f7",
  "Sleep Health": "#6366f1",
  Exercise: "#16a34a",
  "Self-Care": "#d97706",
  Relaxation: "#0891b2",
  "Depression Support": "#0284c7",
  Mindfulness: "#0d9488",
};

/** Lucide icon name used with admin `iconMap` */
export const CATEGORY_ICON_NAME: Record<WellnessToolCategory, string> = {
  "Anxiety Management": "Heart",
  "Stress Management": "Wind",
  Meditation: "Brain",
  "Sleep Health": "Moon",
  Exercise: "Activity",
  "Self-Care": "Sparkles",
  Relaxation: "Music",
  "Depression Support": "HeartPulse",
  Mindfulness: "Leaf",
};

function categorySlug(cat: string) {
  return cat.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Ensures each canonical category has at least one row: API tools when present,
 * otherwise a single placeholder row for that category.
 */
export function mergeWellnessToolsForAdminDisplay<
  T extends {
    id: string;
    category: string;
  }
>(mappedApiTools: T[], buildPlaceholder: (category: WellnessToolCategory) => T): T[] {
  const byCategory = new Map<string, T[]>();
  for (const t of mappedApiTools) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  const out: T[] = [];
  for (const cat of WELLNESS_TOOL_CATEGORIES) {
    const list = byCategory.get(cat);
    if (list && list.length > 0) {
      out.push(...list);
    } else {
      out.push(buildPlaceholder(cat));
    }
  }

  const seen = new Set(out.map((t) => t.id));
  for (const t of mappedApiTools) {
    if (!seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  return out;
}

export function placeholderWellnessToolId(category: WellnessToolCategory): string {
  return `${WELLNESS_PLACEHOLDER_ID_PREFIX}${categorySlug(category)}`;
}

type BuiltinMergeLabel = { title: string } | { name: string };

function labelForBuiltinMerge(t: BuiltinMergeLabel): string {
  if ("title" in t && typeof t.title === "string") return t.title;
  if ("name" in t && typeof t.name === "string") return t.name;
  return "";
}

/**
 * API rows merged with built-in rows. When a published API tool matches a built-in’s
 * title and category, the API row wins so CMS / DB edits are visible (same rule as user app).
 */
export function mergeApiBuiltinsForAdmin<T extends BuiltinMergeLabel & { category: string }>(
  builtins: T[],
  apiItems: T[]
): T[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const rowKey = (t: T) => `${norm(labelForBuiltinMerge(t))}|${norm(t.category)}`;
  const overridden = new Set(apiItems.map(rowKey));
  const builtinsKept = builtins.filter((b) => !overridden.has(rowKey(b)));
  return [...builtinsKept, ...apiItems];
}
