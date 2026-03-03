/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Visual indicator of current safety state (for testing/development)
 */

import { useSafety } from '@/app/contexts/SafetyContext';
import { SafetyState } from '@/app/types/safety';
import { AlertCircle, Shield, AlertTriangle, ShieldAlert, Heart } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

interface SafetyStateIndicatorProps {
  showInProduction?: boolean; // Whether to show in production (default: false)
  compact?: boolean; // Compact view
}

export function SafetyStateIndicator({ 
  showInProduction = false,
  compact = false 
}: SafetyStateIndicatorProps) {
  const { currentState, getStateDescription } = useSafety();

  // Hide in production unless explicitly enabled
  if (!import.meta.env.DEV && !showInProduction) {
    return null;
  }

  const stateConfig: Record<SafetyState, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    label: string;
  }> = {
    NORMAL: {
      icon: <Shield className="size-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      label: 'Normal',
    },
    ELEVATED_CONCERN: {
      icon: <Heart className="size-4" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      label: 'Elevated',
    },
    HIGH_RISK: {
      icon: <AlertTriangle className="size-4" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      label: 'High Risk',
    },
    SAFETY_MODE: {
      icon: <ShieldAlert className="size-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      label: 'Safety Mode',
    },
    COOLDOWN: {
      icon: <AlertCircle className="size-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      label: 'Cooldown',
    },
  };

  const config = stateConfig[currentState];

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={`${config.bgColor} ${config.color} border-current`}
      >
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </Badge>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${config.bgColor} ${config.color} border-current`}>
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <div className="font-medium">Safety State: {config.label}</div>
          <div className="text-sm opacity-80 mt-1">
            {getStateDescription()}
          </div>
        </div>
      </div>
    </div>
  );
}
