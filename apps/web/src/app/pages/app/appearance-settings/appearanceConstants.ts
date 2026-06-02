/** Bump when default theme or migration rules change. */
export const APPEARANCE_SETTINGS_VERSION = 4;

export const ACCENT_COLOR_KEYS = ["pink", "purple", "blue", "teal", "green", "orange"] as const;

export type AppearanceTheme = "light" | "dark";

export type AccentColorKey = (typeof ACCENT_COLOR_KEYS)[number];

export const ACCENT_COLOR_MAP: Record<AccentColorKey, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
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

export function applyAccentColorToDocument(accentKey: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = isAccentColorKey(accentKey) ? ACCENT_COLOR_MAP[accentKey] : ACCENT_COLOR_MAP.pink;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--solace-accent", accent);
  const themeAttr = root.getAttribute("data-ezri-theme");
  if (themeAttr !== "light") {
    root.style.setProperty("--solace-purple", accent);
  }
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
