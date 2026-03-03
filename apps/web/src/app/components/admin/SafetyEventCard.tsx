/**
 * EZRI — CONVERSATION SAFETY FLOW - PHASE 2
 * Admin component for displaying individual safety events
 */

import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { SafetyEvent, SafetyState } from '@/app/types/safety';
import { AlertTriangle, Eye, Clock, TrendingUp, TrendingDown, Shield, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface SafetyEventCardProps {
  event: SafetyEvent;
  onViewDetails?: (event: SafetyEvent) => void;
  compact?: boolean;
}

const stateConfig: Record<SafetyState, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  priority: number;
}> = {
  NORMAL: {
    label: 'Normal',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: <Activity className="size-4" />,
    priority: 0,
  },
  ELEVATED_CONCERN: {
    label: 'Elevated Concern',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: <TrendingUp className="size-4" />,
    priority: 1,
  },
  HIGH_RISK: {
    label: 'High Risk',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: <AlertTriangle className="size-4" />,
    priority: 2,
  },
  SAFETY_MODE: {
    label: 'Safety Mode',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: <Shield className="size-4" />,
    priority: 3,
  },
  COOLDOWN: {
    label: 'Cooldown',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: <TrendingDown className="size-4" />,
    priority: 1,
  },
};

export function SafetyEventCard({ event, onViewDetails, compact = false }: SafetyEventCardProps) {
  const newStateConfig = stateConfig[event.newState];
  const previousStateConfig = stateConfig[event.previousState];
  const isCritical = event.newState === 'HIGH_RISK' || event.newState === 'SAFETY_MODE';

  const timeAgo = formatDistanceToNow(event.timestamp, { addSuffix: true });

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3 rounded-lg border ${newStateConfig.bgColor} ${isCritical ? 'ring-2 ring-red-500 ring-opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className={`mt-0.5 ${newStateConfig.color}`}>
              {newStateConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{event.userId}</span>
                <span className="text-xs text-gray-500">→</span>
                <Badge variant="outline" className={`text-xs ${newStateConfig.color}`}>
                  {newStateConfig.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mt-1">{timeAgo}</p>
            </div>
          </div>
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(event)}
              className="shrink-0"
            >
              <Eye className="size-3" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={`p-4 ${isCritical ? 'ring-2 ring-red-500 ring-opacity-50 shadow-lg' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2 rounded-lg ${newStateConfig.bgColor}`}>
                <div className={newStateConfig.color}>
                  {newStateConfig.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{event.userId}</h3>
                  {isCritical && (
                    <Badge variant="destructive" className="text-xs">
                      Critical
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Clock className="size-3" />
                  <span>{timeAgo}</span>
                </div>
              </div>
            </div>

            {/* State Transition */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className={previousStateConfig.color}>
                  {previousStateConfig.label}
                </Badge>
                <span className="text-gray-400">→</span>
                <Badge variant="outline" className={`${newStateConfig.color} font-semibold`}>
                  {newStateConfig.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-medium">Trigger:</span> {event.trigger}
              </p>
            </div>

            {/* Detected Signals */}
            {event.detectedSignals.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Detected Signals:</p>
                <div className="flex flex-wrap gap-1">
                  {event.detectedSignals.map((signal, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Context */}
            {event.context && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                <span className="font-medium">Context:</span> {event.context}
              </div>
            )}

            {/* Session ID */}
            <div className="text-xs text-gray-500 mt-2">
              Session: <code className="bg-gray-100 px-1 rounded">{event.sessionId}</code>
            </div>
          </div>

          {/* Actions */}
          {onViewDetails && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(event)}
              >
                <Eye className="size-4 mr-2" />
                View Details
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
