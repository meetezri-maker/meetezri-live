import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { datesForPreset, type DashboardTimePreset } from '@/lib/adminAnalytics';
import { adminBtnPrimary, adminInput } from '@/app/admin/adminPageChrome';
import { cn } from '@/lib/utils';

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
  /** When false, hides the Week/Month/Year chart bucket control (e.g. date-only analytics pages). Default true. */
  showChartPeriod?: boolean;
  /** When false, hides the Last 7/30/… preset control. Default true. */
  showRangePreset?: boolean;
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
  showChartPeriod = true,
  showRangePreset = true,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showChartPeriod && (
        <div className="flex items-center gap-1 text-sm text-[var(--admin-text-muted)]">
          <span className="hidden sm:inline">Charts:</span>
          <select
            value={chartPeriod}
            onChange={(e) => onChartPeriodChange(e.target.value as 'week' | 'month' | 'year')}
            className={cn(adminInput, "py-2")}
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>
      )}

      {showRangePreset && (
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline text-sm text-[var(--admin-text-muted)]">Range:</span>
          <select
            value={useCustomRange ? 'custom' : rangePreset}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'custom') {
                onUseCustomRangeChange(true);
              } else {
                onUseCustomRangeChange(false);
                onRangePresetChange(v as DashboardTimePreset);
                const d = datesForPreset(v as DashboardTimePreset);
                onDateFromChange(d.dateFrom);
                onDateToChange(d.dateTo);
              }
            }}
            className={cn(adminInput, "py-2")}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!showRangePreset && (
          <span className="hidden sm:inline text-sm text-[var(--admin-text-muted)]">Period:</span>
        )}
        <input
          type="date"
          value={dateFrom}
          min="2020-01-01"
          max="2099-12-31"
          onChange={(e) => {
            onUseCustomRangeChange(true);
            onDateFromChange(e.target.value);
          }}
          className={cn(adminInput, "py-2")}
        />
        <span className="text-[var(--admin-text-muted)]">–</span>
        <input
          type="date"
          value={dateTo}
          min="2020-01-01"
          max="2099-12-31"
          onChange={(e) => {
            onUseCustomRangeChange(true);
            onDateToChange(e.target.value);
          }}
          className={cn(adminInput, "py-2")}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        title="Refresh"
        className="shrink-0 border-[color:var(--admin-border)] bg-white/[0.03] text-[var(--admin-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--admin-text)]"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>

      {showExport && onExport && (
        <button type="button" className={cn(adminBtnPrimary, "gap-2")} onClick={onExport}>
          <Download className="w-4 h-4" />
          {exportLabel}
        </button>
      )}
    </div>
  );
}
