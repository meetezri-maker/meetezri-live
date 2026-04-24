import {
  Flame,
  Heart,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type WellnessChallengeDashboardPayload = {
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  levelProgressPercent: number;
  challenges: Array<{
    id: string;
    title: string;
    description: string;
    progress: number;
    target: number;
    reward: number;
    difficulty: string;
    isCompleted: boolean;
    isLocked: boolean;
    category?: string | null;
  }>;
};

export interface WellnessChallengeRow {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  difficulty: "Easy" | "Medium" | "Hard";
  icon: LucideIcon;
  color: string;
  isCompleted: boolean;
  isLocked: boolean;
  categoryLabel?: string | null;
}

function getGradientForCategory(category: string | null | undefined): string {
  switch ((category || "").toLowerCase()) {
    case "mindfulness":
      return "from-purple-400 to-pink-500";
    case "exercise":
      return "from-green-400 to-emerald-500";
    case "sleep":
      return "from-indigo-400 to-blue-500";
    case "journaling":
      return "from-pink-400 to-rose-500";
    case "habits":
      return "from-orange-400 to-red-500";
    case "social":
      return "from-red-400 to-rose-500";
    default:
      return "from-blue-400 to-cyan-500";
  }
}

function pickIcon(category: string | null | undefined, title: string | null | undefined): LucideIcon {
  const t = (title ?? "").toLowerCase();
  if (t.includes("meditation")) return Star;
  if (t.includes("journal")) return Heart;
  if (t.includes("breath") || t.includes("breathing")) return Zap;
  if (t.includes("sleep")) return Star;
  if (t.includes("streak") || t.includes("check-in") || t.includes("check in") || t.includes("daily check"))
    return Flame;
  if (t.includes("warrior") || t.includes("wellness activities")) return Trophy;
  if (t.includes("perfect week")) return Target;
  switch ((category || "").toLowerCase()) {
    case "mindfulness":
      return Star;
    case "journaling":
      return Heart;
    case "habits":
      return Flame;
    case "exercise":
      return Zap;
    default:
      return Trophy;
  }
}

function normalizeDifficulty(d: string): "Easy" | "Medium" | "Hard" {
  const x = d?.toLowerCase();
  if (x === "medium") return "Medium";
  if (x === "hard") return "Hard";
  return "Easy";
}

export function mapWellnessChallengeDashboardToRows(
  data: WellnessChallengeDashboardPayload
): WellnessChallengeRow[] {
  try {
    const raw = data?.challenges;
    const list = Array.isArray(raw) ? raw : [];
    return list
      .filter((c): c is NonNullable<(typeof list)[number]> => c != null && typeof c === "object")
      .map((c, index) => ({
        id:
          String((c as { id?: unknown }).id ?? "").trim() ||
          `challenge-row-${index}`,
        title: String((c as { title?: unknown }).title ?? ""),
        description: String((c as { description?: unknown }).description ?? ""),
        progress: Math.max(0, Number((c as { progress?: unknown }).progress) || 0),
        target: Math.max(1, Number((c as { target?: unknown }).target) || 1),
        reward: Number((c as { reward?: unknown }).reward) || 0,
        difficulty: normalizeDifficulty(String((c as { difficulty?: unknown }).difficulty ?? "")),
        icon: pickIcon(
          (c as { category?: unknown }).category as string | null | undefined,
          String((c as { title?: unknown }).title ?? "")
        ),
        color: getGradientForCategory((c as { category?: unknown }).category as string | null | undefined),
        isCompleted: Boolean((c as { isCompleted?: unknown }).isCompleted),
        isLocked: Boolean((c as { isLocked?: unknown }).isLocked),
        categoryLabel: ((c as { category?: unknown }).category as string | null | undefined) ?? null,
      }));
  } catch {
    return [];
  }
}

