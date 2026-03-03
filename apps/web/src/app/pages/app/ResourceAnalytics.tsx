/**
 * EZRI — RESOURCE ANALYTICS DASHBOARD
 * View effectiveness and usage of safety resources
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/app/components/AppLayout';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  ArrowLeft,
  TrendingUp,
  Eye,
  Phone,
  MessageSquare,
  ExternalLink,
  BarChart3,
  Award,
  Calendar,
  Download
} from 'lucide-react';
import {
  getAllResourceAnalytics,
  getMostUsedResources,
  getResourceEffectivenessScore,
  getInteractionsBySafetyState,
  getInteractionsByResourceType,
  getInteractionsByTimePeriod,
  exportResourceAnalytics,
  type ResourceAnalytics
} from '@/app/utils/resourceTracking';
import { getSafetyResources } from '@/app/utils/safetyResources';

export function ResourceAnalyticsPage() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Record<string, ResourceAnalytics>>({});
  const [mostUsed, setMostUsed] = useState<Array<ResourceAnalytics & { rank: number }>>([]);
  const [bySafetyState, setBySafetyState] = useState<Record<string, number>>({});
  const [byType, setByType] = useState<Record<string, number>>({});
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeFilter]);

  const loadAnalytics = () => {
    const allAnalytics = getAllResourceAnalytics();
    setAnalytics(allAnalytics);

    const topResources = getMostUsedResources(10);
    setMostUsed(topResources);

    const stateCounts = getInteractionsBySafetyState();
    setBySafetyState(stateCounts);

    const typeCounts = getInteractionsByResourceType();
    setByType(typeCounts);
  };

  const handleExport = () => {
    const data = exportResourceAnalytics();
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

  const getTotalInteractions = () => {
    return Object.values(analytics).reduce(
      (sum, a) => sum + a.totalViews + a.totalClicks,
      0
    );
  };

  const getTotalClicks = () => {
    return Object.values(analytics).reduce((sum, a) => sum + a.totalClicks, 0);
  };

  const getAverageCTR = () => {
    const resources = Object.values(analytics).filter(a => a.totalViews > 0);
    if (resources.length === 0) return 0;
    
    const totalCTR = resources.reduce((sum, a) => {
      const ctr = (a.totalClicks / a.totalViews) * 100;
      return sum + ctr;
    }, 0);
    
    return (totalCTR / resources.length).toFixed(1);
  };

  const getResourceName = (resourceId: string): string => {
    // Try to find resource name from current resources
    const allResources = getSafetyResources();
    const resource = allResources.find(r => r.id === resourceId);
    return resource?.name || resourceId;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Resource Analytics</h1>
              </div>
              <p className="text-muted-foreground">
                Track the effectiveness and usage of safety resources
              </p>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </motion.div>

        {/* Summary Stats */}
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
            <p className="text-sm text-purple-700">Total Clicks</p>
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

        {/* Most Used Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">Most Used Resources</h2>
          <div className="space-y-3">
            {mostUsed.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">No resource interactions yet</p>
              </Card>
            ) : (
              mostUsed.map((resource) => {
                const effectivenessScore = getResourceEffectivenessScore(resource.resourceId);
                const ctr = resource.totalViews > 0 
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
                              <p className="text-xs text-gray-600">Clicks</p>
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

        {/* Interactions by Safety State */}
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
              <p className="text-sm text-muted-foreground">No data yet</p>
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
                      SAFETY_MODE: 'bg-red-500'
                    };

                    return (
                      <div key={state}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{state.replace('_', ' ')}</span>
                          <span className="text-sm font-bold">{count} ({percentage}%)</span>
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
                      support_group: 'bg-green-500'
                    };

                    const nameMap: Record<string, string> = {
                      crisis_line: 'Crisis Lines',
                      text_line: 'Text Lines',
                      emergency: 'Emergency',
                      support_group: 'Support Groups'
                    };

                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{nameMap[type] || type}</span>
                          <span className="text-sm font-bold">{count} ({percentage}%)</span>
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
      </div>
    </AppLayout>
  );
}
