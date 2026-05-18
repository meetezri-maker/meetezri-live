/**
 * Guided reflection copy + choice metadata (frontend only except Q1 → persisted loads).
 */

import type { LoadItem, MentalClimate } from "./brainHealthPersistedTypes";

export const GUIDED_STEP_COUNT = 5;

export type ReflectionIconKey =
  | "loops"
  | "overthink"
  | "info"
  | "heart"
  | "decision"
  | "clutter"
  | "other"
  | "bell"
  | "weight"
  | "list"
  | "sparkle"
  | "battery"
  | "help"
  | "gauge"
  | "cloud"
  | "pin"
  | "message"
  | "orbit"
  | "briefcase"
  | "users"
  | "mist"
  | "shield";

export interface ReflectionChoice {
  id: string;
  title: string;
  sub: string;
  iconKey: ReflectionIconKey;
  /** When set on Q1, selecting this choice updates `selectedLoads` to a single mapped item. */
  loadItem?: LoadItem | null;
  /** Q4: updates persisted mental climate when chosen. */
  mentalClimate?: MentalClimate;
}

export interface GuidedQuestionMeta {
  question: string;
  shortLabel: string;
  iconKey: ReflectionIconKey;
}

export const GUIDED_QUESTIONS: GuidedQuestionMeta[] = [
  {
    question: "What feels mentally loud today?",
    shortLabel: "What feels mentally loud today?",
    iconKey: "loops",
  },
  {
    question: "What's draining your focus?",
    shortLabel: "What's draining your focus?",
    iconKey: "orbit",
  },
  {
    question: "What would help your mind feel safer?",
    shortLabel: "What would help your mind feel safer?",
    iconKey: "heart",
  },
  {
    question: "How clear does your thinking feel today?",
    shortLabel: "How clear is your thinking?",
    iconKey: "gauge",
  },
  {
    question: "What has your attention been stuck on?",
    shortLabel: "What has your attention been stuck on?",
    iconKey: "pin",
  },
];

/** Q1 — maps into existing persisted `LoadItem` where possible. */
export const Q1_CHOICES: ReflectionChoice[] = [
  {
    id: "q1-loops",
    title: "Too many open loops",
    sub: "My mind won't slow down.",
    iconKey: "loops",
    loadItem: "Too many open loops",
  },
  {
    id: "q1-overthink",
    title: "Overthinking",
    sub: "I replay things again and again.",
    iconKey: "overthink",
    loadItem: "Mental clutter",
  },
  {
    id: "q1-info",
    title: "Information overload",
    sub: "Too much coming in at once.",
    iconKey: "info",
    loadItem: "Pressure to keep up",
  },
  {
    id: "q1-emotional",
    title: "Emotional heaviness",
    sub: "I feel emotionally weighed down.",
    iconKey: "heart",
    loadItem: "Emotional carryover",
  },
  {
    id: "q1-decision",
    title: "Decision fatigue",
    sub: "Too many decisions, not enough clarity.",
    iconKey: "decision",
    loadItem: "Decision fatigue",
  },
  {
    id: "q1-clutter",
    title: "Mental clutter",
    sub: "My thoughts feel scattered.",
    iconKey: "clutter",
    loadItem: "Mental clutter",
  },
  {
    id: "q1-other",
    title: "Something else",
    sub: "It's hard to put into words.",
    iconKey: "other",
    loadItem: null,
  },
];

export const Q2_CHOICES: ReflectionChoice[] = [
  {
    id: "q2-interrupt",
    title: "Interruptions",
    sub: "Messages, pings, and context-switching.",
    iconKey: "bell",
  },
  {
    id: "q2-emotion",
    title: "Emotional processing",
    sub: "Heavy feelings need room I don't have.",
    iconKey: "heart",
  },
  {
    id: "q2-tasks",
    title: "Unfinished tasks",
    sub: "Things half-done calling for attention.",
    iconKey: "list",
  },
  {
    id: "q2-perfection",
    title: "Trying to do it all well",
    sub: "High standards with limited bandwidth.",
    iconKey: "sparkle",
  },
  {
    id: "q2-body",
    title: "Low physical bandwidth",
    sub: "Sleep, hunger, or fatigue are in the mix.",
    iconKey: "battery",
  },
  {
    id: "q2-unsure",
    title: "It shifts",
    sub: "Hard to name — it keeps moving.",
    iconKey: "mist",
  },
];

export const Q3_CHOICES: ReflectionChoice[] = [
  {
    id: "q3-slow",
    title: "A slower pace",
    sub: "Space between one thing and the next.",
    iconKey: "cloud",
  },
  {
    id: "q3-boundaries",
    title: "Clear boundaries",
    sub: "Saying no without guilt.",
    iconKey: "shield",
  },
  {
    id: "q3-pause",
    title: "Permission to pause",
    sub: "It's okay to not push right now.",
    iconKey: "help",
  },
  {
    id: "q3-talk",
    title: "Someone to talk it through",
    sub: "Putting words to what's inside.",
    iconKey: "message",
  },
  {
    id: "q3-input",
    title: "Less input for a while",
    sub: "Screens, news, or noise turned down.",
    iconKey: "info",
  },
  {
    id: "q3-win",
    title: "A small win",
    sub: "One doable thing to build from.",
    iconKey: "sparkle",
  },
];

export const Q4_CHOICES: ReflectionChoice[] = [
  {
    id: "q4-crystal",
    title: "Crystal clear",
    sub: "Ideas land easily.",
    iconKey: "gauge",
    mentalClimate: "clear",
  },
  {
    id: "q4-mostly",
    title: "Mostly clear",
    sub: "A little haze, still workable.",
    iconKey: "gauge",
    mentalClimate: "steady",
  },
  {
    id: "q4-fog",
    title: "A bit foggy",
    sub: "Things feel slower to line up.",
    iconKey: "cloud",
    mentalClimate: "foggy",
  },
  {
    id: "q4-hard",
    title: "Hard to concentrate",
    sub: "Attention keeps slipping.",
    iconKey: "orbit",
    mentalClimate: "scattered",
  },
  {
    id: "q4-murky",
    title: "Murky or heavy",
    sub: "Thinking takes extra effort.",
    iconKey: "weight",
    mentalClimate: "heavy",
  },
  {
    id: "q4-loud",
    title: "Overwhelmed or loud",
    sub: "Too much at once inside.",
    iconKey: "loops",
    mentalClimate: "overfull",
  },
];

export const Q5_CHOICES: ReflectionChoice[] = [
  {
    id: "q5-convo",
    title: "A conversation",
    sub: "Words or tone still echoing.",
    iconKey: "message",
  },
  {
    id: "q5-future",
    title: "A worry about the future",
    sub: "What-ifs running ahead of me.",
    iconKey: "orbit",
  },
  {
    id: "q5-control",
    title: "Something I can't control",
    sub: "Circumstances I can't fix yet.",
    iconKey: "shield",
  },
  {
    id: "q5-work",
    title: "Work or school pressure",
    sub: "Deadlines, expectations, performance.",
    iconKey: "briefcase",
  },
  {
    id: "q5-relations",
    title: "Relationship dynamics",
    sub: "Tension, distance, or uncertainty.",
    iconKey: "users",
  },
  {
    id: "q5-bg",
    title: "Background friction",
    sub: "Nothing sharp — a steady hum.",
    iconKey: "mist",
  },
];

export const CHOICES_BY_STEP: ReflectionChoice[][] = [
  Q1_CHOICES,
  Q2_CHOICES,
  Q3_CHOICES,
  Q4_CHOICES,
  Q5_CHOICES,
];

export function choiceIdFromLoads(loads: LoadItem[]): string | null {
  const priority: Array<[LoadItem, string]> = [
    ["Too many open loops", "q1-loops"],
    ["Decision fatigue", "q1-decision"],
    ["Emotional carryover", "q1-emotional"],
    ["Pressure to keep up", "q1-info"],
    ["Mental clutter", "q1-clutter"],
    ["Social drain", "q1-other"],
  ];
  for (const [load, id] of priority) {
    if (loads.includes(load)) return id;
  }
  return null;
}
