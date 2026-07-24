import {
  Footprints,
  Target,
  Heart,
  BookOpen,
  Zap,
  Moon,
  Trophy,
  Users,
  Award,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a backend-provided achievement icon name to a lucide icon. Mirrors the
 * icon keys used elsewhere in the app; unknown names fall back to a trophy so a
 * new backend icon can never crash the report.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  footprints: Footprints,
  target: Target,
  heart: Heart,
  book: BookOpen,
  zap: Zap,
  moon: Moon,
  trophy: Trophy,
  users: Users,
  award: Award,
};

export function ProgressReportIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = (name && ICON_MAP[name]) || Trophy;
  return <Icon className={className} aria-hidden />;
}
