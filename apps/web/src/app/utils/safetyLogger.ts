/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Event logging and storage utilities
 */

import { SafetyEvent, SafetyState } from '@/app/types/safety';

const STORAGE_KEY = 'ezri_safety_events';
const MAX_EVENTS = 500; // Keep last 500 events

/**
 * Log a safety state transition
 */
export function logSafetyEvent(event: Omit<SafetyEvent, 'id' | 'timestamp'>): void {
  const fullEvent: SafetyEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  try {
    const existingEvents = getSafetyEvents();
    const updatedEvents = [fullEvent, ...existingEvents].slice(0, MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEvents));
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      console.log('[Safety Event]', {
        state: `${event.previousState} → ${event.newState}`,
        trigger: event.trigger,
        signals: event.detectedSignals,
        timestamp: new Date(fullEvent.timestamp).toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to log safety event:', error);
  }
}

/**
 * Get all safety events
 */
export function getSafetyEvents(): SafetyEvent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to retrieve safety events:', error);
    return [];
  }
}

/**
 * Get safety events for a specific user
 */
export function getUserSafetyEvents(userId: string): SafetyEvent[] {
  const allEvents = getSafetyEvents();
  return allEvents.filter(event => event.userId === userId);
}

/**
 * Get safety events for a specific session
 */
export function getSessionSafetyEvents(sessionId: string): SafetyEvent[] {
  const allEvents = getSafetyEvents();
  return allEvents.filter(event => event.sessionId === sessionId);
}

/**
 * Get critical safety events (HIGH_RISK and SAFETY_MODE)
 */
export function getCriticalSafetyEvents(): SafetyEvent[] {
  const allEvents = getSafetyEvents();
  return allEvents.filter(
    event => event.newState === 'HIGH_RISK' || event.newState === 'SAFETY_MODE'
  );
}

/**
 * Clear all safety events (admin only)
 */
export function clearSafetyEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear safety events:', error);
  }
}

/**
 * Get safety event statistics
 */
export function getSafetyEventStats() {
  const events = getSafetyEvents();
  
  const stateCounts: Record<SafetyState, number> = {
    NORMAL: 0,
    ELEVATED_CONCERN: 0,
    HIGH_RISK: 0,
    SAFETY_MODE: 0,
    COOLDOWN: 0,
  };

  events.forEach(event => {
    stateCounts[event.newState]++;
  });

  const last24Hours = events.filter(
    event => Date.now() - event.timestamp < 24 * 60 * 60 * 1000
  );

  return {
    totalEvents: events.length,
    stateCounts,
    criticalEvents: events.filter(
      event => event.newState === 'HIGH_RISK' || event.newState === 'SAFETY_MODE'
    ).length,
    last24HoursCount: last24Hours.length,
    lastEvent: events[0] || null,
  };
}
