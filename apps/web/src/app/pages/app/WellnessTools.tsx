import { AppLayout } from "../../components/AppLayout";
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
  Clock,
  Star,
  Sparkles,
  Lock,
  LayoutGrid,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "../../components/ui/skeleton";
import {
  WELLNESS_TOOL_CATEGORIES,
  WELLNESS_CATEGORY_GRADIENT,
  type WellnessToolCategory,
} from "../../../lib/wellnessToolCategories";
import {
  mergeWellnessProgressWithLocal,
  loadLocalProgress,
  recordBuiltinSession,
  BUILTIN_MIN_SECONDS,
  formatWellnessDuration,
  wellnessProgressTotalSeconds,
  type WellnessProgressRow,
} from "../../../lib/wellnessLocalProgress";
import {
  getWellnessCategoryIcon,
  WELLNESS_CATEGORY_ICONS,
} from "../../../lib/wellnessCategoryIcons";
import {
  ambientKindForExerciseId,
  startWellnessAmbient,
  stopWellnessAmbient,
} from "../../../lib/wellnessAmbientAudio";

const BUILTIN_FAVORITES_KEY = "wellness-builtin-favorites";

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
      category: "Anxiety Management",
      title: "Grounding 5-4-3-2-1",
      description: "Name five things you see, four you feel, three you hear, two you smell, one you taste",
      duration: "5 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Anxiety Management"),
      color: WELLNESS_CATEGORY_GRADIENT["Anxiety Management"],
    },
    {
      id: "stress-release-waves",
      category: "Stress Management",
      title: "Tension Release Scan",
      description: "Notice and soften stress in the body with slow breathing",
      duration: "8 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Stress Management"),
      color: WELLNESS_CATEGORY_GRADIENT["Stress Management"],
    },
    {
      id: "body-scan",
      category: "Meditation",
      title: "Body Scan Meditation",
      description: "Progressive relaxation from head to toe",
      duration: "10 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Meditation"),
      color: WELLNESS_CATEGORY_GRADIENT.Meditation,
    },
    {
      id: "sleep-meditation",
      category: "Sleep Health",
      title: "Sleep Meditation",
      description: "Wind down and prepare for restful sleep",
      duration: "20 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Sleep Health"),
      color: WELLNESS_CATEGORY_GRADIENT["Sleep Health"],
    },
    {
      id: "gentle-movement",
      category: "Exercise",
      title: "Gentle Movement",
      description: "Light stretches and mobility to reconnect with your body",
      duration: "10 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Exercise"),
      color: WELLNESS_CATEGORY_GRADIENT.Exercise,
    },
    {
      id: "gratitude",
      category: "Self-Care",
      title: "Gratitude Reflection",
      description: "Focus on three things you're grateful for",
      duration: "5 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Self-Care"),
      color: WELLNESS_CATEGORY_GRADIENT["Self-Care"],
    },
    {
      id: "box-breathing",
      category: "Relaxation",
      title: "Box Breathing",
      description: "4-4-4-4 breathing pattern to reduce stress",
      duration: "5 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Relaxation"),
      color: WELLNESS_CATEGORY_GRADIENT.Relaxation,
    },
    {
      id: "compassion-pause",
      category: "Depression Support",
      title: "Compassion Pause",
      description: "A short pause with kind phrases you can repeat softly",
      duration: "6 min",
      difficulty: "Beginner",
      icon: getWellnessCategoryIcon("Depression Support"),
      color: WELLNESS_CATEGORY_GRADIENT["Depression Support"],
    },
    {
      id: "mindful-anchor",
      category: "Mindfulness",
      title: "Mindful Anchor Breath",
      description: "Anchor attention on the breath and gentle body awareness",
      duration: "12 min",
      difficulty: "Intermediate",
      icon: getWellnessCategoryIcon("Mindfulness"),
      color: WELLNESS_CATEGORY_GRADIENT.Mindfulness,
    },
    {
      id: "rain-sounds",
      category: "Relaxation",
      title: "Rain & Thunder",
      description: "Calming nature sounds for relaxation",
      duration: "∞",
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

/** Seconds for timed sessions; Infinity for open-ended tools (no auto-complete). */
function parseWellnessDurationSeconds(durationLabel: string): number {
  const d = durationLabel.trim();
  if (d === "∞" || d.toLowerCase() === "infinity") return Number.POSITIVE_INFINITY;
  const n = parseInt(d.replace(/\s*min\s*/i, "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
  return n * 60;
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

/** Built-ins first; API tools appended. Skip API rows that duplicate a built-in title (case-insensitive). */
function mergeBuiltinAndApi(
  builtins: WellnessExerciseItem[],
  apiItems: WellnessExerciseItem[]
): WellnessExerciseItem[] {
  const titles = new Set(builtins.map((b) => b.title.toLowerCase().trim()));
  const extra = apiItems.filter((t) => !titles.has(t.title.toLowerCase().trim()));
  return [...builtins, ...extra];
}

export function WellnessTools() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Wellness Tools are a Core Feature</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock the full library of wellness exercises and tools.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
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
          duration: t.duration_minutes ? `${t.duration_minutes} min` : "∞",
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

  const totalTimeSeconds = progress.reduce(
    (acc, curr) => acc + wellnessProgressTotalSeconds(curr),
    0
  );

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
    if (selectedCategoryTab !== "all") {
      base = base.filter((e) => e.category === selectedCategoryTab);
    }
    if (showOnlyFavorites) {
      base = base.filter((e) => e.favorite);
    }
    return base;
  }, [exercisesSorted, showOnlyFavorites, selectedCategoryTab]);

  const stats = [
    { 
      label: "Completed Sessions", 
      value: progress.reduce((acc, curr) => acc + curr.sessionsCompleted, 0).toString(), 
      icon: Star 
    },
    { 
      label: "Total time", 
      value: formatWellnessDuration(totalTimeSeconds), 
      icon: Clock 
    },
    { 
      label: "Exercises Tried", 
      value: progress.length.toString(), 
      icon: Heart 
    }
  ];

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
    const ambientKind = ambientKindForExerciseId(exerciseId);
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
        void api.wellness
          .getProgress()
          .then((apiProg) => {
            const arr = Array.isArray(apiProg) ? apiProg : [];
            setProgress(
              mergeWellnessProgressWithLocal(arr as WellnessProgressRow[], loadLocalProgress(user.id))
            );
          })
          .catch((err) => console.error("Failed to refresh progress after built-in session:", err));
      }
      return;
    }

    if (timeSpent > 10 && source === "api") {
      const promise = sessionId
        ? api.wellness.completeSession(sessionId, { duration_spent: timeSpent })
        : api.wellness.trackProgress(exerciseId, { duration_spent: timeSpent });

      promise
        .then(() => api.wellness.getProgress())
        .then((apiProg) => {
          const arr = Array.isArray(apiProg) ? apiProg : [];
          setProgress(
            user?.id
              ? mergeWellnessProgressWithLocal(arr as WellnessProgressRow[], loadLocalProgress(user.id))
              : arr
          );
        })
        .catch((err) => console.error("Failed to track progress on close:", err));
    }
  };

  const activeExerciseData = exercises.find((ex) => ex.id === activeExercise);
  const ActiveExerciseIcon = activeExerciseData
    ? getWellnessCategoryIcon(activeExerciseData.category)
    : undefined;

  useEffect(() => {
    if (!isPlaying || !activeExerciseData) return;

    const durationSec = parseWellnessDurationSeconds(activeExerciseData.duration);

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
                  return api.wellness.getProgress();
                })
                .then((apiProg) => {
                  const arr = Array.isArray(apiProg) ? apiProg : [];
                  setProgress(
                    user?.id
                      ? mergeWellnessProgressWithLocal(arr as WellnessProgressRow[], loadLocalProgress(user.id))
                      : arr
                  );
                })
                .catch((err) => console.error("Failed to track progress:", err));
            } else {
              setCurrentSessionId(null);
              if (activeExercise && user?.id && activeExerciseSourceRef.current === "builtin") {
                recordBuiltinSession(user.id, activeExercise, activeExerciseData.title, durationSec);
                void api.wellness
                  .getProgress()
                  .then((apiProg) => {
                    const arr = Array.isArray(apiProg) ? apiProg : [];
                    setProgress(
                      mergeWellnessProgressWithLocal(arr as WellnessProgressRow[], loadLocalProgress(user.id))
                    );
                  })
                  .catch((err) => console.error("Failed to refresh progress after built-in timer:", err));
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
      const ambientKind = activeExercise ? ambientKindForExerciseId(activeExercise) : null;
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
    const kind = activeExercise ? ambientKindForExerciseId(activeExercise) : null;
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
  }, [isPlaying, activeExercise, sessionTimeComplete]);

  const nearEndNudge = useMemo(() => {
    if (!activeExerciseData || !isPlaying || sessionTimeComplete) return false;
    const total = parseWellnessDurationSeconds(activeExerciseData.duration);
    if (!Number.isFinite(total)) return false;
    const remaining = total - timer;
    return remaining > 0 && remaining <= 60;
  }, [activeExerciseData, isPlaying, sessionTimeComplete, timer]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4 text-center">
                <Skeleton className="w-6 h-6 rounded-full mx-auto mb-2" />
                <Skeleton className="h-5 w-16 mx-auto mb-1" />
                <Skeleton className="h-3 w-24 mx-auto" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Wellness Tools</h1>
          </div>
          <p className="text-muted-foreground">
            Guided exercises to support your mental wellbeing
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className="p-4 text-center shadow-lg">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Progress Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold">Detailed Progress</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
             {isLoading ? (
               <p className="text-gray-500 text-center py-4">Loading progress...</p>
             ) : progress.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No exercises completed yet. Start one today!</p>
             ) : (
                <div className="space-y-4">
                  {progress.map((p) => (
                    <div key={p.toolId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                           <Star className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.toolTitle}</p>
                          <p className="text-sm text-gray-500">{p.sessionsCompleted} sessions completed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatWellnessDuration(wellnessProgressTotalSeconds(p))}
                        </p>
                        <p className="text-xs text-gray-500">Total time</p>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </motion.div>

        {/* Category tabs: filter exercises below (each category has a unique icon in wellnessCategoryIcons) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedCategoryTab("all");
                setShowOnlyFavorites(false);
              }}
              className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 p-4 text-center text-white shadow-lg sm:min-h-[120px] sm:p-5 ${
                selectedCategoryTab === "all" ? "ring-4 ring-white/90 ring-offset-2 ring-offset-slate-100" : ""
              }`}
            >
              <LayoutGrid className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" aria-hidden />
              <span className="text-xs font-bold leading-tight sm:text-sm">All</span>
            </motion.button>
            {WELLNESS_TOOL_CATEGORIES.map((cat, index) => {
              const Icon = WELLNESS_CATEGORY_ICONS[cat];
              const active = selectedCategoryTab === cat;
              return (
                <motion.button
                  key={cat}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.03 }}
                  whileHover={{ scale: 1.03, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedCategoryTab(cat);
                    setShowOnlyFavorites(false);
                  }}
                  className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${WELLNESS_CATEGORY_GRADIENT[cat]} p-4 text-center text-white shadow-lg sm:min-h-[120px] sm:p-5 ${
                    active ? "ring-4 ring-white/90 ring-offset-2 ring-offset-slate-100" : ""
                  }`}
                >
                  <Icon className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" aria-hidden />
                  <span className="text-xs font-bold leading-tight sm:text-sm">{cat}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Single exercises grid (same card layout for every tool) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              {showOnlyFavorites
                ? `Favorite exercises (${favoriteCount})`
                : selectedCategoryTab === "all"
                  ? "Wellness Tools"
                  : selectedCategoryTab}
            </h2>
            <button 
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              {showOnlyFavorites ? (
                <>
                  <X className="w-4 h-4" />
                  Show All
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  View Favorites ({favoriteCount})
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {displayExercises.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">
                {showOnlyFavorites
                  ? "No favorites yet. Tap the heart on an exercise to save it here."
                  : selectedCategoryTab !== "all"
                    ? `No exercises in this category yet.`
                    : "No exercises available."}
              </p>
            ) : (
            displayExercises.map((exercise, index) => {
              const Icon = getWellnessCategoryIcon(exercise.category);
              return (
                <motion.div
                  id={`wellness-exercise-card-${exercise.id}`}
                  key={exercise.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.04 }}
                  whileHover={{ y: -5 }}
                  className="scroll-mt-28 h-full"
                >
                  <Card className="p-4 shadow-lg hover:shadow-xl transition-all group cursor-pointer border border-slate-100 h-full min-h-[240px] flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <motion.div
                          whileHover={{ rotate: 10, scale: 1.1 }}
                          className={`p-3 rounded-xl bg-gradient-to-br ${exercise.color} text-white shrink-0`}
                        >
                          <Icon className="w-6 h-6" />
                        </motion.div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            {exercise.category}
                          </p>
                          <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors">
                            {exercise.title}
                          </h3>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleToggleFavorite(exercise.id, e)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors z-10 shrink-0"
                      >
                        <Heart className={`w-5 h-5 ${exercise.favorite ? "text-red-500 fill-red-500" : "text-gray-300"}`} />
                      </motion.button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2 min-h-[2.75rem] flex-1">
                      {exercise.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 mt-auto">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {exercise.duration}
                      </div>
                      <div className="px-2 py-1 bg-gray-100 rounded-full">
                        {exercise.difficulty}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setGuidedExercise(exercise.id)}
                        variant="outline"
                        className="flex-1 group/ezri border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                        size="sm"
                      >
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600 group-hover/ezri:scale-110 transition-transform" />
                        <span className="text-purple-700 font-medium">Ezri</span>
                      </Button>
                      <Button
                        onClick={() => handleStartExercise(exercise.id)}
                        className="flex-1 group/btn"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                        Start
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })
            )}
          </div>
        </motion.div>

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
                  {/* Decorative glows — behind all copy (z-0); scaled breathing uses z-10 so it stays under text rows */}
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
    </AppLayout>
  );
}
