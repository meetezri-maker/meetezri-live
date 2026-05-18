/** Tune presets — visuals + copy only; no API. Future: server / AI can recommend `id`. */
export type TuneStateId = "clear" | "gentle" | "focused" | "light";

export const TUNE_STATES: Array<{
  id: TuneStateId;
  label: string;
  copyHint: string;
}> = [
  { id: "clear", label: "Clear", copyHint: "Make space for clearer thought." },
  { id: "gentle", label: "Gentle", copyHint: "Ease the pace without forcing anything." },
  { id: "focused", label: "Focused", copyHint: "Bring attention back without pressure." },
  { id: "light", label: "Light", copyHint: "Let the heaviness loosen a little." },
];

/** Placeholder reflections — future: replace with `reflectionCopy` from AI/service. */
export const REFLECTION_PLACEHOLDERS = [
  "Your pace feels full today.",
  "There's a lot moving in your mind.",
  "Let's make this lighter.",
  "Your mind deserves a softer moment.",
] as const;

/** Placeholder thought lines — future: replace with `thoughtBubbleData`. */
export const THOUGHT_BUBBLE_PLACEHOLDERS = [
  "A lot on your plate.",
  "Quiet pressure in the background.",
  "Your mind has been carrying things.",
  "Some thoughts want more space than they need.",
  "Not everything needs to stay loud.",
] as const;

export const SIGNATURE_INSIGHTS = [
  "Clearer in slower moments",
  "Responds well to softer pacing",
  "Feels lighter with less visual noise",
] as const;

/** Client-only persistence for layout state (not profile API). */
export const BRAIN_HEALTH_LOCAL_KEY = "ezri_brain_health_experience_v1";
