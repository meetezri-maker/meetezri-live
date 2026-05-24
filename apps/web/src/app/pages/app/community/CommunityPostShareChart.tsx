import { useMemo } from "react";
import {
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import type { CommunityPostShareVisual } from "@/lib/communityPostShare";

interface CommunityPostShareChartProps {
  visual: CommunityPostShareVisual;
  chartId: string;
  className?: string;
}

const WHEEL_COLORS = [
  "#c084fc",
  "#f472b6",
  "#22d3ee",
  "#fbbf24",
  "#4ade80",
  "#818cf8",
  "#e879f9",
] as const;

function truncateLabel(label: string, max = 12): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

interface WheelRow {
  name: string;
  value: number;
  fill: string;
  fullLabel: string;
  displayValue: string;
}

function WheelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WheelRow }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-violet-400/30 bg-[#0a0d18] px-2.5 py-1.5 text-xs shadow-lg">
      <p className="max-w-[130px] font-medium text-violet-50">{row.fullLabel}</p>
      <p className="mt-0.5 tabular-nums text-fuchsia-200">{row.displayValue}</p>
    </div>
  );
}

const PULSE_RADIUS = 48;
const PULSE_ARC_LEN = Math.PI * PULSE_RADIUS;

export function CommunityPostShareChart({
  visual,
  chartId,
  className,
}: CommunityPostShareChartProps) {
  const safeId = chartId.replace(/[^a-zA-Z0-9_-]/g, "") || "share";
  const gradId = `sharePulseGrad-${safeId}`;
  const score = Math.min(100, Math.max(0, Math.round(visual.gaugeValue)));
  const pulseFilled = (score / 100) * PULSE_ARC_LEN;

  const wheelData = useMemo<WheelRow[]>(() => {
    if (visual.bars.length > 0) {
      return visual.bars.map((bar, index) => ({
        name: truncateLabel(bar.label),
        value: Math.min(100, Math.max(0, bar.value)),
        fill: WHEEL_COLORS[index % WHEEL_COLORS.length]!,
        fullLabel: bar.label,
        displayValue: bar.displayValue ?? `${bar.value}%`,
      }));
    }
    return [
      {
        name: visual.title,
        value: score,
        fill: WHEEL_COLORS[0]!,
        fullLabel: visual.title,
        displayValue: `${score}%`,
      },
    ];
  }, [score, visual.bars, visual.title]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[240px] w-full flex-col items-center overflow-hidden px-2 py-3 sm:px-3",
        className,
      )}
      role="img"
      aria-label={`${visual.title} wheel chart, ${score} percent overall`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#070a14]" />

      <p className="relative mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-200/65">
        {visual.title}
      </p>
      <p className="relative mb-2 text-center text-[10px] font-medium text-fuchsia-200/75">
        {visual.gaugeLabel}
      </p>

      {/* Center pulse arc (Community Pulse style) */}
      <div className="relative mx-auto w-full max-w-[168px] shrink-0">
        <svg
          viewBox="0 0 120 72"
          className="relative w-full drop-shadow-[0_0_22px_rgba(192,132,252,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <path
            d="M 12 60 A 48 48 0 0 1 108 60"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 12 60 A 48 48 0 0 1 108 60"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${pulseFilled} ${PULSE_ARC_LEN}`}
            style={{ filter: "drop-shadow(0 0 8px rgba(192, 132, 252, 0.65))" }}
          />
        </svg>
        <p className="-mt-2 text-center text-2xl font-semibold tabular-nums text-white">{score}%</p>
        <p className="text-center text-[9px] uppercase tracking-wider text-violet-200/60">Overall</p>
      </div>

      {/* Radial wheel — one segment per metric from the post */}
      <div className="relative mt-1 min-h-[130px] w-full max-w-[220px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="88%"
            barSize={11}
            data={wheelData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="category" dataKey="name" tick={false} />
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.06)" }}
              dataKey="value"
              cornerRadius={5}
              animationDuration={900}
            >
              {wheelData.map((row) => (
                <Cell
                  key={row.fullLabel}
                  fill={row.fill}
                  style={{ filter: `drop-shadow(0 0 8px ${row.fill}88)` }}
                />
              ))}
            </RadialBar>
            <Tooltip content={<WheelTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <ul className="relative mt-1 max-h-[72px] w-full shrink-0 space-y-1 overflow-y-auto overscroll-contain px-1">
        {wheelData.map((row) => (
          <li
            key={row.fullLabel}
            className="flex items-center justify-between gap-2 text-[9px] leading-tight"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-violet-100/88">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.fill, boxShadow: `0 0 6px ${row.fill}` }}
                aria-hidden
              />
              <span className="truncate">{row.fullLabel}</span>
            </span>
            <span className="shrink-0 tabular-nums text-violet-200/65">{row.displayValue}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
