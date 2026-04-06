import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import type { DashboardTimePreset } from '@/lib/adminAnalytics';

type Props = {
  chartPeriod: 'week' | 'month' | 'year';
  onChartPeriodChange: (v: 'week' | 'month' | 'year') => void;
  rangePreset: DashboardTimePreset;
  onRangePresetChange: (v: DashboardTimePreset) => void;
  useCustomRange: boolean;
  onUseCustomRangeChange: (v: boolean) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onRefresh: () => void;
  onExport?: () => void;
  exportLabel?: string;
  showExport?: boolean;
  isLoading?: boolean;
};

export function AdminAnalyticsToolbar({
  chartPeriod,
  onChartPeriodChange,
  rangePreset,
  onRangePresetChange,
  useCustomRange,
  onUseCustomRangeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onRefresh,
  onExport,
  exportLabel = 'Export',
  showExport = true,
  isLoading = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span className="hidden sm:inline">Charts:</span>
        <select
          value={chartPeriod}
          onChange={(e) => onChartPeriodChange(e.target.value as 'week' | 'month' | 'year')}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <span className="hidden sm:inline text-sm text-muted-foreground">Range:</span>
        <select
          value={useCustomRange ? 'custom' : rangePreset}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'custom') {
              onUseCustomRangeChange(true);
            } else {
              onUseCustomRangeChange(false);
              onRangePresetChange(v as DashboardTimePreset);
            }
          }}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
          <option value="custom">Custom…</option>
        </select>
      </div>

      {useCustomRange && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          />
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        title="Refresh"
        className="shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>

      {showExport && onExport && (
        <Button type="button" className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" onClick={onExport}>
          <Download className="w-4 h-4" />
          {exportLabel}
        </Button>
      )}
    </div>
  );
}
