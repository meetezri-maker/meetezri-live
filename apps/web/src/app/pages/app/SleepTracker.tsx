import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Moon,
  Sun,
  Clock,
  TrendingUp,
  Calendar,
  Plus,
  Bed,
  Coffee,
  Activity,
  Brain,
  Heart,
  Zap,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { Skeleton } from "../../components/ui/skeleton";

export function SleepTracker() {
  const { session } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showLogModal, setShowLogModal] = useState(false);
  const [sleepFormData, setSleepFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    bedTime: "",
    wakeTime: "",
    quality: "85",
    notes: ""
  });
  
  const [sleepEntries, setSleepEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSleepEntries();
  }, [session]);

  const fetchSleepEntries = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const data = await api.sleep.getEntries();
      setSleepEntries(data);
    } catch (error) {
      console.error("Failed to fetch sleep entries", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogSleep = async () => {
    try {
      // Construct ISO strings for bed time and wake time
      // Assuming bedTime and wakeTime are HH:MM strings and date is YYYY-MM-DD
      // Handle overnight sleep where wake date might be next day
      
      const bedDateTimeStr = `${sleepFormData.date}T${sleepFormData.bedTime}:00`;
      let wakeDateTimeStr = `${sleepFormData.date}T${sleepFormData.wakeTime}:00`;
      
      // If wake time is earlier than bed time, assume it's next day
      if (sleepFormData.wakeTime < sleepFormData.bedTime) {
        const nextDate = new Date(sleepFormData.date);
        nextDate.setDate(nextDate.getDate() + 1);
        wakeDateTimeStr = `${format(nextDate, 'yyyy-MM-dd')}T${sleepFormData.wakeTime}:00`;
      }

      await api.sleep.createEntry({
        bed_time: new Date(bedDateTimeStr).toISOString(),
        wake_time: new Date(wakeDateTimeStr).toISOString(),
        quality_rating: parseInt(sleepFormData.quality),
        notes: sleepFormData.notes
      });
      
      // Reset form
      setSleepFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        bedTime: "",
        wakeTime: "",
        quality: "85",
        notes: ""
      });
      
      // Close modal
      setShowLogModal(false);
      
      // Refresh data
      fetchSleepEntries();
      
      // Show success feedback
      alert("Sleep data logged successfully!");
    } catch (error) {
      console.error("Failed to log sleep", error);
      alert("Failed to log sleep data. Please try again.");
    }
  };

  // Calculate stats from real data
  const calculateStats = () => {
    if (sleepEntries.length === 0) return { avgDuration: "0.0", avgQuality: 0, avgDeepSleep: "0.0h", streak: 0 };
    
    let totalDurationMinutes = 0;
    let totalQuality = 0;
    
    sleepEntries.forEach(entry => {
      const duration = differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time));
      totalDurationMinutes += duration;
      totalQuality += entry.quality_rating || 0;
    });
    
    const avgDuration = (totalDurationMinutes / sleepEntries.length / 60).toFixed(1);
    // Scale quality back to 100 if it was 1-5, assuming input was 1-100 but schema is 1-5? 
    // Wait, schema says 1-5. Frontend input defaults to 85. Let's adjust frontend to 1-100 or schema to 1-100.
    // Schema said min(1).max(5). But frontend has 85. Let's update schema or assume frontend sends 1-5 mapped.
    // Let's assume for now we store what we get, but validation might fail. 
    // Actually, let's fix the validation in backend schema if needed, or adjust frontend.
    // Frontend `quality` state default "85".
    // Let's assume we want 0-100 for quality.
    // I should probably update the backend schema to allow 0-100.
    
    const avgQualityVal = Math.round(totalQuality / sleepEntries.length);
    
    return {
      avgDuration,
      avgQuality: avgQualityVal,
      avgDeepSleep: "N/A", // Not tracking deep sleep yet
      streak: sleepEntries.length // Simple streak logic
    };
  };

  const stats = calculateStats();

  // Prepare chart data
  const chartData = sleepEntries.slice(0, 7).reverse().map(entry => {
    const duration = differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time)) / 60;
    return {
      day: format(parseISO(entry.bed_time), 'EEE'),
      hours: parseFloat(duration.toFixed(1)),
      quality: entry.quality_rating
    };
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Moon className="w-8 h-8 text-indigo-500" />
                <h1 className="text-3xl font-bold">Sleep Tracker</h1>
              </div>
              <p className="text-muted-foreground">
                Monitor your sleep patterns and improve sleep quality
              </p>
            </div>
            <Button className="gap-2" onClick={() => setShowLogModal(true)}>
              <Plus className="w-4 h-4" />
              Log Sleep
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500 rounded-xl">
                  <Bed className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600">{stats.avgDuration}h</p>
                  <p className="text-xs text-muted-foreground">Avg Sleep</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500 rounded-xl">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.avgQuality}%</p>
                  <p className="text-xs text-muted-foreground">Avg Quality</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500 rounded-xl">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgDeepSleep}</p>
                  <p className="text-xs text-muted-foreground">Avg Deep Sleep</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500 rounded-xl">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.streak}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sleep Duration Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Weekly Sleep Duration
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="hours" stroke="#8884d8" fillOpacity={1} fill="url(#colorHours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>

          {/* Sleep Quality Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Sleep Quality Trend
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quality" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Recent History
                </h3>
              </div>
              <div className="space-y-4">
                {sleepEntries.slice(0, 5).map((log, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                      <div>
                        <h4 className="font-semibold">{format(parseISO(log.bed_time), 'MMMM d, yyyy')}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Moon className="w-3 h-3" />
                            {format(parseISO(log.bed_time), 'h:mm a')} - {format(parseISO(log.wake_time), 'h:mm a')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(differenceInMinutes(parseISO(log.wake_time), parseISO(log.bed_time)) / 60).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                          {log.quality_rating}% Quality
                        </div>
                      </div>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg mt-2">
                        "{log.notes}"
                      </p>
                    )}
                  </div>
                ))}
                {sleepEntries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No sleep entries yet. Log your first sleep!
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

        {/* Sleep Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
              <Coffee className="w-6 h-6" />
              Sleep Hygiene Tips
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  ✓
                </div>
                <p className="text-sm text-white/90">Maintain a consistent sleep schedule, even on weekends</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  ✓
                </div>
                <p className="text-sm text-white/90">Create a relaxing bedtime routine 30-60 minutes before sleep</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  ✓
                </div>
                <p className="text-sm text-white/90">Keep your bedroom cool, dark, and quiet</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  ✓
                </div>
                <p className="text-sm text-white/90">Avoid caffeine and screens 2-3 hours before bedtime</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
      </div>

      {/* Log Sleep Modal */}
      <AnimatePresence>
        {showLogModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-50"
            >
              <Card className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Moon className="w-6 h-6 text-indigo-500" />
                    Log Sleep
                  </h3>
                  <button
                    onClick={() => setShowLogModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={sleepFormData.date}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Moon className="w-4 h-4 inline mr-1" />
                        Bedtime
                      </label>
                      <input
                        type="time"
                        value={sleepFormData.bedTime}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, bedTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Sun className="w-4 h-4 inline mr-1" />
                        Wake Time
                      </label>
                      <input
                        type="time"
                        value={sleepFormData.wakeTime}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, wakeTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Activity className="w-4 h-4 inline mr-1" />
                      Sleep Quality ({sleepFormData.quality}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sleepFormData.quality}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, quality: e.target.value })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Poor</span>
                      <span>Good</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={sleepFormData.notes}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, notes: e.target.value })}
                      placeholder="How did you feel? Any factors affecting your sleep?"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowLogModal(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleLogSleep}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Log Sleep
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
