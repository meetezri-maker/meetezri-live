import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface InsightDistributionItem {
  name: string;
  value: number;
  color: string;
}

interface InsightActivityWheelProps {
  items: InsightDistributionItem[];
  total: number;
}

function formatMetricValue(value: number): string {
  return value.toLocaleString();
}

export function InsightActivityWheel({ items, total }: InsightActivityWheelProps) {
  const chartData = items.filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[8.5rem] flex-col items-center justify-center px-2 text-center text-xs leading-relaxed text-[var(--solace-muted)]">
        A gentle map forms as you talk, check in, and journal.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Activity overview
        </p>

        <ul className="space-y-2.5" aria-label="Activity breakdown">
          {items.map((item, index) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <li key={item.name}>
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{pct}%</span>
                </div>
                <p
                  className={cn(
                    "pl-3.5 font-serif leading-none tracking-tight text-zinc-50",
                    index === 0
                      ? "text-[1.65rem] sm:text-[1.85rem]"
                      : "text-[1.35rem] sm:text-[1.5rem]",
                  )}
                >
                  {formatMetricValue(item.value)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className="h-[7.25rem] w-[7.25rem] shrink-0 sm:h-[7.75rem] sm:w-[7.75rem]"
        aria-hidden
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="54%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="rgba(6,8,16,0.95)"
              strokeWidth={3}
              animationDuration={600}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
