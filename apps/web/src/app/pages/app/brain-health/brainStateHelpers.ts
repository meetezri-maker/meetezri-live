import type { TuneStateId } from "./constants";

export const TUNE_MIND_HELPER_LINES = [
  "Let's soften things a little.",
  "Let's clear some space.",
  "You don't have to carry all of it right now.",
  "Let's make this feel lighter.",
] as const;

const ALL_STATES: TuneStateId[] = ["gentle", "clear", "focused", "light"];

export function pickRandomTuneStateExcluding(current: TuneStateId): TuneStateId {
  const pool = ALL_STATES.filter((s) => s !== current);
  return pool[Math.floor(Math.random() * pool.length)] ?? "gentle";
}

export function randomHelperLine(): string {
  const i = Math.floor(Math.random() * TUNE_MIND_HELPER_LINES.length);
  return TUNE_MIND_HELPER_LINES[i] ?? TUNE_MIND_HELPER_LINES[0];
}

/** Recent clicks within `windowMs` — for burst → gentle. */
export function pruneRecentClicks(times: number[], windowMs: number, now: number): number[] {
  return times.filter((t) => now - t <= windowMs);
}
