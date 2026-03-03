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
  Lock
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
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
  "😡": { label: "Angry", score: 1, color: "#ef4444" }    // red-500
};

// Helper to get mood info from emoji or label
const getMoodInfo = (mood: string) => {
  if (!mood) return null;
  
  // Try direct lookup (emoji)
  if (MOOD_MAPPING[mood]) return { ...MOOD_MAPPING[mood], emoji: mood };
  
  // Try finding by label (case-insensitive)
  const entry = Object.entries(MOOD_MAPPING).find(([emoji, info]) => 
    info.label.toLowerCase() === mood.toLowerCase()
  );
  if (entry) return { ...entry[1], emoji: entry[0] };
  
  return null;
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
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

    // 1. Chart Data (Mood Trend)
    const days = eachDayOfInterval({ start, end });
    const chartData = days.map(day => {
      const dayEntries = periodEntries.filter(e => isSameDay(new Date(e.created_at), day));
      if (dayEntries.length === 0) return { day: format(day, selectedView === "year" ? "MMM" : "EEE"), fullDate: day, mood: null, intensity: null };
      
      const totalScore = dayEntries.reduce((acc, entry) => {
        return acc + entry.intensity;
      }, 0);
      
      return {
        day: format(day, selectedView === "year" ? "MMM" : "EEE"),
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
    if (selectedView === "month") {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        
        const calendarInterval = eachDayOfInterval({ start: startDate, end: endDate });
        calendarData = calendarInterval.map(day => {
            // Find the latest entry for the day
            const dayEntries = periodEntries.filter(e => isSameDay(new Date(e.created_at), day));
            // Prefer check-in over journal if multiple? Or just latest.
            const dayEntry = dayEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            
            const info = dayEntry ? getMoodInfo(dayEntry.mood) : null;
            
            return {
                day: day.getDate(),
                isCurrentMonth: day.getMonth() === currentDate.getMonth(),
                mood: dayEntry?.intensity,
                emoji: info?.emoji || "",
                date: day
            };
        });
    }

    // 4. Insights
    const avgMood = periodEntries.length > 0 
        ? (periodEntries.reduce((acc, e) => acc + e.intensity, 0) / periodEntries.length).toFixed(1)
        : "0";
    
    const midPoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    const firstHalf = periodEntries.filter(e => new Date(e.created_at) < midPoint);
    const secondHalf = periodEntries.filter(e => new Date(e.created_at) >= midPoint);
    const firstAvg = firstHalf.length ? firstHalf.reduce((acc, e) => acc + e.intensity, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length ? secondHalf.reduce((acc, e) => acc + e.intensity, 0) / secondHalf.length : 0;
    const trend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    // Find best day
    const dayCounts: Record<string, { total: number, count: number }> = {};
    periodEntries.forEach(e => {
        const dayName = format(new Date(e.created_at), "EEEE");
        if (!dayCounts[dayName]) dayCounts[dayName] = { total: 0, count: 0 };
        dayCounts[dayName].total += e.intensity;
        dayCounts[dayName].count++;
    });
    let bestDay = "N/A";
    let maxScore = -1;
    Object.entries(dayCounts).forEach(([day, data]) => {
        const avg = data.total / data.count;
        if (avg > maxScore) {
            maxScore = avg;
            bestDay = day;
        }
    });

    const insightsData = [
        {
          icon: TrendingUp,
          title: "Mood Trend",
          value: `${trend > 0 ? "+" : ""}${trend.toFixed(0)}%`,
          description: "Vs previous period",
          color: trend >= 0 ? "text-green-500" : "text-red-500",
          bgColor: trend >= 0 ? "bg-green-50" : "bg-red-50"
        },
        {
          icon: Heart,
          title: "Average Mood",
          value: `${avgMood}/10`,
          description: "This period",
          color: "text-blue-500",
          bgColor: "bg-blue-50"
        },
        {
          icon: Calendar,
          title: "Check-ins",
          value: periodEntries.length.toString(),
          description: "Total entries",
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
  }, [selectedView, currentDate, entries]);


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

            {/* Calendar View */}
            {selectedView === "month" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Monthly Overview</h2>
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
                          ${day.mood ? "cursor-pointer" : ""}
                        `}
                      >
                        <span className="text-xs text-gray-400 font-medium">{day.day}</span>
                        {day.mood && (
                          <div className="absolute inset-0 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            {day.emoji}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
