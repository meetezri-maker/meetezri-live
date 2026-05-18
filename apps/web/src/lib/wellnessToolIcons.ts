/**
 * Lucide icons for wellness tools (user app + API `tool.icon` string).
 * Keep names in sync with options in `WellnessToolEditor` where possible.
 */
import {
  Activity,
  Brain,
  CloudRain,
  HandHelping,
  Heart,
  HeartPulse,
  Leaf,
  Moon,
  Music,
  Shield,
  Smile,
  Sparkles,
  Sun,
  Target,
  Timer,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const WELLNESS_TOOL_ICON_MAP: Record<string, LucideIcon> = {
  Wind,
  Brain,
  Moon,
  Sun,
  Heart,
  Zap,
  Target,
  Sparkles,
  Music,
  Smile,
  Activity,
  Leaf,
  HeartPulse,
  Shield,
  Waves,
  CloudRain,
  HandHelping,
  Timer,
};

export function getWellnessToolLucideIcon(iconName: string | undefined): LucideIcon {
  if (!iconName) return Sparkles;
  return WELLNESS_TOOL_ICON_MAP[iconName] ?? Sparkles;
}
