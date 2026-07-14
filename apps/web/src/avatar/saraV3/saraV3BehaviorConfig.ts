/**
 * C1: top-level rollback flag for the SaraV3 behavior engine.
 *
 * `enabled: true`  → the behavior state machine wraps the existing presence
 *                    resolver (byte-identical effective mode) and additionally
 *                    tracks authoritative behavior-state metadata.
 * `enabled: false` → the legacy `updateSaraV3PresenceRuntime` path runs exactly
 *                    as it does today, with no wrapper. This is the one-line
 *                    rollback, matching the pattern used by
 *                    `materialPassConfig.enabled` / `rawRenderAuditMode`.
 *
 * Note: enabling the engine does NOT change any visible behavior in C1 — it
 * only adds entry/exit detection and diagnostics. Real visual transitions land
 * in C11.
 */
export const SARA_V3_BEHAVIOR_ENGINE_CONFIG = {
  enabled: true,
} as const;

/**
 * C2: top-level rollback flag for the SaraV3 expression-layer system.
 *
 * `enabled: true`  → `updateSaraV3ExpressionRuntime` combines the ordered layer
 *                    stack (safety guard → lip-sync ownership → blink → state →
 *                    emotion overlay → scheduled micro → idle baseline). The
 *                    additive result is bit-for-bit identical to the pre-C2 sum.
 * `enabled: false` → the literal pre-C2 additive path runs (state base +
 *                    scheduled smile + coordinated blink support, lip-sync-owned
 *                    morphs excluded). One-line rollback.
 *
 * C2 adds no new visible behavior in either state; the flag exists purely so the
 * refactor is trivially reversible.
 */
export const SARA_V3_EXPRESSION_LAYER_CONFIG = {
  enabled: true,
} as const;

/**
 * C3: rollback flag for the sentence-level speaking-sentiment overlay.
 *
 * `enabled: true`  → the sentiment gate evaluates once per new spoken sentence
 *                    and feeds a bounded overlay through C2's
 *                    `emotionOverlayTargets` slot.
 * `enabled: false` → the overlay is always empty; visible behavior matches the
 *                    validated C2 baseline exactly. One-line rollback.
 */
export const SARA_V3_SENTIMENT_GATE_CONFIG = {
  enabled: true,
} as const;

/**
 * C4: rollback flag for the SaraV3 idle-personality behavior layer.
 *
 * `enabled: true`  → the idle behavior coordinator (`saraV3IdleBehavior.ts`)
 *                    runs: it formalizes idle entry/exit off the authoritative
 *                    C1 state, restarts the micro-smile timer with fresh random
 *                    timing on idle (re)entry (so no smile fires instantly), and
 *                    splits the existing breathing / event outputs into C2's
 *                    `idleBaseline` and `scheduledMicro` layer slots.
 * `enabled: false` → the pre-C4 idle path runs exactly as before: the combined
 *                    smile-additive map feeds `scheduledMicro`, `idleBaseline`
 *                    stays empty, and the micro-smile timer spans modes as it
 *                    did previously. One-line rollback.
 *
 * C4 is idle-only. It never adds targets in listening/thinking/speaking and does
 * not alter blink timing, viseme/jaw/lip-sync, the sentiment gate, or C1/C2/C3.
 */
export const SARA_V3_IDLE_BEHAVIOR_CONFIG = {
  enabled: true,
} as const;

/**
 * C5: rollback flag for the SaraV3 listening-personality behavior layer.
 *
 * `enabled: true`  → the listening coordinator (`saraV3ListeningBehavior.ts`)
 *                    runs while C1 state is `listening`: it drives a stronger
 *                    attentive baseline (via the expression runtime's
 *                    `stateExpression` override) and schedules rare
 *                    acknowledgement pulses (brow-lift / soft smile) into C2's
 *                    `scheduledMicro` slot. While active it is the sole listening
 *                    micro-event source, so nothing fires on entry.
 * `enabled: false` → pre-C5 listening runs exactly as before: the static
 *                    `expressionConfig.listening` base plus the smile runtime's
 *                    generic micro-smile events. One-line rollback.
 *
 * C5 is listening-only. It never adds targets in idle/thinking/speaking, does
 * not alter blink timing, viseme/jaw/lip-sync, the sentiment gate, idle logic,
 * or C1/C2/C3/C4. Head-motion acknowledgement is deferred to C9.
 */
export const SARA_V3_LISTENING_BEHAVIOR_CONFIG = {
  enabled: true,
} as const;
