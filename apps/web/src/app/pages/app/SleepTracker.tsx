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
  Zap,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { Skeleton } from "../../components/ui/skeleton";

type SleepEntry = {
  id: string;
  bed_time: string;
  wake_time: string;
  quality_rating: number | null;
  notes: string | null;
};

export function SleepTracker() {
  const { session } = useAuth();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ kind: "error"; message: string } | null>(null);
  const [sleepFormData, setSleepFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    bedTime: "",
    wakeTime: "",
    quality: "85",
    notes: ""
  });
  
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSleepEntries();
  }, [session]);

  const fetchSleepEntries = async (options?: { silent?: boolean }) => {
    if (!session) {
      setSleepEntries([]);
      setIsLoading(false);
      return;
    }
    const silent = options?.silent === true;
    try {
      if (!silent) setIsLoading(true);
      const data = (await api.sleep.getEntries()) as SleepEntry[];
      setSleepEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch sleep entries", error);
      setSleepEntries([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleLogSleep = async () => {
    setModalFeedback(null);
    if (!sleepFormData.bedTime || !sleepFormData.wakeTime) {
      setModalFeedback({
        kind: "error",
        message: "Please set both bedtime and wake time.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const bedDateTimeStr = `${sleepFormData.date}T${sleepFormData.bedTime}:00`;
      let wakeDateTimeStr = `${sleepFormData.date}T${sleepFormData.wakeTime}:00`;

      if (sleepFormData.wakeTime < sleepFormData.bedTime) {
        const nextDate = new Date(sleepFormData.date);
        nextDate.setDate(nextDate.getDate() + 1);
        wakeDateTimeStr = `${format(nextDate, 'yyyy-MM-dd')}T${sleepFormData.wakeTime}:00`;
      }

      await api.sleep.createEntry({
        bed_time: new Date(bedDateTimeStr).toISOString(),
        wake_time: new Date(wakeDateTimeStr).toISOString(),
        quality_rating: parseInt(sleepFormData.quality, 10),
        notes: sleepFormData.notes || undefined,
      });

      setSleepFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        bedTime: "",
        wakeTime: "",
        quality: "85",
        notes: "",
      });

      setShowLogModal(false);
      setShowSuccessModal(true);
      await fetchSleepEntries({ silent: true });
    } catch (error) {
      console.error("Failed to log sleep", error);
      const message =
        error instanceof Error ? error.message : "Could not save your sleep entry. Please try again.";
      setModalFeedback({ kind: "error", message } as { kind: "error"; message: string });
    } finally {
      setIsSaving(false);
    }
  };

  const closeLogModal = () => {
    if (isSaving) return;
    setShowLogModal(false);
    setModalFeedback(null);
  };

  const safeNumber = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;

  // Calculate stats from real data
  const calculateStats = () => {
    if (sleepEntries.length === 0)
      return { avgDuration: "0.0", avgQuality: 0, avgDeepSleep: "0", streak: 0 };

    let totalDurationMinutes = 0;
    let qualitySum = 0;
    let qualityCount = 0;

    sleepEntries.forEach((entry) => {
      const duration = differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time));
      totalDurationMinutes += safeNumber(duration);
      if (entry.quality_rating != null) {
        qualitySum += safeNumber(entry.quality_rating);
        qualityCount += 1;
      }
    });

    const avgDuration = safeNumber(totalDurationMinutes / sleepEntries.length / 60).toFixed(1);
    const avgQualityVal =
      qualityCount > 0 ? safeNumber(Math.round(qualitySum / qualityCount)) : 0;

    return {
      avgDuration,
      avgQuality: avgQualityVal,
      avgDeepSleep: "0",
      streak: sleepEntries.length,
    };
  };

  const stats = calculateStats();

  // API returns entries newest-first; chart shows up to 7 most recent nights, oldest → newest on the X axis
  const chartData = sleepEntries
    .slice(0, 7)
    .reverse()
    .map((entry) => {
      const duration =
        differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time)) / 60;
      return {
        day: format(parseISO(entry.bed_time), "EEE"),
        hours: safeNumber(parseFloat(duration.toFixed(1))),
        quality: safeNumber(entry.quality_rating ?? 0),
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
            <Button
              className="gap-2"
              onClick={() => {
                setModalFeedback(null);
                setShowLogModal(true);
              }}
            >
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
                {sleepEntries.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
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
                          {log.quality_rating != null ? `${log.quality_rating}% quality` : "Quality not set"}
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

      {/* Sleep Saved Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-50"
            >
              <Card className="p-8 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Sleep Logged!</h3>
                  <p className="text-muted-foreground text-sm">
                    Your sleep entry was saved. You can log another night or close this window.
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600"
                    onClick={() => {
                      setShowSuccessModal(false);
                      setModalFeedback(null);
                      setShowLogModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Log Another
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Log Sleep Modal */}
      <AnimatePresence>
        {showLogModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLogModal}
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
                    type="button"
                    onClick={closeLogModal}
                    disabled={isSaving}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {modalFeedback && (
                  <div
                    role="alert"
                    className="mb-4 flex gap-2 rounded-lg border px-3 py-2.5 text-sm border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                    <span>{modalFeedback.message}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={sleepFormData.date}
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
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
                        disabled={isSaving}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, bedTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
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
                        disabled={isSaving}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, wakeTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
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
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, quality: e.target.value })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-60"
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
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, notes: e.target.value })}
                      placeholder="How did you feel? Any factors affecting your sleep?"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={closeLogModal}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleLogSleep}
                      isLoading={isSaving}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600"
                    >
                      {!isSaving && <Plus className="w-4 h-4" />}
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
