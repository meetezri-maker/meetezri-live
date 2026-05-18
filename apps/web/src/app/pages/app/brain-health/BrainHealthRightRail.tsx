import { useState } from "react";
import { Link } from "react-router-dom";
import { Battery, Clock, Sparkles, Video } from "lucide-react";
import { SolacePanel } from "@/app/solace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type BrainHealthRailTimeFilter = "today" | "last_week" | "calendar";

interface BrainHealthRightRailProps {
  railTimeFilter: BrainHealthRailTimeFilter;
  onRailTimeFilterChange: (value: BrainHealthRailTimeFilter) => void;
  /** When false, clarity card shows empty-state copy only. */
  hasReflectionSignal: boolean;
  clarityPercent: number;
  cognitiveEnergyLabel: string;
  cognitiveEnergyHint: string;
  mentalRecoveryLabel: string;
  mentalRecoveryHint: string;
  focusWindowTimeLabel: string;
  focusWindowSupportingLine: string;
  overwhelmRows: Array<{
    key: string;
    label: string;
    status: string;
    dotClass: string;
  }>;
  insightRows: Array<{ key: string; text: string; date: string; Icon: LucideIcon; iconWrap: string }>;
}

function MiniSparkline({ className, seed }: { className?: string; seed: number }) {
  const w = 140;
  const h = 32;
  const pts = [0.25, 0.42, 0.38, 0.55, 0.48, 0.62, 0.58, 0.72].map((base, i) => {
    const jitter = ((seed + i * 11) % 10) / 35 - 0.14;
    const y = Math.min(0.92, Math.max(0.12, base + jitter));
    const x = (i / 7) * w;
    return `${x},${h - y * h}`;
  });
  return (
    <svg className={cn("w-full max-w-[140px]", className)} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <path
        d={`M ${pts.join(" L ")}`}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-violet-400/55"
      />
    </svg>
  );
}

function WeekDots() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="mt-2 flex justify-between text-[10px] font-medium tracking-tight text-zinc-600" aria-hidden>
      {days.map((d, i) => (
        <span key={`${d}-${i}`} className="w-4 text-center">
          {d}
        </span>
      ))}
    </div>
  );
}

const FILTER_OPTIONS: Array<{ value: BrainHealthRailTimeFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last_week", label: "Last week" },
  { value: "calendar", label: "Calendar" },
];

const CLARITY_RANGE_OPTIONS: Array<{ value: "week" | "today" | "last_week"; label: string }> = [
  { value: "week", label: "This week" },
  { value: "today", label: "Today" },
  { value: "last_week", label: "Last week" },
];

const solaceSelectTriggerClass = cn(
  "h-8 w-fit min-w-[5.5rem] shrink-0 gap-1 rounded-full border border-white/[0.1] bg-black/50 py-1 pl-3 pr-1.5 text-[11px] font-medium tracking-wide text-zinc-200 shadow-none outline-none transition-[border-color,box-shadow,background-color]",
  "hover:border-violet-400/35 hover:bg-black/65",
  "focus-visible:border-violet-400/45 focus-visible:ring-2 focus-visible:ring-violet-400/30",
  "data-[state=open]:border-violet-400/45 data-[state=open]:bg-black/60 data-[state=open]:shadow-[0_0_22px_rgba(139,92,246,0.18)]",
  "dark:border-white/10 dark:bg-black/50 dark:hover:bg-black/60",
  "[&>svg:last-child]:size-3 [&>svg:last-child]:text-violet-300/85"
);

const solaceSelectContentClass = cn(
  "z-[100] max-h-[min(240px,var(--radix-select-content-available-height))] overflow-hidden rounded-xl border border-white/[0.1]",
  "bg-[#090b12]/[0.97] p-1 text-zinc-200 shadow-[0_24px_56px_-8px_rgba(0,0,0,0.88),0_0_36px_rgba(139,92,246,0.14)] backdrop-blur-xl"
);

const solaceSelectItemClass = cn(
  "relative cursor-pointer rounded-lg py-2 pl-3 pr-8 text-[11px] text-zinc-200 outline-none select-none",
  "data-[highlighted]:bg-violet-500/18 data-[highlighted]:text-zinc-50",
  "data-[state=checked]:bg-violet-500/22 data-[state=checked]:text-zinc-50",
  "[&_svg]:text-violet-300/90"
);

export function BrainHealthRightRail({
  railTimeFilter,
  onRailTimeFilterChange,
  hasReflectionSignal,
  clarityPercent,
  cognitiveEnergyLabel,
  cognitiveEnergyHint,
  mentalRecoveryLabel,
  mentalRecoveryHint,
  focusWindowTimeLabel,
  focusWindowSupportingLine,
  overwhelmRows,
  insightRows,
}: BrainHealthRightRailProps) {
  const [clarityRange, setClarityRange] = useState<"week" | "today" | "last_week">("week");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SolacePanel glow="cyan" soft className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">
            Your Cognitive Rhythm
          </p>
          <Select
            value={railTimeFilter}
            onValueChange={(v) => onRailTimeFilterChange(v as BrainHealthRailTimeFilter)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Time range for rhythm"
              className={solaceSelectTriggerClass}
            >
              <SelectValue placeholder="Today" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className={solaceSelectItemClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-2.5">
          {/* Focus window */}
          <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-950/40 text-cyan-300/90">
              <Clock className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-100">Focus window</p>
              <p className="mt-0.5 break-words text-[13px] font-medium leading-snug tabular-nums text-zinc-200/95">
                {focusWindowTimeLabel}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{focusWindowSupportingLine}</p>
              <div className="mt-2.5 text-cyan-400/75">
                <MiniSparkline seed={railTimeFilter === "today" ? 2 : railTimeFilter === "last_week" ? 5 : 8} />
              </div>
            </div>
          </div>

          {/* Cognitive energy */}
          <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-950/30 text-emerald-300/90">
              <Battery className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-100">Cognitive energy</p>
              <p className="mt-0.5 text-[13px] font-medium text-zinc-200/95">{cognitiveEnergyLabel}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{cognitiveEnergyHint}</p>
            </div>
          </div>

          {/* Mental recovery */}
          <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-500/20 bg-rose-950/25 text-rose-300/85">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-100">Mental recovery</p>
              <p className="mt-0.5 text-[13px] font-medium text-zinc-200/95">{mentalRecoveryLabel}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{mentalRecoveryHint}</p>
            </div>
          </div>
        </div>
      </SolacePanel>

      <SolacePanel glow="violet" soft className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">Clarity trend</p>
          <Select value={clarityRange} onValueChange={(v) => setClarityRange(v as "week" | "today" | "last_week")}>
            <SelectTrigger size="sm" aria-label="Clarity trend range" className={solaceSelectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
              {CLARITY_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className={solaceSelectItemClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasReflectionSignal ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div
              className="relative mx-auto grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full border border-violet-500/25 bg-gradient-to-br from-violet-950/80 to-slate-950/90 shadow-[0_0_32px_rgba(139,92,246,0.22)] sm:mx-0"
              role="img"
              aria-label={`Clarity about ${clarityPercent} percent`}
            >
              <div
                className="absolute inset-1 rounded-full border border-white/[0.04]"
                style={{
                  background: `conic-gradient(from 210deg, rgba(167,139,250,0.55) ${clarityPercent * 3.6}deg, rgba(255,255,255,0.04) 0deg)`,
                }}
              />
              <div className="relative z-[1] flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-[#0a0a12]/95">
                <span className="text-lg font-semibold tracking-tight text-zinc-50">{Math.round(clarityPercent)}%</span>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500">Average clarity</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-xs text-zinc-400">Snapshot from your reflections — not a diagnosis.</p>
              <div className="mt-2 flex justify-center text-violet-400/70 sm:justify-start">
                <MiniSparkline seed={clarityPercent + (clarityRange === "today" ? 3 : clarityRange === "last_week" ? 7 : 0)} />
              </div>
              <WeekDots />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Clarity trend will appear as you complete reflections.
          </p>
        )}
      </SolacePanel>

      <SolacePanel glow="rose" soft className="p-4 sm:p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">Overwhelm signals</p>
        <ul className="mt-4 space-y-3">
          {overwhelmRows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-zinc-200">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", row.dotClass)} aria-hidden />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-zinc-400">{row.status}</span>
            </li>
          ))}
        </ul>
      </SolacePanel>

      <SolacePanel glow="amber" soft className="p-4 sm:p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">Recent insights</p>
        {insightRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {insightRows.map((row) => (
              <li key={row.key} className="flex gap-3 rounded-lg border border-white/[0.04] bg-black/15 p-2.5">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.06]",
                    row.iconWrap
                  )}
                >
                  <row.Icon className="h-4 w-4 text-zinc-200" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-zinc-100/95">{row.text}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{row.date}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">Insights will appear as you use Brain Health.</p>
        )}
      </SolacePanel>

      <SolacePanel glow="violet" className="p-4 sm:p-5">
        <p className="text-sm font-medium text-zinc-100">Need extra support?</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Talk to Solace anytime or explore tools that can help.
        </p>
        <Link
          to="/app/session-lobby"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-violet-600/95 to-indigo-700/90 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] transition-[transform,box-shadow] duration-300 hover:from-violet-500 hover:to-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
        >
          <Video className="mr-2 h-4 w-4 opacity-90" aria-hidden />
          Talk to Solace
        </Link>
      </SolacePanel>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-600">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Solace listens without judging.
      </p>
    </div>
  );
}
