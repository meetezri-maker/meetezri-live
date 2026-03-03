/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Type definitions for the safety state machine
 */

export type SafetyState = 
  | 'NORMAL'           // STATE A: Default conversation flow
  | 'ELEVATED_CONCERN' // STATE B: Strong emotional distress without unsafe intent
  | 'HIGH_RISK'        // STATE C: Unsafe or alarming intent without immediacy
  | 'SAFETY_MODE'      // STATE D: Imminent unsafe intent or urgency
  | 'COOLDOWN';        // STATE E: User stabilizes after high-risk interaction

export interface SafetyEvent {
  id: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  previousState: SafetyState;
  newState: SafetyState;
  trigger: string; // What caused the transition
  detectedSignals: string[]; // Signals that were detected
  context?: string; // Additional context
}

export interface SafetyConsent {
  agreedToSafetyNotice: boolean;
  agreedAt?: number;
  trustedContactEnabled: boolean;
  trustedContactId?: string;
}

export interface SafetySignals {
  // Elevated Concern signals
  persistentEmotionalHeaviness?: boolean;
  hopelessLanguage?: boolean;
  overwhelmedLanguage?: boolean;
  cognitiveOverload?: boolean;
  
  // High Risk signals
  lossOfDesireToContinue?: boolean;
  repeatedDistressEscalation?: boolean;
  boundaryCrossingRequests?: boolean;
  
  // Safety Mode signals
  unsafeBoundaryViolation?: boolean;
  timeBoundLanguage?: boolean;
  methodOrientedLanguage?: boolean;
  immediacyIndicators?: boolean;
}

export interface SafetyResource {
  id: string;
  type: 'crisis_line' | 'text_line' | 'emergency' | 'support_group' | 'trusted_contact';
  name: string;
  description: string;
  phone?: string;
  url?: string;
  availability: string;
  region: string; // For region-aware resources
}

export interface SafetyContext {
  currentState: SafetyState;
  previousState: SafetyState | null;
  stateChangedAt: number;
  sessionId: string;
  consent: SafetyConsent;
  updateState: (newState: SafetyState, trigger: string, signals: string[]) => void;
  resetToNormal: () => void;
  getStateDescription: () => string;
  canTransitionTo: (targetState: SafetyState) => boolean;
}
