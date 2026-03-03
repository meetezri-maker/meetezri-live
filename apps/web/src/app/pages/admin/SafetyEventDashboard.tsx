/**
 * EZRI — CONVERSATION SAFETY FLOW - PHASE 2
 * Admin dashboard for monitoring safety events
 */

import { useState, useMemo } from 'react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { SafetyEventCard } from '@/app/components/admin/SafetyEventCard';
import { SafetyAnalyticsChart, SafetyStatsOverview } from '@/app/components/admin/SafetyAnalyticsChart';
import { getSafetyEvents, getCriticalSafetyEvents, clearSafetyEvents } from '@/app/utils/safetyLogger';
import { SafetyEvent, SafetyState } from '@/app/types/safety';
import { Search, Filter, Download, RefreshCw, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function SafetyEventDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SafetyEvent[]>(getSafetyEvents());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<SafetyState | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('24h');

  // Refresh events
  const refreshEvents = () => {
    setEvents(getSafetyEvents());
    toast.success('Safety events refreshed');
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filter by search query (userId or sessionId)
    if (searchQuery) {
      filtered = filtered.filter(e => 
        e.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.sessionId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by state
    if (filterState !== 'ALL') {
      filtered = filtered.filter(e => e.newState === filterState);
    }

    // Filter by time
    const now = Date.now();
    const timeFilters = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    filtered = filtered.filter(e => now - e.timestamp < timeFilters[timeFilter]);

    return filtered;
  }, [events, searchQuery, filterState, timeFilter]);

  const criticalEvents = filteredEvents.filter(e => e.newState === 'HIGH_RISK' || e.newState === 'SAFETY_MODE');

  const handleViewDetails = (event: SafetyEvent) => {
    navigate('/admin/safety-event-details', { state: { event } });
  };

  const handleExportEvents = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `safety-events-${new Date().toISOString()}.json`;
    link.click();
    toast.success('Safety events exported');
  };

  const handleClearEvents = () => {
    if (confirm('Are you sure you want to clear all safety event logs? This action cannot be undone.')) {
      clearSafetyEvents();
      setEvents([]);
      toast.success('All safety events cleared');
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <Shield className="size-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Safety Event Monitoring</h1>
              <p className="text-gray-600">Real-time monitoring and analysis of conversation safety events</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <SafetyStatsOverview events={events} />

        {/* Controls */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search by user ID or session ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter by state */}
            <Select value={filterState} onValueChange={(value) => setFilterState(value as SafetyState | 'ALL')}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All States</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="ELEVATED_CONCERN">Elevated Concern</SelectItem>
                <SelectItem value="HIGH_RISK">High Risk</SelectItem>
                <SelectItem value="SAFETY_MODE">Safety Mode</SelectItem>
                <SelectItem value="COOLDOWN">Cooldown</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by time */}
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as typeof timeFilter)}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshEvents}>
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="outline" onClick={handleExportEvents}>
                <Download className="size-4" />
              </Button>
            </div>
          </div>

          {/* Active filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {searchQuery && (
              <Badge variant="secondary">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="ml-2">×</button>
              </Badge>
            )}
            {filterState !== 'ALL' && (
              <Badge variant="secondary">
                State: {filterState}
                <button onClick={() => setFilterState('ALL')} className="ml-2">×</button>
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {filteredEvents.length} events
            </Badge>
          </div>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="events" className="space-y-6">
          <TabsList>
            <TabsTrigger value="events">
              All Events
              {filteredEvents.length > 0 && (
                <Badge variant="secondary" className="ml-2">{filteredEvents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="critical">
              Critical Events
              {criticalEvents.length > 0 && (
                <Badge variant="destructive" className="ml-2">{criticalEvents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* All Events Tab */}
          <TabsContent value="events" className="space-y-4">
            {filteredEvents.length === 0 ? (
              <Card className="p-12 text-center">
                <Shield className="size-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Safety Events</h3>
                <p className="text-gray-600">No safety events match your current filters.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map(event => (
                  <SafetyEventCard
                    key={event.id}
                    event={event}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Critical Events Tab */}
          <TabsContent value="critical" className="space-y-4">
            {criticalEvents.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertTriangle className="size-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Critical Events</h3>
                <p className="text-gray-600">No critical safety events found in the selected time range.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900">Critical Events Require Attention</h3>
                      <p className="text-sm text-red-700 mt-1">
                        These events indicate high-risk or safety mode situations. Review each event and follow appropriate protocols.
                      </p>
                    </div>
                  </div>
                </div>
                {criticalEvents.map(event => (
                  <SafetyEventCard
                    key={event.id}
                    event={event}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <SafetyAnalyticsChart
              events={filteredEvents}
              type="trends"
              title="Safety Event Trends (Last 7 Days)"
              height={300}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SafetyAnalyticsChart
                events={filteredEvents}
                type="timeline"
                title="Events by Hour (Last 24 Hours)"
                height={300}
              />
              <SafetyAnalyticsChart
                events={filteredEvents}
                type="distribution"
                title="State Distribution"
                height={300}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Admin Actions */}
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-red-900">Danger Zone</h3>
              <p className="text-sm text-red-700 mt-1">
                Clear all safety event logs. This action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" onClick={handleClearEvents}>
              Clear All Events
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayoutNew>
  );
}
