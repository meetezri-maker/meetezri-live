/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Display safety boundary messages and refusals
 */

import { SafetyState } from '@/app/types/safety';
import { ShieldAlert, Heart, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface SafetyBoundaryMessageProps {
  state: SafetyState;
  customMessage?: string;
}

export function SafetyBoundaryMessage({ state, customMessage }: SafetyBoundaryMessageProps) {
  const messages: Record<SafetyState, {
    icon: React.ReactNode;
    title: string;
    message: string;
    variant: 'default' | 'destructive';
  }> = {
    NORMAL: {
      icon: <Info className="size-5" />,
      title: 'Conversation Active',
      message: 'I\'m here to support you through our conversation.',
      variant: 'default',
    },
    ELEVATED_CONCERN: {
      icon: <Heart className="size-5" />,
      title: 'Taking it Slowly',
      message: 'I notice you might be going through a difficult time. Let\'s take this at your pace. Would it help to pause and take a breath together?',
      variant: 'default',
    },
    HIGH_RISK: {
      icon: <ShieldAlert className="size-5" />,
      title: 'I\'m Concerned About Your Safety',
      message: 'I care about your wellbeing, and I\'m not able to provide the kind of help you need right now. Would you consider reaching out to one of these resources? You don\'t have to go through this alone.',
      variant: 'destructive',
    },
    SAFETY_MODE: {
      icon: <ShieldAlert className="size-5" />,
      title: 'Please Reach Out for Immediate Support',
      message: 'I\'m really concerned about your safety. I can\'t provide emergency support, but there are people who can help you right now. Please reach out to emergency services or one of the crisis resources below.',
      variant: 'destructive',
    },
    COOLDOWN: {
      icon: <Heart className="size-5" />,
      title: 'Taking Time to Rest',
      message: 'Thank you for pausing with me. It\'s okay to take a break. When you\'re ready, we can talk more, or you can explore the resources available to you.',
      variant: 'default',
    },
  };

  const config = messages[state];
  const displayMessage = customMessage || config.message;

  if (state === 'NORMAL') {
    return null; // Don't show boundary message in normal state
  }

  return (
    <Alert variant={config.variant} className="mb-4">
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{config.title}</h4>
          <AlertDescription>{displayMessage}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

/**
 * Refusal message for unsafe requests
 */
export function SafetyRefusalMessage() {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="size-5" />
      <div className="ml-3">
        <h4 className="font-semibold mb-1">I Can't Help With That</h4>
        <AlertDescription>
          I care about your safety, but I'm not able to provide guidance on that topic. 
          I'd like to connect you with someone who can offer real support. 
          Would you be willing to reach out to a crisis counselor?
        </AlertDescription>
      </div>
    </Alert>
  );
}
