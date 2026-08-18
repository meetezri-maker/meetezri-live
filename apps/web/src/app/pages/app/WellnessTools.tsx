import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { EzriGuidedMode } from "../../components/modals";
import {
  Heart,
  Play,
  Pause,
  RotateCcw,
  X,
  Sparkles,
  Lock,
  CheckCircle2,
  ChevronDown,
  Brain,
  Moon,
  Crosshair,
  Flame,
  Shield,
  Smile,
  Meh,
  CloudLightning,
  Frown,
  Droplets,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SolaceSelect } from "@/app/solace";
import {
  solaceHeroContent,
  solaceHeroMediaShell,
  solaceImageCard,
} from "@/app/solace/solacePageChrome";
import { TalkItOutBottomDock } from "@/app/pages/app/talk-it-out/TalkItOutBottomDock";
import {
  WELLNESS_TOOLS_IMAGES,
  WELLNESS_TOOLS_IMAGE_POOL,
  wellnessToolsCategoryFallbackImage,
  wellnessToolsExerciseImage,
} from "@/lib/solace/wellnessToolsImages";
import {
  WELLNESS_TOOL_CATEGORIES,
  WELLNESS_CATEGORY_GRADIENT,
  type WellnessToolCategory,
} from "../../../lib/wellnessToolCategories";
import {
  mergeWellnessProgressWithLocal,
  loadLocalProgress,
  recordBuiltinSession,
  filterLocalProgressByPeriod,
  BUILTIN_MIN_SECONDS,
  formatWellnessDuration,
  wellnessProgressTotalSeconds,
  type WellnessInsightsPeriod,
  type WellnessProgressRow,
} from "../../../lib/wellnessLocalProgress";
import { getWellnessCategoryIcon } from "../../../lib/wellnessCategoryIcons";
import {
  ambientKindForExercise,
  startWellnessAmbient,
  stopWellnessAmbient,
} from "../../../lib/wellnessAmbientAudio";
import {
  formatSecondsAsMmSs,
  parseWellnessDurationLabelToSeconds,
  WELLNESS_CATEGORY_DURATION_MMSS,
} from "../../../lib/wellnessCategoryDurations";

const BUILTIN_FAVORITES_KEY = "wellness-builtin-favorites";

interface WellnessMoodBreakdown {
  positive: number;
  neutral: number;
  anxious: number;
  sad: number;
  total: number;
}

interface WellnessInsightsData {
  progress: WellnessProgressRow[];
  moodAfterExercises: WellnessMoodBreakdown;
}

const WELLNESS_INSIGHTS_PERIOD_OPTIONS: { value: WellnessInsightsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function loadBuiltinFavoriteMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(BUILTIN_FAVORITES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistBuiltinFavorite(id: string, favorite: boolean) {
  const map = loadBuiltinFavoriteMap();
  map[id] = favorite;
  localStorage.setItem(BUILTIN_FAVORITES_KEY, JSON.stringify(map));
}

type WellnessExerciseItem = {
  id: string;
  source: "builtin" | "api";
  category: string;
  title: string;
  description: string;
  duration: string;
  difficulty: string;
  icon: LucideIcon;
  color: string;
  favorite: boolean;
};

/** One built-in per canonical category (icons align with admin category accents; each tool has a distinct icon). */
function getBuiltinWellnessExercises(): WellnessExerciseItem[] {
  const favMap = loadBuiltinFavoriteMap();
  const raw: Omit<WellnessExerciseItem, "source" | "favorite">[] = [
    {
      id: "grounding-54321",
      category: "Anxiousness",
      title: "Grounding 5-4-3-2-1",
      description: "Name five things you see, four you feel, three you hear, two you smell, one you taste",
      duration: WELLNESS_CATEGORY_DURATION_MMSS["Anxiousness"],
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Anxiousness"),
      color: WELLNESS_CATEGORY_GRADIENT["Anxiousness"],
    },
    {
      id: "stress-release-waves",
      category: "Stress Management",
      title: "Tension Release Scan",
      description: "Notice and soften stress in the body with slow breathing",
      duration: WELLNESS_CATEGORY_DURATION_MMSS["Stress Management"],
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Stress Management"),
      color: WELLNESS_CATEGORY_GRADIENT["Stress Management"],
    },
    {
      id: "body-scan",
      category: "Meditation",
      title: "Body Scan Meditation",
      description: "Progressive relaxation from head to toe",
      duration: WELLNESS_CATEGORY_DURATION_MMSS.Meditation,
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Meditation"),
      color: WELLNESS_CATEGORY_GRADIENT.Meditation,
    },
    {
      id: "sleep-meditation",
      category: "Sleep Health",
      title: "Sleep Meditation",
      description: "Wind down and prepare for restful sleep",
      duration: WELLNESS_CATEGORY_DURATION_MMSS["Sleep Health"],
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Sleep Health"),
      color: WELLNESS_CATEGORY_GRADIENT["Sleep Health"],
    },
    {
      id: "gentle-movement",
      category: "Exercise",
      title: "Gentle Movement",
      description: "Light stretches and mobility to reconnect with your body",
      duration: WELLNESS_CATEGORY_DURATION_MMSS.Exercise,
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Exercise"),
      color: WELLNESS_CATEGORY_GRADIENT.Exercise,
    },
    {
      id: "gratitude",
      category: "Self-Care",
      title: "Gratitude Reflection",
      description: "Focus on three things you're grateful for",
      duration: WELLNESS_CATEGORY_DURATION_MMSS["Self-Care"],
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Self-Care"),
      color: WELLNESS_CATEGORY_GRADIENT["Self-Care"],
    },
    {
      id: "box-breathing",
      category: "Relaxation",
      title: "Box Breathing",
      description: "4-4-4-4 breathing pattern to reduce stress",
      duration: WELLNESS_CATEGORY_DURATION_MMSS.Relaxation,
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Relaxation"),
      color: WELLNESS_CATEGORY_GRADIENT.Relaxation,
    },
    {
      id: "compassion-pause",
      category: "Low morale support",
      title: "Compassion Pause",
      description: "A short pause with kind phrases you can repeat softly",
      duration: WELLNESS_CATEGORY_DURATION_MMSS["Low morale support"],
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Low morale support"),
      color: WELLNESS_CATEGORY_GRADIENT["Low morale support"],
    },
    {
      id: "mindful-anchor",
      category: "Mindfulness",
      title: "Mindful Anchor Breath",
      description: "Anchor attention on the breath and gentle body awareness",
      duration: WELLNESS_CATEGORY_DURATION_MMSS.Mindfulness,
      difficulty: "Intermediate",
      icon: getWellnessCategoryIcon("Mindfulness"),
      color: WELLNESS_CATEGORY_GRADIENT.Mindfulness,
    },
    {
      id: "rain-sounds",
      category: "Relaxation",
      title: "Rain & Thunder",
      description: "Calming nature sounds for relaxation",
      duration: "30:00",
      difficulty: "Any",
      icon: getWellnessCategoryIcon("Relaxation"),
      color: WELLNESS_CATEGORY_GRADIENT.Relaxation,
    },
  ];

  const defaultFavorite: Record<string, boolean> = {
    "grounding-54321": false,
    "stress-release-waves": false,
    "body-scan": false,
    "sleep-meditation": true,
    "gentle-movement": false,
    gratitude: false,
    "box-breathing": true,
    "compassion-pause": false,
    "mindful-anchor": false,
    "rain-sounds": true,
  };

  return raw.map((row) => ({
    ...row,
    source: "builtin" as const,
    favorite: favMap[row.id] ?? defaultFavorite[row.id] ?? false,
  }));
}

const WELLNESS_COMPLETION_MESSAGES = [
  "Great job, you've completed your wellness exercise. Take a moment to appreciate this step you've taken for yourself today.",
  "You've successfully completed your wellness exercise. Notice how you feel, and carry this sense of calm with you.",
  "Congratulations! You've completed your wellness exercise, small steps like this create meaningful change over time.",
  "Well done. You've completed your exercise, remember, taking time for yourself is always worth it.",
  "Exercise complete. You showed up for yourself today, that matters.",
];

function pickRandomCompletionMessage(): string {
  return WELLNESS_COMPLETION_MESSAGES[
    Math.floor(Math.random() * WELLNESS_COMPLETION_MESSAGES.length)
  ];
}

/**
 * Built-ins plus API tools. If an API row matches a built-in’s title and category, the API
 * row is shown (DB/CMS description) and the shipped duplicate is omitted.
 */
function mergeBuiltinAndApi(
  builtins: WellnessExerciseItem[],
  apiItems: WellnessExerciseItem[]
): WellnessExerciseItem[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const key = (t: WellnessExerciseItem) => `${norm(t.title)}|${norm(t.category)}`;
  const overridden = new Set(apiItems.map(key));
  const builtinsKept = builtins.filter((b) => !overridden.has(key(b)));
  return [...builtinsKept, ...apiItems];
}

type ExploreGroup = "mind" | "body" | "emotions" | "relax" | "sleep";

const EXPLORE_GROUP_CATEGORIES: Record<ExploreGroup, WellnessToolCategory[]> = {
  mind: ["Meditation", "Mindfulness"],
  body: ["Exercise"],
  emotions: ["Anxiousness", "Self-Care", "Low morale support"],
  relax: ["Relaxation", "Stress Management"],
  sleep: ["Sleep Health"],
};

type ExploreCardMeta = {
  title: string;
  subtitle: string;
  image: string;
  icon: LucideIcon;
  iconTint: string;
  /** Bottom-anchored cinematic color wash — keeps layout identical, varies emotional identity. */
  ambientOverlay: string;
};

const EXPLORE_CARD_META: Record<ExploreGroup, ExploreCardMeta> = {
  mind: {
    title: "Mind",
    subtitle: "Clear thoughts & focus",
    image: WELLNESS_TOOLS_IMAGES.explore.mind,
    icon: Brain,
    iconTint: "text-violet-200 shadow-[0_0_28px_rgba(167,139,250,0.55)]",
    ambientOverlay:
      "bg-gradient-to-t from-indigo-950/90 via-violet-950/35 to-transparent mix-blend-multiply",
  },
  body: {
    title: "Body",
    subtitle: "Move, breathe & energize",
    image: WELLNESS_TOOLS_IMAGES.explore.body,
    icon: Heart,
    iconTint: "text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.45)]",
    ambientOverlay:
      "bg-gradient-to-t from-amber-950/88 via-orange-900/25 to-transparent mix-blend-soft-light",
  },
  emotions: {
    title: "Emotions",
    subtitle: "Understand & manage feelings",
    image: WELLNESS_TOOLS_IMAGES.explore.emotions,
    icon: Sparkles,
    iconTint: "text-fuchsia-200 shadow-[0_0_28px_rgba(244,114,182,0.45)]",
    ambientOverlay:
      "bg-gradient-to-t from-rose-950/90 via-fuchsia-900/30 to-transparent mix-blend-multiply",
  },
  relax: {
    title: "Relax",
    subtitle: "Rest, breathe & unwind",
    image: WELLNESS_TOOLS_IMAGES.explore.relax,
    icon: Droplets,
    iconTint: "text-sky-200 shadow-[0_0_28px_rgba(56,189,248,0.45)]",
    ambientOverlay:
      "bg-gradient-to-t from-slate-950/92 via-sky-950/35 to-cyan-200/10 mix-blend-multiply",
  },
  sleep: {
    title: "Sleep",
    subtitle: "Better sleep, better you",
    image: WELLNESS_TOOLS_IMAGES.explore.sleep,
    icon: Moon,
    iconTint: "text-indigo-200 shadow-[0_0_28px_rgba(129,140,248,0.5)]",
    ambientOverlay:
      "bg-gradient-to-t from-violet-950/92 via-purple-950/40 to-fuchsia-200/12 mix-blend-multiply",
  },
};

const SUPPORT_PILLS: {
  label: string;
  category: WellnessToolCategory;
  icon: LucideIcon;
  image: string;
  glow: string;
}[] = [
  {
    label: "Calm Anxiety",
    category: "Anxiousness",
    icon: Brain,
    image: WELLNESS_TOOLS_IMAGES.support.calmAnxiety,
    glow: "shadow-[0_0_32px_rgba(167,139,250,0.35)]",
  },
  {
    label: "Sleep Better",
    category: "Sleep Health",
    icon: Moon,
    image: WELLNESS_TOOLS_IMAGES.support.sleepBetter,
    glow: "shadow-[0_0_28px_rgba(56,189,248,0.32)]",
  },
  {
    label: "Boost Focus",
    category: "Mindfulness",
    icon: Crosshair,
    image: WELLNESS_TOOLS_IMAGES.support.boostFocus,
    glow: "shadow-[0_0_28px_rgba(34,211,238,0.32)]",
  },
  {
    label: "Manage Stress",
    category: "Stress Management",
    icon: Flame,
    image: WELLNESS_TOOLS_IMAGES.support.manageStress,
    glow: "shadow-[0_0_28px_rgba(251,146,60,0.32)]",
  },
  {
    label: "Lift Your Mood",
    category: "Self-Care",
    icon: Heart,
    image: WELLNESS_TOOLS_IMAGES.support.liftMood,
    glow: "shadow-[0_0_28px_rgba(244,114,182,0.35)]",
  },
  {
    label: "Build Confidence",
    category: "Low morale support",
    icon: Shield,
    image: WELLNESS_TOOLS_IMAGES.support.buildConfidence,
    glow: "shadow-[0_0_28px_rgba(192,132,252,0.32)]",
  },
];

const WELLNESS_TOOL_CARD_FALLBACKS: readonly string[] = WELLNESS_TOOLS_IMAGE_POOL;

function exerciseCardBackdropSrc(exercise: WellnessExerciseItem): string {
  const fromId = wellnessToolsExerciseImage(exercise.id);
  if (fromId) return fromId;
  const fromCat = wellnessToolsCategoryFallbackImage(exercise.category);
  if (fromCat) return fromCat;
  const idx = Math.abs(
    [...exercise.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % WELLNESS_TOOL_CARD_FALLBACKS.length
  );
  return WELLNESS_TOOL_CARD_FALLBACKS[idx]!;
}

function practiceButtonClass(exercise: WellnessExerciseItem): string {
  const glow =
    "backdrop-blur-sm ring-1 ring-white/15 transition-[filter,box-shadow] hover:brightness-[1.04] hover:shadow-[0_0_32px_rgba(167,139,250,0.22)]";
  const cat = exercise.category as WellnessToolCategory;
  if (cat === "Sleep Health" || cat === "Relaxation" || cat === "Low morale support") {
    return `border border-sky-300/22 bg-gradient-to-r from-sky-500/82 to-indigo-600/88 text-white shadow-[0_0_22px_rgba(56,189,248,0.28),0_10px_28px_-14px_rgba(15,23,42,0.55)] hover:from-sky-400/90 hover:to-indigo-500/90 ${glow}`;
  }
  if (cat === "Stress Management") {
    return `border border-orange-300/22 bg-gradient-to-r from-orange-500/86 to-amber-600/88 text-white shadow-[0_0_22px_rgba(251,146,60,0.28),0_10px_28px_-14px_rgba(15,23,42,0.55)] hover:from-orange-400/90 hover:to-amber-500/90 ${glow}`;
  }
  if (cat === "Exercise") {
    return `border border-emerald-300/20 bg-gradient-to-r from-emerald-500/84 to-teal-600/88 text-white shadow-[0_0_22px_rgba(52,211,153,0.26),0_10px_28px_-14px_rgba(15,23,42,0.55)] hover:from-emerald-400/90 hover:to-teal-500/90 ${glow}`;
  }
  if (cat === "Self-Care" || cat === "Anxiousness") {
    return `border border-fuchsia-300/22 bg-gradient-to-r from-fuchsia-500/84 to-pink-600/86 text-white shadow-[0_0_24px_rgba(236,72,153,0.3),0_10px_28px_-14px_rgba(76,29,149,0.35)] hover:from-fuchsia-400/90 hover:to-pink-500/90 ${glow}`;
  }
  if (cat === "Mindfulness") {
    return `border border-cyan-300/20 bg-gradient-to-r from-cyan-500/82 to-teal-600/86 text-white shadow-[0_0_22px_rgba(34,211,238,0.24),0_10px_28px_-14px_rgba(15,23,42,0.55)] hover:from-cyan-400/90 hover:to-teal-500/90 ${glow}`;
  }
  return `border border-violet-300/22 bg-gradient-to-r from-violet-500/86 to-fuchsia-600/86 text-white shadow-[0_0_26px_rgba(139,92,246,0.32),0_10px_28px_-14px_rgba(236,72,153,0.14)] hover:from-violet-400/90 hover:to-fuchsia-500/90 ${glow}`;
}

export function WellnessTools() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const brainFocusMode =
    Boolean(
      profile &&
        typeof profile.brain_health_settings === "object" &&
        profile.brain_health_settings !== null &&
        (profile.brain_health_settings as { focusModeEnabled?: boolean }).focusModeEnabled === true
    );

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Wellness tools are part of Grow</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8">
              Upgrade to Grow or Thrive to unlock the full library of wellness exercises and tools.
            </p>
            <Button onClick={() => navigate('/app/billing')}>Upgrade membership</Button>
          </div>
        </div>
    );
  }

  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale" | "hold2">("inhale");
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [guidedExercise, setGuidedExercise] = useState<string | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<WellnessToolCategory | "all">("all");
  const [exploreGroup, setExploreGroup] = useState<ExploreGroup | null>(null);
  const [sortOption, setSortOption] = useState<"recommended" | "shortest" | "longest" | "az">("recommended");
  const [insightsPeriod, setInsightsPeriod] = useState<WellnessInsightsPeriod>("week");
  const [insights, setInsights] = useState<WellnessInsightsData | null>(null);
  const [exercises, setExercises] = useState<WellnessExerciseItem[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  /** Tracks whether the active exercise is built-in (no backend UUID session/progress). */
  const activeExerciseSourceRef = useRef<"builtin" | "api">("api");
  /** True after planned duration elapses (standard player); reset when starting a session. */
  const [sessionTimeComplete, setSessionTimeComplete] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(
    WELLNESS_COMPLETION_MESSAGES[0]
  );
  const timedSessionEndFiredRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toolsRes, progressRes] = await Promise.all([
          api.wellness.getAll(),
          api.wellness.getProgress(),
        ]);

        const list = Array.isArray(toolsRes) ? toolsRes : [];
        const publishedTools = list.filter((t: any) => !t.status || t.status === "published");

        const mappedApi: WellnessExerciseItem[] = publishedTools.map((t: any) => ({
          id: t.id,
          source: "api" as const,
          category: t.category,
          title: t.title,
          description: t.description || "",
          duration:
            typeof t.duration_seconds === "number" && t.duration_seconds > 0
              ? formatSecondsAsMmSs(t.duration_seconds)
              : t.duration_minutes
                ? `${t.duration_minutes} min`
                : "∞",
          difficulty: t.difficulty || "Beginner",
          icon: getWellnessCategoryIcon(t.category),
          color:
            WELLNESS_CATEGORY_GRADIENT[t.category as WellnessToolCategory] ||
            "from-indigo-400 to-purple-500",
          favorite: Boolean(t.is_favorite),
        }));

        const builtins = getBuiltinWellnessExercises();
        setExercises(mergeBuiltinAndApi(builtins, mappedApi));
        const apiProg = Array.isArray(progressRes) ? progressRes : [];
        setProgress(
          user?.id
            ? mergeWellnessProgressWithLocal(
                apiProg as WellnessProgressRow[],
                loadLocalProgress(user.id)
              )
            : apiProg
        );
      } catch (error) {
        console.error("Failed to fetch wellness data:", error);
        setExercises(getBuiltinWellnessExercises());
        setProgress(
          user?.id
            ? mergeWellnessProgressWithLocal([], loadLocalProgress(user.id))
            : []
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const refreshInsights = useCallback(
    async (period: WellnessInsightsPeriod = insightsPeriod) => {
      if (!user?.id) {
        setInsights(null);
        return;
      }
      try {
        const data = (await api.wellness.getInsights(period)) as WellnessInsightsData;
        setInsights(data);
      } catch (error) {
        console.error("Failed to fetch wellness insights:", error);
      }
    },
    [user?.id, insightsPeriod]
  );

  useEffect(() => {
    void refreshInsights();
  }, [refreshInsights]);

  const refreshProgressSnapshot = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [apiProg, insightsRes] = await Promise.all([
        api.wellness.getProgress(),
        api.wellness.getInsights(insightsPeriod),
      ]);
      const arr = Array.isArray(apiProg) ? apiProg : [];
      setProgress(mergeWellnessProgressWithLocal(arr as WellnessProgressRow[], loadLocalProgress(user.id)));
      setInsights(insightsRes as WellnessInsightsData);
    } catch (error) {
      console.error("Failed to refresh wellness progress:", error);
    }
  }, [user?.id, insightsPeriod]);

  const periodProgress = useMemo(() => {
    const apiRows = insights?.progress ?? [];
    if (!user?.id) return apiRows;
    const localRows = filterLocalProgressByPeriod(loadLocalProgress(user.id), insightsPeriod);
    return mergeWellnessProgressWithLocal(apiRows, localRows);
  }, [insights, user?.id, insightsPeriod]);

  const totalTimeSeconds = periodProgress.reduce(
    (acc, curr) => acc + wellnessProgressTotalSeconds(curr),
    0
  );

  const completedSessionsTotal = useMemo(
    () => periodProgress.reduce((acc, curr) => acc + (curr.sessionsCompleted ?? 0), 0),
    [periodProgress]
  );

  const moodAfterDisplay = useMemo(() => {
    const m = insights?.moodAfterExercises;
    const buckets = [
      {
        key: "positive" as const,
        label: "Positive",
        icon: Smile,
        tone: "text-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.35)]",
      },
      {
        key: "neutral" as const,
        label: "Neutral",
        icon: Meh,
        tone: "text-sky-300 shadow-[0_0_22px_rgba(56,189,248,0.3)]",
      },
      {
        key: "anxious" as const,
        label: "Anxious",
        icon: CloudLightning,
        tone: "text-violet-300 shadow-[0_0_22px_rgba(167,139,250,0.35)]",
      },
      {
        key: "sad" as const,
        label: "Sad",
        icon: Frown,
        tone: "text-rose-300 shadow-[0_0_22px_rgba(251,113,133,0.3)]",
      },
    ];
    if (!m || m.total === 0) {
      return buckets.map((b) => ({ ...b, pct: "0%" }));
    }
    return buckets.map((b) => ({
      ...b,
      pct: `${Math.round((m[b.key] / m.total) * 100)}%`,
    }));
  }, [insights]);

  const streakDotsActive = useMemo(() => {
    if (completedSessionsTotal <= 0) return 0;
    return Math.min(7, Math.max(1, Math.ceil(completedSessionsTotal / 2)));
  }, [completedSessionsTotal]);

  /** Single list: canonical category order, then title (no duplicate “spotlight” section). */
  const exercisesSorted = useMemo(() => {
    const rank = new Map(WELLNESS_TOOL_CATEGORIES.map((c, i) => [c, i]));
    return [...exercises].sort((a, b) => {
      const ra = rank.get(a.category as WellnessToolCategory) ?? 99;
      const rb = rank.get(b.category as WellnessToolCategory) ?? 99;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });
  }, [exercises]);

  const displayExercises = useMemo(() => {
    let base = exercisesSorted;
    if (exploreGroup) {
      const allow = new Set(EXPLORE_GROUP_CATEGORIES[exploreGroup]);
      base = base.filter((e) => allow.has(e.category as WellnessToolCategory));
    }
    if (selectedCategoryTab !== "all") {
      base = base.filter((e) => e.category === selectedCategoryTab);
    }
    if (showOnlyFavorites) {
      base = base.filter((e) => e.favorite);
    }
    const list = [...base];
    if (sortOption === "az") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === "shortest") {
      list.sort(
        (a, b) =>
          parseWellnessDurationLabelToSeconds(a.duration) -
          parseWellnessDurationLabelToSeconds(b.duration)
      );
    } else if (sortOption === "longest") {
      list.sort(
        (a, b) =>
          parseWellnessDurationLabelToSeconds(b.duration) -
          parseWellnessDurationLabelToSeconds(a.duration)
      );
    }
    return list;
  }, [exercisesSorted, exploreGroup, showOnlyFavorites, selectedCategoryTab, sortOption]);

  const handleStartExercise = async (exerciseId: string) => {
    setSessionTimeComplete(false);
    setCompletionMessage(WELLNESS_COMPLETION_MESSAGES[0]);
    timedSessionEndFiredRef.current = false;
    setActiveExercise(exerciseId);
    setIsPlaying(true);
    setTimer(0);
    setBreathPhase("inhale");
    setPhaseTimer(0);

    const ex = exercises.find((x) => x.id === exerciseId);
    activeExerciseSourceRef.current = ex?.source === "builtin" ? "builtin" : "api";
    const ambientKind = ambientKindForExercise(ex);
    if (ambientKind) {
      // Run from direct user gesture to avoid autoplay blocks.
      void startWellnessAmbient(ambientKind).catch((err) =>
        console.error("Failed to start exercise ambient audio:", err)
      );
    }
    if (ex?.source === "builtin") {
      setCurrentSessionId(null);
      return;
    }

    try {
      const session = await api.wellness.startSession(exerciseId);
      if (session && session.id) {
        setCurrentSessionId(session.id);
      }
    } catch (error) {
      console.error("Failed to start wellness session:", error);
    }
  };

  const handleToggleFavorite = async (exerciseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ex = exercises.find((x) => x.id === exerciseId);
    if (ex?.source === "builtin") {
      const next = !ex.favorite;
      persistBuiltinFavorite(exerciseId, next);
      setExercises((prev) =>
        prev.map((item) => (item.id === exerciseId ? { ...item, favorite: next } : item))
      );
      return;
    }
    try {
      await api.wellness.toggleFavorite(exerciseId);
      setExercises((prev) =>
        prev.map((item) =>
          item.id === exerciseId ? { ...item, favorite: !item.favorite } : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle wellness favorite:", error);
    }
  };

  const handleCloseExercise = () => {
    const exerciseId = activeExercise;
    const timeSpent = timer;
    const sessionId = currentSessionId;
    const source = activeExerciseSourceRef.current;

    setActiveExercise(null);
    setIsPlaying(false);
    setSessionTimeComplete(false);
    setCompletionMessage(WELLNESS_COMPLETION_MESSAGES[0]);
    timedSessionEndFiredRef.current = false;
    setTimer(0);
    setBreathPhase("inhale");
    setPhaseTimer(0);
    setCurrentSessionId(null);
    activeExerciseSourceRef.current = "api";

    if (!exerciseId) return;

    stopWellnessAmbient();

    // Built-in tools have no API tool id — persist progress locally and merge into the dashboard.
    if (source === "builtin" && user?.id && timeSpent >= BUILTIN_MIN_SECONDS) {
      const ex = exercises.find((x) => x.id === exerciseId);
      if (ex) {
        recordBuiltinSession(user.id, exerciseId, ex.title, timeSpent);
        void refreshProgressSnapshot().catch((err) =>
          console.error("Failed to refresh progress after built-in session:", err)
        );
      }
      return;
    }

    if (timeSpent > 10 && source === "api") {
      const promise = sessionId
        ? api.wellness.completeSession(sessionId, { duration_spent: timeSpent })
        : api.wellness.trackProgress(exerciseId, { duration_spent: timeSpent });

      promise
        .then(() => refreshProgressSnapshot())
        .catch((err) => console.error("Failed to track progress on close:", err));
    }
  };

  const activeExerciseData = exercises.find((ex) => ex.id === activeExercise);
  const ActiveExerciseIcon = activeExerciseData
    ? getWellnessCategoryIcon(activeExerciseData.category)
    : undefined;

  useEffect(() => {
    if (!isPlaying || !activeExerciseData) return;

    const durationSec = parseWellnessDurationLabelToSeconds(activeExerciseData.duration);

    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (Number.isFinite(durationSec) && prevTimer >= durationSec) {
          return prevTimer;
        }

        const next = prevTimer + 1;

        if (Number.isFinite(durationSec) && next >= durationSec && !timedSessionEndFiredRef.current) {
          timedSessionEndFiredRef.current = true;
          queueMicrotask(() => {
            setSessionTimeComplete(true);
            setCompletionMessage(pickRandomCompletionMessage());
            setIsPlaying(false);
            setBreathPhase("inhale");
            setPhaseTimer(0);
            toast.success("Time's up", {
              description: `You've reached the end of your ${activeExerciseData.title} session.`,
            });

            if (activeExercise && activeExerciseSourceRef.current === "api") {
              const promise = currentSessionId
                ? api.wellness.completeSession(currentSessionId, { duration_spent: durationSec })
                : api.wellness.trackProgress(activeExercise, { duration_spent: durationSec });

              promise
                .then(() => {
                  setCurrentSessionId(null);
                  return refreshProgressSnapshot();
                })
                .catch((err) => console.error("Failed to track progress:", err));
            } else {
              setCurrentSessionId(null);
              if (activeExercise && user?.id && activeExerciseSourceRef.current === "builtin") {
                recordBuiltinSession(user.id, activeExercise, activeExerciseData.title, durationSec);
                void refreshProgressSnapshot().catch((err) =>
                  console.error("Failed to refresh progress after built-in timer:", err)
                );
              }
            }
          });
          return durationSec;
        }

        return next;
      });

      setPhaseTimer((prevPhaseTimer) => prevPhaseTimer + 1);

      if (breathPhase === "inhale" && phaseTimer >= 4) {
        setBreathPhase("hold");
        setPhaseTimer(0);
      } else if (breathPhase === "hold" && phaseTimer >= 4) {
        setBreathPhase("exhale");
        setPhaseTimer(0);
      } else if (breathPhase === "exhale" && phaseTimer >= 4) {
        setBreathPhase("hold2");
        setPhaseTimer(0);
      } else if (breathPhase === "hold2" && phaseTimer >= 4) {
        setBreathPhase("inhale");
        setPhaseTimer(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isPlaying,
    activeExerciseData,
    timer,
    breathPhase,
    phaseTimer,
    activeExercise,
    currentSessionId,
    user?.id,
  ]);

  const favoriteCount = exercises.filter((ex) => ex.favorite).length;

  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      const ambientKind = ambientKindForExercise(activeExerciseData);
      if (ambientKind) {
        if (next) {
          // Play/resume from user click for reliable media start.
          void startWellnessAmbient(ambientKind).catch((err) =>
            console.error("Failed to resume ambient audio:", err)
          );
        } else {
          stopWellnessAmbient();
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const kind = ambientKindForExercise(activeExerciseData);
    if (!isPlaying || !kind || sessionTimeComplete) {
      stopWellnessAmbient();
      return;
    }
    void startWellnessAmbient(kind).catch((err) =>
      console.error("Wellness ambient audio failed:", err)
    );
    return () => {
      stopWellnessAmbient();
    };
  }, [isPlaying, activeExerciseData, sessionTimeComplete]);

  const nearEndNudge = useMemo(() => {
    if (!activeExerciseData || !isPlaying || sessionTimeComplete) return false;
    const total = parseWellnessDurationLabelToSeconds(activeExerciseData.duration);
    if (!Number.isFinite(total)) return false;
    const remaining = total - timer;
    return remaining > 0 && remaining <= 60;
  }, [activeExerciseData, isPlaying, sessionTimeComplete, timer]);

  const journeyRingPct = Math.min(
    100,
    completedSessionsTotal === 0 ? 6 : Math.min(100, 10 + completedSessionsTotal * 12)
  );
  const journeyNarrative =
    completedSessionsTotal === 0
      ? "Your journey begins with a single gentle step."
      : completedSessionsTotal === 1
        ? "Great start! You've taken 1 step towards a calmer, stronger you."
        : `Great momentum — you've completed ${completedSessionsTotal} sessions towards a calmer, stronger you.`;

  const scrollToFeatured = useCallback(() => {
    document.getElementById("wellness-featured-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const resetFiltersAndScroll = useCallback(() => {
    setExploreGroup(null);
    setSelectedCategoryTab("all");
    setShowOnlyFavorites(false);
    requestAnimationFrame(() =>
      document.getElementById("wellness-featured-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, []);

  const ringRadius = 52;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc * (1 - journeyRingPct / 100);

  if (isLoading) {
    return (
      <div className="relative overflow-x-hidden bg-[var(--solace-page-bg,var(--solace-bg))] px-8 pt-6 pb-28 text-[var(--solace-text)] lg:pb-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgba(192,132,252,0.2),transparent_52%),radial-gradient(ellipse_55%_48%_at_100%_15%,rgba(244,114,182,0.11),transparent_52%),radial-gradient(ellipse_50%_42%_at_0%_50%,rgba(139,92,246,0.1),transparent_48%),radial-gradient(ellipse_70%_45%_at_50%_100%,rgba(251,146,60,0.06),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light"
          aria-hidden
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="mx-auto w-full max-w-[1450px] space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-72 rounded-xl bg-white/[0.06]" />
            <Skeleton className="h-4 w-full max-w-md rounded-lg bg-white/[0.05]" />
          </div>
          <Skeleton className="h-[260px] w-full rounded-3xl bg-white/[0.05]" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[72px] w-[120px] shrink-0 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[180px] rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[250px] rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-x-hidden bg-[var(--solace-page-bg,var(--solace-bg))] pb-28 text-[var(--solace-text)] lg:pb-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgba(192,132,252,0.2),transparent_52%),radial-gradient(ellipse_55%_48%_at_100%_15%,rgba(244,114,182,0.11),transparent_52%),radial-gradient(ellipse_50%_42%_at_0%_50%,rgba(139,92,246,0.1),transparent_48%),radial-gradient(ellipse_70%_45%_at_50%_100%,rgba(251,146,60,0.06),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light"
          aria-hidden
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative mx-auto w-full max-w-[1450px] px-8 pt-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
              <motion.header
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/20 to-violet-600/25 shadow-[0_0_24px_rgba(236,72,153,0.3)]">
                      <Heart className="h-4 w-4 text-fuchsia-100" aria-hidden />
                    </span>
                    <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      Wellness Tools
                    </h1>
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                    Care for your mind, body and soul with guided experiences.
                  </p>
                </div>
              </motion.header>

              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 }}
                className={cn(
                  solaceHeroMediaShell,
                  "h-[260px] rounded-3xl border border-white/[0.12] shadow-[0_32px_90px_-28px_rgba(139,92,246,0.28),0_24px_64px_-32px_rgba(0,0,0,0.9)] ring-1 ring-fuchsia-500/10",
                  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
                  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
                )}
              >
                <img
                  src={WELLNESS_TOOLS_IMAGES.hero}
                  alt="Wooden deck with lanterns and candles overlooking a calm lake at dusk"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[58%_80%]"
                  loading="eager"
                  decoding="async"
                  width={1600}
                  height={520}
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0618]/68 via-[#0a0618]/32 to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06040f]/55 via-transparent to-transparent"
                  aria-hidden
                />
                <div className="relative z-10 grid h-full grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
                  <div className={cn(solaceHeroContent, "flex flex-col justify-center gap-5 px-6 py-5 sm:px-8")}>
                    <h2 className="font-serif text-[clamp(1.25rem,2.8vw,1.75rem)] font-normal leading-tight tracking-tight text-white">
                      Tools to help you{" "}
                      <span className="bg-gradient-to-r from-fuchsia-300 via-violet-200 to-indigo-200 bg-clip-text italic text-transparent">
                        feel better,
                      </span>{" "}
                      anytime.
                    </h2>
                    <p className="text-sm leading-relaxed text-zinc-200/95">
                      Whether you need a moment of calm, focus, energy, or emotional support, you&apos;ll find the
                      right space here.
                    </p>
                    <button
                      type="button"
                      onClick={scrollToFeatured}
                      className="wellness-tools-hero-cta solace-cta-gradient w-fit rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_40px_rgba(236,72,153,0.55),0_16px_48px_-12px_rgba(139,92,246,0.35)] ring-1 ring-white/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/50"
                    >
                      Find Your Tool &gt;
                    </button>
                  </div>
                  <div className="hidden lg:block" aria-hidden />
                </div>
              </motion.section>

              <section className="space-y-3" aria-labelledby="wellness-explore-heading">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2
                      id="wellness-explore-heading"
                      className="text-lg font-semibold tracking-tight text-white sm:text-xl"
                    >
                      Explore by Categories
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">Browse tools by what you want to improve.</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetFiltersAndScroll}
                    className="text-sm font-medium text-fuchsia-300/90 underline-offset-4 hover:text-fuchsia-200 hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="solace-scroll flex gap-4 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible">
                  {(Object.keys(EXPLORE_CARD_META) as ExploreGroup[]).map((group) => {
                    const meta = EXPLORE_CARD_META[group];
                    const Icon = meta.icon;
                    const active = exploreGroup === group;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => {
                          setShowOnlyFavorites(false);
                          setSelectedCategoryTab("all");
                          setExploreGroup(group);
                          scrollToFeatured();
                        }}
                        className={cn(
                          solaceImageCard,
                          "group relative flex h-[180px] w-[min(200px,78vw)] shrink-0 flex-col justify-end overflow-hidden rounded-2xl border p-5 text-left shadow-[0_18px_48px_-28px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.04] transition lg:min-w-0 lg:w-full",
                          active
                            ? "border-violet-400/50 shadow-[0_0_44px_rgba(139,92,246,0.38),0_20px_56px_-28px_rgba(236,72,153,0.15)] ring-fuchsia-400/25"
                            : "border-white/[0.1] hover:border-violet-400/35 hover:shadow-[0_0_32px_rgba(139,92,246,0.2)]"
                        )}
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
                          style={{ backgroundImage: `url(${meta.image})` }}
                          aria-hidden
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-br from-violet-950/50 via-fuchsia-950/10 to-transparent opacity-[0.78] mix-blend-multiply"
                          aria-hidden
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-[#07030f]/95 via-black/45 to-amber-200/10"
                          aria-hidden
                        />
                        <div
                          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_20%_15%,rgba(167,139,250,0.18),transparent_55%)] opacity-[0.65]"
                          aria-hidden
                        />
                        <div
                          className={cn("pointer-events-none absolute inset-0", meta.ambientOverlay)}
                          aria-hidden
                        />
                        <div className="relative flex flex-col gap-2.5 drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
                          <span
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/35 shadow-[0_0_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]",
                              meta.iconTint
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <p className="text-base font-semibold tracking-tight text-white">{meta.title}</p>
                          <p className="line-clamp-2 text-[11px] leading-snug text-zinc-200/95">{meta.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <motion.section
                id="wellness-featured-grid"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="scroll-mt-24 space-y-3"
                aria-labelledby="wellness-featured-heading"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="wellness-featured-heading"
                      className="text-lg font-semibold tracking-tight text-white sm:text-xl"
                    >
                      Featured Wellness Tools
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">Handpicked experiences to support your wellbeing.</p>
                  </div>
                  <SolaceSelect
                    value={sortOption}
                    onValueChange={(v) =>
                      setSortOption(v as "recommended" | "shortest" | "longest" | "az")
                    }
                    ariaLabel="Sort tools"
                    variant="default"
                    size="sm"
                    triggerClassName="w-full sm:w-auto"
                    options={[
                      { value: "recommended", label: "Recommended" },
                      { value: "shortest", label: "Shortest first" },
                      { value: "longest", label: "Longest first" },
                      { value: "az", label: "A–Z" },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {displayExercises.length === 0 ? (
                    <p className="col-span-full rounded-2xl border border-white/[0.08] bg-black/30 p-5 text-center text-sm text-zinc-500">
                      {showOnlyFavorites
                        ? "No favorites yet. Tap the heart on an exercise to save it here."
                        : exploreGroup
                          ? "No exercises in this space yet. Try another category or clear filters."
                          : selectedCategoryTab !== "all"
                            ? "No exercises in this category yet."
                            : "No exercises available."}
                    </p>
                  ) : (
                    displayExercises.map((exercise, index) => {
                      const Icon = getWellnessCategoryIcon(exercise.category);
                      const bg = exerciseCardBackdropSrc(exercise);
                      return (
                        <motion.div
                          id={`wellness-exercise-card-${exercise.id}`}
                          key={exercise.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.03 + index * 0.02 }}
                          whileHover={{ y: -2 }}
                          className={cn(
                            solaceImageCard,
                            "group relative h-[250px] overflow-hidden rounded-2xl border border-white/[0.12] shadow-[0_28px_72px_-30px_rgba(0,0,0,0.88),0_0_60px_-18px_rgba(139,92,246,0.32),0_0_40px_-24px_rgba(236,72,153,0.1)] ring-1 ring-fuchsia-500/10"
                          )}
                        >
                          <div
                            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
                            style={{ backgroundImage: `url(${bg})` }}
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_0%,rgba(192,132,252,0.32),transparent_60%)]"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#050816]/12 via-[22%] to-[#07030f]/92"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_100%_100%,rgba(251,146,60,0.16),transparent_58%)]"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-violet-300/12"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_38%,rgba(0,0,0,0.28)_100%)] opacity-95"
                            aria-hidden
                          />
                          <div className="relative z-10 flex h-full flex-col p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-[0_0_22px_rgba(167,139,250,0.45)] ring-1 ring-fuchsia-300/25 backdrop-blur-sm">
                                <Icon className="h-[18px] w-[18px]" aria-hidden />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-medium tabular-nums text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
                                  {exercise.duration}
                                </span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(exercise.id, e)}
                                  className="rounded-full border border-white/20 bg-black/45 p-2 text-zinc-100 shadow-[0_0_18px_rgba(236,72,153,0.15)] backdrop-blur-sm hover:bg-black/55"
                                  aria-label={exercise.favorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Heart
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      exercise.favorite ? "fill-fuchsia-400 text-fuchsia-400" : "text-zinc-200"
                                    )}
                                  />
                                </motion.button>
                              </div>
                            </div>
                            <div className="mt-auto flex min-h-0 flex-col gap-3.5">
                              <div className="space-y-1.5">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
                                  {exercise.title}
                                </h3>
                                <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-100 drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]">
                                  {exercise.description}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  onClick={() => handleStartExercise(exercise.id)}
                                  size="sm"
                                  className={cn(
                                    "h-9 min-h-0 flex-1 rounded-full px-3 text-xs font-semibold",
                                    practiceButtonClass(exercise)
                                  )}
                                >
                                  <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Start Practice
                                </Button>
                                {/* <Button
                                  type="button"
                                  onClick={() => setGuidedExercise(exercise.id)}
                                  size="sm"
                                  variant="outline"
                                  className="h-9 min-h-0 shrink-0 rounded-full border-white/20 bg-gradient-to-br from-white/[0.1] to-violet-950/40 px-2.5 text-[11px] text-violet-50/95 shadow-[0_0_20px_rgba(139,92,246,0.22)] ring-1 ring-white/15 backdrop-blur-sm hover:from-white/[0.14] hover:to-violet-900/50"
                                >
                                  <Sparkles className="h-3 w-3" aria-hidden />
                                  Solace
                                </Button> */}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={resetFiltersAndScroll}
                    className="mx-auto flex w-full max-w-[220px] items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-black/40 py-2.5 text-sm font-medium text-zinc-100 shadow-[0_0_24px_rgba(139,92,246,0.12)] transition hover:border-violet-400/28 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                  >
                    View All Tools
                    <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
                  </button>
                </div>
              </motion.section>
            </div>

            <div
              role="region"
              aria-label="Wellness insights"
              className="flex w-full shrink-0 flex-col gap-5 lg:sticky lg:top-6 lg:w-[320px] lg:self-start lg:shrink-0"
            >
              <button
                type="button"
                onClick={() => {
                  setShowOnlyFavorites(!showOnlyFavorites);
                  if (!showOnlyFavorites) {
                    setExploreGroup(null);
                    setSelectedCategoryTab("all");
                  }
                }}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-[color-mix(in_oklab,var(--solace-panel)_86%,transparent)] p-5 text-sm font-medium text-zinc-50 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.65),0_0_40px_-14px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-fuchsia-500/10 backdrop-blur-xl transition hover:border-violet-400/35 hover:shadow-[0_0_36px_rgba(236,72,153,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                aria-pressed={showOnlyFavorites}
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    showOnlyFavorites ? "fill-fuchsia-400 text-fuchsia-400" : "text-fuchsia-300/90"
                  )}
                  aria-hidden
                />
                My Favorites ({favoriteCount})
                <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300" aria-hidden />
              </button>
              <div className="rounded-2xl border border-white/[0.12] bg-[color-mix(in_oklab,var(--solace-panel)_86%,transparent)] p-5 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.62),0_0_44px_-12px_rgba(139,92,246,0.32),inset_0_1px_0_rgba(255,255,255,0.09)] ring-1 ring-fuchsia-500/10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-white">Your Wellness Journey</h3>
                  <label className="sr-only" htmlFor="wellness-journey-period">
                    Time period
                  </label>
                  <div className="relative z-30 shrink-0">
                    <SolaceSelect
                      id="wellness-journey-period"
                      value={insightsPeriod}
                      onValueChange={(v) => setInsightsPeriod(v as WellnessInsightsPeriod)}
                      ariaLabel="Time period"
                      variant="compact"
                      size="sm"
                      triggerClassName="max-w-[7.5rem] uppercase tracking-wider text-[10px] text-zinc-400"
                      contentClassName="z-[300]"
                      options={WELLNESS_INSIGHTS_PERIOD_OPTIONS}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-3 text-center">
                  <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
                      <circle
                        cx="60"
                        cy="60"
                        r={ringRadius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={ringRadius}
                        fill="none"
                        stroke="url(#wellnessRingGrad)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                        className="transition-[stroke-dashoffset] duration-700"
                      />
                      <defs>
                        <linearGradient id="wellnessRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#e879f9" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <Heart className="relative h-7 w-7 text-fuchsia-200/95 drop-shadow-[0_0_18px_rgba(236,72,153,0.45)]" aria-hidden />
                  </div>
                  <p className="text-[12px] leading-relaxed text-zinc-300">
                    {journeyNarrative}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4 text-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Completed</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                      {completedSessionsTotal}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Total Time</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                      {formatWellnessDuration(totalTimeSeconds)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Exercises</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-white">{periodProgress.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.12] bg-[color-mix(in_oklab,var(--solace-panel)_86%,transparent)] p-5 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.62),0_0_44px_-12px_rgba(236,72,153,0.14),inset_0_1px_0_rgba(255,255,255,0.09)] ring-1 ring-fuchsia-500/10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-white">Mood After Exercises</h3>
                  <div className="relative z-30 shrink-0">
                    <SolaceSelect
                      value={insightsPeriod}
                      onValueChange={(v) => setInsightsPeriod(v as WellnessInsightsPeriod)}
                      ariaLabel="Mood period"
                      variant="compact"
                      size="sm"
                      triggerClassName="max-w-[7.5rem] uppercase tracking-wider text-[10px] text-zinc-400"
                      contentClassName="z-[300]"
                      options={WELLNESS_INSIGHTS_PERIOD_OPTIONS}
                    />
                  </div>
                </div>
                <p className="sr-only">
                  Mood breakdown from session feedback and check-ins for the selected period.
                </p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {moodAfterDisplay.map((m) => {
                    const MIcon = m.icon;
                    return (
                      <div key={m.label} className="flex flex-col items-center text-center">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            m.tone
                          )}
                        >
                          <MIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <p className="mt-2 text-[11px] text-zinc-500">{m.label}</p>
                        <p className="text-sm font-semibold tabular-nums text-white">{m.pct}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.12] bg-[color-mix(in_oklab,var(--solace-panel)_86%,transparent)] p-5 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.62),0_0_44px_-12px_rgba(251,146,60,0.12),inset_0_1px_0_rgba(255,255,255,0.09)] ring-1 ring-fuchsia-500/10 backdrop-blur-xl">
                <h3 className="text-base font-semibold tracking-tight text-white">Your Streak</h3>
                {completedSessionsTotal === 0 ? (
                  <>
                    <p className="mt-2 font-serif text-2xl font-light text-white">Today</p>
                    <p className="mt-1 text-[13px] text-zinc-400">Begin your gentle streak.</p>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <Flame className="h-5 w-5 shrink-0 text-orange-400/90 drop-shadow-[0_0_12px_rgba(251,146,60,0.45)]" aria-hidden />
                      <p className="text-3xl font-light tabular-nums text-white">{streakDotsActive} days</p>
                    </div>
                    <p className="mt-1 text-[13px] text-zinc-400">Keep your streak alive!</p>
                  </>
                )}
                <div className="mt-5 flex justify-between gap-1 border-t border-white/[0.06] pt-4">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={`${d}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full border border-white/[0.06] transition",
                          i < streakDotsActive
                            ? "border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-400 to-violet-500 shadow-[0_0_14px_rgba(236,72,153,0.55)]"
                            : "bg-white/[0.06]"
                        )}
                      />
                      <span className="text-[10px] font-medium text-zinc-500">{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  solaceImageCard,
                  "relative h-[360px] overflow-hidden rounded-2xl border border-white/[0.12] shadow-[0_28px_100px_-40px_rgba(139,92,246,0.38),0_24px_64px_-36px_rgba(0,0,0,0.82)] ring-1 ring-fuchsia-500/10"
                )}
              >
                <img
                  src={WELLNESS_TOOLS_IMAGES.quote}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                  width={640}
                  height={360}
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0618]/45 via-[#0a0618]/25 to-[#080512]/72"
                  aria-hidden
                />
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-7 py-10 text-center sm:px-10">
                  <Quote className="h-10 w-10 text-violet-200/50 drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]" aria-hidden />
                  <p className="max-w-[20rem] font-serif text-[1.4rem] font-normal leading-snug tracking-tight text-white/95 sm:text-[1.65rem] sm:leading-snug [text-shadow:0_2px_24px_rgba(0,0,0,0.55),0_0_40px_rgba(139,92,246,0.2)]">
                    &ldquo;Wellness is not a destination, it&apos;s the gentle steps you take for yourself every single
                    day.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-6 w-full">
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-12 bg-[linear-gradient(180deg,transparent_0%,rgba(6,10,18,0.4)_100%)]"
              aria-hidden
            />
            <TalkItOutBottomDock
              density="compact"
              getSupportSlot={
                <Button
                  asChild
                  className="min-h-[44px] rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-6 text-[13px] text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
                >
                  <Link to="/app/emergency-resources">Get Support</Link>
                </Button>
              }
            />
          </div>

        {/* Exercise Player Modal */}
        <AnimatePresence>
          {activeExercise && activeExerciseData && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseExercise}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-x-3 top-3 bottom-3 z-50 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,430px)] sm:-translate-x-1/2 sm:-translate-y-1/2"
              >
                <Card
                  className={`relative flex h-full max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${activeExerciseData.color} p-3 text-white shadow-2xl sm:h-auto sm:max-h-none sm:p-4`}
                >
                  {sessionTimeComplete && (
                    <motion.div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="wellness-time-complete-title"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-black/55 px-6 py-10 text-center backdrop-blur-md"
                    >
                      <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-300 drop-shadow-lg" aria-hidden />
                      <h3
                        id="wellness-time-complete-title"
                        className="mb-2 text-2xl font-bold tracking-tight text-white"
                      >
                        Time&apos;s up
                      </h3>
                      <p className="mb-8 max-w-sm text-base leading-relaxed text-white/90">
                        {completionMessage}
                      </p>
                      <Button
                        type="button"
                        size="lg"
                        className="bg-white text-slate-900 hover:bg-white/95"
                        onClick={handleCloseExercise}
                      >
                        Close
                      </Button>
                    </motion.div>
                  )}
                  {/* Decorative glows — hidden in Brain Health → Focus mode */}
                  {!brainFocusMode && (
                    <>
                      <motion.div
                        aria-hidden
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="pointer-events-none absolute -top-20 -right-20 z-0 h-60 w-60 rounded-full bg-white/20 blur-3xl"
                      />
                      <motion.div
                        aria-hidden
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{ duration: 5, repeat: Infinity }}
                        className="pointer-events-none absolute -bottom-20 -left-20 z-0 h-60 w-60 rounded-full bg-white/20 blur-3xl"
                      />
                    </>
                  )}

                  <div className="relative isolate z-10 flex-1">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCloseExercise}
                      className="absolute right-0 top-0 z-50 rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>

                    <div className="relative z-40 mb-4 text-center sm:mb-5">
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="mx-auto mb-2.5 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm sm:mb-3 sm:h-20 sm:w-20"
                      >
                        {ActiveExerciseIcon ? <ActiveExerciseIcon className="h-8 w-8 sm:h-10 sm:w-10" /> : null}
                      </motion.div>
                      <h2 className="relative mb-1.5 text-[clamp(1rem,4.2vw,1.2rem)] font-bold drop-shadow-md">
                        {activeExerciseData.title}
                      </h2>
                      <p className="relative text-xs text-white/90 drop-shadow-md sm:text-sm">{activeExerciseData.description}</p>
                    </div>

                    {nearEndNudge && (
                      <motion.div
                        role="status"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative z-40 mb-3 rounded-xl border border-white/25 bg-white/15 px-2.5 py-2 text-center shadow-lg backdrop-blur-md sm:mb-4 sm:px-3 sm:py-2.5"
                      >
                        <p className="text-xs font-medium text-white sm:text-sm">
                          We hope you&apos;re enjoying this moment.
                        </p>
                        <p className="mt-0.5 text-xs text-white/90 sm:text-sm">
                          How are you feeling right now?
                        </p>
                      </motion.div>
                    )}

                    {/* Breathing rings: clipped so scale cannot paint over title or labels */}
                    <div className="relative z-0 mb-2.5 flex flex-col items-center sm:mb-3">
                      <div className="flex h-[120px] w-full max-w-[175px] items-center justify-center overflow-hidden rounded-2xl sm:h-[150px] sm:max-w-[210px]">
                        <motion.div
                          animate={{
                            scale:
                              breathPhase === "inhale" || breathPhase === "hold" ? 1.38 : 1,
                          }}
                          transition={{
                            duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                            ease: "easeInOut",
                          }}
                          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm will-change-transform sm:h-24 sm:w-24"
                          style={{ transformOrigin: "center center" }}
                        >
                          <motion.div
                            animate={{
                              scale:
                                breathPhase === "inhale" || breathPhase === "hold" ? 1.18 : 0.65,
                            }}
                            transition={{
                              duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                              ease: "easeInOut",
                            }}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/60 sm:h-16 sm:w-16"
                          >
                            <motion.div
                              animate={{
                                scale:
                                  breathPhase === "inhale" || breathPhase === "hold" ? 1 : 0.55,
                              }}
                              transition={{
                                duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                                ease: "easeInOut",
                              }}
                              className="h-8 w-8 rounded-full bg-white/80 sm:h-10 sm:w-10"
                            />
                          </motion.div>
                        </motion.div>
                      </div>

                      {/* Phase copy sits above rings in the stack — never inside the scaled layer */}
                      <motion.div
                        key={breathPhase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative z-30 mt-1.5 w-full text-center sm:mt-2"
                      >
                        <div className="mb-0.5 text-base font-bold drop-shadow-md sm:text-lg">
                          {breathPhase === "inhale" && "Breathe In"}
                          {breathPhase === "hold" && "Hold"}
                          {breathPhase === "exhale" && "Breathe Out"}
                          {breathPhase === "hold2" && "Hold"}
                        </div>
                        <div className="text-[11px] text-white/90 drop-shadow-md sm:text-xs">
                          {4 - phaseTimer} seconds
                        </div>
                      </motion.div>
                    </div>

                    {/* Timer */}
                    <div className="relative z-40 mb-2.5 text-center sm:mb-3">
                      <div className="mb-1 text-[clamp(1.65rem,7vw,2rem)] font-bold tabular-nums">
                        {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                      </div>
                      <p className="text-[11px] text-white/80 sm:text-xs">
                        {sessionTimeComplete
                          ? "Session time finished"
                          : isPlaying
                            ? "Stay focused on your breath"
                            : "Ready to begin"}
                      </p>
                    </div>

                    {/* Controls */}
                    <div
                      className={`relative z-40 flex items-center justify-center gap-2.5 pb-1 ${sessionTimeComplete ? "pointer-events-none opacity-40" : ""}`}
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTimer(0)}
                        className="rounded-full bg-white/20 p-2.5 transition-colors hover:bg-white/30 sm:p-3"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleTogglePlay}
                        className="rounded-full bg-white p-3.5 text-primary shadow-lg transition-all hover:shadow-xl sm:p-4"
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5 sm:h-6 sm:w-6" />
                        ) : (
                          <Play className="h-5 w-5 sm:h-6 sm:w-6" />
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleToggleFavorite(activeExerciseData.id, e)}
                        className="rounded-full bg-white/20 p-2.5 transition-colors hover:bg-white/30 sm:p-3"
                      >
                        <Heart className={`h-4 w-4 ${activeExerciseData.favorite ? "text-red-500 fill-red-500" : "text-white"}`} />
                      </motion.button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Ezri Guided Mode */}
      {guidedExercise && exercises.find(ex => ex.id === guidedExercise) && (
        <EzriGuidedMode
          isOpen={!!guidedExercise}
          onClose={() => setGuidedExercise(null)}
          exerciseId={guidedExercise}
          exerciseTitle={exercises.find(ex => ex.id === guidedExercise)!.title}
          exerciseDescription={exercises.find(ex => ex.id === guidedExercise)!.description}
          exerciseColor={exercises.find(ex => ex.id === guidedExercise)!.color}
          exerciseIcon={getWellnessCategoryIcon(
            exercises.find((ex) => ex.id === guidedExercise)!.category
          )}
          duration={exercises.find(ex => ex.id === guidedExercise)!.duration}
        />
      )}
    </>
  );
}
