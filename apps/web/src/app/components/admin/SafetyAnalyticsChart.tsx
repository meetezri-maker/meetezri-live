/**
 * EZRI — CONVERSATION SAFETY FLOW - PHASE 2
 * Safety analytics visualization component
 */

import { Card } from '@/app/components/ui/card';
import { SafetyEvent, SafetyState } from '@/app/types/safety';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, Activity, Shield } from 'lucide-react';

interface SafetyAnalyticsChartProps {
  events: SafetyEvent[];
  type: 'timeline' | 'distribution' | 'trends';
  title?: string;
  height?: number;
}

const STATE_COLORS: Record<SafetyState, string> = {
  NORMAL: '#10b981',
  ELEVATED_CONCERN: '#f59e0b',
  HIGH_RISK: '#f97316',
  SAFETY_MODE: '#ef4444',
  COOLDOWN: '#3b82f6',
};

export function SafetyAnalyticsChart({ events, type, title, height = 300 }: SafetyAnalyticsChartProps) {
  
  if (type === 'distribution') {
    // Pie chart showing distribution of states
    const stateCounts: Record<string, number> = {};
    events.forEach(event => {
      stateCounts[event.newState] = (stateCounts[event.newState] || 0) + 1;
    });

    const pieData = Object.entries(stateCounts).map(([state, count]) => ({
      name: state.replace(/_/g, ' '),
      value: count,
      color: STATE_COLORS[state as SafetyState],
    }));

    return (
      <Card className="p-6">
        {title && <h3 className="font-semibold mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (type === 'timeline') {
    // Group events by hour for the last 24 hours
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const recentEvents = events.filter(e => e.timestamp >= twentyFourHoursAgo);

    // Create hourly buckets
    const hourlyData: Record<string, Record<SafetyState, number>> = {};
    for (let i = 0; i < 24; i++) {
      const hourStart = twentyFourHoursAgo + i * 60 * 60 * 1000;
      const hourLabel = new Date(hourStart).getHours() + ':00';
      hourlyData[hourLabel] = {
        NORMAL: 0,
        ELEVATED_CONCERN: 0,
        HIGH_RISK: 0,
        SAFETY_MODE: 0,
        COOLDOWN: 0,
      };
    }

    recentEvents.forEach(event => {
      const hourLabel = new Date(event.timestamp).getHours() + ':00';
      if (hourlyData[hourLabel]) {
        hourlyData[hourLabel][event.newState]++;
      }
    });

    const chartData = Object.entries(hourlyData).map(([hour, states]) => ({
      hour,
      ...states,
    }));

    return (
      <Card className="p-6">
        {title && <h3 className="font-semibold mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="NORMAL" stackId="a" fill={STATE_COLORS.NORMAL} name="Normal" />
            <Bar dataKey="ELEVATED_CONCERN" stackId="a" fill={STATE_COLORS.ELEVATED_CONCERN} name="Elevated" />
            <Bar dataKey="HIGH_RISK" stackId="a" fill={STATE_COLORS.HIGH_RISK} name="High Risk" />
            <Bar dataKey="SAFETY_MODE" stackId="a" fill={STATE_COLORS.SAFETY_MODE} name="Safety Mode" />
            <Bar dataKey="COOLDOWN" stackId="a" fill={STATE_COLORS.COOLDOWN} name="Cooldown" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (type === 'trends') {
    // Line chart showing trends over the last 7 days
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentEvents = events.filter(e => e.timestamp >= sevenDaysAgo);

    // Create daily buckets
    const dailyData: Record<string, { total: number; critical: number; elevated: number }> = {};
    for (let i = 0; i < 7; i++) {
      const dayStart = sevenDaysAgo + i * 24 * 60 * 60 * 1000;
      const dayLabel = new Date(dayStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyData[dayLabel] = { total: 0, critical: 0, elevated: 0 };
    }

    recentEvents.forEach(event => {
      const dayLabel = new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyData[dayLabel]) {
        dailyData[dayLabel].total++;
        if (event.newState === 'HIGH_RISK' || event.newState === 'SAFETY_MODE') {
          dailyData[dayLabel].critical++;
        }
        if (event.newState === 'ELEVATED_CONCERN') {
          dailyData[dayLabel].elevated++;
        }
      }
    });

    const chartData = Object.entries(dailyData).map(([day, counts]) => ({
      day,
      ...counts,
    }));

    return (
      <Card className="p-6">
        {title && <h3 className="font-semibold mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#6b7280" strokeWidth={2} name="Total Events" />
            <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Critical Events" />
            <Line type="monotone" dataKey="elevated" stroke="#f59e0b" strokeWidth={2} name="Elevated Concern" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  return null;
}

interface SafetyStatsOverviewProps {
  events: SafetyEvent[];
}

export function SafetyStatsOverview({ events }: SafetyStatsOverviewProps) {
  const now = Date.now();
  const last24Hours = events.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);
  const criticalEvents = events.filter(e => e.newState === 'HIGH_RISK' || e.newState === 'SAFETY_MODE');
  const elevatedEvents = events.filter(e => e.newState === 'ELEVATED_CONCERN');

  const stats = [
    {
      label: 'Total Events (24h)',
      value: last24Hours.length,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Critical Events',
      value: criticalEvents.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Elevated Concerns',
      value: elevatedEvents.length,
      icon: TrendingUp,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Users Affected',
      value: new Set(events.map(e => e.userId)).size,
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <Card key={idx} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
