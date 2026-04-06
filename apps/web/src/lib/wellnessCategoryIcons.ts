/**
 * Exactly one Lucide icon per wellness category — do not reuse a category’s icon for another category.
 * Used for category tabs, exercise cards, player, and guided mode on the user app.
 */
import {
  Activity,
  Brain,
  Heart,
  HeartPulse,
  Leaf,
  Moon,
  Music,
  Sparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  isWellnessToolCategory,
  type WellnessToolCategory,
} from "./wellnessToolCategories";

export const WELLNESS_CATEGORY_ICONS: Record<WellnessToolCategory, LucideIcon> = {
  "Anxiety Management": Heart,
  "Stress Management": Wind,
  Meditation: Brain,
  "Sleep Health": Moon,
  Exercise: Activity,
  "Self-Care": Sparkles,
  Relaxation: Music,
  "Depression Support": HeartPulse,
  Mindfulness: Leaf,
};

export function getWellnessCategoryIcon(category: string): LucideIcon {
  if (isWellnessToolCategory(category)) {
    return WELLNESS_CATEGORY_ICONS[category];
  }
  return Sparkles;
}
