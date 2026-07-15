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
 * EXPERIMENT: rollback flag for the idle-only "Attention Refresh" event.
 *
 * `enabled: true`  → the Attention Refresh coordinator
 *                    (`saraV3AttentionRefresh.ts`) runs while idle: on its own
 *                    5–10s schedule it fires one of four randomized combinations
 *                    (blink / blink+brow+cheek / blink+brow+cheek+eyeball /
 *                    eyeball-only). Brows/cheeks are additive into C2's
 *                    scheduledMicro slot, the blink is delegated to the existing
 *                    blink runtime, and the tiny eyeball refocus is layered on top
 *                    of the C8 gaze value (clamped to the shared gaze safety bound).
 * `enabled: false` → the coordinator does not run, writes nothing, and triggers
 *                    no blink; idle behaves exactly as before this experiment.
 *                    One-line rollback.
 *
 * This is idle-only and additive. It never runs in listening/thinking/speaking,
 * never changes blink TIMING logic (it only re-arms the next blink), and never
 * touches the smile event, breathing, viseme/jaw/lip-sync, the gaze controller,
 * emotion coordinator, or transition engine.
 */
export const SARA_V3_ATTENTION_REFRESH_CONFIG = {
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

/**
 * C6: rollback flag for the SaraV3 thinking-personality behavior layer.
 *
 * `enabled: true`  → the thinking coordinator (`saraV3ThinkingBehavior.ts`) runs
 *                    while C1 state is `thinking`: it drives a concentration
 *                    baseline (via the expression runtime's `stateExpression`
 *                    override) and schedules rare brow-shift / lip-press
 *                    micro-events into C2's `scheduledMicro` slot. While active
 *                    it is the sole thinking micro-event source, which also
 *                    suppresses the smile runtime's generic thinking smile.
 * `enabled: false` → pre-C6 thinking runs exactly as before: the static
 *                    `expressionConfig.thinking` base plus the smile runtime's
 *                    generic (scaled) smile events. One-line rollback.
 *
 * C6 is thinking-only. It never adds targets in idle/listening/speaking, does
 * not alter blink timing, viseme/jaw/lip-sync, the sentiment gate, or the idle /
 * listening layers. Real gaze-away is deferred to C8; head motion to C9.
 */
export const SARA_V3_THINKING_BEHAVIOR_CONFIG = {
  enabled: true,
} as const;

/**
 * C7: rollback flag for the SaraV3 speaking body-language behavior layer.
 *
 * `enabled: true`  → the speaking coordinator (`saraV3SpeakingBehavior.ts`) runs
 *                    while C1 state is `speaking`: it drives a stable engaged
 *                    baseline (via the expression runtime's `stateExpression`
 *                    override) and schedules occasional phrase/sentence-level
 *                    emphasis pulses into C2's `scheduledMicro` slot, triggered
 *                    at chunk boundaries (never per phoneme). While active it is
 *                    the sole speaking-specific micro source, so the smile
 *                    runtime's generic speaking micro-smile is no longer routed.
 * `enabled: false` → pre-C7 speaking runs exactly as before: the static
 *                    `expressionConfig.speaking` base plus the smile runtime's
 *                    generic (0.35-scaled) speaking micro-smile events routed via
 *                    the idle coordinator passthrough. One-line rollback.
 *
 * C7 is speaking-only. It never adds targets in idle/listening/thinking, does
 * not alter blink timing, viseme/jaw/lip-sync, or the C3 sentiment overlay (it
 * only reads C3's direction to suppress its own smile support under concern).
 * It writes no gaze morph and no head motion — those are deferred to C8/C9.
 */
export const SARA_V3_SPEAKING_BEHAVIOR_CONFIG = {
  enabled: true,
} as const;

/**
 * C8: rollback flag for the SaraV3 unified gaze controller.
 *
 * `enabled: true`  → the gaze controller (`saraV3GazeController.ts`) is the sole
 *                    owner of all gaze morphs (`eyeLook*` +
 *                    `LeftEyeball`/`RightEyeball`) across every C1 state. The eye
 *                    runtime writes ONLY blink while this is on, so there is
 *                    exactly one gaze writer. The controller consumes C1 state
 *                    and the C6/C7 `gazeIntent` metadata.
 * `enabled: false` → the pre-C8 gaze path runs exactly as before: the eye
 *                    runtime drives the non-idle `eyeLook*` drift
 *                    (`idleEyeConfig`) and the idle-only eyeball glances
 *                    (`idleEyeballConfig`), and the controller does not run.
 *                    One-line rollback.
 *
 * Blink is never affected in either state — it stays owned by the eye runtime
 * and its outputs are byte-identical regardless of this flag. C1–C7 are
 * unchanged either way.
 */
export const SARA_V3_GAZE_CONTROLLER_CONFIG = {
  enabled: true,
} as const;

/**
 * C10: rollback flag for the SaraV3 unified emotion coordinator.
 *
 * `enabled: true`  → the coordinator (`saraV3EmotionCoordinator.ts`) computes
 *                    per-channel scale multipliers from the authoritative C1
 *                    state + the C3 sentiment direction/magnitude, and those
 *                    scales modulate the existing additive expression layers
 *                    (stateExpression / emotionOverlay / scheduledMicro /
 *                    idleBaseline) so contradictory signals cannot co-exist. It
 *                    owns no morphs and never changes layer ownership.
 * `enabled: false` → the coordinator resolves every scale to 1 and the caller
 *                    passes the layer maps through untouched, so visible
 *                    behavior is byte-identical to the validated C3–C8 baseline.
 *                    One-line rollback.
 *
 * At emotional neutral the scales are also all 1, so a neutral frame is
 * byte-identical whether or not the coordinator is enabled. Blink, lip-sync,
 * viseme, gaze math, and C1–C9 are untouched in either state.
 */
export const SARA_V3_EMOTION_COORDINATOR_CONFIG = {
  enabled: true,
} as const;

/**
 * C11: rollback flag for the SaraV3 cross-state transition engine.
 *
 * `enabled: true`  → the transition controller
 *                    (`saraV3StateTransitionController.ts`) runs one time-boxed,
 *                    config-driven crossfade of the stateExpression baseline per
 *                    C1 state edge (outgoing baseline fades out, incoming fades
 *                    in, on eased progress). It owns no morphs, adds no event,
 *                    and routes the blended baseline through the existing C2
 *                    stateExpression slot. Scheduled micro-events, gaze (C8),
 *                    emotion overlay (C3), and lip-sync (WS-B) are untouched.
 * `enabled: false` → the controller does not run and nothing it produces reaches
 *                    the expression runtime; the pre-C11 path (immediate baseline
 *                    swap smoothed only by the C2 damp) runs exactly as before.
 *                    One-line rollback.
 *
 * Even when enabled, a frame with no active transition is byte-identical to
 * pre-C11 — the crossfade only alters output during the transition window.
 * C1–C10 are unchanged in either state.
 */
export const SARA_V3_TRANSITION_ENGINE_CONFIG = {
  enabled: true,
} as const;
