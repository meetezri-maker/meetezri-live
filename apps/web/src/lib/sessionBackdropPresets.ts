/**
 * Solace session stage backgrounds — brand colors + mood-linked atmospheres.
 * Design reference: primary #4ECDC4, secondary #A78BFA, bg #0A0F1E, surface #0D1428, accent #FBBF24.
 *
 * Gradient philosophy: light lives at the **edges** (bloom + floor), stays **clear in the center**
 * where the companion sits, so layers read as depth—not a flat wash over the 3D subject.
 */

export const SOLACE_BRAND = {
  primary: "#4ECDC4",
  secondary: "#A78BFA",
  background: "#0A0F1E",
  surface: "#0D1428",
  accent: "#FBBF24",
  heading: "#FFFFFF",
} as const;

/** Presets keyed to Mood Check-In `value`s plus brand default `solace`. */
export const SESSION_BACKDROP_PRESETS = {
  solace: {
    rootBg: SOLACE_BRAND.background,
    radialPrimary: [
      "radial-gradient(ellipse 105% 75% at 18% 4%, rgba(78,205,196,0.34) 0%, rgba(78,205,196,0.1) 22%, transparent 48%)",
      "radial-gradient(ellipse 75% 65% at 88% 12%, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0.06) 30%, transparent 52%)",
      "radial-gradient(ellipse 140% 100% at 50% 50%, transparent 28%, rgba(10,15,30,0.55) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 95% 48% at 50% 108%, rgba(78,205,196,0.16) 0%, rgba(167,139,250,0.07) 40%, transparent 68%)",
    linearAccent:
      "linear-gradient(158deg, rgba(255,255,255,0.045) 0%, transparent 38%, rgba(78,205,196,0.055) 92%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(78,205,196,0.22) 0%, rgba(56,189,248,0.08) 42%, transparent 78%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(10,15,30,0.72) 0%, rgba(78,205,196,0.1) 46%, transparent 86%)",
    voiceBar: SOLACE_BRAND.primary,
  },
  happy: {
    rootBg: "#0A0F1E",
    radialPrimary: [
      "radial-gradient(ellipse 100% 78% at 20% 2%, rgba(251,191,36,0.28) 0%, rgba(251,191,36,0.08) 24%, transparent 50%)",
      "radial-gradient(ellipse 82% 68% at 85% 18%, rgba(78,205,196,0.2) 0%, transparent 48%)",
      "radial-gradient(ellipse 135% 100% at 50% 55%, transparent 30%, rgba(10,15,30,0.62) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 98% 50% at 50% 108%, rgba(251,191,36,0.14) 0%, rgba(78,205,196,0.08) 45%, transparent 72%)",
    linearAccent:
      "linear-gradient(145deg, rgba(251,191,36,0.07) 0%, transparent 40%, rgba(78,205,196,0.06) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(251,191,36,0.18) 0%, rgba(78,205,196,0.14) 44%, transparent 80%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(10,15,30,0.68) 0%, rgba(251,191,36,0.09) 44%, transparent 88%)",
    voiceBar: "#FBBF24",
  },
  calm: {
    rootBg: "#0A0F1E",
    radialPrimary: [
      "radial-gradient(ellipse 110% 80% at 12% 8%, rgba(78,205,196,0.38) 0%, rgba(56,189,248,0.1) 26%, transparent 52%)",
      "radial-gradient(ellipse 70% 58% at 95% 25%, rgba(45,212,191,0.1) 0%, transparent 48%)",
      "radial-gradient(ellipse 130% 100% at 50% 50%, transparent 32%, rgba(8,15,28,0.68) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 92% 46% at 50% 108%, rgba(78,205,196,0.14) 0%, rgba(30,64,90,0.12) 48%, transparent 72%)",
    linearAccent:
      "linear-gradient(165deg, rgba(125,211,252,0.06) 0%, transparent 45%, rgba(78,205,196,0.05) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(78,205,196,0.3) 0%, rgba(125,211,252,0.08) 46%, transparent 82%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(8,15,28,0.7) 0%, rgba(78,205,196,0.14) 50%, transparent 88%)",
    voiceBar: SOLACE_BRAND.primary,
  },
  anxious: {
    rootBg: "#090E1A",
    radialPrimary: [
      "radial-gradient(ellipse 105% 76% at 16% 6%, rgba(167,139,250,0.26) 0%, rgba(129,140,248,0.08) 28%, transparent 52%)",
      "radial-gradient(ellipse 78% 62% at 90% 10%, rgba(78,205,196,0.14) 0%, transparent 50%)",
      "radial-gradient(ellipse 130% 100% at 50% 52%, transparent 32%, rgba(9,14,26,0.7) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 96% 48% at 50% 108%, rgba(167,139,250,0.12) 0%, rgba(78,205,196,0.07) 42%, transparent 70%)",
    linearAccent:
      "linear-gradient(150deg, rgba(167,139,250,0.09) 0%, transparent 44%, rgba(99,102,241,0.05) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(167,139,250,0.18) 0%, rgba(78,205,196,0.12) 46%, transparent 80%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(9,14,26,0.74) 0%, rgba(167,139,250,0.1) 48%, transparent 88%)",
    voiceBar: SOLACE_BRAND.secondary,
  },
  sad: {
    rootBg: "#080C18",
    radialPrimary: [
      "radial-gradient(ellipse 100% 72% at 22% 15%, rgba(96,165,250,0.16) 0%, rgba(59,130,175,0.06) 30%, transparent 54%)",
      "radial-gradient(ellipse 85% 70% at 80% 8%, rgba(71,85,120,0.18) 0%, transparent 48%)",
      "radial-gradient(ellipse 130% 100% at 50% 55%, transparent 34%, rgba(8,12,24,0.75) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 90% 44% at 50% 108%, rgba(55,80,115,0.14) 0%, rgba(20,32,52,0.14) 50%, transparent 74%)",
    linearAccent:
      "linear-gradient(160deg, rgba(100,140,200,0.06) 0%, transparent 48%, rgba(59,90,130,0.05) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(96,165,250,0.12) 0%, rgba(45,75,110,0.1) 48%, transparent 84%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(8,12,24,0.78) 0%, rgba(55,85,130,0.1) 52%, transparent 90%)",
    voiceBar: "#7EB8D6",
  },
  angry: {
    rootBg: "#0A0A12",
    radialPrimary: [
      "radial-gradient(ellipse 102% 74% at 14% 2%, rgba(248,113,113,0.12) 0%, rgba(180,80,90,0.06) 24%, transparent 50%)",
      "radial-gradient(ellipse 88% 68% at 86% 12%, rgba(148,163,184,0.14) 0%, transparent 50%)",
      "radial-gradient(ellipse 128% 100% at 50% 52%, transparent 30%, rgba(10,10,20,0.78) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 94% 46% at 50% 108%, rgba(60,55,75,0.14) 0%, rgba(30,35,52,0.16) 50%, transparent 74%)",
    linearAccent:
      "linear-gradient(155deg, rgba(148,163,184,0.06) 0%, transparent 50%, rgba(71,85,105,0.06) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(78,205,196,0.1) 0%, rgba(100,120,160,0.08) 52%, transparent 86%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(10,10,20,0.76) 0%, rgba(55,50,68,0.12) 48%, transparent 88%)",
    voiceBar: "#94A3B8",
  },
  tired: {
    rootBg: "#0B0D18",
    radialPrimary: [
      "radial-gradient(ellipse 108% 78% at 20% 10%, rgba(148,163,184,0.14) 0%, rgba(110,110,140,0.08) 26%, transparent 52%)",
      "radial-gradient(ellipse 72% 58% at 85% 22%, rgba(78,205,196,0.08) 0%, transparent 50%)",
      "radial-gradient(ellipse 128% 100% at 50% 55%, transparent 35%, rgba(11,13,24,0.72) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 94% 44% at 50% 108%, rgba(120,118,150,0.1) 0%, rgba(40,42,60,0.18) 52%, transparent 76%)",
    linearAccent:
      "linear-gradient(165deg, rgba(165,170,200,0.07) 0%, transparent 50%, rgba(78,205,196,0.04) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(148,163,184,0.12) 0%, rgba(78,205,196,0.08) 50%, transparent 86%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(11,13,24,0.74) 0%, rgba(100,105,130,0.1) 50%, transparent 90%)",
    voiceBar: "#A5B4C4",
  },
  excited: {
    rootBg: "#0A0F1E",
    radialPrimary: [
      "radial-gradient(ellipse 104% 78% at 10% 0%, rgba(78,205,196,0.32) 0%, rgba(167,139,250,0.16) 18%, transparent 46%)",
      "radial-gradient(ellipse 82% 70% at 95% 5%, rgba(167,139,250,0.24) 0%, rgba(236,72,153,0.06) 35%, transparent 52%)",
      "radial-gradient(ellipse 132% 100% at 50% 52%, transparent 28%, rgba(10,15,30,0.65) 100%)",
    ].join(", "),
    radialFloor:
      "radial-gradient(ellipse 100% 52% at 50% 106%, rgba(167,139,250,0.16) 0%, rgba(78,205,196,0.12) 44%, transparent 72%)",
    linearAccent:
      "linear-gradient(138deg, rgba(78,205,196,0.09) 0%, transparent 36%, rgba(167,139,250,0.1) 100%)",
    speakingWash:
      "linear-gradient(to bottom, rgba(78,205,196,0.28) 0%, rgba(167,139,250,0.16) 42%, transparent 82%)",
    speakingBottomVignette:
      "linear-gradient(to top, rgba(10,15,30,0.7) 0%, rgba(167,139,250,0.11) 42%, transparent 88%)",
    voiceBar: SOLACE_BRAND.secondary,
  },
} as const;

export type SessionBackdropLayers =
  (typeof SESSION_BACKDROP_PRESETS)[keyof typeof SESSION_BACKDROP_PRESETS];

export type SessionBackdropPresetKey =
  keyof typeof SESSION_BACKDROP_PRESETS;

export type SessionBackdropPreference =
  | "auto"
  | SessionBackdropPresetKey;

const MOOD_SLUG_TO_PRESET: Record<string, SessionBackdropPresetKey> = {
  happy: "happy",
  calm: "calm",
  anxious: "anxious",
  nervous: "anxious",
  sad: "sad",
  angry: "angry",
  tired: "tired",
  excited: "excited",
  energetic: "excited",
  neutral: "solace",
};

export const SESSION_BACKDROP_STORAGE_KEY = "meetezri.activeSession.backdrop";

/**
 * Bold preview gradients for the room-mood picker (swatch tiles).
 * Tuned to feel premium on dark UI: saturated accents, smooth multi-stop blends.
 */
export const SESSION_MOOD_SWATCH_GRADIENT: Record<
  SessionBackdropPreference,
  string
> = {
  auto:
    "linear-gradient(135deg, #312e81 0%, #4ECDC4 38%, #f472b6 68%, #fbbf24 100%)",
  solace:
    "linear-gradient(148deg, #0A0F1E 0%, #134e4a 22%, #4ECDC4 48%, #5b21b6 78%, #c4b5fd 100%)",
  happy:
    "linear-gradient(132deg, #0f172a 0%, #ea580c 32%, #fbbf24 58%, #fef08a 78%, #22d3a1 100%)",
  calm:
    "linear-gradient(145deg, #042f2e 0%, #14b8a6 42%, #67e8f9 72%, #0e7490 100%)",
  anxious:
    "linear-gradient(125deg, #1e1b4b 0%, #6366f1 35%, #a78bfa 62%, #4ECDC4 92%)",
  sad:
    "linear-gradient(142deg, #0c1228 0%, #1d4ed8 28%, #93c5fd 55%, #1e3a8a 100%)",
  angry:
    "linear-gradient(140deg, #18181b 0%, #475569 28%, #fb7185 62%, #94a3b8 100%)",
  tired:
    "linear-gradient(155deg, #1e1b2e 0%, #6b7280 25%, #c7d2fe 58%, #4b5563 100%)",
  excited:
    "linear-gradient(122deg, #4c1d95 0%, #4ECDC4 28%, #e879f9 52%, #f0abfc 78%, #A78BFA 100%)",
};

/** Short label on gradient tiles (full phrase stays in aria-label). */
/** Three.js cyclorama colors per resolved preset (matches `SessionBackdrop` moods). */
export interface SessionRoom3dTheme {
  wall: number;
  wallDeep: number;
  floor: number;
  ceiling: number;
  emissive: number;
  keyLight: number;
  fillLight: number;
  rimLight: number;
  warmthLight: number;
}

export const SESSION_ROOM_3D_THEMES: Record<
  SessionBackdropPresetKey,
  SessionRoom3dTheme
> = {
  solace: {
    wall: 0x2c3a4e,
    wallDeep: 0x1a2838,
    floor: 0x1a2434,
    ceiling: 0x232f3f,
    emissive: 0x0d1522,
    keyLight: 0xfff5eb,
    fillLight: 0xfff1df,
    rimLight: 0x4466aa,
    warmthLight: 0xffc9a8,
  },
  happy: {
    wall: 0x3a4230,
    wallDeep: 0x252e1c,
    floor: 0x1c2414,
    ceiling: 0x2a3224,
    emissive: 0x181408,
    keyLight: 0xfff8e8,
    fillLight: 0xfff0c8,
    rimLight: 0xfbbf24,
    warmthLight: 0xffd080,
  },
  calm: {
    wall: 0x1e3d42,
    wallDeep: 0x122830,
    floor: 0x0f2228,
    ceiling: 0x1a2e35,
    emissive: 0x081820,
    keyLight: 0xe8fffa,
    fillLight: 0xd4f5f0,
    rimLight: 0x2dd4bf,
    warmthLight: 0x7ecfc0,
  },
  anxious: {
    wall: 0x2d2850,
    wallDeep: 0x1a1838,
    floor: 0x151228,
    ceiling: 0x221f3a,
    emissive: 0x100e22,
    keyLight: 0xf0ecff,
    fillLight: 0xe8e0ff,
    rimLight: 0x6366f1,
    warmthLight: 0xc4b5fd,
  },
  sad: {
    wall: 0x1e2a42,
    wallDeep: 0x121a2e,
    floor: 0x0c1420,
    ceiling: 0x182230,
    emissive: 0x080c18,
    keyLight: 0xe8f0ff,
    fillLight: 0xc7d9f0,
    rimLight: 0x3b82f6,
    warmthLight: 0x93c5fd,
  },
  angry: {
    wall: 0x2a2828,
    wallDeep: 0x181616,
    floor: 0x121010,
    ceiling: 0x1e1c1c,
    emissive: 0x0a0808,
    keyLight: 0xfff0ec,
    fillLight: 0xe8e0dc,
    rimLight: 0x64748b,
    warmthLight: 0xd4a0a0,
  },
  tired: {
    wall: 0x2a2a35,
    wallDeep: 0x1a1a22,
    floor: 0x141418,
    ceiling: 0x1e1e28,
    emissive: 0x0c0c12,
    keyLight: 0xf0eef8,
    fillLight: 0xd8d4e8,
    rimLight: 0x6b7280,
    warmthLight: 0xc7c0d8,
  },
  excited: {
    wall: 0x352550,
    wallDeep: 0x201535,
    floor: 0x181025,
    ceiling: 0x281e40,
    emissive: 0x120a22,
    keyLight: 0xfff0ff,
    fillLight: 0xf5e0ff,
    rimLight: 0xa78bfa,
    warmthLight: 0xf0abfc,
  },
};

export function resolveSessionRoom3dTheme(
  preference: SessionBackdropPreference,
  latestMoodSlug: string | null,
): SessionRoom3dTheme {
  const key = resolveSessionBackdropPresetKey(preference, latestMoodSlug);
  return SESSION_ROOM_3D_THEMES[key];
}

export const SESSION_MOOD_TILE_CAPTION: Record<
  SessionBackdropPreference,
  string
> = {
  auto: "Auto",
  solace: "Default",
  happy: "Happy",
  calm: "Calm",
  anxious: "Ease",
  sad: "Reflect",
  angry: "Cool",
  tired: "Rest",
  excited: "Energy",
};

/** Resolved preset key when applying layers (same rules as `resolveSessionBackdropLayers`). */
export function resolveSessionBackdropPresetKey(
  preference: SessionBackdropPreference,
  latestMoodSlug: string | null,
): SessionBackdropPresetKey {
  if (preference === "auto") {
    const slug = latestMoodSlug?.toLowerCase().trim() ?? "";
    return MOOD_SLUG_TO_PRESET[slug] ?? "solace";
  }
  return preference as SessionBackdropPresetKey;
}

/** Picker tiles — 3×3 grid. `solace` is the brand-default room (original session look). */
export const SESSION_BACKDROP_EMOJI_OPTIONS: {
  value: SessionBackdropPreference;
  emoji: string;
  label: string;
}[] = [
  { value: "auto", emoji: "✨", label: "Auto — match latest check-in" },
  { value: "solace", emoji: "🌌", label: "Default — brand atmosphere" },
  { value: "happy", emoji: "😊", label: "Happy" },
  { value: "calm", emoji: "😌", label: "Calm" },
  { value: "anxious", emoji: "😰", label: "Anxious (soothing)" },
  { value: "sad", emoji: "😢", label: "Sad" },
  { value: "angry", emoji: "😠", label: "Angry (cooling)" },
  { value: "tired", emoji: "😴", label: "Tired" },
  { value: "excited", emoji: "🤩", label: "Excited" },
];

export function parseSessionBackdropPreference(
  raw: string | null,
): SessionBackdropPreference {
  if (!raw) return "auto";
  if (raw === "solace") return "solace";
  const allowed = new Set(
    SESSION_BACKDROP_EMOJI_OPTIONS.map((o) => o.value) as string[],
  );
  return allowed.has(raw) ? (raw as SessionBackdropPreference) : "auto";
}

export function resolveSessionBackdropLayers(
  preference: SessionBackdropPreference,
  latestMoodSlug: string | null,
): SessionBackdropLayers {
  const key = resolveSessionBackdropPresetKey(preference, latestMoodSlug);
  return SESSION_BACKDROP_PRESETS[key];
}

/** Swatch gradient key — Auto resolves to the active mood preset, not the rainbow tile. */
export function resolveSessionMoodSwatchKey(
  preference: SessionBackdropPreference,
  latestMoodSlug: string | null,
): SessionBackdropPreference {
  if (preference === "auto") {
    return resolveSessionBackdropPresetKey(preference, latestMoodSlug);
  }
  return preference;
}

export function resolveSessionMoodSwatchGradient(
  preference: SessionBackdropPreference,
  latestMoodSlug: string | null,
): string {
  const key = resolveSessionMoodSwatchKey(preference, latestMoodSlug);
  return SESSION_MOOD_SWATCH_GRADIENT[key];
}
