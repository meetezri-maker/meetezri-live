import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_EXPRESSION_LAYER_CONFIG } from "./saraV3BehaviorConfig";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3ExpressionDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3BindingSet,
  SaraV3ExpressionLayer,
  SaraV3ExpressionState,
  SaraV3RuntimeMode,
} from "./saraV3Types";

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

/**
 * The set of morphs the expression stack is allowed to write. Only these are
 * ever iterated / applied — any layer target keyed outside this list is ignored,
 * exactly as before C2.
 */
const EXPRESSION_MORPH_NAMES = [
  map.smileLeft,
  map.smileRight,
  map.frownLeft,
  map.frownRight,
  map.cheekLeft,
  map.cheekRight,
  map.eyeSquintLeft,
  map.eyeSquintRight,
  map.eyebrows,
  map.sad,
] as const;

// ── Morph ownership (C2) ────────────────────────────────────────────────────
// Each morph is written by exactly one authoritative subsystem; expression
// layers must never write an owned morph, and every future layer passes through
// the same guard below.
//   - Lip-sync owns: all viseme morphs, jawOpen, and mouthRollLower. jawOpen is
//     added explicitly; mouthRollLower and the visemes come from `visemes.names`.
//   - Blink owns: eyeBlinkLeft / eyeBlinkRight.
const LIP_SYNC_OWNED_MORPHS = new Set<string>([
  map.jawOpen,
  ...SARA_V3_AVATAR_DEFINITION.visemes.names,
]);
const BLINK_OWNED_MORPHS = new Set<string>([map.eyeBlinkLeft, map.eyeBlinkRight]);
// Layers 1 (safety guard) + 2 (lip-sync ownership) collapse into one forbidden
// set applied to the expression domain. None of EXPRESSION_MORPH_NAMES are owned
// today, so this suppresses nothing now — it is the guard that keeps future
// layers (C3/C4/C10) from silently fighting lip-sync or blink.
const EXPRESSION_FORBIDDEN_MORPHS = new Set<string>([
  ...LIP_SYNC_OWNED_MORPHS,
  ...BLINK_OWNED_MORPHS,
]);

export function createSaraV3ExpressionState(): SaraV3ExpressionState {
  return {
    morphValues: new Map(),
    baseExpressionTargets: {},
    scheduledSmileTargets: {},
    coordinatedBlinkSupport: {},
    finalAppliedExpressionMorphs: {},
    suppressedLipSyncConflicts: [],
  };
}

/**
 * Builds the ordered expression-layer stack for one frame.
 *
 * The array is stored in *additive-accumulation order* (state → emotion →
 * scheduled micro → idle baseline → blink), chosen so the running sum reproduces
 * the pre-C2 expression exactly (`base + smile + blink`; the emotion and
 * idle-baseline layers contribute zero, and `x + 0 === x`). The formal contract
 * order is the numeric `priority` field (1..7), which diagnostics reports sorted.
 */
function buildSaraV3ExpressionLayers(sources: {
  baseExpressionTargets: Readonly<Record<string, number>>;
  emotionOverlayTargets: Readonly<Record<string, number>>;
  scheduledSmileTargets: Readonly<Record<string, number>>;
  idleBaselineTargets: Readonly<Record<string, number>>;
  coordinatedBlinkSupport: Readonly<Record<string, number>>;
}): SaraV3ExpressionLayer[] {
  return [
    // Guards contribute no targets; they exist as the ownership filter.
    { id: "safetyGuard", priority: 1, enabled: true, blend: "guard", targets: {} },
    { id: "lipSyncOwnership", priority: 2, enabled: true, blend: "guard", targets: {} },
    // Additive layers, in accumulation order (see doc comment above).
    {
      id: "stateExpression",
      priority: 4,
      enabled: true,
      blend: "additive",
      targets: sources.baseExpressionTargets,
    },
    // C2: empty slot wired for C3/C10. Contributes zero targets today; C3 feeds
    // it via `emotionOverlayTargets` with no further signature change.
    {
      id: "emotionOverlay",
      priority: 5,
      enabled: true,
      blend: "additive",
      targets: sources.emotionOverlayTargets,
    },
    {
      id: "scheduledMicro",
      priority: 6,
      enabled: true,
      blend: "additive",
      targets: sources.scheduledSmileTargets,
    },
    // C4: idle-baseline (continuous breathing) contributor. Fed by the idle
    // behavior coordinator only while idle; empty in every other mode, so this
    // stays a zero contribution outside idle and the sum is unchanged there.
    {
      id: "idleBaseline",
      priority: 7,
      enabled: true,
      blend: "additive",
      targets: sources.idleBaselineTargets,
    },
    {
      id: "blink",
      priority: 3,
      enabled: true,
      blend: "additive",
      targets: sources.coordinatedBlinkSupport,
    },
  ];
}

/**
 * Combines the additive layers over the expression domain, skipping any morph
 * owned by another subsystem. Returns pre-damp combined targets plus the list of
 * morphs suppressed by ownership.
 */
function combineSaraV3ExpressionLayers(layers: readonly SaraV3ExpressionLayer[]): {
  combined: Record<string, number>;
  suppressed: string[];
} {
  const combined: Record<string, number> = {};
  const suppressed: string[] = [];
  EXPRESSION_MORPH_NAMES.forEach((name) => {
    if (EXPRESSION_FORBIDDEN_MORPHS.has(name)) {
      suppressed.push(name);
      return;
    }
    // NOTE (C3 safeguard): every layer today is additive, so this running sum is
    // order-independent and the array order is harmless. The moment a
    // non-additive blend mode (e.g. "override"/"replace") is introduced, this
    // loop MUST first sort/process layers by `priority` — additive commutativity
    // no longer holds and a later high-priority layer would otherwise be summed,
    // not applied on top. C3 deliberately adds no non-additive mode.
    let sum = 0;
    for (const layer of layers) {
      if (!layer.enabled || layer.blend !== "additive") continue;
      sum += layer.targets[name] ?? 0;
    }
    combined[name] = Math.max(0, sum);
  });
  return { combined, suppressed };
}

export function updateSaraV3ExpressionRuntime(args: {
  state: SaraV3ExpressionState;
  bindings: SaraV3BindingSet;
  activePresenceState: SaraV3RuntimeMode;
  scheduledSmileTargets?: Readonly<Record<string, number>>;
  coordinatedBlinkSupport?: Readonly<Record<string, number>>;
  /** C2: emotion-overlay layer input. Empty in C2; C3 populates it per sentence. */
  emotionOverlayTargets?: Readonly<Record<string, number>>;
  /** C4: idle-baseline (breathing) layer input. Empty outside idle. */
  idleBaselineTargets?: Readonly<Record<string, number>>;
  /**
   * C5: per-state base override for the `stateExpression` layer. When provided
   * (a behavior module owns the base for this frame, e.g. C5 listening), it
   * replaces `expressionConfig[mode]` as the stateExpression source. Undefined →
   * the static per-mode config is used exactly as before.
   */
  stateExpressionTargets?: Readonly<Record<string, number>>;
  dt: number;
}) {
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.expressionConfig;
  const baseExpressionTargets: Record<string, number> = args.stateExpressionTargets
    ? { ...args.stateExpressionTargets }
    : { ...config[args.activePresenceState] };
  const scheduledSmileTargets = { ...(args.scheduledSmileTargets ?? {}) };
  const coordinatedBlinkSupport = { ...(args.coordinatedBlinkSupport ?? {}) };
  const emotionOverlayTargets = { ...(args.emotionOverlayTargets ?? {}) };
  const idleBaselineTargets = { ...(args.idleBaselineTargets ?? {}) };

  let combinedTargets: Record<string, number>;
  let suppressed: string[];
  let layers: SaraV3ExpressionLayer[] | null = null;

  if (SARA_V3_EXPRESSION_LAYER_CONFIG.enabled) {
    layers = buildSaraV3ExpressionLayers({
      baseExpressionTargets,
      emotionOverlayTargets,
      scheduledSmileTargets,
      idleBaselineTargets,
      coordinatedBlinkSupport,
    });
    const result = combineSaraV3ExpressionLayers(layers);
    combinedTargets = result.combined;
    suppressed = result.suppressed;
  } else {
    // Rollback: literal pre-C2 additive path (state base + scheduled smile +
    // coordinated blink support), lip-sync/blink-owned morphs excluded.
    combinedTargets = {};
    suppressed = [];
    EXPRESSION_MORPH_NAMES.forEach((name) => {
      if (EXPRESSION_FORBIDDEN_MORPHS.has(name)) {
        suppressed.push(name);
        return;
      }
      combinedTargets[name] = Math.max(
        0,
        (baseExpressionTargets[name] ?? 0) +
          (scheduledSmileTargets[name] ?? 0) +
          (idleBaselineTargets[name] ?? 0) +
          (coordinatedBlinkSupport[name] ?? 0)
      );
    });
  }

  const nextValues: Record<string, number> = {};
  EXPRESSION_MORPH_NAMES.forEach((name) => {
    if (!(name in combinedTargets)) return; // suppressed by ownership
    const previous = args.state.morphValues.get(name) ?? 0;
    const nextValue = THREE.MathUtils.damp(
      previous,
      combinedTargets[name],
      config.blendSpeed,
      args.dt
    );
    args.state.morphValues.set(name, nextValue);
    nextValues[name] = nextValue;
  });

  applySaraV3MorphValues(args.bindings, nextValues);

  args.state.baseExpressionTargets = baseExpressionTargets;
  args.state.scheduledSmileTargets = scheduledSmileTargets;
  args.state.coordinatedBlinkSupport = coordinatedBlinkSupport;
  args.state.finalAppliedExpressionMorphs = nextValues;
  args.state.suppressedLipSyncConflicts = suppressed;

  // Development-only layer diagnostics (C2). Base fields below are unchanged.
  const layerDiagnostics =
    import.meta.env.DEV && layers
      ? {
          activeLayerIds: layers.filter((l) => l.enabled).map((l) => l.id),
          layerPriorityOrder: [...layers]
            .sort((a, b) => a.priority - b.priority)
            .map((l) => ({
              id: l.id,
              priority: l.priority,
              enabled: l.enabled,
              blend: l.blend,
            })),
          layerContributions: Object.fromEntries(
            layers
              .filter((l) => l.blend === "additive")
              .map((l) => [l.id, { ...l.targets }])
          ),
          suppressedByOwnership: suppressed,
          finalCombinedTargets: combinedTargets,
        }
      : {};

  writeSaraV3ExpressionDiagnostics({
    activePresenceState: args.activePresenceState,
    baseExpressionTargets,
    scheduledSmileTargets,
    coordinatedBlinkSupport,
    finalAppliedExpressionMorphs: nextValues,
    suppressedLipSyncConflicts: suppressed,
    ...layerDiagnostics,
  });
}
