import { useId } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { DailyBucket } from './resourceAnalyticsUtils';

interface MiniSparklineProps {
  data: number[];
  stroke: string;
  className?: string;
}

export function MiniSparkline({ data, stroke, className }: MiniSparklineProps) {
  const w = 80;
  const h = 36;
  const safe = data.length > 0 ? data : [0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;

  const points = safe
    .map((v, i) => {
      const x = safe.length === 1 ? w / 2 : (i / (safe.length - 1)) * w;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('h-9 w-20 shrink-0 opacity-90', className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ filter: `drop-shadow(0 0 6px ${stroke}66)` }}
      />
    </svg>
  );
}

interface EngagementRingProps {
  percent: number;
  size?: number;
}

export function EngagementRing({ percent, size = 112 }: EngagementRingProps) {
  const gradId = useId().replace(/:/g, '');
  const strokeWidth = 9;
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Engagement ${percent} percent`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`eng-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#eng-${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.45))' }}
        />
      </svg>
    </div>
  );
}

interface SupportActivityTimelineProps {
  data: DailyBucket[];
  isEmpty: boolean;
}

export function SupportActivityTimeline({ data, isEmpty }: SupportActivityTimelineProps) {
  const gradId = useId().replace(/:/g, '');

  const chartData = data.map((d) => ({
    label: d.label,
    value: d.interactions,
  }));

  return (
    <div className="min-h-[280px] w-full sm:min-h-[320px]">
      {isEmpty ? (
        <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center sm:h-[320px]">
          <p className="text-sm text-[rgba(255,255,255,0.5)]">
            Your support timeline will appear here as you explore resources.
          </p>
          <p className="mt-2 text-xs text-[rgba(255,255,255,0.35)]">
            Open emergency resources or use safety tools during a session—then refresh.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id={`timeline-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c084fc" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`timeline-stroke-${gradId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 8"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.32)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as { label: string; value: number };
                return (
                  <div className="rounded-xl border border-white/10 bg-[rgba(10,11,24,0.96)] px-3 py-2 shadow-lg backdrop-blur-md">
                    <p className="text-xs text-[rgba(255,255,255,0.55)]">{row.label}</p>
                    <p className="text-sm font-semibold text-white">
                      {row.value} {row.value === 1 ? 'interaction' : 'interactions'}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={`url(#timeline-stroke-${gradId})`}
              strokeWidth={2.5}
              fill={`url(#timeline-${gradId})`}
              dot={{
                r: 3,
                fill: '#f0abfc',
                stroke: '#fdf4ff',
                strokeWidth: 1,
              }}
              activeDot={{
                r: 6,
                fill: '#f472b6',
                stroke: '#fff',
                strokeWidth: 2,
                style: { filter: 'drop-shadow(0 0 10px rgba(244,114,182,0.8))' },
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
