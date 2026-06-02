import { Link } from "react-router-dom";
import { Battery, Clock, Sparkles, Video } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import { ClarityCircularRing } from "./ClarityCircularRing";
import { SolacePanel } from "@/app/solace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  solaceSelectContentClass,
  solaceSelectItemCompactClass,
  solaceSelectTriggerCompact,
} from "@/app/solace";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type BrainHealthRailTimeFilter = "today" | "last_week" | "last_month";
export type BrainHealthClarityRange = "week" | "today" | "last_week" | "last_month";

interface BrainHealthRightRailProps {
  railTimeFilter: BrainHealthRailTimeFilter;
  onRailTimeFilterChange: (value: BrainHealthRailTimeFilter) => void;
  clarityRange: BrainHealthClarityRange;
  onClarityRangeChange: (value: BrainHealthClarityRange) => void;
  /** When false, clarity card shows empty-state copy only. */
  hasReflectionSignal: boolean;
  clarityPercent: number;
  cognitiveEnergyLabel: string;
  cognitiveEnergyHint: string;
  mentalRecoveryLabel: string;
  mentalRecoveryHint: string;
  focusWindowTimeLabel: string;
  focusWindowSupportingLine: string;
  focusSparklinePoints: number[];
  clarityChartSeries: Array<{ label: string; clarity: number }>;
  insightRows: Array<{ key: string; text: string; date: string; Icon: LucideIcon; iconWrap: string }>;
}

function MiniSparkline({ className, points }: { className?: string; points: number[] }) {
  const w = 140;
  const h = 32;
  const series = points.length >= 2 ? points : [0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12];
  const pts = series.map((y, i) => {
    const norm = Math.min(0.92, Math.max(0.08, y));
    const x = (i / (series.length - 1)) * w;
    return `${x},${h - norm * h}`;
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

const FILTER_OPTIONS: Array<{ value: BrainHealthRailTimeFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
];

const CLARITY_RANGE_OPTIONS: Array<{ value: BrainHealthClarityRange; label: string }> = [
  { value: "week", label: "This week" },
  { value: "today", label: "Today" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
];

export function BrainHealthRightRail({
  railTimeFilter,
  onRailTimeFilterChange,
  clarityRange,
  onClarityRangeChange,
  hasReflectionSignal,
  clarityPercent,
  cognitiveEnergyLabel,
  cognitiveEnergyHint,
  mentalRecoveryLabel,
  mentalRecoveryHint,
  focusWindowTimeLabel,
  focusWindowSupportingLine,
  focusSparklinePoints,
  clarityChartSeries,
  insightRows,
}: BrainHealthRightRailProps) {

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SolacePanel glow="cyan" soft className="solace-rail-card light-theme-card-hover p-4 sm:p-5">
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
              className={solaceSelectTriggerCompact}
            >
              <SelectValue placeholder="Today" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className={solaceSelectItemCompactClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-2.5">
          {/* Focus window */}
          <div className="flex gap-3 rounded-xl border border-[color:var(--border)] bg-[var(--card-soft)] p-3 [html[data-ezri-theme=dark]_&]:border-white/[0.06] [html[data-ezri-theme=dark]_&]:bg-black/25">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-100/80 text-cyan-700 [html[data-ezri-theme=dark]_&]:border-cyan-500/20 [html[data-ezri-theme=dark]_&]:bg-cyan-950/40 [html[data-ezri-theme=dark]_&]:text-cyan-300/90">
              <Clock className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--solace-text)]">Focus window</p>
              <p className="mt-0.5 break-words text-[13px] font-medium leading-snug tabular-nums text-[var(--text-secondary)]">
                {focusWindowTimeLabel}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--solace-muted)]">{focusWindowSupportingLine}</p>
              <div className="mt-2.5 text-cyan-400/75">
                <MiniSparkline points={focusSparklinePoints} />
              </div>
            </div>
          </div>

          {/* Cognitive energy */}
          <div className="flex gap-3 rounded-xl border border-[color:var(--border)] bg-[var(--card-soft)] p-3 [html[data-ezri-theme=dark]_&]:border-white/[0.06] [html[data-ezri-theme=dark]_&]:bg-black/25">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-100/80 text-emerald-700 [html[data-ezri-theme=dark]_&]:border-emerald-500/20 [html[data-ezri-theme=dark]_&]:bg-emerald-950/30 [html[data-ezri-theme=dark]_&]:text-emerald-300/90">
              <Battery className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--solace-text)]">Cognitive energy</p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{cognitiveEnergyLabel}</p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--solace-muted)]">{cognitiveEnergyHint}</p>
            </div>
          </div>

          {/* Mental recovery */}
          <div className="flex gap-3 rounded-xl border border-[color:var(--border)] bg-[var(--card-soft)] p-3 [html[data-ezri-theme=dark]_&]:border-white/[0.06] [html[data-ezri-theme=dark]_&]:bg-black/25">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-400/30 bg-rose-100/80 text-rose-700 [html[data-ezri-theme=dark]_&]:border-rose-500/20 [html[data-ezri-theme=dark]_&]:bg-rose-950/25 [html[data-ezri-theme=dark]_&]:text-rose-300/85">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--solace-text)]">Mental recovery</p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{mentalRecoveryLabel}</p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--solace-muted)]">{mentalRecoveryHint}</p>
            </div>
          </div>
        </div>
      </SolacePanel>

      <SolacePanel glow="violet" soft className="solace-rail-card light-theme-card-hover p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">Clarity trend</p>
          <Select value={clarityRange} onValueChange={(v) => onClarityRangeChange(v as BrainHealthClarityRange)}>
            <SelectTrigger size="sm" aria-label="Clarity trend range" className={solaceSelectTriggerCompact}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className={solaceSelectContentClass}>
              {CLARITY_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className={solaceSelectItemCompactClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasReflectionSignal ? (
          <div className="relative mt-4 flex flex-col items-center">
            <div
              role="img"
              aria-label={`Clarity about ${Math.round(clarityPercent)} percent`}
            >
              <ClarityCircularRing
                value={clarityPercent}
                size={140}
                strokeWidth={10}
                centerSublabel="Clarity"
              />
            </div>
            <p className="mt-3 text-center text-xs text-[var(--solace-muted)]">
              From your moods and reflections — not a diagnosis.
            </p>
            <div className="mt-4 h-[100px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clarityChartSeries} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bhClarityArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    interval={clarityChartSeries.length > 14 ? 4 : 0}
                  />
                  <Area
                    type="monotone"
                    dataKey="clarity"
                    stroke="#c084fc"
                    strokeWidth={2}
                    fill="url(#bhClarityArea)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#e9d5ff", stroke: "#a855f7" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-[var(--solace-muted)]">
            Log a mood check-in, sleep entry, or guided reflection to see your clarity trend.
          </p>
        )}
      </SolacePanel>

      <SolacePanel glow="amber" soft className="solace-rail-card light-theme-card-hover--gold p-4 sm:p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--solace-muted)]">Recent insights</p>
        {insightRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {insightRows.map((row) => (
              <li key={row.key} className="flex gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--card-muted)] p-2.5 [html[data-ezri-theme=dark]_&]:border-white/[0.04] [html[data-ezri-theme=dark]_&]:bg-black/15">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--card-soft)] text-violet-700",
                    row.iconWrap
                  )}
                >
                  <row.Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-[var(--solace-text)]">{row.text}</p>
                  <p className="mt-1 text-[11px] text-[var(--solace-muted)]">{row.date}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-[var(--solace-muted)]">Insights will appear as you use Brain Health.</p>
        )}
      </SolacePanel>

      <SolacePanel glow="violet" className="solace-rail-card light-theme-card-hover p-4 sm:p-5">
        <p className="text-sm font-medium text-[var(--solace-text)]">Need extra support?</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--solace-muted)]">
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

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-soft)]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Solace listens without judging.
      </p>
    </div>
  );
}
