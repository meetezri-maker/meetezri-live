/**
 * EZRI — RESOURCE ANALYTICS DASHBOARD
 * View effectiveness and usage of safety resources (data from your account, stored in the database).
 */

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CrisisResourcesCallout } from '@/app/components/safety/CrisisResourcesCallout';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  ArrowLeft,
  TrendingUp,
  Eye,
  Phone,
  MessageSquare,
  BarChart3,
  Award,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  Info,
} from 'lucide-react';
import {
  getAllResourceAnalytics,
  getMostUsedResources,
  getResourceEffectivenessScore,
  getInteractionsBySafetyState,
  getInteractionsByResourceType,
  getInteractionsByTimePeriod,
  exportResourceAnalytics,
  mapServerRowsToInteractions,
  getResourceInteractions,
} from '@/app/utils/resourceTracking';
import { getSafetyResources } from '@/app/utils/safetyResources';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export function ResourceAnalyticsPage() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? profile?.id ?? null;
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const range = useMemo(() => {
    const now = new Date();
    const isoEnd = now.toISOString();
    switch (timeFilter) {
      case '7d':
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      case '30d':
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      case '90d':
        return {
          from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      default:
        return {};
    }
  }, [timeFilter]);

  const periodBounds = useMemo(() => {
    const now = new Date();
    switch (timeFilter) {
      case '7d':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case '30d':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case '90d':
        return {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now,
        };
      default:
        return { start: new Date(0), end: now };
    }
  }, [timeFilter]);

  const {
    data: rawRows,
    isLoading,
    isError,
    isSuccess,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.safetyResourceInteractions.list({
      userId,
      from: range.from,
      to: range.to,
      window: timeFilter,
    }),
    queryFn: async () => {
      const rows = (await api.safetyResourceInteractions.list({
        from: range.from,
        to: range.to,
        limit: 5000,
      })) as Array<Record<string, unknown>>;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const serverInteractions = useMemo(
    () => mapServerRowsToInteractions(rawRows ?? []),
    [rawRows]
  );

  const localInteractionsFiltered = useMemo(
    () =>
      getInteractionsByTimePeriod(
        periodBounds.start,
        periodBounds.end,
        getResourceInteractions()
      ),
    [periodBounds.start, periodBounds.end]
  );

  const interactions = useMemo(() => {
    if (!(isSuccess || isError)) return [];
    if (serverInteractions.length > 0) return serverInteractions;
    return localInteractionsFiltered;
  }, [serverInteractions, localInteractionsFiltered, isSuccess, isError]);

  const dataSourceNote: 'synced' | 'local_fallback' | 'offline' =
    serverInteractions.length > 0
      ? 'synced'
      : isError
        ? 'offline'
        : localInteractionsFiltered.length > 0
          ? 'local_fallback'
          : 'synced';

  const analytics = useMemo(
    () => getAllResourceAnalytics(interactions),
    [interactions]
  );

  const mostUsed = useMemo(
    () => getMostUsedResources(10, interactions),
    [interactions]
  );

  const bySafetyState = useMemo(
    () => getInteractionsBySafetyState(interactions),
    [interactions]
  );

  const byType = useMemo(
    () => getInteractionsByResourceType(interactions),
    [interactions]
  );

  const handleExport = () => {
    const data = exportResourceAnalytics(interactions);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTotalInteractions = () =>
    Object.values(analytics).reduce((sum, a) => sum + a.totalViews + a.totalClicks, 0);

  const getTotalClicks = () =>
    Object.values(analytics).reduce((sum, a) => sum + a.totalClicks, 0);

  const getAverageCTR = () => {
    const resources = Object.values(analytics).filter((a) => a.totalViews > 0);
    if (resources.length === 0) return 0;
    const totalCTR = resources.reduce((sum, a) => {
      const ctr = (a.totalClicks / a.totalViews) * 100;
      return sum + ctr;
    }, 0);
    return (totalCTR / resources.length).toFixed(1);
  };

  const getResourceName = useCallback(
    (resourceId: string): string => {
      const fromEvent = interactions.find((i) => i.resourceId === resourceId)?.resourceName;
      if (fromEvent?.trim()) return fromEvent.trim();
      const allResources = getSafetyResources();
      const resource = allResources.find((r) => r.id === resourceId);
      return resource?.name || resourceId.replace(/^web_/i, '').replace(/_/g, ' ');
    },
    [interactions]
  );

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p>Loading your settings…</p>
        </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Sign in to view resource analytics.</p>
          </Card>
        </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Resource Analytics</h1>
              </div>
              <p className="text-muted-foreground">
                See when you opened hotlines, links, or call buttons—we log each action for your insights only.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Time range"
                  disabled={isLoading}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button type="button" onClick={handleExport} variant="outline" disabled={interactions.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </motion.div>

        <Card className="p-6 mb-6 bg-muted/30 border-muted">
          <div className="flex gap-3">
            <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" aria-hidden />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">How this works</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Open{' '}
                  <Link className="text-primary underline underline-offset-2 font-medium" to="/app/emergency-resources">
                    Emergency resources
                  </Link>{' '}
                  from Settings (or tap hotlines inside a live session’s safety-resources panel).
                </li>
                <li>
                  When you <strong className="text-foreground font-medium">tap call, visit site, copy, or similar</strong>
                  , MeetEzri records that action (counts as a view when a card mounts in the modal only).
                </li>
                <li>
                  Data is stored on your account when the API syncs;{' '}
                  <strong className="text-foreground font-medium">Refresh</strong> updates this dashboard. If sync fails,
                  actions from this browser in the selected date range still appear below.
                </li>
              </ol>
              <p className="text-xs pt-2">
                No server yet? Ensure the API is running locally and Postgres has the migration for{' '}
                <code className="text-xs bg-muted px-1 rounded">safety_resource_interactions</code> (run{' '}
                <code className="text-xs bg-muted px-1 rounded">pnpm prisma migrate deploy</code> in{' '}
                <code className="text-xs bg-muted px-1 rounded">apps/api</code>).
              </p>
            </div>
          </div>
        </Card>

        {dataSourceNote === 'offline' && interactions.length > 0 && (
          <Card className="p-4 mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Could not reach the server. Showing activity saved in this browser for the selected period.{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => refetch()}
              >
                Retry sync
              </button>
              .
            </p>
          </Card>
        )}

        {dataSourceNote === 'local_fallback' &&
          interactions.length > 0 &&
          !isError &&
          serverInteractions.length === 0 &&
          isSuccess && (
            <Card className="p-4 mb-6 border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-900">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                No synced history for this window yet—we’re showing what this browser logged. Tap a few resources on{' '}
                <Link className="font-semibold underline" to="/app/emergency-resources">
                  Emergency resources
                </Link>{' '}
                then tap <strong>Refresh</strong> here (after migrations, events save to your account too).
              </p>
            </Card>
          )}

        {isError && interactions.length === 0 && (
          <Card className="p-6 mb-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive text-sm mb-3">
              Could not load analytics from the server. Use Emergency resources once, ensure the API/database migration
              is applied, then retry.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 animate-pulse h-28 bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
            >
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <Eye className="w-8 h-8 text-blue-600" />
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-blue-900">{getTotalInteractions()}</p>
                <p className="text-sm text-blue-700">Total Interactions</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <Phone className="w-8 h-8 text-purple-600" />
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-purple-900">{getTotalClicks()}</p>
                <p className="text-sm text-purple-700">Total Engagements</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-8 h-8 text-green-600" />
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-900">{getAverageCTR()}%</p>
                <p className="text-sm text-green-700">Avg Click Rate</p>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 text-orange-600" />
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-orange-900">{Object.keys(analytics).length}</p>
                <p className="text-sm text-orange-700">Resources Tracked</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold mb-4">Most Used Resources</h2>
              <div className="space-y-3">
                {mostUsed.length === 0 ? (
                  <Card className="p-6 text-center space-y-3">
                    <p className="text-muted-foreground">
                      Nothing recorded in this period yet—open Emergency resources or use the safety-resources panel during
                      a session, tap a phone number or link, then tap <strong>Refresh</strong> above.
                    </p>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/app/emergency-resources">Go to Emergency resources</Link>
                    </Button>
                  </Card>
                ) : (
                  mostUsed.map((resource) => {
                    const effectivenessScore = getResourceEffectivenessScore(
                      resource.resourceId,
                      interactions
                    );
                    const ctr =
                      resource.totalViews > 0
                        ? ((resource.totalClicks / resource.totalViews) * 100).toFixed(1)
                        : '0';

                    return (
                      <motion.div
                        key={resource.resourceId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + resource.rank * 0.05 }}
                      >
                        <Card className="p-5 hover:shadow-lg transition-all">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg font-bold text-lg flex-shrink-0">
                              #{resource.rank}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg mb-1">
                                {getResourceName(resource.resourceId)}
                              </h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                <div>
                                  <p className="text-xs text-gray-600">Views</p>
                                  <p className="text-lg font-bold text-blue-600">{resource.totalViews}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Engagements</p>
                                  <p className="text-lg font-bold text-purple-600">{resource.totalClicks}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Click Rate</p>
                                  <p className="text-lg font-bold text-green-600">{ctr}%</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Effectiveness</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                        style={{ width: `${effectivenessScore}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">{effectivenessScore}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid md:grid-cols-2 gap-6 mb-8"
            >
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  By Safety State
                </h3>
                {Object.keys(bySafetyState).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No safety-state context recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(bySafetyState)
                      .sort(([, a], [, b]) => b - a)
                      .map(([state, count]) => {
                        const total = Object.values(bySafetyState).reduce((sum, c) => sum + c, 0);
                        const percentage = ((count / total) * 100).toFixed(0);

                        const colorMap: Record<string, string> = {
                          NORMAL: 'bg-green-500',
                          ELEVATED_CONCERN: 'bg-yellow-500',
                          HIGH_RISK: 'bg-orange-500',
                          SAFETY_MODE: 'bg-red-500',
                          COOLDOWN: 'bg-slate-500',
                        };

                        return (
                          <div key={state}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{state.replace(/_/g, ' ')}</span>
                              <span className="text-sm font-bold">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${colorMap[state] || 'bg-gray-500'}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  By Resource Type
                </h3>
                {Object.keys(byType).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const total = Object.values(byType).reduce((sum, c) => sum + c, 0);
                        const percentage = ((count / total) * 100).toFixed(0);

                        const colorMap: Record<string, string> = {
                          crisis_line: 'bg-blue-500',
                          text_line: 'bg-purple-500',
                          emergency: 'bg-red-500',
                          support_group: 'bg-green-500',
                          trusted_contact: 'bg-orange-500',
                        };

                        const nameMap: Record<string, string> = {
                          crisis_line: 'Emergency & mental-health hotlines',
                          text_line: 'Text Lines',
                          emergency: 'Emergency',
                          support_group: 'Support Groups',
                          trusted_contact: 'Trusted contact',
                        };

                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{nameMap[type] || type}</span>
                              <span className="text-sm font-bold">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${colorMap[type] || 'bg-gray-500'}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            </motion.div>
          </>
        )}

        <CrisisResourcesCallout />
      </div>
  );
}
