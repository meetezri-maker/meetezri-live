/**
 * EZRI — PERSONAL SAFETY INSIGHTS
 * User's personalized safety dashboard with patterns, trends, and recommendations
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { AppLayout } from '@/app/components/AppLayout';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Heart,
  Activity,
  AlertTriangle,
  CheckCircle,
  Star,
  Sparkles,
  Phone,
  Users,
  Moon,
  Sun,
  Zap,
  Target,
  Award
} from 'lucide-react';
import { useSafety } from '@/app/contexts/SafetyContext';
import { getSafetyEvents } from '@/app/utils/safetyLogger';
import { getMostUsedResources, getInteractionsBySafetyState } from '@/app/utils/resourceTracking';

export function SafetyInsights() {
  const navigate = useNavigate();
  const { } = useSafety();
  const [insights, setInsights] = useState<any>(null);
  const [safetyHistory, setSafetyHistory] = useState<any[]>([]);

  useEffect(() => {
    const history = getSafetyEvents();
    setSafetyHistory(history);
  }, []);

  useEffect(() => {
    calculateInsights();
  }, [safetyHistory]);

  const calculateInsights = () => {
    // Get safety events from history
    const events = safetyHistory || [];
    
    // Calculate various metrics
    const totalEvents = events.length;
    const last30Days = events.filter((e: any) => {
      const eventDate = new Date(e.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return eventDate >= thirtyDaysAgo;
    });

    // Safety state distribution
    const stateDistribution = events.reduce((acc: any, event: any) => {
      const state = event.newState || event.state;
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    // Time of day patterns
    const timePatterns = events.reduce((acc: any, event: any) => {
      const hour = new Date(event.timestamp).getHours();
      const period = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {});

    // Day of week patterns
    const dayPatterns = events.reduce((acc: any, event: any) => {
      const day = new Date(event.timestamp).getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[day];
      acc[dayName] = (acc[dayName] || 0) + 1;
      return acc;
    }, {});

    // Trigger analysis
    const triggers = events
      .filter((e: any) => e.signal)
      .reduce((acc: any, event: any) => {
        acc[event.signal] = (acc[event.signal] || 0) + 1;
        return acc;
      }, {});

    // Most used resources
    const topResources = getMostUsedResources(3);

    // Resource usage by safety state
    const resourcesByState = getInteractionsBySafetyState();

    // Calculate trends (comparing last 14 days to previous 14 days)
    const last14Days = events.filter((e: any) => {
      const eventDate = new Date(e.timestamp);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      return eventDate >= fourteenDaysAgo;
    });

    const previous14Days = events.filter((e: any) => {
      const eventDate = new Date(e.timestamp);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      return eventDate >= twentyEightDaysAgo && eventDate < fourteenDaysAgo;
    });

    const highRiskLast14 = last14Days.filter((e: any) => 
      e.newState === 'HIGH_RISK' || e.newState === 'SAFETY_MODE'
    ).length;

    const highRiskPrevious14 = previous14Days.filter((e: any) => 
      e.newState === 'HIGH_RISK' || e.newState === 'SAFETY_MODE'
    ).length;

    const trend = highRiskPrevious14 === 0 
      ? (highRiskLast14 > 0 ? 'increasing' : 'stable')
      : highRiskLast14 > highRiskPrevious14 
        ? 'increasing' 
        : highRiskLast14 < highRiskPrevious14 
          ? 'decreasing' 
          : 'stable';

    // Generate recommendations
    const recommendations = generateRecommendations({
      stateDistribution,
      timePatterns,
      dayPatterns,
      triggers,
      trend,
      topResources,
      totalEvents: last30Days.length
    });

    setInsights({
      totalEvents,
      last30DaysCount: last30Days.length,
      stateDistribution,
      timePatterns,
      dayPatterns,
      triggers,
      topResources,
      resourcesByState,
      trend,
      highRiskLast14,
      highRiskPrevious14,
      recommendations,
      safetyScore: calculateSafetyScore(stateDistribution, trend)
    });
  };

  const generateRecommendations = (data: any) => {
    const recs = [];

    // Time-based recommendation
    const mostCommonTime = Object.entries(data.timePatterns)
      .sort(([, a]: any, [, b]: any) => b - a)[0] as [string, number] | undefined;
    
    if (mostCommonTime && mostCommonTime[1] > 2) {
      recs.push({
        type: 'time',
        icon: Clock,
        title: 'Time Pattern Detected',
        description: `You experience elevated concerns most often in the ${mostCommonTime[0]}. Consider scheduling check-ins or self-care during this time.`,
        action: 'Set Reminder',
        actionLink: '/app/settings/notifications'
      });
    }

    // Trigger-based recommendation
    if (Object.keys(data.triggers).length > 0) {
      const topTrigger = Object.entries(data.triggers)
        .sort(([, a]: any, [, b]: any) => b - a)[0] as [string, number];
      
      recs.push({
        type: 'trigger',
        icon: AlertTriangle,
        title: 'Common Trigger Identified',
        description: `"${topTrigger[0]}" has been detected ${topTrigger[1]} times. Consider adding coping strategies for this trigger to your Safety Plan.`,
        action: 'Update Safety Plan',
        actionLink: '/app/settings/safety-plan'
      });
    }

    // Resource usage recommendation
    if (data.topResources.length === 0 || data.totalEvents > 5) {
      recs.push({
        type: 'resource',
        icon: Phone,
        title: 'Explore Support Resources',
        description: 'You have resources available but haven\'t used them recently. Having quick access to support can be helpful during difficult moments.',
        action: 'View Resources',
        actionLink: '/app/crisis-resources'
      });
    }

    // Trend-based recommendation
    if (data.trend === 'increasing') {
      recs.push({
        type: 'trend',
        icon: TrendingUp,
        title: 'Increased Activity Noticed',
        description: 'You\'ve had more safety concerns recently. This might be a good time to reach out to your trusted contacts or a professional.',
        action: 'Contact Support',
        actionLink: '/app/settings/emergency-contacts'
      });
    } else if (data.trend === 'decreasing') {
      recs.push({
        type: 'trend',
        icon: TrendingDown,
        title: 'Positive Progress!',
        description: 'You\'ve had fewer safety concerns lately. Keep up the great work with your wellness practices!',
        action: 'View Progress',
        actionLink: '/app/progress'
      });
    }

    // Self-care recommendation
    recs.push({
      type: 'selfcare',
      icon: Heart,
      title: 'Daily Self-Care',
      description: 'Regular self-care practices can help prevent escalation of concerns. Explore breathing exercises, journaling, or guided meditations.',
      action: 'Explore Tools',
      actionLink: '/app/wellness-tools'
    });

    return recs.slice(0, 4); // Return top 4 recommendations
  };

  const calculateSafetyScore = (distribution: any, trend: string) => {
    // Score from 0-100 based on safety state distribution and trend
    const normalCount = distribution.NORMAL || 0;
    const elevatedCount = distribution.ELEVATED_CONCERN || 0;
    const highRiskCount = distribution.HIGH_RISK || 0;
    const safetyModeCount = distribution.SAFETY_MODE || 0;
    const total = normalCount + elevatedCount + highRiskCount + safetyModeCount;

    if (total === 0) return 100;

    // Weight by severity (inverted - more NORMAL is better)
    const score = (
      (normalCount * 1.0) +
      (elevatedCount * 0.7) +
      (highRiskCount * 0.3) +
      (safetyModeCount * 0.1)
    ) / total * 100;

    // Adjust for trend
    const trendAdjustment = trend === 'decreasing' ? 5 : trend === 'increasing' ? -5 : 0;

    return Math.round(Math.min(100, Math.max(0, score + trendAdjustment)));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (!insights) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

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
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Your Safety Insights</h1>
          </div>
          <p className="text-muted-foreground">
            Personal patterns, trends, and recommendations based on your safety journey
          </p>
        </motion.div>

        {/* Safety Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="p-8 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 border-2 border-purple-200">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - insights.safetyScore / 100)}`}
                      className={getScoreColor(insights.safetyScore)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-4xl font-bold ${getScoreColor(insights.safetyScore)}`}>
                      {insights.safetyScore}
                    </span>
                    <span className="text-xs text-gray-600 mt-1">Safety Score</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {getScoreLabel(insights.safetyScore)} Wellness
                  </h2>
                  <p className="text-muted-foreground mb-3">
                    Based on {insights.last30DaysCount} safety events in the last 30 days
                  </p>
                  <div className="flex items-center gap-2">
                    {insights.trend === 'decreasing' && (
                      <>
                        <TrendingDown className="w-5 h-5 text-green-600" />
                        <span className="text-green-600 font-medium">Improving trend</span>
                      </>
                    )}
                    {insights.trend === 'increasing' && (
                      <>
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                        <span className="orange-600 font-medium">Increasing concerns</span>
                      </>
                    )}
                    {insights.trend === 'stable' && (
                      <>
                        <Activity className="w-5 h-5 text-blue-600" />
                        <span className="text-blue-600 font-medium">Stable patterns</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/app/settings/safety-plan')}>
                  <Target className="w-4 h-4 mr-2" />
                  Safety Plan
                </Button>
                <Button variant="outline" onClick={() => navigate('/app/crisis-resources')}>
                  <Phone className="w-4 h-4 mr-2" />
                  Resources
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Personalized Recommendations */}
        {insights.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Personalized Recommendations
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {insights.recommendations.map((rec: any, index: number) => {
                const Icon = rec.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <Card className="p-5 hover:shadow-lg transition-all">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold mb-1">{rec.title}</h3>
                          <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(rec.actionLink)}
                          >
                            {rec.action}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Patterns Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
          {/* Time Patterns */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Time of Day Patterns
            </h3>
            <div className="space-y-3">
              {Object.entries(insights.timePatterns)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([period, count]: any) => {
                  const total = Object.values(insights.timePatterns).reduce((sum: number, c: any) => sum + c, 0);
                  const percentage = ((count / total) * 100).toFixed(0);
                  
                  const icons: any = {
                    night: Moon,
                    morning: Sun,
                    afternoon: Sun,
                    evening: Moon
                  };
                  const Icon = icons[period];

                  return (
                    <div key={period}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium capitalize">{period}</span>
                        </div>
                        <span className="text-sm font-bold">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* Safety State Distribution */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Safety State Distribution
            </h3>
            <div className="space-y-3">
              {Object.entries(insights.stateDistribution)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([state, count]: any) => {
                  const total = Object.values(insights.stateDistribution).reduce((sum: number, c: any) => sum + c, 0);
                  const percentage = ((count / total) * 100).toFixed(0);
                  
                  const colorMap: any = {
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
                          className={`h-full ${colorMap[state]}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* Top Resources */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              Your Top Resources
            </h3>
            {insights.topResources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resources used yet</p>
            ) : (
              <div className="space-y-3">
                {insights.topResources.map((resource: any, index: number) => (
                  <div key={resource.resourceId} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Resource {index + 1}</p>
                      <p className="text-xs text-muted-foreground">{resource.totalClicks} uses</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/app/settings/resource-analytics')}
            >
              View All Analytics
            </Button>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <h3 className="font-bold text-lg mb-4">Quick Actions for Your Wellness</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                onClick={() => navigate('/app/settings/safety-plan')}
              >
                <Target className="w-6 h-6" />
                <span className="text-xs">Safety Plan</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                onClick={() => navigate('/app/settings/emergency-contacts')}
              >
                <Users className="w-6 h-6" />
                <span className="text-xs">Contacts</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                onClick={() => navigate('/app/wellness-tools')}
              >
                <Heart className="w-6 h-6" />
                <span className="text-xs">Wellness Tools</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                onClick={() => navigate('/app/progress')}
              >
                <Award className="w-6 h-6" />
                <span className="text-xs">Progress</span>
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
