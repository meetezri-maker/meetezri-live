import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3ExpressionDiagnostics } from "./saraV3Diagnostics";
import type { SaraV3BindingSet, SaraV3ExpressionState, SaraV3RuntimeMode } from "./saraV3Types";

const EXPRESSION_MORPH_NAMES = [
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.smileLeft,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.smileRight,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.frownLeft,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.frownRight,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekLeft,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekRight,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyebrows,
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.sad,
] as const;

const LIP_SYNC_OWNED_MORPHS = new Set([
  SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.jawOpen,
  ...SARA_V3_AVATAR_DEFINITION.visemes.names,
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

export function updateSaraV3ExpressionRuntime(args: {
  state: SaraV3ExpressionState;
  bindings: SaraV3BindingSet;
  activePresenceState: SaraV3RuntimeMode;
  scheduledSmileTargets?: Readonly<Record<string, number>>;
  coordinatedBlinkSupport?: Readonly<Record<string, number>>;
  dt: number;
}) {
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.expressionConfig;
  const baseExpressionTargets = { ...config[args.activePresenceState] };
  const scheduledSmileTargets = { ...(args.scheduledSmileTargets ?? {}) };
  const coordinatedBlinkSupport = { ...(args.coordinatedBlinkSupport ?? {}) };
  const nextValues: Record<string, number> = {};
  const suppressedLipSyncConflicts: string[] = [];

  EXPRESSION_MORPH_NAMES.forEach((name) => {
    if (LIP_SYNC_OWNED_MORPHS.has(name)) {
      suppressedLipSyncConflicts.push(name);
      return;
    }

    const target = Math.max(
      0,
      (baseExpressionTargets[name] ?? 0) +
        (scheduledSmileTargets[name] ?? 0) +
        (coordinatedBlinkSupport[name] ?? 0)
    );
    const previous = args.state.morphValues.get(name) ?? 0;
    const nextValue = THREE.MathUtils.damp(previous, target, config.blendSpeed, args.dt);
    args.state.morphValues.set(name, nextValue);
    nextValues[name] = nextValue;
  });

  applySaraV3MorphValues(args.bindings, nextValues);

  args.state.baseExpressionTargets = baseExpressionTargets;
  args.state.scheduledSmileTargets = scheduledSmileTargets;
  args.state.coordinatedBlinkSupport = coordinatedBlinkSupport;
  args.state.finalAppliedExpressionMorphs = nextValues;
  args.state.suppressedLipSyncConflicts = suppressedLipSyncConflicts;

  writeSaraV3ExpressionDiagnostics({
    activePresenceState: args.activePresenceState,
    baseExpressionTargets,
    scheduledSmileTargets,
    coordinatedBlinkSupport,
    finalAppliedExpressionMorphs: nextValues,
    suppressedLipSyncConflicts,
  });
}
