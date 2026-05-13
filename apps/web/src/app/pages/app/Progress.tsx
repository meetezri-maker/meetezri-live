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
  ChevronRight,
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

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
        <span className="text-3xl font-bold text-white">{value}%</span>
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
          <span className="text-slate-300">{label}</span>
        </div>
        <span className="text-slate-400">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
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
        <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
          {icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-gradient-to-b from-purple-500/30 to-transparent my-2" />
        )}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-white mb-1">{title}</h4>
            <p className="text-sm text-slate-400 mb-2">{description}</p>
            <p className="text-xs text-slate-500">{date}</p>
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
  const [statsData, setStatsData] = useState<{
    weeklyProgress: any[];
    wellnessScore: any[];
    monthlyActivity: any[];
  } | null>(null);

  const loadWellness = useCallback(() => {
    setLoadError(false);
    setIsLoadingWellness(true);
    Promise.all([api.wellness.getProgress(), api.wellness.getStats()])
      .then(([progress, stats]) => {
        setWellnessProgress(Array.isArray(progress) ? progress : []);
        setStatsData(stats ?? null);
      })
      .catch((err) => {
        console.error("Failed to load wellness data:", err);
        setLoadError(true);
        setStatsData(null);
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

  const totalTalks = profile?.stats?.completed_sessions ?? 0;
  const totalMoodCheckins = profile?.stats?.total_checkins ?? 0;
  const totalJournals = profile?.stats?.total_journals ?? 0;
  const currentStreak = profile?.streak_days ?? 0;

  const sparklineData = useMemo(() => {
    if (weeklyProgress.length === 0) {
      return {
        talks: [0, 1, 2, 1, 3, 2, 4],
        mood: [1, 2, 1, 3, 2, 4, 3],
        journal: [0, 1, 1, 2, 1, 2, 3],
        wellness: [1, 0, 2, 1, 2, 3, 2],
      };
    }
    return {
      talks: weeklyProgress.map((w) => w.sessions),
      mood: weeklyProgress.map((w) => w.mood),
      journal: weeklyProgress.map((w) => Math.max(0, w.mood - w.sessions)),
      wellness: weeklyProgress.map((w) => w.wellness),
    };
  }, [weeklyProgress]);

  const emotionalBalanceData = useMemo(() => {
    if (weeklyProgress.length === 0) {
      return [
        { week: 1, positive: 4, neutral: 2, difficult: 1 },
        { week: 2, positive: 5, neutral: 3, difficult: 2 },
        { week: 3, positive: 6, neutral: 2, difficult: 1 },
        { week: 4, positive: 5, neutral: 4, difficult: 2 },
      ];
    }
    return weeklyProgress.map((w, i) => ({
      week: i + 1,
      positive: Math.max(1, w.mood),
      neutral: Math.max(1, Math.floor(w.mood * 0.5)),
      difficult: Math.max(0, Math.floor(w.mood * 0.2)),
    }));
  }, [weeklyProgress]);

  const growthScore = useMemo(() => {
    if (wellnessScore.length === 0) return 72;
    const avg = wellnessScore.reduce((sum, s) => sum + s.A, 0) / wellnessScore.length;
    return Math.round(avg);
  }, [wellnessScore]);

  const areasOfGrowth = useMemo(() => {
    const baseAreas = [
      { label: "Emotional Awareness", value: 82, color: "bg-gradient-to-r from-purple-500 to-purple-400" },
      { label: "Consistency", value: 76, color: "bg-gradient-to-r from-pink-500 to-pink-400" },
      { label: "Self Reflection", value: 64, color: "bg-gradient-to-r from-cyan-500 to-cyan-400" },
      { label: "Mindfulness", value: 58, color: "bg-gradient-to-r from-amber-500 to-amber-400" },
      { label: "Sleep Quality", value: 42, color: "bg-gradient-to-r from-green-500 to-green-400" },
    ];

    if (wellnessScore.length > 0) {
      const hasValidScores = wellnessScore.some(
        (score) => score.A > 0 && score.A < 100
      );
      if (hasValidScores) {
        wellnessScore.forEach((score, i) => {
          if (baseAreas[i] && score.A > 0 && score.A < 100) {
            baseAreas[i].value = score.A;
          }
        });
      }
    }

    return baseAreas;
  }, [wellnessScore]);

  const journeyMilestones = useMemo(() => {
    const milestones = [];

    if (totalTalks >= 1) {
      milestones.push({
        icon: <Star className="w-4 h-4" />,
        title: "First Talk",
        description: "You took the first step and had your first conversation.",
        date: "Apr 10, 2026",
        pill: "Milestone",
        pillColor: "bg-amber-500/20 text-amber-400",
      });
    }

    if (currentStreak >= 7) {
      milestones.push({
        icon: <Flame className="w-4 h-4" />,
        title: "7 Day Streak",
        description: "You showed up for yourself 7 days in a row.",
        date: "Apr 17, 2026",
        pill: "Streak",
        pillColor: "bg-orange-500/20 text-orange-400",
      });
    }

    if (totalJournals >= 1) {
      milestones.push({
        icon: <BookOpen className="w-4 h-4" />,
        title: "Deep Reflection",
        description: "You wrote a meaningful journal entry.",
        date: "Apr 22, 2026",
        pill: "Reflection",
        pillColor: "bg-purple-500/20 text-purple-400",
      });
    }

    if (totalMoodCheckins >= 10) {
      milestones.push({
        icon: <Heart className="w-4 h-4" />,
        title: "Mood Explorer",
        description: "You completed 10 mood check-ins.",
        date: "Apr 25, 2026",
        pill: "Insight",
        pillColor: "bg-pink-500/20 text-pink-400",
      });
    }

    milestones.push({
      icon: <Trophy className="w-4 h-4" />,
      title: "Consistency King",
      description: "You've maintained your wellness habits.",
      date: "May 5, 2026",
      pill: "Achievement",
      pillColor: "bg-green-500/20 text-green-400",
    });

    return milestones.slice(0, 5);
  }, [totalTalks, currentStreak, totalJournals, totalMoodCheckins]);

  const handleExportReport = () => {
    try {
      const sections: string[] = [];

      sections.push("Summary");
      sections.push(
        csvLine(["Metric", "Value"]),
        csvLine(["Talks (total)", totalTalks]),
        csvLine(["Mood check-ins (total)", totalMoodCheckins]),
        csvLine(["Journal entries (total)", totalJournals]),
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
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Progress Tracking is a Core Feature
            </h2>
            <p className="text-slate-400 mb-8">
              Upgrade to Core or Pro to unlock your wellness journey insights, analytics, and exports.
            </p>
            <Button
              onClick={() => navigate("/app/billing")}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >
              View Plans
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoadingWellness) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-lg bg-slate-800/50 animate-pulse" />
            <div className="h-4 w-72 rounded-lg bg-slate-800/30 animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-slate-800/50 animate-pulse hidden sm:block" />
        </div>
        <div className="h-48 w-full rounded-2xl bg-slate-800/30 animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-800/30 animate-pulse" />
          ))}
        </div>
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="h-96 rounded-2xl bg-slate-800/30 animate-pulse" />
            <div className="h-64 rounded-2xl bg-slate-800/30 animate-pulse" />
          </div>
          <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-500/20 flex items-center justify-center">
              <Heart className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Your journey is just beginning.
            </h2>
            <p className="text-slate-400 mb-8">
              We couldn't load your progress data right now. Your growth matters to us—let's try again.
            </p>
            <Button
              onClick={loadWellness}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >
              Try Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const tools = [
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Talk It Out",
      description: `You've opened up ${totalTalks} times.`,
      cta: "Continue",
      route: "/app/session-lobby",
      color: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-cyan-400",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: "Journal",
      description: `You've written ${totalJournals} entries.`,
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
  ];

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-lg opacity-50" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Your Progress</h1>
              <p className="text-sm text-slate-400">
                Track your wellness journey and celebrate your growth.
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportReport}
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/20"
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
          className="relative overflow-hidden rounded-2xl mb-8 min-h-[220px]"
        >
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/95 to-transparent" />
          
          {/* Scenic background image - mountain lake sunset */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'%3E%3Cdefs%3E%3ClinearGradient id='sky' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230f0a1e'/%3E%3Cstop offset='30%25' stop-color='%231a0a2e'/%3E%3Cstop offset='60%25' stop-color='%23581c87'/%3E%3Cstop offset='80%25' stop-color='%23831843'/%3E%3Cstop offset='100%25' stop-color='%23f59e0b'/%3E%3C/linearGradient%3E%3ClinearGradient id='water' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23581c87' stop-opacity='0.6'/%3E%3Cstop offset='100%25' stop-color='%230f172a'/%3E%3C/linearGradient%3E%3CradialGradient id='glow' cx='70%25' cy='60%25' r='40%25'%3E%3Cstop offset='0%25' stop-color='%23fbbf24' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%23581c87' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='url(%23sky)' width='800' height='400'/%3E%3Crect fill='url(%23glow)' width='800' height='400'/%3E%3C!-- Mountains --%3E%3Cpath d='M400,280 L500,180 L600,220 L700,160 L800,200 L800,280 Z' fill='%231e1b4b' opacity='0.9'/%3E%3Cpath d='M300,280 L400,200 L480,240 L550,190 L650,230 L800,180 L800,280 Z' fill='%23312e81' opacity='0.7'/%3E%3Cpath d='M500,280 L580,220 L650,250 L720,200 L800,240 L800,280 Z' fill='%23581c87' opacity='0.5'/%3E%3C!-- Water/Lake --%3E%3Crect y='280' width='800' height='120' fill='url(%23water)'/%3E%3C!-- Stars --%3E%3Ccircle cx='650' cy='80' r='1.5' fill='white' opacity='0.8'/%3E%3Ccircle cx='700' cy='120' r='1' fill='white' opacity='0.6'/%3E%3Ccircle cx='580' cy='60' r='1' fill='white' opacity='0.7'/%3E%3Ccircle cx='750' cy='90' r='1.2' fill='white' opacity='0.5'/%3E%3Ccircle cx='620' cy='140' r='0.8' fill='white' opacity='0.6'/%3E%3Ccircle cx='680' cy='50' r='1' fill='white' opacity='0.4'/%3E%3Ccircle cx='550' cy='100' r='1.5' fill='white' opacity='0.5'/%3E%3Ccircle cx='720' cy='160' r='0.8' fill='white' opacity='0.6'/%3E%3C!-- Path/dock --%3E%3Cpath d='M800,350 Q700,340 650,360 Q600,380 550,370 L550,400 L800,400 Z' fill='%230f172a' opacity='0.6'/%3E%3C/svg%3E")`,
              backgroundSize: "cover",
              backgroundPosition: "right center",
            }}
          />
          
          {/* Left fade overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />
          
          <div className="relative px-8 py-10 md:py-14 flex items-center min-h-[220px]">
            <div className="max-w-md">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                You're showing up for yourself. And that matters.{" "}
                <span className="inline-block">💜</span>
              </h2>
              <p className="text-slate-300 mb-6 text-sm md:text-base">
                Every conversation, every reflection, every small step is building a stronger you.
              </p>
              <Button
                onClick={() => {
                  document.getElementById("journey-timeline")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-slate-800/60 hover:bg-slate-700/60 text-white border border-slate-600/50 rounded-full px-6 backdrop-blur-sm"
              >
                See Your Journey
              </Button>
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
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">Talk It Out</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{totalTalks}</p>
            <p className="text-xs text-slate-500 mb-2">Total talks</p>
            <Sparkline data={sparklineData.talks} color="#22d3ee" height={36} />
          </div>
        </div>

        {/* Mood Check-ups */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-slate-400">Mood Check-ups</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{totalMoodCheckins}</p>
            <p className="text-xs text-slate-500 mb-2">Total check-ins</p>
            <Sparkline data={sparklineData.mood} color="#ec4899" height={36} />
          </div>
        </div>

        {/* Journal Entries */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">Journal Entries</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{totalJournals}</p>
            <p className="text-xs text-slate-500 mb-2">Total entries</p>
            <Sparkline data={sparklineData.journal} color="#a855f7" height={36} />
          </div>
        </div>

        {/* Wellness Exercises */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Wellness Exercises</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{totalWellnessSessions}</p>
            <p className="text-xs text-slate-500 mb-2">Completions this week</p>
            <Sparkline data={sparklineData.wellness} color="#4ade80" height={36} />
          </div>
        </div>

        {/* Current Streak */}
        <div className="relative overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 backdrop-blur-sm p-4">
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-slate-400">Current Streak</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{currentStreak} days</p>
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
            className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
          >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Your Journey Timeline</h3>
                    <p className="text-sm text-slate-400">Key moments from your wellness journey</p>
                  </div>
                  <select className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                    <option>All Time</option>
                    <option>This Month</option>
                    <option>This Week</option>
                  </select>
                </div>

                <div className="space-y-0">
                  {journeyMilestones.map((milestone, index) => (
                    <TimelineItem
                      key={index}
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
                <div className="mt-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex gap-3">
                    <Quote className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300 italic">
                      "Growth is not always loud. Sometimes it's just choosing yourself, quietly, every day."
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
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm"
            >
              <div className="relative grid grid-cols-1 md:grid-cols-2">
                {/* Visual Side - Lanterns, candle, book scene */}
                <div className="relative min-h-[220px] md:min-h-[280px] overflow-hidden">
                  {/* Scene background */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='nightsky' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230a0a1a'/%3E%3Cstop offset='50%25' stop-color='%231a1a3e'/%3E%3Cstop offset='100%25' stop-color='%232d1f4e'/%3E%3C/linearGradient%3E%3CradialGradient id='lanternglow1' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23fbbf24' stop-opacity='0.6'/%3E%3Cstop offset='100%25' stop-color='%23fbbf24' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='lanternglow2' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23f97316' stop-opacity='0.5'/%3E%3Cstop offset='100%25' stop-color='%23f97316' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='candleglow' cx='50%25' cy='30%25' r='60%25'%3E%3Cstop offset='0%25' stop-color='%23fef3c7' stop-opacity='0.8'/%3E%3Cstop offset='50%25' stop-color='%23fbbf24' stop-opacity='0.3'/%3E%3Cstop offset='100%25' stop-color='%23fbbf24' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='url(%23nightsky)' width='400' height='300'/%3E%3C!-- Mountains silhouette --%3E%3Cpath d='M0,200 L80,140 L150,180 L200,120 L280,160 L350,100 L400,150 L400,300 L0,300 Z' fill='%230f0f2a' opacity='0.8'/%3E%3C!-- Water reflection --%3E%3Crect y='220' width='400' height='80' fill='%231a1a3e' opacity='0.6'/%3E%3C!-- Lantern 1 (left) --%3E%3Ccircle cx='80' cy='100' r='40' fill='url(%23lanternglow1)'/%3E%3Crect x='70' y='80' width='20' height='35' rx='3' fill='%23451a03' opacity='0.9'/%3E%3Crect x='73' y='85' width='14' height='25' rx='2' fill='%23fbbf24' opacity='0.7'/%3E%3Cpath d='M75,75 L80,70 L85,75' stroke='%23451a03' stroke-width='2' fill='none'/%3E%3C!-- Lantern 2 (right) --%3E%3Ccircle cx='140' cy='130' r='35' fill='url(%23lanternglow2)'/%3E%3Crect x='130' y='115' width='18' height='30' rx='3' fill='%23451a03' opacity='0.9'/%3E%3Crect x='133' y='119' width='12' height='22' rx='2' fill='%23f97316' opacity='0.6'/%3E%3C!-- Small floating lantern --%3E%3Ccircle cx='200' cy='80' r='20' fill='url(%23lanternglow1)' opacity='0.6'/%3E%3Crect x='193' y='70' width='12' height='18' rx='2' fill='%23fbbf24' opacity='0.5'/%3E%3C!-- Book/Journal --%3E%3Crect x='240' y='200' width='80' height='55' rx='3' fill='%23312e81' transform='rotate(-5 280 227)'/%3E%3Crect x='245' y='205' width='70' height='45' rx='2' fill='%23e0e7ff' transform='rotate(-5 280 227)'/%3E%3Cline x1='255' y1='218' x2='305' y2='215' stroke='%236366f1' stroke-width='1.5' opacity='0.6'/%3E%3Cline x1='256' y1='228' x2='300' y2='225' stroke='%236366f1' stroke-width='1.5' opacity='0.6'/%3E%3Cline x1='257' y1='238' x2='295' y2='235' stroke='%236366f1' stroke-width='1.5' opacity='0.6'/%3E%3C!-- Candle --%3E%3Ccircle cx='330' cy='180' r='35' fill='url(%23candleglow)'/%3E%3Crect x='320' y='190' width='20' height='40' rx='2' fill='%23fef3c7' opacity='0.9'/%3E%3Cellipse cx='330' cy='185' rx='6' ry='10' fill='%23fbbf24'/%3E%3Cellipse cx='330' cy='180' rx='3' ry='6' fill='%23fef3c7'/%3E%3C!-- Fireflies --%3E%3Ccircle cx='50' cy='150' r='2' fill='%23fef3c7' opacity='0.8'%3E%3Canimate attributeName='opacity' values='0.8;0.3;0.8' dur='2s' repeatCount='indefinite'/%3E%3C/circle%3E%3Ccircle cx='180' cy='170' r='1.5' fill='%23fef3c7' opacity='0.6'%3E%3Canimate attributeName='opacity' values='0.6;0.2;0.6' dur='2.5s' repeatCount='indefinite'/%3E%3C/circle%3E%3Ccircle cx='280' cy='140' r='1.5' fill='%23fef3c7' opacity='0.7'%3E%3Canimate attributeName='opacity' values='0.7;0.3;0.7' dur='1.8s' repeatCount='indefinite'/%3E%3C/circle%3E%3Ccircle cx='350' cy='120' r='2' fill='%23fef3c7' opacity='0.5'%3E%3Canimate attributeName='opacity' values='0.5;0.2;0.5' dur='3s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  {/* Right fade for seamless blend */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/95" />
                </div>

                {/* Content Side */}
                <div className="p-6 flex flex-col justify-center bg-gradient-to-l from-slate-900/80 to-transparent">
                  <h3 className="text-lg font-semibold text-white mb-2">This Month's Reflection</h3>
                  <p className="text-sm text-slate-400 mb-6">
                    You've been more consistent and mindful. Your daily choices are creating lasting change.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-purple-400" />
                      </div>
                      <p className="text-xs text-slate-400 mb-1">Most Active Day</p>
                      <p className="text-sm font-semibold text-white">April 28</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-orange-400" />
                      </div>
                      <p className="text-xs text-slate-400 mb-1">Longest Streak</p>
                      <p className="text-sm font-semibold text-white">{Math.max(currentStreak, 12)} days</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-center backdrop-blur-sm">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-cyan-400" />
                      </div>
                      <p className="text-xs text-slate-400 mb-1">Best Mood</p>
                      <p className="text-sm font-semibold text-white">Calm 😌</p>
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
              className="space-y-4"
            >
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Tools that support your growth</h3>
                <p className="text-sm text-slate-400">Keep using what helps you feel better.</p>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
                {tools.map((tool, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-4 min-w-[180px] flex-shrink-0"
                  >
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", tool.color)} />
                    <div className="relative">
                      <div className={cn("w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mb-3", tool.iconColor)}>
                        {tool.icon}
                      </div>
                      <h4 className="font-semibold text-white text-sm mb-1">{tool.title}</h4>
                      <p className="text-xs text-slate-400 mb-3">{tool.description}</p>
                      <Button
                        onClick={() => navigate(tool.route)}
                        variant="ghost"
                        size="sm"
                        className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-white text-xs rounded-lg"
                      >
                        {tool.cta}
                      </Button>
                    </div>
                  </motion.div>
                ))}
                <div className="flex items-center justify-center min-w-[40px] flex-shrink-0">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </div>
              </div>
            </motion.div>

            {/* Closing Encouragement Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative overflow-hidden rounded-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600" />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='0%25' y1='100%25' x2='0%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%239333ea'/%3E%3Cstop offset='100%25' stop-color='%23581c87'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23m)' width='800' height='200'/%3E%3Cpath d='M0,180 Q100,120 200,150 T400,130 T600,160 T800,140 L800,200 L0,200 Z' fill='%237c3aed' opacity='0.5'/%3E%3Cpath d='M0,190 Q150,150 300,170 T600,155 T800,175 L800,200 L0,200 Z' fill='%236d28d9' opacity='0.5'/%3E%3C/svg%3E")`,
                  backgroundSize: "cover",
                  backgroundPosition: "bottom",
                }}
              />
              <div className="relative px-6 py-8 md:px-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      You're doing amazing! <Sparkles className="w-5 h-5" />
                    </h3>
                    <p className="text-sm text-white/80">
                      This month you showed up for yourself in so many ways. Keep going. Your future self is grateful.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/app/settings/achievements")}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-full px-6 whitespace-nowrap"
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
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Growth Overview</h3>
                  <span className="text-xs text-slate-400">This year</span>
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
                  <p className="mt-4 text-sm font-medium text-white">Overall Growth</p>
                  <p className="text-xs text-slate-400">You're making beautiful progress.</p>
                </div>
              </div>
            </motion.div>

            {/* Emotional Balance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Emotional Balance</h3>
                  <span className="text-xs text-slate-400">This month</span>
                </div>

                <div className="h-[140px] mb-4">
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
                </div>

                <div className="flex items-center justify-center gap-6 text-center">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.positive, 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Positive</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.neutral, 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Neutral</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-pink-400" />
                      <span className="text-lg font-bold text-white">
                        {emotionalBalanceData.reduce((sum, d) => sum + d.difficult, 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Difficult</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Top Areas of Growth */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-green-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Top Areas of Growth</h3>
                  <span className="text-xs text-slate-400">This month</span>
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
              className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-900/30 via-slate-900/80 to-slate-900/90 backdrop-blur-sm p-6"
            >
              {/* Warm ambient glow */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-radial from-amber-500/20 via-amber-500/5 to-transparent rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Personal Note</h3>
                  <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30" />
                </div>

                <div className="relative flex items-end gap-4">
                  {/* Candle jar illustration */}
                  <div className="flex-shrink-0">
                    <svg width="60" height="80" viewBox="0 0 60 80" className="drop-shadow-lg">
                      {/* Glow effect */}
                      <defs>
                        <radialGradient id="jarGlow" cx="50%" cy="20%" r="60%">
                          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.6" />
                          <stop offset="40%" stopColor="#fbbf24" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                        </radialGradient>
                        <linearGradient id="jarGlass" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.1" />
                          <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.1" />
                        </linearGradient>
                      </defs>
                      {/* Ambient glow */}
                      <ellipse cx="30" cy="35" rx="35" ry="40" fill="url(#jarGlow)" />
                      {/* Jar body */}
                      <path d="M15,25 Q12,25 12,30 L12,65 Q12,72 20,72 L40,72 Q48,72 48,65 L48,30 Q48,25 45,25 Z" fill="url(#jarGlass)" stroke="#fef3c7" strokeOpacity="0.3" strokeWidth="1" />
                      {/* Jar rim */}
                      <rect x="18" y="22" width="24" height="5" rx="1" fill="#d4a574" opacity="0.8" />
                      {/* Candle wax */}
                      <rect x="22" y="45" width="16" height="22" rx="2" fill="#fef3c7" opacity="0.9" />
                      {/* Flame */}
                      <ellipse cx="30" cy="38" rx="5" ry="10" fill="#fbbf24" opacity="0.9">
                        <animate attributeName="ry" values="10;8;10" dur="0.8s" repeatCount="indefinite" />
                      </ellipse>
                      <ellipse cx="30" cy="36" rx="2.5" ry="6" fill="#fef3c7">
                        <animate attributeName="ry" values="6;5;6" dur="0.6s" repeatCount="indefinite" />
                      </ellipse>
                      {/* Wick */}
                      <line x1="30" y1="45" x2="30" y2="40" stroke="#78716c" strokeWidth="1" />
                    </svg>
                  </div>
                  
                  <p className="text-slate-300 text-sm leading-relaxed pb-2">
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
