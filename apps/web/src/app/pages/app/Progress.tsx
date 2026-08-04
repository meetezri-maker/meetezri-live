import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  TrendingUp,
  BookOpen,
  Flame,
  Star,
  Trophy,
  Download,
  Wind,
  Lock,
  Heart,
  Moon,
  Sparkles,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Quote,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useAuth } from "@/app/contexts/AuthContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "../../components/ui/utils";
import {
  formatWellnessDuration,
  wellnessProgressTotalSeconds,
} from "@/lib/wellnessLocalProgress";
import { PROGRESS_IMAGES } from "@/lib/solace/progressImages";
import { DASHBOARD_IMAGES } from "@/lib/solace/dashboardImages";
import { SolaceSelect } from "@/app/solace";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  PROGRESS_TIME_RANGE_OPTIONS,
  buildEmotionalBalanceSeries,
  buildJourneyMilestoneSeeds,
  buildRangeSparkline,
  computeAreasOfGrowth,
  computeGrowthScore,
  filterByProgressRange,
  filterMilestonesByRange,
  formatMilestoneDate,
  type MoodInsightRow,
  type ProgressTimeRange,
} from "./progress/progressInsights";

interface ProgressRangeSelectProps {
  value: ProgressTimeRange;
  onValueChange: (value: ProgressTimeRange) => void;
  ariaLabel: string;
}

function ProgressRangeSelect({ value, onValueChange, ariaLabel }: ProgressRangeSelectProps) {
  return (
    <SolaceSelect
      value={value}
      onValueChange={(v) => onValueChange(v as ProgressTimeRange)}
      options={PROGRESS_TIME_RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      ariaLabel={ariaLabel}
      variant="compact"
      size="sm"
    />
  );
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",");
}

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function CircularProgress({ value, size = 120, strokeWidth = 8, className }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Glow effect behind the ring */}
      <div 
        className="absolute rounded-full blur-xl opacity-40"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background: `conic-gradient(from 0deg, #a855f7 0%, #ec4899 ${value}%, transparent ${value}%)`,
        }}
      />
      <svg width={size} height={size} className="-rotate-90 relative">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(139, 92, 246, 0.15)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc with glow filter */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: "drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))" }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="progress-ring-value text-3xl font-bold text-white">{value}%</span>
      </div>
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}

function ProgressBar({ label, value, color, icon }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="progress-bar-label text-slate-300">{label}</span>
        </div>
        <span className="progress-bar-pct text-slate-400">{value}%</span>
      </div>
      <div className="progress-bar-track h-2 rounded-full bg-slate-800/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
          style={{ boxShadow: `0 0 12px ${color.includes('purple') ? 'rgba(168, 85, 247, 0.4)' : color.includes('pink') ? 'rgba(236, 72, 153, 0.4)' : color.includes('cyan') ? 'rgba(34, 211, 238, 0.4)' : color.includes('amber') ? 'rgba(251, 191, 36, 0.4)' : 'rgba(74, 222, 128, 0.4)'}` }}
        />
      </div>
    </div>
  );
}

interface TimelineItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  date: string;
  pill: string;
  pillColor: string;
  isLast?: boolean;
}

function TimelineItem({ icon, title, description, date, pill, pillColor, isLast }: TimelineItemProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="progress-timeline-icon w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
          {icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-gradient-to-b from-purple-500/30 to-transparent my-2" />
        )}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="progress-timeline-title font-semibold text-white mb-1">{title}</h4>
            <p className="progress-timeline-desc text-sm text-slate-400 mb-2">{description}</p>
            <p className="progress-timeline-date text-xs text-slate-500">{date}</p>
          </div>
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap",
            pillColor
          )}>
            {pill}
          </span>
        </div>
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
}

function Sparkline({ data, color, height = 40 }: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`sparkline-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#sparkline-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Progress() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [wellnessProgress, setWellnessProgress] = useState<any[]>([]);
  const [isLoadingWellness, setIsLoadingWellness] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [timelineRange, setTimelineRange] = useState<ProgressTimeRange>("this_month");
  const [growthToolsPage, setGrowthToolsPage] = useState(0);
  const [statsData, setStatsData] = useState<{
    weeklyProgress: { name: string; sessions: number; mood: number; wellness: number }[];
    wellnessScore: { subject: string; A: number; fullMark: number }[];
    monthlyActivity: { month: string; value: number }[];
  } | null>(null);
  const [moodEntries, setMoodEntries] = useState<MoodInsightRow[]>([]);
  const [journalEntries, setJournalEntries] = useState<{ created_at: string }[]>([]);
  const [sessionEntries, setSessionEntries] = useState<
    { started_at?: string; ended_at?: string | null }[]
  >([]);
  const [sleepEntries, setSleepEntries] = useState<
    { created_at: string; quality_rating?: number | null }[]
  >([]);

  const loadWellness = useCallback(() => {
    setLoadError(false);
    setIsLoadingWellness(true);
    Promise.all([
      api.wellness.getProgress(),
      api.wellness.getStats(),
      api.moods.getMyMoods().catch(() => []),
      api.journal.getAll().catch(() => []),
      api.sessions.list({ limit: 300 }).catch(() => []),
      api.sleep.getEntries().catch(() => []),
    ])
      .then(([progress, stats, moods, journals, sessions, sleep]) => {
        setWellnessProgress(Array.isArray(progress) ? progress : []);
        setStatsData(stats ?? null);
        setMoodEntries(
          (Array.isArray(moods) ? moods : []).map((m: { created_at: string; mood: string; intensity: number }) => ({
            created_at: m.created_at,
            mood: m.mood,
            intensity: Number(m.intensity) || 5,
          }))
        );
        setJournalEntries(
          (Array.isArray(journals) ? journals : []).map((j: { created_at: string }) => ({
            created_at: j.created_at,
          }))
        );
        setSessionEntries(
          (Array.isArray(sessions) ? sessions : []).map(
            (s: { started_at?: string; ended_at?: string | null }) => ({
              started_at: s.started_at,
              ended_at: s.ended_at,
            })
          )
        );
        setSleepEntries(
          (Array.isArray(sleep) ? sleep : []).map(
            (s: { created_at: string; quality_rating?: number | null }) => ({
              created_at: s.created_at,
              quality_rating: s.quality_rating,
            })
          )
        );
      })
      .catch((err) => {
        console.error("Failed to load wellness data:", err);
        setLoadError(true);
        setStatsData(null);
        setMoodEntries([]);
        setJournalEntries([]);
        setSessionEntries([]);
        setSleepEntries([]);
      })
      .finally(() => setIsLoadingWellness(false));
  }, []);

  useEffect(() => {
    loadWellness();
  }, [loadWellness]);

  const weeklyProgress = useMemo(() => {
    const w = statsData?.weeklyProgress;
    if (!Array.isArray(w) || w.length === 0) return [];
    return w.map((row: Record<string, unknown>) => ({
      name: String(row.name ?? row.week ?? ""),
      sessions: Number(row.sessions) || 0,
      mood: Number(row.mood) || 0,
      wellness: Number(row.wellness) || 0,
    }));
  }, [statsData]);

  const wellnessScore = useMemo(() => {
    const w = statsData?.wellnessScore;
    if (!Array.isArray(w) || w.length === 0) return [];
    return w.map((row: Record<string, unknown>) => ({
      subject: String(row.subject ?? ""),
      A: Math.max(0, Math.min(100, Number(row.A) || 0)),
      fullMark: Number(row.fullMark) || 100,
    }));
  }, [statsData]);

  const monthlyActivity = useMemo(() => {
    const m = statsData?.monthlyActivity;
    if (!Array.isArray(m) || m.length === 0) return [];
    return m.map((row: Record<string, unknown>) => ({
      month: String(row.month ?? ""),
      value: Number(row.value) || 0,
    }));
  }, [statsData]);

  const totalWellnessSessions = wellnessProgress.reduce(
    (acc, curr) => acc + curr.sessionsCompleted,
    0
  );

  const currentStreak = profile?.streak_days ?? 0;

  const activityInput = useMemo(
    () => ({
      moods: moodEntries,
      journals: journalEntries,
      sessions: sessionEntries,
      sleep: sleepEntries,
      wellnessCompletions: [] as { completed_at?: string }[],
    }),
    [moodEntries, journalEntries, sessionEntries, sleepEntries]
  );

  const wellnessCountInRange = useMemo(() => {
    if (timelineRange === "all") return totalWellnessSessions;
    if (weeklyProgress.length === 0) return 0;
    if (timelineRange === "this_week") {
      return weeklyProgress[weeklyProgress.length - 1]?.wellness ?? 0;
    }
    return weeklyProgress.reduce((sum, w) => sum + w.wellness, 0);
  }, [timelineRange, totalWellnessSessions, weeklyProgress]);

  const rangeTalks = useMemo(
    () =>
      filterByProgressRange(
        sessionEntries.filter((s) => s.ended_at),
        timelineRange
      ).length,
    [sessionEntries, timelineRange]
  );

  const rangeMoodCheckins = useMemo(
    () => filterByProgressRange(moodEntries, timelineRange).length,
    [moodEntries, timelineRange]
  );

  const rangeJournals = useMemo(
    () => filterByProgressRange(journalEntries, timelineRange).length,
    [journalEntries, timelineRange]
  );

  const sparklineData = useMemo(
    () => ({
      talks: buildRangeSparkline(
        sessionEntries.filter((s) => s.ended_at).map((s) => ({ started_at: s.started_at })),
        timelineRange
      ),
      mood: buildRangeSparkline(moodEntries, timelineRange),
      journal: buildRangeSparkline(journalEntries, timelineRange),
      wellness: weeklyProgress.length
        ? weeklyProgress.map((w) => w.wellness)
        : buildRangeSparkline(
            Array.from({ length: wellnessCountInRange }, (_, i) => ({
              created_at: new Date(Date.now() - i * 86400000).toISOString(),
            })),
            timelineRange
          ),
    }),
    [
      sessionEntries,
      moodEntries,
      journalEntries,
      timelineRange,
      weeklyProgress,
      wellnessCountInRange,
    ]
  );

  const emotionalBalanceData = useMemo(
    () => buildEmotionalBalanceSeries(moodEntries, timelineRange),
    [moodEntries, timelineRange]
  );

  const areasOfGrowth = useMemo(
    () => computeAreasOfGrowth(activityInput, timelineRange, new Date(), wellnessCountInRange),
    [activityInput, timelineRange, wellnessCountInRange]
  );

  const growthScore = useMemo(() => computeGrowthScore(areasOfGrowth), [areasOfGrowth]);

  const journeyMilestones = useMemo(() => {
    const seeds = buildJourneyMilestoneSeeds(
      { ...activityInput, currentStreak },
      new Date()
    );
    const filtered = filterMilestonesByRange(seeds, timelineRange);
    const iconForTone = (tone: (typeof seeds)[0]["tone"]) => {
      switch (tone) {
        case "streak":
          return <Flame className="w-4 h-4" />;
        case "reflection":
          return <BookOpen className="w-4 h-4" />;
        case "insight":
          return <Heart className="w-4 h-4" />;
        case "achievement":
          return <Trophy className="w-4 h-4" />;
        default:
          return <Star className="w-4 h-4" />;
      }
    };
    return filtered.slice(0, 5).map((seed) => ({
      icon: iconForTone(seed.tone),
      title: seed.title,
      description: seed.description,
      date: formatMilestoneDate(seed.occurredAt),
      pill: seed.pill,
      pillColor: seed.pillColor,
    }));
  }, [activityInput, currentStreak, timelineRange]);

  const handleExportReport = () => {
    try {
      const sections: string[] = [];

      sections.push("Summary");
      sections.push(
        csvLine(["Metric", "Value"]),
        csvLine(["Talks (in range)", rangeTalks]),
        csvLine(["Mood check-ins (in range)", rangeMoodCheckins]),
        csvLine(["Journal entries (in range)", rangeJournals]),
        csvLine(["Time range", timelineRange]),
        csvLine(["Wellness exercise completions (total)", totalWellnessSessions]),
        csvLine(["Current streak (days)", currentStreak]),
        ""
      );

      sections.push("Weekly progress");
      if (weeklyProgress.length > 0) {
        const keys = Object.keys(weeklyProgress[0] as object);
        sections.push(csvLine(keys));
        for (const row of weeklyProgress) {
          sections.push(csvLine(keys.map((k) => (row as Record<string, unknown>)[k])));
        }
      } else {
        sections.push("(no data)");
      }
      sections.push("");

      sections.push("Wellness score (radar)");
      if (wellnessScore.length > 0) {
        const wKeys = Object.keys(wellnessScore[0] as object);
        sections.push(csvLine(wKeys));
        for (const row of wellnessScore) {
          sections.push(csvLine(wKeys.map((k) => (row as Record<string, unknown>)[k])));
        }
      } else {
        sections.push("(no data)");
      }
      sections.push("");

      sections.push("Monthly activity");
      if (monthlyActivity.length > 0) {
        const mKeys = Object.keys(monthlyActivity[0] as object);
        sections.push(csvLine(mKeys));
        for (const row of monthlyActivity) {
          sections.push(csvLine(mKeys.map((k) => (row as Record<string, unknown>)[k])));
        }
      } else {
        sections.push("(no data)");
      }
      sections.push("");

      sections.push("Wellness tools");
      sections.push(
        csvLine(["Tool ID", "Title", "Talk it out completed", "Total time (seconds)"])
      );
      if (wellnessProgress.length === 0) {
        sections.push("(no rows)");
      } else {
        for (const p of wellnessProgress) {
          sections.push(
            csvLine([
              p.toolId,
              p.toolTitle,
              p.sessionsCompleted,
              wellnessProgressTotalSeconds(p),
            ])
          );
        }
      }

      const csv = "\uFEFF" + sections.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solace-progress-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Progress report downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export report");
    }
  };

  if (profile?.subscription_plan === "trial") {
    return (
      <div className="progress-page flex min-h-[60vh] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="progress-gate-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="progress-gate-title text-2xl font-bold text-white mb-3">
              Progress tracking is part of Grow
            </h2>
            <p className="progress-gate-lead text-slate-400 mb-8">
              Upgrade to Grow or Thrive to see your wellness journey over time. Everything you have done so far is already saved.
            </p>
            <Button
              onClick={() => navigate("/app/billing")}
              className="progress-btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >Upgrade membership</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoadingWellness) {
    return (
      <div className="progress-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <div className="progress-skeleton h-8 w-48 rounded-lg bg-slate-800/50 animate-pulse" />
            <div className="progress-skeleton h-4 w-72 rounded-lg bg-slate-800/30 animate-pulse" />
          </div>
          <div className="progress-skeleton h-10 w-32 rounded-lg bg-slate-800/50 animate-pulse hidden sm:block" />
        </div>
        <div className="progress-skeleton h-48 w-full rounded-2xl bg-slate-800/30 animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="progress-skeleton h-32 rounded-xl bg-slate-800/30 animate-pulse" />
          ))}
        </div>
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="progress-skeleton h-96 rounded-2xl bg-slate-800/30 animate-pulse" />
            <div className="progress-skeleton h-64 rounded-2xl bg-slate-800/30 animate-pulse" />
          </div>
          <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="progress-skeleton h-48 rounded-xl bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="progress-page flex min-h-[60vh] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="progress-gate-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-500/20 flex items-center justify-center">
              <Heart className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="progress-gate-title text-2xl font-bold text-white mb-3">
              Your journey is just beginning.
            </h2>
            <p className="progress-gate-lead text-slate-400 mb-8">
              We couldn't load your progress data right now. Your growth matters to us—let's try again.
            </p>
            <Button
              onClick={loadWellness}
              className="progress-btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >
              Try Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const lifetimeTalks = profile?.stats?.completed_sessions ?? 0;
  const lifetimeJournals = profile?.stats?.total_journals ?? 0;

  const tools = [
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Talk It Out",
      description: `You've opened up ${lifetimeTalks} times.`,
      cta: "Continue",
      route: "/app/session-lobby",
      color: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-cyan-400",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: "Journal",
      description: `You've written ${lifetimeJournals} entries.`,
      cta: "Write More",
      route: "/app/journal",
      color: "from-purple-500/20 to-pink-500/20",
      iconColor: "text-purple-400",
    },
    {
      icon: <Heart className="w-5 h-5" />,
      title: "Mood Check-in",
      description: "Keep tracking how you feel.",
      cta: "Check In",
      route: "/app/mood-checkin",
      color: "from-pink-500/20 to-rose-500/20",
      iconColor: "text-pink-400",
    },
    {
      icon: <Wind className="w-5 h-5" />,
      title: "Breathing",
      description: "Take a moment to reset.",
      cta: "Start Now",
      route: "/app/wellness-tools",
      color: "from-teal-500/20 to-emerald-500/20",
      iconColor: "text-teal-400",
    },
    {
      icon: <Moon className="w-5 h-5" />,
      title: "Sleep Tracker",
      description: "Improve your sleep quality.",
      cta: "Track Sleep",
      route: "/app/sleep-tracker",
      color: "from-indigo-500/20 to-violet-500/20",
      iconColor: "text-indigo-400",
    },
    {
      icon: <BookMarked className="w-5 h-5" />,
      title: "Reading Library",
      description: "Explore articles for your wellbeing.",
      cta: "Browse",
      route: "/app/settings/resources",
      color: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-400",
    },
  ];

  /** Carousel: Journal → Mood → Breathing, then Sleep Tracker & Reading Library */
  const growthToolsCarousel = tools.filter((t) => t.title !== "Talk It Out");
  const growthToolsPerPage = 3;
  const growthToolsPageCount = Math.max(
    1,
    Math.ceil(growthToolsCarousel.length / growthToolsPerPage)
  );
  const visibleGrowthTools = growthToolsCarousel.slice(
    growthToolsPage * growthToolsPerPage,
    growthToolsPage * growthToolsPerPage + growthToolsPerPage
  );
  const canShowGrowthToolsPrev = growthToolsPage > 0;
  const canShowGrowthToolsNext = growthToolsPage < growthToolsPageCount - 1;

  return (
    <div className="progress-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-lg opacity-50" />
              <div className="progress-header-icon-wrap relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="progress-page-title text-2xl font-bold text-white">Your Progress</h1>
              <p className="progress-page-lead text-sm text-slate-400">
                Track your wellness journey and celebrate your growth.
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportReport}
            className="progress-btn-primary hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/20"
            aria-label="Export progress report as CSV"
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>
        </motion.div>

        {/* Emotional Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="progress-hero relative overflow-hidden rounded-2xl mb-8 min-h-[220px]"
        >
          <img
            src={PROGRESS_IMAGES.hero}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[right_center]"
            loading="eager"
            decoding="async"
          />
          <div className="progress-hero-scrim pointer-events-none absolute inset-0" />
          
          <div className="relative px-8 py-10 md:py-14 flex items-center min-h-[220px]">
            <div className="max-w-md">
              <h2 className="progress-hero-title text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                You're showing up for yourself. And that matters.{" "}
                <span className="inline-block">💜</span>
              </h2>
              <p className="progress-hero-lead text-slate-300 mb-6 text-sm md:text-base">
                Every conversation, every reflection, every small step is building a stronger you.
              </p>
              {/* <Button
                onClick={() => {
                  document.getElementById("journey-timeline")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-slate-800/60 hover:bg-slate-700/60 text-white border border-slate-600/50 rounded-full px-6 backdrop-blur-sm"
              >
                See Your Journey
              </Button> */}
            </div>
          </div>
        </motion.div>

      {/* Summary Metric Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6"
      >
        {/* Talk It Out */}
        <div className="progress-stat-card relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-cyan-400" />
              <span className="progress-stat-label text-xs text-slate-400">Talk It Out</span>
            </div>
            <p className="progress-stat-value text-2xl font-bold text-white mb-1">{rangeTalks}</p>
            <p className="progress-stat-meta text-xs text-slate-500 mb-2">Talks in period</p>
            <Sparkline data={sparklineData.talks} color="#22d3ee" height={36} />
          </div>
        </div>

        {/* Mood Check-ups */}
        <div className="progress-stat-card relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="progress-stat-label text-xs text-slate-400">Mood Check-ups</span>
            </div>
            <p className="progress-stat-value text-2xl font-bold text-white mb-1">{rangeMoodCheckins}</p>
            <p className="progress-stat-meta text-xs text-slate-500 mb-2">Check-ins in period</p>
            <Sparkline data={sparklineData.mood} color="#ec4899" height={36} />
          </div>
        </div>

        {/* Journal Entries */}
        <div className="progress-stat-card relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="progress-stat-label text-xs text-slate-400">Journal Entries</span>
            </div>
            <p className="progress-stat-value text-2xl font-bold text-white mb-1">{rangeJournals}</p>
            <p className="progress-stat-meta text-xs text-slate-500 mb-2">Entries in period</p>
            <Sparkline data={sparklineData.journal} color="#a855f7" height={36} />
          </div>
        </div>

        {/* Wellness Exercises */}
        <div className="progress-stat-card relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-green-400" />
              <span className="progress-stat-label text-xs text-slate-400">Wellness Exercises</span>
            </div>
            <p className="progress-stat-value text-2xl font-bold text-white mb-1">{wellnessCountInRange}</p>
            <p className="progress-stat-meta text-xs text-slate-500 mb-2">Completions in period</p>
            <Sparkline data={sparklineData.wellness} color="#4ade80" height={36} />
          </div>
        </div>

        {/* Current Streak */}
        <div className="progress-stat-card progress-stat-card--streak relative overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 backdrop-blur-sm p-4">
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="progress-stat-label text-xs text-slate-400">Current Streak</span>
              </div>
              <p className="progress-stat-value text-2xl font-bold text-white mb-1">{currentStreak} days</p>
              <p className="text-xs text-orange-400/80">Keep going! 🔥</p>
            </div>
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(251, 146, 60, 0.2)"
                  strokeWidth="4"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="url(#streakGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(currentStreak / 30) * 176} 176`}
                />
                <defs>
                  <linearGradient id="streakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Column - Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Journey Timeline */}
          <motion.div
            id="journey-timeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="progress-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
          >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="progress-panel-title text-lg font-semibold text-white mb-1">Your Journey Timeline</h3>
                    <p className="progress-panel-lead text-sm text-slate-400">Key moments from your wellness journey</p>
                  </div>
                  <ProgressRangeSelect
                    value={timelineRange}
                    onValueChange={setTimelineRange}
                    ariaLabel="Journey timeline range"
                  />
                </div>

                <div className="space-y-0">
                  {journeyMilestones.length === 0 ? (
                    <p className="progress-empty-hint py-10 text-center text-sm text-slate-400">
                      No milestones in this period yet. Keep showing up — your next win will appear here.
                    </p>
                  ) : null}
                  {journeyMilestones.map((milestone, index) => (
                    <TimelineItem
                      key={`${milestone.title}-${index}`}
                      icon={milestone.icon}
                      title={milestone.title}
                      description={milestone.description}
                      date={milestone.date}
                      pill={milestone.pill}
                      pillColor={milestone.pillColor}
                      isLast={index === journeyMilestones.length - 1}
                    />
                  ))}
                </div>

                {/* Quote Panel */}
                <div className="progress-quote-panel relative mt-6 min-h-[120px] overflow-hidden rounded-xl border border-slate-700/30">
                  <img
                    src={PROGRESS_IMAGES.quoteLandscape}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="progress-quote-scrim pointer-events-none absolute inset-0" />
                  <div className="relative flex gap-3 p-4">
                    <Quote className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
                    <p className="progress-quote-text text-sm italic text-slate-100 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
                      &ldquo;Growth is not always loud. Sometimes it&apos;s just choosing yourself, quietly, every day.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Monthly Reflection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="progress-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm"
            >
              <div className="relative grid grid-cols-1 md:grid-cols-2">
                {/* Visual Side - Lanterns, candle, book scene */}
                <div className="relative min-h-[220px] md:min-h-[280px] overflow-hidden">
                  <img
                    src={PROGRESS_IMAGES.monthlyReflection}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Right fade for seamless blend */}
                  <div className="progress-reflection-visual-fade absolute inset-0" />
                </div>

                {/* Content Side */}
                <div className="progress-reflection-content p-6 flex flex-col justify-center bg-gradient-to-l from-slate-900/80 to-transparent">
                  <h3 className="progress-panel-title text-lg font-semibold text-white mb-2">This Month's Reflection</h3>
                  <p className="progress-panel-lead text-sm text-slate-400 mb-6">
                    You've been more consistent and mindful. Your daily choices are creating lasting change.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="progress-reflection-stat p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-purple-400" />
                      </div>
                      <p className="progress-reflection-stat-label text-xs text-slate-400 mb-1">Most Active Day</p>
                      <p className="progress-reflection-stat-value text-sm font-semibold text-white">April 28</p>
                    </div>
                    <div className="progress-reflection-stat p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-orange-400" />
                      </div>
                      <p className="progress-reflection-stat-label text-xs text-slate-400 mb-1">Longest Streak</p>
                      <p className="progress-reflection-stat-value text-sm font-semibold text-white">{Math.max(currentStreak, 12)} days</p>
                    </div>
                    <div className="progress-reflection-stat p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-cyan-400" />
                      </div>
                      <p className="progress-reflection-stat-label text-xs text-slate-400 mb-1">Best Mood</p>
                      <p className="progress-reflection-stat-value text-sm font-semibold text-white">Calm 😌</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tools That Support Your Growth */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="progress-tools-banner relative overflow-hidden rounded-2xl border border-slate-800/50"
            >
              <img
                src={DASHBOARD_IMAGES.quoteDecor}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                loading="lazy"
                decoding="async"
              />
              <div className="progress-tools-scrim pointer-events-none absolute inset-0" />
              <div className="relative space-y-4 p-5 sm:p-6">
              <div>
                <h3 className="progress-panel-title text-lg font-semibold text-white mb-1">Tools that support your growth</h3>
                <p className="progress-panel-lead text-sm text-slate-400">Keep using what helps you feel better.</p>
              </div>

              <div className="flex items-stretch gap-3">
                {canShowGrowthToolsPrev ? (
                  <button
                    type="button"
                    aria-label="Show previous growth tools"
                    onClick={() => setGrowthToolsPage((p) => Math.max(0, p - 1))}
                    className="progress-carousel-btn flex h-auto shrink-0 items-center justify-center self-center rounded-xl border border-white/10 bg-slate-800/80 px-2 py-6 text-violet-300 shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)] transition-colors hover:border-violet-400/35 hover:bg-slate-700/80 hover:text-violet-200"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}

                <div
                  className={cn(
                    "grid min-w-0 flex-1 gap-4 overflow-hidden",
                    visibleGrowthTools.length === 1 && "max-w-[220px] grid-cols-1",
                    visibleGrowthTools.length === 2 && "grid-cols-2",
                    visibleGrowthTools.length >= 3 && "grid-cols-3"
                  )}
                >
                  {visibleGrowthTools.map((tool) => (
                    <motion.div
                      key={tool.title}
                      whileHover={{ y: -2 }}
                      className="progress-tool-card relative min-w-0 overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 p-4 backdrop-blur-sm"
                    >
                      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", tool.color)} />
                      <div className="relative">
                        <div
                          className={cn(
                            "progress-tool-icon-wrap mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80",
                            tool.iconColor
                          )}
                        >
                          {tool.icon}
                        </div>
                        <h4 className="progress-tool-card-title mb-1 text-sm font-semibold text-white">{tool.title}</h4>
                        <p className="progress-tool-card-desc mb-3 text-xs text-slate-400">{tool.description}</p>
                        <Button
                          onClick={() => navigate(tool.route)}
                          variant="ghost"
                          size="sm"
                          className="progress-tool-cta w-full rounded-lg bg-slate-800/50 text-xs text-white hover:bg-slate-700/50"
                        >
                          {tool.cta}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {canShowGrowthToolsNext ? (
                  <button
                    type="button"
                    aria-label="Show next growth tool"
                    onClick={() =>
                      setGrowthToolsPage((p) => Math.min(growthToolsPageCount - 1, p + 1))
                    }
                    className="progress-carousel-btn flex h-auto shrink-0 items-center justify-center self-center rounded-xl border border-white/10 bg-slate-800/80 px-2 py-6 text-violet-300 shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)] transition-colors hover:border-violet-400/35 hover:bg-slate-700/80 hover:text-violet-200"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
              </div>
              </div>
            </motion.div>

            {/* Closing Encouragement Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="progress-celebrate relative min-h-[168px] overflow-hidden rounded-2xl sm:min-h-[180px]"
            >
              <img
                src={PROGRESS_IMAGES.celebrateBanner}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                loading="lazy"
                decoding="async"
              />
              <div className="progress-celebrate-scrim pointer-events-none absolute inset-0" />
              <div className="relative px-6 py-8 md:px-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="progress-celebrate-icon w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="progress-celebrate-title text-xl font-bold text-white flex items-center gap-2">
                      You're doing amazing! <Sparkles className="w-5 h-5" />
                    </h3>
                    <p className="progress-celebrate-lead text-sm text-white/80">
                      This month you showed up for yourself in so many ways. Keep going. Your future self is grateful.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/app/settings/achievements")}
                  className="progress-btn-secondary bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-full px-6 whitespace-nowrap"
                >
                  Celebrate You
                </Button>
              </div>
            </motion.div>
          </div>

        {/* Right Rail */}
        <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0 space-y-6">
            {/* Growth Overview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="progress-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="progress-panel-title font-semibold text-white">Growth Overview</h3>
                  <ProgressRangeSelect
                    value={timelineRange}
                    onValueChange={setTimelineRange}
                    ariaLabel="Growth overview range"
                  />
                </div>
                <div className="flex flex-col items-center relative">
                  <CircularProgress value={growthScore} size={140} strokeWidth={10} />
                  {/* Achievement badge */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                    className="absolute -right-1 top-1/4 w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30 border-2 border-slate-900"
                  >
                    <span className="text-base">🌱</span>
                  </motion.div>
                  <p className="progress-ring-caption mt-4 text-sm font-medium text-white">Overall Growth</p>
                  <p className="progress-ring-sub text-xs text-slate-400">You're making beautiful progress.</p>
                </div>
              </div>
            </motion.div>

            {/* Emotional Balance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="progress-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="progress-panel-title font-semibold text-white">Emotional Balance</h3>
                  <ProgressRangeSelect
                    value={timelineRange}
                    onValueChange={setTimelineRange}
                    ariaLabel="Emotional balance range"
                  />
                </div>

                <div className="h-[140px] mb-4">
                  {emotionalBalanceData.length === 0 ? (
                    <div className="progress-chart-empty flex h-full items-center justify-center text-xs text-slate-500">
                      No mood check-ins in this period yet.
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emotionalBalanceData}>
                      <Line
                        type="monotone"
                        dataKey="positive"
                        stroke="#4ade80"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="neutral"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="difficult"
                        stroke="#f472b6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>

                <div className="flex items-center justify-center gap-6 text-center">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="progress-balance-stat text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.positive, 0)}
                      </span>
                    </div>
                    <p className="progress-balance-label text-xs text-slate-400">Positive</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="progress-balance-stat text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.neutral, 0)}
                      </span>
                    </div>
                    <p className="progress-balance-label text-xs text-slate-400">Neutral</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-pink-400" />
                      <span className="progress-balance-stat text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.difficult, 0)}
                      </span>
                    </div>
                    <p className="progress-balance-label text-xs text-slate-400">Difficult</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Top Areas of Growth */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="progress-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-green-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="progress-panel-title font-semibold text-white">Top Areas of Growth</h3>
                  <ProgressRangeSelect
                    value={timelineRange}
                    onValueChange={setTimelineRange}
                    ariaLabel="Top areas of growth range"
                  />
                </div>

                <div className="space-y-4">
                  {areasOfGrowth.map((area, index) => (
                    <ProgressBar
                      key={index}
                      label={area.label}
                      value={area.value}
                      color={area.color}
                      icon={
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            index === 0 ? "bg-purple-400" :
                            index === 1 ? "bg-pink-400" :
                            index === 2 ? "bg-cyan-400" :
                            index === 3 ? "bg-amber-400" :
                            "bg-green-400"
                          )}
                        />
                      }
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Personal Note */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="progress-personal-note relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-900/30 via-slate-900/80 to-slate-900/90 backdrop-blur-sm p-6"
            >
              {/* Warm ambient glow */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-radial from-amber-500/20 via-amber-500/5 to-transparent rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="progress-panel-title font-semibold text-white">Personal Note</h3>
                  <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30" />
                </div>

                <div className="relative flex items-end gap-4">
                  <div className="relative h-[88px] w-[60px] shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={PROGRESS_IMAGES.personalNoteJar}
                      alt=""
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="progress-personal-note-copy text-slate-300 text-sm leading-relaxed pb-2">
                    You've come so far. Be proud of your progress.
                  </p>
                </div>
              </div>
            </motion.div>
        </div>
      </div>
    </div>
  );
}
