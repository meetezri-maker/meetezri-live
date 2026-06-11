import * as THREE from "three";
import { normalizePhonemeLabel } from "@/lib/avatar/phonemeToViseme";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import {
  writeSaraV3Diagnostics,
  writeSaraV3LipSyncDiagnostics,
  writeSaraV3WelcomeLipSyncDiagnostics,
} from "./saraV3Diagnostics";
import type { SaraV3VisemeDriverState, UpdateSaraV3VisemeArgs } from "./saraV3Types";

type TimelinePhoneme = NonNullable<UpdateSaraV3VisemeArgs["timeline"]>["phonemes"][number];

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

function normalizeSaraV3TimelineCopy(timelineItems: readonly TimelinePhoneme[]) {
  const originalFirstTimelineStart = timelineItems[0]?.start ?? null;
  const lastTimelineItem = timelineItems[timelineItems.length - 1] ?? null;
  const rawLastTimelineEnd =
    lastTimelineItem == null
      ? 0
      : lastTimelineItem.end ?? lastTimelineItem.start;
  const timelineUnitConverted =
    timelineItems.length > 0 &&
    (
      (originalFirstTimelineStart ?? 0) > 30 ||
      rawLastTimelineEnd > 30
    );
  const secondScaledItems = timelineItems.map((item) => ({
    ...item,
    start: Math.max(0, timelineUnitConverted ? item.start / 1000 : item.start),
    end:
      item.end == null
        ? item.end
        : Math.max(0, timelineUnitConverted ? item.end / 1000 : item.end),
  }));
  const normalizedFirstTimelineStart = secondScaledItems[0]?.start ?? 0;
  const timelineRebasedToZero = normalizedFirstTimelineStart > 0;
  const rebasedItems = secondScaledItems.map((item) => ({
    ...item,
    start: Math.max(0, item.start - normalizedFirstTimelineStart),
    end:
      item.end == null
        ? item.end
        : Math.max(0, item.end - normalizedFirstTimelineStart),
  }));

  return {
    timelineItems: rebasedItems,
    originalFirstTimelineStart,
    rebasedFirstTimelineStart: rebasedItems[0]?.start ?? null,
    timelineRebasedToZero,
    timelineUnitConverted,
  };
}

function resolvePossibleTimingIssue(args: {
  isSpeaking: boolean;
  audioCurrentTime: number;
  timelineLength: number;
  timelineStartsAtZero: boolean;
  timelineUnitConverted: boolean;
  timelineRebasedToZero: boolean;
  activePhoneme: string | null;
}) {
  if (args.timelineLength === 0) {
    return "No phoneme timeline is attached to SaraV3.";
  }
  if (!args.timelineStartsAtZero) {
    return "Timeline does not start at zero, so clip-relative audio.currentTime is being compared against an offset phoneme timeline.";
  }
  if (
    args.isSpeaking &&
    args.audioCurrentTime > 0.12 &&
    !args.activePhoneme
  ) {
    return "Audio is already advancing but no active phoneme was found at the current lookup time.";
  }
  if (args.timelineUnitConverted || args.timelineRebasedToZero) {
    return null;
  }
  return null;
}

export function createSaraV3VisemeDriverState(): SaraV3VisemeDriverState {
  return {
    morphValues: new Map(),
    activePhoneme: null,
    activeViseme: null,
    appliedMorphs: {},
    previousLookupTime: null,
  };
}

export function updateSaraV3VisemeDriver(args: UpdateSaraV3VisemeArgs) {
  const { state } = args;
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.lipSyncConfig;
  const fallbackConfig = config.audioDrivenMouthFallback;
  const normalizedTimeline = normalizeSaraV3TimelineCopy(args.timeline?.phonemes ?? []);
  const timelineItems = normalizedTimeline.timelineItems;
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
  const activeViseme =
    activePhonemeLabel
      ? SARA_V3_AVATAR_DEFINITION.saraV3.visemeMap[activePhonemeLabel] ??
        SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest
      : SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.visemeRest;
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
          ? config.visemeMaxStrength
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
    originalFirstTimelineStart: normalizedTimeline.originalFirstTimelineStart,
    rebasedFirstTimelineStart: normalizedTimeline.rebasedFirstTimelineStart,
    timelineRebasedToZero: normalizedTimeline.timelineRebasedToZero,
    timelineUnitConverted: normalizedTimeline.timelineUnitConverted,
    timelineLength: timelineItems.length,
    firstTimelineItem: asTimelineItem(firstTimelineItem),
    lastTimelineItem: asTimelineItem(lastTimelineItem),
    activePhoneme: state.activePhoneme,
    activeViseme: state.activeViseme,
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
      audioCurrentTime: args.audioCurrentTime,
      timelineLength: timelineItems.length,
      timelineStartsAtZero,
      timelineUnitConverted: normalizedTimeline.timelineUnitConverted,
      timelineRebasedToZero: normalizedTimeline.timelineRebasedToZero,
      activePhoneme: state.activePhoneme,
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
