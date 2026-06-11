import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";

export type AdminDonutChartItem = {
  name: string;
  value: number;
  color: string;
  count?: number;
};

const ADMIN_CHART_TOOLTIP = {
  backgroundColor: "var(--admin-chart-tooltip-bg, rgba(17, 22, 42, 0.96))",
  border: "1px solid var(--admin-chart-tooltip-border, rgba(167, 139, 250, 0.22))",
  borderRadius: "12px",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.38)",
  color: "var(--admin-chart-tooltip-text, #f8fafc)",
  fontSize: 12,
};

function renderOutsidePercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  percent = 0,
}: PieLabelRenderProps) {
  if (percent < 0.035) return null;

  const RADIAN = Math.PI / 180;
  const radius = Number(outerRadius) + 26;
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="var(--admin-text, #f8fafc)"
      textAnchor={x > Number(cx) ? "start" : "end"}
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

type AdminDonutChartProps = {
  data: AdminDonutChartItem[];
  height?: number;
  emptyMessage?: string;
  legendFormat?: (item: AdminDonutChartItem) => string;
  tooltipFormat?: (item: AdminDonutChartItem) => [string, string];
};

export function AdminDonutChart({
  data,
  height = 300,
  emptyMessage = "No data available.",
  legendFormat,
  tooltipFormat,
}: AdminDonutChartProps) {
  if (!data.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const defaultLegend = (item: AdminDonutChartItem) =>
    item.count != null
      ? `${item.count} profiles (${item.value}%)`
      : `relative ${item.value}%`;

  const defaultTooltip = (item: AdminDonutChartItem): [string, string] =>
    item.count != null
      ? [`${item.count} profiles (${item.value}%)`, item.name]
      : [`${item.value}%`, item.name];

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 24, right: 36, bottom: 24, left: 36 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={5}
            cornerRadius={10}
            isAnimationActive={false}
            labelLine={false}
            label={renderOutsidePercentLabel}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={entry.color}
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(_value: number, name: string, item: { payload?: AdminDonutChartItem }) => {
              const row = item.payload ?? { name, value: 0, color: "" };
              return tooltipFormat ? tooltipFormat(row) : defaultTooltip(row);
            }}
            contentStyle={ADMIN_CHART_TOOLTIP}
            itemStyle={{ color: "var(--admin-chart-tooltip-text, #f8fafc)" }}
            labelStyle={{ color: "var(--admin-text-muted, #b8c0d4)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-start gap-2 text-sm">
            <div
              className="mt-1 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="mx-1">·</span>
              {legendFormat ? legendFormat(item) : defaultLegend(item)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
