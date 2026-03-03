/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Safety state management context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SafetyState, SafetyConsent, SafetyContext as SafetyContextType } from '@/app/types/safety';
import { logSafetyEvent } from '@/app/utils/safetyLogger';
import { isValidStateTransition } from '@/app/utils/safetyDetection';
import { notifyTrustedContacts, shouldNotifyContacts } from '@/app/utils/trustedContactNotifications';
import { useAuth } from './AuthContext';

const CONSENT_STORAGE_KEY = 'ezri_safety_consent';

const SafetyContext = createContext<SafetyContextType | undefined>(undefined);

interface SafetyProviderProps {
  children: React.ReactNode;
}

export function SafetyProvider({ children }: SafetyProviderProps) {
  const { user, profile } = useAuth();
  const [currentState, setCurrentState] = useState<SafetyState>('NORMAL');
  const [previousState, setPreviousState] = useState<SafetyState | null>(null);
  const [stateChangedAt, setStateChangedAt] = useState<number>(Date.now());
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [consent, setConsent] = useState<SafetyConsent>(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load safety consent:', error);
    }
    return {
      agreedToSafetyNotice: false,
      trustedContactEnabled: false,
    };
  });

  // Save consent to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch (error) {
      console.error('Failed to save safety consent:', error);
    }
  }, [consent]);

  const updateState = useCallback(async (
    newState: SafetyState,
    trigger: string,
    signals: string[]
  ) => {
    // Validate state transition
    if (!isValidStateTransition(currentState, newState)) {
      console.warn(`Invalid state transition: ${currentState} → ${newState}`);
      return;
    }

    const userId = user?.id || 'unknown';
    const userName = profile?.full_name || 'User';

    // Log the safety event
    logSafetyEvent({
      userId,
      sessionId,
      previousState: currentState,
      newState,
      trigger,
      detectedSignals: signals,
      context: `Transition: ${currentState} → ${newState}`,
    });

    // Update state
    setPreviousState(currentState);
    setCurrentState(newState);
    setStateChangedAt(Date.now());

    // Notify trusted contacts if enabled and state warrants it
    if (consent.trustedContactEnabled && shouldNotifyContacts(newState)) {
      try {
        const notifications = await notifyTrustedContacts(newState, userName);
        console.log(`📤 Sent ${notifications.length} trusted contact notifications`, notifications);
      } catch (error) {
        console.error('Failed to notify trusted contacts:', error);
      }
    }

    // Special handling for SAFETY_MODE
    if (newState === 'SAFETY_MODE') {
      console.warn('[SAFETY MODE ACTIVATED]', {
        trigger,
        signals,
        timestamp: new Date().toISOString(),
      });
      
      // In production, this would also trigger:
      // - Admin alert (high priority)
      // - Session recording flag
      // - Crisis resource display
    }

    // Special handling for HIGH_RISK
    if (newState === 'HIGH_RISK') {
      console.warn('[HIGH RISK DETECTED]', {
        trigger,
        signals,
        timestamp: new Date().toISOString(),
      });
    }
  }, [currentState, sessionId, consent.trustedContactEnabled, user, profile]);

  const resetToNormal = useCallback(() => {
    if (currentState !== 'NORMAL') {
      updateState('NORMAL', 'manual_reset', ['user_stabilized']);
    }
  }, [currentState, updateState]);

  const getStateDescription = useCallback((): string => {
    const descriptions: Record<SafetyState, string> = {
      NORMAL: 'Normal conversation flow',
      ELEVATED_CONCERN: 'Emotional distress detected - Ezri is providing extra support',
      HIGH_RISK: 'High emotional risk - Support resources available',
      SAFETY_MODE: 'Safety protocols active - Please reach out for immediate support',
      COOLDOWN: 'Stabilizing after high-risk interaction',
    };
    return descriptions[currentState];
  }, [currentState]);

  const canTransitionTo = useCallback((targetState: SafetyState): boolean => {
    return isValidStateTransition(currentState, targetState);
  }, [currentState]);

  const value: SafetyContextType = {
    currentState,
    previousState,
    stateChangedAt,
    sessionId,
    consent,
    updateState,
    resetToNormal,
    getStateDescription,
    canTransitionTo,
  };

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextType {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
}

/**
 * Hook to update safety consent
 */
export function useSafetyConsent() {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafetyConsent must be used within a SafetyProvider');
  }

  const updateConsent = useCallback((newConsent: Partial<SafetyConsent>) => {
    try {
      const updated = { ...context.consent, ...newConsent };
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(updated));
      // Note: The SafetyProvider will re-read from localStorage on next mount
      // No need to reload the page - navigation will handle it
    } catch (error) {
      console.error('Failed to update safety consent:', error);
    }
  }, [context.consent]);

  return {
    consent: context.consent,
    updateConsent,
  };
}