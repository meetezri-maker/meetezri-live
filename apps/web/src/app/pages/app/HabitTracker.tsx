import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  Plus,
  Check,
  Flame,
  TrendingUp,
  Edit,
  Trash2,
  X,
  Sprout,
  Quote,
  ArrowRight,
  Link2,
  Leaf,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Target,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useState, useEffect, useMemo, useId } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { format, isSameDay, subDays, startOfWeek, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  SolaceGlowButton,
  SolacePanel,
  solaceSelectContentClass,
  solaceSelectItemClass,
  solaceSelectTriggerForm,
  solaceSelectTriggerPagination,
} from "@/app/solace";
import { HABIT_TRACKER_IMAGES } from "@/lib/solace/habitTrackerImages";
import { TalkItOutBottomDock } from "./talk-it-out/TalkItOutBottomDock";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface HabitLog {
  completed_at: string;
}

interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: "daily" | "weekly";
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  completedThisWeek: number;
  category: string;
  weekProgress: boolean[];
  habit_logs?: HabitLog[];
}

const habitCategories = [
  "Health",
  "Daily life",
  "Sleep",
  "Nutrition",
  "Physical activity",
  "Mental wellbeing",
  "Focus & productivity",
  "Time management",
  "Social life",
  "Digital habits",
  "+ Custom",
] as const;

const habitEmojiOptions = [
  "🎯",
  "💪",
  "🏃",
  "🧘",
  "💤",
  "🥗",
  "📚",
  "🧠",
  "⏰",
  "🧴",
  "🚰",
  "📝",
  "🎵",
  "😊",
  "🔥",
  "⭐",
] as const;

const HABIT_LIST_PAGE_OPTIONS = [10, 20, 50] as const;

const WEEKDAY_RING_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const habitModalInputClass =
  "min-h-[48px] w-full rounded-xl border border-white/[0.088] bg-black/40 px-4 py-3 text-[15px] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] placeholder:text-zinc-600 transition-[border-color,box-shadow,background-color] focus-visible:border-violet-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/25";

const habitModalLabelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";

function matteFloat(extra?: string) {
  return cn(
    "rounded-[1.55rem] border border-white/[0.048] bg-gradient-to-br from-black/[0.28] via-black/[0.2] to-black/[0.32] shadow-[0_52px_120px_-54px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.055),0_0_0_1px_rgba(139,92,246,0.04)] backdrop-blur-xl transition-[transform,box-shadow] duration-500",
    extra
  );
}

function supportiveLineForCategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("sleep") || c.includes("rest")) return "Honor your body's need for rest.";
  if (c.includes("physical") || c.includes("movement") || c.includes("health"))
    return "Movement as care, not performance.";
  if (c.includes("mental") || c.includes("mind")) return "A little attention goes a long way.";
  if (c.includes("social")) return "Connection in small doses still counts.";
  if (c.includes("nutrition")) return "Nourishment without pressure.";
  if (c.includes("focus") || c.includes("time")) return "Ease into steadiness.";
  return "Presence matters more than perfection.";
}

/** Map stored gradient presets to aura colors for rhythm rings */
function habitAuraFromColor(colorKey: string): { stroke: string; shadow: string; soft: string } {
  if (colorKey.includes("orange") || colorKey.includes("red"))
    return { stroke: "#fb923c", shadow: "rgba(251,146,60,0.35)", soft: "rgba(251,146,60,0.12)" };
  if (colorKey.includes("green") || colorKey.includes("teal"))
    return { stroke: "#2dd4bf", shadow: "rgba(45,212,191,0.33)", soft: "rgba(45,212,191,0.1)" };
  if (colorKey.includes("pink") || colorKey.includes("rose"))
    return { stroke: "#f472b6", shadow: "rgba(244,114,182,0.33)", soft: "rgba(244,114,182,0.1)" };
  if (colorKey.includes("amber"))
    return { stroke: "#fbbf24", shadow: "rgba(251,191,36,0.33)", soft: "rgba(251,191,36,0.1)" };
  if (colorKey.includes("purple") || colorKey.includes("indigo"))
    return { stroke: "#c084fc", shadow: "rgba(192,132,252,0.38)", soft: "rgba(192,132,252,0.12)" };
  return { stroke: "#22d3ee", shadow: "rgba(34,211,238,0.38)", soft: "rgba(34,211,238,0.12)" };
}

interface HeroProgressRingProps {
  completed: number;
  total: number;
}

function HeroProgressRing({ completed, total }: HeroProgressRingProps) {
  const gradId = useId().replace(/:/g, "");
  const glowId = `habit-ring-glow-${gradId}`;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const isComplete = total > 0 && completed >= total;
  const r = 72;
  const strokeWidth = 10;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);

  return (
    <div
      className="relative flex h-[188px] w-[188px] shrink-0 items-center justify-center sm:h-[204px] sm:w-[204px]"
      role="img"
      aria-label={`Today's progress: ${completed} of ${Math.max(total, 1)} habits completed, ${pct} percent`}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-[-22%] rounded-full bg-[radial-gradient(circle_at_40%_32%,rgba(167,139,250,0.28)_0%,rgba(34,211,238,0.1)_45%,transparent_72%)] blur-[32px] transition-opacity duration-700",
          isComplete && "opacity-110"
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[6%] rounded-full border border-white/[0.09] bg-[radial-gradient(circle_at_50%_38%,rgba(139,92,246,0.14)_0%,rgba(8,12,24,0.55)_55%,rgba(3,5,12,0.72)_100%)] shadow-[inset_0_0_56px_rgba(139,92,246,0.16),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-[2px]"
        aria-hidden
      />
      <svg className="relative z-[2] h-full w-full -rotate-90" viewBox="0 0 180 180" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(221 214 254)" stopOpacity={1} />
            <stop offset="45%" stopColor="rgb(167 139 250)" stopOpacity={0.98} />
            <stop offset="78%" stopColor="rgb(139 92 246)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity={0.92} />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          filter={`url(#${glowId})`}
          className="transition-[stroke-dashoffset] duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
      </svg>
      <div className="pointer-events-none absolute inset-[14%] z-[3] flex flex-col items-center justify-center px-2 text-center">
        <p className="text-[8px] font-semibold uppercase leading-tight tracking-[0.18em] text-violet-200/80 sm:text-[9px]">
          Today&apos;s progress
        </p>
        <p className="mt-1.5 font-serif text-[1.45rem] font-normal tabular-nums leading-none tracking-[-0.03em] text-zinc-50 sm:text-[1.6rem]">
          <span className="text-zinc-50">{completed}</span>
          <span className="mx-1 text-zinc-500/90">/</span>
          <span className="text-zinc-300/95">{Math.max(total, 1)}</span>
        </p>
        <p className="mt-1 max-w-[6.5rem] text-[9px] leading-tight text-zinc-400/95 sm:text-[10px]">habits completed</p>
        <p
          className={cn(
            "mt-1.5 rounded-full border px-2 py-0.5 text-[8.5px] font-medium tabular-nums leading-tight tracking-wide transition-colors duration-500 sm:text-[9px]",
            isComplete
              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200/95"
              : "border-violet-400/25 bg-violet-500/[0.08] text-violet-200/90"
          )}
        >
          {pct}% complete
        </p>
      </div>
    </div>
  );
}

interface HabitRailsProps {
  habit: Habit;
  onToggleToday: () => void;
  onDotPress: (dayIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function HabitRailCard({ habit, onToggleToday, onDotPress, onEdit, onDelete, isDeleting }: HabitRailsProps) {
  const aura = habitAuraFromColor(habit.color);
  const supportive = supportiveLineForCategory(habit.category);
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        matteFloat(
          "group relative overflow-hidden hover:shadow-[0_0_60px_-12px_rgba(76,29,149,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]"
        )
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent opacity-55"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse 90% 55% at 12% -10%, rgba(167,139,250,0.14), transparent 52%), radial-gradient(ellipse 70% 50% at 88% 100%, rgba(34,211,238,0.06), transparent 55%)`,
        }}
        aria-hidden
      />

        <div className="relative z-[2] px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-5">
              <div
                className="relative flex h-[4.65rem] w-[4.65rem] shrink-0 items-center justify-center rounded-[1.25rem] border border-white/[0.085] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]"
                style={{
                  boxShadow: `inset 0 0 36px ${aura.soft}, 0 20px 50px -32px rgba(0,0,0,0.75)`,
                }}
              >
                <FluentEmoji emoji={habit.icon} size={40} className="shrink-0" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-[1.35rem] font-normal tracking-[-0.02em] text-zinc-50 sm:text-[1.45rem]">
                      {habit.name}
                    </h3>
                    <p className="mt-2 max-w-xl text-[14.5px] leading-[1.7] text-zinc-400/95">{supportive}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={onEdit}
                      disabled={isDeleting}
                      aria-label={`Edit ${habit.name}`}
                      className="min-h-[48px] min-w-[48px] rounded-[0.95rem] border border-white/[0.065] bg-white/[0.03] text-zinc-400 transition-[background-color,color,box-shadow] duration-300 hover:bg-white/[0.06] hover:text-zinc-100 hover:shadow-[0_14px_36px_-22px_rgba(139,92,246,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/38 disabled:opacity-50"
                    >
                      <Edit className="mx-auto h-[18px] w-[18px]" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={isDeleting}
                      aria-label={`Delete ${habit.name}`}
                      className="min-h-[48px] min-w-[48px] rounded-[0.95rem] border border-white/[0.065] bg-white/[0.03] text-zinc-400 transition-[background-color,color,box-shadow] duration-300 hover:border-rose-500/35 hover:bg-rose-950/35 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-rose-400 border-t-transparent mx-auto mt-px" />
                      ) : (
                        <Trash2 className="mx-auto h-[18px] w-[18px]" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={onToggleToday}
                    aria-pressed={habit.completedToday}
                    aria-label={
                      habit.completedToday
                        ? `Mark ${habit.name} as not done today`
                        : `Mark ${habit.name} gently done for today`
                    }
                    className={cn(
                      "relative inline-flex min-h-[46px] items-center gap-2.5 rounded-full border px-5 py-2.5 text-[12.5px] font-medium transition-[border-color,background-color,box-shadow] duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
                      habit.completedToday
                        ? "border-white/[0.12] bg-white/[0.07] text-zinc-100 shadow-[0_0_38px_-4px_var(--today-glow)]"
                        : "border-white/[0.08] bg-black/35 text-zinc-300 hover:border-violet-400/22 hover:bg-white/[0.04]"
                    )}
                    style={
                      habit.completedToday
                        ? ({ ["--today-glow" as string]: aura.shadow } as CSSProperties)
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "flex h-[22px] w-[22px] items-center justify-center rounded-full border",
                        habit.completedToday
                          ? "border-transparent bg-white/[0.12]"
                          : "border-white/[0.1] bg-black/35"
                      )}
                    >
                      {habit.completedToday ? (
                        <Check className="h-3 w-3 text-zinc-100" strokeWidth={2.75} aria-hidden />
                      ) : (
                        <span className="h-[5px] w-[5px] rounded-full bg-violet-300/65" aria-hidden />
                      )}
                    </span>
                    <span>{habit.completedToday ? "Logged today" : "Tap when you showed up"}</span>
                  </motion.button>

                  <span className="inline-flex items-center rounded-full border border-orange-400/15 bg-orange-400/[0.06] px-3.5 py-2 text-[12px] tabular-nums text-orange-50/92">
                    <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-300/95" aria-hidden />
                    <span>{habit.currentStreak} day streak</span>
                  </span>
                  <span className="inline-flex rounded-full border border-white/[0.06] bg-black/25 px-3.5 py-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                    {habit.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">This week</p>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--solace-muted)]">
                Tap a day to softly log this habit—instantly, tactilely yours.
              </p>
              <div className="relative mt-6" aria-label="Weekly rhythm">
                <div
                  className="pointer-events-none absolute top-[28px] right-[28px] left-[28px] z-0 h-[2px] rounded-full bg-white/[0.12] sm:top-[30px] sm:right-[30px] sm:left-[30px]"
                  aria-hidden
                />
                <div className="relative flex items-end justify-between">
                {habit.weekProgress.map((completed, i) => {
                  const ringDate = new Date(startOfCurrentWeek);
                  ringDate.setDate(ringDate.getDate() + i);
                  const isFuture = ringDate > today;
                  return (
                    <div key={`${habit.id}-d-${i}`} className="relative z-[1] flex shrink-0 flex-col items-center gap-3">
                      <motion.button
                        type="button"
                        disabled={isFuture}
                        whileHover={!isFuture ? { scale: 1.06, y: -2 } : undefined}
                        whileTap={!isFuture ? { scale: 0.94 } : undefined}
                        onClick={() => !isFuture && onDotPress(i)}
                        aria-label={`${format(ringDate, "EEEE MMM d")}; ${completed ? "completed" : "not logged"}`}
                        className={cn(
                          "relative flex h-[56px] w-[56px] items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,box-shadow,filter] duration-300 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080d] sm:h-[60px] sm:w-[60px]",
                          isFuture && "cursor-not-allowed opacity-33",
                          !isFuture &&
                            !completed &&
                            "border-[1.5px] border-white/[0.14] bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.11),transparent_48%)] shadow-[inset_0_-6px_20px_rgba(0,0,0,0.35)] hover:border-violet-400/45 hover:bg-white/[0.04] hover:shadow-[0_16px_44px_-18px_rgba(76,29,149,0.42),inset_0_0_0_1px_rgba(167,139,250,0.08)] hover:brightness-[1.06] active:border-violet-400/55",
                          !isFuture && completed && "border-[1.5px] border-white/[0.16]"
                        )}
                        style={
                          !isFuture && completed
                            ? {
                                boxShadow: `0 18px 44px ${aura.soft}, inset 0 0 34px ${aura.soft}`,
                                borderColor: "rgba(255,255,255,0.2)",
                              }
                            : undefined
                        }
                      >
                        {!isFuture && !completed ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-violet-200/35 to-transparent ring-[4px] ring-violet-500/12" aria-hidden />
                        ) : null}
                        {completed ? (
                          <Check className="relative z-[2] h-[21px] w-[21px] text-zinc-50 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" aria-hidden strokeWidth={2.4} />
                        ) : null}
                      </motion.button>
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {WEEKDAY_RING_LABELS[i]}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

interface RightRailBlocksProps {
  weeklyBarData: { label: string; count: number; pct: number }[];
  habitsCompletedWeek: number;
  habitsPotentialWeek: number;
  longestStreak: number;
}

function RightRailBlocks({ weeklyBarData, habitsCompletedWeek, habitsPotentialWeek, longestStreak }: RightRailBlocksProps) {
  const best = useMemo(() => {
    let max = 0;
    let idx = -1;
    weeklyBarData.forEach((d, i) => {
      if (d.count > max) {
        max = d.count;
        idx = i;
      }
    });
    const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return max > 0 && idx >= 0 ? names[idx] : null;
  }, [weeklyBarData]);

  return (
    <div className="relative overflow-hidden rounded-[1.45rem] border border-white/[0.012] bg-[color-mix(in_oklab,var(--solace-bg-elevated)_26%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.028),0_32px_88px_-56px_rgba(0,0,0,0.55),0_0_0_1px_rgba(139,92,246,0.025)] backdrop-blur-[28px]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_140%_92%_at_88%_-8%,rgba(139,92,246,0.07),transparent_62%),radial-gradient(ellipse_100%_60%_at_0%_100%,rgba(14,165,233,0.04),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_38%,transparent_70%,rgba(6,10,18,0.12))]"
        aria-hidden
      />

      <div className="relative divide-y divide-white/[0.017] rounded-[calc(1.45rem-1px)] bg-black/[0.12] backdrop-blur-lg">
        {/* Reflection */}
        <section className="relative overflow-hidden px-6 py-7 sm:px-7">
          <img
            src={HABIT_TRACKER_IMAGES.candleAccent}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#05060e]/94 via-[#05060e]/78 to-[#05060e]/42"
            aria-hidden
          />
          <div className="relative z-[2]">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/82">
              <Quote className="h-4 w-4 shrink-0 text-violet-300/88" aria-hidden />
              Reflection
            </p>
            <p className="mt-5 font-serif text-[1.0625rem] leading-[1.65] tracking-[-0.01em] text-zinc-200 sm:text-[1.125rem]">
              You showed up today.
              <br />
              That matters more than perfection.
            </p>
            <div className="pointer-events-none absolute right-10 top-[28%] h-16 w-px bg-gradient-to-b from-transparent via-violet-400/18 to-transparent" aria-hidden />
          </div>
        </section>

        {/* Weekly */}
        <section className="px-6 py-7 sm:px-7">
          <h2 className="font-serif text-[1.15rem] font-normal tracking-tight text-zinc-50">Weekly overview</h2>
          <div className="mt-6 h-[10.75rem] w-full rounded-xl border border-white/[0.03] bg-black/10 px-1 pb-2 pt-1 shadow-[inset_0_10px_28px_-26px_rgba(139,92,246,0.12)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyBarData}
                margin={{ top: 14, right: 4, left: 4, bottom: 0 }}
                barCategoryGap="18%"
              >
                <defs>
                  <linearGradient id="solaceHabitBars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(196 181 253)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="rgb(49 46 129)" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} horizontal stroke="rgba(255,255,255,0.06)" strokeDasharray="0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  tickLine={false}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis hide domain={[0, "dataMax + 1"]} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeWidth={1} ifOverflow="visible" />
                <Bar dataKey="count" radius={[10, 10, 4, 4]} maxBarSize={32}>
                  {weeklyBarData.map((entry, i) => (
                    <Cell key={`${entry.label}-${i}`} fill="url(#solaceHabitBars)" opacity={entry.pct >= 75 ? 1 : entry.pct >= 40 ? 0.86 : 0.58 + i * 0.02} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-6 space-y-3 text-[13.5px] leading-snug text-[var(--solace-muted)]">
            <li className="flex justify-between gap-4 border-t border-white/[0.03] pt-4">
              <span>Habits completed</span>
              <span className="tabular-nums font-medium text-zinc-300/95">
                {habitsPotentialWeek === 0 ? "—" : `${habitsCompletedWeek}/${habitsPotentialWeek}`}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Best day</span>
              <span className="max-w-[12rem] text-right font-medium text-zinc-300/95">{best ?? "Still unfolding"}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Current streak</span>
              <span className="tabular-nums font-medium text-zinc-300/95">{longestStreak} days</span>
            </li>
          </ul>
        </section>

        {/* Tips */}
        <section className="relative px-6 py-7 sm:px-7">
          <div className="pointer-events-none absolute left-8 top-[18%] h-24 w-24 rounded-full bg-cyan-500/[0.035] blur-3xl" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Tips for your journey</p>
          <ul className="relative z-[2] mt-6 space-y-3.5">
            {[
              {
                Icon: Link2,
                title: "Stack habits for consistency",
                body: "Link something new to a ritual you already trust.",
              },
              {
                Icon: Leaf,
                title: "Start small, stay consistent",
                body: "Gentle reps teach your nervous system safety.",
              },
              {
                Icon: TrendingUp,
                title: "Track progress gently",
                body: "Let patterns emerge without chasing scores.",
              },
            ].map(({ Icon: RowIcon, title, body }) => (
              <li
                key={title}
                className="group flex items-start gap-4 rounded-[1.08rem] border border-white/[0.038] bg-black/[0.08] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.028)] transition-[border-color,box-shadow,background-color] duration-500 hover:border-violet-400/18 hover:bg-white/[0.028] hover:shadow-[0_18px_48px_-36px_rgba(76,29,149,0.32)]"
              >
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/22 bg-gradient-to-br from-cyan-500/12 to-violet-500/10 shadow-[inset_0_0_20px_rgba(34,211,238,0.06)]">
                  <RowIcon className="h-[17px] w-[17px] text-cyan-200/92" strokeWidth={1.8} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[14px] font-medium tracking-tight text-zinc-100">{title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--solace-muted)]">{body}</p>
                </div>
                {/* <ArrowRight
                  className="mt-1.5 h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-violet-200/95"
                  aria-hidden
                  strokeWidth={2}
                /> */}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

interface MobileContinuationProps extends RightRailBlocksProps {}

function MobileContinuation(props: MobileContinuationProps) {
  return (
    <div className="mt-12 space-y-8 xl:hidden">
      <RightRailBlocks {...props} />
    </div>
  );
}

export function HabitTracker() {
  const { session } = useAuth();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [habitFormData, setHabitFormData] = useState({
    name: "",
    icon: "🎯",
    category: "",
    frequency: "daily" as "daily" | "weekly",
    color: "from-blue-400 to-cyan-500",
  });
  const [habitListPage, setHabitListPage] = useState(1);
  const [habitListPageSize, setHabitListPageSize] = useState(10);

  useEffect(() => {
    if (session) {
      void fetchHabits();
    }
  }, [session]);

  const processHabitData = (backendHabit: any): Habit => {
    const logs = backendHabit.habit_logs || [];
    const sortedLogs = logs
      .map((log: any) => {
        const dateVal = new Date(log.completed_at);
        return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
      })
      .sort((a: Date, b: Date) => b.getTime() - a.getTime());

    const today = new Date();
    const completedToday = sortedLogs.some((date: Date) => isSameDay(date, today));

    let currentStreak = 0;
    const uniqueDates = Array.from<string>(
      new Set(sortedLogs.map((d: Date) => format(d, "yyyy-MM-dd")))
    )
      .map((d: string) => {
        const [y, m, day] = d.split("-").map(Number);
        return new Date(y, m - 1, day);
      })
      .sort((a: Date, b: Date) => b.getTime() - a.getTime());

    if (uniqueDates.length > 0) {
      let streak = 0;
      let checkDate = today;

      if (!completedToday) {
        checkDate = subDays(today, 1);
      }

      for (const logDate of uniqueDates) {
        if (isSameDay(logDate, checkDate)) {
          streak++;
          checkDate = subDays(checkDate, 1);
        } else if (isSameDay(logDate, subDays(checkDate, 1))) {
          break;
        } else {
          if (differenceInDays(checkDate, logDate) > 0) {
            break;
          }
        }
      }
      currentStreak = streak;
    }

    let tempStreak = 0;
    let maxStreak = 0;
    if (uniqueDates.length > 0) {
      const ascDates = [...uniqueDates].reverse();
      let prevDate: Date | null = null;
      for (const d of ascDates) {
        if (!prevDate) {
          tempStreak = 1;
        } else {
          if (differenceInDays(d, prevDate) === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, tempStreak);
        prevDate = d;
      }
    }
    const bestStreak = maxStreak;

    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const weekProgress = Array(7)
      .fill(false)
      .map((_, i) => {
        const day = new Date(startOfCurrentWeek);
        day.setDate(day.getDate() + i);
        return sortedLogs.some((logDate: Date) => isSameDay(logDate, day));
      });

    const completedThisWeek = weekProgress.filter(Boolean).length;

    return {
      id: backendHabit.id,
      name: backendHabit.name,
      icon: backendHabit.icon || "🎯",
      color: backendHabit.color || "from-blue-400 to-cyan-500",
      frequency: backendHabit.frequency as "daily" | "weekly",
      currentStreak,
      bestStreak,
      completedToday,
      completedThisWeek,
      category: backendHabit.category || "General",
      weekProgress,
      habit_logs: logs,
    };
  };

  const fetchHabits = async () => {
    try {
      setIsLoading(true);
      const data = await api.habits.getAll();
      const processedHabits = data.map(processHabitData);
      setHabits(processedHabits);
    } catch (error) {
      console.error("Failed to fetch habits", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCustomCategory("");
    setHabitFormData({
      name: "",
      icon: "🎯",
      category: "",
      frequency: "daily",
      color: "from-blue-400 to-cyan-500",
    });
    setEditingHabit(null);
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    const presetChoices = habitCategories.filter((c) => c !== "+ Custom") as readonly string[];
    const isPresetCategory = presetChoices.includes(habit.category);

    setCustomCategory(isPresetCategory ? "" : habit.category);
    setHabitFormData({
      name: habit.name,
      icon: habit.icon,
      category: isPresetCategory ? habit.category : "+ Custom",
      frequency: habit.frequency,
      color: habit.color,
    });
    setShowNewHabit(true);
  };

  const handleCreateHabit = async (payload = habitFormData) => {
    try {
      setIsSaving(true);
      await api.habits.create(payload);
      await fetchHabits();
      setShowNewHabit(false);
      resetForm();
      toast.success("Habit created successfully");
    } catch (error: any) {
      console.error("Failed to create habit", error);
      toast.error(error.message || "Failed to create habit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateHabit = async (payload = habitFormData) => {
    if (!editingHabit) return;

    try {
      setIsSaving(true);
      await api.habits.update(editingHabit.id, payload);
      await fetchHabits();
      setShowNewHabit(false);
      resetForm();
      toast.success("Habit updated successfully");
    } catch (error: any) {
      console.error("Failed to update habit", error);
      toast.error(error.message || "Failed to update habit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (confirm("Are you sure you want to delete this habit?")) {
      try {
        setIsDeleting(id);
        await api.habits.delete(id);
        setHabits(habits.filter((h) => h.id !== id));
        toast.success("Habit deleted");
      } catch (error) {
        console.error("Failed to delete habit", error);
        toast.error("Failed to delete habit");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleSaveHabit = (payload = habitFormData) => {
    if (editingHabit) {
      void handleUpdateHabit(payload);
    } else {
      void handleCreateHabit(payload);
    }
  };

  const toggleHabit = async (id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;

    try {
      if (habit.completedToday) {
        await api.habits.uncomplete(id, format(new Date(), "yyyy-MM-dd"));
        toast.success("Marked as not completed");
      } else {
        await api.habits.complete(id, new Date().toISOString());
        toast.success("Logged with care");
      }
      await fetchHabits();
    } catch (error) {
      console.error("Failed to toggle habit", error);
      toast.error("Failed to save habit log");
    }
  };

  const toggleHabitForDate = async (habitId: string, index: number) => {
    const habitIndex = habits.findIndex((h) => h.id === habitId);
    if (habitIndex === -1) return;

    const habit = habits[habitIndex];
    const isCompleted = habit.weekProgress[index];

    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const targetDate = new Date(startOfCurrentWeek);
    targetDate.setDate(targetDate.getDate() + index);
    if (targetDate > today) return;

    targetDate.setHours(12, 0, 0, 0);

    const newHabits = [...habits];
    newHabits[habitIndex] = {
      ...habit,
      weekProgress: habit.weekProgress.map((p, i) => (i === index ? !p : p)),
    };
    setHabits(newHabits);

    try {
      if (isCompleted) {
        await api.habits.uncomplete(habitId, format(targetDate, "yyyy-MM-dd"));
        toast.success(`Removed log for ${format(targetDate, "MMM d")}`);
      } else {
        await api.habits.complete(habitId, targetDate.toISOString());
        toast.success(`Saved log for ${format(targetDate, "MMM d")}`);
      }
      await fetchHabits();
    } catch (error) {
      console.error("Failed to toggle habit for date", error);
      toast.error("Failed to update habit status");
      setHabits(habits);
    }
  };

  const totalHabits = habits.length;
  const completedTodayCount = habits.filter((h) => h.completedToday).length;
  const completionRate = totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0;
  const longestStreak = totalHabits > 0 ? Math.max(...habits.map((h) => h.currentStreak)) : 0;

  const habitListTotalPages = Math.max(1, Math.ceil(habits.length / habitListPageSize));
  const habitListSafePage = Math.min(Math.max(1, habitListPage), habitListTotalPages);
  const paginatedHabits = useMemo(() => {
    const start = (habitListSafePage - 1) * habitListPageSize;
    return habits.slice(start, start + habitListPageSize);
  }, [habits, habitListSafePage, habitListPageSize]);

  useEffect(() => {
    setHabitListPage((p) => (p > habitListTotalPages ? habitListTotalPages : p));
  }, [habitListTotalPages]);

  const weeklyBarData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      let count = 0;
      for (const h of habits) {
        const logs = h.habit_logs || [];
        for (const log of logs) {
          const d = new Date(log.completed_at);
          const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (isSameDay(local, day)) {
            count++;
            break;
          }
        }
      }
      const pct = totalHabits > 0 ? Math.round((count / totalHabits) * 100) : 0;
      return { label: WEEKDAY_RING_LABELS[i], count, pct };
    });
  }, [habits, totalHabits]);

  const habitsCompletedWeek = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      for (const h of habits) {
        const logs = h.habit_logs || [];
        for (const log of logs) {
          const d = new Date(log.completed_at);
          const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (isSameDay(local, day)) {
            sum++;
            break;
          }
        }
      }
    }
    return sum;
  }, [habits]);

  const habitsPotentialWeek = totalHabits * 7;

  const weeklyProgressLabel = useMemo(() => {
    if (totalHabits === 0) return "0%";
    const maxPerDay = weeklyBarData.reduce((m, d) => Math.max(m, d.count), 0);
    const pct = Math.round((maxPerDay / totalHabits) * 100);
    return `${pct}%`;
  }, [weeklyBarData, totalHabits]);

  const showFrom = habits.length === 0 ? 0 : (habitListSafePage - 1) * habitListPageSize + 1;
  const showTo = Math.min(habitListSafePage * habitListPageSize, habits.length);

  const railProps: RightRailBlocksProps = {
    weeklyBarData,
    habitsCompletedWeek,
    habitsPotentialWeek,
    longestStreak,
  };

  return (
    <>
      {isLoading ? (
        <div className="relative min-h-[calc(100dvh-5rem)] overflow-x-hidden pb-20 text-[var(--solace-text)] lg:pb-11 solace-canvas-bg">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(76,29,149,0.2),transparent_52%),radial-gradient(ellipse_70%_50%_at_100%_40%,rgba(14,165,233,0.06),transparent_42%)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1680px] px-3 sm:px-5 lg:px-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-8 sm:pb-10">
              <div className="space-y-3">
                <Skeleton className="h-9 w-52 rounded-lg bg-zinc-800/90" />
                <Skeleton className="h-4 w-72 bg-zinc-800/80" />
              </div>
              <Skeleton className="h-11 w-36 rounded-full bg-zinc-800/80" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_min(100%,340px)] xl:gap-8">
              <div className="space-y-5">
                <Skeleton className="h-[300px] w-full rounded-[2rem] bg-zinc-800/70" />
                <Skeleton className="h-[180px] w-full rounded-[1.55rem] bg-zinc-800/62" />
                <Skeleton className="h-[180px] w-full rounded-[1.55rem] bg-zinc-800/62" />
              </div>
              <div className="hidden space-y-0 xl:block">
                <Skeleton className="min-h-[520px] w-full rounded-[1.45rem] bg-zinc-800/62" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="relative min-h-[calc(100dvh-5rem)] overflow-x-hidden pb-20 text-[var(--solace-text)] lg:pb-8 solace-canvas-bg">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(76,29,149,0.2),transparent_52%),radial-gradient(ellipse_70%_50%_at_100%_40%,rgba(14,165,233,0.06),transparent_42%)]"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto max-w-[1680px] px-3 sm:px-5 lg:px-8 mt-8">
          <header className="mb-8 border-b border-white/[0.04] ">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <Target className="h-7 w-7 shrink-0 text-violet-300/85 sm:h-8 sm:w-8" aria-hidden strokeWidth={1.5} />
                  <h1 className="font-serif text-[1.9rem] font-normal leading-tight tracking-[-0.02em] text-zinc-50 sm:text-[2.15rem] lg:text-[2.25rem]">
                    Habit Tracker
                  </h1>
                </div>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed tracking-[-0.01em] text-[var(--solace-muted)] sm:text-[1.05rem] sm:leading-[1.75]">
                  Build gentle rhythms—small steps that add up over time.
                </p>
              </div>
              <SolaceGlowButton
                type="button"
                onClick={() => setShowNewHabit(true)}
                className="min-h-[44px] shrink-0 shadow-[0_0_32px_rgba(139,92,246,0.35)]"
              >
                <Plus className="size-4" aria-hidden strokeWidth={2} />
                Add Habit
              </SolaceGlowButton>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_min(100%,340px)] xl:items-start xl:gap-8">
            <div className="min-w-0 space-y-8 lg:space-y-10">
              {/* Hero — locked Solace cinematic shell */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              >
                <SolacePanel glow="violet" className="overflow-hidden rounded-[2rem] p-0 shadow-[0_56px_140px_-58px_rgba(0,0,0,0.92)] ring-1 ring-inset ring-white/[0.09] sm:rounded-[2.1rem]">
                  <div className="relative min-h-[280px] md:min-h-[300px]">
                    <img
                      src={HABIT_TRACKER_IMAGES.hero}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full scale-[1.03] object-cover object-[center_38%] brightness-[1.1] contrast-[1.05] saturate-[1.15]"
                      loading="eager"
                      decoding="async"
                    />

                    <div
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_78%_18%,rgba(248,250,252,0.12)_0%,transparent_55%),radial-gradient(ellipse_70%_55%_at_72%_22%,rgba(167,139,250,0.14),transparent_58%),radial-gradient(ellipse_50%_48%_at_18%_78%,rgba(34,211,238,0.07),transparent_52%)]"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute right-[10%] top-[10%] h-[min(36vw,200px)] w-[min(36vw,200px)] rounded-full bg-violet-100/[0.1] blur-[56px]"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#03040a]/62 via-[#050810]/22 to-transparent"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020308]/90 via-[#020308]/20 via-32% to-transparent"
                      aria-hidden
                    />

                    <div className="relative z-10 min-h-[280px] md:min-h-[300px]">
                      <div className="flex min-h-[280px] flex-col justify-center px-6 py-6 pr-[12.5rem] sm:px-8 sm:py-7 sm:pr-[13.5rem] md:min-h-[300px] lg:max-w-[58%] lg:pr-10">
                        <p className="text-[12px] font-medium tracking-[0.02em] text-violet-200/90">
                          Your habits, your rhythm.
                        </p>
                        <h2 className="mt-3 font-serif text-[clamp(1.45rem,3vw,2rem)] font-normal leading-[1.18] tracking-[-0.025em] text-zinc-50">
                          Your Habit Journey
                        </h2>
                        <p className="mt-3 max-w-md text-[14px] leading-[1.65] text-zinc-400/96 sm:text-[15px]">
                          Small steps. Consistent presence. Big changes over time.
                        </p>
                      </div>

                      <div className="absolute right-3 top-4 z-[12] sm:right-5 sm:top-5 md:right-6 md:top-6 lg:right-8 lg:top-7">
                        <div
                          className="pointer-events-none absolute left-1/2 top-1/2 h-[min(56vw,220px)] w-[min(56vw,220px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.16)_0%,rgba(34,211,238,0.07)_42%,transparent_68%)] blur-md"
                          aria-hidden
                        />
                        <HeroProgressRing completed={completedTodayCount} total={totalHabits} />
                      </div>
                    </div>

                    {/* Integrated stat strip — one surface */}
                    <div className="relative z-20 border-t border-white/[0.06] bg-[#020308]/82 px-1 backdrop-blur-xl">
                      <div className="grid grid-cols-2 divide-y divide-white/[0.05] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                        {[
                          {
                            label: "Day streak",
                            value: String(longestStreak),
                            sub: "days showing up",
                            Icon: Flame,
                            iconClass: "text-orange-400/90",
                          },
                          {
                            label: "Consistency",
                            value: `${completionRate}%`,
                            sub: "today",
                            Icon: TrendingUp,
                            iconClass: "text-violet-300/90",
                          },
                          {
                            label: "Active habits",
                            value: String(totalHabits),
                            sub: "in gentle orbit",
                            Icon: Sprout,
                            iconClass: "text-emerald-400/85",
                          },
                          {
                            label: "Weekly progress",
                            value: weeklyProgressLabel,
                            sub: "peak day breadth",
                            Icon: CircleDot,
                            iconClass: "text-cyan-300/88",
                          },
                        ].map(({ label, value, sub, Icon: SI, iconClass }) => (
                          <div key={label} className="flex flex-col justify-center px-4 py-4 sm:min-h-[88px] sm:px-5 sm:py-5">
                            <div className="flex items-center gap-2">
                              <SI className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
                              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
                            </div>
                            <p className="mt-2 font-serif text-[1.2rem] font-normal tabular-nums tracking-tight text-zinc-50 sm:text-[1.3rem]">
                              {value}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-zinc-500">{sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SolacePanel>
              </motion.section>

              {/* Habits */}
              <section aria-label="My habits" className="space-y-7">
                <div className="pb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Rhythm</p>
                  <h2 className="mt-2 font-serif text-2xl font-normal tracking-tight text-zinc-50 sm:text-[1.65rem]">My Habits</h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-[1.7] text-[var(--solace-muted)]">
                    Build the life you gently choose, one moment at a time.
                  </p>
                </div>

                {habits.length === 0 ? (
                  <SolacePanel glow="violet" soft className="p-8 text-center">
                    <div className="mx-auto mb-5 h-[88px] w-[88px] overflow-hidden rounded-full border border-white/[0.1] bg-black/40 shadow-[0_0_40px_-8px_rgba(139,92,246,0.45)]">
                      <img
                        src={HABIT_TRACKER_IMAGES.companionMascot}
                        alt=""
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <p className="font-serif text-[17px] text-zinc-200">Nothing to track yet</p>
                    <p className="mt-2 text-[14px] text-[var(--solace-muted)]">
                      Begin with something small — a single habit you&apos;d like to soften into.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setShowNewHabit(true)}
                      className="mt-6 rounded-full bg-gradient-to-r from-violet-600/92 to-indigo-700/90 px-8 text-white shadow-[0_20px_50px_-22px_rgba(76,29,149,0.55)]"
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden /> Add your first habit
                    </Button>
                  </SolacePanel>
                ) : (
                  <div className="space-y-6">
                    {paginatedHabits.map((habit) => (
                      <HabitRailCard
                        key={habit.id}
                        habit={habit}
                        onToggleToday={() => void toggleHabit(habit.id)}
                        onDotPress={(i) => void toggleHabitForDate(habit.id, i)}
                        onEdit={() => handleEditHabit(habit)}
                        onDelete={() => void handleDeleteHabit(habit.id)}
                        isDeleting={isDeleting === habit.id}
                      />
                    ))}

                    {habits.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.04] pt-4 text-[12px] text-zinc-500">
                        <p>
                          Showing{" "}
                          <span className="tabular-nums text-zinc-400">
                            {showFrom} to {showTo}
                          </span>{" "}
                          of{" "}
                          <span className="tabular-nums text-zinc-400">{habits.length}</span> habits
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                            <span id="habit-per-page-label">Per page</span>
                            <Select
                              value={String(habitListPageSize)}
                              onValueChange={(v) => {
                                setHabitListPageSize(Number(v));
                                setHabitListPage(1);
                              }}
                            >
                              <SelectTrigger
                                aria-labelledby="habit-per-page-label"
                                className={solaceSelectTriggerPagination}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                sideOffset={6}
                                className={solaceSelectContentClass}
                              >
                                {HABIT_LIST_PAGE_OPTIONS.map((n) => (
                                  <SelectItem
                                    key={n}
                                    value={String(n)}
                                    textValue={String(n)}
                                    className={solaceSelectItemClass}
                                  >
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Previous page"
                              disabled={habitListSafePage <= 1}
                              onClick={() => setHabitListPage((p) => Math.max(1, p - 1))}
                              className="min-h-[44px] rounded-xl border border-white/[0.08] px-3 text-zinc-300 transition-colors enabled:hover:border-violet-400/35 enabled:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ChevronLeft className="h-5 w-5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label="Next page"
                              disabled={habitListSafePage >= habitListTotalPages}
                              onClick={() => setHabitListPage((p) => Math.min(habitListTotalPages, p + 1))}
                              className="min-h-[44px] rounded-xl border border-white/[0.08] px-3 text-zinc-300 transition-colors enabled:hover:border-violet-400/35 enabled:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ChevronRight className="h-5 w-5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <MobileContinuation {...railProps} />
            </div>

            <aside className="relative z-[10] hidden min-w-0 xl:block xl:sticky  xl:self-start xl:rounded-[1.65rem] xl:ring-1 xl:ring-inset xl:ring-white/[0.015] xl:shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]">
              <RightRailBlocks {...railProps} />
            </aside>
          </div>

          <div className="relative mt-8 sm:mt-10 xl:mt-11">
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-[2.75rem] bg-[linear-gradient(180deg,transparent_0%,rgba(6,10,18,0.28)_74%,rgba(6,10,18,0.48)_100%)]"
              aria-hidden
            />
            <div className="relative">
              <TalkItOutBottomDock
                getSupportSlot={
                  <Button
                    asChild
                    className="min-h-[44px] rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-6 text-[13px] text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
                  >
                    <Link to="/app/emergency-resources">Get Support</Link>
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* New/Edit modal */}
        <AnimatePresence>
          {showNewHabit && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-label="Close dialog"
                onClick={() => {
                  setShowNewHabit(false);
                  resetForm();
                }}
                className="fixed inset-0 z-50 bg-[#05060b]/80 backdrop-blur-md"
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="habit-modal-title"
                initial={{ opacity: 0, scale: 0.96, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="solace-scroll fixed inset-4 z-[51] mx-auto overflow-y-auto sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-6rem)] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2"
              >
                <SolacePanel
                  glow="violet"
                  className="overflow-hidden rounded-[1.65rem] p-0 ring-1 ring-inset ring-white/[0.09] shadow-[0_48px_120px_-40px_rgba(0,0,0,0.95)]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_100%_0%,rgba(139,92,246,0.1),transparent_55%),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(34,211,238,0.05),transparent_50%)]"
                    aria-hidden
                  />
                  <div className="relative border-b border-white/[0.06] px-7 py-6 sm:px-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/75">
                          Rhythm
                        </p>
                        <h3 id="habit-modal-title" className="mt-2 font-serif text-[1.4rem] font-normal tracking-tight text-zinc-50">
                          {editingHabit ? "Edit habit" : "New habit"}
                        </h3>
                        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">
                          Something small you&apos;d like to return to, gently.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewHabit(false);
                          resetForm();
                        }}
                        aria-label="Close"
                        className="min-h-[44px] shrink-0 rounded-xl border border-white/[0.06] bg-black/30 p-2 text-zinc-500 transition-colors hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                      >
                        <X className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="relative space-y-5 px-7 py-6 sm:px-8 sm:py-7">
                    <div>
                      <label htmlFor="habit-name" className={habitModalLabelClass}>
                        Name
                      </label>
                      <input
                        id="habit-name"
                        type="text"
                        value={habitFormData.name}
                        onChange={(e) => setHabitFormData({ ...habitFormData, name: e.target.value })}
                        placeholder="What would feel kind to nurture?"
                        className={habitModalInputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={habitModalLabelClass}>Icon</label>
                        <Select
                          value={habitFormData.icon}
                          onValueChange={(icon) => setHabitFormData({ ...habitFormData, icon })}
                        >
                          <SelectTrigger aria-label="Habit icon" className={solaceSelectTriggerForm}>
                            <SelectValue placeholder="Pick an icon" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
                            {habitEmojiOptions.map((emoji) => (
                              <SelectItem
                                key={emoji}
                                value={emoji}
                                textValue={emoji}
                                className={solaceSelectItemClass}
                              >
                                <FluentEmoji emoji={emoji} size={22} className="shrink-0" />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={habitModalLabelClass}>Frequency</label>
                        <Select
                          value={habitFormData.frequency}
                          onValueChange={(frequency) =>
                            setHabitFormData({
                              ...habitFormData,
                              frequency: frequency as "daily" | "weekly",
                            })
                          }
                        >
                          <SelectTrigger aria-label="Habit frequency" className={solaceSelectTriggerForm}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
                            <SelectItem value="daily" className={solaceSelectItemClass}>
                              Daily
                            </SelectItem>
                            <SelectItem value="weekly" className={solaceSelectItemClass}>
                              Weekly
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className={habitModalLabelClass}>Category</label>
                      <Select
                        value={habitFormData.category || undefined}
                        onValueChange={(category) => setHabitFormData({ ...habitFormData, category })}
                      >
                        <SelectTrigger aria-label="Habit category" className={solaceSelectTriggerForm}>
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
                          {habitCategories.map((category) => (
                            <SelectItem key={category} value={category} className={solaceSelectItemClass}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {habitFormData.category === "+ Custom" && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Name your category"
                          className={cn(habitModalInputClass, "mt-3")}
                        />
                      )}
                    </div>

                    <div className="border-t border-white/[0.06] pt-5">
                      <label className={habitModalLabelClass}>Accent</label>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          { label: "Sky", value: "from-blue-400 to-cyan-500" },
                          { label: "Violet", value: "from-purple-400 to-indigo-500" },
                          { label: "Forest", value: "from-green-400 to-teal-500" },
                          { label: "Ember", value: "from-orange-400 to-red-500" },
                          { label: "Rose", value: "from-pink-400 to-rose-500" },
                          { label: "Honey", value: "from-amber-400 to-orange-500" },
                        ].map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setHabitFormData({ ...habitFormData, color: color.value })}
                            className={cn(
                              "min-h-[44px] rounded-xl border px-3 py-2.5 text-xs font-medium text-white transition-[border-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35 active:scale-[0.98]",
                              habitFormData.color === color.value
                                ? "border-white/30 shadow-[0_0_28px_rgba(139,92,246,0.32)] ring-2 ring-violet-400/40"
                                : "border-white/[0.08] opacity-90 hover:border-white/20 hover:opacity-100",
                              `bg-gradient-to-br ${color.value}`
                            )}
                          >
                            {color.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setShowNewHabit(false);
                          resetForm();
                        }}
                        className="min-h-[48px] flex-1 rounded-xl border-white/[0.12] bg-black/25 text-zinc-200 hover:border-violet-400/25 hover:bg-white/[0.04]"
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (habitFormData.category === "+ Custom") {
                            const trimmedCategory = customCategory.trim();
                            if (!trimmedCategory) {
                              toast.error("Please enter a custom category");
                              return;
                            }
                            handleSaveHabit({ ...habitFormData, category: trimmedCategory });
                            return;
                          }
                          handleSaveHabit();
                        }}
                        className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 text-white shadow-[0_20px_50px_-24px_rgba(76,29,149,0.55)]"
                        disabled={
                          !habitFormData.name ||
                          !habitFormData.category ||
                          (habitFormData.category === "+ Custom" && !customCategory.trim())
                        }
                        isLoading={isSaving}
                      >
                        <Check className="mr-2 h-4 w-4" aria-hidden />
                        {editingHabit ? "Save changes" : "Create habit"}
                      </Button>
                    </div>
                  </div>
                </SolacePanel>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

        </>
      )}
    </>
  );
}
