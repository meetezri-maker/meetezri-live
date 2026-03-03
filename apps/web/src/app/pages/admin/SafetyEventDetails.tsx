/**
 * EZRI — CONVERSATION SAFETY FLOW - PHASE 2
 * Detailed view of individual safety events
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { SafetyEvent, SafetyState } from '@/app/types/safety';
import { ArrowLeft, Clock, User, Activity, AlertTriangle, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { getUserSafetyEvents, getSessionSafetyEvents } from '@/app/utils/safetyLogger';

const stateConfig: Record<SafetyState, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  actions: string[];
}> = {
  NORMAL: {
    label: 'Normal',
    description: 'Default conversation flow with no detected safety concerns.',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: <Activity className="size-6" />,
    actions: ['Continue monitoring', 'No immediate action required'],
  },
  ELEVATED_CONCERN: {
    label: 'Elevated Concern',
    description: 'Strong emotional distress detected without unsafe intent. User may be struggling but not in immediate danger.',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: <TrendingUp className="size-6" />,
    actions: ['Monitor conversation closely', 'Provide supportive resources', 'Watch for escalation'],
  },
  HIGH_RISK: {
    label: 'High Risk',
    description: 'Unsafe or alarming intent detected without immediacy. Significant concern for user wellbeing.',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: <AlertTriangle className="size-6" />,
    actions: ['Review full session transcript', 'Consider wellness check', 'Monitor for escalation', 'Document incident'],
  },
  SAFETY_MODE: {
    label: 'Safety Mode',
    description: 'Imminent unsafe intent or urgency detected. User may be in immediate danger.',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: <Shield className="size-6" />,
    actions: ['CRITICAL: Review immediately', 'Follow crisis protocol', 'Contact emergency contact if available', 'Document all actions taken'],
  },
  COOLDOWN: {
    label: 'Cooldown',
    description: 'User is stabilizing after a high-risk interaction. Transitioning back to normal state.',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: <TrendingDown className="size-6" />,
    actions: ['Monitor for stability', 'Provide grounding resources', 'Follow up in next session'],
  },
};

export function SafetyEventDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event as SafetyEvent | undefined;

  if (!event) {
    return (
      <AdminLayoutNew>
        <Card className="p-12 text-center">
          <AlertTriangle className="size-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Not Found</h3>
          <p className="text-gray-600 mb-4">The safety event you're looking for doesn't exist or wasn't provided.</p>
          <Button onClick={() => navigate('/admin/safety-events')}>
            Back to Safety Events
          </Button>
        </Card>
      </AdminLayoutNew>
    );
  }

  const config = stateConfig[event.newState];
  const previousConfig = stateConfig[event.previousState];
  const isCritical = event.newState === 'HIGH_RISK' || event.newState === 'SAFETY_MODE';

  // Get related events
  const userEvents = getUserSafetyEvents(event.userId).filter(e => e.id !== event.id);
  const sessionEvents = getSessionSafetyEvents(event.sessionId).filter(e => e.id !== event.id);

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/admin/safety-events')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Safety Events
          </Button>
          {isCritical && (
            <Badge variant="destructive" className="text-sm">
              Critical Event - Requires Attention
            </Badge>
          )}
        </div>

        {/* Main Event Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`p-6 ${isCritical ? 'ring-2 ring-red-500' : ''}`}>
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-4 rounded-lg ${config.bgColor}`}>
                <div className={config.color}>
                  {config.icon}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{config.label}</h1>
                  <Badge variant="outline" className={config.color}>
                    {event.newState}
                  </Badge>
                </div>
                <p className="text-gray-600">{config.description}</p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Event Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Event Information</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="size-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Timestamp</p>
                      <p className="text-sm text-gray-600">{format(event.timestamp, 'PPpp')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="size-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">User ID</p>
                      <p className="text-sm text-gray-600 font-mono">{event.userId}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Activity className="size-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Session ID</p>
                      <p className="text-sm text-gray-600 font-mono">{event.sessionId}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Event ID</p>
                      <p className="text-sm text-gray-600 font-mono">{event.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">State Transition</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className={previousConfig.color}>
                      {previousConfig.label}
                    </Badge>
                    <div className="text-gray-400">→</div>
                    <Badge variant="outline" className={`${config.color} font-semibold`}>
                      {config.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Trigger</p>
                    <p className="text-sm text-gray-600">{event.trigger}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Signals */}
            {event.detectedSignals.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Detected Signals</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.detectedSignals.map((signal, idx) => (
                      <Badge key={idx} variant="secondary">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Context */}
            {event.context && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Context</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{event.context}</p>
                  </div>
                </div>
              </>
            )}

            {/* Recommended Actions */}
            <Separator className="my-6" />
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Recommended Actions</h3>
              <ul className="space-y-2">
                {config.actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className={`size-1.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-blue-500'} mt-2`} />
                    <span className="text-sm text-gray-700">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>

        {/* Related Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User History */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              User Event History ({userEvents.length})
            </h3>
            {userEvents.length === 0 ? (
              <p className="text-sm text-gray-600">No other events for this user.</p>
            ) : (
              <div className="space-y-3">
                {userEvents.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={stateConfig[e.newState].color}>
                        {e.newState}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {format(e.timestamp, 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
                {userEvents.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{userEvents.length - 5} more events
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Session Timeline */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Session Timeline ({sessionEvents.length})
            </h3>
            {sessionEvents.length === 0 ? (
              <p className="text-sm text-gray-600">No other events in this session.</p>
            ) : (
              <div className="space-y-3">
                {sessionEvents.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={stateConfig[e.newState].color}>
                        {e.newState}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {format(e.timestamp, 'h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
                {sessionEvents.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{sessionEvents.length - 5} more events
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
