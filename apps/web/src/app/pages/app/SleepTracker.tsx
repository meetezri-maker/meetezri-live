import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Moon,
  Sun,
  Calendar,
  Plus,
  Bed,
  Activity,
  Brain,
  Zap,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wind,
  Leaf,
  Headphones,
  ChevronRight,
  Heart,
  Flower2,
  ArrowLeft,
  Star,
  BarChart3,
  Cloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { format, differenceInMinutes, parseISO, differenceInCalendarDays, addMinutes, addDays } from "date-fns";
import { Skeleton } from "@/app/components/ui/skeleton";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SolaceAmbientBackground,
  SolaceGlassCard,
  SolaceGlowButton,
  SolaceProgressRing,
  SolaceRightRailCard,
} from "@/app/solace";
import { usePrefersReducedMotion } from "@/app/pages/app/brain-health/usePrefersReducedMotion";
import { SLEEP_TRACKER_IMAGES } from "@/lib/solace/sleepTrackerImages";

type SleepEntry = {
  id: string;
  bed_time: string;
  wake_time: string;
  quality_rating: number | null;
  notes: string | null;
};

const SLEEP_HISTORY_PAGE_OPTIONS = [10, 20, 50] as const;

const JOURNEY_STAGES = [
  {
    id: "awareness",
    label: "Awareness",
    sub: "Track your sleep patterns",
    Icon: Moon,
  },
  {
    id: "understanding",
    label: "Understanding",
    sub: "Learn what affects your sleep",
    Icon: BarChart3,
  },
  {
    id: "consistency",
    label: "Consistency",
    sub: "Build a regular sleep routine",
    Icon: Flower2,
  },
  {
    id: "recovery",
    label: "Recovery",
    sub: "Improve your rest and energy",
    Icon: Heart,
  },
  {
    id: "transformation",
    label: "Transformation",
    sub: "Live your best, rested life",
    Icon: Star,
  },
] as const;

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function consecutiveSleepNightStreak(entries: SleepEntry[]): number {
  if (!entries.length) return 0;
  const keys = Array.from(
    new Set(entries.map((e) => format(parseISO(e.bed_time), "yyyy-MM-dd")))
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  if (!keys.length) return 0;
  let streak = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = parseISO(`${keys[i - 1]}T12:00:00`);
    const cur = parseISO(`${keys[i]}T12:00:00`);
    if (differenceInCalendarDays(prev, cur) === 1) streak += 1;
    else break;
  }
  return streak;
}

function durationHours(entry: SleepEntry): number {
  return safeNumber(differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time)) / 60);
}

function sleepMemoryLabel(hours: number, quality: number | null): { label: string; Icon: LucideIcon } {
  const q = quality ?? 0;
  if (hours < 5 || q < 45) return { label: "Interrupted Night", Icon: Zap };
  if (hours < 6.5 || q < 62) return { label: "Light Sleep", Icon: Activity };
  if (q >= 85 && hours >= 7) return { label: "Deep Recovery", Icon: Sparkles };
  if (q >= 72) return { label: "Restful Sleep", Icon: Heart };
  if (hours >= 7.5) return { label: "Calm Recovery", Icon: Moon };
  return { label: "Quiet Rest", Icon: Moon };
}

function thumbnailClassForId(id: string): string {
  const n = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 4;
  const palettes = [
    "from-indigo-950 via-violet-900 to-slate-950",
    "from-slate-950 via-cyan-950/80 to-indigo-950",
    "from-violet-950 via-fuchsia-950/70 to-slate-950",
    "from-sky-950/90 via-indigo-950 to-zinc-950",
  ];
  return palettes[n] ?? palettes[0];
}

function averageBedDate(entries: SleepEntry[]): Date | null {
  if (!entries.length) return null;
  const ref = new Date();
  ref.setHours(0, 0, 0, 0);
  let sum = 0;
  for (const e of entries) {
    const d = parseISO(e.bed_time);
    sum += d.getHours() * 60 + d.getMinutes();
  }
  const avg = Math.round(sum / entries.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  const t = new Date(ref);
  t.setHours(h, m, 0, 0);
  const now = new Date();
  if (t.getTime() <= now.getTime()) {
    t.setDate(t.getDate() + 1);
  }
  return t;
}

function windDownTarget(bedAvg: Date | null): Date | null {
  if (!bedAvg) return null;
  return addMinutes(bedAvg, -60);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Anytime you are ready";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function sleepConsistencyScore(entries: SleepEntry[]): number {
  const slice = entries.slice(0, 10);
  if (slice.length < 2) return slice.length === 1 ? 55 : 0;
  const hours = slice.map(durationHours);
  const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
  const variance =
    hours.reduce((acc, h) => acc + (h - mean) * (h - mean), 0) / hours.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - std * 22)));
}

function calmNightsCount(entries: SleepEntry[]): number {
  return entries.filter((e) => {
    const h = durationHours(e);
    const q = e.quality_rating ?? 0;
    return h >= 6.5 && q >= 72;
  }).length;
}

function interruptedNightsCount(entries: SleepEntry[]): number {
  return entries.filter((e) => {
    const h = durationHours(e);
    const q = e.quality_rating ?? 0;
    return h < 5 || q < 45;
  }).length;
}

function journeyStageIndex(entryCount: number): number {
  if (entryCount <= 0) return 0;
  if (entryCount <= 2) return 1;
  if (entryCount <= 6) return 2;
  if (entryCount <= 14) return 3;
  return 4;
}

function computeWeekTrends(entries: SleepEntry[]): {
  avgSleepHoursDelta: number | null;
  avgQualityDelta: number | null;
} {
  const last7 = entries.slice(0, 7);
  const prev7 = entries.slice(7, 14);
  if (last7.length < 3 || prev7.length < 3) {
    return { avgSleepHoursDelta: null, avgQualityDelta: null };
  }
  const avgH = (arr: SleepEntry[]) =>
    arr.reduce((sum, e) => sum + durationHours(e), 0) / arr.length;
  const avgQ = (arr: SleepEntry[]) => {
    const qs = arr.map((e) => e.quality_rating).filter((q): q is number => q != null);
    if (qs.length < 2) return null;
    return qs.reduce((a, b) => a + b, 0) / qs.length;
  };
  const h1 = avgH(last7);
  const h0 = avgH(prev7);
  const q1 = avgQ(last7);
  const q0 = avgQ(prev7);
  return {
    avgSleepHoursDelta: h1 - h0,
    avgQualityDelta: q1 != null && q0 != null ? q1 - q0 : null,
  };
}

function formatHoursTrend(delta: number | null): string {
  if (delta == null) return "Compares when you have 7+ older nights";
  const mins = Math.round(Math.abs(delta) * 60);
  if (mins === 0) return "Stable vs prior week";
  return `${delta > 0 ? "↑" : "↓"} ${mins}m vs prior week`;
}

function formatQualityTrend(delta: number | null): string {
  if (delta == null) return "Compares when you have 7+ older nights";
  const pct = Math.round(Math.abs(delta));
  if (pct === 0) return "Stable vs prior week";
  return `${delta > 0 ? "↑" : "↓"} ${pct}% vs prior week`;
}

type SleepInsightRow = { headline: string; detail: string; Icon: LucideIcon };

type SleepInsightCandidate = SleepInsightRow & { priority: number };

function buildSleepInsightRows(params: {
  entryCount: number;
  avgQuality: number;
  avgHours: number;
  calmNights: number;
  consistency: number;
  streak: number;
  avgSleepHoursDelta: number | null;
  avgQualityDelta: number | null;
  interruptedNights: number;
}): SleepInsightRow[] {
  const {
    entryCount,
    avgQuality,
    avgHours,
    calmNights,
    consistency,
    streak,
    avgSleepHoursDelta,
    avgQualityDelta,
    interruptedNights,
  } = params;

  if (entryCount === 0) {
    return [
      {
        headline: "Your sleep insights will gather here",
        detail: "Log a night when it feels right—Solace will reflect patterns back to you gently.",
        Icon: Moon,
      },
      {
        headline: "Start with one honest night",
        detail: "A single log is enough for us to begin noticing what helps you rest.",
        Icon: Bed,
      },
      {
        headline: "No score, just patterns",
        detail: "We will surface gentle observations—not judgments—as you check in.",
        Icon: Sparkles,
      },
    ];
  }

  const candidates: SleepInsightCandidate[] = [];

  const push = (row: SleepInsightRow, priority: number) => {
    candidates.push({ ...row, priority });
  };

  if (calmNights >= 3) {
    push(
      {
        headline: "Calm nights are adding up",
        detail: `${calmNights} of your logged nights crossed the calm-rest threshold—recovery is finding rhythm.`,
        Icon: Sparkles,
      },
      90
    );
  } else if (calmNights === 0 && entryCount >= 3) {
    push(
      {
        headline: "Restful nights are still rare",
        detail: "Most recent logs show lighter or shorter sleep—tiny wind-down shifts can still help.",
        Icon: Moon,
      },
      72
    );
  }

  if (consistency >= 70) {
    push(
      {
        headline: "Rhythm is doing quiet work",
        detail: `Your duration consistency score is ${consistency}%—predictable bedtimes give your nervous system a landing place.`,
        Icon: Activity,
      },
      88
    );
  } else if (consistency < 45 && entryCount >= 3) {
    push(
      {
        headline: "Bedtime varies quite a bit",
        detail: `With a ${consistency}% consistency score, anchoring one small pre-sleep ritual may steady the week.`,
        Icon: Activity,
      },
      75
    );
  }

  if (streak >= 3) {
    push(
      {
        headline: "You are building a sleep streak",
        detail: `${streak} consecutive logged nights—showing up matters more than perfect hours.`,
        Icon: Zap,
      },
      86
    );
  }

  if (avgSleepHoursDelta != null && avgSleepHoursDelta >= 0.35) {
    const mins = Math.round(avgSleepHoursDelta * 60);
    push(
      {
        headline: "You are sleeping longer lately",
        detail: `This week averages about ${mins} minutes more per night than the prior week.`,
        Icon: Bed,
      },
      84
    );
  } else if (avgSleepHoursDelta != null && avgSleepHoursDelta <= -0.35) {
    const mins = Math.round(Math.abs(avgSleepHoursDelta) * 60);
    push(
      {
        headline: "Recent nights have been shorter",
        detail: `This week runs about ${mins} minutes shorter per night than the week before—be gentle with caffeine and screens.`,
        Icon: Moon,
      },
      83
    );
  }

  if (avgQualityDelta != null && avgQualityDelta >= 6) {
    push(
      {
        headline: "Sleep quality is trending up",
        detail: `Quality moved up roughly ${Math.round(avgQualityDelta)}% compared with your prior week.`,
        Icon: Heart,
      },
      82
    );
  } else if (avgQualityDelta != null && avgQualityDelta <= -6) {
    push(
      {
        headline: "Quality dipped this week",
        detail: `Ratings are about ${Math.round(Math.abs(avgQualityDelta))}% lower than last week—protect what still feels safe at night.`,
        Icon: Heart,
      },
      81
    );
  }

  if (avgHours < 6.5 && avgQuality < 70) {
    push(
      {
        headline: "Time and quality are both asking for softness",
        detail: `You are averaging ${avgHours.toFixed(1)}h at ${avgQuality}% quality—small wind-down shifts often help before chasing longer hours.`,
        Icon: Moon,
      },
      80
    );
  } else if (avgHours < 6.5) {
    push(
      {
        headline: "A little more time in bed can help",
        detail: `Your recent average is ${avgHours.toFixed(1)} hours—your body may need more runway for deeper rest.`,
        Icon: Bed,
      },
      79
    );
  } else if (avgHours >= 7.5) {
    push(
      {
        headline: "You are getting solid duration",
        detail: `${avgHours.toFixed(1)} hours on average lately—protect the habits that got you here.`,
        Icon: Bed,
      },
      70
    );
  }

  if (avgQuality >= 78) {
    push(
      {
        headline: "Quality is holding steady",
        detail: `${avgQuality}% average quality—protect the rituals that make sleep feel safe, not perfect.`,
        Icon: Heart,
      },
      78
    );
  } else if (avgQuality < 55 && entryCount >= 2) {
    push(
      {
        headline: "Quality has room to grow",
        detail: `${avgQuality}% average quality across ${entryCount} nights—one softer evening ritual can be enough to start.`,
        Icon: Heart,
      },
      77
    );
  }

  if (interruptedNights >= 2 && entryCount >= 3) {
    push(
      {
        headline: "Interrupted nights are showing up",
        detail: `${interruptedNights} recent logs look fragmented—longer exhales and dim light may help your body settle.`,
        Icon: Zap,
      },
      76
    );
  }

  if (entryCount >= 7) {
    push(
      {
        headline: "A week of data is taking shape",
        detail: `${entryCount} nights logged—patterns are real enough to guide small, kind experiments.`,
        Icon: BarChart3,
      },
      55
    );
  } else if (entryCount <= 3) {
    push(
      {
        headline: "Early days of tracking",
        detail: `${entryCount} ${entryCount === 1 ? "night" : "nights"} so far—each log makes the next insight more personal.`,
        Icon: BarChart3,
      },
      50
    );
  }

  push(
    {
      headline: "Patterns are forming",
      detail: "You do not have to chase perfection to feel better mornings.",
      Icon: BarChart3,
    },
    20
  );
  push(
    {
      headline: "Rest is permission, not a score",
      detail: "Move at the pace that feels honest tonight.",
      Icon: Sparkles,
    },
    10
  );

  const seen = new Set<string>();
  const ranked = candidates
    .sort((a, b) => b.priority - a.priority)
    .filter((row) => {
      if (seen.has(row.headline)) return false;
      seen.add(row.headline);
      return true;
    })
    .slice(0, 3)
    .map(({ headline, detail, Icon }) => ({ headline, detail, Icon }));

  return ranked;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number; dataKey?: string }>;
  label?: string;
}

function SleepChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const v = row?.value;
  const suffix = row?.dataKey === "hours" ? "h" : "%";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1020]/95 px-3 py-2 text-xs text-zinc-100 shadow-[0_0_24px_rgba(88,28,135,0.35)] backdrop-blur-md">
      <p className="text-[10px] font-medium uppercase tracking-wider text-violet-300/90">{label}</p>
      <p className="mt-0.5 tabular-nums text-sm text-white">
        {v == null ? "—" : `${v}${suffix}`}
      </p>
    </div>
  );
}

interface HeroParticlesProps {
  reduced: boolean;
}

function HeroParticles({ reduced }: HeroParticlesProps) {
  const spots = useMemo(
    () =>
      Array.from({ length: reduced ? 8 : 22 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 85}%`,
        delay: (i % 7) * 0.35,
        dur: 3.5 + (i % 5) * 0.4,
      })),
    [reduced]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {spots.map((s) => (
        <motion.span
          key={s.id}
          className="absolute h-1 w-1 rounded-full bg-white/30 shadow-[0_0_12px_rgba(168,85,247,0.45)]"
          style={{ left: s.left, top: s.top }}
          animate={
            reduced
              ? { opacity: 0.25 }
              : { opacity: [0.15, 0.55, 0.2], y: [0, -10, 0] }
          }
          transition={{
            duration: s.dur,
            delay: s.delay,
            repeat: reduced ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function SleepTracker() {
  const chartGradId = useId().replace(/:/g, "");
  const barGradId = `${chartGradId}-bars`;
  const prefersReducedMotion = usePrefersReducedMotion();
  const { session } = useAuth();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ kind: "error"; message: string } | null>(null);
  const [sleepFormData, setSleepFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    bedTime: "",
    wakeTime: "",
    quality: "85",
    notes: "",
  });

  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sleepHistoryPage, setSleepHistoryPage] = useState(1);
  const [sleepHistoryPageSize, setSleepHistoryPageSize] = useState(10);

  useEffect(() => {
    void fetchSleepEntries();
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
        wakeDateTimeStr = `${format(nextDate, "yyyy-MM-dd")}T${sleepFormData.wakeTime}:00`;
      }

      await api.sleep.createEntry({
        bed_time: new Date(bedDateTimeStr).toISOString(),
        wake_time: new Date(wakeDateTimeStr).toISOString(),
        quality_rating: parseInt(sleepFormData.quality, 10),
        notes: sleepFormData.notes || undefined,
      });

      setSleepFormData({
        date: format(new Date(), "yyyy-MM-dd"),
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

  const closeLogModal = useCallback(() => {
    if (isSaving) return;
    setShowLogModal(false);
    setModalFeedback(null);
  }, [isSaving]);

  const stats = useMemo(() => {
    if (sleepEntries.length === 0) {
      return {
        avgDuration: "0.0",
        avgQuality: 0,
        deepSleepDisplay: "—" as const,
        streak: 0,
        recoveryLevel: 0,
        calmNights: 0,
        consistency: 0,
        avgHoursNum: 0,
      };
    }

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
    const avgQualityVal = qualityCount > 0 ? safeNumber(Math.round(qualitySum / qualityCount)) : 0;
    const streak = consecutiveSleepNightStreak(sleepEntries);
    const calmNights = calmNightsCount(sleepEntries);
    const consistency = sleepConsistencyScore(sleepEntries);

    return {
      avgDuration,
      avgQuality: avgQualityVal,
      deepSleepDisplay: "—" as const,
      streak,
      recoveryLevel: avgQualityVal,
      calmNights,
      consistency,
      avgHoursNum: safeNumber(totalDurationMinutes / sleepEntries.length / 60),
    };
  }, [sleepEntries]);

  const chartData = useMemo(
    () =>
      sleepEntries
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
        }),
    [sleepEntries]
  );

  const sleepHistoryTotalPages = Math.max(1, Math.ceil(sleepEntries.length / sleepHistoryPageSize));
  const sleepHistorySafePage = Math.min(Math.max(1, sleepHistoryPage), sleepHistoryTotalPages);
  const paginatedSleepEntries = useMemo(() => {
    const start = (sleepHistorySafePage - 1) * sleepHistoryPageSize;
    return sleepEntries.slice(start, start + sleepHistoryPageSize);
  }, [sleepEntries, sleepHistorySafePage, sleepHistoryPageSize]);

  useEffect(() => {
    setSleepHistoryPage((p) => (p > sleepHistoryTotalPages ? sleepHistoryTotalPages : p));
  }, [sleepHistoryTotalPages]);

  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const avgBed = useMemo(() => averageBedDate(sleepEntries), [sleepEntries]);
  const windDownAt = useMemo(() => windDownTarget(avgBed), [avgBed]);
  const windDownRemainingMs = useMemo(() => {
    if (!windDownAt) return null;
    void nowTick;
    return windDownAt.getTime() - Date.now();
  }, [windDownAt, nowTick]);

  const weekTrends = useMemo(() => computeWeekTrends(sleepEntries), [sleepEntries]);

  const insightRows = useMemo(
    () =>
      buildSleepInsightRows({
        entryCount: sleepEntries.length,
        avgQuality: stats.avgQuality,
        avgHours: stats.avgHoursNum,
        calmNights: stats.calmNights,
        consistency: stats.consistency,
        streak: stats.streak,
        avgSleepHoursDelta: weekTrends.avgSleepHoursDelta,
        avgQualityDelta: weekTrends.avgQualityDelta,
        interruptedNights: interruptedNightsCount(sleepEntries.slice(0, 14)),
      }),
    [
      sleepEntries,
      stats.avgQuality,
      stats.avgHoursNum,
      stats.calmNights,
      stats.consistency,
      stats.streak,
      weekTrends.avgSleepHoursDelta,
      weekTrends.avgQualityDelta,
    ]
  );

  const journeyIdx = journeyStageIndex(sleepEntries.length);

  const bedtimeProgress = useMemo(() => {
    if (!avgBed) return null;
    void nowTick;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const span = avgBed.getTime() - start.getTime();
    if (span <= 0) return 0.5;
    const p = (Date.now() - start.getTime()) / span;
    return Math.min(1, Math.max(0, p));
  }, [avgBed, nowTick]);

  const nextBedtimeLabel = useMemo(() => {
    if (!avgBed) return null;
    const key = format(avgBed, "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    if (key === today) return "Tonight";
    if (key === tomorrow) return "Tomorrow night";
    return format(avgBed, "MMM d");
  }, [avgBed]);

  const [chartRange, setChartRange] = useState<"week">("week");

  const scrollToHistory = useCallback(() => {
    setSleepHistoryPageSize(50);
    setSleepHistoryPage(1);
    window.requestAnimationFrame(() => {
      document.getElementById("sleep-history-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const openLogModal = useCallback(() => {
    setModalFeedback(null);
    setShowLogModal(true);
  }, []);

  if (isLoading) {
    return (
      <SolaceAmbientBackground className="min-h-[60vh] w-full min-w-0 rounded-[32px] p-4 sm:p-6">
        <div className="grid w-full min-w-0 gap-8 xl:grid-cols-[minmax(0,2.55fr)_minmax(280px,1fr)]">
          <div className="min-w-0 space-y-8">
            <Skeleton className="h-[min(380px,42vh)] w-full rounded-[28px] bg-white/[0.06]" />
            <Skeleton className="h-28 w-full rounded-[24px] bg-white/[0.06]" />
            <div className="grid min-h-[320px] grid-cols-1 gap-6 lg:grid-cols-2">
              <Skeleton className="h-full min-h-[300px] rounded-[28px] bg-white/[0.06]" />
              <Skeleton className="h-full min-h-[300px] rounded-[28px] bg-white/[0.06]" />
            </div>
          </div>
          <div className="hidden min-w-0 space-y-4 xl:block">
            <Skeleton className="h-64 w-full rounded-[24px] bg-white/[0.06]" />
            <Skeleton className="h-48 w-full rounded-[24px] bg-white/[0.06]" />
          </div>
        </div>
      </SolaceAmbientBackground>
    );
  }

  return (
    <>
      <SolaceAmbientBackground className="relative overflow-hidden rounded-[32px]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.12),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]"
          aria-hidden
        />

        <div className="relative z-10 w-full min-w-0 px-3 py-6 sm:px-5 sm:py-8 lg:px-6 xl:px-8">
          <div className="grid w-full min-w-0 grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2.55fr)_minmax(280px,1fr)] xl:items-start xl:gap-10">
            <div className="min-w-0 space-y-10">
              {/* 1. Hero — wide cinematic sanctuary */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="w-full"
              >
                <div
                  className={cn(
                    "relative isolate min-h-[min(380px,42vh)] w-full max-h-[400px] overflow-hidden rounded-[28px]",
                    "border border-[color:var(--solace-ds-border-glow)] bg-[var(--solace-ds-bg-raised)]",
                    "shadow-[var(--solace-ds-shadow-cinematic)]"
                  )}
                >
                  <img
                    src={SLEEP_TRACKER_IMAGES.hero}
                    alt="Moonlit lake at night with a wooden pier and glowing lantern"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[62%_42%]"
                    loading="eager"
                    decoding="async"
                    width={1600}
                    height={900}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0c14]/62 via-[#0a0c14]/28 to-transparent"
                    aria-hidden
                  />
                  <HeroParticles reduced={prefersReducedMotion} />
                  <div className="relative z-10 flex h-full min-h-[min(380px,42vh)] max-h-[400px] flex-col justify-between p-6 sm:p-8 lg:p-10">
                  <div className="relative flex min-h-0 w-full flex-1 flex-col gap-6 lg:flex-row lg:justify-between">
                    <div className="max-w-2xl space-y-4 lg:pr-8">
                      <Link
                        to="/app/settings"
                        className="inline-flex min-h-[44px] items-center gap-2 text-sm text-zinc-300/95 transition-colors hover:text-white"
                      >
                        <ArrowLeft className="size-4 shrink-0 text-violet-300/90" aria-hidden />
                        Back to Settings
                      </Link>
                      <h1 className="font-serif text-[clamp(2.1rem,4.2vw,3.5rem)] font-light leading-[1.06] tracking-tight text-white [text-shadow:0_2px_48px_rgba(0,0,0,0.65)]">
                        Sleep{" "}
                        <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                          Tracker
                        </span>
                      </h1>
                      <p className="max-w-xl text-[15px] leading-relaxed text-zinc-200/95 sm:text-base">
                        Understand your sleep, embrace your rest,
                        <br className="hidden sm:block" /> and wake up to a better you.
                      </p>
                      <blockquote className="max-w-lg border-l-2 border-amber-400/35 pl-4 text-sm italic leading-relaxed text-zinc-300/95">
                        &ldquo;Sleep is the golden chain that ties
                        <br className="hidden sm:block" /> health and our bodies together.&rdquo;
                        <span className="mt-2 block text-xs not-italic text-zinc-500">— Thomas Dekker</span>
                      </blockquote>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end lg:pt-1">
                      <SolaceGlowButton
                        type="button"
                        onClick={openLogModal}
                        className="min-h-[44px] shadow-[0_0_32px_rgba(168,85,247,0.45)]"
                      >
                        <Plus className="size-4" aria-hidden />
                        Log Sleep
                      </SolaceGlowButton>
                    </div>
                  </div>
                  </div>
                </div>
              </motion.section>

              {/* 2. Sleep signal summary strip — one continuous glass bar */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="w-full"
              >
                <div className="flex w-full min-w-0 overflow-x-auto rounded-[24px] border border-white/[0.09] bg-[color-mix(in_oklab,var(--solace-ds-surface)_92%,transparent)] shadow-[0_0_48px_-24px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      {
                        label: "Avg Sleep",
                        value: `${stats.avgDuration}h`,
                        trend: formatHoursTrend(weekTrends.avgSleepHoursDelta),
                        icon: Moon,
                        iconClass: "text-violet-200 shadow-[0_0_20px_rgba(168,85,247,0.45)]",
                        ring: "from-violet-500/30 to-violet-900/20",
                      },
                      {
                        label: "Avg Quality",
                        value: `${stats.avgQuality}%`,
                        trend: formatQualityTrend(weekTrends.avgQualityDelta),
                        icon: Activity,
                        iconClass: "text-sky-200 shadow-[0_0_20px_rgba(34,211,238,0.35)]",
                        ring: "from-cyan-500/25 to-violet-900/20",
                      },
                      {
                        label: "Avg Deep Sleep",
                        value: stats.deepSleepDisplay,
                        trend: "Not tracked in your logs",
                        icon: Brain,
                        iconClass: "text-fuchsia-200/90 shadow-[0_0_18px_rgba(236,72,153,0.35)]",
                        ring: "from-fuchsia-500/25 to-violet-900/20",
                      },
                      {
                        label: "Day Streak",
                        value: String(stats.streak),
                        trend: sleepEntries.length >= 10 ? "From consecutive logged nights" : "Builds with back-to-back logs",
                        icon: Zap,
                        iconClass: "text-emerald-200/90 shadow-[0_0_18px_rgba(52,211,153,0.35)]",
                        ring: "from-emerald-500/20 to-slate-900/30",
                      },
                      {
                        label: "Recovery Level",
                        value: `${stats.recoveryLevel}%`,
                        trend:
                          weekTrends.avgQualityDelta != null
                            ? formatQualityTrend(weekTrends.avgQualityDelta)
                            : "Grounded in your self-reported quality",
                        icon: Heart,
                        iconClass: "text-rose-200/90 shadow-[0_0_18px_rgba(244,63,94,0.28)]",
                        ring: "from-rose-500/20 to-violet-900/20",
                      },
                    ] as const
                  ).map((seg, i, arr) => {
                    const SegIcon = seg.icon;
                    return (
                      <div
                        key={seg.label}
                        className={cn(
                          "flex min-w-[148px] flex-1 flex-col items-center px-4 py-5 sm:min-w-[160px] sm:px-5",
                          i < arr.length - 1 && "border-r border-white/[0.07]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                            seg.ring
                          )}
                        >
                          <SegIcon className={cn("size-6", seg.iconClass)} aria-hidden />
                        </div>
                        <p className="mt-3 font-serif text-2xl font-light tabular-nums tracking-tight text-white">{seg.value}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{seg.label}</p>
                        <p className="mt-2 text-center text-[11px] leading-snug text-zinc-500">{seg.trend}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.section>

              {/* 3. Charts row */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
              >
                <SolaceGlassCard className="flex min-h-[360px] flex-col p-5 sm:min-h-[380px] sm:p-7">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-xl font-light text-white sm:text-2xl">Sleep Duration</h3>
                      <p className="mt-1 text-sm text-zinc-500">Hours of sleep each night</p>
                    </div>
                    <Select value={chartRange} onValueChange={(v) => setChartRange(v as "week")}>
                      <SelectTrigger
                        aria-label="Chart range"
                        className="h-10 w-[140px] shrink-0 border-white/10 bg-black/40 text-xs text-zinc-200"
                      >
                        <SelectValue placeholder="This week" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#0b1020] text-zinc-100">
                        <SelectItem value="week">This week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-h-0 flex-1 pt-2">
                    <div className="h-[min(320px,38vw)] w-full min-h-[260px] sm:h-[300px] lg:min-h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`${chartGradId}-area`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.55} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<SleepChartTooltip />} cursor={{ stroke: "rgba(168,85,247,0.25)" }} />
                        <Area
                          type="monotone"
                          dataKey="hours"
                          stroke="#c084fc"
                          strokeWidth={2.5}
                          fill={`url(#${chartGradId}-area)`}
                          style={{ filter: "drop-shadow(0 0 10px rgba(168,85,247,0.45))" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                </SolaceGlassCard>

                <SolaceGlassCard className="flex min-h-[360px] flex-col p-5 sm:min-h-[380px] sm:p-7">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-xl font-light text-white sm:text-2xl">Sleep Quality Trend</h3>
                      <p className="mt-1 text-sm text-zinc-500">Quality score each night</p>
                    </div>
                    <Select value={chartRange} onValueChange={(v) => setChartRange(v as "week")}>
                      <SelectTrigger
                        aria-label="Chart range"
                        className="h-10 w-[140px] shrink-0 border-white/10 bg-black/40 text-xs text-zinc-200"
                      >
                        <SelectValue placeholder="This week" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#0b1020] text-zinc-100">
                        <SelectItem value="week">This week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-h-0 flex-1 pt-2">
                    <div className="h-[min(320px,38vw)] w-full min-h-[260px] sm:h-[300px] lg:min-h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.85} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                        <Tooltip content={<SleepChartTooltip />} cursor={{ fill: "rgba(168,85,247,0.08)" }} />
                        <Bar dataKey="quality" radius={[10, 10, 4, 4]} maxBarSize={48}>
                          {chartData.map((_, i) => (
                            <Cell key={`c-${i}`} fill={`url(#${barGradId})`} style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.25))" }} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                </SolaceGlassCard>
              </motion.section>

              {/* 4. Sleep History */}
              <motion.section
                id="sleep-history-panel"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.5 }}
                className="w-full scroll-mt-8 space-y-4"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">Sleep History</h3>
                    <p className="mt-1 text-sm text-zinc-500">Your recent sleep logs</p>
                  </div>
                  {sleepEntries.length > 0 ? (
                    <button
                      type="button"
                      onClick={scrollToHistory}
                      className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200"
                    >
                      View All Logs
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <SolaceGlassCard className="overflow-hidden p-0 sm:p-0">
                  <div className="divide-y divide-white/[0.06]">
                    {paginatedSleepEntries.map((log) => {
                      const hours = durationHours(log);
                      const { label, Icon } = sleepMemoryLabel(hours, log.quality_rating);
                      const thumbClass = thumbnailClassForId(log.id);
                      const q = log.quality_rating ?? 0;
                      return (
                        <div
                          key={log.id}
                          className="flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:gap-4 sm:px-5"
                        >
                          <div
                            className={cn(
                              "relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br shadow-[0_0_16px_rgba(88,28,135,0.35)]",
                              thumbClass
                            )}
                          >
                            <Moon className="absolute inset-0 m-auto size-5 text-white/75" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {format(parseISO(log.bed_time), "MMM d, yyyy")}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {format(parseISO(log.bed_time), "h:mm a")} – {format(parseISO(log.wake_time), "h:mm a")} ·{" "}
                              {hours.toFixed(1)}h
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-violet-200/85">
                              <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                              {label}
                            </p>
                            {log.notes ? (
                              <p className="mt-1 truncate text-xs italic text-zinc-600" title={log.notes}>
                                &ldquo;{log.notes}&rdquo;
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                            <SolaceProgressRing value={q} size={56} strokeWidth={6}>
                              <span className="max-w-[40px] text-center text-[9px] font-light leading-tight tabular-nums text-white">
                                {q > 0 ? `${q}%` : "—"}
                              </span>
                            </SolaceProgressRing>
                            <Cloud className="size-5 text-zinc-600/80" aria-hidden />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {sleepEntries.length === 0 ? (
                    <motion.div className="flex flex-col items-center px-5 py-12 text-center">
                      <div className="mb-4 h-[80px] w-[80px] overflow-hidden rounded-full border border-white/[0.1] bg-black/40 shadow-[0_0_32px_-6px_rgba(168,85,247,0.45)]">
                        <img
                          src={SLEEP_TRACKER_IMAGES.companionMascot}
                          alt=""
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <p className="text-sm text-zinc-500">
                        No logs yet. When you record a night, it will appear here—softly, without judgment.
                      </p>
                    </motion.div>
                  ) : null}
                  {sleepEntries.length > 0 ? (
                    <div className="border-t border-white/[0.06]">
                      <AdminPaginationBar
                        variant="solace"
                        total={sleepEntries.length}
                        page={sleepHistoryPage}
                        pageSize={sleepHistoryPageSize}
                        onPageChange={setSleepHistoryPage}
                        onPageSizeChange={setSleepHistoryPageSize}
                        selectId="sleep-tracker-history-page-size"
                        pageSizeOptions={[...SLEEP_HISTORY_PAGE_OPTIONS]}
                      />
                    </div>
                  ) : null}
                </SolaceGlassCard>
              </motion.section>

              {/* 5. Sleep Insights + Recommendations */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.5 }}
                className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
              >
                <div className="min-w-0 space-y-3">
                  <h3 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">Sleep Insights</h3>
                  <div className="space-y-2.5">
                    {insightRows.map((row, i) => {
                      const RowIcon = row.Icon;
                      return (
                        <div
                          key={`insight-${i}-${row.headline}`}
                          className="flex gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-200 shadow-[0_0_18px_rgba(168,85,247,0.2)]">
                            <RowIcon className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-100">{row.headline}</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{row.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <h3 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">Recommendations</h3>
                  <div className="space-y-2.5">
                    {[
                      { title: "Breathing wind-down", sub: "Four slow counts in, pause, out—let the exhale be longer.", icon: Wind },
                      { title: "Ease caffeine earlier", sub: "Give your nervous system a longer runway into night.", icon: Leaf },
                      { title: "Night journaling", sub: "Empty the day onto paper so your mind can land.", icon: Moon },
                    ].map((rec) => {
                      const RecIcon = rec.icon;
                      return (
                        <Link
                          key={rec.title}
                          to="/app/wellness-tools"
                          className="group flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-colors hover:border-violet-400/25 hover:bg-white/[0.04]"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/15 bg-cyan-500/10 text-cyan-200">
                              <RecIcon className="size-[18px]" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-100">{rec.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{rec.sub}</p>
                            </div>
                          </div>
                          <ChevronRight className="size-5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-300" aria-hidden />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </motion.section>

              {/* 6. Your Sleep Journey */}
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.5 }}
                className="w-full space-y-4 pb-2"
              >
                <div>
                  <h3 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">Your Sleep Journey</h3>
                  <p className="mt-1 text-sm text-zinc-500">Small steps create better nights.</p>
                </div>
                <div className="relative min-h-[220px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0614] shadow-[0_0_56px_-28px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:min-h-[240px]">
                  <img
                    src={SLEEP_TRACKER_IMAGES.starfieldAccent}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-[0.38]"
                    loading="lazy"
                    decoding="async"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0614]/75 via-[#0a0614]/35 to-[#0a0614]/80"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_50%,rgba(6,4,14,0.45),transparent_65%)]"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_100%,rgba(88,28,135,0.28),transparent_55%)]"
                    aria-hidden
                  />
                  <div className="relative z-10 w-full overflow-x-auto px-4 py-8 sm:px-8 sm:py-10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="relative grid w-full min-w-[640px] grid-cols-5">
                      {JOURNEY_STAGES.map((stage, idx) => {
                        const active = idx === journeyIdx;
                        const StageIcon = stage.Icon;
                        const segmentLit = idx < journeyIdx;
                        return (
                          <div key={stage.id} className="relative flex flex-col items-center text-center">
                            {idx < JOURNEY_STAGES.length - 1 ? (
                              <div
                                className={cn(
                                  "absolute left-1/2 top-[26px] z-0 h-[2px] w-full shadow-[0_0_16px_rgba(168,85,247,0.4)] sm:top-[28px]",
                                  segmentLit
                                    ? "bg-gradient-to-r from-violet-500/85 via-fuchsia-400/75 to-violet-400/85"
                                    : "bg-white/12"
                                )}
                                aria-hidden
                              />
                            ) : null}
                            <motion.div
                              className={cn(
                                "relative z-[1] flex h-[52px] w-[52px] items-center justify-center rounded-full border backdrop-blur-sm sm:h-14 sm:w-14",
                                active
                                  ? "border-violet-400/70 bg-black/75 text-violet-100 shadow-[0_0_40px_rgba(168,85,247,0.65),0_0_60px_-10px_rgba(236,72,153,0.35)]"
                                  : "border-white/10 bg-black/60 text-zinc-500"
                              )}
                              animate={active ? { scale: [1, 1.05, 1] } : {}}
                              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <StageIcon className={cn("size-6 sm:size-7", active ? "text-violet-100" : "text-zinc-500")} aria-hidden />
                            </motion.div>
                            <p
                              className={cn(
                                "mt-4 text-[10px] font-semibold uppercase tracking-wider sm:text-xs",
                                active ? "text-violet-200" : "text-zinc-500"
                              )}
                            >
                              {stage.label}
                            </p>
                            <p className="mt-2 text-[10px] leading-snug text-zinc-500 sm:text-[11px]">{stage.sub}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.section>
            </div>

            {/* Right rail — nighttime companion */}
            <aside className="flex w-full min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:max-w-[min(100%,380px)]">
              <SolaceRightRailCard className="p-6">
                <h2 className="font-serif text-lg font-light text-white">Sleep Recovery</h2>
                <div className="mt-5 flex flex-col items-center">
                  <div className="mb-4 h-[72px] w-[72px] overflow-hidden rounded-full border border-white/[0.1] bg-black/40 shadow-[0_0_36px_-6px_rgba(168,85,247,0.5)]">
                    <img
                      src={SLEEP_TRACKER_IMAGES.companionMascot}
                      alt=""
                      className="h-full w-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <motion.div
                    animate={{ opacity: [0.85, 1, 0.85] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <SolaceProgressRing value={stats.recoveryLevel} size={140} strokeWidth={10}>
                      <div className="flex flex-col items-center px-2">
                        <span className="text-3xl font-light tabular-nums text-white">{stats.recoveryLevel}%</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Recovered</span>
                      </div>
                    </SolaceProgressRing>
                  </motion.div>
                  <p className="mt-5 text-center text-sm leading-relaxed text-zinc-400">
                    {stats.recoveryLevel >= 75
                      ? "You are recovering with room to soften into rest."
                      : stats.recoveryLevel >= 55
                        ? "Recovery is steady—protect small rituals that feel kind."
                        : "Be gentle; recovery deepens when pressure loosens."}
                  </p>
                </div>
              </SolaceRightRailCard>

              <SolaceRightRailCard className="p-6">
                <h2 className="font-serif text-lg font-light text-white">Next Bedtime</h2>
                {avgBed ? (
                  <>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-violet-300/90">
                      {nextBedtimeLabel ?? "Suggested"}
                    </p>
                    <p className="mt-2 font-serif text-2xl font-light tabular-nums text-white">{format(avgBed, "h:mm a")}</p>
                    <p className="mt-1 text-xs text-zinc-500">From your recent average bedtime</p>
                    {bedtimeProgress != null ? (
                      <div className="mt-5 space-y-2">
                        <div className="flex justify-between text-[11px] text-zinc-500">
                          <span>Day toward rest</span>
                          <span>{Math.round(bedtimeProgress * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/90">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_16px_rgba(168,85,247,0.45)] transition-[width] duration-700"
                            style={{ width: `${Math.round(bedtimeProgress * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/35 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">Wind-down</p>
                      <p className="mt-1 text-sm text-zinc-200">
                        {windDownAt ? format(windDownAt, "h:mm a") : "—"} suggested start
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        {windDownRemainingMs != null
                          ? `${formatCountdown(windDownRemainingMs)} until that softer window`
                          : "We will refine this as you log more nights."}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                    Log a few nights and a gentle bedtime rhythm will appear here—no pressure to be perfect.
                  </p>
                )}
              </SolaceRightRailCard>

              <SolaceRightRailCard className="p-6">
                <h2 className="font-serif text-lg font-light text-white">Wind Down Tip</h2>
                <div className="mt-4 flex gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-violet-400/25 bg-black/40 shadow-[0_0_28px_rgba(168,85,247,0.35)]">
                    <img
                      src={SLEEP_TRACKER_IMAGES.candleAccent}
                      alt=""
                      className="h-full w-full object-cover opacity-[0.9]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-zinc-300">
                      Inhale for four, exhale for six—let the longer exhale tell your body the day can wait.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 min-h-[44px] border-white/15 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
                    >
                      <Link to="/app/wellness-tools">Explore Tools</Link>
                    </Button>
                  </div>
                </div>
              </SolaceRightRailCard>

              <SolaceRightRailCard className="overflow-hidden p-0">
                <div className="relative min-h-[200px] bg-gradient-to-br from-amber-950/50 via-violet-950/80 to-black p-6">
                  <img
                    src={SLEEP_TRACKER_IMAGES.starfieldAccent}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.45]"
                    loading="lazy"
                    decoding="async"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.2),transparent_45%),radial-gradient(circle_at_20%_100%,rgba(168,85,247,0.35),transparent_55%)]"
                    aria-hidden
                  />
                  <div className="relative flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-violet-100">
                      <Headphones className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-light text-white">Need Support?</h2>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                        We&apos;re here to help you improve your sleep.
                      </p>
                      <Button
                        asChild
                        variant="outline"
                        className="mt-5 min-h-[44px] w-full border-white/15 bg-black/30 text-zinc-100 hover:bg-white/[0.08]"
                      >
                        <Link to="/app/settings/help-support">Contact Support</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </SolaceRightRailCard>
            </aside>
          </div>
        </div>
      </SolaceAmbientBackground>

      {/* Sleep Saved Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              className="fixed inset-4 z-50 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2"
            >
              <SolaceGlassCard className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_32px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="size-8 text-emerald-300" aria-hidden />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-light text-white">Sleep logged</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Your night is saved. Rest knowing the story is held for you.
                  </p>
                </div>
                <div className="flex w-full gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    className="flex-1 border-white/12 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                    onClick={() => setShowSuccessModal(false)}
                  >
                    Close
                  </Button>
                  <SolaceGlowButton
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      setShowSuccessModal(false);
                      setModalFeedback(null);
                      setShowLogModal(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Log another
                  </SolaceGlowButton>
                </div>
              </SolaceGlassCard>
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 40 }}
              className="fixed inset-4 z-50 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
            >
              <SolaceGlassCard className="max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <h3 className="font-serif text-2xl font-light text-white">Log sleep</h3>
                  <button
                    type="button"
                    onClick={closeLogModal}
                    disabled={isSaving}
                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                    aria-label="Close log sleep dialog"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>

                {modalFeedback && (
                  <div
                    role="alert"
                    className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2.5 text-sm text-rose-100"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{modalFeedback.message}</span>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                      <Calendar className="size-4 text-violet-300" aria-hidden />
                      Date
                    </label>
                    <input
                      type="date"
                      value={sleepFormData.date}
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, date: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-zinc-100 outline-none ring-violet-500/40 focus:ring-2 disabled:opacity-60"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                        <Moon className="size-4 text-violet-300" aria-hidden />
                        Bedtime
                      </label>
                      <input
                        type="time"
                        value={sleepFormData.bedTime}
                        disabled={isSaving}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, bedTime: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-zinc-100 outline-none ring-violet-500/40 focus:ring-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                        <Sun className="size-4 text-amber-200" aria-hidden />
                        Wake time
                      </label>
                      <input
                        type="time"
                        value={sleepFormData.wakeTime}
                        disabled={isSaving}
                        onChange={(e) => setSleepFormData({ ...sleepFormData, wakeTime: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-zinc-100 outline-none ring-violet-500/40 focus:ring-2 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                      <Activity className="size-4 text-cyan-300" aria-hidden />
                      Sleep quality ({sleepFormData.quality}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sleepFormData.quality}
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, quality: e.target.value })}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500 disabled:opacity-60"
                    />
                    <div className="mt-1 flex justify-between text-xs text-zinc-500">
                      <span>Heavy</span>
                      <span>Balanced</span>
                      <span>Light</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">Notes (optional)</label>
                    <textarea
                      value={sleepFormData.notes}
                      disabled={isSaving}
                      onChange={(e) => setSleepFormData({ ...sleepFormData, notes: e.target.value })}
                      placeholder="How did you feel? Any factors affecting your sleep?"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-zinc-100 outline-none ring-violet-500/40 placeholder:text-zinc-600 focus:ring-2 disabled:opacity-60"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={closeLogModal}
                      disabled={isSaving}
                      className="flex-1 border-white/12 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleLogSleep()}
                      disabled={isSaving}
                      isLoading={isSaving}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:from-violet-500 hover:to-fuchsia-500"
                    >
                      Log sleep
                    </Button>
                  </div>
                </div>
              </SolaceGlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
