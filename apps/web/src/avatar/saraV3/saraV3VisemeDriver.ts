import * as THREE from "three";
import { normalizePhonemeLabel } from "@/lib/avatar/phonemeToViseme";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_REST_VISEME_ENTRY } from "./saraV3VisemeMap";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import {
  writeSaraV3Diagnostics,
  writeSaraV3LipSyncDiagnostics,
  writeSaraV3WelcomeLipSyncDiagnostics,
} from "./saraV3Diagnostics";
import type { SaraV3VisemeDriverState, UpdateSaraV3VisemeArgs } from "./saraV3Types";

function asTimelineItem(
  phoneme:
    | {
        phoneme: string;
        start: number;
        end?: number | null;
      }
    | null
) {
  if (!phoneme) return null;
  return {
    phoneme: phoneme.phoneme,
    start: phoneme.start,
    end: phoneme.end ?? null,
  };
}

function resolvePossibleTimingIssue(args: {
  isSpeaking: boolean;
  timelineLength: number;
  effectiveLookupTime: number;
  lastTimelineEnd: number;
}) {
  if (args.timelineLength === 0) {
    return "No phoneme timeline is attached to SaraV3.";
  }
  // Only a genuine overrun is an issue: the clock has advanced past the end of
  // the entire timeline (with a 0.15 s tolerance). A lookup that merely falls in
  // an inter-word gap between phonemes is normal rest behavior, not a defect, so
  // it is not reported. (B1.3b — de-noise: this fired dozens of times per reply
  // on ordinary 30-90 ms dwell gaps.)
  if (
    args.isSpeaking &&
    args.effectiveLookupTime > args.lastTimelineEnd + 0.15
  ) {
    return "Audio is already advancing but no active phoneme was found at the current lookup time.";
  }
  return null;
}

export function createSaraV3VisemeDriverState(): SaraV3VisemeDriverState {
  return {
    morphValues: new Map(),
    activePhoneme: null,
    activeViseme: null,
    activePhonemeWeight: 1,
    appliedMorphs: {},
    previousLookupTime: null,
  };
}

export function updateSaraV3VisemeDriver(args: UpdateSaraV3VisemeArgs) {
  const { state } = args;
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.lipSyncConfig;
  const fallbackConfig = config.audioDrivenMouthFallback;
  // Use the incoming timeline items directly (B1.3b): the defensive per-frame
  // unit-conversion / rebase-to-zero copy was removed after live captures proved
  // backend phoneme timestamps are always 0-based seconds.
  const timelineItems = args.timeline?.phonemes ?? [];
  const firstTimelineItem = timelineItems[0] ?? null;
  const lastTimelineItem = timelineItems[timelineItems.length - 1] ?? null;
  const values: Record<string, number> = {};
  const previousLookupTime = state.previousLookupTime;
  const effectiveLookupTime = Math.max(
    0,
    args.audioCurrentTime + config.lookAheadSeconds + config.timingOffsetSeconds
  );
  const activePhoneme =
    args.isSpeaking && timelineItems.length
      ? timelineItems.find((current, index) => {
          const next = timelineItems[index + 1];
          const end = current.end ?? next?.start ?? current.start + 0.14;
          return effectiveLookupTime >= current.start && effectiveLookupTime < end;
        }) ?? null
      : null;
  const activePhonemeLabel = activePhoneme ? normalizePhonemeLabel(activePhoneme.phoneme) : null;
  const audioFallbackEnabled =
    fallbackConfig.enabled &&
    args.isSpeaking &&
    timelineItems.length === 0;
  const fallbackEnvelope = audioFallbackEnabled
    ? THREE.MathUtils.clamp(((args.audioLevel ?? 0) - 18) / 120, 0, 1)
    : 0;
  // B2.2: the map now yields { viseme, weight }. An unmapped label falls back
  // to rest at weight 1, exactly as the old `?? visemeRest` did.
  const activeEntry =
    (activePhonemeLabel
      ? SARA_V3_AVATAR_DEFINITION.saraV3.visemeMap[activePhonemeLabel]
      : undefined) ?? SARA_V3_REST_VISEME_ENTRY;
  const activeViseme = activeEntry.viseme;
  const activePhonemeWeight = activeEntry.weight;
  const visemeTable = SARA_V3_AVATAR_DEFINITION.saraV3.visemeTable;
  const activeProfile = visemeTable[activeViseme] ?? visemeTable.viseme_rest;
  // Per-viseme strength scaled by the phoneme weight, still clamped by the
  // global ceiling so no shape can exceed the pre-B2.2 maximum.
  const effectiveStrength = Math.min(
    activeProfile.strength * activePhonemeWeight,
    config.visemeMaxStrength
  );
  const visemeNames = SARA_V3_AVATAR_DEFINITION.visemes.names ?? [];
  visemeNames.forEach((name) => {
    const previous = state.morphValues.get(name) ?? 0;
    let target = 0;
    if (audioFallbackEnabled) {
      target =
        name === SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
          ? config.restStrength
          : 0;
    } else {
      target =
        args.isSpeaking && name === activeViseme
          ? effectiveStrength
          : name === SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
            ? config.restStrength
            : 0;
    }
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
    audioFallbackEnabled
      ? fallbackEnvelope * fallbackConfig.jawOpenMax
      : args.isSpeaking &&
          activeViseme !== SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
        ? activeProfile.jawOpen * activePhonemeWeight
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
  state.activePhonemeWeight = activePhonemeWeight;
  state.appliedMorphs = values;
  state.previousLookupTime = effectiveLookupTime;
  const lastTimelineEnd =
    lastTimelineItem == null
      ? 0
      : lastTimelineItem.end ?? lastTimelineItem.start;
  const timelineStartsAtZero =
    firstTimelineItem == null || Math.abs(firstTimelineItem.start) < 0.001;
  const isNormalizedTimeline =
    timelineItems.length > 0 && timelineStartsAtZero;
  writeSaraV3Diagnostics({
    activePhoneme: state.activePhoneme,
    activeViseme: state.activeViseme,
    appliedMorphs: values,
  });
  writeSaraV3LipSyncDiagnostics({
    isSpeaking: args.isSpeaking,
    audioCurrentTime: args.audioCurrentTime,
    // Vestigial (B1.3b): the unit-conversion / rebase-to-zero normalizer was
    // removed after live captures proved backend timestamps are always 0-based
    // seconds. These fields are kept so window.saraV3LipSyncDiagnostics consumers
    // and the capture snippets don't break; they are now effectively constant
    // (raw first start; never converted; never rebased).
    originalFirstTimelineStart: firstTimelineItem?.start ?? null,
    rebasedFirstTimelineStart: firstTimelineItem?.start ?? null,
    timelineRebasedToZero: false,
    timelineUnitConverted: false,
    timelineLength: timelineItems.length,
    firstTimelineItem: asTimelineItem(firstTimelineItem),
    lastTimelineItem: asTimelineItem(lastTimelineItem),
    activePhoneme: state.activePhoneme,
    activeViseme: state.activeViseme,
    activePhonemeWeight,
    activeVisemeStrength: effectiveStrength,
    activePhonemeStart: activePhoneme?.start ?? null,
    activePhonemeEnd:
      activePhoneme?.end ??
      (activePhoneme
        ? timelineItems[timelineItems.findIndex((item) => item === activePhoneme) + 1]?.start ??
          activePhoneme.start + 0.14
        : null),
    lookupTime: effectiveLookupTime,
    effectiveLookupTime,
    previousLookupTime,
    lookAheadSeconds: config.lookAheadSeconds,
    timingOffsetSeconds: config.timingOffsetSeconds,
    normalizedTimeline: isNormalizedTimeline,
    timelineStartsAtZero,
    timelineDuration: Math.max(0, lastTimelineEnd - (firstTimelineItem?.start ?? 0)),
    appliedMorphs: values,
    jawOpenValue: values[jawName] ?? 0,
    possibleTimingIssue: resolvePossibleTimingIssue({
      isSpeaking: args.isSpeaking,
      timelineLength: timelineItems.length,
      effectiveLookupTime,
      lastTimelineEnd,
    }),
  });
  if (typeof window !== "undefined" && window.saraV3WelcomeLipSyncDiagnostics) {
    writeSaraV3WelcomeLipSyncDiagnostics({
      saraV3TimelineLength: timelineItems.length,
      saraV3IsSpeaking: args.isSpeaking,
      saraV3ActivePhoneme: state.activePhoneme,
      saraV3ActiveViseme: state.activeViseme,
      saraV3AppliedMorphs: values,
      reasonLipsNotMoving:
        !args.isSpeaking
          ? "SaraV3 is not currently marked as speaking during welcome playback."
          : timelineItems.length === 0 && !audioFallbackEnabled
            ? "Welcome audio has no phoneme timeline attached and jaw fallback is not active."
            : args.audioCurrentTime <= 0 && timelineItems.length === 0
              ? "Welcome audio clock has not advanced and no phoneme timeline is attached yet."
              : null,
    });
  }
}
