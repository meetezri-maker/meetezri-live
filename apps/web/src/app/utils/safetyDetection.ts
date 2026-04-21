/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Mock detection logic for testing (dummy/simulated behavior)
 * 
 * This uses keyword-based triggers to simulate AI detection
 * In production, this would be replaced with actual AI model detection
 */

import { SafetyState, SafetySignals } from '@/app/types/safety';

/**
 * Keywords that trigger different safety states
 * These are intentionally generic for testing purposes
 */
const DETECTION_PATTERNS = {
  ELEVATED_CONCERN: [
    'overwhelmed',
    'hopeless',
    'can\'t cope',
    'cant cope',
    'too much',
    'exhausted',
    'heavy',
    'struggling',
    'drowning',
    'lost',
    'anxious',
    'panic',
    'panicking',
    'empty',
    'numb',
    'breaking down',
    'falling apart',
    'i can\'t do this',
    'i cant do this',
    'not okay',
    'feel trapped',
    'helpless',
    'worthless',
  ],
  HIGH_RISK: [
    'suicide',
    'self-harm',
    'self harm',
    'hurt myself',
    'want to die',
    'better off dead',
    'cutting',
    'overdose',
    'give up',
    'no point',
    'end it',
    'not worth',
    'better off',
    'burden',
    'escape',
    'way out',
    'kill myself',
    'end it all',
    'end my life',
    'i want to disappear',
    'i dont want to live',
    'i don\'t want to live',
    'no reason to live',
    'don\'t want to be here',
    'dont want to be here',
    'i am done',
  ],
  SAFETY_MODE: [
    'urgent crisis',
    'immediate danger',
    'right now',
    'tonight',
    'today',
    'method',
    'plan',
    'i have a plan',
    'i have pills',
    'i have a blade',
    'i am going to kill myself',
    'i will kill myself',
    'i am going to end it',
    'doing it tonight',
    'goodbye forever',
    'this is my last message',
    'can\'t stay safe',
    'cannot stay safe',
  ],
};

/**
 * Analyze text for safety signals (mock implementation)
 */
export function analyzeTextForSafety(text: string, currentState: SafetyState): {
  suggestedState: SafetyState;
  detectedSignals: string[];
  confidence: number;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();
  
  // Check for SAFETY_MODE triggers (highest priority)
  const safetyModeMatches = DETECTION_PATTERNS.SAFETY_MODE.filter(pattern => 
    lowerText.includes(pattern)
  );
  if (safetyModeMatches.length >= 1) {
    return {
      suggestedState: 'SAFETY_MODE',
      detectedSignals: ['immediacyIndicators', 'unsafeBoundaryViolation'],
      confidence: 0.9,
      matchedKeywords: safetyModeMatches,
    };
  }

  // Check for HIGH_RISK triggers
  const highRiskMatches = DETECTION_PATTERNS.HIGH_RISK.filter(pattern => 
    lowerText.includes(pattern)
  );
  if (highRiskMatches.length >= 1) {
    return {
      suggestedState: 'HIGH_RISK',
      detectedSignals: ['lossOfDesireToContinue', 'boundaryCrossingRequests'],
      confidence: 0.8,
      matchedKeywords: highRiskMatches,
    };
  }

  // Check for ELEVATED_CONCERN triggers
  const elevatedConcernMatches = DETECTION_PATTERNS.ELEVATED_CONCERN.filter(pattern => 
    lowerText.includes(pattern)
  );
  if (elevatedConcernMatches.length >= 2) {
    return {
      suggestedState: 'ELEVATED_CONCERN',
      detectedSignals: ['persistentEmotionalHeaviness', 'overwhelmedLanguage'],
      confidence: 0.7,
      matchedKeywords: elevatedConcernMatches,
    };
  }

  // If text suggests improvement and currently in elevated state, suggest de-escalation
  const positivePatterns = ['better', 'calmer', 'okay', 'thanks', 'helped', 'feel good'];
  const positiveMatches = positivePatterns.filter(pattern => lowerText.includes(pattern));
  
  if (positiveMatches.length >= 1) {
    if (currentState === 'HIGH_RISK') {
      return {
        suggestedState: 'ELEVATED_CONCERN',
        detectedSignals: ['stabilization'],
        confidence: 0.6,
        matchedKeywords: positiveMatches,
      };
    } else if (currentState === 'ELEVATED_CONCERN') {
      return {
        suggestedState: 'NORMAL',
        detectedSignals: ['stabilization'],
        confidence: 0.6,
        matchedKeywords: positiveMatches,
      };
    }
  }

  // No triggers detected, maintain current state
  return {
    suggestedState: currentState,
    detectedSignals: [],
    confidence: 0.5,
    matchedKeywords: [],
  };
}

/**
 * Check if a state transition is allowed
 */
export function isValidStateTransition(from: SafetyState, to: SafetyState): boolean {
  const validTransitions: Record<SafetyState, SafetyState[]> = {
    NORMAL: ['ELEVATED_CONCERN', 'NORMAL'],
    ELEVATED_CONCERN: ['NORMAL', 'HIGH_RISK', 'ELEVATED_CONCERN'],
    HIGH_RISK: ['ELEVATED_CONCERN', 'SAFETY_MODE', 'COOLDOWN', 'HIGH_RISK'],
    SAFETY_MODE: ['COOLDOWN', 'SAFETY_MODE'], // Can only go to cooldown or stay
    COOLDOWN: ['NORMAL', 'ELEVATED_CONCERN', 'COOLDOWN'],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Get the next recommended state based on current state and signals
 */
export function getRecommendedState(
  currentState: SafetyState,
  signals: SafetySignals
): SafetyState {
  // Check for immediate safety mode triggers
  if (
    signals.unsafeBoundaryViolation ||
    signals.timeBoundLanguage ||
    signals.methodOrientedLanguage ||
    signals.immediacyIndicators
  ) {
    return 'SAFETY_MODE';
  }

  // Check for high risk triggers
  if (
    signals.lossOfDesireToContinue ||
    signals.repeatedDistressEscalation ||
    signals.boundaryCrossingRequests
  ) {
    return 'HIGH_RISK';
  }

  // Check for elevated concern triggers
  if (
    signals.persistentEmotionalHeaviness ||
    signals.hopelessLanguage ||
    signals.overwhelmedLanguage ||
    signals.cognitiveOverload
  ) {
    return 'ELEVATED_CONCERN';
  }

  // No concerning signals, return to normal
  return 'NORMAL';
}

/**
 * Simulate detection during a conversation (for testing)
 * This would be called periodically during an active session
 */
export function simulateDetectionCheck(
  conversationHistory: string[],
  currentState: SafetyState
): {
  shouldTransition: boolean;
  newState: SafetyState;
  signals: string[];
  reason: string;
} {
  // Analyze the last few messages
  const recentMessages = conversationHistory.slice(-3).join(' ');
  const analysis = analyzeTextForSafety(recentMessages, currentState);

  const shouldTransition = 
    analysis.suggestedState !== currentState && 
    analysis.confidence > 0.6;

  return {
    shouldTransition,
    newState: analysis.suggestedState,
    signals: analysis.detectedSignals,
    reason: shouldTransition 
      ? `Detected ${analysis.detectedSignals.join(', ')} with ${(analysis.confidence * 100).toFixed(0)}% confidence`
      : 'No state change needed',
  };
}
