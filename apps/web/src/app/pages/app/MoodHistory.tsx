import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  Heart,
  TrendingUp,
  Calendar,
  Sparkles,
  Flame,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Star,
  Sun,
  Moon,
  CloudRain,
  Zap,
  Phone,
  Video,
  Shield,
  BookMarked,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../../components/ui/skeleton";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { useNavigate } from "react-router-dom";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  isSameDay,
  subMonths,
  addMonths,
  subWeeks,
  addWeeks,
  subYears,
  addYears,
} from "date-fns";
import { cn } from "@/lib/utils";
import { SolacePanel } from "@/app/solace/SolacePanel";
import { lobbyAvatarByName } from "@/lib/avatar/lobbyAvatars";
import { MOOD_CHECKIN_IMAGES, moodCheckInImageForValue } from "@/lib/solace/moodCheckInImages";
import {
  getMoodDisplayInfo,
  MOOD_CALENDAR_LEGEND,
} from "./mood-check-in/moodDisplay";
import {
  computeCheckInStreak,
  weeklyIntensitySeries,
  type MoodEntryLite,
} from "./mood-check-in/moodCheckInUtils";
interface MoodEntry {
  id: string;
  created_at: string;
  mood: string;
  intensity: number;
  activities?: string[];
  notes?: string;
  source: "journal" | "check-in";
}

/** Reflection prompts keyed by Most Common mood label. `{period}` → this week / month / year. */
const MOOD_REFLECTION_LINES: Record<string, string> = {
  Calm: "What moment made everything feel quiet for a little while {period}?",
  Overwhelmed: "What felt like too much {period}?",
  Hopeful: "What gave you a reason to keep looking forward {period}?",
  Tired: "What drained most of your energy {period}?",
  Heavy: "What has been weighing on your heart lately?",
  Grateful: "What are you thankful for {period}?",
  Excited: "What are you genuinely looking forward to right now?",
  Anxious: "What thoughts kept circling in your mind {period}?",
  Numb: "Did anything make you feel emotionally disconnected {period}?",
  Happy: "What small thing made you smile {period}?",
  Nervous: "What situation made your stomach tighten {period}?",
  Sad: "What brought comfort when things felt heavy {period}?",
  Energetic: "What made you feel alive or motivated {period}?",
  Angry: "What frustration or tension showed up for you {period}?",
  Neutral: "What felt steady or uneventful for you {period}?",
};

const getReflectionPrompt = (
  moodLabel: string | null | undefined,
  period: "week" | "month" | "year",
): string => {
  const periodPhrase = period === "week" ? "this week" : period === "month" ? "this month" : "this year";
  const template =
    (moodLabel && MOOD_REFLECTION_LINES[moodLabel]) ??
    "What moments brought you peace {period}?";
  if (!template.includes("{period}")) return template;
  return template.replace("{period}", periodPhrase);
};

const MOOD_HISTORY_PAGE_OPTIONS = [10, 20, 50] as const;


export function MoodHistory() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (profile?.subscription_plan === "trial") {
    return (
      <div className="min-h-screen bg-[#060a12]">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <SolacePanel glow="violet" className="p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20">
              <Lock className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-zinc-50">Mood history is part of Grow</h2>
            <p className="mx-auto mb-8 max-w-md text-zinc-400">Upgrade to Grow or Thrive for detailed mood history and trends. Your check-ins are already being saved.</p>
            <Button onClick={() => navigate("/app/billing")} className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3 text-white">Upgrade membership</Button>
          </SolacePanel>
        </div>
      </div>
    );
  }

  const [selectedView, setSelectedView] = useState<"week" | "month" | "year">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteEntryIds, setFavoriteEntryIds] = useState<string[]>([]);
  const [checkInListPage, setCheckInListPage] = useState(1);
  const [checkInListPageSize, setCheckInListPageSize] = useState(10);

  const getPeriodRange = () => {
    if (selectedView === "week") return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    if (selectedView === "month") return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [journalData, moodData] = await Promise.all([
        api.journal.getAll().catch(() => []),
        api.moods.getMyMoods().catch(() => []),
      ]);
      const normalizedJournal: MoodEntry[] = (journalData || []).map((j: any) => {
        const mood = j.mood_tags?.[0] || "";
        const info = getMoodDisplayInfo(mood);
        return { id: j.id, created_at: j.created_at, mood, intensity: info?.score || 5, notes: j.content, source: "journal" as const };
      }).filter((e: MoodEntry) => e.mood);
      const normalizedMoods: MoodEntry[] = (moodData || []).map((m: any) => ({
        id: m.id, created_at: m.created_at, mood: m.mood, intensity: m.intensity, activities: m.activities, notes: m.notes, source: "check-in" as const,
      }));
      setEntries([...normalizedJournal, ...normalizedMoods].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) { console.error("Failed to load mood history:", error); } finally { setLoading(false); }
  };

  const goToPreviousCalendarMonth = () => setCalendarDate(prev => subMonths(prev, 1));
  const goToNextCalendarMonth = () => setCalendarDate(prev => addMonths(prev, 1));

  const exportCurrentPeriod = () => {
    const { start, end } = getPeriodRange();
    const periodEntries = entries.filter(entry => { const date = new Date(entry.created_at); return date >= start && date <= end; })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (periodEntries.length === 0) return;
    const csvRows = [
      ["Date", "Mood", "Mood Label", "Intensity", "Source", "Activities", "Notes"].join(","),
      ...periodEntries.map(entry => {
        const info = getMoodDisplayInfo(entry.mood);
        return [format(new Date(entry.created_at), "yyyy-MM-dd HH:mm"), entry.mood, info?.label ?? "", String(entry.intensity), entry.source, entry.activities?.join(" | ") ?? "", entry.notes ?? ""]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      }),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mood-history-${selectedView}-${format(currentDate, "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getEntryKey = (entry: MoodEntry) => `${entry.source}:${entry.id}`;
  const toggleFavorite = (entry: MoodEntry) => {
    const entryKey = getEntryKey(entry);
    setFavoriteEntryIds(prev => prev.includes(entryKey) ? prev.filter(id => id !== entryKey) : [...prev, entryKey]);
  };

  const recentCheckIns = useMemo(() => entries.filter(e => e.source === "check-in").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [entries]);
  const displayedCheckIns = useMemo(() => recentCheckIns.slice(0, 4), [recentCheckIns]);

  const { calendarData, summaryData, patternChartData, heatmapData, reflectionPrompt } = useMemo(() => {
    const { start, end } = getPeriodRange();
    const periodEntries = entries.filter(entry => { const date = new Date(entry.created_at); return date >= start && date <= end; });
    const periodCheckIns = periodEntries.filter(e => e.source === "check-in");
    const periodInsightEntries = periodCheckIns.length > 0 ? periodCheckIns : periodEntries;

    // Calendar data
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarData = eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
      const dayEntries = entries.filter(e => isSameDay(new Date(e.created_at), day));
      const dayEntry = dayEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const info = dayEntry ? getMoodDisplayInfo(dayEntry.mood) : null;
      return {
        day: day.getDate(),
        isCurrentMonth: day.getMonth() === calendarDate.getMonth(),
        emoji: info?.emoji || "",
        color: info?.color || "",
        label: info?.label || "",
        mood: dayEntry?.intensity ?? info?.score ?? 0,
        date: day,
      };
    });

    // Summary calculations
    const currAvg = periodInsightEntries.length > 0 ? periodInsightEntries.reduce((acc, e) => acc + e.intensity, 0) / periodInsightEntries.length : 0;
    const moodCounts: Record<string, number> = {};
    periodEntries.forEach((e) => {
      const info = getMoodDisplayInfo(e.mood);
      if (info?.label) moodCounts[info.label] = (moodCounts[info.label] || 0) + 1;
    });
    const mostCommon = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    const mostCommonDisplay = mostCommon
      ? MOOD_CALENDAR_LEGEND.find((d) => d.label === mostCommon[0])
      : null;
    
    const calmCount = (moodCounts["Calm"] || 0) + (moodCounts["Happy"] || 0);
    const totalCount = periodEntries.length || 1;
    const calmnessScore = Math.round((calmCount / totalCount) * 100);
    
    const reflectionCount = periodEntries.filter(e => e.notes && e.notes.length > 10).length;
    const reflectionConsistency = Math.round((reflectionCount / Math.max(totalCount, 1)) * 100);
    
    const anxiousCount = (moodCounts["Anxious"] || 0) + (moodCounts["Sad"] || 0) + (moodCounts["Angry"] || 0);
    const recoveryPattern = totalCount > anxiousCount ? Math.round(((totalCount - anxiousCount) / totalCount) * 100) : 0;

    const summaryData = {
      mostCommonMood: mostCommon && mostCommonDisplay
        ? { label: mostCommon[0], emoji: mostCommonDisplay.emoji }
        : null,
      emotionalTrend: currAvg >= 7 ? "Upward" : currAvg >= 5 ? "Stable" : "Needs Care",
      trendValue: currAvg.toFixed(1),
      reflectionConsistency,
      calmnessScore,
      recoveryPattern,
    };

    // Pattern chart data (last 7 days)
    const moodEntries: MoodEntryLite[] = entries.filter(e => e.source === "check-in").map(e => ({ mood: e.mood, created_at: e.created_at, intensity: e.intensity }));
    const patternChartData = weeklyIntensitySeries(moodEntries).map(d => ({ name: d.short, value: d.avg || 5 }));

    // Heatmap data (4 weeks x 7 days)
    const heatmapData: number[][] = [];
    for (let week = 0; week < 4; week++) {
      const weekData: number[] = [];
      for (let day = 0; day < 7; day++) {
        const idx = week * 7 + day;
        const dayEntries = entries.slice(idx * 2, idx * 2 + 2);
        const avg = dayEntries.length > 0 ? dayEntries.reduce((a, e) => a + e.intensity, 0) / dayEntries.length : 0;
        weekData.push(Math.round(avg));
      }
      heatmapData.push(weekData);
    }

    const reflectionPrompt = getReflectionPrompt(
      summaryData.mostCommonMood?.label,
      selectedView,
    );

    return { calendarData, summaryData, patternChartData, heatmapData, reflectionPrompt };
  }, [selectedView, currentDate, calendarDate, entries]);

  const companionPreview = useMemo(() => lobbyAvatarByName(profile?.selected_avatar ?? "Jordan Taylor"), [profile?.selected_avatar]);
  const streakDays = useMemo(() => {
    const moodEntries: MoodEntryLite[] = entries.filter(e => e.source === "check-in").map(e => ({ mood: e.mood, created_at: e.created_at, intensity: e.intensity }));
    return computeCheckInStreak(moodEntries);
  }, [entries]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-[#060a12]">
      <div className="mx-auto max-w-[1400px] px-6 py-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-600/20 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Heart className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Mood History</h1>
              <p className="text-[11px] text-zinc-500">Your emotional journey and reflections</p>
            </div>
          </div>
          <button onClick={exportCurrentPeriod} disabled={entries.length === 0} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:bg-white/[0.06] disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </motion.div>

        <div className="flex gap-5">
          {/* Main Content */}
          <div className="min-w-0 flex-1 space-y-5">
            {/* Hero Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.06]" style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.15) 0%, rgba(15,23,42,0.9) 50%, rgba(30,41,59,0.8) 100%)" }}>
                <div className="absolute inset-0">
                  <img src={MOOD_CHECKIN_IMAGES.heroBanner} alt="" className="h-full w-full object-cover opacity-40" loading="lazy" decoding="async" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f0a1a]/95 via-[#0f0a1a]/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0612]/90 via-transparent to-[#1a0a2e]/30" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.15),transparent_50%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.08),transparent_50%)]" />
                </div>
                <div className="relative flex min-h-[200px] items-center p-8">
                  <div className="max-w-md space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/80">Your Emotional Journey</p>
                    <h2 className="font-serif text-2xl font-normal leading-tight tracking-tight text-zinc-50">
                      Every feeling tells a story worth understanding
                    </h2>
                    <p className="text-sm leading-relaxed text-zinc-400/90">
                      {entries.length > 0 
                        ? `You've captured ${entries.length} emotional moments. Your journey continues to unfold beautifully.`
                        : "Begin capturing your emotional moments to see your journey unfold."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Emotional Summary Row - 5 Cards */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-5 gap-3">
              {[
                { icon: Heart, label: "Most Common", value: summaryData.mostCommonMood?.label || "—", gradient: "from-amber-500/20 to-orange-600/10", glow: "rgba(251,191,36,0.2)" },
                { icon: TrendingUp, label: "Emotional Trend", value: summaryData.emotionalTrend, sub: `${summaryData.trendValue}/10`, gradient: "from-emerald-500/20 to-teal-600/10", glow: "rgba(52,211,153,0.2)" },
                { icon: MessageCircle, label: "Reflection", value: `${summaryData.reflectionConsistency}%`, sub: "Consistency", gradient: "from-cyan-500/20 to-blue-600/10", glow: "rgba(34,211,238,0.2)" },
                { icon: Sun, label: "Calmness", value: `${summaryData.calmnessScore}%`, sub: "Score", gradient: "from-violet-500/20 to-purple-600/10", glow: "rgba(139,92,246,0.2)" },
                { icon: Zap, label: "Recovery", value: `${summaryData.recoveryPattern}%`, sub: "Pattern", gradient: "from-pink-500/20 to-rose-600/10", glow: "rgba(236,72,153,0.2)" },
              ].map((card, i) => (
                <div key={i} className={cn("relative overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-br p-4", card.gradient)} style={{ boxShadow: `0 0 30px ${card.glow}` }}>
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                  <div className="relative">
                    <card.icon className="mb-2 h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">{card.label}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">{card.value}</p>
                    {card.sub && <p className="mt-0.5 text-[10px] text-zinc-500">{card.sub}</p>}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Mood Timeline Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">Emotional Timeline</h3>
                <button className="text-[10px] text-violet-400 hover:text-violet-300">View all</button>
              </div>
              
              <div className="relative rounded-2xl border border-white/[0.05] bg-black/20 p-5">
                {displayedCheckIns.length === 0 ? (
                  <div className="py-10 text-center">
                    <Heart className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
                    <p className="text-sm text-zinc-500">Your emotional journey begins here</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute bottom-0 left-[100px] top-0 w-px bg-gradient-to-b from-violet-500/40 via-purple-500/20 to-transparent" />
                    
                    <div className="space-y-4">
                      {displayedCheckIns.map((entry, idx) => {
                        const info = getMoodDisplayInfo(entry.mood);
                        const isFavorite = favoriteEntryIds.includes(getEntryKey(entry));
                        const thumbnailUrl = moodCheckInImageForValue(entry.mood);
                        
                        return (
                          <motion.div key={getEntryKey(entry)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="group relative flex items-start gap-4">
                            {/* Timeline node */}
                            <div className="flex w-[100px] shrink-0 flex-col items-end pr-4">
                              <span className="text-[10px] font-medium text-zinc-400">{format(new Date(entry.created_at), "MMM d")}</span>
                              <span className="text-[9px] text-zinc-600">{format(new Date(entry.created_at), "h:mm a")}</span>
                              <div className="absolute right-[-4px] top-3 h-2.5 w-2.5 rounded-full border-2 border-[#0a0612] shadow-[0_0_10px_rgba(139,92,246,0.5)]" style={{ backgroundColor: info?.color || "#8b5cf6" }} />
                            </div>
                            
                            {/* Card */}
                            <div className="flex-1 overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.02] transition-all hover:border-white/[0.08] hover:bg-white/[0.04] hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]">
                              <div className="flex">
                                {/* Thumbnail */}
                                <div className="relative h-[90px] w-[130px] shrink-0 overflow-hidden">
                                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0612]/80" />
                                </div>
                                
                                {/* Content */}
                                <div className="flex flex-1 flex-col justify-between p-3">
                                  <div>
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="font-medium text-zinc-200">{info?.label || "Check-in"}</span>
                                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium text-violet-300">{entry.intensity}/10</span>
                                    </div>
                                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                                      {entry.notes || "A moment of emotional awareness captured in your journey."}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="flex gap-1">
                                      {entry.activities?.slice(0, 2).map((act, i) => (
                                        <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-zinc-500">{act}</span>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => toggleFavorite(entry)} className="rounded p-1 text-zinc-600 transition-colors hover:text-rose-400">
                                        <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-rose-400 text-rose-400")} />
                                      </button>
                                      <button className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                    
                    {recentCheckIns.length > 4 && (
                      <div className="mt-4 text-center">
                        <button className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:bg-white/[0.06]">
                          Show more entries
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Calendar + Heatmap Row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-2 gap-5">
              {/* Mood Calendar */}
              <div className="rounded-2xl border border-white/[0.05] bg-black/20 p-5">
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">Mood calendar</h3>
                    <p className="text-[10px] text-zinc-500">Your mood at a glance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={goToPreviousCalendarMonth} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[100px] text-center text-sm font-medium text-zinc-300">{format(calendarDate, "MMMM yyyy")}</span>
                    <button onClick={goToNextCalendarMonth} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Calendar Grid */}
                <div className="mt-4">
                  {/* Weekday headers */}
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <div key={day} className="py-1 text-center text-[10px] font-medium text-zinc-500">{day}</div>
                    ))}
                  </div>
                  
                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarData.map((day, i) => {
                      const isHighlighted = Boolean(day.emoji && day.isCurrentMonth);
                      return (
                        <div
                          key={i}
                          title={day.label ? `${day.label}` : undefined}
                          className={cn(
                            "relative flex h-10 flex-col items-center justify-center rounded-lg transition-all",
                            day.isCurrentMonth ? "hover:bg-white/[0.05]" : "opacity-30",
                          )}
                          style={
                            isHighlighted && day.color
                              ? { backgroundColor: `${day.color}28`, boxShadow: `inset 0 0 0 1px ${day.color}40` }
                              : undefined
                          }
                        >
                          <span className={cn("text-[11px]", day.isCurrentMonth ? (day.emoji ? "font-medium text-zinc-200" : "text-zinc-500") : "text-zinc-700")}>
                            {day.day}
                          </span>
                          {day.emoji && day.isCurrentMonth && (
                            <div className="mt-0.5">
                              <FluentEmoji emoji={day.emoji} size={16} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Legend — current check-in moods */}
                <div className="mt-4 border-t border-white/[0.05] pt-3">
                  <p className="mb-2 text-center text-[10px] text-zinc-500">Moods</p>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                    {MOOD_CALENDAR_LEGEND.map((item) => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <FluentEmoji emoji={item.emoji} size={12} />
                        <span className="text-[9px] text-zinc-400">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Emotional Heatmap */}
              <div className="rounded-2xl border border-white/[0.05] bg-black/20 p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-zinc-200">Emotional heatmap</h3>
                  <p className="text-[10px] text-zinc-500">Your emotional intensity throughout the week</p>
                </div>
                
                {/* Heatmap Grid */}
                <div className="space-y-2">
                  {/* Column headers (days) */}
                  <div className="ml-[70px] grid grid-cols-7 gap-1">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <div key={day} className="text-center text-[10px] font-medium text-zinc-500">{day}</div>
                    ))}
                  </div>
                  
                  {/* Rows (time of day) */}
                  {[
                    { label: "Morning", data: heatmapData[0] || [0,0,0,0,0,0,0] },
                    { label: "Afternoon", data: heatmapData[1] || [0,0,0,0,0,0,0] },
                    { label: "Evening", data: heatmapData[2] || [0,0,0,0,0,0,0] },
                    { label: "Night", data: heatmapData[3] || [0,0,0,0,0,0,0] },
                  ].map((row, ri) => (
                    <div key={ri} className="flex items-center gap-2">
                      <span className="w-[62px] text-right text-[10px] text-zinc-500">{row.label}</span>
                      <div className="grid flex-1 grid-cols-7 gap-1">
                        {row.data.map((value, di) => (
                          <div
                            key={di}
                            className="h-7 rounded-md transition-all"
                            style={{
                              backgroundColor: value >= 8 ? "rgba(139,92,246,0.7)" : value >= 6 ? "rgba(139,92,246,0.5)" : value >= 4 ? "rgba(139,92,246,0.35)" : value >= 2 ? "rgba(139,92,246,0.2)" : value > 0 ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.03)",
                              boxShadow: value >= 6 ? "0 0 12px rgba(139,92,246,0.3)" : "none",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/[0.05] pt-3">
                  <span className="text-[10px] text-zinc-500">Low</span>
                  <div className="flex items-center gap-1">
                    {[0.1, 0.2, 0.35, 0.5, 0.7].map((opacity, i) => (
                      <div
                        key={i}
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: `rgba(139,92,246,${opacity})` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500">High</span>
                </div>
              </div>
            </motion.div>

            {/* Bottom Support Dock */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <SolacePanel glow="violet" soft className="overflow-hidden rounded-2xl">
                <div className="px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">When you need a hand</p>
                      <p className="text-sm font-medium text-zinc-200">Need support right now?</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/app/emergency-resources" className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-medium text-rose-300 transition-all hover:bg-rose-500/15">
                        <Phone className="h-3 w-3" /> Emergency Resources
                      </Link>
                      <Link to="/app/session-lobby" className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-zinc-300 transition-all hover:bg-white/[0.06]">
                        <Video className="h-3 w-3" /> Talk It Out
                      </Link>
                      <Link to="/app/settings/wellness-plan" className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-zinc-300 transition-all hover:bg-white/[0.06]">
                        <Shield className="h-3 w-3" /> Safety Plan
                      </Link>
                      <Link to="/app/settings/resources" className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-zinc-300 transition-all hover:bg-white/[0.06]">
                        <BookMarked className="h-3 w-3" /> Reading Library
                      </Link>
                    </div>
                  </div>
                </div>
              </SolacePanel>
            </motion.div>
          </div>

          {/* Right Rail - Compact Stacked Cards */}
          <aside className="hidden w-[280px] shrink-0 space-y-3 lg:block">
            {/* Your Pattern - Line Graph */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Your Pattern</h3>
              </div>
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={patternChartData}>
                    <defs>
                      <linearGradient id="patternGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#patternGradient)" />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={[0, 10]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-zinc-600">
                {patternChartData.map((d, i) => <span key={i}>{d.name}</span>)}
              </div>
            </motion.div>

            {/* Reflection Prompt */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-cyan-500/10 to-blue-600/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Reflection</h3>
              </div>
              <p className="font-serif text-sm italic leading-relaxed text-zinc-300">
                &ldquo;{reflectionPrompt}&rdquo;
              </p>
              <button onClick={() => navigate("/app/session-lobby")} className="mt-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 text-[10px] font-medium text-zinc-400 transition-all hover:bg-white/[0.06]">
                Reflect now
              </button>
            </motion.div>

            {/* Your Companion */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30">
              {companionPreview.cardImage && (
                <div className="relative h-20 overflow-hidden">
                  <img src={companionPreview.cardImage} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0612] via-[#0a0612]/50 to-transparent" />
                </div>
              )}
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Heart className="h-3.5 w-3.5 text-rose-400" />
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Your Companion</h3>
                </div>
                <p className="mb-1 text-sm font-medium text-zinc-200">{companionPreview.name}</p>
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  Here to support your emotional wellbeing with care and understanding.
                </p>
              </div>
            </motion.div>

            {/* Emotional Streak */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-amber-500/10 to-orange-600/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Emotional Streak</h3>
              </div>
              
              {/* Circular streak visualization */}
              <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="35" fill="none" stroke="url(#streakGradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(streakDays / 30) * 220} 220`} transform="rotate(-90 40 40)" />
                  <defs>
                    <linearGradient id="streakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="text-center">
                  <span className="text-2xl font-bold text-amber-400">{streakDays}</span>
                  <p className="text-[9px] text-zinc-500">days</p>
                </div>
              </div>
              
              <p className="text-center text-[10px] text-zinc-500">
                {streakDays > 0 ? "Keep nurturing your emotional awareness!" : "Start your streak today!"}
              </p>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#060a12]">
      <div className="mx-auto max-w-[1400px] px-6 py-5">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-10 w-48 bg-zinc-800" />
          <Skeleton className="h-8 w-20 bg-zinc-800" />
        </div>
        <div className="flex gap-5">
          <div className="flex-1 space-y-5">
            <Skeleton className="h-[200px] rounded-[1.75rem] bg-zinc-800" />
            <div className="grid grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[90px] rounded-2xl bg-zinc-800" />)}
            </div>
            <Skeleton className="h-[280px] rounded-2xl bg-zinc-800" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-[180px] rounded-2xl bg-zinc-800" />
              <Skeleton className="h-[180px] rounded-2xl bg-zinc-800" />
            </div>
          </div>
          <div className="hidden w-[280px] space-y-3 lg:block">
            {[120, 100, 140, 130].map((h, i) => <Skeleton key={i} className="rounded-2xl bg-zinc-800" style={{ height: h }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
