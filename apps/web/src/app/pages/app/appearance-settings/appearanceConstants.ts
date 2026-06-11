/** Bump when default theme or migration rules change. */
export const APPEARANCE_SETTINGS_VERSION = 4;

export const APPEARANCE_STORAGE_KEY_BASE = "ezri_appearance_settings";

export const ACCENT_COLOR_KEYS = ["pink", "purple", "blue", "teal", "green", "orange"] as const;

/** Factory Solace sanctuary palette — primary violet, secondary lavender, cyan highlights. */
export const SANCTUARY_THEME = {
  primary: "#7c3aed",
  secondary: "#a78bfa",
  cyan: "#22d3ee",
  rose: "#ec4899",
  buttonGradient: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
  ring: "rgba(167, 139, 250, 0.45)",
  borderGlow: "rgba(168, 85, 247, 0.22)",
  glowPurple: "rgba(168, 85, 247, 0.35)",
  glowPink: "rgba(236, 72, 153, 0.28)",
  glowViolet: "rgba(167, 139, 250, 0.24)",
  glowPinkSoft: "rgba(236, 72, 153, 0.22)",
  scrollbarThumb: "rgba(139, 92, 246, 0.35)",
  scrollbarThumbHover: "rgba(139, 92, 246, 0.55)",
  scrollbarGradient: "linear-gradient(180deg, rgba(139, 92, 246, 0.45), rgba(34, 211, 238, 0.25))",
} as const;

/** Default accent = Lavender swatch = original sanctuary theme (not Rose Pink). */
export const DEFAULT_ACCENT_COLOR_KEY: AccentColorKey = "purple";

export type AppearanceTheme = "light" | "dark";

export type AccentColorKey = (typeof ACCENT_COLOR_KEYS)[number];

export type BackgroundStyle = "solid" | "gradient" | "pattern";

export interface AppearanceSettingsSnapshot {
  theme: AppearanceTheme;
  accentColor: AccentColorKey;
  backgroundStyle: BackgroundStyle;
  animations: boolean;
  compactMode: boolean;
  showAvatars: boolean;
  appearanceVersion: number;
}

export const ACCENT_COLOR_MAP: Record<AccentColorKey, string> = {
  blue: "#3b82f6",
  purple: SANCTUARY_THEME.secondary,
  pink: "#ec4899",
  green: "#22c55e",
  orange: "#f97316",
  teal: "#14b8a6",
};

/** Solid gradient stops for accent orbs (always visible in light + high-contrast). */
export const ACCENT_ORB_GRADIENT: Record<AccentColorKey, [string, string]> = {
  pink: ["#fb7185", "#db2777"],
  purple: ["#a78bfa", "#7c3aed"],
  blue: ["#38bdf8", "#2563eb"],
  teal: ["#2dd4bf", "#0d9488"],
  green: ["#4ade80", "#15803d"],
  orange: ["#fb923c", "#e11d48"],
};

/** Primary button gradients per accent — drives solaceBtnPrimary and CTAs. */
export const ACCENT_BUTTON_GRADIENT: Record<AccentColorKey, string> = {
  pink: "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
  purple: SANCTUARY_THEME.buttonGradient,
  blue: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  teal: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
  green: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  orange: "linear-gradient(135deg, #f97316 0%, #e11d48 100%)",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function hexColorRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(168, 85, 247, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function accentRgba(accentKey: AccentColorKey, alpha: number): string {
  return hexColorRgba(ACCENT_COLOR_MAP[accentKey], alpha);
}

/** Nav + appearance selection gradients — matches accent orb two-stop shades. */
function applyNavSelectionTokens(resolvedKey: AccentColorKey) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = ACCENT_COLOR_MAP[resolvedKey];
  const [orbFrom, orbTo] = ACCENT_ORB_GRADIENT[resolvedKey];

  root.style.setProperty(
    "--nav-active-bg",
    `linear-gradient(to right, ${hexColorRgba(orbFrom, 0.22)}, ${hexColorRgba(orbTo, 0.1)})`
  );
  root.style.setProperty(
    "--nav-active-bg-light",
    `linear-gradient(135deg, ${hexColorRgba(orbFrom, 0.24)}, ${hexColorRgba(orbTo, 0.12)})`
  );
  root.style.setProperty("--nav-active-border", hexColorRgba(orbFrom, 0.35));
  root.style.setProperty("--nav-active-border-light", hexColorRgba(orbFrom, 0.45));
  root.style.setProperty(
    "--nav-active-shadow",
    `0 0 32px ${hexColorRgba(accent, 0.22)}, inset 0 0 0 1px ${hexColorRgba(orbFrom, 0.32)}`
  );
  root.style.setProperty(
    "--nav-active-shadow-light",
    `0 0 20px ${hexColorRgba(accent, 0.16)}`
  );
  root.style.setProperty("--nav-active-icon", orbFrom);
  root.style.setProperty("--nav-active-icon-light", orbTo);
  root.style.setProperty("--nav-active-text-light", orbTo);
  root.style.setProperty(
    "--nav-mobile-indicator",
    `linear-gradient(to right, ${orbFrom}, ${hexColorRgba(accent, 0.85)})`
  );
  root.style.setProperty(
    "--appearance-selection-bg",
    `linear-gradient(135deg, ${hexColorRgba(orbFrom, 0.14)}, ${hexColorRgba(orbTo, 0.07)})`
  );
  root.style.setProperty("--appearance-selection-border", hexColorRgba(orbFrom, 0.42));
  root.style.setProperty(
    "--appearance-selection-shadow",
    `0 0 24px -8px ${hexColorRgba(accent, 0.28)}`
  );
  root.style.setProperty(
    "--appearance-selection-ring",
    hexColorRgba(orbFrom, 0.8)
  );
}

export function getAppearanceStorageKey(userId?: string | null): string {
  if (userId) return `${APPEARANCE_STORAGE_KEY_BASE}_${userId}`;
  return APPEARANCE_STORAGE_KEY_BASE;
}

export function getDefaultAppearanceSettings(): AppearanceSettingsSnapshot {
  return {
    theme: "dark",
    accentColor: DEFAULT_ACCENT_COLOR_KEY,
    backgroundStyle: "gradient",
    animations: true,
    compactMode: false,
    showAvatars: true,
    appearanceVersion: APPEARANCE_SETTINGS_VERSION,
  };
}

export function parseAppearanceSettings(raw: unknown): AppearanceSettingsSnapshot {
  const defaults = getDefaultAppearanceSettings();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<AppearanceSettingsSnapshot> & { theme?: string };
  const backgroundStyle =
    parsed.backgroundStyle === "solid" ||
    parsed.backgroundStyle === "gradient" ||
    parsed.backgroundStyle === "pattern"
      ? parsed.backgroundStyle
      : defaults.backgroundStyle;

  return {
    theme: resolveAppearanceTheme(parsed.theme, parsed.appearanceVersion),
    accentColor: isAccentColorKey(parsed.accentColor) ? parsed.accentColor : defaults.accentColor,
    backgroundStyle,
    animations: typeof parsed.animations === "boolean" ? parsed.animations : defaults.animations,
    compactMode: typeof parsed.compactMode === "boolean" ? parsed.compactMode : defaults.compactMode,
    showAvatars: typeof parsed.showAvatars === "boolean" ? parsed.showAvatars : defaults.showAvatars,
    appearanceVersion: APPEARANCE_SETTINGS_VERSION,
  };
}

/** Read saved appearance — prefers user-specific key, then scans localStorage, then generic. */
export function readAppearanceFromStorage(userId?: string | null): AppearanceSettingsSnapshot {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return getDefaultAppearanceSettings();
  }

  const preferredKey = getAppearanceStorageKey(userId);
  const preferred = window.localStorage.getItem(preferredKey);
  if (preferred) {
    try {
      return parseAppearanceSettings(JSON.parse(preferred));
    } catch {
      return getDefaultAppearanceSettings();
    }
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(`${APPEARANCE_STORAGE_KEY_BASE}_`)) continue;
    try {
      const value = window.localStorage.getItem(key);
      if (!value) continue;
      return parseAppearanceSettings(JSON.parse(value));
    } catch {
      continue;
    }
  }

  const generic = window.localStorage.getItem(APPEARANCE_STORAGE_KEY_BASE);
  if (generic) {
    try {
      return parseAppearanceSettings(JSON.parse(generic));
    } catch {
      return getDefaultAppearanceSettings();
    }
  }

  return getDefaultAppearanceSettings();
}

export function saveAppearanceToStorage(
  settings: AppearanceSettingsSnapshot,
  userId?: string | null
): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  window.localStorage.setItem(getAppearanceStorageKey(userId), JSON.stringify(settings));
}

export function dispatchAppearanceChange(settings: AppearanceSettingsSnapshot): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ezri-appearance-change", { detail: settings }));
}

/** Canonical Solace sanctuary page backdrop (dark + gradient default). */
export const DEFAULT_SOLACE_PAGE_BG =
  "linear-gradient(165deg, #0a0b18 0%, #090a16 42%, #0c0a18 100%)";

export function isDefaultAppearanceSettings(settings: AppearanceSettingsSnapshot): boolean {
  const defaults = getDefaultAppearanceSettings();
  return (
    settings.theme === defaults.theme &&
    settings.accentColor === defaults.accentColor &&
    settings.backgroundStyle === defaults.backgroundStyle &&
    settings.animations === defaults.animations &&
    settings.compactMode === defaults.compactMode &&
    settings.showAvatars === defaults.showAvatars
  );
}

/** Persist + apply factory Solace appearance everywhere (sidebar, buttons, scrollbars, pages). */
export function resetAppearanceToDefaults(userId?: string | null): AppearanceSettingsSnapshot {
  const defaults = getDefaultAppearanceSettings();
  saveAppearanceToStorage(defaults, userId);
  applyAppearanceToDocument(defaults);
  dispatchAppearanceChange(defaults);
  return defaults;
}

export function isAccentColorKey(value: unknown): value is AccentColorKey {
  return typeof value === "string" && ACCENT_COLOR_KEYS.includes(value as AccentColorKey);
}

/** Solace sanctuary UI is dark; migrate legacy light/auto saves until user picks light on v4+. */
export function resolveAppearanceTheme(
  theme: unknown,
  appearanceVersion: unknown
): AppearanceTheme {
  const version = typeof appearanceVersion === "number" ? appearanceVersion : 1;

  if (version < APPEARANCE_SETTINGS_VERSION) {
    return "dark";
  }

  if (theme === "light") {
    return "light";
  }

  return "dark";
}

/** Original sanctuary theme — violet primary, lavender secondary, cyan highlights. */
function applySanctuaryThemeAccentTokens() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { primary, secondary, cyan, rose, buttonGradient, ring } = SANCTUARY_THEME;
  const [orbFrom, orbTo] = ACCENT_ORB_GRADIENT.purple;

  root.style.setProperty("--accent", secondary);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", ring);
  root.style.setProperty("--solace-accent", rose);
  root.style.setProperty("--accent-secondary", secondary);
  root.style.setProperty("--accent-violet", secondary);
  root.style.setProperty("--accent-pink", rose);
  root.style.setProperty("--accent-primary", cyan);
  root.style.setProperty("--button-primary", buttonGradient);
  root.style.setProperty(
    "--button-primary-shadow",
    "0 8px 24px -8px rgba(109, 40, 217, 0.35), 0 0 20px -6px rgba(167, 139, 250, 0.25)"
  );
  root.style.setProperty("--solace-ds-border-glow", SANCTUARY_THEME.borderGlow);
  root.style.setProperty("--solace-ds-glow-purple", SANCTUARY_THEME.glowPurple);
  root.style.setProperty("--solace-ds-glow-pink", SANCTUARY_THEME.glowPink);
  root.style.setProperty("--glow-violet", SANCTUARY_THEME.glowViolet);
  root.style.setProperty("--glow-pink", SANCTUARY_THEME.glowPinkSoft);
  root.style.setProperty("--input-focus-border", secondary);
  root.style.setProperty("--input-focus-glow", "rgba(167, 139, 250, 0.18)");
  root.style.setProperty("--solace-scrollbar-thumb", SANCTUARY_THEME.scrollbarThumb);
  root.style.setProperty("--solace-scrollbar-thumb-hover", SANCTUARY_THEME.scrollbarThumbHover);
  root.style.setProperty("--solace-scrollbar-thumb-gradient", SANCTUARY_THEME.scrollbarGradient);
  root.style.setProperty("--solace-scrollbar-track", "rgba(255, 255, 255, 0.04)");
  root.style.setProperty("--appearance-orb-from", orbFrom);
  root.style.setProperty("--appearance-orb-to", orbTo);
  root.style.setProperty("--solace-purple", secondary);

  const themeAttr = root.getAttribute("data-ezri-theme");
  if (themeAttr === "light") {
    root.style.setProperty("--button-secondary-text", primary);
    root.style.setProperty("--button-secondary-border", "rgba(167, 139, 250, 0.35)");
  }

  applyNavSelectionTokens(DEFAULT_ACCENT_COLOR_KEY);
}

export function applyAccentColorToDocument(accentKey: string) {
  if (typeof document === "undefined") return;
  const resolvedKey = isAccentColorKey(accentKey) ? accentKey : DEFAULT_ACCENT_COLOR_KEY;

  if (resolvedKey === DEFAULT_ACCENT_COLOR_KEY) {
    applySanctuaryThemeAccentTokens();
    return;
  }

  const root = document.documentElement;
  const accent = ACCENT_COLOR_MAP[resolvedKey];
  const [orbFrom, orbTo] = ACCENT_ORB_GRADIENT[resolvedKey];

  root.style.setProperty("--accent", accent);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--solace-accent", accent);
  root.style.setProperty("--accent-secondary", accent);
  root.style.setProperty("--accent-violet", accent);
  root.style.setProperty("--accent-pink", accent);
  root.style.setProperty("--accent-primary", accent);
  root.style.setProperty("--button-primary", ACCENT_BUTTON_GRADIENT[resolvedKey]);
  root.style.setProperty(
    "--button-primary-shadow",
    `0 8px 24px -8px ${accentRgba(resolvedKey, 0.35)}, 0 0 20px -6px ${accentRgba(resolvedKey, 0.25)}`
  );
  root.style.setProperty("--solace-ds-border-glow", accentRgba(resolvedKey, 0.28));
  root.style.setProperty("--solace-ds-glow-purple", accentRgba(resolvedKey, 0.35));
  root.style.setProperty("--solace-ds-glow-pink", accentRgba(resolvedKey, 0.28));
  root.style.setProperty("--glow-violet", accentRgba(resolvedKey, 0.24));
  root.style.setProperty("--glow-pink", accentRgba(resolvedKey, 0.22));
  root.style.setProperty("--input-focus-border", accent);
  root.style.setProperty("--input-focus-glow", accentRgba(resolvedKey, 0.18));
  root.style.setProperty("--solace-scrollbar-thumb", accentRgba(resolvedKey, 0.45));
  root.style.setProperty("--solace-scrollbar-thumb-hover", accentRgba(resolvedKey, 0.65));
  root.style.setProperty(
    "--solace-scrollbar-thumb-gradient",
    `linear-gradient(180deg, ${accentRgba(resolvedKey, 0.5)}, ${accentRgba(resolvedKey, 0.22)})`
  );
  root.style.setProperty("--solace-scrollbar-track", "rgba(255, 255, 255, 0.04)");
  root.style.setProperty("--appearance-orb-from", orbFrom);
  root.style.setProperty("--appearance-orb-to", orbTo);

  const themeAttr = root.getAttribute("data-ezri-theme");
  root.style.setProperty("--solace-purple", accent);
  if (themeAttr === "light") {
    root.style.setProperty("--button-secondary-text", accent);
    root.style.setProperty("--button-secondary-border", accentRgba(resolvedKey, 0.35));
  }

  applyNavSelectionTokens(resolvedKey);
}

interface BackdropTokens {
  color: string;
  image: string;
  size: string;
  position: string;
  repeat: string;
  attachment: string;
}

const LIGHT_PAGE_BASE = "#fbf8ff";
const DARK_PAGE_BASE = "#07080f";
const LIGHT_GRADIENT =
  "linear-gradient(135deg, #ffffff 0%, #fbf8ff 38%, #f3ecff 72%, #ecfdfb 100%)";

/** Preview tokens for a given style + current accent (appearance picker cards). */
export function getBackdropTokensForStyle(
  style: BackgroundStyle,
  accentKey: AccentColorKey,
  theme: AppearanceTheme
): BackdropTokens {
  return buildBackdropTokens(style, accentKey, theme);
}

function buildBackdropTokens(
  style: BackgroundStyle,
  accentKey: AccentColorKey,
  theme: AppearanceTheme
): BackdropTokens {
  const accent = ACCENT_COLOR_MAP[accentKey];
  const [orbFrom, orbTo] = ACCENT_ORB_GRADIENT[accentKey];
  const isLight = theme === "light";
  const base = isLight ? LIGHT_PAGE_BASE : DARK_PAGE_BASE;

  if (style === "solid") {
    return {
      color: isLight
        ? `color-mix(in srgb, ${accent} 10%, ${LIGHT_PAGE_BASE})`
        : `color-mix(in srgb, ${accent} 16%, ${DARK_PAGE_BASE})`,
      image: "none",
      size: "auto",
      position: "0 0",
      repeat: "no-repeat",
      attachment: "fixed",
    };
  }

  if (style === "pattern") {
    const tile = isLight ? "10px 10px" : "12px 12px";
    const stroke = accentRgba(accentKey, isLight ? 0.16 : 0.2);
    return {
      color: base,
      image: `linear-gradient(135deg, ${stroke} 25%, transparent 25%), linear-gradient(225deg, ${stroke} 25%, transparent 25%)`,
      size: `${tile}, ${tile}`,
      position: "0 0, 6px 0",
      repeat: "repeat",
      attachment: "local",
    };
  }

  let gradient = isLight
    ? LIGHT_GRADIENT
    : accentKey === DEFAULT_ACCENT_COLOR_KEY
      ? DEFAULT_SOLACE_PAGE_BG
      : `linear-gradient(165deg, color-mix(in srgb, ${orbFrom} 22%, #0a0b18) 0%, color-mix(in srgb, ${orbTo} 18%, #090a16) 42%, #0c0a18 100%)`;

  return {
    color: base,
    image: gradient,
    size: "100% 100%",
    position: "0 0",
    repeat: "no-repeat",
    attachment: "fixed",
  };
}

function applyBackdropTokensToRoot(root: HTMLElement, tokens: BackdropTokens): void {
  root.style.setProperty("--solace-app-backdrop-color", tokens.color);
  root.style.setProperty("--solace-app-backdrop-image", tokens.image);
  root.style.setProperty("--solace-app-backdrop-size", tokens.size);
  root.style.setProperty("--solace-app-backdrop-position", tokens.position);
  root.style.setProperty("--solace-app-backdrop-repeat", tokens.repeat);
  root.style.setProperty("--solace-app-backdrop-attachment", tokens.attachment);

  root.style.setProperty("--solace-bg", tokens.color);
  root.style.setProperty(
    "--solace-page-bg",
    tokens.image === "none" ? tokens.color : tokens.image
  );

  if (tokens.image === "none" || tokens.repeat === "no-repeat") {
    if (tokens.image !== "none") {
      root.style.setProperty("--solace-page-bg-size", tokens.size);
      root.style.setProperty("--solace-page-bg-position", tokens.position);
    } else {
      root.style.removeProperty("--solace-page-bg-size");
      root.style.removeProperty("--solace-page-bg-position");
    }
  } else {
    root.style.setProperty("--solace-page-bg-size", tokens.size);
    root.style.setProperty("--solace-page-bg-position", tokens.position);
  }
}

/** Page backdrop — solid, gradient, or pattern tinted by accent. */
export function applyBackgroundStyleToDocument(
  style: BackgroundStyle,
  accentKey: AccentColorKey,
  theme: AppearanceTheme
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-ezri-background-style", style);
  applyBackdropTokensToRoot(root, buildBackdropTokens(style, accentKey, theme));
}

export function applyAppearanceToDocument(settings: AppearanceSettingsSnapshot): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  applyThemeToDocument(settings.theme);
  applyAccentColorToDocument(settings.accentColor);
  applyBackgroundStyleToDocument(settings.backgroundStyle, settings.accentColor, settings.theme);

  root.classList.toggle("appearance-no-animations", !settings.animations);
  root.classList.toggle("appearance-hide-avatars", !settings.showAvatars);
  root.toggleAttribute("data-ezri-compact-mode", settings.compactMode);
}

/** Push semantic aliases used by forms, buttons, and shared chrome. */
export function applySemanticThemeTokens(theme: AppearanceTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "light") {
    root.style.setProperty("--bg", "#fbf8ff");
    root.style.setProperty("--bg-soft", "#f7f2ff");
    root.style.setProperty(
      "--bg-gradient",
      "linear-gradient(135deg, #ffffff 0%, #fbf8ff 38%, #f3ecff 72%, #ecfdfb 100%)"
    );
    root.style.setProperty("--surface", "#ffffff");
    root.style.setProperty("--surface-soft", "#fbf8ff");
    root.style.setProperty("--surface-lavender", "#f5eeff");
    root.style.setProperty("--surface-pink", "#fff1f7");
    root.style.setProperty("--surface-teal", "#ecfdfb");
    root.style.setProperty("--surface-gold", "#fff8dd");
    root.style.setProperty("--surface-elevated", "#ffffff");
    root.style.setProperty("--card", "rgba(255, 255, 255, 0.86)");
    root.style.setProperty("--card-solid", "#ffffff");
    root.style.setProperty("--card-muted", "#f8f3ff");
    root.style.setProperty("--card-soft", "#fbf8ff");
    root.style.setProperty("--card-lavender", "#f6f0ff");
    root.style.setProperty("--text-primary", "#101828");
    root.style.setProperty("--text-secondary", "#475467");
    root.style.setProperty("--text-muted", "#667085");
    root.style.setProperty("--text-soft", "#7a728e");
    root.style.setProperty("--text-inverse", "#ffffff");
    root.style.setProperty("--border", "#e7ddfb");
    root.style.setProperty("--border-strong", "#d8c7f7");
    root.style.setProperty("--glow-pink", "rgba(236, 72, 153, 0.22)");
    root.style.setProperty("--glow-violet", "rgba(167, 139, 250, 0.24)");
    root.style.setProperty("--glow-teal", "rgba(78, 205, 196, 0.2)");
    root.style.setProperty("--glow-gold", "rgba(251, 191, 36, 0.2)");
    root.style.setProperty(
      "--rail-card-bg",
      "linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(246, 240, 255, 0.84))"
    );
    root.style.setProperty("--rail-card-border", "rgba(167, 139, 250, 0.3)");
    root.style.setProperty(
      "--hero-overlay-readability",
      "linear-gradient(90deg, rgba(255, 255, 255, 0.4) 0%, rgba(246, 240, 255, 0.28) 55%, rgba(10, 15, 30, 0.12) 100%)"
    );
    root.style.setProperty("--accent-primary", "#4ecdc4");
    root.style.setProperty("--accent-secondary", "#a78bfa");
    root.style.setProperty("--accent-warm", "#fbbf24");
    root.style.setProperty("--accent-teal", "#4ecdc4");
    root.style.setProperty("--accent-violet", "#a78bfa");
    root.style.setProperty("--accent-pink", "#ec4899");
    root.style.setProperty("--accent-gold", "#fbbf24");
    root.style.setProperty("--button-primary", "linear-gradient(135deg, #ec4899, #a855f7)");
    root.style.setProperty("--button-primary-text", "#ffffff");
    root.style.setProperty("--button-secondary-bg", "#f6f0ff");
    root.style.setProperty("--button-secondary-text", "#5b21b6");
    root.style.setProperty("--button-secondary-border", "#d8c7f7");
    root.style.setProperty("--input-bg", "#ffffff");
    root.style.setProperty("--input-border", "#ddd0fa");
    root.style.setProperty("--input-text", "#101828");
    root.style.setProperty("--input-placeholder", "#98a2b3");
    root.style.setProperty("--input-focus-border", "#a78bfa");
    root.style.setProperty("--input-focus-glow", "rgba(167, 139, 250, 0.18)");
    root.style.setProperty("--foreground", "#101828");
    root.style.setProperty("--background", "#fbf8ff");
    root.style.setProperty("--primary", "#a78bfa");
    root.style.setProperty("--primary-foreground", "#ffffff");
    root.style.setProperty("--muted-foreground", "#667085");
    root.style.setProperty("--solace-purple", "#a78bfa");
  } else {
    const lightOnly = [
      "--bg",
      "--bg-gradient",
      "--surface",
      "--surface-elevated",
      "--card",
      "--card-soft",
      "--card-lavender",
      "--text-primary",
      "--text-secondary",
      "--text-muted",
      "--text-soft",
      "--border",
      "--border-strong",
      "--glow-pink",
      "--glow-violet",
      "--glow-teal",
      "--glow-gold",
      "--accent-primary",
      "--accent-secondary",
      "--accent-warm",
      "--accent-teal",
      "--accent-violet",
      "--accent-pink",
      "--accent-gold",
      "--button-primary",
      "--button-primary-text",
      "--button-secondary-bg",
      "--button-secondary-text",
      "--button-secondary-border",
      "--input-bg",
      "--input-border",
      "--input-text",
      "--input-placeholder",
      "--input-focus-border",
      "--input-focus-glow",
    ] as const;
    for (const key of lightOnly) {
      root.style.removeProperty(key);
    }
    root.style.removeProperty("--foreground");
    root.style.removeProperty("--background");
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--muted-foreground");
  }
}

/**
 * Dark = Solace sanctuary as built (glass, moonlit tokens). Does NOT add global `.dark`
 * overrides that flatten every surface. Light = pastel lavender via data-ezri-theme.
 */
export function applyThemeToDocument(theme: AppearanceTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved: AppearanceTheme = theme === "light" ? "light" : "dark";

  root.classList.remove("dark");
  root.setAttribute("data-ezri-theme", resolved);
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved === "light" ? "light" : "dark";
  applySemanticThemeTokens(resolved);
}
