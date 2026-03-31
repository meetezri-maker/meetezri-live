import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  Calendar,
  TrendingUp,
  Heart,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Star
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../../components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears } from "date-fns";

interface MoodEntry {
  id: string;
  created_at: string;
  mood: string;
  intensity: number;
  activities?: string[];
  notes?: string;
  source: 'journal' | 'check-in';
}

const MOOD_MAPPING: Record<string, { label: string; score: number; color: string }> = {
  "😊": { label: "Happy", score: 10, color: "#fbbf24" }, // amber-400
  "😌": { label: "Calm", score: 8, color: "#3b82f6" },  // blue-500
  "🤩": { label: "Excited", score: 9, color: "#a855f7" }, // purple-500
  "😰": { label: "Anxious", score: 4, color: "#f97316" }, // orange-500
  "😢": { label: "Sad", score: 2, color: "#6366f1" },    // indigo-500
  "😡": { label: "Angry", score: 1, color: "#ef4444" },   // red-500
  "😴": { label: "Tired", score: 5, color: "#6b7280" },   // gray-500
  "😐": { label: "Neutral", score: 6, color: "#94a3b8" }  // slate-400
};

// Helper to get mood info from emoji or label
const getMoodInfo = (mood: string) => {
  if (!mood) return null;
  const trimmedMood = mood.trim();
  const normalizedMood = trimmedMood.toLowerCase();

  const aliasToEmoji: Record<string, string> = {
    happy: "😊",
    calm: "😌",
    excited: "🤩",
    anxious: "😰",
    sad: "😢",
    angry: "😡",
    tired: "😴",
    neutral: "😐",
    "😠": "😡"
  };
  
  // Try direct lookup (emoji)
  if (MOOD_MAPPING[trimmedMood]) return { ...MOOD_MAPPING[trimmedMood], emoji: trimmedMood };

  // Try lookup by known aliases (lowercase values from API)
  const mappedEmoji = aliasToEmoji[normalizedMood];
  if (mappedEmoji && MOOD_MAPPING[mappedEmoji]) {
    return { ...MOOD_MAPPING[mappedEmoji], emoji: mappedEmoji };
  }
  
  // Try finding by label (case-insensitive)
  const entry = Object.entries(MOOD_MAPPING).find(([emoji, info]) =>
    info.label.toLowerCase() === normalizedMood
  );
  if (entry) return { ...entry[1], emoji: entry[0] };

  // If a custom emoji is saved in DB, still show it in calendar/list.
  if (/[\u{1F300}-\u{1FAFF}]/u.test(trimmedMood)) {
    return {
      label: "Mood",
      score: 5,
      color: "#9ca3af",
      emoji: trimmedMood
    };
  }
  
  return null;
};

const ACTIVITY_MAPPING: Record<string, { label: string; emoji: string }> = {
  work: { label: "Work", emoji: "💼" },
  exercise: { label: "Exercise", emoji: "🏃" },
  social: { label: "Social", emoji: "👥" },
  rest: { label: "Rest", emoji: "🛌" },
  hobby: { label: "Hobby", emoji: "🎨" },
  family: { label: "Family", emoji: "👨‍👩‍👧" }
};

export function MoodHistory() {
  const { profile } = useAuth();
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Mood History is a Core Feature</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock detailed mood history, trends, and analytics.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [selectedView, setSelectedView] = useState<"week" | "month" | "year">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteEntryIds, setFavoriteEntryIds] = useState<string[]>([]);

  const getPeriodRange = () => {
    if (selectedView === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    }
    if (selectedView === "month") {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
    return {
      start: startOfYear(currentDate),
      end: endOfYear(currentDate)
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [journalData, moodData] = await Promise.all([
        api.journal.getAll().catch(() => []),
        api.moods.getMyMoods().catch(() => [])
      ]);

      const normalizedJournal: MoodEntry[] = (journalData || []).map((j: any) => {
        const mood = j.mood_tags?.[0] || "";
        const info = getMoodInfo(mood);
        return {
          id: j.id,
          created_at: j.created_at,
          mood: mood,
          intensity: info?.score || 5,
          notes: j.content,
          source: 'journal' as const
        };
      }).filter((e: MoodEntry) => e.mood);

      const normalizedMoods: MoodEntry[] = (moodData || []).map((m: any) => ({
        id: m.id,
        created_at: m.created_at,
        mood: m.mood,
        intensity: m.intensity,
        activities: m.activities,
        notes: m.notes,
        source: 'check-in' as const
      }));

      const allEntries = [...normalizedJournal, ...normalizedMoods].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log("Loaded entries:", allEntries);
      setEntries(allEntries);
    } catch (error) {
      console.error("Failed to load mood history:", error);
    } finally {
      setLoading(false);
    }
  };

  // Functions to navigate dates based on view
  const goToPrevious = () => {
    setCurrentDate(prev => {
      if (selectedView === "week") return subWeeks(prev, 1);
      if (selectedView === "month") return subMonths(prev, 1);
      return subYears(prev, 1);
    });
  };

  const goToNext = () => {
    setCurrentDate(prev => {
      if (selectedView === "week") return addWeeks(prev, 1);
      if (selectedView === "month") return addMonths(prev, 1);
      return addYears(prev, 1);
    });
  };

  const goToPreviousCalendarMonth = () => {
    setCalendarDate((prev) => subMonths(prev, 1));
  };

  const goToNextCalendarMonth = () => {
    setCalendarDate((prev) => addMonths(prev, 1));
  };

  const exportCurrentPeriod = () => {
    const { start, end } = getPeriodRange();
    const periodEntries = entries
      .filter((entry) => {
        const date = new Date(entry.created_at);
        return date >= start && date <= end;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (periodEntries.length === 0) {
      return;
    }

    const csvRows = [
      ["Date", "Mood", "Mood Label", "Intensity", "Source", "Activities", "Notes"].join(","),
      ...periodEntries.map((entry) => {
        const info = getMoodInfo(entry.mood);
        const values = [
          format(new Date(entry.created_at), "yyyy-MM-dd HH:mm"),
          entry.mood,
          info?.label ?? "",
          String(entry.intensity),
          entry.source,
          entry.activities?.join(" | ") ?? "",
          entry.notes ?? ""
        ];
        return values
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",");
      })
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
    setFavoriteEntryIds((prev) =>
      prev.includes(entryKey) ? prev.filter((id) => id !== entryKey) : [...prev, entryKey]
    );
  };

  const recentCheckIns = useMemo(() => {
    const fromCheckIns = entries.filter((entry) => entry.source === "check-in");
    return fromCheckIns.slice(0, 12);
  }, [entries]);

  const favoriteCount = useMemo(
    () => recentCheckIns.filter((entry) => favoriteEntryIds.includes(getEntryKey(entry))).length,
    [recentCheckIns, favoriteEntryIds]
  );

  const displayedCheckIns = useMemo(
    () =>
      showFavoritesOnly
        ? recentCheckIns.filter((entry) => favoriteEntryIds.includes(getEntryKey(entry)))
        : recentCheckIns,
    [showFavoritesOnly, recentCheckIns, favoriteEntryIds]
  );



  // Process data based on selected view and date
  const { chartData, distributionData, calendarData, insightsData } = useMemo(() => {
    let start, end;
    if (selectedView === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (selectedView === "month") {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
    }

    // Filter entries for the current period
    const periodEntries = entries.filter(entry => {
      const date = new Date(entry.created_at);
      return date >= start && date <= end;
    });
    const periodCheckIns = periodEntries.filter((e) => e.source === "check-in");
    const periodInsightEntries = periodCheckIns.length > 0 ? periodCheckIns : periodEntries;

    // 1. Chart Data (Mood Trend)
    const days = eachDayOfInterval({ start, end });
    const chartData = days.map(day => {
      const dayEntries = periodEntries.filter(e => isSameDay(new Date(e.created_at), day));
      if (dayEntries.length === 0) {
        return {
          day: format(day, selectedView === "week" ? "EEE" : selectedView === "month" ? "d" : "MMM"),
          fullDate: day,
          mood: null,
          intensity: null
        };
      }
      
      const totalScore = dayEntries.reduce((acc, entry) => {
        return acc + entry.intensity;
      }, 0);
      
      return {
        day: format(day, selectedView === "week" ? "EEE" : selectedView === "month" ? "d" : "MMM"),
        fullDate: day,
        mood: Number((totalScore / dayEntries.length).toFixed(1)),
        intensity: Math.floor(totalScore / dayEntries.length)
      };
    });

    // Aggregating for Year view
    let finalChartData = chartData;
    if (selectedView === "year") {
        const monthlyData: Record<string, { total: number; count: number }> = {};
        periodEntries.forEach(entry => {
            const month = format(new Date(entry.created_at), "MMM");
            if (!monthlyData[month]) monthlyData[month] = { total: 0, count: 0 };
            monthlyData[month].total += entry.intensity;
            monthlyData[month].count += 1;
        });
        finalChartData = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(currentDate.getFullYear(), i, 1);
            const month = format(d, "MMM");
            const data = monthlyData[month];
            
            if (data) {
                return {
                    day: month,
                    fullDate: d,
                    mood: Number((data.total / data.count).toFixed(1)),
                    intensity: Math.floor(data.total / data.count)
                };
            }
            
            return {
                day: month,
                fullDate: d,
                mood: null,
                intensity: null
            };
        });
    }

    // 2. Mood Distribution
    const distributionCounts: Record<string, number> = {};
    periodEntries.forEach(entry => {
      const info = getMoodInfo(entry.mood);
      const label = info?.label || "Unknown";
      distributionCounts[label] = (distributionCounts[label] || 0) + 1;
    });
    
    const distributionData = Object.entries(distributionCounts).map(([name, value]) => {
        // Find color
        const mapping = Object.values(MOOD_MAPPING).find(m => m.label === name);
        return { name, value, color: mapping?.color || "#9ca3af" };
    });

    // 3. Calendar Data
    let calendarData: any[] = [];
    {
        const monthStart = startOfMonth(calendarDate);
        const monthEnd = endOfMonth(calendarDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
        
        const calendarInterval = eachDayOfInterval({ start: startDate, end: endDate });
        calendarData = calendarInterval.map(day => {
            // Prefer latest check-in entry; fallback to latest journal entry.
            const dayEntries = entries.filter(e => isSameDay(new Date(e.created_at), day));
            const latestCheckIn = dayEntries
              .filter((entry) => entry.source === "check-in")
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const latestAny = dayEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const dayEntry = latestCheckIn || latestAny;
            
            const info = dayEntry ? getMoodInfo(dayEntry.mood) : null;
            
            return {
                day: day.getDate(),
                isCurrentMonth: day.getMonth() === calendarDate.getMonth(),
                mood: dayEntry?.intensity,
                emoji: info?.emoji || "",
                date: day
            };
        });
    }

    // 4. Insights
    // Average mood for the selected period (prefer check-ins; fallback to journals if no check-ins).
    const currAvg =
      periodInsightEntries.length > 0
        ? periodInsightEntries.reduce((acc, e) => acc + e.intensity, 0) / periodInsightEntries.length
        : 0;
    const avgMood = periodInsightEntries.length > 0 ? currAvg.toFixed(1) : null;

    // Mood trend vs previous period (aligned with the selected view).
    let prevStart: Date;
    let prevEnd: Date;
    if (selectedView === "week") {
      prevStart = startOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 1 });
      prevEnd = endOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 1 });
    } else if (selectedView === "month") {
      prevStart = startOfMonth(subMonths(currentDate, 1));
      prevEnd = endOfMonth(subMonths(currentDate, 1));
    } else {
      prevStart = startOfYear(subYears(currentDate, 1));
      prevEnd = endOfYear(subYears(currentDate, 1));
    }

    const prevPeriodEntries = entries.filter((e) => {
      const d = new Date(e.created_at);
      return d >= prevStart && d <= prevEnd;
    });
    const prevPeriodCheckIns = prevPeriodEntries.filter((e) => e.source === "check-in");
    const prevPeriodInsightEntries =
      prevPeriodCheckIns.length > 0 ? prevPeriodCheckIns : prevPeriodEntries;

    const prevAvg =
      prevPeriodInsightEntries.length > 0
        ? prevPeriodInsightEntries.reduce((acc, e) => acc + e.intensity, 0) /
          prevPeriodInsightEntries.length
        : 0;

    let trendPercent: number | null;
    if (prevPeriodInsightEntries.length === 0 && periodInsightEntries.length > 0) {
      trendPercent = null; // nothing to compare against yet
    } else if (prevAvg > 0 && periodInsightEntries.length > 0) {
      trendPercent = ((currAvg - prevAvg) / prevAvg) * 100;
    } else {
      trendPercent = 0;
    }

    // Best day = weekday of the best *date* average within the period.
    // Only consider "happy" moods (exclude anxious/sad/tired/angry).
    const excludedBestDayLabels = new Set(["Angry", "Tired", "Anxious", "Sad"]);
    const bestDayEntries = periodInsightEntries.filter((e) => {
      const info = getMoodInfo(e.mood);
      const label = info?.label || "";
      return !excludedBestDayLabels.has(label);
    });

    // We average entries per date first, then pick the best date.
    const dateBuckets: Record<string, { total: number; count: number; date: Date }> = {};
    bestDayEntries.forEach((e) => {
      const d = new Date(e.created_at);
      const key = format(d, "yyyy-MM-dd");
      if (!dateBuckets[key]) {
        dateBuckets[key] = {
          total: 0,
          count: 0,
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate())
        };
      }
      dateBuckets[key].total += e.intensity;
      dateBuckets[key].count += 1;
    });
    let bestDay = "N/A";
    let maxDailyAvg = -1;
    Object.values(dateBuckets).forEach((bucket) => {
      const dailyAvg = bucket.total / bucket.count;
      if (dailyAvg > maxDailyAvg) {
        maxDailyAvg = dailyAvg;
        bestDay = format(bucket.date, "EEEE");
      }
    });

    const insightsData = [
        {
          icon: TrendingUp,
          title: "Mood Trend",
          value:
            trendPercent === null
              ? "—"
              : `${trendPercent > 0 ? "+" : ""}${trendPercent.toFixed(0)}%`,
          description: trendPercent === null ? "No prior period to compare" : "Vs previous period",
          color:
            trendPercent === null
              ? "text-slate-500"
              : trendPercent >= 0
                ? "text-green-500"
                : "text-red-500",
          bgColor:
            trendPercent === null
              ? "bg-slate-50"
              : trendPercent >= 0
                ? "bg-green-50"
                : "bg-red-50"
        },
        {
          icon: Heart,
          title: "Average Mood",
          value: avgMood === null ? "—" : `${avgMood}/10`,
          description: avgMood === null ? "No entries this period" : "This period",
          color: "text-blue-500",
          bgColor: "bg-blue-50"
        },
        {
          icon: Calendar,
          title: "Check-ins",
          value: periodCheckIns.length.toString(),
          description: "Total check-ins",
          color: "text-purple-500",
          bgColor: "bg-purple-50"
        },
        {
          icon: BarChart3,
          title: "Best Day",
          value: bestDay,
          description: "Highest average mood",
          color: "text-amber-500",
          bgColor: "bg-amber-50"
        }
    ];

    return { chartData: finalChartData, distributionData, calendarData, insightsData };
  }, [selectedView, currentDate, calendarDate, entries]);


  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold mb-2">Mood History</h1>
              <p className="text-muted-foreground">
                Track your emotional journey over time
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportCurrentPeriod}
              disabled={entries.length === 0}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="p-4 shadow-lg">
                  <div className="space-y-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-40 mb-4" />
                <Skeleton className="h-64 w-full" />
              </Card>
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <Skeleton className="h-64 w-full" />
                  </div>
                  <div className="w-1/2 space-y-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-3 w-8" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <>
            {/* Insights Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {insightsData.map((insight, index) => {
                const Icon = insight.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                  >
                    <Card className={`p-4 shadow-lg ${insight.bgColor}`}>
                      <Icon className={`w-6 h-6 mb-2 ${insight.color}`} />
                      <p className="text-sm text-muted-foreground mb-1">{insight.title}</p>
                      <p className="text-2xl font-bold mb-1">{insight.value}</p>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* View Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4"
            >
              <div className="flex gap-2 bg-white p-1 rounded-lg inline-flex shadow-md">
                {(["week", "month", "year"] as const).map((view) => (
                  <motion.button
                    key={view}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedView(view)}
                    className={`px-6 py-2 rounded-md font-medium transition-all ${
                      selectedView === view
                        ? "bg-primary text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm">
                <button onClick={goToPrevious} className="p-1 hover:bg-gray-100 rounded-full">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-medium min-w-[120px] text-center">
                  {selectedView === "week" && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")}`}
                  {selectedView === "month" && format(currentDate, "MMMM yyyy")}
                  {selectedView === "year" && format(currentDate, "yyyy")}
                </span>
                <button onClick={goToNext} className="p-1 hover:bg-gray-100 rounded-full">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Mood Trend Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-6 shadow-xl">
                  <h2 className="text-xl font-bold mb-4">Mood Trend</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="day" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#6b7280" }} 
                      />
                      <YAxis 
                        hide 
                        domain={[0, 10]} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        formatter={(value: any) => [`${value}/10`, "Mood Score"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="mood"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4, stroke: "#fff" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              {/* Mood Distribution */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="p-6 shadow-xl">
                  <h2 className="text-xl font-bold mb-4">Mood Distribution</h2>
                  <div className="flex items-center">
                    <div className="w-1/2">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 space-y-3">
                      {distributionData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm text-gray-600">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold">{item.value}</span>
                        </div>
                      ))}
                      {distributionData.length === 0 && (
                         <div className="text-center text-gray-500 text-sm">No data available</div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Emotion Intensity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mb-6"
            >
              <Card className="p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">Emotion Intensity</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280" }}
                    />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                      }}
                      formatter={(value: any) => [`${value ?? 0}/10`, "Intensity"]}
                    />
                    <Bar dataKey="intensity" fill="#a855f7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>

            {/* Calendar View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Calendar View</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPreviousCalendarMonth}
                      className="p-2 rounded-full hover:bg-gray-100"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-medium min-w-[120px] text-center">
                      {format(calendarDate, "MMMM yyyy")}
                    </span>
                    <button
                      onClick={goToNextCalendarMonth}
                      className="p-2 rounded-full hover:bg-gray-100"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                      {day}
                    </div>
                  ))}
                  {calendarData.map((day, index) => (
                    <div
                      key={index}
                      className={`
                        aspect-square rounded-xl p-2 transition-all relative group
                        ${day.isCurrentMonth ? "bg-gray-50 hover:bg-gray-100" : "opacity-30"}
                          ${day.emoji ? "cursor-pointer" : ""}
                      `}
                    >
                      <span className="text-xs text-gray-400 font-medium">{day.day}</span>
                      {day.emoji && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          {day.emoji}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Recent Check-ins */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="mt-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {showFavoritesOnly ? `Favourite Check-ins (${favoriteCount})` : "Recent Check-ins"}
                </h2>
                <button
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                    showFavoritesOnly
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {showFavoritesOnly ? "Show All" : `View Favourites (${favoriteCount})`}
                </button>
              </div>

              <div className="space-y-3">
                {displayedCheckIns.length === 0 && (
                  <Card className="p-8 text-center text-muted-foreground shadow-md">
                    <Heart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>
                      {showFavoritesOnly
                        ? "No favourite check-ins yet. Tap the star on any entry to save it."
                        : "No recent check-ins available yet."}
                    </p>
                  </Card>
                )}

                {displayedCheckIns.map((entry) => {
                  const info = getMoodInfo(entry.mood);
                  const isFavorite = favoriteEntryIds.includes(getEntryKey(entry));
                  const activities = (entry.activities || [])
                    .map((value) => {
                      const key = String(value || "").trim().toLowerCase();
                      const mapped = ACTIVITY_MAPPING[key];
                      return mapped
                        ? { value: key, ...mapped }
                        : key
                          ? { value: key, label: key, emoji: "•" }
                          : null;
                    })
                    .filter(Boolean) as Array<{ value: string; label: string; emoji: string }>;
                  return (
                    <motion.div
                      key={getEntryKey(entry)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ y: -2 }}
                    >
                      <Card className="p-4 shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{info?.emoji || "🙂"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold">{info?.label || entry.mood}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {entry.notes || "No notes added"}
                            </p>
                            {activities.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                              <p className="text-sm font-bold text-muted-foreground">Activity:</p>
                                {activities.map((a) => (
                                  <span
                                    key={`${entry.id}-${a.value}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs"
                                    title={a.label}
                                  >
                                    <span className="text-sm leading-none">{a.emoji}</span>
                                    <span className="leading-none">{a.label}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">{entry.intensity}/10</div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.85 }}
                              onClick={() => toggleFavorite(entry)}
                              className="p-1.5 rounded-full hover:bg-amber-50 transition-colors"
                              title={isFavorite ? "Remove from favourites" : "Add to favourites"}
                            >
                              <Star
                                className={`w-5 h-5 transition-all ${
                                  isFavorite
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-gray-300 hover:text-amber-400"
                                }`}
                              />
                            </motion.button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
