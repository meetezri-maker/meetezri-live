import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSafety } from "@/app/contexts/SafetyContext";
import { SafetyBoundaryBanner } from "@/app/pages/app/active-session/components/SafetyBoundaryBanner";
import type { SafetyState } from "@/app/types/safety";
import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
import { api } from "@/lib/api";

/**
 * Client-side safety layer for REAL text conversations — the same checks voice sessions run on
 * what the member says (`ActiveSession.tsx` → `handleUserText`), applied to what they type:
 *
 * 1. `analyzeTextForSafety` on every message the member sends.
 * 2. Elevated / high-risk / safety-mode signals are reported as a crisis event (keyword detection),
 *    at most once every 30 s — shared across all chat panels, like voice's per-session throttle.
 * 3. A confident signal (> 0.6) moves the shared `SafetyContext` state, so the rest of the app
 *    (quick-chat visibility, dashboards, cooldown rules) reacts exactly as it does for voice.
 * 4. Any move away from NORMAL shows the existing Safety Alert banner (View Resources / Dismiss).
 *    In the floating quick chat — which the app hides in HIGH_RISK / SAFETY_MODE — the member is
 *    taken straight to Emergency Resources instead, so the escalation is never silently hidden.
 *    The quick-chat reply keeps streaming and is saved; nothing is cancelled.
 *
 * Deliberately NOT copied from voice: auto-opening the phone dialer on SAFETY_MODE. That is an
 * open product decision for text chat (D4); the Emergency Resources page offers one-tap calling.
 *
 * Never mounted for the in-memory preview: nothing typed there is read or reported.
 */

export const CRISIS_REPORT_THROTTLE_MS = 30_000;
export const EMERGENCY_RESOURCES_PATH = "/app/emergency-resources";

let lastCrisisReportAt = 0;

/** Test hook: reset the shared report throttle. */
export function resetConversationSafetyThrottle() {
  lastCrisisReportAt = 0;
}

const ESCALATED: readonly SafetyState[] = ["HIGH_RISK", "SAFETY_MODE"];

export interface ConversationSafetyHandle {
  /** Run the safety checks on a message the member is about to send. Never throws. */
  check(text: string): void;
}

export const ConversationSafety = forwardRef<ConversationSafetyHandle, { variant: "page" | "compact" }>(
  function ConversationSafety({ variant }, ref) {
    const { currentState, updateState } = useSafety();
    const navigate = useNavigate();
    const [bannerOpen, setBannerOpen] = useState(false);
    const previousState = useRef<SafetyState>(currentState);

    useImperativeHandle(
      ref,
      () => ({
        check(text: string) {
          try {
            const analysis = analyzeTextForSafety(text, currentState);
            const concerning =
              analysis.suggestedState === "ELEVATED_CONCERN" ||
              analysis.suggestedState === "HIGH_RISK" ||
              analysis.suggestedState === "SAFETY_MODE";

            if (concerning) {
              const now = Date.now();
              if (now - lastCrisisReportAt > CRISIS_REPORT_THROTTLE_MS) {
                lastCrisisReportAt = now;
                const riskLevel =
                  analysis.suggestedState === "SAFETY_MODE"
                    ? "critical"
                    : analysis.suggestedState === "HIGH_RISK"
                      ? "high"
                      : "medium";
                api
                  .reportCrisisEvent({
                    riskLevel,
                    eventType: "keyword_detection",
                    keywords: analysis.matchedKeywords,
                    aiConfidence: Math.round(analysis.confidence * 100),
                    notes: `Auto-detected in text conversation (${analysis.suggestedState})`,
                  })
                  .catch(() => undefined);
              }
            }

            if (analysis.confidence > 0.6 && analysis.suggestedState !== currentState) {
              void Promise.resolve(
                updateState(analysis.suggestedState, "conversation_analysis", analysis.detectedSignals)
              ).catch(() => undefined);
            }
          } catch {
            // Safety analysis must never block sending.
          }
        },
      }),
      [currentState, updateState]
    );

    useEffect(() => {
      const previous = previousState.current;
      previousState.current = currentState;
      if (currentState === previous || currentState === "NORMAL") return;
      if (variant === "compact" && ESCALATED.includes(currentState)) {
        navigate(EMERGENCY_RESOURCES_PATH);
        return;
      }
      setBannerOpen(true);
    }, [currentState, variant, navigate]);

    return (
      <SafetyBoundaryBanner
        open={bannerOpen}
        onViewResources={() => {
          setBannerOpen(false);
          navigate(EMERGENCY_RESOURCES_PATH);
        }}
        onDismiss={() => setBannerOpen(false)}
      />
    );
  }
);
