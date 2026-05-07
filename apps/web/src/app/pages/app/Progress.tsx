import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  TrendingUp,
  Award,
  Target,
  Calendar,
  Heart,
  Video,
  BookOpen,
  Flame,
  Star,
  Trophy,
  Zap,
  Download,
  Wind,
  Lock
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { useAuth } from "@/app/contexts/AuthContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "../../components/ui/skeleton";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
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

export function Progress() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Usage History is a Core Feature</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock usage history, analytics, and exports.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [wellnessProgress, setWellnessProgress] = useState<any[]>([]);
  const [isLoadingWellness, setIsLoadingWellness] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statsData, setStatsData] = useState<{ 
    weeklyProgress: any[], 
    wellnessScore: any[],
    monthlyActivity: any[] 
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

  /** From API: per-week counts for sessions, mood check-ins, and wellness completions. */
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

  /** Last 6 calendar months: combined activity count from the API. */
  const monthlyActivity = useMemo(() => {
    const m = statsData?.monthlyActivity;
    if (!Array.isArray(m) || m.length === 0) return [];
    return m.map((row: Record<string, unknown>) => ({
      month: String(row.month ?? ""),
      value: Number(row.value) || 0,
    }));
  }, [statsData]);

  const monthlyInsight = useMemo(() => {
    if (monthlyActivity.length < 1) {
      return {
        body: "Log Talks, moods, journals, and wellness tools to build your trend.",
        chip1: null as string | null,
      };
    }
    const curr = monthlyActivity[monthlyActivity.length - 1]?.value ?? 0;
    const prev =
      monthlyActivity.length >= 2
        ? monthlyActivity[monthlyActivity.length - 2]?.value ?? 0
        : 0;
    const delta =
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
    return {
      body: `This month you logged ${curr} activities (Talks, mood check-ins, journals, and wellness completions combined).`,
      chip1:
        prev > 0 && delta !== null
          ? `${delta >= 0 ? "+" : ""}${delta}% vs prior month`
          : null,
    };
  }, [monthlyActivity]);

  const achievements = [
    {
      icon: Flame,
      title: "7 Day Streak",
      description: "Checked in every day this week",
      unlocked: true,
      color: "from-orange-400 to-red-500"
    },
    {
      icon: Star,
      title: "First Talk",
      description: "Completed your first Talk",
      unlocked: true,
      color: "from-yellow-400 to-amber-500"
    },
    {
      icon: Trophy,
      title: "Journal Master",
      description: "Written 25 journal entries",
      unlocked: true,
      color: "from-purple-400 to-pink-500"
    },
    {
      icon: Wind,
      title: "Breathing basics",
      description: "Try a guided breathing exercise",
      unlocked: false,
      color: "from-cyan-400 to-teal-500"
    },
    {
      icon: Zap,
      title: "Wellness Warrior",
      description: "Completed 10 wellness exercises",
      unlocked: false,
      color: "from-blue-400 to-cyan-500"
    },
    {
      icon: Heart,
      title: "Mood Maven",
      description: "Tracked mood for 30 days",
      unlocked: false,
      color: "from-pink-400 to-rose-500"
    },
    {
      icon: Target,
      title: "Goal Getter",
      description: "Achieved 5 personal goals",
      unlocked: false,
      color: "from-green-400 to-emerald-500"
    }
  ];

  const totalWellnessSessions = wellnessProgress.reduce((acc, curr) => acc + curr.sessionsCompleted, 0);

  const handleExportReport = () => {
    try {
      const sections: string[] = [];

      sections.push("Summary");
      sections.push(
        csvLine(["Metric", "Value"]),
        csvLine([
          "Talks (total)",
          profile?.stats?.completed_sessions ?? 0,
        ]),
        csvLine([
          "Mood check-ins (total)",
          profile?.stats?.total_checkins ?? 0,
        ]),
        csvLine([
          "Journal entries (total)",
          profile?.stats?.total_journals ?? 0,
        ]),
        csvLine([
          "Wellness exercise completions (total)",
          totalWellnessSessions,
        ]),
        csvLine(["Current streak (days)", profile?.streak_days ?? 0]),
        ""
      );

      sections.push("Weekly progress");
      if (weeklyProgress.length > 0) {
        const keys = Object.keys(weeklyProgress[0] as object);
        sections.push(csvLine(keys));
        for (const row of weeklyProgress) {
          sections.push(
            csvLine(keys.map((k) => (row as Record<string, unknown>)[k]))
          );
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
          sections.push(
            csvLine(wKeys.map((k) => (row as Record<string, unknown>)[k]))
          );
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
          sections.push(
            csvLine(mKeys.map((k) => (row as Record<string, unknown>)[k]))
          );
        }
      } else {
        sections.push("(no data)");
      }
      sections.push("");

      sections.push("Wellness tools");
      sections.push(
        csvLine([
          "Tool ID",
          "Title",
          "Talk it out completed",
          "Total time (seconds)",
        ])
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
      a.download = `ezri-progress-report-${new Date().toISOString().split("T")[0]}.csv`;
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

  const stats = useMemo(() => {
    const lastWeek = weeklyProgress[weeklyProgress.length - 1];
    const latestWellness = lastWeek ? Number(lastWeek.wellness) || 0 : 0;
    return [
      {
        icon: Video,
        label: "Talk It Out",
        value: profile?.stats?.completed_sessions?.toString() || "0",
        change: "Total Talks",
        color: "text-blue-500",
        bgColor: "bg-blue-50"
      },
      {
        icon: Heart,
        label: "Mood Check-ins",
        value: profile?.stats?.total_checkins?.toString() || "0",
        change: "Total check-ins",
        color: "text-pink-500",
        bgColor: "bg-pink-50"
      },
      {
        icon: BookOpen,
        label: "Journal Entries",
        value: profile?.stats?.total_journals?.toString() || "0",
        change: "Total entries",
        color: "text-purple-500",
        bgColor: "bg-purple-50"
      },
      {
        icon: Wind,
        label: "Wellness Exercises",
        value: totalWellnessSessions.toString(),
        change:
          weeklyProgress.length > 0
            ? `${latestWellness} completions in latest week`
            : "Per-week stats load with charts",
        color: "text-cyan-500",
        bgColor: "bg-cyan-50"
      },
      {
        icon: Flame,
        label: "Current Streak",
        value: `${profile?.streak_days || 0} days`,
        change: "Keep it up!",
        color: "text-orange-500",
        bgColor: "bg-orange-50"
      }
    ];
  }, [profile, totalWellnessSessions, weeklyProgress]);

  if (isLoadingWellness) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-3">
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <Skeleton className="h-64 w-full" />
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Your Progress</h1>
              </div>
              <p className="text-muted-foreground">
                Track your wellness journey and celebrate wins
              </p>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportReport}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer"
              aria-label="Export progress report as CSV"
            >
              <Download className="w-4 h-4" />
              Export Report
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className={`p-5 shadow-lg ${stat.bgColor}`}>
                  <Icon className={`w-7 h-7 mb-3 ${stat.color}`} />
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Charts Section — data from GET /wellness/stats */}
        {loadError ? (
          <div className="grid grid-cols-1 mb-8">
            <Card className="p-6 shadow-xl border-destructive/30">
              <p className="text-muted-foreground mb-4">
                Charts could not be loaded. Your summary numbers above may still be up to date.
              </p>
              <Button type="button" variant="outline" onClick={loadWellness}>
                Retry charts
              </Button>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Weekly Progress */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-1">Weekly Progress</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Counts per week: mood check-ins, completed Talks, wellness exercises
                </p>
                {weeklyProgress.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">No weekly data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={weeklyProgress}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mood"
                        stroke="#6366f1"
                        strokeWidth={3}
                        name="Mood check-ins"
                      />
                      <Line
                        type="monotone"
                        dataKey="sessions"
                        stroke="#ec4899"
                        strokeWidth={3}
                        name="Talk"
                      />
                      <Line
                        type="monotone"
                        dataKey="wellness"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        name="Wellness exercises"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </motion.div>

            {/* Wellness Score */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-1">Wellness Score</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Derived from your mood, sleep, community activity, engagement, and exercise time
                </p>
                {wellnessScore.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">No score data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={wellnessScore}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" stroke="#6b7280" />
                      <PolarRadiusAxis domain={[0, 100]} stroke="#6b7280" />
                      <Radar
                        name="Score"
                        dataKey="A"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.6}
                      />
                      <Tooltip formatter={(value: number) => [`${value}`, "Score"]} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </motion.div>
          </div>
        )}

        {/* Wellness Tools Report */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-8"
        >
          <Card className="p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <Wind className="w-6 h-6 text-cyan-500" />
              <h2 className="text-xl font-bold">Wellness Tools Report</h2>
            </div>
            
            {isLoadingWellness ? (
              <p className="text-gray-500 text-center py-4">Loading report...</p>
            ) : wellnessProgress.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No wellness exercises completed yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wellnessProgress.map((p) => (
                  <div key={p.toolId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyan-100 text-cyan-600 rounded-full">
                        <Wind className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{p.toolTitle}</p>
                        <p className="text-sm text-gray-500">{p.sessionsCompleted} sessions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-cyan-600">
                        {formatWellnessDuration(wellnessProgressTotalSeconds(p))}
                      </p>
                      <p className="text-xs text-gray-500">Total time</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Monthly Activity */}
        {!loadError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <Card className="p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-1">Monthly Activity</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Total activities per month (sessions, moods, journals, wellness)
            </p>
            {monthlyActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm py-12 text-center">No monthly data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [value, "Activities"]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {monthlyActivity.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#10b981"][index % 6]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>
        )}

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Achievements</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement, index) => {
                const Icon = achievement.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    whileHover={achievement.unlocked ? { scale: 1.03, y: -5 } : {}}
                  >
                    <Card
                      className={`p-5 transition-all ${
                        achievement.unlocked
                          ? `bg-gradient-to-br ${achievement.color} text-white shadow-lg cursor-pointer`
                          : "bg-gray-100 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <motion.div
                          animate={
                            achievement.unlocked
                              ? { rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }
                              : {}
                          }
                          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                          className={`p-3 rounded-full ${
                            achievement.unlocked ? "bg-white/20" : "bg-white/50"
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                        </motion.div>
                        <div className="flex-1">
                          <h3 className="font-bold mb-1">{achievement.title}</h3>
                          <p
                            className={`text-sm ${
                              achievement.unlocked ? "text-white/90" : "text-gray-600"
                            }`}
                          >
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                      {achievement.unlocked && (
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <Star className="w-3 h-3" />
                          Unlocked
                        </div>
                      )}
                      {!achievement.unlocked && (
                        <div className="text-xs font-medium text-gray-500">🔒 Locked</div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Motivational Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <Trophy className="w-8 h-8 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2 inline-flex items-center gap-2 flex-wrap">
                  You&apos;re Doing Great! <FluentEmoji emoji="🎉" size={24} />
                </h3>
                <p className="text-white/90 mb-4">{monthlyInsight.body}</p>
                {monthlyInsight.chip1 && (
                  <div className="flex flex-wrap gap-3">
                    <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                      {monthlyInsight.chip1}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
