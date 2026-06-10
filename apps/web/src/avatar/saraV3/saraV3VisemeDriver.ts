import * as THREE from "three";
import { normalizePhonemeLabel } from "@/lib/avatar/phonemeToViseme";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3Diagnostics } from "./saraV3Diagnostics";
import type { SaraV3VisemeDriverState, UpdateSaraV3VisemeArgs } from "./saraV3Types";

export function createSaraV3VisemeDriverState(): SaraV3VisemeDriverState {
  return {
    morphValues: new Map(),
    activePhoneme: null,
    activeViseme: null,
    appliedMorphs: {},
  };
}

export function updateSaraV3VisemeDriver(args: UpdateSaraV3VisemeArgs) {
  const { state } = args;
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.lipSyncConfig;
  const values: Record<string, number> = {};
  const activeTime = Math.max(
    0,
    args.audioCurrentTime + config.lookAheadSeconds + config.timingOffsetSeconds
  );
  const activePhoneme =
    args.isSpeaking && args.timeline?.phonemes?.length
      ? args.timeline.phonemes.find((current, index) => {
          const next = args.timeline?.phonemes[index + 1];
          const end = current.end ?? next?.start ?? current.start + 0.14;
          return activeTime >= current.start && activeTime < end;
        }) ?? null
      : null;
  const activePhonemeLabel = activePhoneme ? normalizePhonemeLabel(activePhoneme.phoneme) : null;
  const activeViseme =
    activePhonemeLabel
      ? SARA_V3_AVATAR_DEFINITION.saraV3.visemeMap[activePhonemeLabel] ??
        SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
      : SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest;
  const visemeNames = SARA_V3_AVATAR_DEFINITION.visemes.names ?? [];
  visemeNames.forEach((name) => {
    const previous = state.morphValues.get(name) ?? 0;
    const target =
      args.isSpeaking && name === activeViseme
        ? config.visemeMaxStrength
        : name === SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
          ? config.restStrength
          : 0;
    const next = THREE.MathUtils.damp(
      previous,
      target,
      target > previous ? config.attackSpeed : config.releaseSpeed,
      args.dt
    );
    state.morphValues.set(name, next);
    values[name] = next;
  });
  const jawName = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.jawOpen;
  const previousJaw = state.morphValues.get(jawName) ?? 0;
  const jawTarget =
    args.isSpeaking && activeViseme !== SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
      ? config.jawOpenMax
      : 0;
  const nextJaw = THREE.MathUtils.damp(
    previousJaw,
    jawTarget,
    jawTarget > previousJaw ? config.attackSpeed : config.jawReleaseSpeed,
    args.dt
  );
  state.morphValues.set(jawName, nextJaw);
  values[jawName] = nextJaw;
  applySaraV3MorphValues(args.bindings, values);
  state.activePhoneme = activePhoneme?.phoneme ?? null;
  state.activeViseme = activeViseme;
  state.appliedMorphs = values;
  writeSaraV3Diagnostics({
    activePhoneme: state.activePhoneme,
    activeViseme: state.activeViseme,
    appliedMorphs: values,
  });
}
